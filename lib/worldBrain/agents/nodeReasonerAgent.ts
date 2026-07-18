/**
 * NodeReasonerAgent — GAME pattern wrapper (Phase 8B + 8D latency controls).
 *
 * Wraps the existing Node Reasoner LLM call in typed, validated,
 * retry-aware agent contract.  The route continues to work unchanged
 * because it unpacks AgentRunResult into the existing response shape.
 *
 * Phase 8D adds: timing logs, compact prompts, hard timeouts,
 * deterministic repair before retry, and skip-retry when enough valid nodes remain.
 */

import crypto from "node:crypto";
import type {
  AgentEnvironmentSnapshot,
  AgentFailureMode,
  AgentMemoryPacket,
  AgentRunInput,
  AgentRunResult,
  AgentStopReason,
} from "./agentTypes";
import {
  buildRetryInstructions,
  filterInvalidNodes,
  validateNodeReasonerOutput,
  type NodeReasonerValidationContext,
} from "./nodeReasonerValidation";
import { buildCompactNodeReasonerContext } from "./compactAgentContext";
import {
  estimateTokenCount,
  elapsedMs,
  isAgentFastMode,
  isAgentTimeoutError,
  logAgentTiming,
  NODE_REASONER_MIN_VALID_TO_SKIP_RETRY,
  nowMs,
  resolveNodeReasonerTimeoutMs,
  withTimeout,
} from "./agentLatency";
import { buildNodeReasonerPrompt } from "../nodeReasonerPrompt";
import { normalizeNodeReasonerOutput } from "../reasonNode";
import { applyQualityGuardToNodeOutput } from "../reasonNode";
import type { NodeReasonerInput, NodeReasonerOutput } from "../nodeReasonerTypes";
import type { LightweightCanonItem } from "../constellationReasonerTypes";
import {
  generateJsonWithLLMFallback,
  resolveDefaultLLMProvider,
  resolveGeminiModel,
} from "@/lib/llm/llmClient";
import { parseGeminiJsonContent } from "../reasonConstellation";

// ─── User-facing copy ──────────────────────────────────────────────────────────

export const NODE_REASONER_FALLBACK_COPY =
  "This path needs one more clue. Try steering it.";

export const NODE_REASONER_INVALID_INPUT_COPY =
  "This node isn't ready to explore yet. Try selecting a different one.";

// ─── Payload type ──────────────────────────────────────────────────────────────

/** Agent-specific payload (goes into AgentRunInput.payload). */
export type NodeReasonerAgentPayload = {
  input: NodeReasonerInput;
  /** Titles of nodes previously rejected by the user — must not reappear. */
  rejectedTitles: string[];
};

// ─── Memory builder ────────────────────────────────────────────────────────────

export function buildNodeReasonerMemory(opts: {
  worldSeed: string;
  worldPurpose: string | null;
  acceptedCanonItems: LightweightCanonItem[];
  rejectedIds: string[];
  activeSteeringText: string | null;
  architectureSummary: string | null;
  neighboringConstellationSummaries?: Array<{ id: string; title: string; role: string }>;
}): AgentMemoryPacket {
  return {
    scope: "constellation",
    worldSeed: opts.worldSeed,
    worldPurpose: opts.worldPurpose,
    acceptedCanonIds: opts.acceptedCanonItems.map((c) => c.id),
    acceptedCanonTitles: opts.acceptedCanonItems.map((c) => c.title),
    rejectedIds: [...opts.rejectedIds],
    activeSteeringText: opts.activeSteeringText,
    architectureSummary: opts.architectureSummary,
    neighboringConstellationSummaries: opts.neighboringConstellationSummaries ?? [],
  };
}

// ─── Environment builder ───────────────────────────────────────────────────────

export function buildNodeReasonerEnvironment(opts: {
  navMode: AgentEnvironmentSnapshot["navMode"];
  evolutionApplyInProgress: boolean;
  canonLocked: boolean;
  totalNodeCount: number;
  totalConstellationCount: number;
  canvasModelVersion?: string | null;
}): AgentEnvironmentSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    canvasModelVersion: opts.canvasModelVersion ?? null,
    totalNodeCount: opts.totalNodeCount,
    totalConstellationCount: opts.totalConstellationCount,
    evolutionApplyInProgress: opts.evolutionApplyInProgress,
    canonLocked: opts.canonLocked,
    navMode: opts.navMode,
  };
}

// ─── Environment guard ─────────────────────────────────────────────────────────

function checkEnvironmentGuard(
  env: AgentEnvironmentSnapshot,
): AgentStopReason | null {
  if (env.evolutionApplyInProgress) return "environment_guard_tripped";
  if (env.canonLocked) return "environment_guard_tripped";
  if (env.navMode !== "discovery") return "environment_guard_tripped";
  return null;
}

// ─── Retry policy ──────────────────────────────────────────────────────────────

/**
 * True when we should spend a second LLM call.
 * Skip retry when enough valid nodes remain after filtering, or in fast mode
 * unless the entire output is empty/unusable.
 */
export function shouldRetryNodeReasoner(opts: {
  validationValid: boolean;
  validNodeCount: number;
  hasStructuralError: boolean;
  timedOut: boolean;
  fastMode: boolean;
}): boolean {
  if (opts.timedOut) return false;
  if (opts.validationValid) return false;
  if (opts.fastMode && opts.validNodeCount >= 1) return false;
  if (
    !opts.hasStructuralError &&
    opts.validNodeCount >= NODE_REASONER_MIN_VALID_TO_SKIP_RETRY
  ) {
    return false;
  }
  // Retry only when we don't have enough usable nodes yet
  return opts.validNodeCount < NODE_REASONER_MIN_VALID_TO_SKIP_RETRY;
}

function hasStructuralNodeErrors(
  validation: { issues: Array<{ field: string; severity: string }> },
): boolean {
  return validation.issues.some(
    (i) =>
      i.severity === "error" &&
      (i.field === "sourceNodeId" ||
        i.field === "sourceConstellationId" ||
        i.field === "possibleNewNodes"),
  );
}

// ─── Single LLM attempt ────────────────────────────────────────────────────────

async function runOneLLMAttempt(
  input: NodeReasonerInput,
  retryAddendum: string,
  signal?: AbortSignal,
): Promise<{
  output: NodeReasonerOutput;
  promptBuildMs: number;
  promptChars: number;
  estimatedTokens: number;
  llmMs: number;
  parseMs: number;
}> {
  const compact = buildCompactNodeReasonerContext(input);

  const promptBuildStart = nowMs();
  const basePrompt = buildNodeReasonerPrompt(compact);
  const prompt = retryAddendum ? `${basePrompt}\n\n${retryAddendum}` : basePrompt;
  const promptBuildMs = elapsedMs(promptBuildStart);
  const promptChars = prompt.length;
  const estimatedTokens = estimateTokenCount(prompt);

  const llmStart = nowMs();
  const result = await generateJsonWithLLMFallback({
    provider: resolveDefaultLLMProvider(),
    model: resolveGeminiModel(),
    prompt,
    temperature: 0.7,
    responseMimeType: "application/json",
    signal,
  });
  const llmMs = elapsedMs(llmStart);

  const parseStart = nowMs();
  let parsed: unknown;
  try {
    parsed = parseGeminiJsonContent(result.text);
  } catch (e) {
    throw new Error(`JSON parse failed (${result.provider}/${result.model}): ${String(e)}`);
  }

  const normalized = normalizeNodeReasonerOutput(parsed, input);
  if (!normalized) {
    throw new Error(`Invalid output shape from ${result.provider}/${result.model}`);
  }

  const guarded = applyQualityGuardToNodeOutput(normalized, input);
  const parseMs = elapsedMs(parseStart);

  return {
    output: guarded,
    promptBuildMs,
    promptChars,
    estimatedTokens,
    llmMs,
    parseMs,
  };
}

// ─── Failure builder ───────────────────────────────────────────────────────────

function buildFailure(
  category: AgentFailureMode["category"],
  internalDetail: string,
  userMessage: string = NODE_REASONER_FALLBACK_COPY,
  retryable = true,
  recoveryHint = "Wait for canvas to settle, then try Explore Deeper again.",
): AgentFailureMode {
  return { category, userMessage, internalDetail, retryable, recoveryHint };
}

function fallbackResult(
  runId: string,
  attemptNumber: number,
  stopReason: AgentStopReason | null,
  failure: AgentFailureMode,
  validationSummary: string,
): AgentRunResult<NodeReasonerOutput> {
  return {
    agentId: "NodeReasonerAgent",
    runId,
    status: "fallback",
    output: null,
    validation: { valid: false, issues: [], summary: validationSummary },
    failure,
    stopReason,
    completedAt: new Date().toISOString(),
    attemptNumber,
    userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
  };
}

// ─── Main agent runner ─────────────────────────────────────────────────────────

export async function runNodeReasonerAgent(
  agentInput: AgentRunInput<NodeReasonerAgentPayload>,
): Promise<AgentRunResult<NodeReasonerOutput>> {
  const runId = agentInput.runId;
  const { input, rejectedTitles } = agentInput.payload;
  const { memory, environment } = agentInput;
  const routeStart = nowMs();
  const fastMode = isAgentFastMode();
  const hardTimeoutMs = resolveNodeReasonerTimeoutMs();
  const abortController = new AbortController();

  let retryUsed = false;
  let promptChars = 0;
  let estimatedTokens = 0;
  let promptBuildMs = 0;
  let llmMs = 0;
  let parseMs = 0;
  let validationMs = 0;
  let attemptNumber = 0;

  const logTiming = (extra: Record<string, string | number | boolean | null | undefined>) => {
    logAgentTiming("[node-reasoner:timing]", {
      requestId: runId,
      selectedNodeId: input.selectedNode.id,
      selectedNodeTitle: input.selectedNode.displayTitle || input.selectedNode.title,
      promptBuildMs,
      promptChars,
      estimatedTokens,
      llmMs,
      parseMs,
      validationMs,
      retryUsed,
      totalRouteMs: elapsedMs(routeStart),
      fastMode,
      hardTimeoutMs,
      ...extra,
    });
  };

  // ── E: Environment guard ────────────────────────────────────────────────────
  const guardStop = checkEnvironmentGuard(environment);
  if (guardStop) {
    logTiming({ agentStatus: "failed", outputNodeCount: 0, stopReason: guardStop });
    return {
      agentId: "NodeReasonerAgent",
      runId,
      status: "failed",
      output: null,
      validation: { valid: false, issues: [], summary: "Environment guard tripped." },
      failure: buildFailure(
        "environment_locked",
        `Environment guard: ${guardStop} (navMode=${environment.navMode}, applyInProgress=${environment.evolutionApplyInProgress}, canonLocked=${environment.canonLocked})`,
        NODE_REASONER_FALLBACK_COPY,
        false,
        "Wait for canvas operations to complete before exploring deeper.",
      ),
      stopReason: guardStop,
      completedAt: new Date().toISOString(),
      attemptNumber: 0,
      userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
    };
  }

  const validationCtx: NodeReasonerValidationContext = {
    rejectedIds: memory.rejectedIds,
    rejectedTitles,
    acceptedCanonTitles: memory.acceptedCanonTitles,
    worldSeed: memory.worldSeed,
    parentNodeDescription: input.selectedNode.description ?? "",
    parentNodeId: input.selectedNode.id,
  };

  const runAttempt = (retryAddendum: string) =>
    withTimeout(
      runOneLLMAttempt(input, retryAddendum, abortController.signal),
      Math.max(1_000, hardTimeoutMs - elapsedMs(routeStart)),
      "NodeReasonerAgent",
      abortController,
    );

  // ── Attempt 1 ────────────────────────────────────────────────────────────────
  let attempt1Output: NodeReasonerOutput | null = null;
  let attempt1Error: string | null = null;
  let timedOut = false;

  try {
    attemptNumber = 1;
    const attempt1 = await runAttempt("");
    attempt1Output = attempt1.output;
    promptBuildMs = attempt1.promptBuildMs;
    promptChars = attempt1.promptChars;
    estimatedTokens = attempt1.estimatedTokens;
    llmMs = attempt1.llmMs;
    parseMs = attempt1.parseMs;
  } catch (e) {
    if (isAgentTimeoutError(e)) {
      timedOut = true;
      attempt1Error = e.message;
      logTiming({
        agentStatus: "fallback",
        outputNodeCount: 0,
        timedOut: true,
      });
      return fallbackResult(
        runId,
        1,
        "timeout",
        buildFailure("timeout", attempt1Error, NODE_REASONER_FALLBACK_COPY, false),
        "NodeReasonerAgent timed out.",
      );
    }
    attempt1Error = e instanceof Error ? e.message : String(e);
  }

  if (attempt1Output) {
    const validationStart = nowMs();
    const validation1 = validateNodeReasonerOutput(attempt1Output, input, validationCtx);
    const { filteredOutput, removedNodeIds } = filterInvalidNodes(attempt1Output, validation1);
    const revalidation = validateNodeReasonerOutput(filteredOutput, input, validationCtx);
    validationMs = elapsedMs(validationStart);

    const validCount = filteredOutput.possibleNewNodes.length;
    const structural = hasStructuralNodeErrors(validation1);

    if (validation1.valid) {
      logTiming({
        agentStatus: "success",
        outputNodeCount: attempt1Output.possibleNewNodes.length,
        attemptNumber: 1,
      });
      return {
        agentId: "NodeReasonerAgent",
        runId,
        status: "success",
        output: attempt1Output,
        validation: validation1,
        failure: null,
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 1,
        userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
      };
    }

    // Deterministic repair: keep valid nodes; skip LLM retry when filtered output is usable
    const filteredIsClean = revalidation.valid && validCount > 0;
    const needsRetry =
      !filteredIsClean &&
      shouldRetryNodeReasoner({
        validationValid: false,
        validNodeCount: validCount,
        hasStructuralError: structural && validCount === 0,
        timedOut: false,
        fastMode,
      });

    if ((filteredIsClean || !needsRetry) && validCount > 0) {
      logTiming({
        agentStatus: "success",
        outputNodeCount: validCount,
        attemptNumber: 1,
        skippedRetry: true,
        removedInvalidNodes: removedNodeIds.length,
      });
      return {
        agentId: "NodeReasonerAgent",
        runId,
        status: "success",
        output: filteredOutput,
        validation: revalidation,
        failure: null,
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 1,
        userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
      };
    }

    if (!needsRetry) {
      logTiming({
        agentStatus: "fallback",
        outputNodeCount: 0,
        attemptNumber: 1,
        skippedRetry: true,
      });
      return fallbackResult(
        runId,
        1,
        "max_retries_exceeded",
        buildFailure(
          "validation_error",
          `Insufficient valid nodes after filter (${validCount}). ${validation1.summary}`,
        ),
        validation1.summary,
      );
    }

    // ── Attempt 2 ──────────────────────────────────────────────────────────────
    retryUsed = true;
    const remainingMs = hardTimeoutMs - elapsedMs(routeStart);
    if (remainingMs < 4_000) {
      // Not enough budget for a full second call — use filtered attempt 1 if any
      if (validCount > 0) {
        logTiming({
          agentStatus: "retry",
          outputNodeCount: validCount,
          attemptNumber: 1,
          skippedRetry: true,
          reason: "insufficient_timeout_budget",
        });
        return {
          agentId: "NodeReasonerAgent",
          runId,
          status: "retry",
          output: filteredOutput,
          validation: revalidation,
          failure: buildFailure(
            "validation_error",
            `Skipped retry due to timeout budget. Removed ${removedNodeIds.length} invalid node(s).`,
          ),
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 1,
          userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
        };
      }
      logTiming({ agentStatus: "fallback", outputNodeCount: 0, timedOut: true });
      return fallbackResult(
        runId,
        1,
        "timeout",
        buildFailure("timeout", "Insufficient time remaining for retry", NODE_REASONER_FALLBACK_COPY, false),
        "Timed out before retry.",
      );
    }

    const retryAddendum = buildRetryInstructions(
      validation1,
      attempt1Output.avoidPatterns,
    );

    let attempt2Output: NodeReasonerOutput | null = null;
    let attempt2Error: string | null = null;

    try {
      attemptNumber = 2;
      const attempt2 = await runAttempt(retryAddendum);
      attempt2Output = attempt2.output;
      promptBuildMs += attempt2.promptBuildMs;
      promptChars = Math.max(promptChars, attempt2.promptChars);
      estimatedTokens = Math.max(estimatedTokens, attempt2.estimatedTokens);
      llmMs += attempt2.llmMs;
      parseMs += attempt2.parseMs;
    } catch (e) {
      if (isAgentTimeoutError(e)) {
        timedOut = true;
        // Prefer filtered attempt 1 over hard fallback
        if (validCount > 0) {
          logTiming({
            agentStatus: "retry",
            outputNodeCount: validCount,
            attemptNumber: 2,
            timedOut: true,
          });
          return {
            agentId: "NodeReasonerAgent",
            runId,
            status: "retry",
            output: filteredOutput,
            validation: revalidation,
            failure: buildFailure("timeout", e.message),
            stopReason: "timeout",
            completedAt: new Date().toISOString(),
            attemptNumber: 2,
            userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
          };
        }
        logTiming({ agentStatus: "fallback", outputNodeCount: 0, timedOut: true });
        return fallbackResult(
          runId,
          2,
          "timeout",
          buildFailure("timeout", e.message, NODE_REASONER_FALLBACK_COPY, false),
          "NodeReasonerAgent timed out on retry.",
        );
      }
      attempt2Error = e instanceof Error ? e.message : String(e);
    }

    if (attempt2Output) {
      const validation2Start = nowMs();
      const validation2 = validateNodeReasonerOutput(attempt2Output, input, validationCtx);
      validationMs += elapsedMs(validation2Start);

      if (validation2.valid) {
        logTiming({
          agentStatus: "success",
          outputNodeCount: attempt2Output.possibleNewNodes.length,
          attemptNumber: 2,
        });
        return {
          agentId: "NodeReasonerAgent",
          runId,
          status: "success",
          output: attempt2Output,
          validation: validation2,
          failure: null,
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 2,
          userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
        };
      }

      const filtered2 = filterInvalidNodes(attempt2Output, validation2);
      if (filtered2.filteredOutput.possibleNewNodes.length > 0) {
        const revalidation2 = validateNodeReasonerOutput(
          filtered2.filteredOutput,
          input,
          validationCtx,
        );
        logTiming({
          agentStatus: "retry",
          outputNodeCount: filtered2.filteredOutput.possibleNewNodes.length,
          attemptNumber: 2,
        });
        return {
          agentId: "NodeReasonerAgent",
          runId,
          status: "retry",
          output: filtered2.filteredOutput,
          validation: revalidation2,
          failure: buildFailure(
            "validation_error",
            `Attempt 2 partial: removed ${filtered2.removedNodeIds.length} invalid node(s). Validation: ${validation2.summary}`,
            NODE_REASONER_FALLBACK_COPY,
            false,
            "Some child nodes were filtered. Remaining nodes are usable.",
          ),
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 2,
          userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
        };
      }

      if (validCount > 0) {
        logTiming({
          agentStatus: "retry",
          outputNodeCount: validCount,
          attemptNumber: 2,
        });
        return {
          agentId: "NodeReasonerAgent",
          runId,
          status: "retry",
          output: filteredOutput,
          validation: revalidation,
          failure: buildFailure(
            "validation_error",
            `Attempt 2 invalid; using filtered attempt 1. ${attempt2Error ?? validation2.summary}`,
          ),
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 2,
          userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
        };
      }

      logTiming({ agentStatus: "fallback", outputNodeCount: 0, attemptNumber: 2 });
      return fallbackResult(
        runId,
        2,
        "max_retries_exceeded",
        buildFailure(
          "validation_error",
          `Both attempts produced invalid output. Attempt 2: ${attempt2Error ?? "validation failure"}. Summary: ${validation2.summary}`,
        ),
        validation2.summary,
      );
    }

    // Attempt 2 threw — use filtered attempt 1 if possible
    if (validCount > 0) {
      logTiming({
        agentStatus: "retry",
        outputNodeCount: validCount,
        attemptNumber: 2,
      });
      return {
        agentId: "NodeReasonerAgent",
        runId,
        status: "retry",
        output: filteredOutput,
        validation: revalidation,
        failure: buildFailure(
          "llm_error",
          `Attempt 2 threw: ${attempt2Error ?? "unknown"}. Using filtered attempt 1 (removed ${removedNodeIds.length} nodes).`,
        ),
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 2,
        userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
      };
    }
  }

  logTiming({
    agentStatus: "fallback",
    outputNodeCount: 0,
    attemptNumber,
    timedOut,
  });

  return fallbackResult(
    runId,
    Math.max(attemptNumber, 1),
    "max_retries_exceeded",
    buildFailure(
      attempt1Error?.includes("JSON parse") ? "parse_error" : "llm_error",
      attempt1Error ? `Attempt 1: ${attempt1Error}` : "Attempt 1: null output",
      NODE_REASONER_FALLBACK_COPY,
      false,
      "Check LLM provider configuration and try again.",
    ),
    "All attempts failed or produced null output.",
  );
}

// ─── Convenience: build AgentRunInput from existing route params ──────────────

export function buildNodeReasonerAgentInput(
  input: NodeReasonerInput,
  memory: AgentMemoryPacket,
  environment: AgentEnvironmentSnapshot,
  rejectedTitles: string[],
): AgentRunInput<NodeReasonerAgentPayload> {
  return {
    agentId: "NodeReasonerAgent",
    runId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    memory,
    environment,
    payload: { input, rejectedTitles },
    maxRetries: 2,
  };
}

/**
 * RippleConsequenceAgent — GAME pattern wrapper (Phase 8C + 8D latency controls).
 *
 * Phase 8D adds: timing logs, compact neighborhood prompts, hard timeouts,
 * deterministic repair (trim/downgrade/scrub) before retry, and skip-retry
 * when enough valid operations remain after repair.
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
  buildRippleRetryInstructions,
  downgradeCanonRemovalOperations,
  trimOperationsToRecommendedMax,
  validateRippleConsequenceAgentOutput,
  type RippleConsequenceValidationContext,
} from "./rippleConsequenceValidation";
import { buildCompactRippleContext } from "./compactAgentContext";
import {
  estimateTokenCount,
  elapsedMs,
  isAgentFastMode,
  isAgentTimeoutError,
  logAgentTiming,
  nowMs,
  resolveRippleTimeoutMs,
  RIPPLE_MIN_OPS_TO_SKIP_RETRY,
  withTimeout,
} from "./agentLatency";
import { buildRippleEffectPrompt } from "../rippleEffectPrompt";
import { buildRippleEffectInput } from "../buildRippleEffectPlan";
import { parseRippleEffectOutput } from "../parseRippleEffectOutput";
import type { RippleEffectInput, RippleEffectOutput } from "../rippleEffectTypes";
import type {
  CanonStateSnapshot,
  DecisionEventLog,
  UserDecisionEvent,
} from "../userDecisionTypes";
import type { CanvasWorldModel } from "../mapArchitectureToCanvas";
import type {
  RippleAffectedScope,
  RippleEvaluationMode,
  RippleUserSteering,
} from "../rippleEffectTypes";
import {
  generateJsonWithLLMFallback,
  hasGeminiApiKey,
  hasOpenRouterApiKey,
  resolveDefaultLLMProvider,
  resolveGeminiModel,
} from "@/lib/llm/llmClient";

// ─── User-facing copy ──────────────────────────────────────────────────────────

export const RIPPLE_AGENT_FALLBACK_COPY =
  "This truth has been added. The world needs a little more context before it changes.";

export const RIPPLE_AGENT_NO_KEY_COPY =
  "This truth has been added. World changes require an active connection.";

// ─── Payload type ──────────────────────────────────────────────────────────────

export type RippleConsequenceAgentPayload = {
  triggerEvent: UserDecisionEvent;
  decisionLog: DecisionEventLog;
  canvasModel: CanvasWorldModel;
  activeCanonState: CanonStateSnapshot;
  affectedScopeHint?: RippleAffectedScope;
  userSteering?: RippleUserSteering;
  evaluationMode?: RippleEvaluationMode;
};

// ─── Memory / environment builders ─────────────────────────────────────────────

export function buildRippleConsequenceMemory(opts: {
  worldSeed: string;
  worldPurpose: string | null;
  truthCanonIds: string[];
  truthCanonTitles: string[];
  rejectedIds: string[];
  activeSteeringText: string | null;
  architectureSummary: string | null;
}): AgentMemoryPacket {
  return {
    scope: "world",
    worldSeed: opts.worldSeed,
    worldPurpose: opts.worldPurpose,
    acceptedCanonIds: opts.truthCanonIds,
    acceptedCanonTitles: opts.truthCanonTitles,
    rejectedIds: opts.rejectedIds,
    activeSteeringText: opts.activeSteeringText,
    architectureSummary: opts.architectureSummary,
    neighboringConstellationSummaries: [],
  };
}

export function buildRippleConsequenceEnvironment(opts: {
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

function checkEnvironmentGuard(
  env: AgentEnvironmentSnapshot,
): AgentStopReason | null {
  if (env.evolutionApplyInProgress) return "environment_guard_tripped";
  return null;
}

// ─── Deterministic repair + retry policy ───────────────────────────────────────

const BACKEND_TERM_SCRUBS: Array<[RegExp, string]> = [
  [/\bthis operation\b/gi, "this change"],
  [/\boperation\b/gi, "change"],
  [/\bapply plan\b/gi, "suggested changes"],
  [/\bdry[\s-]?run\b/gi, "review"],
  [/\bpatch\b/gi, "update"],
  [/\bblocker\b/gi, "conflict"],
  [/\bvalidation\b/gi, "check"],
];

/** Scrub backend jargon from creator-facing copy. Exported for tests. */
export function scrubBackendTerms(text: string): string {
  let out = text;
  for (const [pattern, replacement] of BACKEND_TERM_SCRUBS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Apply deterministic repairs that avoid a second LLM call when possible:
 * - downgrade unsafe canon removals
 * - trim to top 3–5 operations
 * - ensure / scrub user-facing copy
 */
export function repairRippleOutputDeterministically(
  output: RippleEffectOutput,
  truthCanonIds: string[],
): RippleEffectOutput {
  const { patchedOutput } = downgradeCanonRemovalOperations(output, truthCanonIds);
  const trimmed = trimOperationsToRecommendedMax(patchedOutput);
  return ensureUserFacingCopy(trimmed);
}

/**
 * Retry only on hard failures that deterministic repair cannot fix.
 */
export function shouldRetryRippleConsequence(opts: {
  validationValid: boolean;
  operationCount: number;
  hasHardErrorsAfterRepair: boolean;
  timedOut: boolean;
  fastMode: boolean;
  onlySoftOrRepairableErrors: boolean;
}): boolean {
  if (opts.timedOut) return false;
  if (opts.validationValid) return false;
  if (opts.fastMode && opts.operationCount >= RIPPLE_MIN_OPS_TO_SKIP_RETRY) return false;
  if (!opts.hasHardErrorsAfterRepair) return false;
  if (opts.onlySoftOrRepairableErrors && opts.operationCount >= RIPPLE_MIN_OPS_TO_SKIP_RETRY) {
    return false;
  }
  return opts.hasHardErrorsAfterRepair;
}

function isRepairableOrSoftError(field: string): boolean {
  return (
    field === "suggestedOperations" ||
    field === "userFacingSummary" ||
    field.startsWith("userFacingBullets") ||
    field === "preservedElements" ||
    field === "summary"
  );
}

// ─── LLM attempt ──────────────────────────────────────────────────────────────

async function runOneRippleLLMAttempt(
  input: RippleEffectInput,
  retryAddendum: string,
  signal?: AbortSignal,
): Promise<{
  output: RippleEffectOutput;
  promptBuildMs: number;
  promptChars: number;
  estimatedTokens: number;
  llmMs: number;
  parseMs: number;
  compactNodeCount: number;
  compactConstellationCount: number;
}> {
  const resolvedInput = buildRippleEffectInput({
    triggerEvent: input.triggerEvent,
    decisionLog: input.decisionLog,
    canvasModel: input.canvasModel,
    activeCanonState: input.activeCanonState,
    affectedScopeHint: input.affectedScopeHint,
    userSteering: input.userSteering,
    evaluationMode: input.evaluationMode,
  });

  const { input: compactInput, stats } = buildCompactRippleContext(resolvedInput);

  const promptBuildStart = nowMs();
  const basePrompt = buildRippleEffectPrompt(compactInput);
  const prompt = retryAddendum ? `${basePrompt}\n\n${retryAddendum}` : basePrompt;
  const promptBuildMs = elapsedMs(promptBuildStart);
  const promptChars = prompt.length;
  const estimatedTokens = estimateTokenCount(prompt);

  const llmStart = nowMs();
  const llmResult = await generateJsonWithLLMFallback({
    provider: resolveDefaultLLMProvider(),
    model: resolveGeminiModel(),
    prompt,
    temperature: 0.4,
    responseMimeType: "application/json",
    signal,
  });
  const llmMs = elapsedMs(llmStart);

  const parseStart = nowMs();
  const parseResult = parseRippleEffectOutput(llmResult.text, {
    fallbackTriggerEventId: input.triggerEvent.id,
  });
  const parseMs = elapsedMs(parseStart);

  if (!parseResult.success || !parseResult.output) {
    const errSummary = parseResult.errors.slice(0, 2).join("; ");
    throw new Error(`Parse/validate failed (${llmResult.provider}/${llmResult.model}): ${errSummary}`);
  }

  return {
    output: parseResult.output,
    promptBuildMs,
    promptChars,
    estimatedTokens,
    llmMs,
    parseMs,
    compactNodeCount: stats.nodeCount,
    compactConstellationCount: stats.constellationCount,
  };
}

// ─── Failure / copy helpers ────────────────────────────────────────────────────

function buildFailure(
  category: AgentFailureMode["category"],
  internalDetail: string,
  userMessage: string = RIPPLE_AGENT_FALLBACK_COPY,
  retryable = true,
  recoveryHint = "The truth was saved. Try Explore Deeper for related paths.",
): AgentFailureMode {
  return { category, userMessage, internalDetail, retryable, recoveryHint };
}

function ensureUserFacingCopy(output: RippleEffectOutput): RippleEffectOutput {
  const hasUFS = output.userFacingSummary && output.userFacingSummary.trim().length >= 20;
  const hasUFB = Array.isArray(output.userFacingBullets) && output.userFacingBullets.length > 0;

  let summary = hasUFS
    ? output.userFacingSummary!
    : output.summary || RIPPLE_AGENT_FALLBACK_COPY;

  summary = scrubBackendTerms(summary);

  const bullets: string[] = hasUFB
    ? output.userFacingBullets!.map(scrubBackendTerms)
    : output.suggestedOperations
        .slice(0, 4)
        .map((op) => {
          const verb = operationVerb(op.operationType);
          const target = op.payload?.["proposedTitle"]
            ? String(op.payload["proposedTitle"])
            : op.target.id;
          const cleanReason = scrubBackendTerms(op.reason || "").slice(0, 120);
          return `${verb} ${target}.${cleanReason ? ` ${cleanReason}` : ""}`.trim();
        })
        .filter(Boolean);

  return { ...output, userFacingSummary: summary, userFacingBullets: bullets };
}

function operationVerb(opType: string): string {
  switch (opType) {
    case "strengthen_node": return "This makes";
    case "weaken_node": return "This weakens";
    case "remove_node": return "This removes";
    case "modify_node": return "This updates";
    case "generate_new_node": return "This may introduce";
    case "refocus_constellation": return "This affects";
    case "ask_user_clarification": return "This needs clarification about";
    case "mark_for_critic_review": return "This needs review because it touches";
    default: return "This changes";
  }
}

function fallbackResult(
  runId: string,
  attemptNumber: number,
  stopReason: AgentStopReason | null,
  failure: AgentFailureMode,
): AgentRunResult<RippleEffectOutput> {
  return {
    agentId: "RippleConsequenceAgent",
    runId,
    status: "fallback",
    output: null,
    validation: { valid: false, issues: [], summary: failure.internalDetail },
    failure,
    stopReason,
    completedAt: new Date().toISOString(),
    attemptNumber,
    userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
  };
}

// ─── Main agent runner ─────────────────────────────────────────────────────────

export async function runRippleConsequenceAgent(
  agentInput: AgentRunInput<RippleConsequenceAgentPayload>,
): Promise<AgentRunResult<RippleEffectOutput>> {
  const { payload, memory, environment, runId } = agentInput;
  const routeStart = nowMs();
  const fastMode = isAgentFastMode();
  const hardTimeoutMs = resolveRippleTimeoutMs();
  const abortController = new AbortController();

  let retryUsed = false;
  let promptChars = 0;
  let estimatedTokens = 0;
  let promptBuildMs = 0;
  let llmMs = 0;
  let parseMs = 0;
  let validationMs = 0;
  let attemptNumber = 0;
  let compactNodeCount = 0;
  let compactConstellationCount = 0;

  const validationCtx: RippleConsequenceValidationContext = {
    truthCanonIds: memory.acceptedCanonIds,
    triggerEventId: payload.triggerEvent.id,
  };

  const logTiming = (extra: Record<string, string | number | boolean | null | undefined>) => {
    logAgentTiming("[ripple-effect:timing]", {
      requestId: runId,
      triggerDecisionId: payload.triggerEvent.id,
      triggerNodeTitle:
        payload.triggerEvent.target.displayTitle || payload.triggerEvent.target.title,
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
      compactNodeCount,
      compactConstellationCount,
      ...extra,
    });
  };

  const guardStop = checkEnvironmentGuard(environment);
  if (guardStop) {
    logTiming({ agentStatus: "failed", operationCount: 0, stopReason: guardStop });
    return {
      agentId: "RippleConsequenceAgent",
      runId,
      status: "failed",
      output: null,
      validation: { valid: false, issues: [], summary: "Environment guard tripped." },
      failure: buildFailure(
        "environment_locked",
        `Environment guard: ${guardStop} (applyInProgress=${environment.evolutionApplyInProgress})`,
        RIPPLE_AGENT_FALLBACK_COPY,
        false,
        "Wait for world evolution apply to complete before evaluating ripple.",
      ),
      stopReason: guardStop,
      completedAt: new Date().toISOString(),
      attemptNumber: 0,
      userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
    };
  }

  if (!hasGeminiApiKey() && !hasOpenRouterApiKey()) {
    logTiming({ agentStatus: "failed", operationCount: 0 });
    return {
      agentId: "RippleConsequenceAgent",
      runId,
      status: "failed",
      output: null,
      validation: { valid: false, issues: [], summary: "No LLM provider configured." },
      failure: buildFailure(
        "llm_error",
        "Missing GEMINI_API_KEY or OPENROUTER_API_KEY",
        RIPPLE_AGENT_NO_KEY_COPY,
        false,
        "Configure an LLM provider API key.",
      ),
      stopReason: null,
      completedAt: new Date().toISOString(),
      attemptNumber: 0,
      userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
    };
  }

  const rippleInput: RippleEffectInput = {
    triggerEvent: payload.triggerEvent,
    decisionLog: payload.decisionLog,
    canvasModel: payload.canvasModel,
    activeCanonState: payload.activeCanonState,
    affectedScopeHint: payload.affectedScopeHint,
    userSteering: payload.userSteering,
    evaluationMode: payload.evaluationMode,
  };

  const runAttempt = (retryAddendum: string) =>
    withTimeout(
      runOneRippleLLMAttempt(rippleInput, retryAddendum, abortController.signal),
      Math.max(1_000, hardTimeoutMs - elapsedMs(routeStart)),
      "RippleConsequenceAgent",
      abortController,
    );

  // ── Attempt 1 ────────────────────────────────────────────────────────────────
  let attempt1Output: RippleEffectOutput | null = null;
  let attempt1Error: string | null = null;

  try {
    attemptNumber = 1;
    const attempt1 = await runAttempt("");
    attempt1Output = attempt1.output;
    promptBuildMs = attempt1.promptBuildMs;
    promptChars = attempt1.promptChars;
    estimatedTokens = attempt1.estimatedTokens;
    llmMs = attempt1.llmMs;
    parseMs = attempt1.parseMs;
    compactNodeCount = attempt1.compactNodeCount;
    compactConstellationCount = attempt1.compactConstellationCount;
  } catch (e) {
    if (isAgentTimeoutError(e)) {
      logTiming({ agentStatus: "fallback", operationCount: 0, timedOut: true });
      return fallbackResult(
        runId,
        1,
        "timeout",
        buildFailure("timeout", e.message, RIPPLE_AGENT_FALLBACK_COPY, false),
      );
    }
    attempt1Error = e instanceof Error ? e.message : String(e);
  }

  if (attempt1Output) {
    const validationStart = nowMs();
    const repaired1 = repairRippleOutputDeterministically(
      attempt1Output,
      validationCtx.truthCanonIds,
    );
    const validation1 = validateRippleConsequenceAgentOutput(
      repaired1,
      rippleInput,
      validationCtx,
    );
    validationMs = elapsedMs(validationStart);

    if (validation1.valid) {
      logTiming({
        agentStatus: "success",
        operationCount: repaired1.suggestedOperations.length,
        attemptNumber: 1,
      });
      return {
        agentId: "RippleConsequenceAgent",
        runId,
        status: "success",
        output: repaired1,
        validation: validation1,
        failure: null,
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 1,
        userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
      };
    }

    const hardErrors = validation1.issues.filter((i) => i.severity === "error");
    const onlySoftOrRepairable =
      hardErrors.length === 0 ||
      hardErrors.every((e) => isRepairableOrSoftError(e.field));
    const opCount = repaired1.suggestedOperations.length;

    const needsRetry = shouldRetryRippleConsequence({
      validationValid: false,
      operationCount: opCount,
      hasHardErrorsAfterRepair: hardErrors.length > 0 && !onlySoftOrRepairable,
      timedOut: false,
      fastMode,
      onlySoftOrRepairableErrors: onlySoftOrRepairable,
    });

    // Accept repaired output when we have usable ops and no non-repairable hard errors
    if (!needsRetry && opCount >= RIPPLE_MIN_OPS_TO_SKIP_RETRY) {
      logTiming({
        agentStatus: "success",
        operationCount: opCount,
        attemptNumber: 1,
        skippedRetry: true,
      });
      return {
        agentId: "RippleConsequenceAgent",
        runId,
        status: "success",
        output: repaired1,
        validation: validation1,
        failure: null,
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 1,
        userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
      };
    }

    if (!needsRetry) {
      logTiming({ agentStatus: "fallback", operationCount: 0, skippedRetry: true });
      return fallbackResult(
        runId,
        1,
        "validation_hard_failure",
        buildFailure("validation_error", validation1.summary),
      );
    }

    // ── Attempt 2 ──────────────────────────────────────────────────────────────
    retryUsed = true;
    const remainingMs = hardTimeoutMs - elapsedMs(routeStart);
    if (remainingMs < 5_000) {
      if (opCount > 0) {
        logTiming({
          agentStatus: "retry",
          operationCount: opCount,
          skippedRetry: true,
          reason: "insufficient_timeout_budget",
        });
        return {
          agentId: "RippleConsequenceAgent",
          runId,
          status: "retry",
          output: repaired1,
          validation: validation1,
          failure: buildFailure(
            "validation_error",
            `Skipped retry due to timeout budget. ${validation1.summary}`,
          ),
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 1,
          userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
        };
      }
      logTiming({ agentStatus: "fallback", operationCount: 0, timedOut: true });
      return fallbackResult(
        runId,
        1,
        "timeout",
        buildFailure("timeout", "Insufficient time remaining for retry", RIPPLE_AGENT_FALLBACK_COPY, false),
      );
    }

    const retryAddendum = buildRippleRetryInstructions(
      validation1,
      validationCtx.truthCanonIds,
    );

    let attempt2Output: RippleEffectOutput | null = null;
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
        if (opCount > 0) {
          logTiming({
            agentStatus: "retry",
            operationCount: opCount,
            timedOut: true,
            attemptNumber: 2,
          });
          return {
            agentId: "RippleConsequenceAgent",
            runId,
            status: "retry",
            output: repaired1,
            validation: validation1,
            failure: buildFailure("timeout", e.message),
            stopReason: "timeout",
            completedAt: new Date().toISOString(),
            attemptNumber: 2,
            userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
          };
        }
        logTiming({ agentStatus: "fallback", operationCount: 0, timedOut: true });
        return fallbackResult(
          runId,
          2,
          "timeout",
          buildFailure("timeout", e.message, RIPPLE_AGENT_FALLBACK_COPY, false),
        );
      }
      attempt2Error = e instanceof Error ? e.message : String(e);
    }

    if (attempt2Output) {
      const validation2Start = nowMs();
      const repaired2 = repairRippleOutputDeterministically(
        attempt2Output,
        validationCtx.truthCanonIds,
      );
      const validation2 = validateRippleConsequenceAgentOutput(
        repaired2,
        rippleInput,
        validationCtx,
      );
      validationMs += elapsedMs(validation2Start);

      if (validation2.valid || repaired2.suggestedOperations.length > 0) {
        logTiming({
          agentStatus: validation2.valid ? "success" : "retry",
          operationCount: repaired2.suggestedOperations.length,
          attemptNumber: 2,
        });
        return {
          agentId: "RippleConsequenceAgent",
          runId,
          status: validation2.valid ? "success" : "retry",
          output: repaired2,
          validation: validation2,
          failure: validation2.valid
            ? null
            : buildFailure(
                "validation_error",
                `Attempt 2 partial: ${validation2.summary}`,
                RIPPLE_AGENT_FALLBACK_COPY,
                false,
              ),
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 2,
          userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
        };
      }
    }

    if (opCount > 0) {
      logTiming({
        agentStatus: "retry",
        operationCount: opCount,
        attemptNumber: 2,
      });
      return {
        agentId: "RippleConsequenceAgent",
        runId,
        status: "retry",
        output: repaired1,
        validation: validation1,
        failure: buildFailure(
          attempt2Error?.includes("Parse") ? "parse_error" : "llm_error",
          `Attempt 2 failed: ${attempt2Error ?? "null output"}. Using repaired attempt 1.`,
        ),
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 2,
        userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
      };
    }
  }

  logTiming({ agentStatus: "fallback", operationCount: 0, attemptNumber });
  return fallbackResult(
    runId,
    Math.max(attemptNumber, 1),
    "max_retries_exceeded",
    buildFailure(
      attempt1Error?.includes("Parse") ? "parse_error" : "llm_error",
      attempt1Error ?? "Attempt 1 produced null output",
      RIPPLE_AGENT_FALLBACK_COPY,
      false,
    ),
  );
}

export function buildRippleConsequenceAgentInput(
  payload: RippleConsequenceAgentPayload,
  memory: AgentMemoryPacket,
  environment: AgentEnvironmentSnapshot,
): AgentRunInput<RippleConsequenceAgentPayload> {
  return {
    agentId: "RippleConsequenceAgent",
    runId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    memory,
    environment,
    payload,
    maxRetries: 2,
  };
}

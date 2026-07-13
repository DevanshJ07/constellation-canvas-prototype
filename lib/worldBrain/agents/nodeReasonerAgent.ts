/**
 * NodeReasonerAgent — GAME pattern wrapper (Phase 8B).
 *
 * Wraps the existing Node Reasoner LLM call in typed, validated,
 * retry-aware agent contract.  The route continues to work unchanged
 * because it unpacks AgentRunResult into the existing response shape.
 *
 * G — Goal: generate concrete, context-preserving child nodes anchored to the selected parent.
 * A — Actions: inspect_parent_node, inspect_constellation_context, inspect_canon_memory,
 *              inspect_rejected_memory, generate_child_nodes, validate_specificity,
 *              validate_continuity, return_fallback
 * M — Memory: explicit AgentMemoryPacket (world seed, canon, rejected, steering)
 * E — Environment: nav mode, selected node/constellation, canvas generation lock
 *
 * Forbidden:
 *   mutate_canvas | alter_canon | ignore_parent_context |
 *   repeat_rejected_ideas | generate_unrelated_world_areas |
 *   produce_vague_category_labels
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
import { buildNodeReasonerPrompt } from "../nodeReasonerPrompt";
import { normalizeNodeReasonerOutput } from "../reasonNode";
import { applyQualityGuardToNodeOutput } from "../reasonNode";
import type { NodeReasonerInput, NodeReasonerOutput } from "../nodeReasonerTypes";
import type { LightweightCanonItem } from "../constellationReasonerTypes";
import {
  generateJsonWithLLMFallback,
  hasGeminiApiKey,
  hasOpenRouterApiKey,
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

/**
 * Build an explicit AgentMemoryPacket for the Node Reasoner.
 * Callers (route or ConstellationCanvas) must provide all fields —
 * nothing is read from ambient state inside the agent.
 */
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

/**
 * Build the environment snapshot for the Node Reasoner.
 * Callers must pass current nav state and canvas flags.
 */
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

// ─── Single LLM attempt ────────────────────────────────────────────────────────

async function runOneLLMAttempt(
  input: NodeReasonerInput,
  retryAddendum: string,
): Promise<NodeReasonerOutput> {
  const basePrompt = buildNodeReasonerPrompt(input);
  const prompt = retryAddendum ? `${basePrompt}\n\n${retryAddendum}` : basePrompt;

  const result = await generateJsonWithLLMFallback({
    provider: resolveDefaultLLMProvider(),
    model: resolveGeminiModel(),
    prompt,
    temperature: 0.7,
    responseMimeType: "application/json",
  });

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

  // Apply quality guard (shallow description repair) as a post-normalize step.
  return applyQualityGuardToNodeOutput(normalized, input);
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

// ─── Main agent runner ─────────────────────────────────────────────────────────

/**
 * Run the NodeReasonerAgent under the GAME contract.
 *
 * 1. Check environment guard.
 * 2. Attempt #1 — LLM call + normalize + quality guard.
 * 3. Validate output against AgentValidationResult.
 * 4. If validation fails, attempt #2 with retry instructions.
 * 5. After #2, filter out hard-error nodes (partial result acceptable).
 * 6. If no valid nodes remain, return fallback result.
 */
export async function runNodeReasonerAgent(
  agentInput: AgentRunInput<NodeReasonerAgentPayload>,
): Promise<AgentRunResult<NodeReasonerOutput>> {
  const startedAt = agentInput.startedAt;
  const runId = agentInput.runId;
  const { input, rejectedTitles } = agentInput.payload;
  const { memory, environment } = agentInput;

  // ── E: Environment guard ────────────────────────────────────────────────────
  const guardStop = checkEnvironmentGuard(environment);
  if (guardStop) {
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

  // ── Attempt 1 ────────────────────────────────────────────────────────────────
  let attempt1Output: NodeReasonerOutput | null = null;
  let attempt1Error: string | null = null;

  try {
    attempt1Output = await runOneLLMAttempt(input, "");
  } catch (e) {
    attempt1Error = e instanceof Error ? e.message : String(e);
  }

  if (attempt1Output) {
    const validation1 = validateNodeReasonerOutput(attempt1Output, input, validationCtx);

    if (validation1.valid) {
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

    // Validation failed — try once more with repair instructions
    const retryAddendum = buildRetryInstructions(
      validation1,
      attempt1Output.avoidPatterns,
    );

    // ── Attempt 2 ──────────────────────────────────────────────────────────────
    let attempt2Output: NodeReasonerOutput | null = null;
    let attempt2Error: string | null = null;

    try {
      attempt2Output = await runOneLLMAttempt(input, retryAddendum);
    } catch (e) {
      attempt2Error = e instanceof Error ? e.message : String(e);
    }

    if (attempt2Output) {
      const validation2 = validateNodeReasonerOutput(attempt2Output, input, validationCtx);

      if (validation2.valid) {
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

      // Partial recovery: filter out only the invalid nodes
      const { filteredOutput, removedNodeIds } = filterInvalidNodes(attempt2Output, validation2);

      if (filteredOutput.possibleNewNodes.length > 0) {
        const revalidation = validateNodeReasonerOutput(filteredOutput, input, validationCtx);
        return {
          agentId: "NodeReasonerAgent",
          runId,
          status: "retry",
          output: filteredOutput,
          validation: revalidation,
          failure: buildFailure(
            "validation_error",
            `Attempt 2 partial: removed ${removedNodeIds.length} invalid node(s) (${removedNodeIds.join(", ")}). Validation: ${validation2.summary}`,
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

      // Both attempts produced no valid nodes
      return {
        agentId: "NodeReasonerAgent",
        runId,
        status: "fallback",
        output: null,
        validation: validation2,
        failure: buildFailure(
          "validation_error",
          `Both attempts produced invalid output. Attempt 2 error: ${attempt2Error ?? "validation failure"}. Summary: ${validation2.summary}`,
          NODE_REASONER_FALLBACK_COPY,
          false,
          "Retry with a more specific parent node, or use the Steer bar.",
        ),
        stopReason: "max_retries_exceeded",
        completedAt: new Date().toISOString(),
        attemptNumber: 2,
        userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
      };
    }

    // Attempt 2 threw
    // Fall back to filtered attempt 1 output
    const { filteredOutput, removedNodeIds } = filterInvalidNodes(attempt1Output, validation1);
    if (filteredOutput.possibleNewNodes.length > 0) {
      const revalidation = validateNodeReasonerOutput(filteredOutput, input, validationCtx);
      return {
        agentId: "NodeReasonerAgent",
        runId,
        status: "retry",
        output: filteredOutput,
        validation: revalidation,
        failure: buildFailure(
          "llm_error",
          `Attempt 2 threw: ${attempt2Error ?? "unknown"}. Using filtered attempt 1 output (removed ${removedNodeIds.length} nodes).`,
        ),
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 2,
        userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
      };
    }
  }

  // Both attempts threw or produced null
  const internalDetail = [
    attempt1Error ? `Attempt 1: ${attempt1Error}` : "Attempt 1: null output",
  ].join("; ");

  return {
    agentId: "NodeReasonerAgent",
    runId,
    status: "fallback",
    output: null,
    validation: { valid: false, issues: [], summary: "All attempts failed or produced null output." },
    failure: buildFailure(
      attempt1Error?.includes("JSON parse") ? "parse_error" : "llm_error",
      internalDetail,
      NODE_REASONER_FALLBACK_COPY,
      false,
      "Check LLM provider configuration and try again.",
    ),
    stopReason: "max_retries_exceeded",
    completedAt: new Date().toISOString(),
    attemptNumber: 2,
    userFacingFallbackCopy: NODE_REASONER_FALLBACK_COPY,
  };
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

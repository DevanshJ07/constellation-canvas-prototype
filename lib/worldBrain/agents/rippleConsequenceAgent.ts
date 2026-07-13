/**
 * RippleConsequenceAgent — GAME pattern wrapper (Phase 8C).
 *
 * Wraps the existing Ripple Effect LLM call in a typed, validated,
 * retry-aware agent contract. The route continues to work unchanged
 * because it unpacks AgentRunResult into the existing response shape.
 *
 * G — Goal: determine what logically changes when a node is established as truth,
 *           while preserving canon and avoiding random expansion.
 * A — Actions: inspect_trigger_decision, inspect_canon_state, inspect_canvas_neighborhood,
 *              inspect_recent_decisions, identify_affected_constellations,
 *              propose_consequence_operations, preserve_existing_canon,
 *              detect_contradictions, summarize_world_change, return_fallback
 * M — Memory: explicit AgentMemoryPacket (world seed, canon, rejected, steering, decisions)
 * E — Environment: canvas snapshot, nav mode, apply lock, canon lock
 *
 * Forbidden:
 *   mutate_canvas | directly_apply_patches | remove_accepted_canon |
 *   overwrite_user_truth | generate_unrelated_new_areas |
 *   produce_consequences_without_source_rationale |
 *   expose_internal_operation_language_to_user
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

/** Agent-specific payload (goes into AgentRunInput.payload). */
export type RippleConsequenceAgentPayload = {
  triggerEvent: UserDecisionEvent;
  decisionLog: DecisionEventLog;
  canvasModel: CanvasWorldModel;
  activeCanonState: CanonStateSnapshot;
  affectedScopeHint?: RippleAffectedScope;
  userSteering?: RippleUserSteering;
  evaluationMode?: RippleEvaluationMode;
};

// ─── Memory builder ────────────────────────────────────────────────────────────

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

// ─── Environment builder ───────────────────────────────────────────────────────

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

// ─── Environment guard ─────────────────────────────────────────────────────────

function checkEnvironmentGuard(
  env: AgentEnvironmentSnapshot,
): AgentStopReason | null {
  // Ripple can run in discovery or constellation mode — unlike Node Reasoner
  if (env.evolutionApplyInProgress) return "environment_guard_tripped";
  return null;
}

// ─── LLM attempt ──────────────────────────────────────────────────────────────

async function runOneRippleLLMAttempt(
  input: RippleEffectInput,
  retryAddendum: string,
): Promise<RippleEffectOutput> {
  const resolvedInput = buildRippleEffectInput({
    triggerEvent: input.triggerEvent,
    decisionLog: input.decisionLog,
    canvasModel: input.canvasModel,
    activeCanonState: input.activeCanonState,
    affectedScopeHint: input.affectedScopeHint,
    userSteering: input.userSteering,
    evaluationMode: input.evaluationMode,
  });

  const basePrompt = buildRippleEffectPrompt(resolvedInput);
  const prompt = retryAddendum ? `${basePrompt}\n\n${retryAddendum}` : basePrompt;

  const llmResult = await generateJsonWithLLMFallback({
    provider: resolveDefaultLLMProvider(),
    model: resolveGeminiModel(),
    prompt,
    temperature: 0.4,
    responseMimeType: "application/json",
  });

  const parseResult = parseRippleEffectOutput(llmResult.text, {
    fallbackTriggerEventId: input.triggerEvent.id,
  });

  if (!parseResult.success || !parseResult.output) {
    const errSummary = parseResult.errors.slice(0, 2).join("; ");
    throw new Error(`Parse/validate failed (${llmResult.provider}/${llmResult.model}): ${errSummary}`);
  }

  return parseResult.output;
}

// ─── Failure builder ───────────────────────────────────────────────────────────

function buildFailure(
  category: AgentFailureMode["category"],
  internalDetail: string,
  userMessage: string = RIPPLE_AGENT_FALLBACK_COPY,
  retryable = true,
  recoveryHint = "The truth was saved. Try Explore Deeper for related paths.",
): AgentFailureMode {
  return { category, userMessage, internalDetail, retryable, recoveryHint };
}

// ─── Post-processing: inject userFacingSummary if missing ─────────────────────

function ensureUserFacingCopy(output: RippleEffectOutput): RippleEffectOutput {
  const hasUFS = output.userFacingSummary && output.userFacingSummary.trim().length >= 20;
  const hasUFB = Array.isArray(output.userFacingBullets) && output.userFacingBullets.length > 0;

  if (hasUFS && hasUFB) return output;

  // Generate minimal fallback copy from existing data
  const summary = hasUFS
    ? output.userFacingSummary!
    : output.summary
      .replace(/\boperation\b/gi, "change")
      .replace(/\bpatch\b/gi, "update")
      .replace(/\bblocker\b/gi, "conflict")
      .replace(/\bdry[\s-]run\b/gi, "review")
      .replace(/\bvalidation\b/gi, "check");

  const bullets: string[] = hasUFB
    ? output.userFacingBullets!
    : output.suggestedOperations
        .slice(0, 4)
        .map((op) => {
          const verb = operationVerb(op.operationType);
          const target = op.payload?.["proposedTitle"]
            ? String(op.payload["proposedTitle"])
            : op.target.id;
          const cleanReason = (op.reason || "")
            .replace(/\boperation\b/gi, "change")
            .replace(/\bpatch\b/gi, "update")
            .slice(0, 120);
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

// ─── Main agent runner ─────────────────────────────────────────────────────────

/**
 * Run the RippleConsequenceAgent under the GAME contract.
 *
 * 1. Check environment guard.
 * 2. Attempt #1 — LLM call + parse/normalize.
 * 3. Downgrade unsafe canon removals automatically (non-blocking).
 * 4. Validate output against AgentValidationResult.
 * 5. If validation fails, attempt #2 with retry instructions.
 * 6. After #2, trim to recommendedMax if still over limit.
 * 7. If no valid output, return fallback.
 */
export async function runRippleConsequenceAgent(
  agentInput: AgentRunInput<RippleConsequenceAgentPayload>,
): Promise<AgentRunResult<RippleEffectOutput>> {
  const { payload, memory, environment, runId } = agentInput;

  const validationCtx: RippleConsequenceValidationContext = {
    truthCanonIds: memory.acceptedCanonIds,
    triggerEventId: payload.triggerEvent.id,
  };

  // ── E: Environment guard ────────────────────────────────────────────────────
  const guardStop = checkEnvironmentGuard(environment);
  if (guardStop) {
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

  // ── Verify LLM keys ────────────────────────────────────────────────────────
  if (!hasGeminiApiKey() && !hasOpenRouterApiKey()) {
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

  // ── Attempt 1 ────────────────────────────────────────────────────────────────
  let attempt1Output: RippleEffectOutput | null = null;
  let attempt1Error: string | null = null;

  try {
    attempt1Output = await runOneRippleLLMAttempt(rippleInput, "");
  } catch (e) {
    attempt1Error = e instanceof Error ? e.message : String(e);
  }

  if (attempt1Output) {
    // Auto-downgrade unsafe canon removals before validation
    const { patchedOutput: patchedAttempt1, downgradedIds: dg1 } =
      downgradeCanonRemovalOperations(attempt1Output, validationCtx.truthCanonIds);
    if (dg1.length > 0) {
      console.info("[ripple-consequence-agent] Auto-downgraded canon removal ops:", dg1.join(", "));
    }

    // Ensure user-facing copy
    const withUFS1 = ensureUserFacingCopy(patchedAttempt1);

    const validation1 = validateRippleConsequenceAgentOutput(withUFS1, rippleInput, validationCtx);

    if (validation1.valid) {
      return {
        agentId: "RippleConsequenceAgent",
        runId,
        status: "success",
        output: withUFS1,
        validation: validation1,
        failure: null,
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 1,
        userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
      };
    }

    // Build retry instructions for attempt 2
    const retryAddendum = buildRippleRetryInstructions(
      validation1,
      validationCtx.truthCanonIds,
    );

    // ── Attempt 2 ──────────────────────────────────────────────────────────────
    let attempt2Output: RippleEffectOutput | null = null;
    let attempt2Error: string | null = null;

    try {
      attempt2Output = await runOneRippleLLMAttempt(rippleInput, retryAddendum);
    } catch (e) {
      attempt2Error = e instanceof Error ? e.message : String(e);
    }

    if (attempt2Output) {
      const { patchedOutput: patchedAttempt2 } =
        downgradeCanonRemovalOperations(attempt2Output, validationCtx.truthCanonIds);

      // Trim to recommended max if still over
      const trimmedAttempt2 = trimOperationsToRecommendedMax(patchedAttempt2);
      const withUFS2 = ensureUserFacingCopy(trimmedAttempt2);

      const validation2 = validateRippleConsequenceAgentOutput(withUFS2, rippleInput, validationCtx);

      if (validation2.valid) {
        return {
          agentId: "RippleConsequenceAgent",
          runId,
          status: "success",
          output: withUFS2,
          validation: validation2,
          failure: null,
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 2,
          userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
        };
      }

      // Attempt 2 still invalid — use trimmed output as partial result
      // (Better than fallback if there are any usable operations)
      const hasAnyOperations = withUFS2.suggestedOperations.length > 0;
      if (hasAnyOperations) {
        return {
          agentId: "RippleConsequenceAgent",
          runId,
          status: "retry",
          output: withUFS2,
          validation: validation2,
          failure: buildFailure(
            "validation_error",
            `Attempt 2 partial: ${validation2.summary}`,
            RIPPLE_AGENT_FALLBACK_COPY,
            false,
            "Partial output used. Review suggested operations manually.",
          ),
          stopReason: null,
          completedAt: new Date().toISOString(),
          attemptNumber: 2,
          userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
        };
      }
    }

    // Attempt 2 threw or produced empty output — fall back to trimmed attempt 1
    const trimmedAttempt1 = trimOperationsToRecommendedMax(withUFS1);
    if (trimmedAttempt1.suggestedOperations.length > 0) {
      const revalidation = validateRippleConsequenceAgentOutput(trimmedAttempt1, rippleInput, validationCtx);
      return {
        agentId: "RippleConsequenceAgent",
        runId,
        status: "retry",
        output: trimmedAttempt1,
        validation: revalidation,
        failure: buildFailure(
          attempt2Error?.includes("Parse") ? "parse_error" : "llm_error",
          `Attempt 2 failed: ${attempt2Error ?? "null output"}. Using trimmed attempt 1.`,
        ),
        stopReason: null,
        completedAt: new Date().toISOString(),
        attemptNumber: 2,
        userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
      };
    }
  }

  // Both attempts failed entirely
  return {
    agentId: "RippleConsequenceAgent",
    runId,
    status: "fallback",
    output: null,
    validation: { valid: false, issues: [], summary: "All attempts failed or produced null output." },
    failure: buildFailure(
      attempt1Error?.includes("Parse") ? "parse_error" : "llm_error",
      attempt1Error ?? "Attempt 1 produced null output",
      RIPPLE_AGENT_FALLBACK_COPY,
      false,
      "Check LLM provider configuration and try again.",
    ),
    stopReason: "max_retries_exceeded",
    completedAt: new Date().toISOString(),
    attemptNumber: 2,
    userFacingFallbackCopy: RIPPLE_AGENT_FALLBACK_COPY,
  };
}

// ─── Convenience builders ──────────────────────────────────────────────────────

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

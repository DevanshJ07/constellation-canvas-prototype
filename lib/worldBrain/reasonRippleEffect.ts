/**
 * Ripple Effect Engine — LLM reasoner (Phase 4.9).
 *
 * Builds prompt → calls LLM → parses → validates. Does not mutate canvas or apply operations.
 */

import {
  generateJsonWithLLMFallback,
  hasGeminiApiKey,
  hasOpenRouterApiKey,
  isLLMQuotaError,
  LLMClientError,
  resolveDefaultLLMProvider,
  resolveGeminiModel,
  type LLMProvider,
} from "@/lib/llm/llmClient";
import { buildRippleEffectInput } from "@/lib/worldBrain/buildRippleEffectPlan";
import type { RippleEffectValidationResult } from "@/lib/worldBrain/buildRippleEffectPlan";
import {
  parseRippleEffectOutput,
  type ParseRippleEffectOutputResult,
} from "@/lib/worldBrain/parseRippleEffectOutput";
import { buildRippleEffectPrompt } from "@/lib/worldBrain/rippleEffectPrompt";
import type {
  RippleEffectInput,
  RippleEffectOutput,
} from "@/lib/worldBrain/rippleEffectTypes";

const RIPPLE_MODEL = resolveGeminiModel();
const RIPPLE_TEMPERATURE = 0.4;

export type ReasonRippleEffectProviderMetadata = {
  provider: LLMProvider;
  model: string;
  promptLength: number;
};

export type ReasonRippleEffectResult = {
  success: boolean;
  output?: RippleEffectOutput;
  parseResult?: ParseRippleEffectOutputResult;
  providerMetadata?: ReasonRippleEffectProviderMetadata;
  /** Development debugging only — omit from production API responses. */
  rawText?: string;
  errors: string[];
  warnings: string[];
  validationResult?: RippleEffectValidationResult;
};

export type ReasonRippleEffectOptions = {
  includeRawText?: boolean;
};

/** Parses and validates raw LLM text without calling a provider (test boundary). */
export function processRippleEffectLlmText(
  rawText: string,
  triggerEventId: string,
): ReasonRippleEffectResult {
  const parseResult = parseRippleEffectOutput(rawText, {
    fallbackTriggerEventId: triggerEventId,
  });

  return {
    success: parseResult.success,
    output: parseResult.output,
    parseResult,
    errors: [...parseResult.errors],
    warnings: [...parseResult.warnings],
    validationResult: parseResult.validationResult,
  };
}

/**
 * Calls the configured LLM to produce a validated RippleEffectOutput plan.
 * Never mutates input or applies suggested operations.
 */
export async function reasonRippleEffect(
  input: RippleEffectInput,
  options: ReasonRippleEffectOptions = {},
): Promise<ReasonRippleEffectResult> {
  if (!hasGeminiApiKey() && !hasOpenRouterApiKey()) {
    return {
      success: false,
      errors: ["Missing GEMINI_API_KEY or OPENROUTER_API_KEY"],
      warnings: [],
    };
  }

  const rippleInput = buildRippleEffectInput({
    triggerEvent: input.triggerEvent,
    decisionLog: input.decisionLog,
    canvasModel: input.canvasModel,
    activeCanonState: input.activeCanonState,
    affectedScopeHint: input.affectedScopeHint,
    userSteering: input.userSteering,
    evaluationMode: input.evaluationMode,
  });

  const prompt = buildRippleEffectPrompt(rippleInput);
  const triggerEventId = rippleInput.triggerEvent.id;

  let llmResult;
  try {
    llmResult = await generateJsonWithLLMFallback({
      provider: resolveDefaultLLMProvider(),
      model: RIPPLE_MODEL,
      prompt,
      temperature: RIPPLE_TEMPERATURE,
      responseMimeType: "application/json",
    });
  } catch (error) {
    const message =
      error instanceof LLMClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : "LLM call failed";

    if (process.env.NODE_ENV === "development") {
      console.error("[ripple-effect] provider error:", message);
    }

    return {
      success: false,
      errors: [isLLMQuotaError(error) ? `LLM quota/provider error: ${message}` : message],
      warnings: [],
      providerMetadata: error instanceof LLMClientError
        ? {
            provider: error.provider,
            model: error.model,
            promptLength: prompt.length,
          }
        : undefined,
    };
  }

  const processed = processRippleEffectLlmText(llmResult.text, triggerEventId);

  const result: ReasonRippleEffectResult = {
    ...processed,
    providerMetadata: {
      provider: llmResult.provider,
      model: llmResult.model,
      promptLength: prompt.length,
    },
    ...(options.includeRawText || process.env.NODE_ENV === "development"
      ? { rawText: llmResult.text }
      : {}),
  };

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[ripple-effect]",
      JSON.stringify({
        provider: llmResult.provider,
        model: llmResult.model,
        promptLength: prompt.length,
        parseSuccess: result.success,
        validationErrors: result.validationResult?.errors.length ?? 0,
        warningCount: result.warnings.length,
        operationCount: result.output?.suggestedOperations.length ?? 0,
      }),
    );
  }

  return result;
}

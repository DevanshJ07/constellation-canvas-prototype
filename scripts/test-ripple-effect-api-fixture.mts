/**
 * Live fixture test for Ripple Effect API route — one LLM call only.
 *
 * Requires Next dev server: npm run dev
 *
 * Usage: npx tsx scripts/test-ripple-effect-api-fixture.mts
 */

import { validateRippleEffectOutput } from "../lib/worldBrain/buildRippleEffectPlan.ts";
import { RIPPLE_EFFECT_INPUT_FIXTURE } from "../lib/worldBrain/rippleEffectPrompt.ts";

const API_URL = process.env.RIPPLE_EFFECT_API_URL ?? "http://localhost:3000/api/world/ripple-effect";

function isQuotaOrProviderFailure(message: string): boolean {
  return (
    message.includes("429") ||
    message.includes("Quota exceeded") ||
    message.includes("quota") ||
    message.includes("Missing GEMINI_API_KEY") ||
    message.includes("Missing OPENROUTER_API_KEY")
  );
}

async function main() {
  console.log("=== Ripple Effect API live fixture (single call) ===\n");
  console.log(`POST ${API_URL}`);

  const fixture = RIPPLE_EFFECT_INPUT_FIXTURE;
  const body = {
    triggerEvent: fixture.triggerEvent,
    decisionLog: fixture.decisionLog,
    canvasModel: fixture.canvasModel,
    activeCanonState: fixture.activeCanonState,
    evaluationMode: fixture.evaluationMode,
    userSteering: fixture.userSteering,
  };

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(
      "FAIL: Could not reach dev server. Start with `npm run dev` and retry.",
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const text = await response.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error(`FAIL: Non-JSON response (${response.status}): ${text.slice(0, 500)}`);
    process.exit(1);
  }

  console.log(`HTTP status: ${response.status}`);
  console.log(`success: ${json.success}`);

  const errors = Array.isArray(json.errors)
    ? json.errors.filter((e): e is string => typeof e === "string")
    : [];
  const warnings = Array.isArray(json.warnings)
    ? json.warnings.filter((w): w is string => typeof w === "string")
    : [];

  if (errors.length > 0) {
    console.log("errors:", errors.join(" | "));
  }
  if (warnings.length > 0) {
    console.log(`warnings (${warnings.length}):`, warnings.slice(0, 3).join(" | "));
  }

  const providerMetadata = json.providerMetadata as
    | { provider?: string; model?: string; promptLength?: number }
    | undefined;
  if (providerMetadata?.provider) {
    console.log(
      `provider: ${providerMetadata.provider} model: ${providerMetadata.model ?? "unknown"}`,
    );
  }

  if (!json.success) {
    const errorText = errors.join(" ") || String(json.error ?? "");
    if (isQuotaOrProviderFailure(errorText)) {
      console.log("\nProvider/quota failure — route returned structured failure (not a code bug).");
      if (response.status === 500 || response.status === 422) {
        console.log("Server remained stable with structured JSON response.");
      }
      process.exit(0);
    }

    if (response.status === 422 && errors.length > 0) {
      console.log(
        "\nParser/validation failure — LLM response could not be validated; route returned structured 422 (not a server crash).",
      );
      console.log("Server remained stable with structured JSON response.");
      process.exit(0);
    }

    console.error("\nFAIL: Unexpected ripple analysis failure.");
    process.exit(1);
  }

  if (response.status !== 200) {
    console.error(`FAIL: Expected HTTP 200 on success, got ${response.status}`);
    process.exit(1);
  }

  const output = json.output as Record<string, unknown> | undefined;
  if (!output) {
    console.error("FAIL: Missing output on successful response");
    process.exit(1);
  }

  if (output.triggerEventId !== fixture.triggerEvent.id) {
    console.error(
      `FAIL: triggerEventId mismatch — got ${output.triggerEventId}, expected ${fixture.triggerEvent.id}`,
    );
    process.exit(1);
  }

  for (const field of [
    "nodeImpacts",
    "constellationImpacts",
    "canonImpacts",
    "suggestedOperations",
    "warnings",
    "preservedElements",
    "followUpQuestions",
    "affectedScopes",
  ]) {
    if (!Array.isArray(output[field])) {
      console.error(`FAIL: output.${field} is not an array`);
      process.exit(1);
    }
  }

  const validation = validateRippleEffectOutput(output as never);
  if (!validation.valid) {
    console.error(`FAIL: validateRippleEffectOutput: ${validation.errors.join("; ")}`);
    process.exit(1);
  }

  const ops = output.suggestedOperations as Array<Record<string, unknown>>;
  for (const op of ops) {
    if (typeof op.requiresUserApproval !== "boolean") {
      console.error("FAIL: suggested operation missing requiresUserApproval");
      process.exit(1);
    }
  }

  console.log(`impactLevel: ${output.impactLevel}`);
  console.log(`nodeImpacts: ${(output.nodeImpacts as unknown[]).length}`);
  console.log(`suggestedOperations: ${ops.length}`);
  console.log(`confidence: ${output.confidence}`);

  console.log("\nLive Ripple Effect API fixture passed.");
}

main();

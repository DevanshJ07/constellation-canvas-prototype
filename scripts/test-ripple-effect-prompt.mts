/**
 * Manual local test for Ripple Effect prompt builder — no network.
 *
 * Usage: npx tsx scripts/test-ripple-effect-prompt.mts
 */

import {
  RIPPLE_EFFECT_INPUT_FIXTURE,
  buildRippleEffectPrompt,
} from "../lib/worldBrain/rippleEffectPrompt.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log("=== Ripple Effect prompt builder (no network) ===\n");

const prompt = buildRippleEffectPrompt(RIPPLE_EFFECT_INPUT_FIXTURE);

const requiredPhrases = [
  "Ripple Effect Planner",
  "If this decision is now part of the creative state",
  "Do not generate new nodes unless",
  "JSON only",
  "triggerEventId",
  "suggestedOperations",
  "preservedElements",
  "CURRENT CANON STATE",
  "DECISION HISTORY",
  "CURRENT CANVAS SNAPSHOT",
  "compatibility",
  "no_random_expansion",
];

for (const phrase of requiredPhrases) {
  assert(prompt.includes(phrase), `prompt includes: ${phrase}`);
}

assert(prompt.length > 3000, `prompt length > 3000 (${prompt.length})`);
assert(prompt.length < 30000, `prompt length < 30000 (${prompt.length})`);

assert(
  prompt.includes("Private Childhood Memories Traded for Housing Credits") ||
    prompt.includes("Housing Memory Trade"),
  "fixture trigger appears in prompt",
);
assert(prompt.includes("Public Memory Archive"), "fixture canvas nodes appear in prompt");
assert(prompt.includes("memory economy") || prompt.includes("Memory Economy"), "fixture world context");

console.log(`prompt length: ${prompt.length} chars`);
console.log(`fixture trigger: ${RIPPLE_EFFECT_INPUT_FIXTURE.triggerEvent.target.displayTitle}`);
console.log(`evaluation mode: ${RIPPLE_EFFECT_INPUT_FIXTURE.evaluationMode}`);

console.log("\nAll Ripple Effect prompt builder checks passed.");

/**
 * Manual local test for Ripple reasoning rubric — no network.
 *
 * Usage: npx tsx scripts/test-ripple-reasoning-rubric.mts
 */

import {
  RIPPLE_DECISION_BEHAVIOR_RULES,
  RIPPLE_OPERATION_SELECTION_RULES,
  RIPPLE_QUALITY_GATES,
  RIPPLE_REASONING_DIMENSIONS,
  getRippleReasoningRubricForPrompt,
  validateRippleReasoningRubric,
} from "../lib/worldBrain/rippleReasoningRubric.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log("=== Ripple reasoning rubric (no network) ===\n");

const validation = validateRippleReasoningRubric();
assert(validation.valid, `rubric validates: ${validation.errors.join("; ")}`);

assert(RIPPLE_REASONING_DIMENSIONS.length >= 10, "dimensions count >= 10");

const dimensionIds = new Set(RIPPLE_REASONING_DIMENSIONS.map((d) => d.id));
for (const required of [
  "compatibility",
  "scope",
  "canon_preservation",
  "contradiction_detection",
]) {
  assert(dimensionIds.has(required), `includes dimension: ${required}`);
}

const gateIds = new Set(RIPPLE_QUALITY_GATES.map((g) => g.id));
assert(gateIds.has("no_random_expansion"), "quality gate no_random_expansion");
assert(gateIds.has("preserve_user_canon"), "quality gate preserve_user_canon");

const promptExport = getRippleReasoningRubricForPrompt();
assert(promptExport.dimensions.length >= 10, "prompt export includes dimensions");
assert(promptExport.qualityGates.length >= 2, "prompt export includes quality gates");
assert(
  promptExport.compactText.includes("If this is now true"),
  "compactText includes primary question",
);
assert(
  promptExport.compactText.includes("no_random_expansion") ||
    promptExport.qualityGates.some((g) => g.id === "no_random_expansion"),
  "prompt export references quality gates",
);

const preferOps = new Set(
  RIPPLE_OPERATION_SELECTION_RULES.map((r) => r.preferOperation),
);
for (const op of [
  "remove_node",
  "modify_node",
  "generate_new_node",
  "ask_user_clarification",
  "mark_for_critic_review",
]) {
  assert(preferOps.has(op), `operation selection includes ${op}`);
}

const decisions = new Set(RIPPLE_DECISION_BEHAVIOR_RULES.map((r) => r.decision));
for (const decision of ["truth", "potential", "rejected"]) {
  assert(decisions.has(decision), `decision behavior includes ${decision}`);
}

console.log(`dimensions: ${RIPPLE_REASONING_DIMENSIONS.length}`);
console.log(`quality gates: ${RIPPLE_QUALITY_GATES.length}`);
console.log(`operation rules: ${RIPPLE_OPERATION_SELECTION_RULES.length}`);
console.log(`decision behaviors: ${RIPPLE_DECISION_BEHAVIOR_RULES.length}`);
console.log(`compactText length: ${promptExport.compactText.length} chars`);

console.log("\nAll Ripple reasoning rubric checks passed.");

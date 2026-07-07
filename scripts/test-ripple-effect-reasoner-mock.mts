/**
 * No-network test for Ripple reasoner parse boundary (mocked LLM text).
 *
 * Usage: npx tsx scripts/test-ripple-effect-reasoner-mock.mts
 */

import { validateRippleEffectOutput } from "../lib/worldBrain/buildRippleEffectPlan.ts";
import { processRippleEffectLlmText } from "../lib/worldBrain/reasonRippleEffect.ts";
import { RIPPLE_EFFECT_INPUT_FIXTURE } from "../lib/worldBrain/rippleEffectPrompt.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const triggerId = RIPPLE_EFFECT_INPUT_FIXTURE.triggerEvent.id;

const validJson = JSON.stringify({
  triggerEventId: triggerId,
  summary: "Housing memory trade strengthens debt collection and challenges public archive.",
  impactLevel: "moderate",
  affectedScopes: ["node", "constellation", "canon"],
  nodeImpacts: [
    {
      nodeId: "node_childhood_debt_collector",
      constellationId: "constellation_memory_economy",
      impactType: "strengthen",
      reason: "Regulated housing trade legitimizes debt collection.",
      severity: "medium",
      confidence: 0.8,
      suggestedOperationIds: ["ripple_op_strengthen_node_node_childhood_debt_collector_0"],
    },
  ],
  constellationImpacts: [],
  canonImpacts: [
    {
      impactType: "possible_contradiction",
      reason: "Public archive may conflict with private trade unless subsidized.",
      affectedCanonIds: ["node_public_memory_archive"],
      suggestedCanonStateChanges: [],
      confidence: 0.65,
    },
  ],
  suggestedOperations: [
    {
      id: "ripple_op_strengthen_node_node_childhood_debt_collector_0",
      operationType: "strengthen_node",
      target: {
        targetType: "node",
        id: "node_childhood_debt_collector",
        constellationId: "constellation_memory_economy",
      },
      reason: "Debt collector becomes more central to housing economy.",
      priority: "medium",
      requiresUserApproval: true,
    },
  ],
  warnings: [],
  preservedElements: [
    {
      targetType: "node",
      id: "node_housing_memory_trade",
      reason: "Trigger established as truth.",
    },
  ],
  followUpQuestions: [],
  confidence: 0.77,
});

console.log("=== Ripple reasoner mock boundary (no network) ===\n");

const fenced = `\`\`\`json\n${validJson}\n\`\`\``;
const parsed = processRippleEffectLlmText(fenced, triggerId);

assert(parsed.success, `mock LLM text parses: ${parsed.errors.join("; ")}`);
assert(parsed.output?.triggerEventId === triggerId, "triggerEventId preserved");
assert(
  validateRippleEffectOutput(parsed.output!).valid,
  "validation passes on mock output",
);

const invalid = processRippleEffectLlmText("not json at all", triggerId);
assert(!invalid.success, "invalid text fails gracefully");
assert(invalid.errors.length > 0, "invalid text has errors");

console.log("mock parse success:", parsed.success);
console.log("operations:", parsed.output?.suggestedOperations.length);
console.log("invalid parse success:", invalid.success);

console.log("\nAll Ripple reasoner mock checks passed.");

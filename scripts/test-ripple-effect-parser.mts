/**
 * Manual local test for Ripple Effect response parser — no network.
 *
 * Usage: npx tsx scripts/test-ripple-effect-parser.mts
 */

import {
  extractRippleEffectJson,
  normalizeRippleEffectOutput,
  parseRippleEffectOutput,
  repairMissingOperationReferences,
} from "../lib/worldBrain/parseRippleEffectOutput.ts";
import { validateRippleEffectOutput } from "../lib/worldBrain/buildRippleEffectPlan.ts";
import type { RippleEffectOutput } from "../lib/worldBrain/rippleEffectTypes.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const TRIGGER_ID = "decision_establish_truth_node_housing_memory_trade";

function baseOutput(overrides: Partial<RippleEffectOutput> = {}): RippleEffectOutput {
  return {
    triggerEventId: TRIGGER_ID,
    summary: "Memory trade strengthens debt economy nodes.",
    impactLevel: "moderate",
    affectedScopes: ["node", "constellation"],
    nodeImpacts: [],
    constellationImpacts: [],
    canonImpacts: [],
    suggestedOperations: [],
    warnings: [],
    preservedElements: [],
    followUpQuestions: [],
    confidence: 0.8,
    ...overrides,
  };
}

console.log("=== Ripple Effect parser (no network) ===\n");

// 1. Clean valid JSON — sci-fi memory economy
const sciFiJson = JSON.stringify(
  baseOutput({
    nodeImpacts: [
      {
        nodeId: "node_childhood_debt_collector",
        constellationId: "constellation_memory_economy",
        impactType: "strengthen",
        reason: "Housing memory trade legitimizes debt collection.",
        severity: "medium",
        confidence: 0.82,
        suggestedOperationIds: ["ripple_op_strengthen_node_node_childhood_debt_collector_0"],
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
        reason: "Debt collector role becomes central.",
        priority: "medium",
        requiresUserApproval: true,
      },
    ],
  }),
);

const clean = parseRippleEffectOutput(sciFiJson, { fallbackTriggerEventId: TRIGGER_ID });
assert(clean.success, `clean JSON parses: ${clean.errors.join("; ")}`);
assert(clean.output?.nodeImpacts.length === 1, "sci-fi node impact preserved");

// 2. JSON inside markdown fence — romance dream-only
const romanceJson = `\`\`\`json
${JSON.stringify(
  baseOutput({
    summary: "Dream-only rule may require modifying daily meetup node.",
    nodeImpacts: [
      {
        nodeId: "node_dream_meeting_cafe",
        impactType: "require_modification",
        reason: "Daily coffee shop meeting conflicts with dream-only contact.",
        severity: "high",
        confidence: 0.9,
        suggestedOperationIds: [],
      },
    ],
  }),
)}
\`\`\``;

const fenced = parseRippleEffectOutput(romanceJson, { fallbackTriggerEventId: TRIGGER_ID });
assert(fenced.success, "fenced JSON parses");

// 3. JSON with extra prose — comedy map-eating crabs
const comedyWrapped = `Here is the ripple plan:
${JSON.stringify(
  baseOutput({
    summary: "Central crab lore may modify treasure clue nodes.",
    nodeImpacts: [
      {
        nodeId: "node_treasure_x_mark",
        impactType: "inspire_new_node",
        reason: "Half-digested map corners become plausible clues.",
        severity: "medium",
        confidence: 0.72,
        suggestedOperationIds: [],
      },
    ],
  }),
)}
End of analysis.`;

const wrapped = parseRippleEffectOutput(comedyWrapped, { fallbackTriggerEventId: TRIGGER_ID });
assert(wrapped.success, "prose-wrapped JSON parses");

// 4. Missing arrays normalize to empty
const sparse = parseRippleEffectOutput(
  JSON.stringify({ triggerEventId: TRIGGER_ID, summary: "Sparse.", impactLevel: "none" }),
  { fallbackTriggerEventId: TRIGGER_ID },
);
assert(sparse.success, "sparse output parses");
assert(sparse.output?.nodeImpacts.length === 0, "missing arrays → empty nodeImpacts");
assert(sparse.output?.warnings.length === 0, "missing warnings → empty");

// 5. Generates missing operation/warning IDs deterministically
const missingIds = normalizeRippleEffectOutput({
  triggerEventId: TRIGGER_ID,
  summary: "IDs generated.",
  impactLevel: "minor",
  suggestedOperations: [
    {
      operationType: "modify_node",
      target: { targetType: "node", id: "node_public_memory_archive" },
      reason: "Public archive needs subsidy explanation.",
    },
  ],
  warnings: [
    {
      warningType: "canon_conflict",
      message: "Free archive vs scarcity.",
      affectedTargets: [{ targetType: "node", id: "node_public_memory_archive" }],
    },
  ],
});
assert(
  missingIds.output.suggestedOperations[0]!.id.startsWith("ripple_op_modify_node_"),
  "generated operation id",
);
assert(
  missingIds.output.warnings[0]!.id.startsWith("ripple_warning_canon_conflict_"),
  "generated warning id",
);

// 6. Drops invalid operation types
const badOp = normalizeRippleEffectOutput({
  triggerEventId: TRIGGER_ID,
  summary: "Bad op dropped.",
  impactLevel: "none",
  suggestedOperations: [
    {
      operationType: "explode_world",
      target: { targetType: "node", id: "node_x" },
      reason: "invalid",
    },
  ],
});
assert(badOp.output.suggestedOperations.length === 0, "invalid operation type dropped");
assert(badOp.warnings.some((w) => w.includes("invalid operationType")), "warned invalid op");

// 7. Invalid node impact type → needs_review
const badImpact = normalizeRippleEffectOutput({
  triggerEventId: TRIGGER_ID,
  summary: "Impact repaired.",
  impactLevel: "minor",
  nodeImpacts: [
    {
      nodeId: "node_outside_intruder_theory",
      impactType: "totally_invalid",
      reason: "Mystery locked-room weakens outside theory.",
    },
  ],
});
assert(
  badImpact.output.nodeImpacts[0]!.impactType === "needs_review",
  "invalid node impact → needs_review",
);

// 8. Removes missing suggestedOperationIds
const brokenRefs = repairMissingOperationReferences(
  baseOutput({
    nodeImpacts: [
      {
        nodeId: "node_victory_parade",
        impactType: "obsolete",
        reason: "Sports drama missed penalty makes celebration obsolete.",
        severity: "high",
        confidence: 0.88,
        suggestedOperationIds: ["ripple_op_missing_ref"],
      },
    ],
    suggestedOperations: [],
  }),
);
assert(
  brokenRefs.output.nodeImpacts[0]!.suggestedOperationIds.length === 0,
  "missing op refs removed",
);
assert(brokenRefs.warnings.length > 0, "warning recorded for missing refs");

const repairedParse = parseRippleEffectOutput(
  JSON.stringify({
    triggerEventId: TRIGGER_ID,
    summary: "Flow conflict.",
    impactLevel: "minor",
    nodeImpacts: [
      {
        nodeId: "node_victory_parade",
        impactType: "weaken",
        reason: "Missed penalty weakens parade.",
        severity: "medium",
        confidence: 0.7,
        suggestedOperationIds: ["ripple_op_does_not_exist"],
      },
    ],
    suggestedOperations: [],
  }),
  { fallbackTriggerEventId: TRIGGER_ID },
);
assert(repairedParse.success, "parse succeeds after ref repair");
assert(
  repairedParse.output!.nodeImpacts[0]!.suggestedOperationIds.length === 0,
  "parse repairs missing refs",
);

// 9. Completely invalid text → success false
const invalid = parseRippleEffectOutput("This is not JSON at all.", {
  fallbackTriggerEventId: TRIGGER_ID,
});
assert(!invalid.success, "invalid text fails");
assert(invalid.errors.length > 0, "invalid text has errors");

// 10. Bounds confidence to 0–1
const confidence = normalizeRippleEffectOutput({
  triggerEventId: TRIGGER_ID,
  summary: "Bounded.",
  impactLevel: "none",
  confidence: 1.9,
  nodeImpacts: [
    {
      nodeId: "node_estate_partition",
      impactType: "strengthen",
      reason: "Family saga inheritance dispute elevates partition nodes.",
      confidence: -0.2,
    },
  ],
});
assert(confidence.output.confidence === 1, "top-level confidence capped at 1");
assert(confidence.output.nodeImpacts[0]!.confidence === 0, "node confidence floored at 0");

// 11. validateRippleEffectOutput on parsed output
const validation = validateRippleEffectOutput(clean.output!);
assert(validation.valid, `validation passes: ${validation.errors.join("; ")}`);

// extractRippleEffectJson direct
const extracted = extractRippleEffectJson(comedyWrapped);
assert(extracted !== null && typeof extracted === "object", "extract returns object");

// Political fantasy — canon impact in parse
const political = parseRippleEffectOutput(
  JSON.stringify(
    baseOutput({
      canonImpacts: [
        {
          impactType: "possible_contradiction",
          reason: "Broken oath may conflict with court loyalty nodes.",
          affectedCanonIds: ["node_broken_oath_witness"],
          suggestedCanonStateChanges: [],
          confidence: 0.65,
        },
      ],
      suggestedOperations: [
        {
          id: "ripple_op_mark_for_critic_review_node_broken_oath_witness_0",
          operationType: "mark_for_critic_review",
          target: { targetType: "canon_item", id: "node_broken_oath_witness" },
          reason: "Deep canon review needed.",
          priority: "high",
          requiresUserApproval: false,
        },
      ],
    }),
  ),
  { fallbackTriggerEventId: TRIGGER_ID },
);
assert(political.success, "political fantasy canon parse succeeds");

console.log("clean parse node impacts:", clean.output?.nodeImpacts.length);
console.log("invalid parse success:", invalid.success);
console.log("confidence bounded:", confidence.output.confidence);

console.log("\nAll Ripple Effect parser checks passed.");

/**
 * Manual local test for Ripple Effect planning helpers — no network.
 *
 * Usage: npx tsx scripts/test-ripple-effect-planner.mts
 */

import {
  appendDecisionEvent,
  createEmptyDecisionEventLog,
} from "../lib/worldBrain/decisionEventLog.ts";
import {
  buildRippleEffectInput,
  buildRippleOperationId,
  buildRippleWarningId,
  createConstellationRippleImpact,
  createEmptyRippleEffectOutput,
  createNodeRippleImpact,
  createPreservedElementsFromCanonState,
  createRippleSuggestedOperation,
  createRippleWarning,
  planNoOpRippleEffect,
  summarizeRippleEffectOutput,
  validateRippleEffectOutput,
} from "../lib/worldBrain/buildRippleEffectPlan.ts";
import type { CanvasWorldModel } from "../lib/worldBrain/mapArchitectureToCanvas.ts";
import type { UserDecisionEvent } from "../lib/worldBrain/userDecisionTypes.ts";
import type { RippleEffectOutput } from "../lib/worldBrain/rippleEffectTypes.ts";

const FIXED_TS = "2026-07-07T14:00:00.000Z";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makeEvent(
  overrides: Partial<UserDecisionEvent> & Pick<UserDecisionEvent, "id" | "target" | "nodeSnapshot">,
): UserDecisionEvent {
  return {
    eventType: "establish_truth",
    decision: "truth",
    worldContext: { worldPrompt: "fixture", currentPhase: "constellation_exploration" },
    timestamp: FIXED_TS,
    source: "user_click",
    ...overrides,
  };
}

const canvasModel: CanvasWorldModel = {
  worldSeed: "A sci-fi colony where memories are used as currency",
  worldSummary: "Memory debt reshapes class.",
  constellations: [],
  nodes: [],
  agents: [],
  criticAgents: [],
  controlRules: {
    mustPreserve: [],
    mustAvoid: [],
    generationPriorities: [],
    rankingCriteria: [],
    expansionRules: [],
  },
};

console.log("=== Ripple Effect planner helpers (no network) ===\n");

// ── Sci-fi: derive canon from decision log ────────────────────────────────────────

const sciFiTruth = makeEvent({
  id: "decision_establish_truth_node_memory_archive",
  target: {
    targetType: "node",
    id: "node_memory_archive",
    title: "Public Memory Archive",
    displayTitle: "Memory Archive",
    constellationId: "constellation_memory_economy",
  },
  nodeSnapshot: {
    id: "node_memory_archive",
    title: "Public Memory Archive",
    displayTitle: "Memory Archive",
    description: "A civic vault advertised as open to all.",
    constellationId: "constellation_memory_economy",
  },
  decision: "truth",
});

const sciFiPotential = makeEvent({
  id: "decision_keep_potential_node_dream_ticket",
  eventType: "keep_potential",
  decision: "potential",
  target: {
    targetType: "node",
    id: "node_dream_ticket",
    title: "Tomorrow Ticket",
    displayTitle: "Tomorrow Ticket",
    constellationId: "constellation_fated_hearts",
  },
  nodeSnapshot: {
    id: "node_dream_ticket",
    title: "Tomorrow Ticket",
    displayTitle: "Tomorrow Ticket",
    description: "Meet your future self for one hour.",
    constellationId: "constellation_fated_hearts",
  },
});

let log = createEmptyDecisionEventLog();
log = appendDecisionEvent(log, sciFiPotential);
log = appendDecisionEvent(log, sciFiTruth);

const input = buildRippleEffectInput({
  triggerEvent: sciFiTruth,
  decisionLog: log,
  canvasModel,
});

assert(input.activeCanonState.truthCount === 1, "derives truth count from log");
assert(input.activeCanonState.potentialCount === 1, "derives potential count from log");
assert(input.evaluationMode === "balanced", "defaults evaluationMode to balanced");
assert(input.triggerEvent.id === sciFiTruth.id, "preserves triggerEvent");

// ── Empty output shape ────────────────────────────────────────────────────────────

const empty = createEmptyRippleEffectOutput(sciFiTruth);
assert(empty.impactLevel === "none", "empty output impactLevel is none");
assert(empty.confidence === 1, "empty output confidence is 1 (deterministic no-impact)");
assert(empty.triggerEventId === sciFiTruth.id, "empty output links triggerEventId");

// ── ID helpers ────────────────────────────────────────────────────────────────────

assert(
  buildRippleOperationId("modify_node", "node123") === "ripple_op_modify_node_node123_0",
  "operation id format",
);
assert(
  buildRippleWarningId("contradiction", "node123") ===
    "ripple_warning_contradiction_node123_0",
  "warning id format",
);

// ── Factories ─────────────────────────────────────────────────────────────────────

const op = createRippleSuggestedOperation({
  operationType: "weaken_node",
  target: { targetType: "node", id: "node_outside_intruder_theory" },
  reason: "Mystery locked-room evidence weakens outside intruder theory.",
});
assert(op.priority === "medium", "operation default priority");
assert(op.requiresUserApproval === true, "operation default requiresUserApproval");
assert(op.id.startsWith("ripple_op_weaken_node_"), "operation auto id");

const warning = createRippleWarning({
  warningType: "contradiction",
  message: "Sports celebration assumes a winning penalty shot.",
  affectedTargets: [{ targetType: "flow_item", id: "flow_victory_parade" }],
  severity: "high",
});
assert(warning.id.startsWith("ripple_warning_contradiction_"), "warning auto id");

const nodeImpact = createNodeRippleImpact({
  nodeId: "node_map_eating_crabs",
  impactType: "inspire_new_node",
  reason: "Comedy treasure clues may become crab-damaged.",
  confidence: 0.72,
});
assert(nodeImpact.severity === "medium", "node impact default severity");
assert(nodeImpact.confidence === 0.72, "node impact custom confidence");

// ── Canon preservation ────────────────────────────────────────────────────────────

const preserved = createPreservedElementsFromCanonState(input.activeCanonState);
assert(preserved.length === 1, "preserves one truth node");
assert(preserved[0]!.id === "node_memory_archive", "preserves truth node id");

// ── Validation: invalid reference ─────────────────────────────────────────────────

const invalidOutput: RippleEffectOutput = {
  ...empty,
  nodeImpacts: [
    createNodeRippleImpact({
      nodeId: "node_estate_heirloom",
      impactType: "require_modification",
      reason: "Family saga inheritance dispute affects heirloom chain.",
      suggestedOperationIds: ["ripple_op_missing_operation"],
    }),
  ],
  suggestedOperations: [],
};

const invalidResult = validateRippleEffectOutput(invalidOutput);
assert(!invalidResult.valid, "invalid output fails validation");
assert(
  invalidResult.errors.some((e) => e.includes("missing operation id")),
  "reports missing operation reference",
);

// ── Validation: valid output ──────────────────────────────────────────────────────

const validOp = createRippleSuggestedOperation({
  operationType: "modify_node",
  target: {
    targetType: "node",
    id: "node_broken_oath_witness",
    constellationId: "constellation_succession_crisis",
  },
  reason: "Political fantasy oath law shifts court loyalty nodes.",
  priority: "high",
});

const validOutput: RippleEffectOutput = {
  ...empty,
  impactLevel: "minor",
  affectedScopes: ["node", "constellation"],
  nodeImpacts: [
    createNodeRippleImpact({
      nodeId: "node_broken_oath_witness",
      impactType: "strengthen",
      reason: "Broken oath canon strengthens witness nodes.",
      suggestedOperationIds: [validOp.id],
    }),
  ],
  constellationImpacts: [
    createConstellationRippleImpact({
      constellationId: "constellation_succession_crisis",
      impactType: "increase_priority",
      reason: "Oath law becomes central to succession tension.",
    }),
  ],
  suggestedOperations: [validOp],
  warnings: [warning],
  preservedElements: preserved,
  confidence: 0.85,
};

const validResult = validateRippleEffectOutput(validOutput);
assert(validResult.valid, `valid output passes: ${validResult.errors.join("; ")}`);

// ── Summary ─────────────────────────────────────────────────────────────────────

const summary = summarizeRippleEffectOutput(validOutput);
assert(summary.nodeImpactCount === 1, "summary nodeImpactCount");
assert(summary.operationCount === 1, "summary operationCount");
assert(summary.highPriorityOperationCount === 1, "summary highPriorityOperationCount");
assert(summary.highSeverityWarningCount === 1, "summary highSeverityWarningCount");
assert(summary.confidence === 0.85, "summary confidence");

// ── No-op planner ─────────────────────────────────────────────────────────────────

const noOpInput = buildRippleEffectInput({
  triggerEvent: sciFiTruth,
  decisionLog: log,
  canvasModel,
});
const noOp = planNoOpRippleEffect(noOpInput);
const noOpValidation = validateRippleEffectOutput(noOp);

assert(noOp.impactLevel === "none", "no-op planner impactLevel none");
assert(noOp.nodeImpacts.length === 0, "no-op planner has no node impacts");
assert(noOp.preservedElements.length >= 1, "no-op planner preserves truth canon");
assert(noOpValidation.valid, "no-op planner output validates");
assert(
  noOp.summary.includes("No ripple planning logic applied"),
  "no-op planner summary documents placeholder status",
);

console.log("buildRippleEffectInput:");
console.log(`  truth=${input.activeCanonState.truthCount} potential=${input.activeCanonState.potentialCount}`);
console.log(`  evaluationMode=${input.evaluationMode}`);

console.log("\nvalidateRippleEffectOutput:");
console.log(`  invalid errors=${invalidResult.errors.length}`);
console.log(`  valid=${validResult.valid}`);

console.log("\nsummarizeRippleEffectOutput:");
console.log(`  operations=${summary.operationCount} warnings=${summary.warningCount}`);

console.log("\nplanNoOpRippleEffect:");
console.log(`  preserved=${noOp.preservedElements.length} confidence=${noOp.confidence}`);

console.log("\nAll Ripple Effect planner checks passed.");

/**
 * No-network test for World Evolution plan planner (Phase 5.1).
 *
 * Usage: npx tsx scripts/test-world-evolution-plan.mts
 */

import type { RippleApplyOperation, RippleApplyPlan } from "../lib/worldBrain/rippleApplyPlan.ts";
import {
  buildRippleApplyPlan,
  validateRippleApplyPlan,
} from "../lib/worldBrain/rippleApplyPlan.ts";
import { buildMemoryEconomyRipplePreviewFixture } from "../lib/worldBrain/ripplePreviewFixture.ts";
import {
  updateRippleOperationApproval,
  type RipplePreviewModel,
} from "../lib/worldBrain/ripplePreviewModel.ts";
import {
  buildWorldEvolutionPlan,
  classifyRippleOperationForEvolution,
  createEvolutionBlocker,
  DEFAULT_EVOLUTION_POLICY,
  enforceNodeBudget,
  estimateEvolutionConfidence,
  getBlockedEvolutionActions,
  getReadyEvolutionActions,
  shouldBlockHardRemoval,
  shouldDowngradeToWeaken,
  summarizeWorldEvolutionPlan,
  validateWorldEvolutionPlan,
  type WorldEvolutionInput,
} from "../lib/worldBrain/worldEvolutionPlan.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function applyOp(
  partial: Partial<RippleApplyOperation> & Pick<RippleApplyOperation, "id" | "sourceOperationId" | "operationType" | "target" | "reason">,
): RippleApplyOperation {
  return {
    title: partial.title ?? partial.operationType,
    description: partial.description ?? partial.reason,
    priority: partial.priority ?? "medium",
    riskLevel: partial.riskLevel ?? "medium",
    requiresUserApproval: partial.requiresUserApproval ?? true,
    relatedWarnings: partial.relatedWarnings ?? [],
    ...partial,
  };
}

function readyPlan(
  approvedOperations: RippleApplyOperation[],
  overrides: Partial<RippleApplyPlan> = {},
): RippleApplyPlan {
  return {
    id: overrides.id ?? "test_apply_plan_ready",
    previewId: overrides.previewId ?? "test_preview",
    triggerEventId: overrides.triggerEventId ?? "decision_test_trigger",
    status: "ready_to_apply",
    approvedOperations,
    rejectedOperations: [],
    clarificationOperations: [],
    blockers: [],
    warnings: [],
    summary: "Ready test apply plan",
    createdAt: "2026-07-07T20:00:00.000Z",
    ...overrides,
  };
}

function inputFor(plan: RippleApplyPlan, extra: Partial<WorldEvolutionInput> = {}): WorldEvolutionInput {
  return {
    applyPlan: plan,
    triggerNodeId: extra.triggerNodeId ?? "node_trigger",
    canonState: extra.canonState,
    preservedTargetIds: extra.preservedTargetIds,
    lockedTargetIds: extra.lockedTargetIds,
    nodeTitleById: extra.nodeTitleById,
    constellationNodeCounts: extra.constellationNodeCounts,
    nodeConstellationMap: extra.nodeConstellationMap,
    operationConfidenceBySourceId: extra.operationConfidenceBySourceId,
    policy: extra.policy,
  };
}

console.log("=== World evolution plan (no network) ===\n");

// Sci-fi memory economy — approved generate-node becomes generate_node action
const sciFiGenerate = applyOp({
  id: "apply_generate_debt_collector",
  sourceOperationId: "ripple_op_generate_new_node_node_childhood_debt_collector_0",
  operationType: "generate_new_node",
  target: {
    targetType: "node",
    id: "node_childhood_debt_collector",
    constellationId: "constellation_housing_credits",
    parentNodeId: "node_housing_credit_exchange",
  },
  reason: "Housing credits need a childhood debt collector agent.",
  payload: {
    continuationAnchor: "childhood memory liens on housing units",
    proposedTitle: "Childhood Debt Collector",
  },
});
const sciFiPlan = buildWorldEvolutionPlan(
  inputFor(readyPlan([sciFiGenerate]), {
    triggerNodeId: "node_housing_credit_exchange",
    nodeConstellationMap: {
      node_housing_credit_exchange: "constellation_housing_credits",
    },
    nodeTitleById: {
      node_housing_credit_exchange: "Housing Credit Exchange",
    },
    operationConfidenceBySourceId: {
      ripple_op_generate_new_node_node_childhood_debt_collector_0: 0.82,
    },
  }),
);
assert(
  sciFiPlan.actions.some(
    (a) => a.kind === "node" && a.actionType === "generate_node" && a.status === "ready",
  ),
  "sci-fi generate becomes ready generate_node action",
);

// Romance dream warning — distant low-confidence generate downgraded/skipped
const romanceWeaken = applyOp({
  id: "apply_weaken_cafe",
  sourceOperationId: "ripple_op_weaken_node_node_dream_meeting_cafe_0",
  operationType: "weaken_node",
  target: { targetType: "node", id: "node_dream_meeting_cafe", constellationId: "constellation_dream_bond" },
  reason: "Waking coffee shop meetup conflicts with dream-only rule.",
});
const romanceGenerate = applyOp({
  id: "apply_generate_distant",
  sourceOperationId: "ripple_op_generate_new_node_node_far_sibling_0",
  operationType: "generate_new_node",
  target: { targetType: "node", id: "node_far_sibling", constellationId: "constellation_waking_world" },
  reason: "Distant sibling node suggested far from dream anchor.",
  payload: { continuationAnchor: "shared alarm clock symbolism" },
});
const romancePlan = buildWorldEvolutionPlan(
  inputFor(readyPlan([romanceWeaken, romanceGenerate]), {
    triggerNodeId: "node_dream_only_rule",
    nodeConstellationMap: {
      node_dream_only_rule: "constellation_dream_bond",
      node_dream_meeting_cafe: "constellation_waking_world",
      node_far_sibling: "constellation_waking_world",
    },
    operationConfidenceBySourceId: {
      ripple_op_weaken_node_node_dream_meeting_cafe_0: 0.88,
      ripple_op_generate_new_node_node_far_sibling_0: 0.45,
    },
  }),
);
assert(
  romancePlan.actions.some((a) => a.actionType === "weaken_node"),
  "romance weaken action planned",
);
assert(
  romancePlan.actions.some(
    (a) =>
      a.sourceOperationId === "ripple_op_generate_new_node_node_far_sibling_0" &&
      (a.status === "skipped" || a.actionType === "weaken_node" || a.actionType === "skipped"),
  ),
  "romance distant low-confidence generate skipped or downgraded",
);

// Comedy treasure hunt — generate with anchor
const comedyGenerate = applyOp({
  id: "apply_generate_crab_clue",
  sourceOperationId: "ripple_op_generate_new_node_node_crab_clue_0",
  operationType: "generate_new_node",
  target: {
    targetType: "node",
    id: "node_crab_clue",
    constellationId: "constellation_treasure_hunt",
    parentNodeId: "node_treasure_x_mark",
  },
  reason: "Map-eating crabs leave ink-stained clue fragments.",
  payload: {
    continuationAnchor: "crabs ate the map edge near the X mark",
    proposedTitle: "Ink-Stained Crab Clue",
  },
});
const comedyPlan = buildWorldEvolutionPlan(
  inputFor(readyPlan([comedyGenerate]), {
    triggerNodeId: "node_treasure_x_mark",
    nodeConstellationMap: { node_treasure_x_mark: "constellation_treasure_hunt" },
    operationConfidenceBySourceId: {
      ripple_op_generate_new_node_node_crab_clue_0: 0.84,
    },
  }),
);
assert(
  comedyPlan.actions.some((a) => a.actionType === "generate_node"),
  "comedy generate proposed",
);
assert(comedyPlan.readyActions.length >= 1, "comedy generate ready");

// Political fantasy oath law — modify + constellation refocus metadata only
const politicalModify = applyOp({
  id: "apply_modify_oath",
  sourceOperationId: "ripple_op_modify_node_node_oath_statute_0",
  operationType: "modify_node",
  target: { targetType: "node", id: "node_oath_statute", constellationId: "constellation_tribunal" },
  reason: "Statute text must reflect broken oath witness testimony.",
});
const politicalRefocus = applyOp({
  id: "apply_refocus_tribunal",
  sourceOperationId: "ripple_op_refocus_constellation_constellation_tribunal_0",
  operationType: "refocus_constellation",
  target: { targetType: "constellation", id: "constellation_tribunal" },
  reason: "Tribunal constellation should emphasize oath legitimacy.",
  payload: { suggestedFocusShift: "oath legitimacy hearings" },
});
const politicalPlan = buildWorldEvolutionPlan(
  inputFor(readyPlan([politicalModify, politicalRefocus]), {
    triggerNodeId: "node_broken_oath_witness",
    nodeConstellationMap: { node_oath_statute: "constellation_tribunal" },
  }),
);
assert(
  politicalPlan.actions.some(
    (a) => a.kind === "constellation" && a.actionType === "refocus_constellation",
  ),
  "political refocus becomes constellation metadata action",
);
assert(
  politicalPlan.actions.some((a) => a.kind === "node" && a.actionType === "modify_node"),
  "political modify preserves node identity declaratively",
);

// Sports drama final match — weaken + defer flow
const sportsWeaken = applyOp({
  id: "apply_weaken_parade",
  sourceOperationId: "ripple_op_weaken_node_node_victory_parade_0",
  operationType: "weaken_node",
  target: { targetType: "node", id: "node_victory_parade", constellationId: "constellation_finale" },
  reason: "Missed penalty makes victory parade invalid.",
});
const sportsFlow = applyOp({
  id: "apply_update_flow",
  sourceOperationId: "ripple_op_update_flow_flow_act_three_0",
  operationType: "update_flow",
  target: { targetType: "flow_item", id: "flow_act_three_finale" },
  reason: "Reorder post-match celebration scenes.",
});
const sportsPlan = buildWorldEvolutionPlan(
  inputFor(readyPlan([sportsWeaken, sportsFlow]), {
    triggerNodeId: "node_missed_penalty",
  }),
);
assert(
  sportsPlan.actions.some((a) => a.actionType === "defer_flow_update"),
  "sports flow update deferred",
);

// Family saga inheritance — node budget prevents excessive generation
const familyGenerates = Array.from({ length: 4 }, (_, i) =>
  applyOp({
    id: `apply_generate_heir_${i}`,
    sourceOperationId: `ripple_op_generate_new_node_node_heir_${i}_0`,
    operationType: "generate_new_node",
    target: {
      targetType: "node",
      id: `node_heir_${i}`,
      constellationId: "constellation_estate_partition",
      parentNodeId: "node_estate_root",
    },
    reason: `Generate estranged heir candidate ${i}.`,
    payload: {
      continuationAnchor: `heir lineage branch ${i}`,
      proposedTitle: `Estranged Heir ${i}`,
    },
  }),
);
const familyConfidence: Record<string, number> = {};
for (let i = 0; i < 4; i++) {
  familyConfidence[`ripple_op_generate_new_node_node_heir_${i}_0`] = 0.88;
}
const familyPlan = buildWorldEvolutionPlan(
  inputFor(readyPlan(familyGenerates), {
    triggerNodeId: "node_estate_root",
    nodeConstellationMap: { node_estate_root: "constellation_estate_partition" },
    constellationNodeCounts: { constellation_estate_partition: 10 },
    operationConfidenceBySourceId: familyConfidence,
    policy: {
      ...DEFAULT_EVOLUTION_POLICY,
      nodeBudget: { ...DEFAULT_EVOLUTION_POLICY.nodeBudget, maxNewNodesPerBatch: 3 },
    },
  }),
);
const familyReadyGenerates = familyPlan.actions.filter((a) => a.actionType === "generate_node" && a.status === "ready");
const familySkippedGenerates = familyPlan.actions.filter(
  (a) => a.actionType === "skipped" && a.stopReason === "node_budget_exceeded",
);
assert(familyReadyGenerates.length === 3, "family saga node budget caps batch generation at three");
assert(familySkippedGenerates.length >= 1, "family saga skips excess generation attempts");

// Mystery locked-room — strengthen + weaken; hard remove on canon blocked
const mysteryStrengthen = applyOp({
  id: "apply_strengthen_clue",
  sourceOperationId: "ripple_op_strengthen_node_node_locked_door_clue_0",
  operationType: "strengthen_node",
  target: { targetType: "node", id: "node_locked_door_clue", constellationId: "constellation_locked_room" },
  reason: "Inside bolt evidence strengthens locked-room solution.",
});
const mysteryRemove = applyOp({
  id: "apply_remove_red_herring",
  sourceOperationId: "ripple_op_remove_node_node_secret_tunnel_0",
  operationType: "remove_node",
  target: { targetType: "node", id: "node_secret_tunnel", constellationId: "constellation_locked_room" },
  reason: "Secret tunnel red herring should be removed.",
  riskLevel: "high",
});
const mysteryPlan = buildWorldEvolutionPlan(
  inputFor(readyPlan([mysteryStrengthen, mysteryRemove]), {
    triggerNodeId: "node_door_bolted_inside",
    nodeConstellationMap: {
      node_door_bolted_inside: "constellation_locked_room",
      node_locked_door_clue: "constellation_locked_room",
      node_secret_tunnel: "constellation_locked_room",
    },
    existingNodeIds: ["node_door_bolted_inside", "node_locked_door_clue", "node_secret_tunnel"],
    operationConfidenceBySourceId: {
      ripple_op_strengthen_node_node_locked_door_clue_0: 0.92,
    },
    canonState: {
      truthNodeIds: ["node_secret_tunnel"],
      potentialNodeIds: [],
      rejectedNodeIds: [],
      truthCount: 1,
      potentialCount: 0,
      rejectedCount: 0,
    },
    preservedTargetIds: [],
  }),
);
assert(
  mysteryPlan.actions.some((a) => a.actionType === "strengthen_node" && a.status === "ready"),
  "mystery strengthen ready",
);
assert(
  mysteryPlan.actions.some(
    (a) =>
      a.sourceOperationId === "ripple_op_remove_node_node_secret_tunnel_0" &&
      a.actionType === "weaken_node",
  ),
  "mystery hard remove on canon downgraded to weaken",
);
assert(
  shouldBlockHardRemoval("node_secret_tunnel", {
    canonState: {
      truthNodeIds: ["node_secret_tunnel"],
      potentialNodeIds: [],
      rejectedNodeIds: [],
      truthCount: 1,
      potentialCount: 0,
      rejectedCount: 0,
    },
  }).blocked,
  "canon truth blocks hard removal",
);

// Rejected/pending apply plan ignored
const blockedApplyPlan = buildRippleApplyPlan(buildMemoryEconomyRipplePreviewFixture());
const blockedEvolution = buildWorldEvolutionPlan({ applyPlan: blockedApplyPlan });
assert(blockedEvolution.status === "failed" || blockedEvolution.status === "empty", "non-ready apply plan fails closed");
assert(blockedEvolution.readyActions.length === 0, "no ready actions from blocked apply plan");

// Empty apply plan
const emptyEvolution = buildWorldEvolutionPlan({
  applyPlan: readyPlan([]),
});
assert(emptyEvolution.status === "empty", "empty apply plan returns empty evolution status");

// Validation catches missing source references in duplicate action ids
const badEvolution = buildWorldEvolutionPlan(inputFor(readyPlan([sciFiGenerate])));
badEvolution.actions.push({ ...badEvolution.actions[0]! });
const badValidation = validateWorldEvolutionPlan(badEvolution);
assert(!badValidation.valid, "duplicate action ids fail validation");
assert(
  badValidation.errors.some((e) => e.includes("Duplicate action id")),
  "duplicate action error message",
);

// Summary helper
const summary = summarizeWorldEvolutionPlan(sciFiPlan);
assert(summary.readyCount >= 1, "summary reports ready count");
assert(summary.summary.length > 10, "summary human-readable");

// Classify helper
assert(
  classifyRippleOperationForEvolution(sciFiGenerate) === "generate_node",
  "classify maps generate_new_node",
);

// Preview immutability via apply plan path
const preview: RipplePreviewModel = buildMemoryEconomyRipplePreviewFixture();
const previewCopy = JSON.parse(JSON.stringify(preview)) as RipplePreviewModel;
const approvedAll = preview.operationPreviews.reduce(
  (model, op) => updateRippleOperationApproval(model, op.id, "approved"),
  preview,
);
buildRippleApplyPlan(approvedAll);
assert(JSON.stringify(previewCopy) === JSON.stringify(preview), "apply plan build does not mutate preview");

// Direct helper checks
const confidence = estimateEvolutionConfidence(sciFiGenerate, inputFor(readyPlan([sciFiGenerate])), {
  hopsFromTrigger: 1,
});
assert(confidence.finalConfidence > 0, "confidence estimate positive");
assert(
  shouldDowngradeToWeaken("remove_node", { ...confidence, tier: "ready", finalConfidence: 0.9 }),
  "remove always downgrade candidate",
);
assert(
  !enforceNodeBudget(3, "constellation_estate_partition", {
    applyPlan: readyPlan([]),
    constellationNodeCounts: { constellation_estate_partition: 22 },
  }).allowed,
  "enforceNodeBudget blocks at cap",
);
assert(createEvolutionBlocker("validation", "test").kind === "validation", "createEvolutionBlocker");

console.log("sci-fi status:", sciFiPlan.status);
console.log("romance status:", romancePlan.status);
console.log("family ready generates:", familyReadyGenerates.length);
console.log("mystery actions:", mysteryPlan.actions.map((a) => `${a.actionType}:${a.status}`).join(", "));

console.log("\nAll World evolution plan checks passed.");

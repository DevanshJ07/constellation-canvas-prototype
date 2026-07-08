/**
 * Stress tests for World Evolution planner (Phase 5.1A).
 *
 * Usage: npx tsx scripts/test-world-evolution-stress.mts
 */

import type { RippleApplyOperation, RippleApplyPlan } from "../lib/worldBrain/rippleApplyPlan.ts";
import {
  buildWorldEvolutionPlan,
  detectSteeringCanonConflict,
  DEFAULT_EVOLUTION_POLICY,
  type WorldEvolutionInput,
  type WorldEvolutionPlan,
} from "../lib/worldBrain/worldEvolutionPlan.ts";

let passed = 0;
let failed = 0;

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
    id: overrides.id ?? "stress_apply_plan_ready",
    previewId: overrides.previewId ?? "stress_preview",
    triggerEventId: overrides.triggerEventId ?? "decision_stress_trigger",
    status: "ready_to_apply",
    approvedOperations,
    rejectedOperations: [],
    clarificationOperations: [],
    blockers: [],
    warnings: [],
    summary: "Stress test apply plan",
    createdAt: "2026-07-08T06:00:00.000Z",
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
    existingNodeIds: extra.existingNodeIds,
    operationConfidenceBySourceId: extra.operationConfidenceBySourceId,
    userSteering: extra.userSteering,
    policy: extra.policy,
    canvasModel: extra.canvasModel,
  };
}

function readyNodeActions(plan: WorldEvolutionPlan, targetId: string) {
  return plan.actions.filter(
    (action) =>
      action.kind === "node" &&
      action.targetId === targetId &&
      action.status === "ready",
  );
}

function scenario(
  name: string,
  expected: string,
  actual: string,
  ok: boolean,
) {
  console.log(`\n=== ${name} ===`);
  console.log(`Expected: ${expected}`);
  console.log(`Actual:   ${actual}`);
  console.log(ok ? "PASS" : "FAIL");
  if (ok) passed += 1;
  else failed += 1;
}

console.log("=== World evolution stress tests (no network) ===");

// A. Over-expansion control
{
  const ops = Array.from({ length: 6 }, (_, i) =>
    applyOp({
      id: `apply_expand_${i}`,
      sourceOperationId: `ripple_op_expand_${i}`,
      operationType: "generate_new_node",
      target: {
        targetType: "node",
        id: `node_expand_${i}`,
        constellationId: "constellation_sprawl",
        parentNodeId: "node_sprawl_root",
      },
      reason: `Expansion candidate ${i}`,
      payload: {
        continuationAnchor: `sprawl branch ${i}`,
        proposedTitle: `Sprawl Node ${i}`,
      },
    }),
  );
  const confidence: Record<string, number> = {};
  for (let i = 0; i < 6; i++) confidence[`ripple_op_expand_${i}`] = 0.9;

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan(ops), {
      triggerNodeId: "node_sprawl_root",
      nodeConstellationMap: { node_sprawl_root: "constellation_sprawl" },
      constellationNodeCounts: { constellation_sprawl: 8 },
      existingNodeIds: ["node_sprawl_root"],
      operationConfidenceBySourceId: confidence,
      policy: {
        ...DEFAULT_EVOLUTION_POLICY,
        nodeBudget: { ...DEFAULT_EVOLUTION_POLICY.nodeBudget, maxNewNodesPerBatch: 3 },
      },
    }),
  );

  const readyGenerates = plan.actions.filter(
    (a) => a.actionType === "generate_node" && a.status === "ready",
  ).length;
  const skippedBudget = plan.actions.filter(
    (a) => a.status === "skipped" && a.stopReason === "node_budget_exceeded",
  ).length;

  scenario(
    "A. Over-expansion control",
    "At most 3 ready generates; excess skipped by batch cap",
    `${readyGenerates} ready generates, ${skippedBudget} batch-cap skips, status=${plan.status}`,
    readyGenerates === 3 && skippedBudget >= 1,
  );
}

// B. Over-deletion protection
{
  const canonId = "node_canon_oath";
  const preservedId = "node_preserved_artifact";
  const lockedId = "node_locked_vault";
  const removableId = "node_draft_note";

  const ops = [
    applyOp({
      id: "apply_remove_canon",
      sourceOperationId: "ripple_remove_canon",
      operationType: "remove_node",
      target: { targetType: "node", id: canonId, constellationId: "constellation_law" },
      reason: "Remove canon oath",
    }),
    applyOp({
      id: "apply_remove_preserved",
      sourceOperationId: "ripple_remove_preserved",
      operationType: "remove_node",
      target: { targetType: "node", id: preservedId, constellationId: "constellation_law" },
      reason: "Remove preserved artifact",
    }),
    applyOp({
      id: "apply_remove_locked",
      sourceOperationId: "ripple_remove_locked",
      operationType: "remove_node",
      target: { targetType: "node", id: lockedId, constellationId: "constellation_law" },
      reason: "Remove locked vault",
    }),
    applyOp({
      id: "apply_remove_draft",
      sourceOperationId: "ripple_remove_draft",
      operationType: "remove_node",
      target: { targetType: "node", id: removableId, constellationId: "constellation_law" },
      reason: "Remove draft note",
    }),
  ];

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan(ops), {
      triggerNodeId: "node_judge",
      existingNodeIds: [canonId, preservedId, lockedId, removableId],
      nodeConstellationMap: {
        node_judge: "constellation_law",
        [canonId]: "constellation_law",
        [preservedId]: "constellation_law",
        [lockedId]: "constellation_law",
        [removableId]: "constellation_law",
      },
      canonState: {
        truthNodeIds: [canonId],
        potentialNodeIds: [],
        rejectedNodeIds: [],
        truthCount: 1,
        potentialCount: 0,
        rejectedCount: 0,
      },
      preservedTargetIds: [preservedId],
      lockedTargetIds: [lockedId],
    }),
  );

  const protectedWeaken = [canonId, preservedId, lockedId].every((id) =>
    plan.actions.some(
      (a) => a.targetId === id && a.actionType === "weaken_node" && a.status !== "ready",
    ),
  );
  const draftArchived = plan.actions.some(
    (a) => a.targetId === removableId && (a.actionType === "archive_node" || a.actionType === "weaken_node"),
  );
  const noHardRemoveReady = !plan.actions.some(
    (a) => a.actionType === "remove_node" && a.status === "ready",
  );

  scenario(
    "B. Over-deletion protection",
    "Canon/preserved/locked removals become weaken; no ready hard remove",
    `protectedWeaken=${protectedWeaken}, draftHandled=${draftArchived}, noHardRemoveReady=${noHardRemoveReady}`,
    protectedWeaken && draftArchived && noHardRemoveReady,
  );
}

// C. Contradictory operations
{
  const targetId = "node_rival_heir";
  const ops = [
    applyOp({
      id: "apply_strengthen_heir",
      sourceOperationId: "ripple_strengthen_heir",
      operationType: "strengthen_node",
      target: { targetType: "node", id: targetId, constellationId: "constellation_estate" },
      reason: "Heir claim strengthened after will discovery",
    }),
    applyOp({
      id: "apply_weaken_heir",
      sourceOperationId: "ripple_weaken_heir",
      operationType: "weaken_node",
      target: { targetType: "node", id: targetId, constellationId: "constellation_estate" },
      reason: "Heir claim weakened after forgery reveal",
    }),
    applyOp({
      id: "apply_modify_heir",
      sourceOperationId: "ripple_modify_heir",
      operationType: "modify_node",
      target: { targetType: "node", id: targetId, constellationId: "constellation_estate" },
      reason: "Update heir claim wording",
    }),
    applyOp({
      id: "apply_remove_heir",
      sourceOperationId: "ripple_remove_heir",
      operationType: "remove_node",
      target: { targetType: "node", id: targetId, constellationId: "constellation_estate" },
      reason: "Remove heir claim entirely",
    }),
  ];

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan(ops), {
      triggerNodeId: "node_estate_root",
      existingNodeIds: [targetId, "node_estate_root"],
      nodeConstellationMap: {
        node_estate_root: "constellation_estate",
        [targetId]: "constellation_estate",
      },
      operationConfidenceBySourceId: {
        ripple_strengthen_heir: 0.9,
        ripple_weaken_heir: 0.7,
        ripple_modify_heir: 0.85,
        ripple_remove_heir: 0.6,
      },
    }),
  );

  const readyOnTarget = readyNodeActions(plan, targetId);
  const conflictSignals =
    plan.blockers.some((b) => b.kind === "conflict") ||
    plan.warnings.some((w) => w.warningType === "conflicting_operations") ||
    plan.actions.some((a) => a.targetId === targetId && a.stopReason === "conflicting_operations");

  scenario(
    "C. Contradictory operations",
    "No conflicting ready actions; conflict warnings/blockers emitted",
    `${readyOnTarget.length} ready on target, conflictSignals=${conflictSignals}, actions=${plan.actions
      .filter((a) => a.kind === "node" && a.targetId === targetId)
      .map((a) => `${a.actionType}:${a.status}`)
      .join("|")}`,
    readyOnTarget.length <= 1 && conflictSignals,
  );
}

// D. Duplicate new node generation
{
  const ops = [
    applyOp({
      id: "apply_dup_a",
      sourceOperationId: "ripple_dup_a",
      operationType: "generate_new_node",
      target: {
        targetType: "node",
        id: "node_hidden_passage_a",
        constellationId: "constellation_dungeon",
        parentNodeId: "node_dungeon_entry",
      },
      reason: "Hidden passage behind tapestry",
      payload: {
        continuationAnchor: "tapestry conceals a drafty passage",
        proposedTitle: "Hidden Tapestry Passage",
      },
    }),
    applyOp({
      id: "apply_dup_b",
      sourceOperationId: "ripple_dup_b",
      operationType: "generate_new_node",
      target: {
        targetType: "node",
        id: "node_hidden_passage_b",
        constellationId: "constellation_dungeon",
        parentNodeId: "node_dungeon_entry",
      },
      reason: "Another hidden passage behind tapestry",
      payload: {
        continuationAnchor: "tapestry conceals a drafty passage",
        proposedTitle: "Hidden Tapestry Passage",
      },
    }),
  ];

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan(ops), {
      triggerNodeId: "node_dungeon_entry",
      existingNodeIds: ["node_dungeon_entry"],
      nodeConstellationMap: { node_dungeon_entry: "constellation_dungeon" },
      operationConfidenceBySourceId: {
        ripple_dup_a: 0.88,
        ripple_dup_b: 0.86,
      },
    }),
  );

  const readyGenerates = plan.actions.filter(
    (a) => a.actionType === "generate_node" && a.status === "ready",
  ).length;
  const duplicateSkipped = plan.actions.some(
    (a) =>
      a.status === "skipped" &&
      (a.stopReason === "duplicate_proposal" || a.stopReason === "duplicate_label"),
  );

  scenario(
    "D. Duplicate new node generation",
    "Only one ready generate; duplicate proposal skipped or blocked",
    `${readyGenerates} ready generates, duplicateSkipped=${duplicateSkipped}`,
    readyGenerates === 1 && duplicateSkipped,
  );
}

// E. Missing target references
{
  const ops = [
    applyOp({
      id: "apply_modify_missing",
      sourceOperationId: "ripple_modify_missing",
      operationType: "modify_node",
      target: { targetType: "node", id: "node_deleted_scene", constellationId: "constellation_cut" },
      reason: "Modify a scene that was removed from canvas",
    }),
    applyOp({
      id: "apply_refocus_missing",
      sourceOperationId: "ripple_refocus_missing",
      operationType: "refocus_constellation",
      target: { targetType: "constellation", id: "constellation_cut" },
      reason: "Refocus cut constellation",
    }),
  ];

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan(ops), {
      triggerNodeId: "node_survivor",
      existingNodeIds: ["node_survivor"],
      nodeConstellationMap: { node_survivor: "constellation_main" },
    }),
  );

  const missingNodeSkipped = plan.actions.some(
    (a) => a.stopReason === "target_not_found" && a.status === "skipped",
  );
  const missingConstellationSkipped = plan.actions.some(
    (a) => a.stopReason === "constellation_not_found" && a.status === "skipped",
  );

  scenario(
    "E. Missing target references",
    "Missing node/constellation actions skipped with clear blockers",
    `nodeSkipped=${missingNodeSkipped}, constellationSkipped=${missingConstellationSkipped}`,
    missingNodeSkipped && missingConstellationSkipped,
  );
}

// F. Low-confidence distant propagation
{
  const op = applyOp({
    id: "apply_distant_generate",
    sourceOperationId: "ripple_distant_generate",
    operationType: "generate_new_node",
    target: {
      targetType: "node",
      id: "node_far_colony",
      constellationId: "constellation_outer_rim",
      parentNodeId: "node_far_colony",
    },
    reason: "Distant colony ripple from dream anchor",
    payload: {
      continuationAnchor: "shared dream signal across star lanes",
      proposedTitle: "Outer Rim Echo",
    },
  });

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan([op]), {
      triggerNodeId: "node_dream_anchor",
      nodeConstellationMap: {
        node_dream_anchor: "constellation_dream_core",
        node_far_colony: "constellation_outer_rim",
      },
      existingNodeIds: ["node_dream_anchor", "node_far_colony"],
      operationConfidenceBySourceId: { ripple_distant_generate: 0.42 },
    }),
  );

  const action = plan.actions[0];
  const safelyHandled =
    action !== undefined &&
    (action.status === "skipped" ||
      action.actionType === "weaken_node" ||
      action.actionType === "skipped");

  scenario(
    "F. Low-confidence distant propagation",
    "Distant low-confidence generate skipped or downgraded, not ready expand",
    action
      ? `${action.actionType}:${action.status}, confidence=${action.confidence}, hops=${action.propagation.hopsFromTrigger}`
      : "no action",
    safelyHandled,
  );
}

// G. User steering conflict
{
  const canonId = "node_ghost_portal";
  const op = applyOp({
    id: "apply_modify_supernatural",
    sourceOperationId: "ripple_modify_supernatural",
    operationType: "modify_node",
    target: { targetType: "node", id: canonId, constellationId: "constellation_haunted" },
    reason: "Reduce supernatural intensity of ghost portal",
    payload: { toneShift: "more mundane" },
  });

  const input = inputFor(readyPlan([op]), {
    triggerNodeId: "node_haunted_house",
    existingNodeIds: [canonId, "node_haunted_house"],
    nodeConstellationMap: {
      node_haunted_house: "constellation_haunted",
      [canonId]: "constellation_haunted",
    },
    nodeTitleById: { [canonId]: "Supernatural Ghost Portal" },
    canonState: {
      truthNodeIds: [canonId],
      potentialNodeIds: [],
      rejectedNodeIds: [],
      truthCount: 1,
      potentialCount: 0,
      rejectedCount: 0,
    },
    userSteering: {
      instruction: "Make this less supernatural",
      targetScope: "world",
      intensity: "moderate",
    },
    operationConfidenceBySourceId: { ripple_modify_supernatural: 0.88 },
  });

  const steeringCheck = detectSteeringCanonConflict(op, canonId, input);
  const plan = buildWorldEvolutionPlan(input);
  const action = plan.actions[0];

  const blockedOrReviewed =
    steeringCheck.conflict &&
    action !== undefined &&
    action.status !== "ready" &&
    (plan.blockers.some((b) => b.kind === "steering" || b.kind === "canon_protection") ||
      action.stopReason === "canon_modify_requires_review" ||
      action.stopReason === "steering_conflict");

  scenario(
    "G. User steering conflict",
    "Canon supernatural truth not silently overwritten; steering/canon blocker present",
    `steeringConflict=${steeringCheck.conflict}, action=${action?.actionType}:${action?.status}, blockers=${plan.blockers.length}`,
    blockedOrReviewed,
  );
}

// H. Constellation overcrowding
{
  const ops = [
    applyOp({
      id: "apply_refocus_crowded",
      sourceOperationId: "ripple_refocus_crowded",
      operationType: "refocus_constellation",
      target: { targetType: "constellation", id: "constellation_crowded" },
      reason: "Refocus crowded constellation themes",
      payload: { suggestedFocusShift: "consolidate duplicate motifs" },
    }),
    ...Array.from({ length: 3 }, (_, i) =>
      applyOp({
        id: `apply_crowded_gen_${i}`,
        sourceOperationId: `ripple_crowded_gen_${i}`,
        operationType: "generate_new_node",
        target: {
          targetType: "node",
          id: `node_crowded_${i}`,
          constellationId: "constellation_crowded",
          parentNodeId: "node_crowded_root",
        },
        reason: `Crowded expansion ${i}`,
        payload: {
          continuationAnchor: `crowded branch ${i}`,
          proposedTitle: `Crowded Node ${i}`,
        },
      }),
    ),
  ];

  const confidence: Record<string, number> = { ripple_refocus_crowded: 0.88 };
  for (let i = 0; i < 3; i++) confidence[`ripple_crowded_gen_${i}`] = 0.9;

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan(ops), {
      triggerNodeId: "node_crowded_root",
      existingNodeIds: ["node_crowded_root"],
      nodeConstellationMap: { node_crowded_root: "constellation_crowded" },
      constellationNodeCounts: { constellation_crowded: 22 },
      operationConfidenceBySourceId: confidence,
    }),
  );

  const refocusReady = plan.actions.some(
    (a) => a.actionType === "refocus_constellation" && a.status === "ready",
  );
  const readyGenerates = plan.actions.filter(
    (a) => a.actionType === "generate_node" && a.status === "ready",
  ).length;
  const nearCapWarnings = plan.warnings.some((w) => w.warningType === "constellation_near_cap");
  const capSkips = plan.actions.some((a) => a.stopReason === "constellation_cap_exceeded");

  scenario(
    "H. Constellation overcrowding",
    "Refocus stays viable; generation capped/warned near constellation limit",
    `refocusReady=${refocusReady}, readyGenerates=${readyGenerates}, nearCapWarnings=${nearCapWarnings}, capSkips=${capSkips}`,
    refocusReady && readyGenerates <= 2 && (nearCapWarnings || capSkips),
  );
}

// I. Mixed-risk operation batch
{
  const ops = [
    applyOp({
      id: "apply_safe_generate",
      sourceOperationId: "ripple_safe_generate",
      operationType: "generate_new_node",
      target: {
        targetType: "node",
        id: "node_safe_child",
        constellationId: "constellation_mixed",
        parentNodeId: "node_mixed_root",
      },
      reason: "Safe child node",
      payload: {
        continuationAnchor: "follow-up clue on the desk",
        proposedTitle: "Desk Clue",
      },
    }),
    applyOp({
      id: "apply_risky_remove",
      sourceOperationId: "ripple_risky_remove",
      operationType: "remove_node",
      target: { targetType: "node", id: "node_red_herring", constellationId: "constellation_mixed" },
      reason: "Risky remove of red herring",
      riskLevel: "high",
    }),
    applyOp({
      id: "apply_low_modify",
      sourceOperationId: "ripple_low_modify",
      operationType: "modify_node",
      target: { targetType: "node", id: "node_ambiguous", constellationId: "constellation_mixed" },
      reason: "Low-confidence modify",
    }),
    applyOp({
      id: "apply_new_constellation",
      sourceOperationId: "ripple_new_constellation",
      operationType: "generate_new_node",
      target: { targetType: "constellation", id: "constellation_brand_new" },
      reason: "Attempt to spawn a new constellation",
    }),
  ];

  const plan = buildWorldEvolutionPlan(
    inputFor(readyPlan(ops), {
      triggerNodeId: "node_mixed_root",
      existingNodeIds: ["node_mixed_root", "node_red_herring", "node_ambiguous"],
      nodeConstellationMap: {
        node_mixed_root: "constellation_mixed",
        node_red_herring: "constellation_mixed",
        node_ambiguous: "constellation_mixed",
      },
      constellationNodeCounts: { constellation_mixed: 5 },
      operationConfidenceBySourceId: {
        ripple_safe_generate: 0.9,
        ripple_risky_remove: 0.66,
        ripple_low_modify: 0.38,
      },
    }),
  );

  const needsReviewOrBlocked = plan.status === "needs_review" || plan.status === "blocked";
  const hasSafeReady = plan.actions.some(
    (a) => a.sourceOperationId === "ripple_safe_generate" && a.status === "ready",
  );
  const newConstellationBlocked = plan.actions.some(
    (a) => a.stopReason === "new_constellation_not_allowed",
  );

  scenario(
    "I. Mixed-risk operation batch",
    "Plan status needs_review/blocked; safe op may remain; new constellation blocked",
    `status=${plan.status}, safeReady=${hasSafeReady}, newConstellationBlocked=${newConstellationBlocked}`,
    needsReviewOrBlocked && hasSafeReady && newConstellationBlocked,
  );
}

// J. Empty / non-ready apply plan
{
  const emptyPlan = buildWorldEvolutionPlan({ applyPlan: readyPlan([]) });
  const blockedPlan = buildWorldEvolutionPlan({
    applyPlan: {
      ...readyPlan([]),
      status: "blocked",
      blockers: [
        {
          id: "apply_blocker_test",
          kind: "validation",
          message: "Preview unresolved",
        },
      ],
    },
  });

  scenario(
    "J. Empty / non-ready apply plan",
    "Empty -> empty status/no actions; blocked apply -> failed/no ready actions",
    `emptyStatus=${emptyPlan.status}, emptyActions=${emptyPlan.actions.length}, blockedStatus=${blockedPlan.status}, blockedReady=${blockedPlan.readyActions.length}`,
    emptyPlan.status === "empty" &&
      emptyPlan.actions.length === 0 &&
      blockedPlan.status === "failed" &&
      blockedPlan.readyActions.length === 0,
  );
}

console.log(`\n=== Stress summary ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
console.log("\nAll World evolution stress checks passed.");

/**
 * No-network tests for World Evolution guarded apply (Phase 5.5B.1).
 *
 * Usage: npx tsx scripts/test-world-evolution-apply.mts
 */

import type { CanvasWorldModel } from "../lib/worldBrain/mapArchitectureToCanvas.ts";
import {
  applyWorldEvolutionPatches,
  computeEvolutionOverlayBatchDelta,
  findLatestUndoableEvolutionHistoryEntry,
  markEvolutionHistoryEntryUndone,
  type EvolutionHistoryEntry,
} from "../lib/worldBrain/worldEvolutionApply.ts";
import {
  buildWorldEvolutionApplyDryRun,
  createCanvasEvolutionFingerprint,
  type EvolutionCanvasPatchCandidate,
  type WorldEvolutionApplyDryRunResult,
} from "../lib/worldBrain/worldEvolutionApplyDryRun.ts";
import {
  DEFAULT_EVOLUTION_POLICY,
  type ConstellationEvolutionAction,
  type NodeEvolutionAction,
  type WorldEvolutionPlan,
} from "../lib/worldBrain/worldEvolutionPlan.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function buildCanvas(overrides: Partial<CanvasWorldModel> = {}): CanvasWorldModel {
  return {
    worldSeed: "test-seed",
    worldSummary: "Test world",
    constellations: [
      {
        id: "constellation_alpha",
        title: "Alpha Region",
        displayTitle: "Alpha",
        description: "Alpha constellation",
        question: "What happens in alpha?",
        priority: 1,
        agentIds: [],
        nodeIds: ["node_root", "node_potential", "node_canon"],
      },
    ],
    nodes: [
      {
        id: "node_root",
        title: "Root Node",
        description: "Root",
        constellationId: "constellation_alpha",
        generatedByAgentId: "agent_1",
        whyPromising: "Root anchor",
        risk: "low",
        explorationQuestions: [],
        nodeType: "concept",
        status: "potential",
        aiGenerated: true,
      },
      {
        id: "node_potential",
        title: "Potential Note",
        description: "Potential",
        constellationId: "constellation_alpha",
        generatedByAgentId: "agent_1",
        whyPromising: "Maybe useful",
        risk: "medium",
        explorationQuestions: [],
        nodeType: "concept",
        status: "potential",
        aiGenerated: true,
      },
      {
        id: "node_canon",
        title: "Canon Truth",
        description: "Established truth",
        constellationId: "constellation_alpha",
        generatedByAgentId: "agent_1",
        whyPromising: "Canon",
        risk: "low",
        explorationQuestions: [],
        nodeType: "concept",
        status: "potential",
        aiGenerated: true,
      },
    ],
    agents: [],
    criticAgents: [],
    controlRules: {
      maxNodesPerConstellation: 24,
      maxDepth: 5,
      toneGuardrails: [],
    },
    ...overrides,
  };
}

function basePlan(actions: WorldEvolutionPlan["actions"]): WorldEvolutionPlan {
  const readyActions = actions.filter((action) => action.status === "ready");
  return {
    id: "apply_test_plan",
    applyPlanId: "apply_test_apply_plan",
    previewId: "apply_test_preview",
    triggerEventId: "apply_test_trigger",
    status: readyActions.length > 0 ? "ready_for_preview" : "empty",
    actions,
    readyActions,
    blockedActions: actions.filter((action) => action.status !== "ready"),
    blockers: [],
    warnings: [],
    summary: "Apply test plan",
    policy: DEFAULT_EVOLUTION_POLICY,
    nodeBudgetRemaining: 3,
    createdAt: "2026-07-08T08:00:00.000Z",
  };
}

function nodeAction(
  partial: Partial<NodeEvolutionAction> & Pick<NodeEvolutionAction, "id" | "actionType" | "targetId" | "reason">,
): NodeEvolutionAction {
  return {
    kind: "node",
    sourceOperationId: partial.sourceOperationId ?? `ripple_${partial.id}`,
    confidence: partial.confidence ?? 0.85,
    riskLevel: partial.riskLevel ?? "medium",
    reversible: partial.reversible ?? true,
    requiresUserConfirmation: partial.requiresUserConfirmation ?? true,
    propagation: partial.propagation ?? {
      scope: "node",
      hopsFromTrigger: 0,
      cappedByPolicy: false,
    },
    confidenceProfile: partial.confidenceProfile ?? {
      baseConfidence: 0.85,
      distanceFactor: 1,
      warningFactor: 1,
      finalConfidence: 0.85,
      tier: "ready",
    },
    status: partial.status ?? "ready",
    constellationId: partial.constellationId ?? "constellation_alpha",
    ...partial,
  };
}

function constellationAction(
  partial: Partial<ConstellationEvolutionAction> &
    Pick<ConstellationEvolutionAction, "id" | "actionType" | "constellationId" | "reason">,
): ConstellationEvolutionAction {
  return {
    kind: "constellation",
    sourceOperationId: partial.sourceOperationId ?? `ripple_${partial.id}`,
    confidence: partial.confidence ?? 0.85,
    riskLevel: partial.riskLevel ?? "low",
    reversible: partial.reversible ?? true,
    requiresUserConfirmation: partial.requiresUserConfirmation ?? false,
    propagation: partial.propagation ?? {
      scope: "constellation",
      hopsFromTrigger: 1,
      cappedByPolicy: false,
    },
    confidenceProfile: partial.confidenceProfile ?? {
      baseConfidence: 0.85,
      distanceFactor: 0.92,
      warningFactor: 1,
      finalConfidence: 0.78,
      tier: "ready",
    },
    status: partial.status ?? "ready",
    ...partial,
  };
}

function dryRunForPlan(
  plan: WorldEvolutionPlan,
  canvas: CanvasWorldModel,
  canonState: WorldEvolutionApplyInput["canonState"],
): WorldEvolutionApplyDryRunResult {
  return buildWorldEvolutionApplyDryRun({
    plan,
    canvasModel: canvas,
    canonState,
  });
}

function applyInput(
  canvas: CanvasWorldModel,
  dryRun: WorldEvolutionApplyDryRunResult,
  overrides: Partial<WorldEvolutionApplyInput> = {},
): WorldEvolutionApplyInput {
  return {
    canvasModel: canvas,
    dryRun,
    confirmed: true,
    canonState,
    triggerEventId: "apply_test_trigger",
    planId: dryRun.planId,
    ...overrides,
  };
}

function manualDryRun(
  canvas: CanvasWorldModel,
  patches: EvolutionCanvasPatchCandidate[],
  status: WorldEvolutionApplyDryRunResult["status"] = "ready_for_confirmation",
): WorldEvolutionApplyDryRunResult {
  const readyPatches = patches.filter((patch) => patch.status === "ready");
  const blockedPatches = patches.filter((patch) => patch.status !== "ready");
  return {
    planId: "manual_dry_run_plan",
    status,
    summary: "Manual dry-run fixture",
    patchCandidates: patches,
    readyPatches,
    blockedPatches,
    blockers: [],
    warnings: [],
    patchSummary: {
      totalCandidates: patches.length,
      readyCount: readyPatches.length,
      blockedCount: patches.filter((patch) => patch.status === "blocked").length,
      needsReviewCount: patches.filter((patch) => patch.status === "needs_review").length,
      confirmationRequiredCount: patches.filter((patch) => patch.requiresConfirmation).length,
      reversibleCount: patches.filter((patch) => patch.reversible).length,
      patchTypes: [...new Set(patches.map((patch) => patch.patchType))],
    },
    validation: { valid: true, errors: [], warnings: [] },
    canvasFingerprint: createCanvasEvolutionFingerprint(canvas),
    createdAt: "2026-07-08T08:00:00.000Z",
    sourcePlanId: "manual_dry_run_plan",
  };
}

function patchCandidate(
  partial: Partial<EvolutionCanvasPatchCandidate> &
    Pick<
      EvolutionCanvasPatchCandidate,
      "id" | "patchType" | "target" | "sourceActionId" | "sourceOperationId" | "reason" | "previewSummary"
    >,
): EvolutionCanvasPatchCandidate {
  return {
    status: partial.status ?? "ready",
    reversible: partial.reversible ?? true,
    requiresConfirmation: partial.requiresConfirmation ?? false,
    ...partial,
  };
}

const canvas = buildCanvas();
const canonState = {
  truthNodeIds: ["node_canon"],
  potentialNodeIds: ["node_potential"],
  rejectedNodeIds: [],
  truthCount: 1,
  potentialCount: 1,
  rejectedCount: 0,
};

console.log("=== World evolution guarded apply (no network) ===\n");

// confirmed=false returns cancelled and unchanged canvas
{
  const plan = basePlan([
    nodeAction({
      id: "evo_cancel",
      actionType: "weaken_node",
      targetId: "node_potential",
      reason: "Cancel test weaken.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, canvas, canonState);
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const result = applyWorldEvolutionPatches(
    applyInput(inputCanvas, dryRun, { confirmed: false }),
  );
  assert(result.status === "cancelled", "confirmed=false returns cancelled");
  assert(JSON.stringify(result.canvasModel) === before, "cancelled apply leaves canvas unchanged");
  assert(JSON.stringify(inputCanvas) === before, "input canvas unchanged on cancel");
}

// ready add_node patch adds node immutably
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const plan = basePlan([
    nodeAction({
      id: "evo_add_child",
      actionType: "generate_node",
      targetId: "node_new_child",
      parentNodeId: "node_root",
      proposedLabel: "Apply Child Node",
      continuationAnchor: "apply child anchor",
      reason: "Add child via apply.",
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "applied", "add_node apply succeeds");
  assert(
    result.canvasModel.nodes.some((node) => node.id === "node_new_child"),
    "add_node adds node to output model",
  );
  assert(JSON.stringify(inputCanvas) === before, "input canvas unchanged after add_node");
  assert(result.appliedPatches.some((patch) => patch.patchType === "add_node"), "add_node recorded as applied");
}

// ready weaken_node patch marks node weakened
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_weaken_apply",
      actionType: "weaken_node",
      targetId: "node_potential",
      reason: "Apply weaken marker.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "applied", "weaken apply succeeds");
  assert(
    result.canvasModel.evolutionOverlay?.weakenedNodeIds.includes("node_potential"),
    "weaken_node marks node weakened in overlay",
  );
}

// archive_node on potential node marks archived/hidden, not removed
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_archive_potential_apply",
      actionType: "archive_node",
      targetId: "node_potential",
      reason: "Archive potential via apply.",
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const archivePatch = dryRun.patchCandidates.find((patch) => patch.patchType === "archive_node");
  assert(archivePatch !== undefined, "archive potential patch exists in dry-run");
  const result = applyWorldEvolutionPatches(
    applyInput(inputCanvas, dryRun, {
      allowNeedsReviewPatches: true,
      selectedPatchIds: [archivePatch.id],
    }),
  );
  assert(result.status === "applied", "archive potential apply succeeds with needs_review allowed");
  assert(
    result.canvasModel.evolutionOverlay?.archivedNodeIds.includes("node_potential"),
    "archive_node marks archived in overlay",
  );
  assert(
    result.canvasModel.nodes.some((node) => node.id === "node_potential"),
    "archive_node does not remove node from nodes array",
  );
  assert(
    result.canvasModel.constellations[0].nodeIds.includes("node_potential"),
    "archive_node does not remove node from constellation nodeIds",
  );
}

// archive_node on canon node fails or is excluded and original canvas is unchanged
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const plan = basePlan([
    nodeAction({
      id: "evo_archive_canon_apply",
      actionType: "archive_node",
      targetId: "node_canon",
      reason: "Attempt archive canon.",
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  assert(
    dryRun.readyPatches.every((patch) => patch.patchType !== "archive_node"),
    "canon archive excluded from ready patches in dry-run",
  );
  const forcedDryRun = manualDryRun(inputCanvas, [
    patchCandidate({
      id: "forced_archive_canon",
      patchType: "archive_node",
      target: { targetType: "node", id: "node_canon", constellationId: "constellation_alpha" },
      sourceActionId: "forced_archive_canon_action",
      sourceOperationId: "forced_op",
      reason: "Forced canon archive",
      previewSummary: "Force archive canon",
      status: "ready",
      requiresConfirmation: true,
    }),
  ]);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, forcedDryRun));
  assert(result.status === "failed", "archive_node on canon fails atomically");
  assert(JSON.stringify(result.canvasModel) === before, "canon archive failure leaves canvas unchanged");
  assert(JSON.stringify(inputCanvas) === before, "input canvas unchanged on canon archive failure");
}

// update_node_metadata shallow merges without changing id
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_modify_apply",
      actionType: "modify_node",
      targetId: "node_root",
      reason: "Update root metadata.",
      payload: { title: "Updated Root Title", description: "Updated description" },
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  const updated = result.canvasModel.nodes.find((node) => node.id === "node_root");
  assert(result.status === "applied", "update_node_metadata apply succeeds");
  assert(updated?.title === "Updated Root Title", "metadata title merged");
  assert(updated?.id === "node_root", "node id preserved");
  assert(inputCanvas.nodes.find((node) => node.id === "node_root")?.title === "Root Node", "input node title unchanged");
}

// update_constellation_metadata updates metadata only
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    constellationAction({
      id: "evo_refocus_apply",
      actionType: "refocus_constellation",
      constellationId: "constellation_alpha",
      focusShift: "emphasize hidden clues",
      reason: "Refocus constellation.",
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "applied", "update_constellation_metadata apply succeeds");
  assert(
    result.canvasModel.constellations[0].description.includes("emphasize hidden clues"),
    "constellation metadata updated with focus shift",
  );
  assert(
    result.canvasModel.constellations[0].id === "constellation_alpha",
    "constellation id preserved",
  );
}

// add_edge works when endpoint was added earlier in same batch
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_edge_batch",
      actionType: "generate_node",
      targetId: "node_edge_child",
      parentNodeId: "node_root",
      proposedLabel: "Edge Batch Child",
      continuationAnchor: "edge batch anchor",
      reason: "Generate child with edge.",
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "applied", "batch with add_node + add_edge succeeds");
  assert(
    result.canvasModel.evolutionOverlay?.edges.some(
      (edge) => edge.fromId === "node_root" && edge.toId === "node_edge_child",
    ),
    "add_edge recorded when endpoint added earlier in batch",
  );
}

// add_edge fails when endpoint missing and atomic rollback happens
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const dryRun = manualDryRun(inputCanvas, [
    patchCandidate({
      id: "orphan_edge_patch",
      patchType: "add_edge",
      target: {
        targetType: "edge",
        id: "node_root->node_missing",
        endpointIds: ["node_root", "node_missing"],
        constellationId: "constellation_alpha",
      },
      sourceActionId: "orphan_edge_action",
      sourceOperationId: "orphan_op",
      reason: "Orphan edge",
      previewSummary: "Edge to missing node",
      status: "ready",
    }),
  ]);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "failed", "missing endpoint edge fails apply");
  assert(JSON.stringify(result.canvasModel) === before, "orphan edge failure rolls back atomically");
}

// blocked/no-op patches never apply
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const dryRun = manualDryRun(
    inputCanvas,
    [
      patchCandidate({
        id: "blocked_patch",
        patchType: "archive_node",
        target: { targetType: "node", id: "node_canon" },
        sourceActionId: "blocked_action",
        sourceOperationId: "blocked_op",
        reason: "Blocked archive",
        previewSummary: "Blocked",
        status: "blocked",
      }),
      patchCandidate({
        id: "noop_patch",
        patchType: "no_op",
        target: { targetType: "node", id: "node_root" },
        sourceActionId: "noop_action",
        sourceOperationId: "noop_op",
        reason: "No op",
        previewSummary: "No op",
        status: "ready",
        reversible: false,
      }),
      patchCandidate({
        id: "ready_weaken",
        patchType: "mark_node_weakened",
        target: { targetType: "node", id: "node_potential", constellationId: "constellation_alpha" },
        sourceActionId: "ready_weaken_action",
        sourceOperationId: "ready_op",
        reason: "Ready weaken",
        previewSummary: "Ready weaken",
        status: "ready",
      }),
    ],
    "needs_review",
  );
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "applied", "apply runs only eligible ready patch");
  assert(result.appliedPatches.length === 1, "only one patch applied");
  assert(result.appliedPatches[0].patchType === "mark_node_weakened", "blocked/no_op skipped");
  assert(result.skippedPatches.length >= 2, "blocked/no_op recorded as skipped");
  assert(JSON.stringify(inputCanvas) === before, "input canvas unchanged for blocked/no-op scenario");
}

// needs_review patches excluded by default
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_review_archive",
      actionType: "archive_node",
      targetId: "node_potential",
      reason: "Needs review archive.",
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const reviewPatch = dryRun.patchCandidates.find((patch) => patch.patchType === "archive_node");
  assert(reviewPatch?.status === "needs_review", "archive potential is needs_review in dry-run");
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "empty", "needs_review excluded by default yields empty apply");
  assert(
    result.skippedPatches.some((patch) => patch.stopReason === "needs_review_not_confirmed"),
    "needs_review patch skipped with reason",
  );
}

// needs_review patches apply only when explicitly allowed and selected
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_review_archive_allowed",
      actionType: "archive_node",
      targetId: "node_potential",
      reason: "Allowed needs review archive.",
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const reviewPatch = dryRun.patchCandidates.find((patch) => patch.patchType === "archive_node");
  assert(reviewPatch !== undefined, "review archive patch exists");
  const result = applyWorldEvolutionPatches(
    applyInput(inputCanvas, dryRun, {
      allowNeedsReviewPatches: true,
      selectedPatchIds: [reviewPatch.id],
    }),
  );
  assert(result.status === "applied", "needs_review applies when allowed and selected");
  assert(
    result.canvasModel.evolutionOverlay?.archivedNodeIds.includes("node_potential"),
    "needs_review archive applied when explicitly allowed",
  );
}

// stale/missing target causes failed atomic rollback
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const dryRun = manualDryRun(inputCanvas, [
    patchCandidate({
      id: "missing_target_patch",
      patchType: "update_node_metadata",
      target: { targetType: "node", id: "node_ghost", constellationId: "constellation_alpha" },
      sourceActionId: "missing_target_action",
      sourceOperationId: "missing_op",
      reason: "Modify missing node",
      previewSummary: "Missing target",
      status: "ready",
      payload: { title: "Ghost" },
    }),
  ]);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.status === "failed", "missing target fails apply");
  assert(JSON.stringify(result.canvasModel) === before, "missing target rolls back atomically");
  assert(result.failedPatches.length >= 1, "missing target recorded as failed");
}

// input canvas object remains unchanged by deep equality
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const plan = basePlan([
    nodeAction({
      id: "evo_immutable_apply",
      actionType: "generate_node",
      targetId: "node_immutable_child",
      parentNodeId: "node_root",
      proposedLabel: "Immutable Apply Child",
      continuationAnchor: "immutable apply",
      reason: "Immutability check.",
    }),
    nodeAction({
      id: "evo_immutable_weaken",
      actionType: "weaken_node",
      targetId: "node_potential",
      reason: "Weaken immutability check.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(JSON.stringify(inputCanvas) === before, "input canvas object remains unchanged by deep equality");
}

// result includes undo snapshot and history entry
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_history",
      actionType: "weaken_node",
      targetId: "node_root",
      reason: "History metadata check.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  assert(result.historyEntry.undoAvailable === true, "history entry marks undo available");
  assert(result.historyEntry.undoSnapshot !== undefined, "history entry includes undo snapshot");
  assert(
    JSON.stringify(result.historyEntry.undoSnapshot?.canvasModelBefore) === JSON.stringify(inputCanvas),
    "undo snapshot stores pre-batch canvas",
  );
  assert(result.appliedPatches.every((patch) => patch.beforeSnapshot !== undefined), "applied patches capture before snapshots");
  assert(result.appliedPatches.every((patch) => patch.afterSnapshot !== undefined), "applied patches capture after snapshots");
  assert(result.mutationBatch.appliedCount === result.appliedPatches.length, "mutation batch counts applied patches");
}

// undo snapshot includes canvasModelAfter distinct from before when patches apply
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const plan = basePlan([
    nodeAction({
      id: "evo_undo_after",
      actionType: "weaken_node",
      targetId: "node_potential",
      reason: "Undo after snapshot check.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  const snapshot = result.historyEntry.undoSnapshot;
  assert(snapshot !== undefined, "undo snapshot present on successful apply");
  assert(
    JSON.stringify(snapshot?.canvasModelBefore) === before,
    "undo snapshot canvasModelBefore matches pre-apply canvas",
  );
  assert(
    JSON.stringify(snapshot?.canvasModelAfter) !== before,
    "undo snapshot canvasModelAfter differs after apply",
  );
  assert(
    snapshot?.canvasModelAfter.evolutionOverlay?.weakenedNodeIds.includes("node_potential"),
    "canvasModelAfter captures overlay changes",
  );
}

// undo helpers select latest undoable entry and mark undone without deleting history
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_undo_helpers",
      actionType: "weaken_node",
      targetId: "node_root",
      reason: "Undo helper check.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, dryRun));
  const history: EvolutionHistoryEntry[] = [result.historyEntry];

  const undoable = findLatestUndoableEvolutionHistoryEntry(history);
  assert(undoable !== null, "findLatestUndoableEvolutionHistoryEntry finds applied batch");
  assert(undoable?.undoAvailable === true, "undoable entry has undoAvailable true");

  const restored = structuredClone(undoable!.undoSnapshot!.canvasModelBefore);
  assert(
    JSON.stringify(restored) === JSON.stringify(inputCanvas),
    "restored model equals original pre-apply canvas",
  );

  const marked = markEvolutionHistoryEntryUndone(history, undoable!.id, "2026-07-08T08:30:00.000Z");
  assert(marked.length === 1, "history entry count preserved after mark undone");
  assert(marked[0].undoAvailable === false, "undone entry has undoAvailable false");
  assert(marked[0].undoneAt !== undefined, "undone entry records undoneAt");
  assert(
    findLatestUndoableEvolutionHistoryEntry(marked) === null,
    "undone entry no longer undoable",
  );

  const delta = computeEvolutionOverlayBatchDelta(
    undoable!.undoSnapshot!.canvasModelBefore,
    undoable!.undoSnapshot!.canvasModelAfter,
  );
  assert(delta.weakenedAdded.includes("node_root"), "batch delta captures weakened nodes");
}

// fingerprint is stable for same canvas regardless of array ordering
{
  const canvasA = buildCanvas();
  const canvasB = buildCanvas({
    nodes: [...canvasA.nodes].reverse(),
    constellations: canvasA.constellations.map((constellation) => ({
      ...constellation,
      nodeIds: [...constellation.nodeIds].reverse(),
    })),
  });
  assert(
    createCanvasEvolutionFingerprint(canvasA) === createCanvasEvolutionFingerprint(canvasB),
    "fingerprint stable for same canvas with different ordering",
  );
}

// fingerprint changes when node is added
{
  const base = buildCanvas();
  const withNode = buildCanvas({
    nodes: [
      ...base.nodes,
      {
        id: "node_fingerprint_new",
        title: "Fingerprint New Node",
        description: "Added for fingerprint test",
        constellationId: "constellation_alpha",
        generatedByAgentId: "agent_1",
        whyPromising: "Test",
        risk: "low",
        explorationQuestions: [],
        nodeType: "concept",
        status: "potential",
        aiGenerated: true,
      },
    ],
    constellations: base.constellations.map((constellation) =>
      constellation.id === "constellation_alpha"
        ? { ...constellation, nodeIds: [...constellation.nodeIds, "node_fingerprint_new"] }
        : constellation,
    ),
  });
  assert(
    createCanvasEvolutionFingerprint(base) !== createCanvasEvolutionFingerprint(withNode),
    "fingerprint changes when node is added",
  );
}

// fingerprint changes when overlay archived/weakened ids change
{
  const base = buildCanvas();
  const weakened = {
    ...base,
    evolutionOverlay: {
      archivedNodeIds: [],
      weakenedNodeIds: ["node_potential"],
      strengthenedNodeIds: [],
      edges: [],
      nodeEvolutionMetadata: {},
      constellationMetadata: {},
    },
  } as CanvasWorldModel;
  const archived = {
    ...base,
    evolutionOverlay: {
      archivedNodeIds: ["node_potential"],
      weakenedNodeIds: [],
      strengthenedNodeIds: [],
      edges: [],
      nodeEvolutionMetadata: {},
      constellationMetadata: {},
    },
  } as CanvasWorldModel;
  assert(
    createCanvasEvolutionFingerprint(base) !== createCanvasEvolutionFingerprint(weakened),
    "fingerprint changes when weakened overlay ids change",
  );
  assert(
    createCanvasEvolutionFingerprint(weakened) !== createCanvasEvolutionFingerprint(archived),
    "fingerprint changes when archived overlay ids change",
  );
}

// apply succeeds when dry-run fingerprint matches current canvas
{
  const inputCanvas = buildCanvas();
  const plan = basePlan([
    nodeAction({
      id: "evo_fingerprint_match",
      actionType: "weaken_node",
      targetId: "node_root",
      reason: "Fingerprint match apply.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  assert(
    dryRun.canvasFingerprint === createCanvasEvolutionFingerprint(inputCanvas),
    "dry-run stores matching canvas fingerprint",
  );
  const result = applyWorldEvolutionPatches(
    applyInput(inputCanvas, dryRun, {
      currentCanvasFingerprint: createCanvasEvolutionFingerprint(inputCanvas),
    }),
  );
  assert(result.status === "applied", "apply succeeds when fingerprint matches");
}

// apply fails with unchanged canvas when dry-run fingerprint is stale
{
  const inputCanvas = buildCanvas();
  const before = JSON.stringify(inputCanvas);
  const plan = basePlan([
    nodeAction({
      id: "evo_fingerprint_stale",
      actionType: "weaken_node",
      targetId: "node_root",
      reason: "Stale fingerprint apply.",
      requiresUserConfirmation: false,
    }),
  ]);
  const dryRun = dryRunForPlan(plan, inputCanvas, canonState);
  const staleDryRun: WorldEvolutionApplyDryRunResult = {
    ...dryRun,
    canvasFingerprint: "stale_fingerprint_value",
  };
  const result = applyWorldEvolutionPatches(applyInput(inputCanvas, staleDryRun));
  assert(result.status === "failed", "stale dry-run apply fails");
  assert(JSON.stringify(result.canvasModel) === before, "stale apply leaves canvas unchanged");
  assert(
    result.failedPatches.some((patch) => patch.stopReason === "stale_dry_run"),
    "stale failure includes stale_dry_run stop reason",
  );
  assert(
    result.summary.includes("stale"),
    "stale failure includes readable summary",
  );
}

console.log("All World evolution guarded apply checks passed.");

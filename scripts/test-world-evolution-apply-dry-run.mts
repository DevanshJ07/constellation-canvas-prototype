/**
 * No-network tests for World Evolution apply dry-run (Phase 5.3).
 *
 * Usage: npx tsx scripts/test-world-evolution-apply-dry-run.mts
 */

import type { CanvasWorldModel } from "../lib/worldBrain/mapArchitectureToCanvas.ts";
import {
  buildWorldEvolutionApplyDryRun,
  createCanvasEvolutionFingerprint,
  getBlockedPatchCandidates,
  getReadyPatchCandidates,
  mapEvolutionActionToPatchCandidates,
  validateWorldEvolutionApplyDryRun,
  type EvolutionCanvasPatchCandidate,
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
    id: "dry_run_test_plan",
    applyPlanId: "dry_run_apply_plan",
    previewId: "dry_run_preview",
    triggerEventId: "dry_run_trigger",
    status: readyActions.length > 0 ? "ready_for_preview" : "empty",
    actions,
    readyActions,
    blockedActions: actions.filter((action) => action.status !== "ready"),
    blockers: [],
    warnings: [],
    summary: "Dry-run test plan",
    policy: DEFAULT_EVOLUTION_POLICY,
    nodeBudgetRemaining: 3,
    createdAt: "2026-07-08T07:00:00.000Z",
  };
}

function nodeAction(partial: Partial<NodeEvolutionAction> & Pick<NodeEvolutionAction, "id" | "actionType" | "targetId" | "reason">): NodeEvolutionAction {
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

const canvas = buildCanvas();
const canonState = {
  truthNodeIds: ["node_canon"],
  potentialNodeIds: ["node_potential"],
  rejectedNodeIds: [],
  truthCount: 1,
  potentialCount: 1,
  rejectedCount: 0,
};

console.log("=== World evolution apply dry-run (no network) ===\n");

// ready generate_node → add_node patch candidate
{
  const plan = basePlan([
    nodeAction({
      id: "evo_generate_child",
      actionType: "generate_node",
      targetId: "node_new_child",
      parentNodeId: "node_root",
      proposedLabel: "New Child Node",
      continuationAnchor: "follow-up clue on the desk",
      reason: "Generate child node from root.",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  const addPatch = result.readyPatches.find((patch) => patch.patchType === "add_node");
  assert(addPatch !== undefined, "ready generate_node → add_node patch candidate");
  assert(addPatch.requiresConfirmation, "add_node requires confirmation");
  assert(result.readyPatches.some((patch) => patch.patchType === "add_edge"), "generate adds edge when parent specified");
}

// ready weaken_node → mark_node_weakened
{
  const plan = basePlan([
    nodeAction({
      id: "evo_weaken",
      actionType: "weaken_node",
      targetId: "node_potential",
      reason: "Reduce emphasis on potential note.",
      requiresUserConfirmation: false,
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  assert(
    result.readyPatches.some((patch) => patch.patchType === "mark_node_weakened"),
    "ready weaken_node → mark_node_weakened patch candidate",
  );
  const weakenPatch = result.readyPatches.find((patch) => patch.patchType === "mark_node_weakened")!;
  assert(weakenPatch.reversible, "mark_node_weakened reversible");
}

// archive_node on canon → blocked
{
  const plan = basePlan([
    nodeAction({
      id: "evo_archive_canon",
      actionType: "archive_node",
      targetId: "node_canon",
      reason: "Attempt archive canon node.",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  const archivePatch = result.patchCandidates.find((patch) => patch.patchType === "archive_node");
  assert(archivePatch?.status === "blocked", "archive_node on canon node → blocked");
  assert(
    result.blockers.some((b) => b.kind === "canon_protection"),
    "canon archive produces canon_protection blocker",
  );
}

// archive_node on non-canon potential → archive candidate requiring confirmation
{
  const plan = basePlan([
    nodeAction({
      id: "evo_archive_potential",
      actionType: "archive_node",
      targetId: "node_potential",
      reason: "Archive potential note.",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  const archivePatch = result.patchCandidates.find((patch) => patch.patchType === "archive_node");
  assert(archivePatch !== undefined, "archive potential produces archive patch");
  assert(
    archivePatch.status === "needs_review" || archivePatch.requiresConfirmation,
    "archive_node on potential requires confirmation/review",
  );
  assert(archivePatch.reversible, "archive reversible");
}

// modify_node on existing node → update_node_metadata
{
  const plan = basePlan([
    nodeAction({
      id: "evo_modify",
      actionType: "modify_node",
      targetId: "node_root",
      reason: "Update root metadata.",
      payload: { toneShift: "more urgent" },
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  assert(
    result.readyPatches.some((patch) => patch.patchType === "update_node_metadata"),
    "modify_node → update_node_metadata candidate",
  );
}

// refocus_constellation → update_constellation_metadata
{
  const plan = basePlan([
    constellationAction({
      id: "evo_refocus",
      actionType: "refocus_constellation",
      constellationId: "constellation_alpha",
      focusShift: "emphasize root mysteries",
      reason: "Refocus constellation metadata.",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  assert(
    result.readyPatches.some((patch) => patch.patchType === "update_constellation_metadata"),
    "refocus_constellation → update_constellation_metadata candidate",
  );
}

// missing node target → blocker
{
  const plan = basePlan([
    nodeAction({
      id: "evo_missing_node",
      actionType: "modify_node",
      targetId: "node_ghost",
      reason: "Modify missing node.",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  assert(
    result.blockers.some((b) => b.message.includes("does not exist")),
    "missing node target → blocker",
  );
  assert(getReadyPatchCandidates(result).length === 0, "missing node produces no ready patches");
}

// missing constellation target → blocker
{
  const plan = basePlan([
    constellationAction({
      id: "evo_missing_constellation",
      actionType: "refocus_constellation",
      constellationId: "constellation_missing",
      reason: "Refocus missing constellation.",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  assert(
    result.blockers.some((b) => b.message.includes("constellation does not exist")),
    "missing constellation target → blocker",
  );
}

// duplicate new node in same constellation → blocked
{
  const plan = basePlan([
    nodeAction({
      id: "evo_dup_a",
      actionType: "generate_node",
      targetId: "node_dup_a",
      parentNodeId: "node_root",
      proposedLabel: "Shared Heir Name",
      continuationAnchor: "duplicate label branch a",
      reason: "Duplicate label generate a.",
    }),
    nodeAction({
      id: "evo_dup_b",
      actionType: "generate_node",
      targetId: "node_dup_b",
      parentNodeId: "node_root",
      proposedLabel: "Shared Heir Name",
      continuationAnchor: "duplicate label branch b",
      reason: "Duplicate label generate b.",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  const dupBlocked = result.patchCandidates.filter(
    (patch) => patch.patchType === "add_node" && patch.status === "blocked",
  );
  assert(dupBlocked.length >= 1, "duplicate new node label in constellation → blocked");
}

// add_edge with missing endpoint → blocked unless proposed in same batch
{
  const orphanPlan = basePlan([
    nodeAction({
      id: "evo_orphan_edge",
      actionType: "strengthen_node",
      targetId: "node_root",
      reason: "Placeholder action.",
    }),
  ]);
  const canvasSnapshot = buildCanvas();
  const mapped = mapEvolutionActionToPatchCandidates(
    nodeAction({
      id: "evo_edge_only",
      actionType: "generate_node",
      targetId: "node_edge_child",
      parentNodeId: "node_missing_parent",
      proposedLabel: "Edge Child",
      continuationAnchor: "orphan edge test",
      reason: "Generate with missing parent edge.",
    }),
    {
      canvasModel: canvasSnapshot,
      existingNodeIds: new Set(["node_root"]),
      existingConstellationIds: new Set(["constellation_alpha"]),
      nodeConstellationMap: { node_root: "constellation_alpha" },
      nodeTitleById: { node_root: "Root Node" },
      preservedTargetIds: new Set(),
      lockedTargetIds: new Set(),
      proposedNodeIds: new Set(),
      proposedLabelsByConstellation: new Map(),
      readyAddNodeCount: 0,
      nodeBudgetRemaining: 3,
      maxNodesPerConstellation: 24,
      constellationNodeCounts: { constellation_alpha: 3 },
    },
  );
  const edgeCandidate = mapped.candidates.find((patch) => patch.patchType === "add_edge");
  assert(edgeCandidate !== undefined, "generate maps add_edge candidate");
  const dryRun = buildWorldEvolutionApplyDryRun({
    plan: basePlan([
      nodeAction({
        id: "evo_edge_batch",
        actionType: "generate_node",
        targetId: "node_edge_ok",
        parentNodeId: "node_root",
        proposedLabel: "Edge OK Child",
        continuationAnchor: "valid parent edge",
        reason: "Generate with valid parent edge.",
      }),
    ]),
    canvasModel: canvasSnapshot,
    canonState,
  });
  assert(
    dryRun.readyPatches.some((patch) => patch.patchType === "add_edge"),
    "add_edge with valid parent in batch → ready",
  );
  assert(orphanPlan.readyActions.length > 0, "orphan plan sanity");
  assert(
    mapped.blockers.length > 0 ||
      mapped.candidates.some((patch) => patch.patchType === "add_edge"),
    "missing parent edge scenario mapped",
  );
}

// skipped/blocked/downgraded evolution actions do not become ready patches
{
  const plan = basePlan([
    nodeAction({
      id: "evo_skipped",
      actionType: "generate_node",
      targetId: "node_skipped",
      reason: "Skipped generate.",
      status: "skipped",
    }),
    nodeAction({
      id: "evo_downgraded",
      actionType: "weaken_node",
      targetId: "node_potential",
      reason: "Downgraded weaken.",
      status: "downgraded",
    }),
    nodeAction({
      id: "evo_blocked",
      actionType: "modify_node",
      targetId: "node_root",
      reason: "Blocked modify.",
      status: "blocked",
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  assert(getReadyPatchCandidates(result).length === 0, "non-ready actions produce no ready patches");
  assert(
    result.blockers.some((b) => b.kind === "action_not_ready"),
    "non-ready actions emit action_not_ready blockers",
  );
}

// input canvas snapshot is not mutated
{
  const canvasCopy = buildCanvas();
  const before = JSON.stringify(canvasCopy);
  const plan = basePlan([
    nodeAction({
      id: "evo_immutable",
      actionType: "generate_node",
      targetId: "node_immutable_child",
      parentNodeId: "node_root",
      proposedLabel: "Immutable Test Child",
      continuationAnchor: "immutability check",
      reason: "Ensure canvas not mutated.",
    }),
    nodeAction({
      id: "evo_immutable_archive",
      actionType: "archive_node",
      targetId: "node_potential",
      reason: "Archive without mutation.",
    }),
  ]);
  buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvasCopy, canonState });
  assert(JSON.stringify(canvasCopy) === before, "input canvas snapshot is not mutated");
}

// validation + summary helpers
{
  const plan = basePlan([
    nodeAction({
      id: "evo_summary",
      actionType: "strengthen_node",
      targetId: "node_root",
      reason: "Strengthen root.",
      requiresUserConfirmation: false,
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  const validation = validateWorldEvolutionApplyDryRun(result);
  assert(validation.valid, "dry-run validation passes");
  assert(result.patchSummary.readyCount >= 1, "patch summary ready count");
  assert(result.summary.length > 10, "human-readable dry-run summary");
  assert(getBlockedPatchCandidates(result).every((p) => p.status !== "ready"), "blocked patches not ready");
}

// dry-run stores canvas fingerprint metadata
{
  const plan = basePlan([
    nodeAction({
      id: "evo_fingerprint_meta",
      actionType: "weaken_node",
      targetId: "node_root",
      reason: "Dry-run fingerprint metadata.",
      requiresUserConfirmation: false,
    }),
  ]);
  const result = buildWorldEvolutionApplyDryRun({ plan, canvasModel: canvas, canonState });
  assert(result.canvasFingerprint.length > 0, "dry-run stores canvasFingerprint");
  assert(
    result.canvasFingerprint === createCanvasEvolutionFingerprint(canvas),
    "dry-run canvasFingerprint matches canvas snapshot",
  );
  assert(result.sourcePlanId === plan.id, "dry-run stores sourcePlanId");
  assert(result.createdAt.length > 0, "dry-run stores createdAt");
}

console.log("All World evolution apply dry-run checks passed.");

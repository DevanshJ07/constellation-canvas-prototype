/**
 * No-network tests for World Evolution preview model (Phase 5.2).
 *
 * Usage: npx tsx scripts/test-world-evolution-preview-model.mts
 */

import { buildWorldEvolutionPlanFromRipplePreview } from "../lib/worldBrain/buildWorldEvolutionFromRipple.ts";
import { buildRippleApplyPlan } from "../lib/worldBrain/rippleApplyPlan.ts";
import { buildMemoryEconomyRipplePreviewFixture } from "../lib/worldBrain/ripplePreviewFixture.ts";
import {
  updateRippleOperationApproval,
  type RipplePreviewModel,
} from "../lib/worldBrain/ripplePreviewModel.ts";
import type { RippleApplyOperation, RippleApplyPlan } from "../lib/worldBrain/rippleApplyPlan.ts";
import {
  buildWorldEvolutionPlan,
  DEFAULT_EVOLUTION_POLICY,
  type WorldEvolutionInput,
  type WorldEvolutionPlan,
} from "../lib/worldBrain/worldEvolutionPlan.ts";
import {
  buildDryRunPreviewGroups,
  buildWorldEvolutionPreviewModel,
  computeEvolutionConfidenceSummary,
  getDryRunPreviewStatus,
  getEvolutionPreviewStatus,
  groupDryRunPatchCandidates,
  groupEvolutionActionsByStatus,
  summarizeEvolutionActionForUser,
} from "../lib/worldBrain/worldEvolutionPreviewModel.ts";
import {
  buildWorldEvolutionApplyDryRun,
} from "../lib/worldBrain/worldEvolutionApplyDryRun.ts";

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

function readyPlan(approvedOperations: RippleApplyOperation[]): RippleApplyPlan {
  return {
    id: "preview_test_apply_plan",
    previewId: "preview_test_preview",
    triggerEventId: "preview_test_trigger",
    status: "ready_to_apply",
    approvedOperations,
    rejectedOperations: [],
    clarificationOperations: [],
    blockers: [],
    warnings: [],
    summary: "Preview test apply plan",
    createdAt: "2026-07-08T06:30:00.000Z",
  };
}

function buildPlan(input: WorldEvolutionInput): WorldEvolutionPlan {
  return buildWorldEvolutionPlan(input);
}

console.log("=== World evolution preview model (no network) ===\n");

// Ready plan groups ready actions
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
const readyEvolutionPlan = buildPlan({
  applyPlan: readyPlan([sciFiGenerate]),
  triggerNodeId: "node_housing_credit_exchange",
  existingNodeIds: ["node_housing_credit_exchange"],
  nodeConstellationMap: {
    node_housing_credit_exchange: "constellation_housing_credits",
  },
  operationConfidenceBySourceId: {
    ripple_op_generate_new_node_node_childhood_debt_collector_0: 0.82,
  },
});
const readyPreview = buildWorldEvolutionPreviewModel(readyEvolutionPlan)!;
assert(readyPreview.status === "ready_for_preview", "ready plan status mapped");
assert(readyPreview.readyActions.length >= 1, "ready plan groups ready actions");
assert(readyPreview.readyActions[0]!.userSummary.length > 10, "action user summary populated");

// Blocked plan groups blockers
const blockedEvolutionPlan = buildPlan({
  applyPlan: readyPlan([]),
});
blockedEvolutionPlan.status = "blocked";
blockedEvolutionPlan.blockers.push({
  id: "blocker_test",
  kind: "node_budget",
  message: "Node budget exceeded",
  stopReason: "node_budget_exceeded",
});
const blockedPreview = buildWorldEvolutionPreviewModel(blockedEvolutionPlan)!;
assert(blockedPreview.isBlocked || blockedPreview.blockers.length > 0, "blocked plan exposes blockers");

// Needs review plan groups downgraded/conflicted actions
const conflictTarget = "node_rival_heir";
const conflictPlan = buildPlan({
  applyPlan: readyPlan([
    applyOp({
      id: "apply_strengthen",
      sourceOperationId: "ripple_strengthen",
      operationType: "strengthen_node",
      target: { targetType: "node", id: conflictTarget, constellationId: "constellation_estate" },
      reason: "Strengthen heir claim",
    }),
    applyOp({
      id: "apply_weaken",
      sourceOperationId: "ripple_weaken",
      operationType: "weaken_node",
      target: { targetType: "node", id: conflictTarget, constellationId: "constellation_estate" },
      reason: "Weaken heir claim",
    }),
  ]),
  triggerNodeId: "node_estate_root",
  existingNodeIds: [conflictTarget, "node_estate_root"],
  nodeConstellationMap: {
    node_estate_root: "constellation_estate",
    [conflictTarget]: "constellation_estate",
  },
  operationConfidenceBySourceId: {
    ripple_strengthen: 0.9,
    ripple_weaken: 0.7,
  },
});
const conflictPreview = buildWorldEvolutionPreviewModel(conflictPlan)!;
assert(
  conflictPreview.status === "needs_review" || conflictPreview.needsReviewActions.length > 0,
  "needs_review plan groups downgraded/conflicted actions",
);
assert(
  conflictPreview.blockers.some((b) => b.kind === "conflict") ||
    conflictPreview.skippedActions.length > 0,
  "conflict blockers or skipped actions surfaced",
);

// Empty plan returns empty preview
const emptyPlan = buildPlan({ applyPlan: readyPlan([]) });
const emptyPreview = buildWorldEvolutionPreviewModel(emptyPlan)!;
assert(emptyPreview.isEmpty, "empty plan returns empty preview");
assert(emptyPreview.readyActions.length === 0, "empty preview has no ready actions");

// Failed plan
const failedPlan = buildPlan({
  applyPlan: {
    ...readyPlan([]),
    status: "blocked",
    blockers: [{ id: "apply_blocker", kind: "preview_blocked", message: "Not ready" }],
  },
});
assert(failedPlan.status === "failed", "non-ready apply plan fails evolution planning");
const failedPreview = buildWorldEvolutionPreviewModel(failedPlan)!;
assert(failedPreview.isFailed, "failed preview flagged");

// Warnings surfaced
const overcrowdedPlan = buildPlan({
  applyPlan: readyPlan([
    applyOp({
      id: "apply_generate_crowded",
      sourceOperationId: "ripple_generate_crowded",
      operationType: "generate_new_node",
      target: {
        targetType: "node",
        id: "node_crowded_child",
        constellationId: "constellation_crowded",
        parentNodeId: "node_crowded_root",
      },
      reason: "Near-cap generate",
      payload: {
        continuationAnchor: "crowded branch detail",
        proposedTitle: "Crowded Child",
      },
    }),
  ]),
  triggerNodeId: "node_crowded_root",
  existingNodeIds: ["node_crowded_root"],
  nodeConstellationMap: { node_crowded_root: "constellation_crowded" },
  constellationNodeCounts: { constellation_crowded: 22 },
  operationConfidenceBySourceId: { ripple_generate_crowded: 0.9 },
});
const overcrowdedPreview = buildWorldEvolutionPreviewModel(overcrowdedPlan)!;
assert(
  overcrowdedPreview.warnings.some((w) => w.warningType === "constellation_near_cap"),
  "warnings are surfaced",
);

// Confidence summary computed
const confidenceSummary = computeEvolutionConfidenceSummary(readyEvolutionPlan);
assert(confidenceSummary.readyCount >= 1, "confidence summary ready count");
assert(confidenceSummary.averageReadyConfidence > 0, "confidence summary average computed");

// Helper coverage
const groups = groupEvolutionActionsByStatus(readyEvolutionPlan);
assert(groups.readyActions.length === readyPreview.readyActions.length, "group helper matches preview");
assert(
  summarizeEvolutionActionForUser(readyEvolutionPlan.actions[0]!).includes("proposed"),
  "summarizeEvolutionActionForUser readable",
);
assert(getEvolutionPreviewStatus(readyEvolutionPlan) === "ready_for_preview", "preview status helper");

// End-to-end from ripple preview fixture (no API)
const ripplePreview: RipplePreviewModel = buildMemoryEconomyRipplePreviewFixture();
const approvedPreview = ripplePreview.operationPreviews.reduce(
  (model, op) => updateRippleOperationApproval(model, op.id, "approved"),
  ripplePreview,
);
const endToEndPlan = buildWorldEvolutionPlanFromRipplePreview({
  preview: approvedPreview,
  nodeTitleById: { node_housing_credit_exchange: "Housing Credit Exchange" },
  nodeConstellationMap: { node_housing_credit_exchange: "constellation_housing_credits" },
  existingNodeIds: ["node_housing_credit_exchange"],
});
const endToEndPreview = buildWorldEvolutionPreviewModel(endToEndPlan);
assert(endToEndPreview !== null, "ripple fixture produces preview model");
assert(endToEndPreview.canShowPreview, "preview model can show preview");

// Null plan
assert(buildWorldEvolutionPreviewModel(null) === null, "null plan returns null preview");
assert(getEvolutionPreviewStatus(null) === "no_plan", "null plan status");

// Dry-run preview grouping
const dryRunPlan = buildPlan({
  applyPlan: readyPlan([
    applyOp({
      id: "apply_generate_child",
      sourceOperationId: "ripple_generate_child",
      operationType: "generate_new_node",
      target: {
        targetType: "node",
        id: "node_child",
        constellationId: "constellation_housing_credits",
        parentNodeId: "node_housing_credit_exchange",
      },
      reason: "Generate child node.",
      payload: {
        continuationAnchor: "desk clue follow-up",
        proposedTitle: "Desk Clue Child",
      },
    }),
  ]),
  triggerNodeId: "node_housing_credit_exchange",
  existingNodeIds: ["node_housing_credit_exchange"],
  nodeConstellationMap: {
    node_housing_credit_exchange: "constellation_housing_credits",
  },
  operationConfidenceBySourceId: { ripple_generate_child: 0.9 },
});
const dryRunResult = buildWorldEvolutionApplyDryRun({
  plan: dryRunPlan,
  existingNodeIds: ["node_housing_credit_exchange"],
  existingConstellationIds: ["constellation_housing_credits"],
  nodeConstellationMap: {
    node_housing_credit_exchange: "constellation_housing_credits",
  },
  nodeTitleById: { node_housing_credit_exchange: "Housing Credit Exchange" },
});
const dryRunGroups = groupDryRunPatchCandidates(dryRunResult);
assert(dryRunGroups.readyPatches.length >= 1, "dry-run groups ready patches");
assert(
  dryRunGroups.readyPatches.some((patch) => patch.patchType === "add_node"),
  "dry-run ready includes add_node preview item",
);

// Blocked archive on canon surfaces blockers in preview groups
const canonArchivePlan = buildPlan({
  applyPlan: readyPlan([
    applyOp({
      id: "apply_archive_canon",
      sourceOperationId: "ripple_archive_canon",
      operationType: "remove_node",
      target: { targetType: "node", id: "node_canon_truth", constellationId: "constellation_housing_credits" },
      reason: "Remove canon node.",
    }),
  ]),
  existingNodeIds: ["node_canon_truth"],
  nodeConstellationMap: { node_canon_truth: "constellation_housing_credits" },
  canonState: {
    truthNodeIds: ["node_canon_truth"],
    potentialNodeIds: [],
    rejectedNodeIds: [],
    truthCount: 1,
    potentialCount: 0,
    rejectedCount: 0,
  },
});
// remove becomes weaken in planner - use direct archive action plan
canonArchivePlan.actions = [
  {
    ...canonArchivePlan.actions[0]!,
    kind: "node",
    actionType: "archive_node",
    targetId: "node_canon_truth",
    status: "ready",
  } as never,
];
canonArchivePlan.readyActions = canonArchivePlan.actions;
const canonDryRun = buildWorldEvolutionApplyDryRun({
  plan: canonArchivePlan,
  existingNodeIds: ["node_canon_truth"],
  existingConstellationIds: ["constellation_housing_credits"],
  nodeConstellationMap: { node_canon_truth: "constellation_housing_credits" },
  canonState: {
    truthNodeIds: ["node_canon_truth"],
    potentialNodeIds: [],
    rejectedNodeIds: [],
    truthCount: 1,
    potentialCount: 0,
    rejectedCount: 0,
  },
});
const canonDryRunGroups = buildDryRunPreviewGroups(canonDryRun)!;
assert(
  canonDryRunGroups.blockedPatches.length >= 1 ||
    canonDryRunGroups.blockers.some((b) => b.kind.includes("canon")),
  "blocked canon archive surfaces blockers in dry-run preview",
);

// Confirmation-required archive on potential → needs review group
const potentialArchivePlan = { ...canonArchivePlan };
potentialArchivePlan.actions = [
  {
    id: "evo_archive_potential",
    kind: "node",
    sourceOperationId: "ripple_archive_potential",
    actionType: "archive_node",
    targetId: "node_potential_note",
    constellationId: "constellation_housing_credits",
    reason: "Archive potential note.",
    confidence: 0.85,
    riskLevel: "medium",
    reversible: true,
    requiresUserConfirmation: true,
    propagation: { scope: "node", hopsFromTrigger: 0, cappedByPolicy: false },
    confidenceProfile: {
      baseConfidence: 0.85,
      distanceFactor: 1,
      warningFactor: 1,
      finalConfidence: 0.85,
      tier: "ready",
    },
    status: "ready",
  } as never,
];
potentialArchivePlan.readyActions = potentialArchivePlan.actions;
const potentialDryRun = buildWorldEvolutionApplyDryRun({
  plan: potentialArchivePlan,
  existingNodeIds: ["node_potential_note"],
  existingConstellationIds: ["constellation_housing_credits"],
  nodeConstellationMap: { node_potential_note: "constellation_housing_credits" },
  canonState: {
    truthNodeIds: [],
    potentialNodeIds: ["node_potential_note"],
    rejectedNodeIds: [],
    truthCount: 0,
    potentialCount: 1,
    rejectedCount: 0,
  },
});
const potentialGroups = buildDryRunPreviewGroups(potentialDryRun)!;
assert(
  potentialGroups.needsReviewPatches.length >= 1 ||
    potentialGroups.readyPatches.some((p) => p.requiresConfirmation),
  "confirmation-required archive flagged in dry-run preview",
);

// Empty and failed dry-run preview groups render safely
const emptyDryRun = buildWorldEvolutionApplyDryRun({ plan: buildPlan({ applyPlan: readyPlan([]) }) });
const emptyDryRunGroups = buildDryRunPreviewGroups(emptyDryRun)!;
assert(emptyDryRunGroups.isEmpty, "empty dry-run preview groups safe");
assert(buildDryRunPreviewGroups(null) === null, "null dry-run returns null groups");

const failedDryRun = buildWorldEvolutionApplyDryRun({
  plan: buildPlan({
    applyPlan: { ...readyPlan([]), status: "blocked", blockers: [{ id: "b", kind: "preview_blocked", message: "x" }] },
  }),
});
const failedDryRunGroups = buildDryRunPreviewGroups(failedDryRun)!;
assert(failedDryRunGroups.isFailed, "failed dry-run preview groups safe");
assert(getDryRunPreviewStatus(failedDryRun) === "failed", "failed dry-run status helper");

console.log("ready preview status:", readyPreview.displayStatus);
console.log("conflict preview status:", conflictPreview.status);
console.log("empty preview summary:", emptyPreview.summary.slice(0, 60));
console.log("end-to-end preview ready actions:", endToEndPreview!.readyActions.length);

console.log("\nAll World evolution preview model checks passed.");

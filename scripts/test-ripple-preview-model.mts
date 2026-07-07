/**
 * Manual local test for Ripple preview model — no network.
 *
 * Usage: npx tsx scripts/test-ripple-preview-model.mts
 */

import type { RippleEffectOutput } from "../lib/worldBrain/rippleEffectTypes.ts";
import {
  buildRipplePreviewModel,
  getApprovalRequiredOperations,
  getHighRiskOperations,
  getRipplePreviewStatus,
  getWarningsRequiringAttention,
  mapRippleOperationToPreview,
  mapRippleWarningToPreview,
  summarizeRipplePreview,
  updateRippleOperationApproval,
  validateRipplePreviewModel,
} from "../lib/worldBrain/ripplePreviewModel.ts";

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
    summary: "Memory trade reshapes housing and debt nodes.",
    impactLevel: "moderate",
    affectedScopes: ["node", "constellation", "canon"],
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

console.log("=== Ripple preview model (no network) ===\n");

// Sci-fi memory economy
const sciFiOutput = baseOutput({
  summary: "Regulated housing memory trade strengthens debt collection.",
  nodeImpacts: [
    {
      nodeId: "node_childhood_debt_collector",
      constellationId: "constellation_memory_economy",
      impactType: "strengthen",
      reason: "Legitimized trade increases collector relevance.",
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
      reason: "Debt collector becomes central to housing economy.",
      priority: "medium",
      requiresUserApproval: true,
    },
  ],
});

const sciFiPreview = buildRipplePreviewModel(sciFiOutput, {
  createdAt: "2026-07-07T18:00:00.000Z",
  nodeTitleById: {
    node_childhood_debt_collector: "Childhood Debt Collector",
  },
  constellationTitleById: {
    constellation_memory_economy: "Memory Economy",
  },
});

assert(sciFiPreview.operationPreviews.length === 1, "operation previews created");
assert(sciFiPreview.affectedNodePreviews[0]?.title === "Childhood Debt Collector", "node title lookup");
assert(sciFiPreview.counts.operationCount === 1, "operation count");
assert(validateRipplePreviewModel(sciFiPreview).valid, "valid sci-fi preview");

// Romance dream contradiction warning
const romanceOutput = baseOutput({
  summary: "Dream-only contact rule strains waking meetup nodes.",
  warnings: [
    {
      id: "ripple_warning_contradiction_node_dream_meeting_cafe_0",
      warningType: "contradiction",
      message: "Daily coffee shop meeting conflicts with dream-only rule.",
      severity: "high",
      affectedTargets: [{ targetType: "node", id: "node_dream_meeting_cafe" }],
    },
  ],
  nodeImpacts: [
    {
      nodeId: "node_dream_meeting_cafe",
      impactType: "require_modification",
      reason: "Waking meetup needs revision.",
      severity: "high",
      confidence: 0.9,
      suggestedOperationIds: [],
    },
  ],
});

const romancePreview = buildRipplePreviewModel(romanceOutput);
assert(romancePreview.warningPreviews.length === 1, "warning previews created");
assert(
  getWarningsRequiringAttention(romancePreview).length >= 1,
  "romance contradiction requires attention",
);
assert(
  getRipplePreviewStatus(romancePreview) === "blocked" ||
    getRipplePreviewStatus(romancePreview) === "needs_review",
  "romance preview needs review or blocked",
);

// Comedy treasure generate node
const comedyOp = mapRippleOperationToPreview(
  {
    id: "ripple_op_generate_new_node_node_crab_clue_0",
    operationType: "generate_new_node",
    target: { targetType: "node", id: "node_treasure_x_mark" },
    reason: "Map-eating crabs leave ink-stained clue fragments.",
    priority: "medium",
    requiresUserApproval: true,
  },
  { nodeTitleById: { node_treasure_x_mark: "Treasure X Mark" } },
);
assert(comedyOp.title === "Generate new node", "comedy operation title");
assert(comedyOp.approvalState === "pending", "approval pending by default");

// Sports flow conflict
const sportsOutput = baseOutput({
  impactLevel: "major",
  warnings: [
    {
      id: "ripple_warning_flow_conflict_flow_act_three_0",
      warningType: "flow_conflict",
      message: "Missed penalty makes victory parade sequence invalid.",
      severity: "medium",
      affectedTargets: [{ targetType: "flow_item", id: "flow_act_three_finale" }],
    },
  ],
  suggestedOperations: [
    {
      id: "ripple_op_update_flow_flow_act_three_0",
      operationType: "update_flow",
      target: { targetType: "flow_item", id: "flow_act_three_finale" },
      reason: "Reorder post-match celebration scenes.",
      priority: "high",
      requiresUserApproval: true,
    },
  ],
});

const sportsPreview = buildRipplePreviewModel(sportsOutput);
assert(getHighRiskOperations(sportsPreview).length >= 1, "sports high-risk op detected");
assert(sportsPreview.counts.highPriorityOperationCount === 1, "high priority count");

// Family saga inheritance modify
const familyOutput = baseOutput({
  constellationImpacts: [
    {
      constellationId: "constellation_estate_partition",
      impactType: "increase_priority",
      reason: "Will revision elevates inheritance dispute.",
      suggestedFocusShift: "heir legitimacy",
      suggestedNodeCountChange: 1,
      confidence: 0.7,
    },
  ],
  suggestedOperations: [
    {
      id: "ripple_op_modify_node_node_estate_heirloom_0",
      operationType: "modify_node",
      target: {
        targetType: "node",
        id: "node_estate_heirloom",
        constellationId: "constellation_estate_partition",
      },
      reason: "Heirloom chain must reflect revised will.",
      priority: "medium",
      requiresUserApproval: true,
    },
  ],
});

const familyPreview = buildRipplePreviewModel(familyOutput, {
  constellationTitleById: { constellation_estate_partition: "Estate Partition" },
});
assert(familyPreview.affectedConstellationPreviews[0]?.title === "Estate Partition", "constellation title lookup");
assert(getApprovalRequiredOperations(familyPreview).length === 1, "approval required ops");

// Immutable approval update
const updated = updateRippleOperationApproval(
  sciFiPreview,
  sciFiPreview.operationPreviews[0]!.id,
  "approved",
);
assert(updated.operationPreviews[0]?.approvalState === "approved", "approval updated");
assert(
  sciFiPreview.operationPreviews[0]?.approvalState === "pending",
  "original model unchanged",
);

// Duplicate operation id validation
const badPreview = buildRipplePreviewModel(sciFiOutput);
badPreview.operationPreviews.push({ ...badPreview.operationPreviews[0]! });
const badValidation = validateRipplePreviewModel(badPreview);
assert(!badValidation.valid, "duplicate operation ids fail validation");
assert(
  badValidation.errors.some((e) => e.includes("Duplicate operation preview id")),
  "duplicate error message",
);

// Failed preview via parse failure output shape
const failedOutput = baseOutput({
  summary: "Ripple analysis could not be parsed.",
  confidence: 0,
  impactLevel: "none",
});
const failedPreview = buildRipplePreviewModel(failedOutput);
assert(failedPreview.status === "failed", "parse failure → failed status");

// summarizeRipplePreview
const summary = summarizeRipplePreview(sciFiPreview);
assert(summary.triggerEventId === TRIGGER_ID, "summary triggerEventId");
assert(summary.counts.operationCount === 1, "summary counts");

// mapRippleWarningToPreview title
const warnPreview = mapRippleWarningToPreview(romanceOutput.warnings[0]!);
assert(warnPreview.title === "Contradiction", "warning title from type");

console.log("sci-fi status:", sciFiPreview.status);
console.log("romance status:", romancePreview.status);
console.log("sports high-risk ops:", getHighRiskOperations(sportsPreview).length);
console.log("failed status:", failedPreview.status);

console.log("\nAll Ripple preview model checks passed.");

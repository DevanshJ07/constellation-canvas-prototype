/**
 * Ripple user-flow helper tests (Phase 6A.2) — no network.
 */

import { buildMemoryEconomyRipplePreviewFixture } from "../lib/worldBrain/ripplePreviewFixture.ts";
import {
  approveSafeRippleOperations,
  buildRippleApplyPlanFromPreview,
  canOpenWorldEvolutionPreview,
  getRippleAcceptanceState,
  isRiskyPendingOperation,
  isSafePendingOperation,
  resolveRippleAcceptanceAction,
} from "../lib/rippleUserFlow.ts";
import { updateRippleOperationApproval } from "../lib/worldBrain/ripplePreviewModel.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log("=== Ripple user flow (no network) ===\n");

const fixture = buildMemoryEconomyRipplePreviewFixture();

assert(
  fixture.operationPreviews.some(isSafePendingOperation),
  "fixture should include safe pending operations",
);
assert(
  fixture.operationPreviews.some(isRiskyPendingOperation),
  "fixture should include risky pending operations",
);

const safeApproved = approveSafeRippleOperations(fixture);
const safeApprovedCount = safeApproved.operationPreviews.filter(
  (op) => op.approvalState === "approved",
).length;
assert(safeApprovedCount > 0, "safe operations should become approved");
assert(
  safeApproved.operationPreviews.some(
    (op) => op.approvalState === "pending" && isRiskyPendingOperation(op),
  ),
  "high-risk operations should remain pending after safe accept",
);

const safeApplyPlan = buildRippleApplyPlanFromPreview(safeApproved);
assert(
  safeApplyPlan.status !== "ready_to_apply",
  "apply plan should not be ready while high-risk operations remain pending",
);
assert(!canOpenWorldEvolutionPreview(safeApproved), "evolution should stay closed");

const acceptanceBefore = getRippleAcceptanceState(fixture);
assert(
  acceptanceBefore === "partial_accept" ||
    acceptanceBefore === "needs_review_first" ||
    acceptanceBefore === "blocked",
  `memory economy fixture should require review before evolution (got ${acceptanceBefore})`,
);

const resolved = resolveRippleAcceptanceAction(fixture);
assert(
  resolved.action.kind === "open_ripple_review",
  "mixed fixture should route to ripple review, not evolution",
);
assert(
  resolved.nextPreview.operationPreviews.some((op) => op.approvalState === "approved"),
  "resolve action should persist safe approvals on preview model",
);

let allApproved = fixture;
for (const op of fixture.operationPreviews) {
  allApproved = updateRippleOperationApproval(allApproved, op.id, "approved");
}
const allApprovedPlan = buildRippleApplyPlanFromPreview(allApproved);
assert(
  allApprovedPlan.status === "blocked" || allApprovedPlan.status === "needs_clarification",
  "canon conflict warnings should still block apply plan even when ops are approved",
);

const lowRiskOnly = buildMemoryEconomyRipplePreviewFixture();
let lowRiskPreview = lowRiskOnly;
for (const op of lowRiskOnly.operationPreviews) {
  if (op.riskLevel === "high" || op.operationType === "remove_node") {
    lowRiskPreview = updateRippleOperationApproval(lowRiskPreview, op.id, "rejected");
  } else {
    lowRiskPreview = updateRippleOperationApproval(lowRiskPreview, op.id, "approved");
  }
}
lowRiskPreview = {
  ...lowRiskPreview,
  warningPreviews: lowRiskPreview.warningPreviews.map((warning) => ({
    ...warning,
    requiresUserAttention: false,
    severity: "low" as const,
  })),
  status: "ready",
};
const lowRiskPlan = buildRippleApplyPlanFromPreview(lowRiskPreview);
assert(
  lowRiskPlan.status === "ready_to_apply",
  "explicitly approved safe/medium operations with no blockers should be ready_to_apply",
);
assert(canOpenWorldEvolutionPreview(lowRiskPreview), "evolution may open for ready apply plan");

const emptyResolved = resolveRippleAcceptanceAction({
  ...fixture,
  operationPreviews: [],
  counts: { ...fixture.counts, operationCount: 0 },
});
assert(emptyResolved.action.kind === "done", "empty preview should finish without evolution");

console.log("safe approved count:", safeApprovedCount);
console.log("acceptance before:", acceptanceBefore);
console.log("mixed action:", resolved.action.kind);
console.log("all-approved plan:", allApprovedPlan.status);
console.log("low-risk-only plan:", lowRiskPlan.status);

console.log("\nAll ripple user flow checks passed.");

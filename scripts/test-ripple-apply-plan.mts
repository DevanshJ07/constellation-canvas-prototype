/**
 * No-network test for Ripple apply plan contract (Phase 4.13).
 *
 * Usage: npx tsx scripts/test-ripple-apply-plan.mts
 */

import { buildMemoryEconomyRipplePreviewFixture } from "../lib/worldBrain/ripplePreviewFixture.ts";
import {
  buildRippleApplyPlan,
  getApprovedRippleOperations,
  getBlockedRippleOperations,
  summarizeRippleApplyPlan,
  validateRippleApplyPlan,
} from "../lib/worldBrain/rippleApplyPlan.ts";
import {
  updateRippleOperationApproval,
  type RipplePreviewModel,
} from "../lib/worldBrain/ripplePreviewModel.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log("=== Ripple apply plan (no network) ===\n");

const basePreview = buildMemoryEconomyRipplePreviewFixture();
assert(basePreview.operationPreviews.length === 3, "fixture has three operations");

// Approved ops become apply operations
const approvedPreview = updateRippleOperationApproval(
  basePreview,
  basePreview.operationPreviews[0]!.id,
  "approved",
);
const approvedPlan = buildRippleApplyPlan(approvedPreview, {
  createdAt: "2026-07-07T19:00:00.000Z",
});

assert(approvedPlan.approvedOperations.length === 1, "one approved apply operation");
assert(
  approvedPlan.approvedOperations[0]?.sourceOperationId ===
    approvedPreview.operationPreviews[0]?.sourceOperationId,
  "apply operation links to source id",
);
assert(validateRippleApplyPlan(approvedPlan).valid, "approved plan validates");

// Rejected ops are excluded from approvedOperations but tracked
const rejectedPreview = updateRippleOperationApproval(
  basePreview,
  basePreview.operationPreviews[1]!.id,
  "rejected",
);
const rejectedPlan = buildRippleApplyPlan(rejectedPreview);
assert(rejectedPlan.approvedOperations.length === 0, "rejected-only preview has no approved ops");
assert(rejectedPlan.rejectedOperations.length === 1, "rejected operation tracked");
assert(rejectedPlan.status === "empty", "rejected-only plan is empty");

// Clarify ops create blockers and needs_clarification status when approved coexist
const mixedPreview = updateRippleOperationApproval(
  updateRippleOperationApproval(
    basePreview,
    basePreview.operationPreviews[0]!.id,
    "approved",
  ),
  basePreview.operationPreviews[1]!.id,
  "needs_clarification",
);
const clarifyPlan = buildRippleApplyPlan(mixedPreview);
assert(
  clarifyPlan.clarificationOperations.length === 1,
  "clarification operation tracked",
);
assert(
  clarifyPlan.blockers.some((b) => b.kind === "clarification_required"),
  "clarification blocker created",
);
assert(clarifyPlan.status === "needs_clarification", "status needs_clarification");

// High-risk pending ops create blockers (even when nothing approved yet)
const pendingHighRiskPlan = buildRippleApplyPlan(basePreview);
assert(
  pendingHighRiskPlan.blockers.some((b) => b.kind === "high_risk_pending"),
  "high-risk pending op creates blocker",
);
assert(pendingHighRiskPlan.status === "empty", "no approvals keeps status empty");

// Approved + unresolved blockers => blocked
const partialApprovedPlan = buildRippleApplyPlan(
  updateRippleOperationApproval(basePreview, basePreview.operationPreviews[0]!.id, "approved"),
);
assert(partialApprovedPlan.status === "blocked", "unresolved blockers prevent ready_to_apply");

// Attention warnings also block when approvals exist
assert(
  partialApprovedPlan.blockers.some((b) => b.kind === "warning_attention"),
  "attention warnings create blockers",
);

// Empty approved plan
const emptyPlan = buildRippleApplyPlan(basePreview);
assert(emptyPlan.approvedOperations.length === 0, "no approved ops");
assert(emptyPlan.status === "empty", "empty status");

// Duplicate apply id validation
const badPlan = buildRippleApplyPlan(
  updateRippleOperationApproval(basePreview, basePreview.operationPreviews[0]!.id, "approved"),
);
badPlan.approvedOperations.push({ ...badPlan.approvedOperations[0]! });
const badValidation = validateRippleApplyPlan(badPlan);
assert(!badValidation.valid, "duplicate apply ids fail validation");
assert(
  badValidation.errors.some((e) => e.includes("Duplicate apply operation id")),
  "duplicate error message",
);

// Preview immutability
const previewCopy: RipplePreviewModel = JSON.parse(JSON.stringify(basePreview));
buildRippleApplyPlan(basePreview);
assert(
  JSON.stringify(previewCopy) === JSON.stringify(basePreview),
  "buildRippleApplyPlan does not mutate preview",
);

// Query helpers
assert(getApprovedRippleOperations(approvedPreview).length === 1, "getApprovedRippleOperations");
assert(getBlockedRippleOperations(basePreview).length >= 1, "getBlockedRippleOperations");

const summary = summarizeRippleApplyPlan(approvedPlan);
assert(summary.approvedCount === 1, "summary approved count");
assert(summary.previewId === basePreview.id, "summary preview id");

console.log("approved status:", approvedPlan.status);
console.log("clarify status:", clarifyPlan.status);
console.log("empty status:", emptyPlan.status);
console.log("blocked plan blockers:", partialApprovedPlan.blockers.length);

console.log("\nAll Ripple apply plan checks passed.");

/**
 * No-network test for Ripple preview fixture and approval count updates.
 *
 * Usage: npx tsx scripts/test-ripple-preview-fixture.mts
 */

import {
  summarizeRipplePreview,
  updateRippleOperationApproval,
  validateRipplePreviewModel,
} from "../lib/worldBrain/ripplePreviewModel.ts";
import { buildMemoryEconomyRipplePreviewFixture } from "../lib/worldBrain/ripplePreviewFixture.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log("=== Ripple preview fixture (no network) ===\n");

const preview = buildMemoryEconomyRipplePreviewFixture();
const validation = validateRipplePreviewModel(preview);

assert(validation.valid, `fixture valid: ${validation.errors.join("; ")}`);
assert(preview.operationPreviews.length === 3, "three operation previews");
assert(preview.warningPreviews.length === 2, "two warning previews");
assert(preview.preservedPreviews.length === 1, "one preserved element");
assert(preview.followUpQuestions.length === 2, "two follow-up questions");
assert(
  preview.status === "blocked" || preview.status === "needs_review",
  "memory economy preview needs review or blocked",
);

const firstOp = preview.operationPreviews[0]!;
assert(firstOp.approvalState === "pending", "initial approval pending");

const approved = updateRippleOperationApproval(preview, firstOp.id, "approved");
assert(
  approved.operationPreviews[0]?.approvalState === "approved",
  "approval state updated",
);
assert(
  preview.operationPreviews[0]?.approvalState === "pending",
  "original fixture unchanged",
);
assert(
  approved.counts.clarificationRequiredCount === 0,
  "approved op does not count as clarification",
);

const summary = summarizeRipplePreview(approved);
assert(summary.counts.operationCount === 3, "summary operation count");
assert(summary.status === approved.status, "summary status matches model");

console.log("title:", preview.title);
console.log("status:", preview.status);
console.log("impact:", preview.impactLevel);
console.log("operations:", preview.counts.operationCount);
console.log("warnings:", preview.counts.warningCount);
console.log("after approve:", approved.operationPreviews[0]?.approvalState);

console.log("\nAll Ripple preview fixture checks passed.");

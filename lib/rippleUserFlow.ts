/**
 * User-facing ripple / evolution flow helpers (Phase 6A.1 / 6A.2).
 * Maps internal planning statuses to creator-friendly copy.
 * Pure functions only — no React, no canvas mutation.
 */

import {
  buildRippleApplyPlan,
  type RippleApplyPlan,
  type RippleApplyPlanStatus,
} from "@/lib/worldBrain/rippleApplyPlan";
import type {
  RippleOperationPreview,
  RipplePreviewModel,
} from "@/lib/worldBrain/ripplePreviewModel";
import { updateRippleOperationApproval } from "@/lib/worldBrain/ripplePreviewModel";
import type { WorldEvolutionPlanStatus } from "@/lib/worldBrain/worldEvolutionPlan";

export type RippleConsequenceFlowState = "ready" | "needs_review" | "blocked" | "empty";

export type RippleAcceptanceState =
  | "ready_to_accept"
  | "partial_accept"
  | "needs_review_first"
  | "blocked"
  | "empty";

export type RippleUserApplyStatus =
  | "ready_to_apply"
  | "needs_review"
  | "blocked"
  | "failed"
  | "empty";

export type RippleAcceptanceAction =
  | { kind: "open_evolution" }
  | { kind: "open_ripple_review"; message: string }
  | { kind: "done" }
  | { kind: "stay_on_card" };

const ATTENTION_WARNING_TYPES = new Set([
  "contradiction",
  "canon_conflict",
  "flow_conflict",
]);

const REVIEW_NEEDED_MESSAGE =
  "Some changes still need review before the world evolves.";

export function isSafePendingOperation(op: RippleOperationPreview): boolean {
  return (
    op.approvalState === "pending" &&
    op.riskLevel !== "high" &&
    op.operationType !== "remove_node"
  );
}

export function isRiskyPendingOperation(op: RippleOperationPreview): boolean {
  return (
    op.approvalState === "pending" &&
    (op.riskLevel === "high" ||
      op.operationType === "remove_node" ||
      (op.requiresUserApproval && op.riskLevel !== "low"))
  );
}

export function approveSafeRippleOperations(
  preview: RipplePreviewModel,
): RipplePreviewModel {
  let next = preview;
  for (const op of preview.operationPreviews) {
    if (isSafePendingOperation(op)) {
      next = updateRippleOperationApproval(next, op.id, "approved");
    }
  }
  return next;
}

export function buildRippleApplyPlanFromPreview(
  preview: RipplePreviewModel,
): RippleApplyPlan {
  return buildRippleApplyPlan(preview);
}

export function mapRippleApplyPlanStatusToUserStatus(
  status: RippleApplyPlanStatus,
  previewStatus?: RipplePreviewModel["status"],
): RippleUserApplyStatus {
  if (previewStatus === "failed") return "failed";
  if (status === "ready_to_apply") return "ready_to_apply";
  if (status === "empty") return "empty";
  if (status === "blocked") return "blocked";
  return "needs_review";
}

export function getRippleApplyUserLabel(status: RippleUserApplyStatus): string {
  switch (status) {
    case "ready_to_apply":
      return "Ready to evolve";
    case "needs_review":
      return "Some changes need review";
    case "blocked":
      return "World evolution paused";
    case "failed":
      return "Could not prepare changes";
    case "empty":
      return "No world changes needed";
  }
}

export function getEvolutionPreviewUserLabel(
  status: WorldEvolutionPlanStatus | "no_plan",
): string {
  switch (status) {
    case "ready_for_preview":
      return "Ready to evolve";
    case "needs_review":
      return "Some changes need review";
    case "blocked":
      return "World evolution paused";
    case "failed":
      return "Could not prepare changes";
    case "empty":
    case "no_plan":
      return "No world changes needed";
  }
}

function hasBlockingWarnings(preview: RipplePreviewModel): boolean {
  return preview.warningPreviews.some(
    (warning) =>
      warning.requiresUserAttention &&
      (warning.severity === "high" ||
        ATTENTION_WARNING_TYPES.has(warning.warningType)),
  );
}

function hasClarificationNeeded(preview: RipplePreviewModel): boolean {
  return preview.operationPreviews.some(
    (op) => op.approvalState === "needs_clarification",
  );
}

function hasPendingRiskyOperations(preview: RipplePreviewModel): boolean {
  return preview.operationPreviews.some(isRiskyPendingOperation);
}

export function hasPendingSafeOperations(preview: RipplePreviewModel): boolean {
  return preview.operationPreviews.some(isSafePendingOperation);
}

/** Compact card acceptance state before user action. */
export function getRippleAcceptanceState(
  preview: RipplePreviewModel,
): RippleAcceptanceState {
  if (preview.status === "failed" || preview.status === "blocked") {
    return "blocked";
  }

  const activeOperations = preview.operationPreviews.filter(
    (op) => op.approvalState !== "rejected",
  );

  if (activeOperations.length === 0 && preview.counts.operationCount === 0) {
    return "empty";
  }

  const afterSafeApprove = approveSafeRippleOperations(preview);
  const applyPlanAfterSafe = buildRippleApplyPlan(afterSafeApprove);
  const pendingSafe = hasPendingSafeOperations(preview);
  const pendingRisky = hasPendingRiskyOperations(preview);

  if (canOpenWorldEvolutionPreview(afterSafeApprove)) {
    return "ready_to_accept";
  }

  if (applyPlanAfterSafe.status === "empty" && !pendingSafe && !pendingRisky) {
    return "empty";
  }

  if (pendingSafe && pendingRisky) {
    return "partial_accept";
  }

  if (!pendingSafe && pendingRisky) {
    return "needs_review_first";
  }

  if (
    hasClarificationNeeded(preview) ||
    hasBlockingWarnings(preview) ||
    preview.status === "needs_review"
  ) {
    return pendingSafe ? "partial_accept" : "needs_review_first";
  }

  if (applyPlanAfterSafe.status === "blocked") {
    return "blocked";
  }

  return pendingSafe ? "partial_accept" : "needs_review_first";
}

/** Applies safe approvals and returns the next UI action. */
export function resolveRippleAcceptanceAction(
  preview: RipplePreviewModel,
): { nextPreview: RipplePreviewModel; action: RippleAcceptanceAction } {
  const nextPreview = approveSafeRippleOperations(preview);
  const applyPlan = buildRippleApplyPlan(nextPreview);

  if (applyPlan.status === "ready_to_apply") {
    return { nextPreview, action: { kind: "open_evolution" } };
  }

  if (applyPlan.status === "empty") {
    return { nextPreview, action: { kind: "done" } };
  }

  if (
    hasPendingRiskyOperations(nextPreview) ||
    hasClarificationNeeded(nextPreview) ||
    hasBlockingWarnings(nextPreview) ||
    applyPlan.blockers.length > 0
  ) {
    return {
      nextPreview,
      action: {
        kind: "open_ripple_review",
        message: REVIEW_NEEDED_MESSAGE,
      },
    };
  }

  return { nextPreview, action: { kind: "stay_on_card" } };
}

/** Derives the compact card state shown before detailed review. */
export function deriveRippleConsequenceFlowState(
  preview: RipplePreviewModel,
): RippleConsequenceFlowState {
  const acceptance = getRippleAcceptanceState(preview);
  switch (acceptance) {
    case "ready_to_accept":
      return "ready";
    case "partial_accept":
    case "needs_review_first":
      return "needs_review";
    case "blocked":
      return "blocked";
    case "empty":
      return "empty";
  }
}

export function getRippleAcceptanceButtonLabel(
  acceptance: RippleAcceptanceState,
): string {
  switch (acceptance) {
    case "ready_to_accept":
      return "Accept safe changes";
    case "partial_accept":
      return "Accept safe changes";
    case "needs_review_first":
      return "Review suggested changes";
    case "blocked":
      return "Review details";
    case "empty":
      return "Done";
  }
}

/** Whether World Evolution Preview should open for this preview. */
export function canOpenWorldEvolutionPreview(
  preview: RipplePreviewModel,
): boolean {
  const applyPlan = buildRippleApplyPlan(preview);
  return applyPlan.status === "ready_to_apply";
}

export function countPendingReviewItems(preview: RipplePreviewModel): number {
  const pendingOps = preview.operationPreviews.filter(
    (op) =>
      op.approvalState === "pending" &&
      (op.riskLevel === "high" ||
        op.operationType === "remove_node" ||
        op.requiresUserApproval),
  ).length;
  const clarifyOps = preview.operationPreviews.filter(
    (op) => op.approvalState === "needs_clarification",
  ).length;
  const attentionWarnings = preview.warningPreviews.filter(
    (w) => w.requiresUserAttention,
  ).length;
  return pendingOps + clarifyOps + attentionWarnings;
}

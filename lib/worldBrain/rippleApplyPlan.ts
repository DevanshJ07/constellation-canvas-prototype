/**
 * Ripple Effect Engine — apply plan contract (Phase 4.13).
 *
 * Converts approved RipplePreviewModel operations into a declarative apply plan.
 * Pure types and helpers only — no React, no API, no LLM, no canvas mutation.
 *
 * Apply plans describe what *could* be applied later; they do not mutate canvas state.
 */

import type {
  RippleOperationPriority,
  RippleOperationTarget,
  RippleOperationType,
  RippleWarningType,
} from "@/lib/worldBrain/rippleEffectTypes";
import type {
  RippleOperationPreview,
  RipplePreviewModel,
  RipplePreviewRiskLevel,
  RippleWarningPreview,
} from "@/lib/worldBrain/ripplePreviewModel";

// ── Apply plan types ────────────────────────────────────────────────────────────────

export type RippleApplyPlanStatus =
  | "ready_to_apply"
  | "needs_clarification"
  | "blocked"
  | "empty";

export type RippleApplyBlockerKind =
  | "clarification_required"
  | "high_risk_pending"
  | "warning_attention"
  | "preview_blocked"
  | "pending_approval";

export type RippleApplyBlocker = {
  id: string;
  kind: RippleApplyBlockerKind;
  message: string;
  operationId?: string;
  warningId?: string;
};

export type RippleApplyOperation = {
  id: string;
  sourceOperationId: string;
  operationType: RippleOperationType;
  target: RippleOperationTarget;
  title: string;
  description: string;
  reason: string;
  priority: RippleOperationPriority;
  riskLevel: RipplePreviewRiskLevel;
  requiresUserApproval: boolean;
  relatedWarnings: string[];
  payload?: Record<string, unknown>;
};

export type RippleApplyPlan = {
  id: string;
  previewId: string;
  triggerEventId: string;
  status: RippleApplyPlanStatus;
  approvedOperations: RippleApplyOperation[];
  rejectedOperations: RippleOperationPreview[];
  clarificationOperations: RippleOperationPreview[];
  blockers: RippleApplyBlocker[];
  warnings: RippleWarningPreview[];
  summary: string;
  createdAt: string;
};

export type RippleApplyPlanSummary = {
  id: string;
  previewId: string;
  triggerEventId: string;
  status: RippleApplyPlanStatus;
  approvedCount: number;
  rejectedCount: number;
  clarificationCount: number;
  blockerCount: number;
  warningCount: number;
  summary: string;
};

export type RippleApplyValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type BuildRippleApplyPlanOptions = {
  id?: string;
  createdAt?: string;
};

const ATTENTION_BLOCKING_WARNING_TYPES = new Set<RippleWarningType>([
  "contradiction",
  "canon_conflict",
  "flow_conflict",
]);

// ── Internal helpers ──────────────────────────────────────────────────────────────

function mapOperationToApplyOperation(
  operation: RippleOperationPreview,
): RippleApplyOperation {
  return {
    id: `apply_${operation.id}`,
    sourceOperationId: operation.sourceOperationId,
    operationType: operation.operationType,
    target: { ...operation.target },
    title: operation.title,
    description: operation.description,
    reason: operation.reason,
    priority: operation.priority,
    riskLevel: operation.riskLevel,
    requiresUserApproval: operation.requiresUserApproval,
    relatedWarnings: [...operation.relatedWarnings],
    ...(operation.payload !== undefined ? { payload: { ...operation.payload } } : {}),
  };
}

function isHighRiskPendingBlocker(operation: RippleOperationPreview): boolean {
  return operation.approvalState === "pending" && operation.riskLevel === "high";
}

function isPendingApprovalBlocker(operation: RippleOperationPreview): boolean {
  return (
    operation.approvalState === "pending" &&
    operation.requiresUserApproval &&
    operation.riskLevel !== "low"
  );
}

function buildClarificationBlocker(operation: RippleOperationPreview): RippleApplyBlocker {
  return {
    id: `blocker_clarify_${operation.id}`,
    kind: "clarification_required",
    message: `Clarification required before applying: ${operation.title}`,
    operationId: operation.id,
  };
}

function buildHighRiskPendingBlocker(operation: RippleOperationPreview): RippleApplyBlocker {
  return {
    id: `blocker_high_risk_${operation.id}`,
    kind: "high_risk_pending",
    message: `High-risk operation still pending approval: ${operation.title}`,
    operationId: operation.id,
  };
}

function buildPendingApprovalBlocker(operation: RippleOperationPreview): RippleApplyBlocker {
  return {
    id: `blocker_pending_${operation.id}`,
    kind: "pending_approval",
    message: `Operation requires explicit approval: ${operation.title}`,
    operationId: operation.id,
  };
}

function buildWarningBlocker(warning: RippleWarningPreview): RippleApplyBlocker {
  return {
    id: `blocker_warning_${warning.id}`,
    kind: "warning_attention",
    message: warning.message,
    warningId: warning.id,
  };
}

function buildPreviewStatusBlocker(preview: RipplePreviewModel): RippleApplyBlocker {
  return {
    id: `blocker_preview_${preview.id}`,
    kind: "preview_blocked",
    message:
      preview.status === "failed"
        ? "Ripple preview failed — apply plan cannot proceed."
        : "Ripple preview is blocked — resolve warnings before applying.",
  };
}

function warningBlocksApply(warning: RippleWarningPreview): boolean {
  if (!warning.requiresUserAttention) return false;
  if (warning.severity === "high") return true;
  return ATTENTION_BLOCKING_WARNING_TYPES.has(warning.warningType);
}

function deriveApplyPlanStatus(
  approvedOperations: RippleApplyOperation[],
  clarificationOperations: RippleOperationPreview[],
  blockers: RippleApplyBlocker[],
): RippleApplyPlanStatus {
  if (approvedOperations.length === 0) {
    return "empty";
  }

  if (clarificationOperations.length > 0) {
    return "needs_clarification";
  }

  if (blockers.length > 0) {
    return "blocked";
  }

  return "ready_to_apply";
}

function buildApplyPlanSummaryText(
  preview: RipplePreviewModel,
  approvedCount: number,
  blockerCount: number,
): string {
  if (approvedCount === 0) {
    return "No approved ripple operations to apply.";
  }
  if (blockerCount > 0) {
    return `${approvedCount} approved operation(s) prepared, but ${blockerCount} blocker(s) prevent apply.`;
  }
  return `${approvedCount} approved operation(s) ready for a future apply phase. Preview: ${preview.summary}`;
}

// ── Public query helpers ──────────────────────────────────────────────────────────

export function getApprovedRippleOperations(
  preview: RipplePreviewModel,
): RippleOperationPreview[] {
  return preview.operationPreviews.filter((op) => op.approvalState === "approved");
}

export function getBlockedRippleOperations(
  preview: RipplePreviewModel,
): RippleOperationPreview[] {
  return preview.operationPreviews.filter(
    (op) =>
      op.approvalState === "needs_clarification" ||
      isHighRiskPendingBlocker(op) ||
      isPendingApprovalBlocker(op),
  );
}

// ── Plan builders ─────────────────────────────────────────────────────────────────

export function buildRippleApplyPlan(
  preview: RipplePreviewModel,
  options: BuildRippleApplyPlanOptions = {},
): RippleApplyPlan {
  const approvedSource = getApprovedRippleOperations(preview);
  const rejectedOperations = preview.operationPreviews
    .filter((op) => op.approvalState === "rejected")
    .map((op) => ({ ...op, target: { ...op.target } }));
  const clarificationOperations = preview.operationPreviews
    .filter((op) => op.approvalState === "needs_clarification")
    .map((op) => ({ ...op, target: { ...op.target } }));

  const blockers: RippleApplyBlocker[] = [];

  for (const operation of clarificationOperations) {
    blockers.push(buildClarificationBlocker(operation));
  }

  for (const operation of preview.operationPreviews) {
    if (operation.approvalState !== "pending") continue;
    if (isHighRiskPendingBlocker(operation)) {
      blockers.push(buildHighRiskPendingBlocker(operation));
    } else if (isPendingApprovalBlocker(operation)) {
      blockers.push(buildPendingApprovalBlocker(operation));
    }
  }

  for (const warning of preview.warningPreviews) {
    if (warningBlocksApply(warning)) {
      blockers.push(buildWarningBlocker(warning));
    }
  }

  if (preview.status === "blocked" || preview.status === "failed") {
    blockers.push(buildPreviewStatusBlocker(preview));
  }

  const approvedOperations = approvedSource.map(mapOperationToApplyOperation);
  const status = deriveApplyPlanStatus(
    approvedOperations,
    clarificationOperations,
    blockers,
  );

  return {
    id: options.id ?? `ripple_apply_plan_${preview.id}`,
    previewId: preview.id,
    triggerEventId: preview.triggerEventId,
    status,
    approvedOperations,
    rejectedOperations,
    clarificationOperations,
    blockers,
    warnings: preview.warningPreviews.map((w) => ({
      ...w,
      affectedTargets: w.affectedTargets.map((t) => ({ ...t })),
    })),
    summary: buildApplyPlanSummaryText(
      preview,
      approvedOperations.length,
      blockers.length,
    ),
    createdAt: options.createdAt ?? preview.createdAt,
  };
}

export function summarizeRippleApplyPlan(plan: RippleApplyPlan): RippleApplyPlanSummary {
  return {
    id: plan.id,
    previewId: plan.previewId,
    triggerEventId: plan.triggerEventId,
    status: plan.status,
    approvedCount: plan.approvedOperations.length,
    rejectedCount: plan.rejectedOperations.length,
    clarificationCount: plan.clarificationOperations.length,
    blockerCount: plan.blockers.length,
    warningCount: plan.warnings.length,
    summary: plan.summary,
  };
}

export function validateRippleApplyPlan(
  plan: RippleApplyPlan,
): RippleApplyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.id?.trim()) errors.push("Missing apply plan id");
  if (!plan.previewId?.trim()) errors.push("Missing previewId");
  if (!plan.triggerEventId?.trim()) errors.push("Missing triggerEventId");

  const applyIds = new Set<string>();
  for (const op of plan.approvedOperations) {
    if (applyIds.has(op.id)) errors.push(`Duplicate apply operation id: ${op.id}`);
    applyIds.add(op.id);
  }

  const blockerIds = new Set<string>();
  for (const blocker of plan.blockers) {
    if (blockerIds.has(blocker.id)) errors.push(`Duplicate blocker id: ${blocker.id}`);
    blockerIds.add(blocker.id);
  }

  if (plan.status === "empty" && plan.approvedOperations.length > 0) {
    errors.push("Status empty but approvedOperations is non-empty");
  }

  if (plan.status === "ready_to_apply") {
    if (plan.approvedOperations.length === 0) {
      errors.push("Status ready_to_apply requires at least one approved operation");
    }
    if (plan.blockers.length > 0) {
      errors.push("Status ready_to_apply cannot have blockers");
    }
    if (plan.clarificationOperations.length > 0) {
      errors.push("Status ready_to_apply cannot have clarification operations");
    }
  }

  if (plan.status === "needs_clarification" && plan.clarificationOperations.length === 0) {
    errors.push("Status needs_clarification requires clarification operations");
  }

  if (plan.status === "empty" && plan.approvedOperations.length === 0 && plan.blockers.length > 0) {
    warnings.push("Empty plan retains blockers from unresolved preview state");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

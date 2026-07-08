/**
 * World Evolution Preview model — UI-friendly grouping (Phase 5.2).
 * Read-only transform of WorldEvolutionPlan for preview panels.
 */

import type {
  EvolutionApplyDryRunBlocker,
  EvolutionApplyDryRunWarning,
  EvolutionCanvasPatchCandidate,
  EvolutionCanvasPatchStatus,
  EvolutionCanvasPatchType,
  WorldEvolutionApplyDryRunResult,
  WorldEvolutionApplyDryRunStatus,
} from "@/lib/worldBrain/worldEvolutionApplyDryRun";
import type {
  EvolutionActionStatus,
  EvolutionActionType,
  EvolutionBlocker,
  EvolutionBlockerKind,
  EvolutionStopReason,
  EvolutionWarning,
  WorldEvolutionAction,
  WorldEvolutionPlan,
  WorldEvolutionPlanStatus,
} from "@/lib/worldBrain/worldEvolutionPlan";

export type EvolutionPreviewStatus = WorldEvolutionPlanStatus | "no_plan";

export type EvolutionActionPreviewItem = {
  id: string;
  actionType: EvolutionActionType;
  actionTypeLabel: string;
  targetLabel: string;
  targetId: string;
  status: EvolutionActionStatus;
  statusLabel: string;
  reason: string;
  confidence: number;
  confidenceLabel: string;
  riskLevel: string;
  reversible: boolean;
  requiresUserConfirmation: boolean;
  sourceOperationId: string;
  propagation?: {
    scope: string;
    hopsFromTrigger: number;
    cappedByPolicy: boolean;
  };
  stopReason?: EvolutionStopReason;
  userSummary: string;
};

export type EvolutionBlockerPreviewItem = {
  id: string;
  kind: EvolutionBlockerKind;
  kindLabel: string;
  message: string;
  sourceOperationId?: string;
  targetId?: string;
  stopReason?: EvolutionStopReason;
};

export type EvolutionWarningPreviewItem = {
  id: string;
  message: string;
  sourceOperationId?: string;
  warningType?: string;
  warningTypeLabel: string;
};

export type EvolutionConfidenceSummary = {
  averageReadyConfidence: number;
  lowestConfidence: number;
  highestConfidence: number;
  readyCount: number;
  tentativeCount: number;
  downgradedCount: number;
  skippedCount: number;
  blockedCount: number;
};

export type EvolutionPropagationSummary = {
  scopes: string[];
  maxHops: number;
  cappedCount: number;
};

export type GroupedEvolutionActions = {
  readyActions: EvolutionActionPreviewItem[];
  needsReviewActions: EvolutionActionPreviewItem[];
  blockedActions: EvolutionActionPreviewItem[];
  skippedActions: EvolutionActionPreviewItem[];
  downgradedActions: EvolutionActionPreviewItem[];
};

export type WorldEvolutionPreviewModel = {
  planId: string;
  applyPlanId: string;
  previewId: string;
  status: EvolutionPreviewStatus;
  displayStatus: string;
  summary: string;
  readyActions: EvolutionActionPreviewItem[];
  needsReviewActions: EvolutionActionPreviewItem[];
  blockedActions: EvolutionActionPreviewItem[];
  skippedActions: EvolutionActionPreviewItem[];
  downgradedActions: EvolutionActionPreviewItem[];
  warnings: EvolutionWarningPreviewItem[];
  blockers: EvolutionBlockerPreviewItem[];
  confidenceSummary: EvolutionConfidenceSummary;
  propagationSummary: EvolutionPropagationSummary;
  nodeBudgetRemaining: number;
  isEmpty: boolean;
  isFailed: boolean;
  isBlocked: boolean;
  canShowPreview: boolean;
};

export type EvolutionPatchBlockerPreviewItem = {
  id: string;
  kind: string;
  message: string;
};

export type EvolutionPatchWarningPreviewItem = {
  id: string;
  message: string;
  warningType?: string;
};

export type EvolutionPatchPreviewItem = {
  id: string;
  patchType: EvolutionCanvasPatchType;
  patchTypeLabel: string;
  status: EvolutionCanvasPatchStatus;
  statusLabel: string;
  targetLabel: string;
  targetId: string;
  sourceActionId: string;
  reason: string;
  previewSummary: string;
  reversible: boolean;
  requiresConfirmation: boolean;
  relatedBlockers: EvolutionPatchBlockerPreviewItem[];
  relatedWarnings: EvolutionPatchWarningPreviewItem[];
};

export type WorldEvolutionDryRunPreviewGroups = {
  status: WorldEvolutionApplyDryRunStatus;
  displayStatus: string;
  summary: string;
  readyPatches: EvolutionPatchPreviewItem[];
  needsReviewPatches: EvolutionPatchPreviewItem[];
  blockedPatches: EvolutionPatchPreviewItem[];
  skippedPatches: EvolutionPatchPreviewItem[];
  blockers: EvolutionPatchBlockerPreviewItem[];
  warnings: EvolutionPatchWarningPreviewItem[];
  isEmpty: boolean;
  isFailed: boolean;
  isBlocked: boolean;
};

export type BuildWorldEvolutionPreviewModelOptions = {
  nodeTitleById?: Record<string, string>;
  constellationTitleById?: Record<string, string>;
};

const STATUS_LABELS: Record<WorldEvolutionPlanStatus, string> = {
  empty: "Empty",
  ready_for_preview: "Ready",
  needs_review: "Needs review",
  blocked: "Blocked",
  failed: "Failed",
};

const BLOCKER_KIND_LABELS: Record<EvolutionBlockerKind, string> = {
  apply_plan: "Apply plan",
  canon_protection: "Canon protection",
  preserved_element: "Preserved element",
  node_budget: "Node budget",
  confidence: "Confidence",
  validation: "Validation",
  policy: "Policy",
  conflict: "Conflict",
  steering: "Steering conflict",
};

const ACTION_TYPE_LABELS: Record<EvolutionActionType, string> = {
  strengthen_node: "Strengthen node",
  weaken_node: "Weaken node",
  modify_node: "Modify node",
  generate_node: "Generate node",
  archive_node: "Archive node",
  remove_node: "Remove node",
  merge_nodes: "Merge nodes",
  split_node: "Split node",
  replace_node: "Replace node",
  refocus_constellation: "Refocus constellation",
  change_constellation_priority: "Change constellation priority",
  defer_flow_update: "Defer flow update",
  skipped: "Skipped",
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function resolveTargetLabel(
  action: WorldEvolutionAction,
  titleLookup: BuildWorldEvolutionPreviewModelOptions,
): string {
  if (action.kind === "constellation") {
    return (
      titleLookup.constellationTitleById?.[action.constellationId] ??
      action.constellationId
    );
  }

  const label =
    action.proposedLabel ??
    titleLookup.nodeTitleById?.[action.targetId] ??
    action.targetId;

  if (action.actionType === "generate_node" && action.proposedLabel) {
    return `${action.proposedLabel} (${action.targetId})`;
  }

  return label;
}

function formatActionType(actionType: EvolutionActionType): string {
  return ACTION_TYPE_LABELS[actionType] ?? actionType.replace(/_/g, " ");
}

function formatStatus(status: EvolutionActionStatus): string {
  return status.replace(/_/g, " ");
}

function formatWarningType(warningType?: string): string {
  if (!warningType) return "General";
  return warningType.replace(/_/g, " ");
}

export function summarizeEvolutionActionForUser(
  action: WorldEvolutionAction,
  options: BuildWorldEvolutionPreviewModelOptions = {},
): string {
  const target = resolveTargetLabel(action, options);
  const typeLabel = formatActionType(action.actionType);

  if (action.status === "skipped" || action.actionType === "skipped") {
    return `${typeLabel} on ${target} was skipped${action.stopReason ? ` (${action.stopReason.replace(/_/g, " ")})` : ""}.`;
  }

  if (action.status === "downgraded") {
    return `${typeLabel} on ${target} was downgraded for safer review at ${formatPercent(action.confidence)} confidence.`;
  }

  if (action.status === "blocked") {
    return `${typeLabel} on ${target} is blocked pending review.`;
  }

  return `${typeLabel} on ${target} is proposed at ${formatPercent(action.confidence)} confidence.`;
}

export function mapEvolutionActionToPreviewItem(
  action: WorldEvolutionAction,
  options: BuildWorldEvolutionPreviewModelOptions = {},
): EvolutionActionPreviewItem {
  const propagation =
    action.propagation !== undefined
      ? {
          scope: action.propagation.scope.replace(/_/g, " "),
          hopsFromTrigger: action.propagation.hopsFromTrigger,
          cappedByPolicy: action.propagation.cappedByPolicy,
        }
      : undefined;

  return {
    id: action.id,
    actionType: action.actionType,
    actionTypeLabel: formatActionType(action.actionType),
    targetLabel: resolveTargetLabel(action, options),
    targetId: action.kind === "node" ? action.targetId : action.constellationId,
    status: action.status,
    statusLabel: formatStatus(action.status),
    reason: action.reason,
    confidence: action.confidence,
    confidenceLabel: formatPercent(action.confidence),
    riskLevel: action.riskLevel,
    reversible: action.reversible,
    requiresUserConfirmation: action.requiresUserConfirmation,
    sourceOperationId: action.sourceOperationId,
    ...(propagation !== undefined ? { propagation } : {}),
    ...(action.stopReason !== undefined ? { stopReason: action.stopReason } : {}),
    userSummary: summarizeEvolutionActionForUser(action, options),
  };
}

function mapBlocker(blocker: EvolutionBlocker): EvolutionBlockerPreviewItem {
  return {
    id: blocker.id,
    kind: blocker.kind,
    kindLabel: BLOCKER_KIND_LABELS[blocker.kind] ?? blocker.kind,
    message: blocker.message,
    ...(blocker.sourceOperationId !== undefined
      ? { sourceOperationId: blocker.sourceOperationId }
      : {}),
    ...(blocker.targetId !== undefined ? { targetId: blocker.targetId } : {}),
    ...(blocker.stopReason !== undefined ? { stopReason: blocker.stopReason } : {}),
  };
}

function mapWarning(warning: EvolutionWarning): EvolutionWarningPreviewItem {
  return {
    id: warning.id,
    message: warning.message,
    warningTypeLabel: formatWarningType(warning.warningType),
    ...(warning.sourceOperationId !== undefined
      ? { sourceOperationId: warning.sourceOperationId }
      : {}),
    ...(warning.warningType !== undefined ? { warningType: warning.warningType } : {}),
  };
}

export function groupEvolutionActionsByStatus(
  plan: WorldEvolutionPlan,
  options: BuildWorldEvolutionPreviewModelOptions = {},
): GroupedEvolutionActions {
  const items = plan.actions.map((action) => mapEvolutionActionToPreviewItem(action, options));

  const readyActions = items.filter((item) => item.status === "ready");
  const downgradedActions = items.filter((item) => item.status === "downgraded");
  const skippedActions = items.filter(
    (item) => item.status === "skipped" || item.actionType === "skipped",
  );
  const blockedActions = items.filter((item) => item.status === "blocked");
  const needsReviewActions = [
    ...downgradedActions,
    ...blockedActions.filter(
      (item) => !downgradedActions.some((downgraded) => downgraded.id === item.id),
    ),
  ];

  return {
    readyActions,
    needsReviewActions,
    blockedActions,
    skippedActions,
    downgradedActions,
  };
}

export function computeEvolutionConfidenceSummary(
  plan: WorldEvolutionPlan,
): EvolutionConfidenceSummary {
  const readyConfidences = plan.actions
    .filter((action) => action.status === "ready")
    .map((action) => action.confidence);
  const allConfidences = plan.actions.map((action) => action.confidence);

  return {
    averageReadyConfidence:
      readyConfidences.length > 0
        ? Number(
            (
              readyConfidences.reduce((sum, value) => sum + value, 0) /
              readyConfidences.length
            ).toFixed(4),
          )
        : 0,
    lowestConfidence:
      allConfidences.length > 0 ? Math.min(...allConfidences) : 0,
    highestConfidence:
      allConfidences.length > 0 ? Math.max(...allConfidences) : 0,
    readyCount: plan.actions.filter((action) => action.status === "ready").length,
    tentativeCount: plan.actions.filter(
      (action) =>
        action.status === "downgraded" &&
        action.confidenceProfile.tier === "tentative",
    ).length,
    downgradedCount: plan.actions.filter((action) => action.status === "downgraded").length,
    skippedCount: plan.actions.filter(
      (action) => action.status === "skipped" || action.actionType === "skipped",
    ).length,
    blockedCount: plan.actions.filter((action) => action.status === "blocked").length,
  };
}

export function computeEvolutionPropagationSummary(
  plan: WorldEvolutionPlan,
): EvolutionPropagationSummary {
  const scopes = new Set<string>();
  let maxHops = 0;
  let cappedCount = 0;

  for (const action of plan.actions) {
    scopes.add(action.propagation.scope);
    maxHops = Math.max(maxHops, action.propagation.hopsFromTrigger);
    if (action.propagation.cappedByPolicy) cappedCount += 1;
  }

  return {
    scopes: [...scopes].map((scope) => scope.replace(/_/g, " ")),
    maxHops,
    cappedCount,
  };
}

export function getEvolutionPreviewStatus(
  plan: WorldEvolutionPlan | null | undefined,
): EvolutionPreviewStatus {
  if (!plan) return "no_plan";
  return plan.status;
}

export function buildWorldEvolutionPreviewModel(
  plan: WorldEvolutionPlan | null | undefined,
  options: BuildWorldEvolutionPreviewModelOptions = {},
): WorldEvolutionPreviewModel | null {
  if (!plan) return null;

  const groups = groupEvolutionActionsByStatus(plan, options);
  const status = plan.status;

  return {
    planId: plan.id,
    applyPlanId: plan.applyPlanId,
    previewId: plan.previewId,
    status,
    displayStatus: STATUS_LABELS[status],
    summary: plan.summary,
    readyActions: groups.readyActions,
    needsReviewActions: groups.needsReviewActions,
    blockedActions: groups.blockedActions,
    skippedActions: groups.skippedActions,
    downgradedActions: groups.downgradedActions,
    warnings: plan.warnings.map(mapWarning),
    blockers: plan.blockers.map(mapBlocker),
    confidenceSummary: computeEvolutionConfidenceSummary(plan),
    propagationSummary: computeEvolutionPropagationSummary(plan),
    nodeBudgetRemaining: plan.nodeBudgetRemaining,
    isEmpty: status === "empty",
    isFailed: status === "failed",
    isBlocked: status === "blocked",
    canShowPreview: true,
  };
}

const PATCH_TYPE_LABELS: Record<EvolutionCanvasPatchType, string> = {
  add_node: "Add node",
  update_node_metadata: "Update node metadata",
  update_node_status: "Update node status",
  archive_node: "Archive node",
  add_edge: "Add edge",
  update_edge_metadata: "Update edge metadata",
  update_constellation_metadata: "Update constellation metadata",
  mark_node_weakened: "Mark node weakened",
  mark_node_strengthened: "Mark node strengthened",
  no_op: "No operation",
};

const DRY_RUN_STATUS_LABELS: Record<WorldEvolutionApplyDryRunStatus, string> = {
  empty: "Empty",
  ready_for_confirmation: "Ready for confirmation",
  needs_review: "Needs review",
  blocked: "Blocked",
  failed: "Failed",
};

function formatPatchType(patchType: EvolutionCanvasPatchType): string {
  return PATCH_TYPE_LABELS[patchType] ?? patchType.replace(/_/g, " ");
}

function formatPatchStatus(status: EvolutionCanvasPatchStatus): string {
  return status.replace(/_/g, " ");
}

function formatPatchTargetLabel(
  patch: EvolutionCanvasPatchCandidate,
  titleLookup: BuildWorldEvolutionPreviewModelOptions = {},
): string {
  if (patch.target.targetType === "edge") {
    const endpoints = patch.target.endpointIds?.join(" → ") ?? patch.target.id;
    return `Edge ${endpoints}`;
  }
  if (patch.target.targetType === "constellation") {
    return (
      titleLookup.constellationTitleById?.[patch.target.id] ?? patch.target.id
    );
  }
  const label =
    (typeof patch.payload?.proposedLabel === "string" && patch.payload.proposedLabel) ||
    titleLookup.nodeTitleById?.[patch.target.id] ||
    patch.target.id;
  return label;
}

function mapDryRunBlocker(blocker: EvolutionApplyDryRunBlocker): EvolutionPatchBlockerPreviewItem {
  return {
    id: blocker.id,
    kind: blocker.kind.replace(/_/g, " "),
    message: blocker.message,
  };
}

function mapDryRunWarning(warning: EvolutionApplyDryRunWarning): EvolutionPatchWarningPreviewItem {
  return {
    id: warning.id,
    message: warning.message,
    ...(warning.warningType !== undefined ? { warningType: warning.warningType } : {}),
  };
}

export function mapPatchCandidateToPreviewItem(
  patch: EvolutionCanvasPatchCandidate,
  result: WorldEvolutionApplyDryRunResult,
  options: BuildWorldEvolutionPreviewModelOptions = {},
): EvolutionPatchPreviewItem {
  const relatedBlockers = result.blockers
    .filter(
      (blocker) =>
        blocker.patchId === patch.id || blocker.sourceActionId === patch.sourceActionId,
    )
    .map(mapDryRunBlocker);
  const relatedWarnings = result.warnings
    .filter(
      (warning) =>
        warning.patchId === patch.id || warning.sourceActionId === patch.sourceActionId,
    )
    .map(mapDryRunWarning);

  return {
    id: patch.id,
    patchType: patch.patchType,
    patchTypeLabel: formatPatchType(patch.patchType),
    status: patch.status,
    statusLabel: formatPatchStatus(patch.status),
    targetLabel: formatPatchTargetLabel(patch, options),
    targetId: patch.target.id,
    sourceActionId: patch.sourceActionId,
    reason: patch.reason,
    previewSummary: patch.previewSummary,
    reversible: patch.reversible,
    requiresConfirmation: patch.requiresConfirmation,
    relatedBlockers,
    relatedWarnings,
  };
}

export function groupDryRunPatchCandidates(
  result: WorldEvolutionApplyDryRunResult,
  options: BuildWorldEvolutionPreviewModelOptions = {},
): Pick<
  WorldEvolutionDryRunPreviewGroups,
  "readyPatches" | "needsReviewPatches" | "blockedPatches" | "skippedPatches"
> {
  const items = result.patchCandidates.map((patch) =>
    mapPatchCandidateToPreviewItem(patch, result, options),
  );

  return {
    readyPatches: items.filter((item) => item.status === "ready"),
    needsReviewPatches: items.filter((item) => item.status === "needs_review"),
    blockedPatches: items.filter(
      (item) => item.status === "blocked" && item.patchType !== "no_op",
    ),
    skippedPatches: items.filter((item) => item.patchType === "no_op"),
  };
}

export function getDryRunPreviewStatus(
  result: WorldEvolutionApplyDryRunResult | null | undefined,
): WorldEvolutionApplyDryRunStatus | "no_dry_run" {
  if (!result) return "no_dry_run";
  return result.status;
}

export function buildDryRunPreviewGroups(
  result: WorldEvolutionApplyDryRunResult | null | undefined,
  options: BuildWorldEvolutionPreviewModelOptions = {},
): WorldEvolutionDryRunPreviewGroups | null {
  if (!result) return null;

  const groups = groupDryRunPatchCandidates(result, options);

  return {
    status: result.status,
    displayStatus: DRY_RUN_STATUS_LABELS[result.status],
    summary: result.summary,
    ...groups,
    blockers: result.blockers.map(mapDryRunBlocker),
    warnings: result.warnings.map(mapDryRunWarning),
    isEmpty: result.status === "empty",
    isFailed: result.status === "failed",
    isBlocked: result.status === "blocked",
  };
}

export function createEmptyWorldEvolutionPreviewModel(): WorldEvolutionPreviewModel {
  return {
    planId: "",
    applyPlanId: "",
    previewId: "",
    status: "no_plan",
    displayStatus: "No plan",
    summary: "No evolution plan available yet.",
    readyActions: [],
    needsReviewActions: [],
    blockedActions: [],
    skippedActions: [],
    downgradedActions: [],
    warnings: [],
    blockers: [],
    confidenceSummary: {
      averageReadyConfidence: 0,
      lowestConfidence: 0,
      highestConfidence: 0,
      readyCount: 0,
      tentativeCount: 0,
      downgradedCount: 0,
      skippedCount: 0,
      blockedCount: 0,
    },
    propagationSummary: { scopes: [], maxHops: 0, cappedCount: 0 },
    nodeBudgetRemaining: 0,
    isEmpty: true,
    isFailed: false,
    isBlocked: false,
    canShowPreview: false,
  };
}

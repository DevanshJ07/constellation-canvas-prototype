/**
 * Ripple Effect Engine — preview model / UI contract (Phase 4.10).
 *
 * Converts RippleEffectOutput into user-reviewable preview data for future UI.
 * Pure types and helpers only — no React, no API, no LLM, no canvas mutation.
 *
 * Ripple suggestions are proposals, not actions. Approval happens in a later phase.
 */

import type {
  CanonRippleImpact,
  CanonRippleImpactType,
  ConstellationRippleImpact,
  ConstellationRippleImpactType,
  NodeImpactSeverity,
  NodeRippleImpact,
  NodeRippleImpactType,
  RippleConfidenceScore,
  RippleEffectOutput,
  RippleImpactLevel,
  RippleOperationPriority,
  RippleOperationTarget,
  RippleOperationType,
  RipplePreservedElement,
  RippleSuggestedOperation,
  RippleWarning,
  RippleWarningType,
  SuggestedCanonStateChange,
} from "@/lib/worldBrain/rippleEffectTypes";

// ── Preview status ────────────────────────────────────────────────────────────────

export type RipplePreviewStatus = "ready" | "needs_review" | "blocked" | "failed";

export type RippleOperationApprovalState =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_clarification";

export type RipplePreviewRiskLevel = "low" | "medium" | "high";

// ── Preview item types ────────────────────────────────────────────────────────────

export type RippleOperationPreview = {
  id: string;
  operationType: RippleOperationType;
  target: RippleOperationTarget;
  title: string;
  description: string;
  reason: string;
  priority: RippleOperationPriority;
  requiresUserApproval: boolean;
  approvalState: RippleOperationApprovalState;
  riskLevel: RipplePreviewRiskLevel;
  sourceOperationId: string;
  relatedWarnings: string[];
  payload?: Record<string, unknown>;
};

export type RippleWarningPreview = {
  id: string;
  warningType: RippleWarningType;
  title: string;
  message: string;
  severity: NodeImpactSeverity;
  affectedTargets: RippleOperationTarget[];
  suggestedResolution?: string;
  relatedOperationIds: string[];
  requiresUserAttention: boolean;
};

export type RippleAffectedNodePreview = {
  nodeId: string;
  constellationId?: string;
  title?: string;
  impactType: NodeRippleImpactType;
  reason: string;
  severity: NodeImpactSeverity;
  confidence: RippleConfidenceScore;
  suggestedOperationIds: string[];
};

export type RippleAffectedConstellationPreview = {
  constellationId: string;
  title?: string;
  impactType: ConstellationRippleImpactType;
  reason: string;
  suggestedFocusShift?: string;
  suggestedNodeCountChange?: number;
  confidence: RippleConfidenceScore;
};

export type RippleCanonPreview = {
  impactType: CanonRippleImpactType;
  reason: string;
  affectedCanonIds: string[];
  suggestedCanonStateChanges: SuggestedCanonStateChange[];
  confidence: RippleConfidenceScore;
};

export type RipplePreservedPreview = {
  targetType: RipplePreservedElement["targetType"];
  id: string;
  title?: string;
  reason: string;
};

export type RipplePreviewCounts = {
  operationCount: number;
  warningCount: number;
  affectedNodeCount: number;
  affectedConstellationCount: number;
  canonImpactCount: number;
  preservedCount: number;
  highPriorityOperationCount: number;
  highSeverityWarningCount: number;
  approvalRequiredCount: number;
  clarificationRequiredCount: number;
};

export type RipplePreviewModel = {
  id: string;
  triggerEventId: string;
  title: string;
  summary: string;
  impactLevel: RippleImpactLevel;
  status: RipplePreviewStatus;
  operationPreviews: RippleOperationPreview[];
  warningPreviews: RippleWarningPreview[];
  affectedNodePreviews: RippleAffectedNodePreview[];
  affectedConstellationPreviews: RippleAffectedConstellationPreview[];
  canonPreviews: RippleCanonPreview[];
  preservedPreviews: RipplePreservedPreview[];
  followUpQuestions: string[];
  counts: RipplePreviewCounts;
  confidence: RippleConfidenceScore;
  createdAt: string;
};

export type RipplePreviewSummary = {
  id: string;
  triggerEventId: string;
  status: RipplePreviewStatus;
  impactLevel: RippleImpactLevel;
  summary: string;
  counts: RipplePreviewCounts;
  confidence: RippleConfidenceScore;
};

export type BuildRipplePreviewModelOptions = {
  id?: string;
  createdAt?: string;
  title?: string;
  /** Force failed preview status (e.g. parse failure path). */
  status?: RipplePreviewStatus;
  nodeTitleById?: Record<string, string>;
  constellationTitleById?: Record<string, string>;
};

export type RipplePreviewValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

// ── Title maps ────────────────────────────────────────────────────────────────────

const OPERATION_TYPE_TITLES: Record<RippleOperationType, string> = {
  remove_node: "Remove node",
  weaken_node: "Weaken node",
  strengthen_node: "Strengthen node",
  modify_node: "Modify node",
  replace_node: "Replace node",
  generate_new_node: "Generate new node",
  merge_nodes: "Merge nodes",
  split_node: "Split node",
  refocus_constellation: "Refocus constellation",
  change_constellation_priority: "Change constellation priority",
  ask_user_clarification: "Ask for clarification",
  mark_for_critic_review: "Mark for critic review",
  update_flow: "Update narrative flow",
};

const WARNING_TYPE_TITLES: Record<RippleWarningType, string> = {
  contradiction: "Contradiction",
  weak_connection: "Weak connection",
  duplicate_idea: "Duplicate idea",
  scope_drift: "Scope drift",
  tone_mismatch: "Tone mismatch",
  feasibility_issue: "Feasibility issue",
  canon_conflict: "Canon conflict",
  flow_conflict: "Flow conflict",
};

const HIGH_RISK_OPERATION_TYPES = new Set<RippleOperationType>([
  "remove_node",
  "replace_node",
  "change_constellation_priority",
  "update_flow",
]);

const ATTENTION_WARNING_TYPES = new Set<RippleWarningType>([
  "contradiction",
  "canon_conflict",
  "flow_conflict",
]);

const APPROVAL_STATES = new Set<string>([
  "pending",
  "approved",
  "rejected",
  "needs_clarification",
]);

const RISK_LEVELS = new Set<string>(["low", "medium", "high"]);

const PARSE_FAILURE_MARKERS = [
  "could not be parsed",
  "Ripple analysis could not be parsed",
];

// ── Internal helpers ──────────────────────────────────────────────────────────────

function targetKey(target: RippleOperationTarget): string {
  return `${target.targetType}:${target.id}`;
}

function resolveTargetTitle(
  target: RippleOperationTarget,
  nodeTitleById?: Record<string, string>,
  constellationTitleById?: Record<string, string>,
): string {
  if (target.targetType === "node") {
    return nodeTitleById?.[target.id] ?? target.id;
  }
  if (target.targetType === "constellation") {
    return constellationTitleById?.[target.id] ?? target.id;
  }
  return target.id;
}

function isStructurallyUnusableOutput(output: RippleEffectOutput): boolean {
  if (!output.triggerEventId?.trim()) return true;
  if (
    output.confidence === 0 &&
    PARSE_FAILURE_MARKERS.some((m) => output.summary.includes(m))
  ) {
    return true;
  }
  return false;
}

function computeOperationRiskLevel(
  operation: RippleSuggestedOperation,
): RipplePreviewRiskLevel {
  if (
    operation.priority === "high" ||
    HIGH_RISK_OPERATION_TYPES.has(operation.operationType)
  ) {
    return "high";
  }
  if (operation.priority === "medium" || operation.requiresUserApproval) {
    return "medium";
  }
  return "low";
}

function warningRequiresAttention(warning: RippleWarning): boolean {
  if (warning.severity === "high") return true;
  return ATTENTION_WARNING_TYPES.has(warning.warningType);
}

function findRelatedWarningIds(
  operation: RippleSuggestedOperation,
  warnings: RippleWarning[],
): string[] {
  const opKey = targetKey(operation.target);
  return warnings
    .filter((w) => w.affectedTargets.some((t) => targetKey(t) === opKey))
    .map((w) => w.id);
}

function findRelatedOperationIds(
  warning: RippleWarning,
  operations: RippleSuggestedOperation[],
): string[] {
  const targetKeys = new Set(warning.affectedTargets.map(targetKey));
  return operations
    .filter((op) => targetKeys.has(targetKey(op.target)))
    .map((op) => op.id);
}

function hasSafeOperations(operations: RippleOperationPreview[]): boolean {
  return operations.some(
    (op) => op.riskLevel !== "high" && op.operationType !== "remove_node",
  );
}

// ── Mappers ───────────────────────────────────────────────────────────────────────

export function mapRippleOperationToPreview(
  operation: RippleSuggestedOperation,
  context: {
    warnings?: RippleWarning[];
    nodeTitleById?: Record<string, string>;
    constellationTitleById?: Record<string, string>;
  } = {},
): RippleOperationPreview {
  const targetLabel = resolveTargetTitle(
    operation.target,
    context.nodeTitleById,
    context.constellationTitleById,
  );
  const baseTitle = OPERATION_TYPE_TITLES[operation.operationType];
  const description = `${baseTitle} on ${targetLabel} (${operation.target.targetType}).`;

  return {
    id: `preview_op_${operation.id}`,
    operationType: operation.operationType,
    target: { ...operation.target },
    title: baseTitle,
    description,
    reason: operation.reason,
    priority: operation.priority,
    requiresUserApproval: operation.requiresUserApproval,
    approvalState: "pending",
    riskLevel: computeOperationRiskLevel(operation),
    sourceOperationId: operation.id,
    relatedWarnings: findRelatedWarningIds(operation, context.warnings ?? []),
    ...(operation.payload !== undefined ? { payload: { ...operation.payload } } : {}),
  };
}

export function mapRippleWarningToPreview(
  warning: RippleWarning,
  operations: RippleSuggestedOperation[] = [],
): RippleWarningPreview {
  return {
    id: `preview_warn_${warning.id}`,
    warningType: warning.warningType,
    title: WARNING_TYPE_TITLES[warning.warningType],
    message: warning.message,
    severity: warning.severity,
    affectedTargets: warning.affectedTargets.map((t) => ({ ...t })),
    ...(warning.suggestedResolution !== undefined
      ? { suggestedResolution: warning.suggestedResolution }
      : {}),
    relatedOperationIds: findRelatedOperationIds(warning, operations),
    requiresUserAttention: warningRequiresAttention(warning),
  };
}

function mapNodeImpactPreview(
  impact: NodeRippleImpact,
  nodeTitleById?: Record<string, string>,
): RippleAffectedNodePreview {
  return {
    nodeId: impact.nodeId,
    impactType: impact.impactType,
    reason: impact.reason,
    severity: impact.severity,
    confidence: impact.confidence,
    suggestedOperationIds: [...impact.suggestedOperationIds],
    ...(impact.constellationId !== undefined
      ? { constellationId: impact.constellationId }
      : {}),
    ...(nodeTitleById?.[impact.nodeId]
      ? { title: nodeTitleById[impact.nodeId] }
      : {}),
  };
}

function mapConstellationImpactPreview(
  impact: ConstellationRippleImpact,
  constellationTitleById?: Record<string, string>,
): RippleAffectedConstellationPreview {
  return {
    constellationId: impact.constellationId,
    impactType: impact.impactType,
    reason: impact.reason,
    confidence: impact.confidence,
    ...(impact.suggestedFocusShift !== undefined
      ? { suggestedFocusShift: impact.suggestedFocusShift }
      : {}),
    ...(impact.suggestedNodeCountChange !== undefined
      ? { suggestedNodeCountChange: impact.suggestedNodeCountChange }
      : {}),
    ...(constellationTitleById?.[impact.constellationId]
      ? { title: constellationTitleById[impact.constellationId] }
      : {}),
  };
}

function mapCanonImpactPreview(impact: CanonRippleImpact): RippleCanonPreview {
  return {
    impactType: impact.impactType,
    reason: impact.reason,
    affectedCanonIds: [...impact.affectedCanonIds],
    suggestedCanonStateChanges: impact.suggestedCanonStateChanges.map((c) => ({
      ...c,
    })),
    confidence: impact.confidence,
  };
}

function mapPreservedPreview(
  element: RipplePreservedElement,
  nodeTitleById?: Record<string, string>,
  constellationTitleById?: Record<string, string>,
): RipplePreservedPreview {
  let title: string | undefined;
  if (element.targetType === "node") {
    title = nodeTitleById?.[element.id];
  } else if (element.targetType === "constellation") {
    title = constellationTitleById?.[element.id];
  }

  return {
    targetType: element.targetType,
    id: element.id,
    reason: element.reason,
    ...(title !== undefined ? { title } : {}),
  };
}

export function computeRipplePreviewCounts(
  model: Pick<
    RipplePreviewModel,
    | "operationPreviews"
    | "warningPreviews"
    | "affectedNodePreviews"
    | "affectedConstellationPreviews"
    | "canonPreviews"
    | "preservedPreviews"
  >,
): RipplePreviewCounts {
  const operationPreviews = model.operationPreviews;
  const warningPreviews = model.warningPreviews;

  return {
    operationCount: operationPreviews.length,
    warningCount: warningPreviews.length,
    affectedNodeCount: model.affectedNodePreviews.length,
    affectedConstellationCount: model.affectedConstellationPreviews.length,
    canonImpactCount: model.canonPreviews.length,
    preservedCount: model.preservedPreviews.length,
    highPriorityOperationCount: operationPreviews.filter((op) => op.priority === "high")
      .length,
    highSeverityWarningCount: warningPreviews.filter((w) => w.severity === "high")
      .length,
    approvalRequiredCount: operationPreviews.filter((op) => op.requiresUserApproval)
      .length,
    clarificationRequiredCount: operationPreviews.filter(
      (op) => op.approvalState === "needs_clarification",
    ).length,
  };
}

export function getRipplePreviewStatus(
  source: RippleEffectOutput | RipplePreviewModel,
): RipplePreviewStatus {
  if ("status" in source && source.status === "failed") {
    return "failed";
  }

  const output: RippleEffectOutput =
    "operationPreviews" in source
      ? {
          triggerEventId: source.triggerEventId,
          summary: source.summary,
          impactLevel: source.impactLevel,
          affectedScopes: [],
          nodeImpacts: [],
          constellationImpacts: [],
          canonImpacts: [],
          suggestedOperations: source.operationPreviews.map((op) => ({
            id: op.sourceOperationId,
            operationType: op.operationType,
            target: op.target,
            reason: op.reason,
            priority: op.priority,
            requiresUserApproval: op.requiresUserApproval,
          })),
          warnings: source.warningPreviews.map((w) => ({
            id: w.id.replace(/^preview_warn_/, ""),
            warningType: w.warningType,
            message: w.message,
            severity: w.severity,
            affectedTargets: w.affectedTargets,
          })),
          preservedElements: [],
          followUpQuestions: source.followUpQuestions,
          confidence: source.confidence,
        }
      : source;

  if (isStructurallyUnusableOutput(output)) {
    return "failed";
  }

  const operationPreviews =
    "operationPreviews" in source
      ? source.operationPreviews
      : output.suggestedOperations.map((op) =>
          mapRippleOperationToPreview(op, { warnings: output.warnings }),
        );

  const warningPreviews =
    "warningPreviews" in source
      ? source.warningPreviews
      : output.warnings.map((w) =>
          mapRippleWarningToPreview(w, output.suggestedOperations),
        );

  const attentionWarnings = warningPreviews.filter((w) => w.requiresUserAttention);
  const highPriorityOps = operationPreviews.filter((op) => op.priority === "high");

  if (
    output.followUpQuestions.length > 0 &&
    !hasSafeOperations(operationPreviews)
  ) {
    return "blocked";
  }

  if (attentionWarnings.some((w) => w.severity === "high")) {
    return "blocked";
  }

  if (warningPreviews.length > 0 || highPriorityOps.length > 0) {
    return "needs_review";
  }

  return "ready";
}

export function buildRipplePreviewModel(
  output: RippleEffectOutput,
  options: BuildRipplePreviewModelOptions = {},
): RipplePreviewModel {
  const operationPreviews = output.suggestedOperations.map((op) =>
    mapRippleOperationToPreview(op, {
      warnings: output.warnings,
      nodeTitleById: options.nodeTitleById,
      constellationTitleById: options.constellationTitleById,
    }),
  );

  const warningPreviews = output.warnings.map((w) =>
    mapRippleWarningToPreview(w, output.suggestedOperations),
  );

  const affectedNodePreviews = output.nodeImpacts.map((impact) =>
    mapNodeImpactPreview(impact, options.nodeTitleById),
  );

  const affectedConstellationPreviews = output.constellationImpacts.map((impact) =>
    mapConstellationImpactPreview(impact, options.constellationTitleById),
  );

  const canonPreviews = output.canonImpacts.map(mapCanonImpactPreview);

  const preservedPreviews = output.preservedElements.map((el) =>
    mapPreservedPreview(el, options.nodeTitleById, options.constellationTitleById),
  );

  const draft: RipplePreviewModel = {
    id: options.id ?? `ripple_preview_${output.triggerEventId}`,
    triggerEventId: output.triggerEventId,
    title: options.title ?? "Ripple Preview",
    summary: output.summary,
    impactLevel: output.impactLevel,
    status: "ready",
    operationPreviews,
    warningPreviews,
    affectedNodePreviews,
    affectedConstellationPreviews,
    canonPreviews,
    preservedPreviews,
    followUpQuestions: [...output.followUpQuestions],
    counts: { operationCount: 0, warningCount: 0, affectedNodeCount: 0, affectedConstellationCount: 0, canonImpactCount: 0, preservedCount: 0, highPriorityOperationCount: 0, highSeverityWarningCount: 0, approvalRequiredCount: 0, clarificationRequiredCount: 0 },
    confidence: output.confidence,
    createdAt: options.createdAt ?? new Date(0).toISOString(),
  };

  draft.counts = computeRipplePreviewCounts(draft);
  draft.status =
    options.status ??
    (isStructurallyUnusableOutput(output) ? "failed" : getRipplePreviewStatus(draft));

  return draft;
}

export function summarizeRipplePreview(model: RipplePreviewModel): RipplePreviewSummary {
  return {
    id: model.id,
    triggerEventId: model.triggerEventId,
    status: model.status,
    impactLevel: model.impactLevel,
    summary: model.summary,
    counts: computeRipplePreviewCounts(model),
    confidence: model.confidence,
  };
}

export function getApprovalRequiredOperations(
  model: RipplePreviewModel,
): RippleOperationPreview[] {
  return model.operationPreviews.filter((op) => op.requiresUserApproval);
}

export function getHighRiskOperations(
  model: RipplePreviewModel,
): RippleOperationPreview[] {
  return model.operationPreviews.filter((op) => op.riskLevel === "high");
}

export function getWarningsRequiringAttention(
  model: RipplePreviewModel,
): RippleWarningPreview[] {
  return model.warningPreviews.filter((w) => w.requiresUserAttention);
}

export function updateRippleOperationApproval(
  model: RipplePreviewModel,
  operationId: string,
  approvalState: RippleOperationApprovalState,
): RipplePreviewModel {
  const operationPreviews = model.operationPreviews.map((op) =>
    op.id === operationId || op.sourceOperationId === operationId
      ? { ...op, approvalState }
      : { ...op },
  );

  const next: RipplePreviewModel = {
    ...model,
    operationPreviews,
    warningPreviews: model.warningPreviews.map((w) => ({ ...w, affectedTargets: w.affectedTargets.map((t) => ({ ...t })) })),
    affectedNodePreviews: model.affectedNodePreviews.map((n) => ({ ...n })),
    affectedConstellationPreviews: model.affectedConstellationPreviews.map((c) => ({ ...c })),
    canonPreviews: model.canonPreviews.map((c) => ({ ...c })),
    preservedPreviews: model.preservedPreviews.map((p) => ({ ...p })),
    followUpQuestions: [...model.followUpQuestions],
    counts: computeRipplePreviewCounts({ ...model, operationPreviews }),
  };

  return next;
}

export function validateRipplePreviewModel(
  model: RipplePreviewModel,
): RipplePreviewValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!model.id?.trim()) errors.push("Missing preview id");
  if (!model.triggerEventId?.trim()) errors.push("Missing triggerEventId");

  const opIds = new Set<string>();
  for (const op of model.operationPreviews) {
    if (opIds.has(op.id)) errors.push(`Duplicate operation preview id: ${op.id}`);
    opIds.add(op.id);
    if (!APPROVAL_STATES.has(op.approvalState)) {
      errors.push(`Invalid approvalState on ${op.id}`);
    }
    if (!RISK_LEVELS.has(op.riskLevel)) {
      errors.push(`Invalid riskLevel on ${op.id}`);
    }
  }

  const warnIds = new Set<string>();
  for (const w of model.warningPreviews) {
    if (warnIds.has(w.id)) errors.push(`Duplicate warning preview id: ${w.id}`);
    warnIds.add(w.id);
  }

  const computed = computeRipplePreviewCounts(model);
  const countFields: (keyof RipplePreviewCounts)[] = [
    "operationCount",
    "warningCount",
    "affectedNodeCount",
    "affectedConstellationCount",
    "canonImpactCount",
    "preservedCount",
    "highPriorityOperationCount",
    "highSeverityWarningCount",
    "approvalRequiredCount",
    "clarificationRequiredCount",
  ];

  for (const field of countFields) {
    if (model.counts[field] !== computed[field]) {
      errors.push(`counts.${field} mismatch: stored ${model.counts[field]}, expected ${computed[field]}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

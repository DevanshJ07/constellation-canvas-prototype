/**
 * World Evolution Engine — type contracts + pure planner (Phase 5.1).
 *
 * Converts a ready RippleApplyPlan into a declarative WorldEvolutionPlan.
 * Pure functions only — no React, no API, no LLM, no canvas mutation.
 *
 * Plans describe intended mutations for future preview/apply phases.
 */

import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import type {
  RippleAffectedScope,
  RippleOperationTarget,
  RippleOperationType,
  RippleUserSteering,
} from "@/lib/worldBrain/rippleEffectTypes";
import type {
  RippleApplyOperation,
  RippleApplyPlan,
  RippleApplyBlocker,
} from "@/lib/worldBrain/rippleApplyPlan";
import type {
  RipplePreviewRiskLevel,
  RippleWarningPreview,
} from "@/lib/worldBrain/ripplePreviewModel";
import type { CanonStateSnapshot } from "@/lib/worldBrain/userDecisionTypes";

// ── Policy ────────────────────────────────────────────────────────────────────────

export type NodeBudgetPolicy = {
  maxNewNodesPerBatch: number;
  maxNodesPerConstellation: number;
  maxDepthFromRoot: number;
  maxNewConstellationsPerBatch: number;
};

export type EvolutionPolicy = {
  nodeBudget: NodeBudgetPolicy;
  /** Maximum propagation scope allowed for a single action. */
  maxPropagationScope: RippleAffectedScope;
  /** Confidence threshold for ready actions. */
  readyConfidenceThreshold: number;
  /** Confidence threshold for tentative / needs_review actions. */
  tentativeConfidenceThreshold: number;
  /** Below this, skip or downgrade. */
  minimumConfidenceThreshold: number;
};

export const DEFAULT_EVOLUTION_POLICY: EvolutionPolicy = {
  nodeBudget: {
    maxNewNodesPerBatch: 3,
    maxNodesPerConstellation: 24,
    maxDepthFromRoot: 5,
    maxNewConstellationsPerBatch: 0,
  },
  maxPropagationScope: "constellation",
  readyConfidenceThreshold: 0.75,
  tentativeConfidenceThreshold: 0.55,
  minimumConfidenceThreshold: 0.4,
};

// ── Plan status & traces ────────────────────────────────────────────────────────────

export type WorldEvolutionPlanStatus =
  | "empty"
  | "ready_for_preview"
  | "needs_review"
  | "blocked"
  | "failed";

export type EvolutionActionStatus = "ready" | "downgraded" | "skipped" | "blocked";

export type EvolutionStopReason =
  | "apply_plan_not_ready"
  | "canon_truth_protected"
  | "preserved_element"
  | "locked_target"
  | "node_budget_exceeded"
  | "constellation_cap_exceeded"
  | "low_confidence"
  | "missing_parent_or_constellation"
  | "missing_continuation_anchor"
  | "duplicate_label"
  | "new_constellation_not_allowed"
  | "flow_deferred"
  | "hard_removal_downgraded"
  | "unsupported_operation"
  | "apply_plan_blocker"
  | "target_not_found"
  | "conflicting_operations"
  | "duplicate_proposal"
  | "steering_conflict"
  | "canon_modify_requires_review"
  | "constellation_not_found";

export type EvolutionPropagationTrace = {
  scope: RippleAffectedScope;
  hopsFromTrigger: number;
  cappedByPolicy: boolean;
};

export type EvolutionConfidenceProfile = {
  baseConfidence: number;
  distanceFactor: number;
  warningFactor: number;
  finalConfidence: number;
  tier: "ready" | "tentative" | "downgrade" | "skip";
};

export type EvolutionBlockerKind =
  | "apply_plan"
  | "canon_protection"
  | "preserved_element"
  | "node_budget"
  | "confidence"
  | "validation"
  | "policy"
  | "conflict"
  | "steering";

export type EvolutionBlocker = {
  id: string;
  kind: EvolutionBlockerKind;
  message: string;
  sourceOperationId?: string;
  targetId?: string;
  stopReason?: EvolutionStopReason;
};

export type EvolutionWarning = {
  id: string;
  message: string;
  sourceOperationId?: string;
  warningType?: string;
};

// ── Action types ────────────────────────────────────────────────────────────────────

export type EvolutionActionType =
  | "strengthen_node"
  | "weaken_node"
  | "modify_node"
  | "generate_node"
  | "archive_node"
  | "remove_node"
  | "merge_nodes"
  | "split_node"
  | "replace_node"
  | "refocus_constellation"
  | "change_constellation_priority"
  | "defer_flow_update"
  | "skipped";

export type WorldEvolutionActionBase = {
  id: string;
  sourceOperationId: string;
  actionType: EvolutionActionType;
  reason: string;
  confidence: number;
  riskLevel: RipplePreviewRiskLevel;
  reversible: boolean;
  requiresUserConfirmation: boolean;
  propagation: EvolutionPropagationTrace;
  confidenceProfile: EvolutionConfidenceProfile;
  status: EvolutionActionStatus;
  stopReason?: EvolutionStopReason;
  originalOperationType?: RippleOperationType;
};

export type NodeEvolutionAction = WorldEvolutionActionBase & {
  kind: "node";
  targetId: string;
  constellationId?: string;
  parentNodeId?: string;
  proposedLabel?: string;
  continuationAnchor?: string;
  payload?: Record<string, unknown>;
};

export type ConstellationEvolutionAction = WorldEvolutionActionBase & {
  kind: "constellation";
  constellationId: string;
  focusShift?: string;
  priorityDelta?: number;
};

export type WorldEvolutionAction = NodeEvolutionAction | ConstellationEvolutionAction;

export type EvolutionApplyResultCandidate = {
  actionId: string;
  sourceOperationId: string;
  wouldApply: boolean;
  reason: string;
};

// ── Input / output ──────────────────────────────────────────────────────────────────

export type WorldEvolutionInput = {
  applyPlan: RippleApplyPlan;
  canvasModel?: CanvasWorldModel | null;
  canonState?: CanonStateSnapshot;
  triggerNodeId?: string;
  preservedTargetIds?: string[];
  lockedTargetIds?: string[];
  nodeTitleById?: Record<string, string>;
  /** Known node counts per constellation for budget enforcement. */
  constellationNodeCounts?: Record<string, number>;
  nodeConstellationMap?: Record<string, string>;
  existingNodeIds?: string[];
  /** Optional explicit confidence per ripple source operation id. */
  operationConfidenceBySourceId?: Record<string, number>;
  /** Optional World Whisper steering — constrains evolution, never bypasses approval. */
  userSteering?: RippleUserSteering;
  policy?: EvolutionPolicy;
  id?: string;
  createdAt?: string;
};

export type WorldEvolutionPlan = {
  id: string;
  applyPlanId: string;
  previewId: string;
  triggerEventId: string;
  status: WorldEvolutionPlanStatus;
  actions: WorldEvolutionAction[];
  readyActions: WorldEvolutionAction[];
  blockedActions: WorldEvolutionAction[];
  blockers: EvolutionBlocker[];
  warnings: EvolutionWarning[];
  summary: string;
  policy: EvolutionPolicy;
  nodeBudgetRemaining: number;
  createdAt: string;
};

export type WorldEvolutionPlanSummary = {
  id: string;
  status: WorldEvolutionPlanStatus;
  readyCount: number;
  blockedCount: number;
  skippedCount: number;
  blockerCount: number;
  summary: string;
};

export type WorldEvolutionValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type BuildWorldEvolutionPlanOptions = {
  id?: string;
  createdAt?: string;
};

// ── Constants ───────────────────────────────────────────────────────────────────────

const SCOPE_ORDER: RippleAffectedScope[] = [
  "node",
  "sibling_nodes",
  "constellation",
  "neighboring_constellations",
  "world",
  "canon",
  "flow",
];

const RISK_BASE_CONFIDENCE: Record<RipplePreviewRiskLevel, number> = {
  low: 0.86,
  medium: 0.74,
  high: 0.66,
};

const REVERSIBLE_ACTION_TYPES = new Set<EvolutionActionType>([
  "strengthen_node",
  "weaken_node",
  "modify_node",
  "generate_node",
  "archive_node",
  "refocus_constellation",
  "change_constellation_priority",
]);

const GENERIC_ANCHORS = new Set([
  "mystery",
  "conflict",
  "theme",
  "idea",
  "story",
  "plot",
]);

// ── Factory helpers ───────────────────────────────────────────────────────────────

export function createEvolutionBlocker(
  kind: EvolutionBlockerKind,
  message: string,
  options: {
    id?: string;
    sourceOperationId?: string;
    targetId?: string;
    stopReason?: EvolutionStopReason;
  } = {},
): EvolutionBlocker {
  const suffix = options.sourceOperationId ?? options.targetId ?? "global";
  return {
    id: options.id ?? `evo_blocker_${kind}_${suffix}`,
    kind,
    message,
    ...(options.sourceOperationId !== undefined
      ? { sourceOperationId: options.sourceOperationId }
      : {}),
    ...(options.targetId !== undefined ? { targetId: options.targetId } : {}),
    ...(options.stopReason !== undefined ? { stopReason: options.stopReason } : {}),
  };
}

export function createEvolutionWarning(
  message: string,
  options: {
    id?: string;
    sourceOperationId?: string;
    warningType?: string;
  } = {},
): EvolutionWarning {
  return {
    id: options.id ?? `evo_warning_${options.sourceOperationId ?? "global"}`,
    message,
    ...(options.sourceOperationId !== undefined
      ? { sourceOperationId: options.sourceOperationId }
      : {}),
    ...(options.warningType !== undefined ? { warningType: options.warningType } : {}),
  };
}

export function createEmptyWorldEvolutionPlan(
  input: Pick<WorldEvolutionInput, "applyPlan"> &
    Partial<Pick<WorldEvolutionInput, "policy" | "createdAt">> &
    BuildWorldEvolutionPlanOptions,
): WorldEvolutionPlan {
  const policy = input.policy ?? DEFAULT_EVOLUTION_POLICY;
  const applyPlan = input.applyPlan;
  return {
    id: input.id ?? `world_evolution_plan_empty_${applyPlan.id ?? "unknown"}`,
    applyPlanId: applyPlan.id ?? "",
    previewId: applyPlan.previewId ?? "",
    triggerEventId: applyPlan.triggerEventId ?? "",
    status: "empty",
    actions: [],
    readyActions: [],
    blockedActions: [],
    blockers: [],
    warnings: [],
    summary: "No evolution actions planned.",
    policy,
    nodeBudgetRemaining: policy.nodeBudget.maxNewNodesPerBatch,
    createdAt: input.createdAt ?? applyPlan.createdAt ?? new Date(0).toISOString(),
  };
}

// ── Classification & guards ─────────────────────────────────────────────────────────

export function classifyRippleOperationForEvolution(
  operation: RippleApplyOperation,
): EvolutionActionType | null {
  switch (operation.operationType) {
    case "strengthen_node":
      return "strengthen_node";
    case "weaken_node":
      return "weaken_node";
    case "modify_node":
      return "modify_node";
    case "generate_new_node":
      return "generate_node";
    case "remove_node":
      return "remove_node";
    case "merge_nodes":
      return "merge_nodes";
    case "split_node":
      return "split_node";
    case "replace_node":
      return "replace_node";
    case "refocus_constellation":
      return "refocus_constellation";
    case "change_constellation_priority":
      return "change_constellation_priority";
    case "update_flow":
      return "defer_flow_update";
    case "ask_user_clarification":
    case "mark_for_critic_review":
      return null;
    default:
      return null;
  }
}

export function shouldBlockHardRemoval(
  targetId: string,
  context: {
    canonState?: CanonStateSnapshot;
    preservedTargetIds?: string[];
    lockedTargetIds?: string[];
  },
): { blocked: boolean; stopReason?: EvolutionStopReason } {
  if (context.preservedTargetIds?.includes(targetId)) {
    return { blocked: true, stopReason: "preserved_element" };
  }
  if (context.lockedTargetIds?.includes(targetId)) {
    return { blocked: true, stopReason: "locked_target" };
  }
  if (context.canonState?.truthNodeIds.includes(targetId)) {
    return { blocked: true, stopReason: "canon_truth_protected" };
  }
  return { blocked: false };
}

export function shouldDowngradeToWeaken(
  operationType: RippleOperationType,
  confidenceProfile: EvolutionConfidenceProfile,
  policy: EvolutionPolicy = DEFAULT_EVOLUTION_POLICY,
): boolean {
  if (operationType === "remove_node") return true;
  if (operationType === "generate_new_node") {
    return confidenceProfile.finalConfidence < policy.readyConfidenceThreshold;
  }
  return confidenceProfile.tier === "downgrade" || confidenceProfile.tier === "skip";
}

function scopeIndex(scope: RippleAffectedScope): number {
  return SCOPE_ORDER.indexOf(scope);
}

function capPropagationScope(
  requested: RippleAffectedScope,
  policy: EvolutionPolicy,
): { scope: RippleAffectedScope; capped: boolean } {
  const reqIdx = scopeIndex(requested);
  const maxIdx = scopeIndex(policy.maxPropagationScope);
  if (reqIdx <= maxIdx) {
    return { scope: requested, capped: false };
  }
  return { scope: policy.maxPropagationScope, capped: true };
}

function computeHopsFromTrigger(
  target: RippleOperationTarget,
  input: WorldEvolutionInput,
): number {
  const triggerId = input.triggerNodeId;
  if (!triggerId) return 0;

  const triggerConstellation =
    input.nodeConstellationMap?.[triggerId] ??
    input.canvasModel?.nodes.find((n) => n.id === triggerId)?.constellationId;

  if (target.targetType === "constellation") {
    if (triggerConstellation && triggerConstellation === target.id) return 1;
    return 2;
  }

  if (target.targetType !== "node") return 2;
  if (target.id === triggerId) return 0;

  const targetConstellation =
    target.constellationId ??
    input.nodeConstellationMap?.[target.id] ??
    input.canvasModel?.nodes.find((n) => n.id === target.id)?.constellationId;

  if (triggerConstellation && targetConstellation) {
    if (triggerConstellation === targetConstellation) return 1;
    return 2;
  }
  return 2;
}

function inferPropagationScope(
  operation: RippleApplyOperation,
  hops: number,
): RippleAffectedScope {
  if (operation.target.targetType === "constellation") return "constellation";
  if (operation.target.targetType === "flow_item") return "flow";
  if (operation.operationType === "refocus_constellation") return "constellation";
  if (hops === 0) return "node";
  if (hops === 1) return "sibling_nodes";
  return "constellation";
}

export function estimateEvolutionConfidence(
  operation: RippleApplyOperation,
  input: WorldEvolutionInput,
  options: {
    hopsFromTrigger?: number;
    planWarnings?: RippleWarningPreview[];
  } = {},
): EvolutionConfidenceProfile {
  const policy = input.policy ?? DEFAULT_EVOLUTION_POLICY;
  const hops =
    options.hopsFromTrigger ??
    computeHopsFromTrigger(operation.target, input);

  const baseConfidence =
    input.operationConfidenceBySourceId?.[operation.sourceOperationId] ??
    RISK_BASE_CONFIDENCE[operation.riskLevel];

  const distanceFactor =
    hops === 0 ? 1 : hops === 1 ? 0.92 : hops === 2 ? 0.84 : 0.72;

  let warningFactor = 1;
  if (operation.relatedWarnings.length > 0) {
    warningFactor *= 0.92;
  }
  for (const warning of options.planWarnings ?? []) {
    if (
      operation.relatedWarnings.some((id) => warning.id.includes(id.replace(/^preview_warn_/, "")))
    ) {
      warningFactor *= 0.88;
    }
    if (warning.warningType === "tone_mismatch" || warning.warningType === "scope_drift") {
      warningFactor *= 0.9;
    }
  }

  const finalConfidence = clampConfidence(baseConfidence * distanceFactor * warningFactor);

  let tier: EvolutionConfidenceProfile["tier"] = "ready";
  if (finalConfidence < policy.minimumConfidenceThreshold) {
    tier = "skip";
  } else if (finalConfidence < policy.tentativeConfidenceThreshold) {
    tier = "downgrade";
  } else if (finalConfidence < policy.readyConfidenceThreshold) {
    tier = "tentative";
  }

  return {
    baseConfidence,
    distanceFactor,
    warningFactor,
    finalConfidence,
    tier,
  };
}

export function enforceNodeBudget(
  plannedGenerations: number,
  constellationId: string | undefined,
  input: WorldEvolutionInput,
  policy: EvolutionPolicy = DEFAULT_EVOLUTION_POLICY,
): { allowed: boolean; stopReason?: EvolutionStopReason } {
  const batchCap = policy.nodeBudget.maxNewNodesPerBatch;
  if (plannedGenerations >= batchCap) {
    return { allowed: false, stopReason: "node_budget_exceeded" };
  }

  if (constellationId) {
    const currentCount =
      input.constellationNodeCounts?.[constellationId] ??
      input.canvasModel?.nodes.filter((n) => n.constellationId === constellationId)
        .length ??
      0;
    if (currentCount + plannedGenerations + 1 > policy.nodeBudget.maxNodesPerConstellation) {
      return { allowed: false, stopReason: "constellation_cap_exceeded" };
    }
  }

  return { allowed: true };
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function resolveConstellationId(
  target: RippleOperationTarget,
  input: WorldEvolutionInput,
): string | undefined {
  if (target.targetType === "constellation") return target.id;
  return (
    target.constellationId ??
    input.nodeConstellationMap?.[target.id] ??
    input.canvasModel?.nodes.find((n) => n.id === target.id)?.constellationId
  );
}

function resolveProposedLabel(
  operation: RippleApplyOperation,
  input: WorldEvolutionInput,
): string | undefined {
  const payload = operation.payload ?? {};
  const fromPayload =
    (typeof payload.proposedTitle === "string" && payload.proposedTitle) ||
    (typeof payload.title === "string" && payload.title) ||
    (typeof payload.displayTitle === "string" && payload.displayTitle);
  if (fromPayload) return fromPayload.trim();
  return input.nodeTitleById?.[operation.target.id] ?? operation.title;
}

function isDuplicateLabel(
  label: string,
  constellationId: string | undefined,
  input: WorldEvolutionInput,
): boolean {
  if (!constellationId || !label.trim()) return false;
  const normalized = label.trim().toLowerCase();
  for (const [nodeId, title] of Object.entries(input.nodeTitleById ?? {})) {
    const nodeConstellation =
      input.nodeConstellationMap?.[nodeId] ??
      input.canvasModel?.nodes.find((n) => n.id === nodeId)?.constellationId;
    if (nodeConstellation === constellationId && title.trim().toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}

type PlannerBatchState = {
  plannedGenerations: number;
  plannedLabelsByConstellation: Map<string, Set<string>>;
  plannedAnchorsByConstellation: Map<string, Set<string>>;
};

function createPlannerBatchState(): PlannerBatchState {
  return {
    plannedGenerations: 0,
    plannedLabelsByConstellation: new Map(),
    plannedAnchorsByConstellation: new Map(),
  };
}

function hasCanvasExistenceContext(input: WorldEvolutionInput): boolean {
  if (input.existingNodeIds && input.existingNodeIds.length > 0) return true;
  if (input.nodeTitleById && Object.keys(input.nodeTitleById).length > 0) return true;
  if (input.canvasModel?.nodes && input.canvasModel.nodes.length > 0) return true;
  if (input.nodeConstellationMap && Object.keys(input.nodeConstellationMap).length > 0) return true;
  return false;
}

function targetNodeExists(targetId: string, input: WorldEvolutionInput): boolean {
  if (!hasCanvasExistenceContext(input)) return true;
  if (input.existingNodeIds?.includes(targetId)) return true;
  if (input.nodeTitleById?.[targetId]) return true;
  if (input.nodeConstellationMap?.[targetId]) return true;
  if (input.canvasModel?.nodes.some((node) => node.id === targetId)) return true;
  return false;
}

function constellationExists(constellationId: string, input: WorldEvolutionInput): boolean {
  if (!hasCanvasExistenceContext(input)) return true;
  if (input.constellationNodeCounts?.[constellationId] !== undefined) return true;
  if (input.canvasModel?.constellations.some((c) => c.id === constellationId)) return true;
  if (Object.values(input.nodeConstellationMap ?? {}).includes(constellationId)) return true;
  return false;
}

function isCanonTruthNode(targetId: string, input: WorldEvolutionInput): boolean {
  return input.canonState?.truthNodeIds.includes(targetId) ?? false;
}

function isConstellationNearCap(
  constellationId: string,
  input: WorldEvolutionInput,
  policy: EvolutionPolicy,
): boolean {
  const currentCount =
    input.constellationNodeCounts?.[constellationId] ??
    input.canvasModel?.nodes.filter((node) => node.constellationId === constellationId).length ??
    0;
  return currentCount >= policy.nodeBudget.maxNodesPerConstellation - 2;
}

function isDuplicateProposalInBatch(
  label: string | undefined,
  anchor: string | undefined,
  constellationId: string | undefined,
  state: PlannerBatchState,
): { duplicate: boolean; stopReason?: EvolutionStopReason } {
  if (!constellationId) return { duplicate: false };

  if (label?.trim()) {
    const labels =
      state.plannedLabelsByConstellation.get(constellationId) ?? new Set<string>();
    const normalizedLabel = label.trim().toLowerCase();
    if (labels.has(normalizedLabel)) {
      return { duplicate: true, stopReason: "duplicate_proposal" };
    }
  }

  if (anchor?.trim()) {
    const anchors =
      state.plannedAnchorsByConstellation.get(constellationId) ?? new Set<string>();
    const normalizedAnchor = anchor.trim().toLowerCase();
    if (anchors.has(normalizedAnchor)) {
      return { duplicate: true, stopReason: "duplicate_proposal" };
    }
  }

  return { duplicate: false };
}

function registerBatchProposal(
  label: string | undefined,
  anchor: string | undefined,
  constellationId: string | undefined,
  state: PlannerBatchState,
): void {
  if (!constellationId) return;

  if (label?.trim()) {
    const labels =
      state.plannedLabelsByConstellation.get(constellationId) ?? new Set<string>();
    labels.add(label.trim().toLowerCase());
    state.plannedLabelsByConstellation.set(constellationId, labels);
  }

  if (anchor?.trim()) {
    const anchors =
      state.plannedAnchorsByConstellation.get(constellationId) ?? new Set<string>();
    anchors.add(anchor.trim().toLowerCase());
    state.plannedAnchorsByConstellation.set(constellationId, anchors);
  }
}

function extractSteeringKeywords(instruction: string): string[] {
  const normalized = instruction.toLowerCase();
  const keywords = new Set<string>();
  const lessPattern = /(?:less|reduce|avoid|no more|minimize|fewer)\s+([a-z][a-z\s-]{2,30})/g;
  for (const match of normalized.matchAll(lessPattern)) {
    keywords.add(match[1]!.trim().split(/\s+/)[0]!);
  }
  if (normalized.includes("supernatural")) keywords.add("supernatural");
  if (normalized.includes("magic")) keywords.add("magic");
  return [...keywords];
}

export function detectSteeringCanonConflict(
  operation: RippleApplyOperation,
  targetId: string,
  input: WorldEvolutionInput,
): { conflict: boolean; message?: string } {
  const steering = input.userSteering;
  if (!steering?.instruction.trim()) return { conflict: false };

  const isTruth = isCanonTruthNode(targetId, input);
  const nodeTitle = input.nodeTitleById?.[targetId]?.toLowerCase() ?? "";
  const opText = `${operation.reason} ${JSON.stringify(operation.payload ?? {})}`.toLowerCase();
  const steeringKeywords = extractSteeringKeywords(steering.instruction);

  if (
    operation.operationType === "modify_node" &&
    isTruth
  ) {
    return {
      conflict: true,
      message: `Modify on canon truth "${targetId}" requires explicit review; evolution will not silently overwrite canon.`,
    };
  }

  for (const keyword of steeringKeywords) {
    const themePresent = nodeTitle.includes(keyword) || opText.includes(keyword);
    if (!themePresent) continue;

    if (
      isTruth &&
      (operation.operationType === "strengthen_node" ||
        operation.operationType === "modify_node")
    ) {
      return {
        conflict: true,
        message: `Steering "${steering.instruction}" conflicts with reinforcing canon truth "${targetId}" (${keyword}).`,
      };
    }

    if (
      operation.operationType === "strengthen_node" &&
      steering.instruction.toLowerCase().includes(`less ${keyword}`)
    ) {
      return {
        conflict: true,
        message: `Steering "${steering.instruction}" blocks strengthen on ${keyword}-themed target ${targetId}.`,
      };
    }
  }

  return { conflict: false };
}

const CONFLICTING_ACTION_PAIRS: [EvolutionActionType, EvolutionActionType][] = [
  ["strengthen_node", "weaken_node"],
  ["modify_node", "weaken_node"],
  ["modify_node", "archive_node"],
];

function actionsConflict(a: EvolutionActionType, b: EvolutionActionType): boolean {
  return CONFLICTING_ACTION_PAIRS.some(
    ([left, right]) => (a === left && b === right) || (a === right && b === left),
  );
}

function resolveActionConflicts(
  actions: WorldEvolutionAction[],
  blockers: EvolutionBlocker[],
  warnings: EvolutionWarning[],
): void {
  const byTarget = new Map<string, WorldEvolutionAction[]>();

  for (const action of actions) {
    if (action.kind !== "node") continue;
    if (action.status === "skipped" || action.actionType === "skipped") continue;
    const group = byTarget.get(action.targetId) ?? [];
    group.push(action);
    byTarget.set(action.targetId, group);
  }

  for (const [targetId, group] of byTarget) {
    const active = group.filter(
      (action) => action.status === "ready" || action.status === "downgraded",
    );
    if (active.length < 2) continue;

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const first = active[i]!;
        const second = active[j]!;
        if (!actionsConflict(first.actionType, second.actionType)) continue;

        const winner = first.confidence >= second.confidence ? first : second;
        const loser = winner === first ? second : first;

        loser.actionType = "skipped";
        loser.status = "skipped";
        loser.stopReason = "conflicting_operations";
        blockers.push(
          createEvolutionBlocker(
            "conflict",
            `Conflicting ${first.actionType} and ${second.actionType} on ${targetId}; kept higher-confidence ${winner.actionType}.`,
            {
              sourceOperationId: loser.sourceOperationId,
              targetId,
              stopReason: "conflicting_operations",
            },
          ),
        );

        if (winner.status === "ready") {
          winner.status = "downgraded";
          warnings.push(
            createEvolutionWarning(
              `Conflicting operations on ${targetId}; ${winner.actionType} retained for review.`,
              {
                sourceOperationId: winner.sourceOperationId,
                warningType: "conflicting_operations",
              },
            ),
          );
        }
      }
    }
  }
}

function mapApplyBlocker(blocker: RippleApplyBlocker): EvolutionBlocker {
  return createEvolutionBlocker("apply_plan", blocker.message, {
    id: `evo_${blocker.id}`,
    sourceOperationId: blocker.operationId,
    stopReason: "apply_plan_blocker",
  });
}

function buildActionBase(
  operation: RippleApplyOperation,
  actionType: EvolutionActionType,
  input: WorldEvolutionInput,
  status: EvolutionActionStatus,
  options: {
    stopReason?: EvolutionStopReason;
    confidenceProfile: EvolutionConfidenceProfile;
    propagation: EvolutionPropagationTrace;
    reason?: string;
  },
): WorldEvolutionActionBase {
  const requiresUserConfirmation =
    operation.requiresUserApproval ||
    operation.riskLevel === "high" ||
    actionType === "remove_node" ||
    actionType === "generate_node";

  return {
    id: `evo_action_${operation.id}`,
    sourceOperationId: operation.sourceOperationId,
    actionType,
    reason: options.reason ?? operation.reason,
    confidence: options.confidenceProfile.finalConfidence,
    riskLevel: operation.riskLevel,
    reversible: REVERSIBLE_ACTION_TYPES.has(actionType),
    requiresUserConfirmation,
    propagation: options.propagation,
    confidenceProfile: options.confidenceProfile,
    status,
    originalOperationType: operation.operationType,
    ...(options.stopReason !== undefined ? { stopReason: options.stopReason } : {}),
  };
}

function planNodeAction(
  operation: RippleApplyOperation,
  classified: EvolutionActionType,
  input: WorldEvolutionInput,
  state: PlannerBatchState,
): { action: WorldEvolutionAction; blockers: EvolutionBlocker[]; warnings: EvolutionWarning[] } {
  const policy = input.policy ?? DEFAULT_EVOLUTION_POLICY;
  const blockers: EvolutionBlocker[] = [];
  const warnings: EvolutionWarning[] = [];
  const hops = computeHopsFromTrigger(operation.target, input);
  const confidenceProfile = estimateEvolutionConfidence(operation, input, {
    hopsFromTrigger: hops,
    planWarnings: input.applyPlan.warnings,
  });
  const requestedScope = inferPropagationScope(operation, hops);
  const { scope, capped } = capPropagationScope(requestedScope, policy);
  const propagation: EvolutionPropagationTrace = {
    scope,
    hopsFromTrigger: hops,
    cappedByPolicy: capped,
  };

  if (classified === "defer_flow_update") {
    const action: NodeEvolutionAction = {
      ...buildActionBase(operation, "defer_flow_update", input, "blocked", {
        confidenceProfile,
        propagation,
        stopReason: "flow_deferred",
        reason: "Flow update deferred until Narrative Flow engine exists.",
      }),
      kind: "node",
      targetId: operation.target.id,
    };
    blockers.push(
      createEvolutionBlocker("policy", action.reason, {
        sourceOperationId: operation.sourceOperationId,
        stopReason: "flow_deferred",
      }),
    );
    return { action, blockers, warnings };
  }

  if (operation.target.targetType !== "node" && classified !== "generate_node") {
    const action: NodeEvolutionAction = {
      ...buildActionBase(operation, "skipped", input, "skipped", {
        confidenceProfile,
        propagation,
        stopReason: "unsupported_operation",
      }),
      kind: "node",
      targetId: operation.target.id,
    };
    return { action, blockers, warnings };
  }

  const targetId = operation.target.id;
  const constellationId = resolveConstellationId(operation.target, input);
  const payload = operation.payload ? { ...operation.payload } : undefined;

  if (classified !== "generate_node" && !targetNodeExists(targetId, input)) {
    const action: NodeEvolutionAction = {
      ...buildActionBase(operation, "skipped", input, "skipped", {
        confidenceProfile,
        propagation,
        stopReason: "target_not_found",
        reason: `Target node ${targetId} not found in canvas context.`,
      }),
      kind: "node",
      targetId,
      ...(constellationId !== undefined ? { constellationId } : {}),
    };
    blockers.push(
      createEvolutionBlocker("validation", action.reason, {
        sourceOperationId: operation.sourceOperationId,
        targetId,
        stopReason: "target_not_found",
      }),
    );
    return { action, blockers, warnings };
  }

  const steeringConflict = detectSteeringCanonConflict(operation, targetId, input);
  if (steeringConflict.conflict && steeringConflict.message) {
    const stopReason: EvolutionStopReason =
      operation.operationType === "modify_node" && isCanonTruthNode(targetId, input)
        ? "canon_modify_requires_review"
        : "steering_conflict";
    const action: NodeEvolutionAction = {
      ...buildActionBase(operation, classified, input, "downgraded", {
        confidenceProfile,
        propagation,
        stopReason,
        reason: steeringConflict.message,
      }),
      kind: "node",
      targetId,
      ...(constellationId !== undefined ? { constellationId } : {}),
      ...(payload !== undefined ? { payload } : {}),
    };
    blockers.push(
      createEvolutionBlocker(
        stopReason === "canon_modify_requires_review" ? "canon_protection" : "steering",
        steeringConflict.message,
        {
          sourceOperationId: operation.sourceOperationId,
          targetId,
          stopReason,
        },
      ),
    );
    return { action, blockers, warnings };
  }

  if (classified === "remove_node") {
    const removal = shouldBlockHardRemoval(targetId, input);
    if (removal.blocked || shouldDowngradeToWeaken(operation.operationType, confidenceProfile, policy)) {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "weaken_node", input, removal.blocked ? "downgraded" : "downgraded", {
          confidenceProfile,
          propagation,
          stopReason: removal.stopReason ?? "hard_removal_downgraded",
          reason: removal.blocked
            ? `Hard removal blocked — downgraded to weaken for ${targetId}.`
            : `Hard removal downgraded to weaken for safer evolution: ${targetId}.`,
        }),
        kind: "node",
        targetId,
        ...(constellationId !== undefined ? { constellationId } : {}),
        ...(payload !== undefined ? { payload } : {}),
      };
      if (removal.blocked) {
        blockers.push(
          createEvolutionBlocker("canon_protection", action.reason, {
            sourceOperationId: operation.sourceOperationId,
            targetId,
            stopReason: removal.stopReason,
          }),
        );
      } else {
        warnings.push(
          createEvolutionWarning(action.reason, {
            sourceOperationId: operation.sourceOperationId,
          }),
        );
      }
      return { action, blockers, warnings };
    }

    const action: NodeEvolutionAction = {
      ...buildActionBase(operation, "archive_node", input, "ready", {
        confidenceProfile,
        propagation,
        reason: `Archive node ${targetId} before any hard removal in later phases.`,
      }),
      kind: "node",
      targetId,
      ...(constellationId !== undefined ? { constellationId } : {}),
      ...(payload !== undefined ? { payload } : {}),
    };
    return { action, blockers, warnings };
  }

  if (classified === "generate_node") {
    const parentNodeId =
      operation.target.parentNodeId ??
      (typeof payload?.parentNodeId === "string" ? payload.parentNodeId : undefined) ??
      input.triggerNodeId;
    const anchor =
      (typeof payload?.continuationAnchor === "string" && payload.continuationAnchor) ||
      (typeof payload?.anchor === "string" && payload.anchor) ||
      undefined;
    const proposedLabel = resolveProposedLabel(operation, input);

    if (!constellationId && !parentNodeId) {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "skipped", input, "skipped", {
          confidenceProfile,
          propagation,
          stopReason: "missing_parent_or_constellation",
        }),
        kind: "node",
        targetId,
        proposedLabel,
      };
      blockers.push(
        createEvolutionBlocker("validation", "Generate-node requires constellation or parent reference.", {
          sourceOperationId: operation.sourceOperationId,
          targetId,
          stopReason: "missing_parent_or_constellation",
        }),
      );
      return { action, blockers, warnings };
    }

    if (!anchor || GENERIC_ANCHORS.has(anchor.trim().toLowerCase())) {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "skipped", input, "skipped", {
          confidenceProfile,
          propagation,
          stopReason: "missing_continuation_anchor",
        }),
        kind: "node",
        targetId,
        ...(constellationId !== undefined ? { constellationId } : {}),
        ...(parentNodeId !== undefined ? { parentNodeId } : {}),
        proposedLabel,
      };
      blockers.push(
        createEvolutionBlocker("validation", "Generate-node requires a specific continuation anchor.", {
          sourceOperationId: operation.sourceOperationId,
          targetId,
          stopReason: "missing_continuation_anchor",
        }),
      );
      return { action, blockers, warnings };
    }

    if (isDuplicateLabel(proposedLabel ?? targetId, constellationId, input)) {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "skipped", input, "skipped", {
          confidenceProfile,
          propagation,
          stopReason: "duplicate_label",
        }),
        kind: "node",
        targetId,
        ...(constellationId !== undefined ? { constellationId } : {}),
        proposedLabel,
        continuationAnchor: anchor,
      };
      blockers.push(
        createEvolutionBlocker("validation", `Duplicate label "${proposedLabel}" in constellation.`, {
          sourceOperationId: operation.sourceOperationId,
          targetId,
          stopReason: "duplicate_label",
        }),
      );
      return { action, blockers, warnings };
    }

    const batchDuplicate = isDuplicateProposalInBatch(
      proposedLabel ?? targetId,
      anchor,
      constellationId,
      state,
    );
    if (batchDuplicate.duplicate) {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "skipped", input, "skipped", {
          confidenceProfile,
          propagation,
          stopReason: batchDuplicate.stopReason,
          reason: "Duplicate generate proposal in the same evolution batch.",
        }),
        kind: "node",
        targetId,
        ...(constellationId !== undefined ? { constellationId } : {}),
        proposedLabel,
        continuationAnchor: anchor,
      };
      blockers.push(
        createEvolutionBlocker("validation", action.reason, {
          sourceOperationId: operation.sourceOperationId,
          targetId,
          stopReason: batchDuplicate.stopReason,
        }),
      );
      return { action, blockers, warnings };
    }

    if (constellationId && isConstellationNearCap(constellationId, input, policy)) {
      warnings.push(
        createEvolutionWarning(
          `Constellation ${constellationId} is near its node cap; prefer refocus/metadata over expansion.`,
          {
            sourceOperationId: operation.sourceOperationId,
            warningType: "constellation_near_cap",
          },
        ),
      );
    }

    const budget = enforceNodeBudget(state.plannedGenerations, constellationId, input, policy);
    if (!budget.allowed) {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "skipped", input, "skipped", {
          confidenceProfile,
          propagation,
          stopReason: budget.stopReason,
        }),
        kind: "node",
        targetId,
        ...(constellationId !== undefined ? { constellationId } : {}),
        ...(parentNodeId !== undefined ? { parentNodeId } : {}),
        proposedLabel,
        continuationAnchor: anchor,
      };
      blockers.push(
        createEvolutionBlocker("node_budget", "Node budget prevents additional generation.", {
          sourceOperationId: operation.sourceOperationId,
          targetId,
          stopReason: budget.stopReason,
        }),
      );
      return { action, blockers, warnings };
    }

    if (confidenceProfile.tier === "skip") {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "skipped", input, "skipped", {
          confidenceProfile,
          propagation,
          stopReason: "low_confidence",
        }),
        kind: "node",
        targetId,
        ...(constellationId !== undefined ? { constellationId } : {}),
        proposedLabel,
        continuationAnchor: anchor,
      };
      blockers.push(
        createEvolutionBlocker("confidence", "Confidence too low to generate a new node.", {
          sourceOperationId: operation.sourceOperationId,
          targetId,
          stopReason: "low_confidence",
        }),
      );
      return { action, blockers, warnings };
    }

    if (shouldDowngradeToWeaken(operation.operationType, confidenceProfile, policy)) {
      const action: NodeEvolutionAction = {
        ...buildActionBase(operation, "weaken_node", input, "downgraded", {
          confidenceProfile,
          propagation,
          stopReason: "low_confidence",
          reason: `Generate-node downgraded to weaken due to confidence ${confidenceProfile.finalConfidence}.`,
        }),
        kind: "node",
        targetId,
        ...(constellationId !== undefined ? { constellationId } : {}),
        proposedLabel,
        continuationAnchor: anchor,
      };
      warnings.push(
        createEvolutionWarning(action.reason, {
          sourceOperationId: operation.sourceOperationId,
        }),
      );
      return { action, blockers, warnings };
    }

    state.plannedGenerations += 1;
    registerBatchProposal(proposedLabel ?? targetId, anchor, constellationId, state);
    const actionStatus: EvolutionActionStatus =
      confidenceProfile.tier === "tentative" ? "downgraded" : "ready";
    const action: NodeEvolutionAction = {
      ...buildActionBase(operation, "generate_node", input, actionStatus, {
        confidenceProfile,
        propagation,
        reason: operation.reason,
      }),
      kind: "node",
      targetId,
      ...(constellationId !== undefined ? { constellationId } : {}),
      ...(parentNodeId !== undefined ? { parentNodeId } : {}),
      proposedLabel,
      continuationAnchor: anchor,
      ...(payload !== undefined ? { payload } : {}),
    };
    return { action, blockers, warnings };
  }

  let actionType = classified;
  let status: EvolutionActionStatus = "ready";
  let stopReason: EvolutionStopReason | undefined;

  if (confidenceProfile.tier === "skip") {
    actionType = "skipped";
    status = "skipped";
    stopReason = "low_confidence";
    blockers.push(
      createEvolutionBlocker("confidence", `Skipped ${classified} due to low confidence.`, {
        sourceOperationId: operation.sourceOperationId,
        targetId,
        stopReason,
      }),
    );
  } else if (confidenceProfile.tier === "downgrade" && classified === "strengthen_node") {
    actionType = "weaken_node";
    status = "downgraded";
    stopReason = "low_confidence";
    warnings.push(
      createEvolutionWarning(`Strengthen downgraded to weaken for ${targetId}.`, {
        sourceOperationId: operation.sourceOperationId,
      }),
    );
  } else if (confidenceProfile.tier === "tentative") {
    status = "downgraded";
    warnings.push(
      createEvolutionWarning(`Tentative confidence for ${classified} on ${targetId}.`, {
        sourceOperationId: operation.sourceOperationId,
      }),
    );
  }

  const action: NodeEvolutionAction = {
    ...buildActionBase(operation, actionType, input, status, {
      confidenceProfile,
      propagation,
      ...(stopReason !== undefined ? { stopReason } : {}),
    }),
    kind: "node",
    targetId,
    ...(constellationId !== undefined ? { constellationId } : {}),
    ...(payload !== undefined ? { payload } : {}),
  };
  return { action, blockers, warnings };
}

function planConstellationAction(
  operation: RippleApplyOperation,
  classified: EvolutionActionType,
  input: WorldEvolutionInput,
): { action: ConstellationEvolutionAction; blockers: EvolutionBlocker[]; warnings: EvolutionWarning[] } {
  const policy = input.policy ?? DEFAULT_EVOLUTION_POLICY;
  const blockers: EvolutionBlocker[] = [];
  const warnings: EvolutionWarning[] = [];
  const hops = computeHopsFromTrigger(operation.target, input);
  const confidenceProfile = estimateEvolutionConfidence(operation, input, {
    hopsFromTrigger: hops,
    planWarnings: input.applyPlan.warnings,
  });
  const requestedScope = inferPropagationScope(operation, hops);
  const { scope, capped } = capPropagationScope(requestedScope, policy);
  const propagation: EvolutionPropagationTrace = {
    scope,
    hopsFromTrigger: hops,
    cappedByPolicy: capped,
  };

  const constellationId =
    operation.target.targetType === "constellation"
      ? operation.target.id
      : resolveConstellationId(operation.target, input) ?? operation.target.id;

  if (
    classified !== "generate_node" &&
    operation.target.targetType === "constellation" &&
    !constellationExists(constellationId, input)
  ) {
    const action: ConstellationEvolutionAction = {
      ...buildActionBase(operation, "skipped", input, "skipped", {
        confidenceProfile,
        propagation,
        stopReason: "constellation_not_found",
        reason: `Constellation ${constellationId} not found in canvas context.`,
      }),
      kind: "constellation",
      constellationId,
    };
    blockers.push(
      createEvolutionBlocker("validation", action.reason, {
        sourceOperationId: operation.sourceOperationId,
        targetId: constellationId,
        stopReason: "constellation_not_found",
      }),
    );
    return { action, blockers, warnings };
  }

  if (classified === "generate_node") {
    blockers.push(
      createEvolutionBlocker("policy", "New constellations are not allowed in this phase.", {
        sourceOperationId: operation.sourceOperationId,
        stopReason: "new_constellation_not_allowed",
      }),
    );
    const action: ConstellationEvolutionAction = {
      ...buildActionBase(operation, "skipped", input, "blocked", {
        confidenceProfile,
        propagation,
        stopReason: "new_constellation_not_allowed",
      }),
      kind: "constellation",
      constellationId,
    };
    return { action, blockers, warnings };
  }

  const focusShift =
    typeof operation.payload?.suggestedFocusShift === "string"
      ? operation.payload.suggestedFocusShift
      : typeof operation.payload?.focusShift === "string"
        ? operation.payload.focusShift
        : undefined;

  let status: EvolutionActionStatus =
    confidenceProfile.tier === "skip" ? "skipped" : "ready";
  if (confidenceProfile.tier === "tentative") status = "downgraded";
  if (confidenceProfile.tier === "skip") {
    blockers.push(
      createEvolutionBlocker("confidence", "Constellation action skipped due to low confidence.", {
        sourceOperationId: operation.sourceOperationId,
        stopReason: "low_confidence",
      }),
    );
  }

  const action: ConstellationEvolutionAction = {
    ...buildActionBase(operation, classified, input, status, {
      confidenceProfile,
      propagation,
      reason:
        classified === "refocus_constellation"
          ? `Refocus constellation metadata for ${constellationId}.`
          : operation.reason,
    }),
    kind: "constellation",
    constellationId,
    ...(focusShift !== undefined ? { focusShift } : {}),
  };
  return { action, blockers, warnings };
}

function derivePlanStatus(
  actions: WorldEvolutionAction[],
  blockers: EvolutionBlocker[],
): WorldEvolutionPlanStatus {
  const ready = actions.filter((a) => a.status === "ready");
  const tentative = actions.filter(
    (a) => a.status === "downgraded" && a.confidenceProfile.tier === "tentative",
  );

  if (actions.length === 0) return "empty";
  if (blockers.some((b) => b.kind === "apply_plan")) return "failed";
  if (ready.length === 0 && blockers.length > 0) return "blocked";
  if (blockers.length > 0 && ready.length > 0) return "needs_review";
  if (tentative.length > 0) return "needs_review";
  if (ready.length > 0 && blockers.length === 0) return "ready_for_preview";
  return "blocked";
}

function buildSummary(plan: WorldEvolutionPlan): string {
  if (plan.status === "empty") return "No evolution actions planned.";
  if (plan.status === "failed") {
    return "Evolution planning failed because the ripple apply plan is not ready.";
  }
  const ready = plan.readyActions.length;
  const blocked = plan.blockedActions.length;
  if (plan.status === "ready_for_preview") {
    return `${ready} evolution action(s) ready for preview.`;
  }
  if (plan.status === "needs_review") {
    return `${ready} ready and ${blocked} blocked/downgraded action(s) need review.`;
  }
  return `${ready} ready, ${blocked} blocked/skipped, ${plan.blockers.length} blocker(s).`;
}

// ── Public planner ──────────────────────────────────────────────────────────────────

export function buildWorldEvolutionPlan(input: WorldEvolutionInput): WorldEvolutionPlan {
  const policy = input.policy ?? DEFAULT_EVOLUTION_POLICY;
  const applyPlan = input.applyPlan;
  const base = createEmptyWorldEvolutionPlan({ applyPlan, policy, createdAt: input.createdAt });

  base.id = input.id ?? `world_evolution_plan_${applyPlan.id}`;
  base.applyPlanId = applyPlan.id;
  base.previewId = applyPlan.previewId;
  base.triggerEventId = applyPlan.triggerEventId;
  base.createdAt = input.createdAt ?? applyPlan.createdAt ?? base.createdAt;

  if (applyPlan.status !== "ready_to_apply") {
    base.status = applyPlan.status === "empty" ? "empty" : "failed";
    base.blockers = applyPlan.blockers.map(mapApplyBlocker);
    if (applyPlan.status !== "empty") {
      base.blockers.unshift(
        createEvolutionBlocker("apply_plan", "Ripple apply plan is not ready_to_apply.", {
          stopReason: "apply_plan_not_ready",
        }),
      );
    }
    base.summary = buildSummary(base);
    return base;
  }

  const actions: WorldEvolutionAction[] = [];
  const blockers: EvolutionBlocker[] = [];
  const warnings: EvolutionWarning[] = [];
  const state = createPlannerBatchState();

  for (const operation of applyPlan.approvedOperations) {
    const classified = classifyRippleOperationForEvolution(operation);
    if (!classified) {
      blockers.push(
        createEvolutionBlocker("validation", `Unsupported ripple operation: ${operation.operationType}`, {
          sourceOperationId: operation.sourceOperationId,
          stopReason: "unsupported_operation",
        }),
      );
      continue;
    }

    const isConstellationAction =
      classified === "refocus_constellation" ||
      classified === "change_constellation_priority" ||
      operation.target.targetType === "constellation";

    const planned = isConstellationAction
      ? planConstellationAction(operation, classified, input)
      : planNodeAction(operation, classified, input, state);

    actions.push(planned.action);
    blockers.push(...planned.blockers);
    warnings.push(...planned.warnings);
  }

  resolveActionConflicts(actions, blockers, warnings);

  base.actions = actions;
  base.blockers = blockers;
  base.warnings = warnings;
  base.readyActions = getReadyEvolutionActions({ ...base, actions, blockers, warnings });
  base.blockedActions = getBlockedEvolutionActions({ ...base, actions, blockers, warnings });
  base.nodeBudgetRemaining = Math.max(
    0,
    policy.nodeBudget.maxNewNodesPerBatch - state.plannedGenerations,
  );
  base.status = derivePlanStatus(actions, blockers);
  base.summary = buildSummary(base);
  return base;
}

export function getReadyEvolutionActions(plan: WorldEvolutionPlan): WorldEvolutionAction[] {
  return plan.actions.filter((action) => action.status === "ready");
}

export function getBlockedEvolutionActions(plan: WorldEvolutionPlan): WorldEvolutionAction[] {
  return plan.actions.filter(
    (action) =>
      action.status === "blocked" ||
      action.status === "skipped" ||
      (action.status === "downgraded" && action.actionType !== "generate_node"),
  );
}

export function summarizeWorldEvolutionPlan(plan: WorldEvolutionPlan): WorldEvolutionPlanSummary {
  return {
    id: plan.id,
    status: plan.status,
    readyCount: plan.readyActions.length,
    blockedCount: plan.blockedActions.length,
    skippedCount: plan.actions.filter((a) => a.status === "skipped").length,
    blockerCount: plan.blockers.length,
    summary: plan.summary,
  };
}

export function validateWorldEvolutionPlan(
  plan: WorldEvolutionPlan,
): WorldEvolutionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan.id?.trim()) errors.push("Missing evolution plan id");
  if (!plan.applyPlanId?.trim()) errors.push("Missing applyPlanId");

  const actionIds = new Set<string>();
  const sourceIds = new Set<string>();

  for (const action of plan.actions) {
    if (actionIds.has(action.id)) errors.push(`Duplicate action id: ${action.id}`);
    actionIds.add(action.id);

    if (!action.sourceOperationId?.trim()) {
      errors.push(`Missing sourceOperationId on action ${action.id}`);
    } else {
      sourceIds.add(action.sourceOperationId);
    }
  }

  if (plan.status === "ready_for_preview" && plan.readyActions.length === 0) {
    errors.push("Status ready_for_preview requires at least one ready action");
  }

  if (plan.status === "empty" && plan.actions.length > 0) {
    errors.push("Status empty cannot have actions");
  }

  if (plan.readyActions.length + plan.blockedActions.length > plan.actions.length) {
    warnings.push("Ready/blocked action partitions overlap or exceed total actions");
  }

  if (plan.nodeBudgetRemaining < 0) {
    errors.push("nodeBudgetRemaining cannot be negative");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

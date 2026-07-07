/**
 * Ripple Effect Engine — deterministic planning helpers (Phase 4.6).
 *
 * Pure functions for constructing, validating, and summarizing RippleEffectInput
 * and RippleEffectOutput. No React, no API calls, no canvas mutation, no LLM.
 *
 * Ripple analysis produces declarative plans only — preview/apply layers come later.
 */

import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { summarizeCanonStateFromEventLog } from "@/lib/worldBrain/decisionEventLog";
import type {
  CanonStateSnapshot,
  DecisionEventLog,
  UserDecisionEvent,
} from "@/lib/worldBrain/userDecisionTypes";
import type {
  ConstellationRippleImpact,
  ConstellationRippleImpactType,
  NodeImpactSeverity,
  NodeRippleImpact,
  NodeRippleImpactType,
  RippleAffectedScope,
  RippleConfidenceScore,
  RippleEffectInput,
  RippleEffectOutput,
  RippleEvaluationMode,
  RippleImpactLevel,
  RippleOperationPriority,
  RippleOperationTarget,
  RippleOperationType,
  RipplePreservedElement,
  RippleSuggestedOperation,
  RippleUserSteering,
  RippleWarning,
  RippleWarningType,
} from "@/lib/worldBrain/rippleEffectTypes";

// ── Validation constants ──────────────────────────────────────────────────────────

export const RIPPLE_OPERATION_TYPES: readonly RippleOperationType[] = [
  "remove_node",
  "weaken_node",
  "strengthen_node",
  "modify_node",
  "replace_node",
  "generate_new_node",
  "merge_nodes",
  "split_node",
  "refocus_constellation",
  "change_constellation_priority",
  "ask_user_clarification",
  "mark_for_critic_review",
  "update_flow",
] as const;

export const RIPPLE_IMPACT_LEVELS: readonly RippleImpactLevel[] = [
  "none",
  "minor",
  "moderate",
  "major",
  "structural",
] as const;

export const RIPPLE_AFFECTED_SCOPES: readonly RippleAffectedScope[] = [
  "node",
  "sibling_nodes",
  "constellation",
  "neighboring_constellations",
  "world",
  "canon",
  "flow",
] as const;

export const NODE_RIPPLE_IMPACT_TYPES: readonly NodeRippleImpactType[] = [
  "strengthen",
  "weaken",
  "contradict",
  "duplicate",
  "obsolete",
  "require_modification",
  "inspire_new_node",
  "unaffected",
  "needs_review",
] as const;

export const CONSTELLATION_RIPPLE_IMPACT_TYPES: readonly ConstellationRippleImpactType[] = [
  "expand",
  "shrink",
  "refocus",
  "split",
  "merge",
  "reduce_priority",
  "increase_priority",
  "unaffected",
  "needs_review",
] as const;

export const RIPPLE_WARNING_TYPES: readonly RippleWarningType[] = [
  "contradiction",
  "weak_connection",
  "duplicate_idea",
  "scope_drift",
  "tone_mismatch",
  "feasibility_issue",
  "canon_conflict",
  "flow_conflict",
] as const;

const OPERATION_TYPE_SET = new Set<string>(RIPPLE_OPERATION_TYPES);
const IMPACT_LEVEL_SET = new Set<string>(RIPPLE_IMPACT_LEVELS);
const AFFECTED_SCOPE_SET = new Set<string>(RIPPLE_AFFECTED_SCOPES);
const NODE_IMPACT_TYPE_SET = new Set<string>(NODE_RIPPLE_IMPACT_TYPES);
const CONSTELLATION_IMPACT_TYPE_SET = new Set<string>(CONSTELLATION_RIPPLE_IMPACT_TYPES);
const WARNING_TYPE_SET = new Set<string>(RIPPLE_WARNING_TYPES);

const DEFAULT_EVALUATION_MODE: RippleEvaluationMode = "balanced";
const DEFAULT_FACTORY_CONFIDENCE: RippleConfidenceScore = 0.7;

/** Confidence for empty/no-op outputs: deterministic certainty that no impacts were found. */
const EMPTY_OUTPUT_CONFIDENCE: RippleConfidenceScore = 1;

// ── Result types ──────────────────────────────────────────────────────────────────

export type RippleEffectValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type RippleEffectOutputSummary = {
  triggerEventId: string;
  impactLevel: RippleImpactLevel;
  affectedScopeCount: number;
  nodeImpactCount: number;
  constellationImpactCount: number;
  canonImpactCount: number;
  operationCount: number;
  warningCount: number;
  preservedElementCount: number;
  highPriorityOperationCount: number;
  highSeverityWarningCount: number;
  confidence: RippleConfidenceScore;
};

export type BuildRippleEffectInputParams = {
  triggerEvent: UserDecisionEvent;
  decisionLog: DecisionEventLog;
  canvasModel: CanvasWorldModel;
  activeCanonState?: CanonStateSnapshot;
  affectedScopeHint?: RippleAffectedScope;
  userSteering?: RippleUserSteering;
  evaluationMode?: RippleEvaluationMode;
};

export type CreateEmptyRippleEffectOutputOptions = {
  summary?: string;
  confidence?: RippleConfidenceScore;
};

export type CreateRippleSuggestedOperationInput = {
  operationType: RippleOperationType;
  target: RippleOperationTarget;
  reason: string;
  id?: string;
  index?: number;
  priority?: RippleOperationPriority;
  requiresUserApproval?: boolean;
  payload?: Record<string, unknown>;
};

export type CreateRippleWarningInput = {
  warningType: RippleWarningType;
  message: string;
  affectedTargets: RippleOperationTarget[];
  id?: string;
  index?: number;
  severity?: NodeImpactSeverity;
  suggestedResolution?: string;
};

export type CreateNodeRippleImpactInput = {
  nodeId: string;
  impactType: NodeRippleImpactType;
  reason: string;
  constellationId?: string;
  severity?: NodeImpactSeverity;
  confidence?: RippleConfidenceScore;
  suggestedOperationIds?: string[];
  relatedTriggerAnchor?: string;
};

export type CreateConstellationRippleImpactInput = {
  constellationId: string;
  impactType: ConstellationRippleImpactType;
  reason: string;
  suggestedFocusShift?: string;
  suggestedNodeCountChange?: number;
  confidence?: RippleConfidenceScore;
};

// ── Internal helpers ──────────────────────────────────────────────────────────────

function sanitizeIdPart(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "unknown";
}

function isConfidenceInRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function targetKey(target: RippleOperationTarget): string {
  return `${target.targetType}:${target.id}`;
}

function uniquePreservedElements(
  elements: RipplePreservedElement[],
): RipplePreservedElement[] {
  const seen = new Set<string>();
  const result: RipplePreservedElement[] = [];
  for (const el of elements) {
    const key = targetKey(el);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(el);
  }
  return result;
}

// ── ID helpers ────────────────────────────────────────────────────────────────────

export function buildRippleOperationId(
  operationType: RippleOperationType,
  targetId: string,
  index = 0,
): string {
  return `ripple_op_${sanitizeIdPart(operationType)}_${sanitizeIdPart(targetId)}_${index}`;
}

export function buildRippleWarningId(
  warningType: RippleWarningType,
  targetId: string,
  index = 0,
): string {
  return `ripple_warning_${sanitizeIdPart(warningType)}_${sanitizeIdPart(targetId)}_${index}`;
}

export function buildRippleImpactId(
  impactKind: "node" | "constellation" | "canon",
  targetId: string,
  index = 0,
): string {
  return `ripple_impact_${impactKind}_${sanitizeIdPart(targetId)}_${index}`;
}

// ── Type guards ───────────────────────────────────────────────────────────────────

export function isValidRippleOperationType(value: string): value is RippleOperationType {
  return OPERATION_TYPE_SET.has(value);
}

export function isValidRippleImpactLevel(value: string): value is RippleImpactLevel {
  return IMPACT_LEVEL_SET.has(value);
}

export function isValidRippleAffectedScope(value: string): value is RippleAffectedScope {
  return AFFECTED_SCOPE_SET.has(value);
}

export function isValidNodeRippleImpactType(value: string): value is NodeRippleImpactType {
  return NODE_IMPACT_TYPE_SET.has(value);
}

export function isValidConstellationRippleImpactType(
  value: string,
): value is ConstellationRippleImpactType {
  return CONSTELLATION_IMPACT_TYPE_SET.has(value);
}

export function isValidRippleWarningType(value: string): value is RippleWarningType {
  return WARNING_TYPE_SET.has(value);
}

// ── Input builder ─────────────────────────────────────────────────────────────────

/** Assembles RippleEffectInput from canvas + decision state without mutating inputs. */
export function buildRippleEffectInput(
  params: BuildRippleEffectInputParams,
): RippleEffectInput {
  const activeCanonState =
    params.activeCanonState ?? summarizeCanonStateFromEventLog(params.decisionLog);

  return {
    triggerEvent: params.triggerEvent,
    decisionLog: {
      events: [...params.decisionLog.events],
      lastUpdatedAt: params.decisionLog.lastUpdatedAt,
    },
    canvasModel: params.canvasModel,
    activeCanonState: {
      truthNodeIds: [...activeCanonState.truthNodeIds],
      potentialNodeIds: [...activeCanonState.potentialNodeIds],
      rejectedNodeIds: [...activeCanonState.rejectedNodeIds],
      truthCount: activeCanonState.truthCount,
      potentialCount: activeCanonState.potentialCount,
      rejectedCount: activeCanonState.rejectedCount,
    },
    ...(params.affectedScopeHint !== undefined
      ? { affectedScopeHint: params.affectedScopeHint }
      : {}),
    ...(params.userSteering !== undefined ? { userSteering: params.userSteering } : {}),
    evaluationMode: params.evaluationMode ?? DEFAULT_EVALUATION_MODE,
  };
}

// ── Output factory ────────────────────────────────────────────────────────────────

/**
 * Creates a blank ripple output for a trigger event.
 * confidence defaults to 1 — deterministic certainty that no impacts were detected yet.
 */
export function createEmptyRippleEffectOutput(
  triggerEvent: UserDecisionEvent,
  options: CreateEmptyRippleEffectOutputOptions = {},
): RippleEffectOutput {
  return {
    triggerEventId: triggerEvent.id,
    summary:
      options.summary ??
      `No ripple impacts detected for decision on "${triggerEvent.target.displayTitle}".`,
    impactLevel: "none",
    affectedScopes: [],
    nodeImpacts: [],
    constellationImpacts: [],
    canonImpacts: [],
    suggestedOperations: [],
    warnings: [],
    preservedElements: [],
    followUpQuestions: [],
    confidence: options.confidence ?? EMPTY_OUTPUT_CONFIDENCE,
  };
}

// ── Object factories ──────────────────────────────────────────────────────────────

export function createRippleSuggestedOperation(
  input: CreateRippleSuggestedOperationInput,
): RippleSuggestedOperation {
  const index = input.index ?? 0;
  return {
    id:
      input.id ??
      buildRippleOperationId(input.operationType, input.target.id, index),
    operationType: input.operationType,
    target: { ...input.target },
    reason: input.reason,
    priority: input.priority ?? "medium",
    requiresUserApproval: input.requiresUserApproval ?? true,
    ...(input.payload !== undefined ? { payload: { ...input.payload } } : {}),
  };
}

export function createRippleWarning(input: CreateRippleWarningInput): RippleWarning {
  const primaryTargetId = input.affectedTargets[0]?.id ?? "unknown";
  const index = input.index ?? 0;
  return {
    id: input.id ?? buildRippleWarningId(input.warningType, primaryTargetId, index),
    warningType: input.warningType,
    message: input.message,
    severity: input.severity ?? "medium",
    affectedTargets: input.affectedTargets.map((t) => ({ ...t })),
    ...(input.suggestedResolution !== undefined
      ? { suggestedResolution: input.suggestedResolution }
      : {}),
  };
}

export function createNodeRippleImpact(
  input: CreateNodeRippleImpactInput,
): NodeRippleImpact {
  return {
    nodeId: input.nodeId,
    impactType: input.impactType,
    reason: input.reason,
    severity: input.severity ?? "medium",
    confidence: input.confidence ?? DEFAULT_FACTORY_CONFIDENCE,
    suggestedOperationIds: [...(input.suggestedOperationIds ?? [])],
    ...(input.constellationId !== undefined
      ? { constellationId: input.constellationId }
      : {}),
    ...(input.relatedTriggerAnchor !== undefined
      ? { relatedTriggerAnchor: input.relatedTriggerAnchor }
      : {}),
  };
}

export function createConstellationRippleImpact(
  input: CreateConstellationRippleImpactInput,
): ConstellationRippleImpact {
  return {
    constellationId: input.constellationId,
    impactType: input.impactType,
    reason: input.reason,
    confidence: input.confidence ?? DEFAULT_FACTORY_CONFIDENCE,
    ...(input.suggestedFocusShift !== undefined
      ? { suggestedFocusShift: input.suggestedFocusShift }
      : {}),
    ...(input.suggestedNodeCountChange !== undefined
      ? { suggestedNodeCountChange: input.suggestedNodeCountChange }
      : {}),
  };
}

// ── Canon preservation ────────────────────────────────────────────────────────────

/** Marks established truth nodes as preserved — accepted canon should not ripple away. */
export function createPreservedElementsFromCanonState(
  activeCanonState: CanonStateSnapshot,
  reason = "Established as truth — preserve unless user revises canon.",
): RipplePreservedElement[] {
  return activeCanonState.truthNodeIds.map((id) => ({
    targetType: "node" as const,
    id,
    reason,
  }));
}

// ── No-op planner ─────────────────────────────────────────────────────────────────

/**
 * Safe placeholder planner before LLM or conservative analysis exists.
 * Returns empty impact lists and preserves truth canon — does not invent impacts.
 */
export function planNoOpRippleEffect(input: RippleEffectInput): RippleEffectOutput {
  const preserved = uniquePreservedElements([
    ...createPreservedElementsFromCanonState(input.activeCanonState),
    ...(input.triggerEvent.decision === "truth"
      ? [
          {
            targetType: "node" as const,
            id: input.triggerEvent.target.id,
            reason:
              "Trigger decision established truth — preserve this node in ripple planning.",
          },
        ]
      : []),
  ]);

  return {
    ...createEmptyRippleEffectOutput(input.triggerEvent, {
      summary:
        "No ripple planning logic applied yet; truth canon elements marked for preservation.",
      confidence: EMPTY_OUTPUT_CONFIDENCE,
    }),
    preservedElements: preserved,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────────

function validateTarget(
  target: RippleOperationTarget,
  label: string,
  errors: string[],
): void {
  if (!target.targetType?.trim()) {
    errors.push(`${label}: missing targetType`);
  }
  if (!target.id?.trim()) {
    errors.push(`${label}: missing target id`);
  }
}

/** Checks referential integrity and shape constraints; does not throw. */
export function validateRippleEffectOutput(
  output: RippleEffectOutput,
): RippleEffectValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!output.triggerEventId?.trim()) {
    errors.push("Missing triggerEventId");
  }

  if (!isValidRippleImpactLevel(output.impactLevel)) {
    errors.push(`Invalid impactLevel: ${output.impactLevel}`);
  }

  if (!isConfidenceInRange(output.confidence)) {
    errors.push(`Output confidence out of range [0, 1]: ${output.confidence}`);
  }

  const operationIds = new Set<string>();
  for (const op of output.suggestedOperations) {
    if (!op.id?.trim()) {
      errors.push("Suggested operation missing id");
      continue;
    }
    if (operationIds.has(op.id)) {
      errors.push(`Duplicate suggested operation id: ${op.id}`);
    }
    operationIds.add(op.id);

    if (!isValidRippleOperationType(op.operationType)) {
      errors.push(`Invalid operationType on ${op.id}: ${op.operationType}`);
    }
    if (!op.reason?.trim()) {
      errors.push(`Suggested operation ${op.id} missing reason`);
    }
    validateTarget(op.target, `Operation ${op.id}`, errors);
  }

  const warningIds = new Set<string>();
  for (const warning of output.warnings) {
    if (!warning.id?.trim()) {
      errors.push("Warning missing id");
      continue;
    }
    if (warningIds.has(warning.id)) {
      errors.push(`Duplicate warning id: ${warning.id}`);
    }
    warningIds.add(warning.id);

    if (!isValidRippleWarningType(warning.warningType)) {
      errors.push(`Invalid warningType on ${warning.id}: ${warning.warningType}`);
    }
    if (warning.affectedTargets.length === 0) {
      warnings.push(`Warning ${warning.id} has no affectedTargets`);
    }
    warning.affectedTargets.forEach((target, i) => {
      validateTarget(target, `Warning ${warning.id} target[${i}]`, errors);
    });
  }

  for (const impact of output.nodeImpacts) {
    if (!isValidNodeRippleImpactType(impact.impactType)) {
      errors.push(`Invalid node impactType on ${impact.nodeId}: ${impact.impactType}`);
    }
    if (!isConfidenceInRange(impact.confidence)) {
      errors.push(`Node impact ${impact.nodeId} confidence out of range [0, 1]`);
    }
    for (const opId of impact.suggestedOperationIds) {
      if (!operationIds.has(opId)) {
        errors.push(
          `Node impact ${impact.nodeId} references missing operation id: ${opId}`,
        );
      }
    }
  }

  for (const impact of output.constellationImpacts) {
    if (!isValidConstellationRippleImpactType(impact.impactType)) {
      errors.push(
        `Invalid constellation impactType on ${impact.constellationId}: ${impact.impactType}`,
      );
    }
    if (!isConfidenceInRange(impact.confidence)) {
      errors.push(
        `Constellation impact ${impact.constellationId} confidence out of range [0, 1]`,
      );
    }
  }

  for (const impact of output.canonImpacts) {
    if (!isConfidenceInRange(impact.confidence)) {
      errors.push(`Canon impact confidence out of range [0, 1]`);
    }
  }

  for (const scope of output.affectedScopes) {
    if (!isValidRippleAffectedScope(scope)) {
      errors.push(`Invalid affectedScope: ${scope}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Summary ───────────────────────────────────────────────────────────────────────

export function summarizeRippleEffectOutput(
  output: RippleEffectOutput,
): RippleEffectOutputSummary {
  return {
    triggerEventId: output.triggerEventId,
    impactLevel: output.impactLevel,
    affectedScopeCount: output.affectedScopes.length,
    nodeImpactCount: output.nodeImpacts.length,
    constellationImpactCount: output.constellationImpacts.length,
    canonImpactCount: output.canonImpacts.length,
    operationCount: output.suggestedOperations.length,
    warningCount: output.warnings.length,
    preservedElementCount: output.preservedElements.length,
    highPriorityOperationCount: output.suggestedOperations.filter(
      (op) => op.priority === "high",
    ).length,
    highSeverityWarningCount: output.warnings.filter((w) => w.severity === "high")
      .length,
    confidence: output.confidence,
  };
}

/**
 * Ripple Effect Engine — Phase 4.5 type contracts.
 *
 * When a user establishes, saves, rejects, modifies, or removes a node, the rest
 * of the world should react logically. This module defines the type language for
 * ripple analysis — not the planner, LLM prompt, or canvas mutation layer.
 *
 * Consumes UserDecisionEvent timelines and CanvasWorldModel snapshots.
 * Produces suggested operations, warnings, and preserved-element markers for
 * future preview, approval, Canon Critic, and Narrative Flow integration.
 *
 * No runtime logic, API calls, persistence, or UI integration — contracts only.
 */

import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import type {
  CanonDecisionState,
  CanonStateSnapshot,
  DecisionEventLog,
  UserDecisionEvent,
} from "@/lib/worldBrain/userDecisionTypes";

// ── Confidence ────────────────────────────────────────────────────────────────────

/** Normalized confidence score in the range 0 (none) to 1 (certain). */
export type RippleConfidenceScore = number;

// ── Evaluation mode ───────────────────────────────────────────────────────────────

/**
 * How aggressively the ripple engine may propose world changes.
 * - conservative: only obvious, low-risk adjustments
 * - balanced: meaningful but controlled evolution
 * - aggressive: broader cross-constellation and canon shifts
 */
export type RippleEvaluationMode = "conservative" | "balanced" | "aggressive";

// ── Affected scope ────────────────────────────────────────────────────────────────

/** Where a decision's impact may propagate. */
export type RippleAffectedScope =
  | "node"
  | "sibling_nodes"
  | "constellation"
  | "neighboring_constellations"
  | "world"
  | "canon"
  | "flow";

// ── Impact level ──────────────────────────────────────────────────────────────────

/**
 * Overall magnitude of ripple effect for one trigger decision.
 * - none: decision is locally isolated
 * - minor: small local adjustment
 * - moderate: several nodes or one constellation
 * - major: multiple constellations or canon direction
 * - structural: world premise, rules, or flow may change
 */
export type RippleImpactLevel =
  | "none"
  | "minor"
  | "moderate"
  | "major"
  | "structural";

// ── Node impact ───────────────────────────────────────────────────────────────────

export type NodeRippleImpactType =
  | "strengthen"
  | "weaken"
  | "contradict"
  | "duplicate"
  | "obsolete"
  | "require_modification"
  | "inspire_new_node"
  | "unaffected"
  | "needs_review";

export type NodeImpactSeverity = "low" | "medium" | "high";

/** How one canvas node is affected by the latest user decision. */
export type NodeRippleImpact = {
  nodeId: string;
  constellationId?: string;
  impactType: NodeRippleImpactType;
  reason: string;
  severity: NodeImpactSeverity;
  /** 0–1 confidence that this impact assessment is warranted. */
  confidence: RippleConfidenceScore;
  /** IDs of RippleSuggestedOperation entries that would apply this impact. */
  suggestedOperationIds: string[];
  /** Optional anchor linking back to the trigger node's premise or metadata key. */
  relatedTriggerAnchor?: string;
};

// ── Constellation impact ──────────────────────────────────────────────────────────

export type ConstellationRippleImpactType =
  | "expand"
  | "shrink"
  | "refocus"
  | "split"
  | "merge"
  | "reduce_priority"
  | "increase_priority"
  | "unaffected"
  | "needs_review";

/** How an entire constellation may evolve after a user decision. */
export type ConstellationRippleImpact = {
  constellationId: string;
  impactType: ConstellationRippleImpactType;
  reason: string;
  /** Optional narrative or thematic shift the constellation should emphasize. */
  suggestedFocusShift?: string;
  /** Signed delta hint for future node generation (negative = fewer nodes). */
  suggestedNodeCountChange?: number;
  confidence: RippleConfidenceScore;
};

// ── Canon impact ──────────────────────────────────────────────────────────────────

export type CanonRippleImpactType =
  | "no_change"
  | "possible_contradiction"
  | "requires_reconciliation"
  | "strengthens_theme"
  | "weakens_theme"
  | "changes_world_rule"
  | "changes_tone"
  | "changes_flow";

/** Prepared for future Canon Critic integration. */
export type SuggestedCanonStateChange = {
  targetId: string;
  fromState?: CanonDecisionState;
  toState: CanonDecisionState;
  reason: string;
};

export type CanonRippleImpact = {
  impactType: CanonRippleImpactType;
  reason: string;
  affectedCanonIds: string[];
  suggestedCanonStateChanges: SuggestedCanonStateChange[];
  confidence: RippleConfidenceScore;
};

// ── Suggested operations (no direct mutation) ─────────────────────────────────────

export type RippleOperationType =
  | "remove_node"
  | "weaken_node"
  | "strengthen_node"
  | "modify_node"
  | "replace_node"
  | "generate_new_node"
  | "merge_nodes"
  | "split_node"
  | "refocus_constellation"
  | "change_constellation_priority"
  | "ask_user_clarification"
  | "mark_for_critic_review"
  | "update_flow";

export type RippleOperationPriority = "low" | "medium" | "high";

export type RippleOperationTargetType =
  | "node"
  | "constellation"
  | "canon_item"
  | "flow_item"
  | "world";

/** Identifies the subject of a suggested ripple operation. */
export type RippleOperationTarget = {
  targetType: RippleOperationTargetType;
  id: string;
  constellationId?: string;
  parentNodeId?: string;
};

/**
 * Declarative operation proposal — the engine suggests; it does not mutate canvas state.
 * Later phases may preview, require approval, or apply approved operations.
 */
export type RippleSuggestedOperation = {
  id: string;
  operationType: RippleOperationType;
  target: RippleOperationTarget;
  reason: string;
  priority: RippleOperationPriority;
  requiresUserApproval: boolean;
  /** Operation-specific parameters (draft titles, merge candidates, flow hints, etc.). */
  payload?: Record<string, unknown>;
};

// ── Warnings ──────────────────────────────────────────────────────────────────────

export type RippleWarningType =
  | "contradiction"
  | "weak_connection"
  | "duplicate_idea"
  | "scope_drift"
  | "tone_mismatch"
  | "feasibility_issue"
  | "canon_conflict"
  | "flow_conflict";

/** Alert surfaced to Canon Critic and future UI warning layers. */
export type RippleWarning = {
  id: string;
  warningType: RippleWarningType;
  message: string;
  severity: NodeImpactSeverity;
  affectedTargets: RippleOperationTarget[];
  suggestedResolution?: string;
};

// ── Preserved elements ────────────────────────────────────────────────────────────

/** Explicit marker: this element should not be changed by ripple application. */
export type RipplePreservedElement = {
  targetType: RippleOperationTargetType;
  id: string;
  reason: string;
};

// ── User steering (World Whisper, future) ─────────────────────────────────────────

export type RippleSteeringTargetScope =
  | "node"
  | "constellation"
  | "world"
  | "canon"
  | "flow";

export type RippleSteeringIntensity = "light" | "moderate" | "strong";

/** Optional steering context from World Whisper — interpretation not implemented yet. */
export type RippleUserSteering = {
  instruction: string;
  targetScope?: RippleSteeringTargetScope;
  intensity?: RippleSteeringIntensity;
};

// ── Engine input / output ─────────────────────────────────────────────────────────

/** Input bundle for ripple analysis (deterministic planner or LLM-backed evaluator). */
export type RippleEffectInput = {
  /** The latest user decision that caused this ripple evaluation. */
  triggerEvent: UserDecisionEvent;
  /** Full append-only timeline of prior user decisions. */
  decisionLog: DecisionEventLog;
  /** Current world/canvas model snapshot. */
  canvasModel: CanvasWorldModel;
  /** Derived canon buckets at evaluation time. */
  activeCanonState: CanonStateSnapshot;
  /** Optional hint narrowing where impact should be searched first. */
  affectedScopeHint?: RippleAffectedScope;
  /** Optional World Whisper steering — biases evaluation, not canon directly. */
  userSteering?: RippleUserSteering;
  /** How aggressively to propose changes. Defaults to balanced in future planners. */
  evaluationMode?: RippleEvaluationMode;
};

/** Full ripple analysis result for one trigger decision. */
export type RippleEffectOutput = {
  triggerEventId: string;
  summary: string;
  impactLevel: RippleImpactLevel;
  affectedScopes: RippleAffectedScope[];
  nodeImpacts: NodeRippleImpact[];
  constellationImpacts: ConstellationRippleImpact[];
  canonImpacts: CanonRippleImpact[];
  suggestedOperations: RippleSuggestedOperation[];
  warnings: RippleWarning[];
  preservedElements: RipplePreservedElement[];
  followUpQuestions: string[];
  /** Overall confidence in this ripple assessment (0–1). */
  confidence: RippleConfidenceScore;
};

// ── Prompt builder aliases (future Phase 4.x) ─────────────────────────────────────

/** Alias for LLM prompt assembly — same shape as engine input. */
export type RippleEffectPromptInput = RippleEffectInput;

/** Alias for LLM structured response parsing — same shape as engine output. */
export type RippleEffectPromptOutput = RippleEffectOutput;

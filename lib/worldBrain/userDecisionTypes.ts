/**
 * User Decision Event Layer — Phase 4 type contracts.
 *
 * Every meaningful user action (Establish as Truth, Keep as Potential, Reject, etc.)
 * should become a structured world-state event — not a transient UI click.
 *
 * These events are the atomic input for future Ripple Effects, Canon Critic,
 * Narrative Flow, and User Steering layers.
 *
 * No runtime logic, API calls, persistence, or UI integration — contracts only.
 */

import type { NodeType as ReasonerNodeType } from "@/lib/worldBrain/constellationReasonerTypes";

/** Reuse reasoner node taxonomy without colliding with Architect `NodeType`. */
export type DecisionNodeType = ReasonerNodeType;

// ── Event classification ────────────────────────────────────────────────────────

export type UserDecisionEventType =
  | "establish_truth"
  | "keep_potential"
  | "reject"
  | "revisit_decision"
  | "modify_decision"
  | "expand_node"
  | "steer_world"
  | "reorder_flow"
  | "remove_from_canon";

/** Resulting canon state after a user decision. */
export type CanonDecisionState =
  | "truth"
  | "potential"
  | "rejected"
  | "unresolved"
  | "modified"
  | "removed";

export type DecisionTargetType =
  | "node"
  | "constellation"
  | "world"
  | "flow_item"
  | "canon_item";

/** What the decision applies to. */
export type DecisionTarget = {
  targetType: DecisionTargetType;
  id: string;
  title: string;
  displayTitle: string;
  constellationId?: string;
  parentNodeId?: string;
  depthLevel?: number;
  nodeType?: DecisionNodeType;
};

export type DecisionSourceLayer =
  | "architect"
  | "constellation_reasoner"
  | "node_reasoner"
  | "user_created"
  | "imported"
  | "unknown";

/**
 * Frozen view of a node at decision time.
 * Preserves state even if the canvas changes later.
 */
export type DecisionNodeSnapshot = {
  id: string;
  title: string;
  displayTitle: string;
  description: string;
  nodeType?: DecisionNodeType;
  constellationId?: string;
  parentNodeId?: string;
  depthLevel?: number;
  sourceLayer?: DecisionSourceLayer;
  /** Layer-specific metadata (continuation scores, discovery questions, etc.). */
  metadata?: Record<string, unknown>;
};

/** Frozen local constellation context at decision time. */
export type DecisionConstellationSnapshot = {
  id: string;
  title: string;
  displayTitle: string;
  description?: string;
  role?: string;
};

export type DecisionWorldPhase =
  | "world_overview"
  | "constellation_exploration"
  | "node_expansion"
  | "canon_review"
  | "flow_building";

/** Where in the product the decision occurred. */
export type DecisionWorldContext = {
  worldPrompt?: string;
  purpose?: string;
  architectureSummary?: string;
  activeConstellationId?: string;
  activeNodeId?: string;
  currentPhase?: DecisionWorldPhase;
};

/** Lightweight pre-decision canon counts — not full Canon Memory. */
export type CanonStateSnapshot = {
  truthNodeIds: string[];
  potentialNodeIds: string[];
  rejectedNodeIds: string[];
  truthCount: number;
  potentialCount: number;
  rejectedCount: number;
};

export type DecisionEventSource =
  | "user_click"
  | "world_whisper"
  | "system_suggestion"
  | "critic_warning"
  | "flow_editor"
  | "unknown";

export type DecisionIntentScope =
  | "node"
  | "constellation"
  | "world"
  | "canon"
  | "flow";

/** Prepared for World Whisper / steering — interpretation not implemented yet. */
export type DecisionUserIntent = {
  rawText?: string;
  interpretedIntent?: string;
  confidence?: number;
  targetScope?: DecisionIntentScope;
};

/**
 * Atomic unit of user creative state transition.
 * Consumed by Ripple Effect, Canon Critic, and Flow Engine (future).
 */
export type UserDecisionEvent = {
  id: string;
  eventType: UserDecisionEventType;
  target: DecisionTarget;
  /** Resulting canon state after this decision. */
  decision: CanonDecisionState;
  nodeSnapshot: DecisionNodeSnapshot;
  constellationSnapshot?: DecisionConstellationSnapshot;
  worldContext: DecisionWorldContext;
  canonStateBefore?: CanonStateSnapshot;
  timestamp: string;
  source: DecisionEventSource;
  userIntent?: DecisionUserIntent;
  notes?: string;
};

/** Append-only timeline of user creative decisions (future persistence target). */
export type DecisionEventLog = {
  events: UserDecisionEvent[];
  lastUpdatedAt?: string;
};

/** Input for deterministic event builders (Phase 4.2). */
export type CreateUserDecisionEventInput = {
  eventType: UserDecisionEventType;
  decision: CanonDecisionState;
  target: DecisionTarget;
  nodeSnapshot: DecisionNodeSnapshot;
  constellationSnapshot?: DecisionConstellationSnapshot;
  worldContext: DecisionWorldContext;
  canonStateBefore?: CanonStateSnapshot;
  source: DecisionEventSource;
  userIntent?: DecisionUserIntent;
  notes?: string;
};

/**
 * Maps current UI discovery actions to decision event types.
 * UI today: accept → Establish as Truth, save → Keep as Potential, reject → Reject.
 */
export const UI_ACTION_TO_EVENT_TYPE = {
  accept: "establish_truth",
  save: "keep_potential",
  reject: "reject",
} as const satisfies Record<string, UserDecisionEventType>;

/**
 * Maps UI discovery decisions to canon decision states.
 * UI today: accepted → truth, saved → potential, rejected → rejected, pending → unresolved.
 */
export const UI_DECISION_TO_CANON_STATE = {
  accepted: "truth",
  saved: "potential",
  rejected: "rejected",
  pending: "unresolved",
} as const;

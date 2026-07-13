/**
 * GAME Framework — Shared Agent Type Scaffold (Phase 8A)
 *
 * Defines the structural vocabulary for all reasoning wrappers
 * as typed, observable agents under the GAME framework:
 *   G — Goals
 *   A — Actions
 *   M — Memory
 *   E — Environment
 *
 * This file is specification + type foundation only.
 * No existing agent is migrated here yet.
 * No runtime logic, LLM calls, or canvas mutation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// G — GOALS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single, narrow, testable objective for an agent run.
 * Each agent should have exactly one primary goal.
 */
export type AgentGoal = {
  /** Short machine-readable identifier, e.g. "generate_exploration_nodes" */
  id: string;
  /** Human-readable goal statement (present-tense, outcome-focused). */
  description: string;
  /**
   * Measurable success signal: what must be true in the output
   * for this goal to be considered achieved.
   */
  successCriteria: string[];
  /**
   * Hard constraints the agent must not violate even when pursuing the goal.
   * These are checked during output validation.
   */
  hardConstraints: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// A — ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** The action category: read-only analysis vs. generative vs. evaluative. */
export type AgentActionKind =
  | "read_world_state"
  | "read_canon"
  | "read_decision_log"
  | "read_constellation"
  | "read_node"
  | "generate_nodes"
  | "generate_operations"
  | "generate_constraints"
  | "evaluate_validity"
  | "evaluate_contradiction"
  | "evaluate_confidence"
  | "plan_evolution"
  | "apply_evolution"
  | "format_user_copy";

/**
 * Declares one capability an agent may exercise during a run.
 * Agents must not exercise actions that are not in their allowed list.
 */
export type AgentActionDefinition = {
  actionId: string;
  kind: AgentActionKind;
  description: string;
  /** Whether the user must explicitly approve before this action's effect is applied. */
  requiresUserApproval: boolean;
  /** If true, the action directly modifies persistent state (canvas, canon). */
  mutatableState: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// M — MEMORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Memory scope determines how broadly a packet reaches across the world.
 * Agents should only receive the narrowest scope that satisfies their goal.
 */
export type AgentMemoryScope =
  | "node"        // Single node and its immediate context
  | "constellation" // One constellation and its nodes
  | "world"       // All constellations + global world rules
  | "canon"       // Established truths only
  | "decision_log"; // Full append-only user decision timeline

/**
 * A typed memory bundle passed explicitly into an agent run.
 * Memory is never ambient — it must be constructed and passed in.
 */
export type AgentMemoryPacket = {
  scope: AgentMemoryScope;
  /** The world seed / prompt from which everything is derived. */
  worldSeed: string;
  /** User-supplied narrative purpose (optional). */
  worldPurpose: string | null;
  /**
   * Canon items accepted as truth.
   * Must be passed even if empty so agents know what is protected.
   */
  acceptedCanonIds: string[];
  acceptedCanonTitles: string[];
  /** Ids of nodes rejected by the user — agents must avoid reproducing them. */
  rejectedIds: string[];
  /** Free-form steering text entered via World Whisper, if any. */
  activeSteeringText: string | null;
  /**
   * Latest architecture summary from WorldArchitectAgent.
   * Required by Constellation, Node, and Ripple agents.
   */
  architectureSummary: string | null;
  /** Lightweight cross-constellation awareness to prevent isolated reasoning. */
  neighboringConstellationSummaries: Array<{
    id: string;
    title: string;
    role: string;
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// E — ENVIRONMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A read-only snapshot of the canvas + world state at the time of an agent run.
 * Agents must not mutate the environment — they return structured outputs instead.
 */
export type AgentEnvironmentSnapshot = {
  /** ISO-8601 timestamp of when the snapshot was captured. */
  capturedAt: string;
  /** Which canvas model version is active, for staleness detection. */
  canvasModelVersion: string | null;
  /**
   * Total node count at snapshot time.
   * Used by evolution agents to enforce node budget limits.
   */
  totalNodeCount: number;
  totalConstellationCount: number;
  /** Whether a world evolution apply is currently in progress (gate for new runs). */
  evolutionApplyInProgress: boolean;
  /** Whether canon is locked (e.g., during ripple apply). */
  canonLocked: boolean;
  /** Current UI mode — agents should not fire in overview or canon modes. */
  navMode: "overview" | "discovery" | "constellation" | "canon";
};

// ─────────────────────────────────────────────────────────────────────────────
// INPUT / OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

/** Agent identity string for logging, validation, and failure attribution. */
export type AgentId =
  | "WorldArchitectAgent"
  | "ConstellationReasonerAgent"
  | "NodeReasonerAgent"
  | "RippleConsequenceAgent"
  | "WorldEvolutionAgent"
  | "WorldWhisperAgent"
  | "CanonCriticAgent"
  | "NarrativeFlowAgent";

/**
 * The complete, typed input bundle for a single agent run.
 * Every field must be explicitly constructed by the caller.
 * No agent may read ambient state; all context flows through this struct.
 */
export type AgentRunInput<TPayload = unknown> = {
  agentId: AgentId;
  runId: string;
  /** ISO-8601 timestamp when the run was initiated. */
  startedAt: string;
  memory: AgentMemoryPacket;
  environment: AgentEnvironmentSnapshot;
  /** Agent-specific input data (e.g., selected node, trigger event). */
  payload: TPayload;
  /**
   * Max attempts before the run is abandoned and fallback copy is shown.
   * Default: 2.
   */
  maxRetries?: number;
};

/**
 * The outcome of a completed (or failed) agent run.
 * Callers must check `status` and `validation.valid` before using `output`.
 */
export type AgentRunResult<TOutput = unknown> = {
  agentId: AgentId;
  runId: string;
  status: "success" | "retry" | "failed" | "fallback";
  /**
   * The structured output, present only when status === "success"
   * and validation.valid === true.
   */
  output: TOutput | null;
  validation: AgentValidationResult;
  failure: AgentFailureMode | null;
  stopReason: AgentStopReason | null;
  /** ISO-8601 timestamp when the run completed or was abandoned. */
  completedAt: string;
  /** Attempt number that produced this result (1-based). */
  attemptNumber: number;
  /**
   * User-facing creative copy shown when the agent falls back.
   * Must be set by the agent definition — never expose raw error strings.
   */
  userFacingFallbackCopy: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export type AgentValidationSeverity = "error" | "warning" | "info";

export type AgentValidationIssue = {
  field: string;
  message: string;
  severity: AgentValidationSeverity;
};

/**
 * Result of running validation rules against a raw agent output.
 * Output must not be applied to the canvas until valid === true.
 */
export type AgentValidationResult = {
  valid: boolean;
  issues: AgentValidationIssue[];
  /** Summary message suitable for internal logging (never shown to users). */
  summary: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE
// ─────────────────────────────────────────────────────────────────────────────

export type AgentFailureCategory =
  | "invalid_input"        // Malformed or missing required input
  | "llm_error"            // Model returned no output or threw
  | "parse_error"          // Output could not be parsed to expected schema
  | "validation_error"     // Output parsed but failed validation rules
  | "canon_violation"      // Output would overwrite protected canon
  | "budget_exceeded"      // Node / constellation budget would be breached
  | "duplicate_output"     // Output is substantively identical to prior run
  | "low_confidence"       // Confidence score below minimum threshold
  | "environment_locked"   // Canvas or canon locked; run rejected
  | "timeout"              // Run exceeded allowed time budget
  | "unknown";

/**
 * Structured failure record attached to failed or retried agent runs.
 * The `userMessage` field is safe to surface; `internalDetail` is not.
 */
export type AgentFailureMode = {
  category: AgentFailureCategory;
  /** Safe, creative copy shown to the user (no technical detail). */
  userMessage: string;
  /** Internal diagnostic string — logged server-side only. */
  internalDetail: string;
  /** Whether retrying the same run is likely to produce a different result. */
  retryable: boolean;
  /** Optional recovery action the caller can take. */
  recoveryHint: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// STOP CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reason an agent run was halted before producing a valid final output.
 * Stop reasons are distinct from failure categories: a stop may be intentional
 * (e.g., nothing to do) rather than a malfunction.
 */
export type AgentStopReason =
  | "max_retries_exceeded"       // Exhausted retry budget
  | "canon_protected"            // Target is canon-locked; no change allowed
  | "budget_exhausted"           // Node or constellation limit reached
  | "no_meaningful_delta"        // Run would produce output identical to current state
  | "rejected_idea_avoided"      // Proposed output matches a previously rejected node
  | "environment_guard_tripped"  // Run blocked by environment snapshot gate
  | "user_abort"                 // User navigated away before completion
  | "validation_hard_failure"    // Output failed a non-retryable validation rule
  | "confidence_floor"           // Final confidence below absolute minimum
  | "duplicate_detected";        // Output matches a prior run's output exactly

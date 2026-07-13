# Agent Architecture — GAME Framework Specification

**Phase:** 8A — Specification + Type Foundation  
**Status:** Draft — No agents migrated yet  
**Last updated:** 2026-07-13

---

## Overview

This document defines how every reasoning wrapper in the platform maps to the **GAME** agentic framework:

| Letter | Dimension | What it defines |
|--------|-----------|-----------------|
| **G** | Goals | What the agent must achieve (narrow, testable) |
| **A** | Actions | What the agent is allowed to do (nothing outside this list) |
| **M** | Memory | What world-state context is explicitly passed in |
| **E** | Environment | Read-only world snapshot (canvas model, nav mode, locks) |

### Design principles

1. Agents never directly mutate the canvas.
2. Agents always return structured, typed outputs.
3. Every output passes validation before being used.
4. Memory is explicitly passed — no ambient state.
5. Rejected ideas are tracked and must be avoided.
6. Canon is protected — agents cannot overwrite established truth.
7. Agents have narrow, task-specific action sets.
8. Error messages include recovery instructions.
9. Internal errors are never surfaced to users.
10. Users see simple, creative fallback copy.

### Type scaffold

All shared types live in:
```
lib/worldBrain/agents/agentTypes.ts
```

Key types: `AgentGoal`, `AgentActionDefinition`, `AgentMemoryPacket`, `AgentEnvironmentSnapshot`, `AgentRunInput`, `AgentRunResult`, `AgentValidationResult`, `AgentFailureMode`, `AgentStopReason`.

---

## Agents

---

### A. WorldArchitectAgent

**Purpose:** Design the initial world workspace from the creator's seed prompt.  
**Phase:** World setup — fires once (or on re-architect).  
**Existing code:** `lib/worldBrain/architectWorld.ts`, `app/api/world/architect/route.ts`

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `design_world_structure` | Produce a complete, internally consistent world architecture from the seed | ≥3 constellations, each with a distinct thematic role; no duplicate constellation titles; every constellation has ≥1 agent and ≥1 critic |
| `preserve_world_seed_fidelity` | Output themes, tone, and tension must derive from the seed prompt | Architecture summary references specific seed language; no generic placeholder themes |

**Hard constraints:**
- Must not generate content contradicting the creator's explicit seed intent.
- Must not produce fewer than 2 or more than 8 constellations in a single run.
- Must not reuse node IDs from any prior architecture run.

#### A — Actions

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_world_seed` | `read_world_state` | No | No |
| `decompose_seed_into_themes` | `evaluate_validity` | No | No |
| `generate_constellation_definitions` | `generate_nodes` | No | No |
| `assign_agents_and_critics` | `generate_nodes` | No | No |
| `generate_architecture_summary` | `format_user_copy` | No | No |

**Forbidden actions:**
- May not read or modify existing canon.
- May not generate exploration nodes (that is ConstellationReasonerAgent's role).
- May not apply any canvas patch.

#### M — Memory

```
worldSeed: string                  (required)
worldPurpose: string | null        (optional creator note)
acceptedCanonIds: []               (empty at world setup; guard for re-architect)
rejectedIds: []                    (empty at world setup)
activeSteeringText: null
architectureSummary: null          (this agent produces the summary)
neighboringConstellationSummaries: [] (not yet available)
```

#### E — Environment

```
navMode: "overview"                (only fires from overview)
evolutionApplyInProgress: false    (must be false to fire)
canonLocked: false                 (must be false)
totalNodeCount: 0                  (expected at world setup)
```

#### Input contract

```ts
// payload shape
{
  decomposition: WorldPromptDecomposition;   // from decomposeWorldPrompt()
}
```

#### Output contract

```ts
// Maps to existing CanvasWorldModel from mapArchitectureToCanvas.ts
{
  worldSeed: string;
  architectureSummary: string;
  constellations: CanvasConstellation[];
  nodes: CanvasNode[];
  agents: CanvasAgent[];
  criticAgents: CanvasCriticAgent[];
  controlRules: ArchitectureControlRules;
}
```

#### Validation rules

1. `constellations.length` must be between 2 and 8.
2. Every constellation must have a non-empty `id`, `title`, and `description`.
3. No two constellations may share the same `id` or the same `title`.
4. Every constellation must reference ≥1 valid agent.
5. `architectureSummary` must be ≥100 characters.
6. No node or constellation ID may contain whitespace.

#### Retry rules

- Max 2 retries.
- Retry if: output JSON is malformed, constellation count is out of range, or validation rule 1–4 fails.
- Do not retry if: seed prompt is empty (invalid input — fail immediately).

#### User-facing fallback copy

> "We had trouble designing your world. Try describing the seed with a bit more detail — themes, tensions, or a single location work well."

---

### B. ConstellationReasonerAgent

**Purpose:** Generate locally coherent exploration nodes for one selected constellation.  
**Phase:** Fires when the user enters a constellation view.  
**Existing code:** `lib/worldBrain/reasonConstellation.ts`, `lib/worldBrain/constellationReasonerTypes.ts`, `app/api/world/constellation-reasoner/route.ts`

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `generate_local_nodes` | Produce 4–7 starting nodes specific to the selected constellation | Each node has distinct `id`, `title`, `description`, `nodeType`, `discoveryQuestion`; no duplicates with sibling constellations |
| `preserve_cross_constellation_coherence` | Nodes must not contradict or replicate themes from neighboring constellations | `avoidPatterns` list populated; node tags avoid synonyms of neighbor titles |

**Hard constraints:**
- Must not generate nodes that duplicate any accepted canon item's `title`.
- Must not reference rejected IDs in output nodes.
- Must stay within the selected constellation's `expansionRules`.

#### A — Actions

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_constellation_context` | `read_constellation` | No | No |
| `read_neighboring_summaries` | `read_constellation` | No | No |
| `read_existing_canon` | `read_canon` | No | No |
| `generate_exploration_axes` | `generate_nodes` | No | No |
| `generate_starting_nodes` | `generate_nodes` | No | No |
| `generate_avoidance_patterns` | `generate_constraints` | No | No |

**Forbidden actions:**
- May not modify or remove existing canvas nodes.
- May not generate nodes for a constellation other than the selected one.
- May not produce nodes that establish or change canon state.

#### M — Memory

```
worldSeed: string                  (required)
worldPurpose: string | null
acceptedCanonIds: string[]         (must filter out from new node candidates)
acceptedCanonTitles: string[]      (title-level dedup check)
rejectedIds: string[]              (must not reappear)
activeSteeringText: string | null  (if set, bias node themes toward steering)
architectureSummary: string        (required — grounds local reasoning)
neighboringConstellationSummaries: [{ id, title, role }]
```

#### E — Environment

```
navMode: "discovery"               (must be discovery mode)
evolutionApplyInProgress: false
canonLocked: false
```

#### Input contract

```ts
{
  selectedConstellation: SelectedConstellation;
  neighboringConstellations: NeighboringConstellation[];
  existingCanon?: LightweightCanonItem[];
  userSteering?: UserSteeringInstruction;
}
```

#### Output contract

```ts
// ConstellationReasonerOutput from constellationReasonerTypes.ts
{
  constellationId: string;
  localSummary: string;
  explorationAxes: ExplorationAxis[];
  startingNodes: ReasonedStartingNode[];   // 4–7 items
  suggestedConnections: SuggestedNodeConnection[];
  expansionRules: string[];
  avoidPatterns: string[];
}
```

#### Validation rules

1. `startingNodes.length` must be between 4 and 7.
2. Every node must have non-empty `id`, `title`, `displayTitle`, `description`, `discoveryQuestion`.
3. No node `id` or `title` may match an `acceptedCanonId` / `acceptedCanonTitle`.
4. No node `id` may appear in `rejectedIds`.
5. `noveltyScore` and `relevanceScore` must be between 0.0 and 1.0.
6. `localSummary` must be ≥80 characters.

#### Retry rules

- Max 2 retries.
- Retry if: output JSON is malformed, node count out of range, or validation rules 2–4 fail.
- On retry: include prior `avoidPatterns` in the new prompt to reduce repetition.

#### User-facing fallback copy

> "We couldn't map this space right now. Try selecting a different area, or nudge the world with the Steer bar."

---

### C. NodeReasonerAgent

**Purpose:** Generate context-preserving child nodes anchored to a selected parent node.  
**Phase:** Fires when the user clicks "Explore Deeper" on a node.  
**Existing code:** `lib/worldBrain/reasonNode.ts`, `lib/worldBrain/nodeReasonerTypes.ts`, `app/api/world/node-reasoner/route.ts`

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `generate_anchored_continuations` | Every output node must directly follow from the selected node's context | Each node has `continuationAnchor` ≠ empty; `continuityScore` ≥ 6.0/10; `driftRisk` ≠ "high" on recommended nodes |
| `avoid_scope_drift` | Continuations must not drift to unrelated constellation themes | `avoidPatterns` populated; no node with `continuationDistance === "far"` is marked `recommended: true` |

**Hard constraints:**
- Must not generate continuations for any node other than `selectedNode`.
- All output nodes must have `parentNodeId === selectedNode.id`.
- Must not reproduce any ID in `rejectedIds`.
- Nodes with `continuityScore < 5` must not be marked `recommended`.

#### A — Actions

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_parent_node_context` | `read_node` | No | No |
| `read_sibling_nodes` | `read_constellation` | No | No |
| `read_depth_context` | `read_node` | No | No |
| `read_existing_canon` | `read_canon` | No | No |
| `evaluate_continuation_scope` | `evaluate_validity` | No | No |
| `generate_expansion_branches` | `generate_nodes` | No | No |
| `generate_possible_new_nodes` | `generate_nodes` | No | No |
| `generate_continuity_scores` | `evaluate_confidence` | No | No |
| `flag_drift_risks` | `evaluate_validity` | No | No |

**Forbidden actions:**
- May not modify the parent node.
- May not generate nodes for a sibling node (not selected as parent).
- May not produce nodes anchored to a different constellation.

#### M — Memory

```
worldSeed: string
worldPurpose: string | null
acceptedCanonIds: string[]
acceptedCanonTitles: string[]
rejectedIds: string[]
activeSteeringText: string | null
architectureSummary: string
neighboringConstellationSummaries: [{ id, title, role }]
```

Also passed (not in base memory packet — payload-level):
```
selectedNode: SelectedReasoningNode
siblingNodes: SiblingReasoningNode[]
parentTrail: NodeTrailItem[]        (depth path from constellation root to parent)
depthContext: NodeDepthContext
```

#### E — Environment

```
navMode: "discovery"
evolutionApplyInProgress: false
canonLocked: false
```

#### Input contract

```ts
// NodeReasonerInput from nodeReasonerTypes.ts
{
  worldPrompt: string;
  purpose: string;
  architectureSummary: string;
  selectedConstellation: NodeReasonerSelectedConstellation;
  selectedNode: SelectedReasoningNode;
  siblingNodes: SiblingReasoningNode[];
  neighboringConstellations: NeighboringConstellation[];
  existingCanon?: LightweightCanonItem[];
  userSteering?: NodeReasonerUserSteering;
  depthContext?: NodeDepthContext;
}
```

#### Output contract

```ts
// NodeReasonerOutput from nodeReasonerTypes.ts
{
  sourceNodeId: string;
  sourceConstellationId: string;
  nodeSummary: string;
  continuationPrinciple: string;
  explorationScope: NodeExplorationScope;
  suggestedDepth: number;
  expansionBranches: NodeExpansionBranch[];
  possibleNewNodes: PossibleNewNode[];     // ≥3, ≤8
  possibleChoices: NodeChoice[];
  consequences: NodeConsequence[];
  relationshipSuggestions: NodeRelationshipSuggestion[];
  avoidPatterns: string[];
}
```

#### Validation rules

1. `possibleNewNodes.length` must be between 3 and 8.
2. Every node must have `parentNodeId === sourceNodeId`.
3. Every node must have non-empty `continuationAnchor` and `whyThisFollows`.
4. `continuityScore` must be in range 1–10.
5. No node `id` may appear in `rejectedIds`.
6. Nodes with `driftRisk === "high"` must not have `recommended: true` in their branch entry.
7. `nodeSummary` and `continuationPrinciple` must each be ≥60 characters.

#### Retry rules

- Max 2 retries.
- Retry if: JSON malformed, node count out of range, or validation rules 2–6 fail.
- On retry: prepend the prior `avoidPatterns` and raise the `continuityScore` floor instruction.
- Do not retry if: parent node is missing from memory (invalid input).

#### Quality guard

The existing `reasoningQualityGuard.ts` shallow-description filter runs **after** output parsing and **before** validation. Any node description matching a shallow-pattern is re-enriched or dropped, not retried wholesale.

#### User-facing fallback copy

> "This thread is hard to unfold right now. Try exploring a neighboring node, or use the Steer bar to give this path a nudge."

---

### D. RippleConsequenceAgent

**Purpose:** Determine what logically changes across the world when the user establishes a node as canon.  
**Phase:** Fires after a user "Establish as Truth" decision.  
**Existing code:** `lib/worldBrain/reasonRippleEffect.ts`, `lib/worldBrain/rippleEffectTypes.ts`, `lib/worldBrain/rippleEffectPrompt.ts`, `app/api/world/ripple-effect/route.ts`

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `assess_world_impact` | Determine which nodes and constellations are meaningfully affected by the accepted node | `nodeImpacts` covers ≥1 non-trivial impact; `confidence` ≥ 0.5 |
| `propose_operations_only` | Produce declarative operations (no direct mutations) | All `suggestedOperations` have `requiresUserApproval` set correctly; none apply changes themselves |
| `protect_existing_canon` | Canon items must not be suggested for removal or contradicted | `canonImpact.impactType !== "requires_reconciliation"` unless confidence ≥ 0.8 |

**Hard constraints:**
- Must never directly modify the canvas or canon state.
- Must not propose `remove_node` for any accepted canon node.
- Must set `requiresUserApproval: true` on all `high`-priority operations.
- Must include `preservedElements` for all accepted canon items in scope.

#### A — Actions

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_trigger_event` | `read_decision_log` | No | No |
| `read_decision_log` | `read_decision_log` | No | No |
| `read_canvas_model` | `read_world_state` | No | No |
| `read_canon_state` | `read_canon` | No | No |
| `evaluate_node_impacts` | `evaluate_validity` | No | No |
| `evaluate_constellation_impacts` | `evaluate_validity` | No | No |
| `evaluate_canon_impacts` | `evaluate_contradiction` | No | No |
| `evaluate_confidence_scores` | `evaluate_confidence` | No | No |
| `generate_suggested_operations` | `generate_operations` | No | No |
| `generate_warnings` | `evaluate_validity` | No | No |
| `mark_preserved_elements` | `evaluate_validity` | No | No |

**Forbidden actions:**
- May not generate new exploration nodes (that is NodeReasonerAgent's role).
- May not apply canvas patches.
- May not modify or remove canon items directly.
- May not fire during a `WorldEvolutionAgent` apply sequence.

#### M — Memory

```
worldSeed: string
worldPurpose: string | null
acceptedCanonIds: string[]         (all previously accepted — must be protected)
acceptedCanonTitles: string[]
rejectedIds: string[]
activeSteeringText: string | null
architectureSummary: string
neighboringConstellationSummaries: [{ id, title, role }]
```

#### E — Environment

```
navMode: "discovery"
evolutionApplyInProgress: false    (must be false — no concurrent apply)
canonLocked: false
```

#### Input contract

```ts
// RippleEffectInput from rippleEffectTypes.ts
{
  triggerEvent: UserDecisionEvent;
  decisionLog: DecisionEventLog;
  canvasModel: CanvasWorldModel;
  activeCanonState: CanonStateSnapshot;
  affectedScopeHint?: RippleAffectedScope;
  userSteering?: RippleUserSteering;
  evaluationMode?: RippleEvaluationMode;  // default: "balanced"
}
```

#### Output contract

```ts
// RippleEffectOutput from rippleEffectTypes.ts
{
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
  confidence: RippleConfidenceScore;       // 0–1
}
```

#### Validation rules

1. `triggerEventId` must match `triggerEvent.id` from input.
2. `confidence` must be in range 0.0–1.0.
3. Every `suggestedOperation` must have a non-empty `reason` and valid `target.id`.
4. No `suggestedOperation` of type `remove_node` may target an accepted canon node.
5. All `high`-priority operations must have `requiresUserApproval: true`.
6. Every accepted canon ID in scope must appear in `preservedElements`.
7. `summary` must be ≥50 characters.

#### Retry rules

- Max 2 retries (1 LLM re-call if JSON malformed or confidence < 0.35).
- The deterministic planner (`buildRippleEffectPlan.ts`) fires first; LLM layer is additive.
- Do not retry if: trigger event is missing required fields (fail immediately with invalid input).

#### User-facing fallback copy

> "We couldn't map how this truth ripples yet. The world will continue — you can review connections later from the Canon view."

---

### E. WorldEvolutionAgent

**Purpose:** Convert an approved ripple apply plan into safe, guarded canvas mutations.  
**Phase:** Fires after the user approves a ripple preview in the WorldChangeCard.  
**Existing code:** `lib/worldBrain/worldEvolutionPlan.ts`, `lib/worldBrain/worldEvolutionApply.ts`, `lib/worldBrain/worldEvolutionApplyDryRun.ts`

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `apply_approved_operations` | Apply only pre-approved, dry-run-validated canvas patches | All applied patches pass `validatePatchCandidate()`; no unapproved operation is applied |
| `preserve_canon_and_budget` | Do not breach node budget or overwrite accepted canon | `totalNodeCount` after apply ≤ policy limit; no accepted canon node is removed |
| `produce_evolution_overlay` | Return an immutable `EvolutionAwareCanvasModel` overlay | Overlay contains `archivedNodeIds`, `weakenedNodeIds`, `strengthenedNodeIds` |

**Hard constraints:**
- Must run dry-run validation (`worldEvolutionApplyDryRun.ts`) before any apply.
- Must not apply more than `DEFAULT_EVOLUTION_POLICY.nodeBudget.maxNewNodesPerBatch` new nodes per run.
- Must not apply operations that target accepted canon nodes as `remove_node`.
- Must not fire while `evolutionApplyInProgress === true`.
- New constellation creation is blocked (`maxNewConstellationsPerBatch: 0`) unless policy is explicitly overridden.

#### A — Actions

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_apply_plan` | `read_world_state` | No | No |
| `read_canon_state` | `read_canon` | No | No |
| `read_canvas_model` | `read_world_state` | No | No |
| `run_dry_run_validation` | `evaluate_validity` | No | No |
| `apply_node_patch` | `apply_evolution` | **Yes (pre-approved)** | **Yes** |
| `apply_constellation_patch` | `apply_evolution` | **Yes (pre-approved)** | **Yes** |
| `generate_evolution_overlay` | `plan_evolution` | No | No |
| `generate_evolution_summary` | `format_user_copy` | No | No |

**Forbidden actions:**
- May not generate new exploration nodes or constellation nodes via LLM in this agent (no generation step).
- May not apply unapproved operations (operations not in the approved apply plan).
- May not fire concurrently with another WorldEvolutionAgent run.

#### M — Memory

```
worldSeed: string
worldPurpose: string | null
acceptedCanonIds: string[]         (hard guard — no removal allowed)
rejectedIds: string[]
activeSteeringText: null           (steering is upstream, not here)
architectureSummary: string
neighboringConstellationSummaries: []
```

#### E — Environment

```
evolutionApplyInProgress: false    (gate — must be false before run begins)
canonLocked: false                 (must be false)
navMode: "discovery"
totalNodeCount: number             (checked against policy cap)
totalConstellationCount: number
```

#### Input contract

```ts
{
  applyPlan: RippleApplyPlan;         // Pre-approved, from ripple preview approval
  canvasModel: CanvasWorldModel;
  canonState: CanonStateSnapshot;
  policy?: EvolutionPolicy;           // Defaults to DEFAULT_EVOLUTION_POLICY
}
```

#### Output contract

```ts
{
  evolutionModel: EvolutionAwareCanvasModel;
  appliedOperationIds: string[];
  skippedOperationIds: string[];
  blockers: EvolutionBlocker[];
  warnings: EvolutionWarning[];
  status: WorldEvolutionPlanStatus;
  fingerprint: string;               // Canvas evolution fingerprint for staleness checks
}
```

#### Validation rules

1. `applyPlan.status` must be `"ready"` before any patch is applied.
2. Every applied operation must pass `validatePatchCandidate()` returning `valid: true`.
3. Post-apply `totalNodeCount` must not exceed `nodeBudget.maxNodesPerConstellation` per constellation.
4. No applied `remove_node` operation may target an accepted canon ID.
5. Applied operations must match the pre-approved `applyPlan.operations` list exactly (no additions at runtime).

#### Retry rules

- No LLM retries — this agent is deterministic.
- If a patch fails `validatePatchCandidate()`, that operation is skipped and added to `skippedOperationIds`.
- Overall run does not retry; partial applies are acceptable.

#### User-facing fallback copy

> "We couldn't update the world map safely right now. Your truth has been recorded — the world will evolve on the next session."

---

### F. WorldWhisperAgent

**Purpose:** Convert natural language creator steering into structured creative constraints that bias downstream agents.  
**Phase:** Fires when the user submits text via the World Whisper steer bar.  
**Existing code:** `components/WorldWhisper.tsx` (UI), `app/api/agents/adapt/route.ts` (steering adaptation)

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `parse_steering_intent` | Map free-form text to a structured steering object with a clear mode and intensity | Output has non-empty `mode`, `intensity`, and `parsedConstraint`; confidence ≥ 0.6 |
| `preserve_creator_voice` | Steering must not override established canon | `conflictsWithCanon: false` or warnings emitted if potential conflict detected |

**Hard constraints:**
- Must not establish new canon (that is the user's explicit action, not a steering event).
- Must not modify existing nodes directly — output is a constraint bundle, not a patch.
- Must not interpret ambiguous or empty input as a strong constraint.

#### A — Actions

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_steering_text` | `read_world_state` | No | No |
| `read_existing_canon` | `read_canon` | No | No |
| `evaluate_steering_intent` | `evaluate_validity` | No | No |
| `detect_canon_conflict` | `evaluate_contradiction` | No | No |
| `generate_structured_constraint` | `generate_constraints` | No | No |
| `format_constraint_summary` | `format_user_copy` | No | No |

**Forbidden actions:**
- May not add nodes to the canvas.
- May not change any node's canon state.
- May not produce constraints that silence or override user's prior accepted canon.

#### M — Memory

```
worldSeed: string
worldPurpose: string | null
acceptedCanonIds: string[]
acceptedCanonTitles: string[]
rejectedIds: string[]
activeSteeringText: string         (the raw text being processed)
architectureSummary: string | null
neighboringConstellationSummaries: []
```

#### E — Environment

```
navMode: "discovery" | "overview"  (fires in both)
evolutionApplyInProgress: false
canonLocked: false
```

#### Input contract

```ts
{
  rawSteeringText: string;               // From World Whisper input
  selectedNodeId: string | null;         // If a node is selected — narrows scope
  selectedConstellationId: string | null;
  existingCanon: LightweightCanonItem[];
}
```

#### Output contract

```ts
{
  parsedConstraint: string;              // Clean, terse constraint phrase
  mode: UserSteeringMode;               // From constellationReasonerTypes.ts
  intensity: "light" | "moderate" | "strong";
  targetScope: "node" | "constellation" | "world";
  conflictsWithCanon: boolean;
  conflictWarning: string | null;        // If conflict detected, safe description
  confidence: number;                    // 0–1
}
```

#### Validation rules

1. `parsedConstraint` must be non-empty and ≤200 characters.
2. `confidence` must be in range 0.0–1.0.
3. If `conflictsWithCanon: true`, `conflictWarning` must be non-empty.
4. `rawSteeringText` must be ≥3 characters (minimum meaningful input).

#### Retry rules

- Max 1 retry (steering is low-stakes; fallback to raw text passthrough is acceptable).
- On failure: pass `rawSteeringText` through directly as a free-form note to downstream agents.

#### User-facing fallback copy

> "Noted. We'll factor that in as we shape the next paths."

---

### G. Future — CanonCriticAgent

**Purpose:** Detect logical contradictions among accepted canon items and suggest reconciliation strategies.  
**Phase:** Future — not yet implemented.  
**Planned trigger:** After multiple "Establish as Truth" decisions, or on entering the Canon view.

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `detect_contradictions` | Find pairs of canon items that logically contradict each other | Every contradiction has `severity`, `reason`, and ≥1 `reconciliationOption` |
| `protect_user_intent` | Never silently remove or modify canon — only surface contradictions | All suggestions are `requiresUserDecision: true` |

#### A — Actions (planned)

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_all_canon_items` | `read_canon` | No | No |
| `evaluate_pairwise_coherence` | `evaluate_contradiction` | No | No |
| `generate_reconciliation_options` | `generate_operations` | No | No |
| `rank_contradictions_by_severity` | `evaluate_confidence` | No | No |

**Forbidden actions:**
- May not modify or remove any canon item directly.
- May not resolve contradictions without explicit user decision.

#### M — Memory (planned)

```
worldSeed: string
worldPurpose: string | null
acceptedCanonIds: string[]
acceptedCanonTitles: string[]
rejectedIds: string[]
activeSteeringText: null
architectureSummary: string
```

#### Input contract (planned)

```ts
{
  canonItems: LightweightCanonItem[];
  decisionLog: DecisionEventLog;
}
```

#### Output contract (planned)

```ts
{
  contradictions: Array<{
    id: string;
    canonItemAId: string;
    canonItemBId: string;
    contradictionType: "logical" | "tonal" | "causal" | "temporal";
    reason: string;
    severity: "low" | "medium" | "high";
    requiresUserDecision: true;
    reconciliationOptions: Array<{
      description: string;
      suggestedAction: string;
    }>;
  }>;
  overallConsistencyScore: number;   // 0–1
  warnings: string[];
}
```

#### Validation rules (planned)

1. Every contradiction must reference valid canon IDs from input.
2. `reconciliationOptions` must be non-empty for all `severity === "high"` contradictions.
3. `requiresUserDecision` must always be `true`.

#### Retry rules (planned)

- Max 2 retries.
- Do not retry if canon list is empty.

#### User-facing fallback copy

> "Your world is growing complex — we'll help you review tensions between truths when you're ready."

---

### H. Future — NarrativeFlowAgent

**Purpose:** Arrange accepted canon items into a coherent story or world progression sequence.  
**Phase:** Future — not yet implemented.  
**Planned trigger:** User enters Canon view and requests "Build World" / Narrative Flow.

#### G — Goals

| ID | Description | Success criteria |
|----|-------------|-----------------|
| `sequence_canon_into_flow` | Arrange accepted canon into a causal / thematic progression | Output has a non-empty `flowItems` list ordered by `position`; every accepted canon item appears |
| `surface_gaps_and_missing_bridges` | Identify missing narrative transitions between canon items | `suggestedBridges` populated for any two adjacent flow items with low `transitionConfidence` |

#### A — Actions (planned)

| Action ID | Kind | Approval needed | Mutates state |
|-----------|------|-----------------|---------------|
| `read_all_canon_items` | `read_canon` | No | No |
| `read_decision_log` | `read_decision_log` | No | No |
| `evaluate_causal_order` | `evaluate_validity` | No | No |
| `generate_flow_sequence` | `generate_operations` | No | No |
| `generate_bridge_suggestions` | `generate_nodes` | No | No |
| `format_narrative_summary` | `format_user_copy` | No | No |

**Forbidden actions:**
- May not remove accepted canon items from the flow — may only reorder.
- May not establish new canon from bridge suggestions.

#### M — Memory (planned)

```
worldSeed: string
worldPurpose: string | null
acceptedCanonIds: string[]
acceptedCanonTitles: string[]
rejectedIds: string[]
architectureSummary: string
activeSteeringText: string | null
```

#### Input contract (planned)

```ts
{
  acceptedCanonItems: LightweightCanonItem[];
  decisionLog: DecisionEventLog;
  userSteering?: { flowStyle: "chronological" | "thematic" | "causal" };
}
```

#### Output contract (planned)

```ts
{
  flowItems: Array<{
    position: number;
    canonItemId: string;
    canonItemTitle: string;
    narrativeRole: string;
    transitionFromPrior: string;
    transitionConfidence: number;   // 0–1
  }>;
  suggestedBridges: Array<{
    afterPosition: number;
    suggestion: string;
    urgency: "low" | "medium" | "high";
  }>;
  flowSummary: string;
}
```

#### Validation rules (planned)

1. Every accepted canon ID must appear exactly once in `flowItems`.
2. `position` values must be unique and contiguous (1, 2, 3…).
3. `transitionConfidence` must be in range 0.0–1.0.
4. `flowSummary` must be ≥80 characters.

#### Retry rules (planned)

- Max 2 retries.
- Do not retry if no canon items exist.

#### User-facing fallback copy

> "We couldn't sequence the world yet. As you establish more truths, the narrative will start to take shape."

---

## Cross-agent data flow

```
Creator enters world seed
        │
        ▼
WorldArchitectAgent ──────────────────► CanvasWorldModel + architectureSummary
        │
        ▼
ConstellationReasonerAgent (per constellation) ──► startingNodes → canvas orbit
        │
        ▼
NodeReasonerAgent (per selected node) ──────────► possibleNewNodes → moon orbit
        │
        ▼
[User: Establish as Truth]
        │
        ▼
RippleConsequenceAgent ──────────────────────────► suggestedOperations + warnings
        │
        ▼
[User: Approve WorldChangeCard]
        │
        ▼
WorldEvolutionAgent ─────────────────────────────► EvolutionAwareCanvasModel
        │
        ▼
[Future] CanonCriticAgent ───────────────────────► contradictions + reconciliations
        │
        ▼
[Future] NarrativeFlowAgent ─────────────────────► flowItems + suggestedBridges

WorldWhisperAgent ─── fires at any point ──────────► structured constraint (biases all downstream agents)
```

---

## Shared validation checklist (all agents)

Before any agent output reaches the canvas or UI:

- [ ] Output JSON is parseable and matches expected schema shape.
- [ ] No output field references a `rejectedId`.
- [ ] No output field modifies or targets an accepted canon item for removal.
- [ ] Confidence / score fields are within declared ranges.
- [ ] Required non-empty strings are non-empty.
- [ ] `userFacingFallbackCopy` is set in the run result.
- [ ] `AgentRunResult.status` is checked before output is used.

---

## Memory packet construction guide

Memory packets must be assembled by the calling layer (typically `ConstellationCanvas.tsx` or a route handler), not by the agent itself:

```ts
const memory: AgentMemoryPacket = {
  scope: "constellation",            // narrowest scope that covers the goal
  worldSeed: worldSeed,
  worldPurpose: worldPurpose ?? null,
  acceptedCanonIds: acceptedIds,
  acceptedCanonTitles: acceptedIds.map(getDisplayTitle),
  rejectedIds: [...rejectedIds],
  activeSteeringText: latestWhisperText ?? null,
  architectureSummary: architectureCanvasModel?.summary ?? null,
  neighboringConstellationSummaries: otherConstellations.map(c => ({
    id: c.id,
    title: c.title,
    role: c.role,
  })),
};
```

---

## Recommended Phase 8B — implementation priorities

1. **Migrate NodeReasonerAgent to GAME contracts** — adds explicit memory packet construction, quality guard integration as post-parse step (not retry), and `AgentRunResult` wrapper. Highest impact on output drift quality.
2. **Migrate RippleConsequenceAgent to GAME contracts** — adds `preservedElements` enforcement and confidence-floor stop condition to the existing route.
3. **Add `AgentRunResult` wrapper to all existing routes** — standardizes success/failure responses so the UI can show `userFacingFallbackCopy` uniformly instead of ad-hoc error strings.
4. **Implement WorldWhisperAgent output contract** — currently steering text is passed raw; parsing it into `parsedConstraint + mode + intensity` enables ConstellationReasoner and NodeReasoner to consume it structurally.
5. **Prototype CanonCriticAgent** — fires passively after 3+ accepted canon items; no UI required in Phase 8B, only a console / internal report.

---

*End of Phase 8A specification.*

# World Evolution Engine — Specification (Phase 5.0)

Last updated: July 2026  
Status: **Design only** — no implementation in this phase.

---

## Purpose

The **World Evolution Engine** is the layer that converts **approved ripple operations** and **accumulated canon decisions** into **coherent, explainable updates** to the world canvas.

It is **not** an LLM that freely edits the graph. It is a **governed mutation layer** that executes only what the user has already approved through the ripple preview chain.

### Critical product warning

> **Do not let World Evolution become “LLM randomly edits the canvas.”**

Every canvas change must follow this chain:

```
approved operations
  → safe evolution plan
  → preview
  → user approval
  → guarded mutation
  → explainable history
```

If any step is skipped, the product loses trust.

---

## Responsibility

The World Evolution Engine:

1. **Accepts** a validated `RippleApplyPlan` (status `ready_to_apply`) plus current canvas/canon context.
2. **Translates** approved operations into a deterministic **Evolution Plan** — ordered, scoped, bounded mutations.
3. **Previews** planned mutations before any write (Phase 5.x UI).
4. **Applies** mutations only after explicit user confirmation on the evolution preview.
5. **Records** an explainable history entry for every applied change (reversibility / audit).
6. **Respects** stop conditions, propagation limits, node-count caps, and conflict rules.

The World Evolution Engine **does not**:

- Propose new ripple operations (Ripple Effect Engine).
- Call Gemini/OpenRouter to invent mutations.
- Apply changes from unapproved or blocked operations.
- Override user canon decisions retroactively without a logged reversal event.

---

## Position in the intelligence stack

```
User Prompt
  → World Architect
  → Bridge → CanvasWorldModel
  → Constellation Reasoner / Node Reasoner (exploration)
  → User explores canvas, makes canon decisions
  → UserDecisionEvent log
  → Ripple Effect Engine (LLM analysis — proposals only)
  → RipplePreviewModel + UI review
  → RippleApplyPlan (approved ops + blockers)
  → World Evolution Engine (THIS SPEC)
  → Evolution Plan preview
  → User confirms apply
  → Guarded canvas mutation + history
  → [future] Canon Critic, Narrative Flow
```

| Layer | Role | Mutates canvas? |
|-------|------|-----------------|
| Architect | Designs workspace | Seeds initial model |
| Constellation / Node Reasoner | Generates exploration candidates | Adds reasoned nodes (exploration path) |
| User canon actions | Establish / Potential / Reject | Updates canon state only |
| Ripple Effect | Analyzes decision impact | **No** |
| Ripple Preview | Human review of proposals | **No** |
| Ripple Apply Plan | Filters to approved ops | **No** |
| **World Evolution** | Executes approved plan safely | **Yes** (guarded) |
| Canon Critic (future) | Audits canon coherence | Advisory |
| Narrative Flow (future) | Orders story beats | Advisory / flow graph |

---

## Ripple vs World Evolution

| Concern | Ripple Effect / Preview / Apply Plan | World Evolution Engine |
|---------|--------------------------------------|-------------------------|
| **Question answered** | “What *might* change because of this decision?” | “How do we *safely* change the canvas for approved ops?” |
| **LLM involvement** | Yes (ripple analysis) | **No** for mutation logic; deterministic planners only |
| **User approval** | Per-operation approve/reject/clarify in preview | Final confirm on evolution preview before write |
| **Output** | Suggestions, warnings, apply plan | Canvas diffs, history records |
| **Failure mode** | Non-blocking preview error | Must fail closed; no partial mystery mutations |

**Ripple** = creative intelligence proposing a plan.  
**World Evolution** = engineering discipline executing a plan.

---

## Conceptual inputs

| Input | Description |
|-------|-------------|
| `RippleApplyPlan` | Approved operations, blockers resolved, status `ready_to_apply` |
| `CanvasWorldModel` | Current nodes, constellations, agents, control rules |
| `DecisionEventLog` | Canon timeline including trigger and prior decisions |
| `CanonStateSnapshot` | Truth / potential / rejected node sets |
| `RipplePreviewModel` (optional) | Warnings, preserved elements, follow-up context |
| `WorldSteeringContext` (optional) | Active World Whisper constraints |
| `EvolutionPolicy` | Hard caps: max nodes per constellation, max propagation depth, etc. |

---

## Conceptual outputs

| Output | Description |
|--------|-------------|
| `EvolutionPlan` | Ordered list of mutation steps with scope, confidence, rollback handles |
| `EvolutionPreviewModel` | UI-facing diff summary (before apply) |
| `EvolutionResult` | Applied / skipped / failed steps + reasons |
| `EvolutionHistoryEntry` | Explainable record linked to trigger event and apply plan |
| `CanvasPatch` | Serializable before/after delta for undo |

Future type candidates (Phase 5.1+): see [Future type candidates](#future-type-candidates).

---

## Core principles

1. **Proposal ≠ mutation** — Ripple proposes; Evolution executes only approved plans.
2. **Preview before write** — No silent canvas changes.
3. **Deterministic core** — Mutation ordering, caps, and conflict resolution are code, not LLM improvisation.
4. **Minimal blast radius** — Default to local scope; widen only when operation explicitly requires it.
5. **Preserve unless approved to remove** — `preservedElements` from ripple output are hard stops.
6. **Explain every step** — Each mutation cites operation id, reason, and trigger event.
7. **Reversible by design** — History stores enough to undo a single evolution batch.
8. **Genre-agnostic rules** — Same engine for sci-fi, romance, comedy, sports, etc.
9. **Stop early** — When caps, conflicts, or confidence decay block progress, halt and surface blockers.
10. **Steering is constraint, not override** — World Whisper narrows choices; it does not bypass approval.

---

## Decision-to-evolution rules

A canon decision triggers ripple analysis; evolution runs **only** when:

1. User has approved one or more operations in `RipplePreviewPanel`.
2. `buildRippleApplyPlan(preview)` returns `status: ready_to_apply`.
3. User confirms the **Evolution Preview** (future UI).
4. Trigger `UserDecisionEvent` is present and matches `applyPlan.triggerEventId`.

| Decision type | Typical evolution behavior |
|---------------|----------------------------|
| Establish as Truth | Strengthen related nodes, generate follow-ups, adjust constellation focus |
| Keep as Potential | Weaken competing truths, mark nodes “contested,” rarely remove |
| Reject | Weaken/hide node branch, prune suggested continuations, no hard delete without approval |

Evolution **never** re-litigates the canon decision itself — it implements approved ripple operations consistent with that decision.

---

## Node mutation rules

### Allowed operation types (from ripple)

| Operation | Evolution behavior |
|-----------|-------------------|
| `strengthen_node` | Increase visual weight, canon linkage, agent relevance; update metadata |
| `weaken_node` | Reduce prominence, mark contested, dim edges; do not delete |
| `modify_node` | Patch title/description/metadata per payload; preserve id |
| `replace_node` | Swap content in-place; retain id or fork with explicit user confirm |
| `generate_new_node` | Create node with parent/constellation linkage; enforce caps |
| `remove_node` | **High risk** — hide or archive first; hard remove only if approved + no preserve flag |
| `merge_nodes` | Combine metadata; retire secondary id to history |
| `split_node` | Create child nodes from facets; parent remains anchor |

### Removal vs weakening decision tree

```
remove_node approved?
  ├─ No → skip
  ├─ Yes → target in preservedElements?
  │         ├─ Yes → BLOCK (surface blocker)
  │         └─ No → node is canon truth?
  │                   ├─ Yes → BLOCK unless explicit remove_from_canon event
  │                   └─ No → has active children / trail focus?
  │                             ├─ Yes → weaken + hide branch first (default)
  │                             └─ No → archive (soft) → optional hard remove in later phase
```

Default policy: **prefer weaken/hide over delete.**

### Confidence decay (node-level)

Each proposed mutation carries confidence from ripple (0–1). Evolution applies decay when:

- Operation target is far from trigger node (see propagation).
- Continuation distance is `far` (Node Reasoner vocabulary).
- Competing canon truths exist on sibling nodes.
- Warning previews flagged `tone_mismatch` or `scope_drift`.

| Decayed confidence | Action |
|--------------------|--------|
| ≥ 0.75 | Apply as planned |
| 0.55 – 0.74 | Apply with “tentative” flag in history; optional UI nudge |
| 0.40 – 0.54 | Downgrade: weaken instead of generate, or skip |
| < 0.40 | Skip step; log reason |

Decay is **multiplicative**, not a single LLM judgment.

---

## Constellation mutation rules

| Operation | Evolution behavior |
|-----------|-------------------|
| `refocus_constellation` | Update constellation question/focus metadata; reorder node emphasis |
| `change_constellation_priority` | Adjust overview ordering / vitality; no silent node deletion |

### Constellation growth limits

| Policy | Default cap |
|--------|-------------|
| Max new nodes per evolution batch | 3 |
| Max nodes per constellation (soft) | Architect `expansionRules` or 24 |
| Max depth from constellation root | 5 levels |
| Max new constellations per batch | 0 (architect-only in early phases) |

When cap exceeded: stop remaining `generate_new_node` steps, mark plan `partially_applied`, surface summary.

---

## Propagation scope levels

Ripple `affectedScopes` map to evolution blast radius:

| Scope | What may change |
|-------|-----------------|
| `node` | Target node metadata only |
| `sibling_nodes` | Target + same-constellation siblings |
| `constellation` | All nodes in constellation + constellation meta |
| `neighboring_constellations` | Adjacent constellations’ **metadata only**, not mass node gen |
| `world` | Global flags, tone registers; no bulk rewrite |
| `canon` | Canon snapshot markers; full critic integration deferred |
| `flow` | Narrative flow placeholders only until Flow engine exists |

**Default execution scope** = operation target scope ∩ policy cap.

### Stop conditions

Evolution halts a batch when:

1. A step fails validation (missing target id).
2. A preserved element would be violated.
3. Node or constellation cap reached.
4. Confidence decay drops step below threshold.
5. User cancels evolution preview.
6. Concurrent evolution lock (another batch in progress).
7. Apply plan status ≠ `ready_to_apply`.

Partial apply is allowed only if later steps are independent; dependent steps must roll back or skip as a group.

---

## New node generation rules

`generate_new_node` must satisfy:

1. **Parent linkage** — `parentNodeId` or constellation root explicit in payload.
2. **Continuation anchor** — Non-generic anchor string (Node Reasoner quality bar).
3. **Uniqueness** — No duplicate display title in same constellation.
4. **Cap check** — Constellation node count + batch count.
5. **Naming** — Use `nodeTitleById` patterns; normalize display titles.
6. **No orphan nodes** — Every new node has constellationId and graph edge.

Reject generation (skip step) when payload missing anchor or duplicate detected.

---

## Conflict handling

| Conflict type | Resolution |
|---------------|------------|
| Canon conflict warning | Block evolution until user clarifies or approves reconcile op |
| Duplicate idea | Merge metadata or skip weaker duplicate |
| Contradiction | Weaken lower-confidence node; never auto-delete truth |
| Tone mismatch | Apply only if steering allows; else skip with log |
| Flow conflict | Defer to Narrative Flow phase; mark node `needs_flow_review` |

Conflicts never resolved by silent LLM rewrite.

---

## Interaction with World Whisper steering

World Whisper provides **constraints**, not mutations:

| Steering intent | Evolution effect |
|-----------------|------------------|
| “Keep it hopeful” | Blocks dystopian strengthen ops flagged by tone warnings |
| “More psychological” | Prefers modify over generate; narrows new node themes |
| “Underwater setting” | Filters generate payloads inconsistent with setting |

Steering **cannot** auto-approve operations or bypass evolution preview.

---

## Explainability

Every applied step records:

- `evolutionId`, `applyPlanId`, `triggerEventId`
- Operation id + type + target id
- Before/after snapshot (or patch)
- Human-readable reason (from ripple operation)
- Confidence before/after decay
- Scope used
- Skipped/failed reason if applicable

UI surfaces: “Because you established **X** as truth, **Y** was strengthened.”

---

## Reversibility and undo

1. **Batch undo** — Revert entire evolution batch via stored `CanvasPatch`.
2. **Operation undo** — Reverse single step if independent.
3. **Canon undo** — Separate from canvas undo; uses decision log, not evolution alone.
4. **History retention** — In-memory first; persistence later.

Undo restores canvas state; it does not delete ripple preview history.

---

## Future type candidates

Phase 5.1+ may introduce (names tentative):

```typescript
type EvolutionPlanStatus =
  | "draft"
  | "ready_for_preview"
  | "blocked"
  | "partially_applied"
  | "applied"
  | "reverted";

type EvolutionMutationKind =
  | "node_strengthen"
  | "node_weaken"
  | "node_modify"
  | "node_create"
  | "node_archive"
  | "constellation_refocus"
  | "canon_marker";

type EvolutionStep = {
  id: string;
  applyOperationId: string;
  kind: EvolutionMutationKind;
  targetId: string;
  scope: RippleAffectedScope;
  confidence: number;
  reason: string;
  payload?: Record<string, unknown>;
  dependsOn?: string[];
};

type EvolutionPlan = {
  id: string;
  applyPlanId: string;
  triggerEventId: string;
  status: EvolutionPlanStatus;
  steps: EvolutionStep[];
  blockers: RippleApplyBlocker[];
  summary: string;
  createdAt: string;
};

type EvolutionHistoryEntry = {
  id: string;
  planId: string;
  appliedStepIds: string[];
  skippedStepIds: string[];
  canvasPatch: CanvasPatch;
  undoAvailable: boolean;
  timestamp: string;
};
```

---

## Implementation roadmap

| Phase | Deliverable | Mutates canvas? |
|-------|-------------|-----------------|
| **5.0** (this doc) | Specification | No |
| **5.1** | `evolutionPlan.ts` types + pure planner from `RippleApplyPlan` | No |
| **5.2** | Evolution preview model + UI skeleton | No |
| **5.3** | Guarded apply executor + history (in-memory) | Yes (confirmed only) |
| **5.4** | Undo batch + dev fixtures | Yes |
| **5.5** | Integration with live ripple → apply flow | Yes |
| **6.x** | Canon Critic, Narrative Flow, persistence | TBD |

---

## Worked examples (diverse genres)

### Sci-fi memory economy

**Trigger:** User establishes “Childhood memories tradable for housing credits” as truth.

**Approved ripple ops:** Modify Public Memory Archive; strengthen Illegal Memory Broker; generate Childhood Debt Collector.

**Evolution plan (sketch):**

1. `modify_node` → Public Memory Archive — add regulated listing metadata (scope: node).
2. `strengthen_node` → Illegal Memory Broker — increase vitality (scope: sibling_nodes).
3. `generate_new_node` → Childhood Debt Collector under Housing Credits constellation (cap check: 1 new node).

**Stop:** Canon conflict warning on Memory-Free Commune blocks batch until user clarifies — evolution preview shows blocker, no write.

---

### Romance dream warning

**Trigger:** Establish “They can only meet in dreams” as truth.

**Approved ops:** Weaken coffee shop meetup node; modify dream boundary rules.

**Evolution:** Weaken (not remove) waking meetup node; patch dream node metadata. Confidence decay on far sibling nodes → skip tangential generates.

---

### Comedy treasure hunt

**Trigger:** Keep “Map-eating crabs” as potential.

**Approved ops:** Generate ink-stained clue node near treasure X mark.

**Evolution:** One new child node with anchor “crabs ate the map edge”; comedy tone preserved via steering. Cap: 1 generate.

---

### Political fantasy oath law

**Trigger:** Establish “Broken oath witness” as truth.

**Approved ops:** Modify oath statute node; strengthen tribunal constellation focus.

**Evolution:** Constellation refocus only on tribunal metadata; modify single node. No mass node spawn.

---

### Sports drama final match

**Trigger:** Reject “Victory parade” node.

**Approved ops:** Weaken parade; update flow placeholder (deferred).

**Evolution:** Weaken/hide parade node; flow update marked `needs_flow_review` — no flow graph write yet.

---

### Family saga inheritance dispute

**Trigger:** Establish revised will as truth.

**Approved ops:** Modify heirloom node; generate estranged heir node.

**Evolution:** Modify in place; one generate with parent = estate partition root; stop if constellation at cap.

---

### Mystery locked-room case

**Trigger:** Establish “Door bolted from inside” as truth.

**Approved ops:** Strengthen locked-room clue; weaken impossible-exit red herring.

**Evolution:** Strengthen + weaken only; no new nodes unless approved and under cap. Contradiction warnings block until resolved.

---

## Recommended next phase

**Phase 5.1 — Evolution Plan Types & Pure Planner**

- Add `lib/worldBrain/evolutionPlan.ts` (types + `buildEvolutionPlan(applyPlan, context)`).
- Deterministic ordering, caps, confidence decay, preserve checks.
- No API, no UI, no canvas writes.
- No-network fixture tests using memory-economy and romance fixtures.

This keeps the product safely on the **approved → plan → preview → apply** rail without opening the door to uncontrolled LLM canvas edits.

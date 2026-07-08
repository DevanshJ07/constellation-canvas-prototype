# Guarded World Evolution Apply — Specification (Phase 5.5A)

Last updated: July 2026  
Status: **Design only** — no implementation in this phase.

Related: [world-evolution-engine-spec.md](./world-evolution-engine-spec.md) (Phase 5.0), implemented layers through Phase 5.4.

---

## Purpose

The **Guarded Canvas Apply** layer is the first layer in the World Evolution stack that **may write to the canvas**. It consumes **validated dry-run patch candidates** and applies them only after **explicit user confirmation**, using **immutable patch application**, **canon protection**, **archive-first mutation**, and **reversible history metadata**.

### Critical product rule

> **The apply layer must not behave like “AI edits the canvas.”**

It must behave like:

```
validated patch candidates
  → explicit user confirmation
  → immutable canvas patch application
  → apply result
  → reversible history metadata
```

If any step is skipped, the product loses trust.

---

## Responsibility of the guarded apply layer

The Guarded Canvas Apply layer:

1. **Accepts** a `WorldEvolutionApplyDryRunResult` with status `ready_for_confirmation` (or explicit user-approved subset of `needs_review` patches).
2. **Re-validates** every patch immediately before write against the **current** canvas snapshot and canon state (fail closed).
3. **Applies** only allowed patch types in deterministic order via immutable updates.
4. **Never** mutates input models (`CanvasWorldModel`, dry-run result, plan objects).
5. **Records** per-patch and batch-level apply outcomes for UI and future undo.
6. **Stops** on hard failures according to partial-apply policy; never silently applies blocked or skipped patches.
7. **Does not** call LLMs, propose new operations, or bypass ripple/evolution approval chains.

The Guarded Canvas Apply layer **does not**:

- Build evolution plans (World Evolution Planner — Phase 5.1).
- Preview UI grouping (Evolution Preview Model — Phase 5.2).
- Dry-run validation only (Dry Run — Phase 5.3).
- Persist history to disk (future phase).
- Undo canvas state by itself (Undo/History Layer consumes apply output).
- Modify canon decision log directly (canon changes remain user decision events).

---

## Position in the intelligence stack

```
User Prompt
  → World Architect
  → CanvasWorldModel
  → Exploration / Reasoners
  → User canon decisions → UserDecisionEvent log
  → Ripple Effect Engine (LLM proposals only)
  → RipplePreviewModel + user approval
  → RippleApplyPlan
  → WorldEvolutionPlan (pure planner)
  → WorldEvolutionPreviewModel + Evolution Preview UI
  → WorldEvolutionApplyDryRun (patch candidates, no writes)
  → [THIS SPEC] Guarded Canvas Apply
  → Undo/History Layer (in-memory first, persistence later)
  → [future] Canon Critic, Narrative Flow
```

| Layer | Mutates canvas? | User confirmation |
|-------|-----------------|-------------------|
| Ripple Preview | No | Per-operation approve/reject |
| Evolution Preview | No | Review only (Phase 5.4) |
| Dry Run | No | N/A |
| **Guarded Apply** | **Yes** | **Batch + per risky patch** |
| Undo/History | Restores prior snapshot | User-initiated undo |

---

## Layer distinctions

### WorldEvolutionPlan (Phase 5.1)

- **Question:** “What high-level evolution actions follow from approved ripple operations?”
- **Output:** `WorldEvolutionAction[]` with status, confidence, blockers, policy caps.
- **Mutates canvas:** No.
- **Granularity:** Semantic operations (`generate_node`, `weaken_node`, `refocus_constellation`).

### WorldEvolutionApplyDryRun (Phase 5.3)

- **Question:** “If we applied ready actions, what **canvas-level patches** would be needed, and which are safe?”
- **Output:** `EvolutionCanvasPatchCandidate[]` with `ready` | `needs_review` | `blocked`.
- **Mutates canvas:** No.
- **Granularity:** Patch types (`add_node`, `archive_node`, `mark_node_weakened`, …).

### Guarded Canvas Apply (Phase 5.5B — this spec)

- **Question:** “Given confirmed patch candidates, apply them **safely** to the live canvas snapshot.”
- **Output:** `WorldEvolutionApplyResult` + history metadata.
- **Mutates canvas:** Yes — immutable copy-on-write only.
- **Granularity:** Executable patches with before/after snapshots per step.

### Undo/History Layer (Phase 5.5C+ — future)

- **Question:** “How do we revert an evolution batch and explain what changed?”
- **Output:** Restored `CanvasWorldModel`, `EvolutionHistoryEntry`, undo availability flags.
- **Mutates canvas:** Yes — via stored snapshot restore, not re-planning.
- **Does not** delete ripple/evolution preview history.

---

## Apply boundary rules

### Preconditions (all required)

1. `WorldEvolutionPlan.status` is `ready_for_preview` or `needs_review` (not `failed` / `empty`).
2. `WorldEvolutionApplyDryRun.status` is `ready_for_confirmation` or user explicitly confirms a `needs_review` subset.
3. User has clicked **Confirm apply** on the evolution preview (future Phase 5.5B UI).
4. Dry-run was computed against the **same** canvas snapshot generation as apply (staleness check).
5. `applyPlan.triggerEventId` matches the active decision context.
6. No blocked patches are included in the apply set unless user explicitly opts in (not default).

### Hard stops (apply must not start)

| Condition | Behavior |
|-----------|----------|
| Dry-run status `blocked` or `failed` | Apply button disabled; show blockers |
| Zero `readyPatches` after re-validation | Fail closed; no writes |
| Canvas snapshot stale (model changed since dry-run) | Re-run dry-run or block apply |
| Patch candidate status `blocked` or `no_op` | Exclude; never apply |
| Patch re-validation fails at apply time | Skip or abort batch per partial-apply policy |
| Missing target node/constellation at apply time | Mark patch failed; do not crash |

### Allowed apply inputs

- Only patches from `dryRunResult.readyPatches` by default.
- Optional `selectedPatchIds` for subset apply (advanced; must still pass re-validation).
- `needs_review` patches only if user explicitly checks them in confirmation UI.

### Forbidden apply inputs

- Patches not present in the dry-run result.
- Patches whose `status !== "ready"` unless explicitly confirmed as `needs_review`.
- Direct `WorldEvolutionAction` application (must go through patch layer).
- LLM-generated patch payloads not present in dry-run candidates.
- Hard delete patches (patch type does not exist in Phase 5.5B).

---

## Patch allow / block matrix

| Patch type | Allowed in apply? | Default confirmation | Notes |
|------------|-------------------|----------------------|-------|
| `add_node` | Yes | Batch + per-patch if high risk | Deterministic id; budget re-check |
| `update_node_metadata` | Yes | Per-patch if canon truth | Metadata only |
| `update_node_status` | Yes | Per-patch | Status flags, not delete |
| `archive_node` | Yes | **Always per-patch** | Soft hide; reversible |
| `mark_node_weakened` | Yes | Optional per-patch | Reversible prominence change |
| `mark_node_strengthened` | Yes | Optional per-patch | Reversible prominence change |
| `update_constellation_metadata` | Yes | Batch | No new constellations |
| `add_edge` | Yes | Batch | Endpoints must exist post prior patches |
| `update_edge_metadata` | Yes | Batch | Metadata only |
| `no_op` | **Never** | N/A | Dry-run placeholder only |

| Block reason | Apply behavior |
|--------------|----------------|
| Canon truth archive/remove | Block permanently |
| Preserved / locked target | Block permanently |
| Missing target | Fail patch |
| Duplicate label / id collision | Fail patch |
| Node budget exceeded at apply time | Fail patch |
| `needs_review` without explicit user opt-in | Skip (not silent apply) |

---

## Patch type behavior (apply semantics)

All patches operate on an **immutable working copy** of `CanvasWorldModel`. Input snapshot is never mutated.

### `add_node`

- **Effect:** Append new `CanvasNode` to working model; link to constellation and optional parent via edge.
- **ID rule:** Use `target.id` from patch if unused; otherwise generate deterministic id: `evo_node_{sourceActionId}_{hash(anchor)}` (no random UUIDs in core).
- **Requires:** Valid constellation, unique label in constellation, parent exists if specified, budget headroom.
- **Reversible:** Yes — undo removes node and associated edges from working snapshot.
- **Confirmation:** Always requires batch confirmation; high-risk payloads require per-patch confirm.

### `update_node_metadata`

- **Effect:** Shallow-merge allowed metadata fields on existing node (`title`, `description`, `whyPromising`, payload fields). **Preserve node id.**
- **Requires:** Target exists; not hard-blocked unless canon truth (then needs explicit per-patch confirm).
- **Reversible:** Yes — store before snapshot on node.
- **Must not:** Change constellation membership without separate patch.

### `update_node_status`

- **Effect:** Update evolution-specific status flags on node or parallel UI state map (e.g. `weakened`, `archived`, `strengthened`). Does not remove from model.
- **Requires:** Target exists.
- **Reversible:** Yes.

### `archive_node`

- **Effect:** Mark node `archived: true` (or move to archived overlay set); hide from default canvas view; **do not delete** node record or edges.
- **Requires:** Target exists; target **not** canon truth, preserved, or locked.
- **Reversible:** Yes — unarchive restores visibility flags.
- **Confirmation:** **Required per patch** always.

### `mark_node_weakened`

- **Effect:** Set weakened prominence metadata; optionally sync to canvas `weakenedIds` UI state via separate adapter (Phase 5.5B documents contract; wiring may be 5.5C).
- **Requires:** Target exists; reason non-empty.
- **Reversible:** Yes.

### `mark_node_strengthened`

- **Effect:** Increase prominence metadata / vitality weight declaratively.
- **Requires:** Target exists.
- **Reversible:** Yes.

### `update_constellation_metadata`

- **Effect:** Patch `displayTitle`, `description`, `question`, `priority`, or `focusShift` metadata only.
- **Requires:** Constellation exists.
- **Must not:** Create new constellations or delete existing ones in Phase 5.5B.

### `add_edge`

- **Effect:** Record parent→child or logical edge in canvas adjacency (constellation `nodeIds` or explicit edge list when added to model).
- **Requires:** Both endpoints exist in working model at apply time (prior `add_node` in same batch counts).
- **Reversible:** Yes — remove edge on undo.

### `update_edge_metadata`

- **Effect:** Update edge label/weight metadata only.
- **Requires:** Edge exists.
- **Reversible:** Yes.

### `no_op`

- **Never applied.** Exists only for dry-run diagnostics when actions are skipped/blocked.

---

## Canon protection rules

Apply-time canon checks are **stricter than dry-run** because state may change between preview and confirm.

| Target state | `update_node_metadata` | `mark_weaken/strengthen` | `archive_node` | `add_node` |
|--------------|------------------------|--------------------------|----------------|------------|
| Canon truth | Allowed with **per-patch confirm** | Allowed with confirm | **Blocked** | Allowed if budget OK |
| Potential | Allowed | Allowed | Allowed with **per-patch confirm** | Allowed |
| Rejected | Allowed | Allowed | Allowed with confirm | Allowed |
| Preserved (ripple) | Allowed with confirm | Allowed | **Blocked** | Allowed |
| Locked | **Blocked** unless explicit override | **Blocked** | **Blocked** | Allowed if parent valid |

**Canon truth is never hard-deleted** by evolution apply in Phase 5.5B.

Modifying canon truth metadata never silently changes `CanonStateSnapshot` — user canon decisions remain authoritative in the decision log.

---

## Archive vs hard delete rules

| Operation | Phase 5.5B behavior |
|-----------|---------------------|
| Hard delete node | **Forbidden** — no patch type |
| `remove_node` evolution action | Must have been converted to `archive_node` or `mark_node_weakened` in dry-run |
| Archive | Default soft removal path |
| Weaken | Default alternative to removal |
| Edge removal | Only when archiving node triggers hide edges; edges not destroyed, only hidden from active view |

**Archive-first invariant:** Any “removal” intent becomes hide/archive/weaken, never erase.

---

## Reversibility requirements

Every applied patch must capture:

1. **Before snapshot** — minimal JSON patch or full entity copy for affected node/constellation/edge.
2. **After snapshot** — state immediately after patch.
3. **Reverse patch** — declarative inverse operation (e.g. `add_node` → remove node from model on undo).

### Batch-level undo (Phase 5.5C)

- `EvolutionUndoSnapshot` stores full pre-batch `CanvasWorldModel` copy (or cumulative patch).
- Undo restores entire batch atomically by default.

### Per-patch undo (optional later)

- Allowed only if patch independence graph says safe (no later patch depended on this patch’s output).

### History metadata (Phase 5.5B minimum)

- Record apply result even if undo UI is not built yet.
- `undoAvailable: true` when snapshot captured successfully.

Undo restores canvas state; it does **not** revert ripple approvals or canon decisions.

---

## Confirmation rules

### Batch confirmation (required)

Before any write, user must confirm a summary showing:

- Count of ready / needs-review patches selected
- List of patch types and targets (human-readable labels)
- Blocked patches shown separately with “will not apply”
- Trigger event + plan id
- Explicit acknowledgment: “This will change the canvas”

### Per-patch confirmation (required when)

- `requiresConfirmation === true` on patch candidate
- `archive_node` (always)
- `update_node_metadata` on canon truth
- Any patch flagged `needs_review` that user opts to include
- High-risk ripple operations (`riskLevel === "high"`)

### Never silently apply

- `needs_review` patches without checkbox opt-in
- `blocked` or `no_op` patches
- Patches failing re-validation at apply time

---

## Failed patch handling

When a single patch fails during apply (after batch started):

1. Record `FailedEvolutionPatch` with reason, patch id, stop code.
2. Do **not** throw uncaught — return structured result.
3. Apply policy determines whether subsequent patches run (see partial apply).

Failure reasons include: `target_not_found`, `canon_protection`, `id_collision`, `budget_exceeded`, `stale_snapshot`, `internal_validation`.

---

## Partial apply policy

**Default policy: atomic batch (recommended for Phase 5.5B v1)**

- If any patch fails, **roll back** all prior patches in the batch using captured before-snapshots.
- Result status: `failed` with zero net canvas change.

**Optional policy: best-effort independent apply (Phase 5.5C+)**

- Apply patches in dependency order; skip failures; continue only if dependency graph allows.
- Result status: `partially_applied`.
- UI must show which patches succeeded vs failed.
- Undo still batch-level from pre-batch snapshot.

Dependency order (same batch):

1. `add_node` (creates ids)
2. `add_edge` (depends on nodes)
3. `update_node_metadata` / `mark_*` / `update_node_status`
4. `archive_node` (last — may hide nodes referenced earlier in same batch only if explicitly ordered)

---

## Apply result representation

### `WorldEvolutionApplyInput` (future)

```typescript
type WorldEvolutionApplyInput = {
  dryRunResult: WorldEvolutionApplyDryRunResult;
  plan: WorldEvolutionPlan;
  canvasModel: CanvasWorldModel;
  canonState: CanonStateSnapshot;
  selectedPatchIds?: string[];
  confirmedPatchIds: string[];      // user-checked per-patch confirms
  batchConfirmed: boolean;          // user confirmed batch dialog
  appliedAt?: string;
};
```

### `WorldEvolutionApplyResult` (future)

```typescript
type WorldEvolutionApplyResultStatus =
  | "empty"
  | "applied"
  | "partially_applied"
  | "failed"
  | "cancelled";

type WorldEvolutionApplyResult = {
  planId: string;
  dryRunId: string;
  status: WorldEvolutionApplyResultStatus;
  appliedPatches: AppliedEvolutionPatch[];
  failedPatches: FailedEvolutionPatch[];
  skippedPatches: FailedEvolutionPatch[];  // needs_review not confirmed
  mutationBatch: EvolutionMutationBatch;
  historyEntry: EvolutionHistoryEntry;
  summary: string;
  canvasModel: CanvasWorldModel;         // new immutable snapshot
};
```

### `AppliedEvolutionPatch` (future)

```typescript
type AppliedEvolutionPatch = {
  patchId: string;
  patchType: EvolutionCanvasPatchType;
  sourceActionId: string;
  targetId: string;
  reason: string;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  reversePatch: EvolutionCanvasPatchCandidate;
  appliedAt: string;
};
```

### `FailedEvolutionPatch` (future)

```typescript
type FailedEvolutionPatch = {
  patchId: string;
  patchType: EvolutionCanvasPatchType;
  sourceActionId: string;
  targetId?: string;
  reason: string;
  stopReason: string;
  recoverable: boolean;
};
```

### `EvolutionMutationBatch` (future)

```typescript
type EvolutionMutationBatch = {
  id: string;
  planId: string;
  triggerEventId: string;
  patchIds: string[];
  appliedCount: number;
  failedCount: number;
  skippedCount: number;
  atomic: boolean;
  startedAt: string;
  completedAt: string;
};
```

### `EvolutionUndoSnapshot` (future)

```typescript
type EvolutionUndoSnapshot = {
  batchId: string;
  canvasModelBefore: CanvasWorldModel;
  canvasModelAfter: CanvasWorldModel;
  inversePatches: EvolutionCanvasPatchCandidate[];
  capturedAt: string;
};
```

### `EvolutionHistoryEntry` (future)

```typescript
type EvolutionHistoryEntry = {
  id: string;
  planId: string;
  dryRunPlanId: string;
  triggerEventId: string;
  applyResultStatus: WorldEvolutionApplyResultStatus;
  appliedPatchIds: string[];
  failedPatchIds: string[];
  summary: string;
  undoSnapshot?: EvolutionUndoSnapshot;
  undoAvailable: boolean;
  timestamp: string;
};
```

---

## Canvas mutation strategy

1. **Immutable update only** — `applyWorldEvolutionPatches(input)` returns new `CanvasWorldModel`; never mutates `input.canvasModel`.
2. **No input mutation** — dry-run result, plan, and patch candidate objects are read-only.
3. **Deterministic ids** — new node ids derived from patch target id or deterministic formula; no `Math.random()`.
4. **Archive, not delete** — archived nodes remain in model with flag or parallel archived index.
5. **Edges preserved** — edges hidden with archived nodes but retained for undo unless explicit edge archive patch exists (future).
6. **Single writer** — only Guarded Apply module performs evolution-driven canvas writes in Phase 5.5B.
7. **Adapter boundary** — React canvas state (`ConstellationCanvas`) consumes returned model via existing registration/update hooks; apply module stays pure.

---

## UI confirmation strategy (Phase 5.5B UI — spec only)

Current Phase 5.4 UI remains **read-only**. Phase 5.5B adds:

1. **Confirmation modal** before apply (batch summary).
2. **Per-patch checklist** for `requiresConfirmation` and `needs_review` patches.
3. **Blocked section** — visible but not selectable.
4. **Apply button** enabled only when:
   - `dryRun.status === "ready_for_confirmation"` OR user selected valid `needs_review` patches
   - `batchConfirmed === true`
   - All required per-patch confirms checked
5. **Post-apply result panel** — applied / failed / skipped lists (no silent success).
6. **Undo button stub** — disabled until Phase 5.5C implements restore.

Never enable apply when dry-run status is `blocked` or `failed`.

---

## Safety invariants

| ID | Invariant |
|----|-----------|
| S1 | No patch applied without dry-run candidate id match |
| S2 | No blocked/`no_op` patch applied |
| S3 | No `needs_review` patch applied without explicit user opt-in |
| S4 | Re-validation at apply time; stale snapshot aborts |
| S5 | Canon truth never hard-deleted |
| S6 | Input canvas model never mutated |
| S7 | Apply is deterministic given same input snapshot |
| S8 | Every applied patch has before/after for undo |
| S9 | LLM never invoked in apply path |
| S10 | Failed apply returns structured result, never throws to UI unhandled |

---

## Testing strategy

### Pure function tests (no network, no UI)

| Suite | Focus |
|-------|-------|
| `test-world-evolution-apply-dry-run.mts` | Existing — patch candidate validation |
| `test-world-evolution-apply.mts` (5.5B) | Apply executor on fixture canvas |
| `test-world-evolution-apply-undo.mts` (5.5C) | Snapshot restore |

### Minimum apply tests (Phase 5.5B)

1. Ready `add_node` patch → node appears in output model; input unchanged.
2. `archive_node` on canon → patch fails; canvas unchanged (atomic batch).
3. `archive_node` on potential → archived flag set; reversible snapshot captured.
4. `mark_node_weakened` → metadata flag set.
5. `update_constellation_metadata` → constellation fields updated.
6. `add_edge` after `add_node` in batch → edge exists.
7. `needs_review` patch excluded unless in `confirmedPatchIds`.
8. Blocked patch in dry-run never applied.
9. Stale target → `FailedEvolutionPatch`; atomic rollback.
10. Partial failure → atomic policy rolls back all (v1).

### UI tests (manual / future)

- Apply button disabled in Phase 5.4 remains until 5.5B wiring.
- Confirmation modal blocks apply until checks complete.

---

## Implementation roadmap — Phase 5.5B

| Step | Deliverable | Mutates canvas? |
|------|-------------|-----------------|
| **5.5A** (this doc) | Guarded apply design spec | No |
| **5.5B.1** | `lib/worldBrain/worldEvolutionApply.ts` — types + pure `applyWorldEvolutionPatches()` | Yes (returns new model) |
| **5.5B.2** | `scripts/test-world-evolution-apply.mts` — fixture tests | No (test harness) |
| **5.5B.3** | Confirmation modal + enabled apply button in `WorldEvolutionPreviewPanel` | Yes (via handler) |
| **5.5B.4** | Wire apply in `ConstellationCanvas` — replace canvas model from result | Yes |
| **5.5B.5** | In-memory `EvolutionHistoryEntry` list (no persistence) | No canvas by itself |
| **5.5C** | Undo batch restore from `EvolutionUndoSnapshot` | Yes (restore) |
| **5.5D** | Staleness detection + dry-run refresh prompt | No |

### Suggested file layout (5.5B)

```
lib/worldBrain/worldEvolutionApply.ts       # apply executor + types
lib/worldBrain/worldEvolutionApplyTypes.ts # optional split if large
scripts/test-world-evolution-apply.mts
```

### Integration point in `ConstellationCanvas`

```
worldEvolutionApplyDryRun
  → user confirms
  → applyWorldEvolutionPatches({ dryRunResult, canvasModel, ... })
  → setArchitectureCanvasModel(result.canvasModel)   // immutable replace
  → appendEvolutionHistoryEntry(result.historyEntry)
```

---

## Relationship to implemented Phase 5.3–5.4

Phase 5.3 implemented **dry-run only** (`worldEvolutionApplyDryRun.ts`).  
Phase 5.4 wired dry-run into **read-only** preview UI.

Phase 5.5B builds on those artifacts directly:

- Apply consumes `WorldEvolutionApplyDryRunResult.readyPatches`.
- Patch types and validation rules in dry-run become the apply contract.
- UI already displays patch groups; 5.5B adds confirmation + apply handler.

---

## Summary

Guarded Canvas Apply is the **disciplined execution gate** between “what we might change” (dry-run) and “what actually changed” (canvas + history). It preserves the product promise: **validated patch candidates → explicit confirmation → immutable application → reversible metadata** — never autonomous AI canvas editing.

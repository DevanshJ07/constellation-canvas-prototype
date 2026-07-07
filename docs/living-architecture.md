# Living Architecture

Last updated: July 2026

This document records the current system design, completed layers, pending validations, and next steps for the AI-native worldbuilding platform.

**Recent commits:** `79af289` (Constellation Reasoner + orbital layout), `e6acc44` (Node Reasoner backend foundation)

---

## Product Vision

### AI-Native Worldbuilding Platform

This product is **not** a chatbot, autocomplete tool, or AI writing assistant.

The platform helps creators:

**Explore → Discover → Decide → Build → Evolve**

The user should feel like they are navigating a **living fictional universe**, not chatting with an LLM.

---

## Current Pipeline

```
User Prompt
  → World Architect (Gemini)
  → Bridge Layer
  → World Overview Canvas
  → Clickable Constellations
  → Constellation Reasoner (Gemini)
  → Reasoned local nodes
  → Orbital constellation layout
  → [planned] Node Reasoner (Gemini)
  → [planned] Child-node expansion layout
```

---

## Current Intelligence Stack

### 1. World Architect

**Responsibility:** Designs the global creative workspace.

**Input:** world prompt, purpose

**Output:** architecture summary, visible constellations, reasoning agents, critics, starting nodes, control rules, expansion rules, constraints

**Status:** Completed and integrated with Gemini.

**Key modules:**
- `lib/worldBrain/decomposeWorldPrompt.ts`
- `lib/worldBrain/architectWorld.ts`
- `app/api/world/architect/route.ts`
- `app/api/world/decompose/route.ts`

---

### 2. Bridge Layer

**Responsibility:** Converts Architect output into `CanvasWorldModel` for the canvas.

**Status:** Completed and integrated.

**Key modules:**
- `lib/worldBrain/mapArchitectureToCanvas.ts`
- `lib/worldBrain/mapReasonedNodesToBranches.ts`

---

### 3. Constellation Reasoner

**Responsibility:** Given one selected constellation, generate meaningful local nodes and exploration axes.

**Status:** Completed, manually tested, and integrated into UI.

**Key modules:**
- `lib/worldBrain/constellationReasonerTypes.ts`
- `lib/worldBrain/constellationReasonerPrompt.ts`
- `lib/worldBrain/buildConstellationReasonerInput.ts`
- `lib/worldBrain/reasonConstellation.ts`
- `app/api/world/constellation-reasoner/route.ts`

---

### 4. Node Reasoner

**Responsibility:** Given one selected node, generate context-preserving continuations.

**Core principle:** Future nodes must grow from the selected node's context, not from random adjacent ideas.

**Status:**
- Backend foundation completed
- Output mapper and child layout helpers completed (deterministic, no Gemini)
- **UI integration not started**
- **Live quality validation pending Gemini quota reset** (HTTP 429 blocked fixture test execution)

**Key modules:**
- `lib/worldBrain/nodeReasonerTypes.ts`
- `lib/worldBrain/nodeReasonerPrompt.ts`
- `lib/worldBrain/buildNodeReasonerInput.ts`
- `lib/worldBrain/reasonNode.ts`
- `app/api/world/node-reasoner/route.ts`
- `lib/worldBrain/mapNodeReasonerToCanvas.ts`

---

## Node Reasoner Continuation Rule

The Node Reasoner should **not** ask:

- "What else can exist in this world?"
- "What else can exist in this constellation?"

It **should** ask:

> "What can be discovered inside, around, beneath, caused by, remembered by, feared in, chosen through, or connected through this selected node?"

### Example

**Selected node:** Old Temple of Lady

**Good continuations:**
- Cracked Lady Idol
- Fresh Marigold Offering
- Bell Without Wind
- Hidden Sanctum Stair
- Animal Sleeping at Her Feet
- Friend Who Hears Anklets

**Bad continuations:**
- Demon King
- Lost Army
- Floating City
- Fire Sword
- Random Portal

### Quality fields

Each `possibleNewNode` should include meaningful values for:

| Field | Purpose |
|-------|---------|
| `continuationAnchor` | Specific hook tying the node to the parent (not generic words like "mystery") |
| `continuationDistance` | `direct` / `near` / `far` — how many steps from the selected node |
| `whyThisFollows` | Explicit justification for continuity |
| `continuityScore` | 1–10 strength of connection to selected node |
| `driftRisk` | `low` / `medium` / `high` — risk of topic drift |

---

## Implemented Modules

### World / Architect

| File | Role |
|------|------|
| `lib/worldBrain/decomposeWorldPrompt.ts` | Prompt decomposition |
| `lib/worldBrain/architectWorld.ts` | Gemini architecture generation |
| `app/api/world/architect/route.ts` | POST architect endpoint |
| `app/api/world/decompose/route.ts` | POST decompose endpoint |

### Bridge

| File | Role |
|------|------|
| `lib/worldBrain/mapArchitectureToCanvas.ts` | `WorldArchitecture` → `CanvasWorldModel` |
| `lib/worldBrain/mapReasonedNodesToBranches.ts` | Constellation Reasoner → canvas branches |

### Constellation Reasoner

| File | Role |
|------|------|
| `lib/worldBrain/constellationReasonerTypes.ts` | Type contracts |
| `lib/worldBrain/constellationReasonerPrompt.ts` | Prompt builder |
| `lib/worldBrain/buildConstellationReasonerInput.ts` | Input builder |
| `lib/worldBrain/reasonConstellation.ts` | Gemini call + normalization |
| `app/api/world/constellation-reasoner/route.ts` | POST endpoint |

### Node Reasoner

| File | Role |
|------|------|
| `lib/worldBrain/nodeReasonerTypes.ts` | Type contracts |
| `lib/worldBrain/nodeReasonerPrompt.ts` | Prompt builder + JSON schema |
| `lib/worldBrain/buildNodeReasonerInput.ts` | Input builder |
| `lib/worldBrain/reasonNode.ts` | Gemini call + normalization |
| `app/api/world/node-reasoner/route.ts` | POST endpoint |
| `lib/worldBrain/mapNodeReasonerToCanvas.ts` | `NodeReasonerOutput` → canvas nodes |

### Layout

| File | Role |
|------|------|
| `lib/graphLayout.ts` | Constellation orbital layout (`computeOrbitalPositions`), child-node expansion layout (`layoutChildNodesAroundParent`), label collision helpers |

### Manual test scripts (no Gemini, no auto-run)

| File | Role |
|------|------|
| `scripts/test-node-reasoner-fixture.mts` | Single-call POST to `/api/world/node-reasoner` (requires dev server + quota) |
| `scripts/test-node-reasoner-mapper.mts` | Local mapper shape test |
| `scripts/test-node-expansion-layout.mts` | Local child layout test |

---

## Status Table

| Layer | Status | UI Integrated | Gemini Tested | Notes |
|-------|--------|---------------|---------------|-------|
| World Architect | Complete | Yes | Yes | Global workspace design |
| Bridge Layer | Complete | Yes | N/A | Pure mapping |
| Constellation Reasoner | Complete | Yes | Yes | Manual tests passed |
| Orbital Constellation Layout | Complete | Yes | N/A | Golden-angle spiral around constellation root |
| Node Reasoner Types/Prompt/Input/API | Complete | No | Blocked | HTTP 429 on live test |
| Node Reasoner Output Mapper | Complete | No | N/A | Pure deterministic mapping |
| Node Expansion Layout | Complete | No | N/A | Pure deterministic layout |
| Node Reasoner UI Integration | Not started | No | — | Deferred until quality validation |
| Canon Memory | Not started | No | — | Planned |
| Ripple Effects | Not started | No | — | Planned |
| World Evolution | Not started | No | — | Planned |
| Narrative Synthesis | Not started | No | — | Planned |

---

## Quota-Safe Development Rule

When Gemini quota is exhausted:

1. **Do not** run full pipeline tests (Architect → Constellation Reasoner → Node Reasoner).
2. **Avoid** repeated UI clicks that trigger reasoning endpoints.
3. **Use** single-call fixture scripts with fail-fast on HTTP 429.
4. **Build** deterministic wrappers first (mappers, layout helpers, type contracts).
5. **Validate** AI output quality later, before UI integration.

**Current blocker:** Gemini HTTP 429 blocked live Node Reasoner quality validation. The endpoint was reached; the failure is quota, not code.

---

## Immediate Next Steps

1. **Wait for Gemini quota reset.**

2. **Run the quota-safe fixture test:**
   ```bash
   npm run dev
   npx tsx scripts/test-node-reasoner-fixture.mts
   ```

3. **Evaluate Node Reasoner output for:**
   - `continuationAnchor` specificity
   - `continuationDistance` direct/near/far balance
   - `whyThisFollows` quality
   - `continuityScore` realism
   - `driftRisk` distribution
   - `displayTitle` clarity
   - Absence of off-context drift

4. **If quality is good:** Proceed to Node Reasoner UI integration (node click → reasoner → map → layout → render).

5. **If quality is weak:** Refine Node Reasoner prompt before UI integration.

---

## Deferred (Do Not Implement Yet)

- Node Reasoner UI connection (node click behavior)
- Rendering `possibleNewNodes` on canvas
- Canon Memory
- Ripple Effects
- World Evolution
- Narrative Synthesis

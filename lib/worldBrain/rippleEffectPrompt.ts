/**
 * Ripple Effect Engine — prompt builder (Phase 4.7).
 *
 * Builds LLM prompt strings for structured ripple analysis plans.
 * Pure string assembly only — no API calls, no UI, no canvas mutation.
 */

import { buildRippleEffectInput } from "@/lib/worldBrain/buildRippleEffectPlan";
import {
  CONSTELLATION_RIPPLE_IMPACT_TYPES,
  NODE_RIPPLE_IMPACT_TYPES,
  RIPPLE_AFFECTED_SCOPES,
  RIPPLE_IMPACT_LEVELS,
  RIPPLE_OPERATION_TYPES,
  RIPPLE_WARNING_TYPES,
} from "@/lib/worldBrain/buildRippleEffectPlan";
import {
  appendDecisionEvents,
  createEmptyDecisionEventLog,
  getLatestEventsByTarget,
  getRecentDecisionEvents,
} from "@/lib/worldBrain/decisionEventLog";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { getRippleReasoningRubricForPrompt } from "@/lib/worldBrain/rippleReasoningRubric";
import type { RippleEffectPromptInput } from "@/lib/worldBrain/rippleEffectTypes";
import type { UserDecisionEvent } from "@/lib/worldBrain/userDecisionTypes";

const RECENT_EVENT_LIMIT = 10;

const SYSTEM_ROLE = `You are a Ripple Effect Planner for an AI-native fictional worldbuilding canvas.

You do NOT write prose or story scenes.
You do NOT directly mutate the canvas.
You do NOT act like a generic brainstormer or idea generator.
You produce a structured ripple analysis plan describing logical consequences of a user decision.`;

const CORE_PRINCIPLE = `Core principle:
If the user makes something true, possible, rejected, modified, or removed, the world must react coherently.

Primary question:
"If this decision is now part of the creative state, what must logically change?"

Anti-pattern — do NOT ask:
"What cool related ideas can we add?"`;

export const RIPPLE_EFFECT_PROMPT_RULES = `═══ RIPPLE PLANNING RULES ═══

Anti-randomness (mandatory):
- Do not generate new nodes unless they logically follow from the trigger decision.
- Do not mark every node as affected.
- Do not weaken nodes only because they are different.
- Do not remove nodes unless obsolete, duplicate, or impossible.
- Do not overwrite accepted truth canon.
- Do not treat potential ideas as fixed truth.
- Do not solve deep canon conflicts inside Ripple; mark them for critic review.
- Do not create large world-level consequences unless the trigger changes a world rule, premise, or flow.
- Prefer asking the user when multiple valuable interpretations exist.
- Every impact must include a specific reason tied to the trigger decision.

Operation ID format (deterministic, no random ids):
- ripple_op_<operationType>_<targetId>_<index>
- ripple_warning_<warningType>_<targetId>_<index>

Impact level guidance:
- none: no meaningful ripple beyond preservation markers.
- minor: small local effect (node or direct siblings).
- moderate: several nodes or one constellation affected.
- major: multiple constellations, canon direction, or flow affected — rare.
- structural: world premise, rules, or major narrative structure affected — very rare.
Avoid major/structural unless clearly justified by the trigger.

Evaluation mode:
- conservative: only obvious direct impacts; prefer warnings and ask_user_clarification over large changes.
- balanced: meaningful local and constellation-level changes; avoid over-expansion.
- aggressive: broader cross-constellation consequences allowed; still preserve canon and avoid random expansion.

Decision-specific behavior:
- truth: preserve trigger target; check contradictions; may strengthen, weaken, modify, or generate new nodes if logically implied.
- potential: light ripple only; do not remove other nodes based on potential alone; optional future directions only.
- rejected: weaken/remove directly dependent nodes; do not delete unrelated material; refocus only if many nodes depended on rejected target.
- removed: treat as canvas cleanup unless semantic rejection is explicit; lower certainty than rejected.
- modified: compare old and new if available; preserve revised version if truth.
- unresolved: avoid strong ripple.

Reasoning mini-patterns (teach logic, not genre templates):
- Sci-fi memory economy: free public archive may contradict memory-as-currency unless subsidized — modify or warn, do not delete all economy nodes.
- Romance dream-only meetings: daily waking meetup node may require modification, not mass removal.
- Comedy treasure hunt: map-eating crabs central → treasure clue nodes may need modification, not random new gags.
- Political fantasy broken oath: court loyalty nodes strengthen or contradict — flag critic review if truth canon conflicts.
- Sports drama missed penalty: celebration scenes obsolete — weaken or flow warning, not unrelated node deletion.
- Mystery locked room: outside intruder theory weakens — explain dependency on interior lock evidence.

Quality checklist (verify before output):
- Does every impact have a reason?
- Does every nodeImpacts.suggestedOperationIds entry exist in suggestedOperations?
- Are accepted truth items in preservedElements unless explicitly revised?
- Are major/structural impactLevels justified by scope?
- Are warnings specific and actionable?
- Are new nodes logically implied by the trigger, not thematic neighbors?
- Are operations suggestions rather than mutations?
- Is ask_user_clarification used when multiple valuable interpretations exist?`;

export const RIPPLE_EFFECT_JSON_SCHEMA_DESCRIPTION = `{
  "triggerEventId": "string — MUST equal trigger decision event id from input",
  "summary": "string — 1-3 sentences: what must logically change because of this decision",
  "impactLevel": "${RIPPLE_IMPACT_LEVELS.join(" | ")}",
  "affectedScopes": ["${RIPPLE_AFFECTED_SCOPES.join('" | "')}"],
  "nodeImpacts": [
    {
      "nodeId": "string — existing canvas node id",
      "constellationId": "string (optional)",
      "impactType": "${NODE_RIPPLE_IMPACT_TYPES.join(" | ")}",
      "reason": "string — specific logical consequence tied to trigger",
      "severity": "low | medium | high",
      "confidence": "number 0-1",
      "suggestedOperationIds": ["string — ids that MUST exist in suggestedOperations"],
      "relatedTriggerAnchor": "string (optional) — phrase or premise from trigger"
    }
  ],
  "constellationImpacts": [
    {
      "constellationId": "string",
      "impactType": "${CONSTELLATION_RIPPLE_IMPACT_TYPES.join(" | ")}",
      "reason": "string",
      "suggestedFocusShift": "string (optional)",
      "suggestedNodeCountChange": "number (optional, signed delta hint)",
      "confidence": "number 0-1"
    }
  ],
  "canonImpacts": [
    {
      "impactType": "no_change | possible_contradiction | requires_reconciliation | strengthens_theme | weakens_theme | changes_world_rule | changes_tone | changes_flow",
      "reason": "string",
      "affectedCanonIds": ["string — node or canon item ids"],
      "suggestedCanonStateChanges": [
        {
          "targetId": "string",
          "fromState": "truth | potential | rejected | unresolved | modified | removed (optional)",
          "toState": "truth | potential | rejected | unresolved | modified | removed",
          "reason": "string"
        }
      ],
      "confidence": "number 0-1"
    }
  ],
  "suggestedOperations": [
    {
      "id": "string — ripple_op_<operationType>_<targetId>_<index>",
      "operationType": "${RIPPLE_OPERATION_TYPES.join(" | ")}",
      "target": {
        "targetType": "node | constellation | canon_item | flow_item | world",
        "id": "string",
        "constellationId": "string (optional)",
        "parentNodeId": "string (optional)"
      },
      "reason": "string — why this operation is suggested",
      "priority": "low | medium | high",
      "requiresUserApproval": "boolean — true for high-risk changes",
      "payload": "object (optional) — draft parameters only, not applied mutations"
    }
  ],
  "warnings": [
    {
      "id": "string — ripple_warning_<warningType>_<targetId>_<index>",
      "warningType": "${RIPPLE_WARNING_TYPES.join(" | ")}",
      "message": "string — specific risk or conflict",
      "severity": "low | medium | high",
      "affectedTargets": [{ "targetType": "...", "id": "...", "constellationId": "..." }],
      "suggestedResolution": "string (optional)"
    }
  ],
  "preservedElements": [
    {
      "targetType": "node | constellation | canon_item | flow_item | world",
      "id": "string",
      "reason": "string — why this must not change (especially truth canon)"
    }
  ],
  "followUpQuestions": ["string — questions for user when clarification is needed"],
  "confidence": "number 0-1 — overall confidence in this ripple assessment"
}

Schema notes:
- suggestedOperations are declarative suggestions, NOT applied canvas mutations.
- nodeImpacts.suggestedOperationIds MUST reference ids present in suggestedOperations.
- warnings explain risks or conflicts; use mark_for_critic_review operation for deep canon issues.
- preservedElements identify what should NOT be changed (especially established truth).
- impactLevel must match actual scope — do not inflate to major/structural without justification.`;

const OUTPUT_INSTRUCTIONS = `═══ OUTPUT FORMAT ═══
Return JSON only — a single valid JSON object matching RippleEffectOutput.
No markdown. No code fences. No commentary. No text outside the JSON object.

The JSON must match this schema:
${RIPPLE_EFFECT_JSON_SCHEMA_DESCRIPTION}

Additional consistency rules:
- triggerEventId MUST equal the trigger decision event id from INPUT CONTEXT.
- Every confidence field MUST be between 0 and 1 inclusive.
- Do not invent canvas node ids not present in Current Canvas Snapshot unless generate_new_node operations propose new ids in payload with clear justification.
- Prefer preservedElements for all truth canon nodes unless the trigger explicitly revises them.`;

function formatTriggerSection(input: RippleEffectPromptInput): string {
  const e = input.triggerEvent;
  const lines = [
    "═══ TRIGGER DECISION EVENT ═══",
    `eventId: ${e.id}`,
    `eventType: ${e.eventType}`,
    `decision: ${e.decision}`,
    `timestamp: ${e.timestamp}`,
    `source: ${e.source}`,
    "",
    "target:",
    `  targetType: ${e.target.targetType}`,
    `  id: ${e.target.id}`,
    `  title: ${e.target.title}`,
    `  displayTitle: ${e.target.displayTitle}`,
    ...(e.target.constellationId
      ? [`  constellationId: ${e.target.constellationId}`]
      : []),
    ...(e.target.parentNodeId ? [`  parentNodeId: ${e.target.parentNodeId}`] : []),
    ...(e.target.nodeType ? [`  nodeType: ${e.target.nodeType}`] : []),
    "",
    "nodeSnapshot:",
    `  id: ${e.nodeSnapshot.id}`,
    `  title: ${e.nodeSnapshot.title}`,
    `  displayTitle: ${e.nodeSnapshot.displayTitle}`,
    `  description: ${e.nodeSnapshot.description}`,
    ...(e.nodeSnapshot.constellationId
      ? [`  constellationId: ${e.nodeSnapshot.constellationId}`]
      : []),
    ...(e.nodeSnapshot.sourceLayer
      ? [`  sourceLayer: ${e.nodeSnapshot.sourceLayer}`]
      : []),
    ...(e.constellationSnapshot
      ? [
          "",
          "constellationSnapshot:",
          `  id: ${e.constellationSnapshot.id}`,
          `  title: ${e.constellationSnapshot.title}`,
          `  displayTitle: ${e.constellationSnapshot.displayTitle}`,
          ...(e.constellationSnapshot.description
            ? [`  description: ${e.constellationSnapshot.description}`]
            : []),
        ]
      : []),
    "",
    "worldContext:",
    ...(e.worldContext.worldPrompt
      ? [`  worldPrompt: ${e.worldContext.worldPrompt}`]
      : []),
    ...(e.worldContext.purpose ? [`  purpose: ${e.worldContext.purpose}`] : []),
    ...(e.worldContext.currentPhase
      ? [`  currentPhase: ${e.worldContext.currentPhase}`]
      : []),
    ...(e.worldContext.activeConstellationId
      ? [`  activeConstellationId: ${e.worldContext.activeConstellationId}`]
      : []),
    ...(e.notes ? ["", `notes: ${e.notes}`] : []),
  ];
  return lines.join("\n");
}

function formatCanonSection(input: RippleEffectPromptInput): string {
  const c = input.activeCanonState;
  return [
    "═══ CURRENT CANON STATE ═══",
    `truthCount: ${c.truthCount}`,
    `potentialCount: ${c.potentialCount}`,
    `rejectedCount: ${c.rejectedCount}`,
    `truthNodeIds: ${c.truthNodeIds.length ? c.truthNodeIds.join(", ") : "(none)"}`,
    `potentialNodeIds: ${c.potentialNodeIds.length ? c.potentialNodeIds.join(", ") : "(none)"}`,
    `rejectedNodeIds: ${c.rejectedNodeIds.length ? c.rejectedNodeIds.join(", ") : "(none)"}`,
  ].join("\n");
}

function formatEventOneLine(event: UserDecisionEvent): string {
  return `- ${event.timestamp} | ${event.eventType} | ${event.decision} | ${event.target.displayTitle} (${event.target.id})`;
}

function formatDecisionHistorySection(input: RippleEffectPromptInput): string {
  const log = input.decisionLog;
  const recent = getRecentDecisionEvents(log, RECENT_EVENT_LIMIT);
  const latestByTarget = [...getLatestEventsByTarget(log).values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, RECENT_EVENT_LIMIT);

  const lines = [
    "═══ DECISION HISTORY SUMMARY ═══",
    `totalEventCount: ${log.events.length}`,
    "",
    `recentEvents (up to ${RECENT_EVENT_LIMIT}, newest first):`,
    ...(recent.length ? recent.map(formatEventOneLine) : ["  (none)"]),
    "",
    `latestDecisionPerTarget (up to ${RECENT_EVENT_LIMIT}):`,
    ...(latestByTarget.length
      ? latestByTarget.map(formatEventOneLine)
      : ["  (none)"]),
  ];
  return lines.join("\n");
}

function formatCanvasSection(input: RippleEffectPromptInput): string {
  const model = input.canvasModel;
  const nodesByConstellation = new Map<string, typeof model.nodes>();

  for (const node of model.nodes) {
    const list = nodesByConstellation.get(node.constellationId) ?? [];
    list.push(node);
    nodesByConstellation.set(node.constellationId, list);
  }

  const lines = [
    "═══ CURRENT CANVAS SNAPSHOT ═══",
    `worldSeed: ${model.worldSeed}`,
    `worldSummary: ${model.worldSummary}`,
    "",
    "constellations:",
  ];

  for (const c of model.constellations) {
    lines.push(
      `- ${c.id} | ${c.displayTitle || c.title} | priority ${c.priority}`,
      `  description: ${c.description}`,
      `  question: ${c.question}`,
    );
    const nodes = nodesByConstellation.get(c.id) ?? [];
    if (nodes.length === 0) {
      lines.push("  nodes: (none listed)");
    } else {
      lines.push("  nodes:");
      for (const n of nodes) {
        lines.push(
          `    - ${n.id} | ${n.title} | type: ${n.nodeType}`,
          `      description: ${n.description}`,
        );
      }
    }
  }

  const orphanNodes = model.nodes.filter(
    (n) => !model.constellations.some((c) => c.id === n.constellationId),
  );
  if (orphanNodes.length > 0) {
    lines.push("", "unassigned nodes:");
    for (const n of orphanNodes) {
      lines.push(`- ${n.id} | ${n.title} | constellationId: ${n.constellationId}`);
    }
  }

  return lines.join("\n");
}

function formatSteeringSection(input: RippleEffectPromptInput): string {
  const steering = input.userSteering;
  if (!steering) {
    return "═══ USER STEERING ═══\n(none)";
  }
  return [
    "═══ USER STEERING ═══",
    `instruction: ${steering.instruction}`,
    ...(steering.targetScope ? [`targetScope: ${steering.targetScope}`] : []),
    ...(steering.intensity ? [`intensity: ${steering.intensity}`] : []),
  ].join("\n");
}

function formatEvaluationModeSection(input: RippleEffectPromptInput): string {
  const mode = input.evaluationMode ?? "balanced";
  return ["═══ EVALUATION MODE ═══", mode].join("\n");
}

function formatInputContext(input: RippleEffectPromptInput): string {
  return [
    "═══ INPUT CONTEXT ═══",
    "",
    formatTriggerSection(input),
    "",
    formatCanonSection(input),
    "",
    formatDecisionHistorySection(input),
    "",
    formatCanvasSection(input),
    "",
    formatSteeringSection(input),
    "",
    formatEvaluationModeSection(input),
  ].join("\n");
}

/** Builds the full Ripple Effect prompt string for an LLM call. */
export function buildRippleEffectPrompt(input: RippleEffectPromptInput): string {
  const rubric = getRippleReasoningRubricForPrompt();

  return [
    SYSTEM_ROLE,
    "",
    CORE_PRINCIPLE,
    "",
    "═══ REASONING RUBRIC ═══",
    rubric.compactText,
    "",
    formatInputContext(input),
    "",
    RIPPLE_EFFECT_PROMPT_RULES,
    "",
    OUTPUT_INSTRUCTIONS,
  ].join("\n");
}

// ── Fixture (sci-fi memory economy — not cave/horror) ─────────────────────────────

const FIXTURE_TS = "2026-07-07T16:00:00.000Z";

const FIXTURE_CANVAS: CanvasWorldModel = {
  worldSeed: "A colony where memories are used as currency",
  worldSummary:
    "Class divides harden when childhood can be borrowed, taxed, or traded for housing and status.",
  constellations: [
    {
      id: "constellation_memory_economy",
      title: "Memory Economy",
      displayTitle: "Memory Economy",
      description: "Who owns a borrowed childhood?",
      question: "What happens when memory debt outlives the debtor?",
      priority: 1,
      agentIds: ["agent_archivist"],
      nodeIds: [
        "node_public_memory_archive",
        "node_illegal_memory_broker",
        "node_dream_tax_office",
        "node_memory_free_commune",
        "node_childhood_debt_collector",
        "node_forgotten_birthday_market",
      ],
    },
  ],
  nodes: [
    {
      id: "node_public_memory_archive",
      title: "Public Memory Archive",
      description: "A civic vault advertised as open to all citizens.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Tests public access vs scarcity.",
      risk: "May contradict private trade.",
      explorationQuestions: ["Who funds the archive?"],
      nodeType: "place",
      status: "potential",
      aiGenerated: true,
    },
    {
      id: "node_illegal_memory_broker",
      title: "Illegal Memory Broker",
      description: "Back-alley traders who skim unregistered childhoods.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Shadow economy tension.",
      risk: "Crime subplot drift.",
      explorationQuestions: ["What is the penalty for unlicensed trade?"],
      nodeType: "character",
      status: "potential",
      aiGenerated: true,
    },
    {
      id: "node_dream_tax_office",
      title: "Dream Tax Office",
      description: "Bureau that levies fees on vivid or recurring dreams.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Institutional control of inner life.",
      risk: "Bureaucracy overload.",
      explorationQuestions: ["Are nightmares exempt?"],
      nodeType: "place",
      status: "potential",
      aiGenerated: true,
    },
    {
      id: "node_memory_free_commune",
      title: "Memory-Free Commune",
      description: "A fringe settlement refusing all memory transactions.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Ideological counterweight.",
      risk: "May feel preachy.",
      explorationQuestions: ["How do they survive without trade?"],
      nodeType: "faction",
      status: "potential",
      aiGenerated: true,
    },
    {
      id: "node_childhood_debt_collector",
      title: "Childhood Debt Collector",
      description: "Agent who repossesses formative memories for housing creditors.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Personal stakes in economic rules.",
      risk: "Tone can turn grim quickly.",
      explorationQuestions: ["Can debts be inherited?"],
      nodeType: "character",
      status: "potential",
      aiGenerated: true,
    },
    {
      id: "node_forgotten_birthday_market",
      title: "Forgotten Birthday Market",
      description: "Street stalls selling discarded celebration memories cheap.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Bittersweet commerce of lost joy.",
      risk: "Sentimentality.",
      explorationQuestions: ["Who sells their own birthdays?"],
      nodeType: "place",
      status: "potential",
      aiGenerated: true,
    },
  ],
  agents: [],
  criticAgents: [],
  controlRules: {
    mustPreserve: ["memory scarcity premise"],
    mustAvoid: ["unexplained unlimited free memory"],
    generationPriorities: ["economic consequence", "class tension"],
    rankingCriteria: ["canon consistency"],
    expansionRules: ["sibling nodes share currency logic"],
  },
};

function makeFixtureEvent(
  overrides: Partial<UserDecisionEvent> & Pick<UserDecisionEvent, "id" | "target" | "nodeSnapshot">,
): UserDecisionEvent {
  return {
    eventType: "establish_truth",
    decision: "truth",
    worldContext: {
      worldPrompt: FIXTURE_CANVAS.worldSeed,
      purpose: "Explore a sci-fi colony for an interactive fiction game",
      currentPhase: "constellation_exploration",
      activeConstellationId: "constellation_memory_economy",
    },
    timestamp: FIXTURE_TS,
    source: "user_click",
    ...overrides,
  };
}

const fixturePriorPotential = makeFixtureEvent({
  id: "decision_keep_potential_node_public_memory_archive",
  eventType: "keep_potential",
  decision: "potential",
  target: {
    targetType: "node",
    id: "node_public_memory_archive",
    title: "Public Memory Archive",
    displayTitle: "Memory Archive",
    constellationId: "constellation_memory_economy",
    nodeType: "place",
  },
  nodeSnapshot: {
    id: "node_public_memory_archive",
    title: "Public Memory Archive",
    displayTitle: "Memory Archive",
    description: "A civic vault advertised as open to all citizens.",
    nodeType: "place",
    constellationId: "constellation_memory_economy",
    sourceLayer: "constellation_reasoner",
  },
});

const fixtureTrigger = makeFixtureEvent({
  id: "decision_establish_truth_node_housing_memory_trade",
  target: {
    targetType: "node",
    id: "node_housing_memory_trade",
    title: "Private Childhood Memories Traded for Housing Credits",
    displayTitle: "Housing Memory Trade",
    constellationId: "constellation_memory_economy",
    nodeType: "rule",
  },
  nodeSnapshot: {
    id: "node_housing_memory_trade",
    title: "Private Childhood Memories Traded for Housing Credits",
    displayTitle: "Housing Memory Trade",
    description:
      "Citizens may trade private childhood memories directly for housing credits under regulated exchange.",
    nodeType: "rule",
    constellationId: "constellation_memory_economy",
    sourceLayer: "user_created",
  },
  constellationSnapshot: {
    id: "constellation_memory_economy",
    title: "Memory Economy",
    displayTitle: "Memory Economy",
    description: "Who owns a borrowed childhood?",
  },
  canonStateBefore: {
    truthNodeIds: [],
    potentialNodeIds: ["node_public_memory_archive"],
    rejectedNodeIds: [],
    truthCount: 0,
    potentialCount: 1,
    rejectedCount: 0,
  },
});

let fixtureLog = createEmptyDecisionEventLog();
fixtureLog = appendDecisionEvents(fixtureLog, [fixturePriorPotential, fixtureTrigger]);

/** Diverse sci-fi fixture for prompt development — not used at runtime. */
export const RIPPLE_EFFECT_INPUT_FIXTURE: RippleEffectPromptInput = buildRippleEffectInput({
  triggerEvent: fixtureTrigger,
  decisionLog: fixtureLog,
  canvasModel: FIXTURE_CANVAS,
  evaluationMode: "balanced",
  userSteering: {
    instruction: "Keep economic consequences concrete; prefer warnings over mass deletion.",
    targetScope: "constellation",
    intensity: "moderate",
  },
});

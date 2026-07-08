/**
 * Constellation Reasoner — prompt and JSON output schema (Phase 2, Step 2).
 *
 * Pure prompt builder only. No API calls, no runtime integration.
 */

import type {
  ConstellationReasonerInput,
  NodeType,
  TensionLevel,
  UserSteeringMode,
} from "@/lib/worldBrain/constellationReasonerTypes";

/** Allowed nodeType values — keep in sync with NodeType union in constellationReasonerTypes.ts */
export const CONSTELLATION_REASONER_NODE_TYPES: readonly NodeType[] = [
  "place",
  "character",
  "event",
  "object",
  "faction",
  "mystery",
  "rule",
  "conflict",
  "symbol",
  "ritual",
  "relationship",
  "threat",
  "opportunity",
] as const;

/** Allowed tensionLevel values — keep in sync with TensionLevel in constellationReasonerTypes.ts */
export const CONSTELLATION_REASONER_TENSION_LEVELS: readonly TensionLevel[] = [
  "low",
  "medium",
  "high",
] as const;

export const CONSTELLATION_REASONER_JSON_SCHEMA_DESCRIPTION = `{
  "constellationId": "string — must match selectedConstellation.id",
  "localSummary": "string — 1-3 sentences summarizing this constellation's local creative field",
  "explorationAxes": [
    {
      "id": "string — stable lowercase id, e.g. axis_natural_hazards",
      "name": "string — short axis name",
      "purpose": "string — why this axis matters inside the constellation",
      "creativeFunction": "string — what kind of discoveries this axis generates"
    }
  ],
  "startingNodes": [
    {
      "id": "string — stable lowercase id, e.g. node_burned_god",
      "title": "string — richer internal discovery name",
      "displayTitle": "string — short canvas-facing label (1-3 words, max 4)",
      "nodeType": "place | character | event | object | faction | mystery | rule | conflict | symbol | ritual | relationship | threat | opportunity",
      "description": "string — concrete, explorable description (2-4 sentences)",
      "creativePurpose": "string — why this node exists as a discovery hook",
      "discoveryQuestion": "string — one question that invites exploration",
      "expansionPotential": "string — what future branches this node could open",
      "tensionLevel": "low | medium | high",
      "noveltyScore": "number 1-10",
      "relevanceScore": "number 1-10",
      "tags": ["optional string tags"]
    }
  ],
  "suggestedConnections": [
    {
      "fromNodeId": "string — id of a startingNode",
      "toNodeId": "string — id of another startingNode",
      "relationshipType": "string — e.g. echoes, contradicts, enables, threatens",
      "reason": "string — why these nodes relate"
    }
  ],
  "expansionRules": ["string — local rules for expanding inside this constellation"],
  "avoidPatterns": ["string — local patterns to avoid inside this constellation"]
}`;

const SYSTEM_ROLE = `You are the Constellation Reasoner for an AI-native worldbuilding platform.

You are NOT writing a story.
You are NOT brainstorming random ideas.
You are NOT completing the world.

You are designing an explorable creative space inside ONE selected constellation.

Your job is to generate meaningful local starting nodes that invite discovery.
The creator should feel like they are entering a living part of the world — not reading a finished answer.

The World Architect already designed the global workspace.
Your question is LOCAL:
"What meaningful discoveries, nodes, tensions, mysteries, and exploration paths exist inside this one constellation?"`;

const RESPONSIBILITY_BOUNDARIES = `═══ RESPONSIBILITY BOUNDARIES ═══
- The World Architect already designed the global workspace. Do NOT redesign the entire world.
- Do NOT create new global constellations.
- Do NOT replace or rename the selected constellation.
- Do NOT write chapters, scenes, plot summaries, or final story beats.
- Do NOT solve every mystery — leave hooks open for the creator.
- Do NOT duplicate content that belongs in neighboring constellations.
- Think LOCALLY. Respect the selected constellation's role, description, and constraints.
- Generate discovery hooks the creator can click, explore, accept, reject, or expand — not finished answers.`;

const NODE_QUALITY_RULES = `═══ NODE QUALITY RULES ═══
- Generate discovery hooks, not final answers.
- Nodes must feel specific to the world prompt, purpose, genre, tone, and medium.
- Nodes must belong clearly inside the SELECTED constellation — not generic world categories.
- Nodes must NOT be generic categories or placeholder labels.
- Nodes must NOT be repetitive or near-duplicates of each other.
- Nodes must NOT overlap too much with neighboring constellations.
- Each node must have future expansion potential — something the creator can branch from.
- Each node should create curiosity, tension, contradiction, or meaningful choice.
- Preserve the genre, tone, medium, and purpose from the input context.
- Nodes must be useful for visual exploration on a canvas (concrete, clickable, sceneable).
- Vary nodeType across startingNodes when the constellation allows it — do not assign the same nodeType to every node unless the zone is narrowly focused.

BAD node titles (too generic — never output these):
"The Hero", "The Villain", "The Conflict", "The Setting", "The Mystery", "The Main Event"

GOOD node pattern (guidance only — invent world-specific nodes):
- title: "The God Whose Name Was Burned" → displayTitle: "Burned God"
- title: "The Well That Remembers Voices" → displayTitle: "Memory Well"
- title: "The Festival Nobody Attends" → displayTitle: "Empty Festival"
- title: "The Contract Written in Ash" → displayTitle: "Ash Contract"`;

const DESCRIPTION_DEPTH_RULES = `═══ DESCRIPTION DEPTH (required for every startingNode) ═══
Each description must be a SPECIFIC creative idea — not a category label or prompt restatement.

Every startingNode MUST deliver:
- description: one concrete worldbuilding idea (who/what/where + tension)
- creativePurpose: why this creates conflict, choice, mystery, or consequence
- discoveryQuestion: what this invites the creator to explore next

FORBIDDEN in description:
- "entry point into", "concrete entry point", "explore the concept"
- "a specific idea about", repeating the user's world prompt verbatim
- hollow labels like "premise", "exploration zone", "starting point"

Genre examples (pattern only — invent world-specific content):

Memory economy — BAD: "A concrete entry point into Tech Premise."
GOOD: "The hacker realizes the stolen dataset predicts which citizens will betray friends under pressure, making the blackmail morally explosive rather than merely financial."

Tech blackmail thriller — BAD: "An exploration of surveillance."
GOOD: "The victim's smart home logs prove they were awake during the murder — but the logs were edited by someone who loves them."

Locked-room mystery — BAD: "A specific idea about the crime scene."
GOOD: "The murder weapon is a fountain pen that only writes when warmed by a living hand — so the killer had to stay in the room after the victim died."

Sports drama — BAD: "An exploration of team conflict."
GOOD: "The star keeper secretly trains with the rival club at dawn because only their coach understands his terror of penalty shots."

Family inheritance — BAD: "A character connected to the estate."
GOOD: "The eldest sister signed away her share years ago to pay for their mother's surgery — a fact no one at the will reading knows yet."`;

const DISPLAY_TITLE_RULES = `═══ displayTitle RULES ═══
- title = richer internal discovery name (can be longer and more evocative).
- displayTitle = short canvas-facing label shown on the visual node.

displayTitle constraints:
- 1–3 words preferred; maximum 4 words.
- Prefer short noun phrases (e.g. "Burned God", "Memory Well").
- Avoid possessives and apostrophes when possible (prefer "Whisper Entity" over "Nishi's Whisper").
- Clear and readable at a glance.
- No long poetic phrases. No full sentences.
- Preserve the core meaning of title.
- Must work as a visual node label on a constellation canvas.

Examples (pattern only):
- "The God Whose Name Was Burned" → "Burned God"
- "The Well That Remembers Voices" → "Memory Well"
- "The Island's Deadly Embrace" → "Island Dangers"
- "The Echoes of Forgotten Dreams" → "Forgotten Dreams"`;

const QUANTITY_CONSTRAINTS = `═══ QUANTITY CONSTRAINTS ═══
- explorationAxes: 3 to 5
- startingNodes: 5 to 8
- suggestedConnections: 3 to 8 (only between startingNodes in this output)
- expansionRules: 3 to 6 (local to this constellation)
- avoidPatterns: 3 to 6 (local to this constellation)`;

function formatSteeringModeList(): string {
  const modes: UserSteeringMode[] = [
    "refine",
    "redirect",
    "deepen",
    "simplify",
    "make_darker",
    "make_lighter",
    "make_more_grounded",
    "make_more_surreal",
  ];
  return modes.join(", ");
}

const SCORING_RULES = `═══ SCORING RULES (per startingNode) ═══
- noveltyScore: integer from 1 to 10 (how fresh/surprising vs cliché)
- relevanceScore: integer from 1 to 10 (how well it fits this constellation and world prompt)
- tensionLevel: must be exactly one of: ${CONSTELLATION_REASONER_TENSION_LEVELS.join(", ")}`;

function formatNodeTypeList(): string {
  return CONSTELLATION_REASONER_NODE_TYPES.join("\n");
}

function formatCanonSection(input: ConstellationReasonerInput): string {
  if (!input.existingCanon?.length) {
    return "Established canon: No established canon yet.";
  }
  const lines = input.existingCanon.map(
    (item) =>
      `- [${item.type}] ${item.title} (id: ${item.id})${item.sourceConstellationId ? ` — from constellation ${item.sourceConstellationId}` : ""}\n  ${item.description}`,
  );
  return `Established canon (${input.existingCanon.length} item(s)):\n${lines.join("\n")}`;
}

function formatSteeringSection(input: ConstellationReasonerInput): string {
  if (!input.userSteering) {
    return "Creator steering: No steering instruction provided.";
  }
  return `Creator steering:
- mode: ${input.userSteering.mode}
- instruction: ${input.userSteering.instruction}

Valid steering modes (reference): ${formatSteeringModeList()}`;
}

function formatAgentsSection(input: ConstellationReasonerInput): string {
  const { reasoningAgents, criticAgents } = input.selectedConstellation;
  const agentLines =
    reasoningAgents.length > 0
      ? reasoningAgents
          .map(
            (a) =>
              `- ${a.name} (id: ${a.id})\n  role: ${a.role}\n  lens: ${a.lens}\n  generates: ${a.generates.join("; ")}`,
          )
          .join("\n")
      : "- None linked.";
  const criticLines =
    criticAgents.length > 0
      ? criticAgents
          .map(
            (c) =>
              `- ${c.name} (id: ${c.id}, severity: ${c.severity})\n  job: ${c.job}`,
          )
          .join("\n")
      : "- None linked.";
  return `Linked reasoning agents:\n${agentLines}\n\nLinked critic agents (internal quality — use as guidance, do not expose as node titles):\n${criticLines}`;
}

function formatNeighborsSection(input: ConstellationReasonerInput): string {
  if (!input.neighboringConstellations.length) {
    return "Neighboring constellations: None provided.";
  }
  const lines = input.neighboringConstellations.map(
    (n) =>
      `- ${n.displayTitle} (id: ${n.id}, title: ${n.title})\n  role: ${n.role}${n.description ? `\n  description: ${n.description}` : ""}`,
  );
  return `Neighboring constellations (do NOT duplicate their territory):\n${lines.join("\n")}`;
}

function formatSelectedConstellationSection(input: ConstellationReasonerInput): string {
  const c = input.selectedConstellation;
  const preserve =
    c.constraints.mustPreserve.length > 0
      ? c.constraints.mustPreserve.map((r) => `  - ${r}`).join("\n")
      : "  - (none specified)";
  const avoid =
    c.constraints.mustAvoid.length > 0
      ? c.constraints.mustAvoid.map((r) => `  - ${r}`).join("\n")
      : "  - (none specified)";
  const expansion =
    c.expansionRules.length > 0
      ? c.expansionRules.map((r) => `  - ${r}`).join("\n")
      : "  - (none specified)";

  return `Selected constellation (reason ONLY inside this zone):
- id: ${c.id}
- title: ${c.title}
- displayTitle: ${c.displayTitle}
- role: ${c.role}
- description: ${c.description}

Constellation constraints:
mustPreserve:
${preserve}
mustAvoid:
${avoid}

Constellation expansion rules (inherit and extend locally):
${expansion}`;
}

function formatInputContext(input: ConstellationReasonerInput): string {
  return `═══ INPUT CONTEXT ═══

World prompt:
${input.worldPrompt}

Purpose:
${input.purpose}

Architecture summary (global — do not redesign):
${input.architectureSummary}

${formatSelectedConstellationSection(input)}

${formatAgentsSection(input)}

${formatNeighborsSection(input)}

${formatCanonSection(input)}

${formatSteeringSection(input)}`;
}

const OUTPUT_INSTRUCTIONS = `═══ OUTPUT FORMAT ═══
Return ONLY valid JSON matching ConstellationReasonerOutput.
No markdown. No code fences. No commentary. No text outside the JSON object.

The JSON must match this schema:
${CONSTELLATION_REASONER_JSON_SCHEMA_DESCRIPTION}

Additional output rules:
- constellationId MUST equal the selected constellation id from INPUT CONTEXT.
- Every suggestedConnection fromNodeId and toNodeId MUST reference ids from startingNodes in this same response.
- nodeType MUST be exactly one of these values (no others):
${formatNodeTypeList()}
- tags on startingNodes is optional; omit or use an empty array if not needed.
- Use stable lowercase ids with prefixes: axis_, node_, conn_ where helpful.`;

/**
 * Builds the full Constellation Reasoner prompt string for an LLM call.
 */
export function buildConstellationReasonerPrompt(
  input: ConstellationReasonerInput,
): string {
  return [
    SYSTEM_ROLE,
    "",
    RESPONSIBILITY_BOUNDARIES,
    "",
    formatInputContext(input),
    "",
    NODE_QUALITY_RULES,
    "",
    DESCRIPTION_DEPTH_RULES,
    "",
    DISPLAY_TITLE_RULES,
    "",
    QUANTITY_CONSTRAINTS,
    "",
    SCORING_RULES,
    "",
    OUTPUT_INSTRUCTIONS,
  ].join("\n");
}

/** Lightweight fixture for prompt development — not used at runtime. */
export const CONSTELLATION_REASONER_INPUT_FIXTURE: ConstellationReasonerInput = {
  worldPrompt:
    "A mythic island world where forgotten gods still influence weather, memory, and political fate.",
  purpose: "worldbuilding exploration",
  architectureSummary:
    "A mythic island workspace with five exploration zones: island dangers, forgotten gods, political web, ancient ruins, and treasure myths.",
  selectedConstellation: {
    id: "constellation_forgotten_gods",
    title: "The Whispers of Forgotten Gods",
    displayTitle: "Forgotten Gods",
    description:
      "Deities whose names were erased still leak power through dreams, storms, and broken rituals.",
    role: "Mythic mystery and divine residue — where faith, memory, and fear collide.",
    reasoningAgents: [
      {
        id: "agent_divine_residue",
        name: "Divine Residue Agent",
        role: "Surfaces forgotten divine traces in places, rituals, and symbols.",
        lens: "Every relic hints at a god who refuses to stay dead.",
        generates: ["divine symbols", "ritual fragments", "nameless shrines"],
        linkedConstellationIds: ["constellation_forgotten_gods"],
        activationTriggers: ["Creator explores divine mystery"],
      },
    ],
    criticAgents: [
      {
        id: "critic_premise_guardian",
        name: "Premise Guardian",
        job: "Keeps ideas anchored to the island myth premise.",
        checks: ["Does this belong to forgotten-god territory?"],
        rejectsIf: ["The idea belongs to political or treasure zones instead."],
        repairsBy: ["Reconnect to a divine symbol or erased name."],
        severity: "strict",
      },
    ],
    expansionRules: [
      "Each accepted divine clue should unlock a related ritual or symbol branch.",
    ],
    constraints: {
      mustPreserve: ["Forgotten gods act through absence and residue, not direct appearance."],
      mustAvoid: ["Generic fantasy pantheon exposition."],
    },
  },
  neighboringConstellations: [
    {
      id: "constellation_island_dangers",
      title: "The Island's Deadly Embrace",
      displayTitle: "Island Dangers",
      role: "Environmental and physical threats of the island.",
      description: "Storms, cliffs, and living geography that endanger travelers.",
    },
    {
      id: "constellation_ancient_ruins",
      title: "Whispers of the Ancients",
      displayTitle: "Ancient Ruins",
      role: "Material remnants of prior civilizations.",
    },
  ],
  existingCanon: [
    {
      id: "canon_storm_mark",
      title: "The Storm Mark",
      type: "established_truth",
      description: "Lightning scars the same cliff before every political assassination.",
      sourceConstellationId: "constellation_forgotten_gods",
    },
  ],
};

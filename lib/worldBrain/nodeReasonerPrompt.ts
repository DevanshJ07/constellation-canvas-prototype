/**
 * Node Reasoner — prompt and JSON output schema (Phase 3, Step 2).
 *
 * Pure prompt builder only. No API calls, no runtime integration.
 */

import { CONSTELLATION_REASONER_NODE_TYPES } from "@/lib/worldBrain/constellationReasonerPrompt";
import type {
  NodeReasonerInput,
  NodeReasonerSteeringMode,
} from "@/lib/worldBrain/nodeReasonerTypes";

/** Allowed nodeType values — keep in sync with NodeReasonerNodeType in nodeReasonerTypes.ts */
export const NODE_REASONER_NODE_TYPES = CONSTELLATION_REASONER_NODE_TYPES;

export const NODE_REASONER_CONTINUATION_DISTANCES = [
  "direct",
  "near",
  "far",
] as const;

export const NODE_REASONER_DRIFT_RISKS = ["low", "medium", "high"] as const;

export const NODE_REASONER_SCOPE_LEVELS = [
  "narrow",
  "moderate",
  "wide",
] as const;

export const NODE_REASONER_BRANCH_TYPES = [
  "deeper_detail",
  "alternate_version",
  "consequence",
  "origin",
  "hidden_truth",
  "character_impact",
  "world_rule",
  "conflict",
  "sensory_detail",
  "choice_point",
  "connection",
] as const;

export const NODE_REASONER_CONTINUATION_TYPES = [
  "direct_deepening",
  "variation",
  "consequence",
  "origin",
  "contradiction",
  "hidden_layer",
  "relationship",
  "choice",
  "obstacle",
  "clue",
] as const;

export const NODE_REASONER_CONSEQUENCE_SCOPES = [
  "node",
  "constellation",
  "world",
  "character",
  "plot",
  "tone",
] as const;

export const NODE_REASONER_CONSEQUENCE_SEVERITIES = [
  "low",
  "medium",
  "high",
] as const;

export const NODE_REASONER_CONSEQUENCE_REVERSIBILITY = [
  "reversible",
  "difficult_to_reverse",
  "permanent",
] as const;

export const NODE_REASONER_RELATIONSHIP_STRENGTHS = [
  "weak",
  "moderate",
  "strong",
] as const;

export const NODE_REASONER_JSON_SCHEMA_DESCRIPTION = `{
  "sourceNodeId": "string — must match input selectedNode.id",
  "sourceConstellationId": "string — must match input selectedNode.constellationId",
  "nodeSummary": "string — 1-3 sentences summarizing what the selected node is and why it matters",
  "continuationPrinciple": "string — one sentence principle for how continuations must grow from this node",
  "explorationScope": {
    "scopeLevel": "narrow | moderate | wide",
    "reason": "string — why this node deserves this scope",
    "recommendedBranchCount": "number — target count for possibleNewNodes"
  },
  "suggestedDepth": "number — recommended depth level for next expansion (1 = first sub-layer)",
  "expansionBranches": [
    {
      "id": "string — stable lowercase id, e.g. branch_hidden_stair",
      "title": "string — richer internal branch name",
      "displayTitle": "string — short canvas label (1-3 words, max 4)",
      "branchType": "deeper_detail | alternate_version | consequence | origin | hidden_truth | character_impact | world_rule | conflict | sensory_detail | choice_point | connection",
      "description": "string — what this branch explores (2-3 sentences)",
      "continuationAnchor": "string — exact part of the selected node being continued",
      "continuationDistance": "direct | near | far",
      "whyItContinuesTheNode": "string — explicit justification of continuity",
      "creativeFunction": "string — what kind of discovery this branch generates",
      "depthPotential": "string — what further expansion this branch could open",
      "riskOfDrift": "low | medium | high",
      "recommended": "boolean — true if this is a strong recommended direction"
    }
  ],
  "possibleNewNodes": [
    {
      "id": "string — stable lowercase id, e.g. subnode_windless_bell",
      "title": "string — richer internal discovery name",
      "displayTitle": "string — short canvas label (1-3 words, max 4)",
      "nodeType": "place | character | event | object | faction | mystery | rule | conflict | symbol | ritual | relationship | threat | opportunity",
      "description": "string — concrete, explorable description (2-4 sentences)",
      "parentNodeId": "string — must equal input selectedNode.id",
      "sourceConstellationId": "string — must equal input selectedNode.constellationId",
      "continuationType": "direct_deepening | variation | consequence | origin | contradiction | hidden_layer | relationship | choice | obstacle | clue",
      "continuationAnchor": "string — exact part of the selected node being continued",
      "continuationDistance": "direct | near | far",
      "whyThisFollows": "string — explicit justification of continuity from the selected node",
      "discoveryQuestion": "string — one question inviting exploration",
      "expansionPotential": "string — what future branches this subnode could open",
      "noveltyScore": "number 1-10",
      "relevanceScore": "number 1-10",
      "continuityScore": "number 1-10 — MOST IMPORTANT score",
      "driftRisk": "low | medium | high",
      "tags": ["optional string tags"]
    }
  ],
  "possibleChoices": [
    {
      "id": "string",
      "choiceText": "string — creator-facing choice label",
      "meaning": "string — what choosing this direction implies",
      "canonImpact": "string — how this choice would affect canon if accepted",
      "opensNodeIds": ["optional ids from possibleNewNodes"],
      "closesPossibilityIds": ["optional ids this choice would foreclose"]
    }
  ],
  "consequences": [
    {
      "id": "string",
      "consequence": "string — what may happen if the selected node becomes canon",
      "affectedScope": "node | constellation | world | character | plot | tone",
      "affectedTargets": ["string — specific targets affected"],
      "severity": "low | medium | high",
      "reversibility": "reversible | difficult_to_reverse | permanent"
    }
  ],
  "relationshipSuggestions": [
    {
      "fromNodeId": "string — selected node, sibling, or possibleNewNode id",
      "toNodeId": "string — selected node, sibling, or possibleNewNode id",
      "relationshipType": "string — e.g. reveals, contradicts, enables, echoes",
      "reason": "string — why these nodes relate",
      "strength": "weak | moderate | strong"
    }
  ],
  "avoidPatterns": ["string — node-specific patterns to avoid when expanding this node"]
}`;

const SYSTEM_ROLE = `You are the Node Reasoner for an AI-native worldbuilding platform.

You are NOT writing a story.
You are NOT generating random new ideas.
You are NOT redesigning the world.
You are NOT creating a new constellation.
You are NOT replacing the selected node.

You are deepening ONE selected node.

Your job is to generate context-preserving continuations from the selected node.

Each continuation must grow from a specific anchor inside the selected node.

The World Architect already designed the global workspace.
The Constellation Reasoner already designed the local constellation field.
Your question is MICRO:
"What can be discovered inside, around, beneath, caused by, remembered by, feared in, chosen through, or connected through THIS selected node?"`;

const MENTAL_MODEL = `═══ KEY MENTAL MODEL ═══

Do NOT ask:
- "What else could exist in this world?"
- "What else could exist in this constellation?"

DO ask:
"What can be discovered inside, around, beneath, caused by, remembered by, feared in, chosen through, or connected through this selected node?"

The selected node is the anchor. Never ignore it.

Every generated branch or new node MUST explain:
- which part of the selected node it continues (continuationAnchor)
- why it follows (whyItContinuesTheNode / whyThisFollows)
- how far it is from the selected node (continuationDistance)
- how risky it is in terms of drifting off-context (riskOfDrift / driftRisk)`;

const CONTINUATION_EXAMPLES = `═══ CONTINUATION PATTERN EXAMPLES (guidance only — do NOT reuse unless the user's world matches) ═══

These examples teach the REASONING PATTERN, not content to copy.

Example A — Cave / ancient ruins
World: Five friends lost in a cave encounter mysterious animals and objects while trying to escape.
Constellation: Ancient Ruins
Selected node: Old Temple of Lady
Good: The Cracked Lady Idol, The Bell Without Wind, The Fresh Marigold Offering, The Hidden Sanctum Stair, The Animal Sleeping at Her Feet, The Friend Who Hears Anklets
Why good: Each grows from the temple, lady figure, ritual objects, hidden architecture, animal guardian, or friend interaction.
Bad: Demon King, Lost Army, Floating City, Fire Sword, Random Portal
Why bad: Interesting but unrelated — they create new context instead of continuing the selected node.

Example B — Sci-fi colony
World: A colony where memories are used as currency.
Constellation: Memory Economy
Selected node: Childhood Memory Bank
Good: The Vault of First Words, A Loan Paid in Birthdays, The Clerk Who Forgets Faces, The Memory Receipt, The Account That Belongs to Two People
Bad: Alien War Fleet, Space Pirates, Robot Revolution, New Planet Kingdom
Why good: Deepens the bank, memory transactions, identity loss, records, and personal cost.

Example C — Political fantasy
World: A kingdom ruled by blood oaths.
Constellation: Oath Politics
Selected node: The King's Broken Oath
Good: The Witness Scar, The Blood-Stained Signature, The Noble Who Heard the Oath Crack, The Law That Cannot Name Treason, The Heir Bound by the Broken Promise
Bad: Dragon Volcano, Magic Tournament, Pirate Island, Ancient Spaceship
Why good: Extends oath law, witnesses, consequences, inheritance, and political instability.

Example D — Romance / dream disaster
World: Two people fall in love while dreaming future disasters.
Constellation: Dream Warnings
Selected node: The Train Station Dream
Good: The Platform Clock That Runs Backward, The Stranger Who Knows Their Names, The Ticket Dated Tomorrow, The Choice to Miss the Train, The Dream They Both Remember Differently
Bad: Medieval Castle Siege, Secret Assassin Guild, Random Treasure Map, New Alien Species
Why good: Deepens the train station, shared dream, time clue, romantic choice, and future disaster.

Example E — Comedy treasure hunt
World: A treasure hunt comedy on a cursed island.
Constellation: Treasure Obstacles
Selected node: Map-Eating Crabs
Good: The Half-Digested Map Corner, The Crab That Prefers Fake Clues, The Crew Member Who Negotiates Badly, The Trail of Inked Claws, The Crab Nest Under the X Mark
Bad: Dark Emperor, Snow Kingdom, Space Portal, Ancient Vampire Court
Why good: Deepens the crabs, map, comedy, treasure clue, and crew interaction.`;

const CONTINUATION_ANCHOR_RULES = `═══ continuationAnchor RULES ═══
Every expansionBranch and possibleNewNode MUST include continuationAnchor.

continuationAnchor = the exact part of the selected node being continued.

Anchor types (use what fits the selected node — be specific):
- physical object
- location feature
- ritual
- character interaction
- hidden chamber
- rule
- history
- consequence
- symbol
- sensory clue
- emotional wound
- social relationship
- transaction
- political promise
- escape clue

The anchor must be specific to the selected node — not generic world vocabulary.`;

const CONTINUATION_DISTANCE_RULES = `═══ continuationDistance RULES ═══
Valid values: ${NODE_REASONER_CONTINUATION_DISTANCES.join(", ")}

direct:
Inside the selected node physically or conceptually.
Example for "Old Temple of Lady": cracked idol, offering bowl, inner sanctum, wall painting.

near:
Closely connected to the selected node.
Example: animal guardian, fresh marigold offering, hidden staircase, abandoned ritual.

far:
A broader implication, but still clearly caused by or connected to the selected node.
Example: village that forgot her, friend chosen by the lady, curse on those who leave.

Prefer mostly direct and near continuations.
Use far sparingly — only when the selected node is broad enough to support wider implications.
Do not generate many far continuations for simple or narrow nodes.`;

const SCOPE_AWARE_EXPANSION = `═══ SCOPE-AWARE EXPANSION ═══
Not every node deserves the same number of expansions.

First judge explorationScope for the selected node:

narrow:
Simple, concrete, or limited node (e.g. a rusty key, a single object).
Generate fewer possibilities. recommendedBranchCount: 2–3.

moderate:
Some mystery, consequence, or relational potential.
Generate medium possibilities. recommendedBranchCount: 4–6.

wide:
Rich node with strong mystery, conflict, world-rule, character impact, or canon consequences.
Generate more possibilities. recommendedBranchCount: 6–8.

Output MUST include:
- explorationScope.scopeLevel
- explorationScope.reason
- explorationScope.recommendedBranchCount

The count of possibleNewNodes should roughly match recommendedBranchCount.
Do not always generate the maximum — let scope decide.`;

const ANTI_DRIFT_RULES = `═══ ANTI-DRIFT RULES ═══
Reject or avoid continuations that:
- introduce a new unrelated villain
- introduce a new unrelated location
- create a new global plotline
- ignore the selected node
- duplicate sibling nodes (check siblingNodes list)
- jump to another constellation's responsibility
- solve the entire mystery too early
- become generic story beats ("The Hero", "The Villain", "The Conflict")
- only sound cool but do not follow from the selected node
- have high noveltyScore but low continuityScore

Prefer continuityScore 7 or above for every possibleNewNode.
Avoid high novelty with low continuity.`;

const NODE_DESCRIPTION_DEPTH_RULES = `═══ NODE DESCRIPTION DEPTH (required for every possibleNewNode) ═══
Each possibleNewNode description must deepen the SELECTED node with a specific creative idea.

Required fields:
- description: concrete idea continuing the selected node (not a category)
- whyThisFollows: explicit continuity from the selected node
- discoveryQuestion: what the creator should explore next

FORBIDDEN:
- "entry point into", "explore the concept", prompt restatement
- generic beats ("The Hero", "The Villain", "The Conflict")
- ideas that could exist without the selected node

Examples (pattern only):
Selected: Childhood Memory Bank (memory economy)
GOOD: "A Loan Paid in Birthdays — parents mortgage their child's tenth birthday to pay rent, leaving a gap in her timeline she can feel but not name."

Selected: The Train Station Dream (romance/disaster)
GOOD: "The Ticket Dated Tomorrow — both lovers find the same impossible ticket in their pockets after waking, but only one remembers buying it."

Selected: Map-Eating Crabs (comedy treasure hunt)
GOOD: "The Half-Digested Map Corner — the crew realizes the crabs prefer fake X marks, meaning every decoy on the island was drawn by someone who wanted them lost."`;

const DISPLAY_TITLE_RULES = `═══ displayTitle RULES ═══
- title = richer internal discovery name (can be longer and more evocative).
- displayTitle = short canvas-facing label shown on the visual node.

displayTitle constraints:
- 1–3 words preferred; maximum 4 words.
- Noun phrase preferred.
- No full sentences.
- Avoid apostrophes when possible.
- Preserve the core meaning of title.
- Readable on a canvas at a glance.

Pattern examples (do NOT copy into output unless the user's world matches):
- "The Bell That Rings Without Wind" → "Windless Bell"
- "The Friend Who Hears Anklets" → "Anklet Witness"
- "The Account That Belongs to Two People" → "Shared Account"
- "The Ticket Dated Tomorrow" → "Tomorrow Ticket"`;

const QUANTITY_CONSTRAINTS = `═══ QUANTITY CONSTRAINTS ═══
- explorationScope: exactly 1 object
- expansionBranches: 3 to 8 items
- possibleNewNodes: roughly match explorationScope.recommendedBranchCount
  - narrow scope: 2–3 possibleNewNodes
  - moderate scope: 4–6 possibleNewNodes
  - wide scope: 6–8 possibleNewNodes
- possibleChoices: 2 to 4 items
- consequences: 2 to 5 items
- relationshipSuggestions: 2 to 5 items
- avoidPatterns: 3 to 6 items (specific to the selected node, not generic)`;

const SCORING_RULES = `═══ SCORING RULES (per possibleNewNode) ═══
- noveltyScore: integer 1–10 (how fresh vs cliché)
- relevanceScore: integer 1–10 (how well it fits world, constellation, and selected node)
- continuityScore: integer 1–10 — MOST IMPORTANT
  - 9–10: directly and strongly grows from the selected node
  - 7–8: clearly connected but adds a new angle
  - 5–6: weakly connected; use carefully
  - below 5: should usually NOT be generated
- driftRisk: must be exactly one of: ${NODE_REASONER_DRIFT_RISKS.join(", ")}
- riskOfDrift on expansionBranches: same values as driftRisk`;

function formatNodeTypeList(): string {
  return NODE_REASONER_NODE_TYPES.join("\n");
}

function formatSteeringModeList(): string {
  const modes: NodeReasonerSteeringMode[] = [
    "make_more_specific",
    "make_more_personal",
    "make_more_dangerous",
    "make_more_mysterious",
    "make_more_emotional",
    "make_more_grounded",
    "make_more_surreal",
    "reduce_scope",
    "expand_scope",
    "connect_to_character",
    "connect_to_world_rule",
    "connect_to_escape_goal",
  ];
  return modes.join(", ");
}

function formatCanonSection(input: NodeReasonerInput): string {
  if (!input.existingCanon?.length) {
    return "Established canon: No established canon yet.";
  }
  const lines = input.existingCanon.map(
    (item) =>
      `- [${item.type}] ${item.title} (id: ${item.id})${item.sourceConstellationId ? ` — from constellation ${item.sourceConstellationId}` : ""}\n  ${item.description}`,
  );
  return `Established canon (${input.existingCanon.length} item(s)):\n${lines.join("\n")}`;
}

function formatSteeringSection(input: NodeReasonerInput): string {
  if (!input.userSteering) {
    return "Creator steering: No user steering instruction provided.";
  }
  return `Creator steering:
- mode: ${input.userSteering.mode}
- instruction: ${input.userSteering.instruction}

Valid steering modes (reference): ${formatSteeringModeList()}`;
}

function formatDepthContextSection(input: NodeReasonerInput): string {
  if (!input.depthContext) {
    return "Depth context: This is the first expansion from the selected node (depth level 1).";
  }
  const dc = input.depthContext;
  const trailLines =
    dc.parentTrail.length > 0
      ? dc.parentTrail
          .map(
            (t, i) =>
              `  ${i + 1}. ${t.displayTitle} (id: ${t.nodeId}, title: ${t.title})${t.nodeType ? ` [${t.nodeType}]` : ""}`,
          )
          .join("\n")
      : "  - (empty trail — direct from constellation entry)";
  return `Depth context:
- depthLevel: ${dc.depthLevel}
- expansionMode: ${dc.expansionMode ?? "(not specified)"}
- maxDepthHint: ${dc.maxDepthHint ?? "(not specified)"}
- parentTrail (path from constellation to selected node):
${trailLines}`;
}

function formatConstellationSection(input: NodeReasonerInput): string {
  const c = input.selectedConstellation;
  const axes =
    c.explorationAxes?.length
      ? c.explorationAxes
          .map((a) => `  - ${a.name} (id: ${a.id}): ${a.purpose}`)
          .join("\n")
      : "  - (none provided)";

  return `Selected constellation (context only — do NOT expand the whole constellation):
- id: ${c.id}
- title: ${c.title}
- displayTitle: ${c.displayTitle}
- description: ${c.description}
${c.role ? `- role: ${c.role}` : ""}
${c.localSummary ? `- localSummary: ${c.localSummary}` : ""}
- explorationAxes:
${axes}`;
}

function formatSelectedNodeSection(input: NodeReasonerInput): string {
  const n = input.selectedNode;
  const optional = [
    n.creativePurpose ? `- creativePurpose: ${n.creativePurpose}` : "",
    n.discoveryQuestion ? `- discoveryQuestion: ${n.discoveryQuestion}` : "",
    n.expansionPotential ? `- expansionPotential: ${n.expansionPotential}` : "",
    n.tensionLevel ? `- tensionLevel: ${n.tensionLevel}` : "",
    n.noveltyScore != null ? `- noveltyScore: ${n.noveltyScore}` : "",
    n.relevanceScore != null ? `- relevanceScore: ${n.relevanceScore}` : "",
    n.parentNodeId ? `- parentNodeId: ${n.parentNodeId}` : "",
    n.tags?.length ? `- tags: ${n.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `Selected node (THE ANCHOR — all continuations must grow from this node):
- id: ${n.id}
- title: ${n.title}
- displayTitle: ${n.displayTitle}
- nodeType: ${n.nodeType}
- constellationId: ${n.constellationId}
- description: ${n.description}
${optional}`;
}

function formatSiblingSection(input: NodeReasonerInput): string {
  if (!input.siblingNodes.length) {
    return "Sibling nodes: None provided.";
  }
  const lines = input.siblingNodes.map(
    (s) =>
      `- ${s.displayTitle} (id: ${s.id}, title: ${s.title})${s.nodeType ? ` [${s.nodeType}]` : ""}${s.description ? `\n  ${s.description}` : ""}`,
  );
  return `Sibling nodes (do NOT duplicate or regenerate these — deepen the selected node instead):\n${lines.join("\n")}`;
}

function formatNeighborsSection(input: NodeReasonerInput): string {
  if (!input.neighboringConstellations.length) {
    return "Neighboring constellations: None provided.";
  }
  const lines = input.neighboringConstellations.map(
    (n) =>
      `- ${n.displayTitle} (id: ${n.id})\n  role: ${n.role}${n.description ? `\n  description: ${n.description}` : ""}`,
  );
  return `Neighboring constellations (awareness only — do NOT jump into their territory):\n${lines.join("\n")}`;
}

function formatInputContext(input: NodeReasonerInput): string {
  return `═══ INPUT CONTEXT ═══

World prompt:
${input.worldPrompt}

Purpose:
${input.purpose}

Architecture summary (global — do not redesign):
${input.architectureSummary}

${formatConstellationSection(input)}

${formatSelectedNodeSection(input)}

${formatSiblingSection(input)}

${formatNeighborsSection(input)}

${formatDepthContextSection(input)}

${formatCanonSection(input)}

${formatSteeringSection(input)}`;
}

const OUTPUT_INSTRUCTIONS = `═══ OUTPUT FORMAT ═══
Return ONLY valid JSON matching NodeReasonerOutput.
No markdown. No code fences. No commentary. No text outside the JSON object.

The JSON must match this schema:
${NODE_REASONER_JSON_SCHEMA_DESCRIPTION}

Additional output consistency rules:
- sourceNodeId MUST equal input selectedNode.id from INPUT CONTEXT.
- sourceConstellationId MUST equal input selectedNode.constellationId.
- Every possibleNewNode.parentNodeId MUST equal input selectedNode.id.
- Every possibleNewNode.sourceConstellationId MUST equal input selectedNode.constellationId.
- relationshipSuggestions fromNodeId and toNodeId MUST reference valid ids from: selected node, sibling nodes, or possibleNewNodes in this response.
- avoidPatterns must be specific to the selected node — not generic writing advice.
- branchType MUST be exactly one of: ${NODE_REASONER_BRANCH_TYPES.join(", ")}.
- continuationType MUST be exactly one of: ${NODE_REASONER_CONTINUATION_TYPES.join(", ")}.
- continuationDistance MUST be exactly one of: ${NODE_REASONER_CONTINUATION_DISTANCES.join(", ")}.
- nodeType MUST be exactly one of these values (no others):
${formatNodeTypeList()}
- tags on possibleNewNodes is optional; omit or use an empty array if not needed.
- Use stable lowercase ids with prefixes: branch_, subnode_, choice_, cons_, rel_ where helpful.`;

/**
 * Builds the full Node Reasoner prompt string for an LLM call.
 */
export function buildNodeReasonerPrompt(input: NodeReasonerInput): string {
  return [
    SYSTEM_ROLE,
    "",
    MENTAL_MODEL,
    "",
    formatInputContext(input),
    "",
    CONTINUATION_EXAMPLES,
    "",
    CONTINUATION_ANCHOR_RULES,
    "",
    CONTINUATION_DISTANCE_RULES,
    "",
    SCOPE_AWARE_EXPANSION,
    "",
    ANTI_DRIFT_RULES,
    "",
    NODE_DESCRIPTION_DEPTH_RULES,
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
export const NODE_REASONER_INPUT_FIXTURE: NodeReasonerInput = {
  worldPrompt: "A treasure hunt comedy on a cursed island.",
  purpose: "Explore a fictional universe for an animated series",
  architectureSummary:
    "A cursed island comedy workspace with treasure obstacles, blundering crew dynamics, island tricks, and ancient ruins.",
  selectedConstellation: {
    id: "constellation_treasure_obstacles",
    title: "Treasure Obstacles and Cursed Clues",
    displayTitle: "Treasure Obstacles",
    description:
      "Comedic hazards, misleading clues, and cursed objects that block the crew's path to treasure.",
    role: "Comedy obstacle engine — every trap should amplify crew flaws.",
    localSummary:
      "This zone defines what gets in the crew's way while hunting treasure — traps, creatures, and cursed objects that turn pursuit into chaos.",
  },
  selectedNode: {
    id: "node_map_eating_crabs",
    title: "The Map-Eating Crabs of Deadman's Cove",
    displayTitle: "Map-Eating Crabs",
    nodeType: "threat",
    description:
      "Aggressive crabs that devour paper maps and leave only ink-stained claw trails toward false X marks.",
    creativePurpose:
      "Turn navigation into comedy — the crew loses directions while the island mocks them.",
    discoveryQuestion:
      "Do the crabs eat maps randomly, or do they prefer certain kinds of clues?",
    expansionPotential:
      "Crab nest, half-digested map fragment, crew negotiation attempt, crab whisperer myth.",
    tensionLevel: "low",
    constellationId: "constellation_treasure_obstacles",
  },
  siblingNodes: [
    {
      id: "node_quicksand_shortcut",
      title: "The Quicksand That Looks Like a Shortcut",
      displayTitle: "Quicksand Shortcut",
      nodeType: "threat",
      description: "A sand pit disguised as a faster path to the treasure grove.",
    },
    {
      id: "node_cursed_coconut",
      title: "The Coconut That Grants Bad Advice",
      displayTitle: "Bad Advice Coconut",
      nodeType: "object",
      description: "A talking coconut that gives confidently wrong directions.",
    },
  ],
  neighboringConstellations: [
    {
      id: "constellation_blundering_crew",
      title: "The Blundering Crew",
      displayTitle: "Blundering Crew",
      role: "Character comedy and inter-crew friction.",
    },
    {
      id: "constellation_island_whims",
      title: "Island Wicked Whims",
      displayTitle: "Island Whims",
      role: "Environmental tricks and cursed island personality.",
    },
  ],
};

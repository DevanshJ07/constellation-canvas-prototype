/**
 * Manual quota-safe fixture test for Node Reasoner.
 * Calls only /api/world/node-reasoner once.
 * Does not call Architect or Constellation Reasoner.
 * No retry loop. Fail fast on HTTP 429.
 *
 * Requires dev server running: npm run dev
 * Run only after Gemini quota has reset:
 *   npx tsx scripts/test-node-reasoner-fixture.mts
 */

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const WORLD_PROMPT =
  "a group of 5 friends lost in a cave and encounter mysterious animals and objects in their way to escape";
const PURPOSE = "Explore a fictional universe for a novel";
const SELECTED_CONSTELLATION_ID = "constellation_ancient_ruins";
const SELECTED_NODE_ID = "node_old_temple_lady";

const canvasModel = {
  worldSeed: WORLD_PROMPT,
  worldSummary:
    "A survival mystery about five friends navigating a cave system filled with strange creatures, ritual objects, and clues that may lead either to escape or deeper entrapment.",
  constellations: [
    {
      id: "constellation_ancient_ruins",
      title: "Ancient Ruins",
      displayTitle: "Ancient Ruins",
      description:
        "A buried ritual zone inside the cave where old structures, forgotten shrines, and strange objects suggest that people once worshipped something beneath the earth.",
      question: "What forgotten structures and ritual objects shape the friends' escape?",
      priority: 1,
      agentIds: [],
      nodeIds: ["node_old_temple_lady"],
    },
    {
      id: "constellation_labyrinth",
      title: "The Labyrinth Below",
      displayTitle: "Labyrinth",
      description: "Twisting passages that rearrange when the friends split up or argue.",
      question: "How does the cave maze punish poor teamwork?",
      priority: 2,
      agentIds: [],
      nodeIds: [],
    },
    {
      id: "constellation_cave_creatures",
      title: "Cave Creatures",
      displayTitle: "Cave Creatures",
      description: "Bioluminescent animals and guardians that react to sound, fear, and offerings.",
      question: "Which creatures block escape and which ones hint at a path out?",
      priority: 3,
      agentIds: [],
      nodeIds: [],
    },
    {
      id: "constellation_bonds_under_strain",
      title: "Bonds Under Strain",
      displayTitle: "Bonds Under Strain",
      description: "Friendship fractures under pressure as secrets and blame surface in the dark.",
      question: "Who breaks trust first when the cave offers false hope?",
      priority: 4,
      agentIds: [],
      nodeIds: [],
    },
  ],
  nodes: [],
  agents: [],
  criticAgents: [],
  controlRules: {
    mustPreserve: ["five friends", "cave survival", "mysterious animals and objects"],
    mustAvoid: ["generic fantasy war", "unrelated space sci-fi"],
    generationPriorities: ["ritual mystery", "escape clues", "character tension"],
    rankingCriteria: ["relevance to cave", "continuation from selected node"],
    expansionRules: ["deepen selected node before widening scope"],
  },
};

const availableNodes = [
  {
    id: "node_old_temple_lady",
    title: "The Old Temple of the Lady Beneath the Cave",
    displayTitle: "Old Lady Temple",
    nodeType: "place",
    description:
      "An abandoned stone temple hidden inside the cave, centered around a worn female idol whose face has been scratched away. The friends find fresh marigolds near the idol even though no one should have entered for years.",
    creativePurpose:
      "Creates a focused mystery object/location that can deepen into ritual, fear, escape clues, and character decisions.",
    discoveryQuestion:
      "Who still leaves offerings here, and why does the temple seem to react to the five friends?",
    expansionPotential:
      "Can branch into idol details, hidden chambers, animal guardians, ritual rules, friend-specific visions, and escape clues.",
    tensionLevel: "high",
    noveltyScore: 8,
    relevanceScore: 9,
    tags: ["temple", "idol", "offering", "escape clue"],
    constellationId: SELECTED_CONSTELLATION_ID,
  },
  {
    id: "node_echo_chamber",
    title: "The Echo Chamber That Repeats Names",
    displayTitle: "Echo Chamber",
    nodeType: "place",
    description:
      "A domed cavern where whispers return as if spoken by someone else, sometimes using names the friends never said aloud.",
    creativePurpose: "Tests trust and memory while hinting at something listening.",
    discoveryQuestion: "Is the echo mimicking them or answering?",
    expansionPotential: "Hidden speaker, ritual acoustics, friend-specific echoes.",
    tensionLevel: "medium",
    constellationId: SELECTED_CONSTELLATION_ID,
  },
  {
    id: "node_crystal_sentinels",
    title: "Crystal Sentinels at the Ruin Gate",
    displayTitle: "Crystal Sentinels",
    nodeType: "creature",
    description:
      "Still crystal formations shaped like kneeling figures that warm when touched and hum when offerings are removed.",
    creativePurpose: "Guardian obstacle tied to ritual respect.",
    discoveryQuestion: "Do the sentinels protect the temple or imprison intruders?",
    expansionPotential: "Activation rules, cracked sentinel, animal nesting inside.",
    tensionLevel: "high",
    constellationId: SELECTED_CONSTELLATION_ID,
  },
  {
    id: "node_memory_siphons",
    title: "Memory Siphons in the Offering Pool",
    displayTitle: "Memory Siphons",
    nodeType: "object",
    description:
      "Shallow pools near the ruin that steal brief memories when stared into, leaving only the scent of marigolds.",
    creativePurpose: "Links ritual objects to personal cost and escape clues.",
    discoveryQuestion: "What memory must be sacrificed to read the pool?",
    expansionPotential: "Stolen childhood memory, borrowed voice, map fragment in reflection.",
    tensionLevel: "high",
    constellationId: SELECTED_CONSTELLATION_ID,
  },
  {
    id: "node_shifting_obelisk",
    title: "The Shifting Obelisk Between Passages",
    displayTitle: "Shifting Obelisk",
    nodeType: "object",
    description:
      "A carved stone pillar that rotates silently to block or reveal passages depending on how the friends stand around it.",
    creativePurpose: "Spatial puzzle tied to group formation and ritual geometry.",
    discoveryQuestion: "Does the obelisk respond to number, fear, or prayer?",
    expansionPotential: "Carved instructions, friend who must stand alone, hidden stair.",
    tensionLevel: "medium",
    constellationId: SELECTED_CONSTELLATION_ID,
  },
];

const requestBody = {
  canvasModel,
  selectedConstellationId: SELECTED_CONSTELLATION_ID,
  selectedNodeId: SELECTED_NODE_ID,
  availableNodes,
  worldPrompt: WORLD_PROMPT,
  purpose: PURPOSE,
  architectureSummary:
    "A cave survival world where five friends navigate mysterious creatures, ritual objects, ancient structures, and trust-breaking obstacles while searching for escape.",
  localSummary:
    "Ancient Ruins explores buried structures and ritual traces inside the cave, turning objects and old worship spaces into clues, dangers, and decisions.",
  explorationAxes: [
    {
      id: "axis_ritual_objects",
      name: "Ritual Objects",
      purpose: "Explore objects that imply old worship and hidden rules.",
      creativeFunction: "Turns physical artifacts into mystery and choice.",
    },
    {
      id: "axis_hidden_architecture",
      name: "Hidden Architecture",
      purpose: "Explore chambers, doors, stairs, and spaces beneath the ruin.",
      creativeFunction: "Creates spatial discovery and escape possibilities.",
    },
    {
      id: "axis_friend_reactions",
      name: "Friend Reactions",
      purpose: "Explore how different friends respond to the temple.",
      creativeFunction: "Connects the ruin to character tension.",
    },
  ],
};

type PossibleNewNode = {
  displayTitle: string;
  continuationAnchor: string;
  continuationDistance: "direct" | "near" | "far";
  continuityScore: number;
  driftRisk: "low" | "medium" | "high";
  whyThisFollows: string;
};

type NodeReasonerResponse = {
  success?: boolean;
  error?: string;
  output?: {
    explorationScope: {
      scopeLevel: string;
      recommendedBranchCount: number;
    };
    possibleNewNodes: PossibleNewNode[];
  };
};

function printReport(data: NodeReasonerResponse) {
  console.log("\n=== Node Reasoner Fixture Report ===");
  console.log(`success: ${data.success ?? false}`);

  if (!data.success || !data.output) {
    console.log(`error: ${data.error ?? "unknown"}`);
    return;
  }

  const { output } = data;
  const nodes = output.possibleNewNodes;
  const avgContinuity =
    nodes.length > 0
      ? nodes.reduce((s, n) => s + n.continuityScore, 0) / nodes.length
      : 0;

  const distanceCounts = { direct: 0, near: 0, far: 0 };
  const driftCounts = { low: 0, medium: 0, high: 0 };
  for (const n of nodes) {
    distanceCounts[n.continuationDistance]++;
    driftCounts[n.driftRisk]++;
  }

  console.log(`selected node: Old Lady Temple (${SELECTED_NODE_ID})`);
  console.log(`scopeLevel: ${output.explorationScope.scopeLevel}`);
  console.log(`recommendedBranchCount: ${output.explorationScope.recommendedBranchCount}`);
  console.log(`possibleNewNodes count: ${nodes.length}`);
  console.log(`average continuityScore: ${Math.round(avgContinuity * 10) / 10}`);
  console.log(
    `distances — direct: ${distanceCounts.direct}, near: ${distanceCounts.near}, far: ${distanceCounts.far}`,
  );
  console.log(
    `driftRisk — low: ${driftCounts.low}, medium: ${driftCounts.medium}, high: ${driftCounts.high}`,
  );

  console.log("\npossibleNewNodes:");
  console.table(
    nodes.map((n) => ({
      displayTitle: n.displayTitle,
      continuationAnchor: n.continuationAnchor,
      continuationDistance: n.continuationDistance,
      continuityScore: n.continuityScore,
      driftRisk: n.driftRisk,
      whyThisFollows: n.whyThisFollows.slice(0, 90),
    })),
  );
}

async function main() {
  console.log(`POST ${BASE}/api/world/node-reasoner (single call, no retries)`);

  const res = await fetch(`${BASE}/api/world/node-reasoner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  let data: NodeReasonerResponse;
  try {
    data = (await res.json()) as NodeReasonerResponse;
  } catch {
    console.error(`HTTP ${res.status}: non-JSON response`);
    process.exit(1);
  }

  if (!res.ok && !data.error) {
    data = { success: false, error: `HTTP ${res.status}` };
  }

  if (
    data.error?.includes("429") ||
    data.error?.includes("Quota exceeded") ||
    res.status === 429
  ) {
    console.error("\nGemini quota exhausted (HTTP 429). Stopping — do not retry.");
    console.error(data.error ?? `HTTP ${res.status}`);
    process.exit(1);
  }

  printReport(data);

  if (!data.success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

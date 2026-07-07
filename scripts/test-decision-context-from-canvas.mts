/**
 * Manual local test for canvas → decision context builders — no network.
 *
 * Usage: npx tsx scripts/test-decision-context-from-canvas.mts
 */

import {
  buildDecisionNodeSourceFromCanvas,
  buildDecisionWorldContextFromCanvas,
  resolveDecisionConstellationFromCanvas,
} from "../lib/worldBrain/buildDecisionContextFromCanvas.ts";
import {
  buildUserDecisionEventFromNodeAction,
  createCanonStateSnapshotFromDecisions,
} from "../lib/worldBrain/buildUserDecisionEvent.ts";
import {
  appendDecisionEvent,
  createEmptyDecisionEventLog,
} from "../lib/worldBrain/decisionEventLog.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const canvasModel = {
  worldSeed: "A sci-fi colony where memories are used as currency",
  worldSummary: "Memory debt reshapes class and identity.",
  constellations: [
    {
      id: "constellation_memory_economy",
      title: "Memory Economy",
      displayTitle: "Memory Economy",
      description: "How memory debt reshapes class.",
      question: "Who owns a borrowed childhood?",
    },
  ],
  nodes: [
    {
      id: "node_architect_seed",
      title: "Architect Seed",
      displayTitle: "Architect Seed",
      description: "Initial architect node.",
      constellationId: "constellation_memory_economy",
      nodeType: "place",
      whyPromising: "Strong hook",
      risk: "low",
      explorationQuestions: [],
      generatedByAgentId: "agent_1",
      status: "potential",
      aiGenerated: true,
    },
  ],
  agents: [],
  criticAgents: [],
  controlRules: {},
} as const;

const reasonedNodeDetails = {
  node_reasoned_child: {
    fullTitle: "Childhood Memory Bank",
    displayTitle: "Memory Bank",
    discoveryQuestion: "Who deposits first?",
    creativePurpose: "Anchor the economy.",
    expansionPotential: "High",
    tensionLevel: "medium",
    noveltyScore: 7,
    relevanceScore: 8,
  },
};

const nodeReasonerPanelMeta = {
  node_nr_child: {
    fullTitle: "Borrowed Childhood Receipt",
    displayTitle: "Childhood Receipt",
    discoveryQuestion: "What memory was sold?",
    expansionPotential: "Moderate",
    continuationType: "consequence",
    continuationAnchor: "Memory Bank",
    continuationDistance: "near",
    whyThisFollows: "Follows the deposit scene.",
    noveltyScore: 6,
    relevanceScore: 8,
    continuityScore: 8,
    driftRisk: "low",
    sourceNodeId: "node_reasoned_child",
    sourceConstellationId: "constellation_memory_economy",
    parentNodeId: "node_reasoned_child",
    depthLevel: 2,
  },
};

const baseParams = {
  architectureCanvasModel: canvasModel,
  navState: {
    mode: "discovery" as const,
    discoveryId: "node_reasoned_child",
    regionId: "constellation_memory_economy",
    discoveryTitle: "Memory Economy",
    trail: ["constellation_memory_economy", "node_reasoned_child"],
  },
  nodeConstellationMap: {
    node_reasoned_child: "constellation_memory_economy",
    node_nr_child: "constellation_memory_economy",
  },
  reasonedNodeDetails,
  nodeReasonerPanelMeta,
  nodeOverrides: {},
  resolveDisplayTitle: (id: string) => id,
  worldSeed: canvasModel.worldSeed,
  worldPurpose: "worldbuilding exploration",
};

function main() {
  console.log("=== Decision context from canvas (no network) ===\n");

  const architectNode = buildDecisionNodeSourceFromCanvas({
    ...baseParams,
    nodeId: "node_architect_seed",
    selectedItem: {
      kind: "ai-discovery",
      discovery: {
        id: "node_architect_seed",
        title: "Architect Seed",
        description: "Initial architect node.",
        category: "place",
        whyItMatters: "Strong hook",
        nodeType: "place",
        generated: true,
      },
    },
  });
  assert(architectNode.sourceLayer === "architect", "architect source layer");

  const reasonedNode = buildDecisionNodeSourceFromCanvas({
    ...baseParams,
    nodeId: "node_reasoned_child",
    selectedItem: {
      kind: "ai-discovery",
      discovery: {
        id: "node_reasoned_child",
        title: "Childhood Memory Bank",
        description: "A vault for formative memories.",
        category: "place",
        whyItMatters: "Anchor the economy.",
        nodeType: "place",
        generated: true,
      },
    },
  });
  assert(reasonedNode.sourceLayer === "constellation_reasoner", "reasoner source layer");

  const nrNode = buildDecisionNodeSourceFromCanvas({
    ...baseParams,
    nodeId: "node_nr_child",
    selectedItem: {
      kind: "ai-discovery",
      discovery: {
        id: "node_nr_child",
        title: "Borrowed Childhood Receipt",
        description: "Proof of a sold memory.",
        category: "object",
        whyItMatters: "Follows the deposit scene.",
        sourceAgent: "Node Reasoner",
        generated: true,
      },
    },
  });
  assert(nrNode.sourceLayer === "node_reasoner", "node reasoner source layer");
  assert(nrNode.parentNodeId === "node_reasoned_child", "parentNodeId preserved");
  assert(nrNode.depthLevel === 2, "depthLevel preserved");

  const worldContext = buildDecisionWorldContextFromCanvas({
    ...baseParams,
    nodeId: "node_nr_child",
    selectedItem: {
      kind: "ai-discovery",
      discovery: {
        id: "node_nr_child",
        title: "Borrowed Childhood Receipt",
        description: "Proof of a sold memory.",
        category: "object",
        whyItMatters: "Follows the deposit scene.",
        generated: true,
      },
    },
  });
  assert(worldContext.currentPhase === "node_expansion", "node_expansion phase");
  assert(
    worldContext.activeConstellationId === "constellation_memory_economy",
    "active constellation id",
  );

  const constellation = resolveDecisionConstellationFromCanvas({
    ...baseParams,
    nodeId: "node_reasoned_child",
    selectedItem: {
      kind: "ai-discovery",
      discovery: {
        id: "node_reasoned_child",
        title: "Childhood Memory Bank",
        description: "A vault for formative memories.",
        category: "place",
        whyItMatters: "Anchor the economy.",
        generated: true,
      },
    },
  });
  assert(constellation?.id === "constellation_memory_economy", "constellation snapshot");

  const canonBefore = createCanonStateSnapshotFromDecisions({}, []);
  const event = buildUserDecisionEventFromNodeAction({
    action: "accept",
    node: reasonedNode,
    constellation,
    canvasModel,
    worldContext,
    canonStateBefore: canonBefore,
    source: "user_click",
    snapshotOptions: {
      constellationId: reasonedNode.constellationId,
      sourceLayer: reasonedNode.sourceLayer,
      metadata: reasonedNode.metadata,
    },
  });

  let log = createEmptyDecisionEventLog();
  log = appendDecisionEvent(log, event);
  assert(log.events.length === 1, "event appended");
  assert(event.eventType === "establish_truth", "establish_truth event");
  assert(event.decision === "truth", "truth decision");
  assert(event.nodeSnapshot.sourceLayer === "constellation_reasoner", "snapshot source layer");

  console.log("Sample event:", {
    eventType: event.eventType,
    decision: event.decision,
    target: event.target.displayTitle,
    phase: event.worldContext.currentPhase,
  });
  console.log("\nAll decision context checks passed.");
}

main();

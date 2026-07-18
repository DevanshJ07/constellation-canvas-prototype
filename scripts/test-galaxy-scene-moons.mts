/**
 * Galaxy scene moon visibility — Explore Deeper children must appear as moons.
 * No network.
 *
 * Usage: npx tsx scripts/test-galaxy-scene-moons.mts
 */

import { mapCanvasStateToGalaxyScene } from "../lib/worldBrain/mapCanvasStateToGalaxyScene.ts";
import { mapNodeReasonerOutputToCanvasNodes } from "../lib/worldBrain/mapNodeReasonerToCanvas.ts";
import type { NodeReasonerOutput } from "../lib/worldBrain/nodeReasonerTypes.ts";
import type { AiGeneratedBranch } from "../lib/agentExplore.ts";
import type { CanvasWorldModel } from "../lib/worldBrain/mapArchitectureToCanvas.ts";

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    pass++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    fail++;
  }
}

const PARENT_ID = "node_memory_price_index";
const CONST_ID = "constellation_memory_economy";
const CHILD_A = "subnode_birthday_loan";
const CHILD_B = "subnode_tax_receipt";

function makeBranch(id: string, title: string, parentId: string): AiGeneratedBranch {
  return {
    id,
    title,
    description: "A concrete continuation for tests.",
    whyItMatters: "It matters for continuity.",
    domain: "event",
    sourceAgent: "Node Reasoner",
    rippleHint: "opens further detail",
    crossDomainEffects: [],
    continuityRisk: "low",
    qualityScore: 0.8,
    parentId,
    generated: true,
  };
}

const canvasModel: CanvasWorldModel = {
  worldSeed: "A colony where memories are used as currency",
  worldSummary: "Memory economy workspace",
  constellations: [
    {
      id: CONST_ID,
      title: "Memory Economy",
      displayTitle: "Memory Economy",
      description: "Who owns childhood?",
      question: "What is the price of memory?",
      priority: 1,
      agentIds: [],
      nodeIds: [PARENT_ID],
    },
  ],
  nodes: [
    {
      id: PARENT_ID,
      title: "Memory Price Index",
      description: "Public board of memory rates.",
      constellationId: CONST_ID,
      generatedByAgentId: "agent_x",
      whyPromising: "economic tension",
      risk: "low",
      explorationQuestions: ["Who sets the rate?"],
      nodeType: "rule",
      status: "potential",
      aiGenerated: true,
    },
  ],
  agents: [],
  criticAgents: [],
  controlRules: {
    mustPreserve: [],
    mustAvoid: [],
    generationPriorities: [],
    rankingCriteria: [],
    expansionRules: [],
  },
};

console.log("\n[Test] 1 — Parent id is authoritative even when LLM sourceNodeId drifts");
{
  const output: NodeReasonerOutput = {
    sourceNodeId: "WRONG_LLM_PARENT_ID",
    sourceConstellationId: CONST_ID,
    nodeSummary: "The price index posts daily rates that reshape informal trade.",
    continuationPrinciple: "Continuations must grow from the posted rate board.",
    explorationScope: {
      scopeLevel: "moderate",
      reason: "local economic consequences",
      recommendedBranchCount: 2,
    },
    suggestedDepth: 2,
    expansionBranches: [],
    possibleNewNodes: [
      {
        id: CHILD_A,
        title: "A Loan Paid in Birthdays",
        displayTitle: "Birthday Loan",
        nodeType: "event",
        description:
          "Parents mortgage a birthday to pay rent, leaving a gap the child can feel but not name.",
        parentNodeId: "WRONG_LLM_PARENT_ID",
        sourceConstellationId: CONST_ID,
        continuationType: "consequence",
        continuationAnchor: "daily posted rates",
        continuationDistance: "direct",
        whyThisFollows: "The board makes personal memories bankable as payment.",
        discoveryQuestion: "Who prices a birthday?",
        expansionPotential: "the receipt, the teller, the missing day",
        noveltyScore: 8,
        relevanceScore: 9,
        continuityScore: 9,
        driftRisk: "low",
      },
    ],
    possibleChoices: [],
    consequences: [],
    relationshipSuggestions: [],
    avoidPatterns: [],
  };

  const mapped = mapNodeReasonerOutputToCanvasNodes({
    output,
    parentNode: { id: PARENT_ID, title: "Memory Price Index", displayTitle: "Price Index" },
    selectedConstellationId: CONST_ID,
  });

  assert(mapped.nodes.length === 1, "mapped one child");
  assert(mapped.nodes[0]!.parentNodeId === PARENT_ID, "parentNodeId forced to canvas parent");
  assert(
    mapped.panelMeta[mapped.nodes[0]!.id]!.parentNodeId === PARENT_ID,
    "panel meta parent matches canvas parent",
  );
}

console.log("\n[Test] 2 — Explore Deeper children become Galaxy moons around selected parent");
{
  const scene = mapCanvasStateToGalaxyScene({
    navState: {
      mode: "discovery",
      discoveryId: CONST_ID,
      regionId: CONST_ID,
      discoveryTitle: "Memory Economy",
      trail: [CONST_ID],
    },
    decisions: {},
    hiddenIds: new Set(),
    weakenedIds: new Set(),
    aiBranches: {
      [CONST_ID]: [makeBranch(PARENT_ID, "Price Index", CONST_ID)],
    },
    nodeReasonerBranchesByParentId: {
      [PARENT_ID]: [
        makeBranch(CHILD_A, "Birthday Loan", PARENT_ID),
        makeBranch(CHILD_B, "Tax Receipt", PARENT_ID),
      ],
    },
    nodeReasonerPanelMeta: {
      [CHILD_A]: { displayTitle: "Birthday Loan" },
      [CHILD_B]: { displayTitle: "Tax Receipt" },
    },
    nodeOverrides: {},
    architectureCanvasModel: canvasModel,
    dynamicConstellations: [],
    worldSeed: canvasModel.worldSeed,
    selectedNodeId: PARENT_ID,
    ripplePulseIds: new Set(),
    worldRippleActive: false,
  });

  assert(scene.primaryNodes.some((n) => n.id === PARENT_ID), "parent remains a primary");
  assert(scene.moonParentId === PARENT_ID, "moon parent is selected parent");
  assert(scene.moonNodes.length === 2, `two moons present (got ${scene.moonNodes.length})`);
  assert(
    scene.moonNodes.every((m) => m.id === CHILD_A || m.id === CHILD_B),
    "moon ids match generated children",
  );
}

console.log("\n[Test] 3 — Nested moon parent is promoted so grandchildren still appear");
{
  const nestedParent = CHILD_A;
  const grand = "subnode_gap_in_timeline";
  const scene = mapCanvasStateToGalaxyScene({
    navState: {
      mode: "discovery",
      discoveryId: CONST_ID,
      regionId: CONST_ID,
      discoveryTitle: "Memory Economy",
      trail: [CONST_ID],
    },
    decisions: {},
    hiddenIds: new Set(),
    weakenedIds: new Set(),
    aiBranches: {
      [CONST_ID]: [makeBranch(PARENT_ID, "Price Index", CONST_ID)],
    },
    nodeReasonerBranchesByParentId: {
      [PARENT_ID]: [makeBranch(CHILD_A, "Birthday Loan", PARENT_ID)],
      [nestedParent]: [makeBranch(grand, "Timeline Gap", nestedParent)],
    },
    nodeReasonerPanelMeta: {
      [CHILD_A]: { displayTitle: "Birthday Loan" },
      [grand]: { displayTitle: "Timeline Gap" },
    },
    nodeOverrides: {},
    architectureCanvasModel: canvasModel,
    dynamicConstellations: [],
    worldSeed: canvasModel.worldSeed,
    selectedNodeId: nestedParent,
    ripplePulseIds: new Set(),
    worldRippleActive: false,
  });

  assert(scene.moonParentId === nestedParent, "nested moon parent selected");
  assert(
    scene.primaryNodes.some((n) => n.id === nestedParent),
    "nested parent promoted onto primary ring for anchoring",
  );
  assert(scene.moonNodes.length === 1, "grandchild moon present");
  assert(scene.moonNodes[0]!.id === grand, "grandchild id correct");
}

console.log("\n──────────────────────────────────────────────────");
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("\nAll galaxy moon visibility checks passed.");

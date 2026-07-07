/**
 * Manual local test for mapNodeReasonerToCanvas — no network, no Gemini.
 *
 * Usage: npx tsx scripts/test-node-reasoner-mapper.mts
 */

import {
  mapNodeReasonerOutputToCanvasNodes,
  resolveNodeReasonerCanvasId,
} from "../lib/worldBrain/mapNodeReasonerToCanvas.ts";
import type { NodeReasonerOutput } from "../lib/worldBrain/nodeReasonerTypes.ts";

const PARENT_NODE_ID = "node_old_temple_lady";
const CONSTELLATION_ID = "constellation_ancient_ruins";

const mockOutput: NodeReasonerOutput = {
  sourceNodeId: PARENT_NODE_ID,
  sourceConstellationId: CONSTELLATION_ID,
  nodeSummary:
    "An abandoned stone temple with a scratched idol and impossible fresh marigold offerings.",
  continuationPrinciple:
    "Every continuation must grow from the temple, idol, offerings, or friend reactions inside the ruin.",
  explorationScope: {
    scopeLevel: "moderate",
    reason: "The temple supports ritual detail, hidden architecture, and character reactions.",
    recommendedBranchCount: 5,
  },
  suggestedDepth: 2,
  expansionBranches: [],
  possibleNewNodes: [
    {
      id: "node_cracked_lady_idol",
      title: "The Cracked Lady Idol With Scratched Eyes",
      displayTitle: "Cracked Lady Idol",
      nodeType: "object",
      description: "The idol's face was deliberately defaced, yet fresh marigolds keep appearing at its feet.",
      parentNodeId: PARENT_NODE_ID,
      sourceConstellationId: CONSTELLATION_ID,
      continuationType: "direct_deepening",
      continuationAnchor: "scratched idol face",
      continuationDistance: "direct",
      whyThisFollows: "Zooms into the central worship object the friends already found in the temple.",
      discoveryQuestion: "Who scratched the face, and why do offerings still arrive?",
      expansionPotential: "Hidden name behind the idol, offering bowl, friend who hears anklets.",
      noveltyScore: 7,
      relevanceScore: 9,
      continuityScore: 9,
      driftRisk: "low",
      tags: ["idol", "offering"],
    },
    {
      id: "node_fresh_marigold_offering",
      title: "Fresh Marigold Offering on Cold Stone",
      displayTitle: "Fresh Marigolds",
      nodeType: "object",
      description: "Marigolds that should be days old look newly picked, staining the altar cloth yellow.",
      parentNodeId: PARENT_NODE_ID,
      sourceConstellationId: CONSTELLATION_ID,
      continuationType: "clue",
      continuationAnchor: "marigold offering bowl",
      continuationDistance: "direct",
      whyThisFollows: "The impossible offerings are the temple's most immediate mystery.",
      discoveryQuestion: "Did someone enter before the friends, or does the cave supply the flowers?",
      expansionPotential: "Pollen trail, animal courier, ritual schedule carved nearby.",
      noveltyScore: 8,
      relevanceScore: 9,
      continuityScore: 9,
      driftRisk: "low",
    },
    {
      id: "node_hidden_sanctum_stair",
      title: "Hidden Sanctum Stair Behind the Altar",
      displayTitle: "Hidden Sanctum Stair",
      nodeType: "place",
      description: "A narrow stair descends when marigold petals are placed on the idol's offering bowl.",
      parentNodeId: PARENT_NODE_ID,
      sourceConstellationId: CONSTELLATION_ID,
      continuationType: "hidden_layer",
      continuationAnchor: "altar offering bowl",
      continuationDistance: "near",
      whyThisFollows: "Reveals architecture concealed by the temple's ritual focal point.",
      discoveryQuestion: "Does the stair lead toward escape or deeper worship?",
      expansionPotential: "Bell without wind, sleeping animal guardian, map fragment on the steps.",
      noveltyScore: 8,
      relevanceScore: 8,
      continuityScore: 8,
      driftRisk: "low",
    },
  ],
  possibleChoices: [],
  consequences: [],
  relationshipSuggestions: [],
  avoidPatterns: ["random portal", "unrelated demon king"],
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function main() {
  console.log("=== Node Reasoner mapper fixture test (no network) ===\n");

  const result = mapNodeReasonerOutputToCanvasNodes({
    output: mockOutput,
    parentNode: { id: PARENT_NODE_ID, displayTitle: "Old Lady Temple" },
    selectedConstellationId: CONSTELLATION_ID,
    existingNodeIds: [PARENT_NODE_ID, "node_cracked_lady_idol"],
  });

  assert(result.nodes.length === 3, "expected 3 mapped nodes");
  assert(
    result.nodes.every((n) => n.parentNodeId === PARENT_NODE_ID),
    "every node must reference parentNodeId",
  );
  assert(
    result.nodes.every((n) => n.constellationId === CONSTELLATION_ID),
    "every node must reference constellationId",
  );
  assert(
    result.nodes.every((n) => n.depthLevel === 2),
    "default depthLevel should be 2 from suggestedDepth",
  );
  assert(
    result.nodes[0].id === "node_node_old_temple_lady_node_cracked_lady_idol",
    "colliding id should be deterministically prefixed",
  );

  const taken = new Set<string>([PARENT_NODE_ID, "node_cracked_lady_idol"]);
  const resolved = resolveNodeReasonerCanvasId(
    "node_cracked_lady_idol",
    PARENT_NODE_ID,
    0,
    taken,
  );
  assert(
    resolved === "node_node_old_temple_lady_node_cracked_lady_idol",
    "resolveNodeReasonerCanvasId should prefix on collision",
  );

  console.log("Mapped nodes:");
  console.table(
    result.nodes.map((n) => ({
      id: n.id,
      displayTitle: result.panelMeta[n.id]?.displayTitle,
      title: n.title,
      parentNodeId: n.parentNodeId,
      depthLevel: n.depthLevel,
      continuationAnchor: result.panelMeta[n.id]?.continuationAnchor,
      continuityScore: result.panelMeta[n.id]?.continuityScore,
    })),
  );

  console.log("\nAll mapper fixture checks passed.");
}

main();

/**
 * Manual local test for User Decision Event builders — no network.
 *
 * Usage: npx tsx scripts/test-user-decision-event-builder.mts
 */

import {
  buildUserDecisionEventFromNodeAction,
  createCanonStateSnapshot,
  createDecisionNodeSnapshot,
  isValidCanonDecisionState,
  isValidUserDecisionEventType,
} from "../lib/worldBrain/buildUserDecisionEvent.ts";

const FIXED_TS = "2026-07-07T06-00-00-000Z";

const worldContext = {
  worldPrompt: "A sci-fi colony where memories are used as currency",
  purpose: "Explore a fictional universe for a game",
  currentPhase: "constellation_exploration" as const,
};

const canonBefore = createCanonStateSnapshot({
  truthNodeIds: ["node_locked_study_window"],
  potentialNodeIds: ["node_final_penalty_shot"],
  rejectedNodeIds: [],
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const examples = [
  {
    label: "Sci-fi — Childhood Memory Bank",
    action: "accept" as const,
    node: {
      id: "node_childhood_memory_bank",
      title: "Childhood Memory Bank",
      displayTitle: "Memory Bank",
      description: "A vault where citizens deposit formative memories as currency.",
      nodeType: "place",
      constellationId: "constellation_memory_economy",
      sourceLayer: "constellation_reasoner" as const,
    },
    constellation: {
      id: "constellation_memory_economy",
      title: "Memory Economy",
      displayTitle: "Memory Economy",
      description: "How memory debt reshapes class and identity.",
      question: "Who owns a borrowed childhood?",
    },
    expectedEventType: "establish_truth",
    expectedDecision: "truth",
  },
  {
    label: "Romance — Tomorrow Ticket",
    action: "save" as const,
    node: {
      id: "node_tomorrow_ticket",
      title: "The Tomorrow Ticket",
      displayTitle: "Tomorrow Ticket",
      description: "A one-way pass to meet your future self for exactly one hour.",
      nodeType: "object",
      constellationId: "constellation_fated_hearts",
      sourceLayer: "architect" as const,
    },
    expectedEventType: "keep_potential",
    expectedDecision: "potential",
  },
  {
    label: "Comedy — Map-Eating Crabs",
    action: "reject" as const,
    node: {
      id: "node_map_eating_crabs",
      title: "Map-Eating Crabs of Deadman's Cove",
      displayTitle: "Map-Eating Crabs",
      description: "Crabs that devour paper maps and leave ink-stained claw trails.",
      nodeType: "threat",
      parentNodeId: "node_treasure_x_mark",
      depthLevel: 2,
      sourceLayer: "node_reasoner" as const,
      metadata: { continuationAnchor: "half-digested map corner", continuityScore: 9 },
    },
    expectedEventType: "reject",
    expectedDecision: "rejected",
  },
  {
    label: "Political fantasy — Broken Oath Witness",
    action: "accept" as const,
    node: {
      id: "node_broken_oath_witness",
      title: "The Broken Oath Witness",
      displayTitle: "Broken Oath Witness",
      description: "A court scribe who remembers every promise rulers tried to erase.",
      nodeType: "character",
      constellationId: "constellation_succession_crisis",
      sourceLayer: "constellation_reasoner" as const,
    },
    expectedEventType: "establish_truth",
    expectedDecision: "truth",
  },
];

function main() {
  console.log("=== User Decision Event builder fixture test (no network) ===\n");

  assert(isValidUserDecisionEventType("establish_truth"), "establish_truth valid");
  assert(isValidCanonDecisionState("truth"), "truth valid");
  assert(!isValidUserDecisionEventType("random_action"), "random action invalid");

  const events = examples.map((ex) =>
    buildUserDecisionEventFromNodeAction({
      action: ex.action,
      node: ex.node,
      constellation: ex.constellation,
      worldContext,
      canonStateBefore: canonBefore,
      timestamp: FIXED_TS,
    }),
  );

  assert(events.length === 4, "expected 4 events");

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    const event = events[i];
    assert(event.eventType === ex.expectedEventType, `${ex.label} eventType`);
    assert(event.decision === ex.expectedDecision, `${ex.label} decision`);
    assert(event.nodeSnapshot.id === ex.node.id, `${ex.label} snapshot id`);
    assert(event.target.displayTitle.length > 0, `${ex.label} target displayTitle`);
    assert(
      event.id.startsWith(`decision_${ex.expectedEventType}_${ex.node.id}`),
      `${ex.label} deterministic id prefix`,
    );
    if (ex.constellation) {
      assert(
        event.constellationSnapshot?.id === ex.constellation.id,
        `${ex.label} constellation snapshot`,
      );
    }
  }

  const crabSnapshot = createDecisionNodeSnapshot(examples[2].node);
  assert(
    crabSnapshot.metadata?.continuationAnchor === "half-digested map corner",
    "metadata preserved for node reasoner node",
  );
  assert(crabSnapshot.depthLevel === 2, "depthLevel preserved");

  console.log("Built events:");
  console.table(
    events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      decision: e.decision,
      displayTitle: e.nodeSnapshot.displayTitle,
      sourceLayer: e.nodeSnapshot.sourceLayer,
      truthBefore: e.canonStateBefore?.truthCount,
    })),
  );

  console.log("\nAll User Decision Event builder checks passed.");
}

main();

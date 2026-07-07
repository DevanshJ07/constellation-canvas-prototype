/**
 * Manual local test for Ripple Effect type contracts — no network.
 *
 * Validates fixture shapes compile and satisfy structural expectations.
 *
 * Usage: npx tsx scripts/test-ripple-effect-types.mts
 */

import type { CanvasWorldModel } from "../lib/worldBrain/mapArchitectureToCanvas.ts";
import type {
  CanonStateSnapshot,
  DecisionEventLog,
  UserDecisionEvent,
} from "../lib/worldBrain/userDecisionTypes.ts";
import type {
  RippleEffectInput,
  RippleEffectOutput,
  RippleSuggestedOperation,
} from "../lib/worldBrain/rippleEffectTypes.ts";

const FIXED_TS = "2026-07-07T12:00:00.000Z";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function makeTriggerEvent(
  overrides: Partial<UserDecisionEvent> & Pick<UserDecisionEvent, "id" | "target" | "nodeSnapshot">,
): UserDecisionEvent {
  return {
    eventType: "establish_truth",
    decision: "truth",
    worldContext: {
      worldPrompt: "A sci-fi colony where memories are used as currency",
      currentPhase: "constellation_exploration",
    },
    timestamp: FIXED_TS,
    source: "user_click",
    ...overrides,
  };
}

const canonState: CanonStateSnapshot = {
  truthNodeIds: ["node_memory_archive_public"],
  potentialNodeIds: ["node_dream_meeting_cafe"],
  rejectedNodeIds: ["node_map_eating_crabs"],
  truthCount: 1,
  potentialCount: 1,
  rejectedCount: 1,
};

const canvasModel: CanvasWorldModel = {
  worldSeed: "A sci-fi colony where memories are used as currency",
  worldSummary: "Class divides harden when childhood can be borrowed or sold.",
  constellations: [
    {
      id: "constellation_memory_economy",
      title: "Memory Economy",
      displayTitle: "Memory Economy",
      description: "Who owns a borrowed childhood?",
      question: "What happens when memory debt outlives the debtor?",
      priority: 1,
      agentIds: ["agent_archivist"],
      nodeIds: ["node_memory_archive_public", "node_childhood_ledger"],
    },
    {
      id: "constellation_succession_crisis",
      title: "Succession Crisis",
      displayTitle: "Succession Crisis",
      description: "Oaths bind courts long after rulers die.",
      question: "Which promise breaks first?",
      priority: 2,
      agentIds: ["agent_scribe"],
      nodeIds: ["node_broken_oath_witness"],
    },
  ],
  nodes: [
    {
      id: "node_memory_archive_public",
      title: "Public Memory Archive",
      description: "A free civic vault advertised as open to all citizens.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Tests the premise that memory is scarce.",
      risk: "May contradict paid memory markets.",
      explorationQuestions: ["Who funds the archive?"],
      nodeType: "place",
      status: "potential",
      aiGenerated: true,
    },
    {
      id: "node_childhood_ledger",
      title: "Childhood Ledger",
      description: "Families record which memories may be collateralized.",
      constellationId: "constellation_memory_economy",
      generatedByAgentId: "agent_archivist",
      whyPromising: "Grounds economic rules in domestic stakes.",
      risk: "Could duplicate archive themes.",
      explorationQuestions: ["Can minors opt out?"],
      nodeType: "object",
      status: "potential",
      aiGenerated: true,
    },
  ],
  agents: [],
  criticAgents: [],
  controlRules: {
    mustPreserve: ["memory scarcity premise"],
    mustAvoid: ["unexplained free unlimited memory"],
    generationPriorities: ["economic consequence", "class tension"],
    rankingCriteria: ["canon consistency"],
    expansionRules: ["sibling nodes must share currency logic"],
  },
};

const triggerEvent = makeTriggerEvent({
  id: "decision_establish_truth_node_memory_archive_public",
  target: {
    targetType: "node",
    id: "node_memory_archive_public",
    title: "Public Memory Archive",
    displayTitle: "Memory Archive",
    constellationId: "constellation_memory_economy",
    nodeType: "place",
  },
  nodeSnapshot: {
    id: "node_memory_archive_public",
    title: "Public Memory Archive",
    displayTitle: "Memory Archive",
    description: "A free civic vault advertised as open to all citizens.",
    nodeType: "place",
    constellationId: "constellation_memory_economy",
    sourceLayer: "constellation_reasoner",
  },
  constellationSnapshot: {
    id: "constellation_memory_economy",
    title: "Memory Economy",
    displayTitle: "Memory Economy",
  },
  canonStateBefore: {
    truthNodeIds: [],
    potentialNodeIds: ["node_memory_archive_public"],
    rejectedNodeIds: [],
    truthCount: 0,
    potentialCount: 1,
    rejectedCount: 0,
  },
});

const decisionLog: DecisionEventLog = {
  events: [triggerEvent],
  lastUpdatedAt: FIXED_TS,
};

const suggestedOps: RippleSuggestedOperation[] = [
  {
    id: "ripple_op_weaken_childhood_ledger",
    operationType: "weaken_node",
    target: {
      targetType: "node",
      id: "node_childhood_ledger",
      constellationId: "constellation_memory_economy",
    },
    reason: "Ledger assumes private collateral; public archive shifts economic premise.",
    priority: "medium",
    requiresUserApproval: true,
  },
  {
    id: "ripple_op_critic_review_archive",
    operationType: "mark_for_critic_review",
    target: {
      targetType: "canon_item",
      id: "node_memory_archive_public",
      constellationId: "constellation_memory_economy",
    },
    reason: "Verify archive funding model does not contradict memory-as-currency rule.",
    priority: "high",
    requiresUserApproval: false,
  },
];

const rippleInput: RippleEffectInput = {
  triggerEvent,
  decisionLog,
  canvasModel,
  activeCanonState: canonState,
  affectedScopeHint: "constellation",
  evaluationMode: "balanced",
  userSteering: {
    instruction: "Keep contradictions subtle — prefer reconciliation over deletion.",
    targetScope: "constellation",
    intensity: "moderate",
  },
};

const rippleOutput: RippleEffectOutput = {
  triggerEventId: triggerEvent.id,
  summary:
    "Establishing a free public memory archive strengthens civic themes but pressures private ledger nodes.",
  impactLevel: "moderate",
  affectedScopes: ["node", "sibling_nodes", "constellation", "canon"],
  nodeImpacts: [
    {
      nodeId: "node_childhood_ledger",
      constellationId: "constellation_memory_economy",
      impactType: "require_modification",
      reason: "Collateral rules need to account for a public access tier.",
      severity: "medium",
      confidence: 0.74,
      suggestedOperationIds: ["ripple_op_weaken_childhood_ledger"],
      relatedTriggerAnchor: "free civic vault",
    },
    {
      nodeId: "node_dream_meeting_cafe",
      constellationId: "constellation_fated_hearts",
      impactType: "contradict",
      reason: "Romance thread assumes daily waking meetings; unrelated unless dream-only rule is canon.",
      severity: "low",
      confidence: 0.31,
      suggestedOperationIds: [],
    },
  ],
  constellationImpacts: [
    {
      constellationId: "constellation_memory_economy",
      impactType: "refocus",
      reason: "Public vs private memory access becomes the central tension.",
      suggestedFocusShift: "institutional trust and debt",
      suggestedNodeCountChange: 1,
      confidence: 0.81,
    },
  ],
  canonImpacts: [
    {
      impactType: "possible_contradiction",
      reason: "Free archive may conflict with scarcity premise unless subsidized.",
      affectedCanonIds: ["node_memory_archive_public"],
      suggestedCanonStateChanges: [],
      confidence: 0.68,
    },
  ],
  suggestedOperations: suggestedOps,
  warnings: [
    {
      id: "warn_memory_scarcity_contradiction",
      warningType: "canon_conflict",
      message:
        "A fully free public archive may contradict 'memories are currency' unless access is rationed.",
      severity: "high",
      affectedTargets: [
        {
          targetType: "node",
          id: "node_memory_archive_public",
          constellationId: "constellation_memory_economy",
        },
      ],
      suggestedResolution: "Clarify whether the archive stores copies, indexes, or subsidized withdrawals.",
    },
  ],
  preservedElements: [
    {
      targetType: "node",
      id: "node_broken_oath_witness",
      reason: "Accepted political-fantasy canon in a separate constellation — no direct link to memory economy.",
    },
  ],
  followUpQuestions: [
    "Is the archive funded by the state, a guild, or memory tithes?",
    "Can citizens withdraw memories they did not deposit?",
  ],
  confidence: 0.77,
};

// ── Additional genre fixtures (shape-only) ──────────────────────────────────────

const genreFixtures: Array<{ label: string; output: Partial<RippleEffectOutput> }> = [
  {
    label: "Romance — dream-only meetings",
    output: {
      impactLevel: "minor",
      nodeImpacts: [
        {
          nodeId: "node_dream_meeting_cafe",
          impactType: "require_modification",
          reason: "Daily coffee shop meeting conflicts with dream-only contact rule.",
          severity: "high",
          confidence: 0.9,
          suggestedOperationIds: [],
        },
      ],
    },
  },
  {
    label: "Comedy — map-eating crabs central",
    output: {
      impactLevel: "moderate",
      nodeImpacts: [
        {
          nodeId: "node_treasure_x_mark",
          impactType: "inspire_new_node",
          reason: "Treasure clues may become crab-damaged or ink-stained.",
          severity: "medium",
          confidence: 0.72,
          suggestedOperationIds: [],
        },
      ],
    },
  },
  {
    label: "Sports drama — missed penalty",
    output: {
      impactLevel: "major",
      nodeImpacts: [
        {
          nodeId: "node_victory_parade",
          impactType: "obsolete",
          reason: "Celebration scenes assume a winning shot.",
          severity: "high",
          confidence: 0.88,
          suggestedOperationIds: [],
        },
      ],
      warnings: [
        {
          id: "warn_flow_celebration_conflict",
          warningType: "flow_conflict",
          message: "Narrative flow may require reordering post-match scenes.",
          severity: "medium",
          affectedTargets: [{ targetType: "flow_item", id: "flow_act_three_finale" }],
        },
      ],
    },
  },
  {
    label: "Mystery — locked from inside",
    output: {
      impactLevel: "moderate",
      nodeImpacts: [
        {
          nodeId: "node_outside_intruder_theory",
          impactType: "weaken",
          reason: "Outside entry becomes less plausible if the window was locked inside.",
          severity: "medium",
          confidence: 0.85,
          suggestedOperationIds: [],
        },
      ],
      warnings: [
        {
          id: "warn_locked_room_contradiction",
          warningType: "contradiction",
          message: "Intruder theory needs reconciliation with interior lock evidence.",
          severity: "high",
          affectedTargets: [{ targetType: "node", id: "node_outside_intruder_theory" }],
        },
      ],
    },
  },
  {
    label: "Family saga — inheritance dispute",
    output: {
      constellationImpacts: [
        {
          constellationId: "constellation_estate_partition",
          impactType: "increase_priority",
          reason: "A newly accepted will revision elevates inheritance conflict across branches.",
          confidence: 0.7,
        },
      ],
    },
  },
];

console.log("=== Ripple Effect type fixtures (no network) ===\n");

assert(rippleInput.triggerEvent.id === triggerEvent.id, "input references trigger event");
assert(rippleInput.decisionLog.events.length === 1, "decision log contains trigger");
assert(rippleInput.canvasModel.nodes.length >= 2, "canvas model has nodes");
assert(rippleInput.activeCanonState.truthCount === 1, "canon state snapshot attached");
assert(
  rippleOutput.suggestedOperations.every((op) => op.requiresUserApproval !== undefined),
  "operations declare approval requirement",
);
assert(
  rippleOutput.suggestedOperations.every((op) => typeof op.id === "string" && op.target.id),
  "operations are declarative targets, not mutations",
);
assert(rippleOutput.preservedElements.length >= 1, "preserved elements listed");
assert(rippleOutput.warnings.some((w) => w.warningType === "canon_conflict"), "canon critic warning present");
assert(rippleInput.userSteering?.instruction.length > 0, "user steering prepared");

for (const fixture of genreFixtures) {
  assert(Boolean(fixture.label), "genre fixture has label");
}

console.log("RippleEffectInput:");
console.log(`  trigger: ${rippleInput.triggerEvent.target.displayTitle}`);
console.log(`  log events: ${rippleInput.decisionLog.events.length}`);
console.log(`  evaluation: ${rippleInput.evaluationMode}`);
console.log(`  steering: ${rippleInput.userSteering?.instruction.slice(0, 48)}…`);

console.log("\nRippleEffectOutput:");
console.log(`  impact: ${rippleOutput.impactLevel}`);
console.log(`  node impacts: ${rippleOutput.nodeImpacts.length}`);
console.log(`  operations: ${rippleOutput.suggestedOperations.length}`);
console.log(`  warnings: ${rippleOutput.warnings.length}`);
console.log(`  preserved: ${rippleOutput.preservedElements.length}`);
console.log(`  confidence: ${rippleOutput.confidence}`);

console.log("\nGenre fixture labels:");
for (const f of genreFixtures) {
  console.log(`  · ${f.label}`);
}

console.log("\nAll Ripple Effect type checks passed.");

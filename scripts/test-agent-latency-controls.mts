/**
 * Phase 8D — Agent latency controls (no network).
 *
 * Covers compact context, timeouts, retry policy, cache/dedupe,
 * and user-facing fallback copy hygiene.
 *
 * Usage: npx tsx scripts/test-agent-latency-controls.mts
 */

import {
  AgentTimeoutError,
  estimateTokenCount,
  isAgentTimeoutError,
  NODE_REASONER_MIN_VALID_TO_SKIP_RETRY,
  withTimeout,
} from "../lib/worldBrain/agents/agentLatency.ts";
import {
  NODE_REASONER_FALLBACK_COPY,
  shouldRetryNodeReasoner,
} from "../lib/worldBrain/agents/nodeReasonerAgent.ts";
import {
  repairRippleOutputDeterministically,
  RIPPLE_AGENT_FALLBACK_COPY,
  scrubBackendTerms,
  shouldRetryRippleConsequence,
} from "../lib/worldBrain/agents/rippleConsequenceAgent.ts";
import {
  buildCompactNodeReasonerContext,
  buildCompactRippleCanvasModel,
  buildCompactRippleContext,
  COMPACT_NODE_REASONER_LIMITS,
  COMPACT_RIPPLE_LIMITS,
  measureCanvasCompaction,
} from "../lib/worldBrain/agents/compactAgentContext.ts";
import { SessionRequestCache } from "../lib/worldBrain/agents/sessionRequestCache.ts";
import { trimOperationsToRecommendedMax } from "../lib/worldBrain/agents/rippleConsequenceValidation.ts";
import type { NodeReasonerInput } from "../lib/worldBrain/nodeReasonerTypes.ts";
import type { CanvasWorldModel } from "../lib/worldBrain/mapArchitectureToCanvas.ts";
import type {
  RippleEffectOutput,
  RippleSuggestedOperation,
} from "../lib/worldBrain/rippleEffectTypes.ts";
import type {
  CanonStateSnapshot,
  DecisionEventLog,
  UserDecisionEvent,
} from "../lib/worldBrain/userDecisionTypes.ts";
import {
  appendDecisionEvents,
  createEmptyDecisionEventLog,
} from "../lib/worldBrain/decisionEventLog.ts";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failCount++;
  }
}

function test(name: string, fn: () => void) {
  console.log(`\n[Test] ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`  ✗ THREW: ${err instanceof Error ? err.message : String(err)}`);
    failCount++;
  }
}

async function testAsync(name: string, fn: () => Promise<void>) {
  console.log(`\n[Test] ${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ✗ THREW: ${err instanceof Error ? err.message : String(err)}`);
    failCount++;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLargeNodeInput(): NodeReasonerInput {
  const siblings = Array.from({ length: 20 }, (_, i) => ({
    id: `sib_${i}`,
    title: `Sibling Node ${i} With A Long Title`,
    displayTitle: `Sibling ${i}`,
    nodeType: "place" as const,
    description: "X".repeat(400),
  }));

  const neighbors = Array.from({ length: 12 }, (_, i) => ({
    id: `const_n_${i}`,
    title: `Neighbor Constellation ${i}`,
    displayTitle: `Neighbor ${i}`,
    role: "supporting pressure",
    description: "Y".repeat(300),
  }));

  return {
    worldPrompt: "W".repeat(800),
    purpose: "Explore a fictional universe",
    architectureSummary: "A".repeat(900),
    selectedConstellation: {
      id: "constellation_memory_economy",
      title: "Memory Economy",
      displayTitle: "Memory Economy",
      description: "Who owns a borrowed childhood?",
      role: "economic pressure engine",
      localSummary: "L".repeat(400),
      explorationAxes: Array.from({ length: 8 }, (_, i) => ({
        id: `axis_${i}`,
        name: `Axis ${i}`,
        purpose: "Purpose text",
        creativeFunction: "pressure",
      })),
    },
    selectedNode: {
      id: "node_memory_price_index",
      title: "Memory Price Index",
      displayTitle: "Price Index",
      nodeType: "rule",
      description: "A public board that posts daily rates for childhood memories.",
      constellationId: "constellation_memory_economy",
    },
    siblingNodes: siblings,
    neighboringConstellations: neighbors,
    existingCanon: Array.from({ length: 20 }, (_, i) => ({
      id: `canon_${i}`,
      title: `Canon ${i}`,
      type: "node",
      description: "accepted truth",
    })),
  };
}

function makeLargeCanvas(): CanvasWorldModel {
  const constellations = Array.from({ length: 8 }, (_, i) => ({
    id: `constellation_${i}`,
    title: `Constellation ${i}`,
    displayTitle: `Const ${i}`,
    description: "D".repeat(250),
    question: "Q?",
    priority: i + 1,
    agentIds: [] as string[],
    nodeIds: Array.from({ length: 10 }, (_, j) => `node_${i}_${j}`),
  }));

  const nodes = constellations.flatMap((c, i) =>
    Array.from({ length: 10 }, (_, j) => ({
      id: `node_${i}_${j}`,
      title: `Node ${i}-${j}`,
      description: "N".repeat(300),
      constellationId: c.id,
      generatedByAgentId: "agent_x",
      whyPromising: "why",
      risk: "risk",
      explorationQuestions: ["q1", "q2", "q3"],
      nodeType: "place",
      status: "potential" as const,
      aiGenerated: true as const,
    })),
  );

  return {
    worldSeed: "A colony where memories are used as currency",
    worldSummary: "S".repeat(600),
    constellations,
    nodes,
    agents: [
      {
        id: "agent_x",
        name: "Archivist",
        role: "builder",
        lens: "systems",
        generates: ["places"],
        linkedConstellationIds: ["constellation_0"],
        activationTriggers: ["truth"],
      },
    ],
    criticAgents: [],
    controlRules: {
      mustPreserve: ["canon"],
      mustAvoid: ["random expansion"],
      generationPriorities: ["local"],
      rankingCriteria: ["relevance"],
      expansionRules: ["preserve truth"],
    },
  };
}

function makeTriggerEvent(): UserDecisionEvent {
  return {
    id: "decision_latency_test_1",
    eventType: "establish_truth",
    decision: "truth",
    timestamp: "2026-07-17T12:00:00.000Z",
    source: "user_click",
    target: {
      id: "node_0_0",
      title: "Node 0-0",
      displayTitle: "Node 0-0",
      targetType: "node",
    },
    nodeSnapshot: {
      id: "node_0_0",
      title: "Node 0-0",
      displayTitle: "Node 0-0",
      description: "Primary trigger node",
      constellationId: "constellation_0",
    },
    constellationSnapshot: {
      id: "constellation_0",
      title: "Constellation 0",
      displayTitle: "Const 0",
    },
    worldContext: {
      worldPrompt: "seed",
      activeConstellationId: "constellation_0",
      currentPhase: "node_expansion",
    },
  };
}

function makeOp(i: number): RippleSuggestedOperation {
  return {
    id: `ripple_op_strengthen_node_x_${i}`,
    operationType: "strengthen_node",
    target: { targetType: "node", id: `node_target_${i}` },
    reason: `Reason for operation ${i} tied to the trigger decision.`,
    priority: i < 2 ? "high" : "low",
    requiresUserApproval: false,
  };
}

function makeRippleOutput(opCount: number): RippleEffectOutput {
  return {
    triggerEventId: "decision_latency_test_1",
    summary: "A moderate ripple from establishing the trigger node as truth.",
    impactLevel: "moderate",
    affectedScopes: ["node"],
    nodeImpacts: [],
    constellationImpacts: [],
    canonImpacts: [],
    suggestedOperations: Array.from({ length: opCount }, (_, i) => makeOp(i)),
    warnings: [],
    preservedElements: [],
    followUpQuestions: [],
    confidence: 0.72,
    userFacingSummary: "This makes nearby brokers more important and weakens the cash desk.",
    userFacingBullets: [
      "This makes brokers more important.",
      "This weakens the cash desk.",
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("1 — Compact NodeReasoner context excludes unrelated large data", () => {
  const large = makeLargeNodeInput();
  const compact = buildCompactNodeReasonerContext(large);

  assert(
    compact.siblingNodes.length <= COMPACT_NODE_REASONER_LIMITS.maxSiblingNodes,
    `siblings capped (${compact.siblingNodes.length})`,
  );
  assert(
    compact.neighboringConstellations.length <=
      COMPACT_NODE_REASONER_LIMITS.maxNeighborConstellations,
    `neighbors capped (${compact.neighboringConstellations.length})`,
  );
  assert(
    compact.architectureSummary.length <=
      COMPACT_NODE_REASONER_LIMITS.maxArchitectureSummaryChars,
    "architecture summary truncated",
  );
  assert(
    compact.worldPrompt.length <= COMPACT_NODE_REASONER_LIMITS.maxWorldPromptChars,
    "world prompt truncated",
  );
  assert(
    compact.neighboringConstellations.every((n) => !n.description),
    "neighbor descriptions stripped",
  );
  assert(
    (compact.existingCanon?.length ?? 0) <= COMPACT_NODE_REASONER_LIMITS.maxCanonItems,
    "canon items capped",
  );
  assert(
    large.siblingNodes.length > compact.siblingNodes.length,
    "compact is smaller than original sibling list",
  );
});

test("2 — Compact Ripple context caps neighborhood and recent decisions", () => {
  const canvas = makeLargeCanvas();
  const { model, stats } = buildCompactRippleCanvasModel(canvas, "constellation_0");
  const measure = measureCanvasCompaction(canvas, model);

  assert(measure.compactNodeCount < measure.originalNodeCount, "node count reduced");
  assert(
    measure.compactConstellationCount <= COMPACT_RIPPLE_LIMITS.maxNeighborConstellations + 1,
    "constellations capped to neighborhood",
  );
  assert(measure.excludedUnrelatedConstellations, "unrelated constellations excluded");
  assert(stats.primaryConstellationId === "constellation_0", "primary constellation retained");
  assert(model.agents.length === 0, "agents stripped from prompt canvas");

  let log: DecisionEventLog = createEmptyDecisionEventLog();
  const events = Array.from({ length: 20 }, (_, i) => ({
    ...makeTriggerEvent(),
    id: `decision_${i}`,
    timestamp: `2026-07-17T12:${String(i).padStart(2, "0")}:00.000Z`,
  }));
  log = appendDecisionEvents(log, events);

  const canon: CanonStateSnapshot = {
    truthNodeIds: ["node_0_0"],
    potentialNodeIds: [],
    rejectedNodeIds: [],
    truthCount: 1,
    potentialCount: 0,
    rejectedCount: 0,
  };

  const { input: compactInput, stats: rippleStats } = buildCompactRippleContext({
    triggerEvent: makeTriggerEvent(),
    decisionLog: log,
    canvasModel: canvas,
    activeCanonState: canon,
    evaluationMode: "balanced",
  });

  assert(
    compactInput.decisionLog.events.length <= COMPACT_RIPPLE_LIMITS.maxRecentDecisions,
    `recent decisions capped (${compactInput.decisionLog.events.length})`,
  );
  assert(
    rippleStats.recentDecisionCount <= COMPACT_RIPPLE_LIMITS.maxRecentDecisions,
    "stats match",
  );
});

await testAsync("3 — NodeReasoner timeout helper returns structured timeout error", async () => {
  try {
    await withTimeout(
      new Promise((resolve) => setTimeout(resolve, 5000)),
      30,
      "NodeReasonerAgent",
    );
    assert(false, "should have thrown");
  } catch (e) {
    assert(isAgentTimeoutError(e), "isAgentTimeoutError true");
    assert(e instanceof AgentTimeoutError, "AgentTimeoutError instance");
    assert(
      (e as Error).message.includes("NodeReasonerAgent"),
      "timeout message names agent",
    );
  }
});

await testAsync("4 — Ripple timeout helper returns structured timeout error", async () => {
  try {
    await withTimeout(
      new Promise((resolve) => setTimeout(resolve, 5000)),
      30,
      "RippleConsequenceAgent",
    );
    assert(false, "should have thrown");
  } catch (e) {
    assert(isAgentTimeoutError(e), "isAgentTimeoutError true");
    assert((e as AgentTimeoutError).timeoutMs === 30, "timeoutMs preserved");
  }
});

test("5 — NodeReasoner does not retry when enough valid nodes exist", () => {
  assert(
    shouldRetryNodeReasoner({
      validationValid: false,
      validNodeCount: NODE_REASONER_MIN_VALID_TO_SKIP_RETRY,
      hasStructuralError: false,
      timedOut: false,
      fastMode: false,
    }) === false,
    "skip retry at min valid threshold",
  );
  assert(
    shouldRetryNodeReasoner({
      validationValid: false,
      validNodeCount: 5,
      hasStructuralError: false,
      timedOut: false,
      fastMode: false,
    }) === false,
    "skip retry with 5 valid nodes",
  );
  assert(
    shouldRetryNodeReasoner({
      validationValid: false,
      validNodeCount: 0,
      hasStructuralError: true,
      timedOut: false,
      fastMode: false,
    }) === true,
    "retry when no valid nodes",
  );
  assert(
    shouldRetryNodeReasoner({
      validationValid: false,
      validNodeCount: 2,
      hasStructuralError: false,
      timedOut: true,
      fastMode: false,
    }) === false,
    "never retry on timeout",
  );
});

test("6 — Ripple trims to top 3–5 without requiring retry", () => {
  const bloated = makeRippleOutput(12);
  const trimmed = trimOperationsToRecommendedMax(bloated);
  assert(trimmed.suggestedOperations.length <= 5, "trimmed to ≤5");
  assert(trimmed.suggestedOperations[0]?.priority === "high", "high priority kept first");

  const repaired = repairRippleOutputDeterministically(bloated, []);
  assert(repaired.suggestedOperations.length <= 5, "repair also trims");

  assert(
    shouldRetryRippleConsequence({
      validationValid: false,
      operationCount: repaired.suggestedOperations.length,
      hasHardErrorsAfterRepair: false,
      timedOut: false,
      fastMode: false,
      onlySoftOrRepairableErrors: true,
    }) === false,
    "no retry after deterministic trim when only soft errors",
  );
});

await testAsync("7 — Duplicate Explore-style calls are deduped by SessionRequestCache", async () => {
  const cache = new SessionRequestCache<{ nodes: string[] }>();
  let calls = 0;

  const factory = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return { nodes: ["a", "b"] };
  };

  const [a, b] = await Promise.all([
    cache.runDeduped("parent_node_1", factory),
    cache.runDeduped("parent_node_1", factory),
  ]);

  assert(calls === 1, "only one factory invocation for concurrent duplicates");
  assert(a.nodes.length === 2 && b.nodes.length === 2, "both callers get result");

  const cached = await cache.runDeduped("parent_node_1", factory);
  assert(calls === 1, "cached hit does not re-invoke factory");
  assert(cached.nodes[0] === "a", "cached value reused");
});

await testAsync("8 — Duplicate Ripple decision calls reuse cache", async () => {
  const cache = new SessionRequestCache<{ ok: true; id: string } | { ok: false }>();
  let calls = 0;

  const result = await cache.runDeduped(
    "decision_latency_test_1",
    async () => {
      calls += 1;
      return { ok: true as const, id: "decision_latency_test_1" };
    },
    { cachePredicate: (v) => v.ok },
  );

  const again = await cache.runDeduped(
    "decision_latency_test_1",
    async () => {
      calls += 1;
      return { ok: true as const, id: "should_not_run" };
    },
    { cachePredicate: (v) => v.ok },
  );

  assert(calls === 1, "second decision id call uses cache");
  assert(
    result.ok && again.ok && again.id === "decision_latency_test_1",
    "same decision reused",
  );
  assert(cache.hasCached("decision_latency_test_1"), "cache stores successful result");
});

test("9 — Loading/fallback copy contains no backend terms", () => {
  const copies = [
    NODE_REASONER_FALLBACK_COPY,
    RIPPLE_AGENT_FALLBACK_COPY,
    "Exploring this path…",
    "Truth added. Checking what changes…",
  ];
  const forbidden = /\b(patch|dry run|apply plan|blocker|validation|API|LLM|JSON)\b/i;
  for (const copy of copies) {
    assert(!forbidden.test(copy), `clean copy: "${copy.slice(0, 48)}"`);
  }

  const scrubbed = scrubBackendTerms(
    "This operation applies a patch via dry run validation blocker.",
  );
  assert(!forbidden.test(scrubbed), `scrubbed backend jargon: "${scrubbed}"`);
});

test("10 — Token estimate helper is sane", () => {
  assert(estimateTokenCount("") === 0, "empty is 0");
  assert(estimateTokenCount("abcd") === 1, "4 chars ≈ 1 token");
  assert(estimateTokenCount("a".repeat(400)) === 100, "400 chars ≈ 100 tokens");
});

console.log("\n──────────────────────────────────────────────────");
console.log(`Results: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  process.exit(1);
}
console.log("\nAll latency control tests passed.");

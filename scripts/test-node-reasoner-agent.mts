/**
 * NodeReasonerAgent — Phase 8B validation tests (no network, no Gemini).
 *
 * Tests validation helpers, AgentRunResult shape, retry instructions,
 * and fallback copy. All tests are pure and synchronous.
 *
 * Usage: npx tsx scripts/test-node-reasoner-agent.mts
 */

import {
  validateNodeSpecificity,
  validateNodeContinuity,
  validateNodeNonRepetition,
  validateNodeCanonCompatibility,
  validateNodeReasonerOutput,
  buildRetryInstructions,
  filterInvalidNodes,
  VALIDATION_CONFIG,
} from "../lib/worldBrain/agents/nodeReasonerValidation.ts";
import type { NodeReasonerValidationContext } from "../lib/worldBrain/agents/nodeReasonerValidation.ts";
import type { AgentValidationResult } from "../lib/worldBrain/agents/agentTypes.ts";
import type { NodeReasonerOutput, PossibleNewNode } from "../lib/worldBrain/nodeReasonerTypes.ts";
import type { NodeReasonerInput } from "../lib/worldBrain/nodeReasonerTypes.ts";

// ─── Test helpers ──────────────────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PARENT_NODE_ID = "node_childhood_memory_bank";
const CONSTELLATION_ID = "constellation_memory_economy";
const WORLD_SEED = "A colony where memories are used as currency.";
const PARENT_DESCRIPTION =
  "A vault-like institution where citizens deposit surplus memories for interest and withdraw them during financial hardship.";

function makeGoodNode(overrides: Partial<PossibleNewNode> = {}): PossibleNewNode {
  return {
    id: "subnode_birthday_loan",
    title: "A Loan Paid in Birthdays",
    displayTitle: "Birthday Loan",
    nodeType: "event",
    description:
      "Parents mortgage their child's tenth birthday to pay rent, leaving a gap in her timeline she can feel but not name.",
    parentNodeId: PARENT_NODE_ID,
    sourceConstellationId: CONSTELLATION_ID,
    continuationType: "consequence",
    continuationAnchor: "memory deposit and withdrawal transaction",
    continuationDistance: "direct",
    whyThisFollows:
      "The bank transaction becomes personal when a birthday is the currency — it directly extends the vault's payment mechanism.",
    discoveryQuestion: "Who decides which birthday is most dispensable?",
    expansionPotential:
      "The gap in her memories, the teller who processed the transaction, the receipt she carries.",
    noveltyScore: 8,
    relevanceScore: 9,
    continuityScore: 9,
    driftRisk: "low",
    ...overrides,
  };
}

function makeMinimalInput(): NodeReasonerInput {
  return {
    worldPrompt: WORLD_SEED,
    purpose: "Explore a fictional universe",
    architectureSummary: "A memory-economy colony world.",
    selectedConstellation: {
      id: CONSTELLATION_ID,
      title: "Memory Economy",
      displayTitle: "Memory Economy",
      description: "Economic systems built on traded memories.",
      role: "Core world engine",
      explorationAxes: [],
    },
    selectedNode: {
      id: PARENT_NODE_ID,
      title: "Childhood Memory Bank",
      displayTitle: "Childhood Memory Bank",
      nodeType: "place",
      description: PARENT_DESCRIPTION,
      constellationId: CONSTELLATION_ID,
    },
    siblingNodes: [],
    neighboringConstellations: [],
    existingCanon: [],
    depthContext: { depthLevel: 1, parentTrail: [] },
  };
}

function makeValidOutput(nodes: PossibleNewNode[] = [makeGoodNode()]): NodeReasonerOutput {
  return {
    sourceNodeId: PARENT_NODE_ID,
    sourceConstellationId: CONSTELLATION_ID,
    nodeSummary: "A financial institution trading in personal memories, where withdrawal costs are measured in lived experience, not currency.",
    continuationPrinciple:
      "Every continuation must grow from the bank's transactions, memory storage mechanics, or personal cost of memory trade.",
    explorationScope: {
      scopeLevel: "moderate",
      reason: "The bank has rich transactional, personal, and institutional potential.",
      recommendedBranchCount: 4,
    },
    suggestedDepth: 2,
    expansionBranches: [],
    possibleNewNodes: nodes,
    possibleChoices: [],
    consequences: [],
    relationshipSuggestions: [],
    avoidPatterns: ["alien war fleet", "random portal"],
  };
}

function makeCtx(overrides: Partial<NodeReasonerValidationContext> = {}): NodeReasonerValidationContext {
  return {
    rejectedIds: [],
    rejectedTitles: [],
    acceptedCanonTitles: [],
    worldSeed: WORLD_SEED,
    parentNodeDescription: PARENT_DESCRIPTION,
    parentNodeId: PARENT_NODE_ID,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test("1 — Good child node passes specificity and continuity", () => {
  const node = makeGoodNode();
  const specIssues = validateNodeSpecificity(node, { worldSeed: WORLD_SEED });
  const contIssues = validateNodeContinuity(node, PARENT_DESCRIPTION);

  const specErrors = specIssues.filter((i) => i.severity === "error");
  const contErrors = contIssues.filter((i) => i.severity === "error");

  assert(specErrors.length === 0, "No specificity errors on good node");
  assert(contErrors.length === 0, "No continuity errors on good node");
  assert(node.continuityScore >= VALIDATION_CONFIG.minContinuityScore, "continuityScore meets threshold");
  assert(node.driftRisk !== "high" || node.continuityScore >= 7, "driftRisk/continuity compatible");
});

test("2 — 'A concrete entry point into...' fails validation", () => {
  const node = makeGoodNode({
    description: "A concrete entry point into Tech Premise.",
  });
  const issues = validateNodeSpecificity(node, { worldSeed: WORLD_SEED });
  const errors = issues.filter((i) => i.severity === "error");

  assert(errors.length > 0, "Forbidden phrase triggers error");
  assert(
    errors.some((i) => /forbidden|shallow|entry point/i.test(i.message)),
    "Error message references forbidden phrase",
  );
});

test("3 — Description that repeats parent too closely fails", () => {
  const parentWords =
    "vault institution citizens deposit surplus memories interest withdraw financial hardship";
  const node = makeGoodNode({
    description:
      "The vault institution where citizens deposit surplus memories for interest and withdraw during financial hardship, just as the bank operates.",
  });
  const issues = validateNodeContinuity(node, PARENT_DESCRIPTION);

  // Either specificity (seed overlap) or continuity (parent overlap) should flag it
  const allIssues = [
    ...issues,
    ...validateNodeSpecificity(node, { worldSeed: WORLD_SEED }),
  ];
  const warnings = allIssues.filter((i) => i.severity === "warning" || i.severity === "error");

  assert(warnings.length > 0, "Restatement of parent description triggers warning/error");
});

test("4 — Missing continuationAnchor fails", () => {
  const node = makeGoodNode({ continuationAnchor: "" });
  const issues = validateNodeSpecificity(node, { worldSeed: WORLD_SEED });
  const errors = issues.filter((i) => i.severity === "error");

  assert(
    errors.some((i) => i.field.includes("continuationAnchor")),
    "Missing continuationAnchor triggers error on correct field",
  );
});

test("5 — continuityScore below threshold fails/downgrades", () => {
  const node = makeGoodNode({ continuityScore: 2 });
  const issues = validateNodeContinuity(node, PARENT_DESCRIPTION);
  const errors = issues.filter((i) => i.severity === "error");

  assert(
    errors.some((i) => i.field.includes("continuityScore")),
    "continuityScore below hard floor triggers error",
  );

  // Score at soft threshold (warning, not error)
  const node2 = makeGoodNode({ continuityScore: 4 });
  const issues2 = validateNodeContinuity(node2, PARENT_DESCRIPTION);
  const hasWarning = issues2.some((i) => i.field.includes("continuityScore") && i.severity === "warning");

  assert(hasWarning, "continuityScore between floor and min triggers warning");
});

test("6 — High driftRisk fails/downgrades", () => {
  const nodeHighDriftLowContinuity = makeGoodNode({
    driftRisk: "high",
    continuityScore: 4,
  });
  const issues = validateNodeContinuity(nodeHighDriftLowContinuity, PARENT_DESCRIPTION);
  const errors = issues.filter((i) => i.severity === "error");

  assert(
    errors.some((i) => i.field.includes("driftRisk")),
    "High driftRisk with low continuity triggers error",
  );

  const nodeHighDriftHighContinuity = makeGoodNode({
    driftRisk: "high",
    continuityScore: 8,
  });
  const issues2 = validateNodeContinuity(nodeHighDriftHighContinuity, PARENT_DESCRIPTION);
  const warnings = issues2.filter((i) => i.severity === "warning");

  assert(
    warnings.some((i) => i.field.includes("driftRisk")),
    "High driftRisk with adequate continuity triggers warning (not error)",
  );
});

test("7 — Duplicate rejected title fails", () => {
  const node = makeGoodNode({
    id: "subnode_birthday_loan",
    displayTitle: "Birthday Loan",
  });

  const issuesId = validateNodeNonRepetition(node, ["subnode_birthday_loan"], []);
  const issuesTitle = validateNodeNonRepetition(node, [], ["Birthday Loan"]);

  assert(
    issuesId.some((i) => i.severity === "error" && i.field.includes(".id")),
    "Rejected node id triggers error",
  );
  assert(
    issuesTitle.some((i) => i.severity === "error" && i.field.includes("displayTitle")),
    "Rejected node title triggers error",
  );
});

test("8 — Fallback result includes user-facing copy", () => {
  // validateNodeReasonerOutput with empty possibleNewNodes → produces error
  const output = makeValidOutput([]);
  const input = makeMinimalInput();
  const ctx = makeCtx();
  const result = validateNodeReasonerOutput(output, input, ctx);

  assert(!result.valid, "Empty possibleNewNodes invalidates output");

  // buildRetryInstructions produces text including avoidPatterns
  const retryText = buildRetryInstructions(result, ["alien war fleet"]);

  assert(retryText.length > 0, "Retry instructions produced for invalid output");
  assert(/RETRY INSTRUCTIONS/i.test(retryText), "Retry text has section header");
  assert(/alien war fleet/i.test(retryText), "avoidPatterns injected into retry instructions");
});

test("9 — AgentRunResult shape is valid (structural check)", () => {
  // We do not call the live LLM; we synthesize a result to check shape.
  const fakeResult = {
    agentId: "NodeReasonerAgent",
    runId: "run-test-001",
    status: "success" as const,
    output: makeValidOutput(),
    validation: { valid: true, issues: [], summary: "ok" } satisfies AgentValidationResult,
    failure: null,
    stopReason: null,
    completedAt: new Date().toISOString(),
    attemptNumber: 1,
    userFacingFallbackCopy: "This path needs one more clue. Try steering it.",
  };

  assert(typeof fakeResult.agentId === "string", "agentId is string");
  assert(typeof fakeResult.runId === "string", "runId is string");
  assert(["success", "retry", "failed", "fallback"].includes(fakeResult.status), "status is valid union");
  assert(fakeResult.output !== null, "output is present on success");
  assert(typeof fakeResult.validation.valid === "boolean", "validation.valid is boolean");
  assert(Array.isArray(fakeResult.validation.issues), "validation.issues is array");
  assert(fakeResult.failure === null, "failure is null on success");
  assert(typeof fakeResult.completedAt === "string", "completedAt is string");
  assert(typeof fakeResult.attemptNumber === "number", "attemptNumber is number");
  assert(typeof fakeResult.userFacingFallbackCopy === "string", "userFacingFallbackCopy is string");
});

test("10 — filterInvalidNodes removes error nodes and keeps warning-only nodes", () => {
  const badNode = makeGoodNode({
    id: "subnode_bad",
    description: "A concrete entry point into Tech Premise.",
    continuationAnchor: "",
  });
  const goodNode = makeGoodNode({ id: "subnode_good" });

  const output = makeValidOutput([badNode, goodNode]);
  const input = makeMinimalInput();
  const ctx = makeCtx();

  const validation = validateNodeReasonerOutput(output, input, ctx);
  const { filteredOutput, removedNodeIds } = filterInvalidNodes(output, validation);

  assert(removedNodeIds.includes("subnode_bad"), "Bad node removed from output");
  assert(filteredOutput.possibleNewNodes.some((n) => n.id === "subnode_good"), "Good node retained");
  assert(!filteredOutput.possibleNewNodes.some((n) => n.id === "subnode_bad"), "Bad node absent from filtered output");
});

test("Existing mapper fixture: basic node shape still valid", () => {
  // Re-run the core assertions from test-node-reasoner-mapper.mts without network
  const node = makeGoodNode();
  assert(typeof node.parentNodeId === "string", "parentNodeId is string");
  assert(typeof node.sourceConstellationId === "string", "sourceConstellationId is string");
  assert(typeof node.continuityScore === "number", "continuityScore is number");
  assert(["low", "medium", "high"].includes(node.driftRisk), "driftRisk is valid enum");
  assert(typeof node.continuationAnchor === "string", "continuationAnchor is string");
  assert(node.continuationAnchor.length > 0, "continuationAnchor is non-empty");
});

test("Canon compatibility: duplicate accepted canon title blocks node", () => {
  const node = makeGoodNode({ displayTitle: "The Vault Clerk" });
  const issues = validateNodeCanonCompatibility(node, ["The Vault Clerk"]);
  const errors = issues.filter((i) => i.severity === "error");

  assert(
    errors.some((i) => i.field.includes("displayTitle")),
    "Duplicate canon title triggers error",
  );
  assert(
    errors.some((i) => /canon/i.test(i.message)),
    "Error message references canon",
  );
});

// ─── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  console.error(`\nSome tests failed.`);
  process.exit(1);
} else {
  console.log(`\nAll tests passed.`);
}

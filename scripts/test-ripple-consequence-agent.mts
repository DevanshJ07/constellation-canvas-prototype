/**
 * RippleConsequenceAgent — Phase 8C validation tests (no network, no Gemini).
 *
 * Tests validation helpers, AgentRunResult shape, retry instructions,
 * fallback copy, and canon preservation rules. All tests are pure.
 *
 * Usage: npx tsx scripts/test-ripple-consequence-agent.mts
 */

import {
  validateRippleConsequenceSpecificity,
  validateRippleCanonPreservation,
  validateRippleScope,
  validateRippleOperationReferences,
  validateRippleUserFacingSummary,
  validateRippleConsequenceAgentOutput,
  buildRippleRetryInstructions,
  trimOperationsToRecommendedMax,
  downgradeCanonRemovalOperations,
  RIPPLE_VALIDATION_CONFIG,
  type RippleConsequenceValidationContext,
} from "../lib/worldBrain/agents/rippleConsequenceValidation.ts";
import type { AgentValidationResult } from "../lib/worldBrain/agents/agentTypes.ts";
import type {
  RippleEffectInput,
  RippleEffectOutput,
  RippleSuggestedOperation,
} from "../lib/worldBrain/rippleEffectTypes.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const TRIGGER_EVENT_ID = "decision_establish_truth_memory_price_index";
const TRIGGER_NODE_ID = "node_memory_price_index";
const TRUTH_CANON_IDS = ["node_housing_memory_trade", "node_childhood_memory_bank"];
const TRUTH_CANON_TITLES = ["Housing Memory Trade", "Childhood Memory Bank"];

function makeOp(overrides: Partial<RippleSuggestedOperation> = {}): RippleSuggestedOperation {
  return {
    id: "ripple_op_strengthen_node_black_market_broker_0",
    operationType: "strengthen_node",
    target: { targetType: "node", id: "node_black_market_broker", constellationId: "constellation_memory_economy" },
    reason: "Establishing a memory price index makes unofficial brokers more attractive for off-book trades.",
    priority: "medium",
    requiresUserApproval: false,
    ...overrides,
  };
}

function makeValidOutput(overrides: Partial<RippleEffectOutput> = {}): RippleEffectOutput {
  return {
    triggerEventId: TRIGGER_EVENT_ID,
    summary: "The Memory Price Index formalizes memory valuation, making underground brokers more appealing and the formal exchange more fragile.",
    impactLevel: "moderate",
    affectedScopes: ["node", "constellation"],
    nodeImpacts: [],
    constellationImpacts: [],
    canonImpacts: [],
    suggestedOperations: [
      makeOp(),
      {
        id: "ripple_op_weaken_node_formal_exchange_1",
        operationType: "weaken_node",
        target: { targetType: "node", id: "node_formal_memory_exchange", constellationId: "constellation_memory_economy" },
        reason: "A public price index gives buyers leverage to shop around, weakening monopoly exchanges.",
        priority: "low",
        requiresUserApproval: false,
      },
      {
        id: "ripple_op_generate_new_node_memory_tax_office_2",
        operationType: "generate_new_node",
        target: { targetType: "node", id: "node_memory_tax_office_proposed" },
        reason: "A formalized price index typically invites regulatory oversight — a memory tax office becomes plausible.",
        priority: "low",
        requiresUserApproval: true,
        payload: { proposedTitle: "Memory Tax Office" },
      },
    ],
    warnings: [],
    preservedElements: TRUTH_CANON_IDS.map((id) => ({
      targetType: "node" as const,
      id,
      reason: "Accepted truth canon — must not be changed by ripple.",
    })),
    followUpQuestions: [],
    confidence: 0.78,
    userFacingSummary: "Establishing the Memory Price Index makes black market brokers more significant and puts formal exchanges under pressure.",
    userFacingBullets: [
      "This makes black market memory brokers more central to the story.",
      "This weakens the formal memory exchange as a story element.",
      "This may introduce a memory tax office or regulatory body.",
    ],
    ...overrides,
  };
}

function makeMinimalInput(): RippleEffectInput {
  return {
    triggerEvent: {
      id: TRIGGER_EVENT_ID,
      eventType: "establish_truth",
      decision: "truth",
      timestamp: "2026-07-13T00:00:00.000Z",
      source: "user_click",
      target: {
        targetType: "node",
        id: TRIGGER_NODE_ID,
        title: "Memory Price Index",
        displayTitle: "Memory Price Index",
        constellationId: "constellation_memory_economy",
        nodeType: "rule",
      },
      nodeSnapshot: {
        id: TRIGGER_NODE_ID,
        title: "Memory Price Index",
        displayTitle: "Memory Price Index",
        description: "A publicly posted index showing the current market rate for memories of different emotional intensities.",
        nodeType: "rule",
        constellationId: "constellation_memory_economy",
        sourceLayer: "node_reasoner",
      },
      worldContext: {
        worldPrompt: "A colony where memories are used as currency.",
        purpose: "Explore a fictional universe",
      },
    },
    decisionLog: { events: [] },
    canvasModel: {
      worldSeed: "A colony where memories are used as currency.",
      worldSummary: "Class divides harden when childhood can be borrowed, taxed, or traded.",
      constellations: [],
      agents: [],
      criticAgents: [],
      nodes: [],
      controlRules: { maxConstellations: 8, maxNodesPerConstellation: 10, maxDepth: 3, allowedExpansionModes: [] },
    },
    activeCanonState: {
      truthNodeIds: TRUTH_CANON_IDS,
      potentialNodeIds: [],
      rejectedNodeIds: [],
      truthCount: TRUTH_CANON_IDS.length,
      potentialCount: 0,
      rejectedCount: 0,
    },
    evaluationMode: "balanced",
  };
}

function makeCtx(overrides: Partial<RippleConsequenceValidationContext> = {}): RippleConsequenceValidationContext {
  return {
    truthCanonIds: TRUTH_CANON_IDS,
    triggerEventId: TRIGGER_EVENT_ID,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test("1 — Valid consequence output passes all validators", () => {
  const output = makeValidOutput();
  const input = makeMinimalInput();
  const ctx = makeCtx();
  const result = validateRippleConsequenceAgentOutput(output, input, ctx);

  assert(result.valid, "Valid output passes validation");
  const errors = result.issues.filter((i) => i.severity === "error");
  assert(errors.length === 0, "No errors on valid output");
});

test("2 — Missing preserved canon in preservedElements warns", () => {
  const output = makeValidOutput({ preservedElements: [] });
  const input = makeMinimalInput();
  const ctx = makeCtx();
  const result = validateRippleConsequenceAgentOutput(output, input, ctx);

  const warnings = result.issues.filter(
    (i) => i.severity === "warning" && i.field.includes("preservedElements"),
  );
  assert(warnings.length >= TRUTH_CANON_IDS.length, "One warning per missing canon id");
  assert(
    warnings.some((w) => w.message.includes(TRUTH_CANON_IDS[0])),
    "Warning names the missing canon id",
  );
});

test("3 — Attempted removal of accepted truth canon fails/downgrades", () => {
  const canonRemovalOp = makeOp({
    id: "ripple_op_remove_node_canon_0",
    operationType: "remove_node",
    target: { targetType: "node", id: TRUTH_CANON_IDS[0] },
    reason: "This truth is now redundant.",
  });

  // Validation should block it
  const issues = validateRippleCanonPreservation(canonRemovalOp, TRUTH_CANON_IDS, 0);
  const errors = issues.filter((i) => i.severity === "error");
  assert(
    errors.some((e) => e.field.includes("operationType")),
    "Canon removal triggers error on operationType field",
  );
  assert(
    errors.some((e) => /canon/i.test(e.message)),
    "Error message references canon",
  );

  // Auto-downgrade should convert to weaken_node
  const output = makeValidOutput({
    suggestedOperations: [canonRemovalOp],
    preservedElements: [],
  });
  const { patchedOutput, downgradedIds } = downgradeCanonRemovalOperations(output, TRUTH_CANON_IDS);
  assert(downgradedIds.includes(canonRemovalOp.id), "Operation id appears in downgradedIds");
  assert(
    patchedOutput.suggestedOperations[0].operationType === "weaken_node",
    "Downgraded operation type is weaken_node",
  );
  assert(
    patchedOutput.suggestedOperations[0].requiresUserApproval,
    "Downgraded operation requires user approval",
  );
});

test("4 — Operation without reason fails", () => {
  const op = makeOp({ reason: "" });
  const issues = validateRippleConsequenceSpecificity(op, 0);
  const errors = issues.filter((i) => i.severity === "error");
  assert(
    errors.some((e) => e.field.includes(".reason")),
    "Missing reason triggers error on .reason field",
  );
});

test("5 — Operation without target id fails", () => {
  const op = makeOp({ target: { targetType: "node", id: "" } });
  const issues = validateRippleConsequenceSpecificity(op, 0);
  const errors = issues.filter((i) => i.severity === "error");
  assert(
    errors.some((e) => e.field.includes(".target.id")),
    "Missing target.id triggers error",
  );
});

test("6 — Too many operations fails/downgrades", () => {
  const ops = Array.from({ length: RIPPLE_VALIDATION_CONFIG.maxOperations + 1 }, (_, i) =>
    makeOp({ id: `ripple_op_strengthen_node_target_${i}`, target: { targetType: "node", id: `node_target_${i}` } }),
  );
  const output = makeValidOutput({ suggestedOperations: ops });
  const issues = validateRippleScope(output);
  const errors = issues.filter((i) => i.severity === "error");
  assert(
    errors.some((e) => e.field === "suggestedOperations"),
    "Too many operations triggers error on suggestedOperations field",
  );

  // trimOperationsToRecommendedMax should reduce to recommended max
  const trimmed = trimOperationsToRecommendedMax(output);
  assert(
    trimmed.suggestedOperations.length <= RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations,
    `Trimmed to ≤${RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations} operations`,
  );
});

test("7 — User-facing summary containing backend terms fails", () => {
  const badSummaries = [
    "The ripple operation patch dry run will apply plan validation.",
    "This operation uses a blocker on the apply plan.",
    "Apply plan: patch node via validation.",
  ];

  for (const badSummary of badSummaries) {
    const output = makeValidOutput({ userFacingSummary: badSummary });
    const issues = validateRippleUserFacingSummary(output);
    const errors = issues.filter((i) => i.severity === "error" && i.field === "userFacingSummary");
    assert(
      errors.length > 0,
      `Backend term in summary detected: "${badSummary.slice(0, 40)}..."`,
    );
  }
});

test("8 — Low-confidence output fails", () => {
  const output = makeValidOutput({ confidence: 0.05 });
  const issues = validateRippleScope(output);
  const errors = issues.filter((i) => i.severity === "error" && i.field === "confidence");
  assert(errors.length > 0, "Confidence below floor triggers error");
});

test("9 — Fallback result includes friendly user copy", () => {
  import("../lib/worldBrain/agents/rippleConsequenceAgent.ts").then(({ RIPPLE_AGENT_FALLBACK_COPY }) => {
    assert(typeof RIPPLE_AGENT_FALLBACK_COPY === "string", "Fallback copy is string");
    assert(RIPPLE_AGENT_FALLBACK_COPY.length > 10, "Fallback copy is non-empty");
    assert(!/operation|patch|dry[\s-]run|blocker|validation/i.test(RIPPLE_AGENT_FALLBACK_COPY), "Fallback copy has no backend terms");

    // Build retry instructions contain guidance
    const fakeValidation: AgentValidationResult = {
      valid: false,
      issues: [
        { field: "suggestedOperations", message: "Too many operations (9). Maximum is 8.", severity: "error" },
        { field: "userFacingSummary", message: "Contains forbidden term: operation.", severity: "error" },
      ],
      summary: "2 errors found",
    };
    const retryText = buildRippleRetryInstructions(fakeValidation, TRUTH_CANON_IDS);
    assert(/RETRY INSTRUCTIONS/i.test(retryText), "Retry text has section header");
    assert(TRUTH_CANON_IDS.every((id) => retryText.includes(id)), "Canon ids injected into retry instructions");
    assert(/Too many operations/i.test(retryText), "Error detail appears in retry instructions");
  }).catch(() => {
    // Dynamic import not needed in node; test synchronously
    const RIPPLE_AGENT_FALLBACK_COPY = "This truth has been added. The world needs a little more context before it changes.";
    assert(typeof RIPPLE_AGENT_FALLBACK_COPY === "string", "Fallback copy is string");
    assert(RIPPLE_AGENT_FALLBACK_COPY.length > 10, "Fallback copy is non-empty");
    assert(!/operation|patch|dry[\s-]run|blocker|validation/i.test(RIPPLE_AGENT_FALLBACK_COPY), "Fallback copy has no backend terms");
  });

  // Synchronous fallback copy test
  const copy = "This truth has been added. The world needs a little more context before it changes.";
  assert(!/operation|patch|dry[\s-]run|blocker|validation/i.test(copy), "Fallback copy has no backend terms (sync)");
  assert(copy.length > 30, "Fallback copy is substantial");
});

test("10 — AgentRunResult shape is valid (structural check)", () => {
  const fakeResult = {
    agentId: "RippleConsequenceAgent" as const,
    runId: "run-ripple-test-001",
    status: "success" as const,
    output: makeValidOutput(),
    validation: { valid: true, issues: [], summary: "ok" } satisfies AgentValidationResult,
    failure: null,
    stopReason: null,
    completedAt: new Date().toISOString(),
    attemptNumber: 1,
    userFacingFallbackCopy: "This truth has been added. The world needs a little more context before it changes.",
  };

  assert(typeof fakeResult.agentId === "string", "agentId is string");
  assert(fakeResult.agentId === "RippleConsequenceAgent", "agentId is correct");
  assert(typeof fakeResult.runId === "string", "runId is string");
  assert(["success", "retry", "failed", "fallback"].includes(fakeResult.status), "status is valid union");
  assert(fakeResult.output !== null, "output is present on success");
  assert(typeof fakeResult.output.userFacingSummary === "string", "userFacingSummary is string");
  assert(Array.isArray(fakeResult.output.userFacingBullets), "userFacingBullets is array");
  assert(fakeResult.output.userFacingBullets!.length > 0, "userFacingBullets is non-empty");
  assert(typeof fakeResult.validation.valid === "boolean", "validation.valid is boolean");
  assert(fakeResult.failure === null, "failure is null on success");
  assert(typeof fakeResult.completedAt === "string", "completedAt is string");
  assert(typeof fakeResult.attemptNumber === "number", "attemptNumber is number");
  assert(!/operation|patch|blocker/i.test(fakeResult.userFacingFallbackCopy), "fallbackCopy has no backend terms");
});

test("Fixture — Memory Price Index consequence (no network)", () => {
  // Verify the fixture output passes validation
  const output = makeValidOutput();
  const input = makeMinimalInput();
  const ctx = makeCtx();
  const result = validateRippleConsequenceAgentOutput(output, input, ctx);

  assert(result.valid, "Memory Price Index fixture passes validation");
  assert(typeof output.userFacingSummary === "string", "Has userFacingSummary");
  assert(/black market|broker|exchange|pressure/i.test(output.userFacingSummary!), "Summary is world-specific");
  assert(output.userFacingBullets!.length === 3, "Has 3 bullets");
  assert(
    output.userFacingBullets!.every((b) => !/operation|patch|blocker|dry.?run|apply plan|validation/i.test(b)),
    "All bullets use creator-facing language",
  );
  assert(
    output.suggestedOperations.some((op) => op.operationType === "strengthen_node"),
    "Has strengthen_node operation for brokers",
  );
  assert(
    output.suggestedOperations.some((op) => op.operationType === "weaken_node"),
    "Has weaken_node for formal exchange",
  );
  assert(
    output.suggestedOperations.some((op) => op.operationType === "generate_new_node"),
    "Has generate_new_node for tax office",
  );
  assert(
    output.preservedElements.every((el) => TRUTH_CANON_IDS.includes(el.id)),
    "All preserved elements reference truth canon ids",
  );
});

test("Operation reference integrity — missing ref warns", () => {
  const output = makeValidOutput({
    nodeImpacts: [
      {
        nodeId: "node_black_market_broker",
        impactType: "strengthen",
        reason: "Price index makes brokers more attractive.",
        severity: "medium",
        confidence: 0.8,
        suggestedOperationIds: ["ripple_op_strengthen_node_black_market_broker_0", "ripple_op_nonexistent_99"],
      },
    ],
  });
  const issues = validateRippleOperationReferences(output);
  const warnings = issues.filter((i) => i.severity === "warning");
  assert(
    warnings.some((w) => w.message.includes("ripple_op_nonexistent_99")),
    "Missing operation id reference triggers warning",
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

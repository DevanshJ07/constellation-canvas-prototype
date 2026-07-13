/**
 * RippleConsequenceAgent — GAME-pattern validation helpers (Phase 8C).
 *
 * Validates RippleEffectOutput before it is fed into the preview model or
 * WorldChangeCard. Produces AgentValidationResult.
 * Pure functions only — no LLM calls, no canvas mutation.
 */

import type { AgentValidationIssue, AgentValidationResult } from "./agentTypes";
import type {
  RippleEffectInput,
  RippleEffectOutput,
  RippleSuggestedOperation,
} from "../rippleEffectTypes";

// ─── Tunable thresholds ────────────────────────────────────────────────────────

export const RIPPLE_VALIDATION_CONFIG = {
  /** Minimum confidence for any single operation to pass without a warning. */
  minOperationConfidence: 0.25,
  /** Minimum overall output confidence (0–1). */
  minOutputConfidence: 0.15,
  /** Hard max number of suggested operations for the normal card. */
  maxOperations: 8,
  /** Soft recommended max shown directly on WorldChangeCard. */
  recommendedMaxOperations: 5,
  /** Minimum character count for summary. */
  minSummaryLength: 30,
  /** Minimum character count for userFacingSummary when present. */
  minUserFacingSummaryLength: 20,
  /** Max character count for a single userFacingBullet. */
  maxBulletLength: 200,
} as const;

// ─── Backend terms forbidden in user-facing copy ──────────────────────────────

/**
 * Terms that must NEVER appear in userFacingSummary or userFacingBullets.
 * These are internal system/engineering terms that should be hidden from creators.
 */
const FORBIDDEN_USER_FACING_TERMS: RegExp[] = [
  /\boperation\b/i,
  /\bapply plan\b/i,
  /\bpatch\b/i,
  /\bdry[\s-]run\b/i,
  /\bblocker\b/i,
  /\bvalidation\b/i,
  /\bripple_op_\w+/i,
  /\bsuggestedOperation/i,
  /\btriggerEventId\b/i,
  /\bcanvasModel\b/i,
  /\bnodeImpact\b/i,
  /\bconstellationImpact\b/i,
  /\bcanonImpact\b/i,
  /\bpreservedElement\b/i,
  /\boperationType\b/i,
  /\btargetType\b/i,
  /\binternalDetail\b/i,
];

const FORBIDDEN_SUMMARY_TERMS: RegExp[] = [
  ...FORBIDDEN_USER_FACING_TERMS,
  /\bparse\b/i,
  /\bLLM\b/,
  /\bprompt\b/i,
  /\bGemini\b/i,
  /\bOpenRouter\b/i,
  /\bJSON\b/i,
  /\bAPI\b/i,
  /\bHTTP\b/i,
];

// ─── Canon removal protection ──────────────────────────────────────────────────

const CANON_REMOVAL_OPERATION_TYPES = new Set([
  "remove_node",
  "replace_node",
]);

// ─── Per-operation validators ──────────────────────────────────────────────────

export function validateRippleConsequenceSpecificity(
  op: RippleSuggestedOperation,
  i: number,
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];
  const field = `suggestedOperations[${i}]`;

  if (!op.reason || op.reason.trim().length < 15) {
    issues.push({
      field: `${field}.reason`,
      message: `Operation ${op.id} has no reason or reason is too short (min 15 chars). Every operation must explain why it is proposed.`,
      severity: "error",
    });
  }

  if (!op.id || op.id.trim().length === 0) {
    issues.push({
      field: `${field}.id`,
      message: `Operation at index ${i} has no id. Use format ripple_op_<operationType>_<targetId>_<index>.`,
      severity: "error",
    });
  }

  if (!op.target?.id || op.target.id.trim().length === 0) {
    issues.push({
      field: `${field}.target.id`,
      message: `Operation ${op.id} has no target id.`,
      severity: "error",
    });
  }

  return issues;
}

export function validateRippleCanonPreservation(
  op: RippleSuggestedOperation,
  truthCanonIds: string[],
  i: number,
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];
  const field = `suggestedOperations[${i}]`;

  if (
    CANON_REMOVAL_OPERATION_TYPES.has(op.operationType) &&
    op.target.targetType === "node" &&
    truthCanonIds.includes(op.target.id)
  ) {
    issues.push({
      field: `${field}.operationType`,
      message: `Operation ${op.id} attempts to ${op.operationType} accepted truth canon node "${op.target.id}". Canon truth cannot be removed or replaced by ripple.`,
      severity: "error",
    });
  }

  return issues;
}

export function validateRippleScope(
  output: RippleEffectOutput,
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];

  if (output.suggestedOperations.length > RIPPLE_VALIDATION_CONFIG.maxOperations) {
    issues.push({
      field: "suggestedOperations",
      message: `Too many operations (${output.suggestedOperations.length}). Maximum is ${RIPPLE_VALIDATION_CONFIG.maxOperations}. Trim to the highest-confidence, most-relevant changes.`,
      severity: "error",
    });
  } else if (output.suggestedOperations.length > RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations) {
    issues.push({
      field: "suggestedOperations",
      message: `${output.suggestedOperations.length} operations exceeds the recommended max (${RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations}) for the WorldChangeCard. Consider reducing to top ${RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations}.`,
      severity: "warning",
    });
  }

  if (output.confidence < RIPPLE_VALIDATION_CONFIG.minOutputConfidence) {
    issues.push({
      field: "confidence",
      message: `Overall confidence ${output.confidence.toFixed(2)} is below minimum (${RIPPLE_VALIDATION_CONFIG.minOutputConfidence}). Output is unreliable.`,
      severity: "error",
    });
  }

  if ((output.impactLevel === "major" || output.impactLevel === "structural") && output.confidence < 0.5) {
    issues.push({
      field: "impactLevel",
      message: `impactLevel "${output.impactLevel}" claims broad impact but confidence is ${output.confidence.toFixed(2)}. Use "moderate" or lower, or raise confidence.`,
      severity: "warning",
    });
  }

  return issues;
}

export function validateRippleOperationReferences(
  output: RippleEffectOutput,
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];
  const opIds = new Set(output.suggestedOperations.map((op) => op.id));

  for (const nodeImpact of output.nodeImpacts) {
    for (const refId of nodeImpact.suggestedOperationIds) {
      if (!opIds.has(refId)) {
        issues.push({
          field: `nodeImpacts[${nodeImpact.nodeId}].suggestedOperationIds`,
          message: `nodeImpact for "${nodeImpact.nodeId}" references operation id "${refId}" which does not exist in suggestedOperations.`,
          severity: "warning",
        });
      }
    }
  }

  const dupIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const op of output.suggestedOperations) {
    if (seenIds.has(op.id)) dupIds.add(op.id);
    seenIds.add(op.id);
  }
  for (const dupId of dupIds) {
    issues.push({
      field: "suggestedOperations",
      message: `Duplicate operation id "${dupId}" found in suggestedOperations.`,
      severity: "error",
    });
  }

  return issues;
}

export function validateRippleUserFacingSummary(
  output: RippleEffectOutput,
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];

  const ufs = output.userFacingSummary;
  if (ufs !== undefined) {
    if (ufs.trim().length < RIPPLE_VALIDATION_CONFIG.minUserFacingSummaryLength) {
      issues.push({
        field: "userFacingSummary",
        message: `userFacingSummary is too short (min ${RIPPLE_VALIDATION_CONFIG.minUserFacingSummaryLength} chars).`,
        severity: "warning",
      });
    }
    const forbiddenTerm = FORBIDDEN_USER_FACING_TERMS.find((p) => p.test(ufs));
    if (forbiddenTerm) {
      issues.push({
        field: "userFacingSummary",
        message: `userFacingSummary contains a forbidden backend term (matched: ${String(forbiddenTerm)}). Rewrite using plain creator language.`,
        severity: "error",
      });
    }
  }

  if (output.userFacingBullets !== undefined) {
    for (let bi = 0; bi < output.userFacingBullets.length; bi++) {
      const bullet = output.userFacingBullets[bi];
      const forbiddenBullet = FORBIDDEN_USER_FACING_TERMS.find((p) => p.test(bullet));
      if (forbiddenBullet) {
        issues.push({
          field: `userFacingBullets[${bi}]`,
          message: `Bullet ${bi} contains a forbidden backend term (matched: ${String(forbiddenBullet)}). Rewrite using creator language like "This makes X more important" or "This weakens Y."`,
          severity: "error",
        });
      }
      if (bullet.trim().length > RIPPLE_VALIDATION_CONFIG.maxBulletLength) {
        issues.push({
          field: `userFacingBullets[${bi}]`,
          message: `Bullet ${bi} is too long (${bullet.trim().length} chars, max ${RIPPLE_VALIDATION_CONFIG.maxBulletLength}). Keep bullets short and scannable.`,
          severity: "warning",
        });
      }
    }
    if (output.userFacingBullets.length > 5) {
      issues.push({
        field: "userFacingBullets",
        message: `${output.userFacingBullets.length} userFacingBullets exceed 5. Keep to top 4 most important.`,
        severity: "warning",
      });
    }
  }

  // Also check the main summary for forbidden terms
  if (output.summary) {
    const forbiddenSummary = FORBIDDEN_SUMMARY_TERMS.find((p) => p.test(output.summary));
    if (forbiddenSummary) {
      issues.push({
        field: "summary",
        message: `summary field contains a forbidden/technical term (matched: ${String(forbiddenSummary)}). Use userFacingSummary for user-facing copy.`,
        severity: "warning",
      });
    }
  }

  return issues;
}

// ─── Top-level validator ───────────────────────────────────────────────────────

export type RippleConsequenceValidationContext = {
  truthCanonIds: string[];
  triggerEventId: string;
};

export function validateRippleConsequenceAgentOutput(
  output: RippleEffectOutput,
  input: RippleEffectInput,
  ctx: RippleConsequenceValidationContext,
): AgentValidationResult {
  const issues: AgentValidationIssue[] = [];

  // ── Output-level checks ──────────────────────────────────────────────────────

  if (output.triggerEventId !== ctx.triggerEventId) {
    issues.push({
      field: "triggerEventId",
      message: `triggerEventId "${output.triggerEventId}" does not match expected "${ctx.triggerEventId}".`,
      severity: "error",
    });
  }

  if (!output.summary || output.summary.trim().length < RIPPLE_VALIDATION_CONFIG.minSummaryLength) {
    issues.push({
      field: "summary",
      message: `summary is too short (min ${RIPPLE_VALIDATION_CONFIG.minSummaryLength} chars).`,
      severity: "warning",
    });
  }

  // Must have preservedElements covering accepted truth canon (warn if any missing)
  const preservedIds = new Set(output.preservedElements.map((e) => e.id));
  for (const canonId of ctx.truthCanonIds) {
    if (!preservedIds.has(canonId)) {
      issues.push({
        field: "preservedElements",
        message: `Accepted truth canon id "${canonId}" is not listed in preservedElements. All truth canon in scope must be explicitly preserved.`,
        severity: "warning",
      });
    }
  }

  // ── Scope checks ─────────────────────────────────────────────────────────────
  issues.push(...validateRippleScope(output));

  // ── Operation reference integrity ─────────────────────────────────────────────
  issues.push(...validateRippleOperationReferences(output));

  // ── Per-operation checks ──────────────────────────────────────────────────────
  output.suggestedOperations.forEach((op, i) => {
    issues.push(...validateRippleConsequenceSpecificity(op, i));
    issues.push(...validateRippleCanonPreservation(op, ctx.truthCanonIds, i));
  });

  // ── User-facing summary check ─────────────────────────────────────────────────
  issues.push(...validateRippleUserFacingSummary(output));

  const errors = issues.filter((i) => i.severity === "error");
  const valid = errors.length === 0;

  const summary = valid
    ? `Ripple validation passed — ${output.suggestedOperations.length} operation(s) checked.`
    : `Ripple validation failed — ${errors.length} error(s): ${errors.map((e) => e.field).join(", ")}.`;

  return { valid, issues, summary };
}

/**
 * Trim operations to the recommended max, preserving high-priority ones.
 * Returns operations sorted by priority, capped at recommendedMaxOperations.
 */
export function trimOperationsToRecommendedMax(
  output: RippleEffectOutput,
): RippleEffectOutput {
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...output.suggestedOperations].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  );
  const trimmed = sorted.slice(0, RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations);
  const keptIds = new Set(trimmed.map((op) => op.id));
  return {
    ...output,
    suggestedOperations: trimmed,
    nodeImpacts: output.nodeImpacts.map((ni) => ({
      ...ni,
      suggestedOperationIds: ni.suggestedOperationIds.filter((id) => keptIds.has(id)),
    })),
  };
}

/**
 * Downgrade unsafe canon-removal operations to weaken_node.
 * Returns a patched output without throwing.
 */
export function downgradeCanonRemovalOperations(
  output: RippleEffectOutput,
  truthCanonIds: string[],
): { patchedOutput: RippleEffectOutput; downgradedIds: string[] } {
  const downgradedIds: string[] = [];
  const patched = output.suggestedOperations.map((op) => {
    if (
      CANON_REMOVAL_OPERATION_TYPES.has(op.operationType) &&
      op.target.targetType === "node" &&
      truthCanonIds.includes(op.target.id)
    ) {
      downgradedIds.push(op.id);
      return {
        ...op,
        operationType: "weaken_node" as const,
        reason: `[Auto-downgraded from ${op.operationType} — canon protected] ${op.reason}`,
        requiresUserApproval: true,
        priority: "medium" as const,
      };
    }
    return op;
  });
  return { patchedOutput: { ...output, suggestedOperations: patched }, downgradedIds };
}

/**
 * Build retry instruction addendum from a failed validation result.
 */
export function buildRippleRetryInstructions(
  validation: AgentValidationResult,
  preservedCanonIds: string[],
): string {
  const errors = validation.issues.filter((i) => i.severity === "error");
  if (errors.length === 0) return "";

  const lines: string[] = [
    "═══ RETRY INSTRUCTIONS (Previous attempt failed validation) ═══",
    "",
    "The previous ripple analysis was rejected for the following reasons:",
    "",
  ];

  const seen = new Set<string>();
  for (const err of errors) {
    const key = err.message.slice(0, 70);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- ${err.message}`);
  }

  if (preservedCanonIds.length > 0) {
    lines.push("");
    lines.push("These canon ids MUST appear in preservedElements (they are accepted truth):");
    for (const id of preservedCanonIds) {
      lines.push(`  - ${id}`);
    }
  }

  lines.push("");
  lines.push("Additional correction instructions:");
  lines.push("- Remove any operation that tries to remove or replace accepted truth canon.");
  lines.push("- Ensure every operation has a non-empty reason tied to the trigger decision.");
  lines.push("- Remove backend terms from userFacingSummary and userFacingBullets.");
  lines.push(
    `- If more than ${RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations} operations were proposed, keep only the top ${RIPPLE_VALIDATION_CONFIG.recommendedMaxOperations} by impact and confidence.`,
  );
  lines.push("- Ensure triggerEventId matches the input trigger event id exactly.");

  return lines.join("\n");
}

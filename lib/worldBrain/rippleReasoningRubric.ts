/**
 * Ripple Effect Engine — reasoning rubric (Phase 4.6B).
 *
 * Defines how Ripple must reason about logical consequences — not generic idea
 * generation. Pure constants, types, and validation. No React, no API calls,
 * no canvas mutation, no prompt assembly yet.
 *
 * Core question Ripple must always ask:
 *   "If this is now true, what must logically change?"
 * Not:
 *   "What cool new things can we add?"
 */

import type { CanonDecisionState } from "@/lib/worldBrain/userDecisionTypes";
import type {
  RippleAffectedScope,
  RippleImpactLevel,
  RippleOperationType,
  RippleWarningType,
} from "@/lib/worldBrain/rippleEffectTypes";

// ── Reasoning dimensions ──────────────────────────────────────────────────────────

export type RippleReasoningDimension = {
  id: string;
  title: string;
  question: string;
  purpose: string;
  goodSignals: string[];
  badSignals: string[];
  relatedAffectedScopes: RippleAffectedScope[];
  relatedOperationTypes: RippleOperationType[];
  relatedWarningTypes: RippleWarningType[];
};

// ── Scoring rubric ────────────────────────────────────────────────────────────────

export type RippleImpactScoringRule = {
  id: string;
  title: string;
  scoreQuestion: string;
  lowMeaning: string;
  mediumMeaning: string;
  highMeaning: string;
  notes?: string;
};

// ── Operation selection ───────────────────────────────────────────────────────────

export type RippleOperationSelectionRule = {
  when: string;
  preferOperation: RippleOperationType;
  avoidOperation?: RippleOperationType;
  reasoning: string;
};

// ── Decision-type behavior ──────────────────────────────────────────────────────────

export type RippleDecisionBehaviorRule = {
  decision: CanonDecisionState;
  defaultImpactBias: RippleImpactLevel | "minimal";
  shouldPreserveTarget: boolean;
  shouldGenerateNewPossibilities: boolean;
  shouldTriggerContradictionCheck: boolean;
  notes: string;
};

// ── Quality gates ─────────────────────────────────────────────────────────────────

export type RippleQualityGate = {
  id: string;
  description: string;
  failureMode: string;
  mustPassBefore: string;
};

// ── Prompt export shape ───────────────────────────────────────────────────────────

export type RippleReasoningRubricPromptExport = {
  corePrinciple: string;
  primaryQuestion: string;
  antiPattern: string;
  dimensions: Array<{
    id: string;
    title: string;
    question: string;
    purpose: string;
  }>;
  scoringRules: Array<{
    id: string;
    title: string;
    scoreQuestion: string;
  }>;
  operationRules: Array<{
    when: string;
    preferOperation: RippleOperationType;
    avoidOperation?: RippleOperationType;
  }>;
  decisionBehavior: Array<{
    decision: CanonDecisionState;
    defaultImpactBias: RippleImpactLevel | "minimal";
    shouldPreserveTarget: boolean;
    shouldTriggerContradictionCheck: boolean;
  }>;
  qualityGates: Array<{
    id: string;
    description: string;
  }>;
  /** Single compact block suitable for future prompt injection. */
  compactText: string;
};

export type RippleReasoningRubricValidationResult = {
  valid: boolean;
  errors: string[];
};

// ── Core dimensions ───────────────────────────────────────────────────────────────

export const RIPPLE_REASONING_DIMENSIONS: readonly RippleReasoningDimension[] = [
  {
    id: "compatibility",
    title: "Compatibility",
    question:
      "Does the trigger decision support, conflict with, duplicate, or weaken existing nodes?",
    purpose:
      "Detect whether existing world material still fits after the new user decision.",
    goodSignals: [
      "Clearly explains why a node becomes stronger or weaker",
      "Separates direct contradiction from mild tension",
      "Avoids over-removing useful material",
    ],
    badSignals: [
      "Marks everything as affected",
      "Treats thematic similarity as logical consequence",
      "Ignores accepted canon",
    ],
    relatedAffectedScopes: ["node", "sibling_nodes", "constellation"],
    relatedOperationTypes: [
      "strengthen_node",
      "weaken_node",
      "modify_node",
      "merge_nodes",
      "remove_node",
    ],
    relatedWarningTypes: ["duplicate_idea", "weak_connection", "contradiction"],
  },
  {
    id: "scope",
    title: "Scope",
    question: "How far should the ripple travel?",
    purpose:
      "Decide whether impact is node-local, constellation-level, cross-constellation, canon-level, flow-level, or structural.",
    goodSignals: [
      "Local decisions stay local unless they change a world rule",
      "Structural changes are rare and justified",
      "Cross-constellation changes require a clear bridge",
    ],
    badSignals: [
      "Every accepted node causes world-level change",
      "No distinction between local and global consequences",
    ],
    relatedAffectedScopes: [
      "node",
      "sibling_nodes",
      "constellation",
      "neighboring_constellations",
      "world",
      "canon",
      "flow",
    ],
    relatedOperationTypes: [
      "refocus_constellation",
      "change_constellation_priority",
      "update_flow",
    ],
    relatedWarningTypes: ["scope_drift"],
  },
  {
    id: "canon_preservation",
    title: "Canon Preservation",
    question: "What must remain stable because the user already accepted it?",
    purpose: "Protect user agency and accepted canon.",
    goodSignals: [
      "Truth canon is preserved unless explicitly revised",
      "Changes are suggested, not silently applied",
      "Contradictions with truth canon produce warnings",
    ],
    badSignals: [
      "Overwrites accepted canon casually",
      "Treats potential ideas as equally fixed as truth",
      "Removes user-approved material without warning",
    ],
    relatedAffectedScopes: ["node", "canon", "world"],
    relatedOperationTypes: [
      "mark_for_critic_review",
      "ask_user_clarification",
    ],
    relatedWarningTypes: ["canon_conflict"],
  },
  {
    id: "contradiction_detection",
    title: "Contradiction Detection",
    question:
      "Which existing nodes become impossible, inconsistent, or require reconciliation?",
    purpose: "Catch logic conflicts early.",
    goodSignals: [
      "Distinguishes contradiction, feasibility issue, tone mismatch, and flow conflict",
      "Proposes reconciliation when possible",
      "Asks user when both options are valuable",
    ],
    badSignals: [
      "Deletes conflicting material without alternatives",
      "Ignores contradiction because both ideas are interesting",
    ],
    relatedAffectedScopes: ["node", "sibling_nodes", "constellation", "canon"],
    relatedOperationTypes: [
      "modify_node",
      "remove_node",
      "ask_user_clarification",
      "mark_for_critic_review",
    ],
    relatedWarningTypes: [
      "contradiction",
      "feasibility_issue",
      "tone_mismatch",
      "flow_conflict",
    ],
  },
  {
    id: "strengthening",
    title: "Strengthening",
    question:
      "Which nodes become more important because the trigger decision supports them?",
    purpose: "Identify ideas that should gain priority.",
    goodSignals: [
      "Explains causal or thematic support",
      "Strengthens specific nodes, not vague categories",
      "Avoids treating all similar nodes as strengthened",
    ],
    badSignals: [
      "Strengthens every nearby node",
      "Confuses aesthetic similarity with logical support",
    ],
    relatedAffectedScopes: ["node", "sibling_nodes", "constellation"],
    relatedOperationTypes: ["strengthen_node", "change_constellation_priority"],
    relatedWarningTypes: ["weak_connection"],
  },
  {
    id: "weakening",
    title: "Weakening",
    question:
      "Which nodes become less relevant, less likely, or lower priority?",
    purpose: "Reduce clutter and incoherence.",
    goodSignals: [
      "Weakens nodes that still might be useful",
      "Does not immediately remove salvageable ideas",
      "Explains why the trigger reduces their relevance",
    ],
    badSignals: [
      "Removes instead of weakening",
      "Weakens nodes only because they are different",
    ],
    relatedAffectedScopes: ["node", "sibling_nodes", "constellation"],
    relatedOperationTypes: ["weaken_node"],
    relatedWarningTypes: [],
  },
  {
    id: "removal_or_replacement",
    title: "Removal or Replacement",
    question: "Which nodes should be removed, replaced, or merged?",
    purpose: "Prevent the canvas from accumulating dead branches.",
    goodSignals: [
      "Removal is reserved for obsolete, duplicate, or impossible nodes",
      "Replacements preserve useful intent when possible",
      "Merges are used for duplicate ideas",
    ],
    badSignals: [
      "Removes nodes aggressively",
      "Replaces too many things after one decision",
      "Deletes interesting tension instead of flagging it",
    ],
    relatedAffectedScopes: ["node", "sibling_nodes", "constellation"],
    relatedOperationTypes: [
      "remove_node",
      "replace_node",
      "merge_nodes",
      "split_node",
    ],
    relatedWarningTypes: ["duplicate_idea"],
  },
  {
    id: "new_possibility",
    title: "New Possibility",
    question: "What new nodes become possible because of this decision?",
    purpose: "Allow the world to grow logically from user choices.",
    goodSignals: [
      "New ideas clearly follow from the trigger",
      "New ideas fill gaps created by ripple",
      "New ideas are suggested as operations, not instantly added",
    ],
    badSignals: [
      "Generates random related ideas",
      "Expands every decision into too many new nodes",
      "Ignores scope and canon boundaries",
    ],
    relatedAffectedScopes: ["node", "constellation", "world"],
    relatedOperationTypes: ["generate_new_node"],
    relatedWarningTypes: ["scope_drift"],
  },
  {
    id: "user_clarification",
    title: "User Clarification",
    question: "When should the system ask the user instead of deciding?",
    purpose: "Preserve user control in ambiguous creative moments.",
    goodSignals: [
      "Asks when two directions are both valuable",
      "Asks when a change would affect accepted canon",
      "Asks when tone or genre direction is uncertain",
    ],
    badSignals: [
      "Asks too often for obvious local effects",
      "Never asks even when user agency is required",
    ],
    relatedAffectedScopes: ["node", "constellation", "world", "canon", "flow"],
    relatedOperationTypes: ["ask_user_clarification"],
    relatedWarningTypes: ["tone_mismatch", "canon_conflict"],
  },
  {
    id: "critic_handoff",
    title: "Critic Handoff",
    question:
      "Which issues should be marked for Canon Critic instead of solved immediately?",
    purpose: "Separate ripple planning from deep contradiction analysis.",
    goodSignals: [
      "Marks complex canon conflicts for critic review",
      "Does not try to solve every contradiction in Ripple",
      "Distinguishes warning from operation",
    ],
    badSignals: [
      "Ripple tries to become Canon Critic",
      "Warnings are vague and unactionable",
    ],
    relatedAffectedScopes: ["canon", "world", "flow"],
    relatedOperationTypes: ["mark_for_critic_review"],
    relatedWarningTypes: ["canon_conflict", "contradiction", "flow_conflict"],
  },
  {
    id: "flow_awareness",
    title: "Flow Awareness",
    question:
      "Does this decision change sequence, setup, payoff, or narrative/world progression?",
    purpose: "Prepare future Narrative Flow Engine.",
    goodSignals: [
      "Flags flow conflicts without building full outline",
      "Identifies setup/payoff shifts",
      "Treats flow as affected scope when needed",
    ],
    badSignals: [
      "Creates full plot structure too early",
      "Ignores sequence-dependent consequences",
    ],
    relatedAffectedScopes: ["flow", "node", "constellation"],
    relatedOperationTypes: ["update_flow"],
    relatedWarningTypes: ["flow_conflict"],
  },
  {
    id: "tone_and_theme",
    title: "Tone and Theme",
    question:
      "Does this decision shift the emotional or thematic direction of the world?",
    purpose: "Catch tone drift and theme strengthening/weakening.",
    goodSignals: [
      "Notices if comedy becomes horror, romance becomes tragedy, etc.",
      "Distinguishes acceptable contrast from tone mismatch",
      "Flags tone shifts as warnings, not automatic rejections",
    ],
    badSignals: [
      "Over-normalizes all tonal contrast",
      "Treats every tonal shift as a problem",
    ],
    relatedAffectedScopes: ["node", "constellation", "world", "canon"],
    relatedOperationTypes: ["modify_node", "refocus_constellation"],
    relatedWarningTypes: ["tone_mismatch"],
  },
] as const;

// ── Impact scoring rules ──────────────────────────────────────────────────────────

export const RIPPLE_IMPACT_SCORING_RULES: readonly RippleImpactScoringRule[] = [
  {
    id: "logical_dependency",
    title: "Logical Dependency",
    scoreQuestion: "How strongly does the target depend on the trigger decision?",
    lowMeaning: "The trigger and target are only loosely related.",
    mediumMeaning:
      "The trigger changes interpretation or priority of the target.",
    highMeaning:
      "The target cannot be understood correctly without the trigger.",
    notes: "High dependency may justify modify or strengthen, not automatic removal.",
  },
  {
    id: "contradiction_strength",
    title: "Contradiction Strength",
    scoreQuestion: "How severe is the conflict between trigger and target?",
    lowMeaning: "Mild tension or tonal mismatch.",
    mediumMeaning: "Requires explanation or modification.",
    highMeaning:
      "Both cannot be true at the same time without reconciliation.",
    notes: "High contradiction may require ask_user_clarification or critic handoff.",
  },
  {
    id: "canon_sensitivity",
    title: "Canon Sensitivity",
    scoreQuestion: "How much accepted canon is touched by this ripple?",
    lowMeaning: "No accepted canon affected.",
    mediumMeaning: "Potential or weakly related canon affected.",
    highMeaning: "Accepted truth canon is affected.",
    notes: "High sensitivity demands preservation markers and explicit approval.",
  },
  {
    id: "scope_radius",
    title: "Scope Radius",
    scoreQuestion: "How far should consequences propagate?",
    lowMeaning: "Only selected node or direct siblings affected.",
    mediumMeaning: "One constellation or neighboring constellation affected.",
    highMeaning: "World rules, canon, or flow affected.",
    notes: "High scope radius should map to major or structural impact levels sparingly.",
  },
  {
    id: "user_agency_risk",
    title: "User Agency Risk",
    scoreQuestion: "How much user approval or clarification is required?",
    lowMeaning: "Safe suggestion.",
    mediumMeaning: "Needs preview before applying.",
    highMeaning: "Requires explicit user approval or clarification.",
    notes: "Maps to requiresUserApproval on suggested operations.",
  },
] as const;

// ── Operation selection rules ─────────────────────────────────────────────────────

export const RIPPLE_OPERATION_SELECTION_RULES: readonly RippleOperationSelectionRule[] =
  [
    {
      when: "Trigger increases relevance but target remains valid.",
      preferOperation: "strengthen_node",
      avoidOperation: "remove_node",
      reasoning: "Support without deleting salvageable material.",
    },
    {
      when: "Target remains possible but lower priority.",
      preferOperation: "weaken_node",
      avoidOperation: "remove_node",
      reasoning: "Reduce prominence before considering deletion.",
    },
    {
      when: "Useful core idea survives but details conflict.",
      preferOperation: "modify_node",
      avoidOperation: "remove_node",
      reasoning: "Preserve intent while reconciling specifics.",
    },
    {
      when: "Target is obsolete, duplicate, or impossible.",
      preferOperation: "remove_node",
      avoidOperation: "generate_new_node",
      reasoning: "Removal is last resort after weaken/modify fail.",
    },
    {
      when: "Trigger creates a clear missing consequence.",
      preferOperation: "generate_new_node",
      avoidOperation: "remove_node",
      reasoning: "Grow from logical gap, not thematic similarity alone.",
    },
    {
      when: "Multiple high-value interpretations exist.",
      preferOperation: "ask_user_clarification",
      avoidOperation: "modify_node",
      reasoning: "Preserve user agency in ambiguous creative forks.",
    },
    {
      when: "Accepted canon may conflict.",
      preferOperation: "mark_for_critic_review",
      avoidOperation: "remove_node",
      reasoning: "Deep canon analysis belongs to Canon Critic.",
    },
    {
      when: "Sequence, setup, or payoff is affected.",
      preferOperation: "update_flow",
      avoidOperation: "generate_new_node",
      reasoning: "Flow changes are structural; do not mask as local node adds.",
    },
    {
      when: "Many nodes in one constellation shift direction.",
      preferOperation: "refocus_constellation",
      avoidOperation: "remove_node",
      reasoning: "Constellation-level refocus beats mass node deletion.",
    },
    {
      when: "Two nodes now represent the same function.",
      preferOperation: "merge_nodes",
      avoidOperation: "generate_new_node",
      reasoning: "Reduce duplication before expanding the canvas.",
    },
  ] as const;

// ── Decision-type behavior ────────────────────────────────────────────────────────

export const RIPPLE_DECISION_BEHAVIOR_RULES: readonly RippleDecisionBehaviorRule[] =
  [
    {
      decision: "truth",
      defaultImpactBias: "moderate",
      shouldPreserveTarget: true,
      shouldGenerateNewPossibilities: true,
      shouldTriggerContradictionCheck: true,
      notes:
        "Strongest ripple effect. Truth may imply new consequences and must be checked against existing canon.",
    },
    {
      decision: "potential",
      defaultImpactBias: "minor",
      shouldPreserveTarget: false,
      shouldGenerateNewPossibilities: true,
      shouldTriggerContradictionCheck: false,
      notes:
        "Light ripple only. Suggest possibilities but avoid removing other nodes.",
    },
    {
      decision: "rejected",
      defaultImpactBias: "minor",
      shouldPreserveTarget: false,
      shouldGenerateNewPossibilities: false,
      shouldTriggerContradictionCheck: true,
      notes:
        "Weaken or remove clearly dependent nodes; refocus constellation if needed. Avoid over-deleting.",
    },
    {
      decision: "removed",
      defaultImpactBias: "minimal",
      shouldPreserveTarget: false,
      shouldGenerateNewPossibilities: false,
      shouldTriggerContradictionCheck: false,
      notes:
        "User may be cleaning canvas, not rejecting concept. Lower semantic certainty than rejected.",
    },
    {
      decision: "modified",
      defaultImpactBias: "moderate",
      shouldPreserveTarget: true,
      shouldGenerateNewPossibilities: true,
      shouldTriggerContradictionCheck: true,
      notes:
        "Preserve revised target if new state is truth. Re-check previous dependencies.",
    },
    {
      decision: "unresolved",
      defaultImpactBias: "minimal",
      shouldPreserveTarget: false,
      shouldGenerateNewPossibilities: false,
      shouldTriggerContradictionCheck: false,
      notes: "No strong ripple until user decides.",
    },
  ] as const;

// ── Quality gates ─────────────────────────────────────────────────────────────────

export const RIPPLE_QUALITY_GATES: readonly RippleQualityGate[] = [
  {
    id: "no_random_expansion",
    description: "Ripple must not generate ideas merely because they are related.",
    failureMode: "Canvas fills with thematic neighbors unrelated to logical consequence.",
    mustPassBefore: "generate_new_node operations are suggested",
  },
  {
    id: "preserve_user_canon",
    description: "Accepted truth must not be silently overwritten.",
    failureMode: "User-established canon changes without approval or warning.",
    mustPassBefore: "any operation targets truth canon nodes",
  },
  {
    id: "explain_every_impact",
    description: "Every impact must have a clear reason.",
    failureMode: "Impacts appear without causal explanation.",
    mustPassBefore: "RippleEffectOutput is returned",
  },
  {
    id: "operations_not_mutations",
    description: "Ripple produces suggested operations, not direct canvas changes.",
    failureMode: "Canvas mutates without preview or approval.",
    mustPassBefore: "operations leave the planning layer",
  },
  {
    id: "scope_justification",
    description: "Major or structural impacts require justification.",
    failureMode: "Local decisions cause unjustified world-level shifts.",
    mustPassBefore: "impactLevel is major or structural",
  },
  {
    id: "critic_boundary",
    description:
      "Ripple flags deep conflicts but does not fully become Canon Critic.",
    failureMode: "Ripple resolves every canon conflict without specialist review.",
    mustPassBefore: "canon_impact suggests state changes on truth canon",
  },
  {
    id: "user_agency",
    description: "High-risk changes require approval or clarification.",
    failureMode: "User loses control over meaningful creative direction.",
    mustPassBefore: "high user_agency_risk operations are emitted",
  },
  {
    id: "diversity_no_overfit",
    description: "Examples and tests must not overfit to one genre.",
    failureMode: "Ripple logic assumes horror, fantasy, or cave tropes.",
    mustPassBefore: "fixtures and prompt examples are authored",
  },
] as const;

// ── Prompt export ─────────────────────────────────────────────────────────────────

function buildCompactRubricText(
  exportData: Omit<RippleReasoningRubricPromptExport, "compactText">,
): string {
  const lines: string[] = [
    "RIPPLE REASONING RUBRIC",
    `Core: ${exportData.corePrinciple}`,
    `Ask: ${exportData.primaryQuestion}`,
    `Avoid: ${exportData.antiPattern}`,
    "",
    "DIMENSIONS:",
    ...exportData.dimensions.map((d) => `- ${d.id}: ${d.question}`),
    "",
    "SCORING:",
    ...exportData.scoringRules.map((r) => `- ${r.id}: ${r.scoreQuestion}`),
    "",
    "OPERATION RULES:",
    ...exportData.operationRules.map(
      (r) =>
        `- prefer ${r.preferOperation}${r.avoidOperation ? `; avoid ${r.avoidOperation}` : ""}: ${r.when}`,
    ),
    "",
    "DECISION BEHAVIOR:",
    ...exportData.decisionBehavior.map(
      (d) =>
        `- ${d.decision}: preserve=${d.shouldPreserveTarget}, contradictionCheck=${d.shouldTriggerContradictionCheck}, bias=${d.defaultImpactBias}`,
    ),
    "",
    "QUALITY GATES:",
    ...exportData.qualityGates.map((g) => `- ${g.id}: ${g.description}`),
  ];
  return lines.join("\n");
}

/** Compact serializable rubric for future Ripple Effect prompt builder. */
export function getRippleReasoningRubricForPrompt(): RippleReasoningRubricPromptExport {
  const corePrinciple =
    "If the user makes something true, the world must react coherently.";
  const primaryQuestion = "If this is now true, what must logically change?";
  const antiPattern = "What cool new things can we add?";

  const base = {
    corePrinciple,
    primaryQuestion,
    antiPattern,
    dimensions: RIPPLE_REASONING_DIMENSIONS.map((d) => ({
      id: d.id,
      title: d.title,
      question: d.question,
      purpose: d.purpose,
    })),
    scoringRules: RIPPLE_IMPACT_SCORING_RULES.map((r) => ({
      id: r.id,
      title: r.title,
      scoreQuestion: r.scoreQuestion,
    })),
    operationRules: RIPPLE_OPERATION_SELECTION_RULES.map((r) => ({
      when: r.when,
      preferOperation: r.preferOperation,
      ...(r.avoidOperation !== undefined ? { avoidOperation: r.avoidOperation } : {}),
    })),
    decisionBehavior: RIPPLE_DECISION_BEHAVIOR_RULES.map((d) => ({
      decision: d.decision,
      defaultImpactBias: d.defaultImpactBias,
      shouldPreserveTarget: d.shouldPreserveTarget,
      shouldTriggerContradictionCheck: d.shouldTriggerContradictionCheck,
    })),
    qualityGates: RIPPLE_QUALITY_GATES.map((g) => ({
      id: g.id,
      description: g.description,
    })),
  };

  return {
    ...base,
    compactText: buildCompactRubricText(base),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────────

function requireNonEmpty(value: string, label: string, errors: string[]): void {
  if (!value?.trim()) {
    errors.push(`${label} is required`);
  }
}

function checkUniqueIds(ids: string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Duplicate ${label} id: ${id}`);
    }
    seen.add(id);
  }
}

/** Validates rubric constants at load/test time; does not throw. */
export function validateRippleReasoningRubric(): RippleReasoningRubricValidationResult {
  const errors: string[] = [];

  checkUniqueIds(
    RIPPLE_REASONING_DIMENSIONS.map((d) => d.id),
    "dimension",
    errors,
  );
  checkUniqueIds(
    RIPPLE_IMPACT_SCORING_RULES.map((r) => r.id),
    "scoring rule",
    errors,
  );
  checkUniqueIds(
    RIPPLE_QUALITY_GATES.map((g) => g.id),
    "quality gate",
    errors,
  );

  for (const dimension of RIPPLE_REASONING_DIMENSIONS) {
    requireNonEmpty(dimension.id, `Dimension ${dimension.title} id`, errors);
    requireNonEmpty(dimension.title, `Dimension ${dimension.id} title`, errors);
    requireNonEmpty(dimension.question, `Dimension ${dimension.id} question`, errors);
    requireNonEmpty(dimension.purpose, `Dimension ${dimension.id} purpose`, errors);
  }

  for (const rule of RIPPLE_OPERATION_SELECTION_RULES) {
    requireNonEmpty(rule.when, "Operation selection when", errors);
    requireNonEmpty(rule.reasoning, "Operation selection reasoning", errors);
    if (!rule.preferOperation) {
      errors.push("Operation selection rule missing preferOperation");
    }
  }

  for (const gate of RIPPLE_QUALITY_GATES) {
    requireNonEmpty(gate.id, "Quality gate id", errors);
    requireNonEmpty(gate.description, `Quality gate ${gate.id} description`, errors);
    requireNonEmpty(gate.failureMode, `Quality gate ${gate.id} failureMode`, errors);
    requireNonEmpty(gate.mustPassBefore, `Quality gate ${gate.id} mustPassBefore`, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

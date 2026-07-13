/**
 * Node Reasoner — GAME-pattern validation helpers (Phase 8B).
 *
 * Produces AgentValidationResult from a raw NodeReasonerOutput.
 * Pure functions only. No API calls, no LLM, no canvas mutation.
 *
 * Replaces the ad-hoc quality-guard post-patch with a typed,
 * structured validation pass that runs before any output is used.
 */

import type { AgentValidationIssue, AgentValidationResult } from "./agentTypes";
import type { NodeReasonerInput, NodeReasonerOutput, PossibleNewNode } from "../nodeReasonerTypes";
import { isShallowNodeDescription } from "../reasoningQualityGuard";

// ─── Tunable thresholds ────────────────────────────────────────────────────────

export const VALIDATION_CONFIG = {
  /** Minimum continuityScore for a node to pass without a warning. */
  minContinuityScore: 5,
  /** continuityScore below this hard-blocks the node (error, not warning). */
  hardContinuityFloor: 3,
  /** Minimum character length for description field. */
  minDescriptionLength: 40,
  /** Minimum character length for continuationAnchor. */
  minAnchorLength: 8,
  /** Minimum character length for whyThisFollows. */
  minWhyLength: 20,
  /** Minimum character length for nodeSummary. */
  minNodeSummaryLength: 60,
  /** Minimum character length for continuationPrinciple. */
  minContinuationPrincipleLength: 30,
  /** Minimum possibleNewNodes count. */
  minNodeCount: 1,
  /** Maximum possibleNewNodes allowed (normalizer already caps at 12, but we re-check). */
  maxNodeCount: 12,
  /**
   * Jaccard overlap threshold — if a node description shares too many tokens
   * with the parent node description it is likely a shallow restatement.
   */
  maxDescriptionParentOverlap: 0.65,
  /**
   * Jaccard overlap threshold for world seed restatement detection.
   */
  maxDescriptionSeedOverlap: 0.6,
} as const;

// ─── Forbidden phrase patterns (static quality rules) ─────────────────────────

/**
 * Phrases that indicate a shallow or category-level description.
 * Matches the user-specified "do not say" list from Phase 8B.
 */
const FORBIDDEN_DESCRIPTION_PATTERNS: RegExp[] = [
  /\bentry point into\b/i,
  /\bexplores the concept\b/i,
  /\ba specific idea about\b/i,
  /\bthis represents\b/i,
  /\bthis develops the premise\b/i,
  /\bwhat makes .+ unique\??/i,
  /\banchor all exploration\b/i,
  /\bexploration zone\b/i,
  /\bconcrete entry point\b/i,
  /\bvivid entry point\b/i,
  /\bgrounded in the (world|premise|seed)\b/i,
  /\bthis (node|branch|idea) (explores|examines|focuses on)\b/i,
  /\bmeaningful discoveries inside\b/i,
  /\ba (concrete|specific) starting point\b/i,
];

/**
 * Patterns that signal a generic category label used as a title.
 * Labels must be specific nouns/noun phrases, not genre descriptors.
 */
const FORBIDDEN_TITLE_PATTERNS: RegExp[] = [
  /^The (Hero|Villain|Conflict|Setting|Mystery|Main Event)$/i,
  /^A (place|character|event|object) in\b/i,
  /^(Dark|Scary|Mysterious) (Place|Person|Moment|Element)$/i,
  /^The (Atmosphere|Vibe|Feeling|Tone|Theme|Concept)$/i,
];

// ─── Token helpers ─────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

// ─── Per-node validators ───────────────────────────────────────────────────────

function containsConcreteThing(text: string): boolean {
  // A description must contain at least one concrete noun, event, rule, or person.
  // Detected by presence of a capitalized word (proper noun), a number, or
  // a construction that refers to a specific thing rather than a category.
  const properNoun = /[A-Z][a-z]{2,}/.test(text);
  const number = /\d/.test(text);
  const specificConstruction = /\b(the|a|an)\s+[a-z]+\s+(that|which|who|when|where)\b/i.test(text);
  const actionConstruction = /\b(is|are|was|were|breaks|forces|reveals|creates|unlocks|hides)\b/i.test(text);
  return properNoun || number || specificConstruction || actionConstruction;
}

export function validateNodeSpecificity(
  node: PossibleNewNode,
  context: { worldSeed: string },
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];
  const { description, displayTitle, title, continuationAnchor, whyThisFollows } = node;

  // 1. Description length
  if (!description || description.trim().length < VALIDATION_CONFIG.minDescriptionLength) {
    issues.push({
      field: `possibleNewNodes[${node.id}].description`,
      message: `Description is too short (${description?.trim().length ?? 0} chars, min ${VALIDATION_CONFIG.minDescriptionLength}). Must be a concrete worldbuilding idea.`,
      severity: "error",
    });
  }

  // 2. Forbidden description phrases
  const descText = description?.trim() ?? "";
  const forbiddenPhrase = FORBIDDEN_DESCRIPTION_PATTERNS.find((p) => p.test(descText));
  if (forbiddenPhrase) {
    issues.push({
      field: `possibleNewNodes[${node.id}].description`,
      message: `Description uses a forbidden shallow phrase (matched: ${String(forbiddenPhrase)}). Write a concrete sentence about a specific event, object, or consequence instead.`,
      severity: "error",
    });
  }

  // 3. Must contain a concrete thing
  if (descText.length >= VALIDATION_CONFIG.minDescriptionLength && !containsConcreteThing(descText)) {
    issues.push({
      field: `possibleNewNodes[${node.id}].description`,
      message: `Description lacks a concrete noun, event, or specific construction. Add a specific person, object, rule, or consequence.`,
      severity: "warning",
    });
  }

  // 4. Seed restatement (Jaccard overlap)
  if (context.worldSeed.trim().length >= 20 && descText.length >= VALIDATION_CONFIG.minDescriptionLength) {
    const seedTokens = tokenize(context.worldSeed);
    const descTokens = tokenize(descText);
    if (
      seedTokens.size >= 4 &&
      descTokens.size >= 4 &&
      jaccardSimilarity(seedTokens, descTokens) >= VALIDATION_CONFIG.maxDescriptionSeedOverlap
    ) {
      issues.push({
        field: `possibleNewNodes[${node.id}].description`,
        message: `Description restates the world seed too closely. Add specific detail that grows from the parent node, not from the world prompt.`,
        severity: "error",
      });
    }
  }

  // 5. Forbidden title patterns
  const titleText = (displayTitle || title || "").trim();
  const forbiddenTitle = FORBIDDEN_TITLE_PATTERNS.find((p) => p.test(titleText));
  if (forbiddenTitle) {
    issues.push({
      field: `possibleNewNodes[${node.id}].displayTitle`,
      message: `Title "${titleText}" is a generic category label (matched: ${String(forbiddenTitle)}). Use a specific noun phrase.`,
      severity: "error",
    });
  }

  // 6. Isomorphic with quality guard
  const isShallow = isShallowNodeDescription(descText, { title: titleText, worldPrompt: context.worldSeed });
  if (isShallow && !forbiddenPhrase) {
    issues.push({
      field: `possibleNewNodes[${node.id}].description`,
      message: `Description was flagged as shallow by the quality guard. Add a specific tension, consequence, or sensory detail.`,
      severity: "warning",
    });
  }

  // 7. continuationAnchor minimum length
  if (!continuationAnchor || continuationAnchor.trim().length < VALIDATION_CONFIG.minAnchorLength) {
    issues.push({
      field: `possibleNewNodes[${node.id}].continuationAnchor`,
      message: `continuationAnchor is missing or too short (min ${VALIDATION_CONFIG.minAnchorLength} chars). Must name the specific part of the parent node being continued.`,
      severity: "error",
    });
  }

  // 8. whyThisFollows minimum length
  if (!whyThisFollows || whyThisFollows.trim().length < VALIDATION_CONFIG.minWhyLength) {
    issues.push({
      field: `possibleNewNodes[${node.id}].whyThisFollows`,
      message: `whyThisFollows is missing or too short (min ${VALIDATION_CONFIG.minWhyLength} chars). Explicitly justify continuity from the parent node.`,
      severity: "error",
    });
  }

  return issues;
}

export function validateNodeContinuity(
  node: PossibleNewNode,
  parentDescription: string,
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];

  // 1. Continuity score hard floor
  if (node.continuityScore < VALIDATION_CONFIG.hardContinuityFloor) {
    issues.push({
      field: `possibleNewNodes[${node.id}].continuityScore`,
      message: `continuityScore ${node.continuityScore} is below the hard floor (${VALIDATION_CONFIG.hardContinuityFloor}). This node is unlikely to follow from the parent.`,
      severity: "error",
    });
  } else if (node.continuityScore < VALIDATION_CONFIG.minContinuityScore) {
    issues.push({
      field: `possibleNewNodes[${node.id}].continuityScore`,
      message: `continuityScore ${node.continuityScore} is low (min recommended: ${VALIDATION_CONFIG.minContinuityScore}). Consider deepening the connection to the parent node.`,
      severity: "warning",
    });
  }

  // 2. High drift risk on recommended node
  if (node.driftRisk === "high") {
    issues.push({
      field: `possibleNewNodes[${node.id}].driftRisk`,
      message: `Node has driftRisk "high". High-drift nodes should not reach the canvas unless continuityScore ≥ 7.`,
      severity: node.continuityScore >= 7 ? "warning" : "error",
    });
  }

  // 3. Description too similar to parent
  const descText = node.description?.trim() ?? "";
  const parentText = parentDescription?.trim() ?? "";
  if (descText.length >= 20 && parentText.length >= 20) {
    const descTokens = tokenize(descText);
    const parentTokens = tokenize(parentText);
    if (
      descTokens.size >= 4 &&
      parentTokens.size >= 4 &&
      jaccardSimilarity(descTokens, parentTokens) >= VALIDATION_CONFIG.maxDescriptionParentOverlap
    ) {
      issues.push({
        field: `possibleNewNodes[${node.id}].description`,
        message: `Description is too similar to the parent node description. It appears to restate rather than continue.`,
        severity: "warning",
      });
    }
  }

  return issues;
}

export function validateNodeNonRepetition(
  node: PossibleNewNode,
  rejectedIds: string[],
  rejectedTitles: string[],
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];

  // 1. ID matches a rejected node
  if (rejectedIds.includes(node.id)) {
    issues.push({
      field: `possibleNewNodes[${node.id}].id`,
      message: `Node id "${node.id}" matches a previously rejected node and must not be regenerated.`,
      severity: "error",
    });
  }

  // 2. Title substantially matches a rejected title
  const nodeTitle = (node.displayTitle || node.title || "").trim().toLowerCase();
  const matchingRejected = rejectedTitles.find((t) => {
    const rt = t.trim().toLowerCase();
    if (!rt || !nodeTitle) return false;
    if (rt === nodeTitle) return true;
    const rtTokens = tokenize(rt);
    const ntTokens = tokenize(nodeTitle);
    if (rtTokens.size >= 2 && ntTokens.size >= 2) {
      return jaccardSimilarity(rtTokens, ntTokens) >= 0.8;
    }
    return false;
  });

  if (matchingRejected) {
    issues.push({
      field: `possibleNewNodes[${node.id}].displayTitle`,
      message: `Node title "${node.displayTitle}" substantially matches previously rejected node "${matchingRejected}". Avoid regenerating rejected ideas.`,
      severity: "error",
    });
  }

  return issues;
}

export function validateNodeCanonCompatibility(
  node: PossibleNewNode,
  acceptedCanonTitles: string[],
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];
  const nodeTitle = (node.displayTitle || node.title || "").trim().toLowerCase();

  const matchingCanon = acceptedCanonTitles.find((t) => {
    const ct = t.trim().toLowerCase();
    if (!ct || !nodeTitle) return false;
    return ct === nodeTitle;
  });

  if (matchingCanon) {
    issues.push({
      field: `possibleNewNodes[${node.id}].displayTitle`,
      message: `Node title "${node.displayTitle}" duplicates accepted canon item "${matchingCanon}". New nodes must not replicate established canon.`,
      severity: "error",
    });
  }

  return issues;
}

// ─── Top-level output validator ────────────────────────────────────────────────

export type NodeReasonerValidationContext = {
  rejectedIds: string[];
  rejectedTitles: string[];
  acceptedCanonTitles: string[];
  worldSeed: string;
  parentNodeDescription: string;
  parentNodeId: string;
};

export function validateNodeReasonerOutput(
  output: NodeReasonerOutput,
  input: NodeReasonerInput,
  ctx: NodeReasonerValidationContext,
): AgentValidationResult {
  const issues: AgentValidationIssue[] = [];

  // ── Output-level checks ──────────────────────────────────────────────────────

  // 1. sourceNodeId must match
  if (output.sourceNodeId !== input.selectedNode.id) {
    issues.push({
      field: "sourceNodeId",
      message: `sourceNodeId "${output.sourceNodeId}" does not match selected node id "${input.selectedNode.id}".`,
      severity: "error",
    });
  }

  // 2. nodeSummary length
  if (!output.nodeSummary || output.nodeSummary.trim().length < VALIDATION_CONFIG.minNodeSummaryLength) {
    issues.push({
      field: "nodeSummary",
      message: `nodeSummary is too short (min ${VALIDATION_CONFIG.minNodeSummaryLength} chars).`,
      severity: "warning",
    });
  }

  // 3. continuationPrinciple length
  if (
    !output.continuationPrinciple ||
    output.continuationPrinciple.trim().length < VALIDATION_CONFIG.minContinuationPrincipleLength
  ) {
    issues.push({
      field: "continuationPrinciple",
      message: `continuationPrinciple is missing or too short (min ${VALIDATION_CONFIG.minContinuationPrincipleLength} chars).`,
      severity: "warning",
    });
  }

  // 4. Node count bounds
  if (output.possibleNewNodes.length < VALIDATION_CONFIG.minNodeCount) {
    issues.push({
      field: "possibleNewNodes",
      message: `possibleNewNodes is empty. At least ${VALIDATION_CONFIG.minNodeCount} node is required.`,
      severity: "error",
    });
  }

  // ── Per-node checks ──────────────────────────────────────────────────────────

  for (const node of output.possibleNewNodes) {
    // parentNodeId binding
    if (node.parentNodeId !== ctx.parentNodeId) {
      issues.push({
        field: `possibleNewNodes[${node.id}].parentNodeId`,
        message: `parentNodeId "${node.parentNodeId}" does not match expected parent "${ctx.parentNodeId}".`,
        severity: "error",
      });
    }

    issues.push(...validateNodeSpecificity(node, { worldSeed: ctx.worldSeed }));
    issues.push(...validateNodeContinuity(node, ctx.parentNodeDescription));
    issues.push(...validateNodeNonRepetition(node, ctx.rejectedIds, ctx.rejectedTitles));
    issues.push(...validateNodeCanonCompatibility(node, ctx.acceptedCanonTitles));
  }

  const errors = issues.filter((i) => i.severity === "error");
  const valid = errors.length === 0;

  const summary = valid
    ? `Validation passed — ${output.possibleNewNodes.length} node(s) checked, no errors.`
    : `Validation failed — ${errors.length} error(s) across ${output.possibleNewNodes.length} node(s): ${errors.map((e) => e.field).join(", ")}.`;

  return { valid, issues, summary };
}

/**
 * Filter out nodes that have hard errors (error-severity issues specific to their id).
 * Nodes with only warnings are kept.
 * Returns the filtered output and a list of removed node ids.
 */
export function filterInvalidNodes(
  output: NodeReasonerOutput,
  validation: AgentValidationResult,
): { filteredOutput: NodeReasonerOutput; removedNodeIds: string[] } {
  const nodesWithErrors = new Set<string>();
  for (const issue of validation.issues) {
    if (issue.severity === "error") {
      const match = /possibleNewNodes\[([^\]]+)\]/.exec(issue.field);
      if (match?.[1]) {
        nodesWithErrors.add(match[1]);
      }
    }
  }

  const removedNodeIds: string[] = [];
  const filtered = output.possibleNewNodes.filter((n) => {
    if (nodesWithErrors.has(n.id)) {
      removedNodeIds.push(n.id);
      return false;
    }
    return true;
  });

  return {
    filteredOutput: { ...output, possibleNewNodes: filtered },
    removedNodeIds,
  };
}

/**
 * Build a retry instruction addendum from a failed validation result.
 * Injected into the prompt for the second attempt.
 */
export function buildRetryInstructions(
  validation: AgentValidationResult,
  avoidPatterns: string[],
): string {
  const errors = validation.issues.filter((i) => i.severity === "error");
  if (errors.length === 0) return "";

  const lines: string[] = [
    "═══ RETRY INSTRUCTIONS (Previous attempt failed validation) ═══",
    "",
    "The previous response was rejected for the following reasons:",
    "",
  ];

  const seen = new Set<string>();
  for (const err of errors) {
    const key = err.message.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- ${err.message}`);
  }

  if (avoidPatterns.length > 0) {
    lines.push("");
    lines.push("Avoid these patterns from the previous attempt:");
    for (const p of avoidPatterns) {
      lines.push(`- ${p}`);
    }
  }

  lines.push("");
  lines.push(
    "Fix every error above. Produce a fresh response — do not reuse node ids or titles from the previous attempt.",
  );

  return lines.join("\n");
}

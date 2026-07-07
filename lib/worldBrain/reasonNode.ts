/**
 * Node Reasoner — Gemini call and response normalization (Phase 3, Step 4).
 */

import { toNodeReasonerNodeType } from "@/lib/worldBrain/buildNodeReasonerInput";
import { buildNodeReasonerPrompt } from "@/lib/worldBrain/nodeReasonerPrompt";
import {
  NODE_REASONER_BRANCH_TYPES,
  NODE_REASONER_CONTINUATION_DISTANCES,
  NODE_REASONER_CONTINUATION_TYPES,
  NODE_REASONER_CONSEQUENCE_REVERSIBILITY,
  NODE_REASONER_CONSEQUENCE_SCOPES,
  NODE_REASONER_CONSEQUENCE_SEVERITIES,
  NODE_REASONER_DRIFT_RISKS,
  NODE_REASONER_RELATIONSHIP_STRENGTHS,
  NODE_REASONER_SCOPE_LEVELS,
} from "@/lib/worldBrain/nodeReasonerPrompt";
import type {
  ContinuationDistance,
  DriftRisk,
  NodeChoice,
  NodeConsequence,
  NodeConsequenceReversibility,
  NodeConsequenceScope,
  NodeConsequenceSeverity,
  NodeExpansionBranch,
  NodeExpansionBranchType,
  NodeExplorationScope,
  NodeExplorationScopeLevel,
  NodeReasonerInput,
  NodeReasonerNodeType,
  NodeReasonerOutput,
  NodeRelationshipStrength,
  NodeRelationshipSuggestion,
  PossibleNewNode,
  PossibleNodeContinuationType,
} from "@/lib/worldBrain/nodeReasonerTypes";
import { parseGeminiJsonContent } from "@/lib/worldBrain/reasonConstellation";
import {
  generateJsonWithLLMFallback,
  hasGeminiApiKey,
  hasOpenRouterApiKey,
  resolveDefaultLLMProvider,
  resolveGeminiModel,
} from "@/lib/llm/llmClient";

const REASONER_MODEL = resolveGeminiModel();

const VALID_DRIFT = new Set<string>(NODE_REASONER_DRIFT_RISKS);
const VALID_DISTANCE = new Set<string>(NODE_REASONER_CONTINUATION_DISTANCES);
const VALID_SCOPE = new Set<string>(NODE_REASONER_SCOPE_LEVELS);
const VALID_BRANCH = new Set<string>(NODE_REASONER_BRANCH_TYPES);
const VALID_CONTINUATION = new Set<string>(NODE_REASONER_CONTINUATION_TYPES);
const VALID_CONSEQUENCE_SCOPE = new Set<string>(NODE_REASONER_CONSEQUENCE_SCOPES);
const VALID_SEVERITY = new Set<string>(NODE_REASONER_CONSEQUENCE_SEVERITIES);
const VALID_REVERSIBILITY = new Set<string>(NODE_REASONER_CONSEQUENCE_REVERSIBILITY);
const VALID_STRENGTH = new Set<string>(NODE_REASONER_RELATIONSHIP_STRENGTHS);

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function strArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function normalizeDrift(v: unknown): DriftRisk {
  const s = str(v, "medium").toLowerCase();
  return VALID_DRIFT.has(s) ? (s as DriftRisk) : "medium";
}

function normalizeDistance(v: unknown): ContinuationDistance {
  const s = str(v, "near").toLowerCase();
  return VALID_DISTANCE.has(s) ? (s as ContinuationDistance) : "near";
}

function normalizeScopeLevel(v: unknown): NodeExplorationScopeLevel {
  const s = str(v, "moderate").toLowerCase();
  return VALID_SCOPE.has(s) ? (s as NodeExplorationScopeLevel) : "moderate";
}

function normalizeBranchType(v: unknown): NodeExpansionBranchType {
  const s = str(v, "deeper_detail").toLowerCase();
  return VALID_BRANCH.has(s) ? (s as NodeExpansionBranchType) : "deeper_detail";
}

function normalizeContinuationType(v: unknown): PossibleNodeContinuationType {
  const s = str(v, "direct_deepening").toLowerCase();
  return VALID_CONTINUATION.has(s)
    ? (s as PossibleNodeContinuationType)
    : "direct_deepening";
}

function normalizeConsequenceScope(v: unknown): NodeConsequenceScope {
  const s = str(v, "node").toLowerCase();
  return VALID_CONSEQUENCE_SCOPE.has(s) ? (s as NodeConsequenceScope) : "node";
}

function normalizeSeverity(v: unknown): NodeConsequenceSeverity {
  const s = str(v, "medium").toLowerCase();
  return VALID_SEVERITY.has(s) ? (s as NodeConsequenceSeverity) : "medium";
}

function normalizeReversibility(v: unknown): NodeConsequenceReversibility {
  const s = str(v, "reversible").toLowerCase();
  return VALID_REVERSIBILITY.has(s)
    ? (s as NodeConsequenceReversibility)
    : "reversible";
}

function normalizeStrength(v: unknown): NodeRelationshipStrength {
  const s = str(v, "moderate").toLowerCase();
  return VALID_STRENGTH.has(s) ? (s as NodeRelationshipStrength) : "moderate";
}

function normalizeExplorationScope(raw: unknown): NodeExplorationScope | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const reason = str(r["reason"] ?? r["scope_reason"]);
  if (!reason) return null;
  return {
    scopeLevel: normalizeScopeLevel(r["scopeLevel"] ?? r["scope_level"]),
    reason,
    recommendedBranchCount: num(
      r["recommendedBranchCount"] ?? r["recommended_branch_count"],
      4,
    ),
  };
}

function normalizeExpansionBranches(raw: unknown): NodeExpansionBranch[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((item, i) => {
    const r = item as Record<string, unknown>;
    const title = str(r["title"], `Branch ${i + 1}`);
    const displayTitle = str(r["displayTitle"] ?? r["display_title"], title);
    return {
      id: str(r["id"], `branch_${i + 1}`),
      title,
      displayTitle,
      branchType: normalizeBranchType(r["branchType"] ?? r["branch_type"]),
      description: str(r["description"]),
      continuationAnchor: str(
        r["continuationAnchor"] ?? r["continuation_anchor"],
      ),
      continuationDistance: normalizeDistance(
        r["continuationDistance"] ?? r["continuation_distance"],
      ),
      whyItContinuesTheNode: str(
        r["whyItContinuesTheNode"] ?? r["why_it_continues_the_node"],
      ),
      creativeFunction: str(r["creativeFunction"] ?? r["creative_function"]),
      depthPotential: str(r["depthPotential"] ?? r["depth_potential"]),
      riskOfDrift: normalizeDrift(r["riskOfDrift"] ?? r["risk_of_drift"]),
      recommended: bool(r["recommended"], i < 3),
    };
  });
}

function normalizePossibleNewNodes(
  raw: unknown,
  parentNodeId: string,
  sourceConstellationId: string,
): PossibleNewNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item, i) => {
    const r = item as Record<string, unknown>;
    const title = str(r["title"], `Continuation ${i + 1}`);
    const displayTitle = str(r["displayTitle"] ?? r["display_title"], title);
    const tags = strArray(r["tags"], 8);
    return {
      id: str(r["id"], `subnode_${i + 1}`),
      title,
      displayTitle,
      nodeType: toNodeReasonerNodeType(
        r["nodeType"] ?? r["node_type"],
      ) as NodeReasonerNodeType,
      description: str(r["description"]),
      parentNodeId: str(r["parentNodeId"] ?? r["parent_node_id"], parentNodeId),
      sourceConstellationId: str(
        r["sourceConstellationId"] ?? r["source_constellation_id"],
        sourceConstellationId,
      ),
      continuationType: normalizeContinuationType(
        r["continuationType"] ?? r["continuation_type"],
      ),
      continuationAnchor: str(
        r["continuationAnchor"] ?? r["continuation_anchor"],
      ),
      continuationDistance: normalizeDistance(
        r["continuationDistance"] ?? r["continuation_distance"],
      ),
      whyThisFollows: str(r["whyThisFollows"] ?? r["why_this_follows"]),
      discoveryQuestion: str(
        r["discoveryQuestion"] ?? r["discovery_question"],
      ),
      expansionPotential: str(
        r["expansionPotential"] ?? r["expansion_potential"],
      ),
      noveltyScore: num(r["noveltyScore"] ?? r["novelty_score"], 5),
      relevanceScore: num(r["relevanceScore"] ?? r["relevance_score"], 5),
      continuityScore: num(r["continuityScore"] ?? r["continuity_score"], 7),
      driftRisk: normalizeDrift(r["driftRisk"] ?? r["drift_risk"]),
      ...(tags.length > 0 ? { tags } : {}),
    };
  });
}

function normalizeChoices(raw: unknown): NodeChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 6).map((item, i) => {
    const r = item as Record<string, unknown>;
    const opens = strArray(r["opensNodeIds"] ?? r["opens_node_ids"], 8);
    const closes = strArray(
      r["closesPossibilityIds"] ?? r["closes_possibility_ids"],
      8,
    );
    return {
      id: str(r["id"], `choice_${i + 1}`),
      choiceText: str(r["choiceText"] ?? r["choice_text"]),
      meaning: str(r["meaning"]),
      canonImpact: str(r["canonImpact"] ?? r["canon_impact"]),
      ...(opens.length > 0 ? { opensNodeIds: opens } : {}),
      ...(closes.length > 0 ? { closesPossibilityIds: closes } : {}),
    };
  });
}

function normalizeConsequences(raw: unknown): NodeConsequence[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((item, i) => {
    const r = item as Record<string, unknown>;
    return {
      id: str(r["id"], `cons_${i + 1}`),
      consequence: str(r["consequence"]),
      affectedScope: normalizeConsequenceScope(
        r["affectedScope"] ?? r["affected_scope"],
      ),
      affectedTargets: strArray(
        r["affectedTargets"] ?? r["affected_targets"],
        8,
      ),
      severity: normalizeSeverity(r["severity"]),
      reversibility: normalizeReversibility(r["reversibility"]),
    };
  });
}

function normalizeRelationships(raw: unknown): NodeRelationshipSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((item, i) => {
    const r = item as Record<string, unknown>;
    return {
      fromNodeId: str(r["fromNodeId"] ?? r["from_node_id"], `node_${i + 1}`),
      toNodeId: str(r["toNodeId"] ?? r["to_node_id"], `node_${i + 2}`),
      relationshipType: str(
        r["relationshipType"] ?? r["relationship_type"],
        "relates",
      ),
      reason: str(r["reason"]),
      strength: normalizeStrength(r["strength"]),
    };
  });
}

export function normalizeNodeReasonerOutput(
  raw: unknown,
  input: NodeReasonerInput,
): NodeReasonerOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const sourceNodeId = str(
    obj["sourceNodeId"] ?? obj["source_node_id"],
    input.selectedNode.id,
  );
  const sourceConstellationId = str(
    obj["sourceConstellationId"] ?? obj["source_constellation_id"],
    input.selectedNode.constellationId,
  );
  const nodeSummary = str(obj["nodeSummary"] ?? obj["node_summary"]);
  const continuationPrinciple = str(
    obj["continuationPrinciple"] ?? obj["continuation_principle"],
  );

  const explorationScope = normalizeExplorationScope(
    obj["explorationScope"] ?? obj["exploration_scope"],
  );
  if (!nodeSummary || !explorationScope) return null;

  const possibleNewNodes = normalizePossibleNewNodes(
    obj["possibleNewNodes"] ?? obj["possible_new_nodes"],
    input.selectedNode.id,
    input.selectedNode.constellationId,
  );
  if (possibleNewNodes.length === 0) return null;

  return {
    sourceNodeId,
    sourceConstellationId,
    nodeSummary,
    continuationPrinciple:
      continuationPrinciple ||
      `Continuations must grow from "${input.selectedNode.displayTitle}".`,
    explorationScope,
    suggestedDepth: num(obj["suggestedDepth"] ?? obj["suggested_depth"], 1),
    expansionBranches: normalizeExpansionBranches(
      obj["expansionBranches"] ?? obj["expansion_branches"],
    ),
    possibleNewNodes,
    possibleChoices: normalizeChoices(
      obj["possibleChoices"] ?? obj["possible_choices"],
    ),
    consequences: normalizeConsequences(obj["consequences"]),
    relationshipSuggestions: normalizeRelationships(
      obj["relationshipSuggestions"] ?? obj["relationship_suggestions"],
    ),
    avoidPatterns: strArray(obj["avoidPatterns"] ?? obj["avoid_patterns"], 8),
  };
}

async function reasonNodeWithLLM(input: NodeReasonerInput): Promise<NodeReasonerOutput> {
  const prompt = buildNodeReasonerPrompt(input);

  const result = await generateJsonWithLLMFallback({
    provider: resolveDefaultLLMProvider(),
    model: REASONER_MODEL,
    prompt,
    temperature: 0.7,
    responseMimeType: "application/json",
  });

  let parsed: unknown;
  try {
    parsed = parseGeminiJsonContent(result.text);
  } catch (e) {
    throw new Error(
      `LLM JSON parse failed (${result.provider}/${result.model}): ${String(e)}`,
    );
  }

  const normalized = normalizeNodeReasonerOutput(parsed, input);
  if (!normalized) {
    throw new Error(
      `Invalid NodeReasonerOutput shape from ${result.provider}/${result.model}`,
    );
  }

  return normalized;
}

/** Calls the configured LLM to reason deeper inside one selected node. */
export async function reasonNodeWorld(
  input: NodeReasonerInput,
): Promise<NodeReasonerOutput> {
  if (!hasGeminiApiKey() && !hasOpenRouterApiKey()) {
    throw new Error("Missing GEMINI_API_KEY or OPENROUTER_API_KEY");
  }

  return reasonNodeWithLLM(input);
}

/** Alias for reasonNodeWorld. */
export const reasonNode = reasonNodeWorld;

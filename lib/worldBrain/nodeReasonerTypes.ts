/**
 * Node Reasoner — Phase 3 type contracts.
 *
 * Global reasoning (World Architect) defines major exploration spaces.
 * Local reasoning (Constellation Reasoner) defines discoveries inside one constellation.
 * Micro reasoning (Node Reasoner) defines deeper possibilities inside one selected node.
 *
 * Core principle: every continuation must grow from the selected node's context —
 * not random topic-adjacent ideas from the wider constellation or world.
 *
 * No runtime logic, prompts, or API calls — contracts only.
 */

import type {
  ExplorationAxis,
  LightweightCanonItem,
  NeighboringConstellation,
  NodeType as ReasonerNodeType,
  TensionLevel,
} from "@/lib/worldBrain/constellationReasonerTypes";

// Re-export for downstream prompt/input builders (same taxonomy as Constellation Reasoner).
export type { ReasonerNodeType as NodeReasonerNodeType };

// ── Shared primitives ───────────────────────────────────────────────────────────

export type DriftRisk = "low" | "medium" | "high";

export type ContinuationDistance = "direct" | "near" | "far";

export type NodeExpansionMode =
  | "deepen"
  | "branch"
  | "vary"
  | "complicate"
  | "reveal_consequence"
  | "reveal_origin"
  | "reveal_connection"
  | "generate_choice";

export type NodeExplorationScopeLevel = "narrow" | "moderate" | "wide";

export type NodeExpansionBranchType =
  | "deeper_detail"
  | "alternate_version"
  | "consequence"
  | "origin"
  | "hidden_truth"
  | "character_impact"
  | "world_rule"
  | "conflict"
  | "sensory_detail"
  | "choice_point"
  | "connection";

export type PossibleNodeContinuationType =
  | "direct_deepening"
  | "variation"
  | "consequence"
  | "origin"
  | "contradiction"
  | "hidden_layer"
  | "relationship"
  | "choice"
  | "obstacle"
  | "clue";

export type NodeConsequenceScope =
  | "node"
  | "constellation"
  | "world"
  | "character"
  | "plot"
  | "tone";

export type NodeConsequenceSeverity = "low" | "medium" | "high";

export type NodeConsequenceReversibility =
  | "reversible"
  | "difficult_to_reverse"
  | "permanent";

export type NodeRelationshipStrength = "weak" | "moderate" | "strong";

export type NodeReasonerSteeringMode =
  | "make_more_specific"
  | "make_more_personal"
  | "make_more_dangerous"
  | "make_more_mysterious"
  | "make_more_emotional"
  | "make_more_grounded"
  | "make_more_surreal"
  | "reduce_scope"
  | "expand_scope"
  | "connect_to_character"
  | "connect_to_world_rule"
  | "connect_to_escape_goal";

// ── Input: constellation + node context ───────────────────────────────────────

/** Local exploration space the selected node belongs to. */
export type NodeReasonerSelectedConstellation = {
  id: string;
  title: string;
  displayTitle: string;
  description: string;
  role?: string;
  /** From Constellation Reasoner output when available. */
  localSummary?: string;
  explorationAxes?: ExplorationAxis[];
};

/**
 * The anchor node for micro reasoning.
 * The Node Reasoner must never ignore this node.
 */
export type SelectedReasoningNode = {
  id: string;
  title: string;
  displayTitle: string;
  nodeType: ReasonerNodeType;
  description: string;
  creativePurpose?: string;
  discoveryQuestion?: string;
  expansionPotential?: string;
  tensionLevel?: TensionLevel;
  noveltyScore?: number;
  relevanceScore?: number;
  tags?: string[];
  constellationId: string;
  parentNodeId?: string;
};

/** Sibling nodes in the same constellation — helps avoid overlap and repetition. */
export type SiblingReasoningNode = {
  id: string;
  title: string;
  displayTitle: string;
  nodeType?: ReasonerNodeType;
  description?: string;
  creativePurpose?: string;
};

/** One step on the path from constellation entry to the selected node. */
export type NodeTrailItem = {
  nodeId: string;
  title: string;
  displayTitle: string;
  nodeType?: ReasonerNodeType;
  description?: string;
};

/**
 * Depth path context for nested exploration:
 * Constellation → Node → Subnode → Sub-subnode
 */
export type NodeDepthContext = {
  depthLevel: number;
  parentTrail: NodeTrailItem[];
  maxDepthHint?: number;
  expansionMode?: NodeExpansionMode;
};

export type NodeReasonerUserSteering = {
  instruction: string;
  mode: NodeReasonerSteeringMode;
};

export type NodeReasonerInput = {
  worldPrompt: string;
  purpose: string;
  architectureSummary: string;
  selectedConstellation: NodeReasonerSelectedConstellation;
  selectedNode: SelectedReasoningNode;
  siblingNodes: SiblingReasoningNode[];
  neighboringConstellations: NeighboringConstellation[];
  existingCanon?: LightweightCanonItem[];
  userSteering?: NodeReasonerUserSteering;
  depthContext?: NodeDepthContext;
};

// ── Output: scoped continuation ─────────────────────────────────────────────────

/** How widely the selected node can support new branches. */
export type NodeExplorationScope = {
  scopeLevel: NodeExplorationScopeLevel;
  reason: string;
  recommendedBranchCount: number;
};

/**
 * A creative direction for continuing the selected node.
 * `whyItContinuesTheNode` must explicitly justify continuity.
 */
export type NodeExpansionBranch = {
  id: string;
  title: string;
  displayTitle: string;
  branchType: NodeExpansionBranchType;
  description: string;
  continuationAnchor: string;
  continuationDistance: ContinuationDistance;
  whyItContinuesTheNode: string;
  creativeFunction: string;
  depthPotential: string;
  riskOfDrift: DriftRisk;
  recommended: boolean;
};

/**
 * A concrete node candidate that may appear on the canvas.
 * `continuityScore` (1–10) measures how strongly this follows the selected node.
 */
export type PossibleNewNode = {
  id: string;
  title: string;
  displayTitle: string;
  nodeType: ReasonerNodeType;
  description: string;
  parentNodeId: string;
  sourceConstellationId: string;
  continuationType: PossibleNodeContinuationType;
  continuationAnchor: string;
  continuationDistance: ContinuationDistance;
  whyThisFollows: string;
  discoveryQuestion: string;
  expansionPotential: string;
  noveltyScore: number;
  relevanceScore: number;
  continuityScore: number;
  driftRisk: DriftRisk;
  tags?: string[];
};

/** A creator-facing decision between creative directions (UI not implemented yet). */
export type NodeChoice = {
  id: string;
  choiceText: string;
  meaning: string;
  canonImpact: string;
  opensNodeIds?: string[];
  closesPossibilityIds?: string[];
};

/** Hypothetical impact if the selected node becomes canon (Canon Memory not implemented yet). */
export type NodeConsequence = {
  id: string;
  consequence: string;
  affectedScope: NodeConsequenceScope;
  affectedTargets: string[];
  severity: NodeConsequenceSeverity;
  reversibility: NodeConsequenceReversibility;
};

/** Suggested link between nodes for future relationship rendering. */
export type NodeRelationshipSuggestion = {
  fromNodeId: string;
  toNodeId: string;
  relationshipType: string;
  reason: string;
  strength: NodeRelationshipStrength;
};

export type NodeReasonerOutput = {
  sourceNodeId: string;
  sourceConstellationId: string;
  /** Local summary of what the selected node is and why it matters. */
  nodeSummary: string;
  /** Principle guiding how continuations should grow from this node. */
  continuationPrinciple: string;
  explorationScope: NodeExplorationScope;
  suggestedDepth: number;
  expansionBranches: NodeExpansionBranch[];
  possibleNewNodes: PossibleNewNode[];
  possibleChoices: NodeChoice[];
  consequences: NodeConsequence[];
  relationshipSuggestions: NodeRelationshipSuggestion[];
  avoidPatterns: string[];
};

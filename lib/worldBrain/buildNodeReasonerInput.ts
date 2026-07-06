/**
 * Node Reasoner — pure input builder (Phase 3, Step 3).
 *
 * Adapts CanvasWorldModel + selected constellation/node + available nodes
 * → NodeReasonerInput.
 * No API calls, no Gemini, no UI, no mutation.
 */

import type { ExplorationAxis } from "@/lib/worldBrain/constellationReasonerTypes";
import type { ReasonedStartingNode } from "@/lib/worldBrain/constellationReasonerTypes";
import type { TensionLevel } from "@/lib/worldBrain/constellationReasonerTypes";
import type { LightweightCanonItem } from "@/lib/worldBrain/constellationReasonerTypes";
import type { NeighboringConstellation } from "@/lib/worldBrain/constellationReasonerTypes";
import { NODE_REASONER_NODE_TYPES } from "@/lib/worldBrain/nodeReasonerPrompt";
import type {
  NodeDepthContext,
  NodeReasonerInput,
  NodeReasonerNodeType,
  NodeReasonerSelectedConstellation,
  NodeReasonerUserSteering,
  SelectedReasoningNode,
  SiblingReasoningNode,
} from "@/lib/worldBrain/nodeReasonerTypes";
import type {
  CanvasConstellation,
  CanvasNode,
  CanvasWorldModel,
} from "@/lib/worldBrain/mapArchitectureToCanvas";

const VALID_NODE_TYPES = new Set<string>(NODE_REASONER_NODE_TYPES);

const DEFAULT_ROLE = "Local exploration space";
const FALLBACK_WORLD_PROMPT = "No world prompt provided.";
const FALLBACK_PURPOSE = "No purpose provided.";
const FALLBACK_ARCHITECTURE_SUMMARY = "No architecture summary provided.";

/** Flat node record for UI-mapped or partial sources. */
export type NodeReasonerAvailableNodeRecord = {
  id: string;
  title?: string;
  displayTitle?: string;
  label?: string;
  description?: string;
  nodeType?: string;
  constellationId?: string;
  parentNodeId?: string;
  creativePurpose?: string;
  discoveryQuestion?: string;
  expansionPotential?: string;
  tensionLevel?: TensionLevel | string;
  noveltyScore?: number;
  relevanceScore?: number;
  tags?: string[];
};

export type NodeReasonerAvailableNode =
  | ReasonedStartingNode
  | CanvasNode
  | NodeReasonerAvailableNodeRecord;

export type BuildNodeReasonerInputParams = {
  canvasModel: CanvasWorldModel;
  selectedConstellationId: string;
  selectedNodeId: string;
  /** Nodes currently visible in the selected constellation (reasoned or architect). */
  availableNodes: NodeReasonerAvailableNode[];
  worldPrompt?: string;
  purpose?: string;
  architectureSummary?: string;
  /** Optional constellation-level summary from Constellation Reasoner output. */
  localSummary?: string;
  explorationAxes?: ExplorationAxis[];
  existingCanon?: LightweightCanonItem[];
  userSteering?: NodeReasonerUserSteering;
  depthContext?: NodeDepthContext;
};

type NormalizedAvailableNode = {
  id: string;
  title: string;
  displayTitle: string;
  description: string;
  nodeType: string;
  constellationId?: string;
  parentNodeId?: string;
  creativePurpose?: string;
  discoveryQuestion?: string;
  expansionPotential?: string;
  tensionLevel?: TensionLevel;
  noveltyScore?: number;
  relevanceScore?: number;
  tags?: string[];
};

function isCanvasNode(node: NodeReasonerAvailableNode): node is CanvasNode {
  return (
    "constellationId" in node &&
    "whyPromising" in node &&
    "explorationQuestions" in node &&
    "aiGenerated" in node
  );
}

function isReasonedStartingNode(
  node: NodeReasonerAvailableNode,
): node is ReasonedStartingNode {
  if (isCanvasNode(node)) return false;
  const n = node as ReasonedStartingNode;
  return (
    typeof n.displayTitle === "string" &&
    typeof n.creativePurpose === "string" &&
    typeof n.discoveryQuestion === "string" &&
    typeof n.expansionPotential === "string" &&
    (n.tensionLevel === "low" ||
      n.tensionLevel === "medium" ||
      n.tensionLevel === "high")
  );
}

function normalizeTension(value: unknown): TensionLevel | undefined {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return undefined;
}

/** Maps loose node type strings to valid NodeReasonerNodeType. */
export function toNodeReasonerNodeType(value: unknown): NodeReasonerNodeType {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (VALID_NODE_TYPES.has(raw)) {
    return raw as NodeReasonerNodeType;
  }

  const aliases: Record<string, NodeReasonerNodeType> = {
    location: "place",
    setting: "place",
    person: "character",
    artifact: "object",
    item: "object",
    group: "faction",
    question: "mystery",
    world_rule: "rule",
    tension: "conflict",
    danger: "threat",
    clue: "opportunity",
    category: "mystery",
    domain: "mystery",
  };

  if (aliases[raw]) return aliases[raw];

  return "mystery";
}

function normalizeAvailableNode(node: NodeReasonerAvailableNode): NormalizedAvailableNode {
  if (isCanvasNode(node)) {
    const title = node.title.trim() || "Untitled Branch";
    return {
      id: node.id,
      title,
      displayTitle: title,
      description: node.description?.trim() ?? "",
      nodeType: node.nodeType,
      constellationId: node.constellationId,
      creativePurpose: node.whyPromising?.trim() || undefined,
      discoveryQuestion: node.explorationQuestions?.[0]?.trim() || undefined,
      expansionPotential: node.risk?.trim() || undefined,
    };
  }

  if (isReasonedStartingNode(node)) {
    return {
      id: node.id,
      title: node.title.trim() || node.displayTitle.trim() || "Untitled Branch",
      displayTitle: node.displayTitle.trim() || node.title.trim() || "Untitled Branch",
      description: node.description?.trim() ?? "",
      nodeType: node.nodeType,
      creativePurpose: node.creativePurpose?.trim() || undefined,
      discoveryQuestion: node.discoveryQuestion?.trim() || undefined,
      expansionPotential: node.expansionPotential?.trim() || undefined,
      tensionLevel: node.tensionLevel,
      noveltyScore: node.noveltyScore,
      relevanceScore: node.relevanceScore,
      tags: node.tags?.length ? [...node.tags] : undefined,
    };
  }

  const record = node as NodeReasonerAvailableNodeRecord;
  const title =
    record.title?.trim() ||
    record.label?.trim() ||
    record.displayTitle?.trim() ||
    "Untitled Branch";
  const displayTitle =
    record.displayTitle?.trim() ||
    record.label?.trim() ||
    record.title?.trim() ||
    title;

  return {
    id: record.id,
    title,
    displayTitle,
    description: record.description?.trim() ?? "",
    nodeType: record.nodeType ?? "mystery",
    constellationId: record.constellationId,
    parentNodeId: record.parentNodeId,
    creativePurpose: record.creativePurpose?.trim() || undefined,
    discoveryQuestion: record.discoveryQuestion?.trim() || undefined,
    expansionPotential: record.expansionPotential?.trim() || undefined,
    tensionLevel: normalizeTension(record.tensionLevel),
    noveltyScore: record.noveltyScore,
    relevanceScore: record.relevanceScore,
    tags: record.tags?.length ? [...record.tags] : undefined,
  };
}

function normalizeConstellationDisplayTitle(constellation: CanvasConstellation): string {
  const display = constellation.displayTitle?.trim();
  if (display) return display;
  return constellation.title.trim() || constellation.id;
}

function resolveConstellationRole(constellation: CanvasConstellation): string {
  const question = constellation.question?.trim();
  if (question) return question;
  const description = constellation.description?.trim();
  if (description) return description;
  return DEFAULT_ROLE;
}

function toNeighboringConstellation(
  constellation: CanvasConstellation,
): NeighboringConstellation {
  const description = constellation.description?.trim();
  return {
    id: constellation.id,
    title: constellation.title,
    displayTitle: normalizeConstellationDisplayTitle(constellation),
    role: resolveConstellationRole(constellation),
    ...(description ? { description } : {}),
  };
}

function toSelectedConstellation(
  constellation: CanvasConstellation,
  params: BuildNodeReasonerInputParams,
): NodeReasonerSelectedConstellation {
  const result: NodeReasonerSelectedConstellation = {
    id: constellation.id,
    title: constellation.title,
    displayTitle: normalizeConstellationDisplayTitle(constellation),
    description: constellation.description?.trim() ?? "",
    role: resolveConstellationRole(constellation),
    explorationAxes: params.explorationAxes?.length
      ? params.explorationAxes.map((a) => ({ ...a }))
      : [],
  };

  const summary = params.localSummary?.trim();
  if (summary) {
    result.localSummary = summary;
  }

  return result;
}

function toSelectedReasoningNode(
  node: NormalizedAvailableNode,
  selectedConstellationId: string,
): SelectedReasoningNode {
  const result: SelectedReasoningNode = {
    id: node.id,
    title: node.title,
    displayTitle: node.displayTitle,
    nodeType: toNodeReasonerNodeType(node.nodeType),
    description: node.description,
    constellationId: node.constellationId ?? selectedConstellationId,
  };

  if (node.creativePurpose) result.creativePurpose = node.creativePurpose;
  if (node.discoveryQuestion) result.discoveryQuestion = node.discoveryQuestion;
  if (node.expansionPotential) result.expansionPotential = node.expansionPotential;
  if (node.tensionLevel) result.tensionLevel = node.tensionLevel;
  if (node.noveltyScore != null) result.noveltyScore = node.noveltyScore;
  if (node.relevanceScore != null) result.relevanceScore = node.relevanceScore;
  if (node.tags?.length) result.tags = [...node.tags];
  if (node.parentNodeId) result.parentNodeId = node.parentNodeId;

  return result;
}

function toSiblingNode(node: NormalizedAvailableNode): SiblingReasoningNode {
  const result: SiblingReasoningNode = {
    id: node.id,
    title: node.title,
    displayTitle: node.displayTitle,
  };

  if (node.nodeType) result.nodeType = toNodeReasonerNodeType(node.nodeType);
  if (node.description) result.description = node.description;
  if (node.creativePurpose) result.creativePurpose = node.creativePurpose;

  return result;
}

function belongsToConstellation(
  node: NormalizedAvailableNode,
  constellationId: string,
): boolean {
  if (!node.constellationId) return true;
  return node.constellationId === constellationId;
}

function resolveWorldPrompt(
  canvasModel: CanvasWorldModel,
  override?: string,
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromModel = canvasModel.worldSeed?.trim();
  if (fromModel) return fromModel;
  return FALLBACK_WORLD_PROMPT;
}

function resolvePurpose(override?: string): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  return FALLBACK_PURPOSE;
}

function resolveArchitectureSummary(
  canvasModel: CanvasWorldModel,
  override?: string,
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromModel = canvasModel.worldSummary?.trim();
  if (fromModel) return fromModel;
  return FALLBACK_ARCHITECTURE_SUMMARY;
}

function resolveDepthContext(
  params: BuildNodeReasonerInputParams,
): NodeDepthContext {
  if (params.depthContext) {
    return {
      depthLevel: params.depthContext.depthLevel,
      parentTrail: params.depthContext.parentTrail.map((t) => ({ ...t })),
      ...(params.depthContext.maxDepthHint != null
        ? { maxDepthHint: params.depthContext.maxDepthHint }
        : {}),
      ...(params.depthContext.expansionMode
        ? { expansionMode: params.depthContext.expansionMode }
        : {}),
    };
  }

  return {
    depthLevel: 1,
    parentTrail: [],
  };
}

/**
 * Builds NodeReasonerInput from canvas model, constellation/node selection, and available nodes.
 */
export function buildNodeReasonerInput(
  params: BuildNodeReasonerInputParams,
): NodeReasonerInput {
  const { canvasModel, selectedConstellationId, selectedNodeId, availableNodes } =
    params;

  const constellation = canvasModel.constellations.find(
    (c) => c.id === selectedConstellationId,
  );
  if (!constellation) {
    throw new Error(`Constellation not found for id: ${selectedConstellationId}`);
  }

  const normalizedNodes = availableNodes.map(normalizeAvailableNode);

  const selectedNormalized = normalizedNodes.find((n) => n.id === selectedNodeId);
  if (!selectedNormalized) {
    throw new Error(`Node not found for id: ${selectedNodeId}`);
  }

  const siblingNodes = normalizedNodes
    .filter(
      (n) =>
        n.id !== selectedNodeId &&
        belongsToConstellation(n, selectedConstellationId),
    )
    .map(toSiblingNode);

  const neighboringConstellations = canvasModel.constellations
    .filter((c) => c.id !== selectedConstellationId)
    .map(toNeighboringConstellation);

  const input: NodeReasonerInput = {
    worldPrompt: resolveWorldPrompt(canvasModel, params.worldPrompt),
    purpose: resolvePurpose(params.purpose),
    architectureSummary: resolveArchitectureSummary(
      canvasModel,
      params.architectureSummary,
    ),
    selectedConstellation: toSelectedConstellation(constellation, params),
    selectedNode: toSelectedReasoningNode(
      selectedNormalized,
      selectedConstellationId,
    ),
    siblingNodes,
    neighboringConstellations,
    existingCanon: params.existingCanon?.length
      ? params.existingCanon.map((c) => ({ ...c }))
      : [],
    depthContext: resolveDepthContext(params),
  };

  if (params.userSteering) {
    input.userSteering = {
      instruction: params.userSteering.instruction,
      mode: params.userSteering.mode,
    };
  }

  return input;
}

/** Converts a bridge CanvasNode into the available-node input shape. */
export function canvasNodeToAvailableNode(node: CanvasNode): CanvasNode {
  return { ...node };
}

/** Converts a Constellation Reasoner starting node into the available-node input shape. */
export function reasonedStartingNodeToAvailableNode(
  node: ReasonedStartingNode,
  constellationId: string,
): NodeReasonerAvailableNodeRecord {
  return {
    id: node.id,
    title: node.title,
    displayTitle: node.displayTitle,
    description: node.description,
    nodeType: node.nodeType,
    constellationId,
    creativePurpose: node.creativePurpose,
    discoveryQuestion: node.discoveryQuestion,
    expansionPotential: node.expansionPotential,
    tensionLevel: node.tensionLevel,
    noveltyScore: node.noveltyScore,
    relevanceScore: node.relevanceScore,
    tags: node.tags,
  };
}

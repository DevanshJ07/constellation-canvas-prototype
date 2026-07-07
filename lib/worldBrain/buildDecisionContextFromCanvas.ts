/**
 * Builds User Decision Event context from live canvas / panel state.
 * Pure functions — no React, no API calls, no persistence.
 */

import type {
  DecisionConstellationSourceRecord,
  DecisionNodeSourceRecord,
} from "@/lib/worldBrain/buildUserDecisionEvent";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import type { NodeReasonerNodePanelMeta } from "@/lib/worldBrain/mapNodeReasonerToCanvas";
import type { ReasonedNodePanelMeta } from "@/lib/worldBrain/mapReasonedNodesToBranches";
import type {
  DecisionSourceLayer,
  DecisionWorldContext,
  DecisionWorldPhase,
} from "@/lib/worldBrain/userDecisionTypes";
import type { NavState, PanelItem } from "@/types/discovery";

export type BuildDecisionContextFromCanvasParams = {
  nodeId: string;
  selectedItem: PanelItem;
  architectureCanvasModel: CanvasWorldModel | null;
  navState: NavState;
  nodeConstellationMap: Record<string, string>;
  reasonedNodeDetails: Record<string, ReasonedNodePanelMeta>;
  nodeReasonerPanelMeta: Record<string, NodeReasonerNodePanelMeta>;
  nodeOverrides: Record<string, { title: string; description: string; whyItMatters: string }>;
  resolveDisplayTitle: (id: string) => string;
  worldSeed: string;
  worldPurpose: string | null;
};

function resolveActiveConstellationId(
  nodeId: string,
  navState: NavState,
  nodeConstellationMap: Record<string, string>,
  architectureCanvasModel: CanvasWorldModel | null,
): string | undefined {
  if (nodeConstellationMap[nodeId]) return nodeConstellationMap[nodeId];
  const archNode = architectureCanvasModel?.nodes.find((n) => n.id === nodeId);
  if (archNode?.constellationId) return archNode.constellationId;
  if (navState.mode === "discovery") return navState.regionId;
  if (navState.mode === "constellation") return navState.regionId;
  return undefined;
}

function resolveSourceLayer(
  nodeId: string,
  selectedItem: PanelItem,
  architectureCanvasModel: CanvasWorldModel | null,
  reasonedNodeDetails: Record<string, ReasonedNodePanelMeta>,
  nodeReasonerPanelMeta: Record<string, NodeReasonerNodePanelMeta>,
): DecisionSourceLayer {
  if (nodeReasonerPanelMeta[nodeId]) return "node_reasoner";
  if (
    selectedItem.kind === "ai-discovery" &&
    selectedItem.discovery.sourceAgent === "Node Reasoner"
  ) {
    return "node_reasoner";
  }
  if (reasonedNodeDetails[nodeId]) return "constellation_reasoner";
  if (architectureCanvasModel?.nodes.some((n) => n.id === nodeId)) {
    return "architect";
  }
  return "unknown";
}

function resolveCurrentPhase(
  nodeId: string,
  navState: NavState,
  nodeReasonerPanelMeta: Record<string, NodeReasonerNodePanelMeta>,
): DecisionWorldPhase {
  const nrMeta = nodeReasonerPanelMeta[nodeId];
  if (nrMeta?.parentNodeId || (nrMeta?.depthLevel ?? 0) > 1) {
    return "node_expansion";
  }
  if (navState.mode === "canon") return "canon_review";
  if (navState.mode === "overview") return "world_overview";
  return "constellation_exploration";
}

/** Resolves a node record suitable for UserDecisionEvent builders. */
export function buildDecisionNodeSourceFromCanvas(
  params: BuildDecisionContextFromCanvasParams,
): DecisionNodeSourceRecord {
  const {
    nodeId,
    selectedItem,
    architectureCanvasModel,
    navState,
    nodeConstellationMap,
    reasonedNodeDetails,
    nodeReasonerPanelMeta,
    nodeOverrides,
    resolveDisplayTitle,
  } = params;

  const overrides = nodeOverrides[nodeId];
  const nrMeta = nodeReasonerPanelMeta[nodeId];
  const reasonedMeta = reasonedNodeDetails[nodeId];
  const archNode = architectureCanvasModel?.nodes.find((n) => n.id === nodeId);
  const constellationId = resolveActiveConstellationId(
    nodeId,
    navState,
    nodeConstellationMap,
    architectureCanvasModel,
  );
  const sourceLayer = resolveSourceLayer(
    nodeId,
    selectedItem,
    architectureCanvasModel,
    reasonedNodeDetails,
    nodeReasonerPanelMeta,
  );

  if (selectedItem.kind === "consequence") {
    const c = selectedItem.consequence;
    return {
      id: nodeId,
      title: overrides?.title ?? c.title,
      displayTitle: overrides?.title ?? c.title,
      description: overrides?.description ?? c.description,
      nodeType: c.category,
      constellationId,
      parentNodeId: c.parentId,
      sourceLayer: "unknown",
    };
  }

  const discovery = selectedItem.discovery;
  const aiNodeType =
    selectedItem.kind === "ai-discovery" ? selectedItem.discovery.nodeType : undefined;
  const displayTitle =
    overrides?.title ??
    nrMeta?.displayTitle ??
    reasonedMeta?.displayTitle ??
    discovery.title ??
    resolveDisplayTitle(nodeId);
  const title =
    overrides?.title ??
    nrMeta?.fullTitle ??
    reasonedMeta?.fullTitle ??
    archNode?.title ??
    discovery.title ??
    displayTitle;
  const description =
    overrides?.description ??
    discovery.description ??
    archNode?.description ??
    reasonedMeta?.creativePurpose ??
    "";

  const record: DecisionNodeSourceRecord = {
    id: nodeId,
    title,
    displayTitle,
    description,
    nodeType:
      aiNodeType ??
      discovery.category ??
      archNode?.nodeType ??
      undefined,
    constellationId,
    sourceLayer,
  };

  if (nrMeta) {
    record.parentNodeId = nrMeta.parentNodeId;
    record.depthLevel = nrMeta.depthLevel;
    record.metadata = {
      continuationType: nrMeta.continuationType,
      continuationDistance: nrMeta.continuationDistance,
      continuityScore: nrMeta.continuityScore,
      driftRisk: nrMeta.driftRisk,
      discoveryQuestion: nrMeta.discoveryQuestion,
      whyThisFollows: nrMeta.whyThisFollows,
    };
  } else if (reasonedMeta) {
    record.metadata = {
      discoveryQuestion: reasonedMeta.discoveryQuestion,
      creativePurpose: reasonedMeta.creativePurpose,
      expansionPotential: reasonedMeta.expansionPotential,
      tensionLevel: reasonedMeta.tensionLevel,
    };
  } else if (archNode) {
    record.metadata = {
      whyPromising: archNode.whyPromising,
      risk: archNode.risk,
    };
  }

  return record;
}

/** Resolves constellation context for the active node, if available. */
export function resolveDecisionConstellationFromCanvas(
  params: BuildDecisionContextFromCanvasParams,
): DecisionConstellationSourceRecord | undefined {
  const constellationId = resolveActiveConstellationId(
    params.nodeId,
    params.navState,
    params.nodeConstellationMap,
    params.architectureCanvasModel,
  );
  if (!constellationId || !params.architectureCanvasModel) return undefined;

  const constellation = params.architectureCanvasModel.constellations.find(
    (c) => c.id === constellationId,
  );
  if (!constellation) return undefined;

  return constellation;
}

/** Builds world context for a canvas decision event. */
export function buildDecisionWorldContextFromCanvas(
  params: BuildDecisionContextFromCanvasParams,
): DecisionWorldContext {
  const activeConstellationId = resolveActiveConstellationId(
    params.nodeId,
    params.navState,
    params.nodeConstellationMap,
    params.architectureCanvasModel,
  );

  return {
    worldPrompt: params.worldSeed,
    purpose: params.worldPurpose ?? undefined,
    architectureSummary: params.architectureCanvasModel?.worldSummary,
    activeConstellationId,
    activeNodeId: params.nodeId,
    currentPhase: resolveCurrentPhase(
      params.nodeId,
      params.navState,
      params.nodeReasonerPanelMeta,
    ),
  };
}

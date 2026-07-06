/**
 * Maps Constellation Reasoner output → existing canvas branch / panel shapes.
 */

import type { AiGeneratedBranch } from "@/lib/agentExplore";
import type { AiDiscovery } from "@/types/discovery";
import type {
  ConstellationReasonerOutput,
  ReasonedStartingNode,
} from "@/lib/worldBrain/constellationReasonerTypes";
import {
  getAgentNameForConstellation,
  type CanvasWorldModel,
} from "@/lib/worldBrain/mapArchitectureToCanvas";

export type ReasonedNodePanelMeta = {
  fullTitle: string;
  displayTitle: string;
  discoveryQuestion: string;
  creativePurpose: string;
  expansionPotential: string;
  tensionLevel: string;
  noveltyScore: number;
  relevanceScore: number;
};

export function mapReasonedStartingNodeToAiBranch(
  node: ReasonedStartingNode,
  parentId: string,
  agentName: string,
): AiGeneratedBranch {
  const displayTitle =
    node.displayTitle.trim() || node.title.trim() || "Untitled Branch";

  return {
    id: node.id,
    title: displayTitle,
    description: node.description,
    whyItMatters: node.creativePurpose || node.discoveryQuestion,
    domain: node.nodeType,
    sourceAgent: agentName,
    rippleHint: node.expansionPotential,
    crossDomainEffects: [],
    continuityRisk:
      node.tensionLevel === "high"
        ? "high"
        : node.tensionLevel === "low"
          ? "low"
          : "medium",
    qualityScore: Math.min(1, (node.relevanceScore + node.noveltyScore) / 20),
    parentId,
    generated: true,
  };
}

export function mapConstellationReasonerOutputToBranches(
  output: ConstellationReasonerOutput,
  model: CanvasWorldModel,
  constellationId: string,
): {
  branches: AiGeneratedBranch[];
  nodeConstellationMap: Record<string, string>;
  panelMeta: Record<string, ReasonedNodePanelMeta>;
} {
  const constellation = model.constellations.find((c) => c.id === constellationId);
  const agentName = constellation
    ? getAgentNameForConstellation(model, constellation)
    : "Reasoning Agent";

  const branches: AiGeneratedBranch[] = [];
  const nodeConstellationMap: Record<string, string> = {};
  const panelMeta: Record<string, ReasonedNodePanelMeta> = {};

  for (const node of output.startingNodes) {
    branches.push(
      mapReasonedStartingNodeToAiBranch(node, constellationId, agentName),
    );
    nodeConstellationMap[node.id] = constellationId;
    panelMeta[node.id] = {
      fullTitle: node.title,
      displayTitle: node.displayTitle,
      discoveryQuestion: node.discoveryQuestion,
      creativePurpose: node.creativePurpose,
      expansionPotential: node.expansionPotential,
      tensionLevel: node.tensionLevel,
      noveltyScore: node.noveltyScore,
      relevanceScore: node.relevanceScore,
    };
  }

  return { branches, nodeConstellationMap, panelMeta };
}

export function reasonedBranchToAiDiscovery(
  branch: AiGeneratedBranch,
  meta?: ReasonedNodePanelMeta,
): AiDiscovery {
  return {
    id: branch.id,
    title: meta?.fullTitle ?? branch.title,
    description: branch.description,
    category: branch.domain,
    whyItMatters: meta?.creativePurpose ?? branch.whyItMatters,
    sourceAgent: branch.sourceAgent,
    rippleHint: meta?.expansionPotential ?? branch.rippleHint,
    generated: true,
    whyPromising: meta?.creativePurpose ?? branch.whyItMatters,
    explorationQuestions: meta?.discoveryQuestion
      ? [meta.discoveryQuestion]
      : undefined,
    nodeType: branch.domain,
  };
}

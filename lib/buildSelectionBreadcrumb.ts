import type { AiGeneratedBranch } from "@/lib/agentExplore";
import type { DynamicConstellation } from "@/lib/dynamicConstellations";
import { simplifyDisplayLabel } from "@/lib/simplifyDisplayLabel";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { PARENT_MAP } from "@/lib/worldData";
import { CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import type { NavState } from "@/types/discovery";

export type SelectionBreadcrumbSegment = {
  id: string;
  label: string;
  kind: "world" | "constellation" | "node";
  isLast: boolean;
};

export type BuildSelectionBreadcrumbInput = {
  navState: NavState;
  selectedNodeId: string | null;
  resolveTitle: (id: string) => string;
  architectureCanvasModel?: CanvasWorldModel | null;
  dynamicConstellations: DynamicConstellation[];
  aiBranches: Record<string, AiGeneratedBranch[]>;
  nodeReasonerBranchesByParentId: Record<string, AiGeneratedBranch[]>;
  nodeConstellationMap: Record<string, string>;
};

function findParentId(
  nodeId: string,
  input: BuildSelectionBreadcrumbInput,
): string | null {
  const consequence = CONSEQUENCE_BY_ID[nodeId];
  if (consequence?.parentId) return consequence.parentId;

  for (const [parentId, branches] of Object.entries(input.nodeReasonerBranchesByParentId)) {
    if (branches.some((b) => b.id === nodeId)) return parentId;
  }

  for (const [parentId, branches] of Object.entries(input.aiBranches)) {
    if (branches.some((b) => b.id === nodeId)) return parentId;
  }

  const archNode = input.architectureCanvasModel?.nodes.find((n) => n.id === nodeId);
  if (archNode) return archNode.constellationId;

  if (input.navState.mode === "discovery") {
    const idx = input.navState.trail.indexOf(nodeId);
    if (idx > 0) return input.navState.trail[idx - 1] ?? null;
  }

  return PARENT_MAP[nodeId] ?? null;
}

function resolveConstellationId(
  input: BuildSelectionBreadcrumbInput,
): string | null {
  const { navState, selectedNodeId, architectureCanvasModel, dynamicConstellations, nodeConstellationMap } =
    input;

  if (navState.mode === "discovery" || navState.mode === "constellation") {
    return navState.regionId;
  }

  if (!selectedNodeId) return null;

  if (architectureCanvasModel?.constellations.some((c) => c.id === selectedNodeId)) {
    return selectedNodeId;
  }
  if (dynamicConstellations.some((c) => c.id === selectedNodeId)) {
    return selectedNodeId;
  }
  if (nodeConstellationMap[selectedNodeId]) {
    return nodeConstellationMap[selectedNodeId];
  }

  const archNode = architectureCanvasModel?.nodes.find((n) => n.id === selectedNodeId);
  if (archNode) return archNode.constellationId;

  return null;
}

function buildNodeChain(
  selectedNodeId: string,
  constellationId: string,
  input: BuildSelectionBreadcrumbInput,
): string[] {
  if (selectedNodeId === constellationId) return [];

  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | null = selectedNodeId;

  while (current && current !== constellationId && !visited.has(current)) {
    visited.add(current);
    chain.unshift(current);
    const parent = findParentId(current, input);
    if (!parent || parent === current) break;
    current = parent;
  }

  return chain;
}

function segmentLabel(id: string, resolveTitle: (id: string) => string): string {
  return simplifyDisplayLabel(resolveTitle(id));
}

export function buildSelectionBreadcrumb(
  input: BuildSelectionBreadcrumbInput,
): SelectionBreadcrumbSegment[] {
  const { navState, selectedNodeId, resolveTitle } = input;

  if (navState.mode === "canon") {
    return [{ id: "canon", label: "Canon Universe", kind: "node", isLast: true }];
  }

  const worldSegment: SelectionBreadcrumbSegment = {
    id: "__world__",
    label: "World",
    kind: "world",
    isLast: false,
  };

  if (navState.mode === "overview") {
    if (!selectedNodeId) {
      return [{ ...worldSegment, isLast: true }];
    }

    const constellationId = resolveConstellationId(input);
    if (constellationId && selectedNodeId === constellationId) {
      return [
        worldSegment,
        {
          id: constellationId,
          label: segmentLabel(constellationId, resolveTitle),
          kind: "constellation",
          isLast: true,
        },
      ];
    }

    if (constellationId) {
      const nodeChain = buildNodeChain(selectedNodeId, constellationId, input);
      const segments: SelectionBreadcrumbSegment[] = [
        worldSegment,
        {
          id: constellationId,
          label: segmentLabel(constellationId, resolveTitle),
          kind: "constellation",
          isLast: nodeChain.length === 0,
        },
      ];
      nodeChain.forEach((id, i) => {
        segments.push({
          id,
          label: segmentLabel(id, resolveTitle),
          kind: "node",
          isLast: i === nodeChain.length - 1,
        });
      });
      return segments;
    }

    return [
      worldSegment,
      {
        id: selectedNodeId,
        label: segmentLabel(selectedNodeId, resolveTitle),
        kind: "node",
        isLast: true,
      },
    ];
  }

  const constellationId = resolveConstellationId(input);
  if (!constellationId) {
    return [{ ...worldSegment, isLast: true }];
  }

  const nodeChain =
    selectedNodeId && selectedNodeId !== constellationId
      ? buildNodeChain(selectedNodeId, constellationId, input)
      : [];

  const segments: SelectionBreadcrumbSegment[] = [
    worldSegment,
    {
      id: constellationId,
      label: segmentLabel(constellationId, resolveTitle),
      kind: "constellation",
      isLast: nodeChain.length === 0,
    },
  ];

  nodeChain.forEach((id, i) => {
    segments.push({
      id,
      label: segmentLabel(id, resolveTitle),
      kind: "node",
      isLast: i === nodeChain.length - 1,
    });
  });

  return segments;
}

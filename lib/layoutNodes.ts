import type { Edge, Node } from "@xyflow/react";
import type { Discovery } from "@/types/discovery";
import type { ConstellationRegionId } from "@/lib/regions";
import {
  CONSTELLATION_REGIONS,
  DISCOVERY_REGION_MAP,
  getRegionById,
  getRegionTheme,
  REGION_THEMES,
} from "@/lib/regions";
import { WORLD_RELATIONSHIPS } from "@/lib/worldLogic";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";

const DISCOVERY_OFFSET = { x: 40, y: 88 };
const DISCOVERY_ROW_HEIGHT = 64;

export function getDiscoveryPositionInRegion(
  regionId: ConstellationRegionId,
  indexInRegion: number,
) {
  const region = getRegionById(regionId);
  return {
    x: region.position.x + DISCOVERY_OFFSET.x,
    y: region.position.y + DISCOVERY_OFFSET.y + indexInRegion * DISCOVERY_ROW_HEIGHT,
  };
}

export function buildConstellationLayout(
  worldSeed: string,
  discoveries: Discovery[],
): { nodes: Node[]; edges: Edge[] } {
  const worldSeedNode: Node = {
    id: "world-seed",
    type: "worldSeed",
    position: { x: -100, y: -20 },
    data: { label: worldSeed },
    draggable: false,
    zIndex: 10,
  };

  const regionNodes: Node[] = CONSTELLATION_REGIONS.map((region) => ({
    id: `region-${region.id}`,
    type: "constellationRegion",
    position: region.position,
    data: {
      regionId: region.id,
      label: region.label,
      width: region.width,
      height: region.height,
    },
    draggable: false,
    selectable: false,
    focusable: false,
    zIndex: 0,
  }));

  const regionDiscoveryCounts: Record<string, number> = {};

  const discoveryNodes: Node[] = discoveries.map((discovery) => {
    const regionId = DISCOVERY_REGION_MAP[discovery.id];
    if (!regionId) {
      throw new Error(`No region assigned for discovery: ${discovery.id}`);
    }

    const indexInRegion = regionDiscoveryCounts[regionId] ?? 0;
    regionDiscoveryCounts[regionId] = indexInRegion + 1;

    return {
      id: discovery.id,
      type: "discovery",
      position: getDiscoveryPositionInRegion(regionId, indexInRegion),
      data: {
        discovery,
        regionId,
        isHidden: false,
      },
      draggable: false,
      zIndex: 5,
    };
  });

  const regionEdges: Edge[] = CONSTELLATION_REGIONS.map((region) => ({
    id: `edge-seed-${region.id}`,
    source: "world-seed",
    target: `region-${region.id}`,
    style: {
      stroke: getRegionTheme(region.id).edge,
      strokeWidth: 1,
    },
  }));

  const discoveryEdges: Edge[] = discoveryNodes.map((node) => {
    const regionId = DISCOVERY_REGION_MAP[node.id];
    return {
      id: `edge-region-${node.id}`,
      source: `region-${regionId}`,
      sourceHandle: "region-source",
      target: node.id,
      style: {
        stroke: getRegionTheme(regionId).edge,
        strokeWidth: 1,
        opacity: 0.45,
      },
    };
  });

  const relationshipEdges: Edge[] = WORLD_RELATIONSHIPS.map((rel) => ({
    id: rel.id,
    source: rel.sourceId,
    target: rel.targetId,
    style: { stroke: "rgba(203, 213, 225, 0.3)", strokeWidth: 1 },
    zIndex: 2,
  }));

  return {
    nodes: [...regionNodes, ...discoveryNodes],
    edges: [...discoveryEdges, ...relationshipEdges],
  };
}

const THEME_KEYS = Object.keys(REGION_THEMES) as ConstellationRegionId[];

/** Spatial overview layout for architecture-generated constellations. */
export function buildArchitectureOverviewLayout(
  model: CanvasWorldModel,
): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...model.constellations].sort((a, b) => a.priority - b.priority);

  const regionNodes: Node[] = sorted.map((constellation, i) => {
    const slot = CONSTELLATION_REGIONS[i % CONSTELLATION_REGIONS.length]!;
    const themeKey = THEME_KEYS[i % THEME_KEYS.length]!;

    return {
      id: `region-${constellation.id}`,
      type: "constellationRegion",
      position: slot.position,
      data: {
        regionId: constellation.id,
        themeKey,
        label: constellation.displayTitle || constellation.title,
        icon: slot.icon,
        width: slot.width,
        height: slot.height,
        description: constellation.description,
        question: constellation.question,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 0,
    };
  });

  return { nodes: regionNodes, edges: [] };
}

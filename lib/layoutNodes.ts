import type { Edge, Node } from "@xyflow/react";
import type { Discovery } from "@/types/discovery";
import type { ConstellationRegionId } from "@/lib/regions";
import {
  DISCOVERY_REGION_MAP,
  getRegionTheme,
  REGION_THEMES,
} from "@/lib/regions";
import { WORLD_RELATIONSHIPS } from "@/lib/worldLogic";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { normalizeCanvasDisplayTitle } from "@/lib/normalizeDisplayTitle";
import {
  computeWorldGalaxyLayout,
  GALAXY_NODE_FOOTPRINT,
  type CanvasDimensions,
} from "@/lib/worldBrain/orbitalLayout";
import { CONSTELLATION_REGIONS } from "@/lib/regions";

const DISCOVERY_OFFSET = { x: 40, y: 88 };
const DISCOVERY_ROW_HEIGHT = 64;

const DEFAULT_OVERVIEW_CANVAS: CanvasDimensions = {
  width: 1280,
  height: 800,
  sidebarWidth: 176,
  panelInset: 0,
};

export function getDiscoveryPositionInRegion(
  regionId: ConstellationRegionId,
  indexInRegion: number,
) {
  const region = CONSTELLATION_REGIONS.find((r) => r.id === regionId);
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  return {
    x: region.position.x + DISCOVERY_OFFSET.x,
    y: region.position.y + DISCOVERY_OFFSET.y + indexInRegion * DISCOVERY_ROW_HEIGHT,
  };
}

export function buildConstellationLayout(
  worldSeed: string,
  discoveries: Discovery[],
  canvas: CanvasDimensions = DEFAULT_OVERVIEW_CANVAS,
): { nodes: Node[]; edges: Edge[] } {
  const regionIds = [...new Set(Object.values(DISCOVERY_REGION_MAP))];
  const galaxyPositions = computeWorldGalaxyLayout(regionIds, canvas);

  const regionNodes: Node[] = regionIds.map((regionId) => {
    const region = CONSTELLATION_REGIONS.find((r) => r.id === regionId)!;
    const pos = galaxyPositions[regionId] ?? { x: 0, y: 0 };
    return {
      id: `region-${regionId}`,
      type: "constellationRegion",
      position: pos,
      data: {
        regionId: region.id,
        label: region.label,
        width: GALAXY_NODE_FOOTPRINT.width,
        height: GALAXY_NODE_FOOTPRINT.height,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 0,
    };
  });

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
  canvas: CanvasDimensions = DEFAULT_OVERVIEW_CANVAS,
): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...model.constellations].sort((a, b) => a.priority - b.priority);
  const ids = sorted.map((c) => c.id);
  const galaxyPositions = computeWorldGalaxyLayout(ids, canvas);

  const regionNodes: Node[] = sorted.map((constellation, i) => {
    const slot = CONSTELLATION_REGIONS[i % CONSTELLATION_REGIONS.length]!;
    const themeKey = THEME_KEYS[i % THEME_KEYS.length]!;
    const position = galaxyPositions[constellation.id] ?? { x: 0, y: 0 };

    return {
      id: `region-${constellation.id}`,
      type: "constellationRegion",
      position,
      data: {
        regionId: constellation.id,
        themeKey,
        label: normalizeCanvasDisplayTitle(
          constellation.displayTitle || constellation.title,
        ),
        icon: slot.icon,
        width: GALAXY_NODE_FOOTPRINT.width,
        height: GALAXY_NODE_FOOTPRINT.height,
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

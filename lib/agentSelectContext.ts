import type { PanelItem } from "@/types/discovery";
import type { AgentSelectInput } from "@/lib/agentSelect";
import type { CanonThreadsData } from "@/lib/canonFlow";
import { PARENT_MAP } from "@/lib/worldData";
import { CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import {
  CONSTELLATION_REGIONS,
  DISCOVERY_REGION_MAP,
  type ConstellationRegionId,
} from "@/lib/regions";
import type { NavState } from "@/types/discovery";

const REGION_IDS = new Set<string>([
  "mythology",
  "rituals",
  "bloodlines",
  "fear",
  "mystery",
]);

function regionLabel(id: string): string {
  return CONSTELLATION_REGIONS.find((r) => r.id === id)?.label ?? id;
}

function regionForNodeId(nodeId: string): string | null {
  const consequence = CONSEQUENCE_BY_ID[nodeId];
  if (consequence?.parentId) {
    return regionForNodeId(consequence.parentId);
  }

  const mapped = DISCOVERY_REGION_MAP[nodeId];
  if (mapped) return mapped;

  let current: string | undefined = nodeId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (REGION_IDS.has(current)) return current;
    current = PARENT_MAP[current];
  }
  return null;
}

export function resolveActiveDomain(
  navState: NavState,
  nodeId: string | null,
): string {
  if (navState.mode === "discovery" || navState.mode === "constellation") {
    return regionLabel(navState.regionId);
  }

  if (nodeId) {
    const regionId = regionForNodeId(nodeId);
    if (regionId) return regionLabel(regionId);
  }

  return "";
}

export function buildAgentSelectInput(params: {
  worldSeed: string;
  item: PanelItem;
  navState: NavState;
  nodeId: string | null;
  creatorDirection: string | null;
  canonThreads: CanonThreadsData;
  worldTensions: string[];
  currentPath: string[];
}): AgentSelectInput {
  const title =
    params.item.kind === "discovery" || params.item.kind === "ai-discovery"
      ? params.item.discovery.title
      : params.item.consequence.title;
  const description =
    params.item.kind === "discovery" || params.item.kind === "ai-discovery"
      ? params.item.discovery.description
      : params.item.consequence.description;

  return {
    worldSeed: params.worldSeed,
    currentNode: { title, description },
    activeDomain: resolveActiveDomain(params.navState, params.nodeId),
    creatorDirection: params.creatorDirection ?? "",
    canonThreads: params.canonThreads,
    worldTensions: params.worldTensions,
    currentPath: params.currentPath,
  };
}

export function regionIdFromNode(nodeId: string): ConstellationRegionId | null {
  return DISCOVERY_REGION_MAP[nodeId] ?? null;
}

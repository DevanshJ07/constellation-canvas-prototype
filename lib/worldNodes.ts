import { MOCK_DISCOVERIES } from "@/lib/mockDiscoveries";
import { TRAIL_NODES } from "@/lib/explorationTrail";
import { CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { WORLD_NODES } from "@/lib/worldData";
import type { PanelItem } from "@/types/discovery";

export type NodeMeta = {
  id: string;
  title: string;
  category: string;
  kind: "discovery" | "consequence";
};

/**
 * Resolve any world node id to display metadata.
 * Priority: WORLD_NODES → MOCK_DISCOVERIES → CONSEQUENCE_BY_ID → TRAIL_NODES
 */
export function resolveNodeMeta(id: string): NodeMeta | null {
  const worldNode = WORLD_NODES[id];
  if (worldNode) {
    return { id, title: worldNode.title, category: "World", kind: "discovery" };
  }
  const discovery = MOCK_DISCOVERIES.find((d) => d.id === id);
  if (discovery) {
    return { id, title: discovery.title, category: discovery.category, kind: "discovery" };
  }
  const consequence = CONSEQUENCE_BY_ID[id];
  if (consequence) {
    return { id, title: consequence.title, category: consequence.category, kind: "consequence" };
  }
  const trailNode = TRAIL_NODES[id];
  if (trailNode) {
    return { id, title: trailNode.title, category: "Discovery", kind: "discovery" };
  }
  return null;
}

export function getNodeTitle(id: string): string {
  return resolveNodeMeta(id)?.title ?? id;
}

/** Build the PanelItem for a given node id. */
export function resolvePanelItem(id: string): PanelItem | null {
  const worldNode = WORLD_NODES[id];
  if (worldNode) {
    return {
      kind: "discovery",
      discovery: {
        id,
        title: worldNode.title,
        description: worldNode.description,
        category: "World",
        whyItMatters: worldNode.whyItMatters ?? worldNode.tagline,
      },
    };
  }
  const discovery = MOCK_DISCOVERIES.find((d) => d.id === id);
  if (discovery) return { kind: "discovery", discovery };
  const consequence = CONSEQUENCE_BY_ID[id];
  if (consequence) return { kind: "consequence", consequence };
  const trailNode = TRAIL_NODES[id];
  if (trailNode) {
    return {
      kind: "discovery",
      discovery: {
        id,
        title: trailNode.title,
        description: trailNode.description,
        category: "Discovery",
        whyItMatters: trailNode.tagline,
      },
    };
  }
  return null;
}

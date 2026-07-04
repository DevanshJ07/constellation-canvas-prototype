import { CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { PARENT_MAP } from "@/lib/worldData";
import { CONSTELLATION_REGIONS } from "@/lib/regions";
import { RIPPLE_MAP } from "@/lib/worldRipple";
import { resolveNodeMeta } from "@/lib/worldNodes";

const REGION_IDS = new Set<string>([
  "mythology",
  "rituals",
  "bloodlines",
  "fear",
  "mystery",
]);

export type CanonThreadNode = { id: string; title: string };

export type CanonThread = {
  id: string;
  nodes: CanonThreadNode[];
};

export type DomainThreads = {
  id: string;
  label: string;
  threads: CanonThread[];
};

export type CanonThreadsData = {
  domains: DomainThreads[];
  orphanThreads: CanonThread[];
};

function titleFor(id: string): string {
  return resolveNodeMeta(id)?.title ?? id;
}

function isRegionRoot(id: string): boolean {
  return REGION_IDS.has(id);
}

function regionForNode(id: string): string | null {
  const consequence = CONSEQUENCE_BY_ID[id];
  if (consequence?.parentId) {
    return regionForNode(consequence.parentId);
  }

  let current: string | undefined = id;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (REGION_IDS.has(current)) return current;
    current = PARENT_MAP[current];
  }
  return null;
}

/** Nearest accepted ancestor via discovery tree (skips region roots). */
function nearestAcceptedAncestor(
  id: string,
  acceptedSet: Set<string>,
): string | null {
  let current: string | undefined = PARENT_MAP[id];
  while (current) {
    if (isRegionRoot(current)) return null;
    if (acceptedSet.has(current)) return current;
    current = PARENT_MAP[current];
  }
  return null;
}

/** Accepted node that unlocked this id, preferring latest before id in canon order. */
function rippleUnlockedFrom(
  id: string,
  acceptedIds: string[],
  acceptedSet: Set<string>,
): string | null {
  const idIndex = acceptedIds.indexOf(id);
  if (idIndex <= 0) return null;

  let best: string | null = null;
  let bestIndex = -1;

  for (const candidate of acceptedIds) {
    if (candidate === id || !acceptedSet.has(candidate)) continue;
    const unlocks = RIPPLE_MAP[candidate]?.unlocks ?? [];
    if (!unlocks.includes(id)) continue;
    const candidateIndex = acceptedIds.indexOf(candidate);
    if (candidateIndex < idIndex && candidateIndex > bestIndex) {
      best = candidate;
      bestIndex = candidateIndex;
    }
  }

  return best;
}

/** Which accepted node does this canon choice extend? */
function getCanonParent(
  id: string,
  acceptedIds: string[],
  acceptedSet: Set<string>,
): string | null {
  const consequence = CONSEQUENCE_BY_ID[id];
  if (consequence?.parentId && acceptedSet.has(consequence.parentId)) {
    return consequence.parentId;
  }

  const ancestor = nearestAcceptedAncestor(id, acceptedSet);
  if (ancestor) return ancestor;

  return rippleUnlockedFrom(id, acceptedIds, acceptedSet);
}

function collectLinearChains(
  root: string,
  childrenOf: Map<string, string[]>,
): CanonThread[] {
  const chains: CanonThread[] = [];

  function walk(node: string, path: string[]) {
    const children = childrenOf.get(node) ?? [];
    if (children.length === 0) {
      chains.push({
        id: path[0],
        nodes: path.map((nid) => ({ id: nid, title: titleFor(nid) })),
      });
      return;
    }
    for (const child of children) {
      walk(child, [...path, child]);
    }
  }

  walk(root, [root]);
  return chains;
}

/**
 * Build the full canon threads structure.
 *
 * @param acceptedIds      Ordered list of accepted node IDs.
 * @param nodeConstellationMap  Maps node IDs → dynamic constellation ID (for AI-generated accepted nodes).
 * @param dynamicDomains   Dynamic constellation id+label pairs from the LLM, used for grouping orphan threads.
 */
export function buildCanonThreads(
  acceptedIds: string[],
  nodeConstellationMap: Record<string, string> = {},
  dynamicDomains: { id: string; label: string }[] = [],
): CanonThreadsData {
  if (acceptedIds.length === 0) {
    return { domains: [], orphanThreads: [] };
  }

  const acceptedSet = new Set(acceptedIds);
  const parentOf = new Map<string, string>();

  for (const id of acceptedIds) {
    const parent = getCanonParent(id, acceptedIds, acceptedSet);
    if (parent) parentOf.set(id, parent);
  }

  const childrenOf = new Map<string, string[]>();
  for (const [child, parent] of parentOf) {
    const list = childrenOf.get(parent) ?? [];
    list.push(child);
    childrenOf.set(parent, list);
  }

  for (const [, kids] of childrenOf) {
    kids.sort((a, b) => acceptedIds.indexOf(a) - acceptedIds.indexOf(b));
  }

  const roots = acceptedIds.filter((id) => !parentOf.has(id));
  const allChains: CanonThread[] = [];

  for (const root of roots) {
    allChains.push(...collectLinearChains(root, childrenOf));
  }

  // Static region map
  const staticDomainMap = new Map<string, CanonThread[]>();
  for (const region of CONSTELLATION_REGIONS) {
    staticDomainMap.set(region.id, []);
  }

  // Dynamic constellation map
  const dynamicDomainMap = new Map<string, CanonThread[]>();
  for (const d of dynamicDomains) {
    dynamicDomainMap.set(d.id, []);
  }

  const orphanThreads: CanonThread[] = [];

  for (const thread of allChains) {
    const rootId = thread.nodes[0]?.id;
    if (!rootId) continue;

    // 1. Static region?
    const staticRegion = regionForNode(rootId);
    if (staticRegion && staticDomainMap.has(staticRegion)) {
      staticDomainMap.get(staticRegion)?.push(thread);
      continue;
    }

    // 2. Dynamic constellation (via nodeConstellationMap)?
    const dynConstellationId = nodeConstellationMap[rootId];
    if (dynConstellationId && dynamicDomainMap.has(dynConstellationId)) {
      dynamicDomainMap.get(dynConstellationId)?.push(thread);
      continue;
    }

    orphanThreads.push(thread);
  }

  const staticDomains: DomainThreads[] = CONSTELLATION_REGIONS.map((r) => ({
    id: r.id,
    label: r.label,
    threads: staticDomainMap.get(r.id) ?? [],
  })).filter((d) => d.threads.length > 0);

  const dynDomains: DomainThreads[] = dynamicDomains.map((d) => ({
    id: d.id,
    label: d.label,
    threads: dynamicDomainMap.get(d.id) ?? [],
  })).filter((d) => d.threads.length > 0);

  return { domains: [...staticDomains, ...dynDomains], orphanThreads };
}

/** @deprecated Use buildCanonThreads — kept for import compatibility. */
export type CanonFlowTruth = CanonThreadNode;

export type CanonFlowData = CanonThreadsData;

export function buildCanonFlowData(acceptedIds: string[]): CanonThreadsData {
  return buildCanonThreads(acceptedIds);
}

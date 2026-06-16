import { ACCEPT_CONSEQUENCES, CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { PARENT_MAP, WORLD_GRAPH, WORLD_NODES } from "@/lib/worldData";

export const CANON_WORLD_SEED_ID = "canon-world-seed";
export const CANON_ROW_H = 88;
export const CANON_COL_W = 200;
export const CANON_BRANCH_GAP = 220;

const REGION_IDS = new Set([
  "mythology",
  "rituals",
  "bloodlines",
  "fear",
  "mystery",
]);

function getParentId(id: string): string | undefined {
  return PARENT_MAP[id] ?? CONSEQUENCE_BY_ID[id]?.parentId;
}

function buildRouteChain(leafId: string, acceptedSet: Set<string>): string[] {
  const chain: string[] = [leafId];
  let current = getParentId(leafId);
  while (current && acceptedSet.has(current)) {
    chain.unshift(current);
    current = getParentId(current);
  }
  return chain;
}

function findLeaves(acceptedSet: Set<string>): string[] {
  return [...acceptedSet].filter((id) => {
    const worldChildren = (WORLD_GRAPH[id] ?? []).filter((c) =>
      acceptedSet.has(c),
    );
    const consChildren = (ACCEPT_CONSEQUENCES[id] ?? [])
      .map((c) => c.id)
      .filter((cid) => acceptedSet.has(cid));
    return worldChildren.length === 0 && consChildren.length === 0;
  });
}

function dedupeRoutes(chains: string[][]): string[][] {
  return chains.filter(
    (chain, i) =>
      !chains.some(
        (other, j) =>
          j !== i &&
          other.length > chain.length &&
          chain.every((id, k) => other[k] === id),
      ),
  );
}

/** Expand a world route with accepted consequences nested after their parent. */
function expandChainWithConsequences(
  chain: string[],
  acceptedSet: Set<string>,
): string[] {
  const result: string[] = [];
  for (const id of chain) {
    result.push(id);
    for (const c of ACCEPT_CONSEQUENCES[id] ?? []) {
      if (acceptedSet.has(c.id)) result.push(c.id);
    }
  }
  return result;
}

export type CanonRoute = {
  columnIndex: number;
  nodeIds: string[];
  positions: Record<string, { x: number; y: number }>;
};

export type CanonTimeline = {
  routes: CanonRoute[];
  seedPosition: { x: number; y: number };
};

/** Build vertical glowing timeline for Canon Universe mode. */
export function buildCanonTimeline(
  acceptedIds: string[],
  _worldSeedLabel: string,
): CanonTimeline | null {
  const acceptedSet = new Set(acceptedIds);
  if (acceptedSet.size === 0) return null;

  const leaves = findLeaves(acceptedSet);
  const rawChains = leaves.map((leaf) => buildRouteChain(leaf, acceptedSet));

  function prependRegionRoot(chain: string[]): string[] {
    const root = chain[0];
    const parent = PARENT_MAP[root];
    if (parent && REGION_IDS.has(parent) && !chain.includes(parent)) {
      return [parent, ...chain];
    }
    return chain;
  }

  const chains = dedupeRoutes(rawChains)
    .map((chain) => expandChainWithConsequences(chain, acceptedSet))
    .map(prependRegionRoot);

  const colCount = chains.length;
  const centerOffset = ((colCount - 1) * CANON_BRANCH_GAP) / 2;

  const routes = chains.map((chain, columnIndex) => {
    const positions: Record<string, { x: number; y: number }> = {};
    const colX = columnIndex * CANON_BRANCH_GAP - centerOffset;

    chain.forEach((id, i) => {
      positions[id] = {
        x: colX,
        y: (i + 1) * CANON_ROW_H,
      };
    });

    return { columnIndex, nodeIds: chain, positions };
  });

  return { routes, seedPosition: { x: 0, y: 0 } };
}

/** @deprecated use buildCanonTimeline */
export function buildCanonRoutes(
  acceptedIds: string[],
  worldSeedLabel: string,
): CanonRoute[] {
  const timeline = buildCanonTimeline(acceptedIds, worldSeedLabel);
  if (!timeline) return [];
  return timeline.routes.map((r) => ({
    ...r,
    nodeIds: [CANON_WORLD_SEED_ID, ...r.nodeIds],
    positions: {
      [CANON_WORLD_SEED_ID]: timeline.seedPosition,
      ...r.positions,
    },
  }));
}

export function getCanonNodeTitle(id: string, worldSeedLabel: string): string {
  if (id === CANON_WORLD_SEED_ID) return worldSeedLabel;
  return WORLD_NODES[id]?.title ?? CONSEQUENCE_BY_ID[id]?.title ?? id;
}

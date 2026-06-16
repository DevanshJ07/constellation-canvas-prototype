import { ACCEPT_CONSEQUENCES, CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { PARENT_MAP, WORLD_NODES } from "@/lib/worldData";
import { CONSTELLATION_REGIONS, type ConstellationRegionId } from "@/lib/regions";
import { RIPPLE_MAP } from "@/lib/worldRipple";
import { resolveNodeMeta } from "@/lib/worldNodes";

const REGION_IDS = new Set<string>([
  "mythology",
  "rituals",
  "bloodlines",
  "fear",
  "mystery",
]);

export type CanonTruth = { id: string; title: string };

export type DomainGroup = {
  id: ConstellationRegionId;
  label: string;
  truths: CanonTruth[];
};

export type RippleConsequence = {
  id: string;
  title: string;
  causedBy: string;
};

export type CanonStructure = {
  corePremise: string;
  domains: DomainGroup[];
  unresolvedThreads: CanonTruth[];
  activeTensions: string[];
  rippleConsequences: RippleConsequence[];
  potentialFutures: string[];
  isFragmented: boolean;
};

function regionForNode(id: string): ConstellationRegionId | null {
  let current: string | undefined = id;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (REGION_IDS.has(current)) return current as ConstellationRegionId;
    current = PARENT_MAP[current];
  }
  return null;
}

function isConsequenceId(id: string): boolean {
  return Boolean(CONSEQUENCE_BY_ID[id]);
}

function isConnectedTruth(id: string, acceptedSet: Set<string>): boolean {
  if (isConsequenceId(id)) {
    const parent = CONSEQUENCE_BY_ID[id]?.parentId;
    return parent ? acceptedSet.has(parent) : false;
  }

  const relations = RIPPLE_MAP[id] ?? {};
  const outward = [
    ...(relations.supports ?? []),
    ...(relations.contradicts ?? []),
    ...(relations.unlocks ?? []),
  ];
  if (outward.some((other) => acceptedSet.has(other) && other !== id)) return true;

  for (const other of acceptedSet) {
    if (other === id) continue;
    const r = RIPPLE_MAP[other] ?? {};
    const linked = [
      ...(r.supports ?? []),
      ...(r.contradicts ?? []),
      ...(r.unlocks ?? []),
    ];
    if (linked.includes(id)) return true;
  }

  return false;
}

function titleFor(id: string): string {
  return resolveNodeMeta(id)?.title ?? id;
}

export function buildCanonStructure(
  acceptedIds: string[],
  worldSeed: string,
  worldTensions: string[],
  potentialFutures: string[],
  coherenceScore: number,
): CanonStructure {
  const acceptedSet = new Set(acceptedIds);

  const domainMap = new Map<ConstellationRegionId, CanonTruth[]>();
  for (const region of CONSTELLATION_REGIONS) {
    domainMap.set(region.id, []);
  }

  const unresolvedThreads: CanonTruth[] = [];
  const rippleConsequences: RippleConsequence[] = [];

  for (const id of acceptedIds) {
    if (isConsequenceId(id)) {
      const parentId = CONSEQUENCE_BY_ID[id]?.parentId ?? "";
      rippleConsequences.push({
        id,
        title: titleFor(id),
        causedBy: titleFor(parentId),
      });
      continue;
    }

    if (!WORLD_NODES[id]) continue;

    if (!isConnectedTruth(id, acceptedSet) && acceptedIds.length > 1) {
      unresolvedThreads.push({ id, title: titleFor(id) });
      continue;
    }

    const region = regionForNode(id);
    if (region) {
      domainMap.get(region)?.push({ id, title: titleFor(id) });
    } else {
      unresolvedThreads.push({ id, title: titleFor(id) });
    }
  }

  const domains: DomainGroup[] = CONSTELLATION_REGIONS.map((r) => ({
    id: r.id,
    label: r.label,
    truths: domainMap.get(r.id) ?? [],
  })).filter((d) => d.truths.length > 0);

  // Also list ripple-unlocked (not yet accepted) consequences from canon parents
  for (const parentId of acceptedIds) {
    for (const c of ACCEPT_CONSEQUENCES[parentId] ?? []) {
      if (acceptedSet.has(c.id)) continue;
      rippleConsequences.push({
        id: c.id,
        title: c.title,
        causedBy: titleFor(parentId),
      });
    }
  }

  const seenConsequence = new Set<string>();
  const dedupedConsequences = rippleConsequences.filter((c) => {
    if (seenConsequence.has(c.id)) return false;
    seenConsequence.add(c.id);
    return true;
  });

  const isFragmented =
    unresolvedThreads.length > 0 ||
    coherenceScore < 45 ||
    (acceptedIds.length >= 3 && domains.length >= 3 && unresolvedThreads.length > 0);

  return {
    corePremise: worldSeed,
    domains,
    unresolvedThreads,
    activeTensions: worldTensions,
    rippleConsequences: dedupedConsequences,
    potentialFutures,
    isFragmented,
  };
}

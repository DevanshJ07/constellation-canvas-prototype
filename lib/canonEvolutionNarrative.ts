import { CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { PARENT_MAP, WORLD_NODES } from "@/lib/worldData";
import { resolveNodeMeta } from "@/lib/worldNodes";
import type { EvolutionFeedEntry } from "@/lib/worldEvolution";
import { CROSS_DOMAIN_MAP } from "@/lib/worldEvolution";
import { computeWorldState, describeStateShifts } from "@/lib/worldState";
import { RIPPLE_MAP } from "@/lib/worldRipple";

export type WorldEvolutionNarrative = {
  nodeId: string;
  title: string;
  ts: number;
  stateShifts: string[];
  unlocked: string[];
  crossDomain: string[];
  evolutions: string[];
  supported: string[];
};

export type CauseChainStep = {
  label: string;
  kind:
    | "origin"
    | "truth"
    | "state"
    | "unlock"
    | "consequence"
    | "cross_domain";
  nodeId?: string;
};

function titleFor(id: string): string {
  return resolveNodeMeta(id)?.title ?? id;
}

/** Group raw feed entries into narrative canon events. */
export function groupEvolutionNarratives(
  feed: EvolutionFeedEntry[],
): WorldEvolutionNarrative[] {
  const sorted = [...feed].sort((a, b) => a.ts - b.ts);
  const narratives: WorldEvolutionNarrative[] = [];
  let current: WorldEvolutionNarrative | null = null;

  for (const entry of sorted) {
    if (entry.kind === "canon") {
      if (current) narratives.push(current);
      current = {
        nodeId: entry.nodeId,
        title: entry.title,
        ts: entry.ts,
        stateShifts: [],
        unlocked: [],
        crossDomain: [],
        evolutions: [],
        supported: [],
      };
      continue;
    }

    if (!current) continue;

    switch (entry.kind) {
      case "state_shift":
        current.stateShifts.push(...entry.descriptions);
        break;
      case "cross_domain":
        current.crossDomain.push(entry.title);
        break;
      case "evolution":
        current.evolutions.push(entry.title);
        break;
      case "unlock":
        current.unlocked.push(entry.title);
        break;
      case "supported":
        current.supported.push(entry.title);
        break;
      default:
        break;
    }
  }

  if (current) narratives.push(current);

  return narratives.map((n) => ({
    ...n,
    stateShifts: [...new Set(n.stateShifts)],
    unlocked: [...new Set(n.unlocked)],
    crossDomain: [...new Set(n.crossDomain)],
    evolutions: [...new Set(n.evolutions)],
    supported: [...new Set(n.supported)],
  }));
}

/** Full evolution timeline — merges live feed with retrospective entries. */
export function buildCanonEvolutionTimeline(
  acceptedIds: string[],
  feed: EvolutionFeedEntry[],
): WorldEvolutionNarrative[] {
  const fromFeed = groupEvolutionNarratives(feed);
  const feedByNode = new Map(fromFeed.map((n) => [n.nodeId, n]));
  const timeline: WorldEvolutionNarrative[] = [];
  let prevAccepted: string[] = [];

  for (const id of acceptedIds) {
    const existing = feedByNode.get(id);
    if (existing) {
      timeline.push(existing);
      prevAccepted = [...prevAccepted, id];
      continue;
    }

    const nextAccepted = [...prevAccepted, id];
    const prevState = computeWorldState(prevAccepted);
    const nextState = computeWorldState(nextAccepted);
    const shifts = describeStateShifts(id, prevState, nextState);
    const crossDomain = (CROSS_DOMAIN_MAP[id] ?? []).map((c) => c.title);
    const unlocked = (RIPPLE_MAP[id]?.unlocks ?? [])
      .map((uid) => titleFor(uid))
      .slice(0, 5);

    timeline.push({
      nodeId: id,
      title: titleFor(id),
      ts: timeline.length,
      stateShifts: shifts,
      unlocked,
      crossDomain,
      evolutions: [],
      supported: [],
    });
    prevAccepted = nextAccepted;
  }

  return timeline;
}

/** Vertical cause-and-effect chains per established truth. */
export function buildCauseChains(
  acceptedIds: string[],
  narratives: WorldEvolutionNarrative[],
  worldSeed: string,
): CauseChainStep[][] {
  const acceptedSet = new Set(acceptedIds);
  const narrativeByNode = new Map(narratives.map((n) => [n.nodeId, n]));
  const chains: CauseChainStep[][] = [];

  for (const id of acceptedIds) {
    const narrative = narrativeByNode.get(id);
    const chain: CauseChainStep[] = [];

    if (CONSEQUENCE_BY_ID[id]) {
      const parentId = CONSEQUENCE_BY_ID[id]?.parentId;
      if (parentId && acceptedSet.has(parentId)) {
        chain.push({
          label: titleFor(parentId),
          kind: "truth",
          nodeId: parentId,
        });
      }
      chain.push({
        label: titleFor(id),
        kind: "consequence",
        nodeId: id,
      });
    } else if (WORLD_NODES[id]) {
      const lineage: string[] = [];
      let current: string | undefined = id;
      while (current) {
        const parent: string | undefined = PARENT_MAP[current];
        if (parent && acceptedSet.has(parent) && WORLD_NODES[parent]) {
          lineage.unshift(parent);
          current = parent;
        } else break;
      }

      if (lineage.length === 0 && acceptedIds.indexOf(id) === 0) {
        chain.push({ label: worldSeed, kind: "origin" });
      }

      for (const pid of lineage) {
        chain.push({ label: titleFor(pid), kind: "truth", nodeId: pid });
      }
      chain.push({ label: titleFor(id), kind: "truth", nodeId: id });
    } else {
      continue;
    }

    if (narrative) {
      for (const shift of narrative.stateShifts) {
        chain.push({ label: shift, kind: "state" });
      }
      for (const unlock of narrative.unlocked) {
        chain.push({ label: unlock, kind: "unlock" });
      }
      for (const effect of narrative.crossDomain) {
        chain.push({ label: effect, kind: "cross_domain" });
      }
    }

    if (chain.length > 1) chains.push(chain);
  }

  return chains;
}

/**
 * World Evolution — cross-domain effects, evolution events, feed.
 */

import { resolveNodeMeta } from "@/lib/worldNodes";
import { computeRipple, type RippleResult } from "@/lib/worldRipple";
import {
  computeWorldState,
  describeStateShifts,
  describeTensions,
  type WorldDimension,
  type WorldState,
} from "@/lib/worldState";

// ── Cross-domain effects ──────────────────────────────────────────────────────

export type CrossDomainEffect = {
  id: string;
  title: string;
  targetRegion: string;
};

export const CROSS_DOMAIN_MAP: Record<string, CrossDomainEffect[]> = {
  "forgotten-temple": [
    { id: "cd-whispers-prayer", title: "Whispers During Prayer", targetRegion: "fear" },
    { id: "cd-secret-pilgrimages", title: "Secret Pilgrimages", targetRegion: "rituals" },
  ],
  "village-oracle": [
    { id: "cd-prophetic-dreams", title: "Prophetic Dreams", targetRegion: "mystery" },
    { id: "cd-oracle-vigils", title: "Oracle Vigils", targetRegion: "rituals" },
  ],
  "cursed-lineage": [
    { id: "cd-hollow-sons", title: "The Hollow Sons", targetRegion: "fear" },
    { id: "cd-missing-records", title: "Family Records Missing", targetRegion: "mystery" },
  ],
  "ruined-rain-temple": [
    { id: "cd-endless-rain", title: "Endless Rain", targetRegion: "fear" },
    { id: "cd-flooded-shrines", title: "Flooded Shrines", targetRegion: "mythology" },
  ],
  "the-trees-watch": [
    { id: "cd-forest-patrols", title: "Forest Patrols", targetRegion: "rituals" },
    { id: "cd-watcher-symbols", title: "Watcher Symbols", targetRegion: "bloodlines" },
  ],
  "forbidden-practices": [
    { id: "cd-underground-rites", title: "Underground Rites", targetRegion: "rituals" },
    { id: "cd-village-suspicion", title: "Village Suspicion", targetRegion: "fear" },
  ],
  "memory-erasure-ritual": [
    { id: "cd-lost-identities", title: "Lost Identities", targetRegion: "mystery" },
    { id: "cd-memory-gaps", title: "Collective Memory Gaps", targetRegion: "bloodlines" },
  ],
  "the-marked": [
    { id: "cd-strange-children", title: "Strange Children", targetRegion: "fear" },
    { id: "cd-marked-records", title: "Marked Birth Records", targetRegion: "mystery" },
  ],
  "forest-fears": [
    { id: "cd-forest-barriers", title: "Forest Barriers", targetRegion: "rituals" },
    { id: "cd-lost-travelers", title: "Lost Travelers", targetRegion: "mystery" },
  ],
  "abandoned-places": [
    { id: "cd-sealed-doors", title: "Sealed Doors", targetRegion: "fear" },
    { id: "cd-forgotten-names", title: "Forgotten Place Names", targetRegion: "mythology" },
  ],
  "forgotten-banyan-goddess": [
    { id: "cd-goddess-whispers", title: "Goddess Whispers", targetRegion: "mythology" },
    { id: "cd-root-offerings", title: "Root Offerings", targetRegion: "rituals" },
  ],
  "memory-tax": [
    { id: "cd-memory-unrest", title: "Memory Unrest", targetRegion: "fear" },
    { id: "cd-pilgrim-routes", title: "Hidden Pilgrim Routes", targetRegion: "mystery" },
  ],
  "the-missing-days": [
    { id: "cd-blank-calendars", title: "Blank Calendars", targetRegion: "mystery" },
    { id: "cd-collective-dread", title: "Collective Dread", targetRegion: "fear" },
  ],
};

// ── Evolution events (threshold-triggered) ───────────────────────────────────

export type EvolutionEventDef = {
  id: string;
  title: string;
  description: string;
  dimension: WorldDimension;
  threshold: number;
  unlockTitles: string[];
};

export const EVOLUTION_EVENTS: EvolutionEventDef[] = [
  {
    id: "faith-resurgence",
    title: "Forgotten Faith Resurgence",
    description:
      "Faith in the world has grown strong enough to reshape society. Temples stir. Pilgrims return.",
    dimension: "faith",
    threshold: 8,
    unlockTitles: ["Temple Economy", "Pilgrim Routes", "Sacred Tax"],
  },
  {
    id: "collective-paranoia",
    title: "Collective Paranoia",
    description:
      "Fear in the world has become strong enough to reshape society. Doors lock. Eyes watch.",
    dimension: "fear",
    threshold: 8,
    unlockTitles: ["Night Curfew", "Watcher Symbols", "Missing Children"],
  },
  {
    id: "memory-market",
    title: "Memory Market",
    description:
      "Memory has accumulated beyond what minds can hold. A trade begins in what was once private.",
    dimension: "memory",
    threshold: 8,
    unlockTitles: ["Memory Merchants", "Borrowed Lives", "Stolen Childhoods"],
  },
  {
    id: "iron-council",
    title: "The Iron Council",
    description:
      "Authority has consolidated. Someone now decides which truths may be spoken aloud.",
    dimension: "authority",
    threshold: 7,
    unlockTitles: ["Truth Registry", "Forbidden Speech", "Council Enforcers"],
  },
  {
    id: "bloodline-convergence",
    title: "Bloodline Convergence",
    description:
      "Ancient bloodlines are awakening across the world. Families recognize each other without being told.",
    dimension: "bloodlineInfluence",
    threshold: 7,
    unlockTitles: ["Lineage Pacts", "Inherited Curses", "Blood Oaths"],
  },
  {
    id: "slow-collapse",
    title: "The Slow Collapse",
    description:
      "Decay has spread through enough truths that the world itself feels like it is forgetting its shape.",
    dimension: "decay",
    threshold: 7,
    unlockTitles: ["Crumbing Shrines", "Fading Names", "Erased Borders"],
  },
  {
    id: "veil-thinning",
    title: "The Veil Thinning",
    description:
      "Mysticism has deepened until the boundary between seen and unseen grows porous.",
    dimension: "mysticism",
    threshold: 8,
    unlockTitles: ["Spirit Crossings", "Dream Bleed", "Oracle Storms"],
  },
];

// ── Feed entries ──────────────────────────────────────────────────────────────

export type EvolutionFeedEntry =
  | { kind: "canon"; nodeId: string; title: string; ts: number }
  | { kind: "state_shift"; descriptions: string[]; sourceTitle: string; ts: number }
  | { kind: "cross_domain"; title: string; region: string; ts: number }
  | { kind: "evolution"; eventId: string; title: string; ts: number }
  | { kind: "unlock"; title: string; ts: number }
  | { kind: "supported"; title: string; ts: number };

// ── Extended ripple result ────────────────────────────────────────────────────

export type ExtendedRippleResult = RippleResult & {
  worldStateShifts: string[];
  crossDomainEffects: CrossDomainEffect[];
  newEvolutions: EvolutionEventDef[];
  evolutionUnlocks: string[];
};

export function getTriggeredEvolutions(
  state: WorldState,
  alreadyTriggered: Set<string>,
): EvolutionEventDef[] {
  return EVOLUTION_EVENTS.filter(
    (ev) =>
      !alreadyTriggered.has(ev.id) && state[ev.dimension] >= ev.threshold,
  );
}

export function computeExtendedRipple(
  nodeId: string,
  nodeTitle: string,
  prevAcceptedIds: string[],
  nextAcceptedIds: string[],
  alreadyTriggeredEvolutions: Set<string>,
): ExtendedRippleResult {
  const base = computeRipple(nodeId, nodeTitle, nextAcceptedIds, nextAcceptedIds);

  const prevState = computeWorldState(prevAcceptedIds);
  const nextState = computeWorldState(nextAcceptedIds);

  const worldStateShifts = describeStateShifts(nodeId, prevState, nextState);
  const crossDomainEffects = CROSS_DOMAIN_MAP[nodeId] ?? [];

  const newEvolutions = getTriggeredEvolutions(nextState, alreadyTriggeredEvolutions);
  const evolutionUnlocks = newEvolutions.flatMap((ev) => ev.unlockTitles);

  return {
    ...base,
    worldStateShifts,
    crossDomainEffects,
    newEvolutions,
    evolutionUnlocks,
  };
}

export function buildFeedEntriesFromRipple(
  result: ExtendedRippleResult,
  nodeId: string,
  ts: number,
): EvolutionFeedEntry[] {
  const entries: EvolutionFeedEntry[] = [
    { kind: "canon", nodeId, title: result.nodeTitle, ts },
  ];

  for (const desc of result.worldStateShifts) {
    entries.push({
      kind: "state_shift",
      descriptions: [desc],
      sourceTitle: result.nodeTitle,
      ts: ts + 1,
    });
  }

  for (const cd of result.crossDomainEffects) {
    entries.push({
      kind: "cross_domain",
      title: cd.title,
      region: cd.targetRegion,
      ts: ts + 2,
    });
  }

  for (const ev of result.newEvolutions) {
    entries.push({ kind: "evolution", eventId: ev.id, title: ev.title, ts: ts + 3 });
    for (const unlock of ev.unlockTitles) {
      entries.push({ kind: "unlock", title: unlock, ts: ts + 4 });
    }
  }

  for (const id of result.unlocked) {
    entries.push({
      kind: "unlock",
      title: resolveNodeMeta(id)?.title ?? id,
      ts: ts + 5,
    });
  }

  return entries;
}

export { describeTensions, computeWorldState };

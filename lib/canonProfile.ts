import { ACCEPT_CONSEQUENCES, CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { PARENT_MAP, WORLD_NODES } from "@/lib/worldData";
import { CONSTELLATION_REGIONS } from "@/lib/regions";
import { RIPPLE_MAP } from "@/lib/worldRipple";
import type { DiscoveryDecision } from "@/types/discovery";

export type CanonProfile = {
  genre: string;
  themes: string[];
  establishedCount: number;
  potentialRemaining: number;
  completionPct: number;
  coherenceScore: number;
  openQuestions: string[];
};

const REGION_THEMES: Record<string, string> = {
  mythology: "Forgotten Memory",
  rituals: "Sacred Ritual",
  bloodlines: "Ancestral Debt",
  fear: "Fear of Observation",
  mystery: "Unspoken Truth",
};

const TITLE_KEYWORDS: Record<string, string> = {
  temple: "Sacred Decay",
  memory: "Forgotten Memory",
  fear: "Primal Dread",
  ritual: "Hidden Ceremony",
  name: "Lost Identity",
  oracle: "Prophetic Burden",
  blood: "Lineage Curse",
  shadow: "Unseen Presence",
  silence: "Imposed Silence",
  forest: "Attentive Wilderness",
};

const REGION_QUESTIONS: Record<string, string> = {
  mythology: "Why was the temple deliberately forgotten?",
  rituals: "Who banned the forbidden practices — and did it work?",
  bloodlines: "What ancestral promise created the first curse?",
  fear: "Why does the forest observe without acting?",
  mystery: "What happened during the missing days no one can recall?",
};

const POTENTIAL_FUTURES = [
  "Forgotten Gods Return — the temples reactivate",
  "Memory Economy Emerges — recollections become currency",
  "Oracle Cult Expands — the dreaming children are sought",
  "Blood Pact Underground forms across villages",
  "Forest Claims Sovereignty — the boundary moves inward",
];

function regionForNode(id: string): string | null {
  let current: string | undefined = id;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (REGION_THEMES[current]) return current;
    current = PARENT_MAP[current];
  }
  return null;
}

function inferGenre(worldSeed: string, acceptedIds: string[]): string {
  const seed = worldSeed.toLowerCase();
  if (/horror|dread|nightmare|terror/.test(seed)) return "Psychological Horror";
  if (/myth|folklore|temple|legend|god/.test(seed)) return "Mythic Folklore";
  if (/memory|forget|name/.test(seed)) return "Memory Gothic";

  const regions = new Set(
    acceptedIds.map(regionForNode).filter(Boolean) as string[],
  );
  if (regions.has("fear")) return "Psychological Horror";
  if (regions.has("mythology")) return "Mythic Folklore";
  if (regions.has("rituals")) return "Occult Realism";
  if (regions.has("bloodlines")) return "Generational Saga";
  if (regions.has("mystery")) return "Atmospheric Mystery";
  return "Atmospheric Dark Fantasy";
}

function deriveThemes(acceptedIds: string[]): string[] {
  const themes = new Set<string>();

  for (const id of acceptedIds) {
    const region = regionForNode(id);
    if (region && REGION_THEMES[region]) themes.add(REGION_THEMES[region]);

    const title = (WORLD_NODES[id]?.title ?? CONSEQUENCE_BY_ID[id]?.title ?? "").toLowerCase();
    for (const [keyword, theme] of Object.entries(TITLE_KEYWORDS)) {
      if (title.includes(keyword)) themes.add(theme);
    }
  }

  if (themes.size === 0) {
    return ["Emerging Identity", "Uncharted Lore", "Foundational Mystery"];
  }

  return [...themes].slice(0, 5);
}

function computeCoherence(acceptedIds: string[]): number {
  if (acceptedIds.length === 0) return 0;

  const acceptedSet = new Set(acceptedIds);
  let score = 50;

  for (const id of acceptedIds) {
    const relations = RIPPLE_MAP[id] ?? {};
    const supportCount = (relations.supports ?? []).filter((s) => acceptedSet.has(s)).length;
    const contradictCount = (relations.contradicts ?? []).filter((c) => acceptedSet.has(c)).length;
    score += supportCount * 3;
    score -= contradictCount * 5;
  }

  // Lone truths (no support relations in canon) gently drag coherence down
  const loneCount = acceptedIds.filter((id) => {
    const relations = RIPPLE_MAP[id] ?? {};
    const connected =
      (relations.supports ?? []).some((s) => acceptedSet.has(s)) ||
      (relations.contradicts ?? []).some((c) => acceptedSet.has(c));
    return !connected;
  }).length;
  score -= loneCount * 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function deriveOpenQuestions(acceptedIds: string[]): string[] {
  const questions: string[] = [];
  const seenRegions = new Set<string>();

  for (const id of acceptedIds) {
    const region = regionForNode(id);
    if (region && !seenRegions.has(region) && REGION_QUESTIONS[region]) {
      questions.push(REGION_QUESTIONS[region]);
      seenRegions.add(region);
    }
    if (questions.length >= 3) break;
  }

  if (questions.length === 0) {
    questions.push("What truth lies at the origin of this world?");
  }

  return questions;
}

export function countPotentialPaths(
  acceptedIds: Set<string>,
  decisions: Record<string, DiscoveryDecision>,
  hiddenIds: Set<string>,
): number {
  let count = 0;

  for (const id of Object.keys(WORLD_NODES)) {
    if (acceptedIds.has(id)) continue;
    if (hiddenIds.has(id)) continue;
    if (decisions[id] === "rejected") continue;
    count++;
  }

  for (const id of acceptedIds) {
    for (const c of ACCEPT_CONSEQUENCES[id] ?? []) {
      if (acceptedIds.has(c.id)) continue;
      if (hiddenIds.has(c.id)) continue;
      if (decisions[c.id] === "rejected") continue;
      count++;
    }
  }

  return count;
}

export function buildCanonProfile(
  acceptedIds: string[],
  worldSeed: string,
  decisions: Record<string, DiscoveryDecision>,
  hiddenIds: Set<string>,
): CanonProfile {
  const acceptedSet = new Set(acceptedIds);
  const establishedCount = acceptedIds.length;
  const potentialRemaining = countPotentialPaths(acceptedSet, decisions, hiddenIds);
  const total = establishedCount + potentialRemaining;
  const completionPct =
    total === 0 ? 0 : Math.min(100, Math.round((establishedCount / total) * 100));

  return {
    genre: inferGenre(worldSeed, acceptedIds),
    themes: deriveThemes(acceptedIds),
    establishedCount,
    potentialRemaining,
    completionPct,
    coherenceScore: computeCoherence(acceptedIds),
    openQuestions: deriveOpenQuestions(acceptedIds),
  };
}

export function originJourneySubtitle(worldSeed: string): string {
  const genre = inferGenre(worldSeed, []);
  if (worldSeed.length > 40) return `${genre} — shaped by your seed`;
  if (/indian|folklore|village|temple/i.test(worldSeed))
    return `${genre} rooted in forgotten Indian folklore`;
  const regionHint = CONSTELLATION_REGIONS[0]?.label ?? "forgotten folklore";
  return `${genre} emerging from ${regionHint.toLowerCase()} and your choices`;
}

export function regionLabel(id: string): string {
  return CONSTELLATION_REGIONS.find((r) => r.id === id)?.label ?? id;
}

export { POTENTIAL_FUTURES };

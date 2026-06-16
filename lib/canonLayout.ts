import { ACCEPT_CONSEQUENCES, CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { WORLD_NODES } from "@/lib/worldData";
import { EVOLUTION_EVENTS, type EvolutionEventDef } from "@/lib/worldEvolution";
import { resolveNodeMeta } from "@/lib/worldNodes";

export const CANON_WORLD_SEED_ID = "canon-world-seed";
export const LORE_ROW_H = 88;
export const SECTION_GAP = 56;

export type CanonLayer =
  | "origin"
  | "major_truth"
  | "emerging_theme"
  | "world_evolution"
  | "potential_future"
  | "truth"
  | "consequence"
  | "theme";

export type LoreTreeNode = {
  id: string;
  flowId: string;
  position: { x: number; y: number };
  parentFlowId: string | null;
  canonLayer: CanonLayer;
  sectionLabel?: string;
};

export type CanonLoreTree = {
  seedFlowId: string;
  seedPosition: { x: number; y: number };
  nodes: LoreTreeNode[];
  sectionMarkers: { label: string; y: number }[];
};

function rowHeight(title: string, layer?: CanonLayer): number {
  const lines = Math.max(1, Math.ceil(title.length / 14));
  const base = layer === "emerging_theme" || layer === "potential_future" ? 64 : LORE_ROW_H;
  return Math.max(base, 58 + (lines - 1) * 14);
}

function getTitle(id: string, worldSeed: string): string {
  if (id === CANON_WORLD_SEED_ID) return worldSeed;
  return WORLD_NODES[id]?.title ?? CONSEQUENCE_BY_ID[id]?.title ?? id;
}

/**
 * Living-system canon layout:
 * Origin → Major Truths → Emerging Themes → World Evolutions → Potential Futures
 */
export function buildCanonEvolutionTree(
  acceptedIds: string[],
  worldSeedLabel: string,
  themes: string[],
  triggeredEvolutionIds: string[],
  potentialFutures: string[],
): CanonLoreTree | null {
  if (acceptedIds.length === 0) return null;

  const seedFlowId = "canon-seed";
  const nodes: LoreTreeNode[] = [];
  const sectionMarkers: { label: string; y: number }[] = [];
  let yAcc = LORE_ROW_H;
  let lastParentFlowId = seedFlowId;

  // ── Major Truths (accepted, spread horizontally) ───────────────────────────
  sectionMarkers.push({ label: "Major Truths", y: yAcc });
  yAcc += 28;

  const majorCount = acceptedIds.length;
  const majorGap = Math.max(200, 180 + majorCount * 8);
  const majorOffset = ((majorCount - 1) * majorGap) / 2;

  acceptedIds.forEach((nodeId, i) => {
    const flowId = `major-${nodeId}`;
    const title = getTitle(nodeId, worldSeedLabel);
    nodes.push({
      id: nodeId,
      flowId,
      position: { x: i * majorGap - majorOffset, y: yAcc },
      parentFlowId: seedFlowId,
      canonLayer: "major_truth",
    });
    lastParentFlowId = flowId;
  });

  yAcc += rowHeight("Major Truth") + SECTION_GAP;

  // ── Emerging Themes ────────────────────────────────────────────────────────
  if (themes.length > 0) {
    sectionMarkers.push({ label: "Emerging Themes", y: yAcc });
    yAcc += 28;

    const themeCount = themes.length;
    const themeGap = Math.max(180, 160 + themeCount * 10);
    const themeOffset = ((themeCount - 1) * themeGap) / 2;

    themes.forEach((theme, i) => {
      const flowId = `theme-${i}`;
      nodes.push({
        id: flowId,
        flowId,
        position: { x: i * themeGap - themeOffset, y: yAcc },
        parentFlowId: lastParentFlowId,
        canonLayer: "emerging_theme",
        sectionLabel: theme,
      });
    });

    yAcc += rowHeight(themes[0] ?? "Theme", "emerging_theme") + SECTION_GAP;
    lastParentFlowId = `theme-${themes.length - 1}`;
  }

  // ── World Evolutions ───────────────────────────────────────────────────────
  const triggeredEvents = EVOLUTION_EVENTS.filter((ev) =>
    triggeredEvolutionIds.includes(ev.id),
  );

  if (triggeredEvents.length > 0) {
    sectionMarkers.push({ label: "World Evolutions", y: yAcc });
    yAcc += 28;

    const evCount = triggeredEvents.length;
    const evGap = Math.max(220, 200 + evCount * 12);
    const evOffset = ((evCount - 1) * evGap) / 2;

    triggeredEvents.forEach((ev, i) => {
      const flowId = `evolution-${ev.id}`;
      nodes.push({
        id: ev.id,
        flowId,
        position: { x: i * evGap - evOffset, y: yAcc },
        parentFlowId: lastParentFlowId,
        canonLayer: "world_evolution",
        sectionLabel: ev.title,
      });
    });

    yAcc += rowHeight(triggeredEvents[0]?.title ?? "Evolution", "world_evolution") + SECTION_GAP;
    lastParentFlowId = `evolution-${triggeredEvents[triggeredEvents.length - 1]?.id}`;
  }

  // ── Potential Futures ──────────────────────────────────────────────────────
  if (potentialFutures.length > 0) {
    sectionMarkers.push({ label: "Potential Futures", y: yAcc });
    yAcc += 28;

    const futCount = potentialFutures.length;
    const futGap = Math.max(200, 180 + futCount * 10);
    const futOffset = ((futCount - 1) * futGap) / 2;

    potentialFutures.forEach((future, i) => {
      const flowId = `future-${i}`;
      nodes.push({
        id: flowId,
        flowId,
        position: { x: i * futGap - futOffset, y: yAcc },
        parentFlowId: lastParentFlowId,
        canonLayer: "potential_future",
        sectionLabel: future,
      });
    });
  }

  return {
    seedFlowId,
    seedPosition: { x: 0, y: 0 },
    nodes,
    sectionMarkers,
  };
}

/** @deprecated Use buildCanonEvolutionTree */
export function buildCanonLoreTree(
  acceptedIds: string[],
  worldSeedLabel: string,
): CanonLoreTree | null {
  return buildCanonEvolutionTree(acceptedIds, worldSeedLabel, [], [], []);
}

export function getCanonNodeTitle(id: string, worldSeedLabel: string): string {
  if (id.startsWith("theme-") || id.startsWith("future-") || id.startsWith("evolution-")) {
    return id;
  }
  const meta = resolveNodeMeta(id);
  if (meta) return meta.title;
  return getTitle(id, worldSeedLabel);
}

export function buildCanonTimeline(
  acceptedIds: string[],
  worldSeedLabel: string,
): { seedPosition: { x: number; y: number }; routes: unknown[] } | null {
  const tree = buildCanonEvolutionTree(acceptedIds, worldSeedLabel, [], [], []);
  if (!tree) return null;
  return { seedPosition: tree.seedPosition, routes: [] };
}

export function resolveCanonLayer(_nodeId: string, _depth: number): CanonLayer {
  return "truth";
}

export function canonRowHeight(title: string, layer?: CanonLayer): number {
  return rowHeight(title, layer);
}

/**
 * "Where to begin" guidance for the world overview (Phase 9B, Part C).
 *
 * Suggests 1-2 beginner-friendly constellations so a creator knows where to
 * start. Deterministic, adapts to the world seed via the architecture's
 * structural categories. Canon is never a starting point; Climax is only
 * recommended if nothing else is available.
 */

import type {
  CanvasConstellation,
  CanvasWorldModel,
} from "@/lib/worldBrain/mapArchitectureToCanvas";
import type { ConstellationCategory } from "@/lib/worldBrain/architectWorld";

/** Preference order for where a creator should begin building. */
const START_PRIORITY: ConstellationCategory[] = [
  "characters",
  "settings",
  "conflict",
  "themes",
  "mysteries",
  "power",
  "timeline",
];

/** Categories that should not usually be the first recommended start. */
const EXCLUDED_FROM_START = new Set<ConstellationCategory>(["canon", "climax"]);

export type StartRecommendation = {
  constellationId: string;
  label: string;
};

/**
 * Return up to `max` recommended starting constellation ids, best-first.
 * Falls back to lowest-priority (non-canon) constellations if categories are
 * missing, and only includes climax as a last resort.
 */
export function recommendStartingConstellations(
  model: CanvasWorldModel,
  max = 2,
): StartRecommendation[] {
  const byCategory = new Map<ConstellationCategory, CanvasConstellation[]>();
  for (const c of model.constellations) {
    const cat = (c.category ?? "other") as ConstellationCategory;
    const list = byCategory.get(cat) ?? [];
    list.push(c);
    byCategory.set(cat, list);
  }

  const picked: CanvasConstellation[] = [];
  const pickedIds = new Set<string>();

  const add = (c: CanvasConstellation | undefined) => {
    if (!c || pickedIds.has(c.id) || picked.length >= max) return;
    picked.push(c);
    pickedIds.add(c.id);
  };

  // 1. Preferred story-starting categories, in order.
  for (const cat of START_PRIORITY) {
    if (picked.length >= max) break;
    const list = (byCategory.get(cat) ?? []).sort((a, b) => a.priority - b.priority);
    add(list[0]);
  }

  // 2. Fallback: any non-excluded constellation by priority.
  if (picked.length < max) {
    const remaining = model.constellations
      .filter(
        (c) =>
          !pickedIds.has(c.id) &&
          !EXCLUDED_FROM_START.has((c.category ?? "other") as ConstellationCategory),
      )
      .sort((a, b) => a.priority - b.priority);
    for (const c of remaining) add(c);
  }

  // 3. Last resort only: climax (never canon).
  if (picked.length === 0) {
    const climax = model.constellations.find((c) => c.category === "climax");
    add(climax);
  }

  return picked.map((c, i) => ({
    constellationId: c.id,
    label: i === 0 ? "Start here" : "Recommended next",
  }));
}

/** Convenience: the set of constellation ids that should show a start badge. */
export function startRecommendationIds(model: CanvasWorldModel, max = 2): Set<string> {
  return new Set(recommendStartingConstellations(model, max).map((r) => r.constellationId));
}

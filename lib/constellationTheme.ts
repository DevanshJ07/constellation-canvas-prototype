import type { ConstellationRegionId } from "@/lib/regions";
import { getRegionTheme, REGION_THEMES, type RegionTheme } from "@/lib/regions";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";

const THEME_KEYS = Object.keys(REGION_THEMES) as ConstellationRegionId[];

/** Deterministic theme key from constellation id + model order. */
export function resolveConstellationThemeKey(
  constellationId: string,
  model: CanvasWorldModel | null | undefined,
): ConstellationRegionId {
  if (!model) return "mythology";
  const sorted = [...model.constellations].sort((a, b) => a.priority - b.priority);
  const idx = sorted.findIndex((c) => c.id === constellationId);
  const slot = idx >= 0 ? idx : stableIndexFromId(constellationId);
  return THEME_KEYS[slot % THEME_KEYS.length]!;
}

function stableIndexFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getConstellationTheme(
  constellationId: string,
  model: CanvasWorldModel | null | undefined,
): RegionTheme {
  return getRegionTheme(resolveConstellationThemeKey(constellationId, model));
}

/** Slightly lighter edge stroke for node-reasoner child links. */
export function themeChildEdgeStroke(theme: RegionTheme): string {
  return theme.edge.replace(/[\d.]+\)$/, "0.38)");
}

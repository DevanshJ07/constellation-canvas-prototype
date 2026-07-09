import type { ConstellationColorTheme } from "@/lib/dynamicConstellations";
import { getConstellationTheme } from "@/lib/constellationTheme";
import type { RegionTheme } from "@/lib/regions";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";

export type ConstellationTheme = {
  key: string;
  label: string;
  /** Primary discovery ring */
  ring: string;
  ringInner: string;
  /** Luminous core */
  core: string;
  coreBright: string;
  /** Active halo / aura */
  aura: string;
  auraStrong: string;
  /** Connection paths */
  link: string;
  linkActive: string;
  linkMoon: string;
  /** Orbit guide rings */
  orbit: string;
  orbitMoon: string;
  /** Central sun tint (warm base preserved) */
  sunCore: string;
  sunInner: string;
  sunEdge: string;
  sunBloomInner: string;
  sunBloomMid: string;
  sunBloomOuter: string;
  /** Label emphasis */
  labelActive: string;
  labelMuted: string;
};

const THEMES: Record<string, ConstellationTheme> = {
  memory: {
    key: "memory",
    label: "Memory / Psychology",
    ring: "rgba(212,180,120,0.62)",
    ringInner: "rgba(180,150,100,0.28)",
    core: "rgba(240,220,180,0.92)",
    coreBright: "rgba(255,248,230,0.98)",
    aura: "rgba(212,180,120,0.16)",
    auraStrong: "rgba(212,180,120,0.28)",
    link: "rgba(180,155,110,0.32)",
    linkActive: "rgba(220,195,140,0.58)",
    linkMoon: "rgba(200,175,130,0.42)",
    orbit: "rgba(212,180,120,0.16)",
    orbitMoon: "rgba(212,180,120,0.2)",
    sunCore: "#f4ece0",
    sunInner: "#d8bc88",
    sunEdge: "#a88858",
    sunBloomInner: "rgba(220,190,130,0.38)",
    sunBloomMid: "rgba(220,190,130,0.16)",
    sunBloomOuter: "rgba(220,190,130,0.07)",
    labelActive: "rgba(244,236,220,0.96)",
    labelMuted: "rgba(210,200,180,0.82)",
  },
  mystery: {
    key: "mystery",
    label: "Mystery",
    ring: "rgba(100,150,220,0.58)",
    ringInner: "rgba(80,120,180,0.26)",
    core: "rgba(180,210,245,0.9)",
    coreBright: "rgba(220,235,255,0.98)",
    aura: "rgba(100,150,220,0.14)",
    auraStrong: "rgba(100,150,220,0.26)",
    link: "rgba(100,140,200,0.3)",
    linkActive: "rgba(140,180,230,0.55)",
    linkMoon: "rgba(120,160,210,0.4)",
    orbit: "rgba(100,150,220,0.14)",
    orbitMoon: "rgba(100,150,220,0.18)",
    sunCore: "#e8eef8",
    sunInner: "#98b8e0",
    sunEdge: "#5878a8",
    sunBloomInner: "rgba(120,160,220,0.32)",
    sunBloomMid: "rgba(120,160,220,0.14)",
    sunBloomOuter: "rgba(120,160,220,0.06)",
    labelActive: "rgba(220,232,248,0.96)",
    labelMuted: "rgba(180,195,220,0.8)",
  },
  horror: {
    key: "horror",
    label: "Horror",
    ring: "rgba(160,100,180,0.58)",
    ringInner: "rgba(120,70,140,0.28)",
    core: "rgba(220,180,230,0.88)",
    coreBright: "rgba(245,230,250,0.96)",
    aura: "rgba(140,80,160,0.16)",
    auraStrong: "rgba(140,80,160,0.28)",
    link: "rgba(140,90,160,0.32)",
    linkActive: "rgba(180,120,200,0.55)",
    linkMoon: "rgba(160,110,180,0.42)",
    orbit: "rgba(140,100,170,0.14)",
    orbitMoon: "rgba(140,100,170,0.18)",
    sunCore: "#f0e4f0",
    sunInner: "#b888c0",
    sunEdge: "#784878",
    sunBloomInner: "rgba(160,100,180,0.34)",
    sunBloomMid: "rgba(160,100,180,0.15)",
    sunBloomOuter: "rgba(160,100,180,0.06)",
    labelActive: "rgba(240,228,245,0.96)",
    labelMuted: "rgba(200,185,210,0.8)",
  },
  romance: {
    key: "romance",
    label: "Love / Romance",
    ring: "rgba(220,130,160,0.58)",
    ringInner: "rgba(180,100,130,0.26)",
    core: "rgba(250,200,215,0.9)",
    coreBright: "rgba(255,235,240,0.98)",
    aura: "rgba(220,130,160,0.14)",
    auraStrong: "rgba(220,130,160,0.26)",
    link: "rgba(200,120,150,0.3)",
    linkActive: "rgba(230,160,185,0.55)",
    linkMoon: "rgba(210,140,170,0.4)",
    orbit: "rgba(220,130,160,0.14)",
    orbitMoon: "rgba(220,130,160,0.18)",
    sunCore: "#faf0f2",
    sunInner: "#e0a8b8",
    sunEdge: "#a87080",
    sunBloomInner: "rgba(230,150,170,0.32)",
    sunBloomMid: "rgba(230,150,170,0.14)",
    sunBloomOuter: "rgba(230,150,170,0.06)",
    labelActive: "rgba(255,240,244,0.96)",
    labelMuted: "rgba(220,190,200,0.82)",
  },
  adventure: {
    key: "adventure",
    label: "Adventure / Wild",
    ring: "rgba(80,180,150,0.58)",
    ringInner: "rgba(60,140,120,0.26)",
    core: "rgba(180,235,215,0.9)",
    coreBright: "rgba(220,250,240,0.98)",
    aura: "rgba(80,180,150,0.14)",
    auraStrong: "rgba(80,180,150,0.26)",
    link: "rgba(70,160,140,0.3)",
    linkActive: "rgba(110,200,175,0.55)",
    linkMoon: "rgba(90,180,155,0.4)",
    orbit: "rgba(80,180,150,0.14)",
    orbitMoon: "rgba(80,180,150,0.18)",
    sunCore: "#ecf8f2",
    sunInner: "#88c8a8",
    sunEdge: "#508868",
    sunBloomInner: "rgba(90,190,160,0.32)",
    sunBloomMid: "rgba(90,190,160,0.14)",
    sunBloomOuter: "rgba(90,190,160,0.06)",
    labelActive: "rgba(230,248,240,0.96)",
    labelMuted: "rgba(180,210,195,0.82)",
  },
  tech: {
    key: "tech",
    label: "Technology / Sci-Fi",
    ring: "rgba(70,190,220,0.58)",
    ringInner: "rgba(50,150,190,0.26)",
    core: "rgba(180,235,250,0.9)",
    coreBright: "rgba(230,248,255,0.98)",
    aura: "rgba(70,190,220,0.14)",
    auraStrong: "rgba(70,190,220,0.26)",
    link: "rgba(60,170,210,0.3)",
    linkActive: "rgba(100,210,240,0.55)",
    linkMoon: "rgba(80,190,225,0.4)",
    orbit: "rgba(70,190,220,0.14)",
    orbitMoon: "rgba(70,190,220,0.18)",
    sunCore: "#e8f8fc",
    sunInner: "#78c8e0",
    sunEdge: "#4890a8",
    sunBloomInner: "rgba(80,200,230,0.32)",
    sunBloomMid: "rgba(80,200,230,0.14)",
    sunBloomOuter: "rgba(80,200,230,0.06)",
    labelActive: "rgba(220,245,252,0.96)",
    labelMuted: "rgba(170,205,220,0.82)",
  },
  power: {
    key: "power",
    label: "Politics / Power",
    ring: "rgba(200,140,90,0.58)",
    ringInner: "rgba(160,110,70,0.26)",
    core: "rgba(245,210,175,0.9)",
    coreBright: "rgba(255,240,225,0.98)",
    aura: "rgba(200,140,90,0.14)",
    auraStrong: "rgba(200,140,90,0.26)",
    link: "rgba(180,120,80,0.3)",
    linkActive: "rgba(220,165,110,0.55)",
    linkMoon: "rgba(200,145,95,0.4)",
    orbit: "rgba(200,140,90,0.14)",
    orbitMoon: "rgba(200,140,90,0.18)",
    sunCore: "#faf0e8",
    sunInner: "#d0a070",
    sunEdge: "#986840",
    sunBloomInner: "rgba(210,150,100,0.32)",
    sunBloomMid: "rgba(210,150,100,0.14)",
    sunBloomOuter: "rgba(210,150,100,0.06)",
    labelActive: "rgba(255,240,228,0.96)",
    labelMuted: "rgba(210,190,170,0.82)",
  },
  family: {
    key: "family",
    label: "Family / Emotional",
    ring: "rgba(220,150,130,0.58)",
    ringInner: "rgba(180,120,105,0.26)",
    core: "rgba(250,210,195,0.9)",
    coreBright: "rgba(255,240,235,0.98)",
    aura: "rgba(220,150,130,0.14)",
    auraStrong: "rgba(220,150,130,0.26)",
    link: "rgba(200,130,115,0.3)",
    linkActive: "rgba(235,175,155,0.55)",
    linkMoon: "rgba(215,145,130,0.4)",
    orbit: "rgba(220,150,130,0.14)",
    orbitMoon: "rgba(220,150,130,0.18)",
    sunCore: "#faf2ee",
    sunInner: "#d8a898",
    sunEdge: "#a87868",
    sunBloomInner: "rgba(225,160,140,0.32)",
    sunBloomMid: "rgba(225,160,140,0.14)",
    sunBloomOuter: "rgba(225,160,140,0.06)",
    labelActive: "rgba(255,242,238,0.96)",
    labelMuted: "rgba(215,195,185,0.82)",
  },
};

const DEFAULT_THEME = THEMES.memory!;

function rgbaAlpha(rgba: string, alpha: number): string {
  const m = rgba.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return rgba;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
}

/** Resolve theme from constellation id + title keywords. */
export function resolveConstellationTheme(id: string, title: string): ConstellationTheme {
  const hay = `${id} ${title}`.toLowerCase();

  if (/memory|psychology|mind|recall|identity/.test(hay)) return THEMES.memory!;
  if (/mystery|noir|detective|secret|unknown/.test(hay)) return THEMES.mystery!;
  if (/horror|dread|fear|nightmare|folklore/.test(hay)) return THEMES.horror!;
  if (/love|romance|heart|passion|rose/.test(hay)) return THEMES.romance!;
  if (/jungle|adventure|wild|expedition|forest/.test(hay)) return THEMES.adventure!;
  if (/tech|sci-fi|cyber|data|hack|digital|economy|index/.test(hay)) return THEMES.tech!;
  if (/politic|power|empire|throne|war|copper/.test(hay)) return THEMES.power!;
  if (/family|saga|mother|father|home|emotional/.test(hay)) return THEMES.family!;

  return DEFAULT_THEME;
}

const DYNAMIC_ACCENT: Record<ConstellationColorTheme, { r: number; g: number; b: number }> = {
  yellow: { r: 251, g: 191, b: 36 },
  violet: { r: 167, g: 139, b: 250 },
  green: { r: 52, g: 211, b: 153 },
  red: { r: 248, g: 113, b: 113 },
  blue: { r: 96, g: 165, b: 250 },
  cyan: { r: 34, g: 211, b: 238 },
  pink: { r: 244, g: 114, b: 182 },
  orange: { r: 251, g: 146, b: 60 },
};

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const rgba = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgba) return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) };
  const hex = color.match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  return null;
}

/** Build a full galaxy theme from a single accent RGB — muted cosmic tones. */
export function buildGalaxyThemeFromAccent(
  r: number,
  g: number,
  b: number,
  key: string,
  label: string,
): ConstellationTheme {
  const mix = (factor: number) =>
    `#${[r, g, b]
      .map((c) => Math.round(Math.min(255, c * factor + 40 * (1 - factor))))
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")}`;

  return {
    key,
    label,
    ring: `rgba(${r}, ${g}, ${b}, 0.68)`,
    ringInner: `rgba(${r}, ${g}, ${b}, 0.32)`,
    core: `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.94)`,
    coreBright: `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 0.98)`,
    aura: `rgba(${r}, ${g}, ${b}, 0.18)`,
    auraStrong: `rgba(${r}, ${g}, ${b}, 0.32)`,
    link: `rgba(${r}, ${g}, ${b}, 0.52)`,
    linkActive: `rgba(${r}, ${g}, ${b}, 0.78)`,
    linkMoon: `rgba(${r}, ${g}, ${b}, 0.58)`,
    orbit: `rgba(${r}, ${g}, ${b}, 0.2)`,
    orbitMoon: `rgba(${r}, ${g}, ${b}, 0.26)`,
    sunCore: mix(1.15),
    sunInner: mix(0.85),
    sunEdge: mix(0.55),
    sunBloomInner: `rgba(${r}, ${g}, ${b}, 0.38)`,
    sunBloomMid: `rgba(${r}, ${g}, ${b}, 0.16)`,
    sunBloomOuter: `rgba(${r}, ${g}, ${b}, 0.07)`,
    labelActive: `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 0.96)`,
    labelMuted: `rgba(${r}, ${g}, ${b}, 0.82)`,
  };
}

export function galaxyThemeFromRegionTheme(
  regionTheme: RegionTheme,
  key: string,
): ConstellationTheme {
  const rgb = parseColorToRgb(regionTheme.dot);
  if (!rgb) return DEFAULT_THEME;
  return buildGalaxyThemeFromAccent(rgb.r, rgb.g, rgb.b, key, key);
}

export function galaxyThemeFromDynamicColor(color: ConstellationColorTheme): ConstellationTheme {
  const rgb = DYNAMIC_ACCENT[color];
  return buildGalaxyThemeFromAccent(rgb.r, rgb.g, rgb.b, color, color);
}

export type ResolveGalaxyThemeOptions = {
  architectureCanvasModel?: CanvasWorldModel | null;
  dynamicColorTheme?: ConstellationColorTheme | null;
};

/** Production theme resolver — architecture / dynamic colors take priority. */
export function resolveGalaxyThemeForApp(
  constellationId: string,
  title: string,
  options: ResolveGalaxyThemeOptions = {},
): ConstellationTheme {
  if (options.architectureCanvasModel) {
    const region = getConstellationTheme(constellationId, options.architectureCanvasModel);
    return galaxyThemeFromRegionTheme(region, constellationId);
  }
  if (options.dynamicColorTheme) {
    return galaxyThemeFromDynamicColor(options.dynamicColorTheme);
  }
  return resolveConstellationTheme(constellationId, title);
}

export function markerPaletteFromTheme(
  theme: ConstellationTheme,
  decision: "pending" | "accepted" | "rejected" | "inactive",
  active: boolean,
): { ring: string; ringInner: string; core: string; aura: string } {
  if (decision === "accepted") {
    return {
      ring: rgbaAlpha(theme.ring, active ? 0.92 : 0.78),
      ringInner: rgbaAlpha(theme.ringInner, 0.38),
      core: theme.coreBright,
      aura: theme.auraStrong,
    };
  }
  if (decision === "rejected") {
    return {
      ring: "rgba(90,95,105,0.38)",
      ringInner: "rgba(70,75,85,0.18)",
      core: "rgba(130,135,145,0.55)",
      aura: "rgba(60,65,75,0.08)",
    };
  }
  if (decision === "inactive") {
    return {
      ring: rgbaAlpha(theme.ring, 0.38),
      ringInner: rgbaAlpha(theme.ringInner, 0.18),
      core: rgbaAlpha(theme.core, 0.68),
      aura: rgbaAlpha(theme.aura, 0.08),
    };
  }
  if (active) {
    return {
      ring: rgbaAlpha(theme.ring, 0.88),
      ringInner: rgbaAlpha(theme.ringInner, 0.42),
      core: theme.coreBright,
      aura: theme.auraStrong,
    };
  }
  return {
    ring: rgbaAlpha(theme.ring, 0.68),
    ringInner: rgbaAlpha(theme.ringInner, 0.32),
    core: rgbaAlpha(theme.core, 0.92),
    aura: rgbaAlpha(theme.aura, 0.14),
  };
}

export function moonPaletteFromTheme(theme: ConstellationTheme): {
  ring: string;
  ringInner: string;
  core: string;
  aura: string;
} {
  return {
    ring: rgbaAlpha(theme.ring, 0.62),
    ringInner: rgbaAlpha(theme.ringInner, 0.28),
    core: rgbaAlpha(theme.core, 0.96),
    aura: rgbaAlpha(theme.aura, 0.16),
  };
}

export type ConstellationRegionId =
  | "mythology"
  | "rituals"
  | "bloodlines"
  | "fear"
  | "mystery";

export type RegionTheme = {
  labelClass: string;
  glow: string;
  dot: string;
  line: string;
  edge: string;
};

export type ConstellationRegion = {
  id: ConstellationRegionId;
  label: string;
  icon: string;
  position: { x: number; y: number };
  width: number;
  height: number;
};

export const REGION_THEMES: Record<ConstellationRegionId, RegionTheme> = {
  mythology: {
    labelClass: "text-amber-200/95",
    glow: "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(251,191,36,0.14) 0%, rgba(251,191,36,0.04) 45%, transparent 72%)",
    dot: "rgba(251, 191, 36, 0.55)",
    line: "rgba(251, 191, 36, 0.18)",
    edge: "rgba(251, 191, 36, 0.22)",
  },
  rituals: {
    labelClass: "text-violet-200/95",
    glow: "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(167,139,250,0.14) 0%, rgba(167,139,250,0.04) 45%, transparent 72%)",
    dot: "rgba(167, 139, 250, 0.55)",
    line: "rgba(167, 139, 250, 0.18)",
    edge: "rgba(167, 139, 250, 0.22)",
  },
  bloodlines: {
    labelClass: "text-emerald-200/95",
    glow: "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(52,211,153,0.14) 0%, rgba(52,211,153,0.04) 45%, transparent 72%)",
    dot: "rgba(52, 211, 153, 0.55)",
    line: "rgba(52, 211, 153, 0.18)",
    edge: "rgba(52, 211, 153, 0.22)",
  },
  fear: {
    labelClass: "text-rose-300/95",
    glow: "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(244,63,94,0.12) 0%, rgba(190,18,60,0.04) 45%, transparent 72%)",
    dot: "rgba(244, 63, 94, 0.5)",
    line: "rgba(244, 63, 94, 0.16)",
    edge: "rgba(244, 63, 94, 0.2)",
  },
  mystery: {
    labelClass: "text-sky-200/95",
    glow: "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(56,189,248,0.14) 0%, rgba(56,189,248,0.04) 45%, transparent 72%)",
    dot: "rgba(56, 189, 248, 0.55)",
    line: "rgba(56, 189, 248, 0.18)",
    edge: "rgba(56, 189, 248, 0.22)",
  },
};

export const CONSTELLATION_REGIONS: ConstellationRegion[] = [
  {
    id: "mythology",
    label: "Mythology",
    icon: "✦",
    position: { x: -520, y: -260 },
    width: 320,
    height: 240,
  },
  {
    id: "rituals",
    label: "Rituals",
    icon: "◈",
    position: { x: 200, y: -260 },
    width: 320,
    height: 240,
  },
  {
    id: "bloodlines",
    label: "Bloodlines",
    icon: "⊕",
    position: { x: -520, y: 70 },
    width: 320,
    height: 200,
  },
  {
    id: "fear",
    label: "Fear",
    icon: "⊗",
    position: { x: 200, y: 70 },
    width: 320,
    height: 200,
  },
  {
    id: "mystery",
    label: "Mystery",
    icon: "◐",
    position: { x: -160, y: 330 },
    width: 320,
    height: 200,
  },
];

export const DISCOVERY_REGION_MAP: Record<string, ConstellationRegionId> = {
  "forgotten-banyan-goddess": "mythology",
  "memory-trapped-spirits": "mythology",
  "ritual-of-the-seventh-night": "rituals",
  "monsoon-possession-myth": "rituals",
  "bloodline-of-silent-heirs": "bloodlines",
  "abandoned-village-shrine": "mystery",
};

export const HIDDEN_DISCOVERY_LABELS: Record<string, string> = {
  "memory-trapped-spirits": "Unknown Signal",
  "abandoned-village-shrine": "Hidden Thread",
  "monsoon-possession-myth": "Unexplored Presence",
};

export function getRegionById(id: ConstellationRegionId) {
  const region = CONSTELLATION_REGIONS.find((r) => r.id === id);
  if (!region) throw new Error(`Unknown region: ${id}`);
  return region;
}

export function getRegionTheme(id: ConstellationRegionId) {
  return REGION_THEMES[id];
}

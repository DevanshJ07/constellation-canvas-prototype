/** Dynamic vertical spacing for future branch nodes. */
export function computeBranchSpacing(count: number, baseGap = 72): number {
  if (count <= 1) return 0;
  if (count === 2) return baseGap * 1.15;
  // Expand spacing as branch count grows to prevent overlap
  return baseGap + Math.max(0, count - 3) * 14;
}

/** Y positions for N future branches, centered on the current node. */
export function computeFutureYPositions(count: number, baseGap = 72): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];
  const spacing = computeBranchSpacing(count, baseGap);
  return Array.from({ length: count }, (_, j) => (j - (count - 1) / 2) * spacing);
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type OrbitalLayoutOptions = {
  centerX?: number;
  centerY?: number;
  baseRadius?: number;
  radiusStep?: number;
  /** Stable phase offset derived from a string (e.g. constellation id). */
  phaseSeed?: string;
};

function stablePhaseOffset(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % 360) * Math.PI) / 180;
}

/**
 * Positions child nodes in a golden-angle spiral around a central point.
 * Deterministic for the same count + options.
 */
export function computeOrbitalPositions(
  count: number,
  options: OrbitalLayoutOptions = {},
): { x: number; y: number }[] {
  if (count <= 0) return [];

  const {
    centerX = -110,
    centerY = 0,
    baseRadius = 250,
    radiusStep = 44,
    phaseSeed = "",
  } = options;

  const phase = phaseSeed ? stablePhaseOffset(phaseSeed) : 0;
  const scaledBase =
    count === 1 ? baseRadius * 0.75 : count <= 3 ? baseRadius * 0.88 : baseRadius;
  const scaledStep =
    count <= 2 ? radiusStep * 0.65 : count <= 4 ? radiusStep * 0.82 : radiusStep;

  return Array.from({ length: count }, (_, index) => {
    const angle = phase + index * GOLDEN_ANGLE;
    const radius = scaledBase + index * scaledStep;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });
}

/** Default center for constellation-root exploration (biased left for right panel). */
export const CONSTELLATION_ORBIT_CENTER = { x: -110, y: 0 } as const;

export type LabelCollisionEntry = {
  id: string;
  x: number;
  y: number;
  priority: number;
};

const LABEL_W = 128;
const LABEL_H = 48;
const NODE_BELOW = 28;

type Box = { left: number; right: number; top: number; bottom: number };

function labelBox(x: number, y: number, offsetY: number): Box {
  const top = y + NODE_BELOW + offsetY;
  return {
    left: x - LABEL_W / 2,
    right: x + LABEL_W / 2,
    top,
    bottom: top + LABEL_H,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Resolve vertical label offsets to reduce overlap. Higher priority wins. */
export function resolveLabelOffsets(
  entries: LabelCollisionEntry[],
): Record<string, number> {
  const offsets: Record<string, number> = {};
  for (const e of entries) offsets[e.id] = 0;

  const sorted = [...entries].sort((a, b) => b.priority - a.priority);
  const placed: Box[] = [];

  for (const entry of sorted) {
    let offset = 0;
    let box = labelBox(entry.x, entry.y, offset);
    let guard = 0;
    while (placed.some((p) => overlaps(p, box)) && guard < 24) {
      offset += 16;
      box = labelBox(entry.x, entry.y, offset);
      guard++;
    }
    offsets[entry.id] = offset;
    placed.push(box);
  }

  return offsets;
}

export function labelPriority(
  journeyPhase: "past" | "current" | "future" | undefined,
  role: string,
  isSelected: boolean,
): number {
  if (isSelected) return 100;
  if (journeyPhase === "current" || role === "focused") return 80;
  if (journeyPhase === "future") return 60;
  if (journeyPhase === "past") return 40;
  return 50;
}

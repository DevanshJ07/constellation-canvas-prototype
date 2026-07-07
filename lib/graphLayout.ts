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

/** Tighter orbit defaults for node expansion (vs constellation-level layout). */
export const NODE_EXPANSION_BASE_RADIUS = 180;
export const NODE_EXPANSION_RADIUS_STEP = 28;
export const NODE_EXPANSION_MIN_PARENT_DISTANCE = 140;
export const NODE_EXPANSION_MIN_SIBLING_DISTANCE = 72;

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

/** Stable angle offset derived from a node id — deterministic, no randomness. */
export const stableHashToAngle = stablePhaseOffset;

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

// ── Node expansion layout (Phase 3 Step 6B) ─────────────────────────────────────

export type NodeExpansionLayoutChild = {
  id: string;
};

export type NodeExpansionLayoutParams = {
  parentPosition: { x: number; y: number };
  childNodes: NodeExpansionLayoutChild[];
  /** Used for stable angleOffset when angleOffset is omitted. */
  parentNodeId?: string;
  depthLevel?: number;
  existingPositions?: Record<string, { x: number; y: number }>;
  baseRadius?: number;
  radiusStep?: number;
  angleOffset?: number;
  minRadiusFromParent?: number;
};

export type NodeExpansionLayoutResult = {
  positions: Record<string, { x: number; y: number }>;
};

function distanceBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function scaleFromCenter(
  center: { x: number; y: number },
  point: { x: number; y: number },
  targetDistance: number,
): { x: number; y: number } {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) {
    return { x: center.x + targetDistance, y: center.y };
  }
  const scale = targetDistance / dist;
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function depthLayoutScale(depthLevel: number): { radiusBoost: number; stepBoost: number } {
  const depth = Math.max(1, Math.floor(depthLevel));
  if (depth <= 2) return { radiusBoost: 0, stepBoost: 0 };
  const extra = depth - 2;
  return { radiusBoost: extra * 24, stepBoost: extra * 8 };
}

/**
 * Deterministic golden-angle spiral around a selected parent node.
 * Tighter than constellation-level orbital layout; intended for Node Reasoner children.
 */
export function layoutChildNodesAroundParent(
  params: NodeExpansionLayoutParams,
): NodeExpansionLayoutResult {
  const {
    parentPosition,
    childNodes,
    parentNodeId = "",
    depthLevel = 2,
    existingPositions = {},
    baseRadius = NODE_EXPANSION_BASE_RADIUS,
    radiusStep = NODE_EXPANSION_RADIUS_STEP,
    angleOffset,
    minRadiusFromParent = NODE_EXPANSION_MIN_PARENT_DISTANCE,
  } = params;

  if (childNodes.length === 0) {
    return { positions: {} };
  }

  const { radiusBoost, stepBoost } = depthLayoutScale(depthLevel);
  const effectiveBase = baseRadius + radiusBoost;
  const effectiveStep = radiusStep + stepBoost;
  const phase =
    angleOffset ?? (parentNodeId ? stablePhaseOffset(parentNodeId) : 0);

  const positions: Record<string, { x: number; y: number }> = {};
  const placed: { x: number; y: number }[] = Object.values(existingPositions);

  childNodes.forEach((child, index) => {
    const angle = phase + index * GOLDEN_ANGLE;
    let radius = effectiveBase + index * effectiveStep;

    // Single child: slight up-right bias for readability
    const finalAngle = childNodes.length === 1 ? phase - Math.PI / 6 : angle;

    let x = parentPosition.x + Math.cos(finalAngle) * radius;
    let y = parentPosition.y + Math.sin(finalAngle) * radius;
    let point = { x, y };

    // Enforce minimum distance from parent
    if (distanceBetween(point, parentPosition) < minRadiusFromParent) {
      point = scaleFromCenter(parentPosition, point, minRadiusFromParent);
    }

    // Nudge outward if too close to existing nodes (simple deterministic bump)
    let guard = 0;
    while (guard < 12) {
      const tooCloseToExisting = placed.some(
        (p) => distanceBetween(point, p) < NODE_EXPANSION_MIN_SIBLING_DISTANCE,
      );
      if (!tooCloseToExisting) break;
      radius += effectiveStep * 0.5;
      x = parentPosition.x + Math.cos(finalAngle) * radius;
      y = parentPosition.y + Math.sin(finalAngle) * radius;
      point = { x, y };
      if (distanceBetween(point, parentPosition) < minRadiusFromParent) {
        point = scaleFromCenter(parentPosition, point, minRadiusFromParent);
      }
      guard++;
    }

    positions[child.id] = point;
    placed.push(point);
  });

  return { positions };
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

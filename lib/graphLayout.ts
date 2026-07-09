import {
  computeConstellationGalaxyLayout,
  layoutSatellitesAroundParent,
} from "@/lib/orbitalLayout";

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

/** Tighter orbit defaults for node expansion (vs constellation-level layout). */
export const NODE_EXPANSION_BASE_RADIUS = 150;
export const NODE_EXPANSION_RADIUS_STEP = 24;
export const NODE_EXPANSION_MIN_PARENT_DISTANCE = 120;
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
  const {
    centerX = 0,
    centerY = 0,
    baseRadius = 210,
    radiusStep = 36,
    phaseSeed = "",
  } = options;

  return computeConstellationGalaxyLayout(count, {
    center: { x: centerX, y: centerY },
    baseRadius,
    radiusStep,
    phaseSeed,
    depthLevel: 1,
  });
}

/** Logical center for constellation-root exploration — viewport pan handles panel inset. */
export const CONSTELLATION_ORBIT_CENTER = { x: 0, y: 0 } as const;

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
    minRadiusFromParent = NODE_EXPANSION_MIN_PARENT_DISTANCE,
  } = params;

  const positions = layoutSatellitesAroundParent({
    parentPosition,
    childIds: childNodes.map((child) => child.id),
    parentNodeId,
    depthLevel,
    existingPositions,
    minParentDistance: minRadiusFromParent,
    minSiblingDistance: NODE_EXPANSION_MIN_SIBLING_DISTANCE,
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

export type LayoutBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type FitLayoutToBoundsOptions = {
  padding?: number;
  minScale?: number;
  maxScale?: number;
};

/** Default safe area for local constellation exploration (React Flow coords). */
export const DISCOVERY_LAYOUT_BOUNDS: LayoutBounds = {
  minX: -380,
  maxX: 380,
  minY: -260,
  maxY: 260,
};

/** Bounds for fit scaling; panel inset shrinks usable width without shifting logical center. */
export function computeDiscoveryLayoutBounds(panelInsetPx = 0): LayoutBounds {
  if (panelInsetPx <= 0) return { ...DISCOVERY_LAYOUT_BOUNDS };
  const shrink = Math.min(120, Math.round(panelInsetPx * 0.22));
  return {
    ...DISCOVERY_LAYOUT_BOUNDS,
    maxX: DISCOVERY_LAYOUT_BOUNDS.maxX - shrink,
    minX: DISCOVERY_LAYOUT_BOUNDS.minX + shrink * 0.35,
  };
}

/**
 * Scales and recenters node positions to fit within bounds.
 * Preserves relative arrangement; deterministic, no randomness.
 */
export function fitLayoutToBounds(
  positions: Record<string, { x: number; y: number }>,
  bounds: LayoutBounds,
  options: FitLayoutToBoundsOptions = {},
): Record<string, { x: number; y: number }> {
  const ids = Object.keys(positions);
  if (ids.length === 0) return { ...positions };

  const padding = options.padding ?? 28;
  const minScale = options.minScale ?? 0.38;
  const maxScale = options.maxScale ?? 1;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const id of ids) {
    const p = positions[id]!;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const boxW = Math.max(maxX - minX, 1);
  const boxH = Math.max(maxY - minY, 1);
  const availW = bounds.maxX - bounds.minX - padding * 2;
  const availH = bounds.maxY - bounds.minY - padding * 2;

  let scale = Math.min(availW / boxW, availH / boxH, maxScale);
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;
  scale = Math.max(minScale, Math.min(maxScale, scale));

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const targetCx = (bounds.minX + bounds.maxX) / 2;
  const targetCy = (bounds.minY + bounds.maxY) / 2;

  const needsScale = boxW > availW || boxH > availH;

  const result: Record<string, { x: number; y: number }> = {};
  for (const id of ids) {
    const p = positions[id]!;
    const effectiveScale = needsScale ? scale : 1;
    result[id] = {
      x: targetCx + (p.x - cx) * effectiveScale,
      y: targetCy + (p.y - cy) * effectiveScale,
    };
  }
  return result;
}

/**
 * Scales nodes around a focus point kept at the bounds center.
 * Prevents centroid recentering from drifting the parent star off-center.
 */
export function fitLayoutPreservingFocus(
  positions: Record<string, { x: number; y: number }>,
  focusId: string,
  bounds: LayoutBounds,
  options: FitLayoutToBoundsOptions = {},
): Record<string, { x: number; y: number }> {
  const ids = Object.keys(positions);
  if (ids.length === 0) return { ...positions };

  const padding = options.padding ?? 28;
  const minScale = options.minScale ?? 0.38;
  const maxScale = options.maxScale ?? 1;

  const focus = positions[focusId] ?? { x: 0, y: 0 };
  const normalized: Record<string, { x: number; y: number }> = {};
  for (const id of ids) {
    const p = positions[id]!;
    normalized[id] = { x: p.x - focus.x, y: p.y - focus.y };
  }

  const availW = bounds.maxX - bounds.minX - padding * 2;
  const availH = bounds.maxY - bounds.minY - padding * 2;
  const halfW = availW / 2;
  const halfH = availH / 2;

  let maxAbsX = 0;
  let maxAbsY = 0;
  for (const id of ids) {
    if (id === focusId) continue;
    const p = normalized[id]!;
    maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
    maxAbsY = Math.max(maxAbsY, Math.abs(p.y));
  }

  let scale = 1;
  if (maxAbsX > halfW || maxAbsY > halfH) {
    const scaleX = maxAbsX > 0 ? halfW / maxAbsX : 1;
    const scaleY = maxAbsY > 0 ? halfH / maxAbsY : 1;
    scale = Math.min(scaleX, scaleY, maxScale);
  }
  scale = Math.max(minScale, Math.min(maxScale, scale));

  const targetCx = (bounds.minX + bounds.maxX) / 2;
  const targetCy = (bounds.minY + bounds.maxY) / 2;

  const result: Record<string, { x: number; y: number }> = {};
  for (const id of ids) {
    const p = normalized[id]!;
    result[id] = {
      x: targetCx + p.x * scale,
      y: targetCy + p.y * scale,
    };
  }
  return result;
}

/** Applies fitted positions back onto React Flow trail nodes. */
export function applyPositionMapToNodes<T extends { id: string; position: { x: number; y: number } }>(
  nodes: T[],
  positions: Record<string, { x: number; y: number }>,
): T[] {
  return nodes.map((n) => ({
    ...n,
    position: positions[n.id] ?? n.position,
  }));
}

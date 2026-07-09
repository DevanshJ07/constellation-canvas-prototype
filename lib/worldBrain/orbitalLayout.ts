/**
 * Deterministic orbital layout system (Phase 6E.2).
 * Pure functions — canvas-dimension-aware, no randomness.
 *
 * Spatial model:
 * - World overview = galaxy (constellations orbit a central void)
 * - Constellation view = sun + planets
 * - Explore deeper = planet + moons
 */

export type Point = { x: number; y: number };

export type LayoutBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type CanvasDimensions = {
  width: number;
  height: number;
  sidebarWidth?: number;
  panelInset?: number;
};

export type OrbitLayoutOptions = {
  center?: Point;
  baseRadius?: number;
  radiusStep?: number;
  ringCapacity?: number;
  phaseSeed?: string;
  depthLevel?: number;
};

export type ViewportTarget = {
  centerX: number;
  centerY: number;
  zoom: number;
};

export type LabelCollisionEntry = {
  id: string;
  x: number;
  y: number;
  priority: number;
};

/** Readable default zoom band for auto-fit. */
export const READABLE_ZOOM_MIN = 0.85;
export const READABLE_ZOOM_MAX = 1.35;
export const VIEWPORT_ZOOM_FLOOR = 0.75;
export const VIEWPORT_ZOOM_CEILING = 1.5;

/** Nodes per ring before opening the next ring. */
export const ORBIT_RING_CAPACITY = 6;

/** Effective footprint for constellation region cards in overview. */
export const GALAXY_NODE_FOOTPRINT = { width: 280, height: 200 };

/** Golden angle for multi-ring fallback. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function stableHashToAngle(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % 360) * Math.PI) / 180;
}

export { stableHashToAngle };

function polarToCartesian(center: Point, angle: number, radius: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getUsableCanvasSize(canvas: CanvasDimensions): { width: number; height: number } {
  const sidebar = canvas.sidebarWidth ?? 176;
  const panel = canvas.panelInset ?? 0;
  const topBottomReserve = 144;
  return {
    width: Math.max(320, canvas.width - sidebar - panel),
    height: Math.max(400, canvas.height - topBottomReserve),
  };
}

/** Flow-space safe bounds derived from visible canvas area. */
export function computeSafeLayoutBounds(canvas: CanvasDimensions): LayoutBounds {
  const { width, height } = getUsableCanvasSize(canvas);
  const halfW = width * 0.46;
  const halfH = height * 0.42;
  return {
    minX: -halfW,
    maxX: halfW,
    minY: -halfH,
    maxY: halfH,
  };
}

export function computeOrbitRadius(
  index: number,
  baseRadius: number,
  radiusStep: number,
  ringCapacity = ORBIT_RING_CAPACITY,
): number {
  const ring = Math.floor(index / ringCapacity);
  const indexInRing = index % ringCapacity;
  const ringBoost = ring * (baseRadius * 0.62 + radiusStep * 1.8);
  return ringBoost + baseRadius + indexInRing * radiusStep * 0.35;
}

export function computeOrbitRadiusFromCanvas(
  canvas: CanvasDimensions,
  kind: "galaxy" | "constellation" | "satellite",
): number {
  const { width, height } = getUsableCanvasSize(canvas);
  const minDim = Math.min(width, height);
  if (kind === "galaxy") return minDim * 0.24;
  if (kind === "constellation") return minDim * 0.22;
  return minDim * 0.11;
}

export function computeOrbitPositions(
  count: number,
  center: Point = { x: 0, y: 0 },
  options: OrbitLayoutOptions = {},
): Point[] {
  if (count <= 0) return [];

  const baseRadius = options.baseRadius ?? 220;
  const radiusStep = options.radiusStep ?? 24;
  const ringCapacity = options.ringCapacity ?? ORBIT_RING_CAPACITY;
  const phase = options.phaseSeed ? stableHashToAngle(options.phaseSeed) * 0.1 : 0;

  if (count === 1) {
    return [polarToCartesian(center, phase - Math.PI / 4, baseRadius * 0.95)];
  }

  if (count === 2) {
    return [
      polarToCartesian(center, phase - Math.PI / 4, baseRadius * 0.95),
      polarToCartesian(center, phase + (3 * Math.PI) / 4, baseRadius * 0.95),
    ];
  }

  if (count <= ringCapacity) {
    return Array.from({ length: count }, (_, index) => {
      const angle = phase - Math.PI / 2 + (index * 2 * Math.PI) / count;
      const radius = baseRadius + (index % 2) * radiusStep;
      return polarToCartesian(center, angle, radius);
    });
  }

  return Array.from({ length: count }, (_, index) => {
    const ring = Math.floor(index / ringCapacity);
    const indexInRing = index % ringCapacity;
    const angle =
      phase -
      Math.PI / 2 +
      ring * (Math.PI / ringCapacity) +
      (indexInRing * 2 * Math.PI) / ringCapacity;
    const radius = computeOrbitRadius(index, baseRadius, radiusStep, ringCapacity);
    return polarToCartesian(center, angle, radius);
  });
}

/** World overview — minimum center-to-center separation (includes label footprint). */
export const WORLD_OVERVIEW_MIN_SEPARATION = 340;

function separateOverviewCenters(
  centers: Point[],
  minDistance: number,
  bounds: LayoutBounds,
): Point[] {
  const pts = centers.map((p) => ({ ...p }));
  for (let iter = 0; iter < 16; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist >= minDistance) continue;
        const push = (minDistance - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
    for (const p of pts) {
      p.x = Math.min(bounds.maxX, Math.max(bounds.minX, p.x));
      p.y = Math.min(bounds.maxY, Math.max(bounds.minY, p.y));
    }
  }
  return pts;
}

/** World overview — constellations as star systems in a galaxy cluster. */
export function computeWorldGalaxyLayout(
  ids: string[],
  canvas: CanvasDimensions,
): Record<string, Point> {
  const count = ids.length;
  if (count === 0) return {};

  const { width, height } = getUsableCanvasSize(canvas);
  const minDim = Math.min(width, height);
  const bounds = computeSafeLayoutBounds(canvas);

  const spread =
    count <= 3 ? 0.32 : count <= 5 ? 0.4 : count <= 6 ? 0.42 : 0.44;
  const rx = minDim * spread;
  const ry = minDim * spread * 0.86;
  const phase = stableHashToAngle(ids.join("|")) * 0.08;

  let centers: Point[];
  if (count === 1) {
    centers = [{ x: 0, y: 0 }];
  } else {
    centers = ids.map((_, index) => {
      const angle = phase - Math.PI / 2 + (index * 2 * Math.PI) / count;
      return {
        x: Math.cos(angle) * rx,
        y: Math.sin(angle) * ry,
      };
    });
    centers = separateOverviewCenters(centers, WORLD_OVERVIEW_MIN_SEPARATION, bounds);
  }

  const positions: Record<string, Point> = {};
  ids.forEach((id, index) => {
    const center = centers[index] ?? { x: 0, y: 0 };
    positions[id] = {
      x: center.x - GALAXY_NODE_FOOTPRINT.width / 2,
      y: center.y - GALAXY_NODE_FOOTPRINT.height / 2,
    };
  });
  return positions;
}

/** Constellation sun view — direct nodes as planets. */
export function computeConstellationOrbitLayout(
  count: number,
  canvas: CanvasDimensions,
  options: OrbitLayoutOptions = {},
): Point[] {
  const center = options.center ?? { x: 0, y: 0 };
  return computeOrbitPositions(count, center, {
    baseRadius: options.baseRadius ?? computeOrbitRadiusFromCanvas(canvas, "constellation"),
    radiusStep:
      options.radiusStep ?? computeOrbitRadiusFromCanvas(canvas, "constellation") * 0.14,
    ringCapacity: ORBIT_RING_CAPACITY,
    phaseSeed: options.phaseSeed,
    depthLevel: options.depthLevel ?? 1,
  });
}

/** Explore deeper — child nodes as moons around selected parent. */
export function computeSatelliteOrbitLayout(
  count: number,
  parentPosition: Point,
  canvas: CanvasDimensions,
  options: OrbitLayoutOptions = {},
): Point[] {
  return computeOrbitPositions(count, parentPosition, {
    baseRadius: options.baseRadius ?? computeOrbitRadiusFromCanvas(canvas, "satellite"),
    radiusStep:
      options.radiusStep ?? computeOrbitRadiusFromCanvas(canvas, "satellite") * 0.12,
    ringCapacity: ORBIT_RING_CAPACITY,
    phaseSeed: options.phaseSeed,
    depthLevel: options.depthLevel ?? 2,
  });
}

export function computeActiveClusterBounds(
  positions: Record<string, Point>,
  nodeIds: string[],
  nodeSize = { width: 48, height: 48 },
): LayoutBounds {
  const ids = nodeIds.length > 0 ? nodeIds : Object.keys(positions);
  if (ids.length === 0) {
    return { minX: -40, maxX: 40, minY: -40, maxY: 40 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const id of ids) {
    const p = positions[id];
    if (!p) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x + nodeSize.width);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + nodeSize.height);
  }

  if (!Number.isFinite(minX)) {
    return { minX: -40, maxX: 40, minY: -40, maxY: 40 };
  }

  return { minX, maxX, minY, maxY };
}

export function computeViewportForCluster(
  bounds: LayoutBounds,
  canvas: CanvasDimensions,
  options: {
    padding?: number;
    minZoom?: number;
    maxZoom?: number;
    targetFill?: number;
  } = {},
): ViewportTarget {
  const padding = options.padding ?? 64;
  const minZoom = options.minZoom ?? READABLE_ZOOM_MIN;
  const maxZoom = options.maxZoom ?? READABLE_ZOOM_MAX;
  const targetFill = options.targetFill ?? 0.65;

  const { width: usableW, height: usableH } = getUsableCanvasSize(canvas);

  const clusterW = Math.max(bounds.maxX - bounds.minX, 96);
  const clusterH = Math.max(bounds.maxY - bounds.minY, 96);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const zoomX = (usableW * targetFill) / (clusterW + padding);
  const zoomY = (usableH * targetFill) / (clusterH + padding);
  let zoom = Math.min(zoomX, zoomY);
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

  return { centerX, centerY, zoom };
}

export function clampPointToCanvasBounds(
  point: Point,
  bounds: LayoutBounds,
  padding = 32,
): Point {
  return {
    x: Math.min(bounds.maxX - padding, Math.max(bounds.minX + padding, point.x)),
    y: Math.min(bounds.maxY - padding, Math.max(bounds.minY + padding, point.y)),
  };
}

export function detectLayoutOverlaps(
  positions: Record<string, Point>,
  minDistance = 72,
): [string, string][] {
  const ids = Object.keys(positions);
  const overlaps: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = positions[ids[i]!]!;
      const b = positions[ids[j]!]!;
      if (distanceBetween(a, b) < minDistance) {
        overlaps.push([ids[i]!, ids[j]!]);
      }
    }
  }
  return overlaps;
}

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

function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function resolveSimpleLabelCollisions(
  entries: LabelCollisionEntry[],
): Record<string, number> {
  const offsets: Record<string, number> = {};
  for (const entry of entries) offsets[entry.id] = 0;

  const sorted = [...entries].sort((a, b) => b.priority - a.priority);
  const placed: Box[] = [];

  for (const entry of sorted) {
    let offset = 0;
    let box = labelBox(entry.x, entry.y, offset);
    let guard = 0;
    while (placed.some((p) => boxesOverlap(p, box)) && guard < 24) {
      offset += 16;
      box = labelBox(entry.x, entry.y, offset);
      guard++;
    }
    offsets[entry.id] = offset;
    placed.push(box);
  }

  return offsets;
}

/** Past breadcrumb arc — tight, behind focus. */
export function computePastContextOrbit(
  count: number,
  center: Point,
  phaseSeed: string,
  orbitRadius = 72,
): Point[] {
  if (count <= 0) return [];
  const phase = stableHashToAngle(phaseSeed) + Math.PI * 0.9;
  return Array.from({ length: count }, (_, index) => {
    const angle = phase - (index + 1) * (Math.PI / (count + 3));
    const radius = orbitRadius + index * 14;
    return polarToCartesian(center, angle, radius);
  });
}

export function childrenOrbitCloserToParentThanCenter(
  parent: Point,
  constellationCenter: Point,
  childPositions: Point[],
): boolean {
  if (childPositions.length === 0) return true;
  return childPositions.every((child) => {
    return (
      distanceBetween(child, parent) <
      distanceBetween(child, constellationCenter) - 8
    );
  });
}

export function getNodeDepthScale(depthLevel: number): number {
  const depth = Math.max(1, Math.floor(depthLevel));
  if (depth <= 1) return 1;
  if (depth === 2) return 0.94;
  if (depth === 3) return 0.88;
  return Math.max(0.78, 0.88 - (depth - 3) * 0.05);
}

export type OrbitalVisualState =
  | "central_star"
  | "planet"
  | "satellite"
  | "canon_stable"
  | "weakened"
  | "rejected"
  | "archived_ghost"
  | "ripple_active";

export function getOrbitalVisualState(input: {
  role: "focused" | "path" | "direction" | "consequence";
  decision: "pending" | "accepted" | "rejected" | "saved";
  journeyPhase?: "past" | "current" | "future";
  weakened?: boolean;
  archived?: boolean;
  rippleActive?: boolean;
  isConstellationRoot?: boolean;
}): OrbitalVisualState {
  if (input.archived) return "archived_ghost";
  if (input.weakened) return "weakened";
  if (input.decision === "rejected") return "rejected";
  if (input.rippleActive) return "ripple_active";
  if (input.decision === "accepted") return "canon_stable";
  if (input.role === "focused" && input.isConstellationRoot) return "central_star";
  if (input.role === "focused") return "planet";
  if (
    input.journeyPhase === "future" ||
    input.role === "direction" ||
    input.role === "consequence"
  ) {
    return "satellite";
  }
  return "planet";
}

export function getOrbitRingRadii(
  childCount: number,
  baseRadius: number,
  radiusStep: number,
): number[] {
  if (childCount <= 0) return [];
  const rings = Math.floor((childCount - 1) / ORBIT_RING_CAPACITY) + 1;
  return Array.from({ length: rings }, (_, ring) =>
    computeOrbitRadius(
      Math.min((ring + 1) * ORBIT_RING_CAPACITY - 1, childCount - 1),
      baseRadius,
      radiusStep,
    ),
  );
}

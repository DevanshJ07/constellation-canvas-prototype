/**
 * Galaxy Canvas v2 — pure deterministic layout (mock prototype).
 * No React Flow, no backend, no randomness.
 */

export type Point = { x: number; y: number };

export type CanvasSize = {
  width: number;
  height: number;
  padding?: number;
  /** Right detail panel width — reduces usable canvas on the right */
  panelInset?: number;
};

export type LayoutBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type OrbitNodeLayout = {
  id: string;
  position: Point;
  angle: number;
  radius: number;
};

export type LabelPlacement = {
  id: string;
  x: number;
  y: number;
  offsetY: number;
};

/** Layout tuning — exported for tests and renderer */
export const RIGHT_PANEL_SAFE_MARGIN = 48;
export const MIN_NODE_DISTANCE = 44;
export const LABEL_PADDING = 10;
export const CONSTELLATION_CLUSTER_OFFSET_FRACTION = 0.14;

const PLANET_RING_FRACTION = 0.38;
const MOON_RING_FRACTION = 0.19;
const PLANET_ALT_ORBIT_BUMP = 22;
const MOON_ALT_ORBIT_BUMP = 14;
const LABEL_H = 24;
const LABEL_W_EST = 148;
const MOON_LABEL_OUTWARD_PUSH = 38;

function stableHashToAngle(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % 360) * Math.PI) / 180;
}

function polarToCartesian(center: Point, angle: number, radius: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function computeReadableBounds(canvas: CanvasSize): LayoutBounds {
  const pad = canvas.padding ?? 48;
  const panelReserve = (canvas.panelInset ?? 0) + RIGHT_PANEL_SAFE_MARGIN;
  return {
    minX: pad,
    maxX: canvas.width - pad - panelReserve,
    minY: pad,
    maxY: canvas.height - pad,
  };
}

/**
 * Center of the active cluster in usable canvas space.
 * When the right panel is open, shifts ~12–18% left of geometric center.
 */
export function computeGalaxyClusterCenter(canvas: CanvasSize): Point {
  const pad = canvas.padding ?? 48;
  const panelInset = canvas.panelInset ?? 0;
  const bounds = computeReadableBounds(canvas);
  const usableW = bounds.maxX - bounds.minX;
  const usableH = bounds.maxY - bounds.minY;

  const extraLeft =
    panelInset > 0 ? usableW * CONSTELLATION_CLUSTER_OFFSET_FRACTION : 0;

  return {
    x: bounds.minX + usableW / 2 - extraLeft,
    y: pad + usableH / 2,
  };
}

/** @deprecated Prefer computeGalaxyClusterCenter for panel-aware layouts */
export function computeCanvasCenter(canvas: CanvasSize): Point {
  return computeGalaxyClusterCenter(canvas);
}

export function computePlanetOrbitRadius(canvas: CanvasSize): number {
  const bounds = computeReadableBounds(canvas);
  const usableW = bounds.maxX - bounds.minX;
  const usableH = bounds.maxY - bounds.minY;
  return Math.min(usableW, usableH) * PLANET_RING_FRACTION;
}

export function computeMoonOrbitRadius(canvas: CanvasSize): number {
  const bounds = computeReadableBounds(canvas);
  const usableW = bounds.maxX - bounds.minX;
  const usableH = bounds.maxY - bounds.minY;
  return Math.min(usableW, usableH) * MOON_RING_FRACTION;
}

/**
 * Even planet ring around the sun.
 * 1 → upper-right, 2 → opposite pair, 3–7 → even 360° distribution.
 */
export function computePlanetOrbitPositions(
  ids: string[],
  center: Point,
  canvas: CanvasSize,
  phaseSeed = "memory-economy",
): OrbitNodeLayout[] {
  const count = ids.length;
  if (count === 0) return [];

  const radius = computePlanetOrbitRadius(canvas);
  const phase = stableHashToAngle(phaseSeed) * 0.08;

  if (count === 1) {
    const angle = phase - Math.PI / 4;
    return [{
      id: ids[0]!,
      position: polarToCartesian(center, angle, radius),
      angle,
      radius,
    }];
  }

  if (count === 2) {
    return ids.map((id, i) => {
      const angle = phase - Math.PI / 4 + i * Math.PI;
      return {
        id,
        position: polarToCartesian(center, angle, radius),
        angle,
        radius,
      };
    });
  }

  return ids.map((id, index) => {
    const angle = phase - Math.PI / 2 + (index * 2 * Math.PI) / count;
    const r = radius + (index % 2) * PLANET_ALT_ORBIT_BUMP;
    return {
      id,
      position: polarToCartesian(center, angle, r),
      angle,
      radius: r,
    };
  });
}

/**
 * Moons orbit the selected planet — always tighter than the planet ring.
 */
export function computeMoonOrbitPositions(
  ids: string[],
  parent: Point,
  sun: Point,
  canvas: CanvasSize,
  phaseSeed: string,
): OrbitNodeLayout[] {
  const count = ids.length;
  if (count === 0) return [];

  const maxMoonRadius = computeMoonOrbitRadius(canvas);
  const distToSun = distance(parent, sun);
  const bounds = computeReadableBounds(canvas);
  const edgeMargin = 24;
  const boundsLimit = Math.min(
    parent.x - bounds.minX - edgeMargin,
    bounds.maxX - parent.x - edgeMargin,
    parent.y - bounds.minY - edgeMargin,
    bounds.maxY - parent.y - edgeMargin,
  );
  const moonRadius = Math.min(maxMoonRadius, distToSun * 0.58, Math.max(48, boundsLimit));
  const phase = stableHashToAngle(phaseSeed) * 0.1;

  if (count === 1) {
    const angle = phase - Math.PI / 4;
    return [{
      id: ids[0]!,
      position: polarToCartesian(parent, angle, moonRadius),
      angle,
      radius: moonRadius,
    }];
  }

  if (count === 2) {
    return ids.map((id, i) => {
      const angle = phase - Math.PI / 4 + i * Math.PI;
      return {
        id,
        position: polarToCartesian(parent, angle, moonRadius),
        angle,
        radius: moonRadius,
      };
    });
  }

  return ids.map((id, index) => {
    const angle = phase - Math.PI / 2 + (index * 2 * Math.PI) / count;
    const r = Math.min(moonRadius + (index % 2) * MOON_ALT_ORBIT_BUMP, boundsLimit);
    return {
      id,
      position: polarToCartesian(parent, angle, r),
      angle,
      radius: r,
    };
  });
}

export type OverlapPair = [string, string];

/** Detect node center overlaps below minDistance. */
export function detectOverlap(
  nodes: { id: string; position: Point; hitRadius?: number }[],
  minDistance = MIN_NODE_DISTANCE,
): OverlapPair[] {
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const needed =
        minDistance + (a.hitRadius ?? 0) + (b.hitRadius ?? 0);
      if (distance(a.position, b.position) < needed) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  return pairs;
}

/** Simple label stacking to avoid overlap. Higher priority wins. */
export function resolveLabelPlacements(
  nodes: { id: string; position: Point; priority: number; labelBelow?: number }[],
): Record<string, LabelPlacement> {
  const result: Record<string, LabelPlacement> = {};
  const sorted = [...nodes].sort((a, b) => b.priority - a.priority);
  const placed: { left: number; right: number; top: number; bottom: number }[] = [];

  for (const node of sorted) {
    const baseBelow = node.labelBelow ?? 28;
    let offsetY = 0;
    let guard = 0;

    while (guard < 20) {
      const x = node.position.x;
      const y = node.position.y + baseBelow + offsetY;
      const box = {
        left: x - LABEL_W_EST / 2,
        right: x + LABEL_W_EST / 2,
        top: y,
        bottom: y + LABEL_H,
      };
      const hit = placed.some(
        (p) =>
          box.left < p.right &&
          box.right > p.left &&
          box.top < p.bottom &&
          box.bottom > p.top,
      );
      if (!hit) {
        result[node.id] = { id: node.id, x, y, offsetY };
        placed.push(box);
        break;
      }
      offsetY += 22;
      guard++;
    }

    if (!result[node.id]) {
      result[node.id] = {
        id: node.id,
        x: node.position.x,
        y: node.position.y + baseBelow,
        offsetY: 0,
      };
    }
  }

  return result;
}

type ExclusionZone = { left: number; right: number; top: number; bottom: number };

function boxOverlapsExclusion(
  box: ExclusionZone,
  zone: ExclusionZone,
): boolean {
  return (
    box.left < zone.right &&
    box.right > zone.left &&
    box.top < zone.bottom &&
    box.bottom > zone.top
  );
}

/** Push moon labels outward from parent and resolve collisions. */
export function resolveMoonLabelPlacements(
  moonLayouts: OrbitNodeLayout[],
  parent: Point,
  options: {
    outwardPush?: number;
    parentExclusionRadius?: number;
    placedBoxes?: ExclusionZone[];
  } = {},
): Record<string, LabelPlacement> {
  const push = options.outwardPush ?? MOON_LABEL_OUTWARD_PUSH;
  const exclusionR = options.parentExclusionRadius ?? 44;
  const parentZone: ExclusionZone = {
    left: parent.x - exclusionR,
    right: parent.x + exclusionR,
    top: parent.y - exclusionR,
    bottom: parent.y + exclusionR,
  };

  const result: Record<string, LabelPlacement> = {};
  const placed: ExclusionZone[] = [...(options.placedBoxes ?? [])];

  const sorted = [...moonLayouts].sort((a, b) => a.angle - b.angle);

  for (const moon of sorted) {
    const dx = moon.position.x - parent.x;
    const dy = moon.position.y - parent.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    let radialPush = push;
    let tangential = 0;
    let guard = 0;

    while (guard < 16) {
      const anchorX = moon.position.x + ux * radialPush + (-uy) * tangential;
      const anchorY = moon.position.y + uy * radialPush + ux * tangential;
      const labelY = anchorY + 10;
      const box: ExclusionZone = {
        left: anchorX - LABEL_W_EST / 2,
        right: anchorX + LABEL_W_EST / 2,
        top: labelY - 2,
        bottom: labelY + LABEL_H,
      };

      const hitsLabel = placed.some((p) => boxOverlapsExclusion(box, p));
      const hitsParent = boxOverlapsExclusion(box, parentZone);

      if (!hitsLabel && !hitsParent) {
        result[moon.id] = {
          id: moon.id,
          x: anchorX,
          y: labelY,
          offsetY: radialPush,
        };
        placed.push(box);
        break;
      }

      if (guard % 2 === 0) radialPush += 12;
      else tangential += (guard % 4 === 1 ? 1 : -1) * 16;
      guard++;
    }

    if (!result[moon.id]) {
      const anchorX = moon.position.x + ux * (push + 20);
      const anchorY = moon.position.y + uy * (push + 20);
      result[moon.id] = {
        id: moon.id,
        x: anchorX,
        y: anchorY + 10,
        offsetY: push + 20,
      };
    }
  }

  return result;
}

/** Collect label bounding boxes from planet label placements for moon collision pass. */
export function labelPlacementsToExclusionBoxes(
  placements: Record<string, LabelPlacement>,
  textLengths: Record<string, number>,
  widthPerChar = 5.8,
): ExclusionZone[] {
  return Object.entries(placements).map(([id, p]) => {
    const w = Math.min((textLengths[id] ?? 12) * widthPerChar + 16, 160);
    return {
      left: p.x - w / 2,
      right: p.x + w / 2,
      top: p.y - 2,
      bottom: p.y + LABEL_H,
    };
  });
}

/** Quadratic bezier arc from parent to child for orbit-link visuals. */
export function computeOrbitArcPath(
  from: Point,
  to: Point,
  bulge = 0.18,
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * len * bulge;
  const cy = my + ny * len * bulge;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

export function allPointsInsideBounds(
  points: Point[],
  bounds: LayoutBounds,
  margin = 24,
): boolean {
  return points.every(
    (p) =>
      p.x >= bounds.minX + margin &&
      p.x <= bounds.maxX - margin &&
      p.y >= bounds.minY + margin &&
      p.y <= bounds.maxY - margin,
  );
}

export function moonsCloserToPlanetThanSun(
  moons: Point[],
  parent: Point,
  sun: Point,
): boolean {
  return moons.every(
    (m) => distance(m, parent) < distance(m, sun) - 12,
  );
}

/** Max auto-fit zoom when framing a node selection — preserves sibling context. */
export const GALAXY_NODE_SELECT_MAX_ZOOM = 1.25;
export const GALAXY_VIEWPORT_MIN_ZOOM = 0.75;
export const GALAXY_VIEWPORT_MAX_ZOOM = 1.35;

export function computeGalaxyClusterBounds(
  center: Point,
  primaryPositions: Point[],
  moonPositions: Point[] = [],
  padding = 52,
): LayoutBounds {
  const points = [center, ...primaryPositions, ...moonPositions];
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
  };
}

/** Fit zoom for galaxy cluster — capped so node-only framing cannot over-zoom. */
export function computeGalaxyFitZoom(
  bounds: LayoutBounds,
  canvas: CanvasSize,
  options: { maxZoom?: number; targetFill?: number } = {},
): number {
  const maxZoom = options.maxZoom ?? GALAXY_NODE_SELECT_MAX_ZOOM;
  const targetFill = options.targetFill ?? 0.88;
  const readable = computeReadableBounds(canvas);
  const usableW = readable.maxX - readable.minX;
  const usableH = readable.maxY - readable.minY;
  const clusterW = Math.max(bounds.maxX - bounds.minX, 120);
  const clusterH = Math.max(bounds.maxY - bounds.minY, 120);
  const zoomX = (usableW * targetFill) / clusterW;
  const zoomY = (usableH * targetFill) / clusterH;
  const zoom = Math.min(zoomX, zoomY);
  return Math.max(GALAXY_VIEWPORT_MIN_ZOOM, Math.min(maxZoom, zoom));
}

/**
 * Orbital layout — re-exports worldBrain layout with legacy aliases.
 */

import type { CanvasDimensions, Point } from "@/lib/worldBrain/orbitalLayout";
import {
  computeConstellationOrbitLayout,
  computeSatelliteOrbitLayout,
  computeOrbitPositions,
  computePastContextOrbit,
  computeSafeLayoutBounds,
  computeWorldGalaxyLayout,
  childrenOrbitCloserToParentThanCenter,
  getNodeDepthScale,
  getOrbitalVisualState,
  getOrbitRingRadii,
  clampPointToCanvasBounds,
  detectLayoutOverlaps,
  resolveSimpleLabelCollisions,
  stableHashToAngle,
  ORBIT_RING_CAPACITY,
  GOLDEN_ANGLE,
  GALAXY_NODE_FOOTPRINT,
  READABLE_ZOOM_MIN,
  READABLE_ZOOM_MAX,
} from "@/lib/worldBrain/orbitalLayout";

export * from "@/lib/worldBrain/orbitalLayout";

const DEFAULT_CANVAS: CanvasDimensions = {
  width: 1280,
  height: 800,
  sidebarWidth: 176,
  panelInset: 0,
};

export type LayoutBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type OrbitCenter = Point;

export type OrbitalLayoutOptions = {
  center?: Point;
  baseRadius?: number;
  radiusStep?: number;
  ringCapacity?: number;
  phaseSeed?: string;
  depthLevel?: number;
  canvas?: CanvasDimensions;
};

/** @deprecated use computeSafeLayoutBounds(canvas) */
export const DISCOVERY_LAYOUT_BOUNDS: LayoutBounds = computeSafeLayoutBounds(DEFAULT_CANVAS);

export const CONSTELLATION_ORBIT_BASE_RADIUS = 200;
export const CONSTELLATION_ORBIT_RADIUS_STEP = 28;
export const SATELLITE_ORBIT_BASE_RADIUS = 130;
export const SATELLITE_ORBIT_RADIUS_STEP = 18;
export const SATELLITE_MIN_PARENT_DISTANCE = 88;

export function computeOrbitalChildren(
  count: number,
  center: Point = { x: 0, y: 0 },
  options: {
    baseRadius?: number;
    radiusStep?: number;
    startAngle?: number;
    phaseSeed?: string;
    canvas?: CanvasDimensions;
  } = {},
): Point[] {
  return computeOrbitPositions(count, center, {
    baseRadius: options.baseRadius,
    radiusStep: options.radiusStep,
    phaseSeed: options.phaseSeed,
  });
}

export function computeMultiRingOrbitalPositions(
  count: number,
  options: OrbitalLayoutOptions = {},
): Point[] {
  const canvas = options.canvas ?? DEFAULT_CANVAS;
  const center = options.center ?? { x: 0, y: 0 };
  return computeOrbitPositions(count, center, {
    baseRadius: options.baseRadius,
    radiusStep: options.radiusStep,
    ringCapacity: options.ringCapacity,
    phaseSeed: options.phaseSeed,
    depthLevel: options.depthLevel,
  });
}

export function computeConstellationGalaxyLayout(
  count: number,
  options: OrbitalLayoutOptions = {},
): Point[] {
  const canvas = options.canvas ?? DEFAULT_CANVAS;
  return computeConstellationOrbitLayout(count, canvas, options);
}

export function computeSatelliteNodeLayout(
  count: number,
  options: OrbitalLayoutOptions = {},
): Point[] {
  const canvas = options.canvas ?? DEFAULT_CANVAS;
  const center = options.center ?? { x: 0, y: 0 };
  return computeSatelliteOrbitLayout(count, center, canvas, options);
}

export function computeInnerSatelliteLayout(
  count: number,
  options: OrbitalLayoutOptions = {},
): Point[] {
  const canvas = options.canvas ?? DEFAULT_CANVAS;
  const center = options.center ?? { x: 0, y: 0 };
  return computeSatelliteOrbitLayout(count, center, canvas, {
    ...options,
    depthLevel: (options.depthLevel ?? 2) + 1,
    baseRadius: options.baseRadius
      ? options.baseRadius * 0.82
      : undefined,
  });
}

export type SatelliteLayoutParams = {
  parentPosition: Point;
  childIds: string[];
  parentNodeId?: string;
  depthLevel?: number;
  existingPositions?: Record<string, Point>;
  minParentDistance?: number;
  minSiblingDistance?: number;
  canvas?: CanvasDimensions;
};

export function layoutSatellitesAroundParent(
  params: SatelliteLayoutParams,
): Record<string, Point> {
  const {
    parentPosition,
    childIds,
    parentNodeId = "",
    depthLevel = 2,
    existingPositions = {},
    minParentDistance = SATELLITE_MIN_PARENT_DISTANCE,
    minSiblingDistance = 68,
    canvas = DEFAULT_CANVAS,
  } = params;

  if (childIds.length === 0) return {};

  const basePositions = computeSatelliteOrbitLayout(
    childIds.length,
    parentPosition,
    canvas,
    { phaseSeed: parentNodeId, depthLevel },
  );

  const positions: Record<string, Point> = {};
  const placed: Point[] = Object.values(existingPositions);

  childIds.forEach((childId, index) => {
    let point = basePositions[index] ?? parentPosition;

    if (Math.hypot(point.x - parentPosition.x, point.y - parentPosition.y) < minParentDistance) {
      const phase = parentNodeId ? stableHashToAngle(parentNodeId) : 0;
      point = {
        x: parentPosition.x + Math.cos(phase) * minParentDistance,
        y: parentPosition.y + Math.sin(phase) * minParentDistance,
      };
    }

    let guard = 0;
    while (
      placed.some((p) => Math.hypot(point.x - p.x, point.y - p.y) < minSiblingDistance) &&
      guard < 10
    ) {
      const angle = stableHashToAngle(`${parentNodeId}_${index}`) + guard * 0.2;
      const radius = minParentDistance + guard * 14;
      point = {
        x: parentPosition.x + Math.cos(angle) * radius,
        y: parentPosition.y + Math.sin(angle) * radius,
      };
      guard++;
    }

    positions[childId] = point;
    placed.push(point);
  });

  return positions;
}

export function clampToCanvasBounds(
  point: Point,
  bounds: LayoutBounds = DISCOVERY_LAYOUT_BOUNDS,
  padding = 24,
): Point {
  return clampPointToCanvasBounds(point, bounds, padding);
}

export {
  computeWorldGalaxyLayout,
  childrenOrbitCloserToParentThanCenter,
  getNodeDepthScale,
  getOrbitalVisualState,
  getOrbitRingRadii,
  detectLayoutOverlaps,
  resolveSimpleLabelCollisions,
};

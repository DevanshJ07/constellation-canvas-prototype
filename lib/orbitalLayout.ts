/**
 * Orbital galaxy layout — deterministic spatial hierarchy (Phase 6B).
 * Pure functions only; no React, no canvas mutation.
 */

/** Golden angle spiral constant (~137.5°). */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function stableHashToAngle(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ((hash % 360) * Math.PI) / 180;
}

export { stableHashToAngle };

export type LayoutBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** Default safe area for local constellation exploration (React Flow coords). */
export const DISCOVERY_LAYOUT_BOUNDS: LayoutBounds = {
  minX: -400,
  maxX: 360,
  minY: -240,
  maxY: 200,
};

/** Children per orbit ring before opening the next ring. */
export const ORBIT_RING_CAPACITY = 8;

/** Constellation-level orbit (planets around sun). */
export const CONSTELLATION_ORBIT_BASE_RADIUS = 200;
export const CONSTELLATION_ORBIT_RADIUS_STEP = 38;

/** Satellite-level orbit (moons around planet). */
export const SATELLITE_ORBIT_BASE_RADIUS = 130;
export const SATELLITE_ORBIT_RADIUS_STEP = 22;
export const SATELLITE_MIN_PARENT_DISTANCE = 105;

/** Past context arc — faded breadcrumb nodes. */
export const PAST_CONTEXT_ORBIT_RADIUS = 95;

export type OrbitCenter = { x: number; y: number };

export type OrbitalLayoutOptions = {
  center?: OrbitCenter;
  baseRadius?: number;
  radiusStep?: number;
  ringCapacity?: number;
  phaseSeed?: string;
  /** 1 = constellation sun, 2+ = deeper exploration */
  depthLevel?: number;
};

export type OrbitalVisualState =
  | "central_star"
  | "planet"
  | "satellite"
  | "canon_stable"
  | "weakened"
  | "rejected"
  | "archived_ghost"
  | "ripple_active";

export function getNodeOrbitLevel(index: number, ringCapacity = ORBIT_RING_CAPACITY): number {
  return Math.floor(index / ringCapacity);
}

export function computeOrbitRadius(
  index: number,
  baseRadius: number,
  radiusStep: number,
  ringCapacity = ORBIT_RING_CAPACITY,
): number {
  const ring = getNodeOrbitLevel(index, ringCapacity);
  const indexInRing = index % ringCapacity;
  const ringBoost = ring * (baseRadius * 0.55 + radiusStep * 2);
  const inRingRadius =
    baseRadius * (indexInRing === 0 && ring === 0 ? 0.82 : 1) + indexInRing * radiusStep;
  return ringBoost + inRingRadius;
}

export function computeOrbitAngle(
  index: number,
  phase: number,
  ringCapacity = ORBIT_RING_CAPACITY,
): number {
  const ring = getNodeOrbitLevel(index, ringCapacity);
  const indexInRing = index % ringCapacity;
  const ringPhase = ring * (Math.PI / 6);
  return phase + ringPhase + indexInRing * GOLDEN_ANGLE;
}

export function getNodeDepthScale(depthLevel: number): number {
  const depth = Math.max(1, Math.floor(depthLevel));
  if (depth <= 1) return 1;
  if (depth === 2) return 0.92;
  if (depth === 3) return 0.84;
  return Math.max(0.72, 0.84 - (depth - 3) * 0.06);
}

function polarToCartesian(
  center: OrbitCenter,
  angle: number,
  radius: number,
): { x: number; y: number } {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function distanceBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Multi-ring golden-angle positions around a center point. */
export function computeMultiRingOrbitalPositions(
  count: number,
  options: OrbitalLayoutOptions = {},
): { x: number; y: number }[] {
  if (count <= 0) return [];

  const center = options.center ?? { x: 0, y: 0 };
  const baseRadius = options.baseRadius ?? CONSTELLATION_ORBIT_BASE_RADIUS;
  const radiusStep = options.radiusStep ?? CONSTELLATION_ORBIT_RADIUS_STEP;
  const ringCapacity = options.ringCapacity ?? ORBIT_RING_CAPACITY;
  const depthLevel = options.depthLevel ?? 1;
  const depthScale = getNodeDepthScale(depthLevel);
  const phase = options.phaseSeed ? stableHashToAngle(options.phaseSeed) : 0;

  const scaledBase = baseRadius * depthScale;
  const scaledStep = radiusStep * depthScale;

  // Solar-system placement: stable, readable rings around the focus (sun/planet).
  if (count === 1) {
    // Single planet/moon: upper-right orbit (not random).
    return [polarToCartesian(center, phase - Math.PI / 4, scaledBase * 0.92)];
  }
  if (count === 2) {
    // Diagonal pair — visually balanced.
    return [
      polarToCartesian(center, phase - Math.PI / 4, scaledBase * 0.92),
      polarToCartesian(center, phase + (3 * Math.PI) / 4, scaledBase * 0.92),
    ];
  }
  if (count <= 6) {
    // Even ring spacing for small planet sets.
    return Array.from({ length: count }, (_, index) => {
      const angle = phase - Math.PI / 2 + (index * 2 * Math.PI) / count;
      return polarToCartesian(center, angle, scaledBase);
    });
  }

  return Array.from({ length: count }, (_, index) => {
    const angle = computeOrbitAngle(index, phase, ringCapacity);
    const radius = computeOrbitRadius(index, scaledBase, scaledStep, ringCapacity);
    return polarToCartesian(center, angle, radius);
  });
}

/** Constellation view — planets orbiting the central sun/head node. */
export function computeConstellationGalaxyLayout(
  count: number,
  options: OrbitalLayoutOptions = {},
): { x: number; y: number }[] {
  return computeMultiRingOrbitalPositions(count, {
    baseRadius: CONSTELLATION_ORBIT_BASE_RADIUS,
    radiusStep: CONSTELLATION_ORBIT_RADIUS_STEP,
    depthLevel: 1,
    ...options,
  });
}

/** Node exploration — moons/satellites orbiting selected parent. */
export function computeSatelliteNodeLayout(
  count: number,
  options: OrbitalLayoutOptions = {},
): { x: number; y: number }[] {
  return computeMultiRingOrbitalPositions(count, {
    baseRadius: SATELLITE_ORBIT_BASE_RADIUS,
    radiusStep: SATELLITE_ORBIT_RADIUS_STEP,
    depthLevel: options.depthLevel ?? 2,
    ...options,
  });
}

export type SatelliteLayoutParams = {
  parentPosition: OrbitCenter;
  childIds: string[];
  parentNodeId?: string;
  depthLevel?: number;
  existingPositions?: Record<string, { x: number; y: number }>;
  minParentDistance?: number;
  minSiblingDistance?: number;
};

/** Inner moon ring — tighter orbit for node-reasoner children. */
export function computeInnerSatelliteLayout(
  count: number,
  options: OrbitalLayoutOptions = {},
): { x: number; y: number }[] {
  return computeMultiRingOrbitalPositions(count, {
    baseRadius: SATELLITE_ORBIT_BASE_RADIUS * 0.78,
    radiusStep: SATELLITE_ORBIT_RADIUS_STEP * 0.85,
    depthLevel: (options.depthLevel ?? 2) + 1,
    ...options,
  });
}

/** Verify children orbit their parent, not a distant constellation center. */
export function childrenOrbitCloserToParentThanCenter(
  parent: OrbitCenter,
  constellationCenter: OrbitCenter,
  childPositions: { x: number; y: number }[],
): boolean {
  if (childPositions.length === 0) return true;
  const distToConstellation = distanceBetween(parent, constellationCenter);
  return childPositions.every((child) => {
    const toParent = distanceBetween(child, parent);
    const toConstellation = distanceBetween(child, constellationCenter);
    return toParent < toConstellation;
  });
}

export function layoutSatellitesAroundParent(
  params: SatelliteLayoutParams,
): Record<string, { x: number; y: number }> {
  const {
    parentPosition,
    childIds,
    parentNodeId = "",
    depthLevel = 2,
    existingPositions = {},
    minParentDistance = SATELLITE_MIN_PARENT_DISTANCE,
    minSiblingDistance = 68,
  } = params;

  if (childIds.length === 0) return {};

  const phase = parentNodeId ? stableHashToAngle(parentNodeId) : 0;
  const basePositions = computeSatelliteNodeLayout(childIds.length, {
    center: parentPosition,
    phaseSeed: parentNodeId,
    depthLevel,
  });

  const positions: Record<string, { x: number; y: number }> = {};
  const placed: { x: number; y: number }[] = Object.values(existingPositions);

  childIds.forEach((childId, index) => {
    let point = basePositions[index] ?? parentPosition;

    if (distanceBetween(point, parentPosition) < minParentDistance) {
      const angle = computeOrbitAngle(index, phase);
      point = polarToCartesian(parentPosition, angle, minParentDistance);
    }

    let guard = 0;
    while (
      placed.some((p) => distanceBetween(point, p) < minSiblingDistance) &&
      guard < 10
    ) {
      const angle = computeOrbitAngle(index, phase) + guard * 0.15;
      const radius =
        computeOrbitRadius(
          index,
          SATELLITE_ORBIT_BASE_RADIUS * getNodeDepthScale(depthLevel),
          SATELLITE_ORBIT_RADIUS_STEP,
        ) +
        guard * 12;
      point = polarToCartesian(parentPosition, angle, radius);
      guard++;
    }

    positions[childId] = point;
    placed.push(point);
  });

  return positions;
}

/** Past trail nodes — partial arc behind the current focus. */
export function computePastContextOrbit(
  count: number,
  center: OrbitCenter,
  phaseSeed: string,
): { x: number; y: number }[] {
  if (count <= 0) return [];
  const phase = stableHashToAngle(phaseSeed) + Math.PI * 0.85;
  return Array.from({ length: count }, (_, index) => {
    const angle = phase - (index + 1) * (Math.PI / (count + 2));
    const radius = PAST_CONTEXT_ORBIT_RADIUS + index * 18;
    return polarToCartesian(center, angle, radius);
  });
}

export function clampToCanvasBounds(
  point: { x: number; y: number },
  bounds: LayoutBounds = DISCOVERY_LAYOUT_BOUNDS,
  padding = 24,
): { x: number; y: number } {
  return {
    x: Math.min(bounds.maxX - padding, Math.max(bounds.minX + padding, point.x)),
    y: Math.min(bounds.maxY - padding, Math.max(bounds.minY + padding, point.y)),
  };
}

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
  if (input.journeyPhase === "future" || input.role === "direction" || input.role === "consequence") {
    return "satellite";
  }
  return "planet";
}

/** Decorative orbit ring radii for visual hints (non-interactive). */
export function getOrbitRingRadii(
  childCount: number,
  baseRadius: number,
  radiusStep: number,
): number[] {
  if (childCount <= 0) return [];
  const rings = getNodeOrbitLevel(childCount - 1) + 1;
  return Array.from({ length: rings }, (_, ring) => {
    const lastIndexInRing = Math.min(
      (ring + 1) * ORBIT_RING_CAPACITY - 1,
      childCount - 1,
    );
    return computeOrbitRadius(lastIndexInRing, baseRadius, radiusStep);
  });
}

/**
 * Orbital layout tests (Phase 6B) — no network.
 */

import {
  computeConstellationGalaxyLayout,
  computeInnerSatelliteLayout,
  computeMultiRingOrbitalPositions,
  computeSatelliteNodeLayout,
  childrenOrbitCloserToParentThanCenter,
  getNodeDepthScale,
  getNodeOrbitLevel,
  getOrbitalVisualState,
  getOrbitRingRadii,
  layoutSatellitesAroundParent,
  ORBIT_RING_CAPACITY,
  SATELLITE_MIN_PARENT_DISTANCE,
  DISCOVERY_LAYOUT_BOUNDS,
} from "../lib/orbitalLayout.ts";
import { fitLayoutToBounds } from "../lib/graphLayout.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

console.log("=== Orbital layout (no network) ===\n");

const parent = { x: 0, y: 0 };
const childIds = Array.from({ length: 10 }, (_, i) => `child_${i + 1}`);

const satellitePositions = layoutSatellitesAroundParent({
  parentPosition: parent,
  parentNodeId: "parent_alpha",
  childIds,
  depthLevel: 2,
});

const coords = Object.values(satellitePositions);
assert(coords.length === 10, "expected 10 satellite positions");

for (const pos of coords) {
  assert(
    distance(pos, parent) >= SATELLITE_MIN_PARENT_DISTANCE - 0.01,
    "satellite too close to parent",
  );
}

for (let i = 0; i < coords.length; i++) {
  for (let j = i + 1; j < coords.length; j++) {
    assert(distance(coords[i], coords[j]) > 40, "satellites overlap too closely");
  }
}

const repeat = layoutSatellitesAroundParent({
  parentPosition: parent,
  parentNodeId: "parent_alpha",
  childIds,
  depthLevel: 2,
});
assert(
  JSON.stringify(satellitePositions) === JSON.stringify(repeat),
  "satellite layout must be deterministic",
);

assert(getNodeOrbitLevel(7) === 0, "index 7 should be ring 0");
assert(getNodeOrbitLevel(8) === 1, "index 8 should activate second ring");

const ringRadii = getOrbitRingRadii(10, 130, 22);
assert(ringRadii.length >= 2, "second ring should activate when count exceeds threshold");

const constellation = computeConstellationGalaxyLayout(6, {
  center: { x: -110, y: 0 },
  phaseSeed: "constellation_memory",
});
const satellites = computeSatelliteNodeLayout(6, {
  center: { x: 0, y: 0 },
  phaseSeed: "node_parent",
  depthLevel: 3,
});
const avgConstellationDist =
  constellation.reduce((sum, p) => sum + distance(p, { x: -110, y: 0 }), 0) /
  constellation.length;
const avgSatelliteDist =
  satellites.reduce((sum, p) => sum + distance(p, { x: 0, y: 0 }), 0) / satellites.length;
assert(
  avgSatelliteDist < avgConstellationDist,
  "satellite orbits should be tighter than constellation orbits",
);

const fitted = fitLayoutToBounds(
  Object.fromEntries(
    computeMultiRingOrbitalPositions(8, { center: { x: 0, y: 0 } }).map((p, i) => [
      `n${i}`,
      p,
    ]),
  ),
  DISCOVERY_LAYOUT_BOUNDS,
  { padding: 32 },
);
for (const p of Object.values(fitted)) {
  assert(p.x >= DISCOVERY_LAYOUT_BOUNDS.minX, "fitted x below min bound");
  assert(p.x <= DISCOVERY_LAYOUT_BOUNDS.maxX, "fitted x above max bound");
  assert(p.y >= DISCOVERY_LAYOUT_BOUNDS.minY, "fitted y below min bound");
  assert(p.y <= DISCOVERY_LAYOUT_BOUNDS.maxY, "fitted y above max bound");
}

assert(getNodeDepthScale(1) > getNodeDepthScale(4), "deeper nodes should scale smaller");
assert(
  getOrbitalVisualState({
    role: "focused",
    decision: "accepted",
    isConstellationRoot: true,
  }) === "canon_stable",
  "accepted constellation root maps to canon_stable",
);
assert(
  getOrbitalVisualState({ role: "direction", decision: "pending", journeyPhase: "future" }) ===
    "satellite",
  "future direction maps to satellite",
);
assert(
  getOrbitalVisualState({ role: "path", decision: "rejected", journeyPhase: "past" }) ===
    "rejected",
  "rejected maps correctly",
);

const threePlanets = computeConstellationGalaxyLayout(3, {
  center: { x: 0, y: 0 },
  phaseSeed: "test_three",
});
assert(threePlanets.length === 3, "three planets layout");
for (let i = 0; i < threePlanets.length; i++) {
  assert(distance(threePlanets[i], { x: 0, y: 0 }) > 150, "planets orbit away from sun");
}

const singlePlanet = computeConstellationGalaxyLayout(1, {
  center: { x: 0, y: 0 },
  phaseSeed: "test_single",
})[0];
assert(singlePlanet.x > 0 && singlePlanet.y < 0, "single planet placed upper-right of sun");

const constellationCenter = { x: -500, y: 0 };
const parentPlanet = { x: 0, y: 0 };
const moons = computeInnerSatelliteLayout(3, {
  center: parentPlanet,
  phaseSeed: "parent_moon",
  depthLevel: 3,
});
assert(
  childrenOrbitCloserToParentThanCenter(parentPlanet, constellationCenter, moons),
  "moons orbit parent, not distant constellation center",
);

console.log("avg constellation orbit:", Math.round(avgConstellationDist));
console.log("avg satellite orbit:", Math.round(avgSatelliteDist));
console.log("ring radii:", ringRadii.map((r) => Math.round(r)).join(", "));
console.log("\nAll orbital layout checks passed.");

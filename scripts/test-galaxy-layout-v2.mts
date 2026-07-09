/**
 * Galaxy Canvas v2 layout tests — no network.
 */

import {
  computeGalaxyClusterCenter,
  computeMoonOrbitPositions,
  computePlanetOrbitPositions,
  computeReadableBounds,
  detectOverlap,
  allPointsInsideBounds,
  moonsCloserToPlanetThanSun,
  resolveMoonLabelPlacements,
  resolveLabelPlacements,
  labelPlacementsToExclusionBoxes,
  computeGalaxyClusterBounds,
  computeGalaxyFitZoom,
  GALAXY_NODE_SELECT_MAX_ZOOM,
  MIN_NODE_DISTANCE,
} from "../lib/worldBrain/galaxyLayoutV2.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const CANVAS = { width: 1200, height: 720, padding: 44 };

const PLANET_IDS = [
  "memory-price-index",
  "debt-memories",
  "childhood-collateral",
  "black-market-brokers",
  "memory-tax-office",
  "identity-loans",
];

const MOON_IDS = ["grief-premium", "skill-crash", "ghost-spike", "index-watchers"];

console.log("=== Galaxy layout v2 (no network) ===\n");

const center = computeGalaxyClusterCenter(CANVAS);
const bounds = computeReadableBounds(CANVAS);

const panelCanvas = { ...CANVAS, panelInset: 380 };
const panelCenter = computeGalaxyClusterCenter(panelCanvas);
assert(panelCenter.x < center.x, "panel open shifts cluster center left");

const planets = computePlanetOrbitPositions(PLANET_IDS, center, CANVAS, "memory-economy");
assert(planets.length === 6, "six planets");

const planetAngles = planets.map((p) => p.angle).sort((a, b) => a - b);
for (let i = 1; i < planetAngles.length; i++) {
  const gap = planetAngles[i]! - planetAngles[i - 1]!;
  assert(gap > 0.4, "planets evenly spaced around ring");
}

const planetPositions = planets.map((p) => p.position);
assert(
  allPointsInsideBounds(planetPositions, bounds, 20),
  "all planets inside viewport bounds",
);

const overlaps = detectOverlap(
  planets.map((p) => ({ id: p.id, position: p.position, hitRadius: 22 })),
  MIN_NODE_DISTANCE - 10,
);
assert(overlaps.length === 0, "no severe planet overlap");

const selectedPlanet = planets[0]!;
const moons = computeMoonOrbitPositions(
  MOON_IDS,
  selectedPlanet.position,
  center,
  CANVAS,
  selectedPlanet.id,
);
assert(moons.length === 4, "four moons");

const moonPositions = moons.map((m) => m.position);
assert(
  moonsCloserToPlanetThanSun(moonPositions, selectedPlanet.position, center),
  "moons closer to planet than sun",
);
assert(
  allPointsInsideBounds(moonPositions, bounds, 12),
  "moons inside viewport bounds",
);

const moonOverlaps = detectOverlap(
  moons.map((m) => ({ id: m.id, position: m.position, hitRadius: 12 })),
  26,
);
assert(moonOverlaps.length <= 1, "moons have limited overlap");

const planetLabels = resolveLabelPlacements(
  planets.map((p) => ({
    id: p.id,
    position: p.position,
    priority: 50,
    labelBelow: 44,
  })),
);
const planetBoxes = labelPlacementsToExclusionBoxes(
  planetLabels,
  Object.fromEntries(PLANET_IDS.map((id) => [id, id.length])),
);
const moonLabels = resolveMoonLabelPlacements(moons, selectedPlanet.position, {
  placedBoxes: planetBoxes,
  parentExclusionRadius: 66,
});
assert(Object.keys(moonLabels).length === 4, "four moon labels placed");

const parentDistances = Object.values(moonLabels).map((l) =>
  Math.hypot(l.x - selectedPlanet.position.x, l.y - selectedPlanet.position.y),
);
assert(
  parentDistances.every((d) => d > 40),
  "moon labels pushed away from selected planet center",
);

const labelBoxes = Object.entries(moonLabels).map(([id, l]) => ({
  id,
  position: { x: l.x, y: l.y },
  hitRadius: 20,
}));
const labelOverlaps = detectOverlap(labelBoxes, 12);
assert(labelOverlaps.length <= 1, "moon labels avoid severe overlap");

const repeat = computePlanetOrbitPositions(PLANET_IDS, center, CANVAS, "memory-economy");
assert(
  JSON.stringify(planets) === JSON.stringify(repeat),
  "deterministic planet positions",
);

console.log("planet ring radius:", Math.round(planets[0]!.radius));
console.log("moon ring radius:", Math.round(moons[0]!.radius));
console.log("center:", center);

// Node selection viewport — must include sun, siblings, and cap zoom
const primaryPositions = planets.map((p) => p.position);
const boundsCluster = computeGalaxyClusterBounds(center, primaryPositions, moonPositions);
assert(boundsCluster.maxX - boundsCluster.minX > 200, "selection bounds include cluster width");
const fitZoom = computeGalaxyFitZoom(boundsCluster, CANVAS);
assert(fitZoom <= GALAXY_NODE_SELECT_MAX_ZOOM, "selection zoom capped for context");
assert(fitZoom >= 0.75, "selection zoom remains readable");

console.log("\nAll galaxy layout v2 checks passed.");

/**
 * Orbital layout tests (Phase 6B / 6E.2) — no network.
 */

import {
  computeWorldGalaxyLayout,
  computeConstellationOrbitLayout,
  computeSatelliteOrbitLayout,
  computeOrbitPositions,
  computeActiveClusterBounds,
  computeViewportForCluster,
  computeSafeLayoutBounds,
  detectLayoutOverlaps,
  resolveSimpleLabelCollisions,
  childrenOrbitCloserToParentThanCenter,
  computeOrbitRadiusFromCanvas,
  GALAXY_NODE_FOOTPRINT,
  WORLD_OVERVIEW_MIN_SEPARATION,
  READABLE_ZOOM_MIN,
  READABLE_ZOOM_MAX,
  type CanvasDimensions,
} from "../lib/worldBrain/orbitalLayout.ts";
import { layoutSatellitesAroundParent } from "../lib/orbitalLayout.ts";
import { computeUsableCanvasCenter } from "../lib/detailPanelLayout.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const CANVAS: CanvasDimensions = {
  width: 1440,
  height: 900,
  sidebarWidth: 176,
  panelInset: 0,
};

const CANVAS_WITH_PANEL: CanvasDimensions = {
  ...CANVAS,
  panelInset: 360,
};

console.log("=== Orbital layout (no network) ===\n");

const usableCenter = computeUsableCanvasCenter(1440, 900, 360);
assert(usableCenter.x > 176 && usableCenter.x < 1200, "usable canvas center excludes sidebar and panel");

const bounds = computeSafeLayoutBounds(CANVAS);
assert(bounds.maxX > 0 && bounds.minX < 0, "safe bounds centered on origin");

// World overview — 4 constellations
const fourIds = ["c1", "c2", "c3", "c4"];
const galaxy4 = computeWorldGalaxyLayout(fourIds, CANVAS);
assert(Object.keys(galaxy4).length === 4, "four constellation positions");
for (const id of fourIds) {
  const p = galaxy4[id]!;
  const cx = p.x + GALAXY_NODE_FOOTPRINT.width / 2;
  const cy = p.y + GALAXY_NODE_FOOTPRINT.height / 2;
  assert(Math.abs(cx) < bounds.maxX + 40, `${id} center x near bounds`);
  assert(Math.abs(cy) < bounds.maxY + 40, `${id} center y near bounds`);
}
const cluster4Bounds = computeActiveClusterBounds(galaxy4, fourIds, GALAXY_NODE_FOOTPRINT);
const vp4 = computeViewportForCluster(cluster4Bounds, CANVAS);
assert(vp4.zoom >= READABLE_ZOOM_MIN, "4-constellation viewport zoom is readable");
assert(vp4.zoom <= READABLE_ZOOM_MAX + 0.01, "4-constellation viewport zoom not tiny");

// World overview — 6 constellations
const sixIds = ["c1", "c2", "c3", "c4", "c5", "c6"];
const galaxy6 = computeWorldGalaxyLayout(sixIds, CANVAS);
const overlaps6 = detectLayoutOverlaps(
  Object.fromEntries(
    sixIds.map((id) => {
      const p = galaxy6[id]!;
      return [id, { x: p.x + GALAXY_NODE_FOOTPRINT.width / 2, y: p.y + GALAXY_NODE_FOOTPRINT.height / 2 }];
    }),
  ),
  WORLD_OVERVIEW_MIN_SEPARATION * 0.85,
);
assert(overlaps6.length === 0, "6 constellations have no severe overlap");

// World overview — 5 constellations (label overlap regression)
const fiveIds = ["fading-sanity", "rituals-dread", "ruins", "unreliable-narrator", "haunting-truths"];
const galaxy5 = computeWorldGalaxyLayout(fiveIds, CANVAS);
const centers5 = fiveIds.map((id) => {
  const p = galaxy5[id]!;
  return { x: p.x + GALAXY_NODE_FOOTPRINT.width / 2, y: p.y + GALAXY_NODE_FOOTPRINT.height / 2 };
});
const overlaps5 = detectLayoutOverlaps(
  Object.fromEntries(fiveIds.map((id, i) => [id, centers5[i]!])),
  WORLD_OVERVIEW_MIN_SEPARATION * 0.85,
);
assert(overlaps5.length === 0, "5 constellations have no severe overlap");
const cluster5Bounds = computeActiveClusterBounds(galaxy5, fiveIds, GALAXY_NODE_FOOTPRINT);
const vp5 = computeViewportForCluster(cluster5Bounds, CANVAS, { targetFill: 0.64 });
assert(vp5.zoom >= READABLE_ZOOM_MIN, "5-constellation viewport zoom readable");
const spreadW = cluster5Bounds.maxX - cluster5Bounds.minX;
const usableW = CANVAS.width - (CANVAS.sidebarWidth ?? 176);
assert(spreadW >= usableW * 0.48, "5 constellations use sufficient canvas width");

// Constellation orbit — 1 node
const onePlanet = computeConstellationOrbitLayout(1, CANVAS, { phaseSeed: "sun" });
assert(onePlanet.length === 1, "one planet");
assert(distance(onePlanet[0]!, { x: 0, y: 0 }) > 80, "single planet away from sun");

// Constellation orbit — 2 nodes opposite
const twoPlanets = computeConstellationOrbitLayout(2, CANVAS, { phaseSeed: "pair" });
assert(twoPlanets.length === 2, "two planets");
const d0 = distance(twoPlanets[0]!, { x: 0, y: 0 });
const d1 = distance(twoPlanets[1]!, { x: 0, y: 0 });
assert(Math.abs(d0 - d1) < 20, "two planets equidistant from center");
const angleDiff = Math.atan2(twoPlanets[1]!.y, twoPlanets[1]!.x) - Math.atan2(twoPlanets[0]!.y, twoPlanets[0]!.x);
assert(Math.abs(Math.abs(angleDiff) - Math.PI) < 0.5, "two planets roughly opposite");

// Constellation orbit — 6 nodes ring
const sixPlanets = computeConstellationOrbitLayout(6, CANVAS, { phaseSeed: "ring" });
assert(sixPlanets.length === 6, "six planets");
for (const p of sixPlanets) {
  assert(distance(p, { x: 0, y: 0 }) > 100, "planet on orbit ring");
}

// Satellite layout
const parent = { x: 0, y: 0 };
const constellationCenter = { x: 0, y: 0 };
const moons = computeSatelliteOrbitLayout(4, parent, CANVAS, { phaseSeed: "moon" });
assert(
  childrenOrbitCloserToParentThanCenter(parent, { x: 500, y: 0 }, moons),
  "moons closer to parent than distant center",
);
const constellationRadius = computeOrbitRadiusFromCanvas(CANVAS, "constellation");
const satelliteRadius = computeOrbitRadiusFromCanvas(CANVAS, "satellite");
assert(satelliteRadius < constellationRadius, "satellite orbit smaller than constellation orbit");
for (const moon of moons) {
  assert(distance(moon, parent) < constellationRadius * 0.85, "moon inside constellation orbit");
}

// Determinism
const repeat = computeConstellationOrbitLayout(6, CANVAS, { phaseSeed: "ring" });
assert(JSON.stringify(sixPlanets) === JSON.stringify(repeat), "layout deterministic");

// Satellite layout helper
const childIds = Array.from({ length: 6 }, (_, i) => `child_${i + 1}`);
const satellitePositions = layoutSatellitesAroundParent({
  parentPosition: parent,
  parentNodeId: "parent_alpha",
  childIds,
  depthLevel: 2,
  canvas: CANVAS,
});
assert(Object.keys(satellitePositions).length === 6, "satellite map has six entries");

// Viewport with panel
const vpPanel = computeViewportForCluster(cluster4Bounds, CANVAS_WITH_PANEL);
assert(vpPanel.zoom >= READABLE_ZOOM_MIN, "panel viewport zoom readable");

// Label collision resolver
const offsets = resolveSimpleLabelCollisions([
  { id: "a", x: 0, y: 0, priority: 10 },
  { id: "b", x: 4, y: 0, priority: 5 },
]);
assert(offsets.b! > 0, "label collision resolved");

console.log("galaxy4 zoom:", vp4.zoom.toFixed(2));
console.log("constellation radius:", Math.round(constellationRadius));
console.log("satellite radius:", Math.round(satelliteRadius));
console.log("\nAll orbital layout checks passed.");

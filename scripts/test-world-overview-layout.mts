/**
 * World overview layout spacing (Phase 9B, Part A). No network.
 *
 * Verifies that dense clusters (7-8 constellations) spread across the canvas
 * without severe label overlap, using box-aware separation.
 *
 * Usage: npx tsx scripts/test-world-overview-layout.mts
 */

import {
  computeWorldGalaxyLayout,
  computeSafeLayoutBounds,
  GALAXY_NODE_FOOTPRINT,
  type CanvasDimensions,
  type Point,
} from "../lib/worldBrain/orbitalLayout.ts";

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    pass++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    fail++;
  }
}

const CANVAS: CanvasDimensions = {
  width: 1440,
  height: 900,
  sidebarWidth: 176,
  panelInset: 0,
};

// Two cards visually overlap if their footprints intersect on BOTH axes.
// We test with a tolerance slightly smaller than the layout's separation box.
const TEST_BOX_W = GALAXY_NODE_FOOTPRINT.width - 24; // 256
const TEST_BOX_H = GALAXY_NODE_FOOTPRINT.height - 40; // 160

function centersFrom(positions: Record<string, Point>): Point[] {
  return Object.values(positions).map((p) => ({
    x: p.x + GALAXY_NODE_FOOTPRINT.width / 2,
    y: p.y + GALAXY_NODE_FOOTPRINT.height / 2,
  }));
}

function countBoxOverlaps(centers: Point[]): number {
  let overlaps = 0;
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      const dx = Math.abs(centers[i]!.x - centers[j]!.x);
      const dy = Math.abs(centers[i]!.y - centers[j]!.y);
      if (dx < TEST_BOX_W && dy < TEST_BOX_H) overlaps++;
    }
  }
  return overlaps;
}

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `constellation_${i}`);
}

function spanOf(centers: Point[]): { w: number; h: number } {
  const xs = centers.map((c) => c.x);
  const ys = centers.map((c) => c.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

console.log("=== World overview layout (no network) ===\n");

for (const n of [7, 8]) {
  console.log(`[${n} constellations]`);
  const positions = computeWorldGalaxyLayout(ids(n), CANVAS);
  const centers = centersFrom(positions);
  assert(Object.keys(positions).length === n, `produced ${n} positions`);

  const overlaps = countBoxOverlaps(centers);
  assert(overlaps === 0, `no severe label overlap (found ${overlaps})`);

  const bounds = computeSafeLayoutBounds(CANVAS);
  const withinBounds = centers.every(
    (c) =>
      c.x >= bounds.minX - 1 &&
      c.x <= bounds.maxX + 1 &&
      c.y >= bounds.minY - 1 &&
      c.y <= bounds.maxY + 1,
  );
  assert(withinBounds, "all constellations stay within safe canvas bounds");

  const span = spanOf(centers);
  assert(span.w >= 600, `spreads across the width (span ${Math.round(span.w)}px)`);
  assert(span.h >= 180, `uses vertical space too (span ${Math.round(span.h)}px)`);

  // Determinism.
  const again = centersFrom(computeWorldGalaxyLayout(ids(n), CANVAS));
  const deterministic = again.every(
    (c, i) => Math.abs(c.x - centers[i]!.x) < 0.01 && Math.abs(c.y - centers[i]!.y) < 0.01,
  );
  assert(deterministic, "layout is deterministic");
  console.log("");
}

// Sanity: sparse clusters still work (unchanged single-ellipse path).
console.log("[5 constellations — unchanged path]");
{
  const positions = computeWorldGalaxyLayout(ids(5), CANVAS);
  assert(Object.keys(positions).length === 5, "produced 5 positions");
  const overlaps = countBoxOverlaps(centersFrom(positions));
  assert(overlaps === 0, `no severe overlap for 5 (found ${overlaps})`);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

/**
 * Manual local test for node expansion layout — no network, no Gemini.
 *
 * Usage: npx tsx scripts/test-node-expansion-layout.mts
 */

import {
  layoutChildNodesAroundParent,
  NODE_EXPANSION_MIN_PARENT_DISTANCE,
} from "../lib/graphLayout.ts";

const PARENT = { x: 100, y: 200 };
const PARENT_ID = "node_old_temple_lady";

const children = Array.from({ length: 6 }, (_, i) => ({
  id: `child_${i + 1}`,
}));

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function positionsEqual(
  a: Record<string, { x: number; y: number }>,
  b: Record<string, { x: number; y: number }>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (k) => Math.abs(a[k].x - b[k].x) < 0.001 && Math.abs(a[k].y - b[k].y) < 0.001,
  );
}

function main() {
  console.log("=== Node expansion layout fixture test (no network) ===\n");

  const result = layoutChildNodesAroundParent({
    parentPosition: PARENT,
    parentNodeId: PARENT_ID,
    childNodes: children,
    depthLevel: 2,
    existingPositions: { [PARENT_ID]: PARENT },
  });

  const coords = Object.values(result.positions);
  assert(coords.length === 6, "expected 6 positions");

  // No duplicate positions
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      assert(
        distance(coords[i], coords[j]) > 1,
        `duplicate or overlapping positions at index ${i} and ${j}`,
      );
    }
  }

  // Minimum distance from parent
  for (const [id, pos] of Object.entries(result.positions)) {
    const d = distance(pos, PARENT);
    assert(
      d >= NODE_EXPANSION_MIN_PARENT_DISTANCE - 0.01,
      `${id} too close to parent (${d.toFixed(1)}px)`,
    );
  }

  // Determinism: same inputs → same outputs
  const result2 = layoutChildNodesAroundParent({
    parentPosition: PARENT,
    parentNodeId: PARENT_ID,
    childNodes: children,
    depthLevel: 2,
    existingPositions: { [PARENT_ID]: PARENT },
  });
  assert(
    positionsEqual(result.positions, result2.positions),
    "layout must be deterministic for same inputs",
  );

  // Depth increases spread
  const shallow = layoutChildNodesAroundParent({
    parentPosition: PARENT,
    parentNodeId: PARENT_ID,
    childNodes: children.slice(0, 1),
    depthLevel: 2,
  });
  const deep = layoutChildNodesAroundParent({
    parentPosition: PARENT,
    parentNodeId: PARENT_ID,
    childNodes: children.slice(0, 1),
    depthLevel: 4,
  });
  const shallowDist = distance(Object.values(shallow.positions)[0], PARENT);
  const deepDist = distance(Object.values(deep.positions)[0], PARENT);
  assert(deepDist >= shallowDist, "deeper depthLevel should not reduce radius");

  console.log("Parent:", PARENT);
  console.table(
    Object.entries(result.positions).map(([id, pos]) => ({
      id,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      distFromParent: Math.round(distance(pos, PARENT)),
    })),
  );

  console.log("\nAll node expansion layout checks passed.");
}

main();

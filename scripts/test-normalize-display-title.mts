/**
 * Manual local test for canvas display title normalization — no network.
 *
 * Usage: npx tsx scripts/test-normalize-display-title.mts
 */

import { normalizeCanvasDisplayTitle } from "../lib/normalizeDisplayTitle.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const cases: Array<{ input: string; expect: string }> = [
  { input: "Xylos Prime Ecosystem", expect: "Prime Ecosystem" },
  { input: "Mind Erosion & Perception", expect: "Mind Erosion" },
  { input: "Veil Forgotten Lore", expect: "Forgotten Lore" },
  { input: "Space Escalation", expect: "Space Conflict" },
  { input: "Artifact Follies", expect: "Artifact Follies" },
  { input: "The Great Xylos Fruit Fiasco", expect: "Fruit Fiasco" },
  { input: "The Glowing Jellyfish Swarm", expect: "Jellyfish Swarm" },
  { input: "Stardust Drifter", expect: "Drifter" },
  { input: "Colony Premise", expect: "Colony Premise" },
  { input: "Dream Warning Signal", expect: "Dream Warning Signal" },
];

function main() {
  console.log("=== normalizeCanvasDisplayTitle (no network) ===\n");

  for (const { input, expect } of cases) {
    const out = normalizeCanvasDisplayTitle(input);
    console.log(`"${input}" → "${out}" (expected "${expect}")`);
    assert(out === expect, `"${input}" → "${out}", expected "${expect}"`);
  }

  console.log("\nAll display title normalization checks passed.");
}

main();

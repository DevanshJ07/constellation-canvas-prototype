/**
 * Creator copy tests (Phase 6E) — no network.
 */

import {
  sanitizeCreatorCopy,
  toStoryHookTitle,
  enrichWhyItMatters,
  formatCreatorCategory,
} from "../lib/creatorCopy.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log("=== Creator copy (no network) ===\n");

assert(
  !/agent-shaped/i.test(sanitizeCreatorCopy("✦ agent-shaped discovery")),
  "sanitizes agent-shaped",
);

assert(
  formatCreatorCategory("✦ Node Reasoner") === "Emergent Discovery",
  "maps reasoner category",
);

const hook = toStoryHookTitle("Psychological Chaos", {
  title: "Psychological Chaos",
  worldSeed: "Five friends lost in a cave",
  category: "conflict",
});
assert(hook !== "Psychological Chaos", "generic title becomes story hook");
assert(hook.length >= 12, "story hook has substance");

const why = enrichWhyItMatters("What lives inside Psychological Chaos?", {
  title: "Psychological Chaos",
  worldSeed: "Five friends lost in a cave",
  category: "Psychological Chaos",
});
assert(why !== null && !/what lives inside/i.test(why), "why it matters enriched");

console.log("\nAll creator copy checks passed.");

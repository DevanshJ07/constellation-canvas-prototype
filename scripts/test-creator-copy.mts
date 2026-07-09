/**
 * Creator copy tests (Phase 6E / 6E.1) — no network.
 */

import {
  sanitizeCreatorCopy,
  toStoryHookTitle,
  enrichWhyItMatters,
  enrichPanelDescription,
  enrichExplorationQuestions,
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

const horrorSeed =
  "psychological horror universe rooted in forgotten Indian folklore";
const desc = enrichPanelDescription(
  `Anchor all exploration in the specific premise: ${horrorSeed}`,
  {
    title: "Fear Spreads Faster Than the Truth",
    worldSeed: horrorSeed,
    category: "Narrative Pressure",
  },
);
assert(!/anchor all exploration/i.test(desc), "panel description replaces shallow fallback");
assert(!desc.toLowerCase().includes(horrorSeed.slice(0, 30).toLowerCase()), "panel description does not repeat seed");

const directions = enrichExplorationQuestions(
  [`What makes "${horrorSeed}" unique?`],
  {
    title: "Fear Spreads Faster Than the Truth",
    worldSeed: horrorSeed,
    category: "Narrative Pressure",
  },
);
assert(directions.length >= 3, "exploration questions enriched");
assert(!directions.some((d) => /what makes .+ unique/i.test(d)), "no generic unique questions");

console.log("\nAll creator copy checks passed.");

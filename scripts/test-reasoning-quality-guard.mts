/**
 * Reasoning quality guard tests (Phase 6D) — no network.
 */

import {
  guardNodeDescription,
  isShallowNodeDescription,
  repairShallowNodeDescription,
} from "../lib/worldBrain/reasoningQualityGuard.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log("=== Reasoning quality guard (no network) ===\n");

assert(
  isShallowNodeDescription("A concrete entry point into Tech Premise."),
  "detects entry point shallow copy",
);

assert(
  isShallowNodeDescription(
    "A colony where memories are used as currency and citizens trade memories for rent.",
    { title: "Memory Bank", worldPrompt: "A colony where memories are used as currency and citizens trade memories for rent" },
  ),
  "detects prompt repetition",
);

const repaired = repairShallowNodeDescription({
  title: "Stolen Dataset",
  constellationTitle: "Tech Premise",
  premise: "Memory is currency in a surveillance colony",
  discoveryQuestion: "Who paid to erase the witness's childhood?",
});

assert(repaired.length >= 40, "repair produces substantive copy");
assert(!/entry point into/i.test(repaired), "repair avoids forbidden phrase");

const guarded = guardNodeDescription("Explore the concept of blackmail.", {
  title: "Predictive Betrayal Index",
  creativePurpose:
    "The index ranks friends by predicted betrayal under pressure, turning social trust into a tradable commodity.",
  worldPrompt: "Memory economy sci-fi",
});

assert(!isShallowNodeDescription(guarded), "guard replaces shallow description");

console.log("\nAll reasoning quality guard checks passed.");

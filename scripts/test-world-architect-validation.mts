/**
 * World Architect story-world validation (Phase 9A). No network.
 *
 * Forces the deterministic (no-API-key) architecture path so results are stable,
 * then verifies story-world structural coverage, anti-vague rules, adaptive
 * climax behavior, and node story fields.
 *
 * Usage: npx tsx scripts/test-world-architect-validation.mts
 */

// Force deterministic fallback path (no live Gemini calls).
process.env.GEMINI_API_KEY = "";
process.env.OPENROUTER_API_KEY = "";

import { decomposeWorldPrompt } from "../lib/worldBrain/decomposeWorldPrompt.ts";
import { architectWorld } from "../lib/worldBrain/architectWorld.ts";
import type {
  VisibleConstellation,
  WorldArchitecture,
} from "../lib/worldBrain/architectWorld.ts";
import {
  computeArchitectureCoverage,
  isFixedEndingClimax,
  isGenericNodeDescription,
  isVagueConstellationTitle,
  nodeHasStoryFields,
  validateWorldArchitecture,
} from "../lib/worldBrain/architectureValidation.ts";

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

async function build(seed: string): Promise<WorldArchitecture> {
  const decomposition = await decomposeWorldPrompt(seed, "");
  return architectWorld(decomposition);
}

function makeConstellation(
  overrides: Partial<VisibleConstellation>,
): VisibleConstellation {
  return {
    id: "constellation_test",
    title: "The House That Remembers",
    purpose: "purpose",
    userFacingQuestion: "question",
    sourceCreativeLayer: "layer",
    linkedReasoningAgentIds: [],
    suggestedStartingNodeIds: [],
    priority: 1,
    category: "settings",
    ...overrides,
  };
}

async function main() {
  // ── Case 1: Horror seed structural coverage ────────────────────────────────
  console.log("\n[1] Horror seed includes characters/settings/themes/climax/canon");
  {
    const arch = await build("Indian folklore horror in an abandoned temple");
    const cov = computeArchitectureCoverage(arch);
    assert(cov.hasCharacters, "has Characters constellation");
    assert(cov.hasSettings, "has Settings constellation");
    assert(cov.hasThemes, "has Themes constellation");
    assert(cov.hasClimax, "has Climax constellation");
    assert(cov.hasCanon, "has Canon Universe constellation");
    const result = validateWorldArchitecture(arch);
    assert(result.valid, `horror architecture is valid (${result.summary})`);
  }

  // ── Case 2: Tech thriller seed structural coverage ──────────────────────────
  console.log("\n[2] Tech thriller seed includes character/theme/timeline/climax/canon");
  {
    const arch = await build(
      "A tech genius hacks a billion-dollar company and blackmails them",
    );
    const cov = computeArchitectureCoverage(arch);
    assert(cov.hasCharacters, "has Characters constellation");
    assert(cov.hasSettings, "has Settings constellation");
    assert(cov.hasThemes, "has Themes constellation");
    assert(cov.hasClimax, "has Climax constellation");
    assert(cov.hasCanon, "has Canon Universe constellation");
    const result = validateWorldArchitecture(arch);
    assert(result.valid, `tech thriller architecture is valid (${result.summary})`);
  }

  // ── Case 3: Vague constellation names fail validation ───────────────────────
  console.log("\n[3] Vague constellation names fail validation");
  {
    assert(isVagueConstellationTitle("Main Ideas"), '"Main Ideas" is vague');
    assert(isVagueConstellationTitle("Lore"), '"Lore" is vague');
    assert(isVagueConstellationTitle("Story Elements"), '"Story Elements" is vague');
    assert(isVagueConstellationTitle("Exploration"), '"Exploration" is vague');
    assert(
      isVagueConstellationTitle("Character Concepts Agent"),
      "backend-sounding title is vague",
    );
    assert(
      !isVagueConstellationTitle("The Leak That Breaks Trust"),
      '"The Leak That Breaks Trust" is concrete',
    );
    assert(
      !isVagueConstellationTitle("The House That Remembers"),
      '"The House That Remembers" is concrete',
    );

    // A whole architecture with a vague title must be invalid.
    const arch = await build("5 friends lost in a cave");
    const vagueArch: WorldArchitecture = {
      ...arch,
      visibleConstellations: [
        makeConstellation({ id: "constellation_vague", title: "Main Ideas", category: "characters" }),
        ...arch.visibleConstellations,
      ],
    };
    const result = validateWorldArchitecture(vagueArch);
    assert(!result.valid, "architecture with a vague title is invalid");
    assert(
      result.issues.some((i) => i.severity === "error" && i.field.includes("constellation")),
      "vague title produces a constellation error",
    );
  }

  // ── Case 4: Climax present but not final-ending-specific ────────────────────
  console.log("\n[4] Climax present and adaptive (not a fixed ending)");
  {
    const arch = await build("Indian folklore horror in an abandoned temple");
    const climax = arch.visibleConstellations.find((c) => c.category === "climax");
    assert(Boolean(climax), "climax constellation exists");
    if (climax) {
      assert(!isFixedEndingClimax(climax), `climax "${climax.title}" is not a fixed ending`);
      assert(
        (climax.canonSensitivity ?? "high") === "high",
        "climax is highly canon-sensitive (adaptive)",
      );
    }
    // A fixed-ending climax must be rejected.
    assert(
      isFixedEndingClimax(makeConstellation({ title: "Final Battle", category: "climax" })),
      '"Final Battle" is a fixed ending',
    );
    assert(
      isFixedEndingClimax(makeConstellation({ title: "The Ending", category: "climax" })),
      '"The Ending" is a fixed ending',
    );
    const badClimaxArch: WorldArchitecture = {
      ...arch,
      visibleConstellations: arch.visibleConstellations.map((c) =>
        c.category === "climax" ? { ...c, title: "Final Battle" } : c,
      ),
    };
    const result = validateWorldArchitecture(badClimaxArch);
    assert(!result.valid, "architecture with a fixed-ending climax is invalid");
  }

  // ── Case 5: Starting nodes include storyUse and possibleConflict ────────────
  console.log("\n[5] Starting nodes include storyUse and possibleConflict");
  {
    const arch = await build("A tech genius hacks a billion-dollar company and blackmails them");
    assert(arch.startingNodes.length > 0, "architecture has starting nodes");
    const allHaveStoryFields = arch.startingNodes.every(nodeHasStoryFields);
    assert(allHaveStoryFields, "every starting node has storyUse + possibleConflict");
    const allHaveBelonging = arch.startingNodes.every(
      (n) => n.whyItBelongsHere && n.whyItBelongsHere.trim().length > 0,
    );
    assert(allHaveBelonging, "every starting node has whyItBelongsHere");
  }

  // ── Case 6: Generic node description detection ──────────────────────────────
  console.log("\n[6] Generic node description detection");
  {
    assert(
      isGenericNodeDescription("A concrete entry point into Tech Premise."),
      "'A concrete entry point into...' is generic",
    );
    assert(isGenericNodeDescription("An idea."), "too-short description is generic");
    assert(
      !isGenericNodeDescription(
        "The hacker discovers the company's dataset predicts which employees will betray friends under pressure.",
      ),
      "a specific description is not generic",
    );
  }

  // ── Case 7: Two seeds produce different worlds ──────────────────────────────
  console.log("\n[7] Different seeds produce different worlds");
  {
    const a = await build("5 friends lost in a cave");
    const b = await build("A tech genius hacks a billion-dollar company");
    const titlesA = a.visibleConstellations.map((c) => c.title).join("|");
    const titlesB = b.visibleConstellations.map((c) => c.title).join("|");
    assert(titlesA !== titlesB, "constellation titles differ between seeds");
  }

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

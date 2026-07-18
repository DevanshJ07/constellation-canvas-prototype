/**
 * Functional constellation names + start guidance (Phase 9B, Parts B/C). No network.
 *
 * Usage: npx tsx scripts/test-functional-constellation-names.mts
 */

process.env.GEMINI_API_KEY = "";
process.env.OPENROUTER_API_KEY = "";

import { decomposeWorldPrompt } from "../lib/worldBrain/decomposeWorldPrompt.ts";
import { architectWorld } from "../lib/worldBrain/architectWorld.ts";
import { mapArchitectureToCanvasModel } from "../lib/worldBrain/mapArchitectureToCanvas.ts";
import { formatConstellationCategory } from "../lib/creatorCopy.ts";
import {
  recommendStartingConstellations,
  startRecommendationIds,
} from "../lib/worldBrain/worldOverviewGuidance.ts";
import { isVagueConstellationTitle } from "../lib/worldBrain/architectureValidation.ts";

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

async function buildModel(seed: string) {
  const decomposition = await decomposeWorldPrompt(seed, "");
  const architecture = await architectWorld(decomposition);
  return mapArchitectureToCanvasModel(architecture);
}

async function main() {
  console.log("=== Functional constellation names + start guidance ===\n");

  // ── Part B: category → functional label ───────────────────────────────────
  console.log("[1] formatConstellationCategory maps to clear functional labels");
  {
    assert(formatConstellationCategory("climax") === "Climax", "climax → Climax");
    assert(formatConstellationCategory("characters") === "Characters", "characters → Characters");
    assert(formatConstellationCategory("canon") === "Canon Universe", "canon → Canon Universe");
    assert(formatConstellationCategory("power") === "Power Structures", "power → Power Structures");
    assert(formatConstellationCategory(undefined) === undefined, "undefined → undefined");
    assert(formatConstellationCategory("other") === "World Area", "other → World Area");
  }

  // ── Part B: canvas model carries category + categoryLabel + evocative title ─
  console.log("\n[2] Canvas constellations carry category + functional label + title");
  {
    const model = await buildModel("Indian folklore horror in an abandoned temple");
    const withCategory = model.constellations.filter((c) => c.category);
    assert(withCategory.length === model.constellations.length, "every constellation has a category");
    const withLabel = model.constellations.filter((c) => c.categoryLabel);
    assert(withLabel.length === model.constellations.length, "every constellation has a functional label");
    const allHaveTitle = model.constellations.every((c) => c.title && c.title.trim().length > 0);
    assert(allHaveTitle, "every constellation keeps an evocative title");
    const climax = model.constellations.find((c) => c.category === "climax");
    assert(Boolean(climax?.categoryLabel === "Climax"), "climax constellation shows 'Climax' label");
    // Function is clear: label differs from the poetic title.
    if (climax) {
      assert(
        climax.categoryLabel !== climax.title,
        "functional label is distinct from evocative title",
      );
    }
  }

  // ── Part B: vague titles are still flagged ─────────────────────────────────
  console.log("\n[3] Vague/confusing names are flagged; functional ones are not");
  {
    assert(isVagueConstellationTitle("Mind Labyrinth") === false, "'Mind Labyrinth' is a title, not a bare vague label");
    assert(isVagueConstellationTitle("Lore"), "'Lore' is vague");
    assert(isVagueConstellationTitle("Exploration"), "'Exploration' is vague");
    assert(!isVagueConstellationTitle("The Temple and Its Boundaries"), "functional title is not vague");
    assert(!isVagueConstellationTitle("The Leak That Breaks Trust"), "functional title is not vague");
  }

  // ── Part C: start recommendation excludes canon and usually climax ─────────
  console.log("\n[4] Start guidance recommends beginner areas, not Canon/Climax");
  {
    const model = await buildModel("5 friends lost in a cave");
    const recs = recommendStartingConstellations(model, 2);
    assert(recs.length >= 1 && recs.length <= 2, `recommends 1-2 constellations (got ${recs.length})`);
    assert(recs[0]?.label === "Start here", "first recommendation labeled 'Start here'");

    const startIds = startRecommendationIds(model, 2);
    const catById = new Map(model.constellations.map((c) => [c.id, c.category]));
    const recommendsCanon = [...startIds].some((id) => catById.get(id) === "canon");
    const recommendsClimax = [...startIds].some((id) => catById.get(id) === "climax");
    assert(!recommendsCanon, "never recommends Canon Universe as a start");
    assert(!recommendsClimax, "does not recommend Climax as a start (has other options)");

    // Prefer characters/settings/conflict first.
    const firstCat = catById.get(recs[0]!.constellationId);
    assert(
      ["characters", "settings", "conflict", "themes"].includes(firstCat ?? ""),
      `first start is a beginner category (got ${firstCat})`,
    );
  }

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

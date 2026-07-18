/**
 * Visible world evolution on accepted truth (Phase 9B, Parts D/E/F/G). No network.
 *
 * Usage: npx tsx scripts/test-visible-world-evolution.mts
 */

process.env.GEMINI_API_KEY = "";
process.env.OPENROUTER_API_KEY = "";

import { decomposeWorldPrompt } from "../lib/worldBrain/decomposeWorldPrompt.ts";
import { architectWorld } from "../lib/worldBrain/architectWorld.ts";
import {
  mapArchitectureToCanvasModel,
  type CanvasWorldModel,
} from "../lib/worldBrain/mapArchitectureToCanvas.ts";
import { applyAcceptedTruthToWorld } from "../lib/worldBrain/applyAcceptedTruth.ts";

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

const BACKEND_TERMS = /\b(operation|patch|dry run|dry-run|validation|blocker|apply plan|metadata|overlay)\b/i;

async function buildModel(seed: string): Promise<CanvasWorldModel> {
  const decomposition = await decomposeWorldPrompt(seed, "");
  const architecture = await architectWorld(decomposition);
  return mapArchitectureToCanvasModel(architecture);
}

function pickTruthNode(model: CanvasWorldModel): string {
  // Prefer a node that is NOT in the canon or climax constellation.
  const canonId = model.constellations.find((c) => c.category === "canon")?.id;
  const climaxId = model.constellations.find((c) => c.category === "climax")?.id;
  const node =
    model.nodes.find(
      (n) => n.constellationId !== canonId && n.constellationId !== climaxId,
    ) ?? model.nodes[0]!;
  return node.id;
}

async function main() {
  console.log("=== Visible world evolution (no network) ===\n");

  const model = await buildModel("A tech genius hacks a billion-dollar company and blackmails them");
  const truthId = pickTruthNode(model);
  const truthTitle = model.nodes.find((n) => n.id === truthId)!.title;
  const result = applyAcceptedTruthToWorld(model, truthId);

  // ── Applied + traceable ───────────────────────────────────────────────────
  console.log("[1] Accepting a truth produces a scoped, traceable change");
  assert(result.applied, "change was applied");
  assert(result.truthNodeId === truthId, "result references the accepted truth node");
  assert(result.affectedNodeIds.length >= 1 && result.affectedNodeIds.length <= 4, `scoped to 1-4 related nodes (got ${result.affectedNodeIds.length})`);

  // ── Related nodes get visible consequence + influencedByCanonIds ───────────
  console.log("\n[2] Related nodes get a visible consequence note and canon link");
  {
    for (const nodeId of result.affectedNodeIds) {
      const node = result.canvasModel.nodes.find((n) => n.id === nodeId)!;
      assert(Boolean(node.consequenceNote && node.consequenceNote.includes("Because")), `node ${node.title} has a "Because…" note`);
      assert((node.influencedByCanonIds ?? []).includes(truthId), `node ${node.title} records influencedByCanonIds`);
      assert(Boolean(node.evolutionState), `node ${node.title} has an evolution state`);
    }
  }

  // ── Canon Universe records the truth ───────────────────────────────────────
  console.log("\n[3] Canon Universe reflects the accepted truth");
  {
    assert(result.canonRecorded, "canon was recorded");
    const canon = result.canvasModel.constellations.find((c) => c.category === "canon")!;
    assert((canon.canonTruthIds ?? []).includes(truthId), "canon constellation lists the truth id");
    const canonNode = result.canvasModel.nodes.find((n) => n.id === `canon_${truthId}`);
    assert(Boolean(canonNode), "a canon entry node was created");
    assert(canon.nodeIds.includes(`canon_${truthId}`), "canon constellation contains the canon entry node");
  }

  // ── Climax constellation evolves ───────────────────────────────────────────
  console.log("\n[4] Climax constellation pressure updates with canon");
  {
    assert(result.climaxUpdated, "climax was updated");
    const climax = result.canvasModel.constellations.find((c) => c.category === "climax")!;
    assert(Boolean(climax.pressureNote && climax.pressureNote.length > 0), "climax has a pressure note");
    assert(climax.pressureNote!.includes(truthTitle.replace(/[.?!]+$/, "").trim()), "climax pressure references the accepted truth");
  }

  // ── User-facing copy has no backend terms ──────────────────────────────────
  console.log("\n[5] User-facing copy is clean (no backend terms)");
  {
    assert(!BACKEND_TERMS.test(result.userFacingSummary), "summary has no backend terms");
    assert(result.userFacingBullets.every((b) => !BACKEND_TERMS.test(b)), "bullets have no backend terms");
    assert(result.userFacingBullets.length >= 1 && result.userFacingBullets.length <= 4, `2-4 bullets (got ${result.userFacingBullets.length})`);
  }

  // ── Reversibility: original model is untouched (immutability) ───────────────
  console.log("\n[6] Original model is not mutated (reversible)");
  {
    const originalNode = model.nodes.find((n) => n.id === result.affectedNodeIds[0]);
    assert(!originalNode?.consequenceNote, "original model node has no consequence note");
    const originalCanon = model.constellations.find((c) => c.category === "canon");
    assert(!(originalCanon?.canonTruthIds ?? []).includes(truthId), "original canon unchanged");
    assert(result.canvasModel !== model, "returns a new model instance");
  }

  // ── Missing node → safe no-op ──────────────────────────────────────────────
  console.log("\n[7] Unknown truth id is a safe no-op");
  {
    const noop = applyAcceptedTruthToWorld(model, "node_does_not_exist");
    assert(!noop.applied, "not applied");
    assert(noop.canvasModel === model, "returns original model unchanged");
    assert(!BACKEND_TERMS.test(noop.userFacingSummary), "fallback copy is clean");
  }

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

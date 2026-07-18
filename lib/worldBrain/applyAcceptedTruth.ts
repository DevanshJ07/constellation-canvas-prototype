/**
 * Deterministic world-content evolution (Phase 9B, Parts D/E/F/G).
 *
 * When a creator establishes a node as truth, the world must visibly respond:
 *  - the accepted truth is recorded into the Canon Universe constellation
 *  - related nodes are reframed with a visible "Because […], this now…" note,
 *    marked with influencedByCanonIds, and tagged strengthened/weakened/reframed
 *  - the Climax constellation's evolving pressure note is updated
 *
 * This is intentionally deterministic and side-effect free (no network, no LLM),
 * so accepting a truth ALWAYS produces a scoped, traceable, canon-safe, reversible
 * change. The richer LLM ripple flow can layer on top of this baseline.
 */

import type {
  CanvasConstellation,
  CanvasNode,
  CanvasWorldModel,
} from "@/lib/worldBrain/mapArchitectureToCanvas";

export type AcceptedTruthChange = {
  nodeId: string;
  title: string;
  evolutionState: "strengthened" | "weakened" | "reframed";
  consequenceNote: string;
};

export type AcceptedTruthResult = {
  canvasModel: CanvasWorldModel;
  applied: boolean;
  truthNodeId: string;
  truthTitle: string;
  affectedNodeIds: string[];
  affectedConstellationIds: string[];
  climaxUpdated: boolean;
  canonRecorded: boolean;
  changes: AcceptedTruthChange[];
  /** Creator-facing summary (no backend terms). */
  userFacingSummary: string;
  /** 2-4 creator-facing consequence bullets. */
  userFacingBullets: string[];
};

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for", "with",
  "that", "this", "who", "whom", "whose", "which", "what", "when", "where",
  "into", "from", "its", "their", "his", "her", "they", "them", "it", "is",
  "are", "was", "were", "be", "been", "as", "by", "but", "not", "no", "yes",
]);

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w)),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let score = 0;
  for (const w of a) if (b.has(w)) score++;
  return score;
}

function shortTitle(title: string): string {
  return title.replace(/[.?!]+$/, "").trim();
}

/**
 * Rank candidate nodes by relatedness to the accepted truth. Same-constellation
 * siblings get a strong prior; keyword overlap breaks ties across the world.
 */
function rankRelatedNodes(
  truth: CanvasNode,
  nodes: CanvasNode[],
): CanvasNode[] {
  const truthWords = keywords(`${truth.title} ${truth.description}`);
  const scored = nodes
    .filter((n) => n.id !== truth.id)
    .map((n) => {
      const nodeWords = keywords(`${n.title} ${n.description}`);
      const sameConstellation = n.constellationId === truth.constellationId ? 2 : 0;
      const overlap = overlapScore(truthWords, nodeWords);
      return { node: n, score: sameConstellation + overlap };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
  return scored.map((entry) => entry.node);
}

/**
 * Deterministic evolution state for an affected node. Same-constellation
 * siblings are strengthened (the truth reinforces them); distant nodes are
 * reframed; conflict/mystery nodes weaken as the truth resolves uncertainty.
 */
function evolutionStateFor(
  truth: CanvasNode,
  node: CanvasNode,
  constellationById: Map<string, CanvasConstellation>,
): "strengthened" | "weakened" | "reframed" {
  const category = constellationById.get(node.constellationId)?.category;
  if (category === "mysteries" || node.nodeType === "mystery") return "weakened";
  if (node.constellationId === truth.constellationId) return "strengthened";
  return "reframed";
}

function consequenceVerb(state: "strengthened" | "weakened" | "reframed"): string {
  switch (state) {
    case "strengthened":
      return "carries more weight";
    case "weakened":
      return "loses some of its mystery";
    case "reframed":
      return "shifts in meaning";
  }
}

function buildConsequenceNote(
  truthTitle: string,
  node: CanvasNode,
  state: "strengthened" | "weakened" | "reframed",
): string {
  const verb = consequenceVerb(state);
  const focus = shortTitle(node.title);
  return `Because "${shortTitle(truthTitle)}" is now true, ${focus} ${verb}.`;
}

function cloneModel(model: CanvasWorldModel): CanvasWorldModel {
  return {
    ...model,
    constellations: model.constellations.map((c) => ({ ...c })),
    nodes: model.nodes.map((n) => ({ ...n })),
    agents: model.agents.map((a) => ({ ...a })),
    criticAgents: model.criticAgents.map((c) => ({ ...c })),
  };
}

export type ApplyAcceptedTruthOptions = {
  /** Maximum related nodes to reframe (default 3, product spec: 2-4). */
  maxAffected?: number;
};

/**
 * Apply an accepted truth to the world model, returning a new model plus a
 * traceable change summary. If the truth node cannot be found, the model is
 * returned unchanged with `applied: false`.
 */
export function applyAcceptedTruthToWorld(
  model: CanvasWorldModel,
  truthNodeId: string,
  options: ApplyAcceptedTruthOptions = {},
): AcceptedTruthResult {
  const maxAffected = Math.max(1, Math.min(4, options.maxAffected ?? 3));
  const truth = model.nodes.find((n) => n.id === truthNodeId);

  if (!truth) {
    return {
      canvasModel: model,
      applied: false,
      truthNodeId,
      truthTitle: "",
      affectedNodeIds: [],
      affectedConstellationIds: [],
      climaxUpdated: false,
      canonRecorded: false,
      changes: [],
      userFacingSummary: "This truth has been added. The world needs a little more context before it changes.",
      userFacingBullets: [],
    };
  }

  const next = cloneModel(model);
  const constellationById = new Map(next.constellations.map((c) => [c.id, c]));
  const nodeById = new Map(next.nodes.map((n) => [n.id, n]));
  const truthTitle = truth.title;
  const affectedConstellationIds = new Set<string>();
  const changes: AcceptedTruthChange[] = [];

  // ── Reframe related nodes ────────────────────────────────────────────────
  const related = rankRelatedNodes(truth, next.nodes).slice(0, maxAffected);
  for (const rel of related) {
    const target = nodeById.get(rel.id);
    if (!target) continue;
    const state = evolutionStateFor(truth, target, constellationById);
    target.evolutionState = state;
    target.consequenceNote = buildConsequenceNote(truthTitle, target, state);
    target.influencedByCanonIds = [
      ...new Set([...(target.influencedByCanonIds ?? []), truth.id]),
    ];
    affectedConstellationIds.add(target.constellationId);
    changes.push({
      nodeId: target.id,
      title: shortTitle(target.title),
      evolutionState: state,
      consequenceNote: target.consequenceNote,
    });
  }

  // ── Record into Canon Universe ───────────────────────────────────────────
  const canonConstellation = next.constellations.find((c) => c.category === "canon");
  let canonRecorded = false;
  if (canonConstellation) {
    canonConstellation.canonTruthIds = [
      ...new Set([...(canonConstellation.canonTruthIds ?? []), truth.id]),
    ];
    const canonNodeId = `canon_${truth.id}`;
    if (!next.nodes.some((n) => n.id === canonNodeId)) {
      const canonNode: CanvasNode = {
        id: canonNodeId,
        title: shortTitle(truthTitle),
        description: `Established truth: ${truth.description || shortTitle(truthTitle)}`,
        constellationId: canonConstellation.id,
        generatedByAgentId: truth.generatedByAgentId,
        whyPromising: "This is now locked canon — the rest of the world must respect it.",
        risk: "",
        explorationQuestions: [],
        nodeType: "canon",
        status: "potential",
        aiGenerated: true,
        influencedByCanonIds: [truth.id],
      };
      next.nodes.push(canonNode);
      nodeById.set(canonNodeId, canonNode);
    }
    if (!canonConstellation.nodeIds.includes(canonNodeId)) {
      canonConstellation.nodeIds = [...canonConstellation.nodeIds, canonNodeId];
    }
    affectedConstellationIds.add(canonConstellation.id);
    canonRecorded = true;
  }

  // ── Evolve the Climax constellation's pressure ───────────────────────────
  const climax = next.constellations.find((c) => c.category === "climax");
  let climaxUpdated = false;
  if (climax && climax.id !== truth.constellationId) {
    climax.pressureNote = `The climax pressure now centers on "${shortTitle(truthTitle)}" — whether the group faces its consequence or tries to escape it.`;
    affectedConstellationIds.add(climax.id);
    climaxUpdated = true;
  } else if (climax) {
    // Truth lives inside the climax area itself — sharpen its own pressure.
    climax.pressureNote = `With "${shortTitle(truthTitle)}" accepted, the endgame pressure tightens around how it finally breaks.`;
    affectedConstellationIds.add(climax.id);
    climaxUpdated = true;
  }

  // ── Creator-facing summary ───────────────────────────────────────────────
  const userFacingBullets: string[] = changes.map((c) => c.consequenceNote);
  if (canonRecorded) {
    userFacingBullets.push(`"${shortTitle(truthTitle)}" is now locked into your canon.`);
  }
  if (climaxUpdated) {
    userFacingBullets.push("The story's climax pressure has shifted toward this truth.");
  }

  const userFacingSummary =
    changes.length > 0
      ? `Establishing "${shortTitle(truthTitle)}" reshaped ${changes.length} nearby part${changes.length === 1 ? "" : "s"} of your world.`
      : `"${shortTitle(truthTitle)}" is now canon. Nearby areas will respond as the world grows.`;

  return {
    canvasModel: next,
    applied: true,
    truthNodeId,
    truthTitle,
    affectedNodeIds: changes.map((c) => c.nodeId),
    affectedConstellationIds: [...affectedConstellationIds],
    climaxUpdated,
    canonRecorded,
    changes,
    userFacingSummary,
    userFacingBullets: userFacingBullets.slice(0, 4),
  };
}

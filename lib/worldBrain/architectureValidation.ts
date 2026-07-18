/**
 * World Architect validation (Phase 9A).
 *
 * Validates that a WorldArchitecture produces concrete, story-useful
 * "story-world construction areas" instead of vague idea clusters, and that
 * the required structural roles are present:
 *   - at least one Characters constellation
 *   - at least one Settings constellation
 *   - at least one Themes constellation
 *   - one Climax / Endgame Pressure constellation (adaptive, not a fixed ending)
 *   - one Canon Universe (or canon-compatible) constellation
 *
 * These are structural ROLES, not fixed names — validation never requires a
 * specific title, only concrete, non-vague titles and correct coverage.
 *
 * This module is side-effect free and makes no network calls.
 */

import type {
  ConstellationCategory,
  StartingNode,
  VisibleConstellation,
  WorldArchitecture,
} from "@/lib/worldBrain/architectWorld";
import type {
  AgentValidationIssue,
  AgentValidationResult,
} from "@/lib/worldBrain/agents/agentTypes";

// Titles that are too vague to be story-world construction areas unless they are
// clearly attached to a concrete function.
const VAGUE_CONSTELLATION_TITLES = [
  "main ideas",
  "world themes",
  "character concepts",
  "story elements",
  "lore",
  "premise",
  "exploration",
  "ideas",
  "concepts",
  "elements",
  "worldbuilding",
  "story",
  "narrative",
  "plot",
];

// Single generic writing-category words that must not stand alone as a title.
const GENERIC_SINGLE_WORDS = new Set([
  "characters",
  "character",
  "settings",
  "setting",
  "themes",
  "theme",
  "conflict",
  "timeline",
  "mysteries",
  "mystery",
  "power",
  "climax",
  "canon",
  "structure",
  "tone",
  "world",
  "story",
]);

const BACKEND_SOUNDING = /\b(agent|engine|module|system|pipeline|architect|specialist)\b/i;

// Endings that reveal a fixed final outcome — the climax must stay adaptive.
const FIXED_ENDING_TITLES = [
  "final battle",
  "the end",
  "ending",
  "conclusion",
  "finale",
  "final showdown",
  "last stand",
  "resolution",
  "grand finale",
];

const GENERIC_NODE_DESCRIPTION =
  /^(a |an |the )?(concrete|vivid|specific|generic|interesting|compelling)?\s*(entry point|idea|element|exploration|story element|main idea|node|concept)\b/i;

function normTitle(title: string): string {
  return title.toLowerCase().replace(/^the\s+/, "").trim();
}

/** A constellation title is vague if it is a bare generic label with no concrete function. */
export function isVagueConstellationTitle(title: string): boolean {
  const raw = title.trim();
  if (raw.length < 4) return true;
  const norm = normTitle(raw);
  const words = norm.split(/\s+/).filter(Boolean);

  if (BACKEND_SOUNDING.test(raw)) return true;

  // Bare single generic word.
  if (words.length === 1 && GENERIC_SINGLE_WORDS.has(words[0]!)) return true;

  // Exact vague label (allow if extended with a concrete continuation of 3+ words).
  for (const vague of VAGUE_CONSTELLATION_TITLES) {
    if (norm === vague) return true;
    // "Story Elements of X" style — short 2-word vague phrase with no concrete anchor.
    if (norm.startsWith(vague) && words.length <= 2) return true;
  }
  return false;
}

/** A node description is generic if it is empty, too short, or a filler template. */
export function isGenericNodeDescription(description: string): boolean {
  const d = description.trim();
  if (d.length < 20) return true;
  if (GENERIC_NODE_DESCRIPTION.test(d)) return true;
  return false;
}

/** The climax constellation must express possible pressure, not a fixed ending. */
export function isFixedEndingClimax(c: VisibleConstellation): boolean {
  const norm = normTitle(c.title);
  return FIXED_ENDING_TITLES.some((t) => norm === t || norm === normTitle(t));
}

function categoryOf(c: VisibleConstellation): ConstellationCategory {
  return c.category ?? "other";
}

export type ArchitectureCoverage = {
  hasCharacters: boolean;
  hasSettings: boolean;
  hasThemes: boolean;
  hasClimax: boolean;
  hasCanon: boolean;
  categories: ConstellationCategory[];
};

export function computeArchitectureCoverage(
  architecture: WorldArchitecture,
): ArchitectureCoverage {
  const categories = architecture.visibleConstellations.map(categoryOf);
  const has = (cat: ConstellationCategory) => categories.includes(cat);
  return {
    hasCharacters: has("characters"),
    hasSettings: has("settings"),
    hasThemes: has("themes"),
    hasClimax: has("climax"),
    hasCanon: has("canon"),
    categories,
  };
}

/**
 * Validate a full WorldArchitecture. Produces an AgentValidationResult with
 * hard errors (block) and warnings (allow, but log).
 */
export function validateWorldArchitecture(
  architecture: WorldArchitecture,
): AgentValidationResult {
  const issues: AgentValidationIssue[] = [];

  const constellations = architecture.visibleConstellations;
  const nodes = architecture.startingNodes;

  // ── Anti-vague titles ──────────────────────────────────────────────────────
  for (const c of constellations) {
    if (isVagueConstellationTitle(c.title)) {
      issues.push({
        field: `constellation:${c.id}`,
        message: `Constellation title "${c.title}" is too vague — must be a concrete story-world area.`,
        severity: "error",
      });
    }
  }

  // ── Role coverage ──────────────────────────────────────────────────────────
  const coverage = computeArchitectureCoverage(architecture);
  const requireRole = (
    present: boolean,
    role: string,
    hint: string,
  ) => {
    if (!present) {
      issues.push({
        field: `coverage:${role}`,
        message: `Missing required ${role} constellation (${hint}).`,
        severity: "error",
      });
    }
  };
  requireRole(coverage.hasCharacters, "Characters", "personalities, wounds, tensions");
  requireRole(coverage.hasSettings, "Settings", "places, atmosphere, rules of place");
  requireRole(coverage.hasThemes, "Themes", "moral/emotional/philosophical tensions");
  requireRole(coverage.hasClimax, "Climax / Endgame Pressure", "adaptive endgame pressure");
  requireRole(coverage.hasCanon, "Canon Universe", "accepted truths / evolving world state");

  // ── Climax must be adaptive, not a fixed ending ──────────────────────────────
  for (const c of constellations) {
    if (categoryOf(c) === "climax" && isFixedEndingClimax(c)) {
      issues.push({
        field: `climax:${c.id}`,
        message: `Climax constellation "${c.title}" reveals a fixed ending — it must express possible endgame pressure instead.`,
        severity: "error",
      });
    }
  }

  // ── Node quality ─────────────────────────────────────────────────────────────
  for (const node of nodes) {
    if (isGenericNodeDescription(node.description)) {
      issues.push({
        field: `node:${node.id}`,
        message: `Starting node "${node.title}" has a generic description.`,
        severity: "error",
      });
    }
    if (!node.storyUse || node.storyUse.trim().length < 12) {
      issues.push({
        field: `node:${node.id}:storyUse`,
        message: `Starting node "${node.title}" is missing a concrete storyUse.`,
        severity: "warning",
      });
    }
    if (!node.possibleConflict || node.possibleConflict.trim().length < 12) {
      issues.push({
        field: `node:${node.id}:possibleConflict`,
        message: `Starting node "${node.title}" is missing a concrete possibleConflict.`,
        severity: "warning",
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const valid = errorCount === 0;

  return {
    valid,
    issues,
    summary: valid
      ? `Architecture valid: ${constellations.length} constellations, ${nodes.length} nodes, coverage [${coverage.categories.join(", ")}], ${warningCount} warning(s).`
      : `Architecture invalid: ${errorCount} error(s), ${warningCount} warning(s).`,
  };
}

/** Convenience: does this node carry the Phase 9A story fields? */
export function nodeHasStoryFields(node: StartingNode): boolean {
  return Boolean(
    node.storyUse &&
      node.storyUse.trim().length > 0 &&
      node.possibleConflict &&
      node.possibleConflict.trim().length > 0,
  );
}

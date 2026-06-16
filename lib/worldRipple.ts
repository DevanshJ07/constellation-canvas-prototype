/**
 * Ripple Engine — deterministic consequence of establishing a truth.
 *
 * Each node may define:
 *   supports    — accepted nodes that become stronger / more coherent
 *   contradicts — accepted nodes that now conflict
 *   unlocks     — future nodes that become newly reachable
 */

export type RippleRelations = {
  supports?: string[];
  contradicts?: string[];
  unlocks?: string[];
};

export type RippleState = "supported" | "contradicted" | "unlocked";

export type RippleResult = {
  supported: string[];
  contradicted: string[];
  unlocked: string[];
  coherenceDelta: number;
  nodeTitle: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Ripple relationships keyed by node ID.
// Only list IDs that exist in WORLD_NODES or CONSEQUENCE_BY_ID.
// ─────────────────────────────────────────────────────────────────────────────
export const RIPPLE_MAP: Record<string, RippleRelations> = {

  // ── Mythology ────────────────────────────────────────────────────────────
  "forgotten-temple": {
    supports: ["old-lady", "shrine-below-the-banyan", "temple-of-vanishing-names"],
    contradicts: ["ruined-rain-temple"],
    unlocks: ["temple-caretaker", "buried-idol", "forbidden-prayer"],
  },
  "old-lady": {
    supports: ["forgotten-temple", "village-oracle"],
    contradicts: [],
    unlocks: ["village-oracle", "keeper-of-forgotten-songs"],
  },
  "village-oracle": {
    supports: ["old-lady", "forgotten-temple", "dreaming-children"],
    contradicts: [],
    unlocks: ["woman-who-remembers-the-dead"],
  },
  "temple-of-vanishing-names": {
    supports: ["forgotten-temple", "buried-idol", "memory-erasure-ritual"],
    contradicts: [],
    unlocks: ["forbidden-prayer"],
  },
  "shrine-below-the-banyan": {
    supports: ["forgotten-temple", "banyan-blood", "forgotten-banyan-goddess"],
    contradicts: [],
    unlocks: ["tree-priests"],
  },
  "ruined-rain-temple": {
    supports: ["monsoon-blood-rite", "seventh-night-ritual"],
    contradicts: ["forgotten-temple", "shrine-below-the-banyan"],
    unlocks: [],
  },
  "keeper-of-forgotten-songs": {
    supports: ["old-lady", "blood-memory", "village-oracle"],
    contradicts: [],
    unlocks: ["blood-memory"],
  },
  "woman-who-remembers-the-dead": {
    supports: ["village-oracle", "the-returning-dead", "old-lady"],
    contradicts: [],
    unlocks: ["the-returning-dead"],
  },

  // ── Rituals ──────────────────────────────────────────────────────────────
  "night-ceremonies": {
    supports: ["seventh-night-ritual", "monsoon-blood-rite", "dream-vigil"],
    contradicts: ["forbidden-practices"],
    unlocks: ["ritual-council"],
  },
  "seventh-night-ritual": {
    supports: ["night-ceremonies", "dream-vigil", "blood-pact"],
    contradicts: [],
    unlocks: ["ritual-council", "forbidden-calendar"],
  },
  "monsoon-blood-rite": {
    supports: ["night-ceremonies", "ruined-rain-temple"],
    contradicts: ["soul-binding"],
    unlocks: ["blood-pact"],
  },
  "dream-vigil": {
    supports: ["seventh-night-ritual", "dreaming-children", "the-trees-watch"],
    contradicts: [],
    unlocks: ["dreaming-children"],
  },
  "forbidden-practices": {
    supports: ["memory-erasure-ritual", "soul-binding", "blood-pact"],
    contradicts: ["night-ceremonies"],
    unlocks: ["memory-erasure-ritual"],
  },
  "memory-erasure-ritual": {
    supports: ["forbidden-practices", "temple-of-vanishing-names"],
    contradicts: ["blood-memory", "woman-who-remembers-the-dead"],
    unlocks: ["soul-binding"],
  },
  "soul-binding": {
    supports: ["forbidden-practices", "blood-pact"],
    contradicts: ["ancestral-debt"],
    unlocks: ["blood-pact"],
  },
  "blood-pact": {
    supports: ["soul-binding", "forbidden-practices", "ancestral-debt"],
    contradicts: [],
    unlocks: ["ancestral-debt"],
  },

  // ── Bloodlines ───────────────────────────────────────────────────────────
  "cursed-lineage": {
    supports: ["silent-heirs", "the-hollow-sons", "banyan-blood"],
    contradicts: [],
    unlocks: ["ancestral-debt"],
  },
  "the-marked": {
    supports: ["dreaming-children", "blood-memory", "ancestral-debt"],
    contradicts: [],
    unlocks: ["dreaming-children"],
  },
  "silent-heirs": {
    supports: ["cursed-lineage", "the-hollow-sons"],
    contradicts: [],
    unlocks: [],
  },
  "the-hollow-sons": {
    supports: ["cursed-lineage", "forest-fears", "the-trees-watch"],
    contradicts: [],
    unlocks: ["the-trees-watch"],
  },
  "banyan-blood": {
    supports: ["forgotten-temple", "shrine-below-the-banyan", "cursed-lineage"],
    contradicts: [],
    unlocks: ["forgotten-banyan-goddess"],
  },
  "dreaming-children": {
    supports: ["the-marked", "village-oracle", "dream-vigil"],
    contradicts: [],
    unlocks: ["blood-memory"],
  },
  "blood-memory": {
    supports: ["the-marked", "keeper-of-forgotten-songs", "ancestral-debt"],
    contradicts: [],
    unlocks: [],
  },
  "ancestral-debt": {
    supports: ["the-marked", "cursed-lineage", "blood-pact"],
    contradicts: [],
    unlocks: [],
  },

  // ── Fear ─────────────────────────────────────────────────────────────────
  "forest-fears": {
    supports: ["the-trees-watch", "the-path-that-loops", "the-hollow-sons"],
    contradicts: [],
    unlocks: ["sounds-at-night"],
  },
  "village-dread": {
    supports: ["the-empty-house", "the-unused-well", "door-that-opens-itself"],
    contradicts: [],
    unlocks: ["the-sealed-shrine"],
  },
  "the-trees-watch": {
    supports: ["forest-fears", "sounds-at-night"],
    contradicts: ["the-path-that-loops"],
    unlocks: ["sounds-at-night"],
  },
  "sounds-at-night": {
    supports: ["forest-fears", "the-trees-watch", "monsoon-whispers"],
    contradicts: [],
    unlocks: ["monsoon-whispers"],
  },
  "the-path-that-loops": {
    supports: ["forest-fears"],
    contradicts: ["the-trees-watch"],
    unlocks: [],
  },
  "the-empty-house": {
    supports: ["village-dread"],
    contradicts: [],
    unlocks: ["the-locked-room"],
  },
  "the-unused-well": {
    supports: ["village-dread", "the-dry-well"],
    contradicts: [],
    unlocks: ["the-dry-well"],
  },
  "door-that-opens-itself": {
    supports: ["village-dread", "the-empty-house"],
    contradicts: [],
    unlocks: [],
  },

  // ── Mystery ──────────────────────────────────────────────────────────────
  "abandoned-places": {
    supports: ["the-sealed-shrine", "the-locked-room", "the-dry-well"],
    contradicts: [],
    unlocks: ["the-sealed-shrine"],
  },
  "unexplained-events": {
    supports: ["the-returning-dead", "monsoon-whispers", "the-missing-days"],
    contradicts: [],
    unlocks: ["the-missing-days"],
  },
  "the-sealed-shrine": {
    supports: ["abandoned-places", "forgotten-temple", "shrine-below-the-banyan"],
    contradicts: [],
    unlocks: [],
  },
  "the-locked-room": {
    supports: ["abandoned-places", "the-empty-house"],
    contradicts: [],
    unlocks: [],
  },
  "the-dry-well": {
    supports: ["abandoned-places", "the-unused-well"],
    contradicts: [],
    unlocks: [],
  },
  "the-returning-dead": {
    supports: ["unexplained-events", "woman-who-remembers-the-dead"],
    contradicts: [],
    unlocks: [],
  },
  "monsoon-whispers": {
    supports: ["unexplained-events", "monsoon-blood-rite", "sounds-at-night"],
    contradicts: [],
    unlocks: [],
  },
  "the-missing-days": {
    supports: ["unexplained-events"],
    contradicts: ["woman-who-remembers-the-dead"],
    unlocks: [],
  },

  // ── Consequences ─────────────────────────────────────────────────────────
  "forgotten-banyan-goddess": {
    supports: ["shrine-below-the-banyan", "banyan-blood", "sacred-memory-forest"],
    contradicts: ["ruined-rain-temple"],
    unlocks: ["tree-priests", "pilgrimage-network"],
  },
  "tree-priests": {
    supports: ["forest-laws", "memory-registry", "sacred-memory-forest"],
    contradicts: ["exiled-priesthood"],
    unlocks: ["memory-registry", "exiled-priesthood"],
  },
  "sacred-memory-forest": {
    supports: ["forgotten-banyan-goddess", "tree-priests", "pilgrimage-network"],
    contradicts: [],
    unlocks: [],
  },
  "temple-caretaker": {
    supports: ["forgotten-temple", "buried-idol"],
    contradicts: [],
    unlocks: [],
  },
  "buried-idol": {
    supports: ["forgotten-temple", "temple-caretaker"],
    contradicts: ["ruined-rain-temple"],
    unlocks: ["forbidden-prayer"],
  },
  "forbidden-prayer": {
    supports: ["forgotten-temple", "buried-idol", "temple-caretaker"],
    contradicts: [],
    unlocks: [],
  },
  "memory-registry": {
    supports: ["tree-priests", "memory-tax"],
    contradicts: ["exiled-priesthood"],
    unlocks: ["memory-tax"],
  },
  "memory-tax": {
    supports: ["memory-registry", "pilgrim-rebellion"],
    contradicts: ["tree-priests"],
    unlocks: ["pilgrim-rebellion", "black-memory-market"],
  },
  "exiled-priesthood": {
    supports: ["pilgrim-rebellion"],
    contradicts: ["tree-priests", "forest-laws"],
    unlocks: [],
  },
  "pilgrim-rebellion": {
    supports: ["memory-smugglers", "exiled-priesthood"],
    contradicts: ["forest-laws", "tree-priests"],
    unlocks: ["memory-smugglers"],
  },
  "memory-harvesters": {
    supports: ["spirit-markets", "black-memory-market"],
    contradicts: ["memory-registry"],
    unlocks: ["harvester-guild"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

export function computeRipple(
  nodeId: string,
  nodeTitle: string,
  acceptedIds: string[],
  allAvailableIds: string[],
): RippleResult {
  const relations = RIPPLE_MAP[nodeId] ?? {};
  const acceptedSet = new Set(acceptedIds);
  const availableSet = new Set(allAvailableIds);

  // Supported = listed nodes that are already accepted (excluding the new node itself)
  const supported = (relations.supports ?? []).filter(
    (id) => acceptedSet.has(id) && id !== nodeId,
  );

  // Contradicted = listed nodes that are already accepted
  const contradicted = (relations.contradicts ?? []).filter(
    (id) => acceptedSet.has(id) && id !== nodeId,
  );

  // Unlocked = listed nodes not yet accepted and available to explore
  const unlocked = (relations.unlocks ?? []).filter(
    (id) => !acceptedSet.has(id) && (availableSet.has(id) || true),
  );

  // +2 per support, −3 per contradiction
  const coherenceDelta = supported.length * 2 - contradicted.length * 3 + 1;

  return { supported, contradicted, unlocked, coherenceDelta, nodeTitle };
}

/**
 * Build a flat record of ripple states for all nodes currently in a ripple.
 * Used to pass `rippleState` into node data for visual feedback.
 */
export function buildRippleStateMap(
  result: RippleResult,
  nodeId: string,
): Record<string, RippleState> {
  const map: Record<string, RippleState> = {};
  for (const id of result.supported) map[id] = "supported";
  for (const id of result.contradicted) map[id] = "contradicted";
  for (const id of result.unlocked) map[id] = "unlocked";
  // The node itself is the origin
  map[nodeId] = "supported";
  return map;
}

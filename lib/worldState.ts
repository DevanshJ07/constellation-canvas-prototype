/**
 * Global World State — hidden numeric dimensions.
 * Users never see raw values; only descriptive tensions.
 */

export type WorldDimension =
  | "faith"
  | "fear"
  | "memory"
  | "authority"
  | "bloodlineInfluence"
  | "decay"
  | "mysticism";

export type WorldState = Record<WorldDimension, number>;

export const WORLD_DIMENSIONS: WorldDimension[] = [
  "faith",
  "fear",
  "memory",
  "authority",
  "bloodlineInfluence",
  "decay",
  "mysticism",
];

export function createEmptyWorldState(): WorldState {
  return {
    faith: 0,
    fear: 0,
    memory: 0,
    authority: 0,
    bloodlineInfluence: 0,
    decay: 0,
    mysticism: 0,
  };
}

/** Each established truth shifts one or more dimensions. */
export const TRUTH_STATE_MODIFIERS: Record<string, Partial<WorldState>> = {
  // Mythology
  "forgotten-temple": { faith: 3, memory: 2 },
  "old-lady": { memory: 2, mysticism: 2 },
  "village-oracle": { fear: 2, faith: 1, mysticism: 2 },
  "temple-of-vanishing-names": { memory: 3, faith: 1 },
  "shrine-below-the-banyan": { faith: 2, mysticism: 2 },
  "ruined-rain-temple": { decay: 2, faith: 1 },
  "keeper-of-forgotten-songs": { memory: 2, mysticism: 1 },
  "woman-who-remembers-the-dead": { memory: 3, fear: 1 },

  // Rituals
  "night-ceremonies": { mysticism: 2, authority: 1 },
  "seventh-night-ritual": { mysticism: 3, fear: 1 },
  "monsoon-blood-rite": { faith: 1, bloodlineInfluence: 1 },
  "dream-vigil": { mysticism: 2, memory: 1 },
  "forbidden-practices": { fear: 2, authority: 2 },
  "memory-erasure-ritual": { memory: 3, fear: 1 },
  "soul-binding": { bloodlineInfluence: 2, fear: 2 },
  "blood-pact": { bloodlineInfluence: 3, authority: 1 },

  // Bloodlines
  "cursed-lineage": { bloodlineInfluence: 3, fear: 1 },
  "the-marked": { mysticism: 2, fear: 1 },
  "silent-heirs": { bloodlineInfluence: 2, memory: 1 },
  "the-hollow-sons": { fear: 3, bloodlineInfluence: 1 },
  "banyan-blood": { bloodlineInfluence: 2, faith: 1 },
  "dreaming-children": { mysticism: 2, memory: 2 },
  "blood-memory": { memory: 3, bloodlineInfluence: 1 },
  "ancestral-debt": { bloodlineInfluence: 2, authority: 1 },

  // Fear
  "forest-fears": { fear: 3 },
  "village-dread": { fear: 2, decay: 1 },
  "the-trees-watch": { fear: 2, mysticism: 1 },
  "sounds-at-night": { fear: 2 },
  "the-path-that-loops": { fear: 2, mysticism: 1 },
  "the-empty-house": { fear: 2, decay: 1 },
  "the-unused-well": { fear: 1, decay: 1 },
  "door-that-opens-itself": { fear: 2, mysticism: 1 },

  // Mystery
  "abandoned-places": { decay: 2, fear: 1 },
  "unexplained-events": { mysticism: 2, fear: 1 },
  "the-sealed-shrine": { faith: 1, decay: 2 },
  "the-locked-room": { fear: 2, mysticism: 1 },
  "the-dry-well": { decay: 2, memory: 1 },
  "the-returning-dead": { fear: 2, memory: 2 },
  "monsoon-whispers": { mysticism: 2, fear: 1 },
  "the-missing-days": { memory: 3, fear: 2 },

  // Consequences
  "forgotten-banyan-goddess": { faith: 3, mysticism: 2 },
  "tree-priests": { faith: 2, authority: 3 },
  "sacred-memory-forest": { memory: 3, mysticism: 2 },
  "temple-caretaker": { faith: 2, memory: 1 },
  "buried-idol": { faith: 2, decay: 1 },
  "forbidden-prayer": { faith: 2, mysticism: 2 },
  "memory-tax": { authority: 3, memory: 2 },
  "memory-registry": { authority: 2, memory: 3 },
  "pilgrim-rebellion": { fear: 2, authority: 1 },
  "memory-harvesters": { memory: 2, fear: 1 },
  "memory-smugglers": { fear: 1, authority: 1 },
};

/** Compute aggregate world state from all accepted truth IDs. */
export function computeWorldState(acceptedIds: string[]): WorldState {
  const state = createEmptyWorldState();
  for (const id of acceptedIds) {
    const mods = TRUTH_STATE_MODIFIERS[id];
    if (!mods) continue;
    for (const dim of WORLD_DIMENSIONS) {
      state[dim] += mods[dim] ?? 0;
    }
  }
  return state;
}

type TensionBand = { min: number; rising: string; growing: string; dominant: string };

const TENSION_BANDS: Record<WorldDimension, TensionBand> = {
  faith: {
    min: 3,
    rising: "Faith Rising",
    growing: "Faith Growing",
    dominant: "Faith Dominant",
  },
  fear: {
    min: 3,
    rising: "Fear Rising",
    growing: "Fear Growing",
    dominant: "Fear Dominant",
  },
  memory: {
    min: 3,
    rising: "Memory Stirring",
    growing: "Memory Fragmenting",
    dominant: "Memory Overwhelming",
  },
  authority: {
    min: 3,
    rising: "Authority Consolidating",
    growing: "Authority Tightening",
    dominant: "Authority Absolute",
  },
  bloodlineInfluence: {
    min: 3,
    rising: "Bloodlines Awakening",
    growing: "Bloodlines Rising",
    dominant: "Bloodlines Dominant",
  },
  decay: {
    min: 3,
    rising: "Decay Spreading",
    growing: "Decay Accelerating",
    dominant: "Decay Consuming",
  },
  mysticism: {
    min: 3,
    rising: "Mysticism Deepening",
    growing: "Mysticism Surging",
    dominant: "Mysticism Unbound",
  },
};

/** Descriptive tension labels — never numeric. */
export function describeTensions(state: WorldState): string[] {
  const labels: string[] = [];
  for (const dim of WORLD_DIMENSIONS) {
    const val = state[dim];
    const band = TENSION_BANDS[dim];
    if (val >= band.min * 3) labels.push(band.dominant);
    else if (val >= band.min * 2) labels.push(band.growing);
    else if (val >= band.min) labels.push(band.rising);
  }
  return labels.slice(0, 5);
}

/** Describe shifts caused by a single truth (for ripple modal). */
export function describeStateShifts(
  nodeId: string,
  prevState: WorldState,
  nextState: WorldState,
): string[] {
  const mods = TRUTH_STATE_MODIFIERS[nodeId] ?? {};
  const labels: string[] = [];

  for (const dim of WORLD_DIMENSIONS) {
    const delta = mods[dim] ?? 0;
    if (delta <= 0) continue;
    const band = TENSION_BANDS[dim];
    const prev = prevState[dim];
    const next = nextState[dim];
    if (prev < band.min && next >= band.min) labels.push(band.rising);
    else if (prev < band.min * 2 && next >= band.min * 2) labels.push(band.growing);
    else if (delta >= 2) labels.push(band.rising.replace("Rising", "Strengthened").replace("Stirring", "Strengthened").replace("Consolidating", "Strengthened").replace("Awakening", "Strengthened").replace("Spreading", "Strengthened").replace("Deepening", "Strengthened"));
    else if (delta >= 1) labels.push(band.rising);
  }

  return [...new Set(labels)].slice(0, 4);
}

export function getDominantDimension(state: WorldState): WorldDimension | null {
  let max = 0;
  let dominant: WorldDimension | null = null;
  for (const dim of WORLD_DIMENSIONS) {
    if (state[dim] > max) {
      max = state[dim];
      dominant = dim;
    }
  }
  return max >= 3 ? dominant : null;
}

export const DOMINANT_FUTURES: Record<WorldDimension, string> = {
  faith: "The Forgotten Gods Return",
  fear: "The Village Seals Itself",
  memory: "Identity Becomes Currency",
  authority: "The Council Rules All Paths",
  bloodlineInfluence: "The Bloodlines Unite",
  decay: "The World Begins to Forget Itself",
  mysticism: "The Veil Between Worlds Thins",
};

export function getDynamicFutures(state: WorldState): string[] {
  const dominant = getDominantDimension(state);
  const futures: string[] = [];
  if (dominant) futures.push(DOMINANT_FUTURES[dominant]);

  const sorted = WORLD_DIMENSIONS
    .filter((d) => state[d] >= 3 && d !== dominant)
    .sort((a, b) => state[b] - state[a])
    .slice(0, 2);

  for (const dim of sorted) {
    const alt = DOMINANT_FUTURES[dim];
    if (!futures.includes(alt)) futures.push(alt);
  }

  if (futures.length === 0) {
    return [
      "Forgotten Gods Return",
      "Memory Economy Emerges",
      "The Village Seals Itself",
    ];
  }
  return futures;
}

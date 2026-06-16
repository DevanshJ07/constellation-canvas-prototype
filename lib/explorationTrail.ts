export type TrailNode = {
  id: string;
  title: string;
  tagline: string;
  description: string;
};

export const TRAIL_ROOT = "forgotten-banyan-goddess";

export const TRAIL_NODES: Record<string, TrailNode> = {
  "forgotten-banyan-goddess": {
    id: "forgotten-banyan-goddess",
    title: "Forgotten Banyan Goddess",
    tagline: "A deity erased from living memory",
    description:
      "Once worshipped at every village threshold, she was deliberately forgotten after a catastrophe no elder will name. Her roots still drink from buried recollections. Everything in this world flows from her absence.",
  },
  "memory-trapped-spirits": {
    id: "memory-trapped-spirits",
    title: "Memory-Trapped Spirits",
    tagline: "The dead who cannot release what they knew",
    description:
      "Souls caught between recollection and oblivion, bound to places where memory is thickest. They repeat fragments of the past until someone listens long enough to understand what they are trying to forget.",
  },
  "tree-priests": {
    id: "tree-priests",
    title: "Tree Priests",
    tagline: "Those who sleep among the roots",
    description:
      "Devotees who interpret the goddess's will through patterns in falling leaves. They alone may enter the Memory Forest without surrendering a recollection — and they have grown powerful because of it.",
  },
  "sacred-memory-forest": {
    id: "sacred-memory-forest",
    title: "Sacred Memory Forest",
    tagline: "Where memories pool in the soil",
    description:
      "A grove where walking its paths restores what was forgotten — or traps you inside someone else's past. The trees grow around sealed memory-vessels. The oldest trees remember things no living person witnessed.",
  },
  "pilgrimage-network": {
    id: "pilgrimage-network",
    title: "Pilgrimage Network",
    tagline: "Routes travelled only in darkness",
    description:
      "Ancient paths linking forgotten shrines across the subcontinent, walked only during the dark fortnight. Guides speak exclusively in idioms the uninitiated cannot parse. The network is larger than anyone admits.",
  },
  "banyan-prophecies": {
    id: "banyan-prophecies",
    title: "Banyan Prophecies",
    tagline: "Warnings carved into living bark",
    description:
      "Prophecies that appear on banyan bark overnight — never written by human hand. Villages that ignore them are found empty by the next monsoon. The priests disagree on whether they are gifts or threats.",
  },
  "memory-harvesters": {
    id: "memory-harvesters",
    title: "Memory Harvesters",
    tagline: "They collect what the spirits cannot release",
    description:
      "Figures who gather trapped recollections and trade them in whispered bargains. Their prices are always paid in something you will miss later.",
  },
  "spirit-markets": {
    id: "spirit-markets",
    title: "Spirit Markets",
    tagline: "Night bazaars at the crossroads",
    description:
      "Markets where the dead barter memories for passage. They appear after the third toll of a temple bell and vanish before dawn.",
  },
  "memory-tax": {
    id: "memory-tax",
    title: "Memory Tax",
    tagline: "Every pilgrim pays a tithe in recollection",
    description:
      "The Tree Priests decree that passing through the Sacred Forest requires surrendering one memory, sealed in clay and stored in the goddess's roots. What began as devotion is now compulsion — and compulsion breeds resistance.",
  },
  "forest-laws": {
    id: "forest-laws",
    title: "Forest Laws",
    tagline: "Rules written in bark, enforced in silence",
    description:
      "A code developed by the Tree Priests to govern behaviour within the Sacred Forest. Violators are not punished but forgotten — erased from the memory of everyone who knew them, as if they never existed.",
  },
  "memory-registry": {
    id: "memory-registry",
    title: "Memory Registry",
    tagline: "The most complete record of human experience",
    description:
      "A ledger inscribed on bark recording every memory collected, the pilgrim who surrendered it, and the vessel it was sealed in. Whoever controls the Registry controls what the world chooses to remember — and forget.",
  },
  "black-memory-market": {
    id: "black-memory-market",
    title: "Black Memory Market",
    tagline: "Seized memories, sold back at a price",
    description:
      "Seized memories flow into a hidden bazaar. Buyers often discover they are purchasing their own stolen past — at a price that ensures they can never fully reclaim it.",
  },
  "pilgrim-rebellion": {
    id: "pilgrim-rebellion",
    title: "Pilgrim Rebellion",
    tagline: "They walk with empty vessels as masks",
    description:
      "Pilgrims who refused the Memory Tax organised into a marching resistance. They wear empty clay vessels as masks and demand the return of what was taken.",
  },
  "memory-smugglers": {
    id: "memory-smugglers",
    title: "Memory Smugglers",
    tagline: "Counterfeit memories for the desperate",
    description:
      "A shadow network that substitutes carefully constructed half-truths for the Memory Tax — lies told in the language of memory.",
  },
};

export const TRAIL_GRAPH: Record<string, string[]> = {
  "forgotten-banyan-goddess": [
    "memory-trapped-spirits",
    "tree-priests",
    "sacred-memory-forest",
    "pilgrimage-network",
    "banyan-prophecies",
  ],
  "memory-trapped-spirits": ["memory-harvesters", "spirit-markets"],
  "tree-priests": ["memory-tax", "forest-laws", "memory-registry"],
  "memory-tax": [
    "black-memory-market",
    "pilgrim-rebellion",
    "memory-smugglers",
  ],
};

export function getTrailChildren(id: string): string[] {
  return TRAIL_GRAPH[id] ?? [];
}

export function isTrailTerminal(id: string): boolean {
  return getTrailChildren(id).length === 0;
}

/**
 * Merged direction source for the canvas trail.
 * TRAIL_GRAPH wins if an entry exists; otherwise falls back to
 * ACCEPT_CONSEQUENCES children (imported lazily to avoid circular deps).
 */
export function getWorldDirectionIds(
  id: string,
  acceptConsequences: Record<string, { id: string }[]>,
): string[] {
  if (TRAIL_GRAPH[id]) return TRAIL_GRAPH[id];
  return (acceptConsequences[id] ?? []).map((c) => c.id);
}

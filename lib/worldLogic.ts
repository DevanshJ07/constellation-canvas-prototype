import type { WorldConsequence, WorldRelationship } from "@/types/discovery";

export const WORLD_RELATIONSHIPS: WorldRelationship[] = [
  {
    id: "rel-goddess-spirits",
    sourceId: "forgotten-banyan-goddess",
    targetId: "memory-trapped-spirits",
    label: "CREATED",
  },
  {
    id: "rel-spirits-ritual",
    sourceId: "memory-trapped-spirits",
    targetId: "ritual-of-the-seventh-night",
    label: "REQUIRE",
  },
  {
    id: "rel-ritual-heirs",
    sourceId: "ritual-of-the-seventh-night",
    targetId: "bloodline-of-silent-heirs",
    label: "CREATED",
  },
  {
    id: "rel-heirs-shrine",
    sourceId: "bloodline-of-silent-heirs",
    targetId: "abandoned-village-shrine",
    label: "GUARD",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Consequence chains
//
// Keyed by ANY node ID — discovery or consequence.
// Establishing (accepting) that node reveals these children.
//
// CHAIN 1: Forgotten Banyan Goddess → Tree Priests / Sacred Memory Forest / Pilgrimage Network
// CHAIN 2: Tree Priests             → Memory Tax / Memory Registry / Memory Smugglers
// CHAIN 3: Memory Tax               → Pilgrim Rebellion / Black Memory Market / Forest Civil War
//
// Additional chains from other discoveries remain intact.
// ─────────────────────────────────────────────────────────────────────────────
export const ACCEPT_CONSEQUENCES: Record<string, WorldConsequence[]> = {

  // ── CHAIN 1 ───────────────────────────────────────────────────────────────
  "forgotten-banyan-goddess": [
    {
      id: "tree-priests",
      title: "Tree Priests",
      category: "Order",
      description:
        "Devotees who sleep among banyan roots and interpret the goddess's will through patterns in falling leaves. They alone may enter the Memory Forest without surrendering a recollection.",
      whyItMatters:
        "An organised faith means the goddess was once powerful enough to inspire hierarchy — and that hierarchy has survived her absence.",
      parentId: "forgotten-banyan-goddess",
    },
    {
      id: "sacred-memory-forest",
      title: "Sacred Memory Forest",
      category: "Location",
      description:
        "A grove where memories pool in the soil. Walking its paths restores what was forgotten — or traps you inside someone else's past.",
      whyItMatters:
        "The goddess has a physical domain. Controlling this territory means controlling access to the past itself.",
      parentId: "forgotten-banyan-goddess",
    },
    {
      id: "pilgrimage-network",
      title: "Pilgrimage Network",
      category: "Hidden Structure",
      description:
        "Routes linking forgotten shrines across the subcontinent, travelled only during the dark fortnight. Guides speak only in idioms the uninitiated cannot parse.",
      whyItMatters:
        "The goddess's reach is wider than any single village. Every stop on the network is another piece of a forgotten truth.",
      parentId: "forgotten-banyan-goddess",
    },
  ],

  // ── CHAIN 2 ───────────────────────────────────────────────────────────────
  "tree-priests": [
    {
      id: "memory-tax",
      title: "Memory Tax",
      category: "Law",
      description:
        "The Tree Priests decree that every pilgrim passing through the Sacred Forest must surrender one memory as a tithe. The memory is sealed in a clay vessel and stored in the roots of the goddess's tree.",
      whyItMatters:
        "Power has formalised into law. What was once devotion is now compulsion — and compulsion breeds resistance.",
      parentId: "tree-priests",
    },
    {
      id: "memory-registry",
      title: "Memory Registry",
      category: "Institution",
      description:
        "A ledger inscribed on bark recording every memory collected, the pilgrim who surrendered it, and the vessel it was sealed in. The Registry is the most complete record of human experience in the known world.",
      whyItMatters:
        "Whoever controls the Registry controls what the world chooses to remember — and what it chooses to forget.",
      parentId: "tree-priests",
    },
    {
      id: "memory-smugglers",
      title: "Memory Smugglers",
      category: "Faction",
      description:
        "A shadow network that helps pilgrims bypass the Memory Tax by substituting counterfeit memories — carefully constructed half-truths that satisfy the priests without giving anything real away.",
      whyItMatters:
        "Resistance has organised. The world now contains people who know how to lie in the language of memory.",
      parentId: "tree-priests",
    },
  ],

  // ── CHAIN 3 ───────────────────────────────────────────────────────────────
  "memory-tax": [
    {
      id: "pilgrim-rebellion",
      title: "Pilgrim Rebellion",
      category: "Conflict",
      description:
        "Pilgrims who refused the Memory Tax organised into a marching resistance. They walk with empty clay vessels worn as masks, demanding the return of what was taken.",
      whyItMatters:
        "The goddess's legacy is now a political crisis. The world is dividing along the line of what people are willing to surrender.",
      parentId: "memory-tax",
    },
    {
      id: "black-memory-market",
      title: "Black Memory Market",
      category: "Location",
      description:
        "Seized memories flow into a hidden bazaar where they are sold back to those who can pay. The cruelest sellers offer a pilgrim their own past — at a price that ensures they can never fully reclaim it.",
      whyItMatters:
        "The sacred is now for sale. The goddess's domain has been commercialised by the very order sworn to protect it.",
      parentId: "memory-tax",
    },
    {
      id: "forest-civil-war",
      title: "Forest Civil War",
      category: "Conflict",
      description:
        "The Tree Priests fracture between the Taxers — who believe the tithe sustains the goddess — and the Protectors, who argue it is slowly killing her. The sacred grove is now a war zone.",
      whyItMatters:
        "The institution that protected the goddess has become the greatest threat to her survival. Truth has consequences that cannot be contained.",
      parentId: "memory-tax",
    },
  ],

  // ── Supporting chains (other discoveries) ────────────────────────────────
  "memory-trapped-spirits": [
    {
      id: "memory-harvesters",
      title: "Memory Harvesters",
      category: "Faction",
      description:
        "Figures who collect trapped recollections and trade them in whispered bargains. Their prices are always paid in something you will miss later.",
      whyItMatters:
        "An economy of memory exists. Suffering has a market value in this world.",
      parentId: "memory-trapped-spirits",
    },
    {
      id: "spirit-markets",
      title: "Spirit Markets",
      category: "Location",
      description:
        "Night bazaars where the dead barter memories for passage. They appear at crossroads after the third toll of a temple bell.",
      whyItMatters:
        "The spirit world is spatially navigable and commercially structured.",
      parentId: "memory-trapped-spirits",
    },
  ],
  "ritual-of-the-seventh-night": [
    {
      id: "ritual-council",
      title: "Ritual Council",
      category: "Institution",
      description:
        "Elders who decide which ceremonies may be performed and which must remain buried. Their votes are cast in silence.",
      whyItMatters:
        "Governance of the supernatural implies political conflict over who controls access to power.",
      parentId: "ritual-of-the-seventh-night",
    },
    {
      id: "forbidden-calendar",
      title: "Forbidden Calendar",
      category: "Artifact",
      description:
        "A lunar almanac marking nights when the veil thins. Each forbidden date carries a name no living person should speak aloud.",
      whyItMatters:
        "Time itself becomes dangerous — knowing the calendar is both power and curse.",
      parentId: "ritual-of-the-seventh-night",
    },
  ],
  "memory-harvesters": [
    {
      id: "harvester-guild",
      title: "Harvester Guild",
      category: "Organisation",
      description:
        "A clandestine brotherhood that has formalised the trade of stolen memories, using a sign only recognisable to those who have already lost something.",
      whyItMatters:
        "What begins as individual exploitation becomes systemic — an organised underworld of grief.",
      parentId: "memory-harvesters",
    },
  ],
  "ritual-council": [
    {
      id: "council-archives",
      title: "Council Archives",
      category: "Location",
      description:
        "A sealed chamber holding records of every ritual ever judged forbidden. The door has no lock — only those deemed worthy may enter without consequence.",
      whyItMatters:
        "Knowledge of every forbidden act exists, waiting for someone with the wrong intentions.",
      parentId: "ritual-council",
    },
  ],
};

// Depth-aware position offsets so nested consequences fan outward clearly.
const OFFSETS_BY_DEPTH = [
  [
    { x: 160, y: -60 },
    { x: 185, y: 20 },
    { x: 160, y: 100 },
  ],
  [
    { x: 155, y: -50 },
    { x: 170, y: 30 },
    { x: 155, y: 110 },
  ],
];

export function getConsequencePosition(
  parentPosition: { x: number; y: number },
  index: number,
  depth = 0,
) {
  const offsets =
    OFFSETS_BY_DEPTH[Math.min(depth, OFFSETS_BY_DEPTH.length - 1)];
  const offset = offsets[index % offsets.length];
  return {
    x: parentPosition.x + offset.x,
    y: parentPosition.y + offset.y,
  };
}

/** All descendant consequence IDs reachable from `id`, at any depth. */
export function getAllDescendantIds(id: string): string[] {
  const children = ACCEPT_CONSEQUENCES[id] ?? [];
  return children.flatMap((c) => [c.id, ...getAllDescendantIds(c.id)]);
}

/** Flat lookup of every consequence by its id. */
export const CONSEQUENCE_BY_ID: Record<string, WorldConsequence> = (() => {
  const map: Record<string, WorldConsequence> = {};
  for (const list of Object.values(ACCEPT_CONSEQUENCES)) {
    for (const c of list) map[c.id] = c;
  }
  return map;
})();

/** IDs of the possible directions (consequences) branching from a node. */
export function getDirectionIds(id: string): string[] {
  return (ACCEPT_CONSEQUENCES[id] ?? []).map((c) => c.id);
}

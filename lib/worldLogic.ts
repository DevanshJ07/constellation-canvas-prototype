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

// Keyed by any node ID (discovery or consequence).
// Accepting that node reveals these children.
export const ACCEPT_CONSEQUENCES: Record<string, WorldConsequence[]> = {
  // ── Depth 1: from discoveries ────────────────────────────────────────────
  "forgotten-banyan-goddess": [
    {
      id: "tree-priests",
      title: "Tree Priests",
      category: "Order",
      description:
        "Devotees who sleep among banyan roots and interpret the goddess's will through patterns in falling leaves.",
      whyItMatters:
        "An organised faith means the goddess was once powerful enough to inspire hierarchy — and may be again.",
      parentId: "forgotten-banyan-goddess",
    },
    {
      id: "sacred-memory-forest",
      title: "Sacred Memory Forest",
      category: "Location",
      description:
        "A grove where memories pool in the soil. Walking its paths restores what was forgotten — or traps you inside someone else's past.",
      whyItMatters:
        "Gives the goddess a physical domain and raises the stakes of entering her territory.",
      parentId: "forgotten-banyan-goddess",
    },
    {
      id: "pilgrimage-network",
      title: "Pilgrimage Network",
      category: "Hidden Structure",
      description:
        "Routes linking forgotten shrines across the subcontinent, travelled only during the dark fortnight.",
      whyItMatters:
        "Implies the goddess's reach is wider than any single village — there are more forgotten places.",
      parentId: "forgotten-banyan-goddess",
    },
  ],
  "memory-trapped-spirits": [
    {
      id: "memory-harvesters",
      title: "Memory Harvesters",
      category: "Faction",
      description:
        "Figures who collect trapped recollections and trade them in whispered bargains. Their prices are always paid in something you will miss later.",
      whyItMatters:
        "Introduces an economy of memory — suffering has a market value in this world.",
      parentId: "memory-trapped-spirits",
    },
    {
      id: "spirit-markets",
      title: "Spirit Markets",
      category: "Location",
      description:
        "Night bazaars where the dead barter memories for passage. They appear at crossroads after the third toll of a temple bell.",
      whyItMatters:
        "Makes the spirit world spatially navigable and commercially structured.",
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

  // ── Depth 2: from consequences ────────────────────────────────────────────
  "tree-priests": [
    {
      id: "bark-scripture",
      title: "Bark Scripture",
      category: "Artifact",
      description:
        "Prayers carved into living wood that bleed when read aloud. Each scripture is unique to the tree it was carved from.",
      whyItMatters:
        "Sacred texts that are also living things — destroying the tree destroys the knowledge.",
      parentId: "tree-priests",
    },
    {
      id: "forest-watchers",
      title: "Forest Watchers",
      category: "Role",
      description:
        "Priests tasked with monitoring the boundary where the sacred grove meets the open world. They have not spoken in years.",
      whyItMatters:
        "A silent sentinel class suggests the grove has been disturbed before — and the watchers know why.",
      parentId: "tree-priests",
    },
  ],
  "memory-harvesters": [
    {
      id: "harvester-guild",
      title: "Harvester Guild",
      category: "Organisation",
      description:
        "A clandestine brotherhood that has formalised the trade of stolen memories. They use a secret sign only recognisable to those who have already lost something.",
      whyItMatters:
        "What begins as individual exploitation becomes systemic — an organised underworld of grief.",
      parentId: "memory-harvesters",
    },
    {
      id: "memory-black-market",
      title: "Memory Black Market",
      category: "Location",
      description:
        "A hidden market where memories are bottled and sold. Buyers often discover they have purchased their own stolen past.",
      whyItMatters:
        "Creates a cycle of loss and reclamation that can drive story after story.",
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
        "Knowledge of every forbidden act exists somewhere, waiting to be found by someone with the wrong intentions.",
      parentId: "ritual-council",
    },
  ],
};

// Depth-aware offsets so nested consequences fan outward clearly.
const OFFSETS_BY_DEPTH = [
  [
    { x: 155, y: -55 },
    { x: 180, y: 18 },
    { x: 155, y: 88 },
  ],
  [
    { x: 150, y: -50 },
    { x: 168, y: 28 },
  ],
];

export function getConsequencePosition(
  parentPosition: { x: number; y: number },
  index: number,
  depth = 0,
) {
  const offsets = OFFSETS_BY_DEPTH[Math.min(depth, OFFSETS_BY_DEPTH.length - 1)];
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

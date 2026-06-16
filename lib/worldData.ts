import type { ConstellationRegionId } from "@/lib/regions";

export type WorldNode = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  whyItMatters?: string;
};

// ── All nodes in the world ────────────────────────────────────────────────────
export const WORLD_NODES: Record<string, WorldNode> = {

  // ── MYTHOLOGY virtual root ────────────────────────────────────────────────
  mythology: {
    id: "mythology",
    title: "Mythology",
    tagline: "The founding stories of a world shaped by forgetting",
    description:
      "Mythology in this world is not legend — it is suppressed truth. Temples were built, deities were worshipped, and then both were deliberately forgotten. What remains are ruins, old women who still remember, and a silence that is not quite silence.",
    whyItMatters:
      "Mythology is the bedrock. Every fear, ritual, and bloodline in this world traces back to a story someone tried to erase.",
  },

  // ── MYTHOLOGY — Parent Nodes ──────────────────────────────────────────────
  "forgotten-temple": {
    id: "forgotten-temple",
    title: "Forgotten Temple",
    tagline: "A place of worship nobody will admit existed",
    description:
      "Somewhere in the forest — nobody agrees where — there is a temple that does not appear on any map. People who stumble upon it report that the idols have no faces. By the time they return with others, the path has changed.",
    whyItMatters:
      "A forgotten temple implies a forgotten god, and forgotten gods do not disappear — they accumulate grievance.",
  },
  "old-lady": {
    id: "old-lady",
    title: "Old Lady",
    tagline: "The oldest woman in the village knows everything and says nothing",
    description:
      "Every village has one. She was old when the village's oldest elder was a child. She does not speak unless she chooses to, and when she does, the words are never comfortable. She has outlived several explanations for her age.",
    whyItMatters:
      "She is a living archive. The mythology lives inside her. What she refuses to say is as important as what she does.",
  },

  // ── MYTHOLOGY — Forgotten Temple children ────────────────────────────────
  "temple-of-vanishing-names": {
    id: "temple-of-vanishing-names",
    title: "Temple of Vanishing Names",
    tagline: "Enter with your name. Leave without it.",
    description:
      "A temple where carved inscriptions slowly erase themselves. Priests who served here for more than a year lost the ability to remember their own names. The last priest left his name on the threshold stone. The stone is now blank.",
    whyItMatters:
      "This is where identity dissolves. A world with a place that takes names is a world where identity itself is fragile.",
  },
  "shrine-below-the-banyan": {
    id: "shrine-below-the-banyan",
    title: "Shrine Below the Banyan Tree",
    tagline: "The tree grew around the shrine, not the other way around",
    description:
      "A small stone shrine swallowed by a thousand-year-old banyan tree. The roots have cracked the offerings bowl but not the idol inside. Villagers leave gifts at the exposed roots without knowing why — it is something their hands do without instruction.",
    whyItMatters:
      "The instinct to worship something they cannot see or explain is the most honest thing this village does.",
  },
  "ruined-rain-temple": {
    id: "ruined-rain-temple",
    title: "Ruined Rain Temple",
    tagline: "Destroyed in the monsoon it was built to appease",
    description:
      "The temple was destroyed thirty-two years ago during the worst monsoon in living memory. Nobody remembers who built it or what deity it housed. The ruins attract rain — even in dry season, this clearing is always damp.",
    whyItMatters:
      "A god whose temple was destroyed by the thing they controlled suggests either betrayal or punishment. The story has not ended.",
  },

  // ── MYTHOLOGY — Old Lady children ─────────────────────────────────────────
  "village-oracle": {
    id: "village-oracle",
    title: "Village Oracle",
    tagline: "She answers questions you have not asked yet",
    description:
      "She does not predict the future. She describes it as though it has already happened, in a tone of mild disappointment. She has been doing this her entire life. Nobody in the village fully believes her. Nobody has ever proven her wrong.",
    whyItMatters:
      "A world with a reliable oracle is a world that has already decided what will happen. The horror is in watching it approach.",
  },
  "keeper-of-forgotten-songs": {
    id: "keeper-of-forgotten-songs",
    title: "Keeper of Forgotten Songs",
    tagline: "She sings what nobody else remembers",
    description:
      "She knows songs that predate the village by centuries — funeral rites for gods, lullabies for the dying, work songs for tasks that no longer exist. The melodies are unbearably sad. People who hear her sing often cannot remember the tune afterward but weep at odd moments for days.",
    whyItMatters:
      "Music that cannot be retained but still affects you is grief operating below the level of consciousness.",
  },
  "woman-who-remembers-the-dead": {
    id: "woman-who-remembers-the-dead",
    title: "Woman Who Remembers the Dead",
    tagline: "She recalls their last thought, not their last words",
    description:
      "She can recall the final conscious thought of anyone who died within a kilometre of where she stands. She does not share this unless asked, and she charges nothing — but she always looks slightly sadder afterward. She has lived in this village for eighty years.",
    whyItMatters:
      "If you know what people were thinking when they died, you know what they were afraid of. This woman is a library of last fears.",
  },

  // ── RITUALS virtual root ───────────────────────────────────────────────────
  rituals: {
    id: "rituals",
    title: "Rituals",
    tagline: "Ceremonies whose purpose has outlasted their meaning",
    description:
      "Every ritual in this world was invented to contain something that could not be contained any other way. The containment never worked perfectly. The rituals remain.",
    whyItMatters:
      "Rituals are codified fear. Understanding them means understanding what people in this world are most afraid of losing.",
  },

  // ── RITUALS — Parent Nodes ────────────────────────────────────────────────
  "night-ceremonies": {
    id: "night-ceremonies",
    title: "Night Ceremonies",
    tagline: "Performed only in darkness, only in silence",
    description:
      "A category of ritual that cannot be performed in daylight. The daylight versions exist — sanitised, public, approved — but practitioners know they accomplish nothing. The real ceremonies happen at 2 AM, in houses with all the lamps extinguished.",
    whyItMatters:
      "Anything that only works in darkness implies that the source of power is something that daylight would destroy or expose.",
  },
  "forbidden-practices": {
    id: "forbidden-practices",
    title: "Forbidden Practices",
    tagline: "The rituals that work too well",
    description:
      "The village council banned certain rituals not because they were ineffective but because they were too effective. The results were consistent and terrible. The records of what exactly happened were destroyed. The knowledge was not.",
    whyItMatters:
      "A banned ritual with documented effectiveness suggests that someone, somewhere, used it successfully. The question is what they were willing to pay.",
  },

  // ── RITUALS — Night Ceremonies children ───────────────────────────────────
  "seventh-night-ritual": {
    id: "seventh-night-ritual",
    title: "The Seventh Night",
    tagline: "Observed once, then outlawed, still practiced",
    description:
      "On the seventh consecutive night of rain, certain families observe a ritual whose details are not publicly shared. Children born into these families learn it without being taught — they simply know it, in the same way they know hunger.",
    whyItMatters:
      "A ritual that transmits itself through blood is no longer a ritual. It is a biological instruction.",
  },
  "monsoon-blood-rite": {
    id: "monsoon-blood-rite",
    title: "Monsoon Blood Rite",
    tagline: "The rains require a price",
    description:
      "Before the first rain of the season, a small cut is made on the left palm and the blood allowed to fall into the earth. This is practiced by every family in the village and none of them will admit it publicly. The crops that follow always justify it.",
    whyItMatters:
      "When an unofficial practice produces reliable results, it becomes harder to classify as superstition.",
  },
  "dream-vigil": {
    id: "dream-vigil",
    title: "The Dream Vigil",
    tagline: "Three nights without sleep, to see what wants to be seen",
    description:
      "A practice of deliberate sleep deprivation that is said to open perception to presences that operate between waking and dreaming. Practitioners report consistency: the same figures appear to different people, making the same gestures, in the same locations.",
    whyItMatters:
      "Consistent hallucinations across independent observers are not hallucinations.",
  },

  // ── RITUALS — Forbidden Practices children ────────────────────────────────
  "memory-erasure-ritual": {
    id: "memory-erasure-ritual",
    title: "Memory Erasure",
    tagline: "A ceremony for making someone forget you exist",
    description:
      "A ritual that, if performed correctly, causes a specific person to have no memory of your existence. Photographs of you in their possession become unrecognisable. Your name in their diary becomes illegible. It works. The side effect is that you begin to forget yourself too.",
    whyItMatters:
      "Identity is relational. If nobody remembers you, you become uncertain of whether you exist.",
  },
  "soul-binding": {
    id: "soul-binding",
    title: "Soul Binding",
    tagline: "Two people, one fate",
    description:
      "A ritual that creates an involuntary connection between two people's life force. What injures one weakens the other. When one dies, the other follows within a season. The ritual requires consent from neither party. It was outlawed after a high-caste family used it on a servant girl.",
    whyItMatters:
      "Power over someone's fate without their consent is the clearest possible definition of what is wrong with this world.",
  },
  "blood-pact": {
    id: "blood-pact",
    title: "The Blood Pact",
    tagline: "An agreement that enforces itself",
    description:
      "A contract sealed with mixed blood that binds both parties physiologically. Breaking the pact causes physical symptoms — fever, hallucinations, hemorrhaging — that worsen until the violated term is fulfilled or the other party dies. It cannot be broken by forgetting you made it.",
    whyItMatters:
      "Commitments that enforce themselves regardless of intent are the world's way of making people accountable to their worst promises.",
  },

  // ── BLOODLINES virtual root ───────────────────────────────────────────────
  bloodlines: {
    id: "bloodlines",
    title: "Bloodlines",
    tagline: "What passes through families when nobody is watching",
    description:
      "Bloodlines in this world carry more than genetics. They carry obligations, memories, curses, and the residue of everything the family line has ever survived. Inheritance here is not a gift — it is a debt.",
    whyItMatters:
      "The horror of bloodlines is that you did not choose your inheritance. Whatever your ancestors did follows you.",
  },

  // ── BLOODLINES — Parent Nodes ─────────────────────────────────────────────
  "cursed-lineage": {
    id: "cursed-lineage",
    title: "Cursed Lineage",
    tagline: "A family that keeps paying for something it no longer remembers doing",
    description:
      "Some family lines carry a specific recurring catastrophe — every third generation loses their voice, every second son disappears, first daughters are born with cataracts that clear at age seven. The family has stopped trying to cure it. They have started trying to understand what it is a punishment for.",
    whyItMatters:
      "Generational curses are ancestral stories that were never allowed to end.",
  },
  "the-marked": {
    id: "the-marked",
    title: "The Marked",
    tagline: "Born different, without explanation",
    description:
      "Occasionally, a child is born into an ordinary family with an extraordinary characteristic — the inability to dream, perfect recollection of events they did not witness, the capacity to speak in languages no one taught them. The village has a name for these children. The children have learned not to ask what it means.",
    whyItMatters:
      "Children who are born as anomalies become the axis around which everyone else's beliefs about the world are organised.",
  },

  // ── BLOODLINES — Cursed Lineage children ─────────────────────────────────
  "silent-heirs": {
    id: "silent-heirs",
    title: "Silent Heirs",
    tagline: "They inherited the silence, not the estate",
    description:
      "A family whose children are born mute in every second generation. They have developed a sophisticated gesture language that outsiders describe as unsettling — not because it is difficult to understand, but because it is beautiful in a way that suggests long practice with loss.",
    whyItMatters:
      "People who cannot speak develop other forms of communication. What they communicate without words is always more honest.",
  },
  "the-hollow-sons": {
    id: "the-hollow-sons",
    title: "The Hollow Sons",
    tagline: "Boys who return from the forest different",
    description:
      "A family whose male children, upon reaching puberty, must spend seven nights in the forest alone as a rite of passage. They all return. But two out of every five return changed in a way nobody can specify — not ill, not traumatised, simply different. Their families accept them. Their wives, years later, report that their husbands sometimes stare at them as though trying to remember their faces.",
    whyItMatters:
      "If a rite of passage reliably changes some people in an unspecifiable way, the forest is doing something the ritual is only pretending to control.",
  },
  "banyan-blood": {
    id: "banyan-blood",
    title: "Banyan Blood",
    tagline: "Their veins run with something older than the village",
    description:
      "A lineage that traces its ancestry to a priest of the Forgotten Temple. Their blood, when drawn, is slightly darker than normal and does not clot at the same rate. They can navigate the forest in complete darkness. They do not discuss this.",
    whyItMatters:
      "A bloodline with physical evidence of non-human influence changes what is possible in this world.",
  },

  // ── BLOODLINES — The Marked children ──────────────────────────────────────
  "dreaming-children": {
    id: "dreaming-children",
    title: "The Dreaming Children",
    tagline: "They dream what has not happened yet",
    description:
      "Children who, between the ages of four and eleven, experience predictive dreams with verifiable accuracy. The dreams stop at puberty. The children never speak of them again. Some become oracles. Most become very quiet adults who flinch at rain.",
    whyItMatters:
      "Prophecy that ends at puberty suggests that whatever is doing the prophesying abandons the child when they become an adult. The question is why.",
  },
  "blood-memory": {
    id: "blood-memory",
    title: "Blood Memory",
    tagline: "They remember things that happened to their ancestors",
    description:
      "A subset of Marked children who experience their ancestors' memories as their own — not as stories, but as sensory experiences. A child born in the village may know the smell of a city that was destroyed two hundred years ago because a great-great-grandmother escaped from it.",
    whyItMatters:
      "Memory that transcends individual lifetimes blurs the boundary between personal history and ancestral inheritance.",
  },
  "ancestral-debt": {
    id: "ancestral-debt",
    title: "Ancestral Debt",
    tagline: "They owe something they never borrowed",
    description:
      "Certain Marked children are born with a specific compulsion — an action they feel driven to perform that turns out to be the completion of something an ancestor promised and never delivered. The debt is not metaphorical. It has terms, conditions, and a creditor.",
    whyItMatters:
      "A world where you can be held responsible for promises you never made is a world where personal sovereignty is a fiction.",
  },

  // ── FEAR virtual root ─────────────────────────────────────────────────────
  fear: {
    id: "fear",
    title: "Fear",
    tagline: "The specific fears that only this village understands",
    description:
      "Every community develops its own taxonomy of fear — particular shapes of dread that outsiders find irrational and locals find obvious. This village's fears are very specific, very local, and entirely justified.",
    whyItMatters:
      "Fear that is specific and local is not superstition. It is documentation.",
  },

  // ── FEAR — Parent Nodes ───────────────────────────────────────────────────
  "forest-fears": {
    id: "forest-fears",
    title: "The Forest",
    tagline: "Not haunted. Attentive.",
    description:
      "The forest outside the village is not dangerous in any way that can be named or measured. People who enter it return physically unharmed. The psychological effects take longer to manifest. After three visits, most people stop going in. They cannot explain why.",
    whyItMatters:
      "A danger that cannot be specified is harder to protect against than one that can be named.",
  },
  "village-dread": {
    id: "village-dread",
    title: "Village Horrors",
    tagline: "The ordinary made unbearable",
    description:
      "Some of the most documented fears in the village concern entirely ordinary objects and locations — a well, a house, a door. These things are not supernaturally wrong. They are simply impossible to look at without feeling that something has already gone wrong and you have only just noticed.",
    whyItMatters:
      "Horror that attaches to ordinary objects cannot be avoided by avoiding extraordinary situations.",
  },

  // ── FEAR — Forest children ────────────────────────────────────────────────
  "sounds-at-night": {
    id: "sounds-at-night",
    title: "Sounds at Night",
    tagline: "Not animals. Something that knows you are listening.",
    description:
      "The forest produces sounds at night that no catalogued animal makes. They are not threatening — they are conversational. Researchers who have camped at the forest edge report feeling strongly that the sounds are about them, specifically. None have returned more than twice.",
    whyItMatters:
      "Something that behaves as though it is aware of you, and responds accordingly, has crossed the line from phenomenon to presence.",
  },
  "the-trees-watch": {
    id: "the-trees-watch",
    title: "The Trees Watch",
    tagline: "They face you. Even the ones you did not walk toward.",
    description:
      "Villagers describe the sensation in the forest of trees orienting toward them — not moving, but somehow facing them regardless of which direction they approach from. Photographs taken in the forest show normal trees. The sensation is unaffected by photographic evidence.",
    whyItMatters:
      "Being watched by something you cannot catch watching you is the experience of being surveilled without recourse.",
  },
  "the-path-that-loops": {
    id: "the-path-that-loops",
    title: "The Path That Loops",
    tagline: "You will arrive at the start. Eventually.",
    description:
      "One path in the forest is known to loop. People who take it walk for hours in a straight line and emerge exactly where they entered. The path shows no curvature. GPS devices, when they function, confirm the walker moved in a straight line. The forest disagrees.",
    whyItMatters:
      "Space that does not behave as expected suggests the forest operates under different rules than the village — and the forest is winning the boundary dispute.",
  },

  // ── FEAR — Village children ───────────────────────────────────────────────
  "the-empty-house": {
    id: "the-empty-house",
    title: "The Empty House",
    tagline: "The family left. The house has not noticed.",
    description:
      "A house at the north end of the village whose occupants left forty years ago. The house is structurally sound, has not been sold, and shows no signs of deterioration. People do not walk on the same side of the road as it. When asked why, they look briefly uncertain and then change the subject.",
    whyItMatters:
      "A house that people avoid without being able to explain why has established its own presence in the village's psychological landscape.",
  },
  "the-unused-well": {
    id: "the-unused-well",
    title: "The Well Nobody Uses",
    tagline: "The water is fine. People have tested it. Nobody drinks it.",
    description:
      "A well in the village square whose water tests clean and tastes normal. It has been tested by the village council, a visiting engineer, and two curious journalists. Nobody who tests it will drink it. Nobody can explain this. The well remains unused.",
    whyItMatters:
      "Rational knowledge that overrides no actual behavior is evidence of a fear too deep to be addressed by information.",
  },
  "door-that-opens-itself": {
    id: "door-that-opens-itself",
    title: "The Door That Opens Itself",
    tagline: "Not wind. Not settling. Just open when you look.",
    description:
      "A door in the village hall that is found open every morning regardless of how it was secured the night before. It has been replaced three times. Cameras installed to record the opening show the door closed, then open, with no intervening footage. The gap in the recording is never more than a frame.",
    whyItMatters:
      "Physical evidence of something that cannot be recorded suggests that whatever is opening the door understands how recording works.",
  },

  // ── MYSTERY virtual root ──────────────────────────────────────────────────
  mystery: {
    id: "mystery",
    title: "Mystery",
    tagline: "Events without explanation, which is a kind of explanation",
    description:
      "The village has developed a taxonomy of inexplicable events. These are not dismissed as coincidence — they are carefully documented, compared with previous occurrences, and filed. The filing has been ongoing for one hundred and forty years. The pattern has not yet been named.",
    whyItMatters:
      "A community that documents its mysteries without explaining them has accepted that explanation is not always possible. This is both humble and terrifying.",
  },

  // ── MYSTERY — Parent Nodes ────────────────────────────────────────────────
  "abandoned-places": {
    id: "abandoned-places",
    title: "Abandoned Places",
    tagline: "Left behind for reasons nobody will repeat",
    description:
      "The village has several locations that have been abandoned without satisfactory public explanation. The official reasons vary — structural failure, ownership disputes, flooding. The unofficial reasons are more consistent and more disturbing and are never officially acknowledged.",
    whyItMatters:
      "Places that people abandon without being able to say why accumulate meaning precisely because the reason is unspeakable.",
  },
  "unexplained-events": {
    id: "unexplained-events",
    title: "Unexplained Events",
    tagline: "Catalogued, compared, never resolved",
    description:
      "Events that have no causal explanation but recur with enough regularity to be considered part of the village's annual calendar. Nobody enjoys them. Nobody has stopped them. They are simply noted and endured.",
    whyItMatters:
      "Recurring inexplicable events that are simply endured rather than investigated suggest the community has made a calculation about what is survivable.",
  },

  // ── MYSTERY — Abandoned Places children ───────────────────────────────────
  "the-sealed-shrine": {
    id: "the-sealed-shrine",
    title: "The Sealed Shrine",
    tagline: "Bricked up in 1987. The bricks are warm.",
    description:
      "A shrine at the edge of the village that was sealed shut by the village council in 1987 following an unspecified event. The brickwork is always warm to the touch regardless of ambient temperature. The council records from that year are missing.",
    whyItMatters:
      "Authorities who brick up shrines and then lose the documentation are covering something they could not explain or control.",
  },
  "the-locked-room": {
    id: "the-locked-room",
    title: "The Locked Room",
    tagline: "It was locked from the inside. There was nobody inside.",
    description:
      "A room in the oldest house in the village that was discovered locked from the inside with no occupant. The door was broken down. The room was empty except for a chair facing the corner and a smell of incense that has never fully dissipated despite the room being ventilated for thirty years.",
    whyItMatters:
      "A room locked from the inside with no one inside represents a simple logical impossibility. The room is still there.",
  },
  "the-dry-well": {
    id: "the-dry-well",
    title: "The Dry Well",
    tagline: "Dry since 1954. Still makes sounds.",
    description:
      "A well at the north end of the village that went dry in 1954. It still produces sounds — water sounds, specifically, in rhythm with rainfall occurring hundreds of kilometres away. No hydrological explanation has been offered. The well is fenced off. The sounds continue.",
    whyItMatters:
      "Something that responds to distant events it has no physical connection to suggests a form of perception.",
  },

  // ── MYSTERY — Unexplained Events children ─────────────────────────────────
  "the-returning-dead": {
    id: "the-returning-dead",
    title: "The Returning Dead",
    tagline: "They come back, briefly, and always at the wrong time",
    description:
      "Once or twice a generation, a recently deceased person is reported seen — briefly, in passing — by multiple independent witnesses, usually within forty-eight hours of death. The appearances have nothing remarkable about them. The person is simply there, and then not there. They never speak.",
    whyItMatters:
      "Visitations that communicate nothing challenge the assumption that hauntings are about unfinished business. These visitations suggest something else is going on.",
  },
  "monsoon-whispers": {
    id: "monsoon-whispers",
    title: "Monsoon Whispers",
    tagline: "The rain says something, just below audibility",
    description:
      "During heavy monsoon rainfall, villagers report hearing something just below the threshold of intelligibility — not quite voices, not quite white noise. Recordings capture only rain. The sensation is consistent across generations. Children hear it first.",
    whyItMatters:
      "Sound that children hear before adults is sound operating at a frequency that adults have been socialised to filter out.",
  },
  "the-missing-days": {
    id: "the-missing-days",
    title: "The Missing Days",
    tagline: "Three days every decade that nobody can account for",
    description:
      "Every eight to twelve years, the village experiences a period of approximately three days where nothing is remembered. People wake on the fourth day with continuous memory up to the start of the period and then nothing until waking. They are healthy, uninjured, and their routines appear to have continued normally. Nobody knows who was in charge.",
    whyItMatters:
      "Collective amnesia that leaves no external evidence suggests either a shared psychological event or a shared agreement so deep it is unconscious.",
  },
};

// ── Navigation graph: parent → children ───────────────────────────────────────
export const WORLD_GRAPH: Record<string, string[]> = {
  // Mythology
  mythology: ["forgotten-temple", "old-lady"],
  "forgotten-temple": [
    "temple-of-vanishing-names",
    "shrine-below-the-banyan",
    "ruined-rain-temple",
  ],
  "old-lady": [
    "village-oracle",
    "keeper-of-forgotten-songs",
    "woman-who-remembers-the-dead",
  ],

  // Rituals
  rituals: ["night-ceremonies", "forbidden-practices"],
  "night-ceremonies": [
    "seventh-night-ritual",
    "monsoon-blood-rite",
    "dream-vigil",
  ],
  "forbidden-practices": [
    "memory-erasure-ritual",
    "soul-binding",
    "blood-pact",
  ],

  // Bloodlines
  bloodlines: ["cursed-lineage", "the-marked"],
  "cursed-lineage": ["silent-heirs", "the-hollow-sons", "banyan-blood"],
  "the-marked": ["dreaming-children", "blood-memory", "ancestral-debt"],

  // Fear
  fear: ["forest-fears", "village-dread"],
  "forest-fears": [
    "sounds-at-night",
    "the-trees-watch",
    "the-path-that-loops",
  ],
  "village-dread": [
    "the-empty-house",
    "the-unused-well",
    "door-that-opens-itself",
  ],

  // Mystery
  mystery: ["abandoned-places", "unexplained-events"],
  "abandoned-places": [
    "the-sealed-shrine",
    "the-locked-room",
    "the-dry-well",
  ],
  "unexplained-events": [
    "the-returning-dead",
    "monsoon-whispers",
    "the-missing-days",
  ],
};

// ── Derived: child → parent lookup ────────────────────────────────────────────
export const PARENT_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [parent, children] of Object.entries(WORLD_GRAPH)) {
    for (const child of children) {
      map[child] = parent;
    }
  }
  return map;
})();

// ── Region virtual root node IDs ──────────────────────────────────────────────
// Clicking a region enters trail mode starting at this virtual root node.
export const REGION_VIRTUAL_ROOTS: Partial<Record<ConstellationRegionId, string>> = {
  mythology: "mythology",
  rituals: "rituals",
  bloodlines: "bloodlines",
  fear: "fear",
  mystery: "mystery",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getChildren(id: string): string[] {
  return WORLD_GRAPH[id] ?? [];
}

export function getWorldNode(id: string): WorldNode | undefined {
  return WORLD_NODES[id];
}

/** Compute depth of a node from its region root (0 = the virtual region root). */
export function getDepth(id: string): number {
  let depth = 0;
  let current = id;
  while (PARENT_MAP[current]) {
    current = PARENT_MAP[current];
    depth++;
  }
  return depth;
}

/**
 * Collect the full ancestor chain from a node back to its region root.
 * Returns [regionRoot, ..., nodeId].
 */
export function getAncestorChain(id: string): string[] {
  const chain: string[] = [id];
  let current = id;
  while (PARENT_MAP[current]) {
    current = PARENT_MAP[current];
    chain.unshift(current);
  }
  return chain;
}

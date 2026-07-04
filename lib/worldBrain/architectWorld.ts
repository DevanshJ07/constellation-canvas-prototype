/**
 * World Architect — Layer 2 intelligence.
 * Converts WorldPromptDecomposition into a controlled worldbuilding workspace structure.
 */

import type { WorldPromptDecomposition } from "@/lib/worldBrain/decomposeWorldPrompt";

export type NodeType =
  | "character"
  | "setting"
  | "event"
  | "conflict"
  | "rule"
  | "mystery"
  | "theme"
  | "style"
  | "relationship"
  | "object";

export type CriticSeverity = "soft" | "medium" | "strict";

export type VisibleConstellation = {
  id: string;
  title: string;
  purpose: string;
  userFacingQuestion: string;
  sourceCreativeLayer: string;
  linkedReasoningAgentIds: string[];
  suggestedStartingNodeIds: string[];
  priority: number;
};

export type ReasoningAgent = {
  id: string;
  name: string;
  role: string;
  lens: string;
  generates: string[];
  linkedConstellationIds: string[];
  activationTriggers: string[];
};

export type CriticAgent = {
  id: string;
  name: string;
  job: string;
  checks: string[];
  rejectsIf: string[];
  repairsBy: string[];
  severity: CriticSeverity;
};

export type StartingNode = {
  id: string;
  title: string;
  description: string;
  belongsToConstellationId: string;
  generatedByAgentId: string;
  whyPromising: string;
  risk: string;
  explorationQuestions: string[];
  nodeType: NodeType;
};

export type ArchitectureControlRules = {
  mustPreserve: string[];
  mustAvoid: string[];
  generationPriorities: string[];
  rankingCriteria: string[];
  expansionRules: string[];
};

export type WorldArchitecture = {
  usedFallback: boolean;
  fallbackReason?: string;
  sourcePrompt: string;
  architectureSummary: string;
  visibleConstellations: VisibleConstellation[];
  reasoningAgents: ReasoningAgent[];
  criticAgents: CriticAgent[];
  startingNodes: StartingNode[];
  controlRules: ArchitectureControlRules;
};

const ARCHITECT_MODEL = "gemini-2.5-flash";

const VALID_NODE_TYPES = new Set<NodeType>([
  "character",
  "setting",
  "event",
  "conflict",
  "rule",
  "mystery",
  "theme",
  "style",
  "relationship",
  "object",
]);

const VALID_SEVERITIES = new Set<CriticSeverity>(["soft", "medium", "strict"]);

const GENERIC_TERMS = new Set([
  "structure",
  "character",
  "conflict",
  "tone",
  "continuity",
  "plot",
  "theme",
  "worldbuilding",
  "narrative",
  "story",
  "setting",
  "dialogue",
  "pacing",
  "arc",
  "tension",
  "exposition",
  "climax",
  "resolution",
  "development",
  "ideas",
  "world",
]);

const STOP_WORDS = new Set([
  "with", "that", "this", "from", "into", "about", "they", "their", "some",
  "have", "been", "were", "what", "when", "where", "which", "while", "will",
  "would", "could", "should", "universe", "world", "story", "few", "lost",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown, fallback = ""): string {
  return v != null ? String(v).trim() : fallback;
}

function strArray(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map((x) => String(x).trim()).filter(Boolean);
}

function extractSeedWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function pickSeedWord(text: string, index = 0): string {
  const words = extractSeedWords(text);
  const word = words[index % Math.max(words.length, 1)] ?? "world";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function toStableId(prefix: string, text: string, seen: Set<string>): string {
  let base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);

  // Avoid duplicate prefix: constellation_constellation_friend_group → constellation_friend_group
  const prefixWithUnderscore = `${prefix}_`;
  while (base.startsWith(prefixWithUnderscore)) {
    base = base.slice(prefixWithUnderscore.length);
  }
  // Also strip bare prefix if entire base is just the prefix word
  if (base === prefix) base = "";

  if (!base) base = "item";
  let id = `${prefix}_${base}`;
  let n = 2;
  while (seen.has(id)) {
    id = `${prefix}_${base}_${n}`;
    n++;
  }
  seen.add(id);
  return id;
}

function looksLikeInternalId(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(constellation|agent|critic|node)_[a-z0-9_]+$/i.test(t)) return true;
  if (/^ai[-_]/i.test(t)) return true;
  if (/^node_\d+/i.test(t)) return true;
  if (t.includes("_") && !t.includes(" ") && t === t.toLowerCase()) return true;
  return false;
}

function isGenericTerm(name: string): boolean {
  const lower = name.toLowerCase().trim();
  const stripped = lower.replace(/\s+agent\s*$/i, "").replace(/\s+layer\s*$/i, "").trim();
  const words = stripped.split(/\s+/);
  if (words.length <= 2 && words.every((w) => GENERIC_TERMS.has(w))) return true;
  return GENERIC_TERMS.has(stripped);
}

function isBackendSoundingTitle(title: string): boolean {
  return /\b(agent|engineer|architect|specialist|module|system|pipeline)\b/i.test(title);
}

function isGenericConstellationTitle(title: string): boolean {
  return isGenericTerm(title) || isBackendSoundingTitle(title) || looksLikeInternalId(title);
}

function isGenericNodeTitle(title: string): boolean {
  return isGenericTerm(title) || looksLikeInternalId(title);
}

function repairConstellationTitle(title: string, prompt: string, layerName?: string): string {
  const source = layerName || title;
  const w1 = pickSeedWord(prompt, 0);
  const w2 = pickSeedWord(prompt, 1);

  const repairPatterns: Record<string, string> = {
    structure: `The ${w1} Escalation`,
    character: `The ${w1} Circle`,
    conflict: `${w2} Gone Wrong`,
    tone: `The Heart Beneath the ${w1}`,
    continuity: `The ${w1} Logic`,
    plot: `The ${w1} Arc`,
    theme: `The ${w1} Undercurrent`,
    worldbuilding: `The ${w1} Rules`,
    narrative: `The ${w1} Thread`,
    pacing: `The ${w1} Rhythm`,
    tension: `${w2} Pressure`,
    climax: `The Final ${w1}`,
    resolution: `The ${w1} Payoff`,
    setting: `The ${w1} Environment`,
  };

  const base = source.toLowerCase().replace(/\s+(layer|agent)\s*$/i, "").trim();
  for (const [key, val] of Object.entries(repairPatterns)) {
    if (base.includes(key) || title.toLowerCase().includes(key)) return val;
  }

  if (isGenericConstellationTitle(title)) {
    return `The ${w1} ${w2}`.replace(/\s+/g, " ").trim();
  }

  // Strip agent-ish suffixes for display
  return title
    .replace(/\s+Agent\s*$/i, "")
    .replace(/\s+Layer\s*$/i, "")
    .trim() || `The ${w1} Zone`;
}

function isPlaceholderNodeTitle(title: string): boolean {
  if (isGenericNodeTitle(title)) return true;
  if (/^Who Took the \w+\??$/i.test(title)) return true;
  if (/^The \w+ Shortcut$/i.test(title)) return true;
  if (/The \w+ Misunderstanding$/i.test(title)) return true;
  if (/That Changes Everything$/i.test(title)) return true;
  if (/^When \w+ Meets \w+$/i.test(title)) return true;
  if (/^The \w+ Moment$/i.test(title)) return true;
  if (/^The Encounter\b/i.test(title)) return true;
  return false;
}

/** World-specific concrete node titles derived from prompt keywords and decomposition context. */
function getWorldSpecificNodeTemplates(prompt: string, ctx?: RepairContext): string[] {
  if (ctx?.isComedyJungle) {
    return [
      "The Fake Survival Expert",
      "The Monkey Who Steals the Map",
      "The Shortcut That Adds Three Days",
      "The Campfire That Refuses to Light",
      "The Final Rescue That Makes Things Worse",
      "The Friend Who Accidentally Becomes Jungle Leader",
      "The Echoing Mimic Bird",
      "Who Ate the Map?",
      "The Banana Bridge Collapse",
      "The Quicksand Picnic",
      "The Snack Hoarder",
      "The Vine Swing Disaster",
      "The Mudslide Rescue Attempt",
      "The Wrong Trail Everyone Trusts",
      "The Friend Who Becomes Jungle Leader",
    ];
  }

  if (ctx && (ctx.flags.dream || ctx.flags.romance || ctx.flags.sciFi)) {
    return [
      "The Silent Tsunami",
      "The Taste of Rain, Twice",
      "The Covert Data Search",
      "The Shared Nightmare Fragment",
      "The Stranger in the Mirror",
      "The Premonition That Won't Fade",
      "The Waking Clue",
      "The Dream Rule They Break",
      "The Message Only One Remembers",
      "The Disaster Countdown",
      "The Trust Test in the Dream",
      "The Real-World Echo",
      "The Symbol That Returns",
      "The Choice Before Dawn",
      "The Connection They Can't Deny",
    ];
  }

  const lower = prompt.toLowerCase();
  const isJungleComedy =
    /\b(jungle|friends?|comedy|chaos|lost|survival)\b/.test(lower);

  if (isJungleComedy) {
    return [
      "The Fake Survival Expert",
      "The Monkey Who Steals the Map",
      "The Shortcut That Adds Three Days",
      "The Campfire That Refuses to Light",
      "The Final Rescue That Makes Things Worse",
      "The Friend Who Accidentally Becomes Jungle Leader",
      "The Echoing Mimic Bird",
      "Who Ate the Map?",
      "The Banana Bridge Collapse",
      "The Quicksand Picnic",
      "The Snack Hoarder",
      "The Vine Swing Disaster",
      "The Mudslide Rescue Attempt",
      "The Wrong Trail Everyone Trusts",
      "The Friend Who Becomes Jungle Leader",
    ];
  }

  const w1 = pickSeedWord(prompt, 0);
  const w2 = pickSeedWord(prompt, 1);
  const w3 = pickSeedWord(prompt, 2);
  return [
    `The ${w1} Nobody Expected`,
    `When the ${w2} Backfires`,
    `The ${w3} That Started It All`,
    `The Last ${w1} Standing`,
    `The ${w2} With a Secret`,
    `What Happened at the ${w1}`,
    `The ${w3} Nobody Believed`,
    `The ${w1} That Changes the Rules`,
    `The Hidden ${w2}`,
    `The ${w3} Payoff`,
  ];
}

function repairNodeTitle(title: string, prompt: string, index: number, ctx?: RepairContext): string {
  const templates = getWorldSpecificNodeTemplates(prompt, ctx);
  if (title && !isPlaceholderNodeTitle(title)) return title;
  return templates[index % templates.length] ?? `The ${pickSeedWord(prompt, index)} Incident`;
}

const OBSCURE_WORDS = new Set([
  "verdant", "vortex", "drollery", "hapless", "ethereal", "jamboree", "follies",
  "mirth", "buffoonery", "caprice", "luminescent", "arcane", "tapestry", "whimsy",
  "spectral", "eldritch", "nocturne", "zephyr", "mellifluous", "sonorous",
]);

const CLEAR_AGENT_PATTERNS = [
  "friend dynamic", "jungle mischief", "survival failure", "slapstick survival",
  "comic escalation", "visual gag", "animated gag", "emotional payoff",
  "group dynamic",
];

const FANCY_AGENT_WORDS = new Set([
  "fiasco", "joker", "absurdity", "virtuoso", "designer", "buffoon", "maestro",
  "whimsy", "caprice", "saga", "chronicle", "epic", "virtuoso", "escape",
  "drollery", "hapless", "mirth", "folly", "follies", "zany", "wacky",
]);

const FANCY_AGENT_TITLE_WORDS = /\b(architect|designer|virtuoso|engineer|craftsman|conductor|orchestrator)\b/i;

const POETIC_PROMPT_PATTERN =
  /\b(poetic|mythic|literary|epic fantasy|fairy tale|legendary|shakespearean|homeric)\b/i;

// ── Context-aware repair (derived from decomposition, not hardcoded domains) ──

type WorldRepairFlags = {
  comedy: boolean;
  jungle: boolean;
  survival: boolean;
  animation: boolean;
  romance: boolean;
  sciFi: boolean;
  mystery: boolean;
  dream: boolean;
  screenplay: boolean;
};

type RepairContext = {
  decomposition: WorldPromptDecomposition;
  prompt: string;
  corpus: string;
  genre: string;
  tones: string;
  premise: string;
  setting: string;
  engine: string;
  promise: string;
  outputType: string;
  medium: string;
  targetExperience: string;
  flags: WorldRepairFlags;
  characterSingular: string;
  characterPlural: string;
  isComedyJungle: boolean;
};

const COMEDY_JUNGLE_LEAK_PATTERNS: RegExp[] = [
  /\bjungle\b/i,
  /\bslapstick\b/i,
  /\bbanana\b/i,
  /\bvine\b/i,
  /\bmonkey\b/i,
  /\bvisual gag\b/i,
  /\banimated comedy\b/i,
  /\bfriend group\b/i,
  /\bharmless trap\b/i,
  /\bsurvival failure\b/i,
  /\bcomic animals\b/i,
  /\bjungle gag/i,
  /\bblame chain/i,
  /\bsquash-and-stretch\b/i,
  /\binterpersonal comedy\b/i,
  /\bslapstick inconvenience\b/i,
  /\bComedy Tone Guardian\b/i,
  /\bVisual Gag Validator\b/i,
  /\banimal.or.plant interference\b/i,
  /\bjungle mischief\b/i,
  /\bjungle problem\b/i,
  /\bjungle response\b/i,
  /\bjungle creature\b/i,
  /\bjungle rule\b/i,
  /\bfriend archetype/i,
  /\brecurring jungle/i,
];

function buildRepairContext(decomposition: WorldPromptDecomposition): RepairContext {
  const prompt = decomposition.originalPrompt;
  const wu = decomposition.worldUnderstanding;
  const intent = decomposition.intent;
  const layerText = decomposition.requiredCreativeLayers
    .map((l) => `${l.name} ${l.purpose} ${l.whyNeeded}`)
    .join(" ");
  const agentText = decomposition.recommendedAgents
    .map((a) => `${a.name} ${a.role} ${a.lens} ${a.shouldGenerate}`)
    .join(" ");
  const directionText = decomposition.startingDirections
    .map((d) => `${d.title} ${d.description}`)
    .join(" ");

  const corpus = [
    prompt,
    wu.genre,
    wu.premise,
    wu.setting,
    wu.coreCreativeEngine,
    wu.creativePromise,
    wu.tone.join(" "),
    intent.outputType,
    intent.likelyMedium,
    intent.targetExperience,
    layerText,
    agentText,
    directionText,
  ]
    .join(" ")
    .toLowerCase();

  const has = (re: RegExp) => re.test(corpus);

  const flags: WorldRepairFlags = {
    comedy: has(/\b(comedy|comedic|funny|humor|humour|slapstick|hilarious)\b/),
    jungle: has(/\b(jungle|rainforest|wilderness)\b/) || /\blost in a jungle\b/.test(corpus),
    survival: has(/\b(survival|camp|shelter|stranded|lost)\b/),
    animation: has(/\b(animated|animation|cartoon|short story)\b/),
    romance: has(/\b(romantic|romance|love|intimacy|relationship|strangers)\b/),
    sciFi: has(/\b(sci-fi|sci fi|science fiction|futur|technology|disaster|premonition|data)\b/),
    mystery: has(/\b(mystery|mysterious|clue|secret|suspense)\b/),
    dream: has(/\b(dream|dreams|nightmare|subconscious|sleep|vision|sharing the same)\b/),
    screenplay: intent.outputType === "screenplay" || has(/\b(screenplay|cinematic|film|scene)\b/),
  };

  let characterSingular = "character";
  let characterPlural = "characters";
  if (has(/\b(two strangers|strangers)\b/)) {
    characterSingular = "protagonist";
    characterPlural = "protagonists";
  } else if (has(/\b(friends|friend group|crew|bumbling)\b/)) {
    characterSingular = "friend";
    characterPlural = "friends";
  } else if (flags.romance) {
    characterSingular = "protagonist";
    characterPlural = "protagonists";
  }

  const isComedyJungle =
    (flags.comedy && flags.jungle) ||
    (flags.jungle && has(/\b(friends|chaos|comedy|survival)\b/));

  return {
    decomposition,
    prompt,
    corpus,
    genre: wu.genre,
    tones: wu.tone.join(", ") || "the intended tone",
    premise: wu.premise,
    setting: wu.setting,
    engine: wu.coreCreativeEngine,
    promise: wu.creativePromise,
    outputType: intent.outputType,
    medium: intent.likelyMedium,
    targetExperience: intent.targetExperience,
    flags,
    characterSingular,
    characterPlural,
    isComedyJungle,
  };
}

function contextSupportsComedyJungle(ctx: RepairContext): boolean {
  return ctx.isComedyJungle || ctx.flags.comedy || ctx.flags.jungle;
}

function textHasUnsupportedLeakage(text: string, ctx: RepairContext): boolean {
  if (!text.trim()) return false;
  const lower = text.toLowerCase();
  if (!contextSupportsComedyJungle(ctx)) {
    for (const pat of COMEDY_JUNGLE_LEAK_PATTERNS) {
      if (pat.test(lower)) return true;
    }
  }
  if (ctx.characterSingular === "protagonist" && /\bfriends?\b/i.test(lower)) return true;
  if (!ctx.flags.comedy && /\b(comedy|slapstick|hilarious|punchline)\b/i.test(lower)) return true;
  if (!ctx.flags.romance && /\b(intimacy|romantic tension|strangers?\b.*\blove)\b/i.test(lower)) return true;
  if (!ctx.flags.dream && /\b(shared dream|dreamspace|dream rule|dream symbol)\b/i.test(lower)) return true;
  if (!ctx.flags.sciFi && /\b(premonition|disaster countdown|covert data|sci-fi)\b/i.test(lower)) return true;
  return false;
}

function charLabel(ctx: RepairContext, capitalize = false): string {
  const w = ctx.characterSingular;
  return capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

function charLabelPlural(ctx: RepairContext, capitalize = false): string {
  const w = ctx.characterPlural;
  return capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

type SemanticTheme = "friend" | "jungle" | "survival" | "escalation" | "animation";

const FUNCTIONAL_AGENT_NAMES: Record<SemanticTheme, string> = {
  friend: "Friend Dynamics Agent",
  jungle: "Jungle Mischief Agent",
  survival: "Survival Failure Agent",
  escalation: "Comic Escalation Agent",
  animation: "Visual Gag Agent",
};

const JUNGLE_COMEDY_AGENT_POOL = [
  "Friend Dynamics Agent",
  "Jungle Mischief Agent",
  "Survival Failure Agent",
  "Comic Escalation Agent",
  "Visual Gag Agent",
  "Emotional Payoff Agent",
];

type AgentOperationalProfile = {
  role: string;
  lens: string;
  generates: string[];
};

const AGENT_OPERATIONAL_PROFILES: Record<string, AgentOperationalProfile> = {
  "Friend Dynamics Agent": {
    role:
      "Creates friend personalities, group tensions, blame chains, loyalty moments, and recurring interpersonal jokes.",
    lens:
      "Comedy emerges from personality clashes, overconfidence, panic, and failed teamwork.",
    generates: [
      "friend archetypes",
      "group misunderstandings",
      "blame chains",
      "recurring interpersonal jokes",
      "emotional payoff beats",
    ],
  },
  "Jungle Mischief Agent": {
    role:
      "Creates bizarre plants, animals, terrain, and jungle rules that actively interfere with the friends.",
    lens: "The jungle behaves like a mischievous comedy machine.",
    generates: [
      "comic animals",
      "strange plants",
      "misleading paths",
      "harmless traps",
      "recurring jungle gags",
    ],
  },
  "Comic Escalation Agent": {
    role: "Turns small mistakes into larger chain reactions and final set pieces.",
    lens: "Every attempted solution should create a funnier problem.",
    generates: [
      "chain reaction disasters",
      "callback setups",
      "escalating complications",
      "final chaos sequences",
    ],
  },
  "Visual Gag Agent": {
    role:
      "Designs animation-friendly physical comedy, expressions, timing, and cartoon physics.",
    lens: "Ideas should be visually funny even without dialogue.",
    generates: [
      "squash-and-stretch moments",
      "exaggerated reactions",
      "sound-effect gags",
      "recurring visual motifs",
    ],
  },
  "Survival Failure Agent": {
    role:
      "Creates failed attempts at navigation, shelter, food, fire, rescue, and teamwork.",
    lens: "Basic survival tasks become absurd comedy set pieces.",
    generates: [
      "failed shelters",
      "food disasters",
      "navigation mistakes",
      "rescue attempts gone wrong",
    ],
  },
  "Emotional Payoff Agent": {
    role:
      "Finds warmth, loyalty, and small victories beneath the chaos without losing comedy.",
    lens: "Friendship should feel real even when everything goes wrong.",
    generates: [
      "loyalty beats",
      "earned reconciliations",
      "quiet friendship moments",
      "comic relief with heart",
    ],
  },
};

const THEME_OPERATIONAL_PROFILES: Record<SemanticTheme, AgentOperationalProfile> = {
  friend: AGENT_OPERATIONAL_PROFILES["Friend Dynamics Agent"]!,
  jungle: AGENT_OPERATIONAL_PROFILES["Jungle Mischief Agent"]!,
  survival: AGENT_OPERATIONAL_PROFILES["Survival Failure Agent"]!,
  escalation: AGENT_OPERATIONAL_PROFILES["Comic Escalation Agent"]!,
  animation: AGENT_OPERATIONAL_PROFILES["Visual Gag Agent"]!,
};

const DEFAULT_JUNGLE_CONSTELLATION_TITLES: Record<SemanticTheme, string> = {
  friend: "The Bumbling Crew",
  jungle: "The Jungle's Tricks",
  survival: "Survival Gone Hilariously Wrong",
  escalation: "The Cascade of Chaos",
  animation: "Animated Antics",
};

const NODE_THEME_KEYWORDS: Record<SemanticTheme, string[]> = {
  friend: [
    "friend", "group", "crew", "expert", "leader", "optimistic", "cynical", "realist",
    "argument", "decision", "personality", "hoarder", "snack", "bumbling", "dynamic",
    "anxious", "trust", "follow", "split", "blame", "leadership", "packed", "items",
    "emotional", "friendship", "quirky", "teamwork", "loyalty", "panic", "overconfidence",
    "misunderstanding", "bond", "relationship",
  ],
  jungle: [
    "jungle", "mimic", "bird", "fruit", "mushroom", "vine", "creature", "animal",
    "monkey", "echo", "thief", "sticky", "bouncy", "trick", "wild", "attract",
    "mischief", "plant", "terrain", "trap", "rule", "sentient", "toucan", "berry",
    "berries", "path", "misleading", "nature",
  ],
  survival: [
    "shelter", "campfire", "river", "crossing", "map", "bridge", "collapse", "survival",
    "quicksand", "trail", "shortcut", "marshmallow", "fire", "fold", "folding",
    "route", "wrong", "detour", "light", "picnic", "mudslide", "food", "navigation",
    "raft", "unprepared", "improvise", "rescue", "cross", "float", "lost",
  ],
  escalation: [
    "coconut", "catapult", "chain", "reaction", "rescue", "pile", "final", "cascade",
    "chaos", "disaster", "worse", "escalation", "climax", "payoff", "domino",
    "consequence", "mistake", "set piece", "callback", "compound",
  ],
  animation: [
    "squash", "stretch", "sweat", "waterfall", "gag", "visual", "exaggerated", "sound",
    "effect", "antic", "slapstick", "animated", "bounce", "bouncing", "slip", "slipping",
    "reaction", "cartoon", "timing", "physics", "motif", "expression",
  ],
};

const CONSTELLATION_THEME_KEYWORDS: Record<SemanticTheme, string[]> = {
  friend: [
    "friend", "group", "crew", "bumbling", "dynamic", "circle", "bond", "relationship",
    "personality", "team",
  ],
  jungle: [
    "jungle", "trick", "wild", "forest", "animal", "mischief", "creature", "nature",
    "plant", "terrain",
  ],
  survival: [
    "survival", "wrong", "hilarious", "slapstick", "camp", "lost", "attempt",
    "unprepared", "failure", "navigation", "shelter",
  ],
  escalation: [
    "chaos", "cascade", "disaster", "final", "climax", "payoff", "heart", "escalation",
  ],
  animation: ["animated", "antic", "gag", "visual", "slapstick", "style", "cartoon"],
};

function isJungleComedyPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /\b(jungle|friends?|comedy|chaos|lost|survival|animated)\b/.test(lower);
}

function isStylizedWord(text: string): boolean {
  return text
    .toLowerCase()
    .split(/\s+/)
    .some((w) => OBSCURE_WORDS.has(w.replace(/[^a-z]/g, "")));
}

function promptAsksPoeticStyle(prompt: string): boolean {
  return POETIC_PROMPT_PATTERN.test(prompt);
}

function isFancyAgentName(name: string): boolean {
  const lower = name.toLowerCase().replace(/\s+agent\s*$/, "");
  if (FANCY_AGENT_TITLE_WORDS.test(name)) return true;
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.some((w) => FANCY_AGENT_WORDS.has(w.replace(/[^a-z]/g, "")))) return true;
  // Alliterative catchy pairs: Friend Fiasco, Jungle Joker
  if (words.length >= 2 && words[0]![0] === words[1]![0]) return true;
  return false;
}

function isClearFunctionalAgentName(name: string): boolean {
  const lower = name.toLowerCase();
  return CLEAR_AGENT_PATTERNS.some((p) => lower.includes(p));
}

function shouldRepairAgentName(name: string, prompt: string): boolean {
  if (promptAsksPoeticStyle(prompt)) return false;
  if (isClearFunctionalAgentName(name) && !isFancyAgentName(name)) return false;
  if (isGenericTerm(name)) return true;
  if (isStylizedWord(name)) return true;
  if (isFancyAgentName(name)) return true;
  // Any agent name that is not clearly functional should be repaired
  if (!isClearFunctionalAgentName(name)) return true;
  return false;
}

function deriveGeneratesFromContext(
  agent: ReasoningAgent,
  linked: VisibleConstellation[],
  ctx: RepairContext,
): string[] {
  const items: string[] = [];
  for (const c of linked.slice(0, 2)) {
    if (c.purpose) items.push(c.purpose.slice(0, 72).toLowerCase());
    items.push(`${c.title.toLowerCase()} beats`);
  }
  if (ctx.engine) items.push(`${ctx.engine.toLowerCase()} consequences`.slice(0, 72));
  if (ctx.genre) items.push(`${ctx.genre.toLowerCase()} exploration angles`);
  const base = agent.name.replace(/\s+Agent$/i, "").toLowerCase();
  items.push(`${base} variations`);
  return [...new Set(items)].filter(Boolean).slice(0, 5);
}

function buildContextAwareAgentProfile(
  agent: ReasoningAgent,
  constellations: VisibleConstellation[],
  ctx: RepairContext,
): AgentOperationalProfile {
  const linked = constellations.filter(
    (c) =>
      agent.linkedConstellationIds.includes(c.id) ||
      c.linkedReasoningAgentIds.includes(agent.id),
  );

  const rec = ctx.decomposition.recommendedAgents.find((r) => {
    const rn = r.name.toLowerCase().replace(/\s+agent$/i, "").trim();
    const an = agent.name.toLowerCase().replace(/\s+agent$/i, "").trim();
    return an.includes(rn) || rn.includes(an);
  });

  if (rec?.role && rec.lens && !isTemplatedAgentText(rec.role)) {
    const gen = rec.shouldGenerate
      ? rec.shouldGenerate.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : deriveGeneratesFromContext(agent, linked, ctx);
    return { role: rec.role, lens: rec.lens, generates: gen.length >= 3 ? gen : deriveGeneratesFromContext(agent, linked, ctx) };
  }

  if (ctx.isComedyJungle) {
    const staticProfile =
      AGENT_OPERATIONAL_PROFILES[agent.name] ??
      THEME_OPERATIONAL_PROFILES[inferAgentTheme(agent, constellations)];
    if (staticProfile) return staticProfile;
  }

  const baseName = agent.name.replace(/\s+Agent$/i, "");
  const zone = linked[0]?.title ?? constellations[0]?.title ?? "this world";
  const layerHint = linked[0]?.purpose ?? linked[0]?.sourceCreativeLayer ?? ctx.engine;
  const nameLower = agent.name.toLowerCase();

  if (ctx.flags.dream && /dream/i.test(nameLower)) {
    return {
      role: "Defines the rules, symbols, sensory patterns, and limits of the shared dreamspace.",
      lens: "The dream world reveals emotional truth and future danger through recurring symbols.",
      generates: ["dream rules", "recurring symbols", "sensory overlaps", "altered memories", "dream-to-reality consequences"],
    };
  }
  if (ctx.flags.romance && /romantic|tension|relationship|intimacy/i.test(nameLower)) {
    return {
      role: `Builds intimacy, mistrust, vulnerability, and emotional stakes between the ${ctx.characterPlural}.`,
      lens: "The relationship grows through shared subconscious exposure before real-world trust.",
      generates: ["intimate dream moments", "trust tests", "emotional misunderstandings", "vulnerability reveals", "romantic turning points"],
    };
  }
  if (/disaster|future|premonition|cataclysm|prophecy/i.test(nameLower) ||
      (ctx.flags.sciFi && /disaster|future/i.test(ctx.corpus))) {
    return {
      role: "Reveals the coming catastrophe through fragments, clues, escalating visions, and real-world evidence.",
      lens: "Every dream clue should increase urgency while preserving mystery.",
      generates: ["premonition fragments", "disaster clues", "countdown signals", "real-world confirmations", "stakes escalation"],
    };
  }
  if (ctx.flags.screenplay && /structure|screenplay|scene|act|cinematic/i.test(nameLower)) {
    return {
      role: "Shapes the world into cinematic acts, turning points, reveals, and climactic choices.",
      lens: "Each discovery should create a sceneable beat or decision.",
      generates: ["act breaks", "midpoint revelations", "reversals", "climax choices", "scene hooks"],
    };
  }
  if (ctx.flags.mystery && /mystery|clue|secret|logic/i.test(nameLower)) {
    return {
      role: "Tracks clues, contradictions, hidden connections, and investigative paths across dreams and reality.",
      lens: "Every clue should deepen mystery while staying fair and explorable.",
      generates: ["clue chains", "contradictions", "hidden connections", "reveal setups", "investigation branches"],
    };
  }

  return {
    role: `Develops ${baseName.toLowerCase()} ideas for ${zone}, aligned with ${ctx.premise}.`,
    lens: `Ideas should express ${layerHint} through a ${ctx.tones} register.`,
    generates: deriveGeneratesFromContext(agent, linked, ctx),
  };
}

function resolveAgentProfile(
  agent: ReasoningAgent,
  constellations: VisibleConstellation[],
  ctx: RepairContext,
): AgentOperationalProfile {
  return buildContextAwareAgentProfile(agent, constellations, ctx);
}

function isTemplatedAgentText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return (
    /everything through the .+ lens/i.test(t) ||
    /concrete .+ scenes and beats/i.test(t) ||
    /visual, clickable moments/i.test(t) ||
    /escalation paths that fit the world premise/i.test(t) ||
    /character-specific complications and payoffs/i.test(t) ||
    /idea generator/i.test(t) ||
    /specialist$/i.test(t) ||
    /mapper$/i.test(t) ||
    /designer$/i.test(t)
  );
}

function isTemplatedGenerates(generates: string[]): boolean {
  if (generates.length < 3) return true;
  return generates.some(
    (g) =>
      /scenes and beats/i.test(g) ||
      /clickable moments/i.test(g) ||
      /world premise/i.test(g) ||
      /explorable moments/i.test(g) ||
      /specific scenes/i.test(g),
  );
}

function applyOperationalProfile(
  agent: ReasoningAgent,
  constellations: VisibleConstellation[],
  ctx: RepairContext,
): void {
  const profile = resolveAgentProfile(agent, constellations, ctx);
  if (isTemplatedAgentText(agent.role) || textHasUnsupportedLeakage(agent.role, ctx)) {
    agent.role = profile.role;
  }
  if (isTemplatedAgentText(agent.lens) || textHasUnsupportedLeakage(agent.lens, ctx)) {
    agent.lens = profile.lens;
  }
  if (isTemplatedGenerates(agent.generates) || agent.generates.some((g) => textHasUnsupportedLeakage(g, ctx))) {
    agent.generates = [...profile.generates];
  }
}

function scoreTextForThemes(text: string): Record<SemanticTheme, number> {
  const lower = text.toLowerCase();
  const scores = { friend: 0, jungle: 0, survival: 0, escalation: 0, animation: 0 };
  for (const [theme, keywords] of Object.entries(NODE_THEME_KEYWORDS) as [SemanticTheme, string[]][]) {
    scores[theme] = keywords.filter((k) => lower.includes(k)).length;
  }
  return scores;
}

function dominantTheme(scores: Record<SemanticTheme, number>): SemanticTheme {
  let best: SemanticTheme = "friend";
  let bestScore = -1;
  for (const [theme, score] of Object.entries(scores) as [SemanticTheme, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = theme;
    }
  }
  return best;
}

function inferNodeTheme(node: StartingNode): SemanticTheme {
  const scores = scoreTextForThemes(`${node.title} ${node.description} ${node.nodeType}`);
  const typeBoost: Partial<Record<NodeType, SemanticTheme>> = {
    character: "friend",
    relationship: "friend",
    setting: "jungle",
    style: "animation",
    conflict: "escalation",
  };
  const boost = typeBoost[node.nodeType];
  if (boost) scores[boost] += 2;
  return dominantTheme(scores);
}

type AgentAssignmentTheme = SemanticTheme | "emotional";

const EMOTIONAL_NODE_KEYWORDS = [
  "warmth", "reconcile", "reconciliation", "loyalty", "heart", "bond", "forgive",
  "reunion", "together", "hug", "comfort", "apolog", "trust restored", "friendship",
];

function inferNodeAgentTheme(node: StartingNode): AgentAssignmentTheme {
  const text = `${node.title} ${node.description}`.toLowerCase();
  const emotionalHits = EMOTIONAL_NODE_KEYWORDS.filter((k) => text.includes(k)).length;
  if (emotionalHits >= 2) return "emotional";
  if (emotionalHits >= 1 && /\b(warm|heart|loyal|bond|reconcil|together)\b/.test(text)) {
    return "emotional";
  }
  return inferNodeTheme(node);
}

function agentThemeFromName(name: string): AgentAssignmentTheme | null {
  const lower = name.toLowerCase();
  if (lower.includes("friend dynamic")) return "friend";
  if (lower.includes("jungle mischief")) return "jungle";
  if (lower.includes("survival failure") || lower.includes("slapstick survival")) return "survival";
  if (lower.includes("comic escalation")) return "escalation";
  if (lower.includes("visual gag") || lower.includes("animated gag")) return "animation";
  if (lower.includes("emotional payoff")) return "emotional";
  return null;
}

function inferConstellationTheme(constellation: VisibleConstellation): SemanticTheme {
  const text = `${constellation.title} ${constellation.purpose} ${constellation.sourceCreativeLayer}`;
  const scores = { friend: 0, jungle: 0, survival: 0, escalation: 0, animation: 0 };
  for (const [theme, keywords] of Object.entries(CONSTELLATION_THEME_KEYWORDS) as [SemanticTheme, string[]][]) {
    scores[theme] = keywords.filter((k) => text.toLowerCase().includes(k)).length;
  }
  return dominantTheme(scores);
}

function inferAgentTheme(
  agent: ReasoningAgent,
  constellations: VisibleConstellation[],
): SemanticTheme {
  const linked = constellations.filter(
    (c) =>
      agent.linkedConstellationIds.includes(c.id) ||
      c.linkedReasoningAgentIds.includes(agent.id),
  );
  const text = `${agent.name} ${agent.role} ${agent.lens} ${agent.generates.join(" ")}`;
  const scores = scoreTextForThemes(text);
  for (const c of linked) {
    const ct = inferConstellationTheme(c);
    scores[ct] += 3;
  }
  return dominantTheme(scores);
}

function isStylizedConstellationTitle(title: string): boolean {
  if (isGenericConstellationTitle(title)) return true;
  if (isStylizedWord(title)) return true;
  const lower = title.toLowerCase();
  const clearHints = [
    "crew", "jungle", "trick", "survival", "chaos", "disaster", "heart", "animal",
    "slapstick", "cascade", "bumbling", "hilarious", "friend", "group", "gone wrong",
  ];
  if (clearHints.some((h) => lower.includes(h))) return false;
  // Vague single-word zones
  if (/^the [a-z]+$/i.test(title.trim()) && title.split(/\s+/).length <= 3) {
    return OBSCURE_WORDS.has(title.toLowerCase().replace(/^the\s+/, "").split(/\s+/)[0] ?? "");
  }
  return false;
}

function repairVisibleConstellationTitle(
  title: string,
  prompt: string,
  layerName?: string,
): string {
  if (!isStylizedConstellationTitle(title)) return title;

  if (isJungleComedyPrompt(prompt)) {
    const theme = dominantTheme(
      scoreTextForThemes(`${title} ${layerName ?? ""} ${prompt}`),
    );
    return DEFAULT_JUNGLE_CONSTELLATION_TITLES[theme] ?? repairConstellationTitle(title, prompt, layerName);
  }

  return repairConstellationTitle(title, prompt, layerName);
}

function repairReasoningAgentNames(
  agents: ReasoningAgent[],
  constellations: VisibleConstellation[],
  ctx: RepairContext,
): void {
  const usedNames = new Set<string>();
  const prompt = ctx.prompt;
  const recommended = ctx.decomposition.recommendedAgents;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    if (!shouldRepairAgentName(agent.name, prompt)) {
      usedNames.add(agent.name);
      continue;
    }

    if (ctx.isComedyJungle) {
      const theme = inferAgentTheme(agent, constellations);
      const preferred = FUNCTIONAL_AGENT_NAMES[theme];
      if (!usedNames.has(preferred)) {
        agent.name = preferred;
      } else {
        for (const candidate of JUNGLE_COMEDY_AGENT_POOL) {
          if (!usedNames.has(candidate)) {
            agent.name = candidate;
            break;
          }
        }
      }
    } else if (recommended[i]?.name) {
      const recName = recommended[i]!.name.endsWith("Agent")
        ? recommended[i]!.name
        : `${recommended[i]!.name} Agent`;
      agent.name = usedNames.has(recName) ? `${recName} ${i + 2}` : recName;
    } else {
      const w1 = pickSeedWord(prompt, i);
      const layer = ctx.decomposition.requiredCreativeLayers[i]?.name ?? "Story";
      const themeLabel = layer.split(/\s+/)[0] ?? "Story";
      let candidate = `${w1} ${themeLabel} Agent`;
      let n = 2;
      while (usedNames.has(candidate)) {
        candidate = `${w1} ${themeLabel} Agent ${n}`;
        n++;
      }
      agent.name = candidate;
    }

    usedNames.add(agent.name);
  }
}

function findBestAgentForNode(
  node: StartingNode,
  agents: ReasoningAgent[],
  ctx?: RepairContext,
): string {
  if (ctx && !ctx.isComedyJungle) {
    const nodeText = `${node.title} ${node.description}`.toLowerCase();
    let best = agents[0]!;
    let bestScore = -1;
    for (const agent of agents) {
      const agentText = `${agent.name} ${agent.role} ${agent.lens} ${agent.generates.join(" ")}`.toLowerCase();
      let score = 0;
      for (const word of nodeText.split(/\W+/)) {
        if (word.length > 3 && agentText.includes(word)) score += 2;
      }
      if (agent.linkedConstellationIds.includes(node.belongsToConstellationId)) score += 6;
      if (score > bestScore) {
        bestScore = score;
        best = agent;
      }
    }
    return best.id;
  }

  const nodeTheme = inferNodeAgentTheme(node);
  const searchTerms: Record<AgentAssignmentTheme, string[]> = {
    friend: ["friend dynamic"],
    jungle: ["jungle mischief"],
    survival: ["survival failure", "slapstick survival"],
    escalation: ["comic escalation"],
    animation: ["visual gag", "animated gag"],
    emotional: ["emotional payoff"],
  };

  for (const term of searchTerms[nodeTheme]) {
    const match = agents.find((a) => a.name.toLowerCase().includes(term));
    if (match) return match.id;
  }

  let best = agents[0]!;
  let bestScore = -1;
  for (const agent of agents) {
    const namedTheme = agentThemeFromName(agent.name);
    const agentTheme = namedTheme ?? inferAgentTheme(agent, []);
    let score = agentTheme === nodeTheme ? 8 : 0;
    if (namedTheme) score += 3;
    score += scoreTextForThemes(`${agent.name} ${node.title} ${node.description}`)[
      agentTheme === "emotional" ? "friend" : (agentTheme as SemanticTheme)
    ] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }
  return best.id;
}

function validateNodeAgentAssignment(
  node: StartingNode,
  agents: ReasoningAgent[],
  ctx?: RepairContext,
): void {
  const agent = agents.find((a) => a.id === node.generatedByAgentId);
  if (!agent) {
    node.generatedByAgentId = findBestAgentForNode(node, agents, ctx);
    return;
  }
  if (ctx && !ctx.isComedyJungle) return;

  const expected = inferNodeAgentTheme(node);
  const actual = agentThemeFromName(agent.name) ?? inferAgentTheme(agent, []);
  if (actual !== expected) {
    node.generatedByAgentId = findBestAgentForNode(node, agents, ctx);
  }
}

function assignNodeAgents(
  nodes: StartingNode[],
  agents: ReasoningAgent[],
  ctx?: RepairContext,
): void {
  for (const node of nodes) {
    node.generatedByAgentId = findBestAgentForNode(node, agents, ctx);
    validateNodeAgentAssignment(node, agents, ctx);
  }
}

const NODE_TYPE_THEME: Partial<Record<NodeType, SemanticTheme[]>> = {
  character: ["friend"],
  relationship: ["friend"],
  setting: ["jungle"],
  object: ["jungle", "animation"],
  event: ["survival", "animation"],
  conflict: ["survival", "escalation"],
  mystery: ["jungle", "escalation"],
  style: ["animation"],
};

function constellationThemeScores(constellation: VisibleConstellation): Record<SemanticTheme, number> {
  const text = `${constellation.title} ${constellation.purpose} ${constellation.sourceCreativeLayer}`.toLowerCase();
  const scores = { friend: 0, jungle: 0, survival: 0, escalation: 0, animation: 0 };
  for (const [theme, keywords] of Object.entries(CONSTELLATION_THEME_KEYWORDS) as [SemanticTheme, string[]][]) {
    scores[theme] = keywords.filter((k) => text.includes(k)).length;
  }
  return scores;
}

function scoreNodeForConstellation(
  node: StartingNode,
  constellation: VisibleConstellation,
): number {
  const nodeTheme = inferNodeTheme(node);
  const constTheme = inferConstellationTheme(constellation);
  let score = nodeTheme === constTheme ? 18 : 0;

  const nodeText = `${node.title} ${node.description}`.toLowerCase();
  const constThemes = constellationThemeScores(constellation);
  for (const [theme, keywords] of Object.entries(NODE_THEME_KEYWORDS) as [SemanticTheme, string[]][]) {
    const themeWeight = constThemes[theme] ?? 0;
    const nodeHits = keywords.filter((k) => nodeText.includes(k)).length;
    if (nodeTheme === theme && themeWeight > 0) score += nodeHits * 3;
    if (themeWeight === 0) continue;
    score += nodeHits * themeWeight * 2;
  }

  const typeThemes = NODE_TYPE_THEME[node.nodeType] ?? [];
  for (const theme of typeThemes) {
    if (constThemes[theme] > 0) score += 4;
    if (nodeTheme === theme) score += 2;
  }

  const constWords = `${constellation.title} ${constellation.purpose}`.toLowerCase().split(/\s+/);
  for (const word of constWords) {
    if (word.length > 4 && nodeText.includes(word)) score += 2;
  }

  return score;
}

function rebalanceNodeDistribution(
  nodes: StartingNode[],
  constellations: VisibleConstellation[],
  agents: ReasoningAgent[],
  ctx?: RepairContext,
): void {
  if (constellations.length === 0) return;

  const maxPer = Math.max(1, Math.floor(nodes.length * 0.4));
  const minPer = nodes.length >= constellations.length * 2 ? 2 : 1;

  const countBy = () => {
    const m = new Map<string, number>();
    for (const c of constellations) m.set(c.id, 0);
    for (const n of nodes) m.set(n.belongsToConstellationId, (m.get(n.belongsToConstellationId) ?? 0) + 1);
    return m;
  };

  let counts = countBy();

  // Fill constellations below minimum
  for (const c of constellations) {
    while ((counts.get(c.id) ?? 0) < minPer) {
      const donor = constellations.find((d) => (counts.get(d.id) ?? 0) > minPer);
      if (!donor) break;
      const movable = nodes
        .filter((n) => n.belongsToConstellationId === donor.id)
        .sort((a, b) => scoreNodeForConstellation(a, c) - scoreNodeForConstellation(b, c))
        .pop();
      if (!movable) break;
      movable.belongsToConstellationId = c.id;
      counts = countBy();
    }
  }

  // Cap at 40%
  counts = countBy();
  for (const c of constellations) {
    while ((counts.get(c.id) ?? 0) > maxPer) {
      const overNodes = nodes.filter((n) => n.belongsToConstellationId === c.id);
      const nodeToMove = [...overNodes].sort(
        (a, b) => scoreNodeForConstellation(a, c) - scoreNodeForConstellation(b, c),
      )[0];
      if (!nodeToMove) break;

      let target = constellations[0]!;
      let minCount = Infinity;
      for (const other of constellations) {
        if (other.id === c.id) continue;
        const cnt = counts.get(other.id) ?? 0;
        if (cnt < minCount && cnt < maxPer) {
          minCount = cnt;
          target = other;
        }
      }
      nodeToMove.belongsToConstellationId = target.id;
      counts = countBy();
    }
  }

  assignNodeAgents(nodes, agents, ctx);
}

function distributeStartingNodes(
  nodes: StartingNode[],
  constellations: VisibleConstellation[],
  reasoningAgents: ReasoningAgent[],
  prompt: string,
  seenIds: Set<string>,
  ctx: RepairContext,
): StartingNode[] {
  if (constellations.length === 0) return nodes;

  // Semantic assignment: node theme → best matching constellation
  for (const node of nodes) {
    let best = constellations[0]!;
    let bestScore = -1;
    for (const c of constellations) {
      const s = scoreNodeForConstellation(node, c);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    node.belongsToConstellationId = best.id;
  }

  rebalanceNodeDistribution(nodes, constellations, reasoningAgents, ctx);

  const counts = new Map<string, number>();
  for (const c of constellations) counts.set(c.id, 0);
  for (const n of nodes) counts.set(n.belongsToConstellationId, (counts.get(n.belongsToConstellationId) ?? 0) + 1);

  const templates = getWorldSpecificNodeTemplates(prompt, ctx);
  let templateIdx = 0;

  for (const c of constellations) {
    while ((counts.get(c.id) ?? 0) < (nodes.length >= constellations.length * 2 ? 2 : 1)) {
      const title = templates[templateIdx % templates.length] ?? repairNodeTitle("", prompt, templateIdx, ctx);
      templateIdx++;
      const nodeId = toStableId("node", title, seenIds);
      const stubNode: StartingNode = {
        title,
        description: `A vivid entry point into ${c.title}`,
        belongsToConstellationId: c.id,
        generatedByAgentId: "",
        whyPromising: "",
        risk: "",
        explorationQuestions: [],
        nodeType: "event",
        id: nodeId,
      };
      const agentId = findBestAgentForNode(stubNode, reasoningAgents, ctx);
      const agent = reasoningAgents.find((a) => a.id === agentId);
      const newNode: StartingNode = {
        id: nodeId,
        title,
        description: `A vivid entry point into ${c.title} — grounded in ${ctx.premise}.`,
        belongsToConstellationId: c.id,
        generatedByAgentId: agentId,
        whyPromising: "",
        risk: "",
        explorationQuestions: [],
        nodeType: "event",
      };
      newNode.whyPromising = buildWhyPromising(newNode, c, ctx);
      newNode.risk = buildRisk(newNode, c, ctx);
      repairExplorationQuestionsForNode(newNode, c, agent, ctx);
      nodes.push(newNode);
      counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    }
  }

  assignNodeAgents(nodes, reasoningAgents, ctx);
  return nodes;
}

const GENERIC_WORLD_WORDS = new Set([
  "friend", "friends", "group", "crew", "jungle", "chaos", "escape", "survival",
  "comedy", "they", "them", "their", "this", "that", "what", "which", "where",
  "when", "how", "does", "the", "and", "for", "with", "from", "into", "about",
]);

/** Question topics that must appear in node title/description before use in a question. */
const QUESTION_OBJECT_RULES: { inQuestion: RegExp; nodeMustMention: RegExp }[] = [
  {
    inQuestion: /\bmap\b|\bmistaken for a map\b/i,
    nodeMustMention: /\b(map|compass|navigation|route|shortcut|path|direction|trail|detour)\b/i,
  },
  {
    inQuestion: /\bvine\b|\bswing\b|\bhold their weight\b/i,
    nodeMustMention: /\b(vine|swing|rope|bridge|chasm|crossing)\b/i,
  },
  {
    inQuestion: /\bbird\b|\bmimic|\becho|\bphrase does the bird\b|\btoucan\b/i,
    nodeMustMention: /\b(bird|echo|mimic|toucan|parrot)\b/i,
  },
  {
    inQuestion: /\bsignal\b|\bshout\b|\bwhisper|\bvoice\b|\bcall\b|\bsound\b/i,
    nodeMustMention: /\b(signal|shout|call|sound|voice|whisper|echo|sign)\b/i,
  },
  {
    inQuestion: /\bavalanche\b|\bdomino\b|\bcoconut\b|\bfruit avalanche\b/i,
    nodeMustMention: /\b(fruit|banana|coconut|falling|rolling|avalanche|domino)\b/i,
  },
  {
    inQuestion: /\bmarshmallow\b|\bcampfire\b/i,
    nodeMustMention: /\b(marshmallow|campfire|fire)\b/i,
  },
  {
    inQuestion: /\braft\b/i,
    nodeMustMention: /\b(raft|river|float|improvised)\b/i,
  },
  {
    inQuestion: /\bberries\b|\bbouncing prevent\b/i,
    nodeMustMention: /\b(berry|berries|bounce|bouncing|buffet)\b/i,
  },
];

function nodeTextOf(title: string, description: string): string {
  return `${title} ${description}`.toLowerCase();
}

function nodeMentions(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function explorationQuestionsValid(
  title: string,
  description: string,
  questions: string[],
): boolean {
  if (questions.length !== 3) return false;
  const nodeText = nodeTextOf(title, description);
  for (const q of questions) {
    for (const { inQuestion, nodeMustMention } of QUESTION_OBJECT_RULES) {
      if (inQuestion.test(q) && !nodeMustMention.test(nodeText)) return false;
    }
    // Reject references to concrete objects absent from node (except generic world words)
    const tokens = q.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    for (const token of tokens) {
      if (GENERIC_WORLD_WORDS.has(token)) continue;
      if (QUESTION_OBJECT_RULES.some((r) => r.inQuestion.test(token) && !r.nodeMustMention.test(nodeText))) {
        return false;
      }
    }
  }
  return true;
}

function extractConcreteTerms(title: string, description: string): string[] {
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "").trim();
  const skip = new Set([
    ...GENERIC_WORLD_WORDS,
    "opens", "concrete", "scene", "creator", "enter", "immediately", "grounded",
    "world", "premise", "vivid", "entry", "point", "into",
  ]);
  const fromTitle = focus
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter((w) => w.length > 3 && !skip.has(w));

  const fromDesc = description
    .toLowerCase()
    .match(/\b[a-z]{4,}\b/g)
    ?.filter((w) => !skip.has(w) && !fromTitle.includes(w)) ?? [];

  return [...new Set([...fromTitle, ...fromDesc])].slice(0, 4);
}

function tryGatedExplorationTemplates(
  title: string,
  description: string,
  ctx: RepairContext,
): string[] | null {
  if (!ctx.isComedyJungle) return null;
  const lower = nodeTextOf(title, description);
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "").trim();
  const who = charLabel(ctx);
  const whoCap = charLabel(ctx, true);

  if (
    nodeMentions(lower, /\b(whisper|sign|wrong turn|turn sign|arrow|direction)\b/) &&
    nodeMentions(lower, /\b(route|path|turn|sign|direction|shortcut|navigation|trail)\b/)
  ) {
    return [
      `What message does the sign whisper that convinces one ${who} to trust it?`,
      `Which ${who} notices the arrows changing, and who refuses to believe them?`,
      "Where does the wrong turn lead the group next?",
    ];
  }
  if (nodeMentions(lower, /\b(mushroom|bouncy|bounce|bouncing)\b/)) {
    return [
      `Who steps onto the first mushroom before realizing it bounces?`,
      `What object or ${who} gets launched highest?`,
      "How does the bouncing accidentally reveal a new path or problem?",
    ];
  }
  if (nodeMentions(lower, /\b(guide|professor|prudent|manual|handbook|book)\b/)) {
    return [
      "Which survival tip from the guide sounds reasonable but fails immediately?",
      `Which ${who} treats the guide like sacred truth?`,
      "What new disaster does the bad advice create?",
    ];
  }
  if (nodeMentions(lower, /\bmap\b/)) {
    return [
      `Who had the map last — and do they admit it?`,
      "What ridiculous object gets mistaken for a map?",
      "How does losing the map force the group to split up?",
    ];
  }
  if (nodeMentions(lower, /\b(vine|swing)\b/)) {
    return [
      "Who insists the vine will hold their weight?",
      "What do they crash into on the other side?",
      "Who has to try again because the first attempt failed?",
    ];
  }
  void focus;
  void whoCap;
  return null;
}

function tryContextualExplorationPatterns(
  title: string,
  description: string,
  ctx: RepairContext,
): string[] | null {
  const lower = nodeTextOf(title, description);
  const p = charLabel(ctx);
  const pCap = charLabel(ctx, true);

  if (/\b(tsunami|silent.*wave|wave.*silent)\b/.test(lower) && (ctx.flags.sciFi || ctx.flags.dream)) {
    return [
      `What detail in the silent wave makes one ${p} realize it is not just a nightmare?`,
      `What does the other stranger notice in the same dream that the first missed?`,
      "How does this vision change their next real-world decision?",
    ];
  }
  if (/\b(taste|rain|sensory|twice)\b/.test(lower) && (ctx.flags.romance || ctx.flags.dream)) {
    return [
      `Which ${p} feels the rain first, and where are they in waking life?`,
      "What shared sensory detail proves they experienced the same dream?",
      `How does this moment make them seek or fear each other?`,
    ];
  }
  if (/\b(data|search|covert|investigat|database)\b/.test(lower) && ctx.flags.sciFi) {
    return [
      "What data point matches a symbol from the dream?",
      `Which ${p} is more willing to break rules to investigate?`,
      "What new danger appears because they searched too deeply?",
    ];
  }
  if (/\b(dream|nightmare|vision|sleep)\b/.test(lower) && ctx.flags.dream) {
    return [
      "What rule or symbol in the dream makes this moment feel inevitable?",
      `Which ${pCap} misreads the dream first, and why?`,
      "How does this dream fragment connect to the future disaster?",
    ];
  }
  if (ctx.flags.romance && /\b(trust|intimacy|vulnerability|stranger)\b/.test(lower)) {
    return [
      "What emotional boundary is crossed in this moment?",
      `Which ${p} reveals more than they intend?`,
      "How does this beat change the trust between them?",
    ];
  }
  return null;
}

function generateFallbackExplorationQuestions(
  title: string,
  description: string,
  constellation: VisibleConstellation,
  agent: ReasoningAgent | undefined,
  ctx: RepairContext,
): string[] {
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "").trim();
  const terms = extractConcreteTerms(title, description);
  const subject = (terms[0] ?? focus.split(/\s+/).slice(-2).join(" ")) || "this moment";
  const detail = terms[1] ?? subject;
  const p = charLabel(ctx);
  const pCap = charLabel(ctx, true);

  let q1 = `What reveals or triggers "${focus}" in ${constellation.title}?`;
  let q2 = `Which ${pCap} is most affected by ${detail}, and why?`;
  let q3 = `What consequence or new branch does "${focus}" create?`;

  if (ctx.flags.romance) {
    q2 = `Which ${p} feels the emotional shift first, and why?`;
    q3 = `How does "${focus}" change trust or intimacy between the ${charLabelPlural(ctx)}?`;
  }
  if (ctx.flags.mystery || ctx.flags.sciFi) {
    q1 = `What clue or signal in "${focus}" deepens the mystery?`;
    q2 = `Which ${p} pursues the clue first — with hope or suspicion?`;
  }
  if (ctx.flags.screenplay) {
    q3 = `What sceneable turning point follows from "${focus}"?`;
  }
  if (ctx.flags.dream) {
    q1 = `What dream rule or symbol activates "${focus}"?`;
    q3 = `How does "${focus}" echo into waking life or the disaster thread?`;
  }
  if (agent?.role && !isTemplatedAgentText(agent.role)) {
    const roleSnippet = agent.role.slice(0, 48).toLowerCase();
    if (!textHasUnsupportedLeakage(roleSnippet, ctx)) {
      q2 = `Which ${p} interacts with ${detail} in a way that fits the agent's focus on ${roleSnippet}?`;
    }
  }

  return [q1, q2, q3];
}

function generateExplorationQuestionsForNode(
  node: StartingNode,
  constellation: VisibleConstellation,
  agent: ReasoningAgent | undefined,
  ctx: RepairContext,
): string[] {
  const gated =
    tryGatedExplorationTemplates(node.title, node.description, ctx) ??
    tryContextualExplorationPatterns(node.title, node.description, ctx);

  let questions =
    gated ??
    generateFallbackExplorationQuestions(
      node.title,
      node.description,
      constellation,
      agent,
      ctx,
    );

  if (
    !explorationQuestionsValid(node.title, node.description, questions) ||
    questions.some((q) => textHasUnsupportedLeakage(q, ctx))
  ) {
    questions = generateFallbackExplorationQuestions(
      node.title,
      node.description,
      constellation,
      agent,
      ctx,
    );
  }

  return questions.slice(0, 3);
}

function repairExplorationQuestionsForNode(
  node: StartingNode,
  constellation: VisibleConstellation,
  agent: ReasoningAgent | undefined,
  ctx: RepairContext,
): void {
  node.explorationQuestions = generateExplorationQuestionsForNode(node, constellation, agent, ctx);
}

function isGenericWhyPromising(text: string, ctx?: RepairContext): boolean {
  if (
    !text ||
    /visually specific.*opens multiple/i.test(text) ||
    /offers an immediate, visual scene/i.test(text) ||
    /Immediately opens .* with a concrete, clickable moment/i.test(text) ||
    /opens multiple comedy or story branches/i.test(text) ||
    /fits .* and opens multiple/i.test(text) ||
    /natural fuel for interpersonal comedy/i.test(text) ||
    /animal.or.plant interference/i.test(text) ||
    /built for a visible physical beat/i.test(text)
  ) {
    return true;
  }
  return ctx ? textHasUnsupportedLeakage(text, ctx) : false;
}

function isGenericRisk(text: string, ctx?: RepairContext): boolean {
  if (
    !text ||
    /Could feel thin if/i.test(text) ||
    /Needs a specific character reaction/i.test(text) ||
    /May need sharpening to match/i.test(text) ||
    /doesn't add a specific consequence/i.test(text) ||
    /slapstick without payoff/i.test(text) ||
    /interpersonal comedy flattens/i.test(text)
  ) {
    return true;
  }
  return ctx ? textHasUnsupportedLeakage(text, ctx) : false;
}

function buildWhyPromising(
  node: StartingNode,
  constellation: VisibleConstellation,
  ctx: RepairContext,
): string {
  const lower = `${node.title} ${node.description}`.toLowerCase();
  const focus = node.title.replace(/^The\s+/i, "").replace(/\?$/, "");

  if (/\b(tsunami|silent.*wave|wave.*silent)\b/.test(lower) && (ctx.flags.sciFi || ctx.flags.dream)) {
    return "It gives the future disaster a powerful symbolic image while preserving mystery and emotional dread.";
  }
  if (/\b(taste|rain|sensory|twice)\b/.test(lower) && (ctx.flags.romance || ctx.flags.dream)) {
    return "It makes the dream connection intimate and sensory before the characters fully understand it.";
  }
  if (/\b(data|search|covert|investigat)\b/.test(lower) && ctx.flags.sciFi) {
    return "It turns dream fragments into real-world investigation, connecting romance, mystery, and sci-fi stakes.";
  }

  if (ctx.isComedyJungle) {
    if (/\b(raft|race)\b/.test(lower) && /\b(river|ruin|cross|float)\b/.test(lower)) {
      return "It turns a simple survival task into a moving slapstick set piece where every weak raft part can fail in sequence.";
    }
    if (/\bbanana\b/.test(lower) && /\b(avalanche|peel|pile|fruit)\b/.test(lower)) {
      return "The fruit pile creates a rolling visual gag that can sweep characters through multiple zones in one beat.";
    }
  }

  if (ctx.flags.romance && ctx.flags.dream) {
    return `"${focus}" deepens the bond between the ${ctx.characterPlural} while advancing the disaster mystery in ${constellation.title}.`;
  }
  if (ctx.flags.screenplay) {
    return `"${focus}" opens a sceneable beat in ${constellation.title} that advances ${ctx.engine || ctx.premise}.`;
  }
  return `"${focus}" advances ${ctx.engine || ctx.premise} within ${constellation.title}, opening ${ctx.genre.toLowerCase()}-aligned exploration.`;
}

function buildRisk(node: StartingNode, constellation: VisibleConstellation, ctx: RepairContext): string {
  const lower = `${node.title} ${node.description}`.toLowerCase();
  const focus = node.title.replace(/^The\s+/i, "").replace(/\?$/, "");

  if (/\b(tsunami|silent.*wave)\b/.test(lower) && ctx.flags.sciFi) {
    return "It could become generic disaster imagery unless tied to a specific memory, location, or personal stake.";
  }
  if (/\b(taste|rain|sensory)\b/.test(lower) && ctx.flags.romance) {
    return "It may feel abstract unless the sensation creates a concrete real-world clue or emotional reaction.";
  }
  if (/\b(data|search|covert)\b/.test(lower) && ctx.flags.sciFi) {
    return "It could become dry exposition unless the search reveals something emotionally personal.";
  }

  if (ctx.isComedyJungle && /\b(raft|race)\b/.test(lower)) {
    return "It may feel like a generic river-crossing gag unless each friend contributes a different bad design choice.";
  }

  if (ctx.flags.screenplay) {
    return `"${focus}" in ${constellation.title} needs a clear dramatic choice or visual action or it may read as exposition.`;
  }
  return `"${focus}" in ${constellation.title} needs one sharp consequence tied to ${ctx.premise} to avoid feeling generic.`;
}

function repairNodeFields(
  node: StartingNode,
  constellation: VisibleConstellation,
  prompt: string,
  agents: ReasoningAgent[],
  ctx: RepairContext,
): void {
  if (isPlaceholderNodeTitle(node.title)) {
    const templates = getWorldSpecificNodeTemplates(prompt, ctx);
    const idx = Math.abs(node.title.length + node.id.length) % templates.length;
    node.title = templates[idx] ?? node.title;
  }

  if (!node.description || node.description.length < 20) {
    node.description = `In ${constellation.title}, "${node.title}" opens a concrete scene the creator can enter immediately — grounded in ${ctx.premise}.`;
  }

  if (isGenericWhyPromising(node.whyPromising, ctx)) {
    node.whyPromising = buildWhyPromising(node, constellation, ctx);
  }

  if (isGenericRisk(node.risk, ctx)) {
    node.risk = buildRisk(node, constellation, ctx);
  }

  const agent = agents.find((a) => a.id === node.generatedByAgentId);
  const needsQuestionRepair =
    node.explorationQuestions.length !== 3 ||
    !explorationQuestionsValid(node.title, node.description, node.explorationQuestions) ||
    node.explorationQuestions.some((q) => textHasUnsupportedLeakage(q, ctx));

  if (needsQuestionRepair) {
    repairExplorationQuestionsForNode(node, constellation, agent, ctx);
  }
}

function repairArchitectureLeakage(
  architecture: Omit<WorldArchitecture, "usedFallback" | "fallbackReason">,
  ctx: RepairContext,
  agents: ReasoningAgent[],
  constellations: VisibleConstellation[],
): void {
  for (const agent of architecture.reasoningAgents) {
    if (textHasUnsupportedLeakage(agent.role, ctx) || isTemplatedAgentText(agent.role)) {
      const profile = resolveAgentProfile(agent, constellations, ctx);
      agent.role = profile.role;
    }
    if (textHasUnsupportedLeakage(agent.lens, ctx) || isTemplatedAgentText(agent.lens)) {
      agent.lens = resolveAgentProfile(agent, constellations, ctx).lens;
    }
    if (agent.generates.some((g) => textHasUnsupportedLeakage(g, ctx) || isTemplatedGenerates([g]))) {
      agent.generates = [...resolveAgentProfile(agent, constellations, ctx).generates];
    }
  }

  if (criticAgentsHaveLeakage(architecture.criticAgents, ctx)) {
    architecture.criticAgents = buildDeterministicCriticAgents(ctx.decomposition);
  }

  for (const node of architecture.startingNodes) {
    const constel =
      constellations.find((c) => c.id === node.belongsToConstellationId) ?? constellations[0]!;
    const agent = agents.find((a) => a.id === node.generatedByAgentId);
    if (isGenericWhyPromising(node.whyPromising, ctx)) {
      node.whyPromising = buildWhyPromising(node, constel, ctx);
    }
    if (isGenericRisk(node.risk, ctx)) {
      node.risk = buildRisk(node, constel, ctx);
    }
    if (
      node.explorationQuestions.some((q) => textHasUnsupportedLeakage(q, ctx)) ||
      node.explorationQuestions.length !== 3
    ) {
      repairExplorationQuestionsForNode(node, constel, agent, ctx);
    }
  }
}

function scoreNodeQuality(node: StartingNode, prompt: string): number {
  let score = 0;
  if (!isPlaceholderNodeTitle(node.title)) score += 5;
  if (node.description.length > 40) score += 2;
  if (node.whyPromising.length > 20) score += 1;
  if (node.risk.length > 15) score += 1;
  if (node.explorationQuestions.length >= 3) score += 2;
  const promptWords = extractSeedWords(prompt);
  const titleLower = node.title.toLowerCase();
  for (const w of promptWords.slice(0, 5)) {
    if (titleLower.includes(w)) score += 1;
  }
  return score;
}

function trimStartingNodes(nodes: StartingNode[], prompt: string): StartingNode[] {
  if (nodes.length <= 15) return nodes;
  const ranked = [...nodes].sort(
    (a, b) => scoreNodeQuality(b, prompt) - scoreNodeQuality(a, prompt),
  );
  // Strict cap: never more than 15; prefer keeping the best 12–15
  const keepCount = Math.min(15, Math.max(12, ranked.length));
  return ranked.slice(0, keepCount);
}

function repairReasoningAgent(
  agent: ReasoningAgent,
  constellations: VisibleConstellation[],
  ctx: RepairContext,
): void {
  const linked = constellations.filter(
    (c) =>
      agent.linkedConstellationIds.includes(c.id) ||
      c.linkedReasoningAgentIds.includes(agent.id),
  );

  if (agent.linkedConstellationIds.length === 0 && linked.length > 0) {
    agent.linkedConstellationIds = linked.map((c) => c.id);
  } else if (agent.linkedConstellationIds.length === 0 && constellations.length > 0) {
    const idx = Math.abs(agent.id.length) % constellations.length;
    agent.linkedConstellationIds = [constellations[idx]!.id];
  }

  for (const cid of agent.linkedConstellationIds) {
    const c = constellations.find((x) => x.id === cid);
    if (c && !c.linkedReasoningAgentIds.includes(agent.id)) {
      c.linkedReasoningAgentIds.push(agent.id);
    }
  }

  applyOperationalProfile(agent, constellations, ctx);

  const profile = resolveAgentProfile(agent, constellations, ctx);
  const linkedTitle = linked[0]?.title ?? constellations[0]?.title ?? "this world";
  const prompt = ctx.prompt;

  if (agent.generates.length < 3 || agent.generates.some((g) => textHasUnsupportedLeakage(g, ctx))) {
    agent.generates = [...new Set([...profile.generates])].slice(0, 5);
  }

  if (agent.activationTriggers.length < 2) {
    const themeLabel = agent.name.replace(/\s+Agent$/i, "");
    const defaults = [
      `Creator explores ${linkedTitle} and needs a new ${themeLabel.toLowerCase()} branch`,
      `Branch generation calls for ${profile.generates[0] ?? "world-specific ideas"}`,
      `Steering direction mentions ${pickSeedWord(prompt, 0).toLowerCase()} or ${pickSeedWord(prompt, 1).toLowerCase()}`,
    ];
    agent.activationTriggers = [...new Set([...agent.activationTriggers, ...defaults])].slice(0, 4);
  }

  if (!agent.role || isTemplatedAgentText(agent.role) || textHasUnsupportedLeakage(agent.role, ctx)) {
    agent.role = profile.role;
  }
  if (!agent.lens || isTemplatedAgentText(agent.lens) || textHasUnsupportedLeakage(agent.lens, ctx)) {
    agent.lens = profile.lens;
  }
}

type CriticOperationalProfile = {
  job: string;
  checks: string[];
  rejectsIf: string[];
  repairsBy: string[];
  severity: CriticSeverity;
};

const PLACEHOLDER_CRITIC_NAME = /^Critic [1-5]$/i;

const DETERMINISTIC_CRITIC_IDS = {
  premise: "critic_premise_guardian",
  tone: "critic_tone_purpose_guardian",
  specificity: "critic_specificity_filter",
  logic: "critic_logic_continuity_checker",
  medium: "critic_medium_fit_checker",
} as const;

const DETERMINISTIC_CRITIC_ID_SET = new Set<string>(Object.values(DETERMINISTIC_CRITIC_IDS));

function normalizeCriticId(rawId: string, index: number): string {
  const fallbacks = Object.values(DETERMINISTIC_CRITIC_IDS);
  if (!rawId.trim()) return fallbacks[index] ?? `critic_${index + 1}`;

  let id = rawId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, "_");

  while (id.startsWith("critic_critic_")) {
    id = id.slice("critic_".length);
  }
  if (id.startsWith("critic_agent_")) {
    id = `critic_${id.slice("critic_agent_".length)}`;
  }
  if (!id.startsWith("critic_")) {
    id = `critic_${id}`;
  }

  if (id.includes("premise")) return DETERMINISTIC_CRITIC_IDS.premise;
  if (id.includes("tone") || id.includes("comedy") || id.includes("purpose")) {
    return DETERMINISTIC_CRITIC_IDS.tone;
  }
  if (id.includes("specific")) return DETERMINISTIC_CRITIC_IDS.specificity;
  if (id.includes("logic") || id.includes("continuity") || id.includes("escalation")) {
    return DETERMINISTIC_CRITIC_IDS.logic;
  }
  if (id.includes("medium") || id.includes("visual") || id.includes("gag") || id.includes("fit")) {
    return DETERMINISTIC_CRITIC_IDS.medium;
  }

  return id;
}

function isInvalidCriticAgent(critic: CriticAgent): boolean {
  if (PLACEHOLDER_CRITIC_NAME.test(critic.name.trim())) return true;
  if (!critic.job.trim()) return true;
  if (critic.checks.length < 3) return true;
  if (critic.rejectsIf.length < 2) return true;
  if (critic.repairsBy.length < 2) return true;
  return false;
}

function criticPremiseContext(ctx: RepairContext): {
  involveLine: string;
  abandonLine: string;
  repairConnect: string;
} {
  if (ctx.isComedyJungle) {
    return {
      involveLine: "Does it involve the friend group, jungle setting, or survival-chaos engine?",
      abandonLine: "The idea abandons the friend group, jungle, or chaos premise.",
      repairConnect: "Add a cause, obstacle, or consequence rooted in the jungle setting.",
    };
  }
  if (ctx.flags.dream && ctx.flags.romance && ctx.flags.sciFi) {
    return {
      involveLine: "Does it involve shared dreams, the two strangers, or the future disaster premise?",
      abandonLine: "The idea abandons shared dreams, the strangers, or the disaster engine.",
      repairConnect: "Reconnect the idea to a dream symbol, stranger choice, or disaster clue.",
    };
  }
  return {
    involveLine: `Does it involve the core characters, setting, or engine from: ${ctx.premise}?`,
    abandonLine: "The idea abandons the established premise, setting, or creative engine.",
    repairConnect: `Add a cause, obstacle, or consequence rooted in ${ctx.setting || "the world setting"}.`,
  };
}

function buildDeterministicCriticAgents(decomposition: WorldPromptDecomposition): CriticAgent[] {
  const ctx = buildRepairContext(decomposition);
  const pc = criticPremiseContext(ctx);

  const toneName = ctx.flags.comedy ? "Comedy Tone Guardian" : "Tone/Purpose Guardian";
  const toneJob = ctx.flags.comedy
    ? "Keeps ideas lighthearted, funny, non-harmful, and suitable for comedic storytelling."
    : `Protects the ${ctx.tones} tone and ${ctx.genre} purpose of this world.`;

  const toneChecks = ctx.flags.comedy
    ? [
        "Does the idea preserve the lighthearted comedic tone?",
        "Does it avoid realistic injury, trauma, or horror?",
        "Does it create visual, situational, or character-driven humor?",
      ]
    : [
        `Does the idea preserve the ${ctx.tones.split(",")[0]?.trim() ?? "intended"} tone?`,
        `Does it honor the ${ctx.genre.toLowerCase()} purpose and emotional register?`,
        "Does it avoid genre whiplash or imported tone from unrelated genres?",
      ];

  const toneRejects = ctx.flags.comedy
    ? [
        "The idea becomes serious survival drama, horror, tragedy, or realistic danger.",
        "The joke becomes cruel, mean-spirited, or emotionally heavy.",
      ]
    : [
        "The idea imports a tone incompatible with the seed (e.g. broad comedy in a serious romance).",
        "The emotional register breaks immersion or the intended audience experience.",
      ];

  const toneRepairs = ctx.flags.comedy
    ? [
        "Convert danger into harmless slapstick inconvenience.",
        "Replace fear or pain with embarrassment, confusion, or absurd delay.",
      ]
    : [
        `Realign the idea with ${ctx.tones.split(",")[0]?.trim() ?? "the intended"} tone markers.`,
        "Adjust stakes and emotional register to match the world premise.",
      ];

  const logicChecks =
    ctx.flags.dream || ctx.flags.sciFi
      ? [
          "Do dream rules and timeline logic stay consistent?",
          "Does cause-and-effect hold across dream and waking layers?",
          "Does the idea avoid contradictions with established premise clues?",
        ]
      : [
          "Does the idea open at least two future branches?",
          "Can stakes escalate naturally without feeling random?",
          "Does it create a consequence that affects another constellation?",
        ];

  const logicRepairs =
    ctx.flags.dream
      ? [
          "Clarify the dream rule or symbol that makes the idea coherent.",
          "Link the idea to a prior dream clue or waking-world confirmation.",
        ]
      : [
          "Add a consequence hook that invites the next branch.",
          `Connect the idea to ${ctx.engine || "the world's creative engine"} or an earlier beat.`,
        ];

  const mediumJob = ctx.flags.screenplay
    ? "Checks whether ideas work as cinematic, sceneable screenplay material."
    : ctx.flags.animation
      ? "Checks whether ideas produce clear visual storytelling suitable for animation."
      : `Checks whether ideas fit the intended ${ctx.outputType} medium and ${ctx.medium}.`;

  const mediumChecks = ctx.flags.screenplay
    ? [
        "Is the idea sceneable with clear action or dialogue potential?",
        "Does it have visual or cinematic potential on screen?",
        "Does it balance revelation, emotion, and forward momentum?",
      ]
    : ctx.flags.animation
      ? [
          "Does the idea create a visible, readable story beat?",
          "Can the moment be understood without excessive exposition?",
          "Does it use movement, expression, or visual contrast effectively?",
        ]
      : [
          "Does the idea fit the intended output format and audience experience?",
          "Could a creator explore it immediately in the intended medium?",
          "Does it match the scope and delivery of the seed?",
        ];

  const mediumRejects = ctx.flags.screenplay
    ? [
        "The idea is mostly abstract and cannot be staged as a scene.",
        "The visual action or dramatic beat is unclear.",
      ]
    : [
        "The idea is mostly abstract or exposition-only.",
        "The moment cannot be rendered clearly in the intended medium.",
      ];

  const mediumRepairs = ctx.flags.screenplay
    ? [
        "Add a concrete action, location, or character choice that can be filmed.",
        "Convert the idea into a scene with clear entry and exit beats.",
      ]
    : [
        "Add a concrete visual detail, object, or character action.",
        "Convert the idea into an immediately explorable story beat.",
      ];

  const specificityRepair = ctx.isComedyJungle
    ? "Replace abstract wording with a concrete object, creature, character action, or jungle event."
    : "Replace abstract wording with a concrete object, character action, place, or world-specific event.";

  return [
    {
      id: DETERMINISTIC_CRITIC_IDS.premise,
      name: "Premise Guardian",
      severity: "strict",
      job: "Keeps ideas anchored to the specific world premise, characters, setting, and creative engine.",
      checks: [
        "Does the idea clearly belong to this world premise?",
        pc.involveLine,
        "Does it create a useful consequence for future exploration?",
      ],
      rejectsIf: [
        ctx.flags.comedy
          ? "The idea could belong to any generic comedy or adventure."
          : "The idea could belong to any generic story in another genre.",
        pc.abandonLine,
      ],
      repairsBy: [
        ctx.isComedyJungle
          ? "Reconnect the idea to a friend decision or mistake."
          : `Reconnect the idea to a ${charLabel(ctx)} decision or story choice.`,
        pc.repairConnect,
      ],
    },
    {
      id: DETERMINISTIC_CRITIC_IDS.tone,
      name: toneName,
      severity: "strict",
      job: toneJob,
      checks: toneChecks,
      rejectsIf: toneRejects,
      repairsBy: toneRepairs,
    },
    {
      id: DETERMINISTIC_CRITIC_IDS.specificity,
      name: "Specificity Filter",
      severity: "strict",
      job: "Prevents abstract, generic, placeholder, or non-clickable ideas.",
      checks: [
        "Is the idea concrete and visual?",
        "Could a creator click and explore it immediately?",
        "Is the title specific to this world rather than a generic category?",
      ],
      rejectsIf: [
        "The title is generic, such as Conflict, Problem, Shortcut, Encounter, Theme, or Event.",
        "The description lacks a concrete object, character, place, action, or consequence.",
      ],
      repairsBy: [
        specificityRepair,
        "Add a specific detail from the world premise.",
      ],
    },
    {
      id: DETERMINISTIC_CRITIC_IDS.logic,
      name: "Logic/Continuity Checker",
      severity: "medium",
      job: ctx.flags.dream
        ? "Ensures dream logic, timeline consistency, and cause/effect coherence."
        : "Ensures ideas can expand into future branches with coherent escalation.",
      checks: logicChecks,
      rejectsIf: [
        ctx.flags.dream
          ? "The idea contradicts established dream rules or timeline logic."
          : "The idea is a one-off beat with no future use.",
        "The escalation or connection feels forced or disconnected from the premise.",
      ],
      repairsBy: logicRepairs,
    },
    {
      id: DETERMINISTIC_CRITIC_IDS.medium,
      name: "Medium Fit Checker",
      severity: "medium",
      job: mediumJob,
      checks: mediumChecks,
      rejectsIf: mediumRejects,
      repairsBy: mediumRepairs,
    },
  ];
}

function criticAgentsHaveLeakage(critics: CriticAgent[], ctx: RepairContext): boolean {
  for (const c of critics) {
    const blob = [c.job, ...c.checks, ...c.rejectsIf, ...c.repairsBy, c.name].join(" ");
    if (textHasUnsupportedLeakage(blob, ctx)) return true;
  }
  return false;
}

function validateAndRepairCriticAgents(
  critics: CriticAgent[],
  decomposition: WorldPromptDecomposition,
): CriticAgent[] {
  const ctx = buildRepairContext(decomposition);
  if (
    critics.length === 0 ||
    critics.some(isInvalidCriticAgent) ||
    criticAgentsHaveLeakage(critics, ctx)
  ) {
    return buildDeterministicCriticAgents(decomposition);
  }
  for (const critic of critics) {
    repairCriticAgent(critic, decomposition, ctx);
  }
  if (criticAgentsHaveLeakage(critics, ctx)) {
    return buildDeterministicCriticAgents(decomposition);
  }
  return critics;
}

function isPlaceholderCritic(critic: CriticAgent): boolean {
  if (/^Quality control for /i.test(critic.job)) return true;
  if (critic.checks.some((c) => /Does this idea satisfy .* criteria\?/i.test(c))) return true;
  if (critic.rejectsIf.some((r) => r === "The idea fails basic quality standards.")) return true;
  if (critic.repairsBy.some((r) => r === "Refine the idea to meet quality standards.")) return true;
  return false;
}

function applyCriticOperationalProfile(critic: CriticAgent, profile: CriticOperationalProfile): void {
  critic.job = profile.job;
  critic.checks = profile.checks;
  critic.rejectsIf = profile.rejectsIf;
  critic.repairsBy = profile.repairsBy;
  critic.severity = profile.severity;
}

const VISUAL_GAG_CRITIC_PROFILE: CriticOperationalProfile = {
  job: "Checks whether an idea can produce clear animation-friendly visual comedy.",
  checks: [
    "Does the idea create a visible physical gag?",
    "Can the moment be understood without heavy dialogue?",
    "Does it use exaggerated movement, timing, expression, prop comedy, or sound?",
  ],
  rejectsIf: [
    "The idea is mostly abstract or dialogue-only.",
    "The visual action is unclear or not funny.",
  ],
  repairsBy: [
    "Add a physical action, prop, creature, or movement pattern.",
    "Convert the idea into a visible animated beat.",
  ],
  severity: "medium",
};

function repairCriticAgent(
  critic: CriticAgent,
  decomposition: WorldPromptDecomposition,
  ctx: RepairContext,
): void {
  if (DETERMINISTIC_CRITIC_ID_SET.has(critic.id)) return;

  const nameLower = critic.name.toLowerCase();
  const premise = decomposition.worldUnderstanding.premise;
  const tones = ctx.tones;
  const genre = ctx.genre;

  if (
    ctx.flags.comedy &&
    (nameLower.includes("visual gag") || (nameLower.includes("visual") && nameLower.includes("valid")))
  ) {
    applyCriticOperationalProfile(critic, VISUAL_GAG_CRITIC_PROFILE);
  } else if (nameLower.includes("tone") || (nameLower.includes("comedy") && ctx.flags.comedy)) {
    critic.job = critic.job || `Keeps ideas aligned with ${tones} and suitable for ${genre.toLowerCase()}.`;
    if (critic.checks.length < 3) {
      critic.checks = [
        `Does the idea preserve the ${tones.split(",")[0]?.trim() ?? "intended"} tone?`,
        ctx.flags.comedy
          ? "Does the idea create visual or situational humor?"
          : "Does the idea avoid genre whiplash or imported tone?",
        `Does it honor the ${genre.toLowerCase()} purpose?`,
        ...critic.checks,
      ];
    }
    if (critic.rejectsIf.length < 2) {
      critic.rejectsIf = ctx.flags.comedy
        ? [
            "The idea becomes horror, tragedy, or realistic danger incompatible with the seed.",
            "The joke becomes cruel, mean-spirited, or tonally wrong.",
            ...critic.rejectsIf,
          ]
        : [
            "The idea imports a tone incompatible with the seed.",
            "The emotional register breaks immersion.",
            ...critic.rejectsIf,
          ];
    }
    if (critic.repairsBy.length < 2) {
      critic.repairsBy = ctx.flags.comedy
        ? [
            "Convert danger into harmless slapstick or absurd inconvenience.",
            "Add exaggeration, misunderstanding, or comic timing.",
            ...critic.repairsBy,
          ]
        : [
            `Realign the idea with ${tones.split(",")[0]?.trim() ?? "the intended"} tone.`,
            "Adjust stakes to match the world premise.",
            ...critic.repairsBy,
          ];
    }
  } else if (nameLower.includes("premise") || nameLower.includes("guardian")) {
    critic.job = critic.job || `Keeps ideas anchored to: ${premise}`;
    if (critic.checks.length < 3) {
      critic.checks = [
        "Does the idea honor the core world premise?",
        "Does it use the setting and characters meaningfully?",
        "Does it create chaos or tension connected to the premise?",
        ...critic.checks,
      ];
    }
    if (critic.rejectsIf.length < 2) {
      critic.rejectsIf = [
        "The idea could belong to any random story, not this specific world.",
        "The idea abandons the premise's setting or core engine.",
        ...critic.rejectsIf,
      ];
    }
    if (critic.repairsBy.length < 2) {
      critic.repairsBy = [
        "Reconnect the idea to a character decision from the premise.",
        "Add a cause or consequence rooted in the world's setting.",
        ...critic.repairsBy,
      ];
    }
  } else if (nameLower.includes("anti-serious") || nameLower.includes("seriousness")) {
    critic.job =
      "Prevents the story from drifting into realistic danger, trauma, horror, or heavy emotional seriousness.";
    critic.checks = [
      "Does this idea stay harmless and comedic?",
      "Does it avoid realistic jungle danger?",
      "Does it preserve friendship warmth?",
      ...critic.checks,
    ].slice(0, 6);
    critic.rejectsIf = [
      "The idea creates real injury, fear, abandonment, or trauma.",
      "The idea turns the jungle into horror or survival realism.",
      ...critic.rejectsIf,
    ].slice(0, 5);
    critic.repairsBy = [
      "Convert danger into slapstick inconvenience.",
      "Replace fear with embarrassment, confusion, or absurd delay.",
      ...critic.repairsBy,
    ].slice(0, 5);
  } else if (nameLower.includes("specific")) {
    critic.job = critic.job || "Prevents abstract, generic, or placeholder ideas.";
    if (critic.checks.length < 3) {
      critic.checks = [
        "Is the idea concrete and visual?",
        "Could the creator click and explore it immediately?",
        "Is the title specific to this world, not a generic category?",
        ...critic.checks,
      ];
    }
    if (critic.rejectsIf.length < 2) {
      critic.rejectsIf = [
        "The title is generic (Conflict, Problem, Shortcut, Encounter, Theme).",
        "The description is placeholder text without concrete detail.",
        ...critic.rejectsIf,
      ];
    }
    if (critic.repairsBy.length < 2) {
      critic.repairsBy = [
        "Replace abstract terms with concrete objects, characters, or events.",
        "Add a specific detail from the world prompt.",
        ...critic.repairsBy,
      ];
    }
  } else if (nameLower.includes("escalation") || nameLower.includes("exploration")) {
    critic.job = critic.job || "Evaluates whether ideas open strong future exploration paths.";
    if (critic.checks.length < 3) {
      critic.checks = [
        "Does the idea open at least two future branches?",
        "Can stakes escalate naturally from this idea?",
        "Does exploring this node teach something new about the world?",
        ...critic.checks,
      ];
    }
    if (critic.rejectsIf.length < 2) {
      critic.rejectsIf = [
        "The idea is a dead-end with nowhere to go.",
        "Escalation would feel forced or unrelated.",
        ...critic.rejectsIf,
      ];
    }
    if (critic.repairsBy.length < 2) {
      critic.repairsBy = [
        "Add a consequence hook that invites the next scene.",
        "Link the idea to an existing tension or character want.",
        ...critic.repairsBy,
      ];
    }
  } else if (isPlaceholderCritic(critic)) {
    // Unknown named critic with placeholder content — use escalation checker defaults
    critic.job = "Evaluates whether ideas open strong future exploration paths.";
    critic.checks = [
      "Does the idea open at least two future branches?",
      "Can stakes escalate naturally from this idea?",
      "Does exploring this node teach something new about the world?",
    ];
    critic.rejectsIf = [
      "The idea is a dead-end with nowhere to go.",
      "Escalation would feel forced or unrelated.",
    ];
    critic.repairsBy = [
      "Add a consequence hook that invites the next scene.",
      "Link the idea to an existing tension or character want.",
    ];
  }

  // Re-apply visual gag profile if still placeholder after generic fill
  if (
    (nameLower.includes("visual gag") || (nameLower.includes("visual") && nameLower.includes("valid"))) &&
    isPlaceholderCritic(critic)
  ) {
    applyCriticOperationalProfile(critic, VISUAL_GAG_CRITIC_PROFILE);
  }

  critic.checks = [...new Set(critic.checks)].slice(0, 6);
  critic.rejectsIf = [...new Set(critic.rejectsIf)].slice(0, 5);
  critic.repairsBy = [...new Set(critic.repairsBy)].slice(0, 5);

  // Meaningful severity defaults
  if (nameLower.includes("visual gag") || (nameLower.includes("visual") && nameLower.includes("valid"))) {
    critic.severity = "medium";
  } else if (nameLower.includes("anti-serious") || nameLower.includes("seriousness")) {
    critic.severity = "strict";
  } else if (nameLower.includes("tone") || nameLower.includes("premise") || nameLower.includes("specific")) {
    critic.severity = "strict";
  } else if (nameLower.includes("escalation") || nameLower.includes("exploration")) {
    critic.severity = "medium";
  } else if (nameLower.includes("animation") || nameLower.includes("viability")) {
    critic.severity = critic.severity === "strict" ? "medium" : (critic.severity || "soft");
  }
}

function syncConstellationNodeIds(
  constellations: VisibleConstellation[],
  nodes: StartingNode[],
): void {
  for (const c of constellations) {
    c.suggestedStartingNodeIds = nodes
      .filter((n) => n.belongsToConstellationId === c.id)
      .map((n) => n.id);
  }
}

function repairArchitecture(
  architecture: Omit<WorldArchitecture, "usedFallback" | "fallbackReason">,
  decomposition: WorldPromptDecomposition,
  seenIds: Set<string>,
): void {
  const ctx = buildRepairContext(decomposition);
  const prompt = decomposition.originalPrompt;
  const { visibleConstellations, reasoningAgents } = architecture;

  // Repair stylized constellation titles
  for (const c of visibleConstellations) {
    c.title = repairVisibleConstellationTitle(c.title, prompt, c.sourceCreativeLayer);
  }

  // Repair abstract agent names before linking
  repairReasoningAgentNames(reasoningAgents, visibleConstellations, ctx);

  for (const agent of reasoningAgents) {
    repairReasoningAgent(agent, visibleConstellations, ctx);
  }

  architecture.criticAgents = validateAndRepairCriticAgents(
    architecture.criticAgents,
    decomposition,
  );

  architecture.startingNodes.forEach((node, i) => {
    if (isPlaceholderNodeTitle(node.title)) {
      node.title = repairNodeTitle("", prompt, i, ctx);
      node.id = toStableId("node", node.title, seenIds);
    }
  });

  architecture.startingNodes = trimStartingNodes(architecture.startingNodes, prompt);

  while (architecture.startingNodes.length < 8) {
    const i = architecture.startingNodes.length;
    const constel = visibleConstellations[i % visibleConstellations.length]!;
    const title = repairNodeTitle("", prompt, i, ctx);
    const nodeId = toStableId("node", title, seenIds);
    const stubNode: StartingNode = {
      id: nodeId,
      title,
      description: `A vivid, concrete entry into ${constel.title}.`,
      belongsToConstellationId: constel.id,
      generatedByAgentId: "",
      whyPromising: "",
      risk: "",
      explorationQuestions: [],
      nodeType: "event",
    };
    const agentId = findBestAgentForNode(stubNode, reasoningAgents, ctx);
    const newNode: StartingNode = {
      ...stubNode,
      generatedByAgentId: agentId,
      whyPromising: "",
      risk: "",
      explorationQuestions: [],
    };
    newNode.whyPromising = buildWhyPromising(newNode, constel, ctx);
    newNode.risk = buildRisk(newNode, constel, ctx);
    architecture.startingNodes.push(newNode);
  }

  architecture.startingNodes = distributeStartingNodes(
    architecture.startingNodes,
    visibleConstellations,
    reasoningAgents,
    prompt,
    seenIds,
    ctx,
  );

  // Final strict cap after distribution may add nodes
  architecture.startingNodes = trimStartingNodes(architecture.startingNodes, prompt);
  rebalanceNodeDistribution(architecture.startingNodes, visibleConstellations, reasoningAgents, ctx);

  for (const node of architecture.startingNodes) {
    const constel =
      visibleConstellations.find((c) => c.id === node.belongsToConstellationId) ??
      visibleConstellations[0]!;
    repairNodeFields(node, constel, prompt, reasoningAgents, ctx);
    validateNodeAgentAssignment(node, reasoningAgents, ctx);
  }

  repairArchitectureLeakage(architecture, ctx, reasoningAgents, visibleConstellations);
  syncConstellationNodeIds(visibleConstellations, architecture.startingNodes);
}

function normalizeNodeType(v: unknown): NodeType {
  const s = str(v, "event").toLowerCase();
  return VALID_NODE_TYPES.has(s as NodeType) ? (s as NodeType) : "event";
}

function normalizeSeverity(v: unknown): CriticSeverity {
  const s = str(v, "medium").toLowerCase();
  return VALID_SEVERITIES.has(s as CriticSeverity) ? (s as CriticSeverity) : "medium";
}

// ── Gemini system prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the World Architect inside a creative worldbuilding platform.

You receive a WorldPromptDecomposition (Layer 1 output) and must design a controlled worldbuilding workspace structure.

You are NOT writing the story. You are designing the architecture for exploration.

═══ CONCEPTS ═══
Creative Layer — internal development area (from decomposition)
Visible Constellation — creator-friendly exploration zone on the canvas (4-6 items)
Reasoning Agent — internal specialist that GENERATES ideas (linked to constellations)
Critic Agent — internal quality-control agent (NEVER visible as constellations)
Starting Node — concrete first explorable idea (8-15 items)

═══ VISIBLE CONSTELLATIONS (4-6) ═══
Must be creator-friendly exploration zones, NOT generic writing categories.
Must NOT sound like backend agent names.

BAD: Character, Conflict, Structure, Tone, Friend Fiasco Architect Agent
GOOD (jungle comedy): The Friend Group, The Jungle's Tricks, Survival Gone Wrong, Animal Chaos, The Final Disaster, The Heart Beneath the Chaos

Each constellation needs:
- id (stable lowercase: constellation_friend_group)
- title (creator-facing)
- purpose, userFacingQuestion
- sourceCreativeLayer (from decomposition layer name)
- linkedReasoningAgentIds (will be filled — use placeholder IDs matching your agents)
- suggestedStartingNodeIds (matching your nodes)
- priority (1 = highest)

═══ REASONING AGENTS ═══
World-specific internal brains. Can sound technical but must be world-specific.
Each visible constellation must have at least one linked reasoning agent.
Names like: Friend Dynamics Agent, Jungle Mischief Agent, Survival Failure Agent, Visual Gag Agent

Each reasoning agent must have operational role, lens, and generates fields — not templated placeholders.
BAD role/lens: "Everything through the X lens", "Concrete X scenes and beats"
GOOD: specific generation duties tied to the agent's function (friend dynamics, jungle mischief, survival failures, etc.)

═══ CRITIC AGENTS (3-5) ═══
Internal only. Never visible on canvas.
Must include at least:
- one premise guardian
- one tone/purpose guardian
- one anti-generic filter
- one escalation/exploration checker

Examples: Comedy Tone Guardian, Premise Guardian, Specificity Filter, Escalation Checker

═══ STARTING NODES (8-15) ═══
Concrete, visual, explorable. NOT abstract words.
BAD: Conflict, Tone, Theme, Character, node_abc_123
GOOD: The Echoing Mimic Bird, Who Ate the Map?, The Banana Bridge Collapse

Each node must link to belongsToConstellationId and generatedByAgentId.

Return ONLY valid JSON:
{
  "architectureSummary": "string",
  "visibleConstellations": [...],
  "reasoningAgents": [...],
  "criticAgents": [...],
  "startingNodes": [...],
  "controlRules": {
    "mustPreserve": ["string"],
    "mustAvoid": ["string"],
    "generationPriorities": ["string"],
    "rankingCriteria": ["string"],
    "expansionRules": ["string"]
  }
}`;

// ── Decomposition-based fallback ────────────────────────────────────────────────

function buildArchitectureFallback(
  decomposition: WorldPromptDecomposition,
  reason?: string,
): WorldArchitecture {
  const prompt = decomposition.originalPrompt;
  const w1 = pickSeedWord(prompt, 0);
  const w2 = pickSeedWord(prompt, 1);
  const w3 = pickSeedWord(prompt, 2);
  const tones = decomposition.worldUnderstanding.tone.join(", ") || "Exploratory";
  const genre = decomposition.worldUnderstanding.genre || "Fiction";

  const seenIds = new Set<string>();

  const reasoningAgents: ReasoningAgent[] = decomposition.recommendedAgents
    .slice(0, 6)
    .map((agent, i) => {
      const name = agent.name.endsWith("Agent") ? agent.name : `${agent.name} Agent`;
      const id = toStableId("agent", name, seenIds);
      return {
        id,
        name,
        role: agent.role || "Idea Generator",
        lens: agent.lens || agent.shouldGenerate,
        generates: strArray(agent.shouldGenerate ? [agent.shouldGenerate] : [], 4),
        linkedConstellationIds: [] as string[],
        activationTriggers: [
          `Exploring ${name.replace(/\s+Agent$/i, "")} territory`,
          `Creator steers toward ${w1.toLowerCase()}-related ideas`,
        ],
      };
    });

  if (reasoningAgents.length === 0) {
    const defaults = [
      { name: `${w1} Dynamics Agent`, role: "Relationship Mapper" },
      { name: `${w2} Chaos Agent`, role: "Chaos Generator" },
      { name: `${w3} Escalation Agent`, role: "Escalation Designer" },
      { name: `Emotional Payoff Agent`, role: "Payoff Shaper" },
    ];
    for (const d of defaults) {
      reasoningAgents.push({
        id: toStableId("agent", d.name, seenIds),
        name: d.name,
        role: d.role,
        lens: `Everything through the ${d.name.replace(/\s+Agent$/i, "")} lens`,
        generates: [`${genre}-specific scenes and beats`, "Concrete explorable moments"],
        linkedConstellationIds: [],
        activationTriggers: [`Entering ${d.name.replace(/\s+Agent$/i, "")} exploration`],
      });
    }
  }

  const layerTitles = decomposition.requiredCreativeLayers.map((l) => l.name);
  const constellationCount = Math.min(6, Math.max(4, layerTitles.length || 4));

  const defaultConstellationTitles = [
    `The ${w1} Circle`,
    `The ${w2}'s Tricks`,
    `${w3} Gone Wrong`,
    `${w1} Chaos`,
    `The Final ${w2}`,
    `The Heart Beneath the ${w1}`,
  ];

  const visibleConstellations: VisibleConstellation[] = [];
  for (let i = 0; i < constellationCount; i++) {
    const layer = decomposition.requiredCreativeLayers[i];
    const rawTitle = layer
      ? repairConstellationTitle(layer.name, prompt, layer.name)
      : defaultConstellationTitles[i] ?? `The ${pickSeedWord(prompt, i)} Zone`;
    const title = isGenericConstellationTitle(rawTitle)
      ? (defaultConstellationTitles[i] ?? `The ${pickSeedWord(prompt, i)} Zone`)
      : rawTitle;
    const id = toStableId("constellation", title, seenIds);
    const agentIdx = i % reasoningAgents.length;
    const agentId = reasoningAgents[agentIdx]!.id;
    reasoningAgents[agentIdx]!.linkedConstellationIds.push(id);

    visibleConstellations.push({
      id,
      title,
      purpose: layer?.purpose ?? `Explore the ${title.toLowerCase()} dimension of this world`,
      userFacingQuestion: layer?.shouldExplore[0] ?? `What lives inside ${title}?`,
      sourceCreativeLayer: layer?.name ?? title,
      linkedReasoningAgentIds: [agentId],
      suggestedStartingNodeIds: [],
      priority: i + 1,
    });
  }

  const criticAgents: CriticAgent[] = buildDeterministicCriticAgents(decomposition);
  const ctx = buildRepairContext(decomposition);

  const startingNodes: StartingNode[] = [];
  const directions = decomposition.startingDirections;
  const targetNodeCount = Math.max(8, Math.min(15, directions.length + 4));
  const nodeTemplates = getWorldSpecificNodeTemplates(prompt, ctx);

  for (let i = 0; i < targetNodeCount; i++) {
    const dir = directions[i];
    let title = dir?.title ? repairNodeTitle(dir.title, prompt, i, ctx) : repairNodeTitle("", prompt, i, ctx);
    if (looksLikeInternalId(title) || isPlaceholderNodeTitle(title)) {
      title = nodeTemplates[i % nodeTemplates.length] ?? repairNodeTitle("", prompt, i, ctx);
    }

    const constIdx = i % visibleConstellations.length;
    const constellation = visibleConstellations[constIdx]!;
    const agentId = constellation.linkedReasoningAgentIds[0] ?? reasoningAgents[0]!.id;
    const nodeId = toStableId("node", title, seenIds);

    const agent = reasoningAgents.find((a) => a.id === agentId);
    const newNode: StartingNode = {
      id: nodeId,
      title,
      description: dir?.description ?? `A concrete entry point into ${constellation.title}`,
      belongsToConstellationId: constellation.id,
      generatedByAgentId: agentId,
      whyPromising: dir?.whyPromising ?? "",
      risk: dir?.risk ?? "",
      explorationQuestions: [],
      nodeType: (["event", "character", "setting", "conflict", "mystery", "relationship", "object"] as NodeType[])[i % 7] ?? "event",
    };
    if (!newNode.whyPromising || isGenericWhyPromising(newNode.whyPromising, ctx)) {
      newNode.whyPromising = buildWhyPromising(newNode, constellation, ctx);
    }
    if (!newNode.risk || isGenericRisk(newNode.risk, ctx)) {
      newNode.risk = buildRisk(newNode, constellation, ctx);
    }
    repairExplorationQuestionsForNode(newNode, constellation, agent, ctx);
    startingNodes.push(newNode);
  }

  const architectureBody: Omit<WorldArchitecture, "usedFallback" | "fallbackReason"> = {
    sourcePrompt: prompt,
    architectureSummary: `A ${genre.toLowerCase()} worldbuilding workspace for: ${decomposition.worldUnderstanding.premise}. ${visibleConstellations.length} exploration zones, ${reasoningAgents.length} reasoning agents, ${criticAgents.length} critics, ${startingNodes.length} starting nodes.`,
    visibleConstellations,
    reasoningAgents,
    criticAgents,
    startingNodes,
    controlRules: {
      mustPreserve: decomposition.constraints.mustPreserve.length > 0
        ? decomposition.constraints.mustPreserve
        : [decomposition.worldUnderstanding.premise, `${genre} identity`, `${tones} tone`],
      mustAvoid: decomposition.constraints.shouldAvoid.length > 0
        ? decomposition.constraints.shouldAvoid
        : ["Generic writing categories as visible zones", "Internal IDs as titles", "Unrelated genre content"],
      generationPriorities: [
        "World-specific concrete ideas over abstract categories",
        "Escalation potential in every branch",
        "Tone fidelity to the seed",
      ],
      rankingCriteria: [
        "Specificity to the world prompt",
        "Exploration potential (opens new paths)",
        "Emotional/thematic resonance",
        "Premise alignment",
      ],
      expansionRules: [
        "Accepted nodes unlock related constellation depth",
        "Rejected ideas inform critic calibration",
        "Creator direction reshapes agent activation triggers",
      ],
    },
  };

  repairArchitecture(architectureBody, decomposition, seenIds);

  return {
    usedFallback: true,
    fallbackReason: reason ?? "Gemini unavailable",
    ...architectureBody,
  };
}

// ── Normalize & repair Gemini output ────────────────────────────────────────────

function normalizeArchitecture(
  raw: unknown,
  decomposition: WorldPromptDecomposition,
): WorldArchitecture | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const prompt = decomposition.originalPrompt;

  const seenIds = new Set<string>();

  // Reasoning agents first (constellations reference them)
  const agentsRaw = obj["reasoningAgents"] ?? obj["reasoning_agents"] ?? obj["agents"];
  if (!Array.isArray(agentsRaw) || agentsRaw.length < 1) return null;

  const reasoningAgents: ReasoningAgent[] = agentsRaw.slice(0, 8).map((a, i) => {
    const r = a as Record<string, unknown>;
    const name = str(r["name"], `Specialist Agent ${i + 1}`);
    const id = toStableId("agent", str(r["id"], name), seenIds);
    return {
      id,
      name: isGenericTerm(name) ? `${pickSeedWord(prompt, i)} ${name.replace(/\s+Agent$/i, "")} Agent` : name,
      role: str(r["role"]),
      lens: str(r["lens"]),
      generates: strArray(r["generates"] ?? r["shouldGenerate"], 6),
      linkedConstellationIds: strArray(r["linkedConstellationIds"] ?? r["linked_constellation_ids"], 8),
      activationTriggers: strArray(r["activationTriggers"] ?? r["activation_triggers"], 5),
    };
  });

  const constRaw = obj["visibleConstellations"] ?? obj["visible_constellations"] ?? obj["constellations"];
  if (!Array.isArray(constRaw) || constRaw.length < 2) return null;

  let visibleConstellations: VisibleConstellation[] = constRaw.slice(0, 8).map((c, i) => {
    const r = c as Record<string, unknown>;
    const rawTitle = str(r["title"], `Zone ${i + 1}`);
    const layerName = str(r["sourceCreativeLayer"] ?? r["source_creative_layer"]);
    const title = repairVisibleConstellationTitle(
      isGenericConstellationTitle(repairConstellationTitle(rawTitle, prompt, layerName))
        ? repairConstellationTitle("", prompt, layerName)
        : repairConstellationTitle(rawTitle, prompt, layerName),
      prompt,
      layerName,
    );
    const id = toStableId("constellation", str(r["id"], title), seenIds);
    return {
      id,
      title,
      purpose: str(r["purpose"]),
      userFacingQuestion: str(r["userFacingQuestion"] ?? r["user_facing_question"]),
      sourceCreativeLayer: layerName || decomposition.requiredCreativeLayers[i]?.name || title,
      linkedReasoningAgentIds: strArray(r["linkedReasoningAgentIds"] ?? r["linked_reasoning_agent_ids"], 6),
      suggestedStartingNodeIds: strArray(r["suggestedStartingNodeIds"] ?? r["suggested_starting_node_ids"], 20),
      priority: typeof r["priority"] === "number" ? r["priority"] : i + 1,
    };
  });

  // Trim to 4-6, keep strongest by priority
  visibleConstellations.sort((a, b) => a.priority - b.priority);
  if (visibleConstellations.length > 6) {
    visibleConstellations = visibleConstellations.slice(0, 6);
  }

  const nodesRaw = obj["startingNodes"] ?? obj["starting_nodes"] ?? obj["nodes"];
  if (!Array.isArray(nodesRaw) || nodesRaw.length < 2) return null;

  let startingNodes: StartingNode[] = nodesRaw.slice(0, 20).map((n, i) => {
    const r = n as Record<string, unknown>;
    let title = str(r["title"], "");
    if (!title || isGenericNodeTitle(title) || isPlaceholderNodeTitle(title)) {
      title = repairNodeTitle(title, prompt, i);
    }
    const id = toStableId("node", str(r["id"], title), seenIds);
    return {
      id,
      title,
      description: str(r["description"]),
      belongsToConstellationId: str(r["belongsToConstellationId"] ?? r["belongs_to_constellation_id"]),
      generatedByAgentId: str(r["generatedByAgentId"] ?? r["generated_by_agent_id"]),
      whyPromising: str(r["whyPromising"] ?? r["why_promising"]),
      risk: str(r["risk"]),
      explorationQuestions: strArray(r["explorationQuestions"] ?? r["exploration_questions"], 5),
      nodeType: normalizeNodeType(r["nodeType"] ?? r["node_type"]),
    };
  });

  const criticsRaw = obj["criticAgents"] ?? obj["critic_agents"] ?? obj["critics"];
  let criticAgents: CriticAgent[] = Array.isArray(criticsRaw)
    ? criticsRaw.slice(0, 6).map((c, i) => {
        const r = c as Record<string, unknown>;
        const name = str(r["name"], `Critic ${i + 1}`);
        const rawId = str(r["id"], name);
        const id = normalizeCriticId(rawId, i);
        return {
          id,
          name,
          job: str(r["job"]),
          checks: strArray(r["checks"], 5),
          rejectsIf: strArray(r["rejectsIf"] ?? r["rejects_if"], 5),
          repairsBy: strArray(r["repairsBy"] ?? r["repairs_by"], 5),
          severity: normalizeSeverity(r["severity"]),
        };
      })
    : [];

  criticAgents = validateAndRepairCriticAgents(criticAgents, decomposition);

  const rulesRaw = obj["controlRules"] ?? obj["control_rules"];
  const rulesObj =
    rulesRaw && typeof rulesRaw === "object"
      ? (rulesRaw as Record<string, unknown>)
      : {};

  const agentIds = new Set(reasoningAgents.map((a) => a.id));

  // Ensure 4-6 constellations
  while (visibleConstellations.length < 4) {
    const i = visibleConstellations.length;
    const title = repairConstellationTitle("", prompt, decomposition.requiredCreativeLayers[i]?.name);
    const id = toStableId("constellation", title, seenIds);
    visibleConstellations.push({
      id,
      title,
      purpose: decomposition.requiredCreativeLayers[i]?.purpose ?? `Explore ${title}`,
      userFacingQuestion: `What secrets hide in ${title}?`,
      sourceCreativeLayer: decomposition.requiredCreativeLayers[i]?.name ?? title,
      linkedReasoningAgentIds: [reasoningAgents[i % reasoningAgents.length]!.id],
      suggestedStartingNodeIds: [],
      priority: i + 1,
    });
  }

  // Validate constellation → agent links exist
  for (const constellation of visibleConstellations) {
    constellation.linkedReasoningAgentIds = constellation.linkedReasoningAgentIds.filter((id) =>
      agentIds.has(id),
    );
    if (constellation.linkedReasoningAgentIds.length === 0) {
      constellation.linkedReasoningAgentIds = [
        reasoningAgents[constellation.priority % reasoningAgents.length]!.id,
      ];
    }
  }

  const architectureSummary =
    str(obj["architectureSummary"] ?? obj["architecture_summary"]) ||
    `Worldbuilding architecture for: ${decomposition.worldUnderstanding.premise}`;

  const architectureBody: Omit<WorldArchitecture, "usedFallback" | "fallbackReason"> = {
    sourcePrompt: prompt,
    architectureSummary,
    visibleConstellations,
    reasoningAgents,
    criticAgents,
    startingNodes,
    controlRules: {
      mustPreserve: strArray(rulesObj["mustPreserve"] ?? rulesObj["must_preserve"], 8).length > 0
        ? strArray(rulesObj["mustPreserve"] ?? rulesObj["must_preserve"], 8)
        : decomposition.constraints.mustPreserve,
      mustAvoid: strArray(rulesObj["mustAvoid"] ?? rulesObj["must_avoid"], 8).length > 0
        ? strArray(rulesObj["mustAvoid"] ?? rulesObj["must_avoid"], 8)
        : decomposition.constraints.shouldAvoid,
      generationPriorities: strArray(rulesObj["generationPriorities"] ?? rulesObj["generation_priorities"], 6),
      rankingCriteria: strArray(rulesObj["rankingCriteria"] ?? rulesObj["ranking_criteria"], 6),
      expansionRules: strArray(rulesObj["expansionRules"] ?? rulesObj["expansion_rules"], 6),
    },
  };

  repairArchitecture(architectureBody, decomposition, seenIds);

  return {
    usedFallback: false,
    ...architectureBody,
  };
}

// ── Gemini call ─────────────────────────────────────────────────────────────────

async function architectWithGemini(
  decomposition: WorldPromptDecomposition,
  apiKey: string,
): Promise<WorldArchitecture> {
  const decompositionJson = JSON.stringify(decomposition, null, 2);

  const userContent = [
    "World Prompt Decomposition (Layer 1 output):",
    decompositionJson,
    "",
    "Design the World Architecture (Layer 2) for this decomposition.",
    "Remember: visible constellations are creator-friendly exploration zones.",
    "Critic agents are internal only and must never appear as visible constellations.",
    "Starting nodes must be concrete and explorable — never abstract category words or internal IDs.",
  ].join("\n");

  const prompt = `${SYSTEM_PROMPT}\n\n---\n\n${userContent}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${ARCHITECT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string; code?: number };
  };

  if (!res.ok) {
    const msg = payload.error?.message ?? res.statusText;
    throw new Error(`Gemini HTTP ${res.status}: ${msg}`);
  }

  if (payload.error) {
    throw new Error(`Gemini error: ${payload.error.message ?? "unknown"}`);
  }

  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from Gemini");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (e) {
    throw new Error(`Gemini JSON parse failed: ${String(e)}`);
  }

  const normalized = normalizeArchitecture(parsed, decomposition);
  if (!normalized) {
    throw new Error("Invalid architecture shape from Gemini response");
  }

  return normalized;
}

// ── Public entry point ──────────────────────────────────────────────────────────

export async function architectWorld(
  decomposition: WorldPromptDecomposition,
): Promise<WorldArchitecture> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildArchitectureFallback(decomposition, "Missing GEMINI_API_KEY");
  }

  try {
    return await architectWithGemini(decomposition, apiKey);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return buildArchitectureFallback(decomposition, reason);
  }
}

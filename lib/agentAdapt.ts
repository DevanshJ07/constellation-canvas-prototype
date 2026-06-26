/**
 * Agent Adapt — World adaptation engine.
 * Analyses existing future nodes against creator direction and reshapes them:
 * add / modify / replace / weaken / remove.
 */

import type { ExploreAgent, AgentInsight } from "@/lib/agentExplore";
export { type ExploreAgent, type AgentInsight };

// ── Shared types ──────────────────────────────────────────────────────────────

export type ExistingNodeInfo = {
  id: string;
  title: string;
  description: string;
  domain: string;
  generated: boolean;
};

export type AdaptAddBranch = {
  title: string;
  description: string;
  whyItMatters: string;
  domain: string;
  sourceAgent: string;
  rippleHint: string;
  crossDomainEffects: { domain: string; effect: string }[];
  continuityRisk: "low" | "medium" | "high";
  qualityScore: number;
};

export type AdaptModify = {
  targetId: string;
  newTitle: string;
  newDescription: string;
  newWhyItMatters: string;
  reason: string;
};

export type AdaptReplace = {
  targetId: string;
  replacement: AdaptAddBranch;
  reason: string;
};

export type AdaptWeaken = {
  targetId: string;
  reason: string;
};

export type AdaptRemove = {
  targetId: string;
  reason: string;
};

export type CrossDomainUpdate = {
  domain: string;
  change: string;
  newBranchTitle: string;
};

export type AgentAdaptInput = {
  worldSeed: string;
  currentNode: {
    id: string;
    title: string;
    description: string;
    whyItMatters: string;
    domain: string;
  };
  activeDomain: string;
  creatorDirection: string;
  canonThreads: unknown;
  worldTensions: string[];
  currentPath: string[];
  existingFutureNodes: ExistingNodeInfo[];
  existingSiblingNodes: ExistingNodeInfo[];
  rejectedIdeas: string[];
  establishedTruths: string[];
};

export type AgentAdaptOutput = {
  selectedAgents: ExploreAgent[];
  agentInsights: AgentInsight[];
  adaptations: {
    add: AdaptAddBranch[];
    modify: AdaptModify[];
    replace: AdaptReplace[];
    weaken: AdaptWeaken[];
    remove: AdaptRemove[];
  };
  crossDomainUpdates: CrossDomainUpdate[];
  worldShiftSummary: string;
  continuityWarnings: string[];
  usedFallback?: boolean;
};

// ── Direction profiles ────────────────────────────────────────────────────────

type DirectionGenre =
  | "psychological"
  | "comic"
  | "romantic"
  | "action"
  | "supernatural"
  | "dark"
  | "neutral";

function detectGenre(direction: string): DirectionGenre {
  const d = direction.toLowerCase();
  if (/psycholog|mental|mind|memory|identity|doubt|guilt|perceiv|introspect|sanity|trauma/.test(d))
    return "psychological";
  if (/comic|comedy|funny|humor|absurd|chaotic|chaos|slapstick|ridiculous|lightheart/.test(d))
    return "comic";
  if (/romant|love|emotion|heart|longing|tender|relation|bond|feeling/.test(d))
    return "romantic";
  if (/action|fight|conflict|chase|danger|survive|survival|urgenc|thrill|intense/.test(d))
    return "action";
  if (/supernatural|divine|spirit|ghost|mystical|cursed|sacred|occult|witch/.test(d))
    return "supernatural";
  if (/dark|grim|brutal|horror|bleak|death|dread|sinister|nightmare/.test(d))
    return "dark";
  return "neutral";
}

function genreKeywords(genre: DirectionGenre): string[] {
  switch (genre) {
    case "psychological":
      return [
        "memory", "identity", "doubt", "guilt", "perceiv", "introspect",
        "sanity", "trauma", "mind", "psyche", "confess", "illusion", "realiz",
        "question", "internal", "unravel",
      ];
    case "comic":
      return [
        "absurd", "chaos", "comedy", "funny", "ridiculous", "bizarre",
        "twist", "accident", "mishap", "ironic", "farce", "clumsy",
      ];
    case "romantic":
      return [
        "love", "longing", "relation", "bond", "heart", "emotion",
        "tender", "devotion", "attachment", "feeling",
      ];
    case "action":
      return [
        "conflict", "chase", "danger", "survival", "fight", "escape",
        "urgency", "threat", "race", "battle", "confront",
      ];
    case "supernatural":
      return [
        "divine", "curse", "ghost", "spirit", "mystical", "sacred",
        "ritual", "occult", "enchant", "omen", "prophecy",
      ];
    case "dark":
      return [
        "dread", "fear", "horror", "death", "dark", "brutal", "grim",
        "despair", "nightmare", "bleak",
      ];
    default:
      return [];
  }
}

function genreAntiKeywords(genre: DirectionGenre): string[] {
  switch (genre) {
    case "psychological":
      return [
        "curse", "divine", "ritual", "ghost", "spirit", "supernatural",
        "action", "fight", "chase",
      ];
    case "comic":
      return [
        "dark", "grim", "horror", "dread", "brutal", "bleak", "tragedy",
        "death", "despair",
      ];
    case "romantic":
      return [
        "action", "fight", "chaos", "brutal", "grim", "horror",
      ];
    case "action":
      return [
        "quiet", "meditat", "reflect", "memory", "introspect", "comic",
      ];
    case "supernatural":
      return [
        "psycholog", "realistic", "mundane", "comedy", "science",
      ];
    case "dark":
      return [
        "comedy", "romance", "light", "hope", "happy", "funny",
      ];
    default:
      return [];
  }
}

/** 0–100: how well a node aligns with the genre */
function nodeAlignmentScore(node: ExistingNodeInfo, genre: DirectionGenre): number {
  if (genre === "neutral") return 60;
  const text = (node.title + " " + node.description).toLowerCase();
  const goodKw = genreKeywords(genre);
  const badKw = genreAntiKeywords(genre);

  let score = 50;
  for (const kw of goodKw) {
    if (text.includes(kw)) score += 12;
  }
  for (const kw of badKw) {
    if (text.includes(kw)) score -= 18;
  }
  return Math.max(0, Math.min(100, score));
}

// ── Specialist pools ──────────────────────────────────────────────────────────

const GENRE_AGENTS: Record<DirectionGenre, ExploreAgent[]> = {
  psychological: [
    { name: "Psychological Horror Agent", role: "Human dread and internal fear mechanics", whySelected: "Direction leans into the mind." },
    { name: "Memory Logic Agent", role: "Rules of remembering, forgetting, and misremembering", whySelected: "Memory is structural to this direction." },
    { name: "Continuity Agent", role: "Canon coherence and contradiction checks", whySelected: "Protecting established truth while adapting the framing." },
    { name: "Symbolism Agent", role: "Motifs, imagery, and thematic coherence", whySelected: "Psychological worlds run on symbols." },
  ],
  comic: [
    { name: "Comedy Agent", role: "Absurdist logic and comedic timing", whySelected: "Direction explicitly requests levity." },
    { name: "Slapstick Agent", role: "Physical chaos and escalating mishaps", whySelected: "Chaos-adjacent direction detected." },
    { name: "Character Dynamics Agent", role: "Relationships under pressure and personality collisions", whySelected: "Comedy lives in character friction." },
    { name: "Pacing Agent", role: "Rhythm, escalation, and release", whySelected: "Comic structures depend on pacing." },
  ],
  romantic: [
    { name: "Romance Agent", role: "Emotional stakes and longing dynamics", whySelected: "Direction is emotionally centred." },
    { name: "Emotional Depth Agent", role: "Internal experience and vulnerability", whySelected: "Romantic framing requires authentic feeling." },
    { name: "Character Relationship Agent", role: "Bond formation, tension, and resolution", whySelected: "Relationships are the primary engine here." },
    { name: "Continuity Agent", role: "Canon coherence and contradiction checks", whySelected: "Ensuring romantic threads do not contradict established truths." },
  ],
  action: [
    { name: "Action Agent", role: "Momentum, stakes, and physical consequence", whySelected: "Direction is explicitly action-oriented." },
    { name: "Thriller Agent", role: "Sustained dread and escalating threat", whySelected: "Action requires a threat to drive against." },
    { name: "Conflict Agent", role: "Opposition, motive, and collision", whySelected: "Every action story needs a clear opposition." },
    { name: "Pacing Agent", role: "Rhythm, escalation, and release", whySelected: "Action requires tight pacing." },
  ],
  supernatural: [
    { name: "Mythology Agent", role: "Sacred logic and folklore consequences", whySelected: "Supernatural direction activates mythic domain." },
    { name: "Symbolism Agent", role: "Motifs, imagery, and thematic coherence", whySelected: "Supernatural worlds run on symbolic language." },
    { name: "Continuity Agent", role: "Canon coherence and contradiction checks", whySelected: "Supernatural rules must remain internally consistent." },
    { name: "Ritual Agent", role: "Ceremonial logic, taboo, and repeated acts", whySelected: "Supernatural worlds need ritual architecture." },
  ],
  dark: [
    { name: "Psychological Horror Agent", role: "Human dread and internal fear mechanics", whySelected: "Darkness requires understanding what humans fear." },
    { name: "Mythology Agent", role: "Sacred logic and folklore consequences", whySelected: "Dark worlds often draw from cultural horror." },
    { name: "Continuity Agent", role: "Canon coherence and contradiction checks", whySelected: "Dark narratives need strict internal logic." },
    { name: "Symbolism Agent", role: "Motifs, imagery, and thematic coherence", whySelected: "Darkness communicates through symbol." },
  ],
  neutral: [
    { name: "Worldbuilding Agent", role: "Ensuring nodes feel native to the world seed", whySelected: "Default for mixed contexts." },
    { name: "Continuity Agent", role: "Canon coherence and contradiction checks", whySelected: "Always needed as canon grows." },
    { name: "Plot/Conflict Agent", role: "Stakes, opposition, and narrative propulsion", whySelected: "Every node needs dramatic pressure." },
  ],
};

// ── Branch pools ──────────────────────────────────────────────────────────────

type BranchSeed = {
  title: string;
  description: string;
  whyItMatters: string;
  domain: string;
  agentName: string;
  rippleHint: string;
};

const GENRE_BRANCHES: Record<DirectionGenre, BranchSeed[]> = {
  psychological: [
    {
      title: "The Memory You Manufactured",
      description:
        "A detailed memory that feels too perfect. Upon inspection the sensory details belong to a different time, a different place. But confronting this risks everything the memory was protecting.",
      whyItMatters:
        "False memories are not errors — they are architecture. What the mind chose to build instead of the truth reveals more than the truth would.",
      domain: "mystery",
      agentName: "Memory Logic Agent",
      rippleHint: "Could unlock identity fracture or grief-displacement threads.",
    },
    {
      title: "The Person Who Keeps Changing Shape",
      description:
        "Not physically, but in how different people remember them. Ask four witnesses and you receive four descriptions of different people occupying the same life.",
      whyItMatters:
        "When identity is unstable in memory, the question is whether the person was performing different selves or whether the witnesses were the ones hallucinating.",
      domain: "mystery",
      agentName: "Psychological Horror Agent",
      rippleHint: "May unlock unreliable-narrator or mass-perception mechanics.",
    },
    {
      title: "The Confession That Arrived Before the Crime",
      description:
        "Someone wrote down what they were going to do eleven years ago. The paper was hidden. Then they forgot. Then they did it anyway.",
      whyItMatters:
        "Predestined guilt is the worst kind — it removes agency while preserving shame. This node explores how much of behaviour is authored versus recalled.",
      domain: "fear",
      agentName: "Psychological Horror Agent",
      rippleHint: "Connects to fate mechanics, guilt loops, and free will debates.",
    },
    {
      title: "The Doubt That Arrived Before the Evidence",
      description:
        "A character becomes certain of something they have no logical basis for being certain of. Then the evidence begins to arrive, one piece at a time, as if summoned.",
      whyItMatters:
        "Conviction that precedes proof suggests either extraordinary intuition or extraordinary self-deception. The world has not yet decided which.",
      domain: "mystery",
      agentName: "Continuity Agent",
      rippleHint: "May trigger prophetic logic or perception-distortion canon threads.",
    },
  ],
  comic: [
    {
      title: "The Temple That Filed a Complaint",
      description:
        "The ancient sacred site has submitted formal paperwork about the number of unsolicited offerings left at its entrance. The bureaucracy of the divine is deeply unglamorous.",
      whyItMatters:
        "Comedy that emerges from the collision of the sacred and the procedural exposes how both systems are fundamentally absurd when examined closely.",
      domain: "mythology",
      agentName: "Comedy Agent",
      rippleHint: "Could unlock divine-bureaucracy or chaotic-ritual threads.",
    },
    {
      title: "The Legend Nobody Agrees On",
      description:
        "Four villages share a founding myth. They have six different versions, none of which agree on any detail except the colour of the sky. Historians are involved. It is not going well.",
      whyItMatters:
        "Collective memory that produces active disagreement is a world telling you it is more interested in the argument than the fact.",
      domain: "mythology",
      agentName: "Character Dynamics Agent",
      rippleHint: "May unlock cultural-war or competing-truth mechanics.",
    },
    {
      title: "The Ritual That Got Slightly Out of Hand",
      description:
        "What began as a three-minute annual ceremony now involves fourteen families, a disputed schedule, a goat that has become a local celebrity, and legal representation.",
      whyItMatters:
        "Rituals that accumulate logistics are rituals that have survived by becoming arguments. They no longer remember what they are for, only how to fight about how to do them.",
      domain: "rituals",
      agentName: "Slapstick Agent",
      rippleHint: "Links to institutional-absurdity or sacred-comedy mechanics.",
    },
  ],
  romantic: [
    {
      title: "The Letter Written in the Wrong Year",
      description:
        "Someone wrote a letter explaining everything, then did not send it for nine years. By the time it arrived, the circumstances that made it necessary had changed entirely, but the feeling had not.",
      whyItMatters:
        "A feeling that survives the obsolescence of its cause is either love or a haunting. This world has not yet determined which.",
      domain: "mystery",
      agentName: "Romance Agent",
      rippleHint: "Could unlock delayed-revelation or time-and-longing threads.",
    },
    {
      title: "The Person Who Remembers Everyone Except You",
      description:
        "They have extraordinary recall. Names, faces, conversations from decades ago. And yet your interactions seem to vanish. You have started keeping notes.",
      whyItMatters:
        "Selective forgetting in a person with otherwise perfect memory is a choice. The question is what the choice is protecting them from.",
      domain: "mystery",
      agentName: "Emotional Depth Agent",
      rippleHint: "May trigger hidden-wound or deliberate-erasure mechanics.",
    },
    {
      title: "The Village That Celebrates Failed Marriages",
      description:
        "On a specific date, couples who separated hold a public dinner together. Not reconciliation — just recognition that the time was real, even if it ended.",
      whyItMatters:
        "A culture that marks endings rather than only beginnings is a culture with a sophisticated relationship to impermanence. What they celebrate reveals what they actually value.",
      domain: "rituals",
      agentName: "Character Relationship Agent",
      rippleHint: "Links to grief-ritual, impermanence-acceptance, or cultural-intimacy threads.",
    },
  ],
  action: [
    {
      title: "The Road Everyone Stopped Using",
      description:
        "There is a faster route between two villages that has been abandoned for seventeen years. Nobody will explain why. But the stones on it are kept clean by persons unknown.",
      whyItMatters:
        "Infrastructure that is maintained in secret is infrastructure that serves a purpose being hidden. The road is not abandoned — it is reserved.",
      domain: "mystery",
      agentName: "Thriller Agent",
      rippleHint: "Could unlock hidden-network or territorial-conflict threads.",
    },
    {
      title: "The Border That Moves at Night",
      description:
        "The territorial line between two domains shifts slightly with each full moon. Both sides have agreed not to discuss this. The agreement is holding, but only just.",
      whyItMatters:
        "Borders that move are arguments waiting to happen. The silence is not peace — it is a countdown.",
      domain: "bloodlines",
      agentName: "Conflict Agent",
      rippleHint: "May trigger territorial-war or authority-collapse mechanics.",
    },
    {
      title: "The Message Nobody Has Decoded Yet",
      description:
        "A series of marks found on three separate structures, in three separate settlements, that appear to be in the same hand. They have been there for at least a hundred years. They are not a language anyone recognises.",
      whyItMatters:
        "Information that has been deliberately preserved but not yet decoded is information that has been waiting for the right reader. It may be waiting for someone in this world, right now.",
      domain: "mystery",
      agentName: "Action Agent",
      rippleHint: "Links to secret-knowledge or hidden-threat mechanics.",
    },
  ],
  supernatural: [
    {
      title: "The God Who Answers Too Quickly",
      description:
        "Prayers addressed to this deity are answered before the supplicant finishes speaking. Devotees find this disturbing. The priests find it wonderful. Neither group is asking the obvious question.",
      whyItMatters:
        "A divine entity that knows what you will ask before you ask it is either omniscient or listening constantly. The distinction matters enormously.",
      domain: "mythology",
      agentName: "Mythology Agent",
      rippleHint: "Could unlock divine-surveillance or prophetic-dependency threads.",
    },
    {
      title: "The Shrine That Grows After Tragedies",
      description:
        "Every time something terrible happens within forty kilometres, the shrine gains a new stone. Nobody places them. Nobody has ever seen one appear. But they are always there by morning.",
      whyItMatters:
        "Sacred architecture that responds to events is sacred architecture with preferences. What it decides to mark, and what it ignores, is a theology.",
      domain: "mythology",
      agentName: "Ritual Agent",
      rippleHint: "Links to grief-accumulation or sacred-record mechanics.",
    },
    {
      title: "The Ancestor Who Keeps Giving Advice",
      description:
        "One specific deceased great-grandparent continues to offer counsel through dreams. The advice is practical, accurate, and occasionally mentions things that have not happened yet.",
      whyItMatters:
        "Dead people who remain functional advisors have not left. They have changed their medium. The question is what they want in return for this extended service.",
      domain: "bloodlines",
      agentName: "Mythology Agent",
      rippleHint: "May unlock ancestor-debt or death-contract mechanics.",
    },
  ],
  dark: [
    {
      title: "The Town That Stopped Making Decisions",
      description:
        "Twelve years ago the council voted on something. The result was not announced. All council members retired immediately. Since then, the town has operated on informal consensus, which everyone pretends is the same thing.",
      whyItMatters:
        "When formal authority is abandoned after a specific event, the event is the real governance. Everything since is managing its aftermath.",
      domain: "mystery",
      agentName: "Psychological Horror Agent",
      rippleHint: "Links to hidden-catastrophe or collective-guilt mechanics.",
    },
    {
      title: "The Illness Nobody Has Named",
      description:
        "There is a condition that moves through the region, not visibly, not contagiously, but seasonally. Those who have had it describe it identically: three weeks of complete certainty about something that turns out not to be true.",
      whyItMatters:
        "An ailment that produces false conviction rather than physical symptoms is an ailment of reality itself. Either the world produces bad information periodically, or something inside people does.",
      domain: "fear",
      agentName: "Psychological Horror Agent",
      rippleHint: "Could trigger mass-delusion or reality-distortion canon threads.",
    },
    {
      title: "The House That Records What Happened In It",
      description:
        "The walls of one particular structure have started producing faint sounds at night that correspond to conversations that occurred there, some decades ago. The current owners have begun to feel observed.",
      whyItMatters:
        "Architecture with memory is architecture with intent. What this house has chosen to replay, and why now, is not a question with a comfortable answer.",
      domain: "mystery",
      agentName: "Mythology Agent",
      rippleHint: "Links to haunted-record or spatial-memory mechanics.",
    },
  ],
  neutral: [
    {
      title: "The Undocumented Agreement",
      description:
        "Two families have honoured an arrangement for four generations that was never written down and cannot now be articulated by any living member. But both sides keep doing whatever it requires.",
      whyItMatters:
        "Agreements that survive without documentation survive through instinct, which suggests the original deal was biological rather than social.",
      domain: "bloodlines",
      agentName: "Continuity Agent",
      rippleHint: "May unlock generational-compact or inherited-obligation threads.",
    },
    {
      title: "The Festival Nobody Founded",
      description:
        "The celebration has happened every year for at least a century. There are no founding records, no patron, and no explanation for its specific date. But attendance is consistent and universal.",
      whyItMatters:
        "A tradition without an origin is a tradition that predates the culture's willingness to remember its origins. Something was at work before the recording began.",
      domain: "rituals",
      agentName: "Worldbuilding Agent",
      rippleHint: "Links to collective-amnesia or pre-history world mechanics.",
    },
  ],
};

// ── Fallback adaptation logic ─────────────────────────────────────────────────

function fallbackAgents(genre: DirectionGenre): ExploreAgent[] {
  return (GENRE_AGENTS[genre] ?? GENRE_AGENTS.neutral).slice(0, 4);
}

function makeBranch(seed: BranchSeed, direction: string): AdaptAddBranch {
  const prefix = direction.trim()
    ? `[Steered: ${direction.slice(0, 60)}${direction.length > 60 ? "…" : ""}] `
    : "";
  return {
    title: seed.title,
    description: prefix ? prefix + seed.description : seed.description,
    whyItMatters: seed.whyItMatters,
    domain: seed.domain,
    sourceAgent: seed.agentName,
    rippleHint: seed.rippleHint,
    crossDomainEffects: [],
    continuityRisk: "low",
    qualityScore: 78,
  };
}

export function generateAdaptationFallback(
  input: AgentAdaptInput,
): AgentAdaptOutput {
  const genre = detectGenre(input.creatorDirection);
  const agents = fallbackAgents(genre);
  const seedPool = [
    ...(GENRE_BRANCHES[genre] ?? []),
    ...(GENRE_BRANCHES.neutral ?? []),
  ];

  const establishedSet = new Set(input.establishedTruths.map((t) => t.toLowerCase()));
  const existingTitles = new Set([
    ...input.existingFutureNodes.map((n) => n.title.toLowerCase()),
    ...input.rejectedIdeas.map((r) => r.toLowerCase()),
  ]);

  // Score existing nodes for alignment
  const weaken: AdaptWeaken[] = [];
  const replace: AdaptReplace[] = [];

  for (const node of input.existingFutureNodes) {
    if (establishedSet.has(node.title.toLowerCase())) continue; // canon protected
    const score = nodeAlignmentScore(node, genre);
    if (score < 35) {
      if (node.generated) {
        // AI nodes can be replaced; find a fitting replacement
        const replacementSeed = seedPool.find(
          (s) => !existingTitles.has(s.title.toLowerCase()),
        );
        if (replacementSeed) {
          existingTitles.add(replacementSeed.title.toLowerCase());
          replace.push({
            targetId: node.id,
            replacement: makeBranch(replacementSeed, input.creatorDirection),
            reason: `"${node.title}" conflicts with the new direction. Replaced with a more aligned branch.`,
          });
        } else {
          weaken.push({
            targetId: node.id,
            reason: `"${node.title}" is misaligned with the new direction but no direct replacement available.`,
          });
        }
      } else {
        // Hardcoded nodes: only weaken
        weaken.push({
          targetId: node.id,
          reason: `"${node.title}" no longer fits the new direction and has been de-emphasised.`,
        });
      }
    }
  }

  // Build new branches from the seed pool
  const addSeeds = seedPool.filter(
    (s) => !existingTitles.has(s.title.toLowerCase()),
  ).slice(0, 3);

  const add: AdaptAddBranch[] = addSeeds.map((s) =>
    makeBranch(s, input.creatorDirection),
  );

  const insights: AgentInsight[] = agents.slice(0, 3).map((a, i) => ({
    agent: a.name,
    insight: add[i]
      ? `"${add[i].title}" fits the new direction while remaining consistent with existing canon.`
      : "Monitor for contradictions as the direction shifts.",
  }));

  const weakenCount = weaken.length;
  const addCount = add.length;
  const replaceCount = replace.length;

  const summaryParts: string[] = [];
  if (addCount > 0)
    summaryParts.push(`added ${addCount} new ${genre}-aligned branch${addCount > 1 ? "es" : ""}`);
  if (weakenCount > 0)
    summaryParts.push(`weakened ${weakenCount} branch${weakenCount > 1 ? "es" : ""} that no longer fit`);
  if (replaceCount > 0)
    summaryParts.push(`replaced ${replaceCount} branch${replaceCount > 1 ? "es" : ""} with more aligned alternatives`);

  const worldShiftSummary =
    summaryParts.length > 0
      ? `Direction "${input.creatorDirection}" ${summaryParts.join(", ")}.`
      : `Direction noted. The world watches for how "${input.creatorDirection}" changes what comes next.`;

  const continuityWarnings: string[] = [];
  if (input.establishedTruths.length > 0 && genre === "comic") {
    continuityWarnings.push(
      "Comic direction may feel tonally inconsistent with your established dark-leaning truths.",
    );
  }

  return {
    selectedAgents: agents,
    agentInsights: insights,
    adaptations: {
      add,
      modify: [],
      replace,
      weaken,
      remove: [],
    },
    crossDomainUpdates: [],
    worldShiftSummary,
    continuityWarnings,
    usedFallback: true,
  };
}

// ── OpenRouter call ───────────────────────────────────────────────────────────

const ADAPT_MODEL = "openai/gpt-4o-mini";

function isValidAdaptOutput(v: unknown): v is AgentAdaptOutput {
  if (!v || typeof v !== "object") return false;
  const out = v as AgentAdaptOutput;
  return (
    Array.isArray(out.selectedAgents) &&
    out.selectedAgents.length >= 2 &&
    out.adaptations !== undefined &&
    typeof out.adaptations === "object" &&
    Array.isArray(out.adaptations.add) &&
    Array.isArray(out.adaptations.modify) &&
    Array.isArray(out.adaptations.replace) &&
    Array.isArray(out.adaptations.weaken) &&
    Array.isArray(out.adaptations.remove) &&
    typeof out.worldShiftSummary === "string"
  );
}

async function adaptWithOpenRouter(
  input: AgentAdaptInput,
  apiKey: string,
): Promise<AgentAdaptOutput> {
  const systemPrompt = `You are a structured worldbuilding adaptation engine inside a creator canvas.

The creator has given a direction. Your job is to REORGANISE the world around this direction — not simply add more ideas.

You must:
1. Analyse existing future nodes against the creator direction.
2. Select 3–5 specialists appropriate for this direction.
3. Decide for each existing node: keep / modify / replace / weaken / remove.
4. Generate 2–4 new branches that strongly fit the creator direction.
5. Return a worldShiftSummary that conveys what changed and why.

Rules:
- NEVER remove or replace established canon truths (establishedTruths list).
- Weakening = the node stays but appears less prominent. Use for hardcoded nodes that no longer fit.
- Replacing = remove the old AI node, insert a better one. Only use for generated: true nodes.
- New branches must be specific and atmospheric. No generic titles.
- Respect the world seed throughout — new branches must feel native.
- If creator direction conflicts with canon truths, issue a continuityWarning and do NOT alter canon.

Return ONLY valid JSON matching this exact shape:
{
  "selectedAgents": [{"name":"string","role":"string","whySelected":"string"}],
  "agentInsights": [{"agent":"string","insight":"string"}],
  "adaptations": {
    "add": [{"title":"string","description":"string","whyItMatters":"string","domain":"string","sourceAgent":"string","rippleHint":"string","crossDomainEffects":[],"continuityRisk":"low","qualityScore":80}],
    "modify": [{"targetId":"string","newTitle":"string","newDescription":"string","newWhyItMatters":"string","reason":"string"}],
    "replace": [{"targetId":"string","replacement":{...same shape as add item...},"reason":"string"}],
    "weaken": [{"targetId":"string","reason":"string"}],
    "remove": [{"targetId":"string","reason":"string"}]
  },
  "crossDomainUpdates": [{"domain":"string","change":"string","newBranchTitle":"string"}],
  "worldShiftSummary": "string",
  "continuityWarnings": ["string"]
}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://constellation-canvas-lab.local",
      "X-Title": "Constellation Canvas Lab",
    },
    body: JSON.stringify({
      model: ADAPT_MODEL,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(input, null, 2) },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response");

  const parsed = JSON.parse(content) as unknown;
  if (!isValidAdaptOutput(parsed)) throw new Error("Invalid shape");
  return { ...parsed, usedFallback: false };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function adaptAgents(
  input: AgentAdaptInput,
): Promise<AgentAdaptOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return generateAdaptationFallback(input);

  try {
    return await adaptWithOpenRouter(input, apiKey);
  } catch {
    return generateAdaptationFallback(input);
  }
}

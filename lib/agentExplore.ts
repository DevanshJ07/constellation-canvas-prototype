/**
 * Agent Explore — AI branch generation.
 * Generates 3–5 world branches through a structured specialist lens.
 */

export type AgentExploreInput = {
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
  rejectedIdeas: string[];
  existingBranches: string[];
};

export type ExploreAgent = {
  name: string;
  role: string;
  whySelected: string;
};

export type AgentInsight = {
  agent: string;
  insight: string;
};

export type GeneratedBranch = {
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

export type AgentExploreOutput = {
  selectedAgents: ExploreAgent[];
  agentInsights: AgentInsight[];
  branches: GeneratedBranch[];
  continuityWarnings: string[];
  whyTheseBranches: string;
};

export type AiGeneratedBranch = GeneratedBranch & {
  id: string;
  parentId: string;
  generated: true;
};

export const EXPLORE_MODEL = "openai/gpt-4o-mini";

// ── Validation ────────────────────────────────────────────────────────────────

function isValidBranch(b: unknown): b is GeneratedBranch {
  if (!b || typeof b !== "object") return false;
  const br = b as GeneratedBranch;
  return (
    typeof br.title === "string" && br.title.trim().length > 0 &&
    typeof br.description === "string" && br.description.trim().length > 0 &&
    typeof br.whyItMatters === "string" &&
    typeof br.domain === "string" &&
    typeof br.sourceAgent === "string" &&
    typeof br.rippleHint === "string" &&
    Array.isArray(br.crossDomainEffects) &&
    (br.continuityRisk === "low" || br.continuityRisk === "medium" || br.continuityRisk === "high") &&
    typeof br.qualityScore === "number"
  );
}

function isValidExploreOutput(v: unknown): v is AgentExploreOutput {
  if (!v || typeof v !== "object") return false;
  const out = v as AgentExploreOutput;
  return (
    Array.isArray(out.selectedAgents) && out.selectedAgents.length >= 2 &&
    Array.isArray(out.agentInsights) &&
    Array.isArray(out.branches) && out.branches.length >= 1 &&
    out.branches.every(isValidBranch) &&
    Array.isArray(out.continuityWarnings) &&
    typeof out.whyTheseBranches === "string"
  );
}

// ── Fallback ─────────────────────────────────────────────────────────────────

type FallbackBranch = {
  title: string;
  description: string;
  whyItMatters: string;
  domain: string;
  agentName: string;
  rippleHint: string;
};

const DOMAIN_BRANCH_SEEDS: Record<string, FallbackBranch[]> = {
  mythology: [
    {
      title: "The Priest Who Remembers Being Someone Else",
      description:
        "An elderly temple priest insists he has served this shrine for three lifetimes. Nobody believes him, but the ritual calendar he keeps is five hundred years old and spotlessly accurate.",
      whyItMatters:
        "If continuity of identity outlasts death, then who owns the sins of a previous life — the soul or the family that bears its name?",
      domain: "mythology",
      agentName: "Mythology Agent",
      rippleHint: "May unlock spiritual inheritance or soul-debt mechanics.",
    },
    {
      title: "A Shrine That Only Appears During Specific Rain",
      description:
        "Villagers know it exists, but only monsoon rain of a certain intensity reveals its entrance. Explorers have waited years to see it. Two have never returned.",
      whyItMatters:
        "Sacred places that control their own visibility are exercising will. What does the shrine want from visitors?",
      domain: "mythology",
      agentName: "Symbolism Agent",
      rippleHint: "Connects to weather, sacrifice, and hidden-knowledge rituals.",
    },
    {
      title: "The Name That Cannot Be Spoken Aloud",
      description:
        "There is a deity in this region whose name was formally revoked. Written documents preserve it, but speaking it aloud causes nosebleeds in those with the old bloodlines.",
      whyItMatters:
        "A god whose name is censored is usually being protected — but from what, or for whose benefit, has been forgotten.",
      domain: "mythology",
      agentName: "Continuity Agent",
      rippleHint: "May link to bloodline suppression or forgotten political purge.",
    },
  ],
  rituals: [
    {
      title: "A Ceremony That Requires Forgetting Something Specific",
      description:
        "To complete the annual ritual, each participant must publicly surrender one memory. Practitioners grow visibly younger for a month afterward. The memories do not return.",
      whyItMatters:
        "Voluntary forgetting as worship implies the gods prefer devotees who are unburdened. What they are unburdened of may not be the participants' choice.",
      domain: "rituals",
      agentName: "Ritual Agent",
      rippleHint: "Could feed memory-economy or sacred-loss mechanics.",
    },
    {
      title: "The Annual Walk That Nobody Organises",
      description:
        "Every year, on the same night, people from four villages walk to the same hilltop, perform the same gesture, and leave before sunrise. Nobody sends invitations. Nobody is in charge.",
      whyItMatters:
        "Rituals that perpetuate themselves without authority suggest the world itself is performing them, with humans as instruments.",
      domain: "rituals",
      agentName: "Mythology Agent",
      rippleHint: "May unlock latent compulsion or world-memory mechanics.",
    },
  ],
  fear: [
    {
      title: "The Part of the Forest That Animals Avoid",
      description:
        "Every creature with working instincts circles around a half-kilometre patch of unremarkable woodland. The trees there are healthy. No bones lie on the ground. Nothing moves.",
      whyItMatters:
        "Animal avoidance of empty space is not superstition. It is data about something frequency-adjacent to life that has chosen to be quiet.",
      domain: "fear",
      agentName: "Psychological Horror Agent",
      rippleHint: "Can connect to predatory silence, spiritual absence, or contamination.",
    },
    {
      title: "The Silence Between the Sounds at Night",
      description:
        "Villagers who spend the night outdoors report normal nighttime sounds: frogs, insects, wind. But between each sound there is a pause that is slightly too long. Listeners begin counting.",
      whyItMatters:
        "Dread that is architectural — built from rhythm rather than content — is the kind the mind cannot argue itself out of.",
      domain: "fear",
      agentName: "Psychological Horror Agent",
      rippleHint: "Links to temporal anomaly, perception distortion, or pattern intrusion.",
    },
  ],
  mystery: [
    {
      title: "The Locked Room in the House Everyone Has Inherited",
      description:
        "Every family in the region has a room in their home they have never opened. The locks are the same design. The keys were buried with someone in 1947 who left no name on the grave.",
      whyItMatters:
        "Collective sealed secrets imply collective guilt or collective protection. The question is which generation was trying to protect which.",
      domain: "mystery",
      agentName: "Mystery Agent",
      rippleHint: "Could unlock shared-trauma or intergenerational-suppression threads.",
    },
    {
      title: "The Second Well That Records What Was Said Near It",
      description:
        "An old stone well at the edge of the village occasionally replays conversations from decades ago. The villagers have learned to avoid saying anything private near it. Most of the time.",
      whyItMatters:
        "Infrastructure with memory is infrastructure with an agenda. What the well has chosen to preserve — and what it has edited out — is a map of what the world considers important.",
      domain: "mystery",
      agentName: "Continuity Agent",
      rippleHint: "Links to acoustic-memory, hidden-archive, or world-record mechanics.",
    },
  ],
  bloodlines: [
    {
      title: "The Inheritance That Skips Every Other Generation",
      description:
        "A particular talent — navigating without landmarks, hearing conversations through walls — appears in alternating generations. Those who have it know they must hide it. Those who don't are suspicious of why.",
      whyItMatters:
        "Skipping-generation traits suggest a deal was made with something that counts in twos. The deal is ongoing, and both sides are still holding it.",
      domain: "bloodlines",
      agentName: "Bloodlines Agent",
      rippleHint: "Could trigger lineage-debt, hidden-compact, or generational-suppression.",
    },
  ],
};

function makeFallbackBranch(seed: FallbackBranch): GeneratedBranch {
  return {
    title: seed.title,
    description: seed.description,
    whyItMatters: seed.whyItMatters,
    domain: seed.domain,
    sourceAgent: seed.agentName,
    rippleHint: seed.rippleHint,
    crossDomainEffects: [],
    continuityRisk: "low" as const,
    qualityScore: 75,
  };
}

function steerBranch(branch: GeneratedBranch, direction: string): GeneratedBranch {
  if (!direction.trim()) return branch;
  const d = direction.toLowerCase();
  let descPrefix = "";

  if (/psychological|internal|mind|psyche/.test(d)) {
    descPrefix = `[Steered: more psychological] `;
  } else if (/supernatural|magical|divine/.test(d)) {
    descPrefix = `[Steered: supernatural framing] `;
  } else if (/comedy|funny|absurd/.test(d)) {
    descPrefix = `[Steered: comedic tone] `;
  } else if (/darker|darker|grim|brutal/.test(d)) {
    descPrefix = `[Steered: darker framing] `;
  } else {
    descPrefix = `[Creator direction: ${direction}] `;
  }

  return {
    ...branch,
    description: descPrefix + branch.description,
  };
}

export function selectAgentsFallback(
  input: AgentExploreInput,
): ExploreAgent[] {
  const blob = [
    input.worldSeed,
    input.activeDomain,
    input.creatorDirection,
    input.currentNode.title,
    ...input.worldTensions,
  ]
    .join(" ")
    .toLowerCase();

  const agents: ExploreAgent[] = [];
  const add = (name: string, role: string, why: string) => {
    if (!agents.some((a) => a.name === name)) {
      agents.push({ name, role, whySelected: why });
    }
  };

  if (/psychological|horror|fear|dread/.test(blob) || input.activeDomain === "fear") {
    add("Psychological Horror Agent", "Human dread and internal fear mechanics", "Fear or psychological framing in active context.");
  }
  if (/myth|folklore|temple|shrine|god|sacred/.test(blob) || input.activeDomain === "mythology") {
    add("Mythology Agent", "Sacred logic and folklore consequences", "Mythic domain or sacred language detected.");
  }
  if (/ritual|ceremony|rite|prayer|practice/.test(blob) || input.activeDomain === "rituals") {
    add("Ritual Agent", "Ceremonial logic, taboo, and repeated acts", "Ritual domain or ceremonial framing.");
  }
  if (/bloodline|lineage|inherit|heir|ancestr/.test(blob) || input.activeDomain === "bloodlines") {
    add("Bloodlines Agent", "Generational debt and inherited truth", "Lineage themes active.");
  }
  if (/mystery|secret|hidden|unknown|sealed/.test(blob) || input.activeDomain === "mystery") {
    add("Mystery Agent", "Protected unknowns and slow revelation", "Mystery framing detected.");
  }
  if (/symbol|motif|pattern|recurring/.test(blob)) {
    add("Symbolism Agent", "Motifs, imagery, and thematic coherence", "Symbolic language active.");
  }
  add("Continuity Agent", "Canon coherence and contradiction checks", "Always needed as canon grows.");

  if (agents.length < 3) {
    add("Worldbuilding Agent", "Ensuring nodes feel native to the world seed", "Default for mixed contexts.");
    add("Plot/Conflict Agent", "Stakes, opposition, and narrative propulsion", "Every node needs dramatic pressure.");
  }

  return agents.slice(0, 5);
}

export function generateBranchesFallback(
  input: AgentExploreInput,
): AgentExploreOutput {
  const domainKey =
    input.activeDomain.toLowerCase().replace(/\s+/g, "_").replace("rituals", "rituals").replace("bloodlines", "bloodlines") ||
    input.currentNode.domain.toLowerCase();

  const seedBag: FallbackBranch[] = [
    ...(DOMAIN_BRANCH_SEEDS[domainKey] ?? []),
    ...(DOMAIN_BRANCH_SEEDS["mythology"] ?? []),
    ...(DOMAIN_BRANCH_SEEDS["fear"] ?? []),
    ...(DOMAIN_BRANCH_SEEDS["mystery"] ?? []),
  ];

  const existingTitles = new Set(input.existingBranches.map((t) => t.toLowerCase()));
  const rejectedTitles = new Set(input.rejectedIdeas.map((t) => t.toLowerCase()));

  const candidates = seedBag.filter(
    (s) =>
      !existingTitles.has(s.title.toLowerCase()) &&
      !rejectedTitles.has(s.title.toLowerCase()),
  );

  const selected = candidates.slice(0, 4).map((s) =>
    steerBranch(makeFallbackBranch(s), input.creatorDirection),
  );

  const agents = selectAgentsFallback(input);

  const insights: AgentInsight[] = agents.slice(0, 3).map((a, i) => ({
    agent: a.name,
    insight: selected[i]
      ? `This node calls for something with specific weight. "${selected[i].title}" may be the pressure point.`
      : "Watch for contradiction with established canon threads.",
  }));

  return {
    selectedAgents: agents,
    agentInsights: insights,
    branches: selected,
    continuityWarnings:
      input.worldTensions.length > 3
        ? ["World tensions are high — new branches may intensify existing pressure."]
        : [],
    whyTheseBranches: input.creatorDirection.trim()
      ? `Branches shaped by creator direction: "${input.creatorDirection}".`
      : `Branches drawn from ${input.activeDomain || "current"} domain logic.`,
  };
}

// ── OpenRouter call ───────────────────────────────────────────────────────────

export async function exploreWithOpenRouter(
  input: AgentExploreInput,
  apiKey: string,
): Promise<AgentExploreOutput> {
  const systemPrompt = `You are a structured worldbuilding intelligence layer inside a creator canvas.

Your job is NOT to chat. Your job is to:
1. Select 3–5 creative specialists relevant to the current node and world context.
2. Generate 6–10 candidate branches through their lenses.
3. Critique each candidate on: specificity, canon fit, originality, consequence depth, story usefulness, creator direction alignment.
4. Return only the 3–5 strongest branches.

Rules:
- Branches must be specific and atmospheric. Avoid generic titles like "Ancient Curse" or "Hidden Secret".
- Every branch must have ripple/consequence potential.
- Respect creator direction strongly if provided.
- Avoid repeating existingBranches titles.
- Respect rejectedIdeas — do not echo them.
- Branches must feel like they belong inside the exact world seed provided.

Return JSON ONLY. Shape:
{
  "selectedAgents": [{"name": "string", "role": "string", "whySelected": "string"}],
  "agentInsights": [{"agent": "string", "insight": "string"}],
  "branches": [
    {
      "title": "string",
      "description": "string",
      "whyItMatters": "string",
      "domain": "string",
      "sourceAgent": "string",
      "rippleHint": "string",
      "crossDomainEffects": [{"domain": "string", "effect": "string"}],
      "continuityRisk": "low | medium | high",
      "qualityScore": number (0–100)
    }
  ],
  "continuityWarnings": ["string"],
  "whyTheseBranches": "string"
}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://constellation-canvas-lab.local",
      "X-Title": "Constellation Canvas Lab",
    },
    body: JSON.stringify({
      model: EXPLORE_MODEL,
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(input, null, 2) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response");

  const parsed = JSON.parse(content) as unknown;
  if (!isValidExploreOutput(parsed)) throw new Error("Invalid shape");

  return {
    ...parsed,
    branches: parsed.branches.filter(isValidBranch).slice(0, 5),
    selectedAgents: parsed.selectedAgents.slice(0, 5),
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function exploreAgents(
  input: AgentExploreInput,
): Promise<AgentExploreOutput & { usedFallback: boolean }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return { ...generateBranchesFallback(input), usedFallback: true };
  }

  try {
    const result = await exploreWithOpenRouter(input, apiKey);
    return { ...result, usedFallback: false };
  } catch {
    return { ...generateBranchesFallback(input), usedFallback: true };
  }
}

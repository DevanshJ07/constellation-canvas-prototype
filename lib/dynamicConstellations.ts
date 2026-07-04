/**
 * Dynamic Constellations — LLM-generated creative specialist constellations.
 * The LLM decides which agents are needed based on the world seed.
 */

export type ConstellationColorTheme =
  | "yellow"
  | "violet"
  | "green"
  | "red"
  | "blue"
  | "cyan"
  | "pink"
  | "orange";

export type DynamicConstellation = {
  id: string;
  title: string;
  agentName: string;
  description: string;
  purpose: string;
  whyThisAgentMatters: string;
  focusQuestions: string[];
  colorTheme: ConstellationColorTheme;
  symbol: string;
};

export type WorldInterpretation = {
  genre: string;
  tone: string;
  medium: string;
  coreCreativeChallenge: string;
};

export type ConstellationCreateOutput = {
  worldInterpretation: WorldInterpretation;
  constellations: DynamicConstellation[];
  usedFallback: boolean;
  fallbackReason?: string;
};

// ── Color theme → CSS tokens ──────────────────────────────────────────────────

export const THEME_COLORS: Record<
  ConstellationColorTheme,
  { border: string; glow: string; text: string; bg: string; dot: string }
> = {
  yellow: {
    border: "rgba(251,191,36,0.45)",
    glow: "rgba(251,191,36,0.2)",
    text: "#FCD34D",
    bg: "rgba(251,191,36,0.06)",
    dot: "#FCD34D",
  },
  violet: {
    border: "rgba(167,139,250,0.45)",
    glow: "rgba(167,139,250,0.2)",
    text: "#C4B5FD",
    bg: "rgba(167,139,250,0.06)",
    dot: "#C4B5FD",
  },
  green: {
    border: "rgba(52,211,153,0.45)",
    glow: "rgba(52,211,153,0.2)",
    text: "#6EE7B7",
    bg: "rgba(52,211,153,0.06)",
    dot: "#6EE7B7",
  },
  red: {
    border: "rgba(248,113,113,0.45)",
    glow: "rgba(248,113,113,0.2)",
    text: "#FCA5A5",
    bg: "rgba(248,113,113,0.06)",
    dot: "#FCA5A5",
  },
  blue: {
    border: "rgba(96,165,250,0.45)",
    glow: "rgba(96,165,250,0.2)",
    text: "#93C5FD",
    bg: "rgba(96,165,250,0.06)",
    dot: "#93C5FD",
  },
  cyan: {
    border: "rgba(34,211,238,0.45)",
    glow: "rgba(34,211,238,0.2)",
    text: "#67E8F9",
    bg: "rgba(34,211,238,0.06)",
    dot: "#67E8F9",
  },
  pink: {
    border: "rgba(236,72,153,0.45)",
    glow: "rgba(236,72,153,0.2)",
    text: "#F9A8D4",
    bg: "rgba(236,72,153,0.06)",
    dot: "#F9A8D4",
  },
  orange: {
    border: "rgba(251,146,60,0.45)",
    glow: "rgba(251,146,60,0.2)",
    text: "#FED7AA",
    bg: "rgba(251,146,60,0.06)",
    dot: "#FED7AA",
  },
};

// ── Generic name detection + quality repair ───────────────────────────────────

const GENERIC_TITLES = new Set([
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
]);

function isGenericTitle(title: string): boolean {
  const lower = title.toLowerCase().trim();
  // Single or double-word generic titles
  const words = lower.replace(/\s+agent\s*$/i, "").trim().split(/\s+/);
  if (words.length <= 2 && words.every((w) => GENERIC_TITLES.has(w))) return true;
  return false;
}

/** Make a generic agent name world-specific using the seed vocabulary. */
function repairGenericTitle(title: string, agentName: string, seed: string): { title: string; agentName: string } {
  const seedWords = seed
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["with", "that", "this", "from", "into", "about", "they", "their", "some"].includes(w));
  const keyWord = seedWords[Math.floor(Math.random() * Math.min(3, seedWords.length))] ?? "world";
  const keyWordCapitalized = keyWord.charAt(0).toUpperCase() + keyWord.slice(1);

  // Map generic base to a more concrete variant
  const base = title.toLowerCase().replace(/\s+agent\s*$/i, "").trim();
  const repairMap: Record<string, string> = {
    structure: `${keyWordCapitalized} Escalation`,
    character: `${keyWordCapitalized} Dynamics`,
    conflict: `${keyWordCapitalized} Friction`,
    tone: `${keyWordCapitalized} Register`,
    continuity: `${keyWordCapitalized} Logic`,
    plot: `${keyWordCapitalized} Arc`,
    theme: `${keyWordCapitalized} Undercurrent`,
    worldbuilding: `${keyWordCapitalized} Rules`,
    narrative: `${keyWordCapitalized} Thread`,
    pacing: `${keyWordCapitalized} Rhythm`,
    tension: `${keyWordCapitalized} Pressure`,
    climax: `${keyWordCapitalized} Peak`,
    resolution: `${keyWordCapitalized} Payoff`,
  };

  const repairedBase = repairMap[base] ?? `${keyWordCapitalized} ${title}`;
  return {
    title: repairedBase,
    agentName: `${repairedBase} Agent`,
  };
}

// ── Fallback (no API key or API failure) ──────────────────────────────────────

export function fallbackConstellations(reason?: string): ConstellationCreateOutput {
  return {
    worldInterpretation: {
      genre: "Unknown",
      tone: "Exploratory",
      medium: "Narrative",
      coreCreativeChallenge:
        "Discovering what this world needs to become coherent and compelling.",
    },
    constellations: [
      {
        id: "structure-agent",
        title: "Structure",
        agentName: "Structure Agent",
        description:
          "Organises narrative events into coherent arcs with clear causality and consequence.",
        purpose:
          "Ensuring the world has a spine — events that build on each other logically.",
        whyThisAgentMatters:
          "Without structure, even the richest world becomes a list of unconnected ideas.",
        focusQuestions: [
          "What has already happened that cannot be undone?",
          "What is the world moving toward?",
          "What is the point of no return?",
        ],
        colorTheme: "violet",
        symbol: "◈",
      },
      {
        id: "character-agent",
        title: "Character",
        agentName: "Character Depth Agent",
        description:
          "Develops the inner lives, contradictions, and relationships of the people in this world.",
        purpose:
          "Making sure the people in this world feel specific, not representative.",
        whyThisAgentMatters:
          "Character is how the audience experiences the world. Without real people, there is no real world.",
        focusQuestions: [
          "Who wants something they cannot have?",
          "Who is hiding something they cannot afford to reveal?",
          "Whose worldview is about to be broken?",
        ],
        colorTheme: "green",
        symbol: "⊕",
      },
      {
        id: "conflict-agent",
        title: "Conflict",
        agentName: "Conflict Agent",
        description:
          "Identifies the oppositions, pressures, and collisions that drive the world forward.",
        purpose:
          "Every world has forces in tension. This agent names and sharpens those tensions.",
        whyThisAgentMatters:
          "Conflict is not destruction — it is the engine that generates meaning from events.",
        focusQuestions: [
          "What cannot coexist with what?",
          "Who or what is the primary resistance?",
          "Where does the world want to go that something else prevents?",
        ],
        colorTheme: "red",
        symbol: "⊗",
      },
      {
        id: "tone-agent",
        title: "Tone",
        agentName: "Tone & Register Agent",
        description:
          "Maintains the emotional and tonal register of the world across all its nodes.",
        purpose:
          "Ensuring each exploration feels native to the world's voice, not imported from another genre.",
        whyThisAgentMatters:
          "Tone is the invisible architecture of a world. Violating it breaks immersion immediately.",
        focusQuestions: [
          "What is the emotional frequency of this world?",
          "What kind of humour or sorrow is appropriate here?",
          "What would feel wrong even if it were narratively valid?",
        ],
        colorTheme: "yellow",
        symbol: "✦",
      },
      {
        id: "continuity-agent",
        title: "Continuity",
        agentName: "Continuity Agent",
        description:
          "Tracks established truths and ensures new branches do not contradict them.",
        purpose:
          "Protecting the world's internal logic as it grows more complex.",
        whyThisAgentMatters:
          "Worlds that contradict themselves lose the trust required to believe in them.",
        focusQuestions: [
          "What has already been established that cannot now be changed?",
          "What would break the world's logic if introduced?",
          "Where are the load-bearing truths?",
        ],
        colorTheme: "cyan",
        symbol: "◐",
      },
    ],
    usedFallback: true,
    fallbackReason: reason ?? "No OPENROUTER_API_KEY configured",
  };
}

// ── OpenRouter call ───────────────────────────────────────────────────────────

const CONSTELLATION_MODEL = "openai/gpt-4o-mini";

const VALID_COLORS: ConstellationColorTheme[] = [
  "yellow", "violet", "green", "red", "blue", "cyan", "pink", "orange",
];

/** Leniently extract constellations from raw LLM JSON — handles key variations */
function extractConstellations(raw: unknown): unknown[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  // Accept "constellations" or "agents" as the array key
  const arr = obj["constellations"] ?? obj["agents"] ?? obj["constellation_agents"];
  if (!Array.isArray(arr)) return null;
  return arr;
}

function extractWorldInterpretation(raw: unknown): WorldInterpretation | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const wi = obj["worldInterpretation"] ?? obj["world_interpretation"] ?? obj["interpretation"];
  if (!wi || typeof wi !== "object") return null;
  const w = wi as Record<string, unknown>;
  return {
    genre: String(w["genre"] ?? ""),
    tone: String(w["tone"] ?? ""),
    medium: String(w["medium"] ?? ""),
    coreCreativeChallenge: String(w["coreCreativeChallenge"] ?? w["core_creative_challenge"] ?? ""),
  };
}

function normalizeConstellation(
  raw: unknown,
  index: number,
  seed: string,
  seen: Set<string>,
): DynamicConstellation | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  let title = String(c["title"] ?? "").trim();
  let agentName = String(c["agentName"] ?? c["agent_name"] ?? c["name"] ?? "").trim();
  const description = String(c["description"] ?? "").trim();
  const purpose = String(c["purpose"] ?? "").trim();

  if (!title && !agentName) return null;
  if (!title) title = agentName.replace(/\s+Agent\s*$/i, "").trim() || `Agent ${index + 1}`;
  if (!agentName) agentName = `${title} Agent`;

  // Quality check: repair generic names
  if (isGenericTitle(title)) {
    const repaired = repairGenericTitle(title, agentName, seed);
    title = repaired.title;
    agentName = repaired.agentName;
  }

  // Generate unique kebab-case ID
  let id = String(c["id"] ?? "").trim();
  if (!id) id = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (!id) id = `agent-${index}`;
  while (seen.has(id)) id = `${id}-${index}`;
  seen.add(id);

  // Focus questions
  const rawFq = c["focusQuestions"] ?? c["focus_questions"] ?? c["questions"];
  const focusQuestions: string[] = Array.isArray(rawFq)
    ? rawFq.slice(0, 3).map(String)
    : [];

  // Color theme
  const rawColor = String(c["colorTheme"] ?? c["color_theme"] ?? c["color"] ?? "").toLowerCase();
  const colorTheme: ConstellationColorTheme =
    VALID_COLORS.includes(rawColor as ConstellationColorTheme)
      ? (rawColor as ConstellationColorTheme)
      : VALID_COLORS[index % VALID_COLORS.length] ?? "violet";

  const symbol = String(c["symbol"] ?? "✦").trim().slice(0, 2) || "✦";

  return {
    id,
    title,
    agentName,
    description: description || `A specialist agent focused on the ${title.toLowerCase()} dimension of this world.`,
    purpose: purpose || `Exploring ${title.toLowerCase()} as a creative lens.`,
    whyThisAgentMatters: String(c["whyThisAgentMatters"] ?? c["why"] ?? "").trim() ||
      `This lens reveals dimensions of the world that other agents cannot access.`,
    focusQuestions,
    colorTheme,
    symbol,
  };
}

async function createWithOpenRouter(
  worldSeed: string,
  creatorDirection: string,
  apiKey: string,
): Promise<ConstellationCreateOutput> {
  const systemPrompt = `You are a WORLD-SPECIFIC creative agent designer inside a worldbuilding platform.

Your ONLY job: Design 4-6 creative specialist agents that are CUSTOM-BUILT for THIS EXACT world seed.

═══ CRITICAL RULE — READ CAREFULLY ═══
Every agent MUST be named after something SPECIFIC to the world seed.
You are NOT creating generic writing categories.
You are creating specialist collaborators for THIS specific world.

═══ FORBIDDEN NAMES (too generic) ═══
These are BANNED unless you add the world's specific vocabulary:
- Structure Agent
- Character Agent
- Conflict Agent
- Tone Agent
- Continuity Agent
- Plot Agent
- Theme Agent
- Worldbuilding Agent
- Narrative Agent

═══ GOOD EXAMPLES (world-specific) ═══

SEED: "comedy universe of friends lost in a jungle"
GOOD agents:
- Jungle Chaos Agent
- Slapstick Survival Agent
- Group Dynamics Agent
- Animal Mischief Agent
- Comic Climax Agent

SEED: "romantic sci-fi about two people sharing dreams"
GOOD agents:
- Dream Chemistry Agent
- Memory Intimacy Agent
- Emotional Barrier Agent
- Future Society Agent
- Shared Dream Logic Agent

SEED: "psychological horror rooted in forgotten Indian folklore"
GOOD agents:
- Forgotten Folklore Agent
- Memory Horror Agent
- Ritual Logic Agent
- Village Secrets Agent
- Dread Escalation Agent

SEED: "political thriller about an AI that learned to grieve"
GOOD agents:
- Grief Mechanism Agent
- System Trust Agent
- Power Vacuum Agent
- Witness Character Agent
- Revelation Timing Agent

═══ RULES ═══
1. Agent titles MUST include specific words from the seed, genre, or world flavor.
2. agentName must end in "Agent" and be descriptive.
3. focusQuestions must reference specific elements of THIS seed (creatures, places, emotions, stakes).
4. symbol: single unicode character.
5. colorTheme: one of yellow, violet, green, red, blue, cyan, pink, orange.
6. id: kebab-case version of title.
7. Return 4-6 agents total.
8. Each agent should open a DISTINCT exploration path — avoid overlap.

Return ONLY valid JSON in this EXACT format:
{
  "worldInterpretation": {
    "genre": "string",
    "tone": "string",
    "medium": "string",
    "coreCreativeChallenge": "string"
  },
  "constellations": [
    {
      "id": "kebab-case-id",
      "title": "World-Specific Title",
      "agentName": "World-Specific Title Agent",
      "description": "string",
      "purpose": "string",
      "whyThisAgentMatters": "string",
      "focusQuestions": ["seed-specific question 1", "seed-specific question 2", "seed-specific question 3"],
      "colorTheme": "violet",
      "symbol": "✦"
    }
  ]
}`;

  const userContent = [
    `World Seed: ${worldSeed}`,
    creatorDirection ? `Creator Direction: ${creatorDirection}` : "",
    "",
    "Design 4-6 world-specific creative agents for this exact world. Make every name feel like it was built for THIS world.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://constellation-canvas-lab.local",
      "X-Title": "Constellation Canvas Lab",
    },
    body: JSON.stringify({
      model: CONSTELLATION_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter HTTP ${res.status}: ${res.statusText}`);
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (payload.error) {
    throw new Error(`OpenRouter error: ${payload.error.message ?? "unknown"}`);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (e) {
    throw new Error(`JSON parse failed: ${String(e)}`);
  }

  const rawConstellations = extractConstellations(parsed);
  if (!rawConstellations || rawConstellations.length < 2) {
    throw new Error(
      `Invalid shape: expected "constellations" array with 2+ items, got ${rawConstellations?.length ?? "none"}`,
    );
  }

  const seen = new Set<string>();
  const constellations: DynamicConstellation[] = rawConstellations
    .slice(0, 6)
    .map((c, i) => normalizeConstellation(c, i, worldSeed, seen))
    .filter((c): c is DynamicConstellation => c !== null);

  if (constellations.length < 2) {
    throw new Error("Could not normalize enough constellations from response");
  }

  const worldInterpretation = extractWorldInterpretation(parsed) ?? {
    genre: "Unknown",
    tone: "Exploratory",
    medium: "Narrative",
    coreCreativeChallenge: "Discovering what this world needs.",
  };

  return {
    worldInterpretation,
    constellations,
    usedFallback: false,
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function createConstellations(
  worldSeed: string,
  creatorDirection = "",
): Promise<ConstellationCreateOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return fallbackConstellations("No OPENROUTER_API_KEY configured");
  }

  try {
    return await createWithOpenRouter(worldSeed, creatorDirection, apiKey);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ...fallbackConstellations(reason), fallbackReason: reason };
  }
}

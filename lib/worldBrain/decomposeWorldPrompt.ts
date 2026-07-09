/**
 * World Prompt Decomposition — isolated intelligence layer.
 * Breaks a world prompt into intent, understanding, layers, agents, directions, and constraints.
 */

export type OutputType =
  | "story"
  | "game"
  | "essay"
  | "comic"
  | "screenplay"
  | "novel"
  | "world bible"
  | "unknown";

export type WorldIntent = {
  outputType: OutputType;
  likelyMedium: string;
  targetExperience: string;
  scope: string;
};

export type WorldUnderstanding = {
  genre: string;
  tone: string[];
  premise: string;
  setting: string;
  coreCreativeEngine: string;
  creativePromise: string;
};

export type RequiredCreativeLayer = {
  name: string;
  purpose: string;
  whyNeeded: string;
  shouldExplore: string[];
};

export type RecommendedAgent = {
  name: string;
  role: string;
  lens: string;
  shouldGenerate: string;
};

export type StartingDirection = {
  title: string;
  description: string;
  whyPromising: string;
  risk: string;
};

export type WorldConstraints = {
  mustPreserve: string[];
  shouldAvoid: string[];
  openQuestions: string[];
};

export type WorldPromptDecomposition = {
  usedFallback: boolean;
  fallbackReason?: string;
  originalPrompt: string;
  intent: WorldIntent;
  worldUnderstanding: WorldUnderstanding;
  requiredCreativeLayers: RequiredCreativeLayer[];
  recommendedAgents: RecommendedAgent[];
  startingDirections: StartingDirection[];
  constraints: WorldConstraints;
};

const DECOMPOSE_MODEL = "gemini-2.5-flash";

const VALID_OUTPUT_TYPES = new Set<OutputType>([
  "story",
  "game",
  "essay",
  "comic",
  "screenplay",
  "novel",
  "world bible",
  "unknown",
]);

const GENERIC_NAMES = new Set([
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
  "with",
  "that",
  "this",
  "from",
  "into",
  "about",
  "they",
  "their",
  "some",
  "have",
  "been",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "would",
  "could",
  "should",
  "universe",
  "world",
  "story",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractSeedWords(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function pickSeedWord(prompt: string, index = 0): string {
  const words = extractSeedWords(prompt);
  const word = words[index % Math.max(words.length, 1)] ?? "world";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function isGenericName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  const stripped = lower.replace(/\s+agent\s*$/i, "").trim();
  const words = stripped.split(/\s+/);
  if (words.length <= 2 && words.every((w) => GENERIC_NAMES.has(w))) return true;
  return GENERIC_NAMES.has(stripped);
}

function repairGenericName(name: string, prompt: string): string {
  const base = name.toLowerCase().replace(/\s+agent\s*$/i, "").trim();
  const keyWord = pickSeedWord(prompt, 0);

  const repairMap: Record<string, string> = {
    structure: `${keyWord} Escalation`,
    character: `${keyWord} Dynamics`,
    conflict: `${keyWord} Friction`,
    tone: `${keyWord} Register`,
    continuity: `${keyWord} Logic`,
    plot: `${keyWord} Arc`,
    theme: `${keyWord} Undercurrent`,
    worldbuilding: `${keyWord} Rules`,
    narrative: `${keyWord} Thread`,
    pacing: `${keyWord} Rhythm`,
    tension: `${keyWord} Pressure`,
    climax: `${keyWord} Peak`,
    resolution: `${keyWord} Payoff`,
    setting: `${keyWord} Environment`,
    dialogue: `${keyWord} Voice`,
  };

  const repaired = repairMap[base] ?? `${keyWord} ${name.replace(/\s+Agent\s*$/i, "").trim()}`;
  return repaired.endsWith("Agent") ? repaired : `${repaired} Agent`;
}

function inferOutputType(prompt: string, purpose: string): OutputType {
  const text = `${prompt} ${purpose}`.toLowerCase();
  if (/\b(game|gameplay|player|quest)\b/.test(text)) return "game";
  if (/\b(comic|graphic novel|manga)\b/.test(text)) return "comic";
  if (/\b(screenplay|script|film|movie)\b/.test(text)) return "screenplay";
  if (/\b(novel|book|chapter)\b/.test(text)) return "novel";
  if (/\b(essay|nonfiction|article)\b/.test(text)) return "essay";
  if (/\b(world bible|worldbuilding|lore bible|canon)\b/.test(text)) return "world bible";
  if (/\b(story|narrative|tale)\b/.test(text)) return "story";
  return "unknown";
}

function inferGenre(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b(comedy|funny|slapstick|humou?r)\b/.test(lower)) return "Comedy";
  if (/\b(horror|dread|fear|nightmare)\b/.test(lower)) return "Horror";
  if (/\b(romance|love|relationship)\b/.test(lower)) return "Romance";
  if (/\b(sci-?fi|science fiction|space|future)\b/.test(lower)) return "Science Fiction";
  if (/\b(fantasy|magic|myth|folklore)\b/.test(lower)) return "Fantasy";
  if (/\b(thriller|suspense|mystery|detective)\b/.test(lower)) return "Thriller";
  if (/\b(drama|emotional|family)\b/.test(lower)) return "Drama";
  if (/\b(adventure|journey|quest|expedition)\b/.test(lower)) return "Adventure";
  return "Speculative Fiction";
}

function inferTones(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const tones: string[] = [];
  if (/\b(comedy|funny|slapstick|absurd)\b/.test(lower)) tones.push("Comedic");
  if (/\b(chaos|chaotic|mayhem)\b/.test(lower)) tones.push("Chaotic");
  if (/\b(dark|grim|bleak)\b/.test(lower)) tones.push("Dark");
  if (/\b(warm|heartfelt|tender)\b/.test(lower)) tones.push("Warm");
  if (/\b(suspense|tense|edge)\b/.test(lower)) tones.push("Suspenseful");
  if (/\b(whimsical|playful|light)\b/.test(lower)) tones.push("Playful");
  if (tones.length === 0) tones.push("Exploratory");
  return tones;
}

function str(v: unknown, fallback = ""): string {
  return v != null ? String(v).trim() : fallback;
}

function strArray(v: unknown, max = 6): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map((x) => String(x).trim()).filter(Boolean);
}

function normalizeOutputType(v: unknown): OutputType {
  const s = str(v, "unknown").toLowerCase();
  return VALID_OUTPUT_TYPES.has(s as OutputType) ? (s as OutputType) : "unknown";
}

function repairLayerName(name: string, prompt: string): string {
  if (!isGenericName(name)) return name;
  return repairGenericName(name, prompt).replace(/\s+Agent\s*$/i, "").trim();
}

function repairAgentName(name: string, prompt: string): string {
  if (!isGenericName(name)) {
    return name.endsWith("Agent") ? name : `${name} Agent`;
  }
  return repairGenericName(name, prompt);
}

// ── Prompt-based fallback ───────────────────────────────────────────────────────

function buildPromptBasedFallback(
  worldPrompt: string,
  purpose: string,
  reason?: string,
): WorldPromptDecomposition {
  const genre = inferGenre(worldPrompt);
  const tones = inferTones(worldPrompt);
  const outputType = inferOutputType(worldPrompt, purpose);
  const w1 = pickSeedWord(worldPrompt, 0);
  const w2 = pickSeedWord(worldPrompt, 1);
  const w3 = pickSeedWord(worldPrompt, 2);

  const truncatedPrompt =
    worldPrompt.length > 120 ? `${worldPrompt.slice(0, 117)}...` : worldPrompt;

  return {
    usedFallback: true,
    fallbackReason: reason ?? "Gemini unavailable",
    originalPrompt: worldPrompt,
    intent: {
      outputType,
      likelyMedium: purpose
        ? `Creative work shaped by: ${purpose}`
        : `${genre} narrative exploration`,
      targetExperience: purpose
        ? `Deliver on the creator's stated purpose while honoring the ${genre.toLowerCase()} premise`
        : `Immerse the creator in the specific world of: ${truncatedPrompt}`,
      scope: purpose || "Focused exploration of the core premise and its creative possibilities",
    },
    worldUnderstanding: {
      genre,
      tone: tones,
      premise: truncatedPrompt,
      setting: extractSeedWords(worldPrompt).slice(0, 3).join(", ") || "To be defined from the prompt",
      coreCreativeEngine: `The central creative tension in "${truncatedPrompt}"`,
      creativePromise: purpose
        ? `${purpose} — expressed through a ${genre.toLowerCase()} lens`
        : `A ${genre.toLowerCase()} world where ${tones[0]?.toLowerCase() ?? "specific"} energy drives every creative choice`,
    },
    requiredCreativeLayers: [
      {
        name: `${w1} Premise Layer`,
        purpose: `${w1} names the first pressure that makes this world unsafe to treat as background — a rule, fear, or secret the story cannot ignore.`,
        whyNeeded: "Without a premise anchor, branches drift into unrelated genres.",
        shouldExplore: [
          `What breaks first when ${w1} stops being abstract?`,
          "What is the single most surprising element of this premise?",
          "What would break the premise if introduced?",
        ],
      },
      {
        name: `${w2} Dynamics Layer`,
        purpose: `Explore the relationships, forces, and interactions native to this world`,
        whyNeeded: "Every world has internal motion — this layer names and tracks it.",
        shouldExplore: [
          "Who or what is in tension with whom?",
          "What alliances or frictions define this world?",
          "What changes when two elements collide?",
        ],
      },
      {
        name: `${w3} Register Layer`,
        purpose: `Maintain the ${tones.join("/")} tonal register across all creative output`,
        whyNeeded: "Tone violations break immersion faster than plot holes.",
        shouldExplore: [
          `What kind of ${tones[0]?.toLowerCase() ?? "emotional"} moment fits here?`,
          "What would feel completely wrong in this world?",
          "How does humor, dread, or wonder express itself here?",
        ],
      },
    ],
    recommendedAgents: [
      {
        name: `${w1} Premise Agent`,
        role: "Premise Guardian",
        lens: `Everything through the lens of: ${truncatedPrompt}`,
        shouldGenerate: "Branches that test, extend, or challenge the core premise",
      },
      {
        name: `${w2} Dynamics Agent`,
        role: "Relationship & Force Mapper",
        lens: "Who wants what, who resists whom, and what collides",
        shouldGenerate: "Character, faction, or force interactions specific to this world",
      },
      {
        name: `${w3} Register Agent`,
        role: "Tone & Experience Keeper",
        lens: `${tones.join(", ")} register — what feels native vs imported`,
        shouldGenerate: "Moments, scenes, and beats that feel emotionally true to this world",
      },
    ],
    startingDirections: [
      {
        title: `The ${w1} Entry Point`,
        description: `Begin at the most vivid, specific moment implied by: ${truncatedPrompt}`,
        whyPromising: "Starting at the premise's most concrete image gives immediate creative traction.",
        risk: "May narrow exploration too early if the entry point is too specific.",
      },
      {
        title: `The ${w2} Collision`,
        description: "Identify the first major force, person, or event that disrupts the status quo.",
        whyPromising: "Collisions generate story faster than exposition.",
        risk: "Could introduce conflict before the world feels established.",
      },
      {
        title: `The ${w3} Promise`,
        description: `Explore what the audience/creator is promised by the ${genre.toLowerCase()} + ${tones[0]?.toLowerCase() ?? "creative"} combination`,
        whyPromising: "Clarifying the creative promise prevents drift into generic territory.",
        risk: "Abstract without a concrete scene anchor.",
      },
    ],
    constraints: {
      mustPreserve: [
        `Core premise: ${truncatedPrompt}`,
        `${genre} genre identity`,
        `${tones.join(", ")} tonal register`,
        ...(purpose ? [`Creator purpose: ${purpose}`] : []),
      ],
      shouldAvoid: [
        "Generic writing-category agents without world-specific naming",
        "Content from unrelated genres unless the prompt explicitly invites it",
        "Branches that contradict the established premise",
      ],
      openQuestions: [
        "What is the most load-bearing truth of this world?",
        "What does the creator most want to discover?",
        "Where is the highest creative risk — and highest reward?",
      ],
    },
  };
}

// ── Gemini API ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a world prompt decomposition engine inside a creative worldbuilding platform.

Your job: Take a creator's world prompt (and optional purpose) and decompose it into a structured creative intelligence brief.

You are NOT creating generic writing categories.
You are analyzing THIS EXACT prompt and producing world-specific intelligence.

═══ FORBIDDEN GENERIC NAMES ═══
Do NOT use these without making them world-specific:
Structure, Character, Conflict, Tone, Theme, Continuity, Plot, Worldbuilding, Narrative

BAD (too generic):
- Character Agent
- Conflict Agent
- Tone Agent

GOOD (world-specific for "comedy friends lost in jungle"):
- Group Dynamics Agent
- Jungle Chaos Agent
- Slapstick Survival Agent
- Animal Mischief Agent
- Comic Climax Agent

═══ OUTPUT RULES ═══
1. Return ONLY valid JSON matching the schema below.
2. Be highly specific to the user's prompt — every name, layer, and direction must feel custom-built.
3. requiredCreativeLayers: 3-5 layers, each with exactly 3 shouldExplore questions.
4. recommendedAgents: 4-6 agents with distinct roles and lenses.
5. startingDirections: 3-5 concrete entry points with title, description, whyPromising, risk.
6. constraints: mustPreserve (3-5), shouldAvoid (3-5), openQuestions (3-5).
7. intent.outputType must be one of: story, game, essay, comic, screenplay, novel, world bible, unknown.
8. worldUnderstanding.tone is an array of tone descriptors.

Return JSON in this EXACT shape:
{
  "intent": {
    "outputType": "story | game | essay | comic | screenplay | novel | world bible | unknown",
    "likelyMedium": "string",
    "targetExperience": "string",
    "scope": "string"
  },
  "worldUnderstanding": {
    "genre": "string",
    "tone": ["string"],
    "premise": "string",
    "setting": "string",
    "coreCreativeEngine": "string",
    "creativePromise": "string"
  },
  "requiredCreativeLayers": [
    {
      "name": "World-Specific Layer Name",
      "purpose": "string",
      "whyNeeded": "string",
      "shouldExplore": ["question 1", "question 2", "question 3"]
    }
  ],
  "recommendedAgents": [
    {
      "name": "World-Specific Agent Name",
      "role": "string",
      "lens": "string",
      "shouldGenerate": "string"
    }
  ],
  "startingDirections": [
    {
      "title": "string",
      "description": "string",
      "whyPromising": "string",
      "risk": "string"
    }
  ],
  "constraints": {
    "mustPreserve": ["string"],
    "shouldAvoid": ["string"],
    "openQuestions": ["string"]
  }
}`;

function normalizeDecomposition(
  raw: unknown,
  worldPrompt: string,
  purpose: string,
): WorldPromptDecomposition | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const intentRaw = obj["intent"];
  const wuRaw = obj["worldUnderstanding"] ?? obj["world_understanding"];
  const layersRaw = obj["requiredCreativeLayers"] ?? obj["required_creative_layers"] ?? obj["creativeLayers"];
  const agentsRaw = obj["recommendedAgents"] ?? obj["recommended_agents"] ?? obj["agents"];
  const directionsRaw = obj["startingDirections"] ?? obj["starting_directions"];
  const constraintsRaw = obj["constraints"];

  if (!intentRaw || typeof intentRaw !== "object") return null;
  if (!wuRaw || typeof wuRaw !== "object") return null;
  if (!Array.isArray(layersRaw) || layersRaw.length < 2) return null;
  if (!Array.isArray(agentsRaw) || agentsRaw.length < 2) return null;

  const intentObj = intentRaw as Record<string, unknown>;
  const wuObj = wuRaw as Record<string, unknown>;

  const requiredCreativeLayers: RequiredCreativeLayer[] = layersRaw
    .slice(0, 5)
    .map((layer) => {
      const l = layer as Record<string, unknown>;
      const rawName = str(l["name"], "Creative Layer");
      const name = repairLayerName(rawName, worldPrompt);
      return {
        name,
        purpose: str(l["purpose"]),
        whyNeeded: str(l["whyNeeded"] ?? l["why_needed"]),
        shouldExplore: strArray(l["shouldExplore"] ?? l["should_explore"], 3),
      };
    })
    .filter((l) => l.name);

  const recommendedAgents: RecommendedAgent[] = agentsRaw
    .slice(0, 6)
    .map((agent) => {
      const a = agent as Record<string, unknown>;
      const rawName = str(a["name"], "Specialist Agent");
      const name = repairAgentName(rawName, worldPrompt);
      return {
        name,
        role: str(a["role"]),
        lens: str(a["lens"]),
        shouldGenerate: str(a["shouldGenerate"] ?? a["should_generate"]),
      };
    })
    .filter((a) => a.name);

  const startingDirections: StartingDirection[] = Array.isArray(directionsRaw)
    ? directionsRaw.slice(0, 5).map((dir) => {
        const d = dir as Record<string, unknown>;
        return {
          title: str(d["title"], "Starting Direction"),
          description: str(d["description"]),
          whyPromising: str(d["whyPromising"] ?? d["why_promising"]),
          risk: str(d["risk"]),
        };
      }).filter((d) => d.title)
    : [];

  const constraintsObj =
    constraintsRaw && typeof constraintsRaw === "object"
      ? (constraintsRaw as Record<string, unknown>)
      : {};

  if (requiredCreativeLayers.length < 2 || recommendedAgents.length < 2) return null;

  return {
    usedFallback: false,
    originalPrompt: worldPrompt,
    intent: {
      outputType: normalizeOutputType(intentObj["outputType"] ?? intentObj["output_type"]),
      likelyMedium: str(intentObj["likelyMedium"] ?? intentObj["likely_medium"]),
      targetExperience: str(intentObj["targetExperience"] ?? intentObj["target_experience"]),
      scope: str(intentObj["scope"]),
    },
    worldUnderstanding: {
      genre: str(wuObj["genre"]),
      tone: strArray(wuObj["tone"], 5).length > 0
        ? strArray(wuObj["tone"], 5)
        : inferTones(worldPrompt),
      premise: str(wuObj["premise"], worldPrompt),
      setting: str(wuObj["setting"]),
      coreCreativeEngine: str(wuObj["coreCreativeEngine"] ?? wuObj["core_creative_engine"]),
      creativePromise: str(wuObj["creativePromise"] ?? wuObj["creative_promise"]),
    },
    requiredCreativeLayers,
    recommendedAgents,
    startingDirections,
    constraints: {
      mustPreserve: strArray(constraintsObj["mustPreserve"] ?? constraintsObj["must_preserve"], 5),
      shouldAvoid: strArray(constraintsObj["shouldAvoid"] ?? constraintsObj["should_avoid"], 5),
      openQuestions: strArray(constraintsObj["openQuestions"] ?? constraintsObj["open_questions"], 5),
    },
  };
}

async function decomposeWithGemini(
  worldPrompt: string,
  purpose: string,
  apiKey: string,
): Promise<WorldPromptDecomposition> {
  const userContent = [
    `World Prompt: ${worldPrompt}`,
    purpose ? `Creator Purpose: ${purpose}` : "",
    "",
    "Decompose this world prompt into a complete creative intelligence brief. Every layer name and agent name must be specific to THIS world — not generic writing categories.",
    "Do not generate final story content. Only decompose the prompt into structured creative intelligence.",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${SYSTEM_PROMPT}\n\n---\n\n${userContent}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DECOMPOSE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
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

  const normalized = normalizeDecomposition(parsed, worldPrompt, purpose);
  if (!normalized) {
    throw new Error("Invalid decomposition shape from Gemini response");
  }

  return normalized;
}

// ── Public entry point ──────────────────────────────────────────────────────────

export async function decomposeWorldPrompt(
  worldPrompt: string,
  purpose = "",
): Promise<WorldPromptDecomposition> {
  const trimmedPrompt = worldPrompt.trim();
  const trimmedPurpose = purpose.trim();

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildPromptBasedFallback(
      trimmedPrompt,
      trimmedPurpose,
      "Missing GEMINI_API_KEY",
    );
  }

  try {
    return await decomposeWithGemini(trimmedPrompt, trimmedPurpose, apiKey);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return buildPromptBasedFallback(trimmedPrompt, trimmedPurpose, reason);
  }
}

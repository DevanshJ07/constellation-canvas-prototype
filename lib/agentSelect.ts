export type AgentSelectInput = {
  worldSeed: string;
  currentNode: {
    title: string;
    description: string;
  };
  activeDomain: string;
  creatorDirection: string;
  canonThreads: unknown;
  worldTensions: string[];
  currentPath: string[];
};

export type SelectedAgent = {
  name: string;
  role: string;
  whySelected: string;
  focusQuestions: string[];
};

export type AgentSelectOutput = {
  selectedAgents: SelectedAgent[];
  creativeNeed: string;
};

export const AGENT_SELECT_MODEL = "openai/gpt-4o-mini";

export function isValidAgentSelectOutput(value: unknown): value is AgentSelectOutput {
  if (!value || typeof value !== "object") return false;
  const v = value as AgentSelectOutput;
  if (typeof v.creativeNeed !== "string") return false;
  if (!Array.isArray(v.selectedAgents) || v.selectedAgents.length < 3) return false;
  return v.selectedAgents.every(
    (a) =>
      a &&
      typeof a.name === "string" &&
      typeof a.role === "string" &&
      typeof a.whySelected === "string" &&
      Array.isArray(a.focusQuestions) &&
      a.focusQuestions.length >= 2,
  );
}

function agent(
  name: string,
  role: string,
  whySelected: string,
  q1: string,
  q2: string,
): SelectedAgent {
  return {
    name,
    role,
    whySelected,
    focusQuestions: [q1, q2],
  };
}

/** Deterministic roster when OpenRouter is unavailable or fails. */
export function selectAgentsFallback(input: AgentSelectInput): AgentSelectOutput {
  const blob = [
    input.worldSeed,
    input.activeDomain,
    input.creatorDirection,
    input.currentNode.title,
    input.currentNode.description,
    ...input.worldTensions,
    ...input.currentPath,
  ]
    .join(" ")
    .toLowerCase();

  const agents: SelectedAgent[] = [];
  const domain = input.activeDomain.toLowerCase();

  const add = (a: SelectedAgent) => {
    if (!agents.some((x) => x.name === a.name)) agents.push(a);
  };

  if (
    /funny|comedy|comedic|slapstick|humor|humour|satire|parody/.test(blob) ||
    /funny|comedy|slapstick|humor|humour/.test(input.creatorDirection.toLowerCase())
  ) {
    add(
      agent(
        "Comedy Agent",
        "Finds tonal beats, absurdity, and payoff in comedic worlds.",
        "Your direction or world seed signals comedic intent.",
        "Where does this moment earn a laugh without breaking the world?",
        "What rule of this world makes the comedy sharper?",
      ),
    );
    add(
      agent(
        "Slapstick Agent",
        "Shapes physical comedy, escalation, and comic timing.",
        "Slapstick or light comedy cues were detected in context.",
        "What physical or situational chaos fits this branch?",
        "How far can exaggeration go before it stops feeling grounded?",
      ),
    );
    add(
      agent(
        "Character Dynamics Agent",
        "Tracks relationships, rivalry, and ensemble chemistry.",
        "Comedy worlds need strong character friction to land.",
        "Which relationship drives the next beat of humor or conflict?",
        "Who misunderstands whom — and why is it funny?",
      ),
    );
    add(
      agent(
        "Pacing Agent",
        "Balances setup, escalation, and release across scenes.",
        "Comedy and action both depend on rhythm at this node.",
        "Should this branch accelerate or breathe before the next turn?",
        "What is the smallest beat that sets up the biggest payoff?",
      ),
    );
  } else if (
    /action|thrill|thriller|chase|fight|combat|suspense/.test(blob) ||
    /action|thrill|thriller/.test(input.creatorDirection.toLowerCase())
  ) {
    add(
      agent(
        "Action Agent",
        "Designs kinetic set pieces and cause-and-effect momentum.",
        "Action or thriller energy is present in your steer or world.",
        "What physical or strategic move changes the power balance here?",
        "What constraint makes this action harder and more interesting?",
      ),
    );
    add(
      agent(
        "Thriller Agent",
        "Builds tension, dread, and stakes that tighten over time.",
        "The current node benefits from suspense-forward thinking.",
        "What does the audience fear will happen next?",
        "What detail should stay hidden until the last possible moment?",
      ),
    );
    add(
      agent(
        "Conflict Agent",
        "Clarifies opposing forces, goals, and irreversible choices.",
        "High-stakes paths need sharper opposition at this branch.",
        "Who wants what — and what are they willing to sacrifice?",
        "What choice here cannot be undone?",
      ),
    );
    add(
      agent(
        "Pacing Agent",
        "Balances setup, escalation, and release across scenes.",
        "Thriller and action threads need deliberate rhythm here.",
        "Where should tension peak before release?",
        "What quiet moment makes the next surge hit harder?",
      ),
    );
  } else if (
    /romance|love|heart|relationship|dream|kingdom|political/.test(blob) ||
    /romance|love|relationship/.test(input.creatorDirection.toLowerCase())
  ) {
    add(
      agent(
        "Romance Agent",
        "Develops longing, chemistry, and emotional stakes between characters.",
        "Romantic or relational themes appear in your world context.",
        "What unspoken feeling sits beneath this moment?",
        "What barrier makes connection difficult but worth pursuing?",
      ),
    );
    add(
      agent(
        "Emotional Depth Agent",
        "Surfaces inner conflict, vulnerability, and character truth.",
        "Relationship-driven worlds need interiority at this node.",
        "What does this character fear revealing?",
        "What memory shapes how they respond here?",
      ),
    );
    if (/dream|political|kingdom|rival/.test(blob)) {
      add(
        agent(
          "Dream Logic Agent",
          "Connects surreal rules to emotional and plot function.",
          "Dream or surreal motifs are active in your world seed or path.",
          "What dream rule mirrors the emotional truth of this scene?",
          "What shifts when waking logic fails?",
        ),
      );
      add(
        agent(
          "Political Conflict Agent",
          "Maps factions, power, and institutional pressure.",
          "Rival powers or political framing surfaced in context.",
          "Which institution benefits if this truth spreads?",
          "Who loses status if this branch becomes canon?",
        ),
      );
    }
    add(
      agent(
        "Continuity Agent",
        "Keeps character history and world rules consistent.",
        "Relational arcs need continuity as canon grows.",
        "What prior choice should echo in this beat?",
        "Which established truth constrains this relationship?",
      ),
    );
  } else if (
    /horror|dread|fear|psychological|unsettling|nightmare/.test(blob) ||
    domain.includes("fear")
  ) {
    add(
      agent(
        "Psychological Horror Agent",
        "Focuses on dread, perception, and the mind under pressure.",
        "Horror or fear-forward language is active in this context.",
        "What fear is rational inside this world — and what fear is contagious?",
        "What normal thing should feel wrong here?",
      ),
    );
    add(
      agent(
        "Symbolism Agent",
        "Tracks motifs, recurring images, and thematic resonance.",
        "Horror and folklore worlds lean on symbolic repetition.",
        "What image or ritual keeps returning — and why?",
        "What symbol could tie this node to your canon threads?",
      ),
    );
    add(
      agent(
        "Mythology Agent",
        "Grounds supernatural logic in belief, ritual, and inherited story.",
        "Folklore or mythic framing appears in your world seed or domain.",
        "What old story explains what is happening now?",
        "Who still performs the rite — and who forgot why?",
      ),
    );
    add(
      agent(
        "Continuity Agent",
        "Keeps canon threads, tone, and cause-and-effect aligned.",
        "Horror worlds fracture easily without continuity discipline.",
        "Which established truth makes this dread inevitable?",
        "What contradiction would break the world's credibility?",
      ),
    );
  }

  if (domain.includes("mythology") || /myth|folklore|temple|god|shrine|ritual/.test(blob)) {
    add(
      agent(
        "Mythology Agent",
        "Grounds supernatural logic in belief, ritual, and inherited story.",
        `The active domain (${input.activeDomain || "mythic context"}) calls for mythic specialists.`,
        "What belief system makes this truth feel ancient rather than invented?",
        "Who preserves this story — and who tries to erase it?",
      ),
    );
    add(
      agent(
        "Symbolism Agent",
        "Tracks motifs, recurring images, and thematic resonance.",
        "Mythic exploration benefits from symbolic through-lines.",
        "What object or place carries more meaning than it appears?",
        "Which symbol links this node to your canon threads?",
      ),
    );
    add(
      agent(
        "Continuity Agent",
        "Keeps canon threads, tone, and cause-and-effect aligned.",
        "Mythology branches multiply quickly without continuity guardrails.",
        "Which prior truth must this branch honor?",
        "What would contradict the world bible you are building?",
      ),
    );
    add(
      agent(
        "Plot/Conflict Agent",
        "Clarifies stakes, opposition, and narrative propulsion.",
        "Every mythic node still needs clear dramatic pressure.",
        "Who opposes this truth becoming canon?",
        "What changes in the world if this is accepted?",
      ),
    );
  }

  if (domain.includes("ritual") || /ritual|ceremony|rite|prayer/.test(blob)) {
    add(
      agent(
        "Ritual Agent",
        "Designs repeated acts, taboos, and ceremonial logic.",
        "Ritual domain or language is active at this node.",
        "What must be performed — and what happens if it is skipped?",
        "Who is allowed to lead the rite?",
      ),
    );
  }

  if (domain.includes("bloodline") || /bloodline|lineage|inherit|heir|ancestr/.test(blob)) {
    add(
      agent(
        "Bloodlines Agent",
        "Tracks inheritance, curses, and family debt across generations.",
        "Lineage themes are present in domain or description.",
        "Who paid for this truth before the current generation?",
        "What secret passes down with the name?",
      ),
    );
  }

  if (domain.includes("mystery") || /mystery|unknown|secret|hidden|unexplained/.test(blob)) {
    add(
      agent(
        "Mystery Agent",
        "Protects unknowns, clues, and delayed revelation.",
        "Mystery-forward context at this node.",
        "What should remain unknowable for now?",
        "What clue can be planted without giving everything away?",
      ),
    );
  }

  if (agents.length < 3) {
    add(
      agent(
        "Worldbuilding Agent",
        "Ensures discoveries feel native to the seed and canon.",
        "Default specialist for early or mixed world context.",
        "What rule of this world makes this node necessary?",
        "How does this connect to what is already canon?",
      ),
    );
    add(
      agent(
        "Continuity Agent",
        "Keeps canon threads, tone, and cause-and-effect aligned.",
        "Always useful as canon and paths grow.",
        "Which established truth should constrain this branch?",
        "What would feel inconsistent with your world bible?",
      ),
    );
    add(
      agent(
        "Plot/Conflict Agent",
        "Clarifies stakes, opposition, and narrative propulsion.",
        "Exploration nodes need clear dramatic pressure.",
        "Who is affected if this becomes true?",
        "What new tension emerges from accepting this?",
      ),
    );
  }

  const selectedAgents = agents.slice(0, 5);
  const creativeNeed =
    input.creatorDirection.trim().length > 0
      ? `Honor the creator direction while deepening "${input.currentNode.title}" in line with ${input.worldSeed}.`
      : `Deepen "${input.currentNode.title}" so it feels inevitable inside ${input.worldSeed}.`;

  return { selectedAgents, creativeNeed };
}

export async function selectAgentsWithOpenRouter(
  input: AgentSelectInput,
  apiKey: string,
): Promise<AgentSelectOutput> {
  const systemPrompt = `You are a creative director assembling a specialist roster for a worldbuilding canvas.
Given world context, select 3 to 5 creative specialists (NOT chatbots) relevant to the current node.
Return JSON ONLY with this exact shape:
{
  "selectedAgents": [
    {
      "name": "string (e.g. Mythology Agent)",
      "role": "string (one-line specialty)",
      "whySelected": "string (why this specialist fits NOW)",
      "focusQuestions": ["string", "string"]
    }
  ],
  "creativeNeed": "string (one sentence describing the core creative problem at this node)"
}
Do not suggest generating branches. Do not write story content. Only select specialists.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://constellation-canvas-lab.local",
      "X-Title": "Constellation Canvas Lab",
    },
    body: JSON.stringify({
      model: AGENT_SELECT_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenRouter response");

  const parsed = JSON.parse(content) as unknown;
  if (!isValidAgentSelectOutput(parsed)) {
    throw new Error("Invalid agent selection JSON");
  }

  return {
    ...parsed,
    selectedAgents: parsed.selectedAgents.slice(0, 5),
  };
}

export async function selectAgents(input: AgentSelectInput): Promise<AgentSelectOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return selectAgentsFallback(input);
  }

  try {
    return await selectAgentsWithOpenRouter(input, apiKey);
  } catch {
    return selectAgentsFallback(input);
  }
}

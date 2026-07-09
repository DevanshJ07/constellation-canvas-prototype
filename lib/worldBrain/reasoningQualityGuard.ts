/**
 * Post-processing guard for shallow / repetitive reasoner output (Phase 6D / 6E.1).
 */

export type NodeDescriptionContext = {
  title: string;
  worldPrompt?: string;
  constellationTitle?: string;
  premise?: string;
  creativePurpose?: string;
  discoveryQuestion?: string;
  whyItMatters?: string;
  nodeType?: string;
  parentTitle?: string;
  nodeId?: string;
};

const SHALLOW_DESCRIPTION_PATTERNS: RegExp[] = [
  /\banchor all exploration\b/i,
  /\bspecific premise\b/i,
  /\bentry point into\b/i,
  /\bconcrete entry point\b/i,
  /\bvivid entry point\b/i,
  /\ba specific idea about\b/i,
  /\bexplore the .* dimension of this world\b/i,
  /\bdimension of this world\b/i,
  /\bexploration zone\b/i,
  /\bthis (node|branch|idea) (explores|examines|focuses on)\b/i,
  /\bgrounded in the (world|premise|seed)\b/i,
  /\bopens a concrete scene the creator can enter\b/i,
  /\bmeaningful discoveries inside\b/i,
  /\ba (concrete|specific) (idea|hook|starting point)\b/i,
  /\bwhat makes .+ unique\??/i,
  /\bthis path explores\b(?!.*(?:because|when|after|before|while|until|if|—|-))/i,
  /\bthis world\b/i,
];

const GENERIC_CATEGORY_PATTERNS: RegExp[] = [
  /^the (hero|villain|conflict|setting|mystery|main event)$/i,
  /^a (place|character|event|object) in\b/i,
];

type SeedHints = {
  horror: boolean;
  folklore: boolean;
  cave: boolean;
  memory: boolean;
  friends: boolean;
  indian: boolean;
};

function extendedSeedHints(seed: string): SeedHints {
  const s = seed.toLowerCase();
  return {
    horror: /\bhorror|dread|fear|nightmare|psychological\b/.test(s),
    folklore: /\bfolklore|myth|legend|spirit|ritual|temple|curse\b/.test(s),
    cave: /\bcave|caves|underground\b/.test(s),
    memory: /\bmemory|memories|remember|forget\b/.test(s),
    friends: /\bfriend|friends|group\b/.test(s),
    indian: /\bindian|sanskrit|village|folklore\b/.test(s),
  };
}

export function isShallowNodeDescription(
  description: string,
  context: Pick<NodeDescriptionContext, "title" | "worldPrompt"> = { title: "" },
): boolean {
  const text = description.trim();
  if (text.length < 24) return true;
  if (SHALLOW_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (GENERIC_CATEGORY_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const prompt = context.worldPrompt?.trim();
  if (prompt && prompt.length >= 20) {
    const promptWords = tokenize(prompt);
    const descWords = tokenize(text);
    if (promptWords.size >= 4 && descWords.size >= 4) {
      const overlap = jaccardSimilarity(promptWords, descWords);
      if (overlap >= 0.55) return true;
    }
    if (text.toLowerCase().includes(prompt.slice(0, 40).toLowerCase())) return true;
  }

  const title = context.title.trim();
  if (title.length >= 4) {
    const titleWords = tokenize(title);
    const descWords = tokenize(text);
    if (titleWords.size >= 2 && jaccardSimilarity(titleWords, descWords) >= 0.85) {
      return true;
    }
  }

  return false;
}

export function buildRichFallbackDescription(context: NodeDescriptionContext): string {
  const title = context.title.trim() || "this discovery";
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "");
  const hints = extendedSeedHints(context.worldPrompt ?? "");
  const parent = context.parentTitle?.trim();

  if (hints.horror && (hints.folklore || hints.indian)) {
    if (hints.friends && hints.cave) {
      return `As the group tries to explain what happened around ${focus}, each friend remembers a different version of the same moment. The horror comes from uncertainty: someone may be lying, someone may be losing memory, or the cave may be rewriting the truth before they can agree on it.`;
    }
    if (hints.cave) {
      return `${focus} turns memory into the first enemy. Before anyone faces a spirit, they begin doubting their own recollections — and the folklore warnings they ignored on the way in.`;
    }
    return `${focus} lets dread grow from a broken rule or a half-remembered warning. The supernatural pressure arrives only after trust, certainty, or safety has already cracked.`;
  }

  if (hints.memory && hints.friends) {
    return `When ${focus} surfaces, the group discovers they no longer share the same account of what happened. The tension is immediate: whoever speaks first may define reality for everyone else.`;
  }

  if (parent) {
    return `${focus} branches from ${parent.replace(/^The\s+/i, "")} with a sharper cost — a contradiction, secret, or consequence that cannot stay abstract for long.`;
  }

  return repairShallowNodeDescription(context);
}

export function buildRichFallbackWhyItMatters(context: NodeDescriptionContext): string {
  const title = context.title.trim() || "this discovery";
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "");
  const hints = extendedSeedHints(context.worldPrompt ?? "");

  if (hints.horror && hints.friends) {
    return "This creates mistrust inside the group before any monster needs to appear. The danger becomes psychological first, supernatural second.";
  }
  if (hints.folklore) {
    return `It forces a folklore rule into the open — one the characters may have broken without realizing — and makes the cost personal instead of decorative.`;
  }

  return `Why ${focus} matters: it forces a choice before the world can stay comfortable, and every option leaves a scar.`;
}

export function buildRichFallbackDirections(context: NodeDescriptionContext): string[] {
  const title = context.title.trim() || "this discovery";
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "");
  const hints = extendedSeedHints(context.worldPrompt ?? "");

  if (hints.horror && hints.friends && hints.cave) {
    return [
      "One friend remembers a warning nobody else heard.",
      "The group records the event, but the recording changes later.",
      "The safest explanation requires accusing someone innocent.",
      "A local folklore rule explains why spoken truth weakens inside the cave.",
    ];
  }

  if (hints.folklore) {
    return [
      `Someone invokes an old rule about ${focus} — and immediately regrets it.`,
      `A village story matches the situation too closely to be coincidence.`,
      `The characters discover they already broke a taboo tied to ${focus}.`,
      `A warning carved in stone contradicts what they thought they knew.`,
    ];
  }

  return [
    `What breaks first when ${focus} stops being abstract?`,
    `Who benefits if everyone misremembers the same moment?`,
    `What secret makes the safest choice feel like betrayal?`,
    `Which old rule or debt suddenly becomes impossible to ignore?`,
  ];
}

export function repairShallowNodeDescription(
  context: NodeDescriptionContext,
): string {
  const title = context.title.trim() || "this discovery";
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "");
  const zone = context.constellationTitle?.trim();
  const premise = context.premise?.trim();

  if (context.creativePurpose && context.creativePurpose.length >= 40) {
    if (!isShallowNodeDescription(context.creativePurpose, context)) {
      return context.creativePurpose;
    }
  }

  if (context.discoveryQuestion && context.discoveryQuestion.length >= 40) {
    const q = context.discoveryQuestion.replace(/\?$/, "").toLowerCase();
    if (!/^what makes .+ unique/.test(q)) {
      return `${focus} becomes urgent when ${q} — forcing a choice before the creator can move forward.`;
    }
  }

  if (context.whyItMatters && context.whyItMatters.length >= 40) {
    if (!isShallowNodeDescription(context.whyItMatters, context)) {
      return context.whyItMatters;
    }
  }

  if (premise && zone && !isShallowNodeDescription(premise, context)) {
    return `Within ${zone}, ${focus} collides with a buried pressure in the world — creating friction, consequence, and a path the creator can push further.`;
  }

  if (zone) {
    return `Inside ${zone}, ${focus} introduces a specific tension the creator can accept, reject, or steer — not a category label, but a living story pressure.`;
  }

  return buildRichFallbackDescription(context);
}

function logFallbackUsage(
  context: NodeDescriptionContext,
  reason: string,
  rejected?: string,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn("[creator-copy] fallback description used", {
    nodeId: context.nodeId ?? "(unknown)",
    title: context.title,
    reason,
    qualityGuardFailed: true,
    rejectedDescription: rejected?.slice(0, 160) ?? null,
  });
}

export function guardNodeDescription(
  description: string,
  context: NodeDescriptionContext,
): string {
  const trimmed = description.trim();
  if (!isShallowNodeDescription(trimmed, context)) return trimmed;

  logFallbackUsage(context, "shallow_or_repetitive_description", trimmed);
  return buildRichFallbackDescription(context);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

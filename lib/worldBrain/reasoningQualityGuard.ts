/**
 * Post-processing guard for shallow / repetitive reasoner output (Phase 6D).
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
};

const SHALLOW_DESCRIPTION_PATTERNS: RegExp[] = [
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
];

const GENERIC_CATEGORY_PATTERNS: RegExp[] = [
  /^the (hero|villain|conflict|setting|mystery|main event)$/i,
  /^a (place|character|event|object) in\b/i,
];

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
      if (overlap >= 0.72) return true;
    }
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

export function repairShallowNodeDescription(
  context: NodeDescriptionContext,
): string {
  const title = context.title.trim() || "this discovery";
  const focus = title.replace(/^The\s+/i, "").replace(/\?$/, "");
  const zone = context.constellationTitle?.trim();
  const premise = context.premise?.trim();

  if (context.creativePurpose && context.creativePurpose.length >= 40) {
    return context.creativePurpose;
  }

  if (context.discoveryQuestion && context.discoveryQuestion.length >= 40) {
    return `${focus} becomes urgent when ${context.discoveryQuestion.replace(/\?$/, "").toLowerCase()} — forcing a choice before the creator can move forward.`;
  }

  if (context.whyItMatters && context.whyItMatters.length >= 40) {
    return context.whyItMatters;
  }

  if (premise && zone) {
    return `Within ${zone}, ${focus} collides with ${premise.slice(0, 120)} — creating friction, consequence, and a path the creator can push further.`;
  }

  if (zone) {
    return `Inside ${zone}, ${focus} introduces a specific tension the creator can accept, reject, or steer — not a category label, but a living story pressure.`;
  }

  return `${focus} introduces a concrete pressure in the world — a choice, contradiction, or hidden cost that invites the creator to go deeper.`;
}

export function guardNodeDescription(
  description: string,
  context: NodeDescriptionContext,
): string {
  const trimmed = description.trim();
  if (!isShallowNodeDescription(trimmed, context)) return trimmed;
  return repairShallowNodeDescription(context);
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

/**
 * Creator-facing copy transforms (Phase 6E).
 * Product-native language — no AI debug or system terms in user UI.
 */

import { simplifyDisplayLabel } from "@/lib/simplifyDisplayLabel";
import {
  guardNodeDescription,
  isShallowNodeDescription,
  buildRichFallbackWhyItMatters,
  buildRichFallbackDirections,
} from "@/lib/worldBrain/reasoningQualityGuard";

export type PanelCopyContext = {
  title: string;
  category?: string;
  worldSeed?: string;
  whyItMatters?: string;
  creativePurpose?: string;
  discoveryQuestion?: string;
  rippleHint?: string;
};

const SYSTEM_TERM_REPLACEMENTS: [RegExp, string][] = [
  [/\bagent-shaped\b/gi, "Emergent Discovery"],
  [/\bAGENT-SHAPED\b/g, "Emergent Discovery"],
  [/\bNode Reasoner\b/g, "Living Thread"],
  [/\bReasoning Agent\b/g, "World Signal"],
  [/\bstarting points?\b/gi, "nearby discoveries"],
  [/\bentry point into\b/gi, "path into"],
  [/\bentry point\b/gi, "Discovery Path"],
  [/\bexplore the ([\w\s]+) dimension of this world\.?/gi, "This path explores $1 inside your world."],
  [/\bdimension of this world\b/gi, "thread in your world"],
  [/\bwhat lives inside\b/gi, "what pressure lives inside"],
  [/\bexploration zone\b/gi, "Emergent Constellation"],
];

const GENERIC_TITLE_PATTERNS: RegExp[] = [
  /\b(fragment|dimension|path|thread|signal|premise|dynamics|artifacts?)\b$/i,
  /^shared\s+\w+\s+fragment$/i,
  /^rule they break$/i,
  /^psychological chaos$/i,
  /^(the\s+)?(hero|villain|conflict|setting|mystery)$/i,
  /\bzone\b$/i,
  /\bchaos\b$/i,
];

const CATEGORY_LABELS: Record<string, string> = {
  place: "Place",
  character: "Character",
  event: "Event",
  object: "Object",
  faction: "Faction",
  mystery: "Mystery",
  rule: "World Rule",
  conflict: "Narrative Pressure",
  symbol: "Symbol",
  ritual: "Ritual",
  relationship: "Living Thread",
  threat: "Threat",
  opportunity: "Uncovered Direction",
  constellation: "Emergent Constellation",
};

export function sanitizeCreatorCopy(text: string): string {
  let result = text.trim();
  for (const [pattern, replacement] of SYSTEM_TERM_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

export function formatCreatorCategory(category?: string | null): string | undefined {
  if (!category) return undefined;
  const cleaned = sanitizeCreatorCopy(category.replace(/^✦\s*/, "").trim());
  const key = cleaned.toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  if (/^✦/i.test(category) || /agent|reasoner|specialist/i.test(cleaned)) {
    return "Emergent Discovery";
  }
  return simplifyDisplayLabel(cleaned);
}

function isGenericStoryTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 8) return true;
  if (GENERIC_TITLE_PATTERNS.some((p) => p.test(t))) return true;
  const words = t.split(/\s+/);
  if (words.length <= 2 && !/\b(the|a)\b/i.test(t)) return true;
  return false;
}

function seedHints(seed: string): {
  hasCave: boolean;
  hasMemory: boolean;
  hasFriends: boolean;
  hasTemple: boolean;
  hasMemoryEconomy: boolean;
  hasHorror: boolean;
  hasFolklore: boolean;
} {
  const s = seed.toLowerCase();
  return {
    hasCave: /\bcave|caves|underground\b/.test(s),
    hasMemory: /\bmemory|memories|remember\b/.test(s),
    hasFriends: /\bfriend|friends|group\b/.test(s),
    hasTemple: /\btemple|ritual|shrine|god\b/.test(s),
    hasMemoryEconomy: /\bmemory.*(econom|currency|trade|market)|econom.*memory\b/.test(s),
    hasHorror: /\bhorror|dread|fear|nightmare|psychological\b/.test(s),
    hasFolklore: /\bfolklore|myth|legend|spirit|ritual|indian\b/.test(s),
  };
}

/** Prefer concrete story-hook titles over category labels. */
export function toStoryHookTitle(title: string, ctx: PanelCopyContext = { title }): string {
  const base = sanitizeCreatorCopy(title);
  if (!isGenericStoryTitle(base)) return base;

  const hints = seedHints(ctx.worldSeed ?? "");
  const lower = base.toLowerCase();

  if (/psychological|chaos|memory|nightmare|fragment/.test(lower)) {
    if (hints.hasCave && hints.hasFriends) {
      return "The Same Dream Begins Differently for Each Friend";
    }
    if (hints.hasCave) {
      return "The Cave Makes Memory Unreliable";
    }
    if (hints.hasMemoryEconomy) {
      return "A Memory That No Longer Belongs to You";
    }
    return "Fear Spreads Faster Than the Truth";
  }

  if (/rule they break|rule|law/.test(lower)) {
    if (hints.hasTemple) return "One Friend Breaks the Temple's Oldest Warning";
    if (hints.hasCave) return "One Friend Breaks the Cave's Oldest Warning";
    return "The Rule Becomes a Moral Choice";
  }

  if (/shared|fragment/.test(lower)) {
    return hints.hasFriends
      ? "Each Friend Remembers the Same Moment Wrong"
      : "A Shared Secret That Cannot Stay Buried";
  }

  if (hints.hasCave) return "Something in the Cave Refuses to Stay Forgotten";
  if (hints.hasMemoryEconomy) return "A Debt Paid in Someone Else's Past";

  return base.length >= 12 ? base : `What ${base} Unleashes Next`;
}

export function enrichPanelDescription(
  description: string,
  ctx: PanelCopyContext,
): string {
  const sanitized = sanitizeCreatorCopy(description);
  if (
    isShallowNodeDescription(sanitized, {
      title: ctx.title,
      worldPrompt: ctx.worldSeed,
    }) ||
    /explore the .* (dimension|thread) of this world/i.test(sanitized) ||
    /\banchor all exploration\b/i.test(sanitized)
  ) {
    return guardNodeDescription(sanitized, {
      title: ctx.title,
      worldPrompt: ctx.worldSeed,
      constellationTitle: ctx.category,
      creativePurpose: ctx.creativePurpose ?? ctx.whyItMatters,
      discoveryQuestion: ctx.discoveryQuestion,
      whyItMatters: ctx.whyItMatters,
      nodeType: ctx.category,
    });
  }
  return sanitized;
}

export function enrichWhyItMatters(
  whyItMatters: string | null | undefined,
  ctx: PanelCopyContext,
): string | null {
  const guardCtx = {
    title: ctx.title,
    worldPrompt: ctx.worldSeed,
    constellationTitle: ctx.category,
    discoveryQuestion: ctx.discoveryQuestion,
    whyItMatters: ctx.whyItMatters,
  };

  if (!whyItMatters?.trim()) {
    if (ctx.discoveryQuestion && !/^what makes .+ unique/i.test(ctx.discoveryQuestion)) {
      return sanitizeCreatorCopy(ctx.discoveryQuestion);
    }
    return buildRichFallbackWhyItMatters(guardCtx);
  }

  const sanitized = sanitizeCreatorCopy(whyItMatters);
  if (
    isShallowNodeDescription(sanitized, { title: ctx.title, worldPrompt: ctx.worldSeed }) ||
    /what makes .+ unique/i.test(sanitized) ||
    /\banchor all exploration\b/i.test(sanitized)
  ) {
    return buildRichFallbackWhyItMatters(guardCtx);
  }

  if (/what lives inside/i.test(sanitized)) {
    const hints = seedHints(ctx.worldSeed ?? "");
    if (hints.hasCave && hints.hasFriends) {
      return "What mental pressure does the cave create, and which friend becomes the first unreliable witness?";
    }
    return `What story pressure does ${ctx.category ?? ctx.title} create — and who pays the cost first?`;
  }

  if (sanitized.length < 28 || /^what .* inside/i.test(sanitized)) {
    return buildRichFallbackWhyItMatters(guardCtx);
  }

  return sanitized;
}

export function enrichExplorationQuestions(
  questions: string[] | null | undefined,
  ctx: PanelCopyContext,
): string[] {
  if (!questions?.length) {
    return buildRichFallbackDirections({
      title: ctx.title,
      worldPrompt: ctx.worldSeed,
      constellationTitle: ctx.category,
    });
  }

  const filtered = questions
    .map((q) => sanitizeCreatorCopy(q))
    .filter(
      (q) =>
        q.length >= 12 &&
        !/^what makes .+ unique/i.test(q) &&
        !/\banchor all exploration\b/i.test(q) &&
        !isShallowNodeDescription(q, { title: ctx.title, worldPrompt: ctx.worldSeed }),
    );

  if (filtered.length >= 2) return filtered.slice(0, 4);

  return buildRichFallbackDirections({
    title: ctx.title,
    worldPrompt: ctx.worldSeed,
    constellationTitle: ctx.category,
  });
}

export function toCreatorNodeLabel(title: string, ctx?: PanelCopyContext): string {
  return toStoryHookTitle(title, ctx ?? { title });
}

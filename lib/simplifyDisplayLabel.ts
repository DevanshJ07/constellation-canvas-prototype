/**
 * User-facing label simplification — display layer only.
 * Does not mutate underlying IDs or stored titles.
 */

import { normalizeCanvasDisplayTitle } from "@/lib/normalizeDisplayTitle";

const POETIC_SUFFIX_PATTERN =
  /\b(Pulse|Echoes|Shadows|Thread|Vanished|Whispers|Embrace|Ripple|Fiasco|Register|Premise|Dynamics|Artifacts)\b/gi;

const POETIC_PREFIX_PATTERN =
  /^(Echoes|Whispers|Veil|Fabled|Hidden|Ancient|Mysterious|Great)\s+/i;

const LABEL_OVERRIDES: [RegExp, string][] = [
  [/echoes\s+vanished\s+self/i, "Lost Identity"],
  [/vanished\s+self/i, "Lost Identity"],
  [/build\s+science/i, "Memory Science"],
  [/memory\s+market\s+pulse/i, "Memory Market"],
  [/memory\s+economy/i, "Memory Economy"],
  [/black\s+market/i, "Black Market"],
  [/chip\s+implanter/i, "Chip Implanter"],
  [/memory\s+price\s+index/i, "Memory Price Index"],
  [/power\s+(&|and)\s+inequality/i, "Power & Inequality"],
  [/law\s+(&|and)\s+regulation/i, "Law & Regulation"],
  [/family\s+debt/i, "Family Debt"],
  [/identity\s+loss/i, "Identity Loss"],
];

const VAGUE_SINGLE_WORDS = new Set([
  "psychological",
  "rooted",
  "horror",
  "mystery",
  "ritual",
  "mythology",
  "supernatural",
  "emotional",
  "cultural",
  "political",
  "economic",
  "social",
  "technological",
]);

const VAGUE_AUGMENT: Record<string, string> = {
  psychological: "Psychological Stakes",
  rooted: "Core Promise",
  horror: "Horror Tone",
  mystery: "Mystery Thread",
  ritual: "Ritual Practice",
  mythology: "Mythology Core",
  supernatural: "Supernatural Force",
  emotional: "Emotional Core",
  cultural: "Cultural Thread",
  political: "Political Stakes",
  economic: "Economic Force",
  social: "Social Dynamics",
  technological: "Technology Core",
};

function stripPoeticNoise(text: string): string {
  let cleaned = text.replace(/^The\s+/i, "");
  cleaned = cleaned.replace(POETIC_PREFIX_PATTERN, "");
  cleaned = cleaned.replace(POETIC_SUFFIX_PATTERN, "");
  return cleaned.replace(/\s+/g, " ").trim();
}

function preserveConceptualLabel(original: string, cleaned: string): string {
  const origWords = normalizeCanvasDisplayTitle(original)
    .split(/\s+/)
    .filter(Boolean);
  const cleanWords = cleaned.split(/\s+/).filter(Boolean);

  if (cleanWords.length >= 2) {
    return cleanWords.slice(0, 3).join(" ");
  }

  if (cleanWords.length === 1 && origWords.length >= 2) {
    const pair = origWords.slice(0, Math.min(3, origWords.length)).join(" ");
    const pairWords = pair.split(/\s+/).filter(Boolean);
    if (pairWords.length >= 2) return pair;
  }

  if (cleanWords.length === 1) {
    const key = cleanWords[0].toLowerCase();
    if (VAGUE_AUGMENT[key]) return VAGUE_AUGMENT[key];
    if (VAGUE_SINGLE_WORDS.has(key) && origWords.length >= 2) {
      return origWords.slice(0, Math.min(3, origWords.length)).join(" ");
    }
  }

  return cleaned;
}

/** Shortens verbose or poetic labels for canvas and panel display (2–3 words preferred). */
export function simplifyDisplayLabel(label: string): string {
  const original = label.trim();
  if (!original) return "Untitled";

  for (const [pattern, replacement] of LABEL_OVERRIDES) {
    if (pattern.test(original)) return replacement;
  }

  const cleaned = stripPoeticNoise(original);
  if (!cleaned) return normalizeCanvasDisplayTitle(original);

  const normalized = normalizeCanvasDisplayTitle(cleaned);
  const result = preserveConceptualLabel(original, normalized);

  const words = result.split(/\s+/).filter(Boolean);
  if (words.length > 3) {
    return words.slice(0, 3).join(" ");
  }

  return result || "Untitled";
}

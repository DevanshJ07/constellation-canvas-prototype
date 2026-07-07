/**
 * Canvas-facing label normalization — rendering layer only.
 * Preserves full internal titles elsewhere (detail panel, event logs, API).
 */

const MAX_WORDS = 4;
const PREFERRED_MAX_CHARS = 28;

const LEADING_FILLERS = new Set([
  "stardust",
  "veil",
  "great",
  "glowing",
  "mysterious",
  "hidden",
  "ancient",
  "fabled",
  "whispers",
  "ethereal",
  "cosmic",
  "celestial",
  "enigmatic",
  "legendary",
]);

const TAIL_NOUNS = new Set([
  "ecosystem",
  "economy",
  "conflict",
  "lore",
  "fiasco",
  "swarm",
  "erosion",
  "perception",
  "dynamics",
  "chaos",
  "register",
  "premise",
  "escalation",
  "artifacts",
  "artifact",
  "mystery",
  "journey",
  "disaster",
  "memory",
  "memories",
  "colony",
  "planet",
  "dreams",
  "romance",
]);

const WORD_REPLACEMENTS: Record<string, string> = {
  escalation: "Conflict",
  antic: "Gags",
  antics: "Gags",
};

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function looksLikeProperName(word: string): boolean {
  if (word.length <= 2) return false;
  if (word === word.toUpperCase()) return false;
  return /^[A-Z][a-z]+$/.test(word) && !TAIL_NOUNS.has(word.toLowerCase());
}

/** Shortens verbose labels for canvas display (1–4 words, clear nouns). */
export function normalizeCanvasDisplayTitle(raw: string): string {
  let text = raw.trim();
  if (!text) return "Untitled";

  if (text.includes("&")) {
    const parts = text
      .split("&")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      text =
        parts.find((p) => p.split(/\s+/).length <= 3) ??
        parts[0] ??
        text;
    }
  }

  text = text.replace(/^The\s+/i, "").replace(/\s+/g, " ").trim();

  let words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Untitled";

  while (words.length > 2 && LEADING_FILLERS.has(words[0]!.toLowerCase())) {
    words = words.slice(1);
  }

  if (words.length === 2 && LEADING_FILLERS.has(words[0]!.toLowerCase())) {
    words = [words[1]!];
  }

  words = words.map((w) => WORD_REPLACEMENTS[w.toLowerCase()] ?? w);

  const lastWord = words[words.length - 1]!.toLowerCase();
  if (words.length >= 3 && TAIL_NOUNS.has(lastWord)) {
    const prefix = words.slice(0, -1);
    const allProper = prefix.every(looksLikeProperName);
    if (allProper || prefix.length >= 2) {
      words = words.slice(-2);
    }
  }

  if (words.length > MAX_WORDS) {
    words = words.slice(-MAX_WORDS);
  } else if (words.length > 3) {
    words = words.slice(-3);
  }

  let result = words
    .slice(0, MAX_WORDS)
    .map((w) => capitalizeWord(w))
    .join(" ");

  if (result.length > PREFERRED_MAX_CHARS && words.length > 2) {
    result = words
      .slice(-2)
      .map((w) => capitalizeWord(w))
      .join(" ");
  }

  return result || "Untitled";
}

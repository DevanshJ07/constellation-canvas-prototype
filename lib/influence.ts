import type { ConstellationRegionId } from "@/lib/regions";

export type WorldShift = {
  truth: string;
  influence: ConstellationRegionId[];
};

// Hardcoded keyword → region influence. No AI, no generation.
// Each entry matches as a case-insensitive substring of the creator's truth.
const INFLUENCE_RULES: { keywords: string[]; regions: ConstellationRegionId[] }[] =
  [
    { keywords: ["forest"], regions: ["mystery", "rituals"] },
    { keywords: ["memory", "remember", "forget"], regions: ["mythology"] },
    { keywords: ["god", "goddess"], regions: ["rituals"] },
    { keywords: ["silence", "silent", "quiet"], regions: ["fear"] },
  ];

export function getInfluence(text: string): ConstellationRegionId[] {
  const haystack = text.toLowerCase();
  const result: ConstellationRegionId[] = [];

  for (const rule of INFLUENCE_RULES) {
    const matched = rule.keywords.some((kw) => haystack.includes(kw));
    if (!matched) continue;
    for (const region of rule.regions) {
      if (!result.includes(region)) result.push(region);
    }
  }

  return result;
}

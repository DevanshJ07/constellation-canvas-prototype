import type { ConstellationRegionId } from "@/lib/regions";
import { PARENT_MAP } from "@/lib/worldData";
import { CONSEQUENCE_BY_ID } from "@/lib/worldLogic";

export type AgentVoice = {
  agentLabel: string;
  message: string;
  accentClass: string;
};

const REGION_VOICES: Record<ConstellationRegionId, AgentVoice> = {
  mythology: {
    agentLabel: "Mythology Agent",
    message:
      "Forgotten gods rarely disappear. This branch may need a deity, shrine, or inherited curse.",
    accentClass: "text-amber-400/90",
  },
  rituals: {
    agentLabel: "Ritual Agent",
    message: "What repeated act keeps this world stable?",
    accentClass: "text-violet-400/90",
  },
  bloodlines: {
    agentLabel: "Bloodlines Agent",
    message:
      "If this is true, someone inherited the cost before anyone alive was born.",
    accentClass: "text-emerald-400/90",
  },
  fear: {
    agentLabel: "Fear Agent",
    message:
      "If this is true, what would the characters be afraid to remember?",
    accentClass: "text-rose-400/90",
  },
  mystery: {
    agentLabel: "Mystery Agent",
    message:
      "This route works better if one crucial fact remains unknowable.",
    accentClass: "text-sky-400/90",
  },
};

const NODE_VOICES: Partial<Record<string, AgentVoice>> = {
  "forgotten-temple": {
    agentLabel: "Mythology Agent",
    message:
      "A temple nobody admits existed usually means someone is still maintaining it in secret.",
    accentClass: "text-amber-400/90",
  },
  "temple-of-vanishing-names": {
    agentLabel: "Mythology Agent",
    message:
      "Names that vanish do not vanish evenly. Ask who benefits from the forgetting.",
    accentClass: "text-amber-400/90",
  },
  "memory-tax": {
    agentLabel: "Ritual Agent",
    message:
      "A tax on memory turns devotion into extraction. Resistance will follow.",
    accentClass: "text-violet-400/90",
  },
  "tree-priests": {
    agentLabel: "Mythology Agent",
    message:
      "Priests who sleep among roots are not servants — they are the forest's memory made human.",
    accentClass: "text-amber-400/90",
  },
  "seventh-night-ritual": {
    agentLabel: "Ritual Agent",
    message:
      "Ceremonies observed in rain are rarely about weather. They are about what rain unlocks.",
    accentClass: "text-violet-400/90",
  },
  "forest-fears": {
    agentLabel: "Fear Agent",
    message:
      "The forest is not haunted. It is attentive. That is worse.",
    accentClass: "text-rose-400/90",
  },
  "the-sealed-shrine": {
    agentLabel: "Mystery Agent",
    message:
      "Warm bricks over a sealed shrine mean something inside is still awake.",
    accentClass: "text-sky-400/90",
  },
};

function inferRegion(nodeId: string): ConstellationRegionId | undefined {
  let current: string | undefined = nodeId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current in REGION_VOICES) return current as ConstellationRegionId;
    current =
      PARENT_MAP[current] ?? CONSEQUENCE_BY_ID[current]?.parentId;
  }
  return undefined;
}

export function getAgentVoice(
  nodeId: string,
  regionId?: string,
): AgentVoice | null {
  if (NODE_VOICES[nodeId]) return NODE_VOICES[nodeId]!;
  const region = (regionId ?? inferRegion(nodeId)) as ConstellationRegionId | undefined;
  if (region && REGION_VOICES[region]) return REGION_VOICES[region]!;
  return null;
}

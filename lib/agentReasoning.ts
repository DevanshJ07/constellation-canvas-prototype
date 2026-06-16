import { ACCEPT_CONSEQUENCES, CONSEQUENCE_BY_ID } from "@/lib/worldLogic";
import { CONSTELLATION_REGIONS } from "@/lib/regions";
import { WORLD_NODES } from "@/lib/worldData";

export type AgentReasoning = {
  agentLabel: string;
  accentClass: string;
  becauseTitle: string;
  reasons: string[];
  ledTo: string[];
};

const REASONING: Record<string, AgentReasoning> = {
  "forgotten-temple": {
    agentLabel: "Mythology Agent",
    accentClass: "text-amber-400/90",
    becauseTitle: "Because the Forgotten Temple became important:",
    reasons: [
      "Someone must maintain it",
      "Someone must protect its secrets",
      "Someone must continue its worship",
    ],
    ledTo: ["Temple Caretaker", "Forbidden Prayer", "Buried Idol"],
  },
  "tree-priests": {
    agentLabel: "Mythology Agent",
    accentClass: "text-amber-400/90",
    becauseTitle: "Because the Tree Priests became real:",
    reasons: [
      "Power needs laws to survive",
      "Memory must be catalogued to be controlled",
      "Every order creates those who refuse it",
    ],
    ledTo: ["Forest Laws", "Memory Registry", "Exiled Priesthood"],
  },
  "memory-tax": {
    agentLabel: "Ritual Agent",
    accentClass: "text-violet-400/90",
    becauseTitle: "Because the Memory Tax became law:",
    reasons: [
      "The taxed will resist",
      "Seized memories will be sold",
      "Smugglers will learn to forge the sacred",
    ],
    ledTo: ["Pilgrim Rebellion", "Black Memory Market", "Memory Smugglers"],
  },
  "memory-registry": {
    agentLabel: "Ritual Agent",
    accentClass: "text-violet-400/90",
    becauseTitle: "Because the Memory Registry exists:",
    reasons: [
      "Catalogued memory invites taxation",
      "What is recorded can be demanded",
      "Control over memory becomes compulsion",
    ],
    ledTo: ["Memory Tax"],
  },
  mythology: {
    agentLabel: "Mythology Agent",
    accentClass: "text-amber-400/90",
    becauseTitle: "Because this world has a mythology:",
    reasons: [
      "Founding stories need physical anchors",
      "Forgotten gods leave caretakers behind",
      "Every myth splits into competing roads",
    ],
    ledTo: ["Forgotten Temple", "Old Lady"],
  },
  "old-lady": {
    agentLabel: "Mythology Agent",
    accentClass: "text-amber-400/90",
    becauseTitle: "Because the Old Lady endures:",
    reasons: [
      "Someone must speak what others cannot",
      "Memory outlives the people who carry it",
      "The dead still need witnesses",
    ],
    ledTo: ["Village Oracle", "Keeper of Forgotten Songs", "Woman Who Remembers the Dead"],
  },
};

function titlesForParent(parentId: string): string[] {
  const fromGraph = (ACCEPT_CONSEQUENCES[parentId] ?? []).map((c) => c.title);
  if (fromGraph.length > 0) return fromGraph;
  return REASONING[parentId]?.ledTo ?? [];
}

export function getAgentReasoning(nodeId: string): AgentReasoning | null {
  const direct = REASONING[nodeId];
  if (direct) {
    return {
      ...direct,
      ledTo: titlesForParent(nodeId).length > 0 ? titlesForParent(nodeId) : direct.ledTo,
    };
  }

  const parentId = CONSEQUENCE_BY_ID[nodeId]?.parentId;
  if (parentId && REASONING[parentId]) {
    const base = REASONING[parentId];
    return {
      ...base,
      ledTo: titlesForParent(parentId),
    };
  }

  // Region virtual roots
  const region = CONSTELLATION_REGIONS.find((r) => r.id === nodeId);
  if (region && REASONING[nodeId]) {
    return REASONING[nodeId];
  }

  return null;
}

export function getJourneyStepTitle(id: string): string {
  if (id in WORLD_NODES) return WORLD_NODES[id].title;
  return CONSEQUENCE_BY_ID[id]?.title ?? id;
}

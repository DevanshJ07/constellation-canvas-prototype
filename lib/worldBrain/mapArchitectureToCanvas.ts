import type {
  ArchitectureControlRules,
  WorldArchitecture,
} from "@/lib/worldBrain/architectWorld";
import type { AiGeneratedBranch } from "@/lib/agentExplore";
import type { AiDiscovery } from "@/types/discovery";

export type CanvasConstellation = {
  id: string;
  title: string;
  /** Short creator-facing label for canvas regions (1–4 words). */
  displayTitle: string;
  description: string;
  question: string;
  priority: number;
  agentIds: string[];
  nodeIds: string[];
};

export type CanvasNode = {
  id: string;
  title: string;
  description: string;
  constellationId: string;
  generatedByAgentId: string;
  whyPromising: string;
  risk: string;
  explorationQuestions: string[];
  nodeType: string;
  status: "potential";
  aiGenerated: true;
};

export type CanvasAgent = {
  id: string;
  name: string;
  role: string;
  lens: string;
  generates: string[];
  linkedConstellationIds: string[];
  activationTriggers: string[];
};

export type CanvasCriticAgent = {
  id: string;
  name: string;
  job: string;
  checks: string[];
  rejectsIf: string[];
  repairsBy: string[];
  severity: "soft" | "medium" | "strict";
};

export type CanvasWorldModel = {
  worldSeed: string;
  worldSummary: string;
  constellations: CanvasConstellation[];
  nodes: CanvasNode[];
  agents: CanvasAgent[];
  criticAgents: CanvasCriticAgent[];
  controlRules: ArchitectureControlRules;
};

function looksLikeInternalId(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(constellation|agent|critic|node)_[a-z0-9_]+$/i.test(t)) return true;
  if (/^ai[-_]/i.test(t)) return true;
  if (/^node_\d+/i.test(t)) return true;
  if (t.includes("_") && !t.includes(" ") && t === t.toLowerCase()) return true;
  return false;
}

function isValidNodeTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (looksLikeInternalId(trimmed)) return false;
  return true;
}

const DISPLAY_TITLE_PRESETS: [RegExp, string][] = [
  [/island.*deadly|deadly.*embrace/i, "Island Dangers"],
  [/fabled prize/i, "Treasure"],
  [/adventurers['']?\s+bond|adventurer.*bond/i, "Adventurers"],
  [/whispers.*ancient|ancient.*whisper/i, "Ancient Ruins"],
  [/dream mirror|dreamscape|shared dream|dream logic/i, "Dreamscape"],
  [/fated heart|hearts entwined|romantic tension|romance/i, "Romance"],
  [/future['']?s\s+shadow|future disaster|coming disaster/i, "Future Disaster"],
  [/reality['']?s\s+ripple|real world|waking world/i, "Real World"],
  [/bumbling crew|the crew/i, "The Crew"],
  [/jungle['']?s\s+prank|jungle trick|jungle mischief/i, "Jungle Tricks"],
  [/survival.*wrong|survival gone/i, "Survival Chaos"],
  [/cascade.*chaos|comic escalation/i, "Escalation"],
  [/animated antic|visual gag/i, "Visual Gags"],
];

const DISPLAY_TITLE_STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "in", "its", "their", "our", "your",
  "whispers", "fabled", "deadly", "embrace", "entwined", "shadow",
  "ripple", "effect", "bumbling", "ancients", "mysterious", "hidden",
]);

/** Short canvas label derived from constellation title and context. */
export function getConstellationDisplayTitle(
  title: string,
  purpose?: string,
  sourceCreativeLayer?: string,
): string {
  const corpus = `${title} ${purpose ?? ""} ${sourceCreativeLayer ?? ""}`.toLowerCase();
  for (const [pattern, label] of DISPLAY_TITLE_PRESETS) {
    if (pattern.test(corpus)) return label;
  }

  let cleaned = title.trim().replace(/^The\s+/i, "");
  cleaned = cleaned.replace(/['']s\b/gi, "").replace(/\s+/g, " ").trim();

  const rawWords = cleaned.split(/\s+/).filter(Boolean);
  const significant = rawWords.filter(
    (w) => !DISPLAY_TITLE_STOP_WORDS.has(w.toLowerCase()),
  );
  const words = (significant.length > 0 ? significant : rawWords).slice(0, 4);

  if (words.length === 0) return title.split(/\s+/).slice(0, 3).join(" ") || "Zone";

  const result = words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return result.length > 28 ? words.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") : result;
}

export function mapArchitectureToCanvasModel(
  architecture: WorldArchitecture,
): CanvasWorldModel {
  const agentIds = new Set(architecture.reasoningAgents.map((a) => a.id));
  const constellationIds = new Set(
    architecture.visibleConstellations.map((c) => c.id),
  );

  const nodes: CanvasNode[] = architecture.startingNodes
    .filter((node) => isValidNodeTitle(node.title))
    .filter((node) => constellationIds.has(node.belongsToConstellationId))
    .map((node) => ({
      id: node.id,
      title: node.title.trim(),
      description: node.description,
      constellationId: node.belongsToConstellationId,
      generatedByAgentId: node.generatedByAgentId,
      whyPromising: node.whyPromising,
      risk: node.risk,
      explorationQuestions: node.explorationQuestions,
      nodeType: node.nodeType,
      status: "potential" as const,
      aiGenerated: true as const,
    }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  const constellations: CanvasConstellation[] = architecture.visibleConstellations.map(
    (c) => {
      const linkedAgents = c.linkedReasoningAgentIds.filter((id) => agentIds.has(id));
      const suggestedNodes = c.suggestedStartingNodeIds.filter((id) => nodeIds.has(id));
      const assignedNodes = nodes
        .filter((n) => n.constellationId === c.id)
        .map((n) => n.id);
      const mergedNodeIds = [...new Set([...suggestedNodes, ...assignedNodes])].filter(
        (id) => nodeIds.has(id),
      );

      return {
        id: c.id,
        title: c.title,
        displayTitle: getConstellationDisplayTitle(
          c.title,
          c.purpose,
          c.sourceCreativeLayer,
        ),
        description: c.purpose,
        question: c.userFacingQuestion,
        priority: c.priority,
        agentIds: linkedAgents,
        nodeIds: mergedNodeIds,
      };
    },
  );

  const agents: CanvasAgent[] = architecture.reasoningAgents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    lens: a.lens,
    generates: a.generates,
    linkedConstellationIds: a.linkedConstellationIds.filter((id) =>
      constellationIds.has(id),
    ),
    activationTriggers: a.activationTriggers,
  }));

  const criticAgents: CanvasCriticAgent[] = architecture.criticAgents.map((c) => ({
    id: c.id,
    name: c.name,
    job: c.job,
    checks: c.checks,
    rejectsIf: c.rejectsIf,
    repairsBy: c.repairsBy,
    severity: c.severity,
  }));

  return {
    worldSeed: architecture.sourcePrompt,
    worldSummary: architecture.architectureSummary,
    constellations,
    nodes,
    agents,
    criticAgents,
    controlRules: architecture.controlRules,
  };
}

export function getAgentNameForConstellation(
  model: CanvasWorldModel,
  constellation: CanvasConstellation,
): string {
  const agent = model.agents.find((a) => constellation.agentIds.includes(a.id));
  return agent?.name ?? "Reasoning Agent";
}

export function canvasNodeToAiBranch(
  node: CanvasNode,
  parentId: string,
  agentName: string,
): AiGeneratedBranch {
  return {
    id: node.id,
    title: node.title.trim() || "Untitled Branch",
    description: node.description,
    whyItMatters: node.whyPromising,
    domain: node.nodeType,
    sourceAgent: agentName,
    rippleHint: node.risk,
    crossDomainEffects: [],
    continuityRisk: "medium",
    qualityScore: 0.85,
    parentId,
    generated: true,
  };
}

export function canvasNodeToAiDiscovery(
  node: CanvasNode,
  agentName: string,
): AiDiscovery {
  return {
    id: node.id,
    title: node.title.trim() || "Untitled Branch",
    description: node.description,
    category: node.nodeType,
    whyItMatters: node.whyPromising,
    sourceAgent: agentName,
    generated: true,
    whyPromising: node.whyPromising,
    risk: node.risk,
    explorationQuestions: node.explorationQuestions,
    nodeType: node.nodeType,
  };
}

export function buildArchitectureBranches(model: CanvasWorldModel): {
  branches: Record<string, AiGeneratedBranch[]>;
  nodeConstellationMap: Record<string, string>;
} {
  const branches: Record<string, AiGeneratedBranch[]> = {};
  const nodeConstellationMap: Record<string, string> = {};

  for (const constellation of model.constellations) {
    const agentName = getAgentNameForConstellation(model, constellation);
    const nodes = model.nodes.filter((n) => n.constellationId === constellation.id);
    branches[constellation.id] = nodes.map((n) =>
      canvasNodeToAiBranch(n, constellation.id, agentName),
    );
    for (const node of nodes) {
      nodeConstellationMap[node.id] = constellation.id;
    }
  }

  return { branches, nodeConstellationMap };
}

const canvasDisplayRegistry = new Map<string, { title: string; category: string }>();

/** Register architecture nodes/constellations for title resolution in canon and panels. */
export function registerCanvasWorldModel(model: CanvasWorldModel | null): void {
  canvasDisplayRegistry.clear();
  if (!model) return;

  for (const node of model.nodes) {
    canvasDisplayRegistry.set(node.id, {
      title: node.title.trim() || "Untitled Branch",
      category: node.nodeType,
    });
  }
  for (const constellation of model.constellations) {
    canvasDisplayRegistry.set(constellation.id, {
      title: constellation.displayTitle || constellation.title,
      category: "Constellation",
    });
  }
}

export function resolveCanvasNodeMeta(
  id: string,
): { title: string; category: string } | null {
  return canvasDisplayRegistry.get(id) ?? null;
}

/** Register reasoned node labels for canvas title resolution (does not clear existing entries). */
export function registerReasonedNodeMeta(
  entries: Array<{ id: string; displayTitle: string; nodeType: string }>,
): void {
  for (const entry of entries) {
    canvasDisplayRegistry.set(entry.id, {
      title: entry.displayTitle.trim() || "Untitled Branch",
      category: entry.nodeType,
    });
  }
}

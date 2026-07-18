/**
 * Compact context builders for GAME agents (Phase 8D).
 *
 * Shrinks prompt input so LLM calls stay within latency budgets.
 * Pure functions — no API calls.
 */

import type { CanvasWorldModel } from "../mapArchitectureToCanvas";
import type { NodeReasonerInput } from "../nodeReasonerTypes";
import type { RippleEffectPromptInput } from "../rippleEffectTypes";
import { getRecentDecisionEvents } from "../decisionEventLog";
import { isAgentFastMode } from "./agentLatency";

export const COMPACT_NODE_REASONER_LIMITS = {
  maxSiblingNodes: 8,
  maxSiblingDescriptionChars: 100,
  maxNeighborConstellations: 4,
  maxArchitectureSummaryChars: 400,
  maxWorldPromptChars: 500,
  maxCanonItems: 12,
  maxExplorationAxes: 4,
  maxParentTrail: 6,
} as const;

export const COMPACT_RIPPLE_LIMITS = {
  maxRecentDecisions: 6,
  maxPrimaryConstellationNodes: 14,
  maxNeighborConstellations: 3,
  maxNeighborNodesEach: 4,
  maxNodeDescriptionChars: 120,
  maxConstellationDescriptionChars: 160,
  maxWorldSummaryChars: 300,
} as const;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Compact NodeReasonerInput before prompt assembly.
 * Keeps parent + local constellation context; drops unrelated bulk.
 */
export function buildCompactNodeReasonerContext(
  input: NodeReasonerInput,
): NodeReasonerInput {
  const fast = isAgentFastMode();
  const siblingCap = fast
    ? Math.min(5, COMPACT_NODE_REASONER_LIMITS.maxSiblingNodes)
    : COMPACT_NODE_REASONER_LIMITS.maxSiblingNodes;
  const neighborCap = fast
    ? Math.min(2, COMPACT_NODE_REASONER_LIMITS.maxNeighborConstellations)
    : COMPACT_NODE_REASONER_LIMITS.maxNeighborConstellations;
  const canonCap = fast
    ? Math.min(8, COMPACT_NODE_REASONER_LIMITS.maxCanonItems)
    : COMPACT_NODE_REASONER_LIMITS.maxCanonItems;

  const constellationId = input.selectedNode.constellationId;

  const siblingNodes = input.siblingNodes.slice(0, siblingCap).map((s) => ({
    ...s,
    description: s.description
      ? truncate(s.description, COMPACT_NODE_REASONER_LIMITS.maxSiblingDescriptionChars)
      : undefined,
  }));

  const neighboringConstellations = input.neighboringConstellations
    .slice(0, neighborCap)
    .map((n) => ({
      id: n.id,
      title: n.title,
      displayTitle: n.displayTitle,
      role: n.role,
      // Drop long neighbor descriptions — awareness only
      description: undefined,
    }));

  const axes = input.selectedConstellation.explorationAxes?.slice(
    0,
    COMPACT_NODE_REASONER_LIMITS.maxExplorationAxes,
  );

  const existingCanon = (input.existingCanon ?? [])
    .filter((c) => {
      const sourceId = c.sourceConstellationId;
      if (sourceId) return sourceId === constellationId;
      return true;
    })
    .slice(0, canonCap);

  const depthContext = input.depthContext
    ? {
        ...input.depthContext,
        parentTrail: input.depthContext.parentTrail?.slice(
          -COMPACT_NODE_REASONER_LIMITS.maxParentTrail,
        ),
      }
    : undefined;

  return {
    ...input,
    worldPrompt: truncate(
      input.worldPrompt,
      COMPACT_NODE_REASONER_LIMITS.maxWorldPromptChars,
    ),
    architectureSummary: truncate(
      input.architectureSummary,
      COMPACT_NODE_REASONER_LIMITS.maxArchitectureSummaryChars,
    ),
    selectedConstellation: {
      ...input.selectedConstellation,
      explorationAxes: axes,
      localSummary: input.selectedConstellation.localSummary
        ? truncate(input.selectedConstellation.localSummary, 280)
        : undefined,
      description: truncate(input.selectedConstellation.description, 280),
    },
    selectedNode: {
      ...input.selectedNode,
      description: truncate(input.selectedNode.description, 500),
    },
    siblingNodes,
    neighboringConstellations,
    existingCanon,
    depthContext,
  };
}

export type CompactRippleCanvasStats = {
  constellationCount: number;
  nodeCount: number;
  recentDecisionCount: number;
  primaryConstellationId: string | null;
};

/**
 * Build a neighborhood-scoped canvas snapshot for ripple prompts.
 * Avoids dumping the full world graph into the LLM context.
 */
export function buildCompactRippleCanvasModel(
  canvasModel: CanvasWorldModel,
  triggerConstellationId: string | null | undefined,
): { model: CanvasWorldModel; stats: CompactRippleCanvasStats } {
  const fast = isAgentFastMode();
  const primaryNodeCap = fast
    ? Math.min(8, COMPACT_RIPPLE_LIMITS.maxPrimaryConstellationNodes)
    : COMPACT_RIPPLE_LIMITS.maxPrimaryConstellationNodes;
  const neighborCap = fast
    ? Math.min(2, COMPACT_RIPPLE_LIMITS.maxNeighborConstellations)
    : COMPACT_RIPPLE_LIMITS.maxNeighborConstellations;
  const neighborNodeCap = fast
    ? Math.min(3, COMPACT_RIPPLE_LIMITS.maxNeighborNodesEach)
    : COMPACT_RIPPLE_LIMITS.maxNeighborNodesEach;

  const primaryId =
    triggerConstellationId &&
    canvasModel.constellations.some((c) => c.id === triggerConstellationId)
      ? triggerConstellationId
      : canvasModel.constellations[0]?.id ?? null;

  const primary = primaryId
    ? canvasModel.constellations.find((c) => c.id === primaryId)
    : undefined;

  const neighbors = canvasModel.constellations
    .filter((c) => c.id !== primaryId)
    .slice(0, neighborCap);

  const keptConstellationIds = new Set<string>(
    [primaryId, ...neighbors.map((c) => c.id)].filter(Boolean) as string[],
  );

  const compactConstellations = canvasModel.constellations
    .filter((c) => keptConstellationIds.has(c.id))
    .map((c) => ({
      ...c,
      description: truncate(
        c.description,
        COMPACT_RIPPLE_LIMITS.maxConstellationDescriptionChars,
      ),
      question: truncate(c.question, 120),
    }));

  const compactNodes = canvasModel.nodes
    .filter((n) => keptConstellationIds.has(n.constellationId))
    .flatMap((n) => {
      // Cap applied after grouping below — keep for filter pass
      return [n];
    });

  const byConstellation = new Map<string, typeof compactNodes>();
  for (const node of compactNodes) {
    const list = byConstellation.get(node.constellationId) ?? [];
    list.push(node);
    byConstellation.set(node.constellationId, list);
  }

  const cappedNodes = [...byConstellation.entries()].flatMap(([cid, nodes]) => {
    const cap = cid === primaryId ? primaryNodeCap : neighborNodeCap;
    return nodes.slice(0, cap).map((n) => ({
      ...n,
      description: truncate(n.description, COMPACT_RIPPLE_LIMITS.maxNodeDescriptionChars),
      whyPromising: n.whyPromising
        ? truncate(n.whyPromising, 80)
        : n.whyPromising,
      risk: n.risk ? truncate(n.risk, 80) : n.risk,
      explorationQuestions: n.explorationQuestions?.slice(0, 1),
    }));
  });

  const model: CanvasWorldModel = {
    ...canvasModel,
    worldSummary: truncate(
      canvasModel.worldSummary,
      COMPACT_RIPPLE_LIMITS.maxWorldSummaryChars,
    ),
    constellations: compactConstellations.length
      ? compactConstellations
      : primary
        ? [
            {
              ...primary,
              description: truncate(
                primary.description,
                COMPACT_RIPPLE_LIMITS.maxConstellationDescriptionChars,
              ),
            },
          ]
        : [],
    nodes: cappedNodes,
    // Drop heavy agent/critic payloads from prompt context
    agents: [],
    criticAgents: [],
  };

  return {
    model,
    stats: {
      constellationCount: model.constellations.length,
      nodeCount: model.nodes.length,
      recentDecisionCount: 0,
      primaryConstellationId: primaryId,
    },
  };
}

/**
 * Compact RippleEffectPromptInput (or raw RippleEffectInput fields used by the prompt).
 */
export function buildCompactRippleContext(
  input: RippleEffectPromptInput,
): { input: RippleEffectPromptInput; stats: CompactRippleCanvasStats } {
  const fast = isAgentFastMode();
  const recentCap = fast
    ? Math.min(4, COMPACT_RIPPLE_LIMITS.maxRecentDecisions)
    : COMPACT_RIPPLE_LIMITS.maxRecentDecisions;

  const triggerConstellationId =
    input.triggerEvent.constellationSnapshot?.id ??
    input.triggerEvent.worldContext.activeConstellationId ??
    input.triggerEvent.nodeSnapshot.constellationId ??
    null;

  const { model, stats } = buildCompactRippleCanvasModel(
    input.canvasModel,
    triggerConstellationId,
  );

  const recentEvents = getRecentDecisionEvents(input.decisionLog, recentCap);
  const compactLog = {
    ...input.decisionLog,
    events: recentEvents,
  };

  // Cap canon id lists so prompt stays readable
  const canonCap = fast ? 12 : 20;
  const activeCanonState = {
    ...input.activeCanonState,
    truthNodeIds: input.activeCanonState.truthNodeIds.slice(0, canonCap),
    potentialNodeIds: input.activeCanonState.potentialNodeIds.slice(0, canonCap),
    rejectedNodeIds: input.activeCanonState.rejectedNodeIds.slice(0, canonCap),
  };

  return {
    input: {
      ...input,
      canvasModel: model,
      decisionLog: compactLog,
      activeCanonState,
    },
    stats: {
      ...stats,
      recentDecisionCount: recentEvents.length,
    },
  };
}

/** Measure whether a compact canvas excluded most of the original world. */
export function measureCanvasCompaction(
  original: CanvasWorldModel,
  compact: CanvasWorldModel,
): {
  originalNodeCount: number;
  compactNodeCount: number;
  originalConstellationCount: number;
  compactConstellationCount: number;
  excludedUnrelatedConstellations: boolean;
} {
  return {
    originalNodeCount: original.nodes.length,
    compactNodeCount: compact.nodes.length,
    originalConstellationCount: original.constellations.length,
    compactConstellationCount: compact.constellations.length,
    excludedUnrelatedConstellations:
      compact.constellations.length < original.constellations.length ||
      original.constellations.length <= 1,
  };
}

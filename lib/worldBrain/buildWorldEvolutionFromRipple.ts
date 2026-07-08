/**
 * Builds WorldEvolutionPlan from RipplePreviewModel + canvas context (Phase 5.2).
 * Pure functions only — no React, no API, no LLM, no canvas mutation.
 */

import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { buildRippleApplyPlan } from "@/lib/worldBrain/rippleApplyPlan";
import type { RipplePreviewModel } from "@/lib/worldBrain/ripplePreviewModel";
import type { CanonStateSnapshot, DecisionEventLog } from "@/lib/worldBrain/userDecisionTypes";
import {
  buildWorldEvolutionPlan,
  type WorldEvolutionInput,
  type WorldEvolutionPlan,
} from "@/lib/worldBrain/worldEvolutionPlan";

export type BuildWorldEvolutionFromRippleParams = {
  preview: RipplePreviewModel;
  canvasModel?: CanvasWorldModel | null;
  canonState?: CanonStateSnapshot;
  triggerNodeId?: string;
  nodeTitleById?: Record<string, string>;
  /** Full node→constellation map when available (canvas + reasoned nodes). */
  nodeConstellationMap?: Record<string, string>;
  decisionEventLog?: DecisionEventLog;
};

export type WorldEvolutionCanvasContext = {
  existingNodeIds: string[];
  nodeConstellationMap: Record<string, string>;
  constellationNodeCounts: Record<string, number>;
  nodeTitleById: Record<string, string>;
  triggerNodeId?: string;
};

/** Collect reliable canvas existence context for target validation. */
export function buildWorldEvolutionCanvasContext(
  params: Pick<
    BuildWorldEvolutionFromRippleParams,
    "canvasModel" | "nodeTitleById" | "nodeConstellationMap" | "triggerNodeId" | "decisionEventLog" | "preview"
  >,
): WorldEvolutionCanvasContext {
  const existingNodeIds = new Set<string>();
  const nodeConstellationMap: Record<string, string> = { ...(params.nodeConstellationMap ?? {}) };
  const nodeTitleById: Record<string, string> = { ...(params.nodeTitleById ?? {}) };
  const constellationNodeCounts: Record<string, number> = {};

  if (params.canvasModel) {
    for (const node of params.canvasModel.nodes) {
      existingNodeIds.add(node.id);
      nodeConstellationMap[node.id] = node.constellationId;
      nodeTitleById[node.id] = nodeTitleById[node.id] ?? (node.title.trim() || node.id);
      constellationNodeCounts[node.constellationId] =
        (constellationNodeCounts[node.constellationId] ?? 0) + 1;
    }
    for (const constellation of params.canvasModel.constellations) {
      constellationNodeCounts[constellation.id] =
        constellationNodeCounts[constellation.id] ??
        constellation.nodeIds.length;
    }
  }

  for (const nodeId of Object.keys(nodeConstellationMap)) {
    existingNodeIds.add(nodeId);
  }

  for (const nodeId of Object.keys(nodeTitleById)) {
    existingNodeIds.add(nodeId);
  }

  let triggerNodeId = params.triggerNodeId;
  if (!triggerNodeId && params.decisionEventLog && params.preview.triggerEventId) {
    const triggerEvent = params.decisionEventLog.events.find(
      (event) => event.id === params.preview.triggerEventId,
    );
    if (triggerEvent?.target.targetType === "node") {
      triggerNodeId = triggerEvent.target.id;
    }
  }

  return {
    existingNodeIds: [...existingNodeIds],
    nodeConstellationMap,
    constellationNodeCounts,
    nodeTitleById,
    ...(triggerNodeId !== undefined ? { triggerNodeId } : {}),
  };
}

export function buildWorldEvolutionInputFromRipple(
  params: BuildWorldEvolutionFromRippleParams,
): WorldEvolutionInput {
  const applyPlan = buildRippleApplyPlan(params.preview);
  const canvasContext = buildWorldEvolutionCanvasContext(params);

  return {
    applyPlan,
    canvasModel: params.canvasModel ?? undefined,
    canonState: params.canonState,
    triggerNodeId: canvasContext.triggerNodeId,
    nodeTitleById: canvasContext.nodeTitleById,
    nodeConstellationMap: canvasContext.nodeConstellationMap,
    existingNodeIds: canvasContext.existingNodeIds,
    constellationNodeCounts: canvasContext.constellationNodeCounts,
  };
}

export function buildWorldEvolutionPlanFromRipplePreview(
  params: BuildWorldEvolutionFromRippleParams,
): WorldEvolutionPlan {
  return buildWorldEvolutionPlan(buildWorldEvolutionInputFromRipple(params));
}

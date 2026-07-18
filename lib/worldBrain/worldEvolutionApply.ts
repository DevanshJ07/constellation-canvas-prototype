/**
 * World Evolution Engine — guarded canvas apply (Phase 5.5B.1).
 *
 * Pure apply executor: validated dry-run patch candidates → immutable canvas writes.
 * No React, no API, no LLM, no persistence.
 */

import type { CanvasConstellation, CanvasNode, CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import type { CanonStateSnapshot } from "@/lib/worldBrain/userDecisionTypes";
import {
  validatePatchCandidate,
  createCanvasEvolutionFingerprint,
  type DryRunContext,
  type EvolutionCanvasPatchCandidate,
  type EvolutionCanvasPatchType,
  type WorldEvolutionApplyDryRunResult,
} from "@/lib/worldBrain/worldEvolutionApplyDryRun";
import type { EvolutionPolicy } from "@/lib/worldBrain/worldEvolutionPlan";
import { DEFAULT_EVOLUTION_POLICY } from "@/lib/worldBrain/worldEvolutionPlan";

// ── Evolution overlay (canvas extension for reversible evolution state) ───────────

export type EvolutionEdgeRecord = {
  id: string;
  fromId: string;
  toId: string;
  constellationId?: string;
  metadata?: Record<string, unknown>;
};

export type CanvasEvolutionOverlay = {
  archivedNodeIds: string[];
  weakenedNodeIds: string[];
  strengthenedNodeIds: string[];
  edges: EvolutionEdgeRecord[];
  nodeEvolutionMetadata: Record<string, Record<string, unknown>>;
  constellationMetadata: Record<string, Record<string, unknown>>;
};

export type EvolutionAwareCanvasModel = CanvasWorldModel & {
  evolutionOverlay?: CanvasEvolutionOverlay;
};

// ── Apply types ───────────────────────────────────────────────────────────────────

export type WorldEvolutionApplyStatus =
  | "empty"
  | "applied"
  | "partially_applied"
  | "failed"
  | "cancelled";

export type WorldEvolutionApplyPolicy = {
  /** When true (default), any patch failure rolls back the entire batch. */
  atomic: boolean;
  maxPatchesPerBatch?: number;
};

export const DEFAULT_EVOLUTION_APPLY_POLICY: WorldEvolutionApplyPolicy = {
  atomic: true,
};

export type WorldEvolutionApplyInput = {
  canvasModel: CanvasWorldModel;
  dryRun: WorldEvolutionApplyDryRunResult;
  confirmed: boolean;
  selectedPatchIds?: string[];
  allowNeedsReviewPatches?: boolean;
  confirmedPatchIds?: string[];
  canonState?: CanonStateSnapshot;
  policy?: WorldEvolutionApplyPolicy;
  evolutionPolicy?: EvolutionPolicy;
  planId?: string;
  triggerEventId?: string;
  preservedTargetIds?: string[];
  lockedTargetIds?: string[];
  currentCanvasFingerprint?: string;
};

export type AppliedEvolutionPatch = {
  patchId: string;
  patchType: EvolutionCanvasPatchType;
  sourceActionId: string;
  targetId: string;
  reason: string;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  reversePatch: EvolutionCanvasPatchCandidate;
  appliedAt: string;
};

export type FailedEvolutionPatch = {
  patchId: string;
  patchType: EvolutionCanvasPatchType;
  sourceActionId: string;
  targetId?: string;
  reason: string;
  stopReason: string;
  recoverable: boolean;
};

export type EvolutionMutationBatch = {
  id: string;
  planId: string;
  triggerEventId: string;
  patchIds: string[];
  appliedCount: number;
  failedCount: number;
  skippedCount: number;
  atomic: boolean;
  startedAt: string;
  completedAt: string;
};

export type EvolutionUndoSnapshot = {
  batchId: string;
  canvasModelBefore: CanvasWorldModel;
  canvasModelAfter: EvolutionAwareCanvasModel;
  inversePatches: EvolutionCanvasPatchCandidate[];
  capturedAt: string;
};

export type EvolutionHistoryEntry = {
  id: string;
  planId: string;
  dryRunPlanId: string;
  triggerEventId: string;
  applyResultStatus: WorldEvolutionApplyStatus;
  appliedPatchIds: string[];
  failedPatchIds: string[];
  summary: string;
  undoSnapshot?: EvolutionUndoSnapshot;
  undoAvailable: boolean;
  /** Set when batch is undone in-memory (Phase 5.5C). */
  undoneAt?: string;
  timestamp: string;
};

export type WorldEvolutionApplyResult = {
  planId: string;
  dryRunId: string;
  status: WorldEvolutionApplyStatus;
  appliedPatches: AppliedEvolutionPatch[];
  failedPatches: FailedEvolutionPatch[];
  skippedPatches: FailedEvolutionPatch[];
  mutationBatch: EvolutionMutationBatch;
  historyEntry: EvolutionHistoryEntry;
  summary: string;
  canvasModel: EvolutionAwareCanvasModel;
};

// ── Helpers ───────────────────────────────────────────────────────────────────────

const PATCH_DEPENDENCY_ORDER: EvolutionCanvasPatchType[] = [
  "add_node",
  "add_edge",
  "update_node_metadata",
  "update_node_status",
  "mark_node_weakened",
  "mark_node_strengthened",
  "update_constellation_metadata",
  "update_edge_metadata",
  "archive_node",
  "no_op",
];

const SAFE_NODE_METADATA_FIELDS = new Set([
  "title",
  "description",
  "whyPromising",
  "risk",
  "explorationQuestions",
  "nodeType",
  // Phase 9B — story fields so accepted truths can visibly reframe node content.
  "storyUse",
  "possibleConflict",
  "whyItBelongsHere",
  "consequenceNote",
  "evolutionState",
]);

const SAFE_CONSTELLATION_METADATA_FIELDS = new Set([
  "displayTitle",
  "description",
  "question",
  "priority",
  "title",
  // Phase 9B — climax pressure + canon evolution.
  "pressureNote",
  "evolutionBehavior",
]);

function deepCloneCanvas<T>(value: T): T {
  return structuredClone(value);
}

function emptyOverlay(): CanvasEvolutionOverlay {
  return {
    archivedNodeIds: [],
    weakenedNodeIds: [],
    strengthenedNodeIds: [],
    edges: [],
    nodeEvolutionMetadata: {},
    constellationMetadata: {},
  };
}

function mergeOverlay(existing: CanvasEvolutionOverlay | undefined): CanvasEvolutionOverlay {
  if (!existing) return emptyOverlay();
  return {
    archivedNodeIds: [...existing.archivedNodeIds],
    weakenedNodeIds: [...existing.weakenedNodeIds],
    strengthenedNodeIds: [...existing.strengthenedNodeIds],
    edges: existing.edges.map((edge) => ({ ...edge, ...(edge.metadata ? { metadata: { ...edge.metadata } } : {}) })),
    nodeEvolutionMetadata: Object.fromEntries(
      Object.entries(existing.nodeEvolutionMetadata).map(([key, meta]) => [key, { ...meta }]),
    ),
    constellationMetadata: Object.fromEntries(
      Object.entries(existing.constellationMetadata).map(([key, meta]) => [key, { ...meta }]),
    ),
  };
}

function cloneCanvasWithOverlay(model: CanvasWorldModel): EvolutionAwareCanvasModel {
  const cloned = deepCloneCanvas(model) as EvolutionAwareCanvasModel;
  const source = (model as EvolutionAwareCanvasModel).evolutionOverlay;
  if (source) {
    cloned.evolutionOverlay = mergeOverlay(source);
  }
  return cloned;
}

function deterministicNodeId(sourceActionId: string, anchor: string): string {
  let hash = 5381;
  const input = `${sourceActionId}:${anchor}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  const suffix = (hash >>> 0).toString(36);
  return `evo_node_${sourceActionId.replace(/[^a-zA-Z0-9_]/g, "_")}_${suffix}`;
}

function isCanonTruth(nodeId: string, canonState?: CanonStateSnapshot): boolean {
  return canonState?.truthNodeIds.includes(nodeId) ?? false;
}

function sortPatches(candidates: EvolutionCanvasPatchCandidate[]): EvolutionCanvasPatchCandidate[] {
  return [...candidates].sort((a, b) => {
    const orderA = PATCH_DEPENDENCY_ORDER.indexOf(a.patchType);
    const orderB = PATCH_DEPENDENCY_ORDER.indexOf(b.patchType);
    if (orderA !== orderB) return orderA - orderB;
    return a.id.localeCompare(b.id);
  });
}

function buildApplyDryRunContext(
  model: EvolutionAwareCanvasModel,
  options: {
    canonState?: CanonStateSnapshot;
    preservedTargetIds?: string[];
    lockedTargetIds?: string[];
    evolutionPolicy?: EvolutionPolicy;
    proposedNodeIds?: Set<string>;
  },
): DryRunContext {
  const existingNodeIds = new Set<string>();
  const existingConstellationIds = new Set<string>();
  const nodeConstellationMap: Record<string, string> = {};
  const nodeTitleById: Record<string, string> = {};
  const constellationNodeCounts: Record<string, number> = {};

  for (const constellation of model.constellations) {
    existingConstellationIds.add(constellation.id);
    constellationNodeCounts[constellation.id] = constellation.nodeIds.length;
  }

  for (const node of model.nodes) {
    existingNodeIds.add(node.id);
    nodeConstellationMap[node.id] = node.constellationId;
    nodeTitleById[node.id] = node.title.trim() || node.id;
    constellationNodeCounts[node.constellationId] =
      (constellationNodeCounts[node.constellationId] ?? 0) + 1;
  }

  for (const nodeId of options.proposedNodeIds ?? []) {
    existingNodeIds.add(nodeId);
  }

  const policy = options.evolutionPolicy ?? DEFAULT_EVOLUTION_POLICY;

  return {
    canvasModel: model,
    canonState: options.canonState,
    existingNodeIds,
    existingConstellationIds,
    nodeConstellationMap,
    nodeTitleById,
    preservedTargetIds: new Set(options.preservedTargetIds ?? []),
    lockedTargetIds: new Set(options.lockedTargetIds ?? []),
    proposedNodeIds: new Set(options.proposedNodeIds ?? []),
    proposedLabelsByConstellation: new Map(),
    readyAddNodeCount: options.proposedNodeIds?.size ?? 0,
    nodeBudgetRemaining: policy.nodeBudget.maxNewNodesPerBatch,
    maxNodesPerConstellation: policy.nodeBudget.maxNodesPerConstellation,
    constellationNodeCounts,
  };
}

function nodeExists(nodeId: string, context: DryRunContext): boolean {
  return context.existingNodeIds.has(nodeId) || context.proposedNodeIds.has(nodeId);
}

function getOverlay(model: EvolutionAwareCanvasModel): CanvasEvolutionOverlay {
  return model.evolutionOverlay ?? emptyOverlay();
}

function setOverlay(model: EvolutionAwareCanvasModel, overlay: CanvasEvolutionOverlay): void {
  model.evolutionOverlay = overlay;
}

function uniquePush(list: string[], value: string): string[] {
  if (list.includes(value)) return list;
  return [...list, value];
}

function removeFromList(list: string[], value: string): string[] {
  return list.filter((item) => item !== value);
}

function createReversePatchPlaceholder(
  patch: EvolutionCanvasPatchCandidate,
  beforeSnapshot: unknown,
): EvolutionCanvasPatchCandidate {
  return {
    id: `reverse_${patch.id}`,
    patchType: "no_op",
    target: patch.target,
    sourceActionId: patch.sourceActionId,
    sourceOperationId: patch.sourceOperationId,
    reason: `Reverse placeholder for ${patch.patchType}`,
    status: "ready",
    reversible: true,
    requiresConfirmation: false,
    previewSummary: `Undo placeholder for ${patch.patchType} on ${patch.target.id}`,
    payload: { beforeSnapshot },
  };
}

function selectPatchesForApply(input: WorldEvolutionApplyInput): {
  selected: EvolutionCanvasPatchCandidate[];
  skipped: FailedEvolutionPatch[];
} {
  const skipped: FailedEvolutionPatch[] = [];
  const selected: EvolutionCanvasPatchCandidate[] = [];
  const selectedIds = input.selectedPatchIds ? new Set(input.selectedPatchIds) : null;
  const confirmedIds = new Set(input.confirmedPatchIds ?? []);

  for (const patch of input.dryRun.patchCandidates) {
    if (patch.patchType === "no_op") {
      skipped.push({
        patchId: patch.id,
        patchType: patch.patchType,
        sourceActionId: patch.sourceActionId,
        targetId: patch.target.id,
        reason: patch.reason,
        stopReason: "no_op_patch",
        recoverable: false,
      });
      continue;
    }

    if (patch.status === "blocked") {
      skipped.push({
        patchId: patch.id,
        patchType: patch.patchType,
        sourceActionId: patch.sourceActionId,
        targetId: patch.target.id,
        reason: patch.reason,
        stopReason: "blocked_patch",
        recoverable: false,
      });
      continue;
    }

    if (patch.status === "needs_review") {
      const allowed =
        input.allowNeedsReviewPatches === true &&
        (selectedIds ? selectedIds.has(patch.id) : true) &&
        (patch.requiresConfirmation ? confirmedIds.has(patch.id) || confirmedIds.size === 0 : true);

      if (!allowed) {
        skipped.push({
          patchId: patch.id,
          patchType: patch.patchType,
          sourceActionId: patch.sourceActionId,
          targetId: patch.target.id,
          reason: patch.reason,
          stopReason: "needs_review_not_confirmed",
          recoverable: true,
        });
        continue;
      }
    }

    if (patch.status === "ready" || patch.status === "needs_review") {
      if (selectedIds && !selectedIds.has(patch.id)) {
        skipped.push({
          patchId: patch.id,
          patchType: patch.patchType,
          sourceActionId: patch.sourceActionId,
          targetId: patch.target.id,
          reason: patch.reason,
          stopReason: "not_selected",
          recoverable: true,
        });
        continue;
      }
      selected.push(patch);
    }
  }

  return { selected: sortPatches(selected), skipped };
}

function applyTimeCanonBlock(
  patch: EvolutionCanvasPatchCandidate,
  context: DryRunContext,
): FailedEvolutionPatch | null {
  const targetId = patch.target.id;

  if (patch.patchType === "archive_node") {
    if (isCanonTruth(targetId, context.canonState)) {
      return {
        patchId: patch.id,
        patchType: patch.patchType,
        sourceActionId: patch.sourceActionId,
        targetId,
        reason: patch.reason,
        stopReason: "canon_protection",
        recoverable: false,
      };
    }
    if (context.preservedTargetIds.has(targetId) || context.lockedTargetIds.has(targetId)) {
      return {
        patchId: patch.id,
        patchType: patch.patchType,
        sourceActionId: patch.sourceActionId,
        targetId,
        reason: patch.reason,
        stopReason: "canon_protection",
        recoverable: false,
      };
    }
  }

  if (
    (patch.patchType === "mark_node_weakened" || patch.patchType === "mark_node_strengthened") &&
    context.lockedTargetIds.has(targetId)
  ) {
    return {
      patchId: patch.id,
      patchType: patch.patchType,
      sourceActionId: patch.sourceActionId,
      targetId,
      reason: patch.reason,
      stopReason: "canon_protection",
      recoverable: false,
    };
  }

  return null;
}

function applyAddNode(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
  context: DryRunContext,
): { nodeId: string; before: unknown; after: unknown } {
  const constellationId = patch.target.constellationId;
  if (!constellationId) {
    throw new Error("add_node requires constellationId");
  }

  const label =
    (typeof patch.payload?.proposedLabel === "string" && patch.payload.proposedLabel) ||
    (typeof patch.payload?.title === "string" && patch.payload.title) ||
    patch.target.id;

  let nodeId = patch.target.id;
  if (context.existingNodeIds.has(nodeId)) {
    const anchor =
      (typeof patch.payload?.continuationAnchor === "string" && patch.payload.continuationAnchor) ||
      label;
    nodeId = deterministicNodeId(patch.sourceActionId, anchor);
    if (context.existingNodeIds.has(nodeId)) {
      throw new Error("id_collision");
    }
  }

  const before = { nodes: model.nodes.length, constellationNodeIds: [...(model.constellations.find((c) => c.id === constellationId)?.nodeIds ?? [])] };

  const newNode: CanvasNode = {
    id: nodeId,
    title: label.trim() || nodeId,
    description:
      (typeof patch.payload?.description === "string" && patch.payload.description) ||
      `Evolution-generated node: ${label}`,
    constellationId,
    generatedByAgentId:
      (typeof patch.payload?.generatedByAgentId === "string" && patch.payload.generatedByAgentId) ||
      "evolution_apply",
    whyPromising:
      (typeof patch.payload?.whyPromising === "string" && patch.payload.whyPromising) ||
      patch.reason,
    risk: (typeof patch.payload?.risk === "string" && patch.payload.risk) || "medium",
    explorationQuestions: Array.isArray(patch.payload?.explorationQuestions)
      ? (patch.payload.explorationQuestions as string[])
      : [],
    nodeType: (typeof patch.payload?.nodeType === "string" && patch.payload.nodeType) || "concept",
    status: "potential",
    aiGenerated: true,
  };

  model.nodes = [...model.nodes, newNode];
  model.constellations = model.constellations.map((constellation) =>
    constellation.id === constellationId
      ? { ...constellation, nodeIds: uniquePush(constellation.nodeIds, nodeId) }
      : constellation,
  );

  context.existingNodeIds.add(nodeId);
  context.proposedNodeIds.add(nodeId);
  context.nodeConstellationMap[nodeId] = constellationId;
  context.nodeTitleById[nodeId] = newNode.title;
  context.constellationNodeCounts[constellationId] =
    (context.constellationNodeCounts[constellationId] ?? 0) + 1;

  return {
    nodeId,
    before,
    after: { node: newNode, constellationId },
  };
}

function applyUpdateNodeMetadata(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
): { before: unknown; after: unknown } {
  const nodeIndex = model.nodes.findIndex((node) => node.id === patch.target.id);
  if (nodeIndex < 0) throw new Error("target_not_found");

  const beforeNode = { ...model.nodes[nodeIndex] };
  const payload = patch.payload ?? {};
  const updates: Partial<CanvasNode> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (SAFE_NODE_METADATA_FIELDS.has(key)) {
      (updates as Record<string, unknown>)[key] = value;
    }
  }

  const updatedNode: CanvasNode = {
    ...model.nodes[nodeIndex],
    ...updates,
    id: beforeNode.id,
    constellationId: beforeNode.constellationId,
    status: "potential",
    aiGenerated: true,
  };

  model.nodes = model.nodes.map((node, index) => (index === nodeIndex ? updatedNode : node));

  return { before: beforeNode, after: updatedNode };
}

function applyUpdateNodeStatus(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
): { before: unknown; after: unknown } {
  const overlay = getOverlay(model);
  const before = { ...overlay.nodeEvolutionMetadata[patch.target.id] };
  const statusPayload =
    patch.payload && typeof patch.payload === "object" ? { ...patch.payload } : { status: patch.reason };

  overlay.nodeEvolutionMetadata = {
    ...overlay.nodeEvolutionMetadata,
    [patch.target.id]: {
      ...overlay.nodeEvolutionMetadata[patch.target.id],
      ...statusPayload,
    },
  };
  setOverlay(model, overlay);

  return {
    before,
    after: overlay.nodeEvolutionMetadata[patch.target.id],
  };
}

function applyArchiveNode(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
): { before: unknown; after: unknown } {
  const node = model.nodes.find((item) => item.id === patch.target.id);
  if (!node) throw new Error("target_not_found");

  const overlay = getOverlay(model);
  const before = {
    archivedNodeIds: [...overlay.archivedNodeIds],
    nodeCount: model.nodes.length,
    constellationNodeIds: model.constellations.find((c) => c.id === node.constellationId)?.nodeIds ?? [],
  };

  overlay.archivedNodeIds = uniquePush(overlay.archivedNodeIds, patch.target.id);
  overlay.weakenedNodeIds = removeFromList(overlay.weakenedNodeIds, patch.target.id);
  overlay.strengthenedNodeIds = removeFromList(overlay.strengthenedNodeIds, patch.target.id);
  overlay.nodeEvolutionMetadata = {
    ...overlay.nodeEvolutionMetadata,
    [patch.target.id]: {
      ...overlay.nodeEvolutionMetadata[patch.target.id],
      archived: true,
      archiveReason: patch.reason,
    },
  };
  setOverlay(model, overlay);

  return {
    before,
    after: {
      archivedNodeIds: overlay.archivedNodeIds,
      nodeStillPresent: model.nodes.some((item) => item.id === patch.target.id),
    },
  };
}

function applyMarkNodeWeakened(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
): { before: unknown; after: unknown } {
  const overlay = getOverlay(model);
  const before = {
    weakenedNodeIds: [...overlay.weakenedNodeIds],
    metadata: { ...overlay.nodeEvolutionMetadata[patch.target.id] },
  };

  overlay.weakenedNodeIds = uniquePush(overlay.weakenedNodeIds, patch.target.id);
  overlay.strengthenedNodeIds = removeFromList(overlay.strengthenedNodeIds, patch.target.id);
  overlay.nodeEvolutionMetadata = {
    ...overlay.nodeEvolutionMetadata,
    [patch.target.id]: {
      ...overlay.nodeEvolutionMetadata[patch.target.id],
      weakened: true,
      weakenReason: patch.reason,
      evolutionPriority: -1,
    },
  };
  setOverlay(model, overlay);

  return { before, after: { weakenedNodeIds: overlay.weakenedNodeIds, metadata: overlay.nodeEvolutionMetadata[patch.target.id] } };
}

function applyMarkNodeStrengthened(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
): { before: unknown; after: unknown } {
  const overlay = getOverlay(model);
  const before = {
    strengthenedNodeIds: [...overlay.strengthenedNodeIds],
    metadata: { ...overlay.nodeEvolutionMetadata[patch.target.id] },
  };

  overlay.strengthenedNodeIds = uniquePush(overlay.strengthenedNodeIds, patch.target.id);
  overlay.weakenedNodeIds = removeFromList(overlay.weakenedNodeIds, patch.target.id);
  overlay.nodeEvolutionMetadata = {
    ...overlay.nodeEvolutionMetadata,
    [patch.target.id]: {
      ...overlay.nodeEvolutionMetadata[patch.target.id],
      strengthened: true,
      strengthenReason: patch.reason,
      evolutionPriority: 1,
    },
  };
  setOverlay(model, overlay);

  return { before, after: { strengthenedNodeIds: overlay.strengthenedNodeIds, metadata: overlay.nodeEvolutionMetadata[patch.target.id] } };
}

function applyUpdateConstellationMetadata(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
): { before: unknown; after: unknown } {
  const constellationIndex = model.constellations.findIndex((item) => item.id === patch.target.id);
  if (constellationIndex < 0) throw new Error("target_not_found");

  const beforeConstellation = { ...model.constellations[constellationIndex] };
  const payload = patch.payload ?? {};
  const updates: Partial<CanvasConstellation> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (SAFE_CONSTELLATION_METADATA_FIELDS.has(key)) {
      (updates as Record<string, unknown>)[key] = value;
    }
  }

  if (typeof payload.focusShift === "string" && payload.focusShift.trim()) {
    updates.description = `${beforeConstellation.description}\nFocus shift: ${payload.focusShift}`.trim();
  }

  if (typeof payload.priorityDelta === "number") {
    updates.priority = beforeConstellation.priority + payload.priorityDelta;
  }

  const updatedConstellation: CanvasConstellation = {
    ...beforeConstellation,
    ...updates,
    id: beforeConstellation.id,
    nodeIds: [...beforeConstellation.nodeIds],
    agentIds: [...beforeConstellation.agentIds],
  };

  model.constellations = model.constellations.map((item, index) =>
    index === constellationIndex ? updatedConstellation : item,
  );

  const overlay = getOverlay(model);
  overlay.constellationMetadata = {
    ...overlay.constellationMetadata,
    [patch.target.id]: {
      ...overlay.constellationMetadata[patch.target.id],
      ...payload,
    },
  };
  setOverlay(model, overlay);

  return { before: beforeConstellation, after: updatedConstellation };
}

function applyAddEdge(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
  context: DryRunContext,
): { before: unknown; after: unknown } {
  const [fromId, toId] = patch.target.endpointIds ?? ["", ""];
  if (!fromId || !toId || !nodeExists(fromId, context) || !nodeExists(toId, context)) {
    throw new Error("endpoint_missing");
  }

  const overlay = getOverlay(model);
  const edgeId = patch.target.id || `${fromId}->${toId}`;
  const before = { edges: [...overlay.edges] };

  const edge: EvolutionEdgeRecord = {
    id: edgeId,
    fromId,
    toId,
    ...(patch.target.constellationId ? { constellationId: patch.target.constellationId } : {}),
    ...(patch.payload ? { metadata: { ...patch.payload } } : {}),
  };

  overlay.edges = [...overlay.edges.filter((item) => item.id !== edgeId), edge];
  setOverlay(model, overlay);

  return { before, after: edge };
}

function applyUpdateEdgeMetadata(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
): { before: unknown; after: unknown } {
  const overlay = getOverlay(model);
  const edgeIndex = overlay.edges.findIndex((edge) => edge.id === patch.target.id);
  if (edgeIndex < 0) throw new Error("target_not_found");

  const beforeEdge = { ...overlay.edges[edgeIndex] };
  const updatedEdge: EvolutionEdgeRecord = {
    ...beforeEdge,
    metadata: {
      ...(beforeEdge.metadata ?? {}),
      ...(patch.payload ?? {}),
    },
  };

  overlay.edges = overlay.edges.map((edge, index) => (index === edgeIndex ? updatedEdge : edge));
  setOverlay(model, overlay);

  return { before: beforeEdge, after: updatedEdge };
}

function executePatch(
  model: EvolutionAwareCanvasModel,
  patch: EvolutionCanvasPatchCandidate,
  context: DryRunContext,
): AppliedEvolutionPatch {
  if (patch.patchType === "no_op") {
    throw new Error("no_op_not_applicable");
  }

  if (!nodeExists(patch.target.id, context) && patch.patchType !== "add_node" && patch.patchType !== "add_edge" && patch.patchType !== "update_constellation_metadata" && patch.patchType !== "update_edge_metadata") {
    if (patch.patchType === "archive_node" || patch.patchType === "mark_node_weakened" || patch.patchType === "mark_node_strengthened" || patch.patchType === "update_node_metadata" || patch.patchType === "update_node_status") {
      throw new Error("target_not_found");
    }
  }

  let result: { before: unknown; after: unknown; targetId?: string };

  switch (patch.patchType) {
    case "add_node":
      result = applyAddNode(model, patch, context);
      break;
    case "update_node_metadata":
      result = applyUpdateNodeMetadata(model, patch);
      break;
    case "update_node_status":
      result = applyUpdateNodeStatus(model, patch);
      break;
    case "archive_node":
      result = applyArchiveNode(model, patch);
      break;
    case "mark_node_weakened":
      result = applyMarkNodeWeakened(model, patch);
      break;
    case "mark_node_strengthened":
      result = applyMarkNodeStrengthened(model, patch);
      break;
    case "update_constellation_metadata":
      result = applyUpdateConstellationMetadata(model, patch);
      break;
    case "add_edge":
      result = applyAddEdge(model, patch, context);
      break;
    case "update_edge_metadata":
      result = applyUpdateEdgeMetadata(model, patch);
      break;
    default:
      throw new Error(`unsupported_patch_type:${patch.patchType}`);
  }

  const appliedAt = new Date().toISOString();
  const targetId = result.targetId ?? patch.target.id;

  return {
    patchId: patch.id,
    patchType: patch.patchType,
    sourceActionId: patch.sourceActionId,
    targetId,
    reason: patch.reason,
    beforeSnapshot: result.before,
    afterSnapshot: result.after,
    reversePatch: createReversePatchPlaceholder(patch, result.before),
    appliedAt,
  };
}

function buildFailureResult(
  input: WorldEvolutionApplyInput,
  originalCanvas: CanvasWorldModel,
  options: {
    status: WorldEvolutionApplyStatus;
    summary: string;
    failedPatches: FailedEvolutionPatch[];
    skippedPatches: FailedEvolutionPatch[];
    appliedPatches?: AppliedEvolutionPatch[];
    startedAt: string;
    completedAt: string;
  },
): WorldEvolutionApplyResult {
  const planId = input.planId ?? input.dryRun.planId;
  const triggerEventId = input.triggerEventId ?? "unknown_trigger";
  const batchId = `evo_batch_${planId}_${Date.now()}`;

  const mutationBatch: EvolutionMutationBatch = {
    id: batchId,
    planId,
    triggerEventId,
    patchIds: options.appliedPatches?.map((patch) => patch.patchId) ?? [],
    appliedCount: options.appliedPatches?.length ?? 0,
    failedCount: options.failedPatches.length,
    skippedCount: options.skippedPatches.length,
    atomic: input.policy?.atomic ?? DEFAULT_EVOLUTION_APPLY_POLICY.atomic,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
  };

  const historyEntry: EvolutionHistoryEntry = {
    id: `evo_history_${batchId}`,
    planId,
    dryRunPlanId: input.dryRun.planId,
    triggerEventId,
    applyResultStatus: options.status,
    appliedPatchIds: options.appliedPatches?.map((patch) => patch.patchId) ?? [],
    failedPatchIds: options.failedPatches.map((patch) => patch.patchId),
    summary: options.summary,
    undoAvailable: false,
    timestamp: options.completedAt,
  };

  return {
    planId,
    dryRunId: input.dryRun.planId,
    status: options.status,
    appliedPatches: options.appliedPatches ?? [],
    failedPatches: options.failedPatches,
    skippedPatches: options.skippedPatches,
    mutationBatch,
    historyEntry,
    summary: options.summary,
    canvasModel: cloneCanvasWithOverlay(originalCanvas),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────────

export function applyWorldEvolutionPatches(input: WorldEvolutionApplyInput): WorldEvolutionApplyResult {
  const startedAt = new Date().toISOString();
  const originalCanvas = input.canvasModel;
  const policy = input.policy ?? DEFAULT_EVOLUTION_APPLY_POLICY;

  if (!input.confirmed) {
    return buildFailureResult(input, originalCanvas, {
      status: "cancelled",
      summary: "Apply cancelled — explicit confirmation was not provided.",
      failedPatches: [],
      skippedPatches: [],
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  if (input.dryRun.status === "failed" || input.dryRun.status === "blocked") {
    return buildFailureResult(input, originalCanvas, {
      status: "failed",
      summary: `Apply blocked — dry-run status is ${input.dryRun.status}.`,
      failedPatches: [],
      skippedPatches: [],
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  const currentFingerprint =
    input.currentCanvasFingerprint ?? createCanvasEvolutionFingerprint(input.canvasModel);

  if (
    input.dryRun.canvasFingerprint &&
    input.dryRun.canvasFingerprint !== currentFingerprint
  ) {
    return buildFailureResult(input, originalCanvas, {
      status: "failed",
      summary: "Dry run is stale. Refresh evolution preview before applying.",
      failedPatches: [
        {
          patchId: "stale_dry_run",
          patchType: "no_op",
          sourceActionId: "staleness_guard",
          reason: "Canvas changed since dry-run was computed.",
          stopReason: "stale_dry_run",
          recoverable: true,
        },
      ],
      skippedPatches: [],
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  const { selected, skipped } = selectPatchesForApply(input);

  if (selected.length === 0) {
    return buildFailureResult(input, originalCanvas, {
      status: "empty",
      summary: "No eligible patches selected for apply.",
      failedPatches: [],
      skippedPatches: skipped,
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  if (policy.maxPatchesPerBatch !== undefined && selected.length > policy.maxPatchesPerBatch) {
    return buildFailureResult(input, originalCanvas, {
      status: "failed",
      summary: `Apply blocked — ${selected.length} patches exceeds maxPatchesPerBatch (${policy.maxPatchesPerBatch}).`,
      failedPatches: [
        {
          patchId: "batch_limit",
          patchType: "no_op",
          sourceActionId: "batch",
          reason: "Batch limit exceeded",
          stopReason: "policy_limit",
          recoverable: true,
        },
      ],
      skippedPatches: skipped,
      startedAt,
      completedAt: new Date().toISOString(),
    });
  }

  const workingModel = cloneCanvasWithOverlay(originalCanvas);
  const proposedNodeIds = new Set<string>();
  const context = buildApplyDryRunContext(workingModel, {
    canonState: input.canonState,
    preservedTargetIds: input.preservedTargetIds,
    lockedTargetIds: input.lockedTargetIds,
    evolutionPolicy: input.evolutionPolicy,
    proposedNodeIds,
  });

  const appliedPatches: AppliedEvolutionPatch[] = [];
  const failedPatches: FailedEvolutionPatch[] = [];

  for (const patch of selected) {
    const validation = validatePatchCandidate(patch, context);
    if (validation.status === "blocked") {
      failedPatches.push({
        patchId: patch.id,
        patchType: patch.patchType,
        sourceActionId: patch.sourceActionId,
        targetId: patch.target.id,
        reason: patch.reason,
        stopReason: validation.blockers[0]?.kind ?? "validation",
        recoverable: false,
      });
      if (policy.atomic) break;
      continue;
    }

    const canonBlock = applyTimeCanonBlock(patch, context);
    if (canonBlock) {
      failedPatches.push(canonBlock);
      if (policy.atomic) break;
      continue;
    }

    try {
      const applied = executePatch(workingModel, patch, context);
      appliedPatches.push(applied);
      if (applied.patchType === "add_node") {
        proposedNodeIds.add(applied.targetId);
        context.proposedNodeIds.add(applied.targetId);
      }
    } catch (error) {
      failedPatches.push({
        patchId: patch.id,
        patchType: patch.patchType,
        sourceActionId: patch.sourceActionId,
        targetId: patch.target.id,
        reason: patch.reason,
        stopReason: error instanceof Error ? error.message : "internal_validation",
        recoverable: false,
      });
      if (policy.atomic) break;
    }
  }

  const completedAt = new Date().toISOString();

  if (failedPatches.length > 0 && policy.atomic) {
    return buildFailureResult(input, originalCanvas, {
      status: "failed",
      summary: `Apply failed atomically — ${failedPatches.length} patch(es) failed; canvas unchanged.`,
      failedPatches,
      skippedPatches: skipped,
      appliedPatches: [],
      startedAt,
      completedAt,
    });
  }

  if (failedPatches.length > 0 && !policy.atomic) {
    const planId = input.planId ?? input.dryRun.planId;
    const triggerEventId = input.triggerEventId ?? "unknown_trigger";
    const batchId = `evo_batch_${planId}_${Date.now()}`;
    const undoSnapshot: EvolutionUndoSnapshot = {
      batchId,
      canvasModelBefore: deepCloneCanvas(originalCanvas),
      canvasModelAfter: cloneCanvasWithOverlay(workingModel),
      inversePatches: appliedPatches.map((patch) => patch.reversePatch),
      capturedAt: completedAt,
    };

    const historyEntry: EvolutionHistoryEntry = {
      id: `evo_history_${batchId}`,
      planId,
      dryRunPlanId: input.dryRun.planId,
      triggerEventId,
      applyResultStatus: "partially_applied",
      appliedPatchIds: appliedPatches.map((patch) => patch.patchId),
      failedPatchIds: failedPatches.map((patch) => patch.patchId),
      summary: `Partially applied ${appliedPatches.length} patch(es); ${failedPatches.length} failed.`,
      undoSnapshot,
      undoAvailable: true,
      timestamp: completedAt,
    };

    return {
      planId,
      dryRunId: input.dryRun.planId,
      status: "partially_applied",
      appliedPatches,
      failedPatches,
      skippedPatches: skipped,
      mutationBatch: {
        id: batchId,
        planId,
        triggerEventId,
        patchIds: appliedPatches.map((patch) => patch.patchId),
        appliedCount: appliedPatches.length,
        failedCount: failedPatches.length,
        skippedCount: skipped.length,
        atomic: false,
        startedAt,
        completedAt,
      },
      historyEntry,
      summary: historyEntry.summary,
      canvasModel: workingModel,
    };
  }

  const planId = input.planId ?? input.dryRun.planId;
  const triggerEventId = input.triggerEventId ?? "unknown_trigger";
  const batchId = `evo_batch_${planId}_${Date.now()}`;
  const undoSnapshot: EvolutionUndoSnapshot = {
    batchId,
    canvasModelBefore: deepCloneCanvas(originalCanvas),
    canvasModelAfter: cloneCanvasWithOverlay(workingModel),
    inversePatches: appliedPatches.map((patch) => patch.reversePatch),
    capturedAt: completedAt,
  };

  const historyEntry: EvolutionHistoryEntry = {
    id: `evo_history_${batchId}`,
    planId,
    dryRunPlanId: input.dryRun.planId,
    triggerEventId,
    applyResultStatus: "applied",
    appliedPatchIds: appliedPatches.map((patch) => patch.patchId),
    failedPatchIds: [],
    summary: `Applied ${appliedPatches.length} evolution patch(es) to canvas.`,
    undoSnapshot,
    undoAvailable: true,
    timestamp: completedAt,
  };

  return {
    planId,
    dryRunId: input.dryRun.planId,
    status: "applied",
    appliedPatches,
    failedPatches: [],
    skippedPatches: skipped,
    mutationBatch: {
      id: batchId,
      planId,
      triggerEventId,
      patchIds: appliedPatches.map((patch) => patch.patchId),
      appliedCount: appliedPatches.length,
      failedCount: 0,
      skippedCount: skipped.length,
      atomic: policy.atomic,
      startedAt,
      completedAt,
    },
    historyEntry,
    summary: historyEntry.summary,
    canvasModel: workingModel,
  };
}

// ── Undo helpers (Phase 5.5C) ─────────────────────────────────────────────────────

export function extractEvolutionOverlayFromModel(
  model: CanvasWorldModel,
): CanvasEvolutionOverlay {
  return mergeOverlay((model as EvolutionAwareCanvasModel).evolutionOverlay);
}

export function findLatestUndoableEvolutionHistoryEntry(
  entries: EvolutionHistoryEntry[],
): EvolutionHistoryEntry | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (
      entry.undoAvailable &&
      entry.applyResultStatus === "applied" &&
      entry.undoSnapshot?.canvasModelBefore
    ) {
      return entry;
    }
  }
  return null;
}

export function markEvolutionHistoryEntryUndone(
  entries: EvolutionHistoryEntry[],
  entryId: string,
  undoneAt: string,
): EvolutionHistoryEntry[] {
  return entries.map((entry) =>
    entry.id === entryId
      ? { ...entry, undoAvailable: false, undoneAt }
      : entry,
  );
}

export function computeEvolutionOverlayBatchDelta(
  beforeModel: CanvasWorldModel,
  afterModel: CanvasWorldModel,
): {
  weakenedAdded: string[];
  archivedAdded: string[];
  nodesAdded: string[];
} {
  const beforeOverlay = extractEvolutionOverlayFromModel(beforeModel);
  const afterOverlay = extractEvolutionOverlayFromModel(afterModel);
  const beforeNodeIds = new Set(beforeModel.nodes.map((node) => node.id));
  const afterNodeIds = afterModel.nodes.map((node) => node.id);

  return {
    weakenedAdded: afterOverlay.weakenedNodeIds.filter(
      (id) => !beforeOverlay.weakenedNodeIds.includes(id),
    ),
    archivedAdded: afterOverlay.archivedNodeIds.filter(
      (id) => !beforeOverlay.archivedNodeIds.includes(id),
    ),
    nodesAdded: afterNodeIds.filter((id) => !beforeNodeIds.has(id)),
  };
}

/**
 * World Evolution Engine — guarded apply dry-run (Phase 5.3).
 *
 * Converts ready WorldEvolutionActions into declarative canvas patch candidates.
 * Pure functions only — no React, no API, no LLM, no canvas mutation.
 */

import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import type { CanonStateSnapshot } from "@/lib/worldBrain/userDecisionTypes";
import type {
  ConstellationEvolutionAction,
  NodeEvolutionAction,
  WorldEvolutionAction,
  WorldEvolutionPlan,
} from "@/lib/worldBrain/worldEvolutionPlan";

// ── Patch types ───────────────────────────────────────────────────────────────────

export type EvolutionCanvasPatchType =
  | "add_node"
  | "update_node_metadata"
  | "update_node_status"
  | "archive_node"
  | "add_edge"
  | "update_edge_metadata"
  | "update_constellation_metadata"
  | "mark_node_weakened"
  | "mark_node_strengthened"
  | "no_op";

export type EvolutionCanvasPatchStatus = "ready" | "blocked" | "needs_review";

export type EvolutionPatchTargetType = "node" | "constellation" | "edge";

export type EvolutionPatchTarget = {
  targetType: EvolutionPatchTargetType;
  id: string;
  constellationId?: string;
  parentNodeId?: string;
  endpointIds?: [string, string];
};

export type EvolutionCanvasPatchCandidate = {
  id: string;
  patchType: EvolutionCanvasPatchType;
  target: EvolutionPatchTarget;
  sourceActionId: string;
  sourceOperationId: string;
  reason: string;
  status: EvolutionCanvasPatchStatus;
  reversible: boolean;
  requiresConfirmation: boolean;
  previewSummary: string;
  payload?: Record<string, unknown>;
};

export type WorldEvolutionApplyDryRunStatus =
  | "empty"
  | "ready_for_confirmation"
  | "needs_review"
  | "blocked"
  | "failed";

export type EvolutionApplyDryRunBlockerKind =
  | "canon_protection"
  | "validation"
  | "node_budget"
  | "policy"
  | "action_not_ready"
  | "plan_state";

export type EvolutionApplyDryRunBlocker = {
  id: string;
  kind: EvolutionApplyDryRunBlockerKind;
  message: string;
  sourceActionId?: string;
  patchId?: string;
  targetId?: string;
};

export type EvolutionApplyDryRunWarning = {
  id: string;
  message: string;
  sourceActionId?: string;
  patchId?: string;
  warningType?: string;
};

export type EvolutionPatchPreviewSummary = {
  totalCandidates: number;
  readyCount: number;
  blockedCount: number;
  needsReviewCount: number;
  confirmationRequiredCount: number;
  reversibleCount: number;
  patchTypes: EvolutionCanvasPatchType[];
};

export type EvolutionDryRunValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type WorldEvolutionApplyDryRunInput = {
  plan: WorldEvolutionPlan;
  canvasModel?: CanvasWorldModel | null;
  canonState?: CanonStateSnapshot;
  existingNodeIds?: string[];
  existingConstellationIds?: string[];
  nodeConstellationMap?: Record<string, string>;
  nodeTitleById?: Record<string, string>;
  preservedTargetIds?: string[];
  lockedTargetIds?: string[];
  /** Optional subset of evolution action ids to dry-run. */
  selectedActionIds?: string[];
};

export type WorldEvolutionApplyDryRunResult = {
  planId: string;
  status: WorldEvolutionApplyDryRunStatus;
  summary: string;
  patchCandidates: EvolutionCanvasPatchCandidate[];
  readyPatches: EvolutionCanvasPatchCandidate[];
  blockedPatches: EvolutionCanvasPatchCandidate[];
  blockers: EvolutionApplyDryRunBlocker[];
  warnings: EvolutionApplyDryRunWarning[];
  patchSummary: EvolutionPatchPreviewSummary;
  validation: EvolutionDryRunValidationResult;
  /** Fingerprint of the canvas snapshot used for this dry-run (Phase 5.5D). */
  canvasFingerprint: string;
  createdAt: string;
  sourcePlanId: string;
};

type CanvasEvolutionOverlayLike = {
  archivedNodeIds?: string[];
  weakenedNodeIds?: string[];
  strengthenedNodeIds?: string[];
  edges?: Array<{ id: string; fromId: string; toId: string }>;
};

type CanvasWithEvolutionOverlay = CanvasWorldModel & {
  evolutionOverlay?: CanvasEvolutionOverlayLike;
};

export type DryRunContext = {
  canvasModel?: CanvasWorldModel | null;
  canonState?: CanonStateSnapshot;
  existingNodeIds: Set<string>;
  existingConstellationIds: Set<string>;
  nodeConstellationMap: Record<string, string>;
  nodeTitleById: Record<string, string>;
  preservedTargetIds: Set<string>;
  lockedTargetIds: Set<string>;
  proposedNodeIds: Set<string>;
  proposedLabelsByConstellation: Map<string, Set<string>>;
  readyAddNodeCount: number;
  nodeBudgetRemaining: number;
  maxNodesPerConstellation: number;
  constellationNodeCounts: Record<string, number>;
};

// ── Canvas fingerprint (Phase 5.5D) ───────────────────────────────────────────────

export function createCanvasEvolutionFingerprint(
  canvasModel: CanvasWorldModel | null | undefined,
): string {
  if (!canvasModel) return "no_canvas";

  const overlay = (canvasModel as CanvasWithEvolutionOverlay).evolutionOverlay;
  const payload = {
    nodes: [...canvasModel.nodes]
      .map((node) => ({
        id: node.id,
        title: node.title.trim(),
        constellationId: node.constellationId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    constellations: [...canvasModel.constellations]
      .map((constellation) => ({
        id: constellation.id,
        nodeIds: [...constellation.nodeIds].sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    overlay: overlay
      ? {
          archivedNodeIds: [...(overlay.archivedNodeIds ?? [])].sort(),
          weakenedNodeIds: [...(overlay.weakenedNodeIds ?? [])].sort(),
          strengthenedNodeIds: [...(overlay.strengthenedNodeIds ?? [])].sort(),
          edges: [...(overlay.edges ?? [])]
            .map((edge) => ({ id: edge.id, fromId: edge.fromId, toId: edge.toId }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        }
      : undefined,
  };

  return JSON.stringify(payload);
}

export function createDryRunSnapshotFingerprint(
  input: WorldEvolutionApplyDryRunInput,
): string {
  return JSON.stringify({
    canvas: createCanvasEvolutionFingerprint(input.canvasModel),
    planId: input.plan.id,
  });
}

function buildDryRunSnapshotMetadata(input: WorldEvolutionApplyDryRunInput): {
  canvasFingerprint: string;
  createdAt: string;
  sourcePlanId: string;
} {
  return {
    canvasFingerprint: createCanvasEvolutionFingerprint(input.canvasModel),
    createdAt: new Date().toISOString(),
    sourcePlanId: input.plan.id,
  };
}

// ── Factory helpers ─────────────────────────────────────────────────────────────

export function createDryRunBlocker(
  kind: EvolutionApplyDryRunBlockerKind,
  message: string,
  options: {
    id?: string;
    sourceActionId?: string;
    patchId?: string;
    targetId?: string;
  } = {},
): EvolutionApplyDryRunBlocker {
  const suffix = options.sourceActionId ?? options.patchId ?? options.targetId ?? "global";
  return {
    id: options.id ?? `dry_run_blocker_${kind}_${suffix}`,
    kind,
    message,
    ...(options.sourceActionId !== undefined ? { sourceActionId: options.sourceActionId } : {}),
    ...(options.patchId !== undefined ? { patchId: options.patchId } : {}),
    ...(options.targetId !== undefined ? { targetId: options.targetId } : {}),
  };
}

export function createDryRunWarning(
  message: string,
  options: {
    id?: string;
    sourceActionId?: string;
    patchId?: string;
    warningType?: string;
  } = {},
): EvolutionApplyDryRunWarning {
  return {
    id: options.id ?? `dry_run_warning_${options.sourceActionId ?? options.patchId ?? "global"}`,
    message,
    ...(options.sourceActionId !== undefined ? { sourceActionId: options.sourceActionId } : {}),
    ...(options.patchId !== undefined ? { patchId: options.patchId } : {}),
    ...(options.warningType !== undefined ? { warningType: options.warningType } : {}),
  };
}

// ── Context builders ──────────────────────────────────────────────────────────────

function buildDryRunContext(input: WorldEvolutionApplyDryRunInput): DryRunContext {
  const existingNodeIds = new Set<string>(input.existingNodeIds ?? []);
  const existingConstellationIds = new Set<string>(input.existingConstellationIds ?? []);
  const nodeConstellationMap: Record<string, string> = { ...(input.nodeConstellationMap ?? {}) };
  const nodeTitleById: Record<string, string> = { ...(input.nodeTitleById ?? {}) };
  const constellationNodeCounts: Record<string, number> = {};

  if (input.canvasModel) {
    for (const constellation of input.canvasModel.constellations) {
      existingConstellationIds.add(constellation.id);
      constellationNodeCounts[constellation.id] =
        constellationNodeCounts[constellation.id] ?? constellation.nodeIds.length;
    }
    for (const node of input.canvasModel.nodes) {
      existingNodeIds.add(node.id);
      nodeConstellationMap[node.id] = node.constellationId;
      nodeTitleById[node.id] = nodeTitleById[node.id] ?? (node.title.trim() || node.id);
      constellationNodeCounts[node.constellationId] =
        (constellationNodeCounts[node.constellationId] ?? 0) + 1;
    }
  }

  for (const [nodeId, constellationId] of Object.entries(nodeConstellationMap)) {
    existingNodeIds.add(nodeId);
    if (constellationNodeCounts[constellationId] === undefined) {
      constellationNodeCounts[constellationId] = 0;
    }
  }

  for (const constellationId of existingConstellationIds) {
    if (constellationNodeCounts[constellationId] === undefined) {
      constellationNodeCounts[constellationId] = 0;
    }
  }

  return {
    canvasModel: input.canvasModel,
    canonState: input.canonState,
    existingNodeIds,
    existingConstellationIds,
    nodeConstellationMap,
    nodeTitleById,
    preservedTargetIds: new Set(input.preservedTargetIds ?? []),
    lockedTargetIds: new Set(input.lockedTargetIds ?? []),
    proposedNodeIds: new Set<string>(),
    proposedLabelsByConstellation: new Map<string, Set<string>>(),
    readyAddNodeCount: 0,
    nodeBudgetRemaining: input.plan.nodeBudgetRemaining,
    maxNodesPerConstellation: input.plan.policy.nodeBudget.maxNodesPerConstellation,
    constellationNodeCounts,
  };
}

function nodeExists(nodeId: string, context: DryRunContext): boolean {
  return context.existingNodeIds.has(nodeId) || context.proposedNodeIds.has(nodeId);
}

function constellationExists(constellationId: string, context: DryRunContext): boolean {
  return context.existingConstellationIds.has(constellationId);
}

function isCanonTruth(nodeId: string, context: DryRunContext): boolean {
  return context.canonState?.truthNodeIds.includes(nodeId) ?? false;
}

function isPotentialTruth(nodeId: string, context: DryRunContext): boolean {
  return context.canonState?.potentialNodeIds.includes(nodeId) ?? false;
}

function resolveNodeConstellation(nodeId: string, context: DryRunContext): string | undefined {
  return (
    context.nodeConstellationMap[nodeId] ??
    context.canvasModel?.nodes.find((node) => node.id === nodeId)?.constellationId
  );
}

function hasDuplicateLabel(
  label: string,
  constellationId: string,
  context: DryRunContext,
): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return true;

  const batchLabels = context.proposedLabelsByConstellation.get(constellationId);
  if (batchLabels?.has(normalized)) return true;

  for (const [nodeId, title] of Object.entries(context.nodeTitleById)) {
    const nodeConstellation = resolveNodeConstellation(nodeId, context);
    if (nodeConstellation === constellationId && title.trim().toLowerCase() === normalized) {
      return true;
    }
  }

  return false;
}

function registerReadyAddNode(
  nodeId: string,
  label: string | undefined,
  constellationId: string,
  context: DryRunContext,
): void {
  context.proposedNodeIds.add(nodeId);
  context.readyAddNodeCount += 1;
  if (label?.trim()) {
    const labels =
      context.proposedLabelsByConstellation.get(constellationId) ?? new Set<string>();
    labels.add(label.trim().toLowerCase());
    context.proposedLabelsByConstellation.set(constellationId, labels);
  }
  context.constellationNodeCounts[constellationId] =
    (context.constellationNodeCounts[constellationId] ?? 0) + 1;
}

function makePatchId(actionId: string, patchType: EvolutionCanvasPatchType, suffix = ""): string {
  return `dry_run_patch_${actionId}_${patchType}${suffix ? `_${suffix}` : ""}`;
}

function basePatch(
  action: WorldEvolutionAction,
  patchType: EvolutionCanvasPatchType,
  target: EvolutionPatchTarget,
  status: EvolutionCanvasPatchStatus,
  options: {
    reason?: string;
    previewSummary: string;
    reversible?: boolean;
    requiresConfirmation?: boolean;
    payload?: Record<string, unknown>;
    suffix?: string;
  },
): EvolutionCanvasPatchCandidate {
  return {
    id: makePatchId(action.id, patchType, options.suffix),
    patchType,
    target,
    sourceActionId: action.id,
    sourceOperationId: action.sourceOperationId,
    reason: options.reason ?? action.reason,
    status,
    reversible: options.reversible ?? action.reversible,
    requiresConfirmation:
      options.requiresConfirmation ??
      action.requiresUserConfirmation ??
      action.riskLevel === "high",
    previewSummary: options.previewSummary,
    ...(options.payload !== undefined ? { payload: options.payload } : {}),
  };
}

// ── Patch validation ──────────────────────────────────────────────────────────────

export function validatePatchCandidate(
  candidate: EvolutionCanvasPatchCandidate,
  context: DryRunContext,
): {
  status: EvolutionCanvasPatchStatus;
  blockers: EvolutionApplyDryRunBlocker[];
  warnings: EvolutionApplyDryRunWarning[];
} {
  const blockers: EvolutionApplyDryRunBlocker[] = [];
  const warnings: EvolutionApplyDryRunWarning[] = [];

  if (candidate.status !== "ready") {
    return { status: candidate.status, blockers, warnings };
  }

  switch (candidate.patchType) {
    case "add_node": {
      const constellationId = candidate.target.constellationId;
      const label =
        (typeof candidate.payload?.proposedLabel === "string" && candidate.payload.proposedLabel) ||
        (typeof candidate.payload?.title === "string" && candidate.payload.title) ||
        undefined;

      if (!constellationId || !constellationExists(constellationId, context)) {
        blockers.push(
          createDryRunBlocker("validation", "Target constellation does not exist.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: constellationId,
          }),
        );
      }

      if (!label?.trim()) {
        blockers.push(
          createDryRunBlocker("validation", "add_node requires a proposed node label/title.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }

      if (candidate.target.parentNodeId && !nodeExists(candidate.target.parentNodeId, context)) {
        blockers.push(
          createDryRunBlocker("validation", "Parent node does not exist for add_node.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.parentNodeId,
          }),
        );
      }

      if (constellationId && label && hasDuplicateLabel(label, constellationId, context)) {
        blockers.push(
          createDryRunBlocker("validation", "Duplicate node label in constellation.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }

      if (context.readyAddNodeCount >= context.nodeBudgetRemaining) {
        blockers.push(
          createDryRunBlocker("node_budget", "Node budget exhausted for dry-run batch.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
          }),
        );
      }

      if (context.existingNodeIds.has(candidate.target.id)) {
        blockers.push(
          createDryRunBlocker("validation", "Node id already exists on canvas.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }

      if (constellationId) {
        const current = context.constellationNodeCounts[constellationId] ?? 0;
        if (current + 1 > context.maxNodesPerConstellation) {
          blockers.push(
            createDryRunBlocker("node_budget", "Constellation node cap would be exceeded.", {
              patchId: candidate.id,
              sourceActionId: candidate.sourceActionId,
              targetId: constellationId,
            }),
          );
        }
      }

      break;
    }

    case "update_node_metadata": {
      if (!nodeExists(candidate.target.id, context)) {
        blockers.push(
          createDryRunBlocker("validation", "Target node does not exist.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      } else if (isCanonTruth(candidate.target.id, context)) {
        warnings.push(
          createDryRunWarning("Canon truth node metadata change requires confirmation.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            warningType: "canon_confirmation_required",
          }),
        );
      }
      break;
    }

    case "mark_node_weakened":
    case "mark_node_strengthened": {
      if (!nodeExists(candidate.target.id, context)) {
        blockers.push(
          createDryRunBlocker("validation", "Target node does not exist.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }
      if (!candidate.reason.trim()) {
        blockers.push(
          createDryRunBlocker("validation", "Reason is required for node status patch.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
          }),
        );
      }
      break;
    }

    case "archive_node": {
      if (!nodeExists(candidate.target.id, context)) {
        blockers.push(
          createDryRunBlocker("validation", "Target node does not exist.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }
      if (isCanonTruth(candidate.target.id, context)) {
        blockers.push(
          createDryRunBlocker("canon_protection", "Cannot archive canon truth node.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }
      if (
        context.preservedTargetIds.has(candidate.target.id) ||
        context.lockedTargetIds.has(candidate.target.id)
      ) {
        blockers.push(
          createDryRunBlocker("canon_protection", "Cannot archive preserved or locked node.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }
      if (
        isPotentialTruth(candidate.target.id, context) ||
        candidate.requiresConfirmation
      ) {
        warnings.push(
          createDryRunWarning("Archive requires explicit user confirmation.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            warningType: "confirmation_required",
          }),
        );
      }
      break;
    }

    case "update_constellation_metadata": {
      if (!constellationExists(candidate.target.id, context)) {
        blockers.push(
          createDryRunBlocker("validation", "Target constellation does not exist.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }
      break;
    }

    case "add_edge": {
      const [fromId, toId] = candidate.target.endpointIds ?? ["", ""];
      const fromExists = nodeExists(fromId, context);
      const toExists = nodeExists(toId, context);
      if (!fromExists || !toExists) {
        blockers.push(
          createDryRunBlocker("validation", "Edge endpoints must exist or be proposed in batch.", {
            patchId: candidate.id,
            sourceActionId: candidate.sourceActionId,
            targetId: candidate.target.id,
          }),
        );
      }
      break;
    }

    default:
      break;
  }

  if (blockers.length > 0) {
    return { status: "blocked", blockers, warnings };
  }

  if (warnings.length > 0) {
    return { status: "needs_review", blockers, warnings };
  }

  return { status: "ready", blockers, warnings };
}

// ── Action → patch mapping ─────────────────────────────────────────────────────────

export function mapEvolutionActionToPatchCandidates(
  action: WorldEvolutionAction,
  context: DryRunContext,
): {
  candidates: EvolutionCanvasPatchCandidate[];
  blockers: EvolutionApplyDryRunBlocker[];
  warnings: EvolutionApplyDryRunWarning[];
} {
  const blockers: EvolutionApplyDryRunBlocker[] = [];
  const warnings: EvolutionApplyDryRunWarning[] = [];

  if (action.status !== "ready") {
    blockers.push(
      createDryRunBlocker(
        "action_not_ready",
        `Evolution action ${action.actionType} is ${action.status}; no ready patch produced.`,
        { sourceActionId: action.id },
      ),
    );
    return {
      candidates: [
        basePatch(
          action,
          "no_op",
          {
            targetType: "node",
            id: action.kind === "node" ? action.targetId : action.constellationId,
          },
          action.status === "downgraded" ? "needs_review" : "blocked",
          {
            previewSummary: `No patch applied — action status is ${action.status}.`,
            reversible: false,
            requiresConfirmation: false,
          },
        ),
      ],
      blockers,
      warnings,
    };
  }

  if (action.kind === "constellation") {
    return mapConstellationActionToPatches(action, context);
  }

  return mapNodeActionToPatches(action, context);
}

function mapNodeActionToPatches(
  action: NodeEvolutionAction,
  _context: DryRunContext,
): {
  candidates: EvolutionCanvasPatchCandidate[];
  blockers: EvolutionApplyDryRunBlocker[];
  warnings: EvolutionApplyDryRunWarning[];
} {
  const blockers: EvolutionApplyDryRunBlocker[] = [];
  const warnings: EvolutionApplyDryRunWarning[] = [];
  const constellationId = action.constellationId;
  const target: EvolutionPatchTarget = {
    targetType: "node",
    id: action.targetId,
    ...(constellationId !== undefined ? { constellationId } : {}),
    ...(action.parentNodeId !== undefined ? { parentNodeId: action.parentNodeId } : {}),
  };

  switch (action.actionType) {
    case "generate_node":
      return {
        candidates: [
          basePatch(action, "add_node", target, "ready", {
            previewSummary: `Would add node "${action.proposedLabel ?? action.targetId}" to constellation.`,
            reversible: true,
            requiresConfirmation: true,
            payload: {
              proposedLabel: action.proposedLabel ?? action.targetId,
              continuationAnchor: action.continuationAnchor,
              parentNodeId: action.parentNodeId,
              ...(action.payload ?? {}),
            },
          }),
          ...(action.parentNodeId
            ? [
                basePatch(
                  action,
                  "add_edge",
                  {
                    targetType: "edge",
                    id: `${action.parentNodeId}->${action.targetId}`,
                    endpointIds: [action.parentNodeId, action.targetId],
                    ...(constellationId !== undefined ? { constellationId } : {}),
                  },
                  "ready",
                  {
                    suffix: "edge",
                    previewSummary: `Would connect parent ${action.parentNodeId} to new node ${action.targetId}.`,
                    reversible: true,
                    requiresConfirmation: false,
                  },
                ),
              ]
            : []),
        ],
        blockers: [],
        warnings: [],
      };

    case "weaken_node":
      return {
        candidates: [
          basePatch(action, "mark_node_weakened", target, "ready", {
            previewSummary: `Would mark node ${action.targetId} as weakened (background relevance).`,
            reversible: true,
            requiresConfirmation: action.requiresUserConfirmation,
          }),
        ],
        blockers: [],
        warnings: [],
      };

    case "strengthen_node":
      return {
        candidates: [
          basePatch(action, "mark_node_strengthened", target, "ready", {
            previewSummary: `Would mark node ${action.targetId} as strengthened.`,
            reversible: true,
            requiresConfirmation: action.requiresUserConfirmation,
          }),
        ],
        blockers: [],
        warnings: [],
      };

    case "modify_node":
      return {
        candidates: [
          basePatch(action, "update_node_metadata", target, "ready", {
            previewSummary: `Would update metadata for node ${action.targetId}.`,
            reversible: true,
            requiresConfirmation: action.requiresUserConfirmation,
            payload: action.payload ? { ...action.payload } : undefined,
          }),
        ],
        blockers: [],
        warnings: [],
      };

    case "archive_node":
      return {
        candidates: [
          basePatch(action, "archive_node", target, "ready", {
            previewSummary: `Would archive node ${action.targetId} (reversible, no hard delete).`,
            reversible: true,
            requiresConfirmation: true,
          }),
        ],
        blockers: [],
        warnings: [],
      };

    case "remove_node":
      blockers.push(
        createDryRunBlocker("policy", "Hard remove is not allowed; use archive or weaken.", {
          sourceActionId: action.id,
          targetId: action.targetId,
        }),
      );
      return {
        candidates: [
          basePatch(action, "no_op", target, "blocked", {
            previewSummary: "Hard remove blocked in dry-run.",
            reversible: false,
            requiresConfirmation: true,
          }),
        ],
        blockers,
        warnings: [],
      };

    default:
      blockers.push(
        createDryRunBlocker("policy", `Unsupported ready action type: ${action.actionType}`, {
          sourceActionId: action.id,
        }),
      );
      return {
        candidates: [
          basePatch(action, "no_op", target, "blocked", {
            previewSummary: `Unsupported action ${action.actionType}.`,
            reversible: false,
            requiresConfirmation: false,
          }),
        ],
        blockers,
        warnings: [],
      };
  }
}

function mapConstellationActionToPatches(
  action: ConstellationEvolutionAction,
  _context: DryRunContext,
): {
  candidates: EvolutionCanvasPatchCandidate[];
  blockers: EvolutionApplyDryRunBlocker[];
  warnings: EvolutionApplyDryRunWarning[];
} {
  const target: EvolutionPatchTarget = {
    targetType: "constellation",
    id: action.constellationId,
  };

  if (
    action.actionType === "refocus_constellation" ||
    action.actionType === "change_constellation_priority"
  ) {
    return {
      candidates: [
        basePatch(action, "update_constellation_metadata", target, "ready", {
          previewSummary: `Would update constellation metadata for ${action.constellationId}.`,
          reversible: true,
          requiresConfirmation: action.requiresUserConfirmation,
          payload: {
            ...(action.focusShift !== undefined ? { focusShift: action.focusShift } : {}),
            ...(action.priorityDelta !== undefined ? { priorityDelta: action.priorityDelta } : {}),
          },
        }),
      ],
      blockers: [],
      warnings: [],
    };
  }

  return {
    candidates: [
      basePatch(action, "no_op", target, "blocked", {
        previewSummary: `Constellation action ${action.actionType} not supported in dry-run.`,
        reversible: false,
        requiresConfirmation: false,
      }),
    ],
    blockers: [
      createDryRunBlocker("policy", `Unsupported constellation action: ${action.actionType}`, {
        sourceActionId: action.id,
      }),
    ],
    warnings: [],
  };
}

// ── Result assembly ───────────────────────────────────────────────────────────────

function deriveDryRunStatus(
  candidates: EvolutionCanvasPatchCandidate[],
  plan: WorldEvolutionPlan,
): WorldEvolutionApplyDryRunStatus {
  if (plan.status === "failed") return "failed";
  if (plan.status === "empty" || candidates.length === 0) return "empty";

  const ready = candidates.filter((patch) => patch.status === "ready");
  const blocked = candidates.filter((patch) => patch.status === "blocked");
  const review = candidates.filter((patch) => patch.status === "needs_review");

  if (ready.length === 0 && blocked.length > 0) return "blocked";
  if (review.length > 0 || plan.status === "needs_review") return "needs_review";
  if (ready.length > 0) return "ready_for_confirmation";
  return "empty";
}

function buildDryRunSummary(
  status: WorldEvolutionApplyDryRunStatus,
  patchSummary: EvolutionPatchPreviewSummary,
): string {
  switch (status) {
    case "empty":
      return "No patch candidates produced from the evolution plan.";
    case "failed":
      return "Dry-run failed because the evolution plan is not valid for apply.";
    case "blocked":
      return `${patchSummary.blockedCount} patch candidate(s) blocked; no safe ready patches.`;
    case "needs_review":
      return `${patchSummary.readyCount} ready and ${patchSummary.needsReviewCount} review-required patch candidate(s).`;
    case "ready_for_confirmation":
      return `${patchSummary.readyCount} patch candidate(s) ready for future confirmation (no canvas writes).`;
    default:
      return "Dry-run complete.";
  }
}

export function summarizeWorldEvolutionApplyDryRun(
  result: WorldEvolutionApplyDryRunResult,
): EvolutionPatchPreviewSummary {
  return result.patchSummary;
}

export function getReadyPatchCandidates(
  result: WorldEvolutionApplyDryRunResult,
): EvolutionCanvasPatchCandidate[] {
  return result.readyPatches;
}

export function getBlockedPatchCandidates(
  result: WorldEvolutionApplyDryRunResult,
): EvolutionCanvasPatchCandidate[] {
  return result.blockedPatches;
}

export function validateWorldEvolutionApplyDryRun(
  result: WorldEvolutionApplyDryRunResult,
): EvolutionDryRunValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result.planId.trim()) errors.push("Missing planId");
  if (result.readyPatches.some((patch) => patch.status !== "ready")) {
    errors.push("readyPatches contains non-ready patch");
  }
  if (result.blockedPatches.some((patch) => patch.status === "ready")) {
    errors.push("blockedPatches contains ready patch");
  }

  const patchIds = new Set<string>();
  for (const patch of result.patchCandidates) {
    if (patchIds.has(patch.id)) errors.push(`Duplicate patch id: ${patch.id}`);
    patchIds.add(patch.id);
    if (!patch.sourceActionId.trim()) {
      errors.push(`Patch ${patch.id} missing sourceActionId`);
    }
  }

  if (result.status === "ready_for_confirmation" && result.readyPatches.length === 0) {
    warnings.push("Status ready_for_confirmation but no ready patches");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function buildWorldEvolutionApplyDryRun(
  input: WorldEvolutionApplyDryRunInput,
): WorldEvolutionApplyDryRunResult {
  const snapshotMetadata = buildDryRunSnapshotMetadata(input);
  const context = buildDryRunContext(input);
  const blockers: EvolutionApplyDryRunBlocker[] = [];
  const warnings: EvolutionApplyDryRunWarning[] = [];
  const patchCandidates: EvolutionCanvasPatchCandidate[] = [];

  if (input.plan.status === "failed") {
    blockers.push(
      createDryRunBlocker("plan_state", "Evolution plan failed; dry-run cannot proceed.", {
        id: "dry_run_blocker_plan_failed",
      }),
    );
    const patchSummary: EvolutionPatchPreviewSummary = {
      totalCandidates: 0,
      readyCount: 0,
      blockedCount: 0,
      needsReviewCount: 0,
      confirmationRequiredCount: 0,
      reversibleCount: 0,
      patchTypes: [],
    };
    return {
      planId: input.plan.id,
      status: "failed",
      summary: buildDryRunSummary("failed", patchSummary),
      patchCandidates: [],
      readyPatches: [],
      blockedPatches: [],
      blockers,
      warnings,
      patchSummary,
      validation: { valid: false, errors: ["Plan status failed"], warnings: [] },
      ...snapshotMetadata,
    };
  }

  const actions = input.selectedActionIds
    ? input.plan.actions.filter((action) => input.selectedActionIds!.includes(action.id))
    : input.plan.actions;

  for (const action of actions) {
    const mapped = mapEvolutionActionToPatchCandidates(action, context);
    blockers.push(...mapped.blockers);
    warnings.push(...mapped.warnings);

    for (const candidate of mapped.candidates) {
      const validated = validatePatchCandidate(candidate, context);
      blockers.push(...validated.blockers);
      warnings.push(...validated.warnings);

      const finalPatch: EvolutionCanvasPatchCandidate = {
        ...candidate,
        status: validated.status,
      };

      patchCandidates.push(finalPatch);

      if (
        finalPatch.status === "ready" &&
        finalPatch.patchType === "add_node" &&
        finalPatch.target.constellationId
      ) {
        const label =
          (typeof finalPatch.payload?.proposedLabel === "string" &&
            finalPatch.payload.proposedLabel) ||
          finalPatch.target.id;
        registerReadyAddNode(
          finalPatch.target.id,
          label,
          finalPatch.target.constellationId,
          context,
        );
      }
    }
  }

  const readyPatches = patchCandidates.filter((patch) => patch.status === "ready");
  const blockedPatches = patchCandidates.filter(
    (patch) => patch.status === "blocked" || patch.status === "needs_review",
  );

  const patchSummary: EvolutionPatchPreviewSummary = {
    totalCandidates: patchCandidates.length,
    readyCount: readyPatches.length,
    blockedCount: patchCandidates.filter((patch) => patch.status === "blocked").length,
    needsReviewCount: patchCandidates.filter((patch) => patch.status === "needs_review").length,
    confirmationRequiredCount: patchCandidates.filter((patch) => patch.requiresConfirmation)
      .length,
    reversibleCount: patchCandidates.filter((patch) => patch.reversible).length,
    patchTypes: [...new Set(patchCandidates.map((patch) => patch.patchType))],
  };

  const status = deriveDryRunStatus(patchCandidates, input.plan);
  const validation = validateWorldEvolutionApplyDryRun({
    planId: input.plan.id,
    status,
    summary: "",
    patchCandidates,
    readyPatches,
    blockedPatches,
    blockers,
    warnings,
    patchSummary,
    validation: { valid: true, errors: [], warnings: [] },
    ...snapshotMetadata,
  });

  return {
    planId: input.plan.id,
    status,
    summary: buildDryRunSummary(status, patchSummary),
    patchCandidates,
    readyPatches,
    blockedPatches,
    blockers,
    warnings,
    patchSummary,
    validation,
    ...snapshotMetadata,
  };
}

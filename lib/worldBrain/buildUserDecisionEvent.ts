/**
 * User Decision Event — deterministic builders (Phase 4.2).
 *
 * Converts node/canon/canvas state into structured UserDecisionEvent objects.
 * Pure functions only — no React, no API calls, no persistence, no UI wiring.
 */

import type { DiscoveryAction } from "@/types/discovery";
import { NODE_REASONER_NODE_TYPES } from "@/lib/worldBrain/nodeReasonerPrompt";
import type { CanvasConstellation, CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import type {
  CanonDecisionState,
  CanonStateSnapshot,
  CreateUserDecisionEventInput,
  DecisionConstellationSnapshot,
  DecisionEventSource,
  DecisionNodeSnapshot,
  DecisionNodeType,
  DecisionSourceLayer,
  DecisionTarget,
  DecisionWorldContext,
  UserDecisionEvent,
  UserDecisionEventType,
} from "@/lib/worldBrain/userDecisionTypes";
import {
  UI_ACTION_TO_EVENT_TYPE,
  UI_DECISION_TO_CANON_STATE,
} from "@/lib/worldBrain/userDecisionTypes";

const VALID_EVENT_TYPES = new Set<string>([
  "establish_truth",
  "keep_potential",
  "reject",
  "revisit_decision",
  "modify_decision",
  "expand_node",
  "steer_world",
  "reorder_flow",
  "remove_from_canon",
]);

const VALID_CANON_STATES = new Set<string>([
  "truth",
  "potential",
  "rejected",
  "unresolved",
  "modified",
  "removed",
]);

const VALID_NODE_TYPES = new Set<string>(NODE_REASONER_NODE_TYPES);

const FALLBACK_NODE_TYPE: DecisionNodeType = "mystery";

/** Flexible node record from Architect, Reasoner, or UI layers. */
export type DecisionNodeSourceRecord = {
  id: string;
  title?: string;
  displayTitle?: string;
  label?: string;
  description?: string;
  summary?: string;
  nodeType?: string;
  type?: string;
  constellationId?: string;
  parentNodeId?: string;
  depthLevel?: number;
  sourceLayer?: DecisionSourceLayer;
  metadata?: Record<string, unknown>;
};

export type DecisionConstellationSourceRecord = {
  id: string;
  title?: string;
  displayTitle?: string;
  description?: string;
  question?: string;
  role?: string;
};

export type CreateDecisionTargetOptions = {
  constellationId?: string;
  parentNodeId?: string;
  depthLevel?: number;
  sourceLayer?: DecisionSourceLayer;
  targetType?: DecisionTarget["targetType"];
};

export type CreateDecisionNodeSnapshotOptions = {
  constellationId?: string;
  parentNodeId?: string;
  depthLevel?: number;
  sourceLayer?: DecisionSourceLayer;
  metadata?: Record<string, unknown>;
};

export type BuildUserDecisionEventFromNodeActionParams = {
  action: Exclude<DiscoveryAction, "unaccept">;
  node: DecisionNodeSourceRecord;
  constellation?: DecisionConstellationSourceRecord | CanvasConstellation;
  canvasModel?: CanvasWorldModel;
  worldContext: DecisionWorldContext;
  canonStateBefore?: CanonStateSnapshot;
  source?: DecisionEventSource;
  notes?: string;
  snapshotOptions?: CreateDecisionNodeSnapshotOptions;
  /** Optional fixed timestamp for deterministic tests. */
  timestamp?: string;
};

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function normalizeNodeType(value: unknown): DecisionNodeType {
  const raw = str(value).toLowerCase();
  return VALID_NODE_TYPES.has(raw) ? (raw as DecisionNodeType) : FALLBACK_NODE_TYPE;
}

function resolveDisplayTitle(node: DecisionNodeSourceRecord): string {
  return (
    str(node.displayTitle) ||
    str(node.label) ||
    str(node.title) ||
    "Untitled Node"
  );
}

function resolveTitle(node: DecisionNodeSourceRecord): string {
  return (
    str(node.title) ||
    str(node.label) ||
    str(node.displayTitle) ||
    "Untitled Node"
  );
}

function resolveDescription(node: DecisionNodeSourceRecord): string {
  const direct = str(node.description) || str(node.summary);
  if (direct) return direct;
  const meta = node.metadata?.description;
  return typeof meta === "string" ? meta.trim() : "";
}

function sanitizeIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
}

/** Deterministic event id — no Math.random(). */
export function buildDecisionEventId(
  eventType: UserDecisionEventType,
  targetId: string,
  timestamp: string,
): string {
  const ts = sanitizeIdSegment(timestamp);
  return `decision_${eventType}_${sanitizeIdSegment(targetId)}_${ts}`;
}

export function isValidUserDecisionEventType(value: string): value is UserDecisionEventType {
  return VALID_EVENT_TYPES.has(value);
}

export function isValidCanonDecisionState(value: string): value is CanonDecisionState {
  return VALID_CANON_STATES.has(value);
}

export function createDecisionTargetFromNode(
  node: DecisionNodeSourceRecord,
  options: CreateDecisionTargetOptions = {},
): DecisionTarget {
  const constellationId =
    str(node.constellationId) || str(options.constellationId) || undefined;
  const parentNodeId =
    str(node.parentNodeId) || str(options.parentNodeId) || undefined;
  const depthLevel = num(node.depthLevel) ?? num(options.depthLevel);

  const target: DecisionTarget = {
    targetType: options.targetType ?? "node",
    id: str(node.id) || "unknown_node",
    title: resolveTitle(node),
    displayTitle: resolveDisplayTitle(node),
    nodeType: normalizeNodeType(node.nodeType ?? node.type),
  };

  if (constellationId) target.constellationId = constellationId;
  if (parentNodeId) target.parentNodeId = parentNodeId;
  if (depthLevel !== undefined) target.depthLevel = depthLevel;

  return target;
}

export function createDecisionNodeSnapshot(
  node: DecisionNodeSourceRecord,
  options: CreateDecisionNodeSnapshotOptions = {},
): DecisionNodeSnapshot {
  const constellationId =
    str(node.constellationId) || str(options.constellationId) || undefined;
  const parentNodeId =
    str(node.parentNodeId) || str(options.parentNodeId) || undefined;
  const depthLevel = num(node.depthLevel) ?? num(options.depthLevel);
  const sourceLayer = options.sourceLayer ?? node.sourceLayer ?? "unknown";

  const metadata =
    options.metadata ?? (node.metadata ? { ...node.metadata } : undefined);

  const snapshot: DecisionNodeSnapshot = {
    id: str(node.id) || "unknown_node",
    title: resolveTitle(node),
    displayTitle: resolveDisplayTitle(node),
    description: resolveDescription(node),
    nodeType: normalizeNodeType(node.nodeType ?? node.type),
    sourceLayer,
  };

  if (constellationId) snapshot.constellationId = constellationId;
  if (parentNodeId) snapshot.parentNodeId = parentNodeId;
  if (depthLevel !== undefined) snapshot.depthLevel = depthLevel;
  if (metadata && Object.keys(metadata).length > 0) snapshot.metadata = metadata;

  return snapshot;
}

export function createDecisionConstellationSnapshot(
  constellation: DecisionConstellationSourceRecord | CanvasConstellation,
): DecisionConstellationSnapshot {
  const title = str(constellation.title) || str(constellation.displayTitle) || "Untitled Constellation";
  const displayTitle = str(constellation.displayTitle) || title;
  const description = str(constellation.description) || undefined;
  const role =
    str("role" in constellation ? constellation.role : undefined) ||
    str(constellation.question) ||
    description;

  const snapshot: DecisionConstellationSnapshot = {
    id: str(constellation.id) || "unknown_constellation",
    title,
    displayTitle,
  };

  if (description) snapshot.description = description;
  if (role) snapshot.role = role;

  return snapshot;
}

export type CreateCanonStateSnapshotParams = {
  truthNodeIds?: string[];
  potentialNodeIds?: string[];
  rejectedNodeIds?: string[];
};

export function createCanonStateSnapshot(
  params: CreateCanonStateSnapshotParams = {},
): CanonStateSnapshot {
  const truthNodeIds = [...(params.truthNodeIds ?? [])];
  const potentialNodeIds = [...(params.potentialNodeIds ?? [])];
  const rejectedNodeIds = [...(params.rejectedNodeIds ?? [])];

  return {
    truthNodeIds,
    potentialNodeIds,
    rejectedNodeIds,
    truthCount: truthNodeIds.length,
    potentialCount: potentialNodeIds.length,
    rejectedCount: rejectedNodeIds.length,
  };
}

/** Builds a complete UserDecisionEvent from structured input. */
export function buildUserDecisionEvent(
  input: CreateUserDecisionEventInput,
  options?: { timestamp?: string },
): UserDecisionEvent {
  const timestamp = options?.timestamp ?? new Date().toISOString();

  const event: UserDecisionEvent = {
    id: buildDecisionEventId(input.eventType, input.target.id, timestamp),
    eventType: input.eventType,
    target: { ...input.target },
    decision: input.decision,
    nodeSnapshot: { ...input.nodeSnapshot },
    worldContext: { ...input.worldContext },
    timestamp,
    source: input.source,
  };

  if (input.constellationSnapshot) {
    event.constellationSnapshot = { ...input.constellationSnapshot };
  }
  if (input.canonStateBefore) {
    event.canonStateBefore = {
      ...input.canonStateBefore,
      truthNodeIds: [...input.canonStateBefore.truthNodeIds],
      potentialNodeIds: [...input.canonStateBefore.potentialNodeIds],
      rejectedNodeIds: [...input.canonStateBefore.rejectedNodeIds],
    };
  }
  if (input.userIntent) {
    event.userIntent = { ...input.userIntent };
  }
  if (input.notes) {
    event.notes = input.notes;
  }

  return event;
}

function enrichWorldContextFromCanvas(
  worldContext: DecisionWorldContext,
  canvasModel?: CanvasWorldModel,
  constellationId?: string,
  nodeId?: string,
): DecisionWorldContext {
  if (!canvasModel) return { ...worldContext };

  return {
    worldPrompt: worldContext.worldPrompt ?? canvasModel.worldSeed,
    purpose: worldContext.purpose,
    architectureSummary: worldContext.architectureSummary ?? canvasModel.worldSummary,
    activeConstellationId: worldContext.activeConstellationId ?? constellationId,
    activeNodeId: worldContext.activeNodeId ?? nodeId,
    currentPhase: worldContext.currentPhase,
  };
}

/** Maps UI accept/save/reject into a structured UserDecisionEvent. */
export function buildUserDecisionEventFromNodeAction(
  params: BuildUserDecisionEventFromNodeActionParams,
): UserDecisionEvent {
  const { action, node, constellation, canvasModel } = params;

  const eventType = UI_ACTION_TO_EVENT_TYPE[action];
  const uiDecisionKey =
    action === "accept" ? "accepted" : action === "save" ? "saved" : "rejected";
  const decision = UI_DECISION_TO_CANON_STATE[uiDecisionKey];

  const snapshotOptions: CreateDecisionNodeSnapshotOptions = {
    ...params.snapshotOptions,
    constellationId:
      params.snapshotOptions?.constellationId ??
      (str(node.constellationId) ||
        (constellation ? str(constellation.id) : undefined)),
  };

  const target = createDecisionTargetFromNode(node, {
    constellationId: snapshotOptions.constellationId,
    parentNodeId: node.parentNodeId,
    depthLevel: node.depthLevel,
    sourceLayer: params.snapshotOptions?.sourceLayer,
  });

  const nodeSnapshot = createDecisionNodeSnapshot(node, snapshotOptions);

  const constellationSnapshot = constellation
    ? createDecisionConstellationSnapshot(constellation)
    : undefined;

  const worldContext = enrichWorldContextFromCanvas(
    params.worldContext,
    canvasModel,
    snapshotOptions.constellationId,
    node.id,
  );

  return buildUserDecisionEvent(
    {
      eventType,
      decision,
      target,
      nodeSnapshot,
      constellationSnapshot,
      worldContext,
      canonStateBefore: params.canonStateBefore,
      source: params.source ?? "user_click",
      notes: params.notes,
    },
    { timestamp: params.timestamp },
  );
}

/**
 * Builds canon snapshot from UI decision maps (acceptedIds + decisions record).
 * accepted → truth, saved → potential, rejected → rejected.
 */
export function createCanonStateSnapshotFromDecisions(
  decisions: Record<string, string>,
  acceptedIds: string[] = [],
): CanonStateSnapshot {
  const truthNodeIds = [...acceptedIds];
  const potentialNodeIds: string[] = [];
  const rejectedNodeIds: string[] = [];

  for (const [id, decision] of Object.entries(decisions)) {
    if (decision === "saved" && !potentialNodeIds.includes(id)) {
      potentialNodeIds.push(id);
    }
    if (decision === "rejected" && !rejectedNodeIds.includes(id)) {
      rejectedNodeIds.push(id);
    }
  }

  return createCanonStateSnapshot({
    truthNodeIds,
    potentialNodeIds,
    rejectedNodeIds,
  });
}

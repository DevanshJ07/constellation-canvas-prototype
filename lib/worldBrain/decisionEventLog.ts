/**
 * Decision Event Log — in-memory helpers (Phase 4.3).
 *
 * Immutable append/query/summarize utilities for UserDecisionEvent timelines.
 * No React, no API calls, no persistence — pure functions only.
 */

import type {
  CanonDecisionState,
  CanonStateSnapshot,
  DecisionEventLog,
  DecisionEventSource,
  UserDecisionEvent,
  UserDecisionEventType,
} from "@/lib/worldBrain/userDecisionTypes";

export type DecisionEventLogSummary = {
  totalEvents: number;
  truthCount: number;
  potentialCount: number;
  rejectedCount: number;
  byEventType: Partial<Record<UserDecisionEventType, number>>;
  bySource: Partial<Record<DecisionEventSource, number>>;
  lastUpdatedAt?: string;
};

const CANON_BUCKET_STATES: readonly CanonDecisionState[] = [
  "truth",
  "potential",
  "rejected",
];

/** States that do not place a target in truth/potential/rejected buckets. */
const NON_BUCKET_STATES: readonly CanonDecisionState[] = [
  "unresolved",
  "removed",
  "modified",
];

function compareTimestamps(a: string, b: string): number {
  return a.localeCompare(b);
}

function resolveConstellationId(event: UserDecisionEvent): string | undefined {
  return (
    event.target.constellationId ??
    event.nodeSnapshot.constellationId ??
    event.constellationSnapshot?.id
  );
}

/** Latest event per target.id — later timestamp wins; tie preserves last in sorted order. */
export function getLatestEventsByTarget(
  log: DecisionEventLog,
): Map<string, UserDecisionEvent> {
  const sorted = [...log.events].sort((a, b) =>
    compareTimestamps(a.timestamp, b.timestamp),
  );
  const latest = new Map<string, UserDecisionEvent>();
  for (const event of sorted) {
    latest.set(event.target.id, event);
  }
  return latest;
}

export function createEmptyDecisionEventLog(): DecisionEventLog {
  return { events: [] };
}

export function appendDecisionEvent(
  log: DecisionEventLog,
  event: UserDecisionEvent,
): DecisionEventLog {
  return {
    events: [...log.events, event],
    lastUpdatedAt: event.timestamp,
  };
}

export function appendDecisionEvents(
  log: DecisionEventLog,
  events: UserDecisionEvent[],
): DecisionEventLog {
  if (events.length === 0) {
    return { events: [...log.events], lastUpdatedAt: log.lastUpdatedAt };
  }
  const merged = [...log.events, ...events];
  const lastUpdatedAt = events[events.length - 1]?.timestamp ?? log.lastUpdatedAt;
  return { events: merged, lastUpdatedAt };
}

export function getDecisionEventsByTargetId(
  log: DecisionEventLog,
  targetId: string,
): UserDecisionEvent[] {
  return log.events.filter((e) => e.target.id === targetId);
}

export function getDecisionEventsByConstellationId(
  log: DecisionEventLog,
  constellationId: string,
): UserDecisionEvent[] {
  return log.events.filter((e) => resolveConstellationId(e) === constellationId);
}

export function getDecisionEventsByType(
  log: DecisionEventLog,
  eventType: UserDecisionEventType,
): UserDecisionEvent[] {
  return log.events.filter((e) => e.eventType === eventType);
}

export function getDecisionEventsByDecision(
  log: DecisionEventLog,
  decision: CanonDecisionState,
): UserDecisionEvent[] {
  return log.events.filter((e) => e.decision === decision);
}

export function getLatestDecisionEventForTarget(
  log: DecisionEventLog,
  targetId: string,
): UserDecisionEvent | undefined {
  return getLatestEventsByTarget(log).get(targetId);
}

export function getLatestDecisionStateForTarget(
  log: DecisionEventLog,
  targetId: string,
): CanonDecisionState | undefined {
  return getLatestDecisionEventForTarget(log, targetId)?.decision;
}

/**
 * Derives current canon buckets from latest decision per target.
 *
 * - truth / potential / rejected → respective lists
 * - removed / unresolved / modified → excluded from all buckets
 */
export function summarizeCanonStateFromEventLog(
  log: DecisionEventLog,
): CanonStateSnapshot {
  const truthNodeIds: string[] = [];
  const potentialNodeIds: string[] = [];
  const rejectedNodeIds: string[] = [];

  for (const [targetId, event] of getLatestEventsByTarget(log)) {
    if (event.decision === "truth") {
      truthNodeIds.push(targetId);
    } else if (event.decision === "potential") {
      potentialNodeIds.push(targetId);
    } else if (event.decision === "rejected") {
      rejectedNodeIds.push(targetId);
    }
    // removed, unresolved, modified → excluded
  }

  return {
    truthNodeIds,
    potentialNodeIds,
    rejectedNodeIds,
    truthCount: truthNodeIds.length,
    potentialCount: potentialNodeIds.length,
    rejectedCount: rejectedNodeIds.length,
  };
}

function getLatestEventsWithDecision(
  log: DecisionEventLog,
  decision: CanonDecisionState,
): UserDecisionEvent[] {
  return [...getLatestEventsByTarget(log).values()].filter(
    (e) => e.decision === decision,
  );
}

export function getTruthEvents(log: DecisionEventLog): UserDecisionEvent[] {
  return getLatestEventsWithDecision(log, "truth");
}

export function getPotentialEvents(log: DecisionEventLog): UserDecisionEvent[] {
  return getLatestEventsWithDecision(log, "potential");
}

export function getRejectedEvents(log: DecisionEventLog): UserDecisionEvent[] {
  return getLatestEventsWithDecision(log, "rejected");
}

export function summarizeDecisionEventLog(
  log: DecisionEventLog,
): DecisionEventLogSummary {
  const canon = summarizeCanonStateFromEventLog(log);
  const byEventType: Partial<Record<UserDecisionEventType, number>> = {};
  const bySource: Partial<Record<DecisionEventSource, number>> = {};

  for (const event of log.events) {
    byEventType[event.eventType] = (byEventType[event.eventType] ?? 0) + 1;
    bySource[event.source] = (bySource[event.source] ?? 0) + 1;
  }

  return {
    totalEvents: log.events.length,
    truthCount: canon.truthCount,
    potentialCount: canon.potentialCount,
    rejectedCount: canon.rejectedCount,
    byEventType,
    bySource,
    lastUpdatedAt: log.lastUpdatedAt,
  };
}

export function getRecentDecisionEvents(
  log: DecisionEventLog,
  limit: number,
): UserDecisionEvent[] {
  if (limit <= 0) return [];
  return [...log.events]
    .sort((a, b) => compareTimestamps(b.timestamp, a.timestamp))
    .slice(0, limit);
}

export function getEventsSince(
  log: DecisionEventLog,
  timestamp: string,
): UserDecisionEvent[] {
  return log.events.filter((e) => compareTimestamps(e.timestamp, timestamp) >= 0);
}

const CANON_RELEVANT_DECISIONS = new Set<CanonDecisionState>([
  ...CANON_BUCKET_STATES,
  "removed",
  "modified",
]);

const CANON_RELEVANT_EVENT_TYPES = new Set<UserDecisionEventType>([
  "establish_truth",
  "keep_potential",
  "reject",
  "revisit_decision",
  "modify_decision",
  "remove_from_canon",
]);

/** Events likely to matter for Ripple Effect / Canon Critic (excludes expand/steer/reorder). */
export function getCanonRelevantEvents(log: DecisionEventLog): UserDecisionEvent[] {
  return log.events.filter(
    (e) =>
      CANON_RELEVANT_DECISIONS.has(e.decision) ||
      CANON_RELEVANT_EVENT_TYPES.has(e.eventType),
  );
}

/** Documents which states participate in canon bucket derivation. */
export function isCanonBucketState(decision: CanonDecisionState): boolean {
  return (CANON_BUCKET_STATES as readonly string[]).includes(decision);
}

export function isNonBucketState(decision: CanonDecisionState): boolean {
  return (NON_BUCKET_STATES as readonly string[]).includes(decision);
}

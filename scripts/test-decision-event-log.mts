/**
 * Manual local test for Decision Event Log helpers — no network.
 *
 * Usage: npx tsx scripts/test-decision-event-log.mts
 */

import { buildUserDecisionEvent } from "../lib/worldBrain/buildUserDecisionEvent.ts";
import {
  appendDecisionEvent,
  appendDecisionEvents,
  createEmptyDecisionEventLog,
  getDecisionEventsByConstellationId,
  getDecisionEventsByTargetId,
  getLatestDecisionStateForTarget,
  getPotentialEvents,
  getRecentDecisionEvents,
  getRejectedEvents,
  getTruthEvents,
  summarizeCanonStateFromEventLog,
  summarizeDecisionEventLog,
} from "../lib/worldBrain/decisionEventLog.ts";
import type { CreateUserDecisionEventInput } from "../lib/worldBrain/userDecisionTypes.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function event(
  partial: CreateUserDecisionEventInput,
  timestamp: string,
) {
  return buildUserDecisionEvent(partial, { timestamp });
}

const worldContext = {
  worldPrompt: "Diverse fictional worlds for testing",
  purpose: "Validate decision event log behavior",
  currentPhase: "canon_review" as const,
};

function nodeTarget(id: string, displayTitle: string, constellationId: string) {
  return {
    targetType: "node" as const,
    id,
    title: displayTitle,
    displayTitle,
    constellationId,
    nodeType: "place" as const,
  };
}

function nodeSnapshot(id: string, displayTitle: string, constellationId: string) {
  return {
    id,
    title: displayTitle,
    displayTitle,
    description: `${displayTitle} description`,
    constellationId,
    sourceLayer: "constellation_reasoner" as const,
  };
}

function main() {
  console.log("=== Decision Event Log fixture test (no network) ===\n");

  const empty = createEmptyDecisionEventLog();
  assert(empty.events.length === 0, "empty log");
  assert(empty.lastUpdatedAt === undefined, "empty log has no lastUpdatedAt");

  const e1 = event(
    {
      eventType: "establish_truth",
      decision: "truth",
      target: nodeTarget("node_childhood_memory_bank", "Memory Bank", "constellation_memory_economy"),
      nodeSnapshot: nodeSnapshot("node_childhood_memory_bank", "Memory Bank", "constellation_memory_economy"),
      worldContext,
      source: "user_click",
    },
    "2026-07-07T10:00:00.000Z",
  );

  const e2 = event(
    {
      eventType: "keep_potential",
      decision: "potential",
      target: nodeTarget("node_tomorrow_ticket", "Tomorrow Ticket", "constellation_fated_hearts"),
      nodeSnapshot: nodeSnapshot("node_tomorrow_ticket", "Tomorrow Ticket", "constellation_fated_hearts"),
      worldContext,
      source: "user_click",
    },
    "2026-07-07T10:01:00.000Z",
  );

  const e3 = event(
    {
      eventType: "reject",
      decision: "rejected",
      target: nodeTarget("node_map_eating_crabs", "Map-Eating Crabs", "constellation_treasure_chaos"),
      nodeSnapshot: nodeSnapshot("node_map_eating_crabs", "Map-Eating Crabs", "constellation_treasure_chaos"),
      worldContext,
      source: "user_click",
    },
    "2026-07-07T10:02:00.000Z",
  );

  const e4a = event(
    {
      eventType: "establish_truth",
      decision: "truth",
      target: nodeTarget("node_broken_oath_witness", "Broken Oath Witness", "constellation_succession"),
      nodeSnapshot: nodeSnapshot("node_broken_oath_witness", "Broken Oath Witness", "constellation_succession"),
      worldContext,
      source: "user_click",
    },
    "2026-07-07T10:03:00.000Z",
  );

  const e4b = event(
    {
      eventType: "reject",
      decision: "rejected",
      target: nodeTarget("node_broken_oath_witness", "Broken Oath Witness", "constellation_succession"),
      nodeSnapshot: nodeSnapshot("node_broken_oath_witness", "Broken Oath Witness", "constellation_succession"),
      worldContext,
      source: "user_click",
      notes: "Changed mind after critic warning",
    },
    "2026-07-07T10:04:00.000Z",
  );

  const e5a = event(
    {
      eventType: "establish_truth",
      decision: "truth",
      target: nodeTarget("node_final_penalty_shot", "Final Penalty Shot", "constellation_championship_arc"),
      nodeSnapshot: nodeSnapshot("node_final_penalty_shot", "Final Penalty Shot", "constellation_championship_arc"),
      worldContext,
      source: "user_click",
    },
    "2026-07-07T10:05:00.000Z",
  );

  const e5b = event(
    {
      eventType: "remove_from_canon",
      decision: "removed",
      target: nodeTarget("node_final_penalty_shot", "Final Penalty Shot", "constellation_championship_arc"),
      nodeSnapshot: nodeSnapshot("node_final_penalty_shot", "Final Penalty Shot", "constellation_championship_arc"),
      worldContext,
      source: "user_click",
    },
    "2026-07-07T10:06:00.000Z",
  );

  const e6 = event(
    {
      eventType: "modify_decision",
      decision: "modified",
      target: nodeTarget("node_locked_study_window", "Locked Study Window", "constellation_mystery_manor"),
      nodeSnapshot: nodeSnapshot("node_locked_study_window", "Locked Study Window", "constellation_mystery_manor"),
      worldContext,
      source: "critic_warning",
    },
    "2026-07-07T10:07:00.000Z",
  );

  let log = appendDecisionEvent(empty, e1);
  assert(empty.events.length === 0, "append must not mutate original log");
  assert(log.events.length === 1, "log has one event");
  assert(log.lastUpdatedAt === e1.timestamp, "lastUpdatedAt updated");

  log = appendDecisionEvents(log, [e2, e3, e4a, e4b, e5a, e5b, e6]);
  assert(log.events.length === 8, "log has eight events");
  assert(log.lastUpdatedAt === e6.timestamp, "lastUpdatedAt is last appended");

  assert(
    getLatestDecisionStateForTarget(log, "node_broken_oath_witness") === "rejected",
    "latest decision wins for witness",
  );
  assert(
    getLatestDecisionStateForTarget(log, "node_final_penalty_shot") === "removed",
    "removed is latest for penalty shot",
  );

  const canon = summarizeCanonStateFromEventLog(log);
  assert(canon.truthCount === 1, "one truth node");
  assert(canon.potentialCount === 1, "one potential node");
  assert(canon.rejectedCount === 2, "two rejected nodes");
  assert(canon.truthNodeIds.includes("node_childhood_memory_bank"), "memory bank is truth");
  assert(!canon.truthNodeIds.includes("node_final_penalty_shot"), "removed node not in truth");
  assert(!canon.truthNodeIds.includes("node_locked_study_window"), "modified excluded from truth");

  assert(getTruthEvents(log).length === 1, "getTruthEvents returns latest truth only");
  assert(getPotentialEvents(log).length === 1, "getPotentialEvents");
  assert(getRejectedEvents(log).length === 2, "getRejectedEvents latest rejected");

  const memoryEvents = getDecisionEventsByTargetId(log, "node_childhood_memory_bank");
  assert(memoryEvents.length === 1, "query by target id");

  const sciFiEvents = getDecisionEventsByConstellationId(log, "constellation_memory_economy");
  assert(sciFiEvents.length === 1, "query by constellation id");

  const summary = summarizeDecisionEventLog(log);
  assert(summary.totalEvents === 8, "summary totalEvents");
  assert(summary.byEventType.establish_truth === 3, "establish_truth count");
  assert(summary.bySource.user_click === 7, "user_click count");

  const recent = getRecentDecisionEvents(log, 3);
  assert(recent.length === 3, "recent limit");
  assert(recent[0].target.id === "node_locked_study_window", "most recent first");

  console.log("Canon summary:", canon);
  console.log("Log summary:", summary);
  console.log("\nAll Decision Event Log checks passed.");
}

main();

/**
 * Mock Ripple Preview fixture for UI skeleton and no-network tests (Phase 4.11).
 * Sci-fi memory economy — no API, no LLM, no canvas mutation.
 */

import type { RippleEffectOutput } from "@/lib/worldBrain/rippleEffectTypes";
import {
  buildRipplePreviewModel,
  type RipplePreviewModel,
} from "@/lib/worldBrain/ripplePreviewModel";

export const MEMORY_ECONOMY_TRIGGER_EVENT_ID =
  "decision_establish_truth_node_housing_memory_trade";

const NODE_TITLES: Record<string, string> = {
  node_public_memory_archive: "Public Memory Archive",
  node_illegal_memory_broker: "Illegal Memory Broker",
  node_childhood_debt_collector: "Childhood Debt Collector",
  node_memory_free_commune: "Memory-Free Commune",
};

const CONSTELLATION_TITLES: Record<string, string> = {
  constellation_memory_economy: "Memory Economy",
  constellation_housing_credits: "Housing Credits",
};

export function buildMemoryEconomyRippleEffectOutput(): RippleEffectOutput {
  return {
    triggerEventId: MEMORY_ECONOMY_TRIGGER_EVENT_ID,
    summary:
      "Allowing private childhood memories to be traded for housing credits reshapes the Memory Economy, strengthens black-market brokers, and pressures canon about memory-free communities.",
    impactLevel: "major",
    affectedScopes: ["node", "constellation", "canon", "world"],
    nodeImpacts: [
      {
        nodeId: "node_public_memory_archive",
        constellationId: "constellation_memory_economy",
        impactType: "require_modification",
        reason: "Public archive must reflect regulated childhood-memory listings.",
        severity: "medium",
        confidence: 0.84,
        suggestedOperationIds: ["ripple_op_modify_node_node_public_memory_archive_0"],
      },
      {
        nodeId: "node_illegal_memory_broker",
        constellationId: "constellation_memory_economy",
        impactType: "strengthen",
        reason: "Legal trade creates demand for off-book memory laundering.",
        severity: "high",
        confidence: 0.88,
        suggestedOperationIds: ["ripple_op_strengthen_node_node_illegal_memory_broker_0"],
      },
      {
        nodeId: "node_childhood_debt_collector",
        constellationId: "constellation_housing_credits",
        impactType: "inspire_new_node",
        reason: "Housing credits tied to childhood memories need a collection agent.",
        severity: "medium",
        confidence: 0.79,
        suggestedOperationIds: ["ripple_op_generate_new_node_node_childhood_debt_collector_0"],
      },
    ],
    constellationImpacts: [
      {
        constellationId: "constellation_memory_economy",
        impactType: "expand",
        reason: "Memory trade becomes a regulated civic infrastructure.",
        suggestedFocusShift: "childhood memory liquidity",
        suggestedNodeCountChange: 1,
        confidence: 0.81,
      },
    ],
    canonImpacts: [
      {
        impactType: "changes_world_rule",
        reason: "Housing policy now depends on sellable childhood memories.",
        affectedCanonIds: ["canon_memory_trade_policy"],
        suggestedCanonStateChanges: [
          {
            targetId: "canon_memory_trade_policy",
            fromState: "potential",
            toState: "truth",
            reason: "User established memory-for-housing trade as truth.",
          },
        ],
        confidence: 0.86,
      },
    ],
    suggestedOperations: [
      {
        id: "ripple_op_modify_node_node_public_memory_archive_0",
        operationType: "modify_node",
        target: {
          targetType: "node",
          id: "node_public_memory_archive",
          constellationId: "constellation_memory_economy",
        },
        reason: "Archive listings must distinguish childhood memories eligible for housing credits.",
        priority: "high",
        requiresUserApproval: true,
      },
      {
        id: "ripple_op_strengthen_node_node_illegal_memory_broker_0",
        operationType: "strengthen_node",
        target: {
          targetType: "node",
          id: "node_illegal_memory_broker",
          constellationId: "constellation_memory_economy",
        },
        reason: "Grey-market brokers profit from memory laundering around the new policy.",
        priority: "medium",
        requiresUserApproval: true,
      },
      {
        id: "ripple_op_generate_new_node_node_childhood_debt_collector_0",
        operationType: "generate_new_node",
        target: {
          targetType: "node",
          id: "node_childhood_debt_collector",
          constellationId: "constellation_housing_credits",
        },
        reason: "Someone must collect overdue childhood-memory debts tied to housing credits.",
        priority: "medium",
        requiresUserApproval: true,
      },
    ],
    warnings: [
      {
        id: "ripple_warning_canon_conflict_node_memory_free_commune_0",
        warningType: "canon_conflict",
        message:
          "Memory-Free Commune canon rejects commodified childhood memories — reconcile or weaken that community.",
        severity: "high",
        affectedTargets: [
          { targetType: "node", id: "node_memory_free_commune" },
          { targetType: "canon_item", id: "canon_memory_free_commune" },
        ],
        suggestedResolution:
          "Clarify whether the commune is underground, reformed, or narratively marginalized.",
      },
      {
        id: "ripple_warning_tone_mismatch_world_dystopia_0",
        warningType: "tone_mismatch",
        message:
          "If the memory economy becomes too dystopian, the world may drift from hopeful sci-fi into grim surveillance fiction.",
        severity: "medium",
        affectedTargets: [{ targetType: "world", id: "world_memory_economy_tone" }],
        suggestedResolution:
          "Add safeguards, resistance nodes, or satirical framing before leaning into horror.",
      },
    ],
    preservedElements: [
      {
        targetType: "node",
        id: "node_memory_free_commune",
        reason: "Commune tension is valuable — preserve as active contradiction unless user resolves it.",
      },
    ],
    followUpQuestions: [
      "Should childhood memories be revocable after housing credits are spent?",
      "Do illegal brokers operate openly or only in shadow networks?",
    ],
    confidence: 0.83,
  };
}

export function buildMemoryEconomyRipplePreviewFixture(): RipplePreviewModel {
  return buildRipplePreviewModel(buildMemoryEconomyRippleEffectOutput(), {
    id: "ripple_preview_fixture_memory_economy",
    title: "Ripple Preview — Memory-for-Housing Trade",
    createdAt: "2026-07-07T18:30:00.000Z",
    nodeTitleById: NODE_TITLES,
    constellationTitleById: CONSTELLATION_TITLES,
  });
}

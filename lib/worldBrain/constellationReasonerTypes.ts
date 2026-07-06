/**
 * Constellation Reasoner — Phase 2 type contracts.
 *
 * Global reasoning (World Architect) defines major exploration spaces.
 * Local reasoning (Constellation Reasoner) defines discoveries, nodes, tensions,
 * and paths inside one constellation.
 *
 * No runtime logic, prompts, or API calls — contracts only.
 */

import type { ArchitectureControlRules } from "@/lib/worldBrain/architectWorld";
import type { CanvasAgent, CanvasCriticAgent } from "@/lib/worldBrain/mapArchitectureToCanvas";

// ── Shared primitives ───────────────────────────────────────────────────────────

/**
 * Local discovery node categories for Constellation Reasoner output.
 * Distinct from Architect-layer `NodeType` in `architectWorld.ts`.
 */
export type NodeType =
  | "place"
  | "character"
  | "event"
  | "object"
  | "faction"
  | "mystery"
  | "rule"
  | "conflict"
  | "symbol"
  | "ritual"
  | "relationship"
  | "threat"
  | "opportunity";

export type TensionLevel = "low" | "medium" | "high";

export type UserSteeringMode =
  | "refine"
  | "redirect"
  | "deepen"
  | "simplify"
  | "make_darker"
  | "make_lighter"
  | "make_more_grounded"
  | "make_more_surreal";

/** Lightweight canon placeholder — not full Canon Memory. */
export type LightweightCanonItem = {
  id: string;
  title: string;
  type: string;
  description: string;
  sourceConstellationId?: string;
};

export type UserSteeringInstruction = {
  instruction: string;
  mode: UserSteeringMode;
};

/** Subset of world control rules scoped to one constellation context. */
export type ConstellationConstraints = Pick<
  ArchitectureControlRules,
  "mustPreserve" | "mustAvoid"
>;

// ── Input ─────────────────────────────────────────────────────────────────────

/** The constellation currently being reasoned about locally. */
export type SelectedConstellation = {
  id: string;
  title: string;
  displayTitle: string;
  description: string;
  /** Creative role this zone plays in the world (e.g. tension engine, mystery layer). */
  role: string;
  reasoningAgents: CanvasAgent[];
  criticAgents: CanvasCriticAgent[];
  expansionRules: string[];
  constraints: ConstellationConstraints;
};

/** Adjacent zones for cross-constellation awareness without global re-reasoning. */
export type NeighboringConstellation = {
  id: string;
  title: string;
  displayTitle: string;
  role: string;
  description?: string;
};

export type ConstellationReasonerInput = {
  worldPrompt: string;
  purpose: string;
  architectureSummary: string;
  selectedConstellation: SelectedConstellation;
  neighboringConstellations: NeighboringConstellation[];
  existingCanon?: LightweightCanonItem[];
  userSteering?: UserSteeringInstruction;
};

// ── Output ────────────────────────────────────────────────────────────────────

/** A major local exploration direction inside one constellation. */
export type ExplorationAxis = {
  id: string;
  name: string;
  purpose: string;
  creativeFunction: string;
};

/**
 * A locally reasoned starting node.
 * `title` preserves richer internal naming; `displayTitle` is canvas-facing.
 */
export type ReasonedStartingNode = {
  id: string;
  title: string;
  displayTitle: string;
  nodeType: NodeType;
  description: string;
  creativePurpose: string;
  discoveryQuestion: string;
  expansionPotential: string;
  tensionLevel: TensionLevel;
  noveltyScore: number;
  relevanceScore: number;
  tags?: string[];
};

/** Suggested relationship between two reasoned nodes (rendering not implemented yet). */
export type SuggestedNodeConnection = {
  fromNodeId: string;
  toNodeId: string;
  relationshipType: string;
  reason: string;
};

export type ConstellationReasonerOutput = {
  constellationId: string;
  localSummary: string;
  explorationAxes: ExplorationAxis[];
  startingNodes: ReasonedStartingNode[];
  suggestedConnections: SuggestedNodeConnection[];
  expansionRules: string[];
  avoidPatterns: string[];
};

/**
 * Constellation Reasoner — pure input builder (Phase 2, Step 3).
 *
 * Adapts CanvasWorldModel + selected constellation id → ConstellationReasonerInput.
 * No API calls, no Gemini, no UI, no mutation.
 */

import type {
  ConstellationReasonerInput,
  ConstellationConstraints,
  LightweightCanonItem,
  NeighboringConstellation,
  SelectedConstellation,
  UserSteeringInstruction,
} from "@/lib/worldBrain/constellationReasonerTypes";
import type {
  CanvasAgent,
  CanvasConstellation,
  CanvasCriticAgent,
  CanvasWorldModel,
} from "@/lib/worldBrain/mapArchitectureToCanvas";

export type BuildConstellationReasonerInputParams = {
  canvasModel: CanvasWorldModel;
  selectedConstellationId: string;
  /** Overrides canvasModel.worldSeed when provided. */
  worldPrompt?: string;
  /** Not stored on CanvasWorldModel — pass explicitly when available. */
  purpose?: string;
  /** Overrides canvasModel.worldSummary when provided. */
  architectureSummary?: string;
  existingCanon?: LightweightCanonItem[];
  userSteering?: UserSteeringInstruction;
};

const DEFAULT_ROLE = "Local exploration space";
const FALLBACK_WORLD_PROMPT = "No world prompt provided.";
const FALLBACK_PURPOSE = "No purpose provided.";
const FALLBACK_ARCHITECTURE_SUMMARY = "No architecture summary provided.";

const EMPTY_CONSTRAINTS: ConstellationConstraints = {
  mustPreserve: [],
  mustAvoid: [],
};

function normalizeDisplayTitle(constellation: CanvasConstellation): string {
  const display = constellation.displayTitle?.trim();
  if (display) return display;
  return constellation.title.trim() || constellation.id;
}

function resolveRole(constellation: CanvasConstellation): string {
  const question = constellation.question?.trim();
  if (question) return question;
  const description = constellation.description?.trim();
  if (description) return description;
  return DEFAULT_ROLE;
}

function extractAgentsForConstellation(
  constellation: CanvasConstellation,
  agents: CanvasAgent[],
): CanvasAgent[] {
  const linkedIds = new Set(constellation.agentIds);
  return agents.filter(
    (agent) =>
      linkedIds.has(agent.id) ||
      agent.linkedConstellationIds.includes(constellation.id),
  );
}

function extractCritics(criticAgents: CanvasCriticAgent[]): CanvasCriticAgent[] {
  return criticAgents.length > 0 ? [...criticAgents] : [];
}

function resolveConstraints(
  controlRules: CanvasWorldModel["controlRules"],
): ConstellationConstraints {
  return {
    mustPreserve: controlRules.mustPreserve?.length
      ? [...controlRules.mustPreserve]
      : [],
    mustAvoid: controlRules.mustAvoid?.length ? [...controlRules.mustAvoid] : [],
  };
}

function resolveExpansionRules(
  controlRules: CanvasWorldModel["controlRules"],
): string[] {
  return controlRules.expansionRules?.length
    ? [...controlRules.expansionRules]
    : [];
}

function toSelectedConstellation(
  constellation: CanvasConstellation,
  canvasModel: CanvasWorldModel,
): SelectedConstellation {
  return {
    id: constellation.id,
    title: constellation.title,
    displayTitle: normalizeDisplayTitle(constellation),
    description: constellation.description?.trim() || constellation.title,
    role: resolveRole(constellation),
    reasoningAgents: extractAgentsForConstellation(constellation, canvasModel.agents),
    criticAgents: extractCritics(canvasModel.criticAgents),
    expansionRules: resolveExpansionRules(canvasModel.controlRules),
    constraints: resolveConstraints(canvasModel.controlRules),
  };
}

function toNeighboringConstellation(
  constellation: CanvasConstellation,
): NeighboringConstellation {
  const description = constellation.description?.trim();
  return {
    id: constellation.id,
    title: constellation.title,
    displayTitle: normalizeDisplayTitle(constellation),
    role: resolveRole(constellation),
    ...(description ? { description } : {}),
  };
}

function resolveWorldPrompt(
  canvasModel: CanvasWorldModel,
  override?: string,
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromModel = canvasModel.worldSeed?.trim();
  if (fromModel) return fromModel;
  return FALLBACK_WORLD_PROMPT;
}

function resolvePurpose(override?: string): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  return FALLBACK_PURPOSE;
}

function resolveArchitectureSummary(
  canvasModel: CanvasWorldModel,
  override?: string,
): string {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromModel = canvasModel.worldSummary?.trim();
  if (fromModel) return fromModel;
  return FALLBACK_ARCHITECTURE_SUMMARY;
}

/**
 * Builds ConstellationReasonerInput from the canvas bridge model and a selected constellation id.
 */
export function buildConstellationReasonerInput(
  params: BuildConstellationReasonerInputParams,
): ConstellationReasonerInput {
  const { canvasModel, selectedConstellationId } = params;

  const selected = canvasModel.constellations.find(
    (c) => c.id === selectedConstellationId,
  );
  if (!selected) {
    throw new Error(`Constellation not found for id: ${selectedConstellationId}`);
  }

  const neighboringConstellations = canvasModel.constellations
    .filter((c) => c.id !== selectedConstellationId)
    .map(toNeighboringConstellation);

  const input: ConstellationReasonerInput = {
    worldPrompt: resolveWorldPrompt(canvasModel, params.worldPrompt),
    purpose: resolvePurpose(params.purpose),
    architectureSummary: resolveArchitectureSummary(
      canvasModel,
      params.architectureSummary,
    ),
    selectedConstellation: toSelectedConstellation(selected, canvasModel),
    neighboringConstellations,
    existingCanon: params.existingCanon ?? [],
  };

  if (params.userSteering) {
    input.userSteering = params.userSteering;
  }

  return input;
}

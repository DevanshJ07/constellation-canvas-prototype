import { NextResponse } from "next/server";
import {
  buildNodeReasonerInput,
  type BuildNodeReasonerInputParams,
  type NodeReasonerAvailableNode,
} from "@/lib/worldBrain/buildNodeReasonerInput";
import type { ExplorationAxis } from "@/lib/worldBrain/constellationReasonerTypes";
import type { LightweightCanonItem } from "@/lib/worldBrain/constellationReasonerTypes";
import type {
  NodeDepthContext,
  NodeReasonerUserSteering,
} from "@/lib/worldBrain/nodeReasonerTypes";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import {
  buildNodeReasonerAgentInput,
  buildNodeReasonerEnvironment,
  buildNodeReasonerMemory,
  NODE_REASONER_FALLBACK_COPY,
  runNodeReasonerAgent,
} from "@/lib/worldBrain/agents/nodeReasonerAgent";

type NodeReasonerRequestBody = {
  canvasModel?: CanvasWorldModel;
  selectedConstellationId?: string;
  selectedNodeId?: string;
  availableNodes?: NodeReasonerAvailableNode[];
  purpose?: string;
  worldPrompt?: string;
  architectureSummary?: string;
  existingCanon?: LightweightCanonItem[];
  userSteering?: NodeReasonerUserSteering;
  depthContext?: NodeDepthContext;
  localSummary?: string;
  explorationAxes?: ExplorationAxis[];
  /** Optional — titles of nodes the user has previously rejected. */
  rejectedTitles?: string[];
  /** Optional — ids of nodes the user has previously rejected. */
  rejectedIds?: string[];
};

function isCanvasWorldModel(value: unknown): value is CanvasWorldModel {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.worldSeed === "string" &&
    Array.isArray(obj.constellations) &&
    Array.isArray(obj.agents) &&
    Array.isArray(obj.criticAgents) &&
    obj.controlRules !== null &&
    typeof obj.controlRules === "object"
  );
}

function isAvailableNode(value: unknown): value is NodeReasonerAvailableNode {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && obj.id.trim().length > 0;
}

export async function POST(request: Request) {
  let body: NodeReasonerRequestBody;

  try {
    body = (await request.json()) as NodeReasonerRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.canvasModel || !isCanvasWorldModel(body.canvasModel)) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid field: canvasModel" },
      { status: 400 },
    );
  }

  const selectedConstellationId = String(body.selectedConstellationId ?? "").trim();
  if (!selectedConstellationId) {
    return NextResponse.json(
      { success: false, error: "Missing required field: selectedConstellationId" },
      { status: 400 },
    );
  }

  const selectedNodeId = String(body.selectedNodeId ?? "").trim();
  if (!selectedNodeId) {
    return NextResponse.json(
      { success: false, error: "Missing required field: selectedNodeId" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.availableNodes) || body.availableNodes.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing or empty field: availableNodes" },
      { status: 400 },
    );
  }

  const availableNodes = body.availableNodes.filter(isAvailableNode);
  if (availableNodes.length === 0) {
    return NextResponse.json(
      { success: false, error: "No valid nodes in availableNodes" },
      { status: 400 },
    );
  }

  const buildParams: BuildNodeReasonerInputParams = {
    canvasModel: body.canvasModel,
    selectedConstellationId,
    selectedNodeId,
    availableNodes,
    purpose: body.purpose,
    worldPrompt: body.worldPrompt,
    architectureSummary: body.architectureSummary,
    existingCanon: body.existingCanon,
    userSteering: body.userSteering,
    depthContext: body.depthContext,
    localSummary: body.localSummary,
    explorationAxes: body.explorationAxes,
  };

  let input;
  try {
    input = buildNodeReasonerInput(buildParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid node selection";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  // ── Build GAME agent inputs ────────────────────────────────────────────────
  const existingCanon = body.existingCanon ?? [];
  const rejectedIds = Array.isArray(body.rejectedIds) ? body.rejectedIds : [];
  const rejectedTitles = Array.isArray(body.rejectedTitles) ? body.rejectedTitles : [];

  const memory = buildNodeReasonerMemory({
    worldSeed: body.canvasModel.worldSeed,
    worldPurpose: body.purpose ?? null,
    acceptedCanonItems: existingCanon,
    rejectedIds,
    activeSteeringText: body.userSteering?.instruction ?? null,
    architectureSummary: body.architectureSummary ?? null,
  });

  const environment = buildNodeReasonerEnvironment({
    navMode: "discovery",
    evolutionApplyInProgress: false,
    canonLocked: false,
    totalNodeCount: availableNodes.length,
    totalConstellationCount: body.canvasModel.constellations.length,
    canvasModelVersion: null,
  });

  const agentInput = buildNodeReasonerAgentInput(input, memory, environment, rejectedTitles);

  // ── Run agent ─────────────────────────────────────────────────────────────
  try {
    const agentResult = await runNodeReasonerAgent(agentInput);

    console.info("[node-reasoner]", JSON.stringify({
      selectedConstellationId,
      selectedNodeId,
      agentStatus: agentResult.status,
      attemptNumber: agentResult.attemptNumber,
      validationValid: agentResult.validation.valid,
      possibleNewNodeCount: agentResult.output?.possibleNewNodes.length ?? 0,
      scopeLevel: agentResult.output?.explorationScope.scopeLevel ?? null,
      fallbackCopy: agentResult.status === "fallback" ? agentResult.userFacingFallbackCopy : null,
    }));

    // ── Fallback path: return user-facing message without error ─────────────
    if (agentResult.status === "fallback" || agentResult.output === null) {
      return NextResponse.json({
        success: false,
        error: NODE_REASONER_FALLBACK_COPY,
        userFacingFallbackCopy: agentResult.userFacingFallbackCopy,
      }, { status: 200 });
    }

    // ── Success / partial-success: preserve existing API response shape ─────
    return NextResponse.json({ success: true, output: agentResult.output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Node reasoning failed";
    console.error("[node-reasoner] error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

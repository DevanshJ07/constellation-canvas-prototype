import { NextResponse } from "next/server";
import {
  buildConstellationReasonerInput,
  type BuildConstellationReasonerInputParams,
} from "@/lib/worldBrain/buildConstellationReasonerInput";
import type {
  LightweightCanonItem,
  UserSteeringInstruction,
} from "@/lib/worldBrain/constellationReasonerTypes";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { reasonConstellationWorld } from "@/lib/worldBrain/reasonConstellation";

type ConstellationReasonerRequestBody = {
  canvasModel?: CanvasWorldModel;
  selectedConstellationId?: string;
  purpose?: string;
  worldPrompt?: string;
  architectureSummary?: string;
  existingCanon?: LightweightCanonItem[];
  userSteering?: UserSteeringInstruction;
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

export async function POST(request: Request) {
  let body: ConstellationReasonerRequestBody;

  try {
    body = (await request.json()) as ConstellationReasonerRequestBody;
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

  const buildParams: BuildConstellationReasonerInputParams = {
    canvasModel: body.canvasModel,
    selectedConstellationId,
    purpose: body.purpose,
    worldPrompt: body.worldPrompt,
    architectureSummary: body.architectureSummary,
    existingCanon: body.existingCanon,
    userSteering: body.userSteering,
  };

  let input;
  try {
    input = buildConstellationReasonerInput(buildParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid constellation selection";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  try {
    const output = await reasonConstellationWorld(input);

    console.info(
      "[constellation-reasoner]",
      JSON.stringify({
        selectedConstellationId,
        startingNodeCount: output.startingNodes.length,
        explorationAxisCount: output.explorationAxes.length,
      }),
    );

    return NextResponse.json({ success: true, output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Constellation reasoning failed";
    console.error("[constellation-reasoner] error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

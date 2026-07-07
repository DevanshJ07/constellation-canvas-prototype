import { NextResponse } from "next/server";
import { buildRippleEffectInput } from "@/lib/worldBrain/buildRippleEffectPlan";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { reasonRippleEffect } from "@/lib/worldBrain/reasonRippleEffect";
import type {
  RippleAffectedScope,
  RippleEvaluationMode,
  RippleUserSteering,
} from "@/lib/worldBrain/rippleEffectTypes";
import type {
  CanonStateSnapshot,
  DecisionEventLog,
  UserDecisionEvent,
} from "@/lib/worldBrain/userDecisionTypes";

type RippleEffectRequestBody = {
  triggerEvent?: UserDecisionEvent;
  decisionLog?: DecisionEventLog;
  canvasModel?: CanvasWorldModel;
  activeCanonState?: CanonStateSnapshot;
  affectedScopeHint?: RippleAffectedScope;
  userSteering?: RippleUserSteering;
  evaluationMode?: RippleEvaluationMode;
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

function isUserDecisionEvent(value: unknown): value is UserDecisionEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  const target = event.target;
  const nodeSnapshot = event.nodeSnapshot;
  const worldContext = event.worldContext;
  if (!target || typeof target !== "object") return false;
  if (!nodeSnapshot || typeof nodeSnapshot !== "object") return false;
  if (!worldContext || typeof worldContext !== "object") return false;

  const t = target as Record<string, unknown>;
  const ns = nodeSnapshot as Record<string, unknown>;

  return (
    typeof event.id === "string" &&
    event.id.trim().length > 0 &&
    typeof event.eventType === "string" &&
    typeof event.decision === "string" &&
    typeof event.timestamp === "string" &&
    typeof event.source === "string" &&
    typeof t.id === "string" &&
    t.id.trim().length > 0 &&
    typeof t.title === "string" &&
    typeof t.displayTitle === "string" &&
    typeof t.targetType === "string" &&
    typeof ns.id === "string" &&
    ns.id.trim().length > 0 &&
    typeof ns.title === "string" &&
    typeof ns.displayTitle === "string" &&
    typeof ns.description === "string"
  );
}

function isDecisionEventLog(value: unknown): value is DecisionEventLog {
  if (!value || typeof value !== "object") return false;
  const log = value as Record<string, unknown>;
  return Array.isArray(log.events);
}

function isProviderConfigError(errors: string[]): boolean {
  return errors.some(
    (e) =>
      e.includes("Missing GEMINI_API_KEY") ||
      e.includes("Missing OPENROUTER_API_KEY") ||
      e.includes("LLM provider") ||
      e.includes("HTTP 5"),
  );
}

export async function POST(request: Request) {
  let body: RippleEffectRequestBody;

  try {
    body = (await request.json()) as RippleEffectRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body", errors: ["Invalid JSON body"], warnings: [] },
      { status: 400 },
    );
  }

  if (!body.triggerEvent || !isUserDecisionEvent(body.triggerEvent)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or invalid field: triggerEvent",
        errors: ["Missing or invalid field: triggerEvent"],
        warnings: [],
      },
      { status: 400 },
    );
  }

  if (!body.decisionLog || !isDecisionEventLog(body.decisionLog)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or invalid field: decisionLog",
        errors: ["Missing or invalid field: decisionLog"],
        warnings: [],
      },
      { status: 400 },
    );
  }

  if (!body.canvasModel || !isCanvasWorldModel(body.canvasModel)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or invalid field: canvasModel",
        errors: ["Missing or invalid field: canvasModel"],
        warnings: [],
      },
      { status: 400 },
    );
  }

  const rippleInput = buildRippleEffectInput({
    triggerEvent: body.triggerEvent,
    decisionLog: body.decisionLog,
    canvasModel: body.canvasModel,
    activeCanonState: body.activeCanonState,
    affectedScopeHint: body.affectedScopeHint,
    userSteering: body.userSteering,
    evaluationMode: body.evaluationMode,
  });

  const result = await reasonRippleEffect(rippleInput, {
    includeRawText: process.env.NODE_ENV === "development",
  });

  const payload = {
    success: result.success,
    output: result.output,
    warnings: result.warnings,
    errors: result.errors,
    validationResult: result.validationResult,
    providerMetadata: result.providerMetadata,
    ...(process.env.NODE_ENV === "development" && result.rawText
      ? { rawText: result.rawText.slice(0, 4000) }
      : {}),
  };

  if (result.success) {
    return NextResponse.json(payload, { status: 200 });
  }

  if (isProviderConfigError(result.errors)) {
    return NextResponse.json(
      { ...payload, error: result.errors[0] ?? "Provider error" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ...payload, error: result.errors[0] ?? "Ripple analysis could not be validated" },
    { status: 422 },
  );
}

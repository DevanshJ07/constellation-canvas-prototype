import { NextResponse } from "next/server";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
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
import { summarizeCanonStateFromEventLog } from "@/lib/worldBrain/decisionEventLog";
import {
  buildRippleConsequenceAgentInput,
  buildRippleConsequenceEnvironment,
  buildRippleConsequenceMemory,
  RIPPLE_AGENT_FALLBACK_COPY,
  runRippleConsequenceAgent,
} from "@/lib/worldBrain/agents/rippleConsequenceAgent";

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

  // Derive canon state from decision log if not provided
  const activeCanonState: CanonStateSnapshot =
    body.activeCanonState ?? summarizeCanonStateFromEventLog(body.decisionLog);

  // ── Build GAME agent inputs ────────────────────────────────────────────────
  const memory = buildRippleConsequenceMemory({
    worldSeed: body.canvasModel.worldSeed,
    worldPurpose: body.canvasModel.worldSummary ?? null,
    truthCanonIds: activeCanonState.truthNodeIds,
    truthCanonTitles: [],
    rejectedIds: activeCanonState.rejectedNodeIds,
    activeSteeringText: body.userSteering?.instruction ?? null,
    architectureSummary: body.canvasModel.worldSummary ?? null,
  });

  const environment = buildRippleConsequenceEnvironment({
    navMode: "discovery",
    evolutionApplyInProgress: false,
    canonLocked: false,
    totalNodeCount: body.canvasModel.nodes?.length ?? 0,
    totalConstellationCount: body.canvasModel.constellations.length,
    canvasModelVersion: null,
  });

  const agentInput = buildRippleConsequenceAgentInput(
    {
      triggerEvent: body.triggerEvent,
      decisionLog: body.decisionLog,
      canvasModel: body.canvasModel,
      activeCanonState,
      affectedScopeHint: body.affectedScopeHint,
      userSteering: body.userSteering,
      evaluationMode: body.evaluationMode,
    },
    memory,
    environment,
  );

  // ── Run agent ─────────────────────────────────────────────────────────────
  const routeStart = Date.now();
  let agentResult;
  try {
    agentResult = await runRippleConsequenceAgent(agentInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ripple failed";
    console.error("[ripple-effect] error:", message, {
      totalRouteMs: Date.now() - routeStart,
    });
    return NextResponse.json(
      {
        success: false,
        error: RIPPLE_AGENT_FALLBACK_COPY,
        errors: [RIPPLE_AGENT_FALLBACK_COPY],
        warnings: [],
      },
      { status: 200 },
    );
  }

  console.info("[ripple-effect]", JSON.stringify({
    requestId: agentInput.runId,
    triggerEventId: body.triggerEvent.id,
    triggerNodeTitle: body.triggerEvent.target.displayTitle,
    agentStatus: agentResult.status,
    attemptNumber: agentResult.attemptNumber,
    validationValid: agentResult.validation.valid,
    operationCount: agentResult.output?.suggestedOperations.length ?? 0,
    impactLevel: agentResult.output?.impactLevel ?? null,
    hasUserFacingSummary: Boolean(agentResult.output?.userFacingSummary),
    totalRouteMs: Date.now() - routeStart,
    stopReason: agentResult.stopReason,
  }));

  // ── Fallback path ─────────────────────────────────────────────────────────
  if (agentResult.status === "fallback" || agentResult.output === null) {
    const isProviderErr = agentResult.failure?.internalDetail?.includes("GEMINI_API_KEY") ||
      agentResult.failure?.internalDetail?.includes("OPENROUTER_API_KEY");

    if (isProviderErr) {
      return NextResponse.json(
        {
          success: false,
          error: agentResult.failure?.userMessage ?? RIPPLE_AGENT_FALLBACK_COPY,
          errors: [agentResult.failure?.internalDetail ?? "Provider error"],
          warnings: [],
        },
        { status: 500 },
      );
    }

    // Timeout / soft failure: truth already saved client-side — do not block UI
    return NextResponse.json(
      {
        success: false,
        error: agentResult.userFacingFallbackCopy || RIPPLE_AGENT_FALLBACK_COPY,
        errors: [],
        warnings: [],
        userFacingFallbackCopy: agentResult.userFacingFallbackCopy || RIPPLE_AGENT_FALLBACK_COPY,
      },
      { status: 200 },
    );
  }

  // ── Success / partial-success: preserve existing API response shape ────────
  const payload = {
    success: true,
    output: agentResult.output,
    warnings: agentResult.validation.issues
      .filter((i) => i.severity === "warning")
      .map((i) => i.message),
    errors: [],
    validationResult: {
      valid: agentResult.validation.valid,
      errors: agentResult.validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message),
      warnings: agentResult.validation.issues
        .filter((i) => i.severity === "warning")
        .map((i) => i.message),
    },
    ...(process.env.NODE_ENV === "development"
      ? {
          agentMeta: {
            agentStatus: agentResult.status,
            attemptNumber: agentResult.attemptNumber,
            validationSummary: agentResult.validation.summary,
          },
        }
      : {}),
  };

  return NextResponse.json(payload, { status: 200 });
}

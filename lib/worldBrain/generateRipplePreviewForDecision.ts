/**
 * Client-side helper to request Ripple Preview from a UserDecisionEvent (Phase 4.12).
 * Preview-only — does not apply operations or mutate canvas state.
 */

import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import {
  buildRipplePreviewModel,
  type RipplePreviewModel,
} from "@/lib/worldBrain/ripplePreviewModel";
import type {
  RippleAffectedScope,
  RippleEffectOutput,
  RippleEvaluationMode,
} from "@/lib/worldBrain/rippleEffectTypes";
import type {
  CanonStateSnapshot,
  DecisionEventLog,
  UserDecisionEvent,
} from "@/lib/worldBrain/userDecisionTypes";

export const RIPPLE_PREVIEW_FRIENDLY_ERROR =
  "Ripple preview could not be generated yet.";

export type RippleTitleLookupMaps = {
  nodeTitleById: Record<string, string>;
  constellationTitleById: Record<string, string>;
};

export type BuildRippleTitleLookupsInput = {
  canvasModel?: CanvasWorldModel | null;
  reasonedNodeDetails?: Record<
    string,
    { displayTitle?: string; fullTitle?: string }
  >;
  nodeReasonerPanelMeta?: Record<
    string,
    { displayTitle?: string; fullTitle?: string }
  >;
  nodeOverrides?: Record<string, { title?: string }>;
};

export function buildRippleTitleLookupMaps(
  input: BuildRippleTitleLookupsInput,
): RippleTitleLookupMaps {
  const nodeTitleById: Record<string, string> = {};
  const constellationTitleById: Record<string, string> = {};

  if (input.canvasModel) {
    for (const constellation of input.canvasModel.constellations) {
      constellationTitleById[constellation.id] =
        constellation.displayTitle?.trim() ||
        constellation.title.trim() ||
        constellation.id;
    }
    for (const node of input.canvasModel.nodes) {
      nodeTitleById[node.id] = node.title.trim() || node.id;
    }
  }

  for (const [id, meta] of Object.entries(input.reasonedNodeDetails ?? {})) {
    nodeTitleById[id] =
      meta.displayTitle?.trim() ||
      meta.fullTitle?.trim() ||
      nodeTitleById[id] ||
      id;
  }

  for (const [id, meta] of Object.entries(input.nodeReasonerPanelMeta ?? {})) {
    nodeTitleById[id] =
      meta.displayTitle?.trim() ||
      meta.fullTitle?.trim() ||
      nodeTitleById[id] ||
      id;
  }

  for (const [id, override] of Object.entries(input.nodeOverrides ?? {})) {
    if (override.title?.trim()) {
      nodeTitleById[id] = override.title.trim();
    }
  }

  return { nodeTitleById, constellationTitleById };
}

export type GenerateRipplePreviewParams = {
  triggerEvent: UserDecisionEvent;
  decisionLog: DecisionEventLog;
  canvasModel: CanvasWorldModel;
  activeCanonState?: CanonStateSnapshot;
  affectedScopeHint?: RippleAffectedScope;
  evaluationMode?: RippleEvaluationMode;
  nodeTitleById?: Record<string, string>;
  constellationTitleById?: Record<string, string>;
};

export type GenerateRipplePreviewResult =
  | { ok: true; preview: RipplePreviewModel }
  | { ok: false; error: string };

type RippleEffectApiResponse = {
  success?: boolean;
  output?: RippleEffectOutput;
  error?: string;
  errors?: string[];
};

export async function generateRipplePreviewForDecision(
  params: GenerateRipplePreviewParams,
): Promise<GenerateRipplePreviewResult> {
  try {
    const res = await fetch("/api/world/ripple-effect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerEvent: params.triggerEvent,
        decisionLog: params.decisionLog,
        canvasModel: params.canvasModel,
        activeCanonState: params.activeCanonState,
        affectedScopeHint: params.affectedScopeHint ?? "node",
        evaluationMode: params.evaluationMode ?? "balanced",
      }),
    });

    let data: RippleEffectApiResponse;
    try {
      data = (await res.json()) as RippleEffectApiResponse;
    } catch {
      return { ok: false, error: RIPPLE_PREVIEW_FRIENDLY_ERROR };
    }

    if (!data.success || !data.output) {
      return { ok: false, error: RIPPLE_PREVIEW_FRIENDLY_ERROR };
    }

    const preview = buildRipplePreviewModel(data.output, {
      nodeTitleById: params.nodeTitleById,
      constellationTitleById: params.constellationTitleById,
      title: `Ripple — ${params.triggerEvent.target.displayTitle}`,
    });

    return { ok: true, preview };
  } catch {
    return { ok: false, error: RIPPLE_PREVIEW_FRIENDLY_ERROR };
  }
}

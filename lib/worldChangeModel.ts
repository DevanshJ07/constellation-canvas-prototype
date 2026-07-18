/**
 * Creator-facing world change card model (Phase 6C).
 * Maps ripple/evolution data to plain-language copy — no backend terms.
 */

import { simplifyDisplayLabel } from "@/lib/simplifyDisplayLabel";
import { sanitizeCreatorCopy } from "@/lib/creatorCopy";
import { canOpenWorldEvolutionPreview } from "@/lib/rippleUserFlow";
import type { RipplePreviewModel } from "@/lib/worldBrain/ripplePreviewModel";
import type { WorldEvolutionApplyDryRunResult } from "@/lib/worldBrain/worldEvolutionApplyDryRun";

export type WorldChangeCardPhase = "pending" | "ready" | "failed" | "canon_only";

export type WorldChangeCardModel = {
  phase: WorldChangeCardPhase;
  title: string;
  subtitle: string;
  summary: string;
  affectedAreas: string[];
  consequences: string[];
  caution?: string;
  isEmpty: boolean;
  canAccept: boolean;
  reviewNeededMessage?: string;
};

export function buildPendingWorldChangeCardModel(): WorldChangeCardModel {
  return {
    phase: "pending",
    title: "Added to Canon",
    subtitle: "Truth added. Checking what changes…",
    summary:
      "Your choice is now true in this world. We're tracing what shifts, unlocks, or comes under pressure because of it.",
    affectedAreas: [],
    consequences: [],
    isEmpty: false,
    canAccept: false,
  };
}

export function buildFailedWorldChangeCardModel(): WorldChangeCardModel {
  return {
    phase: "failed",
    title: "Added to Canon",
    subtitle: "Your truth is saved",
    summary:
      "This truth has been added. The world needs a little more context before it changes.",
    affectedAreas: [],
    consequences: [],
    isEmpty: true,
    canAccept: false,
  };
}

const IMPACT_PHRASES: Record<RipplePreviewModel["impactLevel"], string> = {
  none: "A small adjustment",
  minor: "A small shift",
  moderate: "A noticeable shift",
  major: "A major shift",
  structural: "A deep structural shift",
};

function plainConsequence(text: string): string {
  return simplifyDisplayLabel(text)
    .replace(/\boperation\b/gi, "change")
    .replace(/\bpatch\b/gi, "update")
    .replace(/\bblocker\b/gi, "conflict");
}

export function buildWorldChangeCardModel(
  preview: RipplePreviewModel,
  dryRun?: WorldEvolutionApplyDryRunResult | null,
): WorldChangeCardModel {
  const affectedAreas = [
    ...preview.affectedConstellationPreviews.map((item) =>
      simplifyDisplayLabel(item.title ?? item.constellationId),
    ),
    ...preview.affectedNodePreviews
      .filter(
        (item) =>
          !preview.affectedConstellationPreviews.some(
            (c) => c.constellationId === item.constellationId,
          ),
      )
      .slice(0, 2)
      .map((item) => simplifyDisplayLabel(item.title ?? item.nodeId)),
  ].slice(0, 4);

  // Prefer GAME Phase 8C userFacingBullets when present on the source output
  // (stored on preview model via passthrough — fall back to operation reasons)
  const rawBullets =
    "userFacingBullets" in preview && Array.isArray((preview as Record<string, unknown>)["userFacingBullets"])
      ? ((preview as Record<string, unknown>)["userFacingBullets"] as string[]).slice(0, 4)
      : null;

  const consequences = rawBullets && rawBullets.length > 0
    ? rawBullets.map((b) => sanitizeCreatorCopy(b))
    : preview.operationPreviews
        .filter((op) => op.approvalState !== "rejected")
        .slice(0, 4)
        .map((op) => plainConsequence(op.reason || op.title || op.description));

  const attentionWarnings = preview.warningPreviews.filter(
    (w) => w.requiresUserAttention,
  );
  const caution =
    attentionWarnings.length > 0
      ? attentionWarnings[0].message.length > 120
        ? `${attentionWarnings[0].message.slice(0, 117)}…`
        : attentionWarnings[0].message
      : undefined;

  const isEmpty =
    preview.operationPreviews.filter((op) => op.approvalState !== "rejected").length ===
      0 && preview.counts.operationCount === 0;

  const applyReady = canOpenWorldEvolutionPreview(preview);
  const dryRunReady =
    dryRun?.status === "ready_for_confirmation" &&
    dryRun.patchCandidates.some((p) => p.status === "ready" && p.patchType !== "no_op");

  let reviewNeededMessage: string | undefined;
  if (isEmpty) {
    reviewNeededMessage = undefined;
  } else if (!applyReady) {
    reviewNeededMessage = "Some changes need review before they can be applied.";
  } else if (dryRun && !dryRunReady) {
    reviewNeededMessage = "Some changes need review before they can be applied.";
  }

  // Prefer GAME Phase 8C userFacingSummary when present
  const rawUserFacingSummary =
    "userFacingSummary" in preview && typeof (preview as Record<string, unknown>)["userFacingSummary"] === "string"
      ? ((preview as Record<string, unknown>)["userFacingSummary"] as string)
      : null;

  return {
    phase: "ready",
    title: "This changes your world",
    subtitle: IMPACT_PHRASES[preview.impactLevel] ?? "Your world will shift",
    summary: rawUserFacingSummary
      ? sanitizeCreatorCopy(rawUserFacingSummary)
      : sanitizeCreatorCopy(preview.summary),
    affectedAreas,
    consequences,
    ...(caution ? { caution } : {}),
    isEmpty,
    canAccept: !isEmpty && (applyReady ? dryRunReady || !dryRun : false),
    ...(reviewNeededMessage && !dryRunReady ? { reviewNeededMessage } : {}),
  };
}

export function getWorldChangeUserMessage(code: string): string {
  switch (code) {
    case "review_needed":
      return "Some changes need review before they can be applied.";
    case "canon_protected":
      return "This change is protected because it affects canon.";
    case "empty":
      return "No world changes needed yet.";
    case "needs_context":
      return "The world needs more context before evolving.";
    case "applied":
      return "Your world has been updated.";
    case "declined":
      return "World changes were dismissed.";
    default:
      return "Some changes need review before they can be applied.";
  }
}

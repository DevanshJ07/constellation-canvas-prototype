"use client";

import type { RipplePreviewModel } from "@/lib/worldBrain/ripplePreviewModel";
import { simplifyDisplayLabel } from "@/lib/simplifyDisplayLabel";
import {
  countPendingReviewItems,
  deriveRippleConsequenceFlowState,
  getRippleAcceptanceButtonLabel,
  getRippleAcceptanceState,
  hasPendingSafeOperations,
  type RippleConsequenceFlowState,
} from "@/lib/rippleUserFlow";

type RippleConsequenceCardProps = {
  preview: RipplePreviewModel;
  onAcceptSafeChanges: () => void;
  onReviewSuggestedChanges: () => void;
  onReviewDetails: () => void;
  onDone: () => void;
  onDecline: () => void;
  onClose?: () => void;
};

const IMPACT_LABELS: Record<RipplePreviewModel["impactLevel"], string> = {
  none: "Minimal impact",
  minor: "Minor impact",
  moderate: "Moderate impact",
  major: "Major impact",
  structural: "Structural impact",
};

const STATE_COPY: Record<
  RippleConsequenceFlowState,
  { title: string; body: string; showDecline: boolean }
> = {
  ready: {
    title: "Your choice changes the world",
    body: "",
    showDecline: true,
  },
  needs_review: {
    title: "Some changes need your review",
    body: "A few consequences are important or risky, so review them before the world evolves.",
    showDecline: true,
  },
  blocked: {
    title: "World evolution paused",
    body: "This choice creates a conflict or unsafe change. Review details before continuing.",
    showDecline: true,
  },
  empty: {
    title: "No major world changes",
    body: "This choice has been added to canon, but it does not require world evolution yet.",
    showDecline: false,
  },
};

export default function RippleConsequenceCard({
  preview,
  onAcceptSafeChanges,
  onReviewSuggestedChanges,
  onReviewDetails,
  onDone,
  onDecline,
  onClose,
}: RippleConsequenceCardProps) {
  const flowState = deriveRippleConsequenceFlowState(preview);
  const acceptanceState = getRippleAcceptanceState(preview);
  const copy = STATE_COPY[flowState];
  const primaryLabel = getRippleAcceptanceButtonLabel(acceptanceState);
  const pendingReviewCount = countPendingReviewItems(preview);
  const hasSafeToAccept = hasPendingSafeOperations(preview);

  const suggestedChanges = preview.operationPreviews
    .filter((op) => op.approvalState !== "rejected")
    .slice(0, 4)
    .map((op) => simplifyDisplayLabel(op.title || op.description || op.reason));

  const affectedAreas = [
    ...preview.affectedConstellationPreviews.map((item) =>
      simplifyDisplayLabel(item.title ?? item.constellationId),
    ),
    ...preview.affectedNodePreviews
      .filter(
        (item) =>
          !preview.affectedConstellationPreviews.some(
            (constellation) => constellation.constellationId === item.constellationId,
          ),
      )
      .slice(0, 2)
      .map((item) => simplifyDisplayLabel(item.title ?? item.nodeId)),
  ].slice(0, 4);

  const warningCount = preview.counts.warningCount;

  function handlePrimary() {
    switch (acceptanceState) {
      case "ready_to_accept":
      case "partial_accept":
        onAcceptSafeChanges();
        break;
      case "needs_review_first":
        onReviewSuggestedChanges();
        break;
      case "blocked":
        onReviewDetails();
        break;
      case "empty":
        onDone();
        break;
    }
  }

  const primaryStyle =
    flowState === "empty"
      ? "border-slate-600/50 bg-slate-900/50 text-slate-200 hover:bg-slate-900/70"
      : flowState === "blocked"
        ? "border-amber-700/50 bg-amber-950/35 text-amber-200 hover:bg-amber-950/50"
        : flowState === "needs_review"
          ? "border-violet-700/50 bg-violet-950/35 text-violet-200 hover:bg-violet-950/50"
          : "border-emerald-700/50 bg-emerald-950/35 text-emerald-200 hover:bg-emerald-950/50";

  return (
    <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-violet-500/35 bg-slate-950/97 shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_32px_rgba(139,92,246,0.12)]">
      <header className="flex items-start justify-between gap-3 border-b border-violet-900/30 bg-violet-950/20 px-4 py-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
            World ripple
          </p>
          <h2 className="mt-1 text-sm font-medium text-slate-100">{copy.title}</h2>
          {flowState === "ready" && (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-violet-300/60">
              {IMPACT_LABELS[preview.impactLevel] ?? preview.impactLevel}
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 transition hover:text-slate-300"
            aria-label="Close ripple consequence"
          >
            ×
          </button>
        )}
      </header>

      <div className="space-y-3 px-4 py-3">
        {copy.body && (
          <p className="text-xs leading-relaxed text-slate-300">{copy.body}</p>
        )}

        {acceptanceState === "partial_accept" && (
          <p className="rounded-md border border-amber-900/35 bg-amber-950/15 px-2.5 py-1.5 text-[10px] text-amber-200/90">
            Safe changes can be accepted now. Important or risky changes still need your review.
          </p>
        )}

        {flowState === "ready" && (
          <p className="text-xs leading-relaxed text-slate-300">{preview.summary}</p>
        )}

        {affectedAreas.length > 0 && flowState !== "empty" && (
          <section>
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Affected areas ({preview.counts.affectedConstellationCount || affectedAreas.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {affectedAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-full border border-violet-800/40 bg-violet-950/25 px-2 py-0.5 text-[10px] text-violet-200/90"
                >
                  {area}
                </span>
              ))}
            </div>
          </section>
        )}

        {suggestedChanges.length > 0 && flowState !== "empty" && (
          <section>
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Suggested changes
            </p>
            <ul className="space-y-1">
              {suggestedChanges.map((change) => (
                <li
                  key={change}
                  className="flex items-start gap-2 text-[11px] leading-snug text-slate-300"
                >
                  <span className="mt-0.5 text-violet-400/70">→</span>
                  {change}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pendingReviewCount > 0 && flowState === "needs_review" && (
          <p className="rounded-md border border-amber-900/35 bg-amber-950/15 px-2.5 py-1.5 text-[10px] text-amber-200/90">
            {pendingReviewCount} item{pendingReviewCount === 1 ? "" : "s"} need your approval
            before the world can evolve
          </p>
        )}

        {hasSafeToAccept && acceptanceState === "partial_accept" && (
          <p className="text-[10px] text-slate-500">
            {primaryLabel} will approve low-risk changes only.
          </p>
        )}

        {warningCount > 0 && flowState === "ready" && (
          <p className="rounded-md border border-amber-900/35 bg-amber-950/15 px-2.5 py-1.5 text-[10px] text-amber-200/90">
            {warningCount} note{warningCount === 1 ? "" : "s"} to be aware of
          </p>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-slate-800/70 px-4 py-3">
        <button
          type="button"
          onClick={handlePrimary}
          className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold transition ${primaryStyle}`}
        >
          {primaryLabel}
        </button>
        {copy.showDecline && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDecline}
              className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400 transition hover:text-slate-200"
            >
              Decline
            </button>
            {flowState !== "blocked" && (
              <button
                type="button"
                onClick={onReviewDetails}
                className="flex-1 rounded-lg border border-violet-700/50 bg-violet-950/30 px-3 py-2 text-[11px] font-medium text-violet-200 transition hover:bg-violet-950/45"
              >
                Review details
              </button>
            )}
          </div>
        )}
      </footer>
    </aside>
  );
}

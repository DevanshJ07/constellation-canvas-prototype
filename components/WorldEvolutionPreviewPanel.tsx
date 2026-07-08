"use client";

import { useMemo, useState } from "react";
import type {
  EvolutionActionPreviewItem,
  EvolutionBlockerPreviewItem,
  EvolutionPatchPreviewItem,
  EvolutionPreviewStatus,
  EvolutionWarningPreviewItem,
  BuildWorldEvolutionPreviewModelOptions,
  WorldEvolutionPreviewModel,
} from "@/lib/worldBrain/worldEvolutionPreviewModel";
import { buildDryRunPreviewGroups } from "@/lib/worldBrain/worldEvolutionPreviewModel";
import type { WorldEvolutionApplyDryRunResult } from "@/lib/worldBrain/worldEvolutionApplyDryRun";
import { getEvolutionPreviewUserLabel } from "@/lib/rippleUserFlow";

export type WorldEvolutionConfirmApplyArgs = {
  selectedPatchIds: string[];
  allowNeedsReviewPatches: boolean;
};

type WorldEvolutionPreviewPanelProps = {
  preview: WorldEvolutionPreviewModel;
  applyDryRun?: WorldEvolutionApplyDryRunResult | null;
  dryRunTitleLookup?: BuildWorldEvolutionPreviewModelOptions;
  onClose?: () => void;
  onConfirmApply?: (args: WorldEvolutionConfirmApplyArgs) => void;
  isApplying?: boolean;
  applyError?: string | null;
  applyNotice?: string | null;
  onUndoLastApply?: () => void;
  canUndoLastApply?: boolean;
  undoNotice?: string | null;
  undoError?: string | null;
};

type ApplyButtonState = {
  disabled: boolean;
  label: string;
};

function getApplyButtonState(
  applyDryRun: WorldEvolutionApplyDryRunResult | null | undefined,
  dryRunGroups: ReturnType<typeof buildDryRunPreviewGroups>,
): ApplyButtonState {
  if (!applyDryRun || !dryRunGroups) {
    return { disabled: true, label: "Not ready to apply yet" };
  }

  if (applyDryRun.status === "failed") {
    return { disabled: true, label: "More review needed" };
  }

  if (applyDryRun.status === "blocked") {
    return { disabled: true, label: "Changes blocked for now" };
  }

  if (applyDryRun.status === "empty") {
    return { disabled: true, label: "No changes to apply" };
  }

  const hasReady = dryRunGroups.readyPatches.length > 0;
  const hasNeedsReview = dryRunGroups.needsReviewPatches.length > 0;

  if (!hasReady && !hasNeedsReview) {
    return { disabled: true, label: "No eligible changes" };
  }

  if (!hasReady && hasNeedsReview) {
    return { disabled: false, label: "Review and apply" };
  }

  return { disabled: false, label: "Review and apply" };
}

function getUserFacingEvolutionMessage(preview: WorldEvolutionPreviewModel): string {
  if (preview.isFailed) {
    return "More review is needed before applying world changes.";
  }
  if (preview.isBlocked) {
    return "Some changes are blocked to protect canon.";
  }
  if (preview.isEmpty) {
    return "No evolution actions were planned from the current approved changes.";
  }
  return preview.summary;
}

const STATUS_STYLES: Record<
  Exclude<EvolutionPreviewStatus, "no_plan">,
  { badge: string; label: string }
> = {
  ready_for_preview: {
    badge: "border-emerald-700/50 bg-emerald-950/30 text-emerald-300",
    label: "Ready",
  },
  needs_review: {
    badge: "border-amber-700/50 bg-amber-950/25 text-amber-200",
    label: "Needs review",
  },
  blocked: {
    badge: "border-rose-700/50 bg-rose-950/25 text-rose-200",
    label: "Blocked",
  },
  empty: {
    badge: "border-slate-600/60 bg-slate-900/50 text-slate-400",
    label: "Empty",
  },
  failed: {
    badge: "border-slate-600/60 bg-slate-900/50 text-slate-400",
    label: "Failed",
  },
};

const ACTION_STATUS_STYLES: Record<string, string> = {
  ready: "border-emerald-800/40 bg-emerald-950/15 text-emerald-300",
  downgraded: "border-amber-800/40 bg-amber-950/15 text-amber-200",
  skipped: "border-slate-700/50 bg-slate-900/30 text-slate-400",
  blocked: "border-rose-800/45 bg-rose-950/20 text-rose-200",
};

const RISK_STYLES = {
  low: "text-slate-500",
  medium: "text-amber-400/90",
  high: "text-rose-400/90",
} as const;

const BLOCKER_KIND_STYLES: Record<string, string> = {
  canon_protection: "border-teal-800/40 bg-teal-950/15 text-teal-200",
  validation: "border-slate-700/50 bg-slate-900/35 text-slate-300",
  node_budget: "border-violet-800/40 bg-violet-950/15 text-violet-200",
  steering: "border-fuchsia-800/40 bg-fuchsia-950/15 text-fuchsia-200",
  conflict: "border-orange-800/40 bg-orange-950/15 text-orange-200",
  confidence: "border-amber-800/40 bg-amber-950/15 text-amber-200",
};

const DRY_RUN_STATUS_STYLES: Record<
  WorldEvolutionApplyDryRunResult["status"],
  { badge: string; label: string }
> = {
  ready_for_confirmation: {
    badge: "border-emerald-700/50 bg-emerald-950/30 text-emerald-300",
    label: "Ready for confirmation",
  },
  needs_review: {
    badge: "border-amber-700/50 bg-amber-950/25 text-amber-200",
    label: "Needs review",
  },
  blocked: {
    badge: "border-rose-700/50 bg-rose-950/25 text-rose-200",
    label: "Blocked",
  },
  empty: {
    badge: "border-slate-600/60 bg-slate-900/50 text-slate-400",
    label: "Empty",
  },
  failed: {
    badge: "border-slate-600/60 bg-slate-900/50 text-slate-400",
    label: "Failed",
  },
};

const PATCH_STATUS_STYLES: Record<string, string> = {
  ready: "border-emerald-800/40 bg-emerald-950/15 text-emerald-300",
  needs_review: "border-amber-800/40 bg-amber-950/15 text-amber-200",
  blocked: "border-rose-800/45 bg-rose-950/20 text-rose-200",
};

function PatchCard({ patch }: { patch: EvolutionPatchPreviewItem }) {
  return (
    <li className="rounded-md border border-indigo-900/25 bg-indigo-950/10 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">{patch.patchTypeLabel}</p>
          <p className="mt-0.5 text-xs text-slate-400">{patch.targetLabel}</p>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
            PATCH_STATUS_STYLES[patch.status] ?? PATCH_STATUS_STYLES.blocked
          }`}
        >
          {patch.statusLabel}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{patch.reason}</p>
      <p className="mt-1 text-[11px] text-slate-500">{patch.previewSummary}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <span>Reversible: {patch.reversible ? "yes" : "no"}</span>
        <span>
          Confirm: {patch.requiresConfirmation ? "yes" : "no"}
          {patch.requiresConfirmation ? " ⚑" : ""}
        </span>
      </div>
      <p className="mt-1.5 truncate text-[10px] text-slate-600">
        Source action: {patch.sourceActionId}
      </p>
      {patch.relatedBlockers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {patch.relatedBlockers.map((blocker) => (
            <li
              key={blocker.id}
              className="rounded border border-rose-900/30 bg-rose-950/10 px-2 py-1 text-[10px] text-rose-200/90"
            >
              <span className="font-medium">{blocker.kind}: </span>
              {blocker.message}
            </li>
          ))}
        </ul>
      )}
      {patch.relatedWarnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {patch.relatedWarnings.map((warning) => (
            <li
              key={warning.id}
              className="rounded border border-amber-900/30 bg-amber-950/10 px-2 py-1 text-[10px] text-amber-100/90"
            >
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PatchSection({
  title,
  patches,
}: {
  title: string;
  patches: EvolutionPatchPreviewItem[];
}) {
  if (patches.length === 0) return null;
  return (
    <section>
      <h4 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h4>
      <ul className="space-y-2">
        {patches.map((patch) => (
          <PatchCard key={patch.id} patch={patch} />
        ))}
      </ul>
    </section>
  );
}

function DryRunPatchPreview({
  applyDryRun,
  titleLookup,
}: {
  applyDryRun: WorldEvolutionApplyDryRunResult;
  titleLookup?: BuildWorldEvolutionPreviewModelOptions;
}) {
  const dryRunGroups = buildDryRunPreviewGroups(applyDryRun, titleLookup);
  if (!dryRunGroups) return null;

  const statusStyle = DRY_RUN_STATUS_STYLES[dryRunGroups.status];

  return (
    <section className="rounded-md border border-indigo-900/30 bg-indigo-950/10 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[9px] font-semibold uppercase tracking-wider text-indigo-300/80">
            Canvas Patch Dry Run
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            These are the exact canvas-level patch candidates that would be created if apply is
            enabled later. Nothing is applied yet.
          </p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusStyle.badge}`}
        >
          {dryRunGroups.displayStatus}
        </span>
      </div>

      <p className="mb-3 text-xs text-slate-400">{dryRunGroups.summary}</p>

      {(dryRunGroups.isEmpty || dryRunGroups.isFailed) && (
        <p className="mb-3 text-xs text-slate-500">
          {dryRunGroups.isEmpty && "No patch candidates were produced."}
          {dryRunGroups.isFailed && "Dry-run failed — evolution plan is not apply-ready."}
        </p>
      )}

      <div className="space-y-3">
        <PatchSection title="Ready patches" patches={dryRunGroups.readyPatches} />
        <PatchSection title="Needs review patches" patches={dryRunGroups.needsReviewPatches} />
        <PatchSection title="Blocked patches" patches={dryRunGroups.blockedPatches} />
        <PatchSection title="Skipped / no-op patches" patches={dryRunGroups.skippedPatches} />
      </div>

      {dryRunGroups.blockers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-rose-400/80">
            Dry-run blockers
          </p>
          {dryRunGroups.blockers.map((blocker) => (
            <p key={blocker.id} className="text-[10px] text-rose-200/85">
              {blocker.kind}: {blocker.message}
            </p>
          ))}
        </div>
      )}

      {dryRunGroups.warnings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-400/80">
            Dry-run warnings
          </p>
          {dryRunGroups.warnings.map((warning) => (
            <p key={warning.id} className="text-[10px] text-amber-100/85">
              {warning.message}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function ActionCard({ action }: { action: EvolutionActionPreviewItem }) {
  return (
    <li className="rounded-md border border-cyan-900/20 bg-cyan-950/10 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">{action.actionTypeLabel}</p>
          <p className="mt-0.5 text-xs text-slate-400">{action.targetLabel}</p>
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
            ACTION_STATUS_STYLES[action.status] ?? ACTION_STATUS_STYLES.skipped
          }`}
        >
          {action.statusLabel}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{action.reason}</p>
      <p className="mt-1 text-[11px] text-slate-500">{action.userSummary}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
        <span>Confidence: {action.confidenceLabel}</span>
        <span className={RISK_STYLES[action.riskLevel as keyof typeof RISK_STYLES] ?? RISK_STYLES.medium}>
          Risk: {action.riskLevel}
        </span>
        <span>Reversible: {action.reversible ? "yes" : "no"}</span>
        <span>Confirm: {action.requiresUserConfirmation ? "yes" : "no"}</span>
      </div>
      <p className="mt-1.5 truncate text-[10px] text-slate-600">
        Source: {action.sourceOperationId}
      </p>
      {action.propagation && (
        <p className="mt-1 text-[10px] text-slate-600">
          Propagation: {action.propagation.scope} · {action.propagation.hopsFromTrigger} hop
          {action.propagation.hopsFromTrigger === 1 ? "" : "s"}
          {action.propagation.cappedByPolicy ? " · capped" : ""}
        </p>
      )}
      {action.stopReason && (
        <p className="mt-1 text-[10px] text-amber-400/80">
          Stop reason: {action.stopReason.replace(/_/g, " ")}
        </p>
      )}
    </li>
  );
}

function ActionSection({
  title,
  actions,
}: {
  title: string;
  actions: EvolutionActionPreviewItem[];
}) {
  if (actions.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      <ul className="space-y-2">
        {actions.map((action) => (
          <ActionCard key={action.id} action={action} />
        ))}
      </ul>
    </section>
  );
}

function BlockerList({ blockers }: { blockers: EvolutionBlockerPreviewItem[] }) {
  if (blockers.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-rose-400/80">
        Blockers
      </h3>
      <ul className="space-y-2">
        {blockers.map((blocker) => (
          <li
            key={blocker.id}
            className={`rounded-md border px-3 py-2.5 ${
              BLOCKER_KIND_STYLES[blocker.kind] ??
              "border-rose-800/40 bg-rose-950/15 text-rose-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{blocker.kindLabel}</p>
              {blocker.stopReason && (
                <span className="rounded border border-current/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider opacity-80">
                  {blocker.stopReason.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{blocker.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WarningList({ warnings }: { warnings: EvolutionWarningPreviewItem[] }) {
  if (warnings.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-amber-400/80">
        Warnings
      </h3>
      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.id}
            className="rounded-md border border-amber-800/35 bg-amber-950/10 px-3 py-2.5 text-amber-100/90"
          >
            <p className="text-[10px] uppercase tracking-wider text-amber-400/70">
              {warning.warningTypeLabel}
            </p>
            <p className="mt-1 text-xs leading-relaxed">{warning.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApplyConfirmationModal({
  applyDryRun,
  dryRunGroups,
  onClose,
  onConfirmApply,
  isApplying = false,
  applyError = null,
}: {
  applyDryRun: WorldEvolutionApplyDryRunResult;
  dryRunGroups: NonNullable<ReturnType<typeof buildDryRunPreviewGroups>>;
  onClose: () => void;
  onConfirmApply?: (args: WorldEvolutionConfirmApplyArgs) => void;
  isApplying?: boolean;
  applyError?: string | null;
}) {
  const [batchAcknowledged, setBatchAcknowledged] = useState(false);
  const [includeNeedsReview, setIncludeNeedsReview] = useState(false);

  const readyPatchIds = useMemo(
    () => dryRunGroups.readyPatches.map((patch) => patch.id),
    [dryRunGroups.readyPatches],
  );
  const needsReviewPatchIds = useMemo(
    () => dryRunGroups.needsReviewPatches.map((patch) => patch.id),
    [dryRunGroups.needsReviewPatches],
  );

  const selectedPatchIds = useMemo(
    () => [
      ...readyPatchIds,
      ...(includeNeedsReview ? needsReviewPatchIds : []),
    ],
    [readyPatchIds, needsReviewPatchIds, includeNeedsReview],
  );

  const patchTypesIncluded = useMemo(() => {
    const types = new Set<string>();
    for (const patch of applyDryRun.patchCandidates) {
      if (selectedPatchIds.includes(patch.id) && patch.patchType !== "no_op") {
        types.add(patch.patchType.replace(/_/g, " "));
      }
    }
    return [...types];
  }, [applyDryRun.patchCandidates, selectedPatchIds]);

  const confirmationRequiredPatches = useMemo(
    () =>
      applyDryRun.patchCandidates.filter(
        (patch) =>
          selectedPatchIds.includes(patch.id) &&
          patch.requiresConfirmation &&
          patch.patchType !== "no_op",
      ),
    [applyDryRun.patchCandidates, selectedPatchIds],
  );

  const canConfirm =
    selectedPatchIds.length > 0 &&
    batchAcknowledged &&
    Boolean(onConfirmApply) &&
    !isApplying;

  function handleConfirm() {
    if (!onConfirmApply || !canConfirm) return;
    onConfirmApply({
      selectedPatchIds,
      allowNeedsReviewPatches: includeNeedsReview,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center pb-16 sm:items-center sm:pb-0"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-[#0a0a0f]/60 backdrop-blur-[2px]" />

      <div
        className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-indigo-900/40 bg-slate-950/98 shadow-[0_8px_48px_rgba(0,0,0,0.7)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="evolution-apply-confirm-title"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800/70 px-4 py-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-indigo-400/80">
              Guarded Apply Confirmation
            </p>
            <h2
              id="evolution-apply-confirm-title"
              className="mt-1 text-sm font-medium text-slate-100"
            >
              Review canvas patch apply
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 transition hover:text-slate-300"
            aria-label="Close apply confirmation"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <section className="rounded-md border border-amber-900/35 bg-amber-950/15 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-amber-100/90">
              {onConfirmApply
                ? "Confirming will run the guarded apply executor on the current canvas snapshot."
                : "This confirmation prepares validated patch candidates for canvas apply. In this phase, the panel does not mutate the canvas itself."}
            </p>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-emerald-900/30 bg-emerald-950/15 px-2.5 py-2 text-center">
              <p className="text-lg font-semibold text-emerald-300">{dryRunGroups.readyPatches.length}</p>
              <p className="text-[9px] uppercase tracking-wider text-emerald-400/70">Ready</p>
            </div>
            <div className="rounded-md border border-amber-900/30 bg-amber-950/15 px-2.5 py-2 text-center">
              <p className="text-lg font-semibold text-amber-200">{dryRunGroups.needsReviewPatches.length}</p>
              <p className="text-[9px] uppercase tracking-wider text-amber-400/70">Needs review</p>
            </div>
            <div className="rounded-md border border-rose-900/30 bg-rose-950/15 px-2.5 py-2 text-center">
              <p className="text-lg font-semibold text-rose-200">{dryRunGroups.blockedPatches.length}</p>
              <p className="text-[9px] uppercase tracking-wider text-rose-400/70">Blocked</p>
            </div>
          </section>

          <section className="rounded-md border border-slate-800/60 bg-slate-900/35 px-3 py-2.5">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Selected for apply
            </p>
            <p className="text-xs text-slate-300">
              {selectedPatchIds.length} patch{selectedPatchIds.length === 1 ? "" : "es"} selected
              {patchTypesIncluded.length > 0
                ? ` · ${patchTypesIncluded.join(", ")}`
                : ""}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Ready patches are included by default. Needs-review patches are excluded unless opted in.
            </p>
          </section>

          {confirmationRequiredPatches.length > 0 && (
            <section>
              <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-amber-400/80">
                Confirmation required
              </h3>
              <ul className="space-y-1.5">
                {confirmationRequiredPatches.map((patch) => (
                  <li
                    key={patch.id}
                    className="rounded border border-amber-900/30 bg-amber-950/10 px-2.5 py-2 text-[11px] text-amber-100/90"
                  >
                    <span className="font-medium">{patch.patchType.replace(/_/g, " ")}</span>
                    <span className="text-amber-200/70"> · {patch.target.id}</span>
                    <p className="mt-0.5 text-[10px] text-amber-200/60">{patch.previewSummary}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {dryRunGroups.blockedPatches.length > 0 && (
            <section>
              <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-rose-400/80">
                Blocked — will not apply
              </h3>
              <ul className="space-y-1.5">
                {dryRunGroups.blockedPatches.map((patch) => (
                  <li
                    key={patch.id}
                    className="rounded border border-rose-900/30 bg-rose-950/10 px-2.5 py-2 text-[11px] text-rose-200/90"
                  >
                    <span className="font-medium">{patch.patchTypeLabel}</span>
                    <span className="text-rose-200/70"> · {patch.targetLabel}</span>
                    <p className="mt-0.5 text-[10px] text-rose-200/60">{patch.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {dryRunGroups.needsReviewPatches.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800/60 bg-slate-900/35 px-3 py-2.5">
              <input
                type="checkbox"
                checked={includeNeedsReview}
                onChange={(event) => setIncludeNeedsReview(event.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-slate-300">
                Include {dryRunGroups.needsReviewPatches.length} needs-review patch
                {dryRunGroups.needsReviewPatches.length === 1 ? "" : "es"} (explicit opt-in)
              </span>
            </label>
          )}

          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-indigo-900/35 bg-indigo-950/15 px-3 py-2.5">
            <input
              type="checkbox"
              checked={batchAcknowledged}
              onChange={(event) => setBatchAcknowledged(event.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-slate-200">
              I understand these validated patches would update the canvas when apply is connected.
            </span>
          </label>

          {applyError && (
            <p className="rounded-md border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
              {applyError}
            </p>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-800/70 px-4 py-3">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className={`w-full rounded border px-3 py-2 text-xs font-medium transition ${
              canConfirm
                ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-950/45"
                : "cursor-not-allowed border-slate-700/60 bg-slate-900/40 text-slate-500"
            }`}
          >
            {isApplying
              ? "Applying…"
              : onConfirmApply
                ? "Confirm apply selection"
                : "Apply handler not connected yet."}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded border border-slate-700/60 bg-slate-900/40 px-3 py-1.5 text-[10px] text-slate-400 transition hover:text-slate-200"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function WorldEvolutionPreviewPanel({
  preview,
  applyDryRun = null,
  dryRunTitleLookup,
  onClose,
  onConfirmApply,
  isApplying = false,
  applyError = null,
  applyNotice = null,
  onUndoLastApply,
  canUndoLastApply = false,
  undoNotice = null,
  undoError = null,
}: WorldEvolutionPreviewPanelProps) {
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const isDevMode = process.env.NODE_ENV === "development";
  const showDetails = showTechnicalDetails || isDevMode;

  const dryRunGroups = useMemo(
    () => buildDryRunPreviewGroups(applyDryRun, dryRunTitleLookup),
    [applyDryRun, dryRunTitleLookup],
  );

  const applyButtonState = getApplyButtonState(applyDryRun, dryRunGroups);

  const statusKey =
    preview.status === "no_plan" ? "empty" : preview.status;
  const statusStyle = STATUS_STYLES[statusKey];
  const userStatusLabel = getEvolutionPreviewUserLabel(preview.status);
  const { confidenceSummary, propagationSummary } = preview;
  const userMessage = getUserFacingEvolutionMessage(preview);

  return (
    <aside className="flex max-h-[min(60vh,calc(100vh-180px))] w-full max-w-md flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950/95 shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-800/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-400/80">
            World Evolution Preview
          </p>
          <h2 className="mt-1 text-sm font-medium text-slate-100">Review evolution changes</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusStyle.badge}`}
            >
              {userStatusLabel}
            </span>
            {showDetails && (
              <span className="text-[10px] text-slate-500">
                Budget remaining: {preview.nodeBudgetRemaining}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 transition hover:text-slate-300"
            aria-label="Close evolution preview"
          >
            ×
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section>
          <p className="text-sm leading-relaxed text-slate-300">{userMessage}</p>
          {(preview.isFailed || preview.isBlocked) && !showDetails && (
            <p className="mt-2 text-xs text-slate-500">
              Open details to inspect technical blockers.
            </p>
          )}
        </section>

        {!isDevMode && (preview.isFailed || preview.isBlocked || preview.blockers.length > 0) && (
          <button
            type="button"
            onClick={() => setShowTechnicalDetails((value) => !value)}
            className="text-[10px] text-cyan-400/70 transition hover:text-cyan-300"
          >
            {showTechnicalDetails ? "Hide technical details" : "Show technical details"}
          </button>
        )}

        {showDetails && (
          <>
            {(preview.isEmpty || preview.isFailed || preview.isBlocked) && (
              <section className="rounded-md border border-slate-800/60 bg-slate-900/35 px-3 py-2.5 text-xs text-slate-500">
                {preview.summary}
              </section>
            )}

            <section className="rounded-md border border-slate-800/60 bg-slate-900/35 px-3 py-2">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Confidence summary
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                <span>Ready avg: {Math.round(confidenceSummary.averageReadyConfidence * 100)}%</span>
                <span>Low: {Math.round(confidenceSummary.lowestConfidence * 100)}%</span>
                <span>High: {Math.round(confidenceSummary.highestConfidence * 100)}%</span>
                <span>{confidenceSummary.readyCount} ready</span>
                <span>{confidenceSummary.downgradedCount} downgraded</span>
                <span>{confidenceSummary.skippedCount} skipped</span>
              </div>
            </section>

            {propagationSummary.scopes.length > 0 && (
              <section className="rounded-md border border-slate-800/60 bg-slate-900/35 px-3 py-2">
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  Propagation summary
                </p>
                <div className="text-[10px] text-slate-400">
                  Scopes: {propagationSummary.scopes.join(", ")} · Max hops:{" "}
                  {propagationSummary.maxHops}
                  {propagationSummary.cappedCount > 0
                    ? ` · ${propagationSummary.cappedCount} capped`
                    : ""}
                </div>
              </section>
            )}

            <ActionSection title="Ready actions" actions={preview.readyActions} />
            <ActionSection title="Needs review" actions={preview.needsReviewActions} />
            <ActionSection title="Blocked actions" actions={preview.blockedActions} />
            <ActionSection title="Skipped actions" actions={preview.skippedActions} />
            <ActionSection title="Downgraded actions" actions={preview.downgradedActions} />

            <BlockerList blockers={preview.blockers} />
            <WarningList warnings={preview.warnings} />

            {applyDryRun && (
              <DryRunPatchPreview applyDryRun={applyDryRun} titleLookup={dryRunTitleLookup} />
            )}
          </>
        )}

        {!showDetails && preview.readyActions.length > 0 && (
          <ActionSection title="Suggested world changes" actions={preview.readyActions.slice(0, 4)} />
        )}

        <section className="rounded-md border border-slate-800/50 bg-slate-900/25 px-3 py-2.5">
          <button
            type="button"
            disabled={applyButtonState.disabled}
            onClick={() => setConfirmModalOpen(true)}
            className={`w-full rounded border px-3 py-1.5 text-[10px] font-medium transition ${
              applyButtonState.disabled
                ? "cursor-not-allowed border-slate-700/60 bg-slate-900/40 text-slate-500"
                : "border-emerald-700/50 bg-emerald-950/25 text-emerald-200 hover:bg-emerald-950/40"
            }`}
          >
            {applyButtonState.label}
          </button>
          {!applyButtonState.disabled && !onConfirmApply && (
            <p className="mt-2 text-[10px] text-slate-500">
              Apply handler not connected yet — confirmation will preview selection only.
            </p>
          )}
          {applyNotice && (
            <p className="mt-2 rounded border border-emerald-900/35 bg-emerald-950/15 px-2 py-1.5 text-[10px] text-emerald-200">
              {applyNotice}
            </p>
          )}
          {applyError && !confirmModalOpen && (
            <p className="mt-2 rounded border border-rose-900/35 bg-rose-950/15 px-2 py-1.5 text-[10px] text-rose-200">
              Failed: {applyError}
            </p>
          )}
          {(canUndoLastApply || onUndoLastApply) && (
            <button
              type="button"
              disabled={!canUndoLastApply || !onUndoLastApply}
              onClick={() => onUndoLastApply?.()}
              className={`mt-2 w-full rounded border px-3 py-1.5 text-[10px] font-medium transition ${
                canUndoLastApply && onUndoLastApply
                  ? "border-violet-700/50 bg-violet-950/25 text-violet-200 hover:bg-violet-950/40"
                  : "cursor-not-allowed border-slate-700/60 bg-slate-900/40 text-slate-500"
              }`}
            >
              Undo last evolution apply
            </button>
          )}
          {undoNotice && (
            <p className="mt-2 rounded border border-violet-900/35 bg-violet-950/15 px-2 py-1.5 text-[10px] text-violet-200">
              {undoNotice}
            </p>
          )}
          {undoError && (
            <p className="mt-2 rounded border border-rose-900/35 bg-rose-950/15 px-2 py-1.5 text-[10px] text-rose-200">
              {undoError}
            </p>
          )}
        </section>
      </div>

      {confirmModalOpen && applyDryRun && dryRunGroups && (
        <ApplyConfirmationModal
          applyDryRun={applyDryRun}
          dryRunGroups={dryRunGroups}
          onClose={() => setConfirmModalOpen(false)}
          onConfirmApply={onConfirmApply}
          isApplying={isApplying}
          applyError={applyError}
        />
      )}
    </aside>
  );
}

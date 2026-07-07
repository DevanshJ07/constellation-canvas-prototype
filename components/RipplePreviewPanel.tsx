"use client";

import { useEffect, useState } from "react";
import {
  updateRippleOperationApproval,
  type RippleOperationApprovalState,
  type RipplePreviewModel,
  type RipplePreviewStatus,
} from "@/lib/worldBrain/ripplePreviewModel";

type RipplePreviewPanelProps = {
  preview: RipplePreviewModel;
  onApproveOperation?: (operationId: string) => void;
  onRejectOperation?: (operationId: string) => void;
  onRequestClarification?: (operationId: string) => void;
  onClose?: () => void;
};

const STATUS_STYLES: Record<
  RipplePreviewStatus,
  { badge: string; label: string }
> = {
  ready: {
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
  failed: {
    badge: "border-slate-600/60 bg-slate-900/50 text-slate-400",
    label: "Failed",
  },
};

const APPROVAL_STYLES: Record<RippleOperationApprovalState, string> = {
  pending: "border-slate-700/60 bg-slate-900/40 text-slate-400",
  approved: "border-emerald-700/50 bg-emerald-950/25 text-emerald-300",
  rejected: "border-rose-700/50 bg-rose-950/25 text-rose-300",
  needs_clarification: "border-amber-700/50 bg-amber-950/25 text-amber-200",
};

const SEVERITY_STYLES = {
  low: "border-slate-700/50 bg-slate-900/30 text-slate-400",
  medium: "border-amber-800/40 bg-amber-950/15 text-amber-200/90",
  high: "border-rose-800/45 bg-rose-950/20 text-rose-200/90",
} as const;

const RISK_STYLES = {
  low: "text-slate-500",
  medium: "text-amber-400/90",
  high: "text-rose-400/90",
} as const;

function formatPercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export default function RipplePreviewPanel({
  preview,
  onApproveOperation,
  onRejectOperation,
  onRequestClarification,
  onClose,
}: RipplePreviewPanelProps) {
  const [localPreview, setLocalPreview] = useState(preview);

  useEffect(() => {
    setLocalPreview(preview);
  }, [preview]);

  const statusStyle = STATUS_STYLES[localPreview.status];
  const { counts } = localPreview;

  function applyApprovalState(
    operationId: string,
    approvalState: RippleOperationApprovalState,
  ) {
    setLocalPreview((current) =>
      updateRippleOperationApproval(current, operationId, approvalState),
    );
  }

  function handleApprove(operationId: string) {
    onApproveOperation?.(operationId);
    applyApprovalState(operationId, "approved");
  }

  function handleReject(operationId: string) {
    onRejectOperation?.(operationId);
    applyApprovalState(operationId, "rejected");
  }

  function handleClarify(operationId: string) {
    onRequestClarification?.(operationId);
    applyApprovalState(operationId, "needs_clarification");
  }

  return (
    <aside className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/95 shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-800/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-400/80">
            Ripple Preview
          </p>
          <h2 className="mt-1 truncate text-sm font-medium text-slate-100">
            {localPreview.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusStyle.badge}`}
            >
              {statusStyle.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Impact: {localPreview.impactLevel}
            </span>
            <span className="text-[10px] text-slate-500">
              Confidence {formatPercent(localPreview.confidence)}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 transition hover:text-slate-300"
            aria-label="Close ripple preview"
          >
            ×
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section>
          <p className="text-sm leading-relaxed text-slate-300">{localPreview.summary}</p>
        </section>

        <section className="rounded-md border border-slate-800/60 bg-slate-900/35 px-3 py-2">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            Counts
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
            <span>{counts.operationCount} ops</span>
            <span>{counts.warningCount} warnings</span>
            <span>{counts.approvalRequiredCount} need approval</span>
            <span>{counts.clarificationRequiredCount} need clarification</span>
            <span>{counts.highPriorityOperationCount} high priority</span>
            <span>{counts.preservedCount} preserved</span>
          </div>
        </section>

        {localPreview.operationPreviews.length > 0 && (
          <section>
            <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Suggested operations
            </h3>
            <ul className="space-y-2">
              {localPreview.operationPreviews.map((op) => (
                <li
                  key={op.id}
                  className="rounded-md border border-violet-900/25 bg-violet-950/10 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">{op.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{op.description}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${APPROVAL_STYLES[op.approvalState]}`}
                    >
                      {op.approvalState.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{op.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    <span className="text-slate-500">Priority: {op.priority}</span>
                    <span className={RISK_STYLES[op.riskLevel]}>
                      Risk: {op.riskLevel}
                    </span>
                    {op.requiresUserApproval && (
                      <span className="text-violet-300/80">Approval required</span>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApprove(op.id)}
                      className="rounded border border-emerald-800/50 bg-emerald-950/20 px-2 py-0.5 text-[10px] text-emerald-300 transition hover:border-emerald-600/60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(op.id)}
                      className="rounded border border-rose-800/50 bg-rose-950/20 px-2 py-0.5 text-[10px] text-rose-300 transition hover:border-rose-600/60"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClarify(op.id)}
                      className="rounded border border-amber-800/50 bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-200 transition hover:border-amber-600/60"
                    >
                      Clarify
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {localPreview.warningPreviews.length > 0 && (
          <section>
            <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Warnings
            </h3>
            <ul className="space-y-2">
              {localPreview.warningPreviews.map((warning) => (
                <li
                  key={warning.id}
                  className={`rounded-md border px-3 py-2.5 ${SEVERITY_STYLES[warning.severity]}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{warning.title}</p>
                    {warning.requiresUserAttention && (
                      <span className="rounded border border-current/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider opacity-80">
                        Needs attention
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">{warning.message}</p>
                  {warning.suggestedResolution && (
                    <p className="mt-1.5 text-[11px] italic opacity-75">
                      Suggested: {warning.suggestedResolution}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {localPreview.followUpQuestions.length > 0 && (
          <section>
            <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              Follow-up questions
            </h3>
            <ul className="space-y-1.5">
              {localPreview.followUpQuestions.map((question) => (
                <li key={question} className="text-xs leading-relaxed text-slate-400">
                  · {question}
                </li>
              ))}
            </ul>
          </section>
        )}

        {localPreview.preservedPreviews.length > 0 && (
          <section className="rounded-md border border-teal-900/25 bg-teal-950/10 px-3 py-2.5">
            <h3 className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-teal-400/75">
              Preserved elements
            </h3>
            <ul className="space-y-1.5">
              {localPreview.preservedPreviews.map((item) => (
                <li key={`${item.targetType}:${item.id}`} className="text-xs text-teal-200/85">
                  <span className="font-medium">{item.title ?? item.id}</span>
                  <span className="text-teal-400/60"> — </span>
                  {item.reason}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}

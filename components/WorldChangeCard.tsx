"use client";

import type { WorldChangeCardModel } from "@/lib/worldChangeModel";

type WorldChangeCardProps = {
  model: WorldChangeCardModel;
  onAccept: () => void;
  onDecline: () => void;
  onAdvancedDetails?: () => void;
  isApplying?: boolean;
  statusMessage?: string | null;
  onClose?: () => void;
};

export default function WorldChangeCard({
  model,
  onAccept,
  onDecline,
  onAdvancedDetails,
  isApplying = false,
  statusMessage,
  onClose,
}: WorldChangeCardProps) {
  const showAdvanced =
    process.env.NODE_ENV === "development" &&
    Boolean(onAdvancedDetails) &&
    model.phase === "ready";

  const isPending = model.phase === "pending";
  const isFailed = model.phase === "failed";

  return (
    <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-violet-500/40 bg-slate-950/98 shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_32px_rgba(139,92,246,0.14)]">
      <header className="flex items-start justify-between gap-3 border-b border-violet-900/30 bg-violet-950/25 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
            {isPending ? "Canon" : "World change"}
          </p>
          <h2 className="mt-1 text-base font-medium text-slate-50">{model.title}</h2>
          <p className="mt-1 text-xs text-violet-200/70">{model.subtitle}</p>
        </div>
        {onClose && !isPending && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 transition hover:text-slate-300"
            aria-label="Close world change card"
          >
            ×
          </button>
        )}
      </header>

      <div className="space-y-4 px-5 py-4">
        {isPending && (
          <div className="flex items-center gap-3 rounded-lg border border-violet-800/35 bg-violet-950/20 px-3 py-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-300" />
            <p className="text-sm leading-relaxed text-slate-300">{model.summary}</p>
          </div>
        )}

        {!isPending && (
          <p className="text-sm leading-relaxed text-slate-300">{model.summary}</p>
        )}

        {!isPending && model.isEmpty && model.phase === "ready" && (
          <p className="text-sm leading-relaxed text-slate-400">
            This choice is now part of your canon. No additional world changes are needed
            right now.
          </p>
        )}

        {model.affectedAreas.length > 0 && (
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Affected areas
            </p>
            <div className="flex flex-wrap gap-2">
              {model.affectedAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-full border border-violet-800/45 bg-violet-950/30 px-2.5 py-1 text-xs text-violet-100/90"
                >
                  {area}
                </span>
              ))}
            </div>
          </section>
        )}

        {model.consequences.length > 0 && (
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              What may change
            </p>
            <ul className="space-y-2">
              {model.consequences.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm leading-snug text-slate-300"
                >
                  <span className="mt-1 text-violet-400/80">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {model.caution && (
          <p className="rounded-lg border border-amber-900/35 bg-amber-950/15 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
            {model.caution}
          </p>
        )}

        {(statusMessage || model.reviewNeededMessage) && !isPending && (
          <p className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs leading-relaxed text-slate-300">
            {statusMessage ?? model.reviewNeededMessage}
          </p>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-slate-800/70 px-5 py-4">
        {model.phase === "ready" && !model.isEmpty && (
          <button
            type="button"
            onClick={onAccept}
            disabled={isApplying}
            className="w-full rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/55 disabled:cursor-wait disabled:opacity-60"
          >
            {isApplying ? "Applying changes…" : "Accept"}
          </button>
        )}
        <button
          type="button"
          onClick={onDecline}
          disabled={isApplying || isPending}
          className="w-full rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200 disabled:cursor-wait disabled:opacity-50"
        >
          {isPending
            ? "Thinking…"
            : isFailed || model.isEmpty
              ? "Continue exploring"
              : "Decline"}
        </button>
        {showAdvanced && onAdvancedDetails && !model.isEmpty && (
          <button
            type="button"
            onClick={onAdvancedDetails}
            className="self-center text-[10px] text-slate-600 transition hover:text-slate-400"
          >
            Advanced details
          </button>
        )}
      </footer>
    </aside>
  );
}

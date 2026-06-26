"use client";

export type WorldShiftSummary = {
  added: string[];
  modified: { from: string; to: string }[];
  replaced: { from: string; to: string }[];
  weakened: { title: string; reason: string }[];
  removed: string[];
  specialists: string[];
  worldShiftSummary: string;
  usedFallback: boolean;
};

type WorldShiftModalProps = {
  summary: WorldShiftSummary;
  hasPanel?: boolean;
  onDismiss: () => void;
};

export default function WorldShiftModal({
  summary,
  hasPanel = false,
  onDismiss,
}: WorldShiftModalProps) {
  const hasChanges =
    summary.added.length > 0 ||
    summary.modified.length > 0 ||
    summary.replaced.length > 0 ||
    summary.weakened.length > 0 ||
    summary.removed.length > 0;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center pb-6"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="pointer-events-auto w-80 rounded-xl border border-violet-700/40 bg-slate-950/97 shadow-[0_0_60px_rgba(139,92,246,0.2),0_24px_64px_rgba(0,0,0,0.7)] backdrop-blur-md"
        style={{ marginRight: hasPanel ? "320px" : "0" }}
      >
        {/* Header */}
        <div className="border-b border-violet-800/35 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-violet-400">✦</span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
              World Shift
            </p>
          </div>
          <p className="mt-1.5 text-sm font-medium leading-snug text-slate-100">
            Your direction reshaped this branch.
          </p>
          {summary.worldShiftSummary && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {summary.worldShiftSummary}
            </p>
          )}
          {summary.usedFallback && (
            <p className="mt-1.5 text-[10px] italic text-indigo-400/70">
              Using local prototype adaptation.
            </p>
          )}
        </div>

        {/* Body */}
        <div className="space-y-3.5 px-5 py-4">
          {summary.added.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80">
                Added
              </p>
              <ul className="space-y-1">
                {summary.added.map((title) => (
                  <li key={title} className="flex items-start gap-2 text-xs text-emerald-200/85">
                    <span className="mt-0.5 shrink-0 text-emerald-500">+</span>
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.replaced.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-400/80">
                Replaced
              </p>
              <ul className="space-y-1.5">
                {summary.replaced.map((r) => (
                  <li key={r.from} className="text-[11px] leading-snug">
                    <span className="text-slate-600 line-through">{r.from}</span>
                    <span className="mx-1.5 text-slate-600">→</span>
                    <span className="text-violet-200">{r.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.modified.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400/80">
                Reshaped
              </p>
              <ul className="space-y-1.5">
                {summary.modified.map((m) => (
                  <li key={m.from} className="text-[11px] leading-snug">
                    <span className="text-slate-500">~</span>
                    <span className="ml-1 text-slate-400 line-through">{m.from}</span>
                    <span className="ml-1.5 text-amber-200">{m.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.weakened.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Less Aligned
              </p>
              <ul className="space-y-1">
                {summary.weakened.map((w) => (
                  <li key={w.title} className="flex items-start gap-2 text-[11px] text-slate-500">
                    <span className="mt-0.5 shrink-0">↓</span>
                    <span>{w.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.removed.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-rose-500/70">
                Removed
              </p>
              <ul className="space-y-1">
                {summary.removed.map((title) => (
                  <li key={title} className="flex items-start gap-2 text-[11px] text-rose-300/50 line-through">
                    <span className="mt-0.5 shrink-0 no-underline">×</span>
                    {title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasChanges && (
            <p className="text-[11px] text-slate-600">
              Direction noted. New paths will emerge as you continue exploring.
            </p>
          )}

          {summary.specialists.length > 0 && (
            <div className="border-t border-slate-800/60 pt-3">
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-indigo-400/80">
                Active Specialists
              </p>
              <ul className="space-y-0.5">
                {summary.specialists.map((name) => (
                  <li key={name} className="text-[11px] text-indigo-200/70">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/60 px-5 py-3">
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-lg border border-violet-800/40 bg-violet-950/30 px-4 py-2 text-xs font-medium text-violet-300 transition hover:border-violet-600/55 hover:bg-violet-950/50"
          >
            Continue Exploring
          </button>
        </div>
      </div>
    </div>
  );
}

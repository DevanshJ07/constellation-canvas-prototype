"use client";

import type { CanonProfile } from "@/lib/canonProfile";
import { resolveNodeMeta } from "@/lib/worldNodes";

type WorldSynthesisModalProps = {
  open: boolean;
  onClose: () => void;
  worldSeed: string;
  profile: CanonProfile;
  acceptedIds: string[];
  potentialFutures: string[];
};

export default function WorldSynthesisModal({
  open,
  onClose,
  worldSeed,
  profile,
  acceptedIds,
  potentialFutures,
}: WorldSynthesisModalProps) {
  if (!open) return null;

  const coreTruths = acceptedIds
    .slice(0, 8)
    .map((id) => resolveNodeMeta(id)?.title ?? id);

  const unlockedThreadCount =
    profile.potentialRemaining + profile.establishedCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative mx-4 w-full max-w-md max-h-[88vh] overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/97 shadow-[0_8px_64px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="synthesis-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800/70 bg-slate-950/97 px-6 py-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-400/70">
              World Synthesis
            </p>
            <h2
              id="synthesis-title"
              className="mt-0.5 text-lg font-medium text-slate-100"
            >
              {worldSeed}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 shrink-0 text-slate-500 transition hover:text-slate-300"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-0 divide-y divide-slate-800/60 px-6 py-2">

          {/* Genre */}
          <div className="py-4">
            <p className="text-[9px] uppercase tracking-wider text-slate-600">Genre</p>
            <p className="mt-1 text-sm font-medium text-slate-200">{profile.genre}</p>
          </div>

          {/* Core Truths */}
          {coreTruths.length > 0 && (
            <div className="py-4">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">
                Core Truths
              </p>
              <ul className="mt-2 space-y-1">
                {coreTruths.map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-2 text-sm text-emerald-200/90"
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-500/60">●</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Major Themes */}
          {profile.themes.length > 0 && (
            <div className="py-4">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">
                Major Themes
              </p>
              <ul className="mt-2 space-y-1">
                {profile.themes.map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <span className="mt-0.5 shrink-0 text-violet-500/50">✦</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Open Questions */}
          {profile.openQuestions.length > 0 && (
            <div className="py-4">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">
                Open Questions
              </p>
              <ul className="mt-2 space-y-1.5">
                {profile.openQuestions.map((q) => (
                  <li key={q} className="text-sm italic leading-relaxed text-slate-400">
                    — {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats row */}
          <div className="py-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2.5 text-center">
                <p className="text-lg font-medium tabular-nums text-emerald-300">
                  {profile.establishedCount}
                </p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">
                  Truths
                </p>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2.5 text-center">
                <p className="text-lg font-medium tabular-nums text-violet-300">
                  {unlockedThreadCount}
                </p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">
                  Threads
                </p>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2.5 text-center">
                <p
                  className={`text-lg font-medium tabular-nums ${
                    profile.coherenceScore >= 70
                      ? "text-emerald-300"
                      : profile.coherenceScore >= 40
                        ? "text-amber-300"
                        : "text-rose-300"
                  }`}
                >
                  {profile.coherenceScore}%
                </p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">
                  Coherence
                </p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-600">
                <span>World Completion</span>
                <span className="tabular-nums">{profile.completionPct}%</span>
              </div>
              <div className="mt-1.5 flex h-1 gap-px">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 rounded-sm ${
                      i < Math.round(profile.completionPct / 5)
                        ? "bg-violet-500/55"
                        : "bg-slate-800/80"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Potential Futures */}
          <div className="py-4">
            <p className="text-[9px] uppercase tracking-wider text-slate-600">
              Potential Futures
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              If current canon continues:
            </p>
            <ul className="mt-2 space-y-1.5">
              {potentialFutures.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-[11px] leading-snug text-slate-300"
                >
                  <span className="mt-0.5 shrink-0 text-sky-500/60">→</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Journey tagline */}
          <div className="py-4">
            <p className="text-xs leading-relaxed text-slate-600">
              Explore → Discover → Select Truths → Build Canon →{" "}
              <span className="text-violet-400/80">Build World</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-800/70 bg-slate-950/97 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-700/60 px-4 py-2.5 text-sm text-slate-300 transition hover:border-violet-700/50 hover:text-violet-200"
          >
            Continue Exploring
          </button>
        </div>
      </div>
    </div>
  );
}

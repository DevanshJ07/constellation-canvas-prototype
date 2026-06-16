"use client";

import { useEffect, useState } from "react";
import { resolveNodeMeta } from "@/lib/worldNodes";
import type { ExtendedRippleResult } from "@/lib/worldEvolution";

type RippleModalProps = {
  result: ExtendedRippleResult;
  onClose: () => void;
};

export default function RippleModal({ result, onClose }: RippleModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  function resolveTitle(id: string): string {
    return resolveNodeMeta(id)?.title ?? id;
  }

  const hasRipple =
    result.unlocked.length > 0 ||
    result.supported.length > 0 ||
    result.contradicted.length > 0;

  const hasWorldChanges =
    result.worldStateShifts.length > 0 ||
    result.crossDomainEffects.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-20 sm:items-center sm:pb-0"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-[#0a0a0f]/55 backdrop-blur-[2px]" />

      <div
        className={`relative mx-4 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/97 shadow-[0_8px_48px_rgba(0,0,0,0.7)] transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="ripple-title"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-800/70 bg-slate-950/97 px-5 py-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-400/80">
              Ripple Effects
            </p>
            <h2 id="ripple-title" className="mt-1 text-base font-medium text-slate-100">
              <span className="text-emerald-300">{result.nodeTitle}</span> became
              Canon
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 transition hover:text-slate-300"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Unlocked */}
          {result.unlocked.length > 0 && (
            <section>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-teal-500/80">
                Unlocked
              </p>
              {result.unlocked.map((id) => (
                <div key={id} className="flex items-center gap-2 py-0.5">
                  <span className="text-teal-400">+</span>
                  <span className="text-sm text-teal-200">{resolveTitle(id)}</span>
                </div>
              ))}
            </section>
          )}

          {/* Supported / Contradicted */}
          {(result.supported.length > 0 || result.contradicted.length > 0) && (
            <section>
              {result.supported.map((id) => (
                <div key={id} className="flex items-center gap-2 py-0.5">
                  <span className="text-emerald-400">↑</span>
                  <span className="text-sm text-emerald-200/90">{resolveTitle(id)}</span>
                  <span className="text-[9px] uppercase tracking-wider text-emerald-500/60">
                    Supported
                  </span>
                </div>
              ))}
              {result.contradicted.map((id) => (
                <div key={id} className="flex items-center gap-2 py-0.5">
                  <span className="text-rose-400">↓</span>
                  <span className="text-sm text-rose-200/80">{resolveTitle(id)}</span>
                  <span className="text-[9px] uppercase tracking-wider text-rose-500/60">
                    Weakened
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* World State */}
          {result.worldStateShifts.length > 0 && (
            <section className="rounded-md border border-violet-900/30 bg-violet-950/15 px-3 py-2.5">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-violet-400/75">
                World State
              </p>
              {result.worldStateShifts.map((shift) => (
                <p key={shift} className="text-sm text-violet-200/90">
                  {shift}
                </p>
              ))}
            </section>
          )}

          {/* Cross-Domain */}
          {result.crossDomainEffects.length > 0 && (
            <section className="rounded-md border border-amber-900/25 bg-amber-950/10 px-3 py-2.5">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-amber-400/75">
                Cross-Domain Effects
              </p>
              {result.crossDomainEffects.map((cd) => (
                <div key={cd.id} className="flex items-center gap-2 py-0.5">
                  <span className="text-amber-400">+</span>
                  <span className="text-sm text-amber-200/90">{cd.title}</span>
                  <span className="text-[9px] uppercase tracking-wider text-amber-600/70">
                    in {cd.targetRegion}
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* Evolution unlocks from this accept */}
          {result.evolutionUnlocks.length > 0 && (
            <section>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-teal-500/70">
                Evolution Unlocks
              </p>
              {result.evolutionUnlocks.map((t) => (
                <div key={t} className="flex items-center gap-2 py-0.5">
                  <span className="text-teal-400">✦</span>
                  <span className="text-sm text-teal-200/85">{t}</span>
                </div>
              ))}
            </section>
          )}

          {!hasRipple && !hasWorldChanges && (
            <p className="text-sm text-slate-500">
              This truth stands alone — the world waits for what connects to it.
            </p>
          )}

          {/* Coherence */}
          <div className="flex items-center gap-2 rounded-md border border-slate-800/60 bg-slate-900/40 px-3 py-2">
            <span
              className={`text-sm font-medium ${
                result.coherenceDelta >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {result.coherenceDelta >= 0 ? "+" : ""}
              {result.coherenceDelta}
            </span>
            <span className="text-xs text-slate-400">World Coherence</span>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-800/70 bg-slate-950/97 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-700/60 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Continue Exploring
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { EvolutionEventDef } from "@/lib/worldEvolution";

type EvolutionEventModalProps = {
  event: EvolutionEventDef;
  onClose: () => void;
};

export default function EvolutionEventModal({
  event,
  onClose,
}: EvolutionEventModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a0a0f]/60 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`relative mx-4 w-full max-w-sm rounded-xl border border-amber-900/40 bg-slate-950/97 shadow-[0_8px_48px_rgba(251,191,36,0.08)] transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-amber-900/30 px-5 py-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-400/80">
            World Evolution
          </p>
          <h2 className="mt-1 text-base font-medium text-slate-100">
            {event.title}
          </h2>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-400">
            {event.description}
          </p>

          {event.unlockTitles.length > 0 && (
            <div className="mt-4">
              <p className="text-[9px] uppercase tracking-wider text-slate-600">
                New Possibilities
              </p>
              <ul className="mt-2 space-y-1.5">
                {event.unlockTitles.map((t) => (
                  <li
                    key={t}
                    className="flex items-center gap-2 text-sm text-teal-200/90"
                  >
                    <span className="text-teal-500">+</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/70 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-2 text-sm font-medium text-amber-200/90 transition hover:border-amber-700/50 hover:bg-amber-950/35"
          >
            View Changes
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CONSTELLATION_REGIONS, getRegionTheme } from "@/lib/regions";
import type { WorldShift } from "@/lib/influence";

type WorldPulseProps = {
  shift: WorldShift | null;
  nonce: number;
};

const VISIBLE_MS = 4200;

export default function WorldPulse({ shift, nonce }: WorldPulseProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (nonce === 0 || !shift) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [nonce, shift]);

  if (!visible || !shift) return null;

  return (
    <div
      key={nonce}
      className="animate-pulse-in absolute left-1/2 top-6 z-30 w-80 -translate-x-1/2 rounded-xl border border-violet-800/50 bg-slate-950/92 px-5 py-4 shadow-[0_4px_40px_rgba(124,58,237,0.18)] backdrop-blur-md"
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-400/90">
          World Pulse
        </p>
      </div>

      <p className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
        The world heard
      </p>
      <p className="mt-1 text-sm italic leading-snug text-slate-200">
        &ldquo;{shift.truth}&rdquo;
      </p>

      {shift.influence.length > 0 ? (
        <>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">
            Potential influence detected
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {shift.influence.map((regionId) => {
              const region = CONSTELLATION_REGIONS.find(
                (r) => r.id === regionId,
              );
              const theme = getRegionTheme(regionId);
              return (
                <span
                  key={regionId}
                  className="flex items-center gap-1 text-sm font-medium"
                  style={{ color: theme.dot }}
                >
                  <span className="opacity-70">+</span>
                  {region?.label ?? regionId}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-3 text-[11px] italic text-slate-600">
          The world listens, but stays still...
        </p>
      )}

      <p className="mt-3 text-[11px] italic tracking-wide text-violet-400/70">
        Reality is shifting...
      </p>
    </div>
  );
}

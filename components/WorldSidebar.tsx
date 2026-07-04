"use client";

import { CONSTELLATION_REGIONS } from "@/lib/regions";
import type { NavState } from "@/types/discovery";
import type { DynamicConstellation } from "@/lib/dynamicConstellations";

type WorldSidebarProps = {
  navState: NavState;
  onNavigate: (state: NavState) => void;
  acceptedCount: number;
  creatorTruths: string[];
  dynamicConstellations?: DynamicConstellation[];
};

type NavButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  badge?: number;
};

function NavButton({ active, onClick, icon, label, badge }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
        active
          ? "bg-slate-800/80 text-slate-100"
          : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
      }`}
    >
      <span className="w-4 text-center text-base leading-none">{icon}</span>
      <span className="flex-1 leading-none">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-emerald-900/70 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function WorldSidebar({
  navState,
  onNavigate,
  acceptedCount,
  creatorTruths,
  dynamicConstellations = [],
}: WorldSidebarProps) {
  const { mode } = navState;

  // Resolve the label for the current focused region — check dynamic first,
  // then fall back to static CONSTELLATION_REGIONS
  const focusedRegionLabel =
    mode === "constellation" || mode === "discovery"
      ? (dynamicConstellations.find((c) => c.id === navState.regionId)?.title ??
          CONSTELLATION_REGIONS.find((r) => r.id === navState.regionId)?.label ??
          navState.regionId)
      : "";

  const focusedRegionAgent =
    mode === "constellation" || mode === "discovery"
      ? dynamicConstellations.find((c) => c.id === navState.regionId)?.agentName
      : undefined;

  return (
    <nav className="absolute left-0 top-0 z-20 flex h-full w-44 flex-col border-r border-slate-800/60 bg-slate-950/90 backdrop-blur-md">
      {/* Navigation */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-[9px] uppercase tracking-[0.22em] text-slate-600">
          Navigate
        </p>
      </div>

      <div className="flex flex-col gap-0.5 px-2">
        <NavButton
          active={mode === "overview"}
          onClick={() => onNavigate({ mode: "overview" })}
          icon="🌌"
          label="World Overview"
        />
        <NavButton
          active={mode === "canon"}
          onClick={() => onNavigate({ mode: "canon" })}
          icon="📖"
          label="Canon Universe"
          badge={acceptedCount}
        />
      </div>

      {/* Current focus */}
      {(mode === "constellation" || mode === "discovery") && (
        <>
          <div className="mx-4 mt-5 mb-1 h-px bg-slate-800/70" />
          <div className="px-4 pt-3 pb-2">
            <p className="text-[9px] uppercase tracking-[0.22em] text-slate-600">
              Current Focus
            </p>
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {mode === "discovery" && (
              <>
                <div className="rounded-lg px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                    Exploring
                  </p>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-slate-200">
                    {navState.discoveryTitle}
                  </p>
                  {focusedRegionAgent && (
                    <p className="mt-0.5 text-[9px] text-slate-600">
                      via {focusedRegionAgent}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ mode: "overview" })}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-500 transition hover:bg-slate-800/40 hover:text-slate-300"
                >
                  <span>←</span>
                  <span>World Overview</span>
                </button>
              </>
            )}

            {mode === "constellation" && (
              <>
                <div className="rounded-lg px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600">
                    Region
                  </p>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-slate-200">
                    {focusedRegionLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ mode: "overview" })}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-500 transition hover:bg-slate-800/40 hover:text-slate-300"
                >
                  <span>←</span>
                  <span>World Overview</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Creator Truths (from World Whisper) */}
      {creatorTruths.length > 0 && (
        <>
          <div className="mx-4 mt-5 mb-1 h-px bg-slate-800/70" />
          <div className="px-4 pt-3 pb-2">
            <p className="text-[9px] uppercase tracking-[0.22em] text-slate-600">
              Creator Truths
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1.5 px-4 pb-4">
              {creatorTruths.map((truth, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-[10px] text-violet-600">
                    •
                  </span>
                  <p className="text-[11px] leading-snug text-violet-200/80">
                    {truth}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}

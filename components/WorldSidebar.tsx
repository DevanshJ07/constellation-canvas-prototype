"use client";

import { CONSTELLATION_REGIONS } from "@/lib/regions";
import type { NavState } from "@/types/discovery";

type WorldSidebarProps = {
  navState: NavState;
  onNavigate: (state: NavState) => void;
  acceptedCount: number;
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
}: WorldSidebarProps) {
  const { mode } = navState;

  const focusedRegionLabel =
    mode === "constellation" || mode === "discovery"
      ? (CONSTELLATION_REGIONS.find((r) => r.id === navState.regionId)
          ?.label ?? "")
      : "";

  return (
    <nav className="absolute left-0 top-0 z-20 flex h-full w-44 flex-col border-r border-slate-800/60 bg-slate-950/88 backdrop-blur-md">
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
                    Discovery
                  </p>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-slate-200">
                    {navState.discoveryTitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      mode: "constellation",
                      regionId: navState.regionId,
                    })
                  }
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-500 transition hover:bg-slate-800/40 hover:text-slate-300"
                >
                  <span>←</span>
                  <span>{focusedRegionLabel}</span>
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
    </nav>
  );
}

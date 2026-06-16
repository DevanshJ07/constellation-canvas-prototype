"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiscoveryDecision } from "@/types/discovery";
import type { RippleState } from "@/lib/worldRipple";

export type TrailRole = "focused" | "path" | "direction" | "consequence";

export type TrailNodeData = {
  title: string;
  category?: string;
  role: TrailRole;
  decision: DiscoveryDecision;
  justAccepted?: boolean;
  justEmerged?: boolean;
  hasCreatorDirection?: boolean;
  isCanonPath?: boolean;
  journeyPhase?: "past" | "current" | "future";
  nodeId?: string;
  labelOffsetY?: number;
  canonLayer?: "origin" | "theme" | "truth" | "consequence" | "major_truth" | "emerging_theme" | "world_evolution" | "world_state" | "potential_future" | "domain_truth" | "unresolved";
  rippleState?: RippleState;
};

const SIZE: Record<TrailRole, number> = {
  focused: 36,
  path: 34,
  direction: 30,
  consequence: 30,
};

const CANON_SIZE: Record<TrailRole, number> = {
  focused: 26,
  path: 20,
  direction: 18,
  consequence: 18,
};

const RIPPLE_LABEL: Record<RippleState, string> = {
  supported: "Supported",
  contradicted: "Contradicted",
  unlocked: "Unlocked",
};

const RIPPLE_LABEL_COLOR: Record<RippleState, string> = {
  supported: "text-emerald-400/90",
  contradicted: "text-rose-400/90",
  unlocked: "text-teal-400/90",
};

function TrailNode({ data, selected }: NodeProps) {
  const {
    title,
    category,
    role,
    decision,
    justAccepted,
    justEmerged,
    hasCreatorDirection,
    isCanonPath,
    journeyPhase,
    labelOffsetY = 0,
    canonLayer,
    rippleState,
  } = data as TrailNodeData;

  const size = isCanonPath ? CANON_SIZE[role] : SIZE[role];
  const isPast = journeyPhase === "past";
  const isFuture = journeyPhase === "future";
  const isAccepted = decision === "accepted";
  const isSaved = decision === "saved";
  const isFocused = role === "focused";
  const isDirection = role === "direction";
  const isConsequence = role === "consequence";

  // Ripple animation class overrides ring/glow when active
  const rippleClass = rippleState
    ? `animate-ripple-${rippleState}`
    : "";

  const ring = rippleState === "supported"
    ? "border-emerald-400/80 bg-emerald-500/15"
    : rippleState === "contradicted"
      ? "border-rose-400/70 bg-rose-500/10"
      : rippleState === "unlocked"
        ? "border-teal-400/70 bg-teal-500/12"
        : isAccepted
          ? "border-emerald-300/80 bg-emerald-500/15"
          : isConsequence || canonLayer === "consequence"
            ? "border-teal-400/70 bg-teal-500/12"
            : isSaved
              ? "border-sky-300/70 bg-sky-500/12"
              : isFocused || canonLayer === "origin"
                ? "border-violet-300/80 bg-violet-500/18"
        : canonLayer === "theme"
          ? "border-amber-400/55 bg-amber-500/10"
          : canonLayer === "major_truth" || canonLayer === "domain_truth"
            ? "border-[#5EE7A4]/70 bg-[#5EE7A4]/12"
            : canonLayer === "world_state" || canonLayer === "world_evolution"
              ? "border-[#FFC857]/70 bg-[#FFC857]/14"
              : canonLayer === "unresolved"
              ? "border-[#FF8A65]/65 bg-[#FF8A65]/12"
              : canonLayer === "emerging_theme"
              ? "border-violet-400/50 bg-violet-500/10"
              : canonLayer === "potential_future"
                  ? "border-[#B78CFF]/65 bg-[#B78CFF]/12"
                  : isCanonPath
                    ? "border-violet-300/60 bg-violet-500/10"
                    : "border-slate-500/45 bg-slate-700/20";

  const glow = rippleState
    ? "" // handled by animate-ripple-* classes
    : isAccepted
      ? "shadow-[0_0_26px_rgba(52,211,153,0.45)]"
      : isConsequence
        ? justEmerged
          ? "shadow-[0_0_28px_rgba(45,212,191,0.55)]"
          : "shadow-[0_0_18px_rgba(45,212,191,0.35)]"
        : isFocused
          ? "shadow-[0_0_19px_rgba(167,139,250,0.38)]"
          : isCanonPath
            ? "shadow-[0_0_16px_rgba(167,139,250,0.3)]"
            : role === "path"
              ? "shadow-[0_0_12px_rgba(167,139,250,0.22)]"
              : selected
                ? "shadow-[0_0_16px_rgba(148,163,184,0.3)]"
                : "";

  const coreColor = isAccepted
    ? "bg-emerald-300"
    : isConsequence
      ? "bg-teal-300"
      : isSaved
        ? "bg-sky-300"
        : isFocused
          ? "bg-violet-300"
          : isCanonPath
            ? "bg-violet-300/80"
            : "bg-slate-300/70";

  return (
    <div
      className={`group flex flex-col items-center gap-2 transition-all duration-300 ${
        isPast
          ? "opacity-50 hover:opacity-75"
          : isFuture
            ? isDirection
              ? "opacity-85 hover:opacity-100"
              : isConsequence
                ? "opacity-90 hover:opacity-100"
                : "opacity-85 hover:opacity-100"
            : isDirection
              ? "opacity-75 hover:opacity-100"
              : isConsequence
                ? "opacity-90 hover:opacity-100"
                : "opacity-100"
      } ${justEmerged ? "animate-emerge" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />

      <div
        className={`flex items-center justify-center rounded-full border transition-all duration-300 ${ring} ${glow} ${rippleClass} ${
          isFocused && !rippleState ? "animate-trail-current" : ""
        } ${justAccepted && !rippleState ? "animate-accept-world" : ""}`}
        style={{ width: size, height: size }}
      >
        <div
          className={`rounded-full transition-all duration-300 ${coreColor} ${
            isFocused && !isAccepted && !rippleState ? "animate-truth-pulse" : ""
          } ${isAccepted && !rippleState ? "animate-truth-pulse" : ""}`}
          style={{ width: size * 0.22, height: size * 0.22 }}
        />
      </div>

      <div
        className={`text-center ${isCanonPath ? "max-w-[112px]" : "max-w-[150px]"}`}
        style={{ transform: `translateY(${labelOffsetY}px)` }}
      >
        <p
          className={`leading-snug ${
            isCanonPath ? "break-words hyphens-auto" : ""
          } ${
            isFocused
              ? isCanonPath
                ? "text-[10px] font-semibold leading-tight text-white"
                : "text-xs font-semibold text-violet-100"
              : role === "path"
                ? isCanonPath
                  ? "text-[9px] leading-tight text-slate-300/85"
                  : "text-xs text-slate-300/85"
                : isCanonPath
                  ? "text-[9px] leading-tight text-slate-400"
                  : "text-xs text-slate-400 group-hover:text-slate-200"
          }`}
        >
          {title}
        </p>

        {/* Ripple state label */}
        {rippleState && (
          <p className={`mt-0.5 text-[8px] font-semibold uppercase tracking-wider animate-ripple-label ${RIPPLE_LABEL_COLOR[rippleState]}`}>
            {RIPPLE_LABEL[rippleState]}
          </p>
        )}

        {isFocused && category && !isCanonPath && !rippleState && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-violet-400/70">
            {category}
          </p>
        )}

        {isCanonPath && canonLayer && !rippleState && (
          <p className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {canonLayer === "origin"
              ? "Origin"
              : canonLayer === "major_truth" || canonLayer === "domain_truth"
                ? "Established Truth"
                : canonLayer === "unresolved"
                  ? "Unresolved Thread"
                  : canonLayer === "world_state"
                    ? "World State"
                    : canonLayer === "emerging_theme"
                  ? "Emerging Theme"
                  : canonLayer === "world_evolution"
                    ? "World Evolution"
                    : canonLayer === "potential_future"
                      ? "Potential Future"
                      : canonLayer === "theme"
                        ? "Theme"
                        : canonLayer === "consequence"
                          ? "Consequence"
                          : "Truth"}
          </p>
        )}

        {isAccepted && !isCanonPath && !rippleState && (
          <span className="mt-1 inline-block rounded-sm bg-emerald-900/60 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-emerald-300">
            Established
          </span>
        )}

        {isDirection && decision === "pending" && !rippleState && (
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600 transition-colors group-hover:text-slate-500">
            Explore →
          </p>
        )}

        {isConsequence && !isAccepted && !rippleState && (
          <p className="mt-0.5 text-[8px] leading-snug text-teal-500/80">
            Unlocked because this became true
          </p>
        )}

        {hasCreatorDirection && !rippleState && (
          <p className="mt-1 text-[9px] font-medium tracking-wider text-amber-400/80">
            ✦ shaped by creator
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(TrailNode);

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiscoveryDecision } from "@/types/discovery";

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
};

const SIZE: Record<TrailRole, number> = {
  focused: 64,
  path: 40,
  direction: 32,
  consequence: 36,
};

const CANON_SIZE: Record<TrailRole, number> = {
  focused: 32,
  path: 24,
  direction: 22,
  consequence: 22,
};

export default function TrailNode({ data, selected }: NodeProps) {
  const { title, category, role, decision, justAccepted, justEmerged, hasCreatorDirection, isCanonPath, journeyPhase } =
    data as TrailNodeData;

  const size = isCanonPath ? CANON_SIZE[role] : SIZE[role];
  const isPast = journeyPhase === "past";
  const isFuture = journeyPhase === "future";
  const isAccepted = decision === "accepted";
  const isSaved = decision === "saved";
  const isFocused = role === "focused";
  const isDirection = role === "direction";
  const isConsequence = role === "consequence";

  // Ring + fill colour by state
  const ring = isAccepted
    ? "border-emerald-300/80 bg-emerald-500/15"
    : isConsequence
      ? "border-teal-400/70 bg-teal-500/12"
      : isSaved
        ? "border-sky-300/70 bg-sky-500/12"
        : isFocused
          ? "border-violet-300/80 bg-violet-500/18"
          : isCanonPath
            ? "border-violet-300/60 bg-violet-500/10"
            : "border-slate-500/45 bg-slate-700/20";

  const glow = isAccepted
    ? "shadow-[0_0_26px_rgba(52,211,153,0.45)]"
    : isConsequence
      ? justEmerged
        ? "shadow-[0_0_28px_rgba(45,212,191,0.55)]"
        : "shadow-[0_0_18px_rgba(45,212,191,0.35)]"
      : isFocused
        ? "shadow-[0_0_32px_rgba(167,139,250,0.4)]"
        : isCanonPath
          ? "shadow-[0_0_20px_rgba(167,139,250,0.35)]"
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
              ? "opacity-70 hover:opacity-100"
              : isConsequence
                ? "opacity-85 hover:opacity-100"
                : "opacity-75 hover:opacity-100"
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
        className={`flex items-center justify-center rounded-full border transition-all duration-300 ${ring} ${glow} ${
          isFocused ? "animate-trail-current" : ""
        } ${justAccepted ? "animate-accept-world" : ""}`}
        style={{ width: size, height: size }}
      >
        <div
          className={`rounded-full transition-all duration-300 ${coreColor} ${
            isFocused && !isAccepted ? "animate-truth-pulse" : ""
          } ${isAccepted ? "animate-truth-pulse" : ""}`}
          style={{ width: size * 0.22, height: size * 0.22 }}
        />
      </div>

      <div className={`max-w-[150px] text-center ${isCanonPath ? "max-w-[100px]" : ""}`}>
        <p
          className={`leading-snug ${
            isFocused
              ? isCanonPath
                ? "text-[11px] font-semibold text-white"
                : "text-sm font-semibold text-white"
              : role === "path"
                ? isCanonPath
                  ? "text-[9px] text-slate-300/85"
                  : "text-xs text-slate-300/85"
                : isCanonPath
                  ? "text-[9px] text-slate-400"
                  : "text-xs text-slate-400 group-hover:text-slate-200"
          }`}
        >
          {title}
        </p>

        {isFocused && category && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-violet-400/70">
            {category}
          </p>
        )}

        {isAccepted && !isCanonPath && (
          <span className="mt-1 inline-block rounded-sm bg-emerald-900/60 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-emerald-300">
            Established
          </span>
        )}

        {isDirection && decision === "pending" && (
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600 transition-colors group-hover:text-slate-500">
            Explore →
          </p>
        )}

        {isConsequence && !isAccepted && (
          <p className="mt-0.5 text-[8px] leading-snug text-teal-500/80">
            Unlocked because this became true
          </p>
        )}

        {hasCreatorDirection && (
          <p className="mt-1 text-[9px] font-medium tracking-wider text-amber-400/80">
            ✦ shaped by creator
          </p>
        )}
      </div>
    </div>
  );
}

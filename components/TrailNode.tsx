"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiscoveryDecision } from "@/types/discovery";

export type TrailRole = "focused" | "path" | "direction";

export type TrailNodeData = {
  title: string;
  category?: string;
  role: TrailRole;
  decision: DiscoveryDecision;
  justAccepted?: boolean;
  hasCreatorDirection?: boolean;
};

const SIZE: Record<TrailRole, number> = {
  focused: 64,
  path: 40,
  direction: 32,
};

export default function TrailNode({ data, selected }: NodeProps) {
  const { title, category, role, decision, justAccepted, hasCreatorDirection } =
    data as TrailNodeData;

  const size = SIZE[role];
  const isAccepted = decision === "accepted";
  const isSaved = decision === "saved";
  const isFocused = role === "focused";
  const isDirection = role === "direction";

  // Ring + fill colour by state
  const ring = isAccepted
    ? "border-emerald-300/80 bg-emerald-500/15"
    : isSaved
      ? "border-sky-300/70 bg-sky-500/12"
      : isFocused
        ? "border-violet-300/80 bg-violet-500/18"
        : "border-slate-500/45 bg-slate-700/20";

  const glow = isAccepted
    ? "shadow-[0_0_26px_rgba(52,211,153,0.45)]"
    : isFocused
      ? "shadow-[0_0_32px_rgba(167,139,250,0.4)]"
      : role === "path"
        ? "shadow-[0_0_12px_rgba(167,139,250,0.22)]"
        : selected
          ? "shadow-[0_0_16px_rgba(148,163,184,0.3)]"
          : "";

  const coreColor = isAccepted
    ? "bg-emerald-300"
    : isSaved
      ? "bg-sky-300"
      : isFocused
        ? "bg-violet-300"
        : "bg-slate-300/70";

  return (
    <div
      className={`group flex flex-col items-center gap-2 transition-all duration-300 ${
        isDirection ? "opacity-75 hover:opacity-100" : "opacity-100"
      }`}
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

      <div className="max-w-[150px] text-center">
        <p
          className={`leading-snug ${
            isFocused
              ? "text-sm font-semibold text-white"
              : role === "path"
                ? "text-xs text-slate-300/85"
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

        {isAccepted && (
          <span className="mt-1 inline-block rounded-sm bg-emerald-900/60 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-emerald-300">
            Established
          </span>
        )}

        {isDirection && decision === "pending" && (
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600 transition-colors group-hover:text-slate-500">
            Explore →
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

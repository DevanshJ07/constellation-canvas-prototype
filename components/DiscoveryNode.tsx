"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Discovery } from "@/types/discovery";

export type DiscoveryNodeData = {
  discovery: Discovery;
  regionId?: string;
  isHidden: boolean;
  hiddenLabel?: string;
  isRevealed?: boolean;
  justRevealed?: boolean;
  justAccepted?: boolean;
  decision?: "pending" | "accepted" | "saved" | "rejected";
};

export default function DiscoveryNode({ data, selected }: NodeProps) {
  const {
    discovery,
    isHidden,
    hiddenLabel,
    isRevealed,
    justRevealed,
    justAccepted,
    decision = "pending",
  } = data as DiscoveryNodeData;

  const revealed = !isHidden || isRevealed;
  const label = revealed ? discovery.title : hiddenLabel ?? "Unknown Signal";
  const isRejected = decision === "rejected";
  const isAccepted = decision === "accepted";
  const isSaved = decision === "saved";

  return (
    <div
      className={`group flex max-w-[140px] flex-col items-center gap-2 ${
        isRejected
          ? "animate-fade-out pointer-events-none"
          : justAccepted
            ? "animate-accept-world"
            : justRevealed
              ? "animate-reveal"
              : "transition-all duration-500"
      } ${isRejected ? "" : selected || revealed ? "opacity-100" : "opacity-70 hover:opacity-90"}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <div
        className={`h-3 w-3 rounded-full border transition-all duration-500 ${
          isAccepted
            ? "border-emerald-300 bg-emerald-200 shadow-[0_0_14px_rgba(110,231,183,0.85)]"
            : isSaved
              ? "border-sky-400 bg-sky-300/80 shadow-[0_0_10px_rgba(125,211,252,0.6)]"
              : justRevealed
                ? "border-violet-300 bg-violet-200 shadow-[0_0_16px_rgba(196,181,253,0.9)]"
                : revealed
                  ? selected
                    ? "border-violet-300 bg-violet-200 shadow-[0_0_12px_rgba(196,181,253,0.8)]"
                    : "border-slate-400 bg-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.5)] group-hover:shadow-[0_0_12px_rgba(203,213,225,0.7)]"
                  : "border-slate-600 bg-slate-700/80 shadow-[0_0_6px_rgba(100,116,139,0.3)] animate-pulse"
        }`}
      />
      <p
        className={`text-center text-xs leading-snug transition-all duration-500 ${
          isAccepted
            ? "text-emerald-200"
            : isSaved
              ? "text-sky-300"
              : revealed
                ? "text-slate-300"
                : "text-slate-500 italic"
        }`}
      >
        {label}
      </p>
      {isAccepted && (
        <span className="text-[10px] uppercase tracking-wider text-emerald-500/80">
          Established
        </span>
      )}
      {isSaved && (
        <span className="text-[10px] uppercase tracking-wider text-sky-500/80">
          Saved
        </span>
      )}
    </div>
  );
}

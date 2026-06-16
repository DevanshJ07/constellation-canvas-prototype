"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WorldConsequence, DiscoveryDecision } from "@/types/discovery";

export type ConsequenceNodeData = {
  consequence: WorldConsequence;
  decision?: DiscoveryDecision;
  justEmerged?: boolean;
  justAccepted?: boolean;
};

export default function ConsequenceNode({ data, selected }: NodeProps) {
  const {
    consequence,
    decision = "pending",
    justEmerged,
    justAccepted,
  } = data as ConsequenceNodeData;

  const isAccepted = decision === "accepted";
  const isSaved = decision === "saved";
  const isRejected = decision === "rejected";

  return (
    <div
      className={`group flex max-w-[130px] flex-col items-start gap-1.5 ${
        isRejected
          ? "animate-fade-out pointer-events-none"
          : justAccepted
            ? "animate-accept-world"
            : justEmerged
              ? "animate-emerge"
              : "transition-all duration-300"
      } ${isRejected ? "" : "opacity-90 hover:opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <div
        className={`h-2 w-2 rounded-full border transition-all duration-500 ${
          isAccepted
            ? "border-emerald-400 bg-emerald-300/90 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
            : isSaved
              ? "border-sky-400 bg-sky-300/80 shadow-[0_0_8px_rgba(125,211,252,0.6)]"
              : selected
                ? "border-teal-300 bg-teal-200/80 shadow-[0_0_12px_rgba(45,212,191,0.7)]"
                : "border-teal-500/70 bg-teal-400/60 shadow-[0_0_8px_rgba(45,212,191,0.4)] group-hover:border-teal-300 group-hover:shadow-[0_0_12px_rgba(45,212,191,0.6)]"
        }`}
      />
      <p
        className={`text-[11px] font-medium leading-snug transition-colors ${
          isAccepted
            ? "text-emerald-200/90"
            : isSaved
              ? "text-sky-200/90"
              : "text-teal-100/90"
        }`}
      >
        {consequence.title}
      </p>
      <span
        className={`text-[9px] uppercase tracking-wider ${
          isAccepted
            ? "text-emerald-500/80"
            : isSaved
              ? "text-sky-500/80"
              : "text-teal-500/70"
        }`}
      >
        {isAccepted ? "Established" : isSaved ? "Saved" : "Emerged"}
      </span>
    </div>
  );
}

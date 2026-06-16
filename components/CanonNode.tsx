"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Discovery } from "@/types/discovery";

export type CanonNodeData = {
  discovery: Discovery;
  justAccepted?: boolean;
};

export default function CanonNode({ data, selected }: NodeProps) {
  const { discovery, justAccepted } = data as CanonNodeData;

  return (
    <div
      className={`w-[200px] rounded-lg border bg-emerald-950/50 px-3 py-2.5 backdrop-blur-sm ${
        justAccepted ? "animate-accept-canon" : "transition-shadow duration-300"
      } ${
        selected
          ? "border-emerald-400/70 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
          : "border-emerald-500/45 shadow-[0_0_16px_rgba(16,185,129,0.2)]"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-400/90">
        Canon
      </p>
      <p className="mt-0.5 text-sm font-medium leading-snug text-emerald-50">
        {discovery.title}
      </p>
      <p className="mt-1 text-[10px] text-emerald-400/55">{discovery.category}</p>
    </div>
  );
}

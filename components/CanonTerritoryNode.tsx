"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

export type CanonTerritoryNodeData = {
  label: string;
  subtitle: string;
  count: number;
  height: number;
};

export default function CanonTerritoryNode({ data }: NodeProps) {
  const { label, subtitle, count, height } = data as CanonTerritoryNodeData;

  return (
    <div
      className="pointer-events-none rounded-2xl border-2 border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 via-slate-950/40 to-slate-950/60 px-5 py-4 shadow-[inset_0_0_80px_rgba(16,185,129,0.06)]"
      style={{ width: 300, height }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="canon-target"
        className="!left-0 !top-12 !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="canon-source"
        className="!left-0 !top-12 !opacity-0"
      />
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/90">
        {label}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-500/60">
        {subtitle}
      </p>
      <div className="my-3 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      <p className="text-[11px] text-slate-600">
        {count === 0
          ? "Accepted discoveries cross into reality here"
          : `${count} ${count === 1 ? "truth" : "truths"} established`}
      </p>
    </div>
  );
}

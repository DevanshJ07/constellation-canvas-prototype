"use client";

import type { NodeProps } from "@xyflow/react";

export type GhostOrbitNodeData = {
  accentColor?: string;
  label?: string;
};

/** Non-interactive dormant possibility — visual depth only. */
export default function GhostOrbitNode({ data }: NodeProps) {
  const { accentColor = "rgba(167, 139, 250, 0.35)" } = data as GhostOrbitNodeData;

  return (
    <div
      className="pointer-events-none flex flex-col items-center gap-1 opacity-30"
      aria-hidden
    >
      <div
        className="rounded-full border border-dashed animate-pulse"
        style={{
          width: 14,
          height: 14,
          borderColor: accentColor,
          background: `${accentColor}22`,
          boxShadow: `0 0 12px ${accentColor}33`,
        }}
      />
    </div>
  );
}

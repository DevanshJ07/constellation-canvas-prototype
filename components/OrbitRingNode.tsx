"use client";

import type { NodeProps } from "@xyflow/react";

export type OrbitRingNodeData = {
  radius: number;
  accentColor?: string;
  ringIndex?: number;
  showDust?: boolean;
};

export default function OrbitRingNode({ data }: NodeProps) {
  const {
    radius,
    accentColor = "rgba(167, 139, 250, 0.35)",
    ringIndex = 0,
    showDust = false,
  } = data as OrbitRingNodeData;
  const size = radius * 2 + 8;
  const opacity = ringIndex === 0 ? 0.55 : 0.32;

  return (
    <div
      className="pointer-events-none"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
    >
      <svg width={size} height={size} className="overflow-visible" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={1.2}
          strokeDasharray="4 6"
          opacity={opacity}
        />
        {showDust &&
          Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2 + ringIndex * 0.4;
            const cx = size / 2 + Math.cos(angle) * radius;
            const cy = size / 2 + Math.sin(angle) * radius;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={1.6}
                fill={accentColor}
                opacity={0.22}
              />
            );
          })}
      </svg>
    </div>
  );
}

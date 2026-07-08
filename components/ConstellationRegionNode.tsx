"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ConstellationRegionId } from "@/lib/regions";
import { getRegionTheme } from "@/lib/regions";
import type { DiscoveryDecision } from "@/types/discovery";

export type VitalityDot = { revealed: boolean; decision: DiscoveryDecision };

export type ConstellationRegionNodeData = {
  regionId: string;
  themeKey?: ConstellationRegionId;
  label: string;
  icon: string;
  width: number;
  height: number;
  vitalityDots?: VitalityDot[];
  description?: string;
  question?: string;
};

const STAR_CLUSTERS: Record<
  ConstellationRegionId,
  { x: number; y: number; r: number }[]
> = {
  mythology: [
    { x: 12, y: 58, r: 2 },
    { x: 88, y: 42, r: 1.5 },
    { x: 72, y: 88, r: 2.5 },
    { x: 28, y: 110, r: 1.5 },
    { x: 55, y: 72, r: 1 },
  ],
  rituals: [
    { x: 18, y: 52, r: 2 },
    { x: 92, y: 48, r: 1.5 },
    { x: 65, y: 95, r: 2 },
    { x: 35, y: 105, r: 1.5 },
    { x: 78, y: 68, r: 1 },
  ],
  bloodlines: [
    { x: 15, y: 55, r: 2 },
    { x: 85, y: 45, r: 1.5 },
    { x: 70, y: 82, r: 2 },
    { x: 40, y: 95, r: 1.5 },
  ],
  fear: [
    { x: 20, y: 50, r: 2 },
    { x: 90, y: 55, r: 1.5 },
    { x: 55, y: 90, r: 2.5 },
    { x: 75, y: 75, r: 1 },
  ],
  mystery: [
    { x: 14, y: 54, r: 2 },
    { x: 88, y: 50, r: 1.5 },
    { x: 62, y: 92, r: 2 },
    { x: 38, y: 88, r: 1.5 },
    { x: 50, y: 68, r: 1 },
  ],
};

function ConstellationLines({
  stars,
  lineColor,
}: {
  stars: { x: number; y: number }[];
  lineColor: string;
}) {
  if (stars.length < 2) return null;
  const points = stars.map((s) => `${s.x},${s.y}`).join(" ");

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function ConstellationRegionNode({ data }: NodeProps) {
  const { regionId, themeKey, label, icon, width, height, vitalityDots } =
    data as ConstellationRegionNodeData;
  const themeId = themeKey ?? "mythology";
  const theme = getRegionTheme(themeId);
  const stars = STAR_CLUSTERS[themeId] ?? STAR_CLUSTERS.mythology;
  const isOverview = Boolean(vitalityDots);

  const acceptedCount = vitalityDots?.filter((d) => d.decision === "accepted").length ?? 0;
  const revealedCount = vitalityDots?.filter((d) => d.revealed && d.decision !== "rejected").length ?? 0;
  const totalCount = vitalityDots?.filter((d) => d.decision !== "rejected").length ?? 0;

  return (
    <div
      className={`relative ${isOverview ? "group cursor-pointer" : "pointer-events-none"}`}
      style={{ width, height }}
    >
      <Handle
        type="target"
        position={Position.Right}
        id="region-target"
        className="!opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="region-source"
        className="!opacity-0"
      />

      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: theme.glow,
          boxShadow: isOverview
            ? `0 0 48px ${theme.dot}33, inset 0 0 32px ${theme.dot}18`
            : `0 0 64px ${theme.dot}44, inset 0 0 40px ${theme.dot}22`,
        }}
      />

      {/* Core pulse ring (overview) */}
      {isOverview && (
        <div
          className="pointer-events-none absolute inset-[-6px] rounded-[18px] opacity-50"
          style={{
            border: `1px solid ${theme.dot}55`,
            boxShadow: `0 0 24px ${theme.dot}33`,
          }}
        />
      )}

      {/* Hover ring (overview only) */}
      {isOverview && (
        <div className="absolute inset-0 rounded-2xl border border-transparent transition-all duration-300 group-hover:border-slate-600/30 group-hover:bg-white/[0.015]" />
      )}

      <ConstellationLines stars={stars} lineColor={theme.line} />

      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.r * 2,
            height: star.r * 2,
            backgroundColor: theme.dot,
            boxShadow: `0 0 ${star.r * 4}px ${theme.dot}`,
          }}
        />
      ))}

      {/* Label block */}
      <div className="relative px-1 pt-1">
        {/* Icon */}
        <p
          className={`mb-1.5 text-2xl leading-none ${theme.labelClass} opacity-70`}
        >
          {icon}
        </p>

        <h2
          className={`whitespace-nowrap text-[22px] font-medium uppercase leading-none tracking-[0.32em] ${theme.labelClass}`}
          style={{ textShadow: `0 0 28px ${theme.dot}88, 0 0 48px ${theme.dot}44` }}
        >
          {label}
        </h2>

        {/* Accent line */}
        <div
          className="mt-3 h-px w-28 opacity-80"
          style={{
            background: `linear-gradient(to right, ${theme.dot}, transparent)`,
            boxShadow: `0 0 8px ${theme.dot}66`,
          }}
        />

        {/* Vitality indicators (overview only) */}
        {vitalityDots && vitalityDots.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              {vitalityDots.map((dot, i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor:
                      dot.decision === "accepted"
                        ? "rgba(52,211,153,0.85)"
                        : dot.decision === "saved"
                          ? "rgba(125,211,252,0.75)"
                          : dot.decision === "rejected"
                            ? "rgba(51,65,85,0.5)"
                            : dot.revealed
                              ? "rgba(203,213,225,0.55)"
                              : "rgba(71,85,105,0.4)",
                  }}
                />
              ))}
            </div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">
              {revealedCount}/{totalCount} explored
              {acceptedCount > 0 && (
                <span style={{ color: "rgba(52,211,153,0.7)" }}>
                  {" "}· {acceptedCount} in canon
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

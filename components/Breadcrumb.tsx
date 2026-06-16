"use client";

import { useMemo } from "react";
import { CONSTELLATION_REGIONS } from "@/lib/regions";
import { getNodeTitle } from "@/lib/worldNodes";
import type { NavState } from "@/types/discovery";

type Segment = {
  label: string;
  icon?: string;
  onClick?: () => void;
};

type BreadcrumbProps = {
  navState: NavState;
  onNavigate: (state: NavState) => void;
};

export default function Breadcrumb({ navState, onNavigate }: BreadcrumbProps) {
  const segments = useMemo((): Segment[] => {
    const worldSegment: Segment = {
      label: "World",
      onClick: () => onNavigate({ mode: "overview" }),
    };

    if (navState.mode === "overview") {
      return [{ label: "World" }];
    }

    if (navState.mode === "canon") {
      return [{ label: "Canon Universe" }];
    }

    const region = CONSTELLATION_REGIONS.find(
      (r) =>
        r.id ===
        (navState.mode === "constellation" || navState.mode === "discovery"
          ? navState.regionId
          : ""),
    );

    if (navState.mode === "constellation") {
      return [
        worldSegment,
        { label: region?.label ?? "", icon: region?.icon },
      ];
    }

    if (navState.mode === "discovery") {
      const trail = navState.trail;
      // Skip the first trail item if it is the virtual region root
      // (its label is already shown as the region segment)
      const displayTrail =
        trail.length > 0 && trail[0] === navState.regionId
          ? trail.slice(1)
          : trail;

      const trailSegments: Segment[] = displayTrail.map((id, i) => {
        const isLast = i === displayTrail.length - 1;
        // Map back to real trail index (+1 if we skipped the virtual root)
        const realIdx = trail.length > 0 && trail[0] === navState.regionId ? i + 1 : i;
        return {
          label: getNodeTitle(id),
          onClick: isLast
            ? undefined
            : () =>
                onNavigate({
                  ...navState,
                  trail: trail.slice(0, realIdx + 1),
                }),
        };
      });

      return [
        worldSegment,
        {
          label: region?.label ?? "",
          icon: region?.icon,
          onClick: () =>
            onNavigate({
              mode: "overview",
            }),
        },
        ...trailSegments,
      ];
    }

    return [{ label: "World" }];
  }, [navState, onNavigate]);

  return (
    <div
      className="absolute top-0 z-20 flex h-9 items-center gap-1.5 px-4"
      style={{ left: "176px" }}
    >
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-slate-500 select-none">›</span>
          )}
          {seg.icon && (
            <span className="text-[13px] leading-none opacity-60">
              {seg.icon}
            </span>
          )}
          {seg.onClick ? (
            <button
              type="button"
              onClick={seg.onClick}
              className="text-xs font-medium text-slate-400 transition hover:text-slate-100"
            >
              {seg.label}
            </button>
          ) : (
            <span className="text-xs font-medium text-slate-100">{seg.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

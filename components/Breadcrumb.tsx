"use client";

import { useMemo } from "react";
import { CONSTELLATION_REGIONS } from "@/lib/regions";
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
      return [
        worldSegment,
        {
          label: region?.label ?? "",
          icon: region?.icon,
          onClick: () =>
            onNavigate({
              mode: "constellation",
              regionId: navState.regionId,
            }),
        },
        { label: navState.discoveryTitle },
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
            <span className="text-slate-700 select-none">›</span>
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
              className="text-xs text-slate-500 transition hover:text-slate-300"
            >
              {seg.label}
            </button>
          ) : (
            <span className="text-xs text-slate-300">{seg.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

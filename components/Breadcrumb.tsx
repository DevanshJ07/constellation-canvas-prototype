"use client";

import type { SelectionBreadcrumbSegment } from "@/lib/buildSelectionBreadcrumb";

type BreadcrumbProps = {
  segments: SelectionBreadcrumbSegment[];
  onNavigate: (segment: SelectionBreadcrumbSegment) => void;
};

export default function Breadcrumb({ segments, onNavigate }: BreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="World location"
      className="absolute top-3 z-20 flex max-w-[min(640px,calc(100vw-220px))] items-center"
      style={{ left: "184px" }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg border border-slate-700/55 bg-slate-950/88 px-3 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(148,163,184,0.06)] backdrop-blur-md">
        {segments.map((seg, i) => (
          <span key={`${seg.id}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <span className="shrink-0 px-0.5 text-[11px] text-slate-600 select-none">›</span>
            )}
            {!seg.isLast ? (
              <button
                type="button"
                onClick={() => onNavigate(seg)}
                className="truncate text-xs font-medium text-slate-400 transition hover:text-violet-200/90"
              >
                {seg.label}
              </button>
            ) : (
              <span className="truncate text-xs font-medium text-slate-100">{seg.label}</span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}

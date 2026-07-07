"use client";

type ZoomControlsBarProps = {
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** Right inset when a side panel is open (px). */
  panelInset?: number;
};

export default function ZoomControlsBar({
  zoomPct,
  onZoomIn,
  onZoomOut,
  onReset,
  panelInset = 0,
}: ZoomControlsBarProps) {
  return (
    <div
      className="pointer-events-none fixed z-[35] flex justify-end"
      style={{
        left: "176px",
        right: `${panelInset}px`,
        bottom: "88px",
      }}
    >
      <div className="pointer-events-auto mr-4 flex flex-col overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/92 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomIn}
          className="flex h-8 w-9 items-center justify-center text-sm text-slate-300 transition hover:bg-slate-800/60 hover:text-white"
          aria-label="Zoom in"
        >
          +
        </button>
        <div className="border-y border-slate-800/60 px-2 py-1 text-center text-[10px] tabular-nums text-slate-500">
          {zoomPct}%
        </div>
        <button
          type="button"
          onClick={onZoomOut}
          className="flex h-8 w-9 items-center justify-center text-sm text-slate-300 transition hover:bg-slate-800/60 hover:text-white"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={onReset}
          className="border-t border-slate-800/60 px-1 py-1.5 text-[9px] uppercase tracking-wider text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300"
          aria-label="Reset zoom to 100%"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

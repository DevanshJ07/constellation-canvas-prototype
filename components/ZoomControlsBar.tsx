"use client";

type ZoomControlsBarProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Right inset when a side panel is open (px). */
  panelInset?: number;
};

function MagnifyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

/** Height reserved for the bottom steer bar + gap (px). */
const STEER_ZONE_PX = 88;

export default function ZoomControlsBar({
  onZoomIn,
  onZoomOut,
  panelInset = 0,
}: ZoomControlsBarProps) {
  return (
    <div
      className="pointer-events-none fixed z-[35]"
      style={{
        right: `${panelInset + 20}px`,
        bottom: `${STEER_ZONE_PX}px`,
      }}
    >
      <div className="pointer-events-auto flex items-center gap-px overflow-hidden rounded-lg border border-violet-400/35 bg-slate-900/95 shadow-[0_4px_24px_rgba(0,0,0,0.55),0_0_20px_rgba(139,92,246,0.12),inset_0_0_0_1px_rgba(167,139,250,0.08)] backdrop-blur-md">
        <span
          className="flex h-8 w-8 items-center justify-center text-violet-300/80"
          aria-hidden
        >
          <MagnifyIcon />
        </span>
        <button
          type="button"
          onClick={onZoomOut}
          className="flex h-8 w-8 items-center justify-center border-l border-violet-500/20 text-base leading-none text-slate-200 transition hover:bg-violet-950/50 hover:text-white"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="flex h-8 w-8 items-center justify-center border-l border-violet-500/20 text-base leading-none text-slate-200 transition hover:bg-violet-950/50 hover:text-white"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}

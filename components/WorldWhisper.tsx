"use client";

import { useRef, useState } from "react";

type WorldWhisperProps = {
  onSubmit: (truth: string) => void;
  /** Right inset when detail panel is open (px). */
  panelInset?: number;
};

export default function WorldWhisper({
  onSubmit,
  panelInset = 0,
}: WorldWhisperProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div
      className="pointer-events-none fixed z-[34] flex justify-center px-4"
      style={{
        left: "176px",
        right: `${panelInset}px`,
        bottom: "20px",
      }}
    >
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-xl border border-violet-500/50 bg-slate-950/95 px-4 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_32px_rgba(139,92,246,0.18),inset_0_0_0_1px_rgba(167,139,250,0.12)] backdrop-blur-md">
        <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/90 sm:inline">
          Steer
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Steer the world…"
          aria-label="Steer the world"
          className="min-h-[38px] flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-400/80"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/55 bg-violet-950/60 text-violet-100 shadow-[0_0_16px_rgba(139,92,246,0.25)] transition hover:border-violet-400/70 hover:bg-violet-950/80 disabled:cursor-default disabled:opacity-30 disabled:shadow-none"
          aria-label="Submit steering direction"
        >
          <span className="text-sm leading-none">↵</span>
        </button>
      </div>
    </div>
  );
}

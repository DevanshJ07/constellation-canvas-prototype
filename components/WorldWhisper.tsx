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
      <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-xl border border-violet-800/35 bg-slate-950/88 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_0_1px_rgba(167,139,250,0.06)] backdrop-blur-md">
        <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/70 sm:inline">
          Whisper
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell the world something..."
          className="min-h-[36px] flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-600/40 bg-violet-950/50 text-violet-200 transition hover:border-violet-500/55 hover:bg-violet-950/70 disabled:cursor-default disabled:opacity-30"
          aria-label="Submit truth"
        >
          <span className="text-sm leading-none">↵</span>
        </button>
      </div>
    </div>
  );
}

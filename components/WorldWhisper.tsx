"use client";

import { useRef, useState } from "react";

const EXAMPLES = [
  "Memory is used as currency.",
  "The goddess was imprisoned.",
  "Nobody remembers their own name.",
  "The forest exists outside time.",
];

type WorldWhisperProps = {
  onSubmit: (truth: string) => void;
};

export default function WorldWhisper({ onSubmit }: WorldWhisperProps) {
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

  function handleExampleClick(example: string) {
    setValue(example);
    inputRef.current?.focus();
  }

  return (
    <div className="absolute bottom-6 z-20 w-72 rounded-xl border border-slate-800/70 bg-slate-950/92 shadow-[0_4px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
      style={{ left: "calc(176px + 16px)" }}
    >
      {/* Header */}
      <div className="border-b border-slate-800/60 px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          World Whisper
        </p>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 px-3 py-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell the world something..."
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-700 text-slate-500 transition hover:border-emerald-700/60 hover:text-emerald-400 disabled:cursor-default disabled:opacity-30"
          aria-label="Submit truth"
        >
          <span className="text-xs leading-none">↵</span>
        </button>
      </div>

      {/* Example chips */}
      <div className="border-t border-slate-800/50 px-3 py-2.5">
        <div className="flex flex-col gap-1">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="group flex items-start gap-1.5 text-left"
            >
              <span className="mt-0.5 shrink-0 text-[10px] text-slate-700 transition group-hover:text-slate-500">
                ·
              </span>
              <span className="text-[11px] leading-snug text-slate-600 transition group-hover:text-slate-400">
                {example}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

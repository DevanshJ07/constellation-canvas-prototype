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
  emphasized?: boolean;
};

export default function WorldWhisper({
  onSubmit,
  emphasized = false,
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

  function handleExampleClick(example: string) {
    setValue(example);
    inputRef.current?.focus();
  }

  return (
    <div
      className={`absolute bottom-6 z-20 w-80 rounded-xl border backdrop-blur-md ${
        emphasized
          ? "border-violet-500/55 bg-slate-900/98 shadow-[0_0_48px_rgba(167,139,250,0.22),0_0_0_1px_rgba(167,139,250,0.12),0_12px_48px_rgba(0,0,0,0.6)] ring-1 ring-violet-400/15"
          : "border-violet-700/45 bg-slate-950/96 shadow-[0_0_32px_rgba(167,139,250,0.14),0_8px_40px_rgba(0,0,0,0.55)]"
      }`}
      style={{ left: "calc(176px + 16px)" }}
    >
      <div
        className={`border-b px-4 py-3 ${
          emphasized
            ? "border-violet-600/40 bg-violet-950/40"
            : "border-violet-800/35 bg-violet-950/28"
        }`}
      >
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.26em] ${
            emphasized ? "text-violet-100" : "text-violet-200/95"
          }`}
        >
          World Whisper
        </p>
        <p
          className={`mt-0.5 text-[11px] ${
            emphasized ? "text-slate-300" : "text-slate-400"
          }`}
        >
          Tell the world something
        </p>
      </div>

      <div className="flex items-center gap-2 px-3 py-3">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell the world something..."
          className={`flex-1 bg-transparent text-sm outline-none ${
            emphasized
              ? "text-slate-50 placeholder-slate-400"
              : "text-slate-100 placeholder-slate-500"
          }`}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-600/55 bg-emerald-950/50 text-emerald-300 transition hover:border-emerald-400/65 hover:bg-emerald-950/70 disabled:cursor-default disabled:opacity-30"
          aria-label="Submit truth"
        >
          <span className="text-xs leading-none">↵</span>
        </button>
      </div>

      <div className="border-t border-slate-600/45 px-3 py-2.5">
        <p className="mb-1.5 text-[9px] uppercase tracking-wider text-slate-400">
          Examples
        </p>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="group flex items-start gap-2 text-left"
            >
              <span className="mt-0.5 shrink-0 text-[10px] text-violet-400/70 transition group-hover:text-violet-300">
                ·
              </span>
              <span
                className={`text-[11px] leading-snug transition group-hover:text-slate-100 ${
                  emphasized ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {example}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

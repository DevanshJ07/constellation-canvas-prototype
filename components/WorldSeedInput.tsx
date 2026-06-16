"use client";

import { useState } from "react";

const DEFAULT_SEED =
  "Psychological horror universe rooted in forgotten Indian folklore.";

type WorldSeedInputProps = {
  onGenerate: (seed: string) => void;
};

export default function WorldSeedInput({ onGenerate }: WorldSeedInputProps) {
  const [seed, setSeed] = useState(DEFAULT_SEED);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = seed.trim();
    if (trimmed) onGenerate(trimmed);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6">
      <div className="w-full max-w-lg">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
          Constellation Canvas
        </p>
        <h1 className="mb-8 text-2xl font-light text-slate-100">
          World Seed
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <textarea
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none focus:border-slate-600"
            placeholder="Describe the world you want to explore..."
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white"
          >
            Generate Constellation
          </button>
        </form>
      </div>
    </div>
  );
}

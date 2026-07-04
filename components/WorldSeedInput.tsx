"use client";

import { useState } from "react";
import type { ConstellationCreateOutput } from "@/lib/dynamicConstellations";

const DEFAULT_SEED =
  "Psychological horror universe rooted in forgotten Indian folklore.";

const EXAMPLE_SEEDS = [
  "A slapstick superhero comedy set in an Indian engineering college",
  "A romantic sci-fi story about two people sharing dreams",
  "Comedy universe of friends lost in a jungle and the chaos they encounter",
  "A political thriller about an AI that learned to grieve",
];

type WorldSeedInputProps = {
  onGenerate: (seed: string, result: ConstellationCreateOutput) => void;
};

type LoadingStep = "idle" | "reading" | "assembling" | "done";

export default function WorldSeedInput({ onGenerate }: WorldSeedInputProps) {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [step, setStep] = useState<LoadingStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = step === "reading" || step === "assembling";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = seed.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setStep("reading");

    await new Promise((r) => setTimeout(r, 350));
    setStep("assembling");

    try {
      const res = await fetch("/api/constellations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldSeed: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data = (await res.json()) as ConstellationCreateOutput;
      onGenerate(trimmed, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Could not reach server: ${msg}. Using fallback agents.`);
      setStep("idle");

      // Proceed with the seed using a fallback result
      try {
        const fallbackRes = await fetch("/api/constellations/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worldSeed: trimmed }),
        });
        const fallbackData = (await fallbackRes.json()) as ConstellationCreateOutput;
        onGenerate(trimmed, { ...fallbackData, usedFallback: true });
      } catch {
        onGenerate(trimmed, {
          worldInterpretation: { genre: "", tone: "", medium: "", coreCreativeChallenge: "" },
          constellations: [],
          usedFallback: true,
          fallbackReason: "Could not reach server",
        });
      }
    }
  }

  const stepLabel =
    step === "reading"
      ? "Reading your world seed..."
      : step === "assembling"
        ? "Assembling creative constellations..."
        : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6">
      <div className="w-full max-w-lg">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
          Constellation Canvas
        </p>
        <h1 className="mb-2 text-2xl font-light text-slate-100">
          World Seed
        </h1>
        <p className="mb-8 text-[11px] leading-relaxed text-slate-600">
          Describe the world you want to explore. The canvas will assemble the right creative specialists for your specific world.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <textarea
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            rows={4}
            disabled={isLoading}
            className="w-full resize-none rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none focus:border-slate-600 disabled:opacity-50"
            placeholder="Describe the world you want to explore..."
          />

          {/* Example seeds */}
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600">
              Examples
            </p>
            <div className="flex flex-col gap-1">
              {EXAMPLE_SEEDS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setSeed(ex)}
                  className="group flex items-start gap-2 text-left disabled:opacity-40"
                >
                  <span className="mt-0.5 shrink-0 text-[10px] text-slate-600 group-hover:text-violet-400">
                    ·
                  </span>
                  <span className="text-[11px] leading-snug text-slate-500 group-hover:text-slate-300">
                    {ex}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!seed.trim() || isLoading}
            className="w-full rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? stepLabel : "Generate Constellation"}
          </button>

          {error && (
            <p className="text-center text-[11px] text-amber-400/80">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

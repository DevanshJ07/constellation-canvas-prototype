"use client";

import { useState } from "react";
import type { ConstellationCreateOutput } from "@/lib/dynamicConstellations";
import { fallbackConstellations } from "@/lib/dynamicConstellations";
import type { WorldArchitecture } from "@/lib/worldBrain/architectWorld";
import {
  mapArchitectureToCanvasModel,
  type CanvasWorldModel,
} from "@/lib/worldBrain/mapArchitectureToCanvas";

const DEFAULT_SEED =
  "Psychological horror universe rooted in forgotten Indian folklore.";

const DEFAULT_PURPOSE = "worldbuilding exploration";

const EXAMPLE_SEEDS = [
  "A slapstick superhero comedy set in an Indian engineering college",
  "A romantic sci-fi story about two people sharing dreams",
  "Comedy universe of friends lost in a jungle and the chaos they encounter",
  "A political thriller about an AI that learned to grieve",
];

type WorldSeedInputProps = {
  onGenerate: (
    seed: string,
    result: ConstellationCreateOutput,
    architectureModel?: CanvasWorldModel,
    purpose?: string,
  ) => void;
};

type LoadingStep = "idle" | "reading" | "assembling" | "done";

export default function WorldSeedInput({ onGenerate }: WorldSeedInputProps) {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE);
  const [step, setStep] = useState<LoadingStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = step === "reading" || step === "assembling";

  async function fetchConstellations(trimmed: string): Promise<ConstellationCreateOutput> {
    const res = await fetch("/api/constellations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldSeed: trimmed }),
    });

    if (!res.ok) {
      throw new Error(`Server error ${res.status}`);
    }

    return (await res.json()) as ConstellationCreateOutput;
  }

  async function fetchArchitecture(
    trimmed: string,
    purposeValue: string,
  ): Promise<CanvasWorldModel | undefined> {
    const res = await fetch("/api/world/architect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        worldPrompt: trimmed,
        purpose: purposeValue.trim() || DEFAULT_PURPOSE,
      }),
    });

    if (!res.ok) return undefined;

    const data = (await res.json()) as WorldArchitecture;
    if (!data?.visibleConstellations?.length) return undefined;

    return mapArchitectureToCanvasModel(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = seed.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setStep("reading");

    await new Promise((r) => setTimeout(r, 350));
    setStep("assembling");

    const purposeValue = purpose.trim() || DEFAULT_PURPOSE;

    const [architectureModel, constellationResult] = await Promise.all([
      fetchArchitecture(trimmed, purposeValue).catch(() => undefined),
      fetchConstellations(trimmed).catch(() => null),
    ]);

    if (constellationResult) {
      onGenerate(trimmed, constellationResult, architectureModel, purposeValue);
      return;
    }

    setError("Could not reach server. Using fallback agents.");
    setStep("idle");

    onGenerate(
      trimmed,
      {
        worldInterpretation: { genre: "", tone: "", medium: "", coreCreativeChallenge: "" },
        constellations: [],
        usedFallback: true,
        fallbackReason: "Could not reach server",
      },
      architectureModel,
      purposeValue,
    );
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

          <div>
            <label
              htmlFor="world-purpose"
              className="mb-1.5 block text-[9px] uppercase tracking-[0.18em] text-slate-600"
            >
              Purpose (optional)
            </label>
            <input
              id="world-purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={isLoading}
              placeholder={DEFAULT_PURPOSE}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-slate-600 disabled:opacity-50"
            />
          </div>

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

          {process.env.NODE_ENV === "development" && (
            <button
              type="button"
              onClick={() =>
                onGenerate(
                  seed.trim() || "Dev ripple preview test world",
                  {
                    ...fallbackConstellations("dev-preview-test"),
                    fallbackReason: "dev-preview-test",
                  },
                  undefined,
                  purpose,
                )
              }
              className="w-full rounded-lg border border-violet-900/40 bg-violet-950/20 px-4 py-2 text-[11px] text-violet-300/80 transition hover:border-violet-700/60 hover:text-violet-200"
            >
              Dev: open canvas for preview test (no API)
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

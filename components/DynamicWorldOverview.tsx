"use client";

import type { DynamicConstellation, WorldInterpretation } from "@/lib/dynamicConstellations";
import { THEME_COLORS } from "@/lib/dynamicConstellations";

type DynamicWorldOverviewProps = {
  constellations: DynamicConstellation[];
  worldInterpretation: WorldInterpretation | null;
  worldSeed: string;
  usedFallback?: boolean;
  fallbackReason?: string;
  isGenerating?: boolean;
  generatingStep?: string;
  onSelectConstellation: (constellation: DynamicConstellation) => void;
};

function ConstellationCard({
  constellation,
  onClick,
}: {
  constellation: DynamicConstellation;
  onClick: () => void;
}) {
  const theme = THEME_COLORS[constellation.colorTheme] ?? THEME_COLORS.violet;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all duration-300"
      style={{
        borderColor: theme.border,
        backgroundColor: theme.bg,
        boxShadow: `0 0 0 0 ${theme.glow}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 32px ${theme.glow}`;
        (e.currentTarget as HTMLElement).style.borderColor = theme.glow.replace("0.2", "0.7");
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${theme.glow}`;
        (e.currentTarget as HTMLElement).style.borderColor = theme.border;
      }}
    >
      {/* Symbol + title row */}
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="text-xl leading-none"
            style={{ color: theme.text }}
          >
            {constellation.symbol}
          </span>
          <div>
            <p
              className="text-sm font-semibold leading-snug tracking-wide"
              style={{ color: theme.text }}
            >
              {constellation.title}
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {constellation.agentName}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 text-xs text-slate-600 transition group-hover:text-slate-400"
        >
          Enter →
        </span>
      </div>

      {/* Purpose */}
      <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">
        {constellation.purpose}
      </p>

      {/* Focus questions (first one) */}
      {constellation.focusQuestions[0] && (
        <div
          className="w-full rounded-md border px-2.5 py-2"
          style={{ borderColor: theme.border, backgroundColor: "rgba(0,0,0,0.2)" }}
        >
          <p className="text-[10px] italic leading-snug text-slate-500">
            "{constellation.focusQuestions[0]}"
          </p>
        </div>
      )}
    </button>
  );
}

export default function DynamicWorldOverview({
  constellations,
  worldInterpretation,
  worldSeed,
  usedFallback,
  fallbackReason,
  isGenerating,
  generatingStep,
  onSelectConstellation,
}: DynamicWorldOverviewProps) {
  if (isGenerating) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="mb-4 text-2xl text-slate-600">✦</div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
            {generatingStep ?? "Reading your world seed..."}
          </p>
          <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-slate-700">
            {worldSeed}
          </p>
        </div>
      </div>
    );
  }

  const gridCols =
    constellations.length <= 3
      ? "grid-cols-1 sm:grid-cols-3"
      : constellations.length === 4
        ? "grid-cols-2"
        : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0a0a0f]">
      <div className="mx-auto max-w-3xl px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-600">
            World Overview
          </p>
          <h1 className="mt-2 text-lg font-light leading-snug text-slate-200">
            {worldSeed}
          </h1>
          {worldInterpretation && (
            <div className="mt-3 flex flex-wrap gap-3">
              {worldInterpretation.genre && (
                <span className="rounded-full border border-slate-800/70 bg-slate-900/50 px-2.5 py-1 text-[10px] font-medium text-slate-400">
                  {worldInterpretation.genre}
                </span>
              )}
              {worldInterpretation.tone && (
                <span className="rounded-full border border-slate-800/70 bg-slate-900/50 px-2.5 py-1 text-[10px] font-medium text-slate-400">
                  {worldInterpretation.tone}
                </span>
              )}
              {worldInterpretation.medium && (
                <span className="rounded-full border border-slate-800/70 bg-slate-900/50 px-2.5 py-1 text-[10px] font-medium text-slate-400">
                  {worldInterpretation.medium}
                </span>
              )}
            </div>
          )}
          {worldInterpretation?.coreCreativeChallenge && (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
              {worldInterpretation.coreCreativeChallenge}
            </p>
          )}
        </div>

        {/* Agents assembled notice */}
        {!usedFallback && (
          <div className="mb-6 flex items-center gap-2">
            <span className="text-[10px] text-violet-400">✦</span>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-400/70">
              Agents assembled from your world seed
            </p>
          </div>
        )}
        {usedFallback && (
          <div className="mb-6 rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-2.5 space-y-1">
            <p className="text-[11px] leading-relaxed text-slate-500">
              Using local fallback constellations. Add{" "}
              <code className="rounded bg-slate-800/60 px-1 py-0.5 text-[10px] text-slate-400">
                OPENROUTER_API_KEY
              </code>{" "}
              for adaptive agent creation.
            </p>
            {fallbackReason && (
              <p className="text-[10px] text-slate-700 font-mono truncate">
                {fallbackReason}
              </p>
            )}
          </div>
        )}

        {/* Constellation grid */}
        <div className={`grid gap-4 ${gridCols}`}>
          {constellations.map((c) => (
            <ConstellationCard
              key={c.id}
              constellation={c}
              onClick={() => onSelectConstellation(c)}
            />
          ))}
        </div>

        {/* Footer hint */}
        <p className="mt-8 text-center text-[10px] text-slate-700">
          Select a constellation to begin exploring this dimension of your world.
        </p>
      </div>
    </div>
  );
}

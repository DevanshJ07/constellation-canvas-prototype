"use client";

import type { CanonProfile } from "@/lib/canonProfile";
import type { CanonStructure } from "@/lib/canonStructure";
import { CANON_COLORS } from "@/lib/canonColors";
import type { WorldEvolutionNarrative } from "@/lib/canonEvolutionNarrative";

type CanonUniverseOverlayProps = {
  profile: CanonProfile;
  structure: CanonStructure;
  evolutionNarratives: WorldEvolutionNarrative[];
  hasTruths: boolean;
  onBuildWorld: () => void;
  onSelectNode?: (nodeId: string) => void;
};

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-700/50 pb-3.5 last:border-b-0">
      <h2
        className="text-[9px] font-bold uppercase tracking-[0.2em]"
        style={{ color: accent ?? "#94A3B8" }}
      >
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function EvolutionCard({
  narrative,
  onSelectNode,
}: {
  narrative: WorldEvolutionNarrative;
  onSelectNode?: (nodeId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-700/55 bg-slate-900/70 px-3 py-2.5">
      <button
        type="button"
        onClick={() => onSelectNode?.(narrative.nodeId)}
        className="text-left text-xs font-semibold transition hover:brightness-110"
        style={{ color: CANON_COLORS.establishedTruth.text }}
      >
        {narrative.title} became canon
      </button>

      {narrative.stateShifts.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {narrative.stateShifts.map((shift) => (
            <li
              key={shift}
              className="flex items-start gap-1.5 text-[11px] font-medium"
              style={{ color: CANON_COLORS.worldState.text }}
            >
              <span className="opacity-60">→</span>
              {shift}
            </li>
          ))}
        </ul>
      )}

      {narrative.unlocked.length > 0 && (
        <div className="mt-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            Unlocked
          </p>
          <ul className="mt-1 space-y-0.5">
            {narrative.unlocked.map((item) => (
              <li
                key={item}
                className="text-[11px]"
                style={{ color: CANON_COLORS.potentialFuture.text }}
              >
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrative.crossDomain.length > 0 && (
        <div className="mt-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            Consequences
          </p>
          <ul className="mt-1 space-y-0.5">
            {narrative.crossDomain.map((item) => (
              <li
                key={item}
                className="text-[11px]"
                style={{ color: CANON_COLORS.consequence.text }}
              >
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {narrative.evolutions.length > 0 && (
        <div className="mt-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            World Evolution
          </p>
          <ul className="mt-1 space-y-0.5">
            {narrative.evolutions.map((item) => (
              <li
                key={item}
                className="text-[11px] font-medium"
                style={{ color: CANON_COLORS.worldState.text }}
              >
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CanonUniverseOverlay({
  profile,
  structure,
  evolutionNarratives,
  hasTruths,
  onBuildWorld,
  onSelectNode,
}: CanonUniverseOverlayProps) {
  const barFilled = Math.round(profile.completionPct / 10);
  const recentNarratives = [...evolutionNarratives].reverse();

  return (
    <>
      {/* Header bar — top center */}
      <div
        className="pointer-events-none absolute z-20 flex flex-col items-center"
        style={{ left: "176px", right: 0, top: "44px" }}
      >
        <div className="pointer-events-auto flex items-center gap-4">
          <div className="text-center">
            <h1 className="text-sm font-semibold tracking-wide text-slate-100">
              Canon Universe
            </h1>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {profile.establishedCount} truths · {profile.genre}
            </p>
          </div>
          <button
            type="button"
            onClick={onBuildWorld}
            disabled={!hasTruths}
            className="rounded-lg border border-violet-500/45 bg-violet-950/55 px-3 py-1.5 text-[11px] font-medium text-violet-100 transition hover:border-violet-400/60 disabled:opacity-40"
          >
            Build My World ✨
          </button>
        </div>
      </div>

      {/* Primary world bible — left */}
      <div
        className="pointer-events-none absolute z-20"
        style={{ left: "192px", top: "88px", bottom: "80px", width: "340px" }}
      >
        <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-xl border border-slate-600/50 bg-slate-950/95 shadow-[0_8px_48px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <div className="border-b border-slate-700/60 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300/90">
              Your World Bible
            </p>
            <p className="mt-0.5 text-xs text-slate-300">
              What kind of world have you built?
            </p>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
            <Section title="Core Premise">
              <p className="text-sm font-medium leading-snug text-slate-100">
                {structure.corePremise}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">{profile.genre}</p>
            </Section>

            {recentNarratives.length > 0 && (
              <Section
                title="World Evolution"
                accent={CANON_COLORS.worldState.text}
              >
                <div className="space-y-2">
                  {recentNarratives.map((n) => (
                    <EvolutionCard
                      key={`${n.nodeId}-${n.ts}`}
                      narrative={n}
                      onSelectNode={onSelectNode}
                    />
                  ))}
                </div>
              </Section>
            )}

            {structure.activeTensions.length > 0 && (
              <Section
                title="World State"
                accent={CANON_COLORS.worldState.text}
              >
                <div
                  className="rounded-md border px-2.5 py-2"
                  style={{
                    borderColor: CANON_COLORS.worldState.border,
                    backgroundColor: CANON_COLORS.worldState.bg,
                  }}
                >
                  <ul className="space-y-1">
                    {structure.activeTensions.map((t) => (
                      <li
                        key={t}
                        className="text-xs font-semibold"
                        style={{ color: CANON_COLORS.worldState.text }}
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>
            )}

            {structure.isFragmented && (
              <div className="rounded-md border border-amber-800/40 bg-amber-950/20 px-3 py-2">
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Some truths are not yet connected. Explore or steer them to
                  strengthen world coherence.
                </p>
              </div>
            )}

            {structure.potentialFutures.length > 0 && (
              <Section
                title="Future Directions"
                accent={CANON_COLORS.potentialFuture.text}
              >
                <ul className="space-y-1">
                  {structure.potentialFutures.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs font-medium"
                      style={{ color: CANON_COLORS.potentialFuture.text }}
                    >
                      <span className="opacity-50">→</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          <div className="border-t border-slate-700/60 px-4 py-3">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-500">
              <span>Coherence · {profile.coherenceScore}%</span>
              <span>Completion · {profile.completionPct}%</span>
            </div>
            <div className="mt-1.5 flex h-1 gap-px">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className={`h-full flex-1 rounded-sm ${
                    i < barFilled ? "bg-violet-500/55" : "bg-slate-700/80"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

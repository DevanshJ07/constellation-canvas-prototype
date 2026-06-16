"use client";

import type { CanonProfile } from "@/lib/canonProfile";
import type { EvolutionFeedEntry } from "@/lib/worldEvolution";

type CanonUniverseOverlayProps = {
  profile: CanonProfile;
  hasTruths: boolean;
  worldTensions: string[];
  evolutionFeed: EvolutionFeedEntry[];
  onBuildWorld: () => void;
};

function CoherenceMeter({ score }: { score: number }) {
  const segments = 12;
  const filled = Math.round((score / 100) * segments);
  const color =
    score >= 70
      ? "bg-emerald-500/70"
      : score >= 40
        ? "bg-amber-500/65"
        : "bg-rose-500/60";
  const label =
    score >= 70 ? "Coherent" : score >= 40 ? "Developing" : "Fragmented";
  const labelColor =
    score >= 70
      ? "text-emerald-300"
      : score >= 40
        ? "text-amber-300"
        : "text-rose-300";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-400">
          World Coherence
        </span>
        <span className={`text-[10px] tabular-nums font-medium ${labelColor}`}>
          {score}% · {label}
        </span>
      </div>
      <div className="flex h-1.5 w-44 gap-px">
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            className={`h-full flex-1 rounded-sm transition-all duration-500 ${
              i < filled ? color : "bg-slate-700/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function feedEntryText(entry: EvolutionFeedEntry): string {
  switch (entry.kind) {
    case "canon":
      return `${entry.title} became canon`;
    case "state_shift":
      return `${entry.sourceTitle} shifted the world — ${entry.descriptions.join(", ")}`;
    case "cross_domain":
      return `${entry.title} appeared in ${entry.region}`;
    case "evolution":
      return `${entry.title} emerged`;
    case "unlock":
      return `${entry.title} unlocked`;
    case "supported":
      return `${entry.title} strengthened`;
    default:
      return "";
  }
}

function feedEntryColor(entry: EvolutionFeedEntry): string {
  switch (entry.kind) {
    case "canon":
      return "text-emerald-300/95";
    case "evolution":
      return "text-amber-300/95";
    case "cross_domain":
      return "text-violet-300/90";
    case "unlock":
      return "text-teal-300/90";
    case "state_shift":
      return "text-slate-300/90";
    default:
      return "text-slate-400";
  }
}

export default function CanonUniverseOverlay({
  profile,
  hasTruths,
  worldTensions,
  evolutionFeed,
  onBuildWorld,
}: CanonUniverseOverlayProps) {
  const barFilled = Math.round(profile.completionPct / 10);
  const feedSorted = [...evolutionFeed].sort((a, b) => b.ts - a.ts).slice(0, 12);

  return (
    <>
      {/* Top center */}
      <div
        className="pointer-events-none absolute z-20 flex flex-col items-center"
        style={{ left: "176px", right: 0, top: "48px" }}
      >
        <div className="pointer-events-auto flex flex-col items-center gap-3">
          <div className="text-center">
            <h1 className="text-sm font-semibold tracking-wide text-slate-100">
              Canon Universe
            </h1>
            <div className="mt-1.5 flex items-center justify-center gap-4 text-[11px] text-slate-400">
              <span>
                <span className="tabular-nums font-medium text-emerald-300">
                  {profile.establishedCount}
                </span>{" "}
                Established {profile.establishedCount === 1 ? "Truth" : "Truths"}
              </span>
              <span className="text-slate-600">·</span>
              <span>
                <span className="tabular-nums font-medium text-slate-300">
                  {profile.potentialRemaining}
                </span>{" "}
                Potential Threads
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  World Completion
                </span>
                <span className="text-[10px] tabular-nums font-medium text-slate-300">
                  {profile.completionPct}%
                </span>
              </div>
              <div className="flex h-1.5 w-36 gap-px">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 rounded-sm ${
                      i < barFilled ? "bg-violet-500/60" : "bg-slate-700/80"
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onBuildWorld}
              disabled={!hasTruths}
              className="rounded-lg border border-violet-500/40 bg-violet-950/50 px-4 py-2 text-xs font-medium text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.15)] transition hover:border-violet-400/55 hover:bg-violet-950/65 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Build My World ✨
            </button>
          </div>

          {hasTruths && <CoherenceMeter score={profile.coherenceScore} />}
        </div>
      </div>

      {/* World Tensions — top left */}
      {worldTensions.length > 0 && (
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: "192px", top: "168px" }}
        >
          <div className="pointer-events-auto w-52 rounded-lg border border-slate-700/60 bg-slate-950/92 px-3.5 py-3 shadow-lg backdrop-blur-md">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              World Tensions
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {worldTensions.map((tension) => (
                <li
                  key={tension}
                  className="text-xs font-medium leading-snug text-slate-200"
                >
                  {tension}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* World Profile — below tensions or top left if no tensions */}
      {hasTruths && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: "192px",
            top: worldTensions.length > 0 ? "calc(168px + 140px)" : "168px",
          }}
        >
          <div className="pointer-events-auto w-52 rounded-lg border border-slate-700/60 bg-slate-950/92 px-3.5 py-3 shadow-lg backdrop-blur-md">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              World Profile
            </p>
            <div className="mt-2.5">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Genre</p>
              <p className="mt-0.5 text-xs font-medium text-slate-100">{profile.genre}</p>
            </div>
            <div className="mt-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Core Themes</p>
              <ul className="mt-1 space-y-0.5">
                {profile.themes.map((theme) => (
                  <li key={theme} className="text-[11px] leading-snug text-slate-300">
                    • {theme}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Evolution Feed — right side */}
      {feedSorted.length > 0 && (
        <div
          className="pointer-events-none absolute z-20"
          style={{ right: "16px", top: "168px" }}
        >
          <div
            className="pointer-events-auto w-52 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950/92 px-3.5 py-3 shadow-lg backdrop-blur-md"
            style={{ maxHeight: "calc(100vh - 260px)" }}
          >
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              World Evolution
            </p>
            <ul className="space-y-2.5">
              {feedSorted.map((entry, i) => (
                <li key={`${entry.kind}-${i}-${entry.ts}`}>
                  <p className={`text-[11px] leading-snug ${feedEntryColor(entry)}`}>
                    {feedEntryText(entry)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

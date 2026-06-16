"use client";

import { useState } from "react";
import type {
  DiscoveryAction,
  DiscoveryDecision,
  PanelItem,
} from "@/types/discovery";
import type { AgentVoice } from "@/lib/agentVoices";
import type { AgentReasoning } from "@/lib/agentReasoning";

export type PanelDirection = {
  id: string;
  title: string;
  category: string;
  decision: DiscoveryDecision;
  kind?: "route" | "consequence";
};

export type JourneyStep = {
  id: string;
  title: string;
  subtitle?: string;
  role?: "origin" | "step" | "current";
};

const STEER_EXAMPLES = [
  "The temple is underwater",
  "Nobody can speak inside",
  "The caretaker is blind",
];

type DiscoveryPanelProps = {
  item: PanelItem;
  decision: DiscoveryDecision;
  directions: PanelDirection[];
  activeTrail: string[];
  journeySteps: JourneyStep[];
  onNavigateDirection: (id: string) => void;
  onAction: (action: DiscoveryAction) => void;
  onClose: () => void;
  creatorDirection: string | null;
  onSetDirection: (direction: string) => void;
  agentVoice: AgentVoice | null;
  agentReasoning: AgentReasoning | null;
  potentialConsequences: string[];
};

export default function DiscoveryPanel({
  item,
  decision,
  directions,
  activeTrail,
  journeySteps,
  onNavigateDirection,
  onAction,
  onClose,
  creatorDirection,
  onSetDirection,
  agentVoice,
  agentReasoning,
  potentialConsequences,
}: DiscoveryPanelProps) {
  const [draftDirection, setDraftDirection] = useState("");
  const title =
    item.kind === "discovery" ? item.discovery.title : item.consequence.title;
  const category =
    item.kind === "discovery"
      ? item.discovery.category
      : item.consequence.category;
  const description =
    item.kind === "discovery"
      ? item.discovery.description
      : item.consequence.description;
  const whyItMatters =
    item.kind === "discovery"
      ? item.discovery.whyItMatters
      : (item.consequence.whyItMatters ?? null);

  const isAccepted = decision === "accepted";
  const isRejected = decision === "rejected";
  const canDecide = decision === "pending" || decision === "saved";

  return (
    <aside className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col border-l border-slate-800/80 bg-slate-950/92 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-violet-400/80">
            {category}
          </p>
          <h2
            className={`mt-1 text-lg font-medium leading-snug ${isAccepted ? "text-emerald-100" : "text-slate-100"}`}
          >
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-slate-500 transition hover:text-slate-300"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Your Journey */}
        {journeySteps.length > 0 && (
          <section className="rounded-md border border-violet-800/40 bg-violet-950/20 px-3 py-2.5">
            <h3 className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300/90">
              Your Journey
            </h3>
            <div className="flex flex-col items-stretch gap-0">
              {journeySteps.map((step, i) => {
                const isCurrent = step.role === "current" || i === journeySteps.length - 1;
                const isOrigin = step.role === "origin" || step.id === "__world-seed__";
                return (
                  <div key={step.id} className="flex flex-col">
                    {i > 0 && (
                      <div className="my-1.5 flex justify-center">
                        <span className="text-[10px] leading-none text-slate-600/80 select-none">
                          ↓
                        </span>
                      </div>
                    )}
                    <div
                      className={`rounded-md px-2 py-1.5 ${
                        isCurrent
                          ? "border border-violet-600/40 bg-violet-950/35"
                          : isOrigin
                            ? "border border-slate-700/50 bg-slate-900/30"
                            : ""
                      }`}
                    >
                      {isOrigin && (
                        <p className="mb-0.5 text-[8px] uppercase tracking-[0.14em] text-slate-600">
                          Origin
                        </p>
                      )}
                      {isCurrent && !isOrigin && (
                        <p className="mb-0.5 text-[8px] uppercase tracking-[0.14em] text-violet-500/70">
                          Current
                        </p>
                      )}
                      {isOrigin || isCurrent ? (
                        <span
                          className={`block text-left leading-snug ${
                            isCurrent
                              ? "text-xs font-medium text-violet-50"
                              : "text-xs text-slate-300"
                          }`}
                        >
                          {step.title}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigateDirection(step.id)}
                          className="block w-full text-left text-xs leading-snug text-slate-400 transition hover:text-slate-100"
                        >
                          {step.title}
                        </button>
                      )}
                      {step.subtitle && isOrigin && (
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                          {step.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">
            Description
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">{description}</p>
        </section>

        {whyItMatters && (
          <section>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">
              Why it matters
            </h3>
            <p className="text-sm leading-relaxed text-slate-400">
              {whyItMatters}
            </p>
          </section>
        )}

        {/* Consequences preview */}
        {potentialConsequences.length > 0 && (
          <section className="rounded-md border border-teal-900/30 bg-teal-950/10 px-3 py-2.5">
            <h3 className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-teal-400/80">
              Consequences
            </h3>
            <p className="mb-2 text-[11px] leading-snug text-slate-500">
              Establishing this as Truth may unlock:
            </p>
            <ul className="space-y-1">
              {potentialConsequences.map((name) => (
                <li
                  key={name}
                  className="flex items-start gap-2 text-xs text-teal-200/85"
                >
                  <span className="mt-0.5 text-teal-500/70">✓</span>
                  {name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Agent Reasoning — why branches appeared */}
        {agentReasoning && (
          <section className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Agent Reasoning
            </p>
            <p
              className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${agentReasoning.accentClass}`}
            >
              {agentReasoning.agentLabel}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {agentReasoning.becauseTitle}
            </p>
            <ul className="mt-2 space-y-1">
              {agentReasoning.reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 text-xs text-slate-400"
                >
                  <span className="mt-0.5 text-slate-600">•</span>
                  {reason}
                </li>
              ))}
            </ul>
            {agentReasoning.ledTo.length > 0 && (
              <>
                <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">
                  This led to:
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {agentReasoning.ledTo.map((name) => (
                    <li
                      key={name}
                      className="text-xs font-medium text-teal-300/80"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* Agent Insight — creative collaborator */}
        {agentVoice && (
          <section className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Agent Insight
            </p>
            <p className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${agentVoice.accentClass}`}>
              {agentVoice.agentLabel}
            </p>
            <p className="mt-2 text-sm italic leading-relaxed text-slate-400">
              "{agentVoice.message}"
            </p>
          </section>
        )}

        {/* Possible Directions — the trail forward */}
        {directions.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs uppercase tracking-wider text-slate-500">
              Possible Directions
            </h3>
            <p className="mb-3 text-[11px] text-slate-600">
              Where does this lead?
            </p>
            <ul className="flex flex-col gap-2">
              {directions.map((dir) => {
                const onTrail = activeTrail.includes(dir.id);
                const dirAccepted = dir.decision === "accepted";
                const isConsequence = dir.kind === "consequence";
                return (
                  <li key={dir.id}>
                    <button
                      type="button"
                      onClick={() => onNavigateDirection(dir.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                        dirAccepted
                          ? "border-emerald-700/40 bg-emerald-950/20 hover:border-emerald-500/50"
                          : isConsequence
                            ? "border-teal-800/40 bg-teal-950/15 hover:border-teal-600/50"
                            : onTrail
                              ? "border-violet-600/45 bg-violet-950/20 hover:border-violet-500/60"
                              : "border-slate-800/60 bg-slate-900/20 hover:border-slate-600/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm font-medium ${dirAccepted ? "text-emerald-200" : isConsequence ? "text-teal-200" : "text-slate-200"}`}
                        >
                          {dir.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-600">
                          {dirAccepted ? "● canon" : isConsequence ? "✦ emerged" : "→"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-600">
                        {isConsequence ? "World Consequence" : dir.category}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Steer This Path */}
        <section className="rounded-lg border border-amber-900/30 bg-amber-950/10 p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] text-amber-400/80">✦</span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
              Steer This Path
            </h3>
          </div>
          <p className="mb-3 text-[11px] text-slate-500">
            What should happen next?
          </p>

          {creatorDirection && (
            <div className="mb-3 rounded-md border border-amber-800/30 bg-amber-950/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-amber-600/70">
                Your direction
              </p>
              <p className="mt-1 text-sm italic leading-relaxed text-amber-200/80">
                "{creatorDirection}"
              </p>
            </div>
          )}

          <textarea
            value={draftDirection}
            onChange={(e) => setDraftDirection(e.target.value)}
            placeholder="Add your own idea, twist, or constraint for this branch..."
            rows={3}
            className="w-full resize-none rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-amber-700/60 focus:ring-1 focus:ring-amber-800/40"
          />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {STEER_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setDraftDirection(ex)}
                className="rounded-full border border-slate-700/50 bg-slate-900/40 px-2 py-0.5 text-[10px] text-slate-500 transition hover:border-amber-800/50 hover:text-amber-300/80"
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!draftDirection.trim()}
            onClick={() => {
              if (!draftDirection.trim()) return;
              onSetDirection(draftDirection.trim());
              setDraftDirection("");
            }}
            className="mt-3 w-full rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-300 transition hover:border-amber-700/60 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply Direction
          </button>

          <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
            Future AI-generated branches will adapt to this direction.
          </p>
        </section>
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-800/80 px-5 py-4">
        {isAccepted ? (
          <div className="flex flex-col gap-2">
            <div className="mb-1 flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-sm font-medium text-emerald-300">
                Established Truth
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAction("unaccept")}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:border-rose-800/60 hover:text-rose-300"
            >
              Remove from Canon
            </button>
          </div>
        ) : canDecide ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onAction("accept")}
              className="rounded-lg bg-emerald-700/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Establish as Truth
            </button>
            <button
              type="button"
              onClick={() => onAction("save")}
              className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-4 py-2.5 text-sm font-medium text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-950/60"
            >
              Keep as Potential
            </button>
            <button
              type="button"
              onClick={() => onAction("reject")}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
            >
              Reject
            </button>
          </div>
        ) : isRejected ? (
          <p className="text-center text-sm text-slate-500 line-through">
            Rejected
          </p>
        ) : (
          <p className="text-center text-sm text-sky-400">Kept as Potential</p>
        )}
      </div>
    </aside>
  );
}

"use client";

import { useState } from "react";
import type {
  DiscoveryAction,
  DiscoveryDecision,
  PanelItem,
} from "@/types/discovery";
import { simplifyDisplayLabel } from "@/lib/simplifyDisplayLabel";
import {
  toStoryHookTitle,
  enrichPanelDescription,
  enrichWhyItMatters,
  enrichExplorationQuestions,
  formatCreatorCategory,
  sanitizeCreatorCopy,
} from "@/lib/creatorCopy";
import type { SelectionBreadcrumbSegment } from "@/lib/buildSelectionBreadcrumb";
import type { AgentVoice } from "@/lib/agentVoices";
import type { AgentReasoning } from "@/lib/agentReasoning";
import type { AgentSelectInput } from "@/lib/agentSelect";
import type { ExploreAgent, AgentInsight } from "@/lib/agentExplore";

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
  onApplyAndGenerate: (direction: string) => Promise<void>;
  agentVoice: AgentVoice | null;
  agentReasoning: AgentReasoning | null;
  potentialConsequences: string[];
  agentSelectContext: AgentSelectInput;
  agentSelectContextKey: string;
  activeSpecialists: ExploreAgent[];
  agentInsights: AgentInsight[];
  exploreLoading: boolean;
  exploreFallback: boolean;
  exploreError: string | null;
  showExploreDeeper?: boolean;
  onExploreDeeper?: () => void;
  nodeReasonerLoading?: boolean;
  nodeReasonerError?: string | null;
  hasNodeReasonerCache?: boolean;
  panelWidth?: number;
  worldSeed?: string;
  breadcrumbSegments?: SelectionBreadcrumbSegment[];
  onBreadcrumbNavigate?: (segment: SelectionBreadcrumbSegment) => void;
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
  onApplyAndGenerate,
  agentVoice,
  agentReasoning,
  potentialConsequences,
  activeSpecialists,
  agentInsights,
  exploreLoading,
  exploreFallback,
  exploreError,
  showExploreDeeper = false,
  onExploreDeeper,
  nodeReasonerLoading = false,
  nodeReasonerError = null,
  hasNodeReasonerCache = false,
  panelWidth,
  worldSeed = "",
  breadcrumbSegments = [],
  onBreadcrumbNavigate,
}: DiscoveryPanelProps) {
  const [draftDirection, setDraftDirection] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  const isAiNode = item.kind === "ai-discovery";
  const rawTitle =
    item.kind === "discovery" || item.kind === "ai-discovery"
      ? item.discovery.title
      : item.consequence.title;
  const title = toStoryHookTitle(rawTitle, {
    title: rawTitle,
    worldSeed,
    category:
      item.kind === "discovery" || item.kind === "ai-discovery"
        ? item.discovery.category
        : item.consequence.category,
  });
  const category =
    item.kind === "discovery" || item.kind === "ai-discovery"
      ? formatCreatorCategory(item.discovery.category)
      : formatCreatorCategory(item.consequence.category);
  const rawDescription =
    item.kind === "discovery" || item.kind === "ai-discovery"
      ? item.discovery.description
      : item.consequence.description;
  const panelCtx = {
    title,
    worldSeed,
    category: category ?? undefined,
    whyItMatters:
      item.kind === "discovery" || item.kind === "ai-discovery"
        ? item.discovery.whyItMatters
        : item.consequence.whyItMatters,
    discoveryQuestion: isAiNode ? item.discovery.explorationQuestions?.[0] : undefined,
    rippleHint: isAiNode ? item.discovery.rippleHint : undefined,
  };
  const description = enrichPanelDescription(rawDescription, panelCtx);
  const whyItMatters = enrichWhyItMatters(
    item.kind === "discovery" || item.kind === "ai-discovery"
      ? item.discovery.whyItMatters
      : (item.consequence.whyItMatters ?? null),
    panelCtx,
  );
  const sourceAgent = isAiNode ? sanitizeCreatorCopy(item.discovery.sourceAgent ?? "") : null;
  const rippleHint = isAiNode ? sanitizeCreatorCopy(item.discovery.rippleHint ?? "") : null;
  const whyPromising = isAiNode ? enrichWhyItMatters(item.discovery.whyPromising, panelCtx) : null;
  const risk = isAiNode ? item.discovery.risk : null;
  const explorationQuestions = isAiNode
    ? enrichExplorationQuestions(item.discovery.explorationQuestions, panelCtx)
    : null;
  const nodeType = isAiNode ? item.discovery.nodeType : null;

  const isAccepted = decision === "accepted";
  const isRejected = decision === "rejected";
  const canDecide = decision === "pending" || decision === "saved";

  const handleGenerate = async () => {
    if (!draftDirection.trim() && !creatorDirection) return;
    const dir = draftDirection.trim() || creatorDirection || "";
    setLocalLoading(true);
    try {
      await onApplyAndGenerate(dir);
      if (draftDirection.trim()) setDraftDirection("");
    } finally {
      setLocalLoading(false);
    }
  };

  const isGenerating = localLoading || exploreLoading;

  return (
    <aside
      className="absolute right-0 top-0 z-10 flex h-full flex-col border-l border-slate-800/80 bg-slate-950/92 backdrop-blur-md"
      style={{
        width: panelWidth
          ? `${panelWidth}px`
          : "clamp(280px, calc((100vw - 176px) / 3.5), 480px)",
      }}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-slate-800/80 px-5 py-3">
        {breadcrumbSegments.length > 0 && (
          <nav
            aria-label="Selection location"
            className="mb-2 flex flex-wrap items-center gap-1 text-[11px] leading-snug"
          >
            {breadcrumbSegments.map((seg, i) => (
              <span key={`${seg.id}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 && <span className="shrink-0 text-slate-600 select-none">›</span>}
                {!seg.isLast && onBreadcrumbNavigate ? (
                  <button
                    type="button"
                    onClick={() => onBreadcrumbNavigate(seg)}
                    className="truncate text-slate-500 transition hover:text-violet-300/90"
                  >
                    {seg.label}
                  </button>
                ) : (
                  <span
                    className={`truncate ${seg.isLast ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {seg.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-violet-400/80">
              {isAiNode ? (
                <span className="text-violet-300/90">
                  ✦ Emergent Discovery · {formatCreatorCategory(nodeType ?? category) ?? "Living Thread"}
                </span>
              ) : (
                category
              )}
            </p>
            <h2
              className={`mt-1 text-lg font-medium leading-snug ${isAccepted ? "text-emerald-100" : "text-slate-100"}`}
            >
              {title}
            </h2>
            {sourceAgent && (
              <p className="mt-0.5 text-[10px] text-violet-400/70">{sourceAgent}</p>
            )}
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
      </div>

      {/* Scrollable body — primary content focus */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <section className="rounded-lg border border-slate-800/50 bg-slate-900/20 px-4 py-3.5">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Description
          </h3>
          <p className="max-w-prose text-sm leading-[1.7] text-slate-300">{description}</p>
        </section>

        {(whyItMatters || whyPromising) && (
          <section className="rounded-lg border border-slate-800/40 bg-slate-900/10 px-4 py-3.5">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Why it matters
            </h3>
            <p className="max-w-prose text-sm leading-[1.7] text-slate-400">
              {whyPromising ?? whyItMatters}
            </p>
          </section>
        )}

        {risk && (
          <section>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">
              Risk
            </h3>
            <p className="text-sm leading-relaxed text-amber-400/70">{risk}</p>
          </section>
        )}

        {explorationQuestions && explorationQuestions.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">
              Possible directions
            </h3>
            <ul className="space-y-1.5">
              {explorationQuestions.map((q, i) => (
                <li key={i} className="text-sm leading-relaxed text-slate-400">
                  · {q}
                </li>
              ))}
            </ul>
          </section>
        )}

        {rippleHint && (
          <section className="rounded-md border border-violet-900/30 bg-violet-950/15 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400/80">
              Ripple hint
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-violet-200/70">
              {rippleHint}
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
                <li key={name} className="flex items-start gap-2 text-xs text-teal-200/85">
                  <span className="mt-0.5 text-teal-500/70">✓</span>
                  {name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Active Specialists — compact, only shown after generate */}
        {activeSpecialists.length > 0 && (
          <section className="rounded-lg border border-indigo-900/35 bg-indigo-950/15 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/85">
              Active Specialists
            </p>
            {exploreFallback && (
              <p className="mt-1 text-[10px] italic text-slate-600">
                Using local prototype specialists
              </p>
            )}
            <ul className="mt-2.5 space-y-2">
              {activeSpecialists.map((s) => (
                <li key={s.name}>
                  <p className="text-[11px] font-semibold text-indigo-100">{s.name}</p>
                  <p className="text-[10px] leading-snug text-slate-500">{s.role}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Agent Insights — shown after generate */}
        {agentInsights.length > 0 && (
          <section className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Agent Insights
            </p>
            <ul className="mt-2.5 space-y-2.5">
              {agentInsights.map((ins) => (
                <li key={ins.agent}>
                  <p className="text-[10px] font-semibold text-indigo-200/80">{ins.agent}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {ins.insight}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Agent Reasoning */}
        {agentReasoning && (
          <section className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Agent Reasoning
            </p>
            <p className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${agentReasoning.accentClass}`}>
              {agentReasoning.agentLabel}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {agentReasoning.becauseTitle}
            </p>
            <ul className="mt-2 space-y-1">
              {agentReasoning.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-xs text-slate-400">
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
                    <li key={name} className="text-xs font-medium text-teal-300/80">
                      {name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* Agent Insight */}
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

        {/* Possible Directions */}
        {directions.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs uppercase tracking-wider text-slate-500">
              Possible Directions
            </h3>
            <p className="mb-3 text-[11px] text-slate-600">Where does this lead?</p>
            <ul className="flex flex-col gap-2">
              {directions.map((dir) => {
                const onTrail = activeTrail.includes(dir.id);
                const dirAccepted = dir.decision === "accepted";
                const isConsequence = dir.kind === "consequence";
                const isAi = dir.id.startsWith("ai-");
                return (
                  <li key={dir.id}>
                    <button
                      type="button"
                      onClick={() => onNavigateDirection(dir.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                        dirAccepted
                          ? "border-emerald-700/40 bg-emerald-950/20 hover:border-emerald-500/50"
                          : isAi
                            ? "border-violet-800/45 bg-violet-950/15 hover:border-violet-600/55"
                            : isConsequence
                              ? "border-teal-800/40 bg-teal-950/15 hover:border-teal-600/50"
                              : onTrail
                                ? "border-violet-600/45 bg-violet-950/20 hover:border-violet-500/60"
                                : "border-slate-800/60 bg-slate-900/20 hover:border-slate-600/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium ${dirAccepted ? "text-emerald-200" : isAi ? "text-violet-200" : isConsequence ? "text-teal-200" : "text-slate-200"}`}>
                          {simplifyDisplayLabel(dir.title)}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-600">
                          {dirAccepted ? "● canon" : isAi ? "✦ agent" : isConsequence ? "✦ emerged" : "→"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-600">
                        {isAi ? "Agent-shaped" : isConsequence ? "World Consequence" : dir.category}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* ─── Sticky bottom: compact Steer + Actions ─────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800/80">
        <div className="border-b border-slate-800/60 px-4 py-2.5">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/70">
            Steer This Path
          </p>

          {creatorDirection && (
            <p className="mb-1.5 truncate text-[10px] italic text-amber-200/60">
              Active: &ldquo;{creatorDirection}&rdquo;
            </p>
          )}

          <div className="flex items-stretch gap-2">
            <textarea
              value={draftDirection}
              onChange={(e) => setDraftDirection(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
              placeholder="Add a twist, constraint, or direction..."
              rows={1}
              className="min-h-[34px] flex-1 resize-none rounded-md border border-slate-700/60 bg-slate-900/60 px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none transition focus:border-amber-700/60 focus:ring-1 focus:ring-amber-800/40"
            />
            <button
              type="button"
              disabled={(!draftDirection.trim() && !creatorDirection) || isGenerating}
              onClick={() => void handleGenerate()}
              className="shrink-0 rounded-md border border-amber-800/40 bg-amber-950/30 px-3 text-xs font-semibold text-amber-300 transition hover:border-amber-700/60 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Apply and generate paths"
            >
              {isGenerating ? "…" : "Apply"}
            </button>
          </div>

          {exploreError && !isGenerating && (
            <p className="mt-1 text-[10px] leading-snug text-rose-400/80">{exploreError}</p>
          )}
        </div>

        {showExploreDeeper && onExploreDeeper && (
          <div className="border-t border-slate-800/80 px-4 py-3">
            <button
              type="button"
              onClick={onExploreDeeper}
              disabled={nodeReasonerLoading || hasNodeReasonerCache}
              className="w-full rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-2 text-xs font-semibold text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-950/50 disabled:cursor-default disabled:opacity-60"
            >
              {nodeReasonerLoading
                ? "Exploring continuations..."
                : hasNodeReasonerCache
                  ? "Continuations loaded"
                  : "Explore Deeper"}
            </button>
            {nodeReasonerError && !nodeReasonerLoading && (
              <p className="mt-1.5 text-[10px] leading-snug text-slate-400/90">
                {nodeReasonerError}
              </p>
            )}
          </div>
        )}

        {/* Decision actions */}
        <div className="px-5 py-4">
          {isAccepted ? (
            <div className="flex flex-col gap-2.5">
              <div className="mb-1 flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="text-sm font-medium text-emerald-300">Established Truth</p>
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
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => onAction("accept")}
                className="rounded-lg bg-emerald-700/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Establish as Truth
              </button>
              <button
                type="button"
                onClick={() => onAction("reject")}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
              >
                Reject
              </button>
            </div>
          ) : isRejected ? (
            <p className="text-center text-sm text-slate-500 line-through">Rejected</p>
          ) : (
            <p className="text-center text-sm text-sky-400">Kept as Potential</p>
          )}
        </div>
      </div>
    </aside>
  );
}

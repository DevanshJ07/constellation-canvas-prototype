"use client";

import type { ReactNode } from "react";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";

type ArchitecturePreviewProps = {
  model: CanvasWorldModel;
  embedded?: boolean;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-600">
      {children}
    </p>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-800/70 bg-slate-900/50 px-2.5 py-1 text-[10px] font-medium text-slate-400">
      {children}
    </span>
  );
}

export default function ArchitecturePreview({ model, embedded = false }: ArchitecturePreviewProps) {
  const sortedConstellations = [...model.constellations].sort(
    (a, b) => a.priority - b.priority,
  );

  const nodesByConstellation = new Map<string, typeof model.nodes>();
  for (const c of sortedConstellations) {
    nodesByConstellation.set(
      c.id,
      model.nodes.filter((n) => n.constellationId === c.id),
    );
  }

  const agentsById = new Map(model.agents.map((a) => [a.id, a]));

  return (
    <div className={embedded ? "relative" : "absolute inset-0 overflow-y-auto bg-[#0a0a0f]"}>
      <div className={embedded ? "space-y-8" : "mx-auto max-w-3xl px-8 py-12"}>
        <div className="mb-8">
          <SectionLabel>Architecture Preview</SectionLabel>
          {!embedded && (
            <>
              <h1 className="mt-2 text-lg font-light leading-snug text-slate-200">
                {model.worldSeed}
              </h1>
              {model.worldSummary && (
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                  {model.worldSummary}
                </p>
              )}
            </>
          )}
        </div>

        {/* Constellations + starting nodes */}
        <section className="mb-10 space-y-6">
          <SectionLabel>Constellations &amp; Starting Nodes</SectionLabel>
          {sortedConstellations.map((c) => {
            const nodes = nodesByConstellation.get(c.id) ?? [];
            const linkedAgents = c.agentIds
              .map((id) => agentsById.get(id))
              .filter(Boolean);

            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-5"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-violet-300/90">
                      {c.title}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      Priority {c.priority}
                    </p>
                  </div>
                  {linkedAgents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedAgents.map((a) => (
                        <Tag key={a!.id}>{a!.name}</Tag>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500">{c.description}</p>
                {c.question && (
                  <p className="mt-2 rounded-md border border-slate-800/60 bg-black/20 px-2.5 py-2 text-[10px] italic leading-snug text-slate-500">
                    &ldquo;{c.question}&rdquo;
                  </p>
                )}

                {nodes.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-slate-800/50 pt-4">
                    {nodes.map((node) => (
                      <div
                        key={node.id}
                        className="rounded-lg border border-slate-800/50 bg-slate-950/40 px-3.5 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] font-medium text-slate-300">
                            {node.title}
                          </p>
                          <Tag>{node.nodeType}</Tag>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                          {node.description}
                        </p>
                        {node.whyPromising && (
                          <p className="mt-2 text-[10px] leading-relaxed text-emerald-400/70">
                            <span className="font-medium text-emerald-500/80">Why promising: </span>
                            {node.whyPromising}
                          </p>
                        )}
                        {node.risk && (
                          <p className="mt-1 text-[10px] leading-relaxed text-amber-400/60">
                            <span className="font-medium text-amber-500/70">Risk: </span>
                            {node.risk}
                          </p>
                        )}
                        {node.explorationQuestions.length > 0 && (
                          <ul className="mt-2 space-y-1 border-t border-slate-800/40 pt-2">
                            {node.explorationQuestions.map((q, i) => (
                              <li
                                key={i}
                                className="text-[10px] leading-snug text-slate-600 before:mr-1.5 before:text-slate-700 before:content-['·']"
                              >
                                {q}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Reasoning agents */}
        <section className="mb-10">
          <SectionLabel>Reasoning Agents</SectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {model.agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg border border-slate-800/70 bg-slate-900/25 p-4"
              >
                <p className="text-[12px] font-semibold text-slate-300">{agent.name}</p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{agent.role}</p>
                <p className="mt-1 text-[10px] italic leading-relaxed text-slate-600">
                  {agent.lens}
                </p>
                {agent.generates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {agent.generates.slice(0, 4).map((g) => (
                      <Tag key={g}>{g}</Tag>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Critic agents */}
        <section className="mb-10">
          <SectionLabel>Critic Agents</SectionLabel>
          <div className="mt-4 space-y-3">
            {model.criticAgents.map((critic) => (
              <div
                key={critic.id}
                className="rounded-lg border border-slate-800/60 bg-slate-950/30 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-medium text-slate-300">{critic.name}</p>
                  <Tag>{critic.severity}</Tag>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{critic.job}</p>
                {critic.checks.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {critic.checks.map((check, i) => (
                      <li key={i} className="text-[10px] text-slate-600">
                        ✓ {check}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Control rules */}
        <section className="mb-6">
          <SectionLabel>Control Rules</SectionLabel>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Must preserve", model.controlRules.mustPreserve],
                ["Must avoid", model.controlRules.mustAvoid],
                ["Generation priorities", model.controlRules.generationPriorities],
                ["Ranking criteria", model.controlRules.rankingCriteria],
                ["Expansion rules", model.controlRules.expansionRules],
              ] as const
            ).map(([label, items]) =>
              items.length > 0 ? (
                <div
                  key={label}
                  className="rounded-lg border border-slate-800/50 bg-slate-900/20 p-3.5"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="text-[10px] leading-snug text-slate-600">
                        · {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </section>

        <p className="text-center text-[10px] text-slate-700">
          Temporary architecture preview — not connected to branch generation yet.
        </p>
      </div>
    </div>
  );
}

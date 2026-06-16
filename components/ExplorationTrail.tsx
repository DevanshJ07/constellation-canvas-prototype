"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TRAIL_NODES,
  TRAIL_ROOT,
  TRAIL_GRAPH,
  getTrailChildren,
  isTrailTerminal,
} from "@/lib/explorationTrail";

const COL_WIDTH = 248;
const ROW_HEIGHT = 76;
const CENTER_Y = 260;
const FOCUS_X = 310;

type NodeState = "current" | "path" | "unchosen" | "ahead";
type LayoutNode = { id: string; x: number; y: number; state: NodeState };
type LayoutEdge = {
  from: string;
  to: string;
  kind: "trail" | "branch" | "ahead";
};

function distribute(count: number): number[] {
  if (count === 0) return [];
  const half = ((count - 1) * ROW_HEIGHT) / 2;
  return Array.from({ length: count }, (_, i) => -half + i * ROW_HEIGHT);
}

function buildLayout(path: string[]): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
} {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];

  nodes.push({
    id: path[0],
    x: 0,
    y: CENTER_Y,
    state: path.length === 1 ? "current" : "path",
  });

  for (let col = 1; col < path.length; col++) {
    const parentId = path[col - 1];
    const chosenId = path[col];
    const isCurrent = col === path.length - 1;
    const allChildren = TRAIL_GRAPH[parentId] ?? [];
    const unchosen = allChildren.filter((id) => id !== chosenId);

    nodes.push({
      id: chosenId,
      x: col * COL_WIDTH,
      y: CENTER_Y,
      state: isCurrent ? "current" : "path",
    });
    edges.push({ from: parentId, to: chosenId, kind: "trail" });

    const siblingOffsets = distribute(unchosen.length);
    const adjustedOffsets = siblingOffsets.map((o) =>
      o === 0 ? (siblingOffsets.length > 1 ? ROW_HEIGHT : -ROW_HEIGHT) : o,
    );
    unchosen.forEach((sibId, i) => {
      nodes.push({
        id: sibId,
        x: col * COL_WIDTH,
        y: CENTER_Y + adjustedOffsets[i],
        state: "unchosen",
      });
      edges.push({ from: parentId, to: sibId, kind: "branch" });
    });
  }

  const currentId = path[path.length - 1];
  const nextOptions = TRAIL_GRAPH[currentId] ?? [];
  if (nextOptions.length > 0) {
    const nextCol = path.length;
    const offsets = distribute(nextOptions.length);
    nextOptions.forEach((optId, i) => {
      nodes.push({
        id: optId,
        x: nextCol * COL_WIDTH,
        y: CENTER_Y + offsets[i],
        state: "ahead",
      });
      edges.push({ from: currentId, to: optId, kind: "ahead" });
    });
  }

  return { nodes, edges };
}

function edgePath(from: LayoutNode, to: LayoutNode): string {
  if (from.y === to.y) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const mx = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`;
}

export default function ExplorationTrail() {
  const [path, setPath] = useState<string[]>([TRAIL_ROOT]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const currentId = path[path.length - 1];
  const possibleDirections = getTrailChildren(currentId);
  const { nodes, edges } = useMemo(() => buildLayout(path), [path]);
  const nodeMap = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const translateX = FOCUS_X - (path.length - 1) * COL_WIDTH;
  const atEnd = isTrailTerminal(currentId);

  const displayId = hoveredId ?? currentId;
  const displayNode = TRAIL_NODES[displayId];
  const displayState: NodeState = nodeMap[displayId]?.state ?? "current";
  const isPreviewing = hoveredId !== null && hoveredId !== currentId;

  function navigate(id: string) {
    setPath((p) => [...p, id]);
    setHoveredId(null);
  }

  function stepBack(toIndex: number) {
    setPath((p) => p.slice(0, toIndex + 1));
    setHoveredId(null);
  }

  function handleNodeClick(id: string, state: NodeState) {
    if (state === "ahead") navigate(id);
    else if (state === "path") stepBack(path.indexOf(id));
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0a0f]">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800/40 px-6 py-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-600">
          Exploration Trail
        </p>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              setPath([TRAIL_ROOT]);
              setHoveredId(null);
            }}
            className="text-xs text-slate-600 transition hover:text-slate-400"
          >
            Reset
          </button>
          <Link
            href="/constellation"
            className="text-xs text-slate-600 transition hover:text-slate-400"
          >
            ← Old Canvas
          </Link>
        </div>
      </header>

      <nav className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-800/25 px-6 py-2.5">
        {path.map((id, i) => {
          const isLast = i === path.length - 1;
          return (
            <span key={id} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="select-none text-[11px] text-slate-700">›</span>
              )}
              {isLast ? (
                <span className="text-[11px] text-violet-300">
                  {TRAIL_NODES[id].title}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => stepBack(i)}
                  className="text-[11px] text-slate-500 transition hover:text-slate-300"
                >
                  {TRAIL_NODES[id].title}
                </button>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1">
        <div
          className="relative flex-1 overflow-hidden"
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#0a0a0f] to-transparent" />

          <div
            style={{
              transform: `translateX(${translateX}px)`,
              transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            className="absolute inset-0"
          >
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              <defs>
                <filter id="trail-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {edges.map((edge) => {
                const from = nodeMap[edge.from];
                const to = nodeMap[edge.to];
                if (!from || !to) return null;
                const isTrail = edge.kind === "trail";
                const isAhead = edge.kind === "ahead";
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={edgePath(from, to)}
                    fill="none"
                    stroke={
                      isTrail
                        ? "rgba(167, 139, 250, 0.65)"
                        : isAhead
                          ? "rgba(148, 163, 184, 0.45)"
                          : "rgba(71, 85, 105, 0.18)"
                    }
                    strokeWidth={isTrail ? 1.5 : isAhead ? 1.25 : 1}
                    className={isAhead ? "animate-trail-flow" : undefined}
                    filter={isTrail ? "url(#trail-glow)" : undefined}
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const tn = TRAIL_NODES[node.id];
              const isHovered = hoveredId === node.id;
              const { state } = node;

              return (
                <button
                  key={node.id}
                  type="button"
                  style={{
                    position: "absolute",
                    left: node.x,
                    top: node.y,
                    transform: "translate(-50%, -50%)",
                  }}
                  onClick={() => handleNodeClick(node.id, state)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  className={[
                    "flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 text-center transition-all duration-300",
                    state === "current"
                      ? "animate-trail-current w-44 border-violet-400/60 bg-violet-950/50"
                      : state === "path"
                        ? "w-40 border-violet-700/35 bg-violet-950/18 hover:border-violet-500/50 hover:bg-violet-950/28"
                        : state === "ahead"
                          ? `w-44 border-slate-600/55 bg-slate-900/40 ${isHovered ? "border-slate-400/65 shadow-[0_0_16px_rgba(148,163,184,0.1)]" : ""}`
                          : `w-40 cursor-default border-slate-800/25 bg-slate-900/15 ${isHovered ? "border-slate-700/40" : ""}`,
                  ].join(" ")}
                >
                  <div
                    className={[
                      "rounded-full transition-all duration-300",
                      state === "current"
                        ? "h-3 w-3 animate-truth-pulse bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.85)]"
                        : state === "path"
                          ? "h-2.5 w-2.5 bg-violet-500/80 shadow-[0_0_8px_rgba(167,139,250,0.45)]"
                          : state === "ahead"
                            ? `h-2.5 w-2.5 ${isHovered ? "bg-slate-300" : "bg-slate-400/80"}`
                            : "h-2 w-2 bg-slate-600/60",
                    ].join(" ")}
                  />

                  <p
                    className={[
                      "text-xs font-medium leading-snug transition-colors",
                      state === "current"
                        ? "text-white"
                        : state === "path"
                          ? "text-slate-300/85"
                          : state === "ahead"
                            ? isHovered
                              ? "text-slate-100"
                              : "text-slate-300"
                            : "text-slate-500/80",
                    ].join(" ")}
                  >
                    {tn.title}
                  </p>

                  {(state === "current" || state === "ahead") && (
                    <p
                      className={[
                        "text-[10px] leading-snug",
                        state === "current"
                          ? "italic text-violet-400/60"
                          : "text-slate-500",
                      ].join(" ")}
                    >
                      {tn.tagline}
                    </p>
                  )}

                  {state === "ahead" && isHovered && (
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">
                      Follow →
                    </p>
                  )}
                  {state === "path" && isHovered && (
                    <p className="text-[9px] uppercase tracking-wider text-violet-600/55">
                      ← step back
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-800/40 bg-[#0a0a0f]">
          <div className="px-5 py-6">
            <p className="text-[9px] uppercase tracking-[0.24em] text-slate-600">
              {isPreviewing
                ? displayState === "ahead"
                  ? "Possible direction"
                  : displayState === "unchosen"
                    ? "Road not taken"
                    : "Where you've been"
                : "You are here"}
            </p>
            <h2
              className={`mt-2 text-base font-semibold leading-snug ${
                isPreviewing
                  ? displayState === "ahead"
                    ? "text-slate-200"
                    : "text-slate-400"
                  : "text-violet-100"
              }`}
            >
              {displayNode.title}
            </h2>
            <p className="mt-0.5 text-[11px] italic text-slate-600">
              {displayNode.tagline}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {displayNode.description}
            </p>

            {isPreviewing && displayState === "ahead" && (
              <button
                type="button"
                onClick={() => navigate(displayId)}
                className="mt-5 w-full rounded-lg border border-slate-600/55 bg-slate-900/30 px-4 py-2.5 text-sm text-slate-300 transition hover:border-violet-600/40 hover:bg-violet-950/18 hover:text-violet-200"
              >
                Follow this thread →
              </button>
            )}

            {isPreviewing && displayState === "unchosen" && (
              <p className="mt-4 text-xs italic leading-relaxed text-slate-600">
                A fork you passed by. Step back in the breadcrumb to explore
                this path instead.
              </p>
            )}
          </div>

          {!isPreviewing && possibleDirections.length > 0 && (
            <div className="border-t border-slate-800/40 px-5 py-5">
              <p className="text-[9px] uppercase tracking-[0.24em] text-slate-600">
                Possible Directions
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Which path do you want to explore next?
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {possibleDirections.map((dirId) => {
                  const dir = TRAIL_NODES[dirId];
                  const isHovered = hoveredId === dirId;
                  return (
                    <li key={dirId}>
                      <button
                        type="button"
                        onClick={() => navigate(dirId)}
                        onMouseEnter={() => setHoveredId(dirId)}
                        className={[
                          "w-full rounded-lg border px-3 py-2.5 text-left transition-all",
                          isHovered
                            ? "border-violet-600/45 bg-violet-950/20"
                            : "border-slate-800/60 bg-slate-900/20 hover:border-slate-700/60",
                        ].join(" ")}
                      >
                        <p className="text-sm font-medium text-slate-200">
                          {dir.title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                          {dir.tagline}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!isPreviewing && atEnd && (
            <div className="border-t border-slate-800/40 px-5 py-5">
              <p className="text-xs italic leading-relaxed text-violet-500/50">
                This thread ends here. Step back to follow a different road.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

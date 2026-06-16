"use client";

import { CANON_COLORS } from "@/lib/canonColors";
import type { CanonThread, CanonThreadsData } from "@/lib/canonFlow";

type CanonThreadsPanelProps = {
  threads: CanonThreadsData;
  onSelectNode?: (nodeId: string) => void;
};

function ThreadChain({
  thread,
  onSelectNode,
}: {
  thread: CanonThread;
  onSelectNode?: (nodeId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/55 px-3 py-2.5">
      <div className="flex flex-col">
        {thread.nodes.map((node, i) => (
          <div key={node.id} className="flex flex-col">
            {i > 0 && (
              <span
                className="py-0.5 pl-3 text-[11px] leading-none"
                style={{ color: CANON_COLORS.establishedTruth.text, opacity: 0.45 }}
              >
                ↓
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelectNode?.(node.id)}
              className="text-left text-[12px] font-medium leading-snug transition hover:brightness-110"
              style={{
                color: CANON_COLORS.establishedTruth.text,
                paddingLeft: i > 0 ? "12px" : "0",
              }}
            >
              {node.title}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DomainBlock({
  label,
  threads,
  onSelectNode,
}: {
  label: string;
  threads: CanonThread[];
  onSelectNode?: (nodeId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: CANON_COLORS.worldState.text }}
      >
        {label}
      </p>
      <div className="space-y-2 pl-1">
        {threads.map((thread) => (
          <ThreadChain
            key={thread.nodes.map((n) => n.id).join("→")}
            thread={thread}
            onSelectNode={onSelectNode}
          />
        ))}
      </div>
    </div>
  );
}

export default function CanonThreadsPanel({
  threads,
  onSelectNode,
}: CanonThreadsPanelProps) {
  const hasContent =
    threads.domains.length > 0 || threads.orphanThreads.length > 0;

  return (
    <div
      className="pointer-events-none absolute z-[12]"
      style={{ left: "548px", right: "16px", top: "88px", bottom: "80px" }}
    >
      <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-xl border border-slate-700/45 bg-slate-950/88 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="border-b border-slate-700/50 px-4 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Canon Threads
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            How the selected ideas connect together
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasContent ? (
            <p className="text-center text-xs text-slate-500">
              Establish connected truths to see narrative threads form.
            </p>
          ) : (
            <div className="space-y-5">
              {threads.domains.map((domain) => (
                <DomainBlock
                  key={domain.id}
                  label={domain.label}
                  threads={domain.threads}
                  onSelectNode={onSelectNode}
                />
              ))}

              {threads.orphanThreads.length > 0 && (
                <DomainBlock
                  label="Unresolved Threads"
                  threads={threads.orphanThreads}
                  onSelectNode={onSelectNode}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

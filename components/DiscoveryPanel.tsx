"use client";

import type {
  DiscoveryAction,
  DiscoveryDecision,
  PanelItem,
} from "@/types/discovery";

type DiscoveryPanelProps = {
  item: PanelItem;
  decision: DiscoveryDecision;
  onAction: (action: DiscoveryAction) => void;
  onClose: () => void;
};

export default function DiscoveryPanel({
  item,
  decision,
  onAction,
  onClose,
}: DiscoveryPanelProps) {
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
      : item.consequence.whyItMatters ?? null;

  const hasConsequences =
    item.kind === "consequence"
      ? false
      : true; // discoveries always potentially have consequences

  const isAccepted = decision === "accepted";
  const isSaved = decision === "saved";
  const isRejected = decision === "rejected";
  const canDecide = decision === "pending" || decision === "saved";

  return (
    <aside className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col border-l border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-violet-400/80">
            {category}
          </p>
          <h2 className="mt-1 text-lg font-medium leading-snug text-slate-100">
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
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
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

        {item.kind === "consequence" && isAccepted && (
          <section>
            <p className="text-xs leading-relaxed text-teal-500/70">
              This is established in the world. Accepting it may reveal further
              consequences.
            </p>
          </section>
        )}
      </div>

      {/* Footer actions — available for both discoveries and consequences */}
      <div className="border-t border-slate-800/80 px-5 py-4">
        {isAccepted ? (
          <div className="flex flex-col gap-2">
            <p className="mb-1 text-center text-sm text-emerald-400">
              Established in the world
            </p>
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
              className="rounded-lg bg-emerald-600/90 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onAction("save")}
              className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-4 py-2.5 text-sm font-medium text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-950/60"
            >
              Save For Later
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
          <p className="text-center text-sm text-sky-400">Saved for later</p>
        )}
      </div>
    </aside>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentSelectInput, AgentSelectOutput } from "@/lib/agentSelect";

type ActiveSpecialistsProps = {
  context: AgentSelectInput;
  contextKey: string;
};

export default function ActiveSpecialists({
  context,
  contextKey,
}: ActiveSpecialistsProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentSelectOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchSpecialists = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agents/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });

      if (!response.ok) {
        throw new Error("Could not assemble specialists");
      }

      const data = (await response.json()) as AgentSelectOutput;
      if (id !== requestId.current) return;
      setResult(data);
    } catch {
      if (id !== requestId.current) return;
      setError("Specialists unavailable right now.");
      setResult(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    fetchSpecialists();
  }, [contextKey, fetchSpecialists]);

  return (
    <section className="rounded-lg border border-indigo-900/35 bg-indigo-950/15 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/85">
            Active Specialists
          </p>
          {result?.creativeNeed && !loading && (
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              {result.creativeNeed}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={fetchSpecialists}
          disabled={loading}
          className="shrink-0 rounded-md border border-indigo-800/45 bg-indigo-950/40 px-2 py-1 text-[10px] font-medium text-indigo-200/90 transition hover:border-indigo-600/55 disabled:opacity-50"
        >
          Refresh Specialists
        </button>
      </div>

      {loading && (
        <p className="mt-3 text-xs italic text-indigo-200/75">
          Assembling creative specialists...
        </p>
      )}

      {error && !loading && (
        <p className="mt-3 text-xs text-rose-300/80">{error}</p>
      )}

      {result && !loading && (
        <ul className="mt-3 space-y-2.5">
          {result.selectedAgents.map((specialist) => (
            <li
              key={specialist.name}
              className="rounded-md border border-slate-800/60 bg-slate-900/35 px-3 py-2.5"
            >
              <p className="text-xs font-semibold text-indigo-100">
                {specialist.name}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                {specialist.role}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                {specialist.whySelected}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

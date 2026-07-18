/**
 * Shared latency controls for GAME agents (Phase 8D).
 *
 * Timing helpers, token estimates, hard timeouts, and fast-mode flags.
 * Pure utilities — no LLM calls, no canvas mutation.
 */

export const NODE_REASONER_TARGET_MS = 15_000;
export const NODE_REASONER_HARD_TIMEOUT_MS = 28_000;

export const RIPPLE_TARGET_MS = 20_000;
export const RIPPLE_HARD_TIMEOUT_MS = 32_000;

/** Minimum valid child nodes to accept without a second LLM call. */
export const NODE_REASONER_MIN_VALID_TO_SKIP_RETRY = 3;

/** Minimum valid ripple operations to accept after deterministic repair. */
export const RIPPLE_MIN_OPS_TO_SKIP_RETRY = 1;

export class AgentTimeoutError extends Error {
  readonly timedOut = true as const;
  readonly timeoutMs: number;

  constructor(agentLabel: string, timeoutMs: number) {
    super(`${agentLabel} timed out after ${timeoutMs}ms`);
    this.name = "AgentTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function isAgentTimeoutError(error: unknown): error is AgentTimeoutError {
  return (
    error instanceof AgentTimeoutError ||
    (error instanceof Error &&
      (error.name === "AgentTimeoutError" ||
        error.message.toLowerCase().includes("timed out") ||
        error.message.toLowerCase().includes("aborted")))
  );
}

/** Rough token estimate: ~4 characters per token for English/JSON prompts. */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function isAgentFastMode(): boolean {
  const publicFlag = process.env.NEXT_PUBLIC_AGENT_FAST_MODE?.trim().toLowerCase();
  const serverFlag = process.env.AGENT_FAST_MODE?.trim().toLowerCase();
  return publicFlag === "true" || publicFlag === "1" || serverFlag === "true" || serverFlag === "1";
}

export function resolveNodeReasonerTimeoutMs(): number {
  if (isAgentFastMode()) return Math.min(NODE_REASONER_HARD_TIMEOUT_MS, 18_000);
  return NODE_REASONER_HARD_TIMEOUT_MS;
}

export function resolveRippleTimeoutMs(): number {
  if (isAgentFastMode()) return Math.min(RIPPLE_HARD_TIMEOUT_MS, 22_000);
  return RIPPLE_HARD_TIMEOUT_MS;
}

export type TimingMark = {
  label: string;
  ms: number;
};

export function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function elapsedMs(startedAt: number): number {
  return Math.round(nowMs() - startedAt);
}

/**
 * Race a promise against a hard timeout.
 * Optionally aborts an AbortController when the timeout fires.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  agentLabel: string,
  abortController?: AbortController,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abortController?.abort();
      reject(new AgentTimeoutError(agentLabel, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type AgentTimingLogPayload = {
  requestId: string;
  [key: string]: string | number | boolean | null | undefined;
};

export function logAgentTiming(
  prefix: "[node-reasoner:timing]" | "[ripple-effect:timing]",
  payload: AgentTimingLogPayload,
): void {
  console.info(prefix, JSON.stringify(payload));
}

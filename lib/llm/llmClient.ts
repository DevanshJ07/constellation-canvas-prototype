/**
 * Provider-agnostic LLM JSON generation adapter.
 * Gemini is the default provider; OpenRouter is supported as an optional fallback.
 */

export type LLMProvider =
  | "gemini"
  | "openrouter"
  | "groq"
  | "openai"
  | "anthropic"
  | "ollama";

export type LLMGenerateJsonParams = {
  provider?: LLMProvider;
  model?: string;
  prompt: string;
  temperature?: number;
  responseMimeType?: string;
  schemaName?: string;
};

export type LLMGenerateJsonResult = {
  text: string;
  provider: LLMProvider;
  model: string;
  raw?: unknown;
};

const VALID_PROVIDERS = new Set<string>([
  "gemini",
  "openrouter",
  "groq",
  "openai",
  "anthropic",
  "ollama",
]);

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENROUTER_MODEL = "qwen/qwen-2.5-72b-instruct";

export class LLMClientError extends Error {
  readonly provider: LLMProvider;
  readonly model: string;
  readonly status?: number;

  constructor(message: string, provider: LLMProvider, model: string, status?: number) {
    super(message);
    this.name = "LLMClientError";
    this.provider = provider;
    this.model = model;
    this.status = status;
  }
}

export function isLLMQuotaError(error: unknown): boolean {
  if (error instanceof LLMClientError) {
    return error.status === 429 || error.message.includes("429") || error.message.includes("Quota exceeded");
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("Quota exceeded");
}

export function resolveDefaultLLMProvider(): LLMProvider {
  const fromEnv = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (fromEnv && VALID_PROVIDERS.has(fromEnv)) {
    return fromEnv as LLMProvider;
  }
  return "gemini";
}

export function resolveGeminiModel(override?: string): string {
  return override?.trim() || process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function resolveOpenRouterModel(override?: string): string {
  return override?.trim() || process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

export function hasOpenRouterApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

async function generateJsonWithGemini(
  params: LLMGenerateJsonParams,
): Promise<LLMGenerateJsonResult> {
  const model = resolveGeminiModel(params.model);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMClientError(
      "Missing GEMINI_API_KEY",
      "gemini",
      model,
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        responseMimeType: params.responseMimeType ?? "application/json",
      },
    }),
  });

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string; code?: number };
  };

  if (!res.ok) {
    const msg = payload.error?.message ?? res.statusText;
    throw new LLMClientError(
      `Gemini HTTP ${res.status}: ${msg}`,
      "gemini",
      model,
      res.status,
    );
  }

  if (payload.error) {
    throw new LLMClientError(
      `Gemini error: ${payload.error.message ?? "unknown"}`,
      "gemini",
      model,
      payload.error.code,
    );
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new LLMClientError("Empty response from Gemini", "gemini", model);
  }

  return { text, provider: "gemini", model, raw: payload };
}

async function generateJsonWithOpenRouter(
  params: LLMGenerateJsonParams,
): Promise<LLMGenerateJsonResult> {
  const model = resolveOpenRouterModel(params.model);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMClientError(
      "Missing OPENROUTER_API_KEY",
      "openrouter",
      model,
    );
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: params.prompt }],
      temperature: params.temperature ?? 0.7,
      response_format: { type: "json_object" },
    }),
  });

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string; code?: number | string };
  };

  if (!res.ok) {
    const msg =
      (typeof payload.error?.message === "string" ? payload.error.message : null) ??
      res.statusText;
    throw new LLMClientError(
      `OpenRouter HTTP ${res.status}: ${msg}`,
      "openrouter",
      model,
      res.status,
    );
  }

  if (payload.error) {
    throw new LLMClientError(
      `OpenRouter error: ${payload.error.message ?? "unknown"}`,
      "openrouter",
      model,
    );
  }

  const text = payload.choices?.[0]?.message?.content;
  if (!text) {
    throw new LLMClientError("Empty response from OpenRouter", "openrouter", model);
  }

  return { text, provider: "openrouter", model, raw: payload };
}

function notImplemented(provider: LLMProvider): never {
  throw new LLMClientError(
    `LLM provider "${provider}" is not implemented yet`,
    provider,
    "unknown",
  );
}

/** Generates JSON text from the configured LLM provider. */
export async function generateJsonWithLLM(
  params: LLMGenerateJsonParams,
): Promise<LLMGenerateJsonResult> {
  const provider = params.provider ?? resolveDefaultLLMProvider();

  switch (provider) {
    case "gemini":
      return generateJsonWithGemini(params);
    case "openrouter":
      return generateJsonWithOpenRouter(params);
    case "groq":
    case "openai":
    case "anthropic":
    case "ollama":
      return notImplemented(provider);
    default:
      throw new LLMClientError(`Unknown LLM provider: ${provider}`, "gemini", "unknown");
  }
}

/**
 * Attempts primary provider, then optionally falls back once to OpenRouter on quota errors.
 * No retry loops — at most two total attempts.
 */
export async function generateJsonWithLLMFallback(
  params: LLMGenerateJsonParams,
  options?: {
    fallbackProvider?: LLMProvider;
    fallbackOnQuota?: boolean;
  },
): Promise<LLMGenerateJsonResult> {
  const primaryProvider = params.provider ?? resolveDefaultLLMProvider();
  const fallbackProvider = options?.fallbackProvider ?? "openrouter";
  const fallbackOnQuota = options?.fallbackOnQuota ?? true;

  try {
    return await generateJsonWithLLM({ ...params, provider: primaryProvider });
  } catch (error) {
    const shouldFallback =
      fallbackOnQuota &&
      isLLMQuotaError(error) &&
      primaryProvider === "gemini" &&
      fallbackProvider === "openrouter" &&
      hasOpenRouterApiKey();

    if (!shouldFallback) throw error;

    return generateJsonWithLLM({
      ...params,
      provider: "openrouter",
      model: params.model && primaryProvider !== "gemini" ? params.model : undefined,
    });
  }
}

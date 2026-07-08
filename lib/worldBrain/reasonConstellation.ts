/**
 * Constellation Reasoner — Gemini call and response normalization (Phase 2, Step 4).
 */

import { buildConstellationReasonerPrompt } from "@/lib/worldBrain/constellationReasonerPrompt";
import {
  CONSTELLATION_REASONER_NODE_TYPES,
  CONSTELLATION_REASONER_TENSION_LEVELS,
} from "@/lib/worldBrain/constellationReasonerPrompt";
import type {
  ConstellationReasonerInput,
  ConstellationReasonerOutput,
  ExplorationAxis,
  NodeType,
  ReasonedStartingNode,
  SuggestedNodeConnection,
  TensionLevel,
} from "@/lib/worldBrain/constellationReasonerTypes";
import { guardNodeDescription } from "@/lib/worldBrain/reasoningQualityGuard";

const REASONER_MODEL = "gemini-2.5-flash";

const VALID_NODE_TYPES = new Set<NodeType>(CONSTELLATION_REASONER_NODE_TYPES);
const VALID_TENSION = new Set<TensionLevel>(CONSTELLATION_REASONER_TENSION_LEVELS);

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function strArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  return t;
}

export function parseGeminiJsonContent(text: string): unknown {
  const stripped = stripJsonFences(text);
  return JSON.parse(stripped) as unknown;
}

function normalizeNodeType(v: unknown): NodeType {
  const s = str(v, "event").toLowerCase();
  return VALID_NODE_TYPES.has(s as NodeType) ? (s as NodeType) : "event";
}

function normalizeTension(v: unknown): TensionLevel {
  const s = str(v, "medium").toLowerCase();
  return VALID_TENSION.has(s as TensionLevel) ? (s as TensionLevel) : "medium";
}

function normalizeExplorationAxes(raw: unknown): ExplorationAxis[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((item, i) => {
    const r = item as Record<string, unknown>;
    const name = str(r["name"], `Axis ${i + 1}`);
    return {
      id: str(r["id"], `axis_${i + 1}`),
      name,
      purpose: str(r["purpose"]),
      creativeFunction: str(r["creativeFunction"] ?? r["creative_function"]),
    };
  });
}

function normalizeStartingNodes(raw: unknown): ReasonedStartingNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item, i) => {
    const r = item as Record<string, unknown>;
    const title = str(r["title"], `Discovery ${i + 1}`);
    const displayTitle = str(r["displayTitle"] ?? r["display_title"], title);
    const tags = strArray(r["tags"], 8);
    return {
      id: str(r["id"], `node_${i + 1}`),
      title,
      displayTitle,
      nodeType: normalizeNodeType(r["nodeType"] ?? r["node_type"]),
      description: str(r["description"]),
      creativePurpose: str(r["creativePurpose"] ?? r["creative_purpose"]),
      discoveryQuestion: str(r["discoveryQuestion"] ?? r["discovery_question"]),
      expansionPotential: str(r["expansionPotential"] ?? r["expansion_potential"]),
      tensionLevel: normalizeTension(r["tensionLevel"] ?? r["tension_level"]),
      noveltyScore: num(r["noveltyScore"] ?? r["novelty_score"], 5),
      relevanceScore: num(r["relevanceScore"] ?? r["relevance_score"], 5),
      ...(tags.length > 0 ? { tags } : {}),
    };
  });
}

function normalizeConnections(raw: unknown): SuggestedNodeConnection[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item, i) => {
    const r = item as Record<string, unknown>;
    return {
      fromNodeId: str(r["fromNodeId"] ?? r["from_node_id"], `node_${i + 1}`),
      toNodeId: str(r["toNodeId"] ?? r["to_node_id"], `node_${i + 2}`),
      relationshipType: str(r["relationshipType"] ?? r["relationship_type"], "relates"),
      reason: str(r["reason"]),
    };
  });
}

export function normalizeConstellationReasonerOutput(
  raw: unknown,
  expectedConstellationId: string,
): ConstellationReasonerOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const constellationId = str(obj["constellationId"] ?? obj["constellation_id"], expectedConstellationId);
  const localSummary = str(obj["localSummary"] ?? obj["local_summary"]);
  if (!localSummary) return null;

  const startingNodes = normalizeStartingNodes(obj["startingNodes"] ?? obj["starting_nodes"]);
  if (startingNodes.length === 0) return null;

  return {
    constellationId,
    localSummary,
    explorationAxes: normalizeExplorationAxes(obj["explorationAxes"] ?? obj["exploration_axes"]),
    startingNodes,
    suggestedConnections: normalizeConnections(
      obj["suggestedConnections"] ?? obj["suggested_connections"],
    ),
    expansionRules: strArray(obj["expansionRules"] ?? obj["expansion_rules"], 8),
    avoidPatterns: strArray(obj["avoidPatterns"] ?? obj["avoid_patterns"], 8),
  };
}

function applyQualityGuardToOutput(
  output: ConstellationReasonerOutput,
  input: ConstellationReasonerInput,
): ConstellationReasonerOutput {
  const constellationTitle =
    input.selectedConstellation.displayTitle ?? input.selectedConstellation.title;

  return {
    ...output,
    startingNodes: output.startingNodes.map((node) => ({
      ...node,
      description: guardNodeDescription(node.description, {
        title: node.title,
        worldPrompt: input.worldPrompt,
        constellationTitle,
        creativePurpose: node.creativePurpose,
        discoveryQuestion: node.discoveryQuestion,
        nodeType: node.nodeType,
      }),
    })),
  };
}

async function reasonConstellationWithGemini(
  input: ConstellationReasonerInput,
  apiKey: string,
): Promise<ConstellationReasonerOutput> {
  const prompt = buildConstellationReasonerPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${REASONER_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string; code?: number };
  };

  if (!res.ok) {
    const msg = payload.error?.message ?? res.statusText;
    throw new Error(`Gemini HTTP ${res.status}: ${msg}`);
  }

  if (payload.error) {
    throw new Error(`Gemini error: ${payload.error.message ?? "unknown"}`);
  }

  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from Gemini");

  let parsed: unknown;
  try {
    parsed = parseGeminiJsonContent(content);
  } catch (e) {
    throw new Error(`Gemini JSON parse failed: ${String(e)}`);
  }

  const normalized = normalizeConstellationReasonerOutput(
    parsed,
    input.selectedConstellation.id,
  );
  if (!normalized) {
    throw new Error("Invalid ConstellationReasonerOutput shape from Gemini response");
  }

  return applyQualityGuardToOutput(normalized, input);
}

/** Calls Gemini to reason locally inside one constellation. */
export async function reasonConstellationWorld(
  input: ConstellationReasonerInput,
): Promise<ConstellationReasonerOutput> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return reasonConstellationWithGemini(input, apiKey);
}

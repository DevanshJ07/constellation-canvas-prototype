import { NextResponse } from "next/server";
import { adaptAgents, type AgentAdaptInput } from "@/lib/agentAdapt";

export async function POST(request: Request) {
  let body: AgentAdaptInput;

  try {
    body = (await request.json()) as AgentAdaptInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.worldSeed || !body?.currentNode?.title) {
    return NextResponse.json(
      { error: "Missing required: worldSeed, currentNode" },
      { status: 400 },
    );
  }

  const input: AgentAdaptInput = {
    worldSeed: String(body.worldSeed),
    currentNode: {
      id: String(body.currentNode.id ?? ""),
      title: String(body.currentNode.title),
      description: String(body.currentNode.description ?? ""),
      whyItMatters: String(body.currentNode.whyItMatters ?? ""),
      domain: String(body.currentNode.domain ?? ""),
    },
    activeDomain: String(body.activeDomain ?? ""),
    creatorDirection: String(body.creatorDirection ?? ""),
    canonThreads: body.canonThreads ?? null,
    worldTensions: Array.isArray(body.worldTensions)
      ? body.worldTensions.map(String)
      : [],
    currentPath: Array.isArray(body.currentPath)
      ? body.currentPath.map(String)
      : [],
    existingFutureNodes: Array.isArray(body.existingFutureNodes)
      ? body.existingFutureNodes
      : [],
    existingSiblingNodes: Array.isArray(body.existingSiblingNodes)
      ? body.existingSiblingNodes
      : [],
    rejectedIdeas: Array.isArray(body.rejectedIdeas)
      ? body.rejectedIdeas.map(String)
      : [],
    establishedTruths: Array.isArray(body.establishedTruths)
      ? body.establishedTruths.map(String)
      : [],
  };

  const result = await adaptAgents(input);
  return NextResponse.json(result);
}

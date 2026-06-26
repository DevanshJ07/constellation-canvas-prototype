import { NextResponse } from "next/server";
import {
  selectAgents,
  type AgentSelectInput,
} from "@/lib/agentSelect";

export async function POST(request: Request) {
  let body: AgentSelectInput;

  try {
    body = (await request.json()) as AgentSelectInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body?.worldSeed ||
    !body?.currentNode?.title ||
    !body?.currentNode?.description
  ) {
    return NextResponse.json(
      { error: "Missing required fields: worldSeed, currentNode" },
      { status: 400 },
    );
  }

  const normalized: AgentSelectInput = {
    worldSeed: String(body.worldSeed),
    currentNode: {
      title: String(body.currentNode.title),
      description: String(body.currentNode.description),
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
  };

  const result = await selectAgents(normalized);
  return NextResponse.json(result);
}

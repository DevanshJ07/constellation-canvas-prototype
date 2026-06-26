import { NextResponse } from "next/server";
import { exploreAgents, type AgentExploreInput } from "@/lib/agentExplore";

export async function POST(request: Request) {
  let body: AgentExploreInput;

  try {
    body = (await request.json()) as AgentExploreInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.worldSeed || !body?.currentNode?.title) {
    return NextResponse.json(
      { error: "Missing required: worldSeed, currentNode" },
      { status: 400 },
    );
  }

  const input: AgentExploreInput = {
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
    rejectedIdeas: Array.isArray(body.rejectedIdeas)
      ? body.rejectedIdeas.map(String)
      : [],
    existingBranches: Array.isArray(body.existingBranches)
      ? body.existingBranches.map(String)
      : [],
  };

  const result = await exploreAgents(input);
  return NextResponse.json(result);
}

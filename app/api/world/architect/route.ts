import { NextResponse } from "next/server";
import { decomposeWorldPrompt } from "@/lib/worldBrain/decomposeWorldPrompt";
import type { WorldPromptDecomposition } from "@/lib/worldBrain/decomposeWorldPrompt";
import { architectWorld } from "@/lib/worldBrain/architectWorld";

type ArchitectRequestBody = {
  decomposition?: WorldPromptDecomposition;
  worldPrompt?: string;
  purpose?: string;
};

export async function POST(request: Request) {
  let body: ArchitectRequestBody;

  try {
    body = (await request.json()) as ArchitectRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let decomposition = body.decomposition;

  if (!decomposition) {
    const worldPrompt = String(body.worldPrompt ?? "").trim();
    if (!worldPrompt) {
      return NextResponse.json(
        { error: "Missing required field: decomposition or worldPrompt" },
        { status: 400 },
      );
    }

    const purpose = String(body.purpose ?? "").trim();
    decomposition = await decomposeWorldPrompt(worldPrompt, purpose);
  }

  try {
    const result = await architectWorld(decomposition);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Architecture failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

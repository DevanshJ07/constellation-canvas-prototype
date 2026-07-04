import { NextResponse } from "next/server";
import { decomposeWorldPrompt } from "@/lib/worldBrain/decomposeWorldPrompt";

export async function POST(request: Request) {
  let body: { worldPrompt?: string; purpose?: string };

  try {
    body = (await request.json()) as { worldPrompt?: string; purpose?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const worldPrompt = String(body?.worldPrompt ?? "").trim();
  if (!worldPrompt) {
    return NextResponse.json(
      { error: "Missing required field: worldPrompt" },
      { status: 400 },
    );
  }

  const purpose = String(body?.purpose ?? "").trim();

  try {
    const result = await decomposeWorldPrompt(worldPrompt, purpose);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Decomposition failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

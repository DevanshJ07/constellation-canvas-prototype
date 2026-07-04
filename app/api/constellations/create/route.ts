import { NextResponse } from "next/server";
import { createConstellations } from "@/lib/dynamicConstellations";

export async function POST(request: Request) {
  let body: { worldSeed?: string; creatorDirection?: string };

  try {
    body = (await request.json()) as { worldSeed?: string; creatorDirection?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const worldSeed = String(body?.worldSeed ?? "").trim();
  if (!worldSeed) {
    return NextResponse.json(
      { error: "Missing required: worldSeed" },
      { status: 400 },
    );
  }

  const creatorDirection = String(body?.creatorDirection ?? "").trim();
  const result = await createConstellations(worldSeed, creatorDirection);
  return NextResponse.json(result);
}

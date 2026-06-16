"use client";

import { useState } from "react";
import ConstellationCanvas from "@/components/ConstellationCanvas";
import WorldSeedInput from "@/components/WorldSeedInput";

export default function Home() {
  const [worldSeed, setWorldSeed] = useState<string | null>(null);

  if (!worldSeed) {
    return <WorldSeedInput onGenerate={setWorldSeed} />;
  }

  return <ConstellationCanvas worldSeed={worldSeed} />;
}

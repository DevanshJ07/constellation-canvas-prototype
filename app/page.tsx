"use client";

import { useState } from "react";
import ConstellationCanvas from "@/components/ConstellationCanvas";
import WorldSeedInput from "@/components/WorldSeedInput";
import type {
  DynamicConstellation,
  WorldInterpretation,
} from "@/lib/dynamicConstellations";

export default function Home() {
  const [worldSeed, setWorldSeed] = useState<string | null>(null);
  const [constellations, setConstellations] = useState<DynamicConstellation[]>([]);
  const [worldInterpretation, setWorldInterpretation] =
    useState<WorldInterpretation | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | undefined>(undefined);

  if (!worldSeed) {
    return (
      <WorldSeedInput
        onGenerate={(seed, result) => {
          setConstellations(result.constellations);
          setWorldInterpretation(result.worldInterpretation ?? null);
          setUsedFallback(result.usedFallback);
          setFallbackReason(result.fallbackReason);
          setWorldSeed(seed);
        }}
      />
    );
  }

  return (
    <ConstellationCanvas
      worldSeed={worldSeed}
      dynamicConstellations={constellations}
      worldInterpretation={worldInterpretation}
      usedFallback={usedFallback}
      fallbackReason={fallbackReason}
    />
  );
}

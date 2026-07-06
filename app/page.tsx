"use client";

import { useState } from "react";
import ConstellationCanvas from "@/components/ConstellationCanvas";
import WorldSeedInput from "@/components/WorldSeedInput";
import type {
  DynamicConstellation,
  WorldInterpretation,
} from "@/lib/dynamicConstellations";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";

export default function Home() {
  const [worldSeed, setWorldSeed] = useState<string | null>(null);
  const [constellations, setConstellations] = useState<DynamicConstellation[]>([]);
  const [worldInterpretation, setWorldInterpretation] =
    useState<WorldInterpretation | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | undefined>(undefined);
  const [architectureCanvasModel, setArchitectureCanvasModel] =
    useState<CanvasWorldModel | null>(null);
  const [worldPurpose, setWorldPurpose] = useState<string | null>(null);

  if (!worldSeed) {
    return (
      <WorldSeedInput
        onGenerate={(seed, result, architectureModel, purpose) => {
          setConstellations(result.constellations);
          setWorldInterpretation(result.worldInterpretation ?? null);
          setUsedFallback(result.usedFallback);
          setFallbackReason(result.fallbackReason);
          setArchitectureCanvasModel(architectureModel ?? null);
          setWorldPurpose(purpose?.trim() || null);
          setWorldSeed(seed);
        }}
      />
    );
  }

  return (
    <ConstellationCanvas
      worldSeed={worldSeed}
      worldPurpose={worldPurpose}
      dynamicConstellations={constellations}
      worldInterpretation={worldInterpretation}
      usedFallback={usedFallback}
      fallbackReason={fallbackReason}
      architectureCanvasModel={architectureCanvasModel}
    />
  );
}

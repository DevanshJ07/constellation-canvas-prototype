"use client";

import { useCallback, useMemo, useState } from "react";
import GalaxyOrbitalScene from "@/components/GalaxyOrbitalScene";
import type { GalaxyNodeDecision, GalaxyScene } from "@/lib/worldBrain/galaxyScene";

// ── Mock data for isolated prototype route ────────────────────────────────────

export type NodeDecision = GalaxyNodeDecision;

export type MockMoon = {
  id: string;
  title: string;
  decision?: NodeDecision;
};

export type MockPlanet = {
  id: string;
  title: string;
  decision: NodeDecision;
  moons: MockMoon[];
};

export type MockConstellation = {
  id: string;
  title: string;
  planets: MockPlanet[];
};

export const MEMORY_ECONOMY_MOCK: MockConstellation = {
  id: "memory-economy",
  title: "Memory Economy",
  planets: [
    {
      id: "memory-price-index",
      title: "Memory Price Index",
      decision: "pending",
      moons: [
        { id: "grief-premium", title: "Grief Premium" },
        { id: "skill-crash", title: "Skill Crash" },
        { id: "ghost-spike", title: "Ghost Spike" },
        { id: "index-watchers", title: "Index Watchers" },
      ],
    },
    {
      id: "debt-memories",
      title: "Debt Memories",
      decision: "accepted",
      moons: [],
    },
    {
      id: "childhood-collateral",
      title: "Childhood Collateral",
      decision: "pending",
      moons: [
        { id: "sold-birthday", title: "Sold Birthday" },
        { id: "mothers-voice", title: "Mother's Voice" },
        { id: "empty-school-photo", title: "Empty School Photo" },
        { id: "borrowed-lullaby", title: "Borrowed Lullaby" },
      ],
    },
    {
      id: "black-market-brokers",
      title: "Black Market Brokers",
      decision: "inactive",
      moons: [],
    },
    {
      id: "memory-tax-office",
      title: "Memory Tax Office",
      decision: "pending",
      moons: [],
    },
    {
      id: "identity-loans",
      title: "Identity Loans",
      decision: "rejected",
      moons: [],
    },
  ],
};

function mockToScene(
  constellation: MockConstellation,
  selectedPlanetId: string,
): GalaxyScene {
  const selectedPlanet = constellation.planets.find((p) => p.id === selectedPlanetId);
  const moons = selectedPlanet?.moons ?? [];

  return {
    constellationId: constellation.id,
    constellationTitle: constellation.title,
    centerId: constellation.id,
    centerTitle: constellation.title,
    primaryNodes: constellation.planets.map((p) => ({
      id: p.id,
      title: p.title,
      decision: p.decision,
    })),
    moonParentId: moons.length > 0 ? selectedPlanetId : null,
    moonNodes: moons.map((m) => ({
      id: m.id,
      title: m.title,
      decision: m.decision ?? "pending",
    })),
    selectedNodeId: selectedPlanetId,
    ripplePulseIds: [],
    worldRippleActive: false,
  };
}

type GalaxyCanvasV2Props = {
  constellation?: MockConstellation;
  showRipple?: boolean;
};

export default function GalaxyCanvasV2({
  constellation = MEMORY_ECONOMY_MOCK,
  showRipple = true,
}: GalaxyCanvasV2Props) {
  const [selectedPlanetId, setSelectedPlanetId] = useState<string>(
    constellation.planets[0]?.id ?? "",
  );
  const [rippleKey, setRippleKey] = useState(0);

  const scene = useMemo(
    () => mockToScene(constellation, selectedPlanetId),
    [constellation, selectedPlanetId],
  );

  const handleNodeClick = useCallback((nodeId: string) => {
    if (constellation.planets.some((p) => p.id === nodeId)) {
      setSelectedPlanetId(nodeId);
      setRippleKey((k) => k + 1);
    }
  }, [constellation.planets]);

  return (
    <GalaxyOrbitalScene
      scene={scene}
      onNodeClick={handleNodeClick}
      showRipple={showRipple}
      showStatusStrip
      rippleKey={rippleKey}
    />
  );
}

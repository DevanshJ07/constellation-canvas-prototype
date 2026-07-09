/**
 * Maps live constellation exploration state → GalaxyScene for orbital rendering.
 */

import type { AiGeneratedBranch } from "@/lib/agentExplore";
import { toCreatorNodeLabel } from "@/lib/creatorCopy";
import type { DynamicConstellation } from "@/lib/dynamicConstellations";
import type { CanvasWorldModel } from "@/lib/worldBrain/mapArchitectureToCanvas";
import { getChildren } from "@/lib/worldData";
import { ACCEPT_CONSEQUENCES } from "@/lib/worldLogic";
import { resolveNodeMeta } from "@/lib/worldNodes";
import type { DiscoveryDecision, NavState } from "@/types/discovery";
import type { GalaxyNodeDecision, GalaxyOrbitNode, GalaxyScene } from "./galaxyScene";

export type MapGalaxySceneInput = {
  navState: Extract<NavState, { mode: "discovery" }>;
  decisions: Record<string, DiscoveryDecision>;
  hiddenIds: Set<string>;
  weakenedIds: Set<string>;
  aiBranches: Record<string, AiGeneratedBranch[]>;
  nodeReasonerBranchesByParentId: Record<string, AiGeneratedBranch[]>;
  nodeReasonerPanelMeta: Record<string, { displayTitle?: string }>;
  nodeOverrides: Record<string, { title?: string }>;
  architectureCanvasModel?: CanvasWorldModel | null;
  dynamicConstellations: DynamicConstellation[];
  worldSeed: string;
  selectedNodeId: string | null;
  ripplePulseIds: Set<string>;
  worldRippleActive: boolean;
};

function labelTitle(title: string, worldSeed: string, category?: string): string {
  return toCreatorNodeLabel(title, { title, worldSeed, category });
}

function mapDecision(
  id: string,
  decisions: Record<string, DiscoveryDecision>,
  hiddenIds: Set<string>,
  weakenedIds: Set<string>,
): GalaxyNodeDecision {
  if (hiddenIds.has(id) || decisions[id] === "rejected") return "rejected";
  if (weakenedIds.has(id)) return "inactive";
  if (decisions[id] === "accepted") return "accepted";
  return "pending";
}

function resolveCenterMeta(
  centerId: string,
  input: MapGalaxySceneInput,
): { title: string; category?: string } {
  const { architectureCanvasModel, dynamicConstellations, aiBranches, nodeReasonerPanelMeta } =
    input;
  const allAi = Object.values(aiBranches).flat();
  const allNr = Object.values(input.nodeReasonerBranchesByParentId).flat();

  const archConst = architectureCanvasModel?.constellations.find((c) => c.id === centerId);
  if (archConst) {
    return {
      title: archConst.displayTitle || archConst.title,
      category: archConst.displayTitle || "Constellation",
    };
  }

  const archNode = architectureCanvasModel?.nodes.find((n) => n.id === centerId);
  if (archNode) {
    return { title: archNode.title.trim() || "Untitled Branch", category: archNode.nodeType };
  }

  const dynConst = dynamicConstellations.find((c) => c.id === centerId);
  if (dynConst) return { title: dynConst.title, category: dynConst.agentName };

  const aiBranch = allAi.find((b) => b.id === centerId);
  if (aiBranch) return { title: aiBranch.title || "Untitled Branch", category: aiBranch.domain };

  const nrBranch = allNr.find((b) => b.id === centerId);
  const nrMeta = nodeReasonerPanelMeta[centerId];
  if (nrBranch || nrMeta) {
    return {
      title: nrMeta?.displayTitle ?? nrBranch?.title ?? "Untitled Branch",
      category: nrBranch?.domain ?? "Continuation",
    };
  }

  const meta = resolveNodeMeta(centerId);
  return { title: meta?.title ?? "Untitled Branch", category: meta?.category };
}

function resolvePrimaryTitle(
  id: string,
  aiBranch: AiGeneratedBranch | null,
  input: MapGalaxySceneInput,
): string {
  const { nodeOverrides, worldSeed } = input;
  if (aiBranch) {
    return labelTitle(
      nodeOverrides[aiBranch.id]?.title ?? (aiBranch.title || "Untitled Branch"),
      worldSeed,
      aiBranch.domain,
    );
  }
  const meta = resolveNodeMeta(id);
  return labelTitle(nodeOverrides[id]?.title ?? meta?.title ?? "Untitled Branch", worldSeed, meta?.category);
}

function resolveMoonTitle(branch: AiGeneratedBranch, input: MapGalaxySceneInput): string {
  const meta = input.nodeReasonerPanelMeta[branch.id];
  return labelTitle(
    input.nodeOverrides[branch.id]?.title ??
      meta?.displayTitle ??
      branch.title ??
      "Untitled Branch",
    input.worldSeed,
    branch.domain,
  );
}

function resolveConstellationTitle(input: MapGalaxySceneInput): {
  id: string;
  title: string;
} {
  const regionId = input.navState.regionId;
  const archConst = input.architectureCanvasModel?.constellations.find((c) => c.id === regionId);
  if (archConst) {
    return {
      id: regionId,
      title: labelTitle(archConst.displayTitle || archConst.title, input.worldSeed, "Constellation"),
    };
  }
  const dynConst = input.dynamicConstellations.find((c) => c.id === regionId);
  if (dynConst) {
    return { id: regionId, title: labelTitle(dynConst.title, input.worldSeed, dynConst.agentName) };
  }
  return {
    id: regionId,
    title: labelTitle(input.navState.discoveryTitle, input.worldSeed),
  };
}

/** Resolve constellation sun — always the region root in galaxy detail view. */
function resolveConstellationRootId(input: MapGalaxySceneInput): string {
  const { navState, architectureCanvasModel, dynamicConstellations } = input;
  const regionId = navState.regionId;

  if (architectureCanvasModel?.constellations.some((c) => c.id === regionId)) {
    return regionId;
  }
  if (dynamicConstellations.some((c) => c.id === regionId)) {
    return regionId;
  }

  for (const id of navState.trail) {
    if (architectureCanvasModel?.constellations.some((c) => c.id === id)) return id;
    if (dynamicConstellations.some((c) => c.id === id)) return id;
  }

  return navState.trail[0] ?? navState.discoveryId;
}

/** Derive one expanded moon orbit at a time — prefer selected primary, else center. */
function resolveMoonParentId(
  centerId: string,
  primaryIds: Set<string>,
  selectedNodeId: string | null,
  nodeReasonerBranchesByParentId: Record<string, AiGeneratedBranch[]>,
): string | null {
  const candidates: string[] = [];

  if (selectedNodeId && (nodeReasonerBranchesByParentId[selectedNodeId]?.length ?? 0) > 0) {
    candidates.push(selectedNodeId);
  }

  if ((nodeReasonerBranchesByParentId[centerId]?.length ?? 0) > 0) {
    candidates.push(centerId);
  }

  for (const id of primaryIds) {
    if (id !== selectedNodeId && (nodeReasonerBranchesByParentId[id]?.length ?? 0) > 0) {
      candidates.push(id);
    }
  }

  if (candidates.length === 0) return null;

  if (selectedNodeId && candidates.includes(selectedNodeId)) return selectedNodeId;
  if (candidates.includes(centerId)) return centerId;
  return candidates.find((id) => primaryIds.has(id)) ?? candidates[0] ?? null;
}

export function mapCanvasStateToGalaxyScene(input: MapGalaxySceneInput): GalaxyScene {
  const {
    navState,
    decisions,
    hiddenIds,
    weakenedIds,
    aiBranches,
    nodeReasonerBranchesByParentId,
    selectedNodeId,
    ripplePulseIds,
    worldRippleActive,
  } = input;

  const trail = navState.trail;
  const centerId = resolveConstellationRootId(input);
  const centerMeta = resolveCenterMeta(centerId, input);
  const constellation = resolveConstellationTitle(input);

  const dirIds = getChildren(centerId).filter(
    (id) => !hiddenIds.has(id) && decisions[id] !== "rejected" && !trail.includes(id),
  );

  const isCenterAccepted = decisions[centerId] === "accepted";
  const consIds = isCenterAccepted
    ? (ACCEPT_CONSEQUENCES[centerId] ?? [])
        .map((c) => c.id)
        .filter(
          (id) => !hiddenIds.has(id) && decisions[id] !== "rejected" && !trail.includes(id),
        )
    : [];

  const aiFutures = (aiBranches[centerId] ?? []).filter(
    (b) => !hiddenIds.has(b.id) && decisions[b.id] !== "rejected",
  );

  type FutureEntry =
    | { id: string; ai: false; branch: null }
    | { id: string; ai: true; branch: AiGeneratedBranch };

  const futureEntries: FutureEntry[] = [
    ...dirIds.map((id) => ({ id, ai: false as const, branch: null })),
    ...consIds.map((id) => ({ id, ai: false as const, branch: null })),
    ...aiFutures.map((b) => ({ id: b.id, ai: true as const, branch: b })),
  ];

  const primaryNodes: GalaxyOrbitNode[] = futureEntries.map((entry) => ({
    id: entry.id,
    title: resolvePrimaryTitle(entry.id, entry.branch, input),
    decision: mapDecision(entry.id, decisions, hiddenIds, weakenedIds),
  }));

  const primaryIds = new Set(primaryNodes.map((n) => n.id));
  const moonParentId = resolveMoonParentId(
    centerId,
    primaryIds,
    selectedNodeId,
    nodeReasonerBranchesByParentId,
  );

  const moonNodes: GalaxyOrbitNode[] = moonParentId
    ? (nodeReasonerBranchesByParentId[moonParentId] ?? [])
        .filter((b) => !hiddenIds.has(b.id) && decisions[b.id] !== "rejected" && !trail.includes(b.id))
        .map((branch) => ({
          id: branch.id,
          title: resolveMoonTitle(branch, input),
          decision: mapDecision(branch.id, decisions, hiddenIds, weakenedIds),
        }))
    : [];

  return {
    constellationId: constellation.id,
    constellationTitle: constellation.title,
    centerId,
    centerTitle: labelTitle(centerMeta.title, input.worldSeed, centerMeta.category),
    primaryNodes,
    moonParentId,
    moonNodes,
    selectedNodeId,
    ripplePulseIds: [...ripplePulseIds],
    worldRippleActive,
  };
}

/** Empty scene for non-discovery modes. */
export function emptyGalaxyScene(): GalaxyScene {
  return {
    constellationId: "",
    constellationTitle: "",
    centerId: "",
    centerTitle: "",
    primaryNodes: [],
    moonParentId: null,
    moonNodes: [],
    selectedNodeId: null,
    ripplePulseIds: [],
    worldRippleActive: false,
  };
}

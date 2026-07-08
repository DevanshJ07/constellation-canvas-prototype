"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import Breadcrumb from "@/components/Breadcrumb";
import WorldPulse from "@/components/WorldPulse";
import WorldWhisper from "@/components/WorldWhisper";
import { getInfluence, type WorldShift } from "@/lib/influence";
import ConsequenceNode, {
  type ConsequenceNodeData,
} from "@/components/ConsequenceNode";
import ConstellationRegionNode, {
  type VitalityDot,
} from "@/components/ConstellationRegionNode";
import DiscoveryNode, {
  type DiscoveryNodeData,
} from "@/components/DiscoveryNode";
import GhostOrbitNode from "@/components/GhostOrbitNode";
import OrbitRingNode from "@/components/OrbitRingNode";
import TrailNode, { type TrailNodeData } from "@/components/TrailNode";
import GraphMinimap from "@/components/GraphMinimap";
import ZoomControlsBar from "@/components/ZoomControlsBar";
import CanonUniverseOverlay from "@/components/CanonUniverseOverlay";
import CanonThreadsPanel from "@/components/CanonThreadsPanel";
import WorldSynthesisModal from "@/components/WorldSynthesisModal";
import EvolutionEventModal from "@/components/EvolutionEventModal";
import RippleModal from "@/components/RippleModal";
import WorldChangeCard from "@/components/WorldChangeCard";
import RipplePreviewPanel from "@/components/RipplePreviewPanel";
import WorldEvolutionPreviewPanel from "@/components/WorldEvolutionPreviewPanel";
import DiscoveryPanel from "@/components/DiscoveryPanel";
import WorldSidebar from "@/components/WorldSidebar";
import { buildConstellationLayout, buildArchitectureOverviewLayout } from "@/lib/layoutNodes";
import { MOCK_DISCOVERIES } from "@/lib/mockDiscoveries";
import {
  CONSTELLATION_REGIONS,
  DISCOVERY_REGION_MAP,
} from "@/lib/regions";
import {
  REGION_VIRTUAL_ROOTS,
  WORLD_GRAPH,
  getChildren,
} from "@/lib/worldData";
import {
  ACCEPT_CONSEQUENCES,
  getAllDescendantIds,
} from "@/lib/worldLogic";
import { buildCanonStructure } from "@/lib/canonStructure";
import { buildCanonThreads } from "@/lib/canonFlow";
import {
  buildCanonEvolutionTimeline,
} from "@/lib/canonEvolutionNarrative";
import { buildCanonProfile, originJourneySubtitle } from "@/lib/canonProfile";
import {
  computeExtendedRipple,
  buildFeedEntriesFromRipple,
  describeTensions,
  computeWorldState,
  type ExtendedRippleResult,
  type EvolutionFeedEntry,
  type EvolutionEventDef,
} from "@/lib/worldEvolution";
import { getDynamicFutures } from "@/lib/worldState";
import {
  buildRippleStateMap,
  type RippleState,
} from "@/lib/worldRipple";
import { getAgentVoice } from "@/lib/agentVoices";
import { buildAgentSelectInput } from "@/lib/agentSelectContext";
import type { AiGeneratedBranch } from "@/lib/agentExplore";
import type {
  AgentAdaptInput,
  AgentAdaptOutput,
  ExploreAgent,
  AgentInsight,
  ExistingNodeInfo,
} from "@/lib/agentAdapt";
import WorldShiftModal, { type WorldShiftSummary } from "@/components/WorldShiftModal";
import type {
  DynamicConstellation,
  WorldInterpretation,
} from "@/lib/dynamicConstellations";
import DynamicWorldOverview from "@/components/DynamicWorldOverview";
import ArchitecturePreview from "@/components/ArchitecturePreview";
import {
  buildArchitectureBranches,
  canvasNodeToAiDiscovery,
  getAgentNameForConstellation,
  registerCanvasWorldModel,
  registerReasonedNodeMeta,
  type CanvasConstellation,
  type CanvasWorldModel,
} from "@/lib/worldBrain/mapArchitectureToCanvas";
import {
  mapConstellationReasonerOutputToBranches,
  reasonedBranchToAiDiscovery,
  type ReasonedNodePanelMeta,
} from "@/lib/worldBrain/mapReasonedNodesToBranches";
import {
  canvasNodeToAvailableNode,
  reasonedStartingNodeToAvailableNode,
  type NodeReasonerAvailableNode,
} from "@/lib/worldBrain/buildNodeReasonerInput";
import {
  mapNodeReasonerOutputToCanvasNodes,
  nodeReasonerBranchToAiDiscovery,
  nodeReasonerCanvasNodeToAiBranch,
  registerNodeReasonerNodeMeta,
  type NodeReasonerNodePanelMeta,
} from "@/lib/worldBrain/mapNodeReasonerToCanvas";
import {
  buildDecisionNodeSourceFromCanvas,
  buildDecisionWorldContextFromCanvas,
  resolveDecisionConstellationFromCanvas,
} from "@/lib/worldBrain/buildDecisionContextFromCanvas";
import {
  buildUserDecisionEventFromNodeAction,
  createCanonStateSnapshotFromDecisions,
} from "@/lib/worldBrain/buildUserDecisionEvent";
import {
  appendDecisionEvent,
  createEmptyDecisionEventLog,
  summarizeCanonStateFromEventLog,
  summarizeDecisionEventLog,
} from "@/lib/worldBrain/decisionEventLog";
import {
  buildRippleTitleLookupMaps,
  generateRipplePreviewForDecision,
} from "@/lib/worldBrain/generateRipplePreviewForDecision";
import {
  updateRippleOperationApproval,
  type RipplePreviewModel,
} from "@/lib/worldBrain/ripplePreviewModel";
import { buildMemoryEconomyRipplePreviewFixture } from "@/lib/worldBrain/ripplePreviewFixture";
import { buildWorldEvolutionPlanFromRipplePreview } from "@/lib/worldBrain/buildWorldEvolutionFromRipple";
import { buildWorldEvolutionApplyDryRun, createCanvasEvolutionFingerprint } from "@/lib/worldBrain/worldEvolutionApplyDryRun";
import {
  applyWorldEvolutionPatches,
  computeEvolutionOverlayBatchDelta,
  extractEvolutionOverlayFromModel,
  findLatestUndoableEvolutionHistoryEntry,
  markEvolutionHistoryEntryUndone,
  type EvolutionAwareCanvasModel,
  type EvolutionHistoryEntry,
  type EvolutionUndoSnapshot,
  type WorldEvolutionApplyResult,
} from "@/lib/worldBrain/worldEvolutionApply";
import type { WorldEvolutionConfirmApplyArgs } from "@/components/WorldEvolutionPreviewPanel";
import { buildWorldEvolutionPreviewModel } from "@/lib/worldBrain/worldEvolutionPreviewModel";
import type { DecisionEventLog, UserDecisionEvent } from "@/lib/worldBrain/userDecisionTypes";
import type { NodeReasonerOutput } from "@/lib/worldBrain/nodeReasonerTypes";
import type { ConstellationReasonerOutput } from "@/lib/worldBrain/constellationReasonerTypes";
import { getAgentReasoning } from "@/lib/agentReasoning";
import { resolveNodeMeta, resolvePanelItem } from "@/lib/worldNodes";
import {
  CONSTELLATION_ORBIT_CENTER,
  labelPriority,
  layoutChildNodesAroundParent,
  resolveLabelOffsets,
  fitLayoutToBounds,
  DISCOVERY_LAYOUT_BOUNDS,
  applyPositionMapToNodes,
} from "@/lib/graphLayout";
import {
  computeConstellationGalaxyLayout,
  computeInnerSatelliteLayout,
  computePastContextOrbit,
  computeSatelliteNodeLayout,
  getNodeDepthScale,
  getOrbitRingRadii,
  getOrbitalVisualState,
  CONSTELLATION_ORBIT_BASE_RADIUS,
  CONSTELLATION_ORBIT_RADIUS_STEP,
  SATELLITE_ORBIT_BASE_RADIUS,
  SATELLITE_ORBIT_RADIUS_STEP,
} from "@/lib/orbitalLayout";
import { getConstellationTheme, themeChildEdgeStroke } from "@/lib/constellationTheme";
import { simplifyDisplayLabel } from "@/lib/simplifyDisplayLabel";
import {
  toCreatorNodeLabel,
  sanitizeCreatorCopy,
  formatCreatorCategory,
} from "@/lib/creatorCopy";
import {
  approveSafeRippleOperations,
  canOpenWorldEvolutionPreview,
} from "@/lib/rippleUserFlow";
import {
  buildWorldChangeDryRunBundle,
  canAutoApplyWorldChange,
  isRipplePreviewEmpty,
} from "@/lib/worldChangeFlow";
import {
  buildWorldChangeCardModel,
  buildFailedWorldChangeCardModel,
  buildPendingWorldChangeCardModel,
  getWorldChangeUserMessage,
} from "@/lib/worldChangeModel";
import {
  computeDetailPanelInset,
  computeDetailPanelWidth,
  SIDEBAR_WIDTH_PX,
} from "@/lib/detailPanelLayout";
import type {
  AiDiscovery,
  DiscoveryAction,
  DiscoveryDecision,
  NavState,
  PanelItem,
} from "@/types/discovery";

const ACCEPT_GLOW_MS = 700;
const EMERGE_GLOW_MS = 800;
const FIT_DELAY_MS = 80;
const FIT_DURATION_MS = 600;

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function nearestZoomLevel(zoom: number): number {
  return ZOOM_LEVELS.reduce((best, z) =>
    Math.abs(z - zoom) < Math.abs(best - zoom) ? z : best,
  );
}

// Trail (discovery-mode) orbital layout
const PAST_STEP_X = 165;

const CONSEQUENCE_EDGE_STYLE = {
  stroke: "rgba(45, 212, 191, 0.55)",
  strokeWidth: 1.5,
  strokeDasharray: "4 3",
} as const;

const TRAIL_EDGE_STYLE = {
  stroke: "rgba(167, 139, 250, 0.72)",
  strokeWidth: 2.5,
} as const;

const FUTURE_EDGE_STYLE = {
  stroke: "rgba(148, 163, 184, 0.45)",
  strokeWidth: 1.5,
  strokeDasharray: "5 4",
} as const;

const PAST_EDGE_STYLE = {
  stroke: "rgba(100, 116, 139, 0.42)",
  strokeWidth: 1.5,
} as const;

const nodeTypes = {
  constellationRegion: ConstellationRegionNode,
  discovery: DiscoveryNode,
  consequence: ConsequenceNode,
  trailNode: TrailNode,
  orbitRing: OrbitRingNode,
  ghostOrbit: GhostOrbitNode,
};

type ConstellationCanvasProps = {
  worldSeed: string;
  worldPurpose?: string | null;
  dynamicConstellations?: DynamicConstellation[];
  worldInterpretation?: WorldInterpretation | null;
  usedFallback?: boolean;
  fallbackReason?: string;
  architectureCanvasModel?: CanvasWorldModel | null;
};

function applyLabelOffsets(
  nodes: Node[],
  selectedId: string | null,
): Node[] {
  const entries = nodes
    .filter((n) => n.type === "trailNode")
    .map((n) => {
      const data = n.data as TrailNodeData;
      const collisionId = data.nodeId ?? n.id;
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        priority: labelPriority(
          data.journeyPhase,
          data.role,
          collisionId === selectedId || n.id === selectedId,
        ),
      };
    });

  if (entries.length === 0) return nodes;

  const offsets = resolveLabelOffsets(entries);
  return nodes.map((n) => {
    const offset = offsets[n.id];
    if (offset === undefined) return n;
    return {
      ...n,
      data: { ...(n.data as TrailNodeData), labelOffsetY: offset },
    };
  });
}

function injectRippleStates(
  nodes: Node[],
  rippleStates: Record<string, RippleState>,
): Node[] {
  if (Object.keys(rippleStates).length === 0) return nodes;
  return nodes.map((n) => {
    const state = rippleStates[n.id] ?? rippleStates[(n.data as TrailNodeData).nodeId ?? ""];
    if (!state) return n;
    return { ...n, data: { ...(n.data as TrailNodeData), rippleState: state } };
  });
}

/** Collect all descendant IDs from WORLD_GRAPH (recursive). */
function getWorldDescendantIds(id: string): string[] {
  const result: string[] = [];
  const queue = [...(WORLD_GRAPH[id] ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    result.push(next);
    queue.push(...(WORLD_GRAPH[next] ?? []));
  }
  return result;
}

function buildAvailableNodesForNodeReasoner(
  constellationId: string,
  architectureCanvasModel: CanvasWorldModel,
  reasonedConstellations: Record<string, ConstellationReasonerOutput>,
  nodeReasonerBranchesByParentId: Record<string, AiGeneratedBranch[]>,
  nodeReasonerPanelMeta: Record<string, NodeReasonerNodePanelMeta>,
  nodeConstellationMap: Record<string, string>,
): NodeReasonerAvailableNode[] {
  const seen = new Set<string>();
  const nodes: NodeReasonerAvailableNode[] = [];

  const pushUnique = (node: NodeReasonerAvailableNode) => {
    const id = "id" in node ? node.id : "";
    if (!id || seen.has(id)) return;
    seen.add(id);
    nodes.push(node);
  };

  const reasoned = reasonedConstellations[constellationId];
  if (reasoned?.startingNodes?.length) {
    for (const n of reasoned.startingNodes) {
      pushUnique(reasonedStartingNodeToAvailableNode(n, constellationId));
    }
  } else {
    for (const n of architectureCanvasModel.nodes) {
      if (n.constellationId === constellationId) {
        pushUnique(canvasNodeToAvailableNode(n));
      }
    }
  }

  for (const branches of Object.values(nodeReasonerBranchesByParentId)) {
    for (const branch of branches) {
      if (nodeConstellationMap[branch.id] !== constellationId) continue;
      const meta = nodeReasonerPanelMeta[branch.id];
      if (!meta) continue;
      pushUnique({
        id: branch.id,
        title: meta.fullTitle,
        displayTitle: meta.displayTitle,
        description: branch.description,
        nodeType: branch.domain,
        constellationId,
        creativePurpose: meta.whyThisFollows,
        discoveryQuestion: meta.discoveryQuestion,
        expansionPotential: meta.expansionPotential,
        tensionLevel: "medium",
      });
    }
  }

  return nodes;
}

function canvasNodeLabel(title: string, worldSeed = "", category?: string): string {
  return toCreatorNodeLabel(title, { title, worldSeed, category });
}

export default function ConstellationCanvas({
  worldSeed,
  worldPurpose = null,
  dynamicConstellations = [],
  worldInterpretation = null,
  usedFallback = false,
  fallbackReason,
  architectureCanvasModel: initialArchitectureCanvasModel = null,
}: ConstellationCanvasProps) {
  const [evolutionAppliedCanvasModel, setEvolutionAppliedCanvasModel] =
    useState<EvolutionAwareCanvasModel | null>(null);
  const architectureCanvasModel =
    evolutionAppliedCanvasModel ?? initialArchitectureCanvasModel;
  const [navState, setNavState] = useState<NavState>({ mode: "overview" });
  const [selectedItem, setSelectedItem] = useState<PanelItem | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [justRevealedId, setJustRevealedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DiscoveryDecision>>(
    {},
  );
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [canonRipplePulseIds, setCanonRipplePulseIds] = useState<Set<string>>(new Set());
  const [justAcceptedId, setJustAcceptedId] = useState<string | null>(null);
  const [justEmergedIds, setJustEmergedIds] = useState<Set<string>>(new Set());
  const [creatorTruths, setCreatorTruths] = useState<string[]>([]);
  const [latestShift, setLatestShift] = useState<WorldShift | null>(null);
  const [pulseNonce, setPulseNonce] = useState(0);
  const [creatorDirections, setCreatorDirections] = useState<Record<string, string>>({});
  const [synthesisOpen, setSynthesisOpen] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [rippleStates, setRippleStates] = useState<Record<string, RippleState>>({});
  const [rippleModal, setRippleModal] = useState<ExtendedRippleResult | null>(null);
  const [triggeredEvolutionIds, setTriggeredEvolutionIds] = useState<string[]>([]);
  const [evolutionFeed, setEvolutionFeed] = useState<EvolutionFeedEntry[]>([]);
  const [pendingEvolution, setPendingEvolution] = useState<EvolutionEventDef | null>(null);
  const [evolutionQueue, setEvolutionQueue] = useState<EvolutionEventDef[]>([]);

  // ── AI-generated branches & world adaptation ──────────────────────────────
  // keyed by parentNodeId → list of generated branches for that node
  const [aiBranches, setAiBranches] = useState<Record<string, AiGeneratedBranch[]>>({});
  // node title/description overrides (from adapt modify actions)
  const [nodeOverrides, setNodeOverrides] = useState<
    Record<string, { title: string; description: string; whyItMatters: string }>
  >({});
  // node IDs that have been weakened (dim + "less aligned" label)
  const [weakenedIds, setWeakenedIds] = useState<Set<string>>(new Set());
  const [activeSpecialists, setActiveSpecialists] = useState<ExploreAgent[]>([]);
  const [agentInsights, setAgentInsights] = useState<AgentInsight[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreFallback, setExploreFallback] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [adaptSummary, setAdaptSummary] = useState<WorldShiftSummary | null>(null);

  // Dynamic constellation state
  // Tracks which constellation IDs have had their initial branches auto-generated
  const [initializedConstellationIds, setInitializedConstellationIds] = useState<Set<string>>(new Set());
  const [constellationAutoLoading, setConstellationAutoLoading] = useState(false);
  // Maps AI node IDs → dynamic constellation ID (for canon thread grouping)
  const [nodeConstellationMap, setNodeConstellationMap] = useState<Record<string, string>>({});
  const architectureSeededRef = useRef(false);
  const [archDebugOpen, setArchDebugOpen] = useState(false);
  const [reasonedConstellations, setReasonedConstellations] = useState<
    Record<string, ConstellationReasonerOutput>
  >({});
  const [reasonedNodeDetails, setReasonedNodeDetails] = useState<
    Record<string, ReasonedNodePanelMeta>
  >({});
  const [isReasoningConstellation, setIsReasoningConstellation] = useState(false);
  const [reasoningConstellationId, setReasoningConstellationId] = useState<
    string | null
  >(null);
  const [constellationReasonerHints, setConstellationReasonerHints] = useState<
    Record<string, string>
  >({});
  const [isReasoningNode, setIsReasoningNode] = useState(false);
  const [reasoningNodeId, setReasoningNodeId] = useState<string | null>(null);
  const [nodeReasonerError, setNodeReasonerError] = useState<string | null>(null);
  const [nodeReasonerOutputsByParentId, setNodeReasonerOutputsByParentId] = useState<
    Record<string, NodeReasonerOutput>
  >({});
  const [nodeReasonerBranchesByParentId, setNodeReasonerBranchesByParentId] = useState<
    Record<string, AiGeneratedBranch[]>
  >({});
  const [nodeReasonerPanelMeta, setNodeReasonerPanelMeta] = useState<
    Record<string, NodeReasonerNodePanelMeta>
  >({});
  const [nodeReasonerChildPositions, setNodeReasonerChildPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [decisionEventLog, setDecisionEventLog] = useState<DecisionEventLog>(
    () => createEmptyDecisionEventLog(),
  );
  const [ripplePreview, setRipplePreview] = useState<RipplePreviewModel | null>(
    null,
  );
  const [ripplePreviewPanelOpen, setRipplePreviewPanelOpen] = useState(false);
  const [rippleConsequenceCardOpen, setRippleConsequenceCardOpen] = useState(false);
  const [pendingEvolutionOpen, setPendingEvolutionOpen] = useState(false);
  const [worldChangeStatusMessage, setWorldChangeStatusMessage] = useState<string | null>(
    null,
  );
  const [isApplyingWorldChange, setIsApplyingWorldChange] = useState(false);
  const [rippleReviewMessage, setRippleReviewMessage] = useState<string | null>(null);
  const [worldChangeCardPhase, setWorldChangeCardPhase] = useState<
    "idle" | "pending" | "ready" | "failed"
  >("idle");
  const [isGeneratingRipplePreview, setIsGeneratingRipplePreview] = useState(false);
  const [ripplePreviewError, setRipplePreviewError] = useState<string | null>(
    null,
  );
  const [latestRippleTriggerEventId, setLatestRippleTriggerEventId] = useState<
    string | null
  >(null);
  const [evolutionPreviewPanelOpen, setEvolutionPreviewPanelOpen] = useState(false);
  const [isApplyingWorldEvolution, setIsApplyingWorldEvolution] = useState(false);
  const [worldEvolutionApplyError, setWorldEvolutionApplyError] = useState<string | null>(
    null,
  );
  const [lastWorldEvolutionApplyResult, setLastWorldEvolutionApplyResult] =
    useState<WorldEvolutionApplyResult | null>(null);
  const [evolutionHistoryEntries, setEvolutionHistoryEntries] = useState<
    EvolutionHistoryEntry[]
  >([]);
  const [worldEvolutionUndoNotice, setWorldEvolutionUndoNotice] = useState<string | null>(
    null,
  );
  const [worldEvolutionUndoError, setWorldEvolutionUndoError] = useState<string | null>(
    null,
  );
  const rippleRequestGenRef = useRef(0);
  const reasonedConstellationsRef = useRef(reasonedConstellations);
  const reasonerRequestGenRef = useRef<Record<string, number>>({});
  const nodeReasonerRequestGenRef = useRef<Record<string, number>>({});
  const navStateRef = useRef(navState);

  useEffect(() => {
    reasonedConstellationsRef.current = reasonedConstellations;
  }, [reasonedConstellations]);

  useEffect(() => {
    navStateRef.current = navState;
  }, [navState]);

  /** Card overlay only for legacy dynamic constellations — architecture uses spatial canvas. */
  const showOverviewOverlay =
    navState.mode === "overview" &&
    !architectureCanvasModel &&
    dynamicConstellations.length > 0;

  useEffect(() => {
    console.log("Using architecture canvas model:", Boolean(architectureCanvasModel));
    console.log(
      "Canvas constellations:",
      architectureCanvasModel?.constellations?.map((c) => c.displayTitle || c.title),
    );
  }, [architectureCanvasModel]);

  useEffect(() => {
    if (!architectureCanvasModel || architectureSeededRef.current) return;
    architectureSeededRef.current = true;

    const { branches, nodeConstellationMap: archNodeMap } =
      buildArchitectureBranches(architectureCanvasModel);

    registerCanvasWorldModel(architectureCanvasModel);

    setAiBranches((prev) => ({ ...prev, ...branches }));
    setNodeConstellationMap((prev) => ({ ...prev, ...archNodeMap }));
    setInitializedConstellationIds(
      (prev) =>
        new Set([
          ...prev,
          ...architectureCanvasModel.constellations.map((c) => c.id),
        ]),
    );
  }, [architectureCanvasModel]);

  const applyReasonedOutput = useCallback(
    (constellationId: string, output: ConstellationReasonerOutput) => {
      if (!architectureCanvasModel) return;

      const { branches, nodeConstellationMap: newMap, panelMeta } =
        mapConstellationReasonerOutputToBranches(
          output,
          architectureCanvasModel,
          constellationId,
        );

      registerReasonedNodeMeta(
        output.startingNodes.map((n) => ({
          id: n.id,
          displayTitle: n.displayTitle,
          nodeType: n.nodeType,
        })),
      );

      setReasonedNodeDetails((prev) => ({ ...prev, ...panelMeta }));
      setNodeConstellationMap((prev) => ({ ...prev, ...newMap }));

      const ns = navStateRef.current;
      if (ns.mode === "discovery" && ns.regionId === constellationId) {
        setAiBranches((prev) => ({ ...prev, [constellationId]: branches }));
      }
    },
    [architectureCanvasModel],
  );

  const fetchReasonerForConstellation = useCallback(
    async (constellation: CanvasConstellation) => {
      if (!architectureCanvasModel) return;

      const id = constellation.id;
      const cached = reasonedConstellationsRef.current[id];
      if (cached) {
        applyReasonedOutput(id, cached);
        return;
      }

      const nextGen = (reasonerRequestGenRef.current[id] ?? 0) + 1;
      reasonerRequestGenRef.current[id] = nextGen;

      setIsReasoningConstellation(true);
      setReasoningConstellationId(id);
      setConstellationReasonerHints((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      const requestReasoner = async () => {
        const res = await fetch("/api/world/constellation-reasoner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasModel: architectureCanvasModel,
            selectedConstellationId: id,
            purpose: worldPurpose ?? undefined,
            worldPrompt: worldSeed,
            architectureSummary: architectureCanvasModel.worldSummary,
            existingCanon: [],
          }),
        });
        return (await res.json()) as {
          success?: boolean;
          output?: ConstellationReasonerOutput;
          error?: string;
        };
      };

      try {
        let data = await requestReasoner();
        if (!data.success || !data.output) {
          data = await requestReasoner();
        }

        if (reasonerRequestGenRef.current[id] !== nextGen) return;

        if (!data.success || !data.output) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[constellation-reasoner] failed", {
            constellationId: id,
            reason: "api_no_output",
            detail: data.error,
          });
        }
          const { branches } = buildArchitectureBranches(architectureCanvasModel);
          const archBranches = branches[id];
          const ns = navStateRef.current;
          if (
            archBranches?.length &&
            ns.mode === "discovery" &&
            ns.regionId === id
          ) {
            setAiBranches((prev) => ({
              ...prev,
              [id]: prev[id]?.length ? prev[id] : archBranches,
            }));
          }
          setConstellationReasonerHints((prev) => ({
            ...prev,
            [id]: "Nearby discoveries are ready to explore.",
          }));
          return;
        }

        setReasonedConstellations((prev) => ({ ...prev, [id]: data.output! }));
        applyReasonedOutput(id, data.output);
      } catch (error) {
        if (reasonerRequestGenRef.current[id] === nextGen) {
          if (process.env.NODE_ENV === "development") {
            console.debug("[constellation-reasoner] threw", {
              constellationId: id,
              reason: "exception",
              detail: error,
            });
          }
          const { branches } = buildArchitectureBranches(architectureCanvasModel);
          const archBranches = branches[id];
          const ns = navStateRef.current;
          if (
            archBranches?.length &&
            ns.mode === "discovery" &&
            ns.regionId === id
          ) {
            setAiBranches((prev) => ({
              ...prev,
              [id]: prev[id]?.length ? prev[id] : archBranches,
            }));
          }
          setConstellationReasonerHints((prev) => ({
            ...prev,
            [id]: "Nearby discoveries are ready to explore.",
          }));
        }
      } finally {
        if (reasonerRequestGenRef.current[id] === nextGen) {
          setIsReasoningConstellation(false);
          setReasoningConstellationId((current) =>
            current === id ? null : current,
          );
        }
      }
    },
    [architectureCanvasModel, worldSeed, worldPurpose, applyReasonedOutput],
  );

  const applyNodeReasonerOutput = useCallback(
    (parentId: string, output: NodeReasonerOutput, constellationId: string) => {
      if (!architectureCanvasModel) return;

      const parentMeta = reasonedNodeDetails[parentId];
      const archNode = architectureCanvasModel.nodes.find((n) => n.id === parentId);
      const nrParentMeta = nodeReasonerPanelMeta[parentId];
      const parentNode = {
        id: parentId,
        title:
          parentMeta?.fullTitle ??
          nrParentMeta?.fullTitle ??
          archNode?.title ??
          parentId,
        displayTitle:
          parentMeta?.displayTitle ??
          nrParentMeta?.displayTitle ??
          archNode?.title ??
          parentId,
      };

      const parentDepth =
        nrParentMeta?.depthLevel ??
        (reasonedConstellations[constellationId]?.startingNodes.some((n) => n.id === parentId)
          ? 1
          : 1);
      const depthLevel = parentDepth + 1;

      const existingNodeIds = [
        ...architectureCanvasModel.nodes.map((n) => n.id),
        ...Object.values(reasonedConstellations).flatMap((o) =>
          o.startingNodes.map((n) => n.id),
        ),
        ...Object.values(nodeReasonerBranchesByParentId).flatMap((branches) =>
          branches.map((b) => b.id),
        ),
      ];

      const mapped = mapNodeReasonerOutputToCanvasNodes({
        output,
        parentNode,
        selectedConstellationId: constellationId,
        depthLevel,
        existingNodeIds,
      });

      const layout = layoutChildNodesAroundParent({
        parentPosition: { x: 0, y: 0 },
        parentNodeId: parentId,
        childNodes: mapped.nodes.map((n) => ({ id: n.id })),
        depthLevel,
      });

      const branches = mapped.nodes.map((n) =>
        nodeReasonerCanvasNodeToAiBranch(n, mapped.panelMeta[n.id], parentId),
      );

      registerNodeReasonerNodeMeta(mapped.panelMeta, registerReasonedNodeMeta);
      setNodeReasonerPanelMeta((prev) => ({ ...prev, ...mapped.panelMeta }));
      setNodeReasonerChildPositions((prev) => ({ ...prev, ...layout.positions }));
      setNodeReasonerBranchesByParentId((prev) => ({ ...prev, [parentId]: branches }));
      setNodeConstellationMap((prev) => ({ ...prev, ...mapped.nodeConstellationMap }));
    },
    [
      architectureCanvasModel,
      reasonedNodeDetails,
      nodeReasonerPanelMeta,
      reasonedConstellations,
      nodeReasonerBranchesByParentId,
    ],
  );

  const handleAddTruth = useCallback((truth: string) => {
    setCreatorTruths((prev) => [...prev, truth]);
    setLatestShift({ truth, influence: getInfluence(truth) });
    setPulseNonce((n) => n + 1);
  }, []);

  const rfInstance = useRef<ReactFlowInstance | null>(null);

  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const panelInset = computeDetailPanelInset(viewportWidth, Boolean(selectedItem));
  const detailPanelWidth = computeDetailPanelWidth(viewportWidth);
  const canvasRightInset = panelInset > 0 ? `${panelInset}px` : "0";

  const handleViewportChange = useCallback((viewport: { zoom: number }) => {
    setZoomPct(Math.round(viewport.zoom * 100));
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    const inst = rfInstance.current;
    if (!inst) return;
    inst.zoomTo(level, { duration: 180 });
    setZoomPct(Math.round(level * 100));
  }, []);

  const handleZoomIn = useCallback(() => {
    const inst = rfInstance.current;
    if (!inst) return;
    const current = nearestZoomLevel(inst.getZoom());
    const idx = ZOOM_LEVELS.indexOf(current as (typeof ZOOM_LEVELS)[number]);
    setZoomLevel(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, idx + 1)]);
  }, [setZoomLevel]);

  const handleZoomOut = useCallback(() => {
    const inst = rfInstance.current;
    if (!inst) return;
    const current = nearestZoomLevel(inst.getZoom());
    const idx = ZOOM_LEVELS.indexOf(current as (typeof ZOOM_LEVELS)[number]);
    setZoomLevel(ZOOM_LEVELS[Math.max(0, idx - 1)]);
  }, [setZoomLevel]);

  const handleZoomReset = useCallback(() => setZoomLevel(1), [setZoomLevel]);

  const selectedNodeId = useMemo(() => {
    if (!selectedItem) return null;
    if (selectedItem.kind === "discovery") return selectedItem.discovery.id;
    if (selectedItem.kind === "ai-discovery") return selectedItem.discovery.id;
    return selectedItem.consequence.id;
  }, [selectedItem]);

  const handleExploreDeeper = useCallback(async () => {
    if (!architectureCanvasModel || !selectedNodeId) return;

    const constellationId =
      navState.mode === "discovery" ? navState.regionId : null;
    if (!constellationId) return;

    if (
      architectureCanvasModel.constellations.some((c) => c.id === selectedNodeId)
    ) {
      return;
    }

    const parentId = selectedNodeId;
    const cached = nodeReasonerOutputsByParentId[parentId];
    if (cached) {
      setNodeReasonerError(null);
      return;
    }

    const nextGen = (nodeReasonerRequestGenRef.current[parentId] ?? 0) + 1;
    nodeReasonerRequestGenRef.current[parentId] = nextGen;

    setIsReasoningNode(true);
    setReasoningNodeId(parentId);
    setNodeReasonerError(null);

    const requestNodeReasoner = async () => {
      const reasoned = reasonedConstellations[constellationId];
      const availableNodes = buildAvailableNodesForNodeReasoner(
        constellationId,
        architectureCanvasModel,
        reasonedConstellations,
        nodeReasonerBranchesByParentId,
        nodeReasonerPanelMeta,
        nodeConstellationMap,
      );

      const res = await fetch("/api/world/node-reasoner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasModel: architectureCanvasModel,
          selectedConstellationId: constellationId,
          selectedNodeId: parentId,
          availableNodes,
          worldPrompt: worldSeed,
          purpose: worldPurpose ?? undefined,
          architectureSummary: architectureCanvasModel.worldSummary,
          localSummary: reasoned?.localSummary,
          explorationAxes: reasoned?.explorationAxes,
        }),
      });

      return (await res.json()) as {
        success?: boolean;
        output?: NodeReasonerOutput;
        error?: string;
      };
    };

    try {
      let data = await requestNodeReasoner();
      if (!data.success || !data.output) {
        data = await requestNodeReasoner();
      }

      if (nodeReasonerRequestGenRef.current[parentId] !== nextGen) return;

      if (!data.success || !data.output) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[node-reasoner] failed", {
            parentId,
            reason: "api_no_output",
            detail: data.error,
          });
        }
        setNodeReasonerError("This path needs one more clue. Try steering it.");
        return;
      }

      setNodeReasonerOutputsByParentId((prev) => ({
        ...prev,
        [parentId]: data.output!,
      }));
      applyNodeReasonerOutput(parentId, data.output, constellationId);
    } catch (error) {
      if (nodeReasonerRequestGenRef.current[parentId] === nextGen) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[node-reasoner] threw", {
            parentId,
            reason: "exception",
            detail: error,
          });
        }
        setNodeReasonerError("This path needs one more clue. Try steering it.");
      }
    } finally {
      if (nodeReasonerRequestGenRef.current[parentId] === nextGen) {
        setIsReasoningNode(false);
        setReasoningNodeId((current) => (current === parentId ? null : current));
      }
    }
  }, [
    architectureCanvasModel,
    selectedNodeId,
    navState,
    nodeReasonerOutputsByParentId,
    reasonedConstellations,
    nodeReasonerBranchesByParentId,
    nodeReasonerPanelMeta,
    nodeConstellationMap,
    worldSeed,
    worldPurpose,
    applyNodeReasonerOutput,
  ]);

  const canExploreDeeperNode = useMemo(() => {
    if (!architectureCanvasModel || !selectedNodeId) return false;
    if (selectedItem?.kind === "consequence") return false;
    if (navState.mode !== "discovery") return false;
    if (
      architectureCanvasModel.constellations.some((c) => c.id === selectedNodeId)
    ) {
      return false;
    }
    return true;
  }, [architectureCanvasModel, selectedNodeId, selectedItem, navState.mode]);

  const hasNodeReasonerCache = Boolean(
    selectedNodeId && nodeReasonerOutputsByParentId[selectedNodeId],
  );

  const baseLayout = useMemo(
    () => buildConstellationLayout(worldSeed, MOCK_DISCOVERIES),
    [worldSeed],
  );

  const architectureLayout = useMemo(
    () =>
      architectureCanvasModel
        ? buildArchitectureOverviewLayout(architectureCanvasModel)
        : null,
    [architectureCanvasModel],
  );

  const overviewLayout = architectureLayout ?? baseLayout;

  useEffect(() => {
    const t = window.setTimeout(() => {
      rfInstance.current?.fitView({
        padding: 0.28,
        duration: FIT_DURATION_MS,
        includeHiddenNodes: false,
      });
    }, FIT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [navState]);

  // ── Trail layout: PAST ← CURRENT → FUTURE ─────────────────────────────────
  const trailLayout = useMemo(() => {
    if (navState.mode !== "discovery") {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const trail = navState.trail;
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const focusedId = trail[trail.length - 1];
    const pastCount = trail.length - 1;

    const constellationTheme = architectureCanvasModel
      ? getConstellationTheme(navState.regionId, architectureCanvasModel)
      : null;
    const accentColor = constellationTheme?.dot;
    const themedTrailEdge = {
      ...TRAIL_EDGE_STYLE,
      stroke: constellationTheme?.line ?? TRAIL_EDGE_STYLE.stroke,
    };
    const themedFutureEdge = {
      ...FUTURE_EDGE_STYLE,
      stroke: constellationTheme?.edge ?? FUTURE_EDGE_STYLE.stroke,
    };
    const themedAiEdge = {
      stroke: constellationTheme?.dot ?? "rgba(139, 92, 246, 0.65)",
      strokeWidth: 1.5,
      strokeDasharray: "5 3",
    };
    const themedNrEdge = {
      stroke: constellationTheme
        ? themeChildEdgeStroke(constellationTheme)
        : "rgba(56, 189, 248, 0.55)",
      strokeWidth: 1.5,
      strokeDasharray: "4 4",
    };

    const isConstellationRootView =
      trail.length === 1 &&
      Boolean(
        architectureCanvasModel?.constellations.some((c) => c.id === focusedId) ||
          dynamicConstellations.some((c) => c.id === focusedId),
      );

    const orbitCenter = CONSTELLATION_ORBIT_CENTER;
    const focusCenter = isConstellationRootView ? orbitCenter : { x: 0, y: 0 };
    const explorationDepth = trail.length;
    const depthScale = getNodeDepthScale(explorationDepth);

    const allFlatBranches = Object.values(aiBranches).flat();
    const allNrBranches = Object.values(nodeReasonerBranchesByParentId).flat();

    const pastTrailIds = trail.slice(0, -1);
    const pastOrbitPositions = computePastContextOrbit(
      pastTrailIds.length,
      focusCenter,
      focusedId,
    );

    const buildOrbitalTrailData = (
      params: {
        role: TrailNodeData["role"];
        journeyPhase: TrailNodeData["journeyPhase"];
        decision: TrailNodeData["decision"];
        weakened?: boolean;
        rippleState?: TrailNodeData["rippleState"];
      },
    ): Pick<TrailNodeData, "depthScale" | "orbitalVisualState"> => ({
      depthScale,
      orbitalVisualState: getOrbitalVisualState({
        role: params.role,
        decision: params.decision,
        journeyPhase: params.journeyPhase,
        weakened: params.weakened,
        isConstellationRoot: isConstellationRootView && params.role === "focused",
        rippleActive: Boolean(params.rippleState),
      }),
    });

    const isWorldRippleActive =
      worldChangeCardPhase === "pending" || isGeneratingRipplePreview;

    // PAST + CURRENT: walked path
    trail.forEach((id, i) => {
      const staticMeta = resolveNodeMeta(id);
      const archConst = architectureCanvasModel?.constellations.find((c) => c.id === id);
      const archNode = architectureCanvasModel?.nodes.find((n) => n.id === id);
      const dynConst = staticMeta || archConst || archNode ? null : dynamicConstellations.find((c) => c.id === id);
      const aiBranch = (staticMeta || dynConst || archConst || archNode) ? null : allFlatBranches.find((b) => b.id === id);
      const nrBranch =
        staticMeta || dynConst || archConst || archNode || aiBranch
          ? null
          : allNrBranches.find((b) => b.id === id);
      const nrMeta = nodeReasonerPanelMeta[id];
      const meta = staticMeta
        ?? (archNode
          ? {
              title: archNode.title.trim() || "Untitled Branch",
              category: archNode.nodeType,
            }
          : null)
        ?? (archConst
          ? {
              title: archConst.displayTitle || archConst.title,
              category: archConst.displayTitle || "Constellation",
            }
          : null)
        ?? (dynConst ? { title: dynConst.title, category: dynConst.agentName } : null)
        ?? (aiBranch ? { title: aiBranch.title || "Untitled Branch", category: aiBranch.domain } : null)
        ?? (nrBranch || nrMeta
          ? {
              title: nrMeta?.displayTitle ?? nrBranch?.title ?? "Untitled Branch",
              category: nrBranch?.domain ?? "Continuation",
            }
          : null);
      const isFocused = i === trail.length - 1;
      const pastIndex = pastTrailIds.indexOf(id);
      const pastPos = pastIndex >= 0 ? pastOrbitPositions[pastIndex] : null;
      const x = isFocused
        ? focusCenter.x
        : pastPos?.x ?? focusCenter.x - PAST_STEP_X * Math.max(0, pastCount - i);
      const y = isFocused ? focusCenter.y : pastPos?.y ?? focusCenter.y;

      const trailDecision = decisions[id] ?? "pending";
      nodes.push({
        id,
        type: "trailNode",
        position: { x, y },
        data: {
          title: canvasNodeLabel(meta?.title || "Untitled Branch", worldSeed, meta?.category),
          category: formatCreatorCategory(meta?.category),
          role: isFocused ? "focused" : "path",
          decision: trailDecision,
          justAccepted: id === justAcceptedId,
          isRipplePulse: canonRipplePulseIds.has(id),
          isWorldRippleDimmed: isWorldRippleActive && id !== focusedId && !canonRipplePulseIds.has(id),
          hasCreatorDirection: Boolean(creatorDirections[id]),
          journeyPhase: isFocused ? "current" : "past",
          accentColor,
          ...buildOrbitalTrailData({
            role: isFocused ? "focused" : "path",
            journeyPhase: isFocused ? "current" : "past",
            decision: trailDecision,
            weakened: weakenedIds.has(id),
          }),
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: isFocused ? 10 : 4,
      });

      if (i > 0) {
        edges.push({
          id: `trail-${trail[i - 1]}-${id}`,
          source: trail[i - 1],
          target: id,
          type: "smoothstep",
          animated: isFocused,
          style: isFocused ? themedTrailEdge : PAST_EDGE_STYLE,
        });
      }
    });

    // FUTURE: route branches (right)
    const dirIds = getChildren(focusedId).filter(
      (id) =>
        !hiddenIds.has(id) &&
        decisions[id] !== "rejected" &&
        !trail.includes(id),
    );

    const isFocusedAccepted = decisions[focusedId] === "accepted";
    const consIds = isFocusedAccepted
      ? (ACCEPT_CONSEQUENCES[focusedId] ?? [])
          .map((c) => c.id)
          .filter(
            (id) =>
              !hiddenIds.has(id) &&
              decisions[id] !== "rejected" &&
              !trail.includes(id),
          )
      : [];

    const aiFutures = (aiBranches[focusedId] ?? []).filter(
      (b) => !hiddenIds.has(b.id) && decisions[b.id] !== "rejected",
    );

    type FutureEntry =
      | { id: string; kind: "direction" | "consequence"; ai: false; branch: null }
      | { id: string; kind: "direction"; ai: true; branch: AiGeneratedBranch };

    const futureIds: FutureEntry[] = [
      ...dirIds.map((id) => ({ id, kind: "direction" as const, ai: false as const, branch: null })),
      ...consIds.map((id) => ({ id, kind: "consequence" as const, ai: false as const, branch: null })),
      ...aiFutures.map((b) => ({ id: b.id, kind: "direction" as const, ai: true as const, branch: b })),
    ];

    const nrFutures = (nodeReasonerBranchesByParentId[focusedId] ?? []).filter(
      (b) =>
        !hiddenIds.has(b.id) &&
        decisions[b.id] !== "rejected" &&
        !trail.includes(b.id),
    );

    const totalSatelliteCount = futureIds.length + nrFutures.length;
    const planetOrbitPositions = isConstellationRootView
      ? computeConstellationGalaxyLayout(futureIds.length, {
          center: focusCenter,
          phaseSeed: focusedId,
          depthLevel: explorationDepth,
        })
      : computeSatelliteNodeLayout(futureIds.length, {
          center: focusCenter,
          phaseSeed: focusedId,
          depthLevel: explorationDepth,
        });

    const moonOrbitPositions =
      nrFutures.length > 0
        ? computeInnerSatelliteLayout(nrFutures.length, {
            center: focusCenter,
            phaseSeed: `${focusedId}_moons`,
            depthLevel: explorationDepth + 1,
          })
        : [];

    futureIds.forEach((item, j) => {
      const { id, kind, ai, branch: aiBranch } = item;
      const position = planetOrbitPositions[j] ?? focusCenter;
      const meta = resolveNodeMeta(id);
      const futureDecision = decisions[id] ?? "pending";

      nodes.push({
        id,
        type: "trailNode",
        position,
        data: {
          title: canvasNodeLabel(
            aiBranch
              ? (nodeOverrides[aiBranch.id]?.title ?? (aiBranch.title || "Untitled Branch"))
              : (nodeOverrides[id]?.title ?? meta?.title ?? "Untitled Branch"),
            worldSeed,
            aiBranch?.domain ?? meta?.category,
          ),
          category: aiBranch
            ? formatCreatorCategory(aiBranch.domain) ?? "Emergent Discovery"
            : formatCreatorCategory(meta?.category ?? (kind === "consequence" ? "Narrative Pressure" : undefined)),
          role: kind,
          decision: futureDecision,
          justEmerged: justEmergedIds.has(id),
          isForming: justEmergedIds.has(id),
          isRipplePulse: canonRipplePulseIds.has(id),
          isWorldRippleDimmed:
            isWorldRippleActive && !justEmergedIds.has(id) && !canonRipplePulseIds.has(id),
          hasCreatorDirection: Boolean(creatorDirections[id]),
          journeyPhase: "future",
          aiGenerated: ai,
          weakened: weakenedIds.has(id),
          nodeModified: Boolean(nodeOverrides[id]),
          accentColor,
          isInactiveBranch:
            futureDecision === "pending" &&
            !justEmergedIds.has(id) &&
            !weakenedIds.has(id),
          ...buildOrbitalTrailData({
            role: kind,
            journeyPhase: "future",
            decision: futureDecision,
            weakened: weakenedIds.has(id),
          }),
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: 5,
      });

      edges.push({
        id: `future-${focusedId}-${id}`,
        source: focusedId,
        target: id,
        type: "smoothstep",
        animated: kind === "consequence" || ai,
        style: ai
          ? themedAiEdge
          : kind === "consequence"
            ? CONSEQUENCE_EDGE_STYLE
            : themedFutureEdge,
      });
    });

    nrFutures.forEach((branch, index) => {
      const position = moonOrbitPositions[index] ?? focusCenter;
      const meta = nodeReasonerPanelMeta[branch.id];
      const nrDecision = decisions[branch.id] ?? "pending";
      const satelliteDepthScale = getNodeDepthScale(explorationDepth + 1);

      nodes.push({
        id: branch.id,
        type: "trailNode",
        position,
        data: {
          title: canvasNodeLabel(
            nodeOverrides[branch.id]?.title ??
            meta?.displayTitle ??
            branch.title ??
            "Untitled Branch",
            worldSeed,
            branch.domain,
          ),
          category: formatCreatorCategory(branch.domain) ?? "Living Thread",
          role: "direction",
          decision: nrDecision,
          justEmerged: justEmergedIds.has(branch.id),
          isForming: justEmergedIds.has(branch.id),
          isRipplePulse: canonRipplePulseIds.has(branch.id),
          isWorldRippleDimmed:
            isWorldRippleActive &&
            !justEmergedIds.has(branch.id) &&
            !canonRipplePulseIds.has(branch.id),
          hasCreatorDirection: Boolean(creatorDirections[branch.id]),
          journeyPhase: "future",
          aiGenerated: true,
          weakened: weakenedIds.has(branch.id),
          nodeModified: Boolean(nodeOverrides[branch.id]),
          accentColor,
          isInactiveBranch: nrDecision === "pending" && !justEmergedIds.has(branch.id),
          depthScale: satelliteDepthScale,
          orbitalVisualState: getOrbitalVisualState({
            role: "direction",
            decision: nrDecision,
            journeyPhase: "future",
            weakened: weakenedIds.has(branch.id),
          }),
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: 5,
      });

      edges.push({
        id: `nr-future-${focusedId}-${branch.id}`,
        source: focusedId,
        target: branch.id,
        type: "smoothstep",
        animated: true,
        style: themedNrEdge,
      });
    });

    const totalSatellites = totalSatelliteCount;
    if (totalSatellites > 0) {
      const orbitBase = isConstellationRootView
        ? CONSTELLATION_ORBIT_BASE_RADIUS
        : SATELLITE_ORBIT_BASE_RADIUS;
      const orbitStep = isConstellationRootView
        ? CONSTELLATION_ORBIT_RADIUS_STEP
        : SATELLITE_ORBIT_RADIUS_STEP;
      const ringRadii = getOrbitRingRadii(
        totalSatellites,
        orbitBase * depthScale,
        orbitStep,
      );
      ringRadii.forEach((radius, ringIndex) => {
        nodes.unshift({
          id: `orbit-ring-${focusedId}-${ringIndex}`,
          type: "orbitRing",
          position: { x: focusCenter.x, y: focusCenter.y },
          data: {
            radius,
            accentColor: constellationTheme?.line ?? accentColor,
            ringIndex,
            showDust: true,
          },
          draggable: false,
          selectable: false,
          zIndex: 0,
        });
      });
    }

    const minVisualSlots = isConstellationRootView ? 5 : 4;
    if (totalSatellites > 0 && totalSatellites < minVisualSlots) {
      const ghostLayout = isConstellationRootView
        ? computeConstellationGalaxyLayout(minVisualSlots, {
            center: focusCenter,
            phaseSeed: `${focusedId}_ghost`,
            depthLevel: explorationDepth,
          })
        : computeInnerSatelliteLayout(minVisualSlots, {
            center: focusCenter,
            phaseSeed: `${focusedId}_ghost_moon`,
            depthLevel: explorationDepth + 1,
          });
      ghostLayout.slice(totalSatellites).forEach((position, index) => {
        nodes.unshift({
          id: `ghost-orbit-${focusedId}-${index}`,
          type: "ghostOrbit",
          position,
          data: { accentColor: constellationTheme?.line ?? accentColor },
          draggable: false,
          selectable: false,
          zIndex: 1,
        });
      });
    }

    const layoutBounds = {
      ...DISCOVERY_LAYOUT_BOUNDS,
      maxX: selectedItem ? DISCOVERY_LAYOUT_BOUNDS.maxX - 40 : DISCOVERY_LAYOUT_BOUNDS.maxX,
    };
    const positionMap: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      positionMap[n.id] = n.position;
    }
    const fitted = fitLayoutToBounds(positionMap, layoutBounds, {
      padding: 32,
      minScale: 0.42,
      maxScale: 1,
    });

    return { nodes: applyPositionMapToNodes(nodes, fitted), edges };
  }, [navState, decisions, hiddenIds, justAcceptedId, creatorDirections, justEmergedIds, aiBranches, weakenedIds, nodeOverrides, dynamicConstellations, architectureCanvasModel, nodeReasonerBranchesByParentId, nodeReasonerPanelMeta, selectedItem, worldSeed, canonRipplePulseIds, worldChangeCardPhase, isGeneratingRipplePreview]);

  // ── Canon layout: living evolution tree ─────────────────────────────────────
  const worldState = useMemo(
    () => computeWorldState(acceptedIds),
    [acceptedIds],
  );

  const worldTensions = useMemo(
    () => describeTensions(worldState),
    [worldState],
  );

  const dynamicFutures = useMemo(
    () => getDynamicFutures(worldState),
    [worldState],
  );

  const canonProfile = useMemo(
    () => buildCanonProfile(acceptedIds, worldSeed, decisions, hiddenIds),
    [acceptedIds, worldSeed, decisions, hiddenIds],
  );

  const canonStructure = useMemo(
    () =>
      buildCanonStructure(
        acceptedIds,
        worldSeed,
        worldTensions,
        dynamicFutures,
        canonProfile.coherenceScore,
      ),
    [
      acceptedIds,
      worldSeed,
      worldTensions,
      dynamicFutures,
      canonProfile.coherenceScore,
    ],
  );

  const evolutionNarratives = useMemo(
    () => buildCanonEvolutionTimeline(acceptedIds, evolutionFeed),
    [acceptedIds, evolutionFeed],
  );

  const canonThreads = useMemo(
    () =>
      buildCanonThreads(
        acceptedIds,
        nodeConstellationMap,
        [
          ...dynamicConstellations.map((c) => ({ id: c.id, label: c.title })),
          ...(architectureCanvasModel?.constellations.map((c) => ({
            id: c.id,
            label: c.displayTitle || c.title,
          })) ?? []),
        ],
      ),
    [acceptedIds, nodeConstellationMap, dynamicConstellations, architectureCanvasModel],
  );

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const nodes = useMemo(() => {
    const { mode } = navState;

    if (mode === "canon") {
      return [];
    }

    if (mode === "discovery") {
      const base = applyLabelOffsets(trailLayout.nodes, selectedNodeId);
      return injectRippleStates(base, rippleStates);
    }

    return overviewLayout.nodes.map((node) => {
      if (node.type === "constellationRegion") {
        const regionId = node.id.replace("region-", "") as string;

        const hidden = mode !== "overview";

        let vitalityDots: VitalityDot[] | undefined;
        if (mode === "overview") {
          if (architectureCanvasModel) {
            vitalityDots = architectureCanvasModel.nodes
              .filter((n) => n.constellationId === regionId)
              .map((n) => ({
                revealed: true,
                decision: decisions[n.id] ?? "pending",
              }));
          } else {
            vitalityDots = MOCK_DISCOVERIES.filter(
              (d) => DISCOVERY_REGION_MAP[d.id] === regionId,
            ).map((d) => ({
              revealed: true,
              decision: decisions[d.id] ?? "pending",
            }));
          }
        }

        const regionDef = CONSTELLATION_REGIONS.find((r) => r.id === regionId);
        const archConst = architectureCanvasModel?.constellations.find(
          (c) => c.id === regionId,
        );

        return {
          ...node,
          hidden,
          selectable: mode === "overview",
          data: {
            ...node.data,
            icon: regionDef?.icon ?? (node.data as { icon?: string }).icon ?? "✦",
            label: archConst?.displayTitle
              ? simplifyDisplayLabel(archConst.displayTitle)
              : (node.data as { label?: string }).label,
            vitalityDots,
          },
        };
      }

      if (node.type === "discovery") {
        const data = node.data as DiscoveryNodeData;
        const decision = decisions[node.id] ?? "pending";
        const isRevealed = !data.isHidden || revealedIds.has(node.id);

        // In the new route model, discovery nodes are hidden at all non-overview levels
        // (navigation happens via trail nodes driven by worldData)
        const hidden = true;

        return {
          ...node,
          hidden,
          data: {
            ...data,
            isRevealed,
            justRevealed: node.id === justRevealedId,
            justAccepted: node.id === justAcceptedId,
            decision,
          },
        };
      }

      return { ...node, hidden: true };
    });
  }, [
    navState,
    trailLayout.nodes,
    overviewLayout.nodes,
    decisions,
    revealedIds,
    justRevealedId,
    justAcceptedId,
    selectedNodeId,
    rippleStates,
    architectureCanvasModel,
  ]);

  // ── Edges ─────────────────────────────────────────────────────────────────
  const edges = useMemo(() => {
    const { mode } = navState;

    if (mode === "discovery") return trailLayout.edges;
    if (mode === "canon") return [];
    return [];
  }, [navState, trailLayout.edges]);

  // Directions + unlocked consequences + AI branches for the side panel
  const panelDirections = useMemo(() => {
    if (!selectedItem) return [];
    const id =
      selectedItem.kind === "discovery"
        ? selectedItem.discovery.id
        : selectedItem.kind === "ai-discovery"
          ? selectedItem.discovery.id
          : selectedItem.consequence.id;

    const routeDirs = getChildren(id)
      .filter((dirId) => !hiddenIds.has(dirId) && decisions[dirId] !== "rejected")
      .map((dirId) => {
        const meta = resolveNodeMeta(dirId);
        return {
          id: dirId,
          title: meta?.title ?? dirId,
          category: meta?.category ?? "",
          decision: decisions[dirId] ?? "pending",
          kind: "route" as const,
        };
      });

    const consDirs =
      decisions[id] === "accepted"
        ? (ACCEPT_CONSEQUENCES[id] ?? [])
            .filter(
              (c) =>
                !hiddenIds.has(c.id) && decisions[c.id] !== "rejected",
            )
            .map((c) => ({
              id: c.id,
              title: c.title,
              category: c.category,
              decision: decisions[c.id] ?? "pending",
              kind: "consequence" as const,
            }))
        : [];

    const aiDirs = (aiBranches[id] ?? [])
      .filter((b) => !hiddenIds.has(b.id) && decisions[b.id] !== "rejected")
      .map((b) => ({
        id: b.id,
        title: b.title || "Untitled Branch",
        category: b.domain,
        decision: decisions[b.id] ?? "pending",
        kind: "route" as const,
      }));

    const nrDirs = (nodeReasonerBranchesByParentId[id] ?? [])
      .filter((b) => !hiddenIds.has(b.id) && decisions[b.id] !== "rejected")
      .map((b) => ({
        id: b.id,
        title: b.title || "Untitled Branch",
        category: b.domain,
        decision: decisions[b.id] ?? "pending",
        kind: "route" as const,
      }));

    return [...routeDirs, ...consDirs, ...aiDirs, ...nrDirs];
  }, [selectedItem, hiddenIds, decisions, aiBranches, nodeReasonerBranchesByParentId]);

  // ── Trail navigation ────────────────────────────────────────────────────────
  const navigateTrail = useCallback(
    (targetId: string) => {
      setNavState((prev) => {
        if (prev.mode !== "discovery") return prev;
        const idx = prev.trail.indexOf(targetId);
        const trail =
          idx >= 0 ? prev.trail.slice(0, idx + 1) : [...prev.trail, targetId];
        return { ...prev, trail };
      });

      // Check if this is a Node Reasoner child branch
      const nrBranch = Object.values(nodeReasonerBranchesByParentId)
        .flat()
        .find((b) => b.id === targetId);
      if (nrBranch) {
        setSelectedItem({
          kind: "ai-discovery",
          discovery: nodeReasonerBranchToAiDiscovery(
            nrBranch,
            nodeReasonerPanelMeta[nrBranch.id],
          ),
        });
        return;
      }

      // Check if this is an AI-generated branch
      const allAiBranches = Object.values(aiBranches).flat();
      const aiBranch = allAiBranches.find((b) => b.id === targetId);
      const archNode = architectureCanvasModel?.nodes.find((n) => n.id === targetId);
      if (archNode) {
        const constellation = architectureCanvasModel!.constellations.find(
          (c) => c.id === archNode.constellationId,
        );
        const agentName = constellation
          ? getAgentNameForConstellation(architectureCanvasModel!, constellation)
          : "Reasoning Agent";
        setSelectedItem({
          kind: "ai-discovery",
          discovery: canvasNodeToAiDiscovery(archNode, agentName),
        });
        return;
      }
      if (aiBranch) {
        setSelectedItem({
          kind: "ai-discovery",
          discovery: reasonedBranchToAiDiscovery(
            aiBranch,
            reasonedNodeDetails[aiBranch.id],
          ),
        });
        return;
      }

      const item = resolvePanelItem(targetId);
      if (item) setSelectedItem(item);
    },
    [aiBranches, architectureCanvasModel, reasonedNodeDetails, nodeReasonerBranchesByParentId, nodeReasonerPanelMeta],
  );

  /** Enter exploration mode for an architecture constellation (pre-seeded starting nodes). */
  const handleArchitectureConstellationEnter = useCallback(
    (constellation: CanvasConstellation) => {
      const displayTitle = canvasNodeLabel(
        constellation.displayTitle || constellation.title,
        worldSeed,
        "Constellation",
      );
      setConstellationReasonerHints((prev) => {
        const next = { ...prev };
        delete next[constellation.id];
        return next;
      });
      setNavState({
        mode: "discovery",
        discoveryId: constellation.id,
        regionId: constellation.id,
        discoveryTitle: displayTitle,
        trail: [constellation.id],
      });
      setSelectedItem({
        kind: "ai-discovery",
        discovery: {
          id: constellation.id,
          title: displayTitle,
          description: constellation.description,
          category: "Constellation",
          whyItMatters: constellation.question,
          generated: true,
        },
      });
      void fetchReasonerForConstellation(constellation);
    },
    [fetchReasonerForConstellation],
  );

  // ── Interaction ───────────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const { mode } = navState;

      // Overview: clicking a region enters that constellation's trail
      if (mode === "overview" && node.type === "constellationRegion") {
        const regionId = node.id.replace("region-", "") as string;

        const archConst = architectureCanvasModel?.constellations.find(
          (c) => c.id === regionId,
        );
        if (archConst) {
          handleArchitectureConstellationEnter(archConst);
          return;
        }

        const rootId = (REGION_VIRTUAL_ROOTS as Record<string, string>)[regionId] ?? regionId;
        const item = resolvePanelItem(rootId);
        const meta = resolveNodeMeta(rootId);
        setNavState({
          mode: "discovery",
          discoveryId: rootId,
          regionId,
          discoveryTitle: meta?.title || rootId,
          trail: [rootId],
        });
        setSelectedItem(item);
        return;
      }

      // Canon mode: clicking a node selects it for the panel
      if (mode === "canon" && node.type === "trailNode") {
        if (node.id === "canon-seed") return;
        const rawId = (node.data as TrailNodeData).nodeId ?? node.id;
        const item = resolvePanelItem(rawId);
        if (item) setSelectedItem(item);
        return;
      }

      // Discovery (trail) mode: navigate trail
      if (node.type === "trailNode") {
        navigateTrail(node.id);
        return;
      }

      if (node.type === "consequence") {
        const data = node.data as ConsequenceNodeData;
        setSelectedItem({ kind: "consequence", consequence: data.consequence });
        return;
      }

      if (node.type === "discovery") {
        const data = node.data as DiscoveryNodeData;
        if (hiddenIds.has(node.id)) return;

        if (data.isHidden && !revealedIds.has(node.id)) {
          setRevealedIds((prev) => new Set([...prev, node.id]));
          setJustRevealedId(node.id);
          window.setTimeout(() => setJustRevealedId(null), 700);
        }

        if (mode === "constellation") {
          setNavState({
            mode: "discovery",
            discoveryId: node.id,
            regionId: navState.regionId,
            discoveryTitle: data.discovery.title,
            trail: [node.id],
          });
        }

        setSelectedItem({ kind: "discovery", discovery: data.discovery });
      }
    },
    [navState, hiddenIds, revealedIds, navigateTrail, architectureCanvasModel, handleArchitectureConstellationEnter],
  );

  const onPaneClick = useCallback(() => setSelectedItem(null), []);

  const handleNavigate = useCallback((state: NavState) => {
    setNavState(state);
    setSelectedItem(null);
  }, []);

  /** Resolve node meta for static nodes, architecture nodes, or dynamic constellation roots. */
  const resolveNodeMetaExt = useCallback(
    (id: string) => {
      const staticMeta = resolveNodeMeta(id);
      if (staticMeta) return staticMeta;

      const archNode = architectureCanvasModel?.nodes.find((n) => n.id === id);
      if (archNode) {
        const constellation = architectureCanvasModel!.constellations.find(
          (c) => c.id === archNode.constellationId,
        );
        const agentName = constellation
          ? getAgentNameForConstellation(architectureCanvasModel!, constellation)
          : "Reasoning Agent";
        return {
          title: archNode.title.trim() || "Untitled Branch",
          category: archNode.nodeType,
          description: archNode.description,
          whyItMatters: archNode.whyPromising,
        };
      }

      const reasonedMeta = reasonedNodeDetails[id];
      if (reasonedMeta) {
        return {
          title: reasonedMeta.displayTitle,
          category: "Reasoned Node",
          description: reasonedMeta.fullTitle,
          whyItMatters: reasonedMeta.creativePurpose,
        };
      }

      const nodeReasonerMeta = nodeReasonerPanelMeta[id];
      if (nodeReasonerMeta) {
        return {
          title: nodeReasonerMeta.displayTitle,
          category: "Continuation",
          description: nodeReasonerMeta.fullTitle,
          whyItMatters: nodeReasonerMeta.whyThisFollows,
        };
      }

      const archConst = architectureCanvasModel?.constellations.find((c) => c.id === id);
      if (archConst) {
        return {
          title: archConst.displayTitle || archConst.title,
          category: archConst.displayTitle || "Constellation",
          description: archConst.description,
          whyItMatters: archConst.question,
        };
      }

      const dynConst = dynamicConstellations.find((c) => c.id === id);
      if (dynConst) {
        return {
          title: dynConst.title,
          category: dynConst.agentName,
          description: dynConst.description,
          whyItMatters: dynConst.purpose,
        };
      }
      return null;
    },
    [architectureCanvasModel, dynamicConstellations, reasonedNodeDetails, nodeReasonerPanelMeta],
  );

  const getDisplayTitle = useCallback(
    (id: string) => simplifyDisplayLabel(resolveNodeMetaExt(id)?.title ?? "Untitled Branch"),
    [resolveNodeMetaExt],
  );

  const appendUserDecisionEventForAction = useCallback(
    (
      action: Exclude<DiscoveryAction, "unaccept">,
      nodeId: string,
    ): { event: UserDecisionEvent; updatedLog: DecisionEventLog } | null => {
      if (!selectedItem) return null;

      try {
        const contextParams = {
          nodeId,
          selectedItem,
          architectureCanvasModel,
          navState,
          nodeConstellationMap,
          reasonedNodeDetails,
          nodeReasonerPanelMeta,
          nodeOverrides,
          resolveDisplayTitle: getDisplayTitle,
          worldSeed,
          worldPurpose,
        };

        const canonStateBefore = createCanonStateSnapshotFromDecisions(
          decisions,
          acceptedIds,
        );
        const node = buildDecisionNodeSourceFromCanvas(contextParams);
        const constellation = resolveDecisionConstellationFromCanvas(contextParams);
        const worldContext = buildDecisionWorldContextFromCanvas(contextParams);

        const event = buildUserDecisionEventFromNodeAction({
          action,
          node,
          constellation,
          canvasModel: architectureCanvasModel ?? undefined,
          worldContext,
          canonStateBefore,
          source: "user_click",
          snapshotOptions: {
            constellationId: node.constellationId,
            parentNodeId: node.parentNodeId,
            depthLevel: node.depthLevel,
            sourceLayer: node.sourceLayer,
            metadata: node.metadata,
          },
        });

        if (process.env.NODE_ENV === "development") {
          console.debug("[decision-event]", event);
        }

        let updatedLog!: DecisionEventLog;
        setDecisionEventLog((prev) => {
          updatedLog = appendDecisionEvent(prev, event);
          return updatedLog;
        });

        return { event, updatedLog };
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[decision-event] logging failed", err);
        }
        return null;
      }
    },
    [
      selectedItem,
      architectureCanvasModel,
      navState,
      nodeConstellationMap,
      reasonedNodeDetails,
      nodeReasonerPanelMeta,
      nodeOverrides,
      getDisplayTitle,
      worldSeed,
      worldPurpose,
      decisions,
      acceptedIds,
    ],
  );

  const requestRipplePreview = useCallback(
    async (
      event: UserDecisionEvent,
      updatedLog: DecisionEventLog,
      options?: { optimistic?: boolean },
    ) => {
      if (!architectureCanvasModel) return;

      const requestGen = rippleRequestGenRef.current + 1;
      rippleRequestGenRef.current = requestGen;

      setRipplePreview(null);
      setRipplePreviewPanelOpen(false);
      if (!options?.optimistic) {
        setRippleConsequenceCardOpen(false);
        setWorldChangeCardPhase("idle");
      }
      setRippleReviewMessage(null);
      setWorldChangeStatusMessage(null);
      setPendingEvolutionOpen(false);
      setRipplePreviewError(null);
      setIsGeneratingRipplePreview(true);
      setLatestRippleTriggerEventId(event.id);

      const titleMaps = buildRippleTitleLookupMaps({
        canvasModel: architectureCanvasModel,
        reasonedNodeDetails,
        nodeReasonerPanelMeta,
        nodeOverrides,
      });

      const result = await generateRipplePreviewForDecision({
        triggerEvent: event,
        decisionLog: updatedLog,
        canvasModel: architectureCanvasModel,
        activeCanonState: summarizeCanonStateFromEventLog(updatedLog),
        affectedScopeHint: "node",
        evaluationMode: "balanced",
        nodeTitleById: titleMaps.nodeTitleById,
        constellationTitleById: titleMaps.constellationTitleById,
      });

      if (rippleRequestGenRef.current !== requestGen) return;

      setIsGeneratingRipplePreview(false);

      if (result.ok) {
        setRipplePreview(result.preview);
        setRippleConsequenceCardOpen(true);
        setWorldChangeCardPhase("ready");
        setRipplePreviewPanelOpen(false);
        setEvolutionPreviewPanelOpen(false);
        setRipplePreviewError(null);
        if (process.env.NODE_ENV === "development") {
          console.debug("[ripple-preview] ready", {
            triggerEventId: event.id,
            operationCount: result.preview.counts.operationCount,
            status: result.preview.status,
          });
        }
      } else {
        if (options?.optimistic) {
          setWorldChangeCardPhase("failed");
          setRippleConsequenceCardOpen(true);
          setRipplePreviewError(null);
        } else {
          setRipplePreviewError("The world needs more context before evolving.");
        }
        if (process.env.NODE_ENV === "development") {
          console.debug("[ripple-preview] failed", event.id, result.error);
        }
      }
    },
    [
      architectureCanvasModel,
      reasonedNodeDetails,
      nodeReasonerPanelMeta,
      nodeOverrides,
    ],
  );

  const showMockRipplePreview = useCallback(() => {
    if (process.env.NODE_ENV !== "development") return;
    setRipplePreviewError(null);
    setIsGeneratingRipplePreview(false);
    setLatestRippleTriggerEventId("dev_mock_ripple_preview");
    setEvolutionPreviewPanelOpen(false);
    setRipplePreviewPanelOpen(false);
    setRipplePreview(buildMemoryEconomyRipplePreviewFixture());
    setRippleConsequenceCardOpen(true);
  }, []);

  useEffect(() => {
    if (!pendingEvolutionOpen || !ripplePreview) return;
    if (canOpenWorldEvolutionPreview(ripplePreview)) {
      setEvolutionPreviewPanelOpen(true);
    } else {
      setEvolutionPreviewPanelOpen(false);
    }
    setPendingEvolutionOpen(false);
  }, [ripplePreview, pendingEvolutionOpen]);

  const handleDeclineWorldChange = useCallback(() => {
    setRippleConsequenceCardOpen(false);
    setWorldChangeCardPhase("idle");
    setRippleReviewMessage(null);
    setWorldChangeStatusMessage(null);
    setRipplePreviewPanelOpen(false);
    setEvolutionPreviewPanelOpen(false);
    setPendingEvolutionOpen(false);
  }, []);

  const handleWorldChangeAdvancedDetails = useCallback(() => {
    setRippleConsequenceCardOpen(false);
    setRipplePreviewPanelOpen(true);
    if (ripplePreview) {
      const approved = approveSafeRippleOperations(ripplePreview);
      if (canOpenWorldEvolutionPreview(approved)) {
        setEvolutionPreviewPanelOpen(true);
      } else {
        setEvolutionPreviewPanelOpen(false);
      }
    }
  }, [ripplePreview]);

  const rippleTitleMaps = useMemo(
    () =>
      buildRippleTitleLookupMaps({
        canvasModel: architectureCanvasModel,
        reasonedNodeDetails,
        nodeReasonerPanelMeta,
        nodeOverrides,
      }),
    [architectureCanvasModel, reasonedNodeDetails, nodeReasonerPanelMeta, nodeOverrides],
  );

  const worldEvolutionPlan = useMemo(() => {
    if (!ripplePreview) return null;
    return buildWorldEvolutionPlanFromRipplePreview({
      preview: ripplePreview,
      canvasModel: architectureCanvasModel,
      canonState: summarizeCanonStateFromEventLog(decisionEventLog),
      nodeTitleById: rippleTitleMaps.nodeTitleById,
      nodeConstellationMap,
      decisionEventLog,
    });
  }, [
    ripplePreview,
    architectureCanvasModel,
    decisionEventLog,
    rippleTitleMaps.nodeTitleById,
    nodeConstellationMap,
  ]);

  const worldEvolutionPreview = useMemo(() => {
    if (!worldEvolutionPlan) return null;
    return buildWorldEvolutionPreviewModel(worldEvolutionPlan, {
      nodeTitleById: rippleTitleMaps.nodeTitleById,
      constellationTitleById: rippleTitleMaps.constellationTitleById,
    });
  }, [worldEvolutionPlan, rippleTitleMaps]);

  const worldEvolutionApplyDryRun = useMemo(() => {
    if (!worldEvolutionPlan) return null;
    const existingNodeIds = architectureCanvasModel
      ? architectureCanvasModel.nodes.map((node) => node.id)
      : Object.keys(nodeConstellationMap);
    const existingConstellationIds = architectureCanvasModel
      ? architectureCanvasModel.constellations.map((constellation) => constellation.id)
      : [...new Set(Object.values(nodeConstellationMap))];

    return buildWorldEvolutionApplyDryRun({
      plan: worldEvolutionPlan,
      canvasModel: architectureCanvasModel,
      canonState: summarizeCanonStateFromEventLog(decisionEventLog),
      nodeConstellationMap,
      nodeTitleById: rippleTitleMaps.nodeTitleById,
      existingNodeIds,
      existingConstellationIds,
    });
  }, [
    worldEvolutionPlan,
    architectureCanvasModel,
    decisionEventLog,
    nodeConstellationMap,
    rippleTitleMaps.nodeTitleById,
  ]);

  const worldChangeCardModel = useMemo(() => {
    if (worldChangeCardPhase === "pending") {
      return buildPendingWorldChangeCardModel();
    }
    if (worldChangeCardPhase === "failed") {
      return buildFailedWorldChangeCardModel();
    }
    if (!ripplePreview) return null;
    return buildWorldChangeCardModel(ripplePreview, worldEvolutionApplyDryRun);
  }, [worldChangeCardPhase, ripplePreview, worldEvolutionApplyDryRun]);

  const syncEvolutionOverlayToUi = useCallback(
    (
      model: EvolutionAwareCanvasModel,
      options: { mode?: "apply" | "restore"; undoSnapshot?: EvolutionUndoSnapshot } = {},
    ) => {
      const mode = options.mode ?? "apply";
      registerCanvasWorldModel(model);

      const { branches, nodeConstellationMap: archNodeMap } = buildArchitectureBranches(model);
      const archConstellationIds = new Set(model.constellations.map((constellation) => constellation.id));

      setAiBranches((prev) => {
        const next = { ...prev };

        if (mode === "restore" && options.undoSnapshot) {
          const batchDelta = computeEvolutionOverlayBatchDelta(
            options.undoSnapshot.canvasModelBefore,
            options.undoSnapshot.canvasModelAfter,
          );
          for (const constellationId of archConstellationIds) {
            next[constellationId] = branches[constellationId] ?? [];
          }
          for (const [constellationId, branchList] of Object.entries(next)) {
            next[constellationId] = branchList.filter(
              (branch) => !batchDelta.nodesAdded.includes(branch.id),
            );
          }
          return next;
        }

        for (const [constellationId, branchList] of Object.entries(branches)) {
          const existing = next[constellationId] ?? [];
          const merged = [...existing];
          for (const branch of branchList) {
            if (!merged.some((item) => item.id === branch.id)) {
              merged.push(branch);
            }
          }
          next[constellationId] = merged;
        }
        return next;
      });

      setNodeConstellationMap((prev) => {
        if (mode === "restore" && options.undoSnapshot) {
          const batchDelta = computeEvolutionOverlayBatchDelta(
            options.undoSnapshot.canvasModelBefore,
            options.undoSnapshot.canvasModelAfter,
          );
          const next: Record<string, string> = {};
          for (const [nodeId, constellationId] of Object.entries(prev)) {
            if (!batchDelta.nodesAdded.includes(nodeId)) {
              next[nodeId] = constellationId;
            }
          }
          return { ...next, ...archNodeMap };
        }
        return { ...prev, ...archNodeMap };
      });

      const overlay =
        mode === "restore" && options.undoSnapshot
          ? extractEvolutionOverlayFromModel(options.undoSnapshot.canvasModelBefore)
          : model.evolutionOverlay
            ? extractEvolutionOverlayFromModel(model)
            : null;

      if (!overlay && mode !== "restore") return;

      if (mode === "restore" && options.undoSnapshot) {
        const batchDelta = computeEvolutionOverlayBatchDelta(
          options.undoSnapshot.canvasModelBefore,
          options.undoSnapshot.canvasModelAfter,
        );
        const targetOverlay = extractEvolutionOverlayFromModel(
          options.undoSnapshot.canvasModelBefore,
        );

        setWeakenedIds((prev) => {
          const next = new Set(prev);
          for (const nodeId of batchDelta.weakenedAdded) next.delete(nodeId);
          for (const nodeId of targetOverlay.weakenedNodeIds) next.add(nodeId);
          return next;
        });

        setHiddenIds((prev) => {
          const next = new Set(prev);
          for (const nodeId of batchDelta.archivedAdded) next.delete(nodeId);
          for (const nodeId of targetOverlay.archivedNodeIds) next.add(nodeId);
          return next;
        });
        return;
      }

      if (overlay) {
        if (overlay.weakenedNodeIds.length > 0) {
          setWeakenedIds((prev) => new Set([...prev, ...overlay.weakenedNodeIds]));
        }

        // TODO: dedicated archived-node styling — soft-hide via hiddenIds until archive UI exists.
        if (overlay.archivedNodeIds.length > 0) {
          setHiddenIds((prev) => new Set([...prev, ...overlay.archivedNodeIds]));
        }
      }
    },
    [],
  );

  const canUndoLastWorldEvolutionApply = useMemo(
    () => findLatestUndoableEvolutionHistoryEntry(evolutionHistoryEntries) !== null,
    [evolutionHistoryEntries],
  );

  const handleUndoLastWorldEvolutionApply = useCallback(() => {
    const entry = findLatestUndoableEvolutionHistoryEntry(evolutionHistoryEntries);
    if (!entry?.undoSnapshot?.canvasModelBefore) {
      setWorldEvolutionUndoNotice(null);
      setWorldEvolutionUndoError("No evolution batch available to undo.");
      return;
    }

    const restoredModel = structuredClone(
      entry.undoSnapshot.canvasModelBefore,
    ) as EvolutionAwareCanvasModel;

    const equalsInitial =
      initialArchitectureCanvasModel !== null &&
      JSON.stringify(restoredModel) === JSON.stringify(initialArchitectureCanvasModel);

    setEvolutionAppliedCanvasModel(equalsInitial ? null : restoredModel);
    syncEvolutionOverlayToUi(restoredModel, {
      mode: "restore",
      undoSnapshot: entry.undoSnapshot,
    });

    const undoneAt = new Date().toISOString();
    setEvolutionHistoryEntries((prev) =>
      markEvolutionHistoryEntryUndone(prev, entry.id, undoneAt),
    );
    setLastWorldEvolutionApplyResult(null);
    setWorldEvolutionApplyError(null);
    setWorldEvolutionUndoError(null);
    setWorldEvolutionUndoNotice(
      `Undid evolution batch (${entry.appliedPatchIds.length} patch${entry.appliedPatchIds.length === 1 ? "" : "es"}).`,
    );
  }, [evolutionHistoryEntries, initialArchitectureCanvasModel, syncEvolutionOverlayToUi]);

  const handleConfirmWorldEvolutionApply = useCallback(
    ({ selectedPatchIds, allowNeedsReviewPatches }: WorldEvolutionConfirmApplyArgs) => {
      if (!architectureCanvasModel) {
        setWorldEvolutionApplyError("No architecture canvas model available.");
        return;
      }
      if (!worldEvolutionApplyDryRun) {
        setWorldEvolutionApplyError("No dry-run result available.");
        return;
      }
      if (selectedPatchIds.length === 0) {
        setWorldEvolutionApplyError("Select at least one patch to apply.");
        return;
      }
      if (
        worldEvolutionApplyDryRun.status === "failed" ||
        worldEvolutionApplyDryRun.status === "blocked"
      ) {
        setWorldEvolutionApplyError(
          `Dry-run is ${worldEvolutionApplyDryRun.status}; apply is not allowed.`,
        );
        return;
      }

      const currentCanvasFingerprint = createCanvasEvolutionFingerprint(architectureCanvasModel);
      if (
        worldEvolutionApplyDryRun.canvasFingerprint &&
        worldEvolutionApplyDryRun.canvasFingerprint !== currentCanvasFingerprint
      ) {
        setWorldEvolutionApplyError(
          "Dry run is stale. Refresh evolution preview before applying.",
        );
        return;
      }

      setIsApplyingWorldEvolution(true);
      setWorldEvolutionApplyError(null);

      try {
        const result = applyWorldEvolutionPatches({
          canvasModel: architectureCanvasModel,
          dryRun: worldEvolutionApplyDryRun,
          confirmed: true,
          selectedPatchIds,
          allowNeedsReviewPatches,
          canonState: summarizeCanonStateFromEventLog(decisionEventLog),
          planId: worldEvolutionPlan?.id,
          triggerEventId: worldEvolutionPlan?.triggerEventId,
          evolutionPolicy: worldEvolutionPlan?.policy,
          currentCanvasFingerprint,
        });

        setLastWorldEvolutionApplyResult(result);

        if (result.status === "applied") {
          setEvolutionAppliedCanvasModel(result.canvasModel);
          syncEvolutionOverlayToUi(result.canvasModel, { mode: "apply" });
          setEvolutionHistoryEntries((prev) => [...prev, result.historyEntry]);
          setWorldEvolutionApplyError(null);
          setWorldEvolutionUndoNotice(null);
          setWorldEvolutionUndoError(null);
        } else {
          const failureDetail =
            result.failedPatches.length > 0
              ? result.failedPatches.map((patch) => patch.stopReason).join(", ")
              : result.summary;
          setWorldEvolutionApplyError(
            result.status === "partially_applied"
              ? `Partial apply is not enabled: ${failureDetail}`
              : failureDetail,
          );
        }
      } catch (error) {
        setWorldEvolutionApplyError(
          error instanceof Error ? error.message : "Unexpected apply failure.",
        );
      } finally {
        setIsApplyingWorldEvolution(false);
      }
    },
    [
      architectureCanvasModel,
      worldEvolutionApplyDryRun,
      worldEvolutionPlan,
      decisionEventLog,
      syncEvolutionOverlayToUi,
    ],
  );

  const handleAcceptWorldChange = useCallback(() => {
    if (!ripplePreview || !architectureCanvasModel) return;

    if (isRipplePreviewEmpty(ripplePreview)) {
      setRippleConsequenceCardOpen(false);
      setWorldChangeStatusMessage(null);
      return;
    }

    const bundle = buildWorldChangeDryRunBundle({
      preview: ripplePreview,
      canvasModel: architectureCanvasModel,
      decisionEventLog,
      nodeTitleById: rippleTitleMaps.nodeTitleById,
      nodeConstellationMap,
    });

    setRipplePreview(bundle.approvedPreview);

    if (!canOpenWorldEvolutionPreview(bundle.approvedPreview)) {
      setWorldChangeStatusMessage(getWorldChangeUserMessage("review_needed"));
      return;
    }

    if (!canAutoApplyWorldChange(bundle)) {
      setWorldChangeStatusMessage(getWorldChangeUserMessage("review_needed"));
      return;
    }

    setIsApplyingWorldChange(true);
    setWorldChangeStatusMessage(null);

    try {
      const currentCanvasFingerprint = createCanvasEvolutionFingerprint(
        architectureCanvasModel,
      );
      const dryRun = bundle.dryRun!;

      if (
        dryRun.canvasFingerprint &&
        dryRun.canvasFingerprint !== currentCanvasFingerprint
      ) {
        setWorldChangeStatusMessage(getWorldChangeUserMessage("review_needed"));
        return;
      }

      const result = applyWorldEvolutionPatches({
        canvasModel: architectureCanvasModel,
        dryRun,
        confirmed: true,
        selectedPatchIds: bundle.readyPatchIds,
        allowNeedsReviewPatches: false,
        canonState: summarizeCanonStateFromEventLog(decisionEventLog),
        planId: bundle.plan?.id,
        triggerEventId: bundle.plan?.triggerEventId,
        evolutionPolicy: bundle.plan?.policy,
        currentCanvasFingerprint,
      });

      setLastWorldEvolutionApplyResult(result);

      if (result.status === "applied") {
        setEvolutionAppliedCanvasModel(result.canvasModel);
        syncEvolutionOverlayToUi(result.canvasModel, { mode: "apply" });
        setEvolutionHistoryEntries((prev) => [...prev, result.historyEntry]);
        setRippleConsequenceCardOpen(false);
        setWorldChangeCardPhase("idle");
        setWorldChangeStatusMessage(null);
        setRipplePreviewPanelOpen(false);
        setEvolutionPreviewPanelOpen(false);
        setWorldEvolutionApplyError(null);
      } else {
        if (process.env.NODE_ENV === "development") {
          console.debug("[world-change] apply blocked", result);
        }
        setWorldChangeStatusMessage(getWorldChangeUserMessage("review_needed"));
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[world-change] apply failed", error);
      }
      setWorldChangeStatusMessage(getWorldChangeUserMessage("review_needed"));
    } finally {
      setIsApplyingWorldChange(false);
    }
  }, [
    ripplePreview,
    architectureCanvasModel,
    decisionEventLog,
    rippleTitleMaps.nodeTitleById,
    nodeConstellationMap,
    syncEvolutionOverlayToUi,
  ]);

  // ── Action handler ─────────────────────────────────────────────────────────
  const handleAction = useCallback(
    (action: DiscoveryAction) => {
      if (!selectedItem) return;

      const id =
        selectedItem.kind === "discovery"
          ? selectedItem.discovery.id
          : selectedItem.kind === "ai-discovery"
            ? selectedItem.discovery.id
            : selectedItem.consequence.id;

      if (action === "unaccept") {
        const worldDesc = getWorldDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
        const consDesc = getAllDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
        const toReset = new Set([id, ...worldDesc, ...consDesc]);
        setDecisions((prev) => {
          const next = { ...prev };
          for (const rid of toReset) next[rid] = "pending";
          return next;
        });
        setAcceptedIds((prev) => prev.filter((a) => !toReset.has(a)));
        return;
      }

      const decisionMap: Record<
        Exclude<DiscoveryAction, "unaccept">,
        DiscoveryDecision
      > = { accept: "accepted", save: "saved", reject: "rejected" };
      const decision =
        decisionMap[action as Exclude<DiscoveryAction, "unaccept">];

      const decisionEventResult = appendUserDecisionEventForAction(
        action as Exclude<DiscoveryAction, "unaccept">,
        id,
      );

      setDecisions((prev) => ({ ...prev, [id]: decision }));

      if (decisionEventResult && architectureCanvasModel) {
        if (action === "accept") {
          setRippleConsequenceCardOpen(true);
          setWorldChangeCardPhase("pending");
          setRipplePreview(null);
          setRipplePreviewError(null);
          void requestRipplePreview(
            decisionEventResult.event,
            decisionEventResult.updatedLog,
            { optimistic: true },
          );
        } else {
          void requestRipplePreview(
            decisionEventResult.event,
            decisionEventResult.updatedLog,
          );
        }
      }

      // Accepting a weakened node overrides the weakened state — the creator is
      // explicitly committing to this truth regardless of direction alignment.
      if (action === "accept" && weakenedIds.has(id)) {
        setWeakenedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }

      if (action === "accept") {
        const aiTitle = selectedItem.kind === "ai-discovery" ? selectedItem.discovery.title : null;
        const nodeTitle = nodeOverrides[id]?.title ?? aiTitle ?? getDisplayTitle(id);
        const prevAccepted = acceptedIds;
        const nextAccepted = prevAccepted.includes(id)
          ? prevAccepted
          : [...prevAccepted, id];

        const triggeredSet = new Set(triggeredEvolutionIds);
        const result = computeExtendedRipple(
          id,
          nodeTitle,
          prevAccepted,
          nextAccepted,
          triggeredSet,
        );

        setAcceptedIds(nextAccepted);

        const stateMap = buildRippleStateMap(result, id);
        setRippleStates(stateMap);

        const pulseTargets = new Set<string>([id]);
        for (const childId of getChildren(id)) pulseTargets.add(childId);
        for (const branch of aiBranches[id] ?? []) pulseTargets.add(branch.id);
        for (const cons of ACCEPT_CONSEQUENCES[id] ?? []) pulseTargets.add(cons.id);
        setCanonRipplePulseIds(pulseTargets);
        window.setTimeout(() => setCanonRipplePulseIds(new Set()), 3200);

        const ts = Date.now();
        const feedEntries = buildFeedEntriesFromRipple(result, id, ts);
        setEvolutionFeed((prev) => [...prev, ...feedEntries]);

        if (result.newEvolutions.length > 0) {
          const newIds = result.newEvolutions.map((ev) => ev.id);
          setTriggeredEvolutionIds((prev) => [...prev, ...newIds]);
          setEvolutionQueue(result.newEvolutions);
          setPendingEvolution(result.newEvolutions[0]);
        }

        window.setTimeout(() => setRippleModal(result), 550);
        window.setTimeout(() => setRippleStates({}), 2800);

        setJustAcceptedId(id);

        const consequences = ACCEPT_CONSEQUENCES[id] ?? [];
        if (consequences.length > 0) {
          setJustEmergedIds(new Set(consequences.map((c) => c.id)));
          window.setTimeout(() => setJustEmergedIds(new Set()), EMERGE_GLOW_MS);
        }

        window.setTimeout(() => setJustAcceptedId(null), ACCEPT_GLOW_MS);
      }

      if (action === "reject") {
        const worldDesc = getWorldDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
        const consDesc = getAllDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
        const descendants = [...new Set([...worldDesc, ...consDesc])];
        if (descendants.length > 0) {
          setDecisions((prev) => {
            const next = { ...prev };
            for (const rid of descendants) next[rid] = "pending";
            return next;
          });
          setAcceptedIds((prev) =>
            prev.filter((a) => !new Set(descendants).has(a)),
          );
        }

        window.setTimeout(
          () => setHiddenIds((prev) => new Set([...prev, id])),
          500,
        );
        window.setTimeout(() => setSelectedItem(null), 400);

        // Step back in trail if rejected node is focused
        if (navState.mode === "discovery") {
          window.setTimeout(() => {
            setNavState((prev) => {
              if (prev.mode !== "discovery") return prev;
              const idx = prev.trail.indexOf(id);
              if (idx <= 0) {
                return { mode: "overview" };
              }
              if (idx === prev.trail.length - 1) {
                return { ...prev, trail: prev.trail.slice(0, idx) };
              }
              return prev;
            });
          }, 600);
        }
      }
    },
    [selectedItem, acceptedIds, navState, triggeredEvolutionIds, appendUserDecisionEventForAction, requestRipplePreview, architectureCanvasModel, getDisplayTitle, weakenedIds],
  );

  const decisionEventDebug = useMemo(
    () => summarizeDecisionEventLog(decisionEventLog),
    [decisionEventLog],
  );

  const handleEvolutionClose = useCallback(() => {
    setEvolutionQueue((queue) => {
      const [, ...rest] = queue;
      setPendingEvolution(rest[0] ?? null);
      return rest;
    });
  }, []);

  const selectedDecision = useMemo((): DiscoveryDecision => {
    if (!selectedItem) return "pending";
    const id =
      selectedItem.kind === "discovery"
        ? selectedItem.discovery.id
        : selectedItem.kind === "ai-discovery"
          ? selectedItem.discovery.id
          : selectedItem.consequence.id;
    return decisions[id] ?? "pending";
  }, [selectedItem, decisions]);

  const activeTrail = navState.mode === "discovery" ? navState.trail : [];

  const handleSetDirection = useCallback(
    (direction: string) => {
      if (!selectedNodeId) return;
      setCreatorDirections((prev) => ({ ...prev, [selectedNodeId]: direction }));
    },
    [selectedNodeId],
  );

  const agentVoice = useMemo(() => {
    if (!selectedNodeId) return null;
    const regionId =
      navState.mode === "discovery" || navState.mode === "constellation"
        ? navState.regionId
        : undefined;
    return getAgentVoice(selectedNodeId, regionId);
  }, [selectedNodeId, navState]);

  const agentReasoning = useMemo(() => {
    if (!selectedNodeId) return null;
    return getAgentReasoning(selectedNodeId);
  }, [selectedNodeId]);

  const journeySteps = useMemo(() => {
    if (navState.mode !== "discovery") return [];
    const allAiBranches = Object.values(aiBranches).flat();
    const steps = navState.trail.map((id, i, arr) => {
      const aiBranch = allAiBranches.find((b) => b.id === id);
      const archNode = architectureCanvasModel?.nodes.find((n) => n.id === id);
      const archConst = architectureCanvasModel?.constellations.find((c) => c.id === id);
      const dynConst = dynamicConstellations.find((c) => c.id === id);
      return {
        id,
        title: aiBranch?.title
          || archNode?.title.trim()
          || archConst?.displayTitle
          || archConst?.title
          || dynConst?.title
          || resolveNodeMeta(id)?.title
          || "Untitled Branch",
        role: (i === arr.length - 1 ? "current" : "step") as "step" | "current",
      };
    });
    return [
      {
        id: "__world-seed__",
        title: worldSeed,
        subtitle: originJourneySubtitle(worldSeed),
        role: "origin" as const,
      },
      ...steps,
    ];
  }, [navState, worldSeed, aiBranches, dynamicConstellations, architectureCanvasModel]);

  const potentialConsequences = useMemo(() => {
    if (!selectedNodeId) return [];
    return (ACCEPT_CONSEQUENCES[selectedNodeId] ?? []).map((c) => c.title);
  }, [selectedNodeId]);

  const handleCanonNodeSelect = useCallback((nodeId: string) => {
    const item = resolvePanelItem(nodeId);
    if (item) setSelectedItem(item);
  }, []);

  /** Auto-generate initial branches for a dynamic constellation root node. */
  const autoGenerateForConstellation = useCallback(
    async (constellation: DynamicConstellation) => {
      if (initializedConstellationIds.has(constellation.id)) return;
      setInitializedConstellationIds((prev) => new Set([...prev, constellation.id]));
      setConstellationAutoLoading(true);

      // Build a rich direction string so the AI generates world-specific starter branches
      const starterDirection = [
        `You are the ${constellation.agentName}.`,
        `World: ${worldSeed}`,
        `Your lens: ${constellation.purpose}`,
        `Generate 4-5 specific, vivid starter branches for exploring this world through the ${constellation.title} perspective.`,
        `Each branch must feel native to the world described in the seed.`,
        `Do NOT produce generic or horror-themed content unless the seed specifically asks for it.`,
        constellation.focusQuestions.length > 0
          ? `Use these focus questions as inspiration: ${constellation.focusQuestions.join(" | ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const input: AgentAdaptInput = {
        worldSeed,
        currentNode: {
          id: constellation.id,
          title: constellation.title,
          description: constellation.description,
          whyItMatters: constellation.purpose,
          domain: constellation.agentName,
        },
        activeDomain: constellation.agentName,
        creatorDirection: starterDirection,
        canonThreads,
        worldTensions,
        currentPath: [worldSeed, constellation.title],
        existingFutureNodes: [],
        existingSiblingNodes: [],
        rejectedIdeas: [],
        establishedTruths: acceptedIds.map((aid) => getDisplayTitle(aid)),
      };

      try {
        const res = await fetch("/api/agents/adapt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error("API error");
        const data = (await res.json()) as AgentAdaptOutput;

        const nowMs = Date.now();
        const newBranches: AiGeneratedBranch[] = (data.adaptations?.add ?? [])
          .filter((b) => b?.title && String(b.title).trim())
          .map((b, i) => ({
            ...b,
            title: String(b.title).trim(),
            id: `ai-${constellation.id}-${nowMs}-${i}`,
            parentId: constellation.id,
            generated: true as const,
          }));

        if (newBranches.length > 0) {
          setAiBranches((prev) => ({
            ...prev,
            [constellation.id]: [...(prev[constellation.id] ?? []), ...newBranches],
          }));
          // Track which constellation each branch belongs to
          setNodeConstellationMap((prev) => {
            const next = { ...prev };
            for (const b of newBranches) next[b.id] = constellation.id;
            return next;
          });
          setJustEmergedIds(new Set(newBranches.map((b) => b.id)));
          window.setTimeout(() => setJustEmergedIds(new Set()), EMERGE_GLOW_MS);
        }

        if (data.selectedAgents?.length > 0) {
          setActiveSpecialists(data.selectedAgents);
        }
        if (data.agentInsights?.length > 0) {
          setAgentInsights(data.agentInsights);
        }
      } catch {
        // Silently fail — the user can still click Apply & Generate Paths manually
      } finally {
        setConstellationAutoLoading(false);
      }
    },
    [
      initializedConstellationIds,
      worldSeed,
      canonThreads,
      worldTensions,
      acceptedIds,
    ],
  );

  /** Enter exploration mode for a dynamic constellation. */
  const handleDynamicConstellationEnter = useCallback(
    (constellation: DynamicConstellation) => {
      setNavState({
        mode: "discovery",
        discoveryId: constellation.id,
        regionId: constellation.id,
        discoveryTitle: constellation.title,
        trail: [constellation.id],
      });

        const aiDiscovery: AiDiscovery = {
        id: constellation.id,
        title: constellation.title,
        description: constellation.description,
        category: constellation.agentName,
        whyItMatters: constellation.purpose,
        sourceAgent: constellation.agentName,
        generated: true,
      };
      setSelectedItem({ kind: "ai-discovery", discovery: aiDiscovery });

      // Auto-generate initial branches if not done yet
      void autoGenerateForConstellation(constellation);
    },
    [autoGenerateForConstellation],
  );

  const handleApplyAndGenerate = useCallback(
    async (direction: string) => {
      if (!selectedItem || !selectedNodeId) return;

      const id = selectedNodeId;
      setCreatorDirections((prev) => ({ ...prev, [id]: direction }));

      const title =
        selectedItem.kind === "discovery" || selectedItem.kind === "ai-discovery"
          ? selectedItem.discovery.title
          : selectedItem.consequence.title;
      const description =
        selectedItem.kind === "discovery" || selectedItem.kind === "ai-discovery"
          ? selectedItem.discovery.description
          : selectedItem.consequence.description;
      const whyItMatters =
        selectedItem.kind === "discovery" || selectedItem.kind === "ai-discovery"
          ? (selectedItem.discovery.whyItMatters ?? "")
          : (selectedItem.consequence.whyItMatters ?? "");

      // Prefer dynamic constellation agentName as the domain; fall back to regionId
      const activeConstellation =
        navState.mode === "discovery" || navState.mode === "constellation"
          ? dynamicConstellations.find((c) => c.id === navState.regionId)
          : undefined;
      const activeArchitectureConstellation =
        navState.mode === "discovery" || navState.mode === "constellation"
          ? architectureCanvasModel?.constellations.find((c) => c.id === navState.regionId)
          : undefined;
      const activeDomain = activeConstellation?.agentName
        ?? (activeArchitectureConstellation && architectureCanvasModel
          ? getAgentNameForConstellation(architectureCanvasModel, activeArchitectureConstellation)
          : (navState.mode === "discovery" || navState.mode === "constellation"
            ? navState.regionId
            : ""));

      // Build the existing future node list for adaptation analysis
      const existingFutureNodes: ExistingNodeInfo[] = [
        ...getChildren(id)
          .filter((cid) => !hiddenIds.has(cid) && decisions[cid] !== "rejected")
          .map((cid) => {
            const meta = resolveNodeMeta(cid);
            return {
              id: cid,
              title: nodeOverrides[cid]?.title ?? meta?.title ?? cid,
              description: nodeOverrides[cid]?.description ?? "",
              domain: activeDomain,
              generated: false,
            };
          }),
        ...(aiBranches[id] ?? [])
          .filter((b) => !hiddenIds.has(b.id) && decisions[b.id] !== "rejected")
          .map((b) => ({
            id: b.id,
            title: nodeOverrides[b.id]?.title ?? b.title,
            description: nodeOverrides[b.id]?.description ?? b.description,
            domain: b.domain,
            generated: true,
          })),
      ];

      const rejectedTitles = Object.entries(decisions)
        .filter(([, d]) => d === "rejected")
        .map(([rid]) => getDisplayTitle(rid));

      const establishedTitles = acceptedIds.map((aid) => getDisplayTitle(aid));

      // If inside a dynamic constellation, include its focus questions as extra context
      const constellationContext = activeArchitectureConstellation && architectureCanvasModel
        ? `\n\nAgent lens: ${getAgentNameForConstellation(architectureCanvasModel, activeArchitectureConstellation)}\nFocus: ${activeArchitectureConstellation.description}\nKey questions: ${activeArchitectureConstellation.question}`
        : activeConstellation
        ? `\n\nAgent lens: ${activeConstellation.agentName}\nFocus: ${activeConstellation.purpose}\nKey questions: ${activeConstellation.focusQuestions.join("; ")}`
        : "";

      const input: AgentAdaptInput = {
        worldSeed,
        currentNode: { id, title, description, whyItMatters, domain: activeDomain },
        activeDomain,
        creatorDirection: direction + constellationContext,
        canonThreads,
        worldTensions,
        currentPath: journeySteps.map((s) => s.title),
        existingFutureNodes,
        existingSiblingNodes: [],
        rejectedIdeas: rejectedTitles,
        establishedTruths: establishedTitles,
      };

      setExploreLoading(true);
      setExploreError(null);
      setAdaptSummary(null);

      try {
        const res = await fetch("/api/agents/adapt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!res.ok) throw new Error("API error");

        const data = (await res.json()) as AgentAdaptOutput;

        setActiveSpecialists(data.selectedAgents ?? []);
        setAgentInsights(data.agentInsights ?? []);
        setExploreFallback(data.usedFallback ?? false);

        // ── Apply adaptations ──────────────────────────────────────────────

        const existingTitleSet = new Set(
          existingFutureNodes.map((n) => n.title.toLowerCase()),
        );

        // ADD new branches
        const newBranches: AiGeneratedBranch[] = (data.adaptations?.add ?? [])
          .filter((b) => b?.title && !existingTitleSet.has(b.title.toLowerCase()))
          .map((b, i) => ({
            ...b,
            id: `ai-${id}-${Date.now()}-${i}`,
            parentId: id,
            generated: true as const,
          }));

        if (newBranches.length > 0) {
          setAiBranches((prev) => ({
            ...prev,
            [id]: [...(prev[id] ?? []), ...newBranches],
          }));
          // Track dynamic constellation membership for canon grouping
          if (activeConstellation || activeArchitectureConstellation) {
            setNodeConstellationMap((prev) => {
              const next = { ...prev };
              const constelId = activeConstellation?.id ?? activeArchitectureConstellation?.id;
              if (constelId) {
                for (const b of newBranches) next[b.id] = constelId;
              }
              return next;
            });
          }
          setJustEmergedIds(new Set(newBranches.map((b) => b.id)));
          window.setTimeout(() => setJustEmergedIds(new Set()), EMERGE_GLOW_MS);
        }

        // MODIFY existing nodes
        if ((data.adaptations?.modify ?? []).length > 0) {
          setAiBranches((prev) => {
            const next = { ...prev };
            for (const [parentId, branches] of Object.entries(next)) {
              next[parentId] = branches.map((b) => {
                const mod = data.adaptations.modify.find((m) => m.targetId === b.id);
                if (!mod) return b;
                return {
                  ...b,
                  title: mod.newTitle || b.title,
                  description: mod.newDescription || b.description,
                  whyItMatters: mod.newWhyItMatters || b.whyItMatters,
                };
              });
            }
            return next;
          });
          // For hardcoded nodes, store overrides
          for (const mod of data.adaptations.modify) {
            const isAiNode = Object.values(aiBranches).flat().some((b) => b.id === mod.targetId);
            if (!isAiNode && mod.newTitle) {
              setNodeOverrides((prev) => ({
                ...prev,
                [mod.targetId]: {
                  title: mod.newTitle,
                  description: mod.newDescription,
                  whyItMatters: mod.newWhyItMatters,
                },
              }));
            }
          }
        }

        // REPLACE: hide original (if not accepted), add replacement
        const replacedInfo: { from: string; to: string }[] = [];
        for (const rep of data.adaptations?.replace ?? []) {
          if (acceptedIds.includes(rep.targetId)) continue; // canon protected
          setHiddenIds((prev) => new Set([...prev, rep.targetId]));
          const fromTitle = existingFutureNodes.find((n) => n.id === rep.targetId)?.title ?? rep.targetId;
          const replacement: AiGeneratedBranch = {
            ...rep.replacement,
            id: `ai-rep-${rep.targetId}-${Date.now()}`,
            parentId: id,
            generated: true as const,
          };
          setAiBranches((prev) => ({
            ...prev,
            [id]: [...(prev[id] ?? []), replacement],
          }));
          replacedInfo.push({ from: fromTitle, to: rep.replacement.title });
        }

        // WEAKEN: visual dimming
        const newWeak = (data.adaptations?.weaken ?? [])
          .filter((w) => !acceptedIds.includes(w.targetId))
          .map((w) => w.targetId);
        if (newWeak.length > 0) {
          setWeakenedIds((prev) => new Set([...prev, ...newWeak]));
        }

        // REMOVE: hide (not if accepted)
        for (const rem of data.adaptations?.remove ?? []) {
          if (!acceptedIds.includes(rem.targetId)) {
            setHiddenIds((prev) => new Set([...prev, rem.targetId]));
          }
        }

        // Build World Shift summary for modal
        const weakenedSummary = (data.adaptations?.weaken ?? [])
          .filter((w) => !acceptedIds.includes(w.targetId))
          .map((w) => ({
            title: existingFutureNodes.find((n) => n.id === w.targetId)?.title ?? w.targetId,
            reason: w.reason,
          }));

        const modifiedSummary = (data.adaptations?.modify ?? []).map((m) => ({
          from: existingFutureNodes.find((n) => n.id === m.targetId)?.title ?? m.targetId,
          to: m.newTitle,
        }));

        const removedSummary = (data.adaptations?.remove ?? [])
          .filter((r) => !acceptedIds.includes(r.targetId))
          .map((r) => existingFutureNodes.find((n) => n.id === r.targetId)?.title ?? r.targetId);

        setAdaptSummary({
          added: newBranches.map((b) => b.title),
          modified: modifiedSummary,
          replaced: replacedInfo,
          weakened: weakenedSummary,
          removed: removedSummary,
          specialists: (data.selectedAgents ?? []).map((a) => a.name),
          worldShiftSummary: data.worldShiftSummary ?? "",
          usedFallback: data.usedFallback ?? false,
        });
      } catch {
        setExploreError(
          "Agents could not generate new paths. Prototype suggestions are still available.",
        );
      } finally {
        setExploreLoading(false);
      }
    },
    [
      selectedItem,
      selectedNodeId,
      worldSeed,
      navState,
      canonThreads,
      worldTensions,
      journeySteps,
      decisions,
      aiBranches,
      hiddenIds,
      acceptedIds,
      nodeOverrides,
      dynamicConstellations,
      architectureCanvasModel,
      getDisplayTitle,
    ],
  );

  const agentSelectContext = useMemo(() => {
    if (!selectedItem) {
      return {
        worldSeed,
        currentNode: { title: "", description: "" },
        activeDomain: "",
        creatorDirection: "",
        canonThreads,
        worldTensions,
        currentPath: [] as string[],
      };
    }

    const currentPath =
      navState.mode === "discovery"
        ? journeySteps.map((s) => s.title)
        : selectedNodeId
          ? [worldSeed, getDisplayTitle(selectedNodeId)]
          : [worldSeed];

    return buildAgentSelectInput({
      worldSeed,
      item: selectedItem,
      navState,
      nodeId: selectedNodeId,
      creatorDirection: selectedNodeId
        ? (creatorDirections[selectedNodeId] ?? null)
        : null,
      canonThreads,
      worldTensions,
      currentPath,
    });
  }, [
    selectedItem,
    worldSeed,
    navState,
    selectedNodeId,
    creatorDirections,
    canonThreads,
    worldTensions,
    journeySteps,
  ]);

  const agentSelectContextKey = useMemo(
    () => JSON.stringify(agentSelectContext),
    [agentSelectContext],
  );

  return (
    <div className="relative h-screen w-screen bg-[#0a0a0f]">
      <WorldSidebar
        navState={navState}
        onNavigate={handleNavigate}
        acceptedCount={acceptedIds.length}
        creatorTruths={creatorTruths}
        dynamicConstellations={dynamicConstellations}
      />
      {!(showOverviewOverlay) && (
        <Breadcrumb navState={navState} onNavigate={handleNavigate} />
      )}
      <WorldPulse shift={latestShift} nonce={pulseNonce} />
      {!(showOverviewOverlay) && (
        <WorldWhisper onSubmit={handleAddTruth} panelInset={panelInset} />
      )}
      {navState.mode === "discovery" &&
        architectureCanvasModel &&
        isReasoningConstellation &&
        reasoningConstellationId === navState.regionId && (
          <div
            className="pointer-events-none absolute z-20 flex justify-center"
            style={{ left: `${SIDEBAR_WIDTH_PX}px`, right: canvasRightInset, top: "78px" }}
          >
            <span className="rounded-full border border-violet-500/40 bg-violet-950/60 px-4 py-1.5 text-[11px] text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
              Reasoning inside {navState.discoveryTitle}…
            </span>
          </div>
        )}
      {navState.mode === "discovery" &&
        architectureCanvasModel &&
        navState.regionId &&
        constellationReasonerHints[navState.regionId] &&
        !isReasoningConstellation && (
          <div
            className="pointer-events-none absolute z-20 flex justify-center"
            style={{ left: `${SIDEBAR_WIDTH_PX}px`, right: canvasRightInset, top: "78px" }}
          >
            <span className="rounded-full border border-slate-600/40 bg-slate-950/60 px-4 py-1.5 text-[11px] text-slate-300/90">
              {constellationReasonerHints[navState.regionId]}
            </span>
          </div>
        )}
      {navState.mode === "discovery" &&
        architectureCanvasModel &&
        isReasoningNode &&
        reasoningNodeId && (
          <div
            className="pointer-events-none absolute z-20 flex justify-center"
            style={{ left: `${SIDEBAR_WIDTH_PX}px`, right: canvasRightInset, top: "78px" }}
          >
            <span className="rounded-full border border-sky-500/40 bg-sky-950/60 px-4 py-1.5 text-[11px] text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
              Exploring continuations…
            </span>
          </div>
        )}
      {navState.mode === "canon" && (
        <>
          <CanonUniverseOverlay
            profile={canonProfile}
            structure={canonStructure}
            evolutionNarratives={evolutionNarratives}
            hasTruths={acceptedIds.length > 0}
            onBuildWorld={() => setSynthesisOpen(true)}
            onSelectNode={handleCanonNodeSelect}
          />
          <CanonThreadsPanel
            threads={canonThreads}
            onSelectNode={handleCanonNodeSelect}
          />
        </>
      )}
      <WorldSynthesisModal
        open={synthesisOpen}
        onClose={() => setSynthesisOpen(false)}
        worldSeed={worldSeed}
        profile={canonProfile}
        acceptedIds={acceptedIds}
        potentialFutures={dynamicFutures}
      />
      {rippleModal && (
        <RippleModal
          result={rippleModal}
          onClose={() => setRippleModal(null)}
        />
      )}
      {pendingEvolution && (
        <EvolutionEventModal
          event={pendingEvolution}
          onClose={handleEvolutionClose}
        />
      )}
      {navState.mode !== "canon" && (
      <ZoomControlsBar
        zoomPct={zoomPct}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleZoomReset}
        panelInset={panelInset}
      />
      )}
      {architectureCanvasModel && (
        <button
          type="button"
          onClick={() => setArchDebugOpen((v) => !v)}
          className="absolute bottom-4 z-20 rounded border border-slate-800/60 bg-slate-950/75 px-2 py-0.5 text-[8px] uppercase tracking-[0.12em] text-slate-700 opacity-60 transition hover:opacity-100 hover:text-slate-500"
          style={{ left: "184px" }}
        >
          {archDebugOpen ? "Hide debug" : "Debug"}
        </button>
      )}
      {process.env.NODE_ENV === "development" && (
        <button
          type="button"
          onClick={showMockRipplePreview}
          className="absolute bottom-4 z-20 rounded border border-slate-800/60 bg-slate-950/75 px-2 py-0.5 text-[8px] uppercase tracking-[0.12em] text-slate-700 opacity-60 transition hover:opacity-100 hover:text-slate-500"
          style={{ left: architectureCanvasModel ? "248px" : "184px" }}
        >
          Mock ripple
        </button>
      )}
      {architectureCanvasModel && archDebugOpen && (
        <div
          className="absolute bottom-12 z-20 max-h-[42vh] overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/95 p-4 shadow-xl"
          style={{ left: "184px", right: panelInset > 0 ? `${panelInset + 16}px` : "16px" }}
        >
          <div className="mb-3 rounded border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-[10px] text-slate-400">
            <p>
              Decision events: {decisionEventDebug.totalEvents}
              {decisionEventLog.events.length > 0 && (
                <>
                  {" "}
                  · latest{" "}
                  {decisionEventLog.events[decisionEventLog.events.length - 1]?.eventType}{" "}
                  —{" "}
                  {
                    decisionEventLog.events[decisionEventLog.events.length - 1]?.target
                      .displayTitle
                  }
                </>
              )}
            </p>
          </div>
          <ArchitecturePreview model={architectureCanvasModel} embedded />
        </div>
      )}
      {navState.mode === "overview" && !architectureCanvasModel && dynamicConstellations.length > 0 && (
        <div className="absolute inset-y-0 right-0" style={{ left: "176px" }}>
          <DynamicWorldOverview
            constellations={dynamicConstellations}
            worldInterpretation={worldInterpretation}
            worldSeed={worldSeed}
            usedFallback={usedFallback}
            fallbackReason={fallbackReason}
            isGenerating={false}
            onSelectConstellation={handleDynamicConstellationEnter}
          />
        </div>
      )}

      {navState.mode !== "canon" && !showOverviewOverlay && (
      <div
        className="absolute inset-y-0 right-0"
        style={{ left: "176px" }}
      >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          rfInstance.current = instance;
          setZoomPct(Math.round(instance.getZoom() * 100));
        }}
        onViewportChange={handleViewportChange}
        fitView
        fitViewOptions={{ padding: 0.28, includeHiddenNodes: false }}
        minZoom={0.5}
        maxZoom={2}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0a0f]"
      >
        <GraphMinimap
          nodes={nodes}
          panelInset={panelInset}
        />
      </ReactFlow>
      </div>
      )}
      {navState.mode === "canon" && (
        <div
          className="absolute inset-y-0 right-0 bg-[#0a0a0f]"
          style={{ left: "176px" }}
        />
      )}
      {selectedItem && (
        <DiscoveryPanel
          key={selectedNodeId ?? "panel"}
          item={selectedItem}
          decision={selectedDecision}
          directions={panelDirections}
          activeTrail={activeTrail}
          onNavigateDirection={navigateTrail}
          onAction={handleAction}
          onClose={() => setSelectedItem(null)}
          creatorDirection={selectedNodeId ? (creatorDirections[selectedNodeId] ?? null) : null}
          onSetDirection={handleSetDirection}
          onApplyAndGenerate={handleApplyAndGenerate}
          agentVoice={agentVoice}
          agentReasoning={agentReasoning}
          journeySteps={journeySteps}
          potentialConsequences={potentialConsequences}
          agentSelectContext={agentSelectContext}
          agentSelectContextKey={agentSelectContextKey}
          activeSpecialists={activeSpecialists}
          agentInsights={agentInsights}
          exploreLoading={exploreLoading || constellationAutoLoading}
          exploreFallback={exploreFallback}
          exploreError={exploreError}
          showExploreDeeper={canExploreDeeperNode}
          onExploreDeeper={() => void handleExploreDeeper()}
          nodeReasonerLoading={isReasoningNode && reasoningNodeId === selectedNodeId}
          nodeReasonerError={nodeReasonerError}
          hasNodeReasonerCache={hasNodeReasonerCache}
          panelWidth={detailPanelWidth}
          worldSeed={worldSeed}
        />
      )}

      {(rippleConsequenceCardOpen && worldChangeCardModel) ||
      (ripplePreview && (ripplePreviewPanelOpen || evolutionPreviewPanelOpen)) ||
      (ripplePreviewError && !rippleConsequenceCardOpen) ? (
        <div
          className="pointer-events-none fixed inset-0 z-[70]"
          aria-live="polite"
        >
          <div
            className="pointer-events-auto absolute flex max-h-[calc(100vh-96px)] flex-col gap-2 overflow-y-auto"
            style={{
              top: "78px",
              right: panelInset > 0 ? `${panelInset + 12}px` : "12px",
              width: "min(360px, calc(100vw - 200px))",
            }}
          >
            {ripplePreviewError && !rippleConsequenceCardOpen && (
              <div className="flex shrink-0 items-start justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-950/95 px-3 py-2 text-xs text-slate-300 shadow-lg">
                <span>{ripplePreviewError}</span>
                <button
                  type="button"
                  onClick={() => setRipplePreviewError(null)}
                  className="shrink-0 text-slate-400/70 transition hover:text-slate-200"
                  aria-label="Dismiss ripple preview error"
                >
                  ×
                </button>
              </div>
            )}
            {rippleConsequenceCardOpen && worldChangeCardModel && (
                <WorldChangeCard
                  model={worldChangeCardModel}
                  onAccept={handleAcceptWorldChange}
                  onDecline={handleDeclineWorldChange}
                  onAdvancedDetails={handleWorldChangeAdvancedDetails}
                  isApplying={isApplyingWorldChange}
                  statusMessage={worldChangeStatusMessage}
                  onClose={
                    worldChangeCardPhase === "pending" ? undefined : handleDeclineWorldChange
                  }
                />
              )}
            {ripplePreview &&
              !rippleConsequenceCardOpen &&
              !ripplePreviewPanelOpen &&
              !evolutionPreviewPanelOpen &&
              !isGeneratingRipplePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setRippleConsequenceCardOpen(true);
                    setWorldChangeStatusMessage(null);
                  }}
                  className="shrink-0 rounded-lg border border-violet-800/45 bg-violet-950/40 px-3 py-2 text-left text-xs text-violet-200/90 shadow-lg transition hover:border-violet-600/50 hover:bg-violet-950/55"
                >
                  <span className="font-medium">World changes pending</span>
                  <span className="mt-0.5 block text-[10px] text-violet-300/60">
                    Tap to review how this choice affects your world
                  </span>
                </button>
              )}
            {ripplePreview && ripplePreviewPanelOpen && (
              <>
                {rippleReviewMessage && (
                  <div className="shrink-0 rounded-lg border border-amber-900/35 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90 shadow-lg">
                    {rippleReviewMessage}
                  </div>
                )}
              <RipplePreviewPanel
                preview={ripplePreview}
                onClose={() => setRipplePreviewPanelOpen(false)}
                onApproveOperation={(operationId) => {
                  setRipplePreview((prev) => {
                    if (!prev) return null;
                    return updateRippleOperationApproval(prev, operationId, "approved");
                  });
                  setPendingEvolutionOpen(true);
                }}
                onRejectOperation={(operationId) => {
                  setRipplePreview((prev) =>
                    prev
                      ? updateRippleOperationApproval(prev, operationId, "rejected")
                      : null,
                  );
                }}
                onRequestClarification={(operationId) => {
                  setRipplePreview((prev) =>
                    prev
                      ? updateRippleOperationApproval(
                          prev,
                          operationId,
                          "needs_clarification",
                        )
                      : null,
                  );
                  if (process.env.NODE_ENV === "development") {
                    console.debug(
                      "[ripple-preview] clarification requested",
                      operationId,
                      latestRippleTriggerEventId,
                    );
                  }
                }}
              />
              </>
            )}
            {worldEvolutionPreview?.canShowPreview &&
              evolutionPreviewPanelOpen &&
              ripplePreview &&
              canOpenWorldEvolutionPreview(ripplePreview) &&
              !isGeneratingRipplePreview && (
                <WorldEvolutionPreviewPanel
                  preview={worldEvolutionPreview}
                  applyDryRun={worldEvolutionApplyDryRun}
                  dryRunTitleLookup={{
                    nodeTitleById: rippleTitleMaps.nodeTitleById,
                    constellationTitleById: rippleTitleMaps.constellationTitleById,
                  }}
                  onClose={() => setEvolutionPreviewPanelOpen(false)}
                  onConfirmApply={handleConfirmWorldEvolutionApply}
                  isApplying={isApplyingWorldEvolution}
                  applyError={worldEvolutionApplyError}
                  applyNotice={
                    lastWorldEvolutionApplyResult?.status === "applied"
                      ? lastWorldEvolutionApplyResult.summary
                      : null
                  }
                  onUndoLastApply={handleUndoLastWorldEvolutionApply}
                  canUndoLastApply={canUndoLastWorldEvolutionApply}
                  undoNotice={worldEvolutionUndoNotice}
                  undoError={worldEvolutionUndoError}
                />
              )}
          </div>
        </div>
      ) : null}

      {/* World Shift modal — shown after adaptation */}
      {adaptSummary && (
        <WorldShiftModal
          summary={adaptSummary}
          hasPanel={Boolean(selectedItem)}
          onDismiss={() => setAdaptSummary(null)}
        />
      )}
    </div>
  );
}

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
import TrailNode, { type TrailNodeData } from "@/components/TrailNode";
import GraphMinimap from "@/components/GraphMinimap";
import ZoomControlsBar from "@/components/ZoomControlsBar";
import CanonUniverseOverlay from "@/components/CanonUniverseOverlay";
import CanonThreadsPanel from "@/components/CanonThreadsPanel";
import WorldSynthesisModal from "@/components/WorldSynthesisModal";
import EvolutionEventModal from "@/components/EvolutionEventModal";
import RippleModal from "@/components/RippleModal";
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
  summarizeDecisionEventLog,
} from "@/lib/worldBrain/decisionEventLog";
import type { DecisionEventLog } from "@/lib/worldBrain/userDecisionTypes";
import type { NodeReasonerOutput } from "@/lib/worldBrain/nodeReasonerTypes";
import type { ConstellationReasonerOutput } from "@/lib/worldBrain/constellationReasonerTypes";
import { getAgentReasoning } from "@/lib/agentReasoning";
import { resolveNodeMeta, resolvePanelItem } from "@/lib/worldNodes";
import {
  computeFutureYPositions,
  computeOrbitalPositions,
  CONSTELLATION_ORBIT_CENTER,
  labelPriority,
  layoutChildNodesAroundParent,
  resolveLabelOffsets,
  fitLayoutToBounds,
  DISCOVERY_LAYOUT_BOUNDS,
  applyPositionMapToNodes,
} from "@/lib/graphLayout";
import { getConstellationTheme, themeChildEdgeStroke } from "@/lib/constellationTheme";
import { normalizeCanvasDisplayTitle } from "@/lib/normalizeDisplayTitle";
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

// Trail (discovery-mode) layout — PAST ← CURRENT → FUTURE
const PAST_STEP_X = 165;
const FUTURE_X = 185;
const FUTURE_ROW_H = 72;

const CONSEQUENCE_EDGE_STYLE = {
  stroke: "rgba(45, 212, 191, 0.55)",
  strokeWidth: 1.5,
  strokeDasharray: "4 3",
} as const;

const TRAIL_EDGE_STYLE = {
  stroke: "rgba(167, 139, 250, 0.6)",
  strokeWidth: 2,
} as const;

const FUTURE_EDGE_STYLE = {
  stroke: "rgba(148, 163, 184, 0.35)",
  strokeWidth: 1,
  strokeDasharray: "5 4",
} as const;

const PAST_EDGE_STYLE = {
  stroke: "rgba(100, 116, 139, 0.35)",
  strokeWidth: 1.5,
} as const;

const nodeTypes = {
  constellationRegion: ConstellationRegionNode,
  discovery: DiscoveryNode,
  consequence: ConsequenceNode,
  trailNode: TrailNode,
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

function canvasNodeLabel(title: string): string {
  return normalizeCanvasDisplayTitle(title);
}

export default function ConstellationCanvas({
  worldSeed,
  worldPurpose = null,
  dynamicConstellations = [],
  worldInterpretation = null,
  usedFallback = false,
  fallbackReason,
  architectureCanvasModel = null,
}: ConstellationCanvasProps) {
  const [navState, setNavState] = useState<NavState>({ mode: "overview" });
  const [selectedItem, setSelectedItem] = useState<PanelItem | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [justRevealedId, setJustRevealedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DiscoveryDecision>>(
    {},
  );
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
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
  const [constellationReasonerErrors, setConstellationReasonerErrors] = useState<
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
      setConstellationReasonerErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      try {
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

        const data = (await res.json()) as {
          success?: boolean;
          output?: ConstellationReasonerOutput;
          error?: string;
        };

        if (reasonerRequestGenRef.current[id] !== nextGen) return;

        if (!data.success || !data.output) {
          setConstellationReasonerErrors((prev) => ({
            ...prev,
            [id]: "Could not deepen this constellation yet. Showing initial nodes.",
          }));
          return;
        }

        setReasonedConstellations((prev) => ({ ...prev, [id]: data.output! }));
        applyReasonedOutput(id, data.output);
      } catch {
        if (reasonerRequestGenRef.current[id] === nextGen) {
          setConstellationReasonerErrors((prev) => ({
            ...prev,
            [id]: "Could not deepen this constellation yet. Showing initial nodes.",
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

  const panelInset = selectedItem ? 320 : 0;

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

    try {
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

      const data = (await res.json()) as {
        success?: boolean;
        output?: NodeReasonerOutput;
        error?: string;
      };

      if (nodeReasonerRequestGenRef.current[parentId] !== nextGen) return;

      if (!data.success || !data.output) {
        setNodeReasonerError("Could not deepen this node yet.");
        return;
      }

      setNodeReasonerOutputsByParentId((prev) => ({
        ...prev,
        [parentId]: data.output!,
      }));
      applyNodeReasonerOutput(parentId, data.output, constellationId);
    } catch {
      if (nodeReasonerRequestGenRef.current[parentId] === nextGen) {
        setNodeReasonerError("Could not deepen this node yet.");
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

    const allFlatBranches = Object.values(aiBranches).flat();
    const allNrBranches = Object.values(nodeReasonerBranchesByParentId).flat();

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
      const x = isFocused
        ? isConstellationRootView
          ? orbitCenter.x
          : 0
        : (i - pastCount) * PAST_STEP_X +
          (isConstellationRootView ? orbitCenter.x : 0);
      const y = isFocused && isConstellationRootView ? orbitCenter.y : 0;

      nodes.push({
        id,
        type: "trailNode",
        position: { x, y },
        data: {
          title: canvasNodeLabel(meta?.title || "Untitled Branch"),
          category: meta?.category,
          role: isFocused ? "focused" : "path",
          decision: decisions[id] ?? "pending",
          justAccepted: id === justAcceptedId,
          hasCreatorDirection: Boolean(creatorDirections[id]),
          journeyPhase: isFocused ? "current" : "past",
          accentColor,
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

    const orbitalPositions = isConstellationRootView
      ? computeOrbitalPositions(futureIds.length, {
          centerX: orbitCenter.x,
          centerY: orbitCenter.y,
          phaseSeed: focusedId,
        })
      : null;
    const yPositions = computeFutureYPositions(futureIds.length, FUTURE_ROW_H);

    futureIds.forEach((item, j) => {
      const { id, kind, ai, branch: aiBranch } = item;
      const position = orbitalPositions
        ? (orbitalPositions[j] ?? { x: FUTURE_X, y: 0 })
        : { x: FUTURE_X, y: yPositions[j] ?? 0 };
      const meta = resolveNodeMeta(id);

      nodes.push({
        id,
        type: "trailNode",
        position,
        data: {
          title: canvasNodeLabel(
            aiBranch
              ? (nodeOverrides[aiBranch.id]?.title ?? (aiBranch.title || "Untitled Branch"))
              : (nodeOverrides[id]?.title ?? meta?.title ?? "Untitled Branch"),
          ),
          category: aiBranch
            ? `✦ ${aiBranch.sourceAgent ?? "Agent-shaped"}`
            : (meta?.category ?? (kind === "consequence" ? "Consequence" : undefined)),
          role: kind,
          decision: decisions[id] ?? "pending",
          justEmerged: justEmergedIds.has(id),
          hasCreatorDirection: Boolean(creatorDirections[id]),
          journeyPhase: "future",
          aiGenerated: ai,
          weakened: weakenedIds.has(id),
          nodeModified: Boolean(nodeOverrides[id]),
          accentColor,
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: 5,
      });

      edges.push({
        id: `future-${focusedId}-${id}`,
        source: focusedId,
        target: id,
        animated: kind === "consequence" || ai,
        style: ai
          ? themedAiEdge
          : kind === "consequence"
            ? CONSEQUENCE_EDGE_STYLE
            : themedFutureEdge,
      });
    });

    const nrFutures = (nodeReasonerBranchesByParentId[focusedId] ?? []).filter(
      (b) =>
        !hiddenIds.has(b.id) &&
        decisions[b.id] !== "rejected" &&
        !trail.includes(b.id),
    );

    nrFutures.forEach((branch) => {
      const position = nodeReasonerChildPositions[branch.id] ?? {
        x: FUTURE_X,
        y: 0,
      };
      const meta = nodeReasonerPanelMeta[branch.id];

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
          ),
          category: `✦ ${branch.sourceAgent ?? "Node Reasoner"}`,
          role: "direction",
          decision: decisions[branch.id] ?? "pending",
          justEmerged: justEmergedIds.has(branch.id),
          hasCreatorDirection: Boolean(creatorDirections[branch.id]),
          journeyPhase: "future",
          aiGenerated: true,
          weakened: weakenedIds.has(branch.id),
          nodeModified: Boolean(nodeOverrides[branch.id]),
          accentColor,
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: 5,
      });

      edges.push({
        id: `nr-future-${focusedId}-${branch.id}`,
        source: focusedId,
        target: branch.id,
        animated: true,
        style: themedNrEdge,
      });
    });

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
  }, [navState, decisions, hiddenIds, justAcceptedId, creatorDirections, justEmergedIds, aiBranches, weakenedIds, nodeOverrides, dynamicConstellations, architectureCanvasModel, nodeReasonerBranchesByParentId, nodeReasonerChildPositions, nodeReasonerPanelMeta, selectedItem]);

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
              ? normalizeCanvasDisplayTitle(archConst.displayTitle)
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
      );
      setConstellationReasonerErrors((prev) => {
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
    (id: string) => resolveNodeMetaExt(id)?.title ?? "Untitled Branch",
    [resolveNodeMetaExt],
  );

  const appendUserDecisionEventForAction = useCallback(
    (action: Exclude<DiscoveryAction, "unaccept">, nodeId: string) => {
      if (!selectedItem) return;

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

        setDecisionEventLog((prev) => appendDecisionEvent(prev, event));
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[decision-event] logging failed", err);
        }
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

      appendUserDecisionEventForAction(
        action as Exclude<DiscoveryAction, "unaccept">,
        id,
      );

      setDecisions((prev) => ({ ...prev, [id]: decision }));

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
    [selectedItem, acceptedIds, navState, triggeredEvolutionIds, appendUserDecisionEventForAction, getDisplayTitle, weakenedIds],
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
      {navState.mode === "discovery" && (
        <div
          className="pointer-events-none absolute z-10 flex items-center justify-center gap-0"
          style={{ left: "176px", right: "320px", top: "44px" }}
        >
          <div className="flex flex-1 justify-center">
            <span className="rounded-full border border-slate-600/50 bg-slate-900/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 shadow-[0_0_10px_rgba(100,116,139,0.1)]">
              Past
            </span>
          </div>
          <div className="flex flex-1 justify-center">
            <span className="rounded-full border border-violet-500/50 bg-violet-950/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200 shadow-[0_0_24px_rgba(167,139,250,0.25)]">
              Current
            </span>
          </div>
          <div className="flex flex-1 justify-center">
            <span className="rounded-full border border-slate-500/50 bg-slate-800/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200 shadow-[0_0_16px_rgba(148,163,184,0.15)]">
              Future
            </span>
          </div>
        </div>
      )}
      {navState.mode === "discovery" &&
        architectureCanvasModel &&
        isReasoningConstellation &&
        reasoningConstellationId === navState.regionId && (
          <div
            className="pointer-events-none absolute z-20 flex justify-center"
            style={{ left: "176px", right: "320px", top: "78px" }}
          >
            <span className="rounded-full border border-violet-500/40 bg-violet-950/60 px-4 py-1.5 text-[11px] text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
              Reasoning inside {navState.discoveryTitle}…
            </span>
          </div>
        )}
      {navState.mode === "discovery" &&
        architectureCanvasModel &&
        navState.regionId &&
        constellationReasonerErrors[navState.regionId] &&
        !isReasoningConstellation && (
          <div
            className="pointer-events-none absolute z-20 flex justify-center"
            style={{ left: "176px", right: "320px", top: "78px" }}
          >
            <span className="rounded-full border border-amber-500/30 bg-amber-950/50 px-4 py-1.5 text-[11px] text-amber-200/90">
              {constellationReasonerErrors[navState.regionId]}
            </span>
          </div>
        )}
      {navState.mode === "discovery" &&
        architectureCanvasModel &&
        isReasoningNode &&
        reasoningNodeId && (
          <div
            className="pointer-events-none absolute z-20 flex justify-center"
            style={{ left: "176px", right: selectedItem ? "320px" : "0", top: "78px" }}
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
          className="absolute bottom-4 z-20 rounded border border-slate-800/80 bg-slate-950/90 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-700 hover:text-slate-400"
          style={{ left: "184px" }}
        >
          {archDebugOpen ? "Hide architecture debug" : "Architecture debug"}
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
        />
      )}

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

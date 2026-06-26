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
import { buildConstellationLayout } from "@/lib/layoutNodes";
import { MOCK_DISCOVERIES } from "@/lib/mockDiscoveries";
import {
  CONSTELLATION_REGIONS,
  DISCOVERY_REGION_MAP,
  type ConstellationRegionId,
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
import { getAgentReasoning } from "@/lib/agentReasoning";
import { resolveNodeMeta, resolvePanelItem } from "@/lib/worldNodes";
import {
  computeFutureYPositions,
  labelPriority,
  resolveLabelOffsets,
} from "@/lib/graphLayout";
import type {
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

type ConstellationCanvasProps = { worldSeed: string };

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

export default function ConstellationCanvas({
  worldSeed,
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
    return selectedItem.kind === "discovery"
      ? selectedItem.discovery.id
      : selectedItem.consequence.id;
  }, [selectedItem]);

  const baseLayout = useMemo(
    () => buildConstellationLayout(worldSeed, MOCK_DISCOVERIES),
    [worldSeed],
  );

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

    // PAST + CURRENT: walked path
    trail.forEach((id, i) => {
      const meta = resolveNodeMeta(id);
      const isFocused = i === trail.length - 1;
      const x = isFocused ? 0 : (i - pastCount) * PAST_STEP_X;

      nodes.push({
        id,
        type: "trailNode",
        position: { x, y: 0 },
        data: {
          title: meta?.title ?? id,
          category: meta?.category,
          role: isFocused ? "focused" : "path",
          decision: decisions[id] ?? "pending",
          justAccepted: id === justAcceptedId,
          hasCreatorDirection: Boolean(creatorDirections[id]),
          journeyPhase: isFocused ? "current" : "past",
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
          style: isFocused ? TRAIL_EDGE_STYLE : PAST_EDGE_STYLE,
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

    const futureIds = [
      ...dirIds.map((id) => ({ id, kind: "direction" as const })),
      ...consIds.map((id) => ({ id, kind: "consequence" as const })),
    ];
    const yPositions = computeFutureYPositions(futureIds.length, FUTURE_ROW_H);

    futureIds.forEach((item, j) => {
      const { id, kind } = item;
      const y = yPositions[j] ?? 0;
      const meta = resolveNodeMeta(id);

      nodes.push({
        id,
        type: "trailNode",
        position: { x: FUTURE_X, y },
        data: {
          title: meta?.title ?? id,
          category: meta?.category ?? (kind === "consequence" ? "Consequence" : undefined),
          role: kind,
          decision: decisions[id] ?? "pending",
          justEmerged: justEmergedIds.has(id),
          hasCreatorDirection: Boolean(creatorDirections[id]),
          journeyPhase: "future",
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: 5,
      });

      edges.push({
        id: `future-${focusedId}-${id}`,
        source: focusedId,
        target: id,
        animated: kind === "consequence",
        style: kind === "consequence" ? CONSEQUENCE_EDGE_STYLE : FUTURE_EDGE_STYLE,
      });
    });

    return { nodes, edges };
  }, [navState, decisions, hiddenIds, justAcceptedId, creatorDirections, justEmergedIds]);

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
    () => buildCanonThreads(acceptedIds),
    [acceptedIds],
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

    return baseLayout.nodes.map((node) => {
      if (node.type === "constellationRegion") {
        const regionId = node.id.replace(
          "region-",
          "",
        ) as ConstellationRegionId;

        const hidden = mode !== "overview";

        let vitalityDots: VitalityDot[] | undefined;
        if (mode === "overview") {
          vitalityDots = MOCK_DISCOVERIES.filter(
            (d) => DISCOVERY_REGION_MAP[d.id] === regionId,
          ).map((d) => ({
            revealed: true,
            decision: decisions[d.id] ?? "pending",
          }));
        }

        const regionDef = CONSTELLATION_REGIONS.find((r) => r.id === regionId);

        return {
          ...node,
          hidden,
          selectable: mode === "overview",
          data: { ...node.data, icon: regionDef?.icon ?? "", vitalityDots },
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
    baseLayout.nodes,
    decisions,
    revealedIds,
    justRevealedId,
    justAcceptedId,
    selectedNodeId,
    rippleStates,
  ]);

  // ── Edges ─────────────────────────────────────────────────────────────────
  const edges = useMemo(() => {
    const { mode } = navState;

    if (mode === "discovery") return trailLayout.edges;
    if (mode === "canon") return [];
    return [];
  }, [navState, trailLayout.edges]);

  // Directions + unlocked consequences for the side panel
  const panelDirections = useMemo(() => {
    if (!selectedItem) return [];
    const id =
      selectedItem.kind === "discovery"
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

    return [...routeDirs, ...consDirs];
  }, [selectedItem, hiddenIds, decisions]);

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
      const item = resolvePanelItem(targetId);
      if (item) setSelectedItem(item);
    },
    [],
  );

  // ── Interaction ───────────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const { mode } = navState;

      // Overview: clicking a region enters the trail at that region's virtual root
      if (mode === "overview" && node.type === "constellationRegion") {
        const regionId = node.id.replace("region-", "") as ConstellationRegionId;
        const rootId = REGION_VIRTUAL_ROOTS[regionId] ?? regionId;
        const item = resolvePanelItem(rootId);
        const meta = resolveNodeMeta(rootId);
        setNavState({
          mode: "discovery",
          discoveryId: rootId,
          regionId,
          discoveryTitle: meta?.title ?? rootId,
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
    [navState, hiddenIds, revealedIds, navigateTrail],
  );

  const onPaneClick = useCallback(() => setSelectedItem(null), []);

  const handleNavigate = useCallback((state: NavState) => {
    setNavState(state);
    setSelectedItem(null);
  }, []);

  // ── Action handler ─────────────────────────────────────────────────────────
  const handleAction = useCallback(
    (action: DiscoveryAction) => {
      if (!selectedItem) return;

      const id =
        selectedItem.kind === "discovery"
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

      setDecisions((prev) => ({ ...prev, [id]: decision }));

      if (action === "accept") {
        const nodeTitle = resolveNodeMeta(id)?.title ?? id;
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
    [selectedItem, acceptedIds, navState, triggeredEvolutionIds],
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
    const steps = navState.trail.map((id, i, arr) => ({
      id,
      title: resolveNodeMeta(id)?.title ?? id,
      role: (i === arr.length - 1 ? "current" : "step") as "step" | "current",
    }));
    return [
      {
        id: "__world-seed__",
        title: worldSeed,
        subtitle: originJourneySubtitle(worldSeed),
        role: "origin" as const,
      },
      ...steps,
    ];
  }, [navState, worldSeed]);

  const potentialConsequences = useMemo(() => {
    if (!selectedNodeId) return [];
    return (ACCEPT_CONSEQUENCES[selectedNodeId] ?? []).map((c) => c.title);
  }, [selectedNodeId]);

  const handleCanonNodeSelect = useCallback((nodeId: string) => {
    const item = resolvePanelItem(nodeId);
    if (item) setSelectedItem(item);
  }, []);

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
          ? [worldSeed, resolveNodeMeta(selectedNodeId)?.title ?? selectedNodeId]
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
      />
      <Breadcrumb navState={navState} onNavigate={handleNavigate} />
      <WorldPulse shift={latestShift} nonce={pulseNonce} />
      <WorldWhisper
        onSubmit={handleAddTruth}
        emphasized={navState.mode === "overview"}
      />
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
      {navState.mode !== "canon" && (
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
          agentVoice={agentVoice}
          agentReasoning={agentReasoning}
          journeySteps={journeySteps}
          potentialConsequences={potentialConsequences}
          agentSelectContext={agentSelectContext}
          agentSelectContextKey={agentSelectContextKey}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  MarkerType,
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
import {
  buildCanonTimeline,
  getCanonNodeTitle,
} from "@/lib/canonLayout";
import { getAgentVoice } from "@/lib/agentVoices";
import { getAgentReasoning } from "@/lib/agentReasoning";
import { resolveNodeMeta, resolvePanelItem } from "@/lib/worldNodes";
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

// Trail (discovery-mode) layout — PAST ← CURRENT → FUTURE
const PAST_STEP_X = 200;
const FUTURE_X = 280;
const FUTURE_ROW_H = 95;

// Canon tree layout constants (vertical glowing paths)
const CANON_PATH_EDGE = {
  stroke: "rgba(167, 139, 250, 0.8)",
  strokeWidth: 2.5,
} as const;

const CANON_PATH_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 14,
  height: 14,
  color: "rgba(167, 139, 250, 0.85)",
} as const;

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

  const handleAddTruth = useCallback((truth: string) => {
    setCreatorTruths((prev) => [...prev, truth]);
    setLatestShift({ truth, influence: getInfluence(truth) });
    setPulseNonce((n) => n + 1);
  }, []);

  const rfInstance = useRef<ReactFlowInstance | null>(null);

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
    const fn = futureIds.length;

    futureIds.forEach((item, j) => {
      const { id, kind } = item;
      const y =
        fn === 1 ? 0 : (j - (fn - 1) / 2) * FUTURE_ROW_H;
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

  // ── Canon layout: compact vertical civilization timeline ─────────────────────
  const canonLayout = useMemo(() => {
    if (navState.mode !== "canon") {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const timeline = buildCanonTimeline(acceptedIds, worldSeed);
    if (!timeline) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const seedFlowId = "canon-seed";

    nodes.push({
      id: seedFlowId,
      type: "trailNode",
      position: timeline.seedPosition,
      data: {
        title: worldSeed,
        category: "Origin",
        role: "focused",
        decision: "pending",
        isCanonPath: true,
      } satisfies TrailNodeData,
      draggable: false,
      selectable: false,
      zIndex: 10,
    });

    for (const route of timeline.routes) {
      route.nodeIds.forEach((id, i) => {
        const flowId = `canon-${route.columnIndex}::${id}`;
        const title = getCanonNodeTitle(id, worldSeed);

        nodes.push({
          id: flowId,
          type: "trailNode",
          position: route.positions[id] ?? { x: 0, y: 0 },
          data: {
            title,
            category: "Established Truth",
            role: "path",
            decision: "accepted",
            isCanonPath: true,
            justAccepted: id === justAcceptedId,
          } satisfies TrailNodeData,
          draggable: false,
          selectable: true,
          zIndex: 6,
        });

        const prevFlowId =
          i === 0 ? seedFlowId : `canon-${route.columnIndex}::${route.nodeIds[i - 1]}`;

        edges.push({
          id: `canon-edge-${prevFlowId}-${flowId}`,
          source: prevFlowId,
          target: flowId,
          animated: true,
          style: CANON_PATH_EDGE,
          markerEnd: CANON_PATH_MARKER,
        });
      });
    }

    return { nodes, edges };
  }, [navState.mode, acceptedIds, worldSeed, justAcceptedId]);

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const nodes = useMemo(() => {
    const { mode } = navState;

    if (mode === "discovery") return trailLayout.nodes;
    if (mode === "canon") return canonLayout.nodes;

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
    canonLayout.nodes,
    baseLayout.nodes,
    decisions,
    revealedIds,
    justRevealedId,
    justAcceptedId,
  ]);

  // ── Edges ─────────────────────────────────────────────────────────────────
  const edges = useMemo(() => {
    const { mode } = navState;

    if (mode === "discovery") return trailLayout.edges;
    if (mode === "canon") return canonLayout.edges;
    return [];
  }, [navState, trailLayout.edges, canonLayout.edges]);

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
        const rawId = node.id.includes("::")
          ? node.id.split("::")[1]
          : node.id;
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
        setAcceptedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
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
    [selectedItem, acceptedIds, navState],
  );

  const selectedDecision = useMemo((): DiscoveryDecision => {
    if (!selectedItem) return "pending";
    const id =
      selectedItem.kind === "discovery"
        ? selectedItem.discovery.id
        : selectedItem.consequence.id;
    return decisions[id] ?? "pending";
  }, [selectedItem, decisions]);

  const activeTrail = navState.mode === "discovery" ? navState.trail : [];

  const selectedNodeId = useMemo(() => {
    if (!selectedItem) return null;
    return selectedItem.kind === "discovery"
      ? selectedItem.discovery.id
      : selectedItem.consequence.id;
  }, [selectedItem]);

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
    return navState.trail.map((id) => ({
      id,
      title: resolveNodeMeta(id)?.title ?? id,
    }));
  }, [navState]);

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
      <WorldWhisper onSubmit={handleAddTruth} />
      {navState.mode === "discovery" && (
        <div
          className="pointer-events-none absolute z-10 flex items-center justify-center gap-0"
          style={{ left: "176px", right: "320px", top: "44px" }}
        >
          <div className="flex flex-1 justify-center">
            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-600/80">
              Past
            </span>
          </div>
          <div className="flex flex-1 justify-center">
            <span className="text-[9px] uppercase tracking-[0.2em] text-violet-400/70">
              Current
            </span>
          </div>
          <div className="flex flex-1 justify-center">
            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500/80">
              Future
            </span>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          rfInstance.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.28, includeHiddenNodes: false }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0a0f]"
      />
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
        />
      )}
    </div>
  );
}

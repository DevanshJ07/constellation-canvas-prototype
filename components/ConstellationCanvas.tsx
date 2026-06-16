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
  WORLD_NODES,
  PARENT_MAP,
  getChildren,
} from "@/lib/worldData";
import { resolveNodeMeta, resolvePanelItem } from "@/lib/worldNodes";
import type {
  DiscoveryAction,
  DiscoveryDecision,
  NavState,
  PanelItem,
} from "@/types/discovery";

const ACCEPT_GLOW_MS = 700;
const FIT_DELAY_MS = 80;
const FIT_DURATION_MS = 600;

// Trail (discovery-mode) layout constants
const TRAIL_STEP_X = 280;
const ORBIT_R = 240;
const ANGLE_SPREAD = 130;

// Canon tree layout constants
const CANON_COL_W = 270;
const CANON_ROW_H = 110;

const TRAIL_EDGE_STYLE = {
  stroke: "rgba(167, 139, 250, 0.6)",
  strokeWidth: 2,
} as const;

const CANON_EDGE_STYLE = {
  stroke: "rgba(167, 139, 250, 0.45)",
  strokeWidth: 1.5,
  strokeDasharray: "6 4",
} as const;

const CANON_MARKER_END = {
  type: MarkerType.ArrowClosed,
  width: 12,
  height: 12,
  color: "rgba(167, 139, 250, 0.55)",
} as const;

const ORBIT_EDGE_STYLE = {
  stroke: "rgba(148, 163, 184, 0.25)",
  strokeWidth: 1,
  strokeDasharray: "5 4",
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

  // ── Trail layout (discovery mode = Exploration Trail) ───────────────────────
  const trailLayout = useMemo(() => {
    if (navState.mode !== "discovery") {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const trail = navState.trail;
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const focusedId = trail[trail.length - 1];

    // Walked path nodes laid out horizontally
    trail.forEach((id, i) => {
      const meta = resolveNodeMeta(id);
      const isFocused = i === trail.length - 1;
      nodes.push({
        id,
        type: "trailNode",
        position: { x: i * TRAIL_STEP_X, y: 0 },
        data: {
          title: meta?.title ?? id,
          category: meta?.category,
          role: isFocused ? "focused" : "path",
          decision: decisions[id] ?? "pending",
          justAccepted: id === justAcceptedId,
          hasCreatorDirection: Boolean(creatorDirections[id]),
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: isFocused ? 10 : 6,
      });

      if (i > 0) {
        edges.push({
          id: `trail-${trail[i - 1]}-${id}`,
          source: trail[i - 1],
          target: id,
          animated: true,
          style: TRAIL_EDGE_STYLE,
        });
      }
    });

    // Possible directions: orbit the focused node (right hemisphere)
    const dirIds = getChildren(focusedId).filter(
      (id) =>
        !hiddenIds.has(id) &&
        decisions[id] !== "rejected" &&
        !trail.includes(id),
    );
    const focusX = (trail.length - 1) * TRAIL_STEP_X;
    const n = dirIds.length;

    dirIds.forEach((id, j) => {
      const angleDeg =
        n === 1 ? 0 : -ANGLE_SPREAD / 2 + (ANGLE_SPREAD * j) / (n - 1);
      const rad = (angleDeg * Math.PI) / 180;
      const pos = {
        x: focusX + ORBIT_R * Math.cos(rad),
        y: ORBIT_R * Math.sin(rad),
      };
      const meta = resolveNodeMeta(id);

      nodes.push({
        id,
        type: "trailNode",
        position: pos,
        data: {
          title: meta?.title ?? id,
          category: meta?.category,
          role: "direction",
          decision: decisions[id] ?? "pending",
          hasCreatorDirection: Boolean(creatorDirections[id]),
        } satisfies TrailNodeData,
        draggable: false,
        selectable: true,
        zIndex: 5,
      });

      edges.push({
        id: `orbit-${focusedId}-${id}`,
        source: focusedId,
        target: id,
        style: ORBIT_EDGE_STYLE,
      });
    });

    return { nodes, edges };
  }, [navState, decisions, hiddenIds, justAcceptedId, creatorDirections]);

  // ── Canon layout: tree of established truths ─────────────────────────────────
  const canonLayout = useMemo(() => {
    if (navState.mode !== "canon") {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const acceptedSet = new Set(acceptedIds);
    if (acceptedSet.size === 0) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    // Find roots: accepted nodes whose parent is not accepted (or has no parent)
    const roots = acceptedIds.filter((id) => {
      const parent = PARENT_MAP[id];
      return !parent || !acceptedSet.has(parent);
    });

    // Recursive DFS tree layout: leaf nodes consume rows, parents are centered
    const positions: Record<string, { x: number; y: number }> = {};
    let nextRow = 0;

    function layoutNode(id: string, depth: number): void {
      const children = (WORLD_GRAPH[id] ?? []).filter((c) =>
        acceptedSet.has(c),
      );
      if (children.length === 0) {
        positions[id] = { x: depth * CANON_COL_W, y: nextRow * CANON_ROW_H };
        nextRow++;
        return;
      }
      for (const child of children) layoutNode(child, depth + 1);
      const firstY = positions[children[0]].y;
      const lastY = positions[children[children.length - 1]].y;
      positions[id] = { x: depth * CANON_COL_W, y: (firstY + lastY) / 2 };
    }

    for (const root of roots) layoutNode(root, 0);

    const nodes: Node[] = acceptedIds.map((id) => ({
      id,
      type: "trailNode" as const,
      position: positions[id] ?? { x: 0, y: 0 },
      data: {
        title:
          WORLD_NODES[id]?.title ?? resolveNodeMeta(id)?.title ?? id,
        category: WORLD_NODES[id]
          ? "Established Truth"
          : resolveNodeMeta(id)?.category,
        role: "path" as const,
        decision: "accepted" as DiscoveryDecision,
        justAccepted: id === justAcceptedId,
      } satisfies TrailNodeData,
      draggable: false,
      selectable: true,
      zIndex: 6,
    }));

    const edges: Edge[] = acceptedIds.flatMap((id) => {
      const parent = PARENT_MAP[id];
      if (!parent || !acceptedSet.has(parent)) return [];
      return [
        {
          id: `canon-${parent}-${id}`,
          source: parent,
          target: id,
          animated: true,
          style: CANON_EDGE_STYLE,
          markerEnd: CANON_MARKER_END,
        },
      ];
    });

    return { nodes, edges };
  }, [navState.mode, acceptedIds, justAcceptedId]);

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

  // Directions for the currently selected node in the side panel
  const panelDirections = useMemo(() => {
    if (!selectedItem) return [];
    const id =
      selectedItem.kind === "discovery"
        ? selectedItem.discovery.id
        : selectedItem.consequence.id;
    return getChildren(id)
      .filter((dirId) => !hiddenIds.has(dirId) && decisions[dirId] !== "rejected")
      .map((dirId) => {
        const meta = resolveNodeMeta(dirId);
        return {
          id: dirId,
          title: meta?.title ?? dirId,
          category: meta?.category ?? "",
          decision: decisions[dirId] ?? "pending",
        };
      });
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
        const item = resolvePanelItem(node.id);
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
        // Also unaccept world-graph descendants
        const descendants = getWorldDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
        const toReset = new Set([id, ...descendants]);
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
        window.setTimeout(() => setJustAcceptedId(null), ACCEPT_GLOW_MS);
      }

      if (action === "reject") {
        // Cascade-unaccept any world-graph descendants that were accepted
        const descendants = getWorldDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
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
        />
      )}
    </div>
  );
}

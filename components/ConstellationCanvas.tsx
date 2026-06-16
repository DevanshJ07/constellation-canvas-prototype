"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import Breadcrumb from "@/components/Breadcrumb";
import ConsequenceNode, {
  type ConsequenceNodeData,
} from "@/components/ConsequenceNode";
import ConstellationRegionNode, {
  type VitalityDot,
} from "@/components/ConstellationRegionNode";
import DiscoveryNode, {
  type DiscoveryNodeData,
} from "@/components/DiscoveryNode";
import DiscoveryPanel from "@/components/DiscoveryPanel";
import WorldSidebar from "@/components/WorldSidebar";
import { buildConstellationLayout } from "@/lib/layoutNodes";
import { MOCK_DISCOVERIES } from "@/lib/mockDiscoveries";
import {
  CONSTELLATION_REGIONS,
  DISCOVERY_REGION_MAP,
  HIDDEN_DISCOVERY_LABELS,
  type ConstellationRegionId,
} from "@/lib/regions";
import {
  ACCEPT_CONSEQUENCES,
  getAllDescendantIds,
  getConsequencePosition,
} from "@/lib/worldLogic";
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

const nodeTypes = {
  constellationRegion: ConstellationRegionNode,
  discovery: DiscoveryNode,
  consequence: ConsequenceNode,
};

type ConstellationCanvasProps = { worldSeed: string };

export default function ConstellationCanvas({
  worldSeed,
}: ConstellationCanvasProps) {
  const [navState, setNavState] = useState<NavState>({ mode: "overview" });
  const [selectedItem, setSelectedItem] = useState<PanelItem | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [justRevealedId, setJustRevealedId] = useState<string | null>(null);
  // decisions covers ALL node IDs: discoveries and consequences alike
  const [decisions, setDecisions] = useState<Record<string, DiscoveryDecision>>(
    {},
  );
  // acceptedIds covers ALL accepted node IDs (discoveries + consequences)
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [justAcceptedId, setJustAcceptedId] = useState<string | null>(null);
  const [justEmergedIds, setJustEmergedIds] = useState<Set<string>>(new Set());

  const rfInstance = useRef<ReactFlowInstance | null>(null);

  const baseLayout = useMemo(
    () => buildConstellationLayout(worldSeed, MOCK_DISCOVERIES),
    [worldSeed],
  );

  const discoveryBasePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const node of baseLayout.nodes) {
      if (node.type === "discovery") map[node.id] = node.position;
    }
    return map;
  }, [baseLayout.nodes]);

  // Animated fitView whenever nav level changes
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

  // ── BFS consequence tree ──────────────────────────────────────────────────
  // Returns nodes + a position registry so consequence edges can be derived
  // from the same source of truth.
  const { consequenceNodes, consequencePosReg } = useMemo(() => {
    const { mode } = navState;
    if (mode === "overview" || mode === "constellation") {
      return { consequenceNodes: [] as Node[], consequencePosReg: {} as Record<string, { x: number; y: number }> };
    }

    const posReg: Record<string, { x: number; y: number }> = {};
    const nodes: Node[] = [];

    // In discovery mode: start only from the focused discovery.
    // In canon mode: start from all accepted discoveries.
    const rootIds =
      mode === "discovery"
        ? [navState.discoveryId]
        : acceptedIds.filter((id) => Boolean(discoveryBasePositions[id]));

    type QueueItem = { parentId: string; depth: number };
    const queue: QueueItem[] = rootIds.map((id) => ({ parentId: id, depth: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const item = queue.shift()!;
      const { parentId, depth } = item;
      if (visited.has(parentId)) continue;
      visited.add(parentId);

      const parentPos = discoveryBasePositions[parentId] ?? posReg[parentId];
      if (!parentPos) continue;

      const consequences = ACCEPT_CONSEQUENCES[parentId] ?? [];

      consequences.forEach((consequence, index) => {
        if (hiddenIds.has(consequence.id)) return;

        const pos = getConsequencePosition(parentPos, index, depth);
        posReg[consequence.id] = pos;

        const conDecision = decisions[consequence.id] ?? "pending";

        // In discovery mode: show all children of the root (any decision state)
        // In canon mode: show only accepted children
        const shouldShow =
          mode === "discovery" ? true : conDecision === "accepted";

        if (shouldShow) {
          nodes.push({
            id: consequence.id,
            type: "consequence",
            position: pos,
            data: {
              consequence,
              decision: conDecision,
              justEmerged: justEmergedIds.has(consequence.id),
              justAccepted: consequence.id === justAcceptedId,
            } satisfies ConsequenceNodeData,
            draggable: false,
            zIndex: 8,
          });
        }

        if (conDecision === "accepted") {
          queue.push({ parentId: consequence.id, depth: depth + 1 });
        }
      });
    }

    return { consequenceNodes: nodes, consequencePosReg: posReg };
  }, [
    navState,
    acceptedIds,
    decisions,
    hiddenIds,
    discoveryBasePositions,
    justEmergedIds,
    justAcceptedId,
  ]);

  // ── nodes ─────────────────────────────────────────────────────────────────
  const nodes = useMemo(() => {
    const { mode } = navState;

    const mapped = baseLayout.nodes.map((node) => {
      if (node.type === "constellationRegion") {
        const regionId = node.id.replace(
          "region-",
          "",
        ) as ConstellationRegionId;

        let hidden = false;
        if (mode !== "overview") {
          hidden =
            mode === "constellation"
              ? regionId !== navState.regionId
              : true;
        }

        // Vitality dots: only computed for overview
        let vitalityDots: VitalityDot[] | undefined;
        if (mode === "overview") {
          vitalityDots = MOCK_DISCOVERIES.filter(
            (d) => DISCOVERY_REGION_MAP[d.id] === regionId,
          ).map((d) => ({
            revealed:
              !HIDDEN_DISCOVERY_LABELS[d.id] || revealedIds.has(d.id),
            decision: decisions[d.id] ?? "pending",
          }));
        }

        // Pass icon from region definition
        const regionDef = CONSTELLATION_REGIONS.find((r) => r.id === regionId);

        return {
          ...node,
          hidden,
          selectable: mode === "overview",
          data: {
            ...node.data,
            icon: regionDef?.icon ?? "",
            vitalityDots,
          },
        };
      }

      if (node.type === "discovery") {
        const data = node.data as DiscoveryNodeData;
        const decision = decisions[node.id] ?? "pending";
        const isRevealed = !data.isHidden || revealedIds.has(node.id);

        let hidden = false;
        if (mode === "overview") {
          hidden = true;
        } else if (mode === "constellation") {
          hidden =
            DISCOVERY_REGION_MAP[node.id] !== navState.regionId ||
            hiddenIds.has(node.id);
        } else if (mode === "discovery") {
          hidden = node.id !== navState.discoveryId;
        } else {
          // canon: show accepted only
          hidden = decision !== "accepted";
        }

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

    return [...mapped, ...consequenceNodes];
  }, [
    navState,
    baseLayout.nodes,
    decisions,
    revealedIds,
    justRevealedId,
    justAcceptedId,
    hiddenIds,
    consequenceNodes,
  ]);

  // ── edges ─────────────────────────────────────────────────────────────────
  const edges = useMemo(() => {
    const { mode } = navState;
    const isRejected = (id: string) => hiddenIds.has(id);
    const isAccepted = (id: string) => decisions[id] === "accepted";

    // Build consequence edges for a given root (BFS)
    function buildConsequenceEdges(rootIds: string[]): Edge[] {
      const result: Edge[] = [];
      const queue = [...rootIds];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const parentId = queue.shift()!;
        if (visited.has(parentId)) continue;
        visited.add(parentId);

        for (const consequence of ACCEPT_CONSEQUENCES[parentId] ?? []) {
          if (hiddenIds.has(consequence.id)) continue;
          result.push({
            id: `ce-${consequence.id}`,
            source: parentId,
            target: consequence.id,
            style: {
              stroke: "rgba(45, 212, 191, 0.4)",
              strokeWidth: 1,
              strokeDasharray: "5 4",
            },
          });
          if (isAccepted(consequence.id)) {
            queue.push(consequence.id);
          }
        }
      }

      return result;
    }

    if (mode === "overview") return [];

    if (mode === "constellation") {
      const { regionId } = navState;
      return baseLayout.edges.filter((edge) => {
        if (edge.id.startsWith("edge-region-")) {
          return (
            DISCOVERY_REGION_MAP[edge.target] === regionId &&
            !isRejected(edge.target)
          );
        }
        if (edge.id.startsWith("rel-")) {
          return (
            DISCOVERY_REGION_MAP[edge.source] === regionId &&
            DISCOVERY_REGION_MAP[edge.target] === regionId &&
            !isRejected(edge.source) &&
            !isRejected(edge.target)
          );
        }
        return false;
      });
    }

    if (mode === "discovery") {
      const { discoveryId } = navState;
      return buildConsequenceEdges([discoveryId]);
    }

    // canon
    const canonRelEdges = baseLayout.edges.filter(
      (edge) =>
        edge.id.startsWith("rel-") &&
        isAccepted(edge.source) &&
        isAccepted(edge.target) &&
        !isRejected(edge.source) &&
        !isRejected(edge.target),
    );
    const acceptedDiscoveries = acceptedIds.filter(
      (id) => Boolean(discoveryBasePositions[id]),
    );
    return [...canonRelEdges, ...buildConsequenceEdges(acceptedDiscoveries)];
  }, [
    navState,
    baseLayout.edges,
    decisions,
    hiddenIds,
    acceptedIds,
    discoveryBasePositions,
  ]);

  // ── interaction ───────────────────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const { mode } = navState;

      if (mode === "overview" && node.type === "constellationRegion") {
        const regionId = node.id.replace(
          "region-",
          "",
        ) as ConstellationRegionId;
        setNavState({ mode: "constellation", regionId });
        setSelectedItem(null);
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
          });
        }

        setSelectedItem({ kind: "discovery", discovery: data.discovery });
      }
    },
    [navState, hiddenIds, revealedIds],
  );

  const onPaneClick = useCallback(() => setSelectedItem(null), []);

  const handleNavigate = useCallback((state: NavState) => {
    setNavState(state);
    setSelectedItem(null);
  }, []);

  // Unified action handler — works for both discoveries and consequences
  const handleAction = useCallback(
    (action: DiscoveryAction) => {
      if (!selectedItem) return;

      const id =
        selectedItem.kind === "discovery"
          ? selectedItem.discovery.id
          : selectedItem.consequence.id;

      if (action === "unaccept") {
        // Cascade: unaccept this node and all its accepted descendants
        const descendants = getAllDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
        const toReset = new Set([id, ...descendants]);
        setDecisions((prev) => {
          const next = { ...prev };
          for (const rid of toReset) next[rid] = "pending";
          return next;
        });
        setAcceptedIds((prev) => prev.filter((a) => !toReset.has(a)));
        setSelectedItem(null);
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
          window.setTimeout(
            () => setJustEmergedIds(new Set()),
            EMERGE_GLOW_MS,
          );
          // Re-fit after emergence so new nodes appear in view
          window.setTimeout(() => {
            rfInstance.current?.fitView({
              padding: 0.28,
              duration: 500,
              includeHiddenNodes: false,
            });
          }, 120);
        }

        window.setTimeout(() => setJustAcceptedId(null), ACCEPT_GLOW_MS);
      }

      if (action === "reject") {
        // Also cascade-unaccept any accepted descendants before hiding
        const descendants = getAllDescendantIds(id).filter((did) =>
          acceptedIds.includes(did),
        );
        const toReset = new Set(descendants);
        if (toReset.size > 0) {
          setDecisions((prev) => {
            const next = { ...prev };
            for (const rid of toReset) next[rid] = "pending";
            return next;
          });
          setAcceptedIds((prev) => prev.filter((a) => !toReset.has(a)));
        }

        window.setTimeout(
          () => setHiddenIds((prev) => new Set([...prev, id])),
          500,
        );
        window.setTimeout(() => setSelectedItem(null), 400);

        // If rejecting the focused discovery, return to constellation
        if (
          navState.mode === "discovery" &&
          navState.discoveryId === id
        ) {
          window.setTimeout(() => {
            setNavState((prev) =>
              prev.mode === "discovery"
                ? { mode: "constellation", regionId: prev.regionId }
                : prev,
            );
          }, 600);
        }
      }
    },
    [selectedItem, acceptedIds, navState],
  );

  const selectedDecision = useMemo(() => {
    if (!selectedItem) return "pending" as DiscoveryDecision;
    const id =
      selectedItem.kind === "discovery"
        ? selectedItem.discovery.id
        : selectedItem.consequence.id;
    return decisions[id] ?? "pending";
  }, [selectedItem, decisions]);

  return (
    <div className="relative h-screen w-screen bg-[#0a0a0f]">
      <WorldSidebar
        navState={navState}
        onNavigate={handleNavigate}
        acceptedCount={acceptedIds.length}
      />
      <Breadcrumb navState={navState} onNavigate={handleNavigate} />
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
          item={selectedItem}
          decision={selectedDecision}
          onAction={handleAction}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

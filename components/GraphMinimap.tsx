"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  MiniMap,
  Panel,
  useOnViewportChange,
  useReactFlow,
  getNodesBounds,
  type Node,
} from "@xyflow/react";

type GraphMinimapProps = {
  nodes: Node[];
  /** Right inset when discovery panel is open (px). */
  panelInset?: number;
};

function GraphMinimapInner({ nodes, panelInset = 0 }: GraphMinimapProps) {
  const { getViewport } = useReactFlow();
  const [showMinimap, setShowMinimap] = useState(false);

  const checkMinimap = useCallback(() => {
    if (nodes.length < 4) {
      setShowMinimap(false);
      return;
    }
    try {
      const bounds = getNodesBounds(nodes);
      const { zoom } = getViewport();
      const el = document.querySelector(".react-flow__viewport")?.parentElement;
      if (!el) {
        setShowMinimap(nodes.length > 6);
        return;
      }
      const graphW = (bounds.width + 80) * zoom;
      const graphH = (bounds.height + 80) * zoom;
      setShowMinimap(
        graphW > el.clientWidth * 0.85 || graphH > el.clientHeight * 0.85,
      );
    } catch {
      setShowMinimap(nodes.length > 6);
    }
  }, [nodes, getViewport]);

  useEffect(() => {
    checkMinimap();
  }, [checkMinimap]);

  useOnViewportChange({ onEnd: checkMinimap });

  if (!showMinimap) return null;

  return (
    <Panel
      position="bottom-right"
      className="!m-0"
      style={{ marginRight: panelInset + 16, marginBottom: 120 }}
    >
      <MiniMap
        className="!rounded-lg !border !border-slate-800/80 !bg-slate-950/90 !shadow-lg"
        style={{ width: 140, height: 96 }}
        nodeColor={(node) => {
          const phase = (node.data as { journeyPhase?: string })?.journeyPhase;
          if (phase === "current") return "rgba(167, 139, 250, 0.85)";
          if (phase === "future") return "rgba(148, 163, 184, 0.55)";
          if (phase === "past") return "rgba(100, 116, 139, 0.45)";
          const layer = (node.data as { canonLayer?: string })?.canonLayer;
          if (layer === "origin") return "rgba(167, 139, 250, 0.9)";
          if (layer === "theme") return "rgba(251, 191, 36, 0.6)";
          return "rgba(167, 139, 250, 0.5)";
        }}
        maskColor="rgba(10, 10, 15, 0.72)"
        pannable
        zoomable
      />
    </Panel>
  );
}

const GraphMinimap = memo(GraphMinimapInner);
export default GraphMinimap;

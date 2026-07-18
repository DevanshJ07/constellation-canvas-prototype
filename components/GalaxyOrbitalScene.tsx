"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  computeGalaxyClusterCenter,
  computeMoonOrbitPositions,
  computeMoonOrbitRadius,
  computeOrbitArcPath,
  computePlanetOrbitPositions,
  computePlanetOrbitRadius,
  GALAXY_VIEWPORT_MAX_ZOOM,
  GALAXY_VIEWPORT_MIN_ZOOM,
  labelPlacementsToExclusionBoxes,
  resolveLabelPlacements,
  resolveMoonLabelPlacements,
  type CanvasSize,
  type OrbitNodeLayout,
} from "@/lib/worldBrain/galaxyLayoutV2";
import type { GalaxyNodeDecision, GalaxyScene } from "@/lib/worldBrain/galaxyScene";
import {
  markerPaletteFromTheme,
  moonPaletteFromTheme,
  resolveGalaxyThemeForApp,
  type ConstellationTheme,
  type ResolveGalaxyThemeOptions,
} from "@/lib/worldBrain/galaxyThemeV2";

const SUN_RADIUS = 38;
const PRIMARY_RING_R = 18;
const PRIMARY_CORE_R = 3.4;
const SECONDARY_RING_R = 9.5;
const SECONDARY_CORE_R = 2;
const PLANET_RADIUS = PRIMARY_RING_R;
const CANVAS_PADDING = 44;
const LABEL_PLATE = "rgba(8,10,18,0.78)";

/** Premium connector weight — ~2–3px visual with glow */
const LINK_PRIMARY = 2;
const LINK_PRIMARY_ACTIVE = 2.5;
const LINK_MOON = 2;
const PAN_DRAG_THRESHOLD = 6;
const ZOOM_WHEEL_SENSITIVITY = 0.0012;
const ZOOM_BUTTON_STEP = 0.1;

export type GalaxyOrbitalSceneHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};

type MarkerPalette = {
  ring: string;
  ringInner: string;
  core: string;
  aura: string;
};

function decisionOpacity(decision: GalaxyNodeDecision, isActive: boolean): number {
  if (decision === "rejected") return 0.48;
  if (decision === "inactive") return 0.68;
  if (decision === "accepted") return 0.98;
  return isActive ? 1 : 0.88;
}

function fadeToTransparent(rgba: string): string {
  const m = rgba.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return "rgba(0,0,0,0)";
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0)`;
}

export type GalaxyOrbitalSceneProps = {
  scene: GalaxyScene;
  onNodeClick: (nodeId: string) => void;
  showRipple?: boolean;
  showStatusStrip?: boolean;
  rippleKey?: number;
  /** Right detail panel width — shifts cluster center-left */
  panelInset?: number;
  /** Architecture / dynamic constellation color source */
  themeOptions?: ResolveGalaxyThemeOptions;
  onZoomChange?: (zoomPct: number) => void;
};

const GalaxyOrbitalScene = forwardRef<GalaxyOrbitalSceneHandle, GalaxyOrbitalSceneProps>(
function GalaxyOrbitalScene(
{
  scene,
  onNodeClick,
  showRipple = true,
  showStatusStrip = false,
  rippleKey: externalRippleKey,
  panelInset = 0,
  themeOptions,
  onZoomChange,
}: GalaxyOrbitalSceneProps,
ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<CanvasSize>({
    width: 1200,
    height: 720,
    padding: CANVAS_PADDING,
    panelInset: 0,
  });
  const [internalRippleKey, setInternalRippleKey] = useState(0);
  const rippleKey = externalRippleKey ?? internalRippleKey;
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const panSession = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });
  const suppressClickRef = useRef(false);

  const clampZoom = useCallback(
    (value: number) =>
      Math.max(GALAXY_VIEWPORT_MIN_ZOOM, Math.min(GALAXY_VIEWPORT_MAX_ZOOM, value)),
    [],
  );

  const notifyZoom = useCallback(
    (z: number) => {
      onZoomChange?.(Math.round(z * 100));
    },
    [onZoomChange],
  );

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    notifyZoom(1);
  }, [notifyZoom]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        setZoom((z) => {
          const next = clampZoom(z + ZOOM_BUTTON_STEP);
          notifyZoom(next);
          return next;
        });
      },
      zoomOut: () => {
        setZoom((z) => {
          const next = clampZoom(z - ZOOM_BUTTON_STEP);
          notifyZoom(next);
          return next;
        });
      },
      resetView,
    }),
    [clampZoom, notifyZoom, resetView],
  );

  useEffect(() => {
    resetView();
  }, [scene.constellationId, scene.centerId, resetView]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
        padding: CANVAS_PADDING,
        panelInset,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [panelInset]);

  const theme = useMemo(
    () =>
      resolveGalaxyThemeForApp(scene.constellationId, scene.constellationTitle, themeOptions),
    [scene.constellationId, scene.constellationTitle, themeOptions],
  );

  const center = useMemo(() => computeGalaxyClusterCenter(size), [size]);

  const primaryIds = useMemo(
    () => scene.primaryNodes.map((n) => n.id),
    [scene.primaryNodes],
  );

  const planetLayouts = useMemo(
    () =>
      computePlanetOrbitPositions(primaryIds, center, size, scene.constellationId),
    [primaryIds, center, size, scene.constellationId],
  );

  const primaryById = useMemo(
    () => new Map(scene.primaryNodes.map((p) => [p.id, p])),
    [scene.primaryNodes],
  );

  const layoutByPrimaryId = useMemo(
    () => new Map(planetLayouts.map((l) => [l.id, l])),
    [planetLayouts],
  );

  const moonParentLayout = useMemo(() => {
    if (!scene.moonParentId) return null;
    if (scene.moonNodes.length === 0) return null;

    if (scene.moonParentId === scene.centerId) {
      // Offset from sun so moon orbit radius does not collapse to ~0
      const r = Math.max(72, computePlanetOrbitRadius(size) * 0.32);
      return {
        x: center.x + r * 0.35,
        y: center.y - r * 0.2,
        id: scene.moonParentId,
      };
    }

    const layout = layoutByPrimaryId.get(scene.moonParentId);
    if (layout) {
      return { x: layout.position.x, y: layout.position.y, id: scene.moonParentId };
    }

    // Orphaned / nested moon parent without primary layout — keep moons visible.
    const fallbackR = Math.max(96, computePlanetOrbitRadius(size) * 0.55);
    const angle = -Math.PI / 5;
    return {
      x: center.x + Math.cos(angle) * fallbackR,
      y: center.y + Math.sin(angle) * fallbackR,
      id: scene.moonParentId,
    };
  }, [scene.moonParentId, scene.moonNodes.length, scene.centerId, layoutByPrimaryId, center, size]);

  const moonLayouts = useMemo((): OrbitNodeLayout[] => {
    if (!moonParentLayout || scene.moonNodes.length === 0) return [];
    return computeMoonOrbitPositions(
      scene.moonNodes.map((m) => m.id),
      { x: moonParentLayout.x, y: moonParentLayout.y },
      center,
      size,
      scene.moonParentId!,
    );
  }, [moonParentLayout, scene.moonNodes, scene.moonParentId, center, size]);

  const moonById = useMemo(
    () => new Map(scene.moonNodes.map((m) => [m.id, m])),
    [scene.moonNodes],
  );

  const highlightPrimaryId = useMemo(() => {
    if (scene.selectedNodeId && primaryIds.includes(scene.selectedNodeId)) {
      return scene.selectedNodeId;
    }
    return scene.moonParentId && primaryIds.includes(scene.moonParentId)
      ? scene.moonParentId
      : null;
  }, [scene.selectedNodeId, scene.moonParentId, primaryIds]);

  const planetLabels = useMemo(() => {
    const entries = planetLayouts.map((l) => {
      const p = primaryById.get(l.id)!;
      return {
        id: l.id,
        position: l.position,
        priority:
          l.id === highlightPrimaryId ? 100 : p.decision === "accepted" ? 80 : 50,
        labelBelow: PLANET_RADIUS + 26,
      };
    });
    return resolveLabelPlacements(entries);
  }, [planetLayouts, primaryById, highlightPrimaryId]);

  const moonLabels = useMemo(() => {
    if (!moonParentLayout || moonLayouts.length === 0) return {};
    const textLengths: Record<string, number> = {};
    for (const l of planetLayouts) {
      const p = primaryById.get(l.id)!;
      textLengths[l.id] = p.title.length;
    }
    const planetBoxes = labelPlacementsToExclusionBoxes(planetLabels, textLengths);
    return resolveMoonLabelPlacements(
      moonLayouts,
      { x: moonParentLayout.x, y: moonParentLayout.y },
      {
        placedBoxes: planetBoxes,
        parentExclusionRadius: PLANET_RADIUS + 48,
      },
    );
  }, [moonParentLayout, moonLayouts, planetLayouts, planetLabels, primaryById]);

  const labelPlacements = useMemo(
    () => ({ ...planetLabels, ...moonLabels }),
    [planetLabels, moonLabels],
  );

  const moonOrbitRadius = useMemo(() => {
    if (!moonParentLayout) return 0;
    return moonLayouts[0]?.radius ?? computeMoonOrbitRadius(size);
  }, [moonParentLayout, moonLayouts, size]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (externalRippleKey === undefined) {
        setInternalRippleKey((k) => k + 1);
      }
      onNodeClick(nodeId);
    },
    [onNodeClick, externalRippleKey],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      panSession.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!panSession.current.active) return;
    const dx = e.clientX - panSession.current.startX;
    const dy = e.clientY - panSession.current.startY;
    if (Math.hypot(dx, dy) > PAN_DRAG_THRESHOLD) {
      panSession.current.moved = true;
    }
    setPan({
      x: panSession.current.panX + dx,
      y: panSession.current.panY + dy,
    });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (panSession.current.moved) {
      suppressClickRef.current = true;
    }
    panSession.current.active = false;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const delta = -e.deltaY * ZOOM_WHEEL_SENSITIVITY;
      setZoom((z) => {
        const next = clampZoom(z + delta * Math.max(z, 0.5));
        notifyZoom(next);
        return next;
      });
    },
    [clampZoom, notifyZoom],
  );

  const resolveOpacity = useCallback(
    (nodeId: string, decision: GalaxyNodeDecision, active: boolean) => {
      let opacity = decisionOpacity(decision, active);
      if (
        scene.worldRippleActive &&
        !scene.ripplePulseIds.includes(nodeId) &&
        nodeId !== scene.centerId
      ) {
        opacity *= 0.72;
      }
      return opacity;
    },
    [scene.worldRippleActive, scene.ripplePulseIds, scene.centerId],
  );

  const selectedPrimary = highlightPrimaryId ? primaryById.get(highlightPrimaryId) : null;

  const clusterGlow = theme.aura.replace(/[\d.]+\)$/, "0.12)");

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#06070c]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 55% 45% at ${(center.x / Math.max(size.width, 1)) * 100}% ${(center.y / Math.max(size.height, 1)) * 100}%, ${clusterGlow} 0%, transparent 68%),
            radial-gradient(ellipse 70% 55% at 50% 42%, rgba(28,32,48,0.5) 0%, transparent 62%),
            radial-gradient(ellipse 40% 30% at 72% 18%, rgba(45,40,62,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 35% 25% at 18% 72%, rgba(30,38,52,0.14) 0%, transparent 50%),
            #06070c
          `,
        }}
      />
      <Starfield width={size.width} height={size.height} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 75% at 50% 48%, transparent 35%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <svg
        width={size.width}
        height={size.height}
        className={`absolute inset-0 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        aria-label={`${scene.constellationTitle} exploration`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        <defs>
          <SunGradients theme={theme} />
          <filter id="galaxy-sun-soft-bloom" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="galaxy-link-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="galaxy-label-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={center.x}
          cy={center.y}
          r={computePlanetOrbitRadius(size)}
          fill="none"
          stroke={theme.orbit}
          strokeWidth={0.85}
          strokeDasharray="2 12"
          className="galaxy-v2-orbit-drift"
        />

        {moonParentLayout && scene.moonNodes.length > 0 && (
          <circle
            cx={moonParentLayout.x}
            cy={moonParentLayout.y}
            r={moonOrbitRadius}
            fill="none"
            stroke={theme.orbitMoon}
            strokeWidth={0.85}
            strokeDasharray="2 10"
            className="galaxy-v2-orbit-drift galaxy-v2-orbit-moon"
          />
        )}

        {planetLayouts.map((layout) => {
          const node = primaryById.get(layout.id)!;
          const active = layout.id === highlightPrimaryId;
          const path = computeOrbitArcPath(center, layout.position, 0.1);
          const opacity = resolveOpacity(node.id, node.decision, active);
          const rippleActive =
            showRipple && (active || scene.ripplePulseIds.includes(node.id));
          return (
            <FlowPath
              key={`link-sun-${layout.id}`}
              d={path}
              stroke={active ? theme.linkActive : theme.link}
              strokeWidth={active ? LINK_PRIMARY_ACTIVE : LINK_PRIMARY}
              opacity={Math.min(1, opacity + 0.1)}
              variant={active ? "primary-active" : "primary"}
              ripple={rippleActive}
              rippleKey={rippleKey}
              rippleStroke={theme.linkActive}
            />
          );
        })}

        {moonParentLayout &&
          moonLayouts.map((layout) => {
            const path = computeOrbitArcPath(
              { x: moonParentLayout.x, y: moonParentLayout.y },
              layout.position,
              0.16,
            );
            return (
              <FlowPath
                key={`link-moon-${layout.id}`}
                d={path}
                stroke={theme.linkMoon}
                strokeWidth={LINK_MOON}
                opacity={0.94}
                variant="moon"
                ripple={showRipple}
                rippleKey={`${rippleKey}-${layout.id}`}
                rippleStroke={theme.linkMoon}
              />
            );
          })}

        <g className="galaxy-v2-sun">
          <circle
            cx={center.x}
            cy={center.y}
            r={SUN_RADIUS * 2.8}
            fill="url(#galaxy-sun-bloom-outer)"
            className="galaxy-v2-sun-outer"
          />
          <circle
            cx={center.x}
            cy={center.y}
            r={SUN_RADIUS * 1.75}
            fill="url(#galaxy-sun-bloom-mid)"
          />
          <circle
            cx={center.x}
            cy={center.y}
            r={SUN_RADIUS * 1.35}
            fill="url(#galaxy-sun-bloom-inner)"
          />
          <circle
            cx={center.x}
            cy={center.y}
            r={SUN_RADIUS}
            fill="url(#galaxy-sun-body)"
            stroke={theme.ring}
            strokeOpacity={0.55}
            strokeWidth={1.1}
            filter="url(#galaxy-sun-soft-bloom)"
          />
          <text
            x={center.x}
            y={center.y + SUN_RADIUS + 26}
            textAnchor="middle"
            className="text-[10px] font-medium uppercase tracking-[0.24em]"
            fill={theme.labelMuted}
          >
            {scene.centerTitle}
          </text>
        </g>

        {planetLayouts.map((layout) => {
          const node = primaryById.get(layout.id)!;
          const active = layout.id === highlightPrimaryId;
          const opacity = resolveOpacity(node.id, node.decision, active);
          const label = labelPlacements[layout.id];
          const colors = markerPaletteFromTheme(theme, node.decision, active);

          return (
            <g
              key={layout.id}
              className="cursor-pointer transition-opacity duration-300"
              opacity={opacity}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => handleNodeClick(node.id)}
              role="button"
              tabIndex={0}
              aria-label={node.title}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleNodeClick(node.id);
              }}
            >
              <PrimaryOrbitMarker x={layout.position.x} y={layout.position.y} colors={colors} active={active} />
              {label && (
                <NodeLabel
                  x={label.x}
                  y={label.y}
                  text={node.title}
                  active={active}
                  size="planet"
                  theme={theme}
                />
              )}
            </g>
          );
        })}

        {moonLayouts.map((layout) => {
          const moon = moonById.get(layout.id)!;
          const label = labelPlacements[layout.id];
          const colors = moonPaletteFromTheme(theme);
          const selected = scene.selectedNodeId === moon.id;
          return (
            <g
              key={layout.id}
              opacity={resolveOpacity(moon.id, moon.decision, selected)}
              className="galaxy-v2-moon-marker cursor-pointer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => handleNodeClick(moon.id)}
              role="button"
              tabIndex={0}
              aria-label={moon.title}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleNodeClick(moon.id);
              }}
            >
              <SecondaryOrbitMarker x={layout.position.x} y={layout.position.y} colors={colors} />
              {label && (
                <NodeLabel
                  x={label.x}
                  y={label.y}
                  text={moon.title}
                  active={selected}
                  size="moon"
                  theme={theme}
                />
              )}
            </g>
          );
        })}
        </g>
      </svg>

      {showStatusStrip && (
        <div className="pointer-events-none absolute bottom-5 left-5 text-[10px] tracking-wide text-slate-500/70">
          <span className="uppercase tracking-[0.18em] text-slate-400/85">
            {scene.constellationTitle}
          </span>
          {selectedPrimary && (
            <>
              <span className="mx-2 text-slate-700">/</span>
              <span style={{ color: theme.labelActive }}>{selectedPrimary.title}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

GalaxyOrbitalScene.displayName = "GalaxyOrbitalScene";

export default GalaxyOrbitalScene;

function SunGradients({ theme }: { theme: ConstellationTheme }) {
  return (
    <>
      <radialGradient id="galaxy-sun-bloom-inner" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={theme.sunBloomInner} />
        <stop offset="100%" stopColor={fadeToTransparent(theme.sunBloomInner)} />
      </radialGradient>
      <radialGradient id="galaxy-sun-bloom-mid" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={theme.sunBloomMid} />
        <stop offset="100%" stopColor={fadeToTransparent(theme.sunBloomMid)} />
      </radialGradient>
      <radialGradient id="galaxy-sun-bloom-outer" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={theme.sunBloomOuter} />
        <stop offset="100%" stopColor={fadeToTransparent(theme.sunBloomOuter)} />
      </radialGradient>
      <radialGradient id="galaxy-sun-body" cx="38%" cy="35%" r="65%">
        <stop offset="0%" stopColor={theme.sunCore} />
        <stop offset="55%" stopColor={theme.sunInner} />
        <stop offset="100%" stopColor={theme.sunEdge} />
      </radialGradient>
    </>
  );
}

function FlowPath({
  d,
  stroke,
  strokeWidth,
  opacity = 1,
  variant,
  ripple = false,
  rippleKey,
  rippleStroke,
}: {
  d: string;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  variant: "primary" | "primary-active" | "moon";
  ripple?: boolean;
  rippleKey?: string | number;
  rippleStroke?: string;
}) {
  const flowClass =
    variant === "moon"
      ? "galaxy-v2-flow-path galaxy-v2-flow-path-moon"
      : variant === "primary-active"
        ? "galaxy-v2-flow-path galaxy-v2-flow-path-active"
        : "galaxy-v2-flow-path";

  return (
    <g opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth + 1.5}
        strokeOpacity={0.22}
        filter="url(#galaxy-link-glow)"
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={flowClass}
        filter="url(#galaxy-link-glow)"
      />
      {ripple && (
        <path
          key={rippleKey}
          d={d}
          fill="none"
          stroke={rippleStroke ?? stroke}
          strokeWidth={strokeWidth + 0.25}
          strokeOpacity={0.5}
          className="galaxy-v2-ripple-path"
        />
      )}
    </g>
  );
}

function PrimaryOrbitMarker({
  x,
  y,
  colors,
  active,
}: {
  x: number;
  y: number;
  colors: MarkerPalette;
  active: boolean;
}) {
  return (
    <>
      <circle cx={x} cy={y} r={PRIMARY_RING_R + 8} fill="transparent" />
      {active && (
        <circle
          cx={x}
          cy={y}
          r={PRIMARY_RING_R + 14}
          fill={colors.aura}
          className="galaxy-v2-halo-shimmer"
        />
      )}
      {active && (
        <circle
          cx={x}
          cy={y}
          r={PRIMARY_RING_R + 7}
          fill="none"
          stroke={colors.ringInner}
          strokeWidth={0.6}
          strokeDasharray="2 5"
          className="galaxy-v2-focus-ring-outer"
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={PRIMARY_RING_R}
        fill="none"
        stroke={colors.ring}
        strokeWidth={active ? 1.15 : 0.9}
        className={active ? "galaxy-v2-focus-ring" : undefined}
      />
      <circle
        cx={x}
        cy={y}
        r={PRIMARY_RING_R * 0.55}
        fill="none"
        stroke={colors.ringInner}
        strokeWidth={0.55}
        strokeDasharray="1 4"
        opacity={0.82}
      />
      <circle cx={x} cy={y} r={PRIMARY_CORE_R} fill={colors.core} />
      <circle cx={x} cy={y} r={PRIMARY_CORE_R * 0.45} fill="rgba(255,255,255,0.42)" />
    </>
  );
}

function SecondaryOrbitMarker({
  x,
  y,
  colors,
}: {
  x: number;
  y: number;
  colors: MarkerPalette;
}) {
  return (
    <>
      <circle
        cx={x}
        cy={y}
        r={SECONDARY_RING_R + 4}
        fill={colors.aura}
        className="galaxy-v2-moon-presence"
      />
      <circle cx={x} cy={y} r={SECONDARY_RING_R} fill="none" stroke={colors.ring} strokeWidth={0.8} />
      <circle
        cx={x}
        cy={y}
        r={SECONDARY_RING_R * 0.5}
        fill="none"
        stroke={colors.ringInner}
        strokeWidth={0.45}
        strokeDasharray="1 3"
        opacity={0.85}
      />
      <circle cx={x} cy={y} r={SECONDARY_CORE_R} fill={colors.core} />
      <circle cx={x} cy={y} r={SECONDARY_CORE_R * 0.4} fill="rgba(255,255,255,0.28)" />
    </>
  );
}

function NodeLabel({
  x,
  y,
  text,
  active,
  size,
  theme,
}: {
  x: number;
  y: number;
  text: string;
  active: boolean;
  size: "planet" | "moon";
  theme: ConstellationTheme;
}) {
  const fontSize = size === "moon" ? 10 : 11.5;

  if (active) {
    return (
      <text
        x={x}
        y={y + 11}
        textAnchor="middle"
        fill={theme.labelActive}
        fontSize={fontSize}
        fontWeight={500}
        letterSpacing="0.02em"
        filter="url(#galaxy-label-glow)"
      >
        {text}
      </text>
    );
  }

  const estWidth = Math.min(text.length * (size === "moon" ? 5.6 : 6) + 16, 158);
  const h = size === "moon" ? 16 : 18;

  return (
    <g>
      <rect
        x={x - estWidth / 2}
        y={y - 1}
        width={estWidth}
        height={h}
        rx={2}
        fill={LABEL_PLATE}
        stroke="rgba(71,85,105,0.2)"
        strokeWidth={0.45}
      />
      <text
        x={x}
        y={y + (size === "moon" ? 10 : 11)}
        textAnchor="middle"
        fill={theme.labelMuted}
        fontSize={fontSize}
        fontWeight={400}
        letterSpacing="0.015em"
      >
        {text}
      </text>
    </g>
  );
}

function Starfield({ width, height }: { width: number; height: number }) {
  const stars = useMemo(() => {
    const items: { x: number; y: number; r: number; o: number }[] = [];
    let seed = 42;
    for (let i = 0; i < 48; i++) {
      seed = (seed * 16807 + 12345) % 2147483647;
      const fx = (seed % 10000) / 10000;
      seed = (seed * 16807 + 12345) % 2147483647;
      const fy = (seed % 10000) / 10000;
      seed = (seed * 16807 + 12345) % 2147483647;
      const fr = (seed % 100) / 100;
      items.push({
        x: fx * width,
        y: fy * height,
        r: 0.35 + fr * 0.65,
        o: 0.06 + fr * 0.22,
      });
    }
    return items;
  }, [width, height]);

  return (
    <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={`rgba(180,190,210,${s.o})`} />
      ))}
    </svg>
  );
}

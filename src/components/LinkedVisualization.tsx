import React, { useState, useRef, useCallback, useMemo } from "react";
import { SP, C, R } from "../styles/tokens";
import { S_CURSOR_POINTER } from "../styles/shared";
import { useTranslation } from "../i18n";
import { LinkedVisualizationGuides } from "./LinkedVisualizationGuides";
import { LinkedVisualizationLegend } from "./LinkedVisualizationLegend";
import { BottomProjectionGraph, RightProjectionGraph } from "./LinkedVisualizationProjectionGraphs";
import { LinkedVisualizationWheel } from "./LinkedVisualizationWheel";
import {
  buildLinkedVisualizationDots,
  BXright,
  BY,
  clampHueFromBottomGraphY,
  clampHueFromRightGraphX,
  cosinePath,
  CX,
  CY,
  lumR0,
  lumR7,
  LV_COLORS,
  sinePath,
  TH,
  TW,
  WO,
  type LinkedVisualizationDot,
  type LinkedVisualizationHover,
} from "./linked-visualization-geometry";

export type { LinkedVisualizationDot } from "./linked-visualization-geometry";

export interface LinkedVisualizationOverlayContext {
  activeDots: LinkedVisualizationDot[];
  activeAlpha: number;
  hoveredDot: LinkedVisualizationHover | null;
  setHoveredDot: (d: LinkedVisualizationHover | null) => void;
  x: number;
  y: number;
  rowHeight: number;
  width: number;
}

export interface LinkedVisualizationProps {
  hueAngleDeg: number;
  brushLevel: number;
  onHueAngleDegChange?: (angle: number) => void;
  hoveredCandidate?: LinkedVisualizationHover | null;
  onHoverCandidate?: (d: LinkedVisualizationHover | null) => void;
  candidateOverridesByLevel?: Map<number, number>;
  showLegend?: boolean;
  bottomRightOverlay?: (ctx: LinkedVisualizationOverlayContext) => React.ReactNode;
  /** Controlled alpha state (for Music tab integration) */
  alpha0?: number;
  onAlpha0Change?: (angleDeg: number) => void;
  alpha7?: number;
  onAlpha7Change?: (angleDeg: number) => void;
  /** Callback when L0/L7 origin mode changes */
  onOriginModeChange?: (mode: 0 | 7) => void;
}

const DOT_HIT_R = 10;
const DOT_TRANSITION = "r 0.3s, opacity 0.3s, stroke 0.3s, stroke-width 0.3s, fill 0.3s";

/* ── Toggle button style ── */
const S_TOGGLE: React.CSSProperties = {
  padding: "var(--linked-viz-toggle-padding, 3px 10px)",
  fontSize: "var(--linked-viz-toggle-fs, 11px)",
  lineHeight: "var(--linked-viz-toggle-line, 14px)",
  borderRadius: R.md,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  background: "transparent",
  color: C.textSecondary,
  transition: "all 0.15s",
  whiteSpace: "nowrap",
};
const S_TOGGLE_ACTIVE: React.CSSProperties = {
  padding: "var(--linked-viz-toggle-padding, 3px 10px)",
  fontSize: "var(--linked-viz-toggle-fs, 11px)",
  lineHeight: "var(--linked-viz-toggle-line, 14px)",
  borderRadius: R.md,
  border: `1px solid ${C.accent}`,
  cursor: "pointer",
  background: C.accent,
  color: C.bgRoot,
  transition: "all 0.15s",
  whiteSpace: "nowrap",
};

export const LinkedVisualization = React.memo(function LinkedVisualization({
  hueAngleDeg,
  brushLevel,
  onHueAngleDegChange,
  hoveredCandidate,
  onHoverCandidate,
  candidateOverridesByLevel,
  showLegend = true,
  bottomRightOverlay,
  alpha0: alpha0Prop,
  onAlpha0Change,
  alpha7: alpha7Prop,
  onAlpha7Change,
  onOriginModeChange,
}: LinkedVisualizationProps) {
  const { t } = useTranslation();
  const [mode, setModeInternal] = useState<0 | 7>(0);
  const setMode = useCallback(
    (m: 0 | 7) => {
      setModeInternal(m);
      onOriginModeChange?.(m);
    },
    [onOriginModeChange],
  );
  const [alpha0Internal, setAlpha0Internal] = useState(0);
  const [alpha7Internal, setAlpha7Internal] = useState(0);
  const alpha0 = alpha0Prop ?? alpha0Internal;
  const alpha7 = alpha7Prop ?? alpha7Internal;
  const setAlpha0 = useMemo<React.Dispatch<React.SetStateAction<number>>>(
    () =>
      onAlpha0Change
        ? (v) => {
            onAlpha0Change(typeof v === "function" ? (v as (prev: number) => number)(alpha0) : v);
          }
        : setAlpha0Internal,
    [alpha0, onAlpha0Change],
  );
  const setAlpha7 = useMemo<React.Dispatch<React.SetStateAction<number>>>(
    () =>
      onAlpha7Change
        ? (v) => {
            onAlpha7Change(typeof v === "function" ? (v as (prev: number) => number)(alpha7) : v);
          }
        : setAlpha7Internal,
    [alpha7, onAlpha7Change],
  );
  const [localHoveredDot, setLocalHoveredDot] = useState<LinkedVisualizationHover | null>(null);
  const hoveredDot = onHoverCandidate ? (hoveredCandidate ?? null) : localHoveredDot;
  const setHoveredDot = onHoverCandidate ?? setLocalHoveredDot;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ type: "wheel"; startAngle: number; startAlpha: number } | { type: "hue" } | { type: "hue-bottom" } | null>(null);

  const activeAlpha = mode === 0 ? alpha0 : alpha7;
  const activeRadiusFn = mode === 0 ? lumR0 : lumR7;

  // Compute dots
  const dots = useMemo(() => {
    return buildLinkedVisualizationDots(hueAngleDeg, candidateOverridesByLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- brushLevel triggers re-render for active dot updates
  }, [hueAngleDeg, brushLevel, candidateOverridesByLevel]);

  const activeDots = useMemo(() => dots.filter((d) => d.isActive), [dots]);
  const projectionDots = useMemo(() => [...dots].sort((a, b) => Number(a.isActive) - Number(b.isActive)), [dots]);

  // SVG coordinate conversion
  const svgCoord = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (clientX - rect.left) * (TW / rect.width), y: (clientY - rect.top) * (TH / rect.height) };
  }, []);

  // Wheel rotation drag
  const onWheelPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pt = svgCoord(e.clientX, e.clientY);
      const angle = (Math.atan2(pt.y - CY, pt.x - CX) * 180) / Math.PI;
      dragRef.current = { type: "wheel", startAngle: angle, startAlpha: activeAlpha };
      svgRef.current?.setPointerCapture(e.pointerId);
    },
    [activeAlpha, svgCoord],
  );

  // Hue line drag (on right graph)
  const onHuePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      dragRef.current = { type: "hue" };
      svgRef.current?.setPointerCapture(e.pointerId);
      // Immediately update hue
      const pt = svgCoord(e.clientX, e.clientY);
      const hue = clampHueFromRightGraphX(pt.x);
      onHueAngleDegChange?.(Math.round(hue));
    },
    [svgCoord, onHueAngleDegChange],
  );

  // Hue line drag (on bottom graph)
  const onHueBottomPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      dragRef.current = { type: "hue-bottom" };
      svgRef.current?.setPointerCapture(e.pointerId);
      const pt = svgCoord(e.clientX, e.clientY);
      const hue = clampHueFromBottomGraphY(pt.y);
      onHueAngleDegChange?.(Math.round(hue));
    },
    [svgCoord, onHueAngleDegChange],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pt = svgCoord(e.clientX, e.clientY);
      if (drag.type === "wheel") {
        const angle = (Math.atan2(pt.y - CY, pt.x - CX) * 180) / Math.PI;
        const delta = angle - drag.startAngle;
        const newAlpha = (((drag.startAlpha - delta) % 360) + 360) % 360;
        if (mode === 0) setAlpha0(newAlpha);
        else setAlpha7(newAlpha);
      } else if (drag.type === "hue") {
        const hue = clampHueFromRightGraphX(pt.x);
        onHueAngleDegChange?.(Math.round(hue));
      } else if (drag.type === "hue-bottom") {
        const hue = clampHueFromBottomGraphY(pt.y);
        onHueAngleDegChange?.(Math.round(hue));
      }
    },
    [svgCoord, mode, setAlpha0, setAlpha7, onHueAngleDegChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Pre-compute all sine/cosine paths so vizContent doesn't recalculate them
  const sinePaths = useMemo(() => {
    const r0: Record<number, string> = {};
    const r7: Record<number, string> = {};
    for (let levelIndex = 0; levelIndex <= 7; levelIndex++) {
      r0[levelIndex] = sinePath(levelIndex, lumR0, alpha0);
      r7[levelIndex] = sinePath(levelIndex, lumR7, alpha7);
    }
    return { r0, r7 };
  }, [alpha0, alpha7]);

  const cosinePaths = useMemo(() => {
    const r0: Record<number, string> = {};
    const r7: Record<number, string> = {};
    for (let levelIndex = 0; levelIndex <= 7; levelIndex++) {
      r0[levelIndex] = cosinePath(levelIndex, lumR0, alpha0);
      r7[levelIndex] = cosinePath(levelIndex, lumR7, alpha7);
    }
    return { r0, r7 };
  }, [alpha0, alpha7]);

  // Hover helpers
  const dotHandlers = (d: LinkedVisualizationDot) => ({
    onPointerEnter: () => setHoveredDot({ levelIndex: d.levelIndex, candidateIndex: d.candidateIndex }),
    onPointerLeave: () => setHoveredDot(null),
    style: S_CURSOR_POINTER,
  });
  const legendL0 = mode === 0 ? t("linkedviz_legend_l0_origin") : t("linkedviz_legend_l0_boundary");
  const legendL7 = mode === 0 ? t("linkedviz_legend_l7_boundary") : t("linkedviz_legend_l7_origin");

  // Main visualization content
  const vizContent = useMemo(() => {
    const lvColor = (levelIndex: number) => {
      // Use hovered dot's color if hovering a specific candidate for this level
      if (hoveredDot && hoveredDot.levelIndex === levelIndex) {
        const hd = dots.find((dd) => dd.levelIndex === levelIndex && dd.candidateIndex === hoveredDot.candidateIndex);
        if (hd) return `rgb(${hd.rgb.join(",")})`;
      }
      const d = activeDots.find((ad) => ad.levelIndex === levelIndex);
      return d ? `rgb(${d.rgb.join(",")})` : LV_COLORS[levelIndex];
    };

    return (
      <>
        <LinkedVisualizationGuides
          dots={dots}
          activeDots={activeDots}
          hoveredDot={hoveredDot}
          activeAlpha={activeAlpha}
          activeRadiusFn={activeRadiusFn}
          alpha0={alpha0}
          alpha7={alpha7}
          mode={mode}
        />

        <RightProjectionGraph
          mode={mode}
          hueAngleDeg={hueAngleDeg}
          alpha0={alpha0}
          alpha7={alpha7}
          activeAlpha={activeAlpha}
          activeRadiusFn={activeRadiusFn}
          activeDots={activeDots}
          projectionDots={projectionDots}
          hoveredDot={hoveredDot}
          dotHandlers={dotHandlers}
          lvColor={lvColor}
          paths={sinePaths}
          dotHitR={DOT_HIT_R}
          dotTransition={DOT_TRANSITION}
          axisLabel={t("linkedviz_axis_sin")}
          onHuePointerDown={onHuePointerDown}
        />

        <BottomProjectionGraph
          mode={mode}
          hueAngleDeg={hueAngleDeg}
          alpha0={alpha0}
          alpha7={alpha7}
          activeAlpha={activeAlpha}
          activeRadiusFn={activeRadiusFn}
          activeDots={activeDots}
          projectionDots={projectionDots}
          hoveredDot={hoveredDot}
          dotHandlers={dotHandlers}
          lvColor={lvColor}
          paths={cosinePaths}
          dotHitR={DOT_HIT_R}
          dotTransition={DOT_TRANSITION}
          axisLabel={t("linkedviz_axis_cos")}
          onHuePointerDown={onHueBottomPointerDown}
        />

        {showLegend && (
          <LinkedVisualizationLegend
            activeDots={activeDots}
            hoveredDot={hoveredDot}
            setHoveredDot={setHoveredDot}
            dotHandlers={dotHandlers}
            legendL0={legendL0}
            legendL7={legendL7}
          />
        )}
        {!showLegend &&
          bottomRightOverlay?.({
            activeDots,
            activeAlpha,
            hoveredDot,
            setHoveredDot,
            x: BXright + 10,
            y: BY + 16,
            rowHeight: 24,
            width: TW,
          })}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hoveredDot is intentionally reactive
  }, [
    dots,
    hueAngleDeg,
    alpha0,
    alpha7,
    mode,
    activeAlpha,
    activeRadiusFn,
    sinePaths,
    cosinePaths,
    hoveredDot,
    onHuePointerDown,
    onHueBottomPointerDown,
    legendL0,
    legendL7,
    showLegend,
    bottomRightOverlay,
    activeDots,
    projectionDots,
  ]);

  const deltaAlpha = Math.round((((alpha0 - alpha7) % 360) + 360) % 360);
  const isInverted = deltaAlpha === 180;

  return (
    <div className="linked-viz-root" style={{ marginTop: SP.xl, textAlign: "center" }}>
      {/* L0/L7 Toggle + Δα controls */}
      <div
        className="linked-viz-controls"
        style={{
          marginBottom: SP.md,
          display: "flex",
          flexWrap: "nowrap",
          gap: "var(--linked-viz-control-gap, 3px)",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: "100%",
          minWidth: 0,
        }}
      >
        <button type="button" style={mode === 0 ? S_TOGGLE_ACTIVE : S_TOGGLE} onClick={() => setMode(0)}>
          {t("linkedviz_mode_l0")}
        </button>
        <button type="button" style={mode === 7 ? S_TOGGLE_ACTIVE : S_TOGGLE} onClick={() => setMode(7)}>
          {t("linkedviz_mode_l7")}
        </button>
        <span
          style={{
            color: isInverted ? C.accent : C.textDim,
            fontSize: "var(--linked-viz-toggle-fs, 11px)",
            width: "var(--linked-viz-delta-width, 62px)",
            textAlign: "right",
            display: "inline-block",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {"\u0394\u03b1:\u00a0" + deltaAlpha + "\u00b0"}
        </span>
        <button type="button" style={deltaAlpha === 0 ? S_TOGGLE_ACTIVE : S_TOGGLE} onClick={() => setAlpha7(alpha0)}>
          {t("linkedviz_in_phase")}
        </button>
        <button type="button" style={isInverted ? S_TOGGLE_ACTIVE : S_TOGGLE} onClick={() => setAlpha7((alpha0 + 180) % 360)}>
          {t("linkedviz_anti_phase")}
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${TW} ${TH}`}
        width="100%"
        style={{ maxWidth: "min(500px, calc(100vw - 24px))" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {vizContent}

        <LinkedVisualizationWheel
          alpha={activeAlpha}
          radiusFn={activeRadiusFn}
          dots={dots}
          hueAngleDeg={hueAngleDeg}
          hoveredDot={hoveredDot}
          onHoverDot={setHoveredDot}
          mode={mode}
          onPointerDown={onWheelPointerDown}
        />

        {/* Label with rotation angle */}
        <text x={CX} y={WO - 2} fontSize={8} fill={C.textDimmer} textAnchor="middle">
          {mode === 0 ? `\u03b1\u2080: ${Math.round(alpha0)}\u00b0` : `\u03b1\u2087: ${Math.round(alpha7)}\u00b0`}
        </text>
      </svg>
    </div>
  );
});

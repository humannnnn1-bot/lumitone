import React, { useState, useRef, useCallback, useMemo } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES, findClosestCandidate, hue2rgb } from "../color-engine";
import { SP, C, R } from "../tokens";
import { useTranslation } from "../i18n";

interface LinkedVizProps {
  hueAngle: number;
  brushLevel: number;
  onHueAngleChange?: (angle: number) => void;
}

/* ── Layout constants ── */
const WR = 58;
const WO = 18; // left/top margin for axis labels
const WCX = 68;
const WCY = 68;
const RING_R = 70; // hue ring outer edge + margin
const GRAPH_GAP = 2; // minimal gap between ring and graph

// Single wheel center
const CX = WO + WCX; // 86
const CY = WO + WCY; // 86

// Right graph (sine: Y-projection) — flush with wheel
const RX = CX + RING_R + GRAPH_GAP; // 158
const RW = 170;
const RYtop = CY - WR - 4; // 24
const RYbot = CY + WR + 4; // 148
const RH = RYbot - RYtop; // 124

// Bottom graph (cosine: X-projection) — flush with wheel
const BY = CY + RING_R + GRAPH_GAP; // 158
const BXleft = CX - WR - 4; // 24
const BXright = CX + WR + 4; // 148
const BW = BXright - BXleft; // 124
const BH = 170;

// Total SVG
const TW = RX + RW + 4; // 332
const TH = BY + BH + 16; // 344

// Active levels (skip black=0, white=7)
const ACTIVE_LEVELS = [1, 2, 3, 4, 5, 6];
const HUE_LABELS = [0, 60, 120, 180, 240, 300, 360];

// Level display colors
const LV_COLORS = ["", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", ""];

// C2 symmetry pairs: level a + level b = 7
const C2_PAIR: Record<number, number> = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };

const lumR0 = (lv: number) => (LEVEL_INFO[lv].gray / 255) * WR;
const lumR7 = (lv: number) => (1 - LEVEL_INFO[lv].gray / 255) * WR;

/* ── Dot type ── */
interface Dot {
  lv: number;
  ci: number;
  a: number;
  rgb: [number, number, number];
  act: boolean;
}

/* ── Wheel rendering ── */
interface WheelOpts {
  cx: number;
  cy: number;
  alpha: number;
  radiusFn: (lv: number) => number;
  dots: Dot[];
  hueAngle: number;
  hoveredDot: { lv: number; ci: number } | null;
  onHoverDot: (d: { lv: number; ci: number } | null) => void;
  mode: 0 | 7;
}

function renderWheel({ cx, cy, alpha, radiusFn, dots, hueAngle, hoveredDot, onHoverDot, mode }: WheelOpts) {
  const wP = (a: number, lv: number) => {
    const rad = ((a - alpha - 90) * Math.PI) / 180;
    const r = radiusFn(lv);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const sweepRad = ((hueAngle - alpha - 90) * Math.PI) / 180;

  return (
    <g>
      {/* Hue ring (rotates with wheel) */}
      {Array.from({ length: 360 }, (_, d) => {
        const r = ((d - alpha - 90) * Math.PI) / 180;
        const [cr, cg, cb] = hue2rgb(d);
        return (
          <line
            key={`h${d}`}
            x1={cx + 64 * Math.cos(r)}
            y1={cy + 64 * Math.sin(r)}
            x2={cx + 69 * Math.cos(r)}
            y2={cy + 69 * Math.sin(r)}
            stroke={`rgb(${cr},${cg},${cb})`}
            strokeWidth={1.5}
          />
        );
      })}
      {/* Level circles */}
      {LEVEL_INFO.map((_, lv) => {
        const r = radiusFn(lv);
        return r > 1 ? <circle key={`g${lv}`} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} /> : null;
      })}
      {/* Center dot: fixed origin level (achromatic, no angle) */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={mode === 0 ? "#000" : "#fff"}
        stroke={mode === 0 ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
        strokeWidth={0.8}
      />
      <circle cx={cx} cy={cy} r={WR} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} strokeDasharray="2,2" />
      {/* C2 symmetry lines */}
      {/* C2 symmetry */}
      {(
        [
          [1, 6],
          [2, 5],
          [3, 4],
        ] as [number, number][]
      ).flatMap(([a, b]) =>
        LEVEL_CANDIDATES[a].map((ca, ci) => {
          if (ca.angle < 0) return null;
          const comp = (ca.angle + 180) % 360;
          const ciB = LEVEL_CANDIDATES[b].findIndex((cb) => Math.abs(((cb.angle - comp + 540) % 360) - 180) < 1);
          if (ciB < 0) return null;
          const pA = wP(ca.angle, a),
            pB = wP(LEVEL_CANDIDATES[b][ciB].angle, b);
          return (
            <line
              key={`s${a}${ci}`}
              x1={pA.x}
              y1={pA.y}
              x2={pB.x}
              y2={pB.y}
              stroke={C.accent}
              strokeWidth={0.5}
              strokeDasharray="3,2"
              opacity={0.2}
            />
          );
        }),
      )}
      {/* Active connections (Catmull-Rom spline) */}
      {(() => {
        const p = dots.filter((d) => d.act).map((d) => wP(d.a, d.lv));
        if (p.length < 2) return null;
        const t = 0.5; // tension
        let d = `M${p[0].x},${p[0].y}`;
        for (let i = 0; i < p.length - 1; i++) {
          const p0 = p[Math.max(0, i - 1)];
          const p1 = p[i];
          const p2 = p[i + 1];
          const p3 = p[Math.min(p.length - 1, i + 2)];
          const cp1x = p1.x + (p2.x - p0.x) / (6 / t);
          const cp1y = p1.y + (p2.y - p0.y) / (6 / t);
          const cp2x = p2.x - (p3.x - p1.x) / (6 / t);
          const cp2y = p2.y - (p3.y - p1.y) / (6 / t);
          d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
        }
        return <path d={d} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />;
      })()}
      {/* Dots */}
      {dots.map((d) => {
        const p = wP(d.a, d.lv);
        const hov = d.act && hoveredDot !== null && hoveredDot.lv === d.lv && hoveredDot.ci === d.ci;
        const dimmed = d.act && hoveredDot !== null && !hov;
        return (
          <circle
            key={`w${d.lv}${d.ci}`}
            cx={p.x}
            cy={p.y}
            r={d.act ? (hov ? 5.5 : 4) : 1.8}
            fill={d.act ? `rgb(${d.rgb.join(",")})` : `rgb(${d.rgb.join(",")})`}
            stroke={d.act ? "#fff" : "rgba(255,255,255,0.15)"}
            strokeWidth={d.act ? (hov ? 1.4 : 1.0) : 0.5}
            opacity={d.act ? (dimmed ? 0.25 : 1) : 0.3}
            filter={hov ? "url(#dot-glow)" : undefined}
            style={d.act ? { cursor: "pointer" } : undefined}
            onPointerEnter={
              d.act
                ? (e) => {
                    e.stopPropagation();
                    onHoverDot({ lv: d.lv, ci: d.ci });
                  }
                : undefined
            }
            onPointerLeave={d.act ? () => onHoverDot(null) : undefined}
          />
        );
      })}
      {/* Angle marker */}
      {(() => {
        const x = cx + 69 * Math.cos(sweepRad),
          y = cy + 69 * Math.sin(sweepRad);
        return (
          <polygon
            points={`${x},${y} ${x + 4 * Math.cos(sweepRad + 2.5)},${y + 4 * Math.sin(sweepRad + 2.5)} ${x + 4 * Math.cos(sweepRad - 2.5)},${y + 4 * Math.sin(sweepRad - 2.5)}`}
            fill="#fff"
          />
        );
      })()}
    </g>
  );
}

/* ── Toggle button style ── */
const S_TOGGLE: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: 11,
  lineHeight: "14px",
  borderRadius: R.md,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  background: "transparent",
  color: C.textSecondary,
  transition: "all 0.15s",
};
const S_TOGGLE_ACTIVE: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: 11,
  lineHeight: "14px",
  borderRadius: R.md,
  border: `1px solid ${C.accent}`,
  cursor: "pointer",
  background: C.accent,
  color: "#fff",
  transition: "all 0.15s",
};

export const LinkedViz = React.memo(function LinkedViz({ hueAngle, brushLevel, onHueAngleChange }: LinkedVizProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<0 | 7>(0);
  const [alpha0, setAlpha0] = useState(0);
  const [alpha7, setAlpha7] = useState(0);
  const [hoveredDot, setHoveredDot] = useState<{ lv: number; ci: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ type: "wheel"; startAngle: number; startAlpha: number } | { type: "hue" } | { type: "hue-bottom" } | null>(null);

  const activeAlpha = mode === 0 ? alpha0 : alpha7;
  const activeRadiusFn = mode === 0 ? lumR0 : lumR7;

  // Compute dots
  const dots = useMemo(() => {
    const result: Dot[] = [];
    for (let lv = 0; lv < LEVEL_CANDIDATES.length; lv++)
      for (let ci = 0; ci < LEVEL_CANDIDATES[lv].length; ci++) {
        const c = LEVEL_CANDIDATES[lv][ci];
        if (c.angle < 0) continue;
        result.push({ lv, ci, a: c.angle, rgb: c.rgb, act: findClosestCandidate(lv, hueAngle) === ci });
      }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- brushLevel triggers re-render for active dot updates
  }, [hueAngle, brushLevel]);

  // Wheel dot position (for guide lines)
  const wP = useCallback(
    (a: number, lv: number) => {
      const rad = ((a - activeAlpha - 90) * Math.PI) / 180;
      const r = activeRadiusFn(lv);
      return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
    },
    [activeAlpha, activeRadiusFn],
  );

  // Graph mapping
  const rPx = (a: number) => RX + 10 + (a / 360) * (RW - 14);
  const bPy = (a: number) => BY + 8 + (a / 360) * (BH - 16);

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
      const hue = Math.max(0, Math.min(360, ((pt.x - RX - 10) / (RW - 14)) * 360));
      onHueAngleChange?.(Math.round(hue));
    },
    [svgCoord, onHueAngleChange],
  );

  // Hue line drag (on bottom graph)
  const onHueBottomPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      dragRef.current = { type: "hue-bottom" };
      svgRef.current?.setPointerCapture(e.pointerId);
      const pt = svgCoord(e.clientX, e.clientY);
      const hue = Math.max(0, Math.min(360, ((pt.y - BY - 8) / (BH - 16)) * 360));
      onHueAngleChange?.(Math.round(hue));
    },
    [svgCoord, onHueAngleChange],
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
        const hue = Math.max(0, Math.min(360, ((pt.x - RX - 10) / (RW - 14)) * 360));
        onHueAngleChange?.(Math.round(hue));
      } else if (drag.type === "hue-bottom") {
        const hue = Math.max(0, Math.min(360, ((pt.y - BY - 8) / (BH - 16)) * 360));
        onHueAngleChange?.(Math.round(hue));
      }
    },
    [svgCoord, mode, onHueAngleChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Generate continuous sine path for right graph
  const sinePath = useCallback((lv: number, radiusFn: (lv: number) => number, alpha: number) => {
    const r = radiusFn(lv);
    if (r < 1) return "";
    const pts: string[] = [];
    for (let h = 0; h <= 360; h += 2) {
      const rad = ((h - alpha - 90) * Math.PI) / 180;
      const y = CY + r * Math.sin(rad);
      pts.push(`${h === 0 ? "M" : "L"}${rPx(h).toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, []);

  // Generate continuous cosine path for bottom graph
  const cosinePath = useCallback((lv: number, radiusFn: (lv: number) => number, alpha: number) => {
    const r = radiusFn(lv);
    if (r < 1) return "";
    const pts: string[] = [];
    for (let h = 0; h <= 360; h += 2) {
      const rad = ((h - alpha - 90) * Math.PI) / 180;
      const x = CX + r * Math.cos(rad);
      pts.push(`${h === 0 ? "M" : "L"}${x.toFixed(1)},${bPy(h).toFixed(1)}`);
    }
    return pts.join(" ");
  }, []);

  // Hover helpers
  const isHovered = (d: Dot) => hoveredDot !== null && hoveredDot.lv === d.lv && hoveredDot.ci === d.ci;
  const dotHandlers = (d: Dot) => ({
    onPointerEnter: () => setHoveredDot({ lv: d.lv, ci: d.ci }),
    onPointerLeave: () => setHoveredDot(null),
    style: { cursor: "pointer" as const },
  });
  const dotOpacity = (d: Dot) => (hoveredDot === null ? 1 : isHovered(d) ? 1 : 0.25);
  const legendL0 = mode === 0 ? t("linkedviz_legend_l0_origin") : t("linkedviz_legend_l0_boundary");
  const legendL7 = mode === 0 ? t("linkedviz_legend_l7_boundary") : t("linkedviz_legend_l7_origin");

  // Main visualization content
  const vizContent = useMemo(() => {
    const activeDots = dots.filter((d) => d.act);
    const lvColor = (lv: number) => {
      const d = activeDots.find((ad) => ad.lv === lv);
      return d ? `rgb(${d.rgb.join(",")})` : LV_COLORS[lv];
    };

    return (
      <>
        {/* ═══ GUIDE LINES — inactive dots (thin) ═══ */}
        {dots
          .filter((d) => !d.act)
          .map((d) => {
            const w = wP(d.a, d.lv);
            const rad = ((d.a - activeAlpha - 90) * Math.PI) / 180;
            const ry = CY + activeRadiusFn(d.lv) * Math.sin(rad);
            const bx = CX + activeRadiusFn(d.lv) * Math.cos(rad);
            const col = `rgb(${d.rgb.join(",")})`;
            return (
              <g key={`gli-${d.lv}-${d.ci}`} opacity={0.2}>
                <line x1={w.x} y1={w.y} x2={rPx(d.a)} y2={ry} stroke={col} strokeWidth={0.4} strokeDasharray="2,3" />
                <line x1={w.x} y1={w.y} x2={bx} y2={bPy(d.a)} stroke={col} strokeWidth={0.4} strokeDasharray="2,3" />
              </g>
            );
          })}
        {/* ═══ GUIDE LINES — active dots (prominent) ═══ */}
        {activeDots.map((d) => {
          const w = wP(d.a, d.lv);
          const rad = ((d.a - activeAlpha - 90) * Math.PI) / 180;
          const ry = CY + activeRadiusFn(d.lv) * Math.sin(rad);
          const bx = CX + activeRadiusFn(d.lv) * Math.cos(rad);
          const col = `rgb(${d.rgb.join(",")})`;
          const hov = hoveredDot !== null && hoveredDot.lv === d.lv && hoveredDot.ci === d.ci;
          return (
            <g key={`gl-${d.lv}-${d.ci}`} opacity={hov ? 0.7 : 0.4}>
              <line x1={w.x} y1={w.y} x2={rPx(d.a)} y2={ry} stroke={col} strokeWidth={hov ? 0.8 : 0.6} strokeDasharray="3,2" />
              <line x1={w.x} y1={w.y} x2={bx} y2={bPy(d.a)} stroke={col} strokeWidth={hov ? 0.8 : 0.6} strokeDasharray="3,2" />
            </g>
          );
        })}

        {/* ═══ RIGHT GRAPH: Sine (Y-projection) ═══ */}
        <g>
          <rect
            x={RX}
            y={RYtop}
            width={RW}
            height={RH}
            fill="rgba(255,255,255,0.035)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
            rx={4}
          />
          {/* Grid lines */}
          {HUE_LABELS.map((a) => (
            <line key={`rg${a}`} x1={rPx(a)} y1={RYtop} x2={rPx(a)} y2={RYbot} stroke="rgba(255,255,255,0.07)" strokeWidth={0.4} />
          ))}
          <line x1={RX} y1={CY} x2={RX + RW} y2={CY} stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} />
          {/* Origin level center line: r=0 → projection always at CY */}
          <line
            x1={RX}
            y1={CY}
            x2={RX + RW}
            y2={CY}
            stroke={mode === 0 ? "#222" : "#fff"}
            strokeWidth={mode === 0 ? 1.4 : 0.6}
            opacity={mode === 0 ? 0.4 : 0.12}
          />
          <line
            x1={RX}
            y1={CY}
            x2={RX + RW}
            y2={CY}
            stroke={mode === 7 ? "#fff" : "#222"}
            strokeWidth={mode === 7 ? 1.4 : 0.6}
            opacity={mode === 7 ? 0.4 : 0.12}
            strokeDasharray="6,3"
          />
          {/* L7(white) boundary curve in L0 system — full amplitude WR */}
          <path
            d={sinePath(7, lumR0, alpha0)}
            fill="none"
            stroke="#fff"
            strokeWidth={mode === 0 ? 1.4 : 0.6}
            opacity={mode === 0 ? 0.5 : 0.12}
          />
          {/* L0(black) boundary curve in L7 system — full amplitude WR */}
          <path
            d={sinePath(0, lumR7, alpha7)}
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={mode === 7 ? 1.4 : 0.6}
            opacity={mode === 7 ? 0.5 : 0.12}
            strokeDasharray="6,3"
          />
          {/* Boundary dots — outer (oscillating) and center (fixed) */}
          {(() => {
            const yellowDot = activeDots.find((d) => d.lv === 6);
            const blueDot = activeDots.find((d) => d.lv === 1);
            return (
              <>
                {/* L0=origin: White oscillates near Yellow (outer), Black fixed near Blue (center) */}
                {yellowDot &&
                  (() => {
                    const rad = ((yellowDot.a - alpha0 - 90) * Math.PI) / 180;
                    return (
                      <circle
                        cx={rPx(yellowDot.a)}
                        cy={CY + WR * Math.sin(rad)}
                        r={4}
                        fill="#fff"
                        stroke="rgba(0,0,0,0.5)"
                        strokeWidth={0.8}
                        opacity={mode === 0 ? 0.8 : 0.15}
                      />
                    );
                  })()}
                {blueDot && (
                  <circle
                    cx={rPx(blueDot.a)}
                    cy={CY}
                    r={4}
                    fill="#222"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={0.8}
                    opacity={mode === 0 ? 0.8 : 0.15}
                  />
                )}
                {/* L7=origin: Black oscillates near Blue (outer), White fixed near Yellow (center) */}
                {blueDot &&
                  (() => {
                    const rad = ((blueDot.a - alpha7 - 90) * Math.PI) / 180;
                    return (
                      <circle
                        cx={rPx(blueDot.a)}
                        cy={CY + WR * Math.sin(rad)}
                        r={4}
                        fill="#222"
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth={0.8}
                        opacity={mode === 7 ? 0.8 : 0.15}
                      />
                    );
                  })()}
                {yellowDot && (
                  <circle
                    cx={rPx(yellowDot.a)}
                    cy={CY}
                    r={4}
                    fill="#fff"
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth={0.8}
                    opacity={mode === 7 ? 0.8 : 0.15}
                  />
                )}
              </>
            );
          })()}
          {/* Axis label */}
          <text x={RX + RW / 2} y={RYtop - 4} fontSize={10} fill={C.textMuted} textAnchor="middle" fontStyle="italic">
            {t("linkedviz_axis_sin")}
          </text>
          {HUE_LABELS.map((a) => (
            <text key={`ra${a}`} x={rPx(a)} y={RYbot + 12} fontSize={8} fill={C.textMuted} textAnchor="middle">
              {a}°
            </text>
          ))}

          {/* L0 continuous sine curves */}
          {ACTIVE_LEVELS.map((lv) => (
            <path
              key={`rs0-${lv}`}
              d={sinePath(lv, lumR0, alpha0)}
              fill="none"
              stroke={lvColor(lv)}
              strokeWidth={mode === 0 ? 1.8 : 0.8}
              opacity={hoveredDot ? (hoveredDot.lv === lv ? 0.9 : 0.15) : mode === 0 ? 0.65 : 0.2}
            />
          ))}
          {/* L7 continuous sine curves (dashed) */}
          {ACTIVE_LEVELS.map((lv) => (
            <path
              key={`rs7-${lv}`}
              d={sinePath(lv, lumR7, alpha7)}
              fill="none"
              stroke={lvColor(lv)}
              strokeWidth={mode === 7 ? 1.8 : 0.8}
              opacity={hoveredDot ? (hoveredDot.lv === lv ? 0.9 : 0.15) : mode === 7 ? 0.65 : 0.2}
              strokeDasharray="6,3"
            />
          ))}

          {/* Hue angle line (draggable) */}
          <line x1={rPx(hueAngle)} y1={RYtop} x2={rPx(hueAngle)} y2={RYbot} stroke={C.accent} strokeWidth={1} opacity={0.5} />
          {/* Narrow drag handle strip (12px wide) centered on hue line */}
          <rect
            x={rPx(hueAngle) - 6}
            y={RYtop - 5}
            width={12}
            height={RH + 10}
            fill="transparent"
            style={{ cursor: "ew-resize" }}
            onPointerDown={onHuePointerDown}
          />

          {/* Inactive dots on current mode's curves (small, no guide lines) */}
          {dots
            .filter((d) => !d.act)
            .map((d) => {
              const rad = ((d.a - activeAlpha - 90) * Math.PI) / 180;
              const y = CY + activeRadiusFn(d.lv) * Math.sin(rad);
              return (
                <circle
                  key={`ri-${d.lv}-${d.ci}`}
                  cx={rPx(d.a)}
                  cy={y}
                  r={1.8}
                  fill={`rgb(${d.rgb.join(",")})`}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={0.5}
                  opacity={0.3}
                />
              );
            })}
          {/* Active dots on current mode's curves */}
          {activeDots.map((d) => {
            const rad = ((d.a - activeAlpha - 90) * Math.PI) / 180;
            const y = CY + activeRadiusFn(d.lv) * Math.sin(rad);
            const hov = isHovered(d);
            return (
              <circle
                key={`rd-${d.lv}-${d.ci}`}
                cx={rPx(d.a)}
                cy={y}
                r={hov ? 5.5 : 4}
                fill={`rgb(${d.rgb.join(",")})`}
                stroke="#fff"
                strokeWidth={hov ? 1.4 : 1.0}
                opacity={dotOpacity(d)}
                filter={hov ? "url(#dot-glow)" : undefined}
                {...dotHandlers(d)}
              />
            );
          })}
        </g>

        {/* ═══ BOTTOM GRAPH: Cosine (X-projection) ═══ */}
        <g>
          <rect
            x={BXleft}
            y={BY}
            width={BW}
            height={BH}
            fill="rgba(255,255,255,0.035)"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
            rx={4}
          />
          {/* Grid lines */}
          {HUE_LABELS.map((a) => (
            <line key={`bg${a}`} x1={BXleft} y1={bPy(a)} x2={BXright} y2={bPy(a)} stroke="rgba(255,255,255,0.07)" strokeWidth={0.4} />
          ))}
          <line x1={CX} y1={BY} x2={CX} y2={BY + BH} stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} />
          {/* Origin level center line: r=0 → projection always at CX */}
          <line
            x1={CX}
            y1={BY}
            x2={CX}
            y2={BY + BH}
            stroke={mode === 0 ? "#222" : "#fff"}
            strokeWidth={mode === 0 ? 1.4 : 0.6}
            opacity={mode === 0 ? 0.4 : 0.12}
          />
          <line
            x1={CX}
            y1={BY}
            x2={CX}
            y2={BY + BH}
            stroke={mode === 7 ? "#fff" : "#222"}
            strokeWidth={mode === 7 ? 1.4 : 0.6}
            opacity={mode === 7 ? 0.4 : 0.12}
            strokeDasharray="6,3"
          />
          {/* L7(white) boundary curve in L0 system — full amplitude WR */}
          <path
            d={cosinePath(7, lumR0, alpha0)}
            fill="none"
            stroke="#fff"
            strokeWidth={mode === 0 ? 1.4 : 0.6}
            opacity={mode === 0 ? 0.5 : 0.12}
          />
          {/* L0(black) boundary curve in L7 system — full amplitude WR */}
          <path
            d={cosinePath(0, lumR7, alpha7)}
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={mode === 7 ? 1.4 : 0.6}
            opacity={mode === 7 ? 0.5 : 0.12}
            strokeDasharray="6,3"
          />
          {/* Boundary dots — outer (oscillating) and center (fixed) */}
          {(() => {
            const yellowDot = activeDots.find((d) => d.lv === 6);
            const blueDot = activeDots.find((d) => d.lv === 1);
            return (
              <>
                {/* L0=origin: White oscillates near Yellow, Black fixed near Blue */}
                {yellowDot &&
                  (() => {
                    const rad = ((yellowDot.a - alpha0 - 90) * Math.PI) / 180;
                    return (
                      <circle
                        cx={CX + WR * Math.cos(rad)}
                        cy={bPy(yellowDot.a)}
                        r={4}
                        fill="#fff"
                        stroke="rgba(0,0,0,0.5)"
                        strokeWidth={0.8}
                        opacity={mode === 0 ? 0.8 : 0.15}
                      />
                    );
                  })()}
                {blueDot && (
                  <circle
                    cx={CX}
                    cy={bPy(blueDot.a)}
                    r={4}
                    fill="#222"
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={0.8}
                    opacity={mode === 0 ? 0.8 : 0.15}
                  />
                )}
                {/* L7=origin: Black oscillates near Blue, White fixed near Yellow */}
                {blueDot &&
                  (() => {
                    const rad = ((blueDot.a - alpha7 - 90) * Math.PI) / 180;
                    return (
                      <circle
                        cx={CX + WR * Math.cos(rad)}
                        cy={bPy(blueDot.a)}
                        r={4}
                        fill="#222"
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth={0.8}
                        opacity={mode === 7 ? 0.8 : 0.15}
                      />
                    );
                  })()}
                {yellowDot && (
                  <circle
                    cx={CX}
                    cy={bPy(yellowDot.a)}
                    r={4}
                    fill="#fff"
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth={0.8}
                    opacity={mode === 7 ? 0.8 : 0.15}
                  />
                )}
              </>
            );
          })()}
          {/* Axis label */}
          <text x={CX} y={BY + BH + 12} fontSize={10} fill={C.textMuted} textAnchor="middle" fontStyle="italic">
            {t("linkedviz_axis_cos")}
          </text>
          {HUE_LABELS.map((a) => (
            <text key={`ba${a}`} x={BXleft - 4} y={bPy(a)} fontSize={8} fill={C.textMuted} textAnchor="end" dominantBaseline="middle">
              {a}°
            </text>
          ))}
          <line x1={BXleft} y1={bPy(hueAngle)} x2={BXright} y2={bPy(hueAngle)} stroke={C.accent} strokeWidth={1} opacity={0.5} />
          {/* Narrow drag handle strip (12px tall) centered on hue line */}
          <rect
            x={BXleft - 5}
            y={bPy(hueAngle) - 6}
            width={BW + 10}
            height={12}
            fill="transparent"
            style={{ cursor: "ns-resize" }}
            onPointerDown={onHueBottomPointerDown}
          />

          {/* L0 continuous cosine curves */}
          {ACTIVE_LEVELS.map((lv) => (
            <path
              key={`bc0-${lv}`}
              d={cosinePath(lv, lumR0, alpha0)}
              fill="none"
              stroke={lvColor(lv)}
              strokeWidth={mode === 0 ? 1.8 : 0.8}
              opacity={hoveredDot ? (hoveredDot.lv === lv ? 0.9 : 0.15) : mode === 0 ? 0.65 : 0.2}
            />
          ))}
          {/* L7 continuous cosine curves (dashed) */}
          {ACTIVE_LEVELS.map((lv) => (
            <path
              key={`bc7-${lv}`}
              d={cosinePath(lv, lumR7, alpha7)}
              fill="none"
              stroke={lvColor(lv)}
              strokeWidth={mode === 7 ? 1.8 : 0.8}
              opacity={hoveredDot ? (hoveredDot.lv === lv ? 0.9 : 0.15) : mode === 7 ? 0.65 : 0.2}
              strokeDasharray="6,3"
            />
          ))}

          {/* Inactive dots on current mode's curves (small, no guide lines) */}
          {dots
            .filter((d) => !d.act)
            .map((d) => {
              const rad = ((d.a - activeAlpha - 90) * Math.PI) / 180;
              const x = CX + activeRadiusFn(d.lv) * Math.cos(rad);
              return (
                <circle
                  key={`bi-${d.lv}-${d.ci}`}
                  cx={x}
                  cy={bPy(d.a)}
                  r={1.8}
                  fill={`rgb(${d.rgb.join(",")})`}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={0.5}
                  opacity={0.3}
                />
              );
            })}
          {/* Active dots on current mode's curves */}
          {activeDots.map((d) => {
            const rad = ((d.a - activeAlpha - 90) * Math.PI) / 180;
            const x = CX + activeRadiusFn(d.lv) * Math.cos(rad);
            const hov = isHovered(d);
            return (
              <circle
                key={`bd-${d.lv}-${d.ci}`}
                cx={x}
                cy={bPy(d.a)}
                r={hov ? 5.5 : 4}
                fill={`rgb(${d.rgb.join(",")})`}
                stroke="#fff"
                strokeWidth={hov ? 1.4 : 1.0}
                opacity={dotOpacity(d)}
                filter={hov ? "url(#dot-glow)" : undefined}
                {...dotHandlers(d)}
              />
            );
          })}
        </g>

        {/* ═══ BOTTOM-RIGHT: Legend + Active color info ═══ */}
        <g>
          {/* Active color info with L0 legend above, L7 legend below */}
          {(() => {
            const hovIdx = hoveredDot ? activeDots.findIndex((d) => d.lv === hoveredDot.lv && d.ci === hoveredDot.ci) : -1;
            const ix = BXright + 12;
            const ixRgb = ix + 60; // fixed column for RGB values
            const ixC2 = ixRgb + 70; // fixed column for C2 pairs
            const ROW_H = 18; // single line per entry
            let yOffset = BY + 20;

            // L0 legend at top
            const l0y = yOffset;
            yOffset += ROW_H; // same spacing as other entries
            const dotElements = activeDots.map((d, i) => {
              const col = `rgb(${d.rgb.join(",")})`;
              const y = yOffset;
              const hov = hovIdx === i;
              yOffset += ROW_H; // always same increment
              return (
                <g key={`info-${d.lv}-${d.ci}`} opacity={hov ? 1 : hovIdx >= 0 ? 0.3 : 0.8} {...dotHandlers(d)}>
                  <rect x={ix} y={y} width={11} height={11} rx={2} fill={col} stroke={hov ? "#fff" : "none"} strokeWidth={hov ? 0.5 : 0} />
                  <text
                    x={ix + 15}
                    y={y + 9}
                    fontSize={hov ? 11 : 10}
                    fill={hov ? C.textWhite : C.textDimmer}
                    fontWeight={hov ? "bold" : "normal"}
                  >
                    L{d.lv} <tspan style={{ fontVariantNumeric: "tabular-nums" }}>{String(Math.round(d.a)).padStart(3, "\u2007")}°</tspan>
                  </text>
                  <text x={ixRgb} y={y + 9} fontSize={10} fill={C.textDimmer}>
                    ({d.rgb.join(",")})
                  </text>
                  <text x={ixC2} y={y + 9} fontSize={10} fill={C.textDimmer}>
                    C2:L{C2_PAIR[d.lv]}
                  </text>
                </g>
              );
            });

            // L7 legend below L6
            const l7y = yOffset; // same spacing as other entries

            return (
              <>
                {/* L0 legend */}
                <g key="legend-l0" opacity={hovIdx >= 0 ? 0.3 : 0.8}>
                  <rect x={ix} y={l0y + 1} width={11} height={11} rx={2} fill="#222" stroke="rgba(255,255,255,0.5)" strokeWidth={0.6} />
                  <text x={ix + 15} y={l0y + 9} fontSize={10} fill={C.textDimmer}>
                    {legendL0}
                  </text>
                  <text x={ixRgb} y={l0y + 9} fontSize={10} fill={C.textDimmer}>
                    (0,0,0)
                  </text>
                  <text x={ixC2} y={l0y + 9} fontSize={10} fill={C.textDimmer}>
                    C2:L7
                  </text>
                </g>
                {dotElements}
                {/* L7 legend */}
                <g key="legend-l7" opacity={hovIdx >= 0 ? 0.3 : 0.8}>
                  <rect x={ix} y={l7y + 1} width={11} height={11} rx={2} fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth={0.6} />
                  <text x={ix + 15} y={l7y + 9} fontSize={10} fill={C.textDimmer}>
                    {legendL7}
                  </text>
                  <text x={ixRgb} y={l7y + 9} fontSize={10} fill={C.textDimmer}>
                    (255,255,255)
                  </text>
                  <text x={ixC2} y={l7y + 9} fontSize={10} fill={C.textDimmer}>
                    C2:L0
                  </text>
                </g>
              </>
            );
          })()}
        </g>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hoveredDot is intentionally reactive
  }, [
    dots,
    wP,
    hueAngle,
    alpha0,
    alpha7,
    mode,
    activeAlpha,
    activeRadiusFn,
    sinePath,
    cosinePath,
    hoveredDot,
    onHuePointerDown,
    onHueBottomPointerDown,
    legendL0,
    legendL7,
  ]);

  const deltaAlpha = Math.round((((alpha0 - alpha7) % 360) + 360) % 360);
  const isInverted = deltaAlpha === 180;

  return (
    <div style={{ marginTop: SP.xl, textAlign: "center" }}>
      {/* L0/L7 Toggle + Δα controls */}
      <div style={{ marginBottom: SP.md, display: "flex", gap: SP.sm, justifyContent: "center", alignItems: "center" }}>
        <button type="button" style={mode === 0 ? S_TOGGLE_ACTIVE : S_TOGGLE} onClick={() => setMode(0)}>
          {t("linkedviz_mode_l0")}
        </button>
        <button type="button" style={mode === 7 ? S_TOGGLE_ACTIVE : S_TOGGLE} onClick={() => setMode(7)}>
          {t("linkedviz_mode_l7")}
        </button>
        <span
          style={{
            color: isInverted ? C.accent : C.textDim,
            fontSize: 11,
            width: 62,
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
        style={{ maxWidth: "min(340px, calc(100vw - 24px))" }}
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

        {/* ═══ WHEEL (single, toggleable) ═══ */}
        <g style={{ cursor: "grab" }} onPointerDown={onWheelPointerDown}>
          <circle cx={CX} cy={CY} r={WR + 14} fill="transparent" />
          {renderWheel({
            cx: CX,
            cy: CY,
            alpha: activeAlpha,
            radiusFn: activeRadiusFn,
            dots,
            hueAngle,
            hoveredDot,
            onHoverDot: setHoveredDot,
            mode,
          })}
        </g>

        {/* Label with rotation angle */}
        <text x={CX} y={WO - 2} fontSize={8} fill={C.textDimmer} textAnchor="middle">
          {mode === 0 ? `\u03b1\u2080: ${Math.round(alpha0)}\u00b0` : `\u03b1\u2087: ${Math.round(alpha7)}\u00b0`}
        </text>
      </svg>
    </div>
  );
});

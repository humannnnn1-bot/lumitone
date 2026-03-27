import React, { useState, useMemo, useCallback, memo } from "react";
import { LEVEL_CANDIDATES } from "../color-engine";
import { NUM_VERTICES } from "../constants";
import {
  HEX_VERTICES,
  HEX_EDGES,
  HEX_EDGE_COLORS,
  HEX_VERTEX_ALTS,
  HEX_EDGE_ALTS,
  HEX_DOTS,
  HEX_CX,
  HEX_CY,
  HEX_R,
  HEX_VP,
} from "../hex-data";
import type { ColorAction } from "../color-reducer";
import { useTranslation } from "../i18n";
import { C, FS, FW, O } from "../tokens";

interface Props {
  cc: number[];
  dispatch: React.Dispatch<ColorAction>;
  hist: number[];
  total: number;
  locked: boolean[];
  onToggleLock: (lv: number) => void;
  onRandomize: () => void;
}

export const HexDiag = memo(
  function HexDiag({ cc, dispatch, hist, total, locked, onToggleLock, onRandomize }: Props) {
    const { t } = useTranslation();
    const [hl, setHl] = useState<number | null>(null);
    const [focusedLv, setFocusedLv] = useState<number | null>(null);
    const [diceRolling, setDiceRolling] = useState(false);
    const handleRandomize = useCallback(() => {
      onRandomize();
      setDiceRolling(true);
      setTimeout(() => setDiceRolling(false), 400);
    }, [onRandomize]);
    const vp = HEX_VP;
    const sel = (lv: number, ai: number) => dispatch({ type: "set_color", lv, idx: ai });
    const isA = (lv: number, ai: number) => cc[lv] % LEVEL_CANDIDATES[lv].length === ai;

    // Event delegation for mouse enter/leave on SVG groups with data-lv attribute
    const onSvgMouseOver = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
      const g = (e.target as SVGElement).closest<SVGElement>("g[data-lv]");
      if (g) setHl(Number(g.dataset.lv));
    }, []);
    const onSvgMouseOut = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
      const g = (e.target as SVGElement).closest<SVGElement>("g[data-lv]");
      if (g) setHl(null);
    }, []);
    const dR = (lv: number, vertex: boolean, active: boolean) => {
      const mn = vertex ? 12 : 8;
      if (!active) return mn;
      const base = vertex ? 15 : 8,
        mx = vertex ? 50 : 30;
      const r = total > 0 ? hist[lv] / total : 0;
      return Math.min(mx, Math.max(mn, base * (0.5 + r * 10)));
    };
    const { cp } = useMemo(() => {
      const points = HEX_DOTS.filter((d) => isA(d.lv, d.alt))
        .map((d) => {
          let pos: { x: number; y: number };
          if (d.vi >= 0) pos = vp[d.vi];
          else {
            const e = HEX_EDGES[d.ei],
              p0 = vp[e.f],
              p1 = vp[e.t % NUM_VERTICES];
            const ts = Math.abs(HEX_VERTICES[e.f].lv - HEX_VERTICES[e.t % NUM_VERTICES].lv);
            if (ts === 0) return null;
            const frac = (d.si + 1) / ts;
            pos = { x: p0.x + (p1.x - p0.x) * frac, y: p0.y + (p1.y - p0.y) * frac };
          }
          return { ...pos, ang: Math.atan2(pos.y - HEX_CY, pos.x - HEX_CX) };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => a.ang - b.ang);
      const path =
        points.length > 1 ? points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ") + "Z" : "";
      return { actP: points, cp: path };
    }, [cc, vp, isA]); // eslint-disable-line react-hooks/exhaustive-deps -- isA depends on cc

    return (
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
        <svg
          viewBox="-10 -25 420 445"
          style={{ width: "100%", maxWidth: 420 }}
          role="img"
          aria-label={t("hex_diagram_label")}
          onMouseOver={onSvgMouseOver}
          onMouseOut={onSvgMouseOut}
        >
          <g transform="translate(0, 16)">
            {/* Angle labels at 15° intervals on hexagonal outline */}
            {(() => {
              const nodeAngles = new Set([15, 30, 45, 90, 195, 210, 225, 270]);
              const labelHexR = HEX_R + 62;
              const apothem = labelHexR * Math.cos(Math.PI / 6);
              return Array.from({ length: 24 }, (_, i) => {
                const deg = i * 15;
                const svgAng = deg - 90;
                const svgNorm = (((svgAng + 30) % 360) + 360) % 360;
                const withinSector = svgNorm % 60;
                const angleFromMid = ((withinSector - 30) * Math.PI) / 180;
                const hexR = apothem / Math.cos(angleFromMid);
                const rad = (svgAng * Math.PI) / 180;
                const lx = HEX_CX + hexR * Math.cos(rad),
                  ly = HEX_CY + hexR * Math.sin(rad);
                const isVertex = deg % 60 === 0;
                const isNode = nodeAngles.has(deg);
                return (
                  <text
                    key={"a" + i}
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isVertex ? 13 : isNode ? 11 : FS.xs}
                    fontFamily="monospace"
                    fill={isVertex ? C.textPrimary : isNode ? C.textMuted : C.textSubtle}
                    fontWeight={isVertex || isNode ? FW.bold : 400}
                  >
                    {deg}°
                  </text>
                );
              });
            })()}
            {HEX_VERTICES.map((_, i) => {
              const j = (i + 1) % NUM_VERTICES;
              return <line key={"e" + i} x1={vp[i].x} y1={vp[i].y} x2={vp[j].x} y2={vp[j].y} stroke={C.borderAlt} strokeWidth={1.5} />;
            })}
            {cp && <path d={cp} fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.5)" strokeWidth={1.5} strokeDasharray="4,3" />}
            {/* Collect all circles (edges + vertices), sort by radius descending so smaller circles render on top */}
            {(() => {
              type CircleItem = {
                key: string;
                lv: number;
                ai: number;
                x: number;
                y: number;
                r: number;
                color: string;
                vertex: boolean;
                vertexIdx?: number;
              };
              const allCircles: CircleItem[] = [];
              // Edge circles
              HEX_EDGES.forEach((e, ei) => {
                const p0 = vp[e.f],
                  p1 = vp[e.t % NUM_VERTICES];
                const ts = Math.abs(HEX_VERTICES[e.f].lv - HEX_VERTICES[e.t % NUM_VERTICES].lv);
                if (ts === 0) return;
                e.lv.forEach((lv, li) => {
                  const frac = (li + 1) / ts;
                  const x = p0.x + (p1.x - p0.x) * frac,
                    y = p0.y + (p1.y - p0.y) * frac;
                  const dc = HEX_EDGE_COLORS[ei][li].hex,
                    ai = HEX_EDGE_ALTS[ei][li];
                  const act = isA(lv, ai),
                    r = dR(lv, false, act);
                  allCircles.push({ key: "m" + ei + li, lv, ai, x, y, r, color: dc, vertex: false });
                });
              });
              // Vertex circles
              HEX_VERTICES.forEach((v, i) => {
                const p = vp[i],
                  ai = HEX_VERTEX_ALTS[i];
                const act = isA(v.lv, ai),
                  r = dR(v.lv, true, act);
                allCircles.push({ key: "v" + i, lv: v.lv, ai, x: p.x, y: p.y, r, color: v.rgb, vertex: true, vertexIdx: i });
              });
              // Sort descending by radius — large circles behind, small circles on top
              allCircles.sort((a, b) => b.r - a.r);
              return allCircles.map((item) => {
                const { key, lv, ai, x, y, r, color, vertex, vertexIdx } = item;
                const act = isA(lv, ai),
                  hov = hl === lv;
                if (vertex && vertexIdx !== undefined) {
                  const v = HEX_VERTICES[vertexIdx];
                  const la = (v.a * Math.PI) / 180,
                    lx = HEX_CX + (HEX_R + 28) * Math.cos(la),
                    ly = HEX_CY + (HEX_R + 28) * Math.sin(la);
                  return (
                    <g
                      key={key}
                      data-lv={lv}
                      onFocus={() => {
                        setHl(lv);
                        setFocusedLv(lv);
                      }}
                      onBlur={() => {
                        setHl(null);
                        setFocusedLv(null);
                      }}
                      onClick={() => {
                        if (!locked[lv]) sel(lv, ai);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onToggleLock(lv);
                      }}
                      style={{ cursor: "pointer" }}
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          sel(lv, ai);
                        }
                      }}
                      role="button"
                      aria-pressed={act}
                      aria-label={t("hex_vertex_label", v.c, lv)}
                    >
                      {r < 24 && <circle cx={x} cy={y} r={24} fill="transparent" />}
                      {focusedLv === lv && <circle cx={x} cy={y} r={r + 8} fill="none" stroke={C.accent} strokeWidth={2} />}
                      {act && (
                        <circle
                          cx={x}
                          cy={y}
                          r={r + 5}
                          fill="none"
                          stroke={C.textWhite}
                          strokeWidth={1.5}
                          strokeDasharray="4,3"
                          opacity={O.soft}
                        />
                      )}
                      {hov && !act && <circle cx={x} cy={y} r={r + 4} fill="none" stroke={C.svgStrokeHover} strokeWidth={1} />}
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill={act ? color : "none"}
                        stroke={act ? C.textWhite : color}
                        strokeWidth={act ? 3 : 1.5}
                        fillOpacity={act ? O.soft : 1}
                      />
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={Math.max(FS.sm, r * 0.7)}
                        fontWeight={900}
                        fontFamily="monospace"
                        fill={act ? (lv >= 4 ? "#000" : C.textWhite) : color}
                      >
                        {lv}
                      </text>
                      <text
                        x={lx}
                        y={ly}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={14}
                        fontWeight={FW.bold}
                        fontFamily="monospace"
                        fill={color}
                        opacity={O.strong}
                      >
                        {v.c}
                      </text>
                      {locked[lv] && <circle cx={x} cy={y} r={r + 5} fill="none" stroke={C.warning} strokeWidth={2.5} />}
                    </g>
                  );
                }
                return (
                  <g
                    key={key}
                    data-lv={lv}
                    onFocus={() => {
                      setHl(lv);
                      setFocusedLv(lv);
                    }}
                    onBlur={() => {
                      setHl(null);
                      setFocusedLv(null);
                    }}
                    onClick={() => {
                      if (!locked[lv]) sel(lv, ai);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onToggleLock(lv);
                    }}
                    style={{ cursor: "pointer" }}
                    tabIndex={0}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        sel(lv, ai);
                      }
                    }}
                    role="button"
                    aria-pressed={act}
                    aria-label={t("hex_edge_label", lv, color)}
                  >
                    {focusedLv === lv && <circle cx={x} cy={y} r={r + 8} fill="none" stroke={C.accent} strokeWidth={2} />}
                    {act && (
                      <circle
                        cx={x}
                        cy={y}
                        r={r + 5}
                        fill="none"
                        stroke={C.textWhite}
                        strokeWidth={1.5}
                        strokeDasharray="3,2"
                        opacity={O.soft}
                      />
                    )}
                    {hov && !act && <circle cx={x} cy={y} r={r + 4} fill="none" stroke={C.svgStrokeHover} strokeWidth={1} />}
                    {r < 22 && <circle cx={x} cy={y} r={22} fill="transparent" />}
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={act ? color : "none"}
                      stroke={act ? C.textWhite : color}
                      strokeWidth={act ? 2.5 : 1.5}
                      fillOpacity={act ? O.soft : 1}
                    />
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={Math.max(FS.xxs, r * 0.9)}
                      fontWeight={FW.bold}
                      fontFamily="monospace"
                      fill={act ? (lv >= 4 ? "#000" : C.textWhite) : color}
                    >
                      {lv}
                    </text>
                    {locked[lv] && <circle cx={x} cy={y} r={r + 4} fill="none" stroke={C.warning} strokeWidth={2.5} />}
                  </g>
                );
              });
            })()}
            {/* Dice button at center */}
            <g
              onClick={handleRandomize}
              style={{ cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-pressed={false}
              aria-label={t("btn_random_color")}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  handleRandomize();
                }
              }}
            >
              <text
                x={HEX_CX}
                y={HEX_CY + 12}
                textAnchor="middle"
                fontSize={36}
                style={{
                  transformOrigin: `${HEX_CX}px ${HEX_CY}px`,
                  transition: diceRolling ? "transform 0.4s cubic-bezier(.2,.8,.3,1)" : "none",
                  transform: diceRolling ? "rotate(720deg) scale(1.2)" : "rotate(0deg) scale(1)",
                }}
              >
                🎲
              </text>
            </g>
          </g>
        </svg>
      </div>
    );
  },
  (prev, next) => {
    if (prev.total !== next.total) return false;
    for (let i = 0; i < 8; i++) {
      if (prev.cc[i] !== next.cc[i]) return false;
      if (prev.hist[i] !== next.hist[i]) return false;
      if (prev.locked[i] !== next.locked[i]) return false;
    }
    return true;
  },
);

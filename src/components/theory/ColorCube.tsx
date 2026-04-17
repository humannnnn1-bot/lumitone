import React, { useState, useCallback } from "react";
import { THEORY_LEVELS, CUBE_EDGES, CUBE_POINTS, GRAY_PATH, edgeChannel, isBackEdge, STELLA_EDGES, COMPLEMENT_EDGES } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { usePinReset } from "./pin-reset";
import { S_BTN } from "../../styles";
import { useTranslation } from "../../i18n";

const DOT_R = 11;

function edgesOf(v: number): number[] {
  return CUBE_EDGES.map((e, i) => (e[0] === v || e[1] === v ? i : -1)).filter((i) => i >= 0);
}

const AXIS_LABELS: { ch: "G" | "R" | "B"; from: number; to: number }[] = [
  { ch: "G", from: 0, to: 4 },
  { ch: "R", from: 0, to: 2 },
  { ch: "B", from: 0, to: 1 },
];

const CHANNEL_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const ColorCube = React.memo(function ColorCube({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [equatorMode, setEquatorMode] = useState(false);
  const [showComplements, setShowComplements] = useState(false);
  const [showK8, setShowK8] = useState(false);

  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;
  const hlEdges = hl !== null ? edgesOf(hl) : [];
  const hlVerts = new Set<number>();
  if (hl !== null) {
    hlVerts.add(hl);
    for (const ei of hlEdges) {
      hlVerts.add(CUBE_EDGES[ei][0]);
      hlVerts.add(CUBE_EDGES[ei][1]);
    }
  }

  const onEnter = useCallback((lv: number) => onHover(lv), [onHover]);
  const onLeave = useCallback(() => onHover(null), [onHover]);
  const onTap = useCallback(
    (lv: number) => {
      setPinned((prev) => {
        const next = prev === lv ? null : lv;
        queueMicrotask(() => onHover(next));
        return next;
      });
    },
    [onHover],
  );

  const getPos = (lv: number) => CUBE_POINTS[lv];

  const isEquator = (lv: number) => lv !== 0 && lv !== 7;

  // Equator path (hexagonal outline connecting the 6 chromatic vertices on the cube)
  const equatorPath =
    GRAY_PATH.map((lv, i) => {
      const p = getPos(lv);
      return (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }).join(" ") + "Z";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <svg viewBox="55 35 190 195" style={{ width: "100%", maxWidth: 235 }} role="img" aria-label={t("theory_cube_title")}>
        {/* Equator path (toggle overlay) */}
        {equatorMode && (
          <path d={equatorPath} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.40)" strokeWidth={1.5} strokeDasharray="4,3" />
        )}

        {/* Axis labels */}
        {AXIS_LABELS.map(({ ch, from, to }) => {
          const p0 = getPos(from),
            p1 = getPos(to);
          const mx = (p0.x + p1.x) / 2,
            my = (p0.y + p1.y) / 2;
          const chColor = CHANNEL_COLORS[ch];
          const dx = mx - 150,
            dy = my - 150;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ox = mx + (dx / dist) * 14,
            oy = my + (dy / dist) * 14;
          return (
            <text
              key={"ax" + ch}
              x={ox}
              y={oy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.sm}
              fontFamily="monospace"
              fontWeight={FW.bold}
              fill={chColor}
              opacity={0.5}
            >
              {ch}
            </text>
          );
        })}

        {/* Complement diagonals (all 4 body diagonals) */}
        {showComplements &&
          COMPLEMENT_EDGES.map(([a, b]) => {
            const pa = getPos(a),
              pb = getPos(b);
            const la = THEORY_LEVELS[a],
              lb = THEORY_LEVELS[b];
            const grad = `url(#compGrad${a}${b})`;
            return (
              <g key={"comp" + a + b}>
                <defs>
                  <linearGradient id={`compGrad${a}${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={la.color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={lb.color} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <line
                  data-testid={`cube-complement-${a}-${b}`}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={grad}
                  strokeWidth={1.5}
                  strokeDasharray="6,4"
                  opacity={0.7}
                />
                <text
                  x={(pa.x + pb.x) / 2}
                  y={(pa.y + pb.y) / 2 - 8}
                  textAnchor="middle"
                  fontSize={FS.xxs}
                  fontFamily="monospace"
                  fill={C.textDimmer}
                  opacity={0.6}
                >
                  {a}
                  {"\u2295"}
                  {b}=7
                </text>
              </g>
            );
          })}

        {/* K₈ distance-2 edges (stella octangula) */}
        {showK8 &&
          STELLA_EDGES.map(([a, b], i) => {
            const pa = getPos(a),
              pb = getPos(b);
            return (
              <line
                key={"stella" + i}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
                strokeDasharray="5,3"
              />
            );
          })}

        {/* K₈ distance-3 edges (complement matching) */}
        {showK8 &&
          COMPLEMENT_EDGES.map(([a, b], i) => {
            const pa = getPos(a),
              pb = getPos(b);
            const la = THEORY_LEVELS[a],
              lb = THEORY_LEVELS[b];
            const gradId = `k8Comp${a}${b}`;
            return (
              <g key={"k8c" + i}>
                <defs>
                  <linearGradient id={gradId} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={la.color} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={lb.color} stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={`url(#${gradId})`} strokeWidth={1.5} strokeDasharray="2,3" />
              </g>
            );
          })}

        {/* Edges */}
        {CUBE_EDGES.map((e, ei) => {
          const p0 = getPos(e[0]),
            p1 = getPos(e[1]);
          const back = isBackEdge(e[0], e[1]);
          const active = hlEdges.includes(ei);
          const dim = hl !== null && !active;
          const ch = edgeChannel(e[0], e[1]);
          const chColor = CHANNEL_COLORS[ch];
          const isEqEdge = isEquator(e[0]) && isEquator(e[1]);
          const edgeOpacity = dim ? 0.15 : active ? 0.9 : isEqEdge && equatorMode ? 0.6 : 0.4;
          return (
            <g key={"ce" + ei}>
              <line
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={active ? chColor : C.textDimmer}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={back && !active ? "3,3" : undefined}
                opacity={edgeOpacity}
              />
              {active && (
                <text
                  x={(p0.x + p1.x) / 2}
                  y={(p0.y + p1.y) / 2 - 8}
                  textAnchor="middle"
                  fontSize={FS.xs}
                  fontFamily="monospace"
                  fontWeight={FW.bold}
                  fill={chColor}
                >
                  {ch}
                </text>
              )}
            </g>
          );
        })}

        {/* Vertices */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((lv) => {
          const p = getPos(lv);
          const info = THEORY_LEVELS[lv];
          const active = hlVerts.has(lv);
          const dim = hl !== null && !active;
          return (
            <g
              key={"cv" + lv}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={p.x} cy={p.y} r={DOT_R + 6} fill="transparent" />
              {active && <circle cx={p.x} cy={p.y} r={DOT_R + 4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
              <circle
                cx={p.x}
                cy={p.y}
                r={DOT_R}
                fill={lv === 0 ? C.bgRoot : info.color}
                fillOpacity={dim ? 0.2 : 0.85}
                stroke={dim ? (lv === 0 ? C.textDimmer : info.color) : "#fff"}
                strokeWidth={lv === 0 ? 1 : active ? 2.5 : 1.5}
                strokeOpacity={dim ? 0.3 : 0.8}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fontWeight={900}
                fontFamily="monospace"
                fill={lv >= 4 ? "#000" : "#fff"}
                opacity={dim ? 0.3 : 1}
              >
                {lv}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          fontSize: FS.xs,
          color: C.textDimmer,
          textAlign: "center",
          fontFamily: "monospace",
          visibility: showK8 ? "visible" : "hidden",
        }}
      >
        {"K\u2088 = Q\u2083 \u222A (K\u2084\u2294K\u2084) \u222A M\u2084"}
      </div>

      <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          className="theory-annotation"
          style={{ ...S_BTN, opacity: equatorMode ? 1 : 0.5, borderColor: equatorMode ? "rgba(255,255,255,0.5)" : undefined }}
          onClick={() => setEquatorMode((v) => !v)}
        >
          {t("theory_cube_equator")}
        </button>
        <button
          className="theory-annotation"
          style={{ ...S_BTN, opacity: showComplements ? 1 : 0.5, borderColor: showComplements ? "rgba(255,255,255,0.5)" : undefined }}
          onClick={() => setShowComplements((v) => !v)}
        >
          {t("theory_cube_complements")}
        </button>
        <button
          className="theory-annotation"
          style={{ ...S_BTN, opacity: showK8 ? 1 : 0.5, borderColor: showK8 ? "rgba(255,255,255,0.5)" : undefined }}
          onClick={() => setShowK8((v) => !v)}
        >
          {"K\u2088"}
        </button>
      </div>
    </div>
  );
});

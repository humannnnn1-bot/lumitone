import React, { useState, useCallback, useEffect, useRef } from "react";
import { THEORY_LEVELS, CUBE_EDGES, CUBE_POINTS, GRAY_PATH, edgeChannel, isBackEdge, GRAY_TOGGLES } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 300;
const DOT_R = 14;

function edgesOf(v: number): number[] {
  return CUBE_EDGES.map((e, i) => (e[0] === v || e[1] === v ? i : -1)).filter((i) => i >= 0);
}

const AXIS_LABELS: { ch: "G" | "R" | "B"; from: number; to: number }[] = [
  { ch: "G", from: 0, to: 4 },
  { ch: "R", from: 0, to: 2 },
  { ch: "B", from: 0, to: 1 },
];

// Hexagon target positions for equator mode (centered at 150,150, r=100)
const HEX_TARGETS: Record<number, { x: number; y: number }> = {};
GRAY_PATH.forEach((lv, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
  HEX_TARGETS[lv] = { x: 150 + 100 * Math.cos(angle), y: 150 + 100 * Math.sin(angle) };
});

const CHANNEL_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const ColorCube = React.memo(function ColorCube({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  const [equatorMode, setEquatorMode] = useState(false);
  const [showComplements, setShowComplements] = useState(false);
  const [animT, setAnimT] = useState(0); // 0 = cube, 1 = hexagon
  const animRef = useRef<number>(0);

  // Animate transition
  useEffect(() => {
    const target = equatorMode ? 1 : 0;
    let raf: number;
    const animate = () => {
      setAnimT((prev) => {
        const next = prev + (target > prev ? 0.06 : -0.06);
        if ((target > prev && next >= target) || (target < prev && next <= target)) return target;
        raf = requestAnimationFrame(animate);
        return next;
      });
    };
    raf = requestAnimationFrame(animate);
    animRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [equatorMode]);

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

  // Interpolated positions
  const getPos = (lv: number) => {
    const cube = CUBE_POINTS[lv];
    if (lv === 0 || lv === 7) return { x: cube.x, y: cube.y }; // Black/White stay
    const hex = HEX_TARGETS[lv];
    return { x: lerp(cube.x, hex.x, animT), y: lerp(cube.y, hex.y, animT) };
  };

  const isEquator = (lv: number) => lv !== 0 && lv !== 7;

  // Equator path
  const equatorPath =
    GRAY_PATH.map((lv, i) => {
      const p = getPos(lv);
      return (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }).join(" ") + "Z";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_cube_title")}>
        {/* Equator path */}
        <path
          d={equatorPath}
          fill={`rgba(255,255,255,${0.04 + animT * 0.04})`}
          stroke={`rgba(255,255,255,${0.15 + animT * 0.25})`}
          strokeWidth={animT > 0.5 ? 1.5 : 1}
          strokeDasharray={animT < 0.5 ? "4,3" : undefined}
        />

        {/* Axis labels (fade out in equator mode) */}
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
              opacity={0.5 * (1 - animT)}
            >
              {ch}
            </text>
          );
        })}

        {/* Gray code toggle labels (fade in during equator mode) */}
        {animT > 0.3 &&
          GRAY_PATH.map((lv, i) => {
            const nLv = GRAY_PATH[(i + 1) % 6];
            const p0 = getPos(lv),
              p1 = getPos(nLv);
            const mx = (p0.x + p1.x) / 2,
              my = (p0.y + p1.y) / 2;
            const tg = GRAY_TOGGLES[i];
            const dx = mx - 150,
              dy = my - 150;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const lx = mx + (dx / dist) * 16,
              ly = my + (dy / dist) * 16;
            return (
              <text
                key={"gt" + i}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xs}
                fontFamily="monospace"
                fontWeight={FW.bold}
                fill={CHANNEL_COLORS[tg]}
                opacity={Math.min(1, (animT - 0.3) * 3)}
              >
                {tg}
              </text>
            );
          })}

        {/* Complement diagonals (space diagonals through center) */}
        {showComplements &&
          (
            [
              [1, 6],
              [2, 5],
              [3, 4],
            ] as const
          ).map(([a, b]) => {
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
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={grad}
                  strokeWidth={1.5}
                  strokeDasharray="6,4"
                  opacity={0.7 * (1 - animT)}
                />
                <text
                  x={(pa.x + pb.x) / 2}
                  y={(pa.y + pb.y) / 2 - 8}
                  textAnchor="middle"
                  fontSize={FS.xxs}
                  fontFamily="monospace"
                  fill={C.textDimmer}
                  opacity={0.6 * (1 - animT)}
                >
                  {a}
                  {"\u2295"}
                  {b}=7
                </text>
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
          // In equator mode, hide non-equator edges
          const isEqEdge = isEquator(e[0]) && isEquator(e[1]);
          const edgeOpacity = dim ? 0.15 : active ? 0.9 : isEqEdge ? 0.4 : 0.4 * (1 - animT);
          return (
            <g key={"ce" + ei}>
              <line
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={active ? chColor : C.textDimmer}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={back && !active && animT < 0.5 ? "3,3" : undefined}
                opacity={edgeOpacity}
              />
              {active && animT < 0.3 && (
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
          // Black and White fade out in equator mode
          const vertOpacity = lv === 0 || lv === 7 ? 1 - animT * 0.8 : 1;
          return (
            <g
              key={"cv" + lv}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
              opacity={vertOpacity}
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
                fontSize={FS.lg}
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

      <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center" }}>
        <button style={S_BTN} onClick={() => setEquatorMode((v) => !v)}>
          {t("theory_cube_equator")} {equatorMode ? "\u25c0" : "\u25b6"}
        </button>
        <button
          style={{ ...S_BTN, opacity: showComplements ? 1 : 0.5, borderColor: showComplements ? "rgba(255,255,255,0.5)" : undefined }}
          onClick={() => setShowComplements((v) => !v)}
        >
          {t("theory_cube_complements")}
        </button>
      </div>
    </div>
  );
});

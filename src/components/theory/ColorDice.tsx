import React, { useCallback, useState } from "react";
import { THEORY_LEVELS } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { useTranslation } from "../../i18n";

/* ── Isometric die geometry ─────────────── */

const EDGE = 80;
const CX = 130,
  CY = 145;

// Isometric unit vectors
const AX_R = { dx: EDGE * Math.cos(Math.PI / 6), dy: EDGE * Math.sin(Math.PI / 6) };
const AX_L = { dx: -EDGE * Math.cos(Math.PI / 6), dy: EDGE * Math.sin(Math.PI / 6) };
const AX_U = { dx: 0, dy: -EDGE };

// Front-bottom vertex
const O = { x: CX, y: CY + EDGE };
const pts = (dx: number, dy: number) => `${O.x + dx},${O.y + dy}`;

// Three visible faces
const FACE_TOP = [
  pts(AX_U.dx, AX_U.dy),
  pts(AX_U.dx + AX_R.dx, AX_U.dy + AX_R.dy),
  pts(AX_U.dx + AX_R.dx + AX_L.dx, AX_U.dy + AX_R.dy + AX_L.dy),
  pts(AX_U.dx + AX_L.dx, AX_U.dy + AX_L.dy),
].join(" ");

const FACE_LEFT = [pts(0, 0), pts(AX_L.dx, AX_L.dy), pts(AX_U.dx + AX_L.dx, AX_U.dy + AX_L.dy), pts(AX_U.dx, AX_U.dy)].join(" ");

const FACE_RIGHT = [pts(0, 0), pts(AX_R.dx, AX_R.dy), pts(AX_U.dx + AX_R.dx, AX_U.dy + AX_R.dy), pts(AX_U.dx, AX_U.dy)].join(" ");

// Face centroids
const faceCentroid = (face: string) => {
  const coords = face.split(" ").map((p) => {
    const [x, y] = p.split(",").map(Number);
    return { x, y };
  });
  return { x: coords.reduce((s, c) => s + c.x, 0) / coords.length, y: coords.reduce((s, c) => s + c.y, 0) / coords.length };
};

const CENTER_TOP = faceCentroid(FACE_TOP);
const CENTER_LEFT = faceCentroid(FACE_LEFT);
const CENTER_RIGHT = faceCentroid(FACE_RIGHT);

// Die face assignments: opposite faces sum to 7
const FACE_CONFIG: { face: string; center: { x: number; y: number }; lv: number; compLv: number }[] = [
  { face: FACE_TOP, center: CENTER_TOP, lv: 6, compLv: 1 },
  { face: FACE_LEFT, center: CENTER_LEFT, lv: 2, compLv: 5 },
  { face: FACE_RIGHT, center: CENTER_RIGHT, lv: 4, compLv: 3 },
];

const PAIRS: [number, number][] = [
  [1, 6],
  [2, 5],
  [3, 4],
];

const DOT_R = 14;
const SVG_W = 380,
  SVG_H = 280;

// Front-facing edge endpoints (from O vertex)
const FRONT_EDGES: [number, number, number, number][] = [
  [O.x, O.y, O.x + AX_U.dx, O.y + AX_U.dy],
  [O.x, O.y, O.x + AX_L.dx, O.y + AX_L.dy],
  [O.x, O.y, O.x + AX_R.dx, O.y + AX_R.dy],
];

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const ColorDice = React.memo(function ColorDice({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);

  const enter = useCallback((lv: number) => onHover(lv), [onHover]);
  const leave = useCallback(() => onHover(null), [onHover]);
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

  // Highlight resolution: external > pinned > null
  const hl = hlLevel !== null && hlLevel >= 1 && hlLevel <= 6 ? hlLevel : pinned;
  const activePairIdx = hl !== null ? PAIRS.findIndex(([a, b]) => a === hl || b === hl) : -1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: "100%", maxWidth: SVG_W }} role="img" aria-label={t("theory_dice_title")}>
        {/* Die faces */}
        {FACE_CONFIG.map(({ face, center, lv, compLv }, fi) => {
          const info = THEORY_LEVELS[lv];
          const compInfo = THEORY_LEVELS[compLv];
          const isActive = hl === lv || hl === compLv;
          const isDim = hl !== null && !isActive;
          const fillOpacity = isActive ? 0.45 : isDim ? 0.08 : 0.25;
          const strokeOpacity = isActive ? 0.8 : isDim ? 0.2 : 0.55;

          // Ghost complement position
          const dx = center.x - CX,
            dy = center.y - CY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const gx = center.x + (dx / dist) * 58;
          const gy = center.y + (dy / dist) * 58;
          const compOpacity = isActive ? 0.9 : isDim ? 0.1 : 0.35;
          const compR = isActive ? DOT_R - 1 : 10;

          // Perpendicular offset for "= 7" label
          const mx = (center.x + gx) / 2,
            my = (center.y + gy) / 2;
          const ldx = gx - center.x,
            ldy = gy - center.y;
          const llen = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
          const px = (-ldy / llen) * 14,
            py = (ldx / llen) * 14;

          return (
            <g key={"face" + fi}>
              {/* Face polygon */}
              <g onMouseEnter={() => enter(lv)} onMouseLeave={leave} onClick={() => onTap(lv)} style={{ cursor: "pointer" }}>
                <polygon
                  points={face}
                  fill={info.color}
                  fillOpacity={fillOpacity}
                  stroke={info.color}
                  strokeWidth={isActive ? 2 : 1.2}
                  strokeOpacity={strokeOpacity}
                  strokeLinejoin="round"
                />
                {isActive && (
                  <circle cx={center.x} cy={center.y} r={DOT_R + 4} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                )}
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={DOT_R}
                  fill={info.color}
                  fillOpacity={isDim ? 0.2 : 0.85}
                  stroke="#fff"
                  strokeWidth={isActive ? 2.5 : 1.5}
                  strokeOpacity={isDim ? 0.2 : 0.7}
                />
                <text
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.xl}
                  fontWeight={900}
                  fontFamily="monospace"
                  fill={lv >= 4 ? "#000" : "#fff"}
                  opacity={isDim ? 0.3 : 1}
                >
                  {lv}
                </text>
              </g>

              {/* Complement ghost + connector */}
              <g onMouseEnter={() => enter(compLv)} onMouseLeave={leave} onClick={() => onTap(compLv)} style={{ cursor: "pointer" }}>
                <line
                  x1={center.x}
                  y1={center.y}
                  x2={gx}
                  y2={gy}
                  stroke={compInfo.color}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeDasharray="3,3"
                  opacity={compOpacity * 0.5}
                />
                <circle
                  cx={gx}
                  cy={gy}
                  r={compR}
                  fill={compInfo.color}
                  fillOpacity={compOpacity * 0.7}
                  stroke={compInfo.color}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? undefined : "2,2"}
                  strokeOpacity={compOpacity}
                />
                <text
                  x={gx}
                  y={gy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isActive ? FS.lg : FS.sm}
                  fontWeight={FW.bold}
                  fontFamily="monospace"
                  fill={compLv >= 4 ? "#000" : "#fff"}
                  opacity={compOpacity}
                >
                  {compLv}
                </text>
              </g>

              {/* "= 7" label — always visible, brighter when active */}
              <text
                x={mx + px}
                y={my + py}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xs}
                fontFamily="monospace"
                fill={C.textDimmer}
                opacity={isActive ? 1 : isDim ? 0.15 : 0.45}
              >
                = 7
              </text>
            </g>
          );
        })}

        {/* Front-facing edge lines for cube definition */}
        {FRONT_EDGES.map(([x1, y1, x2, y2], ei) => (
          <line key={"edge" + ei} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={1.5} strokeOpacity={hl !== null ? 0.2 : 0.4} />
        ))}

        {/* Complement pairs summary (right column) */}
        {PAIRS.map(([a, b], pi) => {
          const infoA = THEORY_LEVELS[a];
          const infoB = THEORY_LEVELS[b];
          const isActive = activePairIdx === pi;
          const isDim = hl !== null && !isActive;
          const opacity = isDim ? 0.2 : isActive ? 1 : 0.6;
          const baseX = 290,
            baseY = 80 + pi * 56;
          const r = 12;

          return (
            <g key={"pair" + pi} opacity={opacity}>
              <g onMouseEnter={() => enter(a)} onMouseLeave={leave} onClick={() => onTap(a)} style={{ cursor: "pointer" }}>
                <circle cx={baseX - 22} cy={baseY} r={r} fill={infoA.color} fillOpacity={0.85} stroke="#fff" strokeWidth={1.2} />
                <text
                  x={baseX - 22}
                  y={baseY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.md}
                  fontWeight={900}
                  fontFamily="monospace"
                  fill={a >= 4 ? "#000" : "#fff"}
                >
                  {a}
                </text>
              </g>
              <text
                x={baseX}
                y={baseY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fontFamily="monospace"
                fill={C.textDimmer}
              >
                +
              </text>
              <g onMouseEnter={() => enter(b)} onMouseLeave={leave} onClick={() => onTap(b)} style={{ cursor: "pointer" }}>
                <circle cx={baseX + 22} cy={baseY} r={r} fill={infoB.color} fillOpacity={0.85} stroke="#fff" strokeWidth={1.2} />
                <text
                  x={baseX + 22}
                  y={baseY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.md}
                  fontWeight={900}
                  fontFamily="monospace"
                  fill={b >= 4 ? "#000" : "#fff"}
                >
                  {b}
                </text>
              </g>
              <text
                x={baseX + 48}
                y={baseY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fontFamily="monospace"
                fontWeight={FW.bold}
                fill={C.textMuted}
              >
                = 7
              </text>
              <text x={baseX} y={baseY + 16} textAnchor="middle" fontSize={FS.xs} fontFamily="monospace" fill={C.textDimmer}>
                {infoA.name} + {infoB.name}
              </text>
            </g>
          );
        })}

        {/* Transition hint */}
        <text x={SVG_W / 2} y={SVG_H - 14} textAnchor="middle" fontSize={FS.sm} fontFamily="monospace" fill={C.textDimmer}>
          {t("theory_dice_hint")}
        </text>
      </svg>
    </div>
  );
});

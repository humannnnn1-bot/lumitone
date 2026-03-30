import React, { useCallback, useState } from "react";
import { THEORY_LEVELS } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { useTranslation } from "../../i18n";

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

/* ── Die net (2-2-2 staircase unfolding) ── */

const NET_CELL = 52;
const NET_GAP = 3;
const NET_STEP = NET_CELL + NET_GAP;
const NET_W = 4 * NET_STEP + NET_GAP;
const NET_H = 3 * NET_STEP + NET_GAP;

const NET_FACES: { lv: number; col: number; row: number }[] = [
  { lv: 2, col: 0, row: 0 },
  { lv: 6, col: 1, row: 0 },
  { lv: 4, col: 1, row: 1 },
  { lv: 5, col: 2, row: 1 },
  { lv: 1, col: 2, row: 2 },
  { lv: 3, col: 3, row: 2 },
];

const NET_COMP_PAIRS: [number, number][] = [
  [1, 6],
  [2, 5],
  [3, 4],
];

const NET_TOGGLES: { from: number; to: number; ch: string; color: string }[] = [
  { from: 0, to: 1, ch: "G", color: "#00ff00" },
  { from: 1, to: 2, ch: "R", color: "#ff0000" },
  { from: 2, to: 3, ch: "B", color: "#0000ff" },
  { from: 3, to: 4, ch: "G", color: "#00ff00" },
  { from: 4, to: 5, ch: "R", color: "#ff0000" },
];

const PAIRS: [number, number][] = [
  [1, 6],
  [2, 5],
  [3, 4],
];

/* ── Mini isometric cube geometry ──────── */

const M_EDGE = 26;
const M_COS30 = Math.cos(Math.PI / 6);
const M_U = { dx: 0, dy: -M_EDGE };
const M_R = { dx: M_COS30 * M_EDGE, dy: 0.5 * M_EDGE };
const M_L = { dx: -M_COS30 * M_EDGE, dy: 0.5 * M_EDGE };
const M_VW = 62;
const M_VH = 62;
const M_OX = M_VW / 2;
const M_OY = M_VH / 2 + 5;

// Precomputed face polygon points (O is front vertex at center)
const fp = (dx: number, dy: number) => `${(M_OX + dx).toFixed(1)},${(M_OY + dy).toFixed(1)}`;
const FACE_T = [fp(M_U.dx, M_U.dy), fp(M_U.dx + M_R.dx, M_U.dy + M_R.dy), fp(0, 0), fp(M_U.dx + M_L.dx, M_U.dy + M_L.dy)].join(" ");
const FACE_R = [fp(0, 0), fp(M_R.dx, M_R.dy), fp(M_U.dx + M_R.dx, M_U.dy + M_R.dy), fp(M_U.dx, M_U.dy)].join(" ");
const FACE_L = [fp(0, 0), fp(M_L.dx, M_L.dy), fp(M_U.dx + M_L.dx, M_U.dy + M_L.dy), fp(M_U.dx, M_U.dy)].join(" ");

// Color abbreviations
const ABBR: Record<number, string> = { 1: "B", 2: "R", 3: "M", 4: "G", 5: "C", 6: "Y" };

// 8 die views: [left column = additive, right column = subtractive]
interface DieView {
  top: number;
  left: number;
  right: number;
  type: "identity" | "additive" | "subtractive";
}

// Rows: [left, right] pairs
const VIEW_ROWS: [DieView, DieView][] = [
  [
    { top: 4, left: 1, right: 2, type: "identity" }, // RGB
    { top: 6, left: 5, right: 3, type: "identity" }, // CMY
  ],
  [
    { top: 6, left: 2, right: 4, type: "additive" }, // R+G=Y
    { top: 2, left: 3, right: 6, type: "subtractive" }, // M∧Y=R
  ],
  [
    { top: 3, left: 2, right: 1, type: "additive" }, // R+B=M
    { top: 4, left: 5, right: 6, type: "subtractive" }, // C∧Y=G
  ],
  [
    { top: 5, left: 4, right: 1, type: "additive" }, // G+B=C
    { top: 1, left: 5, right: 3, type: "subtractive" }, // C∧M=B
  ],
];

function MiniCube({
  view,
  hl,
  onEnter,
  onLeave,
  onTap,
}: {
  view: DieView;
  hl: number | null;
  onEnter: (lv: number) => void;
  onLeave: () => void;
  onTap: (lv: number) => void;
}) {
  const faces = [
    { pts: FACE_L, lv: view.left },
    { pts: FACE_R, lv: view.right },
    { pts: FACE_T, lv: view.top },
  ];

  const isOutput = (lv: number) => view.type !== "identity" && lv === view.top;
  const viewLevels = [view.top, view.left, view.right];
  const anyHl = hl !== null && viewLevels.includes(hl);

  // Build label
  const op = view.type === "additive" ? " \u2295 " : view.type === "subtractive" ? " \u2227 " : "";
  const leftA = ABBR[view.left];
  const rightA = ABBR[view.right];
  const topA = ABBR[view.top];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg viewBox={`0 0 ${M_VW} ${M_VH}`} style={{ width: 80, height: 80 }}>
        {faces.map(({ pts, lv }) => {
          const info = THEORY_LEVELS[lv];
          const active = hl === lv;
          const dim = hl !== null && !active && !anyHl;
          const output = isOutput(lv);
          return (
            <g
              key={`f${lv}`}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
            >
              <polygon
                points={pts}
                fill={info.color}
                fillOpacity={dim ? 0.08 : output ? 0.6 : active ? 0.5 : 0.35}
                stroke={output ? "#fff" : info.color}
                strokeWidth={output ? 1.5 : active ? 1.5 : 0.8}
                strokeOpacity={dim ? 0.15 : output ? 0.8 : 0.5}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {/* Level numbers on each face */}
        {[
          { lv: view.top, x: M_OX, y: M_OY - M_EDGE * 0.5 },
          { lv: view.left, x: M_OX - M_COS30 * M_EDGE * 0.45, y: M_OY + M_EDGE * 0.15 },
          { lv: view.right, x: M_OX + M_COS30 * M_EDGE * 0.45, y: M_OY + M_EDGE * 0.15 },
        ].map(({ lv, x, y }) => (
          <text
            key={`n${lv}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontWeight={900}
            fontFamily="monospace"
            fill={lv >= 4 ? "#000" : "#fff"}
            opacity={0.9}
          >
            {lv}
          </text>
        ))}
      </svg>
      {/* Label */}
      <div style={{ fontSize: 9, fontFamily: "monospace", textAlign: "center", lineHeight: 1 }}>
        {view.type === "identity" ? (
          <span style={{ color: C.textDimmer }}>
            {"{ "}
            <span style={{ color: THEORY_LEVELS[view.left].color }}>{leftA}</span>
            {", "}
            <span style={{ color: THEORY_LEVELS[view.right].color }}>{rightA}</span>
            {", "}
            <span style={{ color: THEORY_LEVELS[view.top].color }}>{topA}</span>
            {" }"}
          </span>
        ) : (
          <span>
            <span style={{ color: THEORY_LEVELS[view.left].color }}>{leftA}</span>
            <span style={{ color: C.textDimmer }}>{op}</span>
            <span style={{ color: THEORY_LEVELS[view.right].color }}>{rightA}</span>
            <span style={{ color: C.textDimmer }}> = </span>
            <span style={{ color: THEORY_LEVELS[view.top].color, fontWeight: FW.bold }}>{topA}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export const ColorDice = React.memo(function ColorDice({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  const [showViews, setShowViews] = useState(false);

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

  const hl = hlLevel !== null && hlLevel >= 1 && hlLevel <= 6 ? hlLevel : pinned;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      {/* Die net (staircase unfolding) */}
      <svg viewBox={`0 0 ${NET_W} ${NET_H}`} style={{ width: "100%", maxWidth: NET_W }} role="img" aria-label={t("theory_dice_title")}>
        {NET_COMP_PAIRS.map(([a, b]) => {
          const fa = NET_FACES.find((f) => f.lv === a)!;
          const fb = NET_FACES.find((f) => f.lv === b)!;
          const ax = NET_GAP + fa.col * NET_STEP + NET_CELL / 2;
          const ay = NET_GAP + fa.row * NET_STEP + NET_CELL / 2;
          const bx = NET_GAP + fb.col * NET_STEP + NET_CELL / 2;
          const by = NET_GAP + fb.row * NET_STEP + NET_CELL / 2;
          const isActive = hl === a || hl === b;
          return (
            <line
              key={`nc${a}${b}`}
              x1={ax}
              y1={ay}
              x2={bx}
              y2={by}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={isActive ? 2 : 1}
              strokeDasharray="4,3"
              opacity={isActive ? 0.6 : 0.3}
            />
          );
        })}

        {NET_TOGGLES.map(({ from, to, ch, color }) => {
          const fa = NET_FACES[from];
          const fb = NET_FACES[to];
          const ax = NET_GAP + fa.col * NET_STEP + NET_CELL / 2;
          const ay = NET_GAP + fa.row * NET_STEP + NET_CELL / 2;
          const bx = NET_GAP + fb.col * NET_STEP + NET_CELL / 2;
          const by = NET_GAP + fb.row * NET_STEP + NET_CELL / 2;
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const isHorizontal = fa.row === fb.row;
          const ox = isHorizontal ? 0 : -12;
          const oy = isHorizontal ? -10 : 0;
          return (
            <text
              key={`nt${from}${to}`}
              x={mx + ox}
              y={my + oy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.xs}
              fontFamily="monospace"
              fontWeight={FW.bold}
              fill={color}
              opacity={0.7}
            >
              {ch}
            </text>
          );
        })}

        {NET_FACES.map(({ lv, col, row }) => {
          const info = THEORY_LEVELS[lv];
          const x = NET_GAP + col * (NET_CELL + NET_GAP);
          const y = NET_GAP + row * (NET_CELL + NET_GAP);
          const cx = x + NET_CELL / 2;
          const cy = y + NET_CELL / 2;
          const comp = lv ^ 7;
          const isActive = hl === lv || hl === comp;
          const isDim = hl !== null && !isActive;
          return (
            <g key={`nf${lv}`} onMouseEnter={() => enter(lv)} onMouseLeave={leave} onClick={() => onTap(lv)} style={{ cursor: "pointer" }}>
              <rect
                x={x}
                y={y}
                width={NET_CELL}
                height={NET_CELL}
                rx={4}
                fill={info.color}
                fillOpacity={isDim ? 0.1 : isActive ? 0.5 : 0.3}
                stroke={isActive ? "#fff" : info.color}
                strokeWidth={isActive ? 2 : 1}
                strokeOpacity={isDim ? 0.2 : 0.6}
              />
              <circle
                cx={cx}
                cy={cy}
                r={14}
                fill={info.color}
                fillOpacity={isDim ? 0.2 : 0.85}
                stroke={isDim ? info.color : "#fff"}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeOpacity={isDim ? 0.3 : 0.7}
              />
              <text
                x={cx}
                y={cy}
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
              <text
                x={cx}
                y={y + NET_CELL - 6}
                textAnchor="middle"
                fontSize={FS.xxs}
                fontFamily="monospace"
                fill={isDim ? C.textDimmer : info.color}
                opacity={isDim ? 0.3 : 0.8}
              >
                {info.name}
              </text>
              {isActive && (
                <text x={cx} y={y + 10} textAnchor="middle" fontSize={FS.xxs} fontFamily="monospace" fill={C.textDimmer} opacity={0.7}>
                  +{comp}=7
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Complement pairs summary */}
      <div style={{ display: "flex", gap: SP.lg, justifyContent: "center", flexWrap: "wrap" }}>
        {PAIRS.map(([a, b]) => {
          const infoA = THEORY_LEVELS[a];
          const infoB = THEORY_LEVELS[b];
          const isActive = hl === a || hl === b;
          const isDim = hl !== null && !isActive;
          return (
            <span
              key={`p${a}${b}`}
              style={{
                fontSize: FS.xs,
                fontFamily: "monospace",
                color: isDim ? C.textDimmer : C.textMuted,
                opacity: isDim ? 0.3 : isActive ? 1 : 0.6,
              }}
            >
              {infoA.name}({a}) + {infoB.name}({b}) = 7
            </span>
          );
        })}
      </div>

      <p style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}>
        {t("theory_dice_hint")}
      </p>

      {/* Cube Views toggle */}
      <button style={{ ...S_BTN, opacity: showViews ? 1 : 0.5 }} onClick={() => setShowViews((v) => !v)}>
        {t("theory_dice_views")} {showViews ? "\u25b2" : "\u25bc"}
      </button>

      {/* 8 isometric cube views: 2 columns × 4 rows */}
      {showViews && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.sm }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xl, width: "100%", maxWidth: 220 }}>
            <div style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, textAlign: "center" }}>
              {t("theory_dice_additive_col")}
            </div>
            <div style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, textAlign: "center" }}>
              {t("theory_dice_subtractive_col")}
            </div>
          </div>
          {/* Grid rows */}
          {VIEW_ROWS.map(([left, right], ri) => (
            <div key={`vr${ri}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xl, width: "100%", maxWidth: 220 }}>
              <MiniCube view={left} hl={hl} onEnter={enter} onLeave={leave} onTap={onTap} />
              <MiniCube view={right} hl={hl} onEnter={enter} onLeave={leave} onTap={onTap} />
            </div>
          ))}
          {/* Footer annotation */}
          <p style={{ fontSize: 8, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}>
            {"\u2295"} = XOR (GF(2){"\u00b3"}) | {"\u2227"} = AND (Boolean)
          </p>
        </div>
      )}
    </div>
  );
});

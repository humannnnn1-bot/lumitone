import React, { useCallback, useState } from "react";
import { THEORY_LEVELS, CUBE_EDGES, CUBE_POINTS, TETRA_T0, TETRA_T1, TETRA_T0_EDGES, TETRA_T1_EDGES } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

/* ── Die net (2-2-2 staircase unfolding) ──
   Opposite faces when folded: 2↔5 (R↔C), 6↔1 (Y↔B), 4↔3 (G↔M).
   Each pair satisfies a⊕b = 7 (XOR complement). ── */

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

const M_EDGE = 24;
const M_COS30 = Math.cos(Math.PI / 6);
const M_SIN30 = 0.5;

// Standard isometric projection: front vertex at bottom, 3 edges go upward.
// A = vertical edge (up), B = back-right (up-right), C = back-left (up-left)
const M_A = { dx: 0, dy: -M_EDGE };
const M_B = { dx: M_COS30 * M_EDGE, dy: -M_SIN30 * M_EDGE };
const M_C = { dx: -M_COS30 * M_EDGE, dy: -M_SIN30 * M_EDGE };

const M_VW = 62;
const M_VH = 68;
const M_OX = M_VW / 2;
const M_OY = M_VH - 6; // front vertex near bottom

const fp = (dx: number, dy: number) => `${(M_OX + dx).toFixed(1)},${(M_OY + dy).toFixed(1)}`;

// Top face (lid): O+A, O+A+B, O+A+B+C, O+A+C — diamond at the top
const FACE_T = [
  fp(M_A.dx, M_A.dy),
  fp(M_A.dx + M_B.dx, M_A.dy + M_B.dy),
  fp(M_A.dx + M_B.dx + M_C.dx, M_A.dy + M_B.dy + M_C.dy),
  fp(M_A.dx + M_C.dx, M_A.dy + M_C.dy),
].join(" ");
// Left face: O, O+A, O+A+C, O+C — parallelogram on the left
const FACE_L = [fp(0, 0), fp(M_A.dx, M_A.dy), fp(M_A.dx + M_C.dx, M_A.dy + M_C.dy), fp(M_C.dx, M_C.dy)].join(" ");
// Right face: O, O+B, O+A+B, O+A — parallelogram on the right
const FACE_R = [fp(0, 0), fp(M_B.dx, M_B.dy), fp(M_A.dx + M_B.dx, M_A.dy + M_B.dy), fp(M_A.dx, M_A.dy)].join(" ");

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
  // De Morgan dual pairs: each row's ⊕ and ∧ are related by complement (a⊕b=c ↔ a'∧b'=c')
  // Outputs form complement pairs: Y↔B, C↔R, M↔G. Additive column follows color wheel: Y→C→M.
  [
    { top: 6, left: 2, right: 4, type: "additive" }, // R⊕G=Y
    { top: 1, left: 5, right: 3, type: "subtractive" }, // C∧M=B  (De Morgan dual: R'=C, G'=M, Y'=B)
  ],
  [
    { top: 5, left: 4, right: 1, type: "additive" }, // G⊕B=C
    { top: 2, left: 3, right: 6, type: "subtractive" }, // M∧Y=R  (De Morgan dual: G'=M, B'=Y, C'=R)
  ],
  [
    { top: 3, left: 2, right: 1, type: "additive" }, // R⊕B=M
    { top: 4, left: 5, right: 6, type: "subtractive" }, // C∧Y=G  (De Morgan dual: R'=C, B'=Y, M'=G)
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
  // Draw order: top face first (furthest back), then side faces in front.
  // Note: viewing from above mirrors left/right, so FACE_L shows view.right and vice versa.
  const faces = [
    { pts: FACE_T, lv: view.top },
    { pts: FACE_L, lv: view.right },
    { pts: FACE_R, lv: view.left },
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
                fillOpacity={dim ? 0.15 : 1}
                stroke={dim ? C.textDimmer : "#000"}
                strokeWidth={output ? 1.5 : active ? 1.5 : 1.2}
                strokeOpacity={dim ? 0.2 : 1}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {/* Level numbers on each face */}
        {[
          { lv: view.top, x: M_OX, y: M_OY + M_A.dy + (M_B.dy + M_C.dy) / 2 },
          { lv: view.right, x: M_OX + M_C.dx / 2, y: M_OY + (M_A.dy + M_C.dy) / 2 },
          { lv: view.left, x: M_OX + M_B.dx / 2, y: M_OY + (M_A.dy + M_B.dy) / 2 },
        ].map(({ lv, x, y }) => {
          const isDim = hl !== null && !viewLevels.includes(hl);
          return (
            <text
              key={`n${lv}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight={900}
              fontFamily="monospace"
              fill={isDim ? C.textDimmer : lv >= 4 ? "#000" : "#fff"}
              opacity={isDim ? 0.3 : 0.9}
            >
              {lv}
            </text>
          );
        })}
      </svg>
      {/* Label */}
      <div className="theory-annotation" style={{ fontSize: 9, fontFamily: "monospace", textAlign: "center", lineHeight: 1 }}>
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

/* ── Mini tetrahedron inscribed in ghost cube ── */

const MT_W = 160,
  MT_H = 160;
const MT_CX = MT_W / 2,
  MT_CY = MT_H / 2;

/* Uniform rescaling: compute bounding box of all 8 cube points, then scale to fit */
const _cpVals = Object.values(CUBE_POINTS);
const _cpMinX = Math.min(..._cpVals.map((p) => p.x));
const _cpMaxX = Math.max(..._cpVals.map((p) => p.x));
const _cpMinY = Math.min(..._cpVals.map((p) => p.y));
const _cpMaxY = Math.max(..._cpVals.map((p) => p.y));
const _cpCX = (_cpMinX + _cpMaxX) / 2;
const _cpCY = (_cpMinY + _cpMaxY) / 2;
const _cpSpan = Math.max(_cpMaxX - _cpMinX, _cpMaxY - _cpMinY);
const MT_FIT = (MT_W - 40) / _cpSpan; // 40px padding for vertex labels

function mtPt(lv: number): { x: number; y: number } {
  const p = CUBE_POINTS[lv];
  return {
    x: MT_CX + (p.x - _cpCX) * MT_FIT,
    y: MT_CY + (p.y - _cpCY) * MT_FIT,
  };
}

/** Build the 4 triangular faces from 4 vertices (all C(4,2)=6 edges → 4 faces) */
function tetraFaces(verts: readonly number[]): [number, number, number][] {
  const faces: [number, number, number][] = [];
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++) for (let k = j + 1; k < verts.length; k++) faces.push([verts[i], verts[j], verts[k]]);
  return faces;
}

function MiniTetra({
  verts,
  edges,
  label,
  hl,
  onEnter,
  onLeave,
}: {
  verts: readonly number[];
  edges: [number, number][];
  label: string;
  hl: number | null;
  onEnter: (lv: number) => void;
  onLeave: () => void;
}) {
  const faces = tetraFaces(verts);
  // For each face, find the opposite (4th) vertex: XOR of 3 face verts
  const faceColor = (f: [number, number, number]) => f[0] ^ f[1] ^ f[2];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg viewBox={`0 0 ${MT_W} ${MT_H}`} style={{ width: MT_W, height: MT_H }}>
        {/* Ghost cube edges (dashed, to show inscribed relationship) */}
        {CUBE_EDGES.map(([a, b], i) => (
          <line
            key={`gc${i}`}
            x1={mtPt(a).x}
            y1={mtPt(a).y}
            x2={mtPt(b).x}
            y2={mtPt(b).y}
            stroke={C.textDimmer}
            strokeWidth={0.6}
            strokeDasharray="3 2"
            opacity={0.25}
          />
        ))}
        {/* Ghost vertices (the 4 non-tetrahedron cube vertices as small dots) */}
        {[0, 1, 2, 3, 4, 5, 6, 7]
          .filter((lv) => !verts.includes(lv))
          .map((lv) => {
            const p = mtPt(lv);
            return <circle key={`gv${lv}`} cx={p.x} cy={p.y} r={2.5} fill={C.textDimmer} opacity={0.25} />;
          })}
        {/* Tetrahedron faces (filled triangles) */}
        {faces.map((f, i) => {
          const fc = faceColor(f);
          const info = THEORY_LEVELS[fc];
          const pts = f.map((v) => `${mtPt(v).x},${mtPt(v).y}`).join(" ");
          return (
            <polygon
              key={`tf${i}`}
              points={pts}
              fill={info.color}
              fillOpacity={0.12}
              stroke={info.color}
              strokeWidth={0.5}
              strokeOpacity={0.2}
              strokeLinejoin="round"
            />
          );
        })}
        {/* Tetrahedron edges */}
        {edges.map(([a, b], i) => {
          const active = hl === a || hl === b;
          return (
            <line
              key={`te${i}`}
              x1={mtPt(a).x}
              y1={mtPt(a).y}
              x2={mtPt(b).x}
              y2={mtPt(b).y}
              stroke={active ? "#fff" : "rgba(255,255,255,0.6)"}
              strokeWidth={active ? 2 : 1.2}
              opacity={active ? 0.9 : 0.5}
            />
          );
        })}
        {/* Vertices */}
        {verts.map((lv) => {
          const p = mtPt(lv);
          const info = THEORY_LEVELS[lv];
          const active = hl === lv;
          return (
            <g key={`tv${lv}`} onMouseEnter={() => onEnter(lv)} onMouseLeave={onLeave} style={{ cursor: "pointer" }}>
              <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={9}
                fill={info.color}
                fillOpacity={active ? 0.8 : 0.45}
                stroke={active ? "#fff" : info.color}
                strokeWidth={active ? 2 : 1}
                strokeOpacity={0.8}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xs}
                fontWeight={900}
                fontFamily="monospace"
                fill={lv >= 4 ? "#000" : "#fff"}
                opacity={0.95}
              >
                {lv}
              </text>
            </g>
          );
        })}
      </svg>
      <span style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer }}>{label}</span>
    </div>
  );
}

export const ColorDice = React.memo(function ColorDice({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);

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
              className="theory-annotation"
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

      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}
      >
        {t("theory_dice_hint")}
      </p>

      {/* 8 isometric cube views: 2 columns × 4 rows */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.sm }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xl, width: "100%", maxWidth: 220 }}>
          <div className="theory-annotation" style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, textAlign: "center" }}>
            {t("theory_dice_additive_col")}
          </div>
          <div className="theory-annotation" style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, textAlign: "center" }}>
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
        <p
          className="theory-annotation"
          style={{ fontSize: 8, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center", lineHeight: 1.6 }}
        >
          {"\u2295"} = XOR (GF(2){"\u00b3"}) | {"\u2227"} = AND (Boolean)
          <br />
          De Morgan: a{"\u2295"}b=c {"\u2194"} a{"\u2032"}
          {"\u2227"}b{"\u2032"}=c{"\u2032"} (x{"\u2032"}=x{"\u2295"}7)
        </p>
      </div>

      {/* T0/T1 Tetrahedra — two inscribed tetrahedra in the cube */}
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
      >
        {t("theory_dice_tetra")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
        <div style={{ display: "flex", gap: SP.xl, justifyContent: "center" }}>
          <MiniTetra verts={TETRA_T0} edges={TETRA_T0_EDGES} label={t("theory_dice_tetra_t0")} hl={hl} onEnter={enter} onLeave={leave} />
          <MiniTetra verts={TETRA_T1} edges={TETRA_T1_EDGES} label={t("theory_dice_tetra_t1")} hl={hl} onEnter={enter} onLeave={leave} />
        </div>
        <div style={{ maxWidth: 300, textAlign: "center" }}>
          <p className="theory-annotation" style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textMuted, margin: `0 0 2px` }}>
            {t("theory_dice_tetra_subgroup")}
          </p>
          <p className="theory-annotation" style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, margin: 0 }}>
            {t("theory_dice_tetra_face_xor")}
          </p>
        </div>
      </div>
    </div>
  );
});

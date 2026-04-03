import React, { useCallback, useState } from "react";
import {
  THEORY_LEVELS,
  CUBE_EDGES,
  CUBE_POINTS,
  TETRA_T0,
  TETRA_T1,
  TETRA_T0_EDGES,
  TETRA_T1_EDGES,
  TRUNC_MISSING_EDGES,
} from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
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

/* ── Star net for tetrahedron: 1 center face + 3 surrounding ── */
const STAR_W = 120,
  STAR_H = 110;
const STAR_S = 30; // triangle side
const STAR_TH = (STAR_S * Math.sqrt(3)) / 2;

function StarNet({
  verts,
  label,
  hl,
  onEnter,
  onLeave,
}: {
  verts: readonly number[];
  label: string;
  hl: number | null;
  onEnter: (lv: number) => void;
  onLeave: () => void;
}) {
  const faces = tetraFaces(verts);
  const faceColor = (f: [number, number, number]) => f[0] ^ f[1] ^ f[2];
  // Center face: T0 → Black(0), T1 → White(7).
  // T0={0,3,5,6}: face {3,5,6} has color 3⊕5⊕6=0 (Black). Surround: M(3),C(5),Y(6).
  // T1={1,2,4,7}: face {1,2,4} has color 1⊕2⊕4=7 (White). Surround: R(2),G(4),B(1).
  // Select center by achromatic color (0 or 7):
  const achromaticColor = verts.includes(0) ? 0 : 7;
  const centerFaceIdx = faces.findIndex((f) => faceColor(f) === achromaticColor);
  const centerColor = faceColor(faces[centerFaceIdx]);
  const surroundFaces = faces.filter((_, i) => i !== centerFaceIdx);

  const cx = STAR_W / 2,
    cy = STAR_H / 2 - 2;

  // Center triangle (pointing up)
  const centerPts = `${cx - STAR_S / 2},${cy + STAR_TH / 3} ${cx},${cy - (2 * STAR_TH) / 3} ${cx + STAR_S / 2},${cy + STAR_TH / 3}`;

  // 3 surrounding equilateral triangles — each shares a vertex with center
  const surroundData = [
    // top: vertex-touches center's top vertex B, points down
    {
      pts: `${cx - STAR_S / 2},${cy - (2 * STAR_TH) / 3 - STAR_TH} ${cx},${cy - (2 * STAR_TH) / 3} ${cx + STAR_S / 2},${cy - (2 * STAR_TH) / 3 - STAR_TH}`,
      lx: cx,
      ly: cy - (4 * STAR_TH) / 3,
    },
    // bottom-left: vertex-touches center's bottom-left vertex A, points down
    {
      pts: `${cx - (3 * STAR_S) / 2},${cy + STAR_TH / 3} ${cx - STAR_S / 2},${cy + STAR_TH / 3} ${cx - STAR_S},${cy + STAR_TH / 3 + STAR_TH}`,
      lx: cx - STAR_S,
      ly: cy + (2 * STAR_TH) / 3,
    },
    // bottom-right: vertex-touches center's bottom-right vertex C, points down
    {
      pts: `${cx + STAR_S / 2},${cy + STAR_TH / 3} ${cx + (3 * STAR_S) / 2},${cy + STAR_TH / 3} ${cx + STAR_S},${cy + STAR_TH / 3 + STAR_TH}`,
      lx: cx + STAR_S,
      ly: cy + (2 * STAR_TH) / 3,
    },
  ];

  // Sort surround faces to match positions (top, bottom-left, bottom-right) by their color
  const sortedSurround = [...surroundFaces].sort((a, b) => faceColor(a) - faceColor(b));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg viewBox={`0 0 ${STAR_W} ${STAR_H}`} style={{ width: STAR_W, height: STAR_H }}>
        {/* Center face */}
        {(() => {
          const info = THEORY_LEVELS[centerColor];
          const active = hl === centerColor;
          const dim = hl !== null && !active;
          return (
            <g onMouseEnter={() => onEnter(centerColor)} onMouseLeave={onLeave} style={{ cursor: "default" }}>
              <polygon
                points={centerPts}
                fill={centerColor === 0 ? C.bgRoot : info.color}
                fillOpacity={active ? 0.5 : dim ? 0.08 : 0.3}
                stroke={active ? "#fff" : info.color}
                strokeWidth={active ? 1.5 : 0.8}
                strokeOpacity={dim ? 0.15 : 0.7}
                strokeLinejoin="round"
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontWeight={700}
                fontFamily="monospace"
                fill={centerColor === 0 ? "#888" : centerColor >= 4 ? "#000" : "#fff"}
                opacity={dim ? 0.2 : 0.9}
              >
                {info.short}
              </text>
            </g>
          );
        })()}
        {/* Surrounding faces */}
        {sortedSurround.map((sf, i) => {
          const sc = faceColor(sf);
          const info = THEORY_LEVELS[sc];
          const active = hl === sc;
          const dim = hl !== null && !active;
          const d = surroundData[i];
          return (
            <g key={`sf-${i}`} onMouseEnter={() => onEnter(sc)} onMouseLeave={onLeave} style={{ cursor: "default" }}>
              <polygon
                points={d.pts}
                fill={info.color}
                fillOpacity={active ? 0.5 : dim ? 0.08 : 0.3}
                stroke={active ? "#fff" : info.color}
                strokeWidth={active ? 1.5 : 0.8}
                strokeOpacity={dim ? 0.15 : 0.7}
                strokeLinejoin="round"
              />
              <text
                x={d.lx}
                y={d.ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontWeight={700}
                fontFamily="monospace"
                fill={sc >= 4 ? "#000" : "#fff"}
                opacity={dim ? 0.2 : 0.9}
              >
                {info.short}
              </text>
            </g>
          );
        })}
      </svg>
      <span style={{ fontSize: 8, fontFamily: "monospace", color: C.textDimmer, textAlign: "center", maxWidth: STAR_W }}>{label}</span>
    </div>
  );
}

/* ── Octahedron Gray code strip net ──
   8 faces in Gray code order: [0,1,3,2,6,7,5,4]
   Channel toggles: B,R,B,G,B,R,B (palindrome)
   Adjacent faces = Hamming distance 1. Complement pairs = opposite faces. ── */

const ON_S = 36; // triangle side length
const ON_TH = (ON_S * Math.sqrt(3)) / 2; // triangle height
const ON_SEQ = [0, 1, 3, 2, 6, 7, 5, 4]; // Gray code face order
const ON_CH = ["B", "R", "B", "G", "B", "R", "B"]; // channel toggles
const ON_CH_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };
const ON_W = 8 * (ON_S / 2) + ON_S + 20; // total width with padding
const ON_H = ON_TH + 30; // height with room for labels
const ON_SX = (ON_W - 8 * (ON_S / 2)) / 2; // start X to center
const ON_SY = 8; // start Y

/* ── Complement pairs: 4 pairs shown side by side ── */
const PAIR_W = 56,
  PAIR_H = 90;

function ComplementPairs({ hl, onEnter, onLeave }: { hl: number | null; onEnter: (lv: number) => void; onLeave: () => void }) {
  const cx = PAIR_W / 2;
  const topY = 16;
  const botY = 58;
  const shapeR = 14;

  function triPts(px: number, py: number, r: number, up: boolean): string {
    if (up) return `${px},${py - r} ${px - r * 0.866},${py + r * 0.5} ${px + r * 0.866},${py + r * 0.5}`;
    return `${px - r * 0.866},${py - r * 0.5} ${px + r * 0.866},${py - r * 0.5} ${px},${py + r}`;
  }

  return (
    <div style={{ display: "flex", gap: SP.sm, justifyContent: "center", flexWrap: "wrap" }}>
      {TRUNC_MISSING_EDGES.map(([colorA, colorB]) => {
        const infoA = THEORY_LEVELS[colorA];
        const infoB = THEORY_LEVELS[colorB];
        const activeA = hl === colorA;
        const activeB = hl === colorB;
        const anyActive = hl !== null;
        const dimA = anyActive && !activeA;
        const dimB = anyActive && !activeB;

        return (
          <svg key={`cp-${colorA}`} viewBox={`0 0 ${PAIR_W} ${PAIR_H}`} style={{ width: PAIR_W, height: PAIR_H }}>
            {/* Top face (pointing up) */}
            <g onMouseEnter={() => onEnter(colorA)} onMouseLeave={onLeave} style={{ cursor: "default" }}>
              <polygon
                points={triPts(cx, topY, shapeR, true)}
                fill={colorA === 0 ? C.bgRoot : infoA.color}
                fillOpacity={activeA ? 0.5 : dimA ? 0.08 : 0.25}
                stroke={activeA ? "#fff" : infoA.color}
                strokeWidth={activeA ? 1.5 : 0.8}
                strokeOpacity={dimA ? 0.15 : 0.7}
                strokeLinejoin="round"
              />
              <text
                x={cx}
                y={topY + 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={700}
                fontFamily="monospace"
                fill={colorA === 0 ? "#888" : colorA >= 4 ? "#000" : "#fff"}
                opacity={dimA ? 0.2 : 0.9}
              >
                {infoA.short}
              </text>
            </g>

            {/* Dashed line = non-adjacent (opposite faces) */}
            <line
              x1={cx}
              y1={topY + shapeR + 2}
              x2={cx}
              y2={botY - shapeR - 1}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />

            {/* Bottom face (pointing down) */}
            <g onMouseEnter={() => onEnter(colorB)} onMouseLeave={onLeave} style={{ cursor: "default" }}>
              <polygon
                points={triPts(cx, botY, shapeR, false)}
                fill={infoB.color}
                fillOpacity={activeB ? 0.5 : dimB ? 0.08 : 0.25}
                stroke={activeB ? "#fff" : infoB.color}
                strokeWidth={activeB ? 1.5 : 0.8}
                strokeOpacity={dimB ? 0.15 : 0.7}
                strokeLinejoin="round"
              />
              <text
                x={cx}
                y={botY}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={700}
                fontFamily="monospace"
                fill={colorB === 7 ? "#000" : colorB === 1 ? "#fff" : infoB.color}
                opacity={dimB ? 0.2 : 0.9}
              >
                {infoB.short}
              </text>
            </g>

            {/* XOR equation */}
            <text x={cx} y={PAIR_H - 4} textAnchor="middle" fontSize={7} fontFamily="monospace" fill={C.textDimmer}>
              {colorA}
              {"\u2295"}
              {colorB}=7
            </text>
          </svg>
        );
      })}
    </div>
  );
}

export const TetraDecomposition = React.memo(function TetraDecomposition({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);

  const enter = useCallback(
    (lv: number) => {
      setPinned(null);
      onHover(lv);
    },
    [onHover],
  );
  const leave = useCallback(() => onHover(null), [onHover]);
  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
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

      {/* Star nets: T0 = K+CMY, T1 = W+RGB */}
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
      >
        {t("theory_tetra_star_net")}
      </p>
      <div style={{ display: "flex", gap: SP.xl, justifyContent: "center", flexWrap: "wrap" }}>
        <StarNet verts={TETRA_T0} label={t("theory_tetra_star_t0")} hl={hl} onEnter={enter} onLeave={leave} />
        <StarNet verts={TETRA_T1} label={t("theory_tetra_star_t1")} hl={hl} onEnter={enter} onLeave={leave} />
      </div>

      {/* Truncated Tetrahedron flower net */}
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
      >
        {t("theory_dice_trunc")}
      </p>
      <svg viewBox={`0 0 ${ON_W} ${ON_H}`} style={{ width: "100%", maxWidth: ON_W }}>
        {/* 8 triangular faces in Gray code zigzag */}
        {ON_SEQ.map((color, i) => {
          const info = THEORY_LEVELS[color];
          const isUp = i % 2 === 0;
          const bx = ON_SX + i * (ON_S / 2);
          const x0 = bx,
            x1 = bx + ON_S / 2,
            x2 = bx + ON_S;
          const pts = isUp
            ? `${x0},${ON_SY + ON_TH} ${x1},${ON_SY} ${x2},${ON_SY + ON_TH}`
            : `${x0},${ON_SY} ${x1},${ON_SY + ON_TH} ${x2},${ON_SY}`;
          const ly = isUp ? ON_SY + ON_TH * 0.62 : ON_SY + ON_TH * 0.38;
          const active = hl === color;
          const dim = hl !== null && !active;
          return (
            <g key={`on${i}`} onMouseEnter={() => enter(color)} onMouseLeave={leave} style={{ cursor: "default" }}>
              <polygon
                points={pts}
                fill={color === 0 ? C.bgRoot : info.color}
                fillOpacity={active ? 0.5 : dim ? 0.08 : 0.25}
                stroke={active ? "#fff" : info.color}
                strokeWidth={active ? 1.5 : 0.8}
                strokeOpacity={dim ? 0.15 : 0.7}
                strokeLinejoin="round"
              />
              <text
                x={x1}
                y={ly - 4}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontWeight={900}
                fontFamily="monospace"
                fill={color === 0 || color === 1 ? "#fff" : color === 7 ? "#000" : info.color}
                opacity={dim ? 0.2 : 0.95}
              >
                {info.short}
              </text>
              <text
                x={x1}
                y={ly + 6}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={7}
                fontFamily="monospace"
                fill={color === 0 ? "#555" : color >= 4 ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)"}
                opacity={dim ? 0.1 : 0.7}
              >
                {info.bits.join("")}
              </text>
            </g>
          );
        })}
        {/* Channel toggle labels between triangles */}
        {ON_CH.map((ch, i) => (
          <text
            key={`oc${i}`}
            x={ON_SX + (i + 1) * (ON_S / 2)}
            y={ON_SY + ON_TH + 14}
            textAnchor="middle"
            fontSize={8}
            fontFamily="monospace"
            fontWeight={700}
            fill={ON_CH_COLORS[ch]}
            opacity={0.75}
          >
            {ch}
          </text>
        ))}
      </svg>
      <p
        className="theory-annotation"
        style={{
          fontSize: FS.xs,
          fontFamily: "monospace",
          color: C.textDimmer,
          margin: 0,
          textAlign: "center",
          maxWidth: 340,
          lineHeight: 1.5,
        }}
      >
        {t("theory_dice_trunc_annotation")}
      </p>

      {/* Truncated tetrahedron flower net */}
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
      >
        {t("theory_trunc_net")}
      </p>
      <ComplementPairs hl={hl} onEnter={enter} onLeave={leave} />
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xxs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center", maxWidth: 300 }}
      >
        {t("theory_trunc_net_desc")}
      </p>
    </div>
  );
});

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
import { OctaNet } from "./Octahedron";

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
/* ── Tetrahedron net: 4 triangles forming one big equilateral triangle ──
   Layout (2 rows × 3 cols in triangular grid):
     Row 0:       △ (top face)
     Row 1:  △    ▽    △   (left, center inverted, right)
   Center ▽ = achromatic face (K for T0, W for T1).
   3 surrounding △ faces share edges with center, forming a big △. */

const TNET_S = 36;
const TNET_TH = (TNET_S * Math.sqrt(3)) / 2;
const TNET_W = 120;
const TNET_H = 90;

function TetraNet({
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
  const achromaticColor = verts.includes(0) ? 0 : 7;
  const centerFaceIdx = faces.findIndex((f) => faceColor(f) === achromaticColor);
  const centerColor = faceColor(faces[centerFaceIdx]);
  const surroundFaces = faces.filter((_, i) => i !== centerFaceIdx);
  const sortedSurround = [...surroundFaces].sort((a, b) => faceColor(a) - faceColor(b));

  const hS = TNET_S / 2;
  const ox = (TNET_W - 3 * hS) / 2; // center the 3-column grid
  const oy = 6;

  // Triangle vertex computation (same grid system as OctaNet)
  const tri = (col: number, row: number, up: boolean) => {
    const bx = ox + col * hS;
    const by = oy + row * TNET_TH;
    if (up) {
      return {
        pts: `${bx},${by + TNET_TH} ${bx + hS},${by} ${bx + 2 * hS},${by + TNET_TH}`,
        lx: bx + hS,
        ly: by + TNET_TH * 0.62,
      };
    }
    return {
      pts: `${bx},${by} ${bx + hS},${by + TNET_TH} ${bx + 2 * hS},${by}`,
      lx: bx + hS,
      ly: by + TNET_TH * 0.38,
    };
  };

  // 4 faces: top △, bottom-left △, center ▽, bottom-right △
  const layout: { pts: string; lx: number; ly: number; color: number }[] = [
    { ...tri(1, 0, true), color: faceColor(sortedSurround[0]) }, // top
    { ...tri(0, 1, true), color: faceColor(sortedSurround[1]) }, // bottom-left
    { ...tri(1, 1, false), color: centerColor }, // center ▽
    { ...tri(2, 1, true), color: faceColor(sortedSurround[2]) }, // bottom-right
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg viewBox={`0 0 ${TNET_W} ${TNET_H}`} style={{ width: TNET_W, height: TNET_H }}>
        {layout.map((face, i) => {
          const info = THEORY_LEVELS[face.color];
          const active = hl === face.color;
          const dim = hl !== null && !active;
          return (
            <g key={`tn-${i}`} onMouseEnter={() => onEnter(face.color)} onMouseLeave={onLeave} style={{ cursor: "default" }}>
              <polygon
                points={face.pts}
                fill={face.color === 0 ? C.bgRoot : info.color}
                fillOpacity={active ? 0.5 : dim ? 0.08 : 0.3}
                stroke={active ? "#fff" : info.color}
                strokeWidth={active ? 1.5 : 0.8}
                strokeOpacity={dim ? 0.15 : 0.7}
                strokeLinejoin="round"
              />
              <text
                x={face.lx}
                y={face.ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontWeight={700}
                fontFamily="monospace"
                fill={face.color === 0 ? "#888" : face.color >= 4 ? "#000" : "#fff"}
                opacity={dim ? 0.2 : 0.9}
              >
                {info.short}
              </text>
            </g>
          );
        })}
      </svg>
      <span style={{ fontSize: 8, fontFamily: "monospace", color: C.textDimmer, textAlign: "center", maxWidth: TNET_W }}>{label}</span>
    </div>
  );
}

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
        <TetraNet verts={TETRA_T0} label={t("theory_tetra_star_t0")} hl={hl} onEnter={enter} onLeave={leave} />
        <TetraNet verts={TETRA_T1} label={t("theory_tetra_star_t1")} hl={hl} onEnter={enter} onLeave={leave} />
      </div>

      {/* D8 Color Die — Gray code strip net */}
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
      >
        {t("theory_dice_trunc")}
      </p>
      <OctaNet mode="gray" hl={hl} onEnter={enter} onLeave={leave} t={t} />

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

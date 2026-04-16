import React, { useCallback, useState } from "react";
import {
  THEORY_LEVELS,
  CUBE_EDGES,
  CUBE_POINTS,
  TETRA_T0,
  TETRA_T1,
  TETRA_T0_EDGES,
  TETRA_T1_EDGES,
  vertexRadius,
  faceDiffuse,
  isBackEdge,
  vertexDepth,
} from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

/* ── Mini tetrahedron inscribed in ghost cube ── */

const MT_W = 200,
  MT_H = 200;
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
const MT_FIT = (MT_W - 50) / _cpSpan; // 50px padding for vertex labels

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
        {/* Ghost cube edges (back edges dashed, front edges solid) */}
        {CUBE_EDGES.map(([a, b], i) => {
          const back = isBackEdge(a, b);
          return (
            <line
              key={`gc${i}`}
              x1={mtPt(a).x}
              y1={mtPt(a).y}
              x2={mtPt(b).x}
              y2={mtPt(b).y}
              stroke={C.textDimmer}
              strokeWidth={back ? 0.5 : 0.8}
              strokeDasharray={back ? "3 2" : undefined}
              opacity={back ? 0.15 : 0.3}
            />
          );
        })}
        {/* Ghost vertices (the 4 non-tetrahedron cube vertices as small dots) */}
        {[0, 1, 2, 3, 4, 5, 6, 7]
          .filter((lv) => !verts.includes(lv))
          .map((lv) => {
            const p = mtPt(lv);
            return <circle key={`gv${lv}`} cx={p.x} cy={p.y} r={2.5} fill={C.textDimmer} opacity={0.25} />;
          })}
        {/* Depth-gradient defs for tetra faces */}
        <defs>
          {faces.map((f, i) => {
            const depths = f.map((vi) => ({ v: vi, d: vertexDepth(vi), p: mtPt(vi) }));
            const minD = depths.reduce((a, b) => (a.d < b.d ? a : b));
            const maxD = depths.reduce((a, b) => (a.d > b.d ? a : b));
            if (minD.d === maxD.d) return null;
            const fc = faceColor(f);
            const info = THEORY_LEVELS[fc];
            const opMin = 0.02 + (minD.d / 3) * 0.2;
            const opMax = 0.02 + (maxD.d / 3) * 0.2;
            return (
              <linearGradient
                key={`tfg-${i}`}
                id={`tfg-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={minD.p.x}
                y1={minD.p.y}
                x2={maxD.p.x}
                y2={maxD.p.y}
              >
                <stop offset="0%" stopColor={info.color} stopOpacity={opMin} />
                <stop offset="100%" stopColor={info.color} stopOpacity={opMax} />
              </linearGradient>
            );
          })}
        </defs>
        {/* Tetrahedron faces (filled triangles with depth-based lighting) */}
        {faces.map((f, i) => {
          const fc = faceColor(f);
          const info = THEORY_LEVELS[fc];
          const pts = f.map((v) => `${mtPt(v).x},${mtPt(v).y}`).join(" ");
          const d = faceDiffuse(f[0], f[1], f[2]);
          const depths = f.map((vi) => vertexDepth(vi));
          const hasDepthDiff = Math.max(...depths) !== Math.min(...depths);
          return (
            <polygon
              key={`tf${i}`}
              points={pts}
              fill={hasDepthDiff ? `url(#tfg-${i})` : info.color}
              fillOpacity={hasDepthDiff ? 1 : 0.04 + d * 0.2}
              stroke={info.color}
              strokeWidth={0.5}
              strokeOpacity={0.1 + d * 0.3}
              strokeLinejoin="round"
            />
          );
        })}
        {/* Tetrahedron edge gradient defs */}
        <defs>
          {edges.map(([a, b], i) => {
            const da = vertexDepth(a) / 3;
            const db = vertexDepth(b) / 3;
            if (Math.abs(da - db) < 0.01) return null;
            const pa = mtPt(a),
              pb = mtPt(b);
            const opA = 0.15 + da * 0.6;
            const opB = 0.15 + db * 0.6;
            return (
              <linearGradient key={`teg-${i}`} id={`teg-${i}`} gradientUnits="userSpaceOnUse" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}>
                <stop offset="0%" stopColor="#fff" stopOpacity={opA} />
                <stop offset="100%" stopColor="#fff" stopOpacity={opB} />
              </linearGradient>
            );
          })}
        </defs>
        {/* Tetrahedron edges (depth-based brightness + taper) */}
        {edges.map(([a, b], i) => {
          const active = hl === a || hl === b;
          const da = vertexDepth(a) / 3;
          const db = vertexDepth(b) / 3;
          const hasGradient = Math.abs(da - db) > 0.01;
          const avgDepth = (da + db) / 2;
          const pa = mtPt(a),
            pb = mtPt(b);

          if (active) {
            return <line key={`te${i}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#fff" strokeWidth={2} opacity={0.9} />;
          }

          if (hasGradient) {
            const hwA = 0.3 + da * 0.8;
            const hwB = 0.3 + db * 0.8;
            const dx = pb.x - pa.x,
              dy = pb.y - pa.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len,
              ny = dx / len;
            return (
              <polygon
                key={`te${i}`}
                points={`${pa.x + nx * hwA},${pa.y + ny * hwA} ${pb.x + nx * hwB},${pb.y + ny * hwB} ${pb.x - nx * hwB},${pb.y - ny * hwB} ${pa.x - nx * hwA},${pa.y - ny * hwA}`}
                fill={`url(#teg-${i})`}
              />
            );
          }

          const uniformOp = 0.15 + avgDepth * 0.6;
          const uniformW = 0.6 + avgDepth * 1.2;
          return (
            <line
              key={`te${i}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke="rgba(255,255,255,0.65)"
              strokeWidth={uniformW}
              opacity={uniformOp}
            />
          );
        })}
        {/* Vertices */}
        {verts.map((lv) => {
          const p = mtPt(lv);
          const info = THEORY_LEVELS[lv];
          const active = hl === lv;
          const r = vertexRadius(lv, 11);
          const hitR = vertexRadius(lv, 16);
          return (
            <g key={`tv${lv}`} onMouseEnter={() => onEnter(lv)} onMouseLeave={onLeave} style={{ cursor: "pointer" }}>
              <circle cx={p.x} cy={p.y} r={hitR} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
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
        style={{ fontSize: FS.xl, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
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

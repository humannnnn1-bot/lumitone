import React, { useCallback, useState } from "react";
import {
  THEORY_LEVELS,
  CUBE_EDGES,
  CUBE_POINTS,
  TETRA_T0,
  TETRA_T1,
  TETRA_T0_EDGES,
  TETRA_T1_EDGES,
  TRUNC_TETRA_FACES,
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

  // 3 surrounding triangles (pointing outward from each edge of center)
  const surroundData = [
    // top: shares top edge of center, pointing up further
    {
      pts: `${cx - STAR_S / 2},${cy - (2 * STAR_TH) / 3 - STAR_TH} ${cx},${cy - (2 * STAR_TH) / 3} ${cx + STAR_S / 2},${cy - (2 * STAR_TH) / 3 - STAR_TH}`,
      lx: cx,
      ly: cy - (2 * STAR_TH) / 3 - STAR_TH * 0.4,
    },
    // bottom-left
    {
      pts: `${cx - STAR_S},${cy + STAR_TH / 3} ${cx - STAR_S / 2},${cy + STAR_TH / 3} ${cx - STAR_S / 2 - STAR_S / 2},${cy + STAR_TH / 3 + STAR_TH}`,
      lx: cx - STAR_S * 0.65,
      ly: cy + STAR_TH / 3 + STAR_TH * 0.4,
    },
    // bottom-right
    {
      pts: `${cx + STAR_S / 2},${cy + STAR_TH / 3} ${cx + STAR_S},${cy + STAR_TH / 3} ${cx + STAR_S / 2 + STAR_S / 2},${cy + STAR_TH / 3 + STAR_TH}`,
      lx: cx + STAR_S * 0.65,
      ly: cy + STAR_TH / 3 + STAR_TH * 0.4,
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
                {info.name[0]}
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
                {info.name[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <span style={{ fontSize: 8, fontFamily: "monospace", color: C.textDimmer, textAlign: "center", maxWidth: STAR_W }}>{label}</span>
    </div>
  );
}

/* ── Truncated tetrahedron flower net ── */
const FLOWER_W = 240,
  FLOWER_H = 200;

function TruncFlowerNet({ hl, onEnter, onLeave }: { hl: number | null; onEnter: (lv: number) => void; onLeave: () => void }) {
  const cx = FLOWER_W / 2,
    cy = FLOWER_H / 2;
  const hexR = 22; // hexagon "radius" (center to vertex)
  const triR = 14; // triangle size
  const ringR = 50; // distance from center to ring items

  // Layout: center = hex W(7), ring alternates hex and tri
  // Hex positions: 7(center), 1(B), 2(R), 4(G) at 120° intervals
  // Tri positions: 3(M), 5(C), 6(Y) between hexagons, 0(K) outside
  const hexCenter = { color: 7, x: cx, y: cy };
  const hexRing = [
    { color: 1, angle: -Math.PI / 2 }, // Blue (top)
    { color: 2, angle: -Math.PI / 2 + (2 * Math.PI) / 3 }, // Red (bottom-left)
    { color: 4, angle: -Math.PI / 2 + (4 * Math.PI) / 3 }, // Green (bottom-right)
  ];
  const triRing = [
    { color: 3, angle: -Math.PI / 2 + Math.PI / 3 }, // Magenta (between B and R)
    { color: 5, angle: -Math.PI / 2 + Math.PI }, // Cyan (between R and G)
    { color: 6, angle: -Math.PI / 2 + (5 * Math.PI) / 3 }, // Yellow (between G and B)
  ];
  // Black triangle at outer edge (opposite to White center)
  const triOuter = { color: 0, x: cx, y: cy + ringR + 32 };

  function hexPoints(px: number, py: number, r: number): string {
    return Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI / 6 + (i * Math.PI) / 3;
      return `${px + r * Math.cos(a)},${py + r * Math.sin(a)}`;
    }).join(" ");
  }

  function triPoints(px: number, py: number, r: number, pointUp: boolean): string {
    if (pointUp) {
      return `${px},${py - r} ${px - r * 0.866},${py + r * 0.5} ${px + r * 0.866},${py + r * 0.5}`;
    }
    return `${px - r * 0.866},${py - r * 0.5} ${px + r * 0.866},${py - r * 0.5} ${px},${py + r}`;
  }

  function renderFace(color: number, pts: string, lx: number, ly: number, isHex: boolean) {
    const info = THEORY_LEVELS[color];
    const active = hl === color;
    const dim = hl !== null && !active;
    return (
      <g key={`fl-${color}`} onMouseEnter={() => onEnter(color)} onMouseLeave={onLeave} style={{ cursor: "default" }}>
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
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={700}
          fontFamily="monospace"
          fill={color === 0 || color === 1 ? "#fff" : color === 7 ? "#000" : info.color}
          opacity={dim ? 0.2 : 0.9}
        >
          {isHex ? "⬡" : "△"}
          {info.name[0]}
        </text>
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${FLOWER_W} ${FLOWER_H}`} style={{ width: "100%", maxWidth: FLOWER_W }}>
      {/* Complement pair indicators (dashed lines showing NON-adjacency) */}
      <line
        x1={triOuter.x}
        y1={triOuter.y - triR * 0.5}
        x2={cx}
        y2={cy + hexR * 0.5}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={0.8}
        strokeDasharray="3,3"
      />

      {hexRing.map((h) => {
        const hx = cx + ringR * Math.cos(h.angle);
        const hy = cy + ringR * Math.sin(h.angle);
        // Find complement triangle
        const comp = triRing.find((t) => (t.color ^ h.color) === 7);
        if (comp) {
          const tx = cx + (ringR + 4) * Math.cos(comp.angle);
          const ty = cy + (ringR + 4) * Math.sin(comp.angle);
          return (
            <line
              key={`cp-${h.color}`}
              x1={hx}
              y1={hy}
              x2={tx}
              y2={ty}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={0.8}
              strokeDasharray="3,3"
            />
          );
        }
        return null;
      })}

      {/* Center hexagon (White) */}
      {renderFace(hexCenter.color, hexPoints(hexCenter.x, hexCenter.y, hexR), hexCenter.x, hexCenter.y, true)}

      {/* Ring hexagons (B, R, G) */}
      {hexRing.map((h) => {
        const hx = cx + ringR * Math.cos(h.angle);
        const hy = cy + ringR * Math.sin(h.angle);
        return renderFace(h.color, hexPoints(hx, hy, hexR * 0.8), hx, hy, true);
      })}

      {/* Ring triangles (M, C, Y) */}
      {triRing.map((t) => {
        const tx = cx + (ringR + 4) * Math.cos(t.angle);
        const ty = cy + (ringR + 4) * Math.sin(t.angle);
        const pointOut = t.angle > 0 && t.angle < Math.PI;
        return renderFace(t.color, triPoints(tx, ty, triR, !pointOut), tx, ty, false);
      })}

      {/* Outer triangle (Black) */}
      {renderFace(triOuter.color, triPoints(triOuter.x, triOuter.y, triR, false), triOuter.x, triOuter.y, false)}

      {/* Legend */}
      <text x={FLOWER_W - 8} y={12} textAnchor="end" fontSize={7} fontFamily="monospace" fill={C.textDimmer}>
        {"--- = "}補色非隣接
      </text>
    </svg>
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

      {/* Truncated Tetrahedron: 8 faces = T0 (triangles) + T1 (hexagons) */}
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
      >
        {t("theory_dice_trunc")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.sm }}>
        {/* 8 colored face blocks: 4 triangles (T0) + 4 hexagons (T1) */}
        <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center", maxWidth: 320 }}>
          {TRUNC_TETRA_FACES.map((face, i) => {
            const info = THEORY_LEVELS[face.color];
            const isActive = hl === face.color;
            const isDim = hl !== null && !isActive;
            const shape = face.type === "tri" ? "△" : "⬡";
            const group = face.type === "tri" ? "T0" : "T1";
            return (
              <div
                key={`ttf${i}`}
                onMouseEnter={() => enter(face.color)}
                onMouseLeave={leave}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  opacity: isDim ? 0.25 : 1,
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: face.type === "tri" ? 0 : 6,
                    clipPath: face.type === "tri" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
                    background: face.color === 0 ? C.bgRoot : info.color,
                    border: isActive ? "2px solid #fff" : `1px solid ${info.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: FS.md,
                      fontWeight: 900,
                      fontFamily: "monospace",
                      color: face.color >= 4 ? "#000" : "#fff",
                      marginTop: face.type === "tri" ? 8 : 0,
                    }}
                  >
                    {face.color}
                  </span>
                </div>
                <span style={{ fontSize: 7, fontFamily: "monospace", color: C.textDimmer }}>
                  {shape} {group}
                </span>
              </div>
            );
          })}
        </div>

        {/* Missing edges: 4 complement pairs */}
        <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center" }}>
          {TRUNC_MISSING_EDGES.map(([a, b]) => {
            const infoA = THEORY_LEVELS[a];
            const infoB = THEORY_LEVELS[b];
            return (
              <span key={`me${a}${b}`} className="theory-annotation" style={{ fontSize: 8, fontFamily: "monospace", color: C.textDimmer }}>
                <span style={{ color: infoA.color === "#000000" ? "#666" : infoA.color }}>{a}</span>
                {" ✕ "}
                <span style={{ color: infoB.color }}>{b}</span>
              </span>
            );
          })}
        </div>
        <p
          className="theory-annotation"
          style={{
            fontSize: FS.xs,
            fontFamily: "monospace",
            color: C.textDimmer,
            margin: 0,
            textAlign: "center",
            maxWidth: 300,
            lineHeight: 1.5,
          }}
        >
          {t("theory_dice_trunc_annotation")}
        </p>
      </div>

      {/* Truncated tetrahedron flower net */}
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.accentBright, margin: 0, fontWeight: FW.bold }}
      >
        {t("theory_trunc_net")}
      </p>
      <TruncFlowerNet hl={hl} onEnter={enter} onLeave={leave} />
      <p
        className="theory-annotation"
        style={{ fontSize: FS.xxs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center", maxWidth: 300 }}
      >
        {t("theory_trunc_net_desc")}
      </p>
    </div>
  );
});

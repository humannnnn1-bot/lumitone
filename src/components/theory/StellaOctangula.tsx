import React, { useState, useCallback } from "react";
import {
  THEORY_LEVELS,
  CUBE_POINTS,
  CUBE_EDGES,
  STELLA_EDGES,
  STELLA_FACES,
  STELLA_3D,
  COMPLEMENT_EDGES,
  TETRA_T0,
  TETRA_T1,
  stellaEdgeChannels,
} from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 300;
const VR = 7; // vertex circle radius
const HIT_R = 14; // hit area radius
const CY = 150; // vertical center for label placement

/* ── 3D lighting (same model as Octahedron.tsx) ── */

const LIGHT_DIR: [number, number, number] = (() => {
  const lx = -0.4,
    ly = 0.7,
    lz = 0.6;
  const len = Math.sqrt(lx * lx + ly * ly + lz * lz);
  return [lx / len, ly / len, lz / len];
})();

const CUBE_CENTER: [number, number, number] = [0.5, 0.5, 0.5];

function stellaFaceLighting(verts: readonly [number, number, number]): { isFront: boolean; diffuse: number } {
  const p0 = STELLA_3D[verts[0]],
    p1 = STELLA_3D[verts[1]],
    p2 = STELLA_3D[verts[2]];
  const e1: [number, number, number] = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2: [number, number, number] = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  // Outward: normal should point away from cube center
  const cx = (p0[0] + p1[0] + p2[0]) / 3 - CUBE_CENTER[0];
  const cy = (p0[1] + p1[1] + p2[1]) / 3 - CUBE_CENTER[1];
  const cz = (p0[2] + p1[2] + p2[2]) / 3 - CUBE_CENTER[2];
  const outSign = nx * cx + ny * cy + nz * cz > 0 ? 1 : -1;
  const nnx = (outSign * nx) / nLen;
  const nny = (outSign * ny) / nLen;
  const nnz = (outSign * nz) / nLen;
  const isFront = nnz > 0;
  const dot = nnx * LIGHT_DIR[0] + nny * LIGHT_DIR[1] + nnz * LIGHT_DIR[2];
  const diffuse = 0.15 + 0.85 * Math.max(0, dot);
  return { isFront, diffuse };
}

const FACE_LIGHTING = STELLA_FACES.map((f) => stellaFaceLighting(f.verts));

// Sort faces by diffuse ascending (dim/far first)
const SORTED_FACES = STELLA_FACES.map((f, i) => ({ ...f, origIdx: i })).sort(
  (a, b) => FACE_LIGHTING[a.origIdx].diffuse - FACE_LIGHTING[b.origIdx].diffuse,
);

// Back-edge set: edge is "back" if both adjacent faces are back-facing
const STELLA_BACK_EDGES = new Set<string>();
{
  const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const edgeFaces = new Map<string, number[]>();
  for (let fi = 0; fi < STELLA_FACES.length; fi++) {
    const vs = STELLA_FACES[fi].verts;
    for (let i = 0; i < 3; i++) {
      const k = edgeKey(vs[i], vs[(i + 1) % 3]);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k)!.push(fi);
    }
  }
  for (const [k, faces] of edgeFaces) {
    if (faces.length >= 2 && faces.every((fi) => !FACE_LIGHTING[fi].isFront)) {
      STELLA_BACK_EDGES.add(k);
    }
  }
}

function isBackEdge(a: number, b: number): boolean {
  return STELLA_BACK_EDGES.has(a < b ? `${a}-${b}` : `${b}-${a}`);
}

function centroid2D(verts: readonly [number, number, number]): { x: number; y: number } {
  const p0 = CUBE_POINTS[verts[0]],
    p1 = CUBE_POINTS[verts[1]],
    p2 = CUBE_POINTS[verts[2]];
  return { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
}

const CH_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

/* ── K₈ edge color coding ── */
const K8_Q3_COLOR = "#60aaff";
const K8_STELLA_COLOR = "#ffaa60";
const K8_M4_COLOR = "#ff6080";

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const StellaOctangula = React.memo(function StellaOctangula({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [viewMode, setViewMode] = useState<"compound" | "k8">("compound");
  const [hlFace, setHlFace] = useState<number | null>(null);

  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;

  // Edges adjacent to highlighted vertex
  const hlStellaEdgeSet = new Set<number>();
  const hlFaceSet = new Set<number>();
  let complementLv: number | null = null;

  if (hl !== null) {
    STELLA_EDGES.forEach(([a, b], ei) => {
      if (a === hl || b === hl) hlStellaEdgeSet.add(ei);
    });
    STELLA_FACES.forEach((f, fi) => {
      if (f.verts.includes(hl as number)) hlFaceSet.add(fi);
    });
    complementLv = hl ^ 7;
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

  const anyHl = hl !== null || hlFace !== null;

  // K₈ view: build sets for hl adjacency
  const hlQ3 = new Set<number>();
  const hlStella = new Set<number>();
  const hlM4 = new Set<number>();
  if (hl !== null) {
    CUBE_EDGES.forEach(([a, b], i) => {
      if (a === hl || b === hl) hlQ3.add(i);
    });
    STELLA_EDGES.forEach(([a, b], i) => {
      if (a === hl || b === hl) hlStella.add(i);
    });
    COMPLEMENT_EDGES.forEach(([a, b], i) => {
      if (a === hl || b === hl) hlM4.add(i);
    });
  }

  /* ── Render ── */

  const renderVertices = () =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((lv) => {
      const p = CUBE_POINTS[lv];
      const info = THEORY_LEVELS[lv];
      const active = hl === lv || complementLv === lv;
      const dim = anyHl && !active;
      const isComplement = complementLv === lv;
      const t0 = TETRA_T0 as readonly number[];
      const t1 = TETRA_T1 as readonly number[];
      const sameTetra = hl !== null && ((t0.includes(hl) && t0.includes(lv)) || (t1.includes(hl) && t1.includes(lv)));
      const neighbour = sameTetra && lv !== hl;

      return (
        <g key={`v-${lv}`} onMouseEnter={() => onEnter(lv)} onMouseLeave={onLeave} onClick={() => onTap(lv)} style={{ cursor: "pointer" }}>
          <circle cx={p.x} cy={p.y} r={HIT_R} fill="transparent" />
          {/* Neighbour halo */}
          {neighbour && <circle cx={p.x} cy={p.y} r={VR + 4} fill="none" stroke="#fff" strokeWidth={0.8} strokeOpacity={0.3} />}
          <circle
            cx={p.x}
            cy={p.y}
            r={VR}
            fill={lv === 0 ? C.bgRoot : info.color}
            fillOpacity={active ? 0.85 : dim ? 0.15 : 0.6}
            stroke={isComplement ? "#fff" : active ? "#fff" : lv === 0 ? "#666" : info.color}
            strokeWidth={active ? 2 : 1}
            strokeOpacity={dim ? 0.2 : 0.8}
            strokeDasharray={isComplement ? "3 2" : "none"}
          />
          <text
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={FS.xs}
            fontFamily="monospace"
            fontWeight={FW.bold}
            fill={lv === 6 || lv === 7 ? "#000" : "#fff"}
            opacity={dim ? 0.2 : 0.9}
          >
            {lv}
          </text>
          <text
            x={p.x}
            y={p.y + (p.y < CY ? -VR - 5 : VR + 8)}
            textAnchor="middle"
            dominantBaseline={p.y < CY ? "auto" : "hanging"}
            fontSize={FS.xxs}
            fontFamily="monospace"
            fill={lv === 0 ? "#888" : info.color}
            opacity={dim ? 0.15 : 0.7}
          >
            {info.name}
          </text>
        </g>
      );
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_stella_title")}>
        {viewMode === "compound" ? (
          <>
            {/* ── Compound view: faces + edges + vertices ── */}

            {/* Faces — sorted back to front */}
            {SORTED_FACES.map((sf) => {
              const lighting = FACE_LIGHTING[sf.origIdx];
              const faceActive = hlFace === sf.color || hlFaceSet.has(sf.origIdx);
              const faceDim = anyHl && !faceActive;
              const info = THEORY_LEVELS[sf.color];
              const pts = sf.verts.map((v) => `${CUBE_POINTS[v].x},${CUBE_POINTS[v].y}`).join(" ");
              const ctr = centroid2D(sf.verts);
              const baseOpacity = 0.06 + lighting.diffuse * 0.26;
              const baseStrokeOpacity = 0.1 + lighting.diffuse * 0.3;

              return (
                <g
                  key={`face-${sf.origIdx}`}
                  onMouseEnter={() => setHlFace(sf.color)}
                  onMouseLeave={() => setHlFace(null)}
                  style={{ cursor: "default" }}
                >
                  <polygon points={pts} fill="transparent" />
                  <polygon
                    points={pts}
                    fill={sf.color === 0 ? "#333" : info.color}
                    fillOpacity={faceActive ? 0.4 : faceDim ? 0.03 : baseOpacity}
                    stroke={sf.color === 0 ? "#666" : info.color}
                    strokeWidth={faceActive ? 1.5 : 0.5}
                    strokeOpacity={faceActive ? 0.8 : faceDim ? 0.06 : baseStrokeOpacity}
                    strokeLinejoin="round"
                  />
                  {hlFace === sf.color && (
                    <text
                      x={ctr.x}
                      y={ctr.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={FS.xxs}
                      fontFamily="monospace"
                      fontWeight={FW.bold}
                      fill={sf.color === 0 || sf.color === 1 ? "#fff" : info.color}
                      opacity={0.9}
                    >
                      {sf.tetra === 0 ? "T0" : "T1"}: {info.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Edges — 12 stella edges */}
            {STELLA_EDGES.map(([a, b], ei) => {
              const active = hlStellaEdgeSet.has(ei);
              const dim = anyHl && !active;
              const back = isBackEdge(a, b);
              const pa = CUBE_POINTS[a],
                pb = CUBE_POINTS[b];
              const mx = (pa.x + pb.x) / 2,
                my = (pa.y + pb.y) / 2;

              return (
                <g key={`e-${ei}`}>
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={active ? "#fff" : C.textDimmer}
                    strokeWidth={active ? 1.8 : 0.8}
                    strokeDasharray={back && !active ? "3,3" : undefined}
                    opacity={dim ? 0.1 : active ? 0.85 : 0.3}
                  />
                  {/* Channel label on active edges */}
                  {active &&
                    hl !== null &&
                    (() => {
                      const chs = stellaEdgeChannels(a, b);
                      const dx = pb.x - pa.x,
                        dy = pb.y - pa.y;
                      const len = Math.sqrt(dx * dx + dy * dy) || 1;
                      const ox = (-dy / len) * 10,
                        oy = (dx / len) * 10;
                      return (
                        <text
                          x={mx + ox}
                          y={my + oy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={FS.xxs}
                          fontFamily="monospace"
                          fontWeight={FW.bold}
                          opacity={0.85}
                        >
                          <tspan fill={CH_COLORS[chs[0]]}>{chs[0]}</tspan>
                          <tspan fill="rgba(255,255,255,0.5)">+</tspan>
                          <tspan fill={CH_COLORS[chs[1]]}>{chs[1]}</tspan>
                        </text>
                      );
                    })()}
                </g>
              );
            })}

            {renderVertices()}
          </>
        ) : (
          <>
            {/* ── K₈ decomposition view ── */}

            {/* Q₃ edges (distance 1) */}
            {CUBE_EDGES.map(([a, b], i) => {
              const active = hlQ3.has(i);
              const dim = hl !== null && !active;
              return (
                <line
                  key={`q3-${i}`}
                  x1={CUBE_POINTS[a].x}
                  y1={CUBE_POINTS[a].y}
                  x2={CUBE_POINTS[b].x}
                  y2={CUBE_POINTS[b].y}
                  stroke={K8_Q3_COLOR}
                  strokeWidth={active ? 2 : 1}
                  opacity={dim ? 0.1 : active ? 0.9 : 0.4}
                />
              );
            })}

            {/* Stella edges (distance 2) */}
            {STELLA_EDGES.map(([a, b], i) => {
              const active = hlStella.has(i);
              const dim = hl !== null && !active;
              return (
                <line
                  key={`st-${i}`}
                  x1={CUBE_POINTS[a].x}
                  y1={CUBE_POINTS[a].y}
                  x2={CUBE_POINTS[b].x}
                  y2={CUBE_POINTS[b].y}
                  stroke={K8_STELLA_COLOR}
                  strokeWidth={active ? 2.2 : 1.2}
                  strokeDasharray="5,3"
                  opacity={dim ? 0.1 : active ? 0.9 : 0.35}
                />
              );
            })}

            {/* M₄ edges (distance 3) */}
            {COMPLEMENT_EDGES.map(([a, b], i) => {
              const active = hlM4.has(i);
              const dim = hl !== null && !active;
              return (
                <line
                  key={`m4-${i}`}
                  x1={CUBE_POINTS[a].x}
                  y1={CUBE_POINTS[a].y}
                  x2={CUBE_POINTS[b].x}
                  y2={CUBE_POINTS[b].y}
                  stroke={K8_M4_COLOR}
                  strokeWidth={active ? 2.5 : 1.5}
                  strokeDasharray="2,4"
                  opacity={dim ? 0.1 : active ? 0.9 : 0.3}
                />
              );
            })}

            {renderVertices()}

            {/* K₈ annotation */}
            <text x={W / 2} y={H - 18} textAnchor="middle" fontSize={FS.xxs} fontFamily="monospace">
              <tspan fill={K8_Q3_COLOR}>Q&#x2083;(12)</tspan>
              <tspan fill="rgba(255,255,255,0.4)"> + </tspan>
              <tspan fill={K8_STELLA_COLOR}>&#x2606;(12)</tspan>
              <tspan fill="rgba(255,255,255,0.4)"> + </tspan>
              <tspan fill={K8_M4_COLOR}>M&#x2084;(4)</tspan>
              <tspan fill="rgba(255,255,255,0.5)"> = 28</tspan>
            </text>
            <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={FS.xxs} fontFamily="monospace" fill={C.textDimmer}>
              {t("theory_stella_k8_degree")}
            </text>
          </>
        )}
      </svg>

      {/* Annotation below SVG */}
      {viewMode === "compound" && (
        <p style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}>
          {t("theory_stella_annotation")}
        </p>
      )}

      {/* Toggle buttons */}
      <div style={{ display: "flex", gap: SP.md }}>
        <button
          style={{
            ...S_BTN,
            borderColor: viewMode === "compound" ? C.accentBright : C.border,
            color: viewMode === "compound" ? C.accentBright : C.textMuted,
          }}
          onClick={() => setViewMode("compound")}
        >
          {t("theory_stella_compound")}
        </button>
        <button
          style={{
            ...S_BTN,
            borderColor: viewMode === "k8" ? C.accentBright : C.border,
            color: viewMode === "k8" ? C.accentBright : C.textMuted,
          }}
          onClick={() => setViewMode("k8")}
        >
          {t("theory_stella_k8")}
        </button>
      </div>
    </div>
  );
});

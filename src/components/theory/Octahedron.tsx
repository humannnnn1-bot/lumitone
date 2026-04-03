import React, { useState, useCallback } from "react";
import { THEORY_LEVELS, OCTA_POINTS, OCTA_EDGES, OCTA_FACES, OCTA_COMPLEMENT_AXES } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 300;
const DOT_R = 13;
const CY = 150;

/* ── Gray code strip net (8 triangular faces in zigzag) ── */
const GRAY_CODE_SEQ = [0, 1, 3, 2, 6, 7, 5, 4]; // face colors in Gray code order
const GRAY_CHANNELS = ["B", "R", "B", "G", "B", "R", "B"]; // channel toggles (palindrome)
const GRAY_CH_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };
const NET_W = 300,
  NET_H = 90;
const TRI_S = 32; // triangle side length
const TRI_H_VAL = (TRI_S * Math.sqrt(3)) / 2; // triangle height
const NET_START_X = (NET_W - (8 * TRI_S) / 2) / 2; // center the strip
const NET_START_Y = (NET_H - TRI_H_VAL) / 2 + 4;

/* ── 3D lighting model ── */

// 3D coordinates of octahedron vertices (unit cross-polytope on R/G/B axes).
// Slightly tilted from pure axis-alignment to avoid edge-on faces.
// The tilt gives a "generic" viewpoint where all 4 front faces are clearly visible
// and the silhouette forms a proper hexagon instead of a degenerate quadrilateral.
const TILT = 0.18; // small forward tilt on B axis
const OCTA_3D: Record<number, [number, number, number]> = {
  2: [0, 1, 0], // Red = +R axis
  5: [0, -1, 0], // Cyan = -R axis
  4: [1, 0, TILT], // Green = +G axis, slightly forward
  3: [-1, 0, TILT], // Magenta = -G axis, slightly forward
  1: [0, 0, 1], // Blue = +B axis
  6: [0, 0, -1], // Yellow = -B axis
};

// Light direction: from upper-left-front, normalized
const LIGHT_DIR: [number, number, number] = (() => {
  const lx = -0.4,
    ly = 0.7,
    lz = 0.6;
  const len = Math.sqrt(lx * lx + ly * ly + lz * lz);
  return [lx / len, ly / len, lz / len];
})();

/** Compute face normal (outward) and diffuse lighting for a face */
function faceLighting(verts: readonly [number, number, number]): { isFront: boolean; diffuse: number } {
  const [a, b, c] = verts;
  const p0 = OCTA_3D[a],
    p1 = OCTA_3D[b],
    p2 = OCTA_3D[c];
  // Edge vectors
  const e1: [number, number, number] = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2: [number, number, number] = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  // Cross product (face normal)
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  // Ensure outward-pointing: normal should point away from origin (dot with centroid > 0)
  const cx = (p0[0] + p1[0] + p2[0]) / 3;
  const cy = (p0[1] + p1[1] + p2[1]) / 3;
  const cz = (p0[2] + p1[2] + p2[2]) / 3;
  const outSign = nx * cx + ny * cy + nz * cz > 0 ? 1 : -1;
  const nnx = (outSign * nx) / nLen;
  const nny = (outSign * ny) / nLen;
  const nnz = (outSign * nz) / nLen;
  // Is front-facing? Check if normal has positive z component (toward viewer in isometric)
  const isFront = nnz > 0;
  // Diffuse = dot(normal, light), clamped to [0,1] with ambient
  const dot = nnx * LIGHT_DIR[0] + nny * LIGHT_DIR[1] + nnz * LIGHT_DIR[2];
  const ambient = 0.15;
  const diffuse = ambient + (1 - ambient) * Math.max(0, dot);
  return { isFront, diffuse };
}

// Precompute lighting for all faces
const FACE_LIGHTING = OCTA_FACES.map((f) => faceLighting(f.verts));

/** Sort faces back-to-front using 3D face-centroid depth (z component) */
function sortedFaces() {
  const indexed = OCTA_FACES.map((f, i) => ({ f, i }));
  indexed.sort((a, b) => {
    const zA = FACE_LIGHTING[a.i].diffuse;
    const zB = FACE_LIGHTING[b.i].diffuse;
    return zA - zB; // dimmer (back) first, brighter (front) last
  });
  return indexed.map(({ f, i }) => ({ ...f, origIdx: i }));
}

const SORTED_FACES = sortedFaces();

/** Centroid of a triangle */
function centroid(verts: readonly [number, number, number]): { x: number; y: number } {
  const p0 = OCTA_POINTS[verts[0]],
    p1 = OCTA_POINTS[verts[1]],
    p2 = OCTA_POINTS[verts[2]];
  return { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
}

function isFrontFace(f: (typeof OCTA_FACES)[number]): boolean {
  const idx = OCTA_FACES.indexOf(f);
  return idx >= 0 ? FACE_LIGHTING[idx].isFront : false;
}

/** Back-edge set: an edge is "back" if both adjacent faces are back-facing */
const OCTA_BACK_EDGES = new Set<string>();
{
  const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const edgeFaces = new Map<string, (typeof OCTA_FACES)[number][]>();
  for (const f of OCTA_FACES) {
    const vs = f.verts;
    for (let i = 0; i < 3; i++) {
      const k = edgeKey(vs[i], vs[(i + 1) % 3]);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k)!.push(f);
    }
  }
  for (const [k, faces] of edgeFaces) {
    if (faces.length === 2 && !isFrontFace(faces[0]) && !isFrontFace(faces[1])) {
      OCTA_BACK_EDGES.add(k);
    }
  }
}

function isOctaBackEdge(a: number, b: number): boolean {
  return OCTA_BACK_EDGES.has(a < b ? `${a}-${b}` : `${b}-${a}`);
}

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const Octahedron = React.memo(function Octahedron({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [showAxes, setShowAxes] = useState(false);
  const [showNet, setShowNet] = useState(false);
  const [hlFace, setHlFace] = useState<number | null>(null);

  const hl = hlLevel !== null && hlLevel >= 1 && hlLevel <= 6 ? hlLevel : pinned;

  // Edges adjacent to highlighted vertex
  const hlEdgeSet = new Set<number>();
  // Faces adjacent to highlighted vertex
  const hlFaceSet = new Set<number>();
  // Complement partner
  let complementLv: number | null = null;

  if (hl !== null) {
    OCTA_EDGES.forEach(([a, b], ei) => {
      if (a === hl || b === hl) hlEdgeSet.add(ei);
    });
    OCTA_FACES.forEach((f, fi) => {
      if (f.verts.includes(hl as 1 | 2 | 3 | 4 | 5 | 6)) hlFaceSet.add(fi);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_octa_title")}>
        {/* Faces — sorted back to front with diffuse lighting */}
        {SORTED_FACES.map((sf, fi) => {
          const lighting = FACE_LIGHTING[sf.origIdx];
          const faceActive = hlFace === sf.color || hlFaceSet.has(sf.origIdx);
          const faceDim = anyHl && !faceActive;
          const info = THEORY_LEVELS[sf.color];
          const pts = sf.verts.map((v) => `${OCTA_POINTS[v].x},${OCTA_POINTS[v].y}`).join(" ");
          const ctr = centroid(sf.verts);

          // Diffuse lighting drives face opacity: bright faces 0.30, dim faces 0.05
          const baseOpacity = 0.05 + lighting.diffuse * 0.28;
          const baseStrokeOpacity = 0.08 + lighting.diffuse * 0.3;

          return (
            <g
              key={`face-${fi}`}
              onMouseEnter={() => setHlFace(sf.color)}
              onMouseLeave={() => setHlFace(null)}
              style={{ cursor: "default" }}
            >
              {/* Invisible hit area */}
              <polygon points={pts} fill="transparent" />
              {/* Visible face */}
              <polygon
                points={pts}
                fill={info.color}
                fillOpacity={faceActive ? 0.4 : faceDim ? 0.03 : baseOpacity}
                stroke={info.color}
                strokeWidth={faceActive ? 1.5 : 0.5}
                strokeOpacity={faceActive ? 0.8 : faceDim ? 0.06 : baseStrokeOpacity}
                strokeLinejoin="round"
              />
              {/* Face label on hover */}
              {hlFace === sf.color && (
                <text
                  x={ctr.x}
                  y={ctr.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.xs}
                  fontFamily="monospace"
                  fontWeight={FW.bold}
                  fill={sf.color === 0 || sf.color === 1 ? "#fff" : info.color}
                  opacity={0.9}
                >
                  {info.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Edges */}
        {OCTA_EDGES.map(([a, b], ei) => {
          const active = hlEdgeSet.has(ei);
          const dim = anyHl && !active;
          const back = isOctaBackEdge(a, b);
          return (
            <line
              key={`e-${ei}`}
              x1={OCTA_POINTS[a].x}
              y1={OCTA_POINTS[a].y}
              x2={OCTA_POINTS[b].x}
              y2={OCTA_POINTS[b].y}
              stroke={active ? "#fff" : C.textDimmer}
              strokeWidth={active ? 1.8 : 0.8}
              strokeDasharray={back && !active ? "3,3" : undefined}
              opacity={dim ? 0.12 : active ? 0.85 : 0.35}
            />
          );
        })}

        {/* Complement axes (optional) */}
        {showAxes &&
          OCTA_COMPLEMENT_AXES.map(([a, b]) => {
            const pa = OCTA_POINTS[a],
              pb = OCTA_POINTS[b];
            const mx = (pa.x + pb.x) / 2,
              my = (pa.y + pb.y) / 2;
            return (
              <g key={`ax-${a}-${b}`}>
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="4 3" />
                <text
                  x={mx + (a === 4 ? 16 : a === 1 ? -16 : 0)}
                  y={my + (a === 2 ? -14 : a === 4 ? 10 : 14)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.xxs}
                  fontFamily="monospace"
                  fill="rgba(255,255,255,0.4)"
                >
                  {THEORY_LEVELS[a].short}\u2194{THEORY_LEVELS[b].short}
                </text>
              </g>
            );
          })}

        {/* Vertices */}
        {[2, 5, 4, 3, 1, 6].map((lv) => {
          const p = OCTA_POINTS[lv];
          const info = THEORY_LEVELS[lv];
          const active = hl === lv || complementLv === lv;
          const dim = anyHl && !active && !hlFaceSet.has(-1); // dim only when something is highlighted
          const isComplement = complementLv === lv;

          return (
            <g
              key={`v-${lv}`}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
            >
              {/* Larger hit area */}
              <circle cx={p.x} cy={p.y} r={DOT_R + 6} fill="transparent" />
              {/* Vertex circle */}
              <circle
                cx={p.x}
                cy={p.y}
                r={DOT_R}
                fill={info.color}
                fillOpacity={active ? 0.5 : dim ? 0.08 : 0.3}
                stroke={isComplement ? "#fff" : active ? "#fff" : info.color}
                strokeWidth={active ? 2 : 1.2}
                strokeOpacity={dim ? 0.15 : 0.7}
                strokeDasharray={isComplement ? "3 2" : "none"}
              />
              {/* Level number */}
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fontFamily="monospace"
                fontWeight={FW.bold}
                fill={lv === 6 ? "#000" : "#fff"}
                opacity={dim ? 0.2 : 0.9}
              >
                {lv}
              </text>
              {/* Color name below/above vertex */}
              <text
                x={p.x}
                y={p.y + (p.y < CY ? -DOT_R - 5 : DOT_R + 8)}
                textAnchor="middle"
                dominantBaseline={p.y < CY ? "auto" : "hanging"}
                fontSize={FS.xxs}
                fontFamily="monospace"
                fill={info.color}
                opacity={dim ? 0.15 : 0.7}
              >
                {info.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Gray code strip net */}
      {showNet && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.sm }}>
          <svg viewBox={`0 0 ${NET_W} ${NET_H}`} style={{ width: "100%", maxWidth: NET_W }} role="img" aria-label={t("theory_octa_net")}>
            {GRAY_CODE_SEQ.map((color, i) => {
              const info = THEORY_LEVELS[color];
              const isUp = i % 2 === 0; // even index = pointing up
              const baseX = NET_START_X + i * (TRI_S / 2);
              const x0 = baseX;
              const x1 = baseX + TRI_S / 2;
              const x2 = baseX + TRI_S;
              let pts: string;
              let labelY: number;
              if (isUp) {
                pts = `${x0},${NET_START_Y + TRI_H_VAL} ${x1},${NET_START_Y} ${x2},${NET_START_Y + TRI_H_VAL}`;
                labelY = NET_START_Y + TRI_H_VAL * 0.62;
              } else {
                pts = `${x0},${NET_START_Y} ${x1},${NET_START_Y + TRI_H_VAL} ${x2},${NET_START_Y}`;
                labelY = NET_START_Y + TRI_H_VAL * 0.38;
              }
              const active = hl === color;
              const dim = hl !== null && !active;
              return (
                <g
                  key={`net-${i}`}
                  onMouseEnter={() => onEnter(color >= 1 && color <= 6 ? color : color === 0 ? 0 : 7)}
                  onMouseLeave={onLeave}
                  style={{ cursor: "default" }}
                >
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
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="monospace"
                    fill={color === 0 || color === 1 ? "#fff" : color === 7 ? "#000" : info.color}
                    opacity={dim ? 0.2 : 0.9}
                  >
                    {info.short}
                  </text>
                </g>
              );
            })}
            {/* Channel toggle labels between triangles */}
            {GRAY_CHANNELS.map((ch, i) => {
              const x = NET_START_X + (i + 1) * (TRI_S / 2);
              return (
                <text
                  key={`ch-${i}`}
                  x={x}
                  y={NET_START_Y + TRI_H_VAL + 14}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="monospace"
                  fontWeight={700}
                  fill={GRAY_CH_COLORS[ch]}
                  opacity={0.7}
                >
                  {ch}
                </text>
              );
            })}
          </svg>
          <p
            className="theory-annotation"
            style={{ fontSize: FS.xxs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center", maxWidth: 300 }}
          >
            {t("theory_octa_net_desc")}
          </p>
        </div>
      )}

      {/* Toggle buttons */}
      <div style={{ display: "flex", gap: SP.md, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          style={{
            ...S_BTN,
            borderColor: showNet ? C.accentBright : C.border,
            color: showNet ? C.accentBright : C.textMuted,
          }}
          onClick={() => setShowNet((v) => !v)}
        >
          {t("theory_octa_net")}
        </button>
        <button
          style={{
            ...S_BTN,
            borderColor: showAxes ? C.accentBright : C.border,
            color: showAxes ? C.accentBright : C.textMuted,
          }}
          onClick={() => setShowAxes((v) => !v)}
        >
          {t("theory_octa_axes")}
        </button>
      </div>
    </div>
  );
});

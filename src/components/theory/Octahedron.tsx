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

/* ── 3D geometry: RGB face front / CMY face front ── */

/** Base octahedron vertices (unit cross-polytope) */
const BASE_3D: Record<number, [number, number, number]> = {
  2: [0, 1, 0], // Red = +y
  5: [0, -1, 0], // Cyan = -y
  4: [1, 0, 0], // Green = +x
  3: [-1, 0, 0], // Magenta = -x
  1: [0, 0, 1], // Blue = +z
  6: [0, 0, -1], // Yellow = -z
};

/** Rodrigues rotation: rotate vector v around unit axis k by angle θ */
function rodrigues(v: [number, number, number], k: [number, number, number], theta: number): [number, number, number] {
  const c = Math.cos(theta),
    s = Math.sin(theta),
    t = 1 - c;
  const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const kxv: [number, number, number] = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [v[0] * c + kxv[0] * s + k[0] * d * t, v[1] * c + kxv[1] * s + k[1] * d * t, v[2] * c + kxv[2] * s + k[2] * d * t];
}

/** Apply rotation to all vertices */
function rotateAll(
  coords: Record<number, [number, number, number]>,
  k: [number, number, number],
  theta: number,
): Record<number, [number, number, number]> {
  const result: Record<number, [number, number, number]> = {};
  for (const key of Object.keys(coords)) {
    result[Number(key)] = rodrigues(coords[Number(key)], k, theta);
  }
  return result;
}

/*
 * Front view: RGB face (White, vertices R+G+B, normal [1,1,1]) tilted toward viewer.
 * Partial rotation toward [1,1,1]: enough to make RGB face the frontmost,
 * but preserving the hexagonal silhouette (not face-on).
 * Rotation axis: [1,-1,0]/√2 (perpendicular to [1,1,1] and [0,0,1]).
 */
/*
 * 2D positions: use original OCTA_POINTS for regular hexagonal silhouette.
 * 3D coords: rotated versions used ONLY for lighting/front-back computation.
 *
 * Front view (RGB face = White face prominent):
 *   Rotate toward [1,1,1] so RGB face normal has positive z → front-lit.
 *   Then slight x-tilt for "from above" lighting.
 * Back view (CMY face = Black face prominent):
 *   Flip 180° around y, then slight opposite tilt for "from below" lighting.
 *   2D positions are mirrored horizontally for back perspective.
 */
const SQ2 = Math.sqrt(2);
const ALIGN_AXIS: [number, number, number] = [1 / SQ2, -1 / SQ2, 0];
const ALIGN_ANGLE = Math.acos(1 / Math.sqrt(3)) * 0.45; // ~25° bias toward RGB face (lighting only)

/* Front: RGB (White) face forward — 3D for lighting only */
const OCTA_3D_FRONT = rotateAll(BASE_3D, ALIGN_AXIS, ALIGN_ANGLE);

/* 2D points: regular hexagonal silhouette (unchanged from theory-data) */
const OCTA_POINTS_FRONT = OCTA_POINTS;

/*
 * Hidden-edge computation: must match the 2D layout (BASE_3D), not the rotated
 * 3D used for lighting. Otherwise silhouette edges get incorrectly classified as hidden.
 */
function computeHiddenEdges(octa3d: Record<number, [number, number, number]>): Set<string> {
  const lighting = OCTA_FACES.map((f) => computeFaceLighting(f.verts, octa3d, LIGHT_DIR));
  const edgeKeyFn = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const edgeFaces = new Map<string, number[]>();
  for (let fi = 0; fi < OCTA_FACES.length; fi++) {
    const vs = OCTA_FACES[fi].verts;
    for (let i = 0; i < 3; i++) {
      const k = edgeKeyFn(vs[i], vs[(i + 1) % 3]);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k)!.push(fi);
    }
  }
  const hidden = new Set<string>();
  for (const [k, faces] of edgeFaces) {
    if (faces.length === 2 && !lighting[faces[0]].isFront && !lighting[faces[1]].isFront) {
      hidden.add(k);
    }
  }
  return hidden;
}
const LIGHT_DIR: [number, number, number] = (() => {
  const lx = -0.4,
    ly = 0.7,
    lz = 0.6;
  const len = Math.sqrt(lx * lx + ly * ly + lz * lz);
  return [lx / len, ly / len, lz / len];
})();

const HIDDEN_EDGES_FRONT = computeHiddenEdges(BASE_3D);

/* ── Per-view precomputation ── */

interface FaceLightData {
  isFront: boolean;
  diffuse: number;
  centroidZ: number;
}

interface DiamondViewData {
  faceLighting: FaceLightData[];
  sortedFaces: { verts: [number, number, number]; color: number; origIdx: number }[];
  backEdges: Set<string>;
  silhouetteEdges: Set<string>;
  frontFaceEdges: Set<string>;
  backFaceEdges: Set<string>;
  hiddenEdges: Set<string>;
  points: Record<number, { x: number; y: number }>;
}

function computeFaceLighting(
  verts: readonly [number, number, number],
  octa3d: Record<number, [number, number, number]>,
  lightDir: [number, number, number],
): FaceLightData {
  const [a, b, c] = verts;
  const p0 = octa3d[a],
    p1 = octa3d[b],
    p2 = octa3d[c];
  const e1: [number, number, number] = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2: [number, number, number] = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  const cx = (p0[0] + p1[0] + p2[0]) / 3;
  const cy = (p0[1] + p1[1] + p2[1]) / 3;
  const cz = (p0[2] + p1[2] + p2[2]) / 3;
  const outSign = nx * cx + ny * cy + nz * cz > 0 ? 1 : -1;
  const nnx = (outSign * nx) / nLen;
  const nny = (outSign * ny) / nLen;
  const nnz = (outSign * nz) / nLen;
  const isFront = nnz > 0;
  const dot = nnx * lightDir[0] + nny * lightDir[1] + nnz * lightDir[2];
  const ambient = 0.15;
  const diffuse = ambient + (1 - ambient) * Math.max(0, dot);
  return { isFront, diffuse, centroidZ: cz };
}

function computeDiamondView(
  octa3d: Record<number, [number, number, number]>,
  points: Record<number, { x: number; y: number }>,
): DiamondViewData {
  const faceLighting = OCTA_FACES.map((f) => computeFaceLighting(f.verts, octa3d, LIGHT_DIR));
  const indexed = OCTA_FACES.map((f, i) => ({ f, i }));
  indexed.sort((a, b) => faceLighting[a.i].centroidZ - faceLighting[b.i].centroidZ);
  const sortedFaces = indexed.map(({ f, i }) => ({ ...f, origIdx: i }));

  const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const edgeFaces = new Map<string, number[]>();
  for (let fi = 0; fi < OCTA_FACES.length; fi++) {
    const vs = OCTA_FACES[fi].verts;
    for (let i = 0; i < 3; i++) {
      const k = edgeKey(vs[i], vs[(i + 1) % 3]);
      if (!edgeFaces.has(k)) edgeFaces.set(k, []);
      edgeFaces.get(k)!.push(fi);
    }
  }
  const backEdges = new Set<string>();
  const silhouetteEdges = new Set<string>();
  for (const [k, faces] of edgeFaces) {
    if (faces.length === 2) {
      const f0Front = faceLighting[faces[0]].isFront;
      const f1Front = faceLighting[faces[1]].isFront;
      if (!f0Front && !f1Front) {
        backEdges.add(k);
      } else if (f0Front !== f1Front) {
        silhouetteEdges.add(k);
      }
    }
  }

  // Frontmost / backmost face by centroid z-depth
  const edgeKeyFn = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  let frontFaceIdx = 0,
    backFaceIdx = 0;
  for (let fi = 0; fi < OCTA_FACES.length; fi++) {
    if (faceLighting[fi].centroidZ > faceLighting[frontFaceIdx].centroidZ) frontFaceIdx = fi;
    if (faceLighting[fi].centroidZ < faceLighting[backFaceIdx].centroidZ) backFaceIdx = fi;
  }
  const frontFaceEdges = new Set<string>();
  const backFaceEdges = new Set<string>();
  const fv = OCTA_FACES[frontFaceIdx].verts;
  const bv = OCTA_FACES[backFaceIdx].verts;
  for (let i = 0; i < 3; i++) {
    frontFaceEdges.add(edgeKeyFn(fv[i], fv[(i + 1) % 3]));
    backFaceEdges.add(edgeKeyFn(bv[i], bv[(i + 1) % 3]));
  }

  return { faceLighting, sortedFaces, backEdges, silhouetteEdges, frontFaceEdges, backFaceEdges, hiddenEdges: backEdges, points };
}

const DIAMOND_FRONT = { ...computeDiamondView(OCTA_3D_FRONT, OCTA_POINTS_FRONT), hiddenEdges: HIDDEN_EDGES_FRONT };

/* ── Single Diamond view sub-component ── */

function DiamondView({
  view,
  viewId,
  mirror,
  hl,
  complementLv,
  hlEdgeSet,
  hlFaceSet,
  hlFace,
  setHlFace,
  showAxes,
  anyHl,
  onEnter,
  onLeave,
  onTap,
}: {
  view: DiamondViewData;
  viewId: string;
  mirror: boolean;
  hl: number | null;
  complementLv: number | null;
  hlEdgeSet: Set<number>;
  hlFaceSet: Set<number>;
  hlFace: number | null;
  setHlFace: (c: number | null) => void;
  showAxes: boolean;
  anyHl: boolean;
  onEnter: (lv: number) => void;
  onLeave: () => void;
  onTap: (lv: number) => void;
}) {
  const { sortedFaces, frontFaceEdges, backFaceEdges, points } = view;

  function centroid2d(verts: readonly [number, number, number]): { x: number; y: number } {
    const p0 = points[verts[0]],
      p1 = points[verts[1]],
      p2 = points[verts[2]];
    return { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
  }

  // Axis label offsets: mirror x-offsets for back view
  const axXOff = (a: number) => {
    const base = a === 4 ? 16 : a === 1 ? -16 : 0;
    return mirror ? -base : base;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 300 }} role="img">
      {/* Gradient defs: 3 per face (one per vertex → opposite edge midpoint) */}
      <defs>
        {/* Edge gradients: vertex-to-vertex color blend */}
        {OCTA_EDGES.map(([a, b], ei) => (
          <linearGradient
            key={`${viewId}-eg-${ei}`}
            id={`${viewId}-eg-${ei}`}
            gradientUnits="userSpaceOnUse"
            x1={points[a].x}
            y1={points[a].y}
            x2={points[b].x}
            y2={points[b].y}
          >
            <stop offset="0%" stopColor={THEORY_LEVELS[a].color} />
            <stop offset="100%" stopColor={THEORY_LEVELS[b].color} />
          </linearGradient>
        ))}
        {/* Face gradients: 3 per face (one per vertex → opposite edge midpoint) */}
        {sortedFaces.map((sf, fi) =>
          sf.verts.map((v, vi) => {
            const vp = points[v];
            const opp0 = points[sf.verts[(vi + 1) % 3]];
            const opp1 = points[sf.verts[(vi + 2) % 3]];
            const mx = (opp0.x + opp1.x) / 2;
            const my = (opp0.y + opp1.y) / 2;
            return (
              <linearGradient
                key={`${viewId}-fg-${fi}-${vi}`}
                id={`${viewId}-fg-${fi}-${vi}`}
                gradientUnits="userSpaceOnUse"
                x1={vp.x}
                y1={vp.y}
                x2={mx}
                y2={my}
              >
                <stop offset="0%" stopColor={THEORY_LEVELS[v].color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={THEORY_LEVELS[v].color} stopOpacity={0} />
              </linearGradient>
            );
          }),
        )}
      </defs>

      {/* Faces — uniform opacity with vertex-color gradients (no lighting) */}
      {sortedFaces.map((sf, fi) => {
        const faceActive = hlFace === sf.color || hlFaceSet.has(sf.origIdx);
        const faceDim = anyHl && !faceActive;
        const info = THEORY_LEVELS[sf.color];
        const pts = sf.verts.map((v) => `${points[v].x},${points[v].y}`).join(" ");
        const ctr = centroid2d(sf.verts);

        const layerOpacity = faceActive ? 0.6 : faceDim ? 0.04 : 0.4;
        const strokeOp = faceActive ? 0.8 : faceDim ? 0.06 : 0.3;

        return (
          <g key={`face-${fi}`} onMouseEnter={() => setHlFace(sf.color)} onMouseLeave={() => setHlFace(null)} style={{ cursor: "default" }}>
            <polygon points={pts} fill="transparent" />
            {[0, 1, 2].map((vi) => (
              <polygon
                key={vi}
                points={pts}
                fill={`url(#${viewId}-fg-${fi}-${vi})`}
                fillOpacity={layerOpacity}
                stroke="none"
                strokeLinejoin="round"
              />
            ))}
            <polygon
              points={pts}
              fill="none"
              stroke={info.color}
              strokeWidth={faceActive ? 1.5 : 0.5}
              strokeOpacity={strokeOp}
              strokeLinejoin="round"
            />
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

      {/* Edges — vertex-to-vertex color gradient, front/back depth cue */}
      {OCTA_EDGES.map(([a, b], ei) => {
        const active = hlEdgeSet.has(ei);
        const dim = anyHl && !active;
        const ek = a < b ? `${a}-${b}` : `${b}-${a}`;
        const isFront = frontFaceEdges.has(ek);
        const isBackFace = backFaceEdges.has(ek);
        const isHidden = isBackFace;
        const w = active ? 2.5 : isFront ? 2.5 : isBackFace ? 1.2 : 2;
        const op = dim ? 0.15 : active ? 0.9 : isFront ? 0.9 : isBackFace ? 0.35 : 0.65;
        return (
          <line
            key={`e-${ei}`}
            x1={points[a].x}
            y1={points[a].y}
            x2={points[b].x}
            y2={points[b].y}
            stroke={active ? "#fff" : `url(#${viewId}-eg-${ei})`}
            strokeWidth={w}
            strokeDasharray={isHidden && !active ? "6,4" : undefined}
            opacity={op}
          />
        );
      })}

      {/* Complement axes (optional) */}
      {showAxes &&
        OCTA_COMPLEMENT_AXES.map(([a, b]) => {
          const pa = points[a],
            pb = points[b];
          const mx = (pa.x + pb.x) / 2,
            my = (pa.y + pb.y) / 2;
          return (
            <g key={`ax-${a}-${b}`}>
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="4 3" />
              <text
                x={mx + axXOff(a)}
                y={my + (a === 2 ? -14 : a === 4 ? 10 : 14)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xxs}
                fontFamily="monospace"
                fill="rgba(255,255,255,0.4)"
              >
                {THEORY_LEVELS[a].lv}
                {"\u2194"}
                {THEORY_LEVELS[b].lv}
              </text>
            </g>
          );
        })}

      {/* Vertices */}
      {[2, 5, 4, 3, 1, 6].map((lv) => {
        const p = points[lv];
        const info = THEORY_LEVELS[lv];
        const active = hl === lv || complementLv === lv;
        const dim = anyHl && !active && !hlFaceSet.has(-1);
        const isComplement = complementLv === lv;

        return (
          <g
            key={`v-${lv}`}
            onMouseEnter={() => onEnter(lv)}
            onMouseLeave={onLeave}
            onClick={() => onTap(lv)}
            style={{ cursor: "pointer" }}
          >
            <circle cx={p.x} cy={p.y} r={DOT_R + 6} fill="transparent" />
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
  );
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

  const sharedProps = {
    hl,
    complementLv,
    hlEdgeSet,
    hlFaceSet,
    hlFace,
    setHlFace,
    showAxes,
    anyHl,
    onEnter,
    onLeave,
    onTap,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <DiamondView view={DIAMOND_FRONT} viewId="df" mirror={false} {...sharedProps} />
      </div>

      {/* Toggle buttons */}
      <div style={{ display: "flex", gap: SP.md, flexWrap: "wrap", justifyContent: "center" }}>
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

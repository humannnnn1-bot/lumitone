import React from "react";
import { THEORY_LEVELS, OCTA_POINTS, OCTA_EDGES, OCTA_FACES } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";

/* ── 3D lighting model (same as Octahedron.tsx) ── */

const TILT = 0.18;
const OCTA_3D: Record<number, [number, number, number]> = {
  2: [0, 1, 0], // Red = +R axis
  5: [0, -1, 0], // Cyan = -R axis
  4: [1, 0, TILT], // Green = +G axis
  3: [-1, 0, TILT], // Magenta = -G axis
  1: [0, 0, 1], // Blue = +B axis
  6: [0, 0, -1], // Yellow = -B axis
};

/* Back view: negate z to rotate 180° around the vertical axis */
const OCTA_3D_BACK: Record<number, [number, number, number]> = {
  2: [0, 1, 0],
  5: [0, -1, 0],
  4: [1, 0, -TILT],
  3: [-1, 0, -TILT],
  1: [0, 0, -1],
  6: [0, 0, 1],
};

/* Back view 2D: mirror x around center (CX=150) */
const OCTA_POINTS_BACK: Record<number, { x: number; y: number }> = {};
for (const k of [1, 2, 3, 4, 5, 6]) {
  OCTA_POINTS_BACK[k] = { x: 300 - OCTA_POINTS[k].x, y: OCTA_POINTS[k].y };
}

const LIGHT_DIR: [number, number, number] = (() => {
  const lx = -0.4,
    ly = 0.7,
    lz = 0.6;
  const len = Math.sqrt(lx * lx + ly * ly + lz * lz);
  return [lx / len, ly / len, lz / len];
})();

/* ── Per-view precomputation ── */

interface FaceLightingData {
  isFront: boolean;
  diffuse: number;
  centroidZ: number;
}

interface ViewData {
  faceLighting: FaceLightingData[];
  sortedFaces: { verts: [number, number, number]; color: number; origIdx: number }[];
  backEdges: Set<string>;
  points: Record<number, { x: number; y: number }>;
}

function computeFaceLighting(verts: readonly [number, number, number], octa3d: Record<number, [number, number, number]>): FaceLightingData {
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
  const dot = nnx * LIGHT_DIR[0] + nny * LIGHT_DIR[1] + nnz * LIGHT_DIR[2];
  const ambient = 0.15;
  const diffuse = ambient + (1 - ambient) * Math.max(0, dot);
  return { isFront, diffuse, centroidZ: cz };
}

function computeView(octa3d: Record<number, [number, number, number]>, points: Record<number, { x: number; y: number }>): ViewData {
  const faceLighting = OCTA_FACES.map((f) => computeFaceLighting(f.verts, octa3d));

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
  for (const [k, faces] of edgeFaces) {
    if (faces.length === 2 && !faceLighting[faces[0]].isFront && !faceLighting[faces[1]].isFront) {
      backEdges.add(k);
    }
  }

  return { faceLighting, sortedFaces, backEdges, points };
}

const VIEW_FRONT = computeView(OCTA_3D, OCTA_POINTS);
const VIEW_BACK = computeView(OCTA_3D_BACK, OCTA_POINTS_BACK);

/* ── Text fill: white for dark faces (0-3), black for light faces (4-7) ── */
function labelFill(colorIdx: number): string {
  return colorIdx <= 3 ? "#fff" : "#000";
}

/* ── Single octahedron view ── */

function OctaView({
  view,
  hl,
  hlComp,
  anyHl,
  onEnter,
  onLeave,
}: {
  view: ViewData;
  hl: number | null;
  hlComp: number | null;
  anyHl: boolean;
  onEnter: (lv: number) => void;
  onLeave: () => void;
}) {
  const { faceLighting, sortedFaces, backEdges, points } = view;

  function centroid2d(verts: readonly [number, number, number]): { x: number; y: number } {
    const p0 = points[verts[0]],
      p1 = points[verts[1]],
      p2 = points[verts[2]];
    return { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
  }

  function isBack(a: number, b: number): boolean {
    return backEdges.has(a < b ? `${a}-${b}` : `${b}-${a}`);
  }

  return (
    <svg viewBox="0 0 300 300" style={{ width: "100%", maxWidth: 200 }} role="img">
      {/* Faces — sorted back to front */}
      {sortedFaces.map((sf, fi) => {
        const lighting = faceLighting[sf.origIdx];
        const info = THEORY_LEVELS[sf.color];
        const pts = sf.verts.map((v) => `${points[v].x},${points[v].y}`).join(" ");
        const ctr = centroid2d(sf.verts);

        const isHl = hl === sf.color;
        const isComp = hlComp === sf.color;
        const active = isHl || isComp;
        const dim = anyHl && !active;

        const fillColor = sf.color === 0 ? C.bgRoot : info.color;

        let fillOpacity: number;
        let strokeOpacity: number;
        if (lighting.isFront) {
          fillOpacity = active ? 0.55 : dim ? 0.06 : 0.35 + lighting.diffuse * 0.35;
          strokeOpacity = active ? 0.9 : dim ? 0.08 : 0.15 + lighting.diffuse * 0.4;
        } else {
          fillOpacity = active ? 0.3 : dim ? 0.02 : 0.05 + lighting.diffuse * 0.05;
          strokeOpacity = active ? 0.5 : dim ? 0.04 : 0.08;
        }

        const strokeColor = isComp ? "#fff" : active ? "#fff" : info.color;
        const strokeW = active ? 1.8 : 0.5;
        const strokeDash = isComp ? "4 2" : "none";

        return (
          <g key={`face-${fi}`} onMouseEnter={() => onEnter(sf.color)} onMouseLeave={onLeave} style={{ cursor: "default" }}>
            <polygon points={pts} fill="transparent" />
            <polygon
              points={pts}
              fill={fillColor}
              fillOpacity={fillOpacity}
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeOpacity={strokeOpacity}
              strokeDasharray={strokeDash}
              strokeLinejoin="round"
            />
            <text
              x={ctr.x}
              y={ctr.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={FS.md}
              fontFamily="monospace"
              fontWeight={FW.bold}
              fill={labelFill(sf.color)}
              opacity={dim ? 0.15 : lighting.isFront ? 0.9 : 0.4}
            >
              {info.short}
            </text>
          </g>
        );
      })}

      {/* Edges */}
      {OCTA_EDGES.map(([a, b], ei) => {
        const back = isBack(a, b);
        const edgeActive =
          anyHl &&
          OCTA_FACES.some(
            (f) =>
              (f.color === hl || f.color === hlComp) &&
              f.verts.includes(a as 1 | 2 | 3 | 4 | 5 | 6) &&
              f.verts.includes(b as 1 | 2 | 3 | 4 | 5 | 6),
          );
        const dim = anyHl && !edgeActive;

        return (
          <line
            key={`e-${ei}`}
            x1={points[a].x}
            y1={points[a].y}
            x2={points[b].x}
            y2={points[b].y}
            stroke={edgeActive ? "#fff" : C.textDimmer}
            strokeWidth={edgeActive ? 1.5 : 0.8}
            strokeDasharray={back && !edgeActive ? "3,3" : undefined}
            opacity={dim ? 0.1 : edgeActive ? 0.8 : back ? 0.2 : 0.35}
          />
        );
      })}
    </svg>
  );
}

/* ── Exported component ── */

interface D8OctaProps {
  hl: number | null;
  onEnter: (lv: number) => void;
  onLeave: () => void;
}

export const D8Octahedron = React.memo(function D8Octahedron({ hl, onEnter, onLeave }: D8OctaProps) {
  const hlComp = hl !== null ? hl ^ 7 : null;
  const anyHl = hl !== null;

  return (
    <div style={{ display: "flex", gap: SP.md, justifyContent: "center" }}>
      <OctaView view={VIEW_FRONT} hl={hl} hlComp={hlComp} anyHl={anyHl} onEnter={onEnter} onLeave={onLeave} />
      <OctaView view={VIEW_BACK} hl={hl} hlComp={hlComp} anyHl={anyHl} onEnter={onEnter} onLeave={onLeave} />
    </div>
  );
});

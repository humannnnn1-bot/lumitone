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
  vertexRadius,
  vertexDepth,
} from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { usePinReset } from "./pin-reset";
import { useTranslation } from "../../i18n";

const VW = 320; // single-view width
const VR = 7;
const HIT_R = 14;

/* ── 3D lighting (same model as Octahedron.tsx) ── */

const LIGHT_DIR: [number, number, number] = (() => {
  const lx = -0.4,
    ly = 0.7,
    lz = 0.6;
  const len = Math.sqrt(lx * lx + ly * ly + lz * lz);
  return [lx / len, ly / len, lz / len];
})();

const CUBE_CENTER: [number, number, number] = [0.5, 0.5, 0.5];

function computeFaceLighting(coords3D: Record<number, [number, number, number]>) {
  return STELLA_FACES.map((f) => {
    const p0 = coords3D[f.verts[0]],
      p1 = coords3D[f.verts[1]],
      p2 = coords3D[f.verts[2]];
    const e1: [number, number, number] = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2: [number, number, number] = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const cx = (p0[0] + p1[0] + p2[0]) / 3 - CUBE_CENTER[0];
    const cy = (p0[1] + p1[1] + p2[1]) / 3 - CUBE_CENTER[1];
    const cz = (p0[2] + p1[2] + p2[2]) / 3 - CUBE_CENTER[2];
    const outSign = nx * cx + ny * cy + nz * cz > 0 ? 1 : -1;
    const nnx = (outSign * nx) / nLen;
    const nny = (outSign * ny) / nLen;
    const nnz = (outSign * nz) / nLen;
    const isFront = nnx + nny + nnz > 0; // viewing along (1,1,1) body diagonal
    const dot = nnx * LIGHT_DIR[0] + nny * LIGHT_DIR[1] + nnz * LIGHT_DIR[2];
    const diffuse = 0.15 + 0.85 * Math.max(0, dot);
    return { isFront, diffuse };
  });
}

function computeBackEdges(lighting: { isFront: boolean }[]) {
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
  const result = new Set<string>();
  for (const [k, faces] of edgeFaces) {
    if (faces.length >= 2 && faces.every((fi) => !lighting[fi].isFront)) {
      result.add(k);
    }
  }
  return result;
}

/** Sort faces far-to-near by centroid depth along (1,1,1) (painter's algorithm) */
function computeSortedFaces() {
  return STELLA_FACES.map((f, i) => {
    const [a, b, c] = f.verts;
    const depth = vertexDepth(a) + vertexDepth(b) + vertexDepth(c); // sum of popcount = 3× centroid·(1,1,1)
    return { ...f, origIdx: i, depth };
  }).sort((a, b) => a.depth - b.depth);
}

// Front view data
const FACE_LIGHTING_F = computeFaceLighting(STELLA_3D);
const SORTED_FACES_F = computeSortedFaces();
const BACK_EDGES_F = computeBackEdges(FACE_LIGHTING_F);

// Back view data

/* ── Cross-body hidden-line computation ── */

/** Point-in-triangle test via barycentric coordinates */
function pointInTri(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-10) return false;
  const u = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
  const v = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
  return u >= -0.01 && v >= -0.01 && u + v <= 1.01;
}

/** Interpolate depth on a triangle face at a 2D point using barycentric coords */
function triDepthAt(
  px: number,
  py: number,
  verts: readonly [number, number, number],
  pts2D: Record<number, { x: number; y: number }>,
): number {
  const [a, b, c] = verts;
  const pa = pts2D[a],
    pb = pts2D[b],
    pc = pts2D[c];
  const d = (pb.y - pc.y) * (pa.x - pc.x) + (pc.x - pb.x) * (pa.y - pc.y);
  if (Math.abs(d) < 1e-10) return 0;
  const u = ((pb.y - pc.y) * (px - pc.x) + (pc.x - pb.x) * (py - pc.y)) / d;
  const v = ((pc.y - pa.y) * (px - pc.x) + (pa.x - pc.x) * (py - pc.y)) / d;
  const w = 1 - u - v;
  return u * vertexDepth(a) + v * vertexDepth(b) + w * vertexDepth(c);
}

interface EdgeSegment {
  t0: number;
  t1: number;
  hidden: boolean;
}

/** Compute visible/hidden segments for a stella edge, considering occlusion by the opposite tetrahedron */
function computeEdgeSegments(
  edgeIdx: number,
  pts2D: Record<number, { x: number; y: number }>,
  faceLighting: { isFront: boolean }[],
): EdgeSegment[] {
  const [a, b] = STELLA_EDGES[edgeIdx];
  const pa = pts2D[a],
    pb = pts2D[b];
  const da = vertexDepth(a),
    db = vertexDepth(b);

  // Get ALL front-facing faces, excluding faces that contain this edge
  const occluderFaces = STELLA_FACES.map((f, i) => ({ ...f, idx: i })).filter((f) => {
    if (!faceLighting[f.idx].isFront) return false;
    // Exclude faces adjacent to this edge (a face containing both endpoints)
    const vSet = new Set(f.verts);
    if (vSet.has(a) && vSet.has(b)) return false;
    return true;
  });

  if (occluderFaces.length === 0) {
    return [{ t0: 0, t1: 1, hidden: false }];
  }

  const N = 40; // sample points
  const samples: boolean[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const px = pa.x + t * (pb.x - pa.x);
    const py = pa.y + t * (pb.y - pa.y);
    const edgeDepth = da + t * (db - da);

    let hidden = false;
    for (const face of occluderFaces) {
      const [v0, v1, v2] = face.verts;
      const p0 = pts2D[v0],
        p1 = pts2D[v1],
        p2 = pts2D[v2];
      if (pointInTri(px, py, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y)) {
        const faceDepth = triDepthAt(px, py, face.verts, pts2D);
        if (faceDepth > edgeDepth + 0.05) {
          hidden = true;
          break;
        }
      }
    }
    samples.push(hidden);
  }

  // Merge consecutive samples into segments
  const segments: EdgeSegment[] = [];
  let segStart = 0;
  let segHidden = samples[0];
  for (let i = 1; i <= N; i++) {
    if (i === N || samples[i] !== segHidden) {
      segments.push({ t0: segStart / N, t1: i === N && samples[i - 1] === segHidden ? 1 : i / N, hidden: segHidden });
      if (i < N) {
        segStart = i;
        segHidden = samples[i];
      }
    }
  }
  return segments;
}

/** Precomputed edge segments for all 12 stella edges */
const EDGE_SEGMENTS_F: EdgeSegment[][] = STELLA_EDGES.map((_, ei) => computeEdgeSegments(ei, CUBE_POINTS, FACE_LIGHTING_F));

/* ── Cross-body face occlusion ── */

type Pt2 = { x: number; y: number };

/** Sutherland-Hodgman polygon clipping (convex clip polygon) */
function clipPolygon(subject: Pt2[], clip: Pt2[]): Pt2[] {
  let output = subject;
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const input = output;
    output = [];
    const a = clip[i],
      b = clip[(i + 1) % clip.length];
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length];
      const pInside = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
      const qInside = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x) >= 0;
      if (pInside && qInside) {
        output.push(q);
      } else if (pInside) {
        output.push(intersectEdge(p, q, a, b));
      } else if (qInside) {
        output.push(intersectEdge(p, q, a, b));
        output.push(q);
      }
    }
  }
  return output;
}

function intersectEdge(p: Pt2, q: Pt2, a: Pt2, b: Pt2): Pt2 {
  const dx1 = q.x - p.x,
    dy1 = q.y - p.y;
  const dx2 = b.x - a.x,
    dy2 = b.y - a.y;
  const d = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(d) < 1e-10) return p;
  const t = ((a.x - p.x) * dy2 - (a.y - p.y) * dx2) / d;
  return { x: p.x + t * dx1, y: p.y + t * dy1 };
}

interface FaceOcclusion {
  clipPoints: string;
  dimAmount: number;
}

/** Precompute face occlusion overlays */
function computeFaceOcclusions(pts2D: Record<number, { x: number; y: number }>, faceLighting: { isFront: boolean }[]): FaceOcclusion[][] {
  return STELLA_FACES.map((face, fi) => {
    const occlusions: FaceOcclusion[] = [];
    const fVerts = face.verts.map((v) => pts2D[v]);

    // Check all front-facing faces as potential occluders (skip same face)
    for (let oi = 0; oi < STELLA_FACES.length; oi++) {
      if (oi === fi) continue;
      if (!faceLighting[oi].isFront) continue;
      const oFace = STELLA_FACES[oi];

      // Skip if faces share any vertex (adjacent faces can't occlude each other)
      if (face.verts.some((v) => oFace.verts.includes(v as number))) continue;

      const oVerts = oFace.verts.map((v) => pts2D[v]);

      // Clip subject face against occluder face
      const clipped = clipPolygon(
        fVerts.map((p) => ({ x: p.x, y: p.y })),
        oVerts.map((p) => ({ x: p.x, y: p.y })),
      );
      if (clipped.length < 3) continue;

      // Compare depths at centroid of clipped region
      const cx = clipped.reduce((s, p) => s + p.x, 0) / clipped.length;
      const cy = clipped.reduce((s, p) => s + p.y, 0) / clipped.length;

      const faceDepth = triDepthAt(cx, cy, face.verts, pts2D);
      const occDepth = triDepthAt(cx, cy, oFace.verts, pts2D);

      if (occDepth > faceDepth + 0.05) {
        const pts = clipped.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        // Dim amount based on how much further in front the occluder is
        const dimAmount = Math.min(0.2, (occDepth - faceDepth) * 0.08);
        occlusions.push({ clipPoints: pts, dimAmount });
      }
    }
    return occlusions;
  });
}

const FACE_OCCLUSIONS_F = computeFaceOcclusions(CUBE_POINTS, FACE_LIGHTING_F);

/* ── Stella octangula 24-face surface ── */

interface SurfaceFace {
  verts2D: [Pt2, Pt2, Pt2];
  ridgeBase: [Pt2, Pt2]; // the two midpoints forming the ridge edge (spike base)
  ridgeDepths: [number, number]; // depths of the two midpoints
  depth: number; // centroid depth for painter's algorithm
  isFront: boolean;
  diffuse: number;
  tipVertex: number; // the original cube vertex at the spike tip
  tetra: 0 | 1;
  color: number; // parent face color
}

function computeSurfaceFaces(pts2D: Record<number, Pt2>): SurfaceFace[] {
  const mid2D = (a: number, b: number): Pt2 => ({
    x: (pts2D[a].x + pts2D[b].x) / 2,
    y: (pts2D[a].y + pts2D[b].y) / 2,
  });
  const midDepth = (a: number, b: number) => (vertexDepth(a) + vertexDepth(b)) / 2;
  const mid3D = (a: number, b: number): [number, number, number] => [
    (STELLA_3D[a][0] + STELLA_3D[b][0]) / 2,
    (STELLA_3D[a][1] + STELLA_3D[b][1]) / 2,
    (STELLA_3D[a][2] + STELLA_3D[b][2]) / 2,
  ];

  const faces: SurfaceFace[] = [];

  for (const sf of STELLA_FACES) {
    const [v0, v1, v2] = sf.verts;
    // 3 edge midpoints of this face
    const m01 = { p2D: mid2D(v0, v1), p3D: mid3D(v0, v1), d: midDepth(v0, v1) };
    const m02 = { p2D: mid2D(v0, v2), p3D: mid3D(v0, v2), d: midDepth(v0, v2) };
    const m12 = { p2D: mid2D(v1, v2), p3D: mid3D(v1, v2), d: midDepth(v1, v2) };

    // 3 spike triangles: each tip vertex + two adjacent midpoints
    const spikes: { tip: number; mA: typeof m01; mB: typeof m01 }[] = [
      { tip: v0, mA: m01, mB: m02 },
      { tip: v1, mA: m01, mB: m12 },
      { tip: v2, mA: m02, mB: m12 },
    ];

    for (const spike of spikes) {
      const tipP = pts2D[spike.tip];
      const verts2D: [Pt2, Pt2, Pt2] = [tipP, spike.mA.p2D, spike.mB.p2D];
      const tipD = vertexDepth(spike.tip);
      const depth = (tipD + spike.mA.d + spike.mB.d) / 3;

      // Normal computation (same plane as parent face, reuse parent normal direction)
      const p0 = STELLA_3D[v0],
        p1 = STELLA_3D[v1],
        p2 = STELLA_3D[v2];
      const e1: [number, number, number] = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const e2: [number, number, number] = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1];
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      const nz = e1[0] * e2[1] - e1[1] * e2[0];
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const cx = (p0[0] + p1[0] + p2[0]) / 3 - 0.5;
      const cy = (p0[1] + p1[1] + p2[1]) / 3 - 0.5;
      const cz = (p0[2] + p1[2] + p2[2]) / 3 - 0.5;
      const outSign = nx * cx + ny * cy + nz * cz > 0 ? 1 : -1;
      const nnx = (outSign * nx) / nLen,
        nny = (outSign * ny) / nLen,
        nnz = (outSign * nz) / nLen;
      const isFront = nnx + nny + nnz > 0;
      const dot = nnx * LIGHT_DIR[0] + nny * LIGHT_DIR[1] + nnz * LIGHT_DIR[2];
      const diffuse = 0.15 + 0.85 * Math.max(0, dot);

      faces.push({
        verts2D,
        ridgeBase: [spike.mA.p2D, spike.mB.p2D],
        ridgeDepths: [spike.mA.d, spike.mB.d],
        depth,
        isFront,
        diffuse,
        tipVertex: spike.tip,
        tetra: sf.tetra as 0 | 1,
        color: sf.color,
      });
    }
  }

  // Sort far-to-near (painter's algorithm)
  faces.sort((a, b) => a.depth - b.depth);
  return faces;
}

const SURFACE_FACES_F = computeSurfaceFaces(CUBE_POINTS);

/* Surface mode colors: warm for T0, cool for T1 */

/** Compute silhouette edges: edges where exactly one adjacent face is front-facing */
interface SilhouetteEdge {
  from: Pt2;
  to: Pt2;
}
function computeSilhouetteEdges(faces: SurfaceFace[]): SilhouetteEdge[] {
  const edgeKey = (a: Pt2, b: Pt2) => {
    const ax = a.x.toFixed(1),
      ay = a.y.toFixed(1),
      bx = b.x.toFixed(1),
      by = b.y.toFixed(1);
    return ax < bx || (ax === bx && ay < by) ? `${ax},${ay}-${bx},${by}` : `${bx},${by}-${ax},${ay}`;
  };
  // Build adjacency: edge key → list of face isFront values
  const adj = new Map<string, { front: number; from: Pt2; to: Pt2 }>();
  for (const f of faces) {
    const verts = f.verts2D;
    for (let i = 0; i < 3; i++) {
      const a = verts[i],
        b = verts[(i + 1) % 3];
      const k = edgeKey(a, b);
      if (!adj.has(k)) adj.set(k, { front: 0, from: a, to: b });
      if (f.isFront) adj.get(k)!.front++;
    }
  }
  const result: SilhouetteEdge[] = [];
  for (const [, v] of adj) {
    // Silhouette: exactly one adjacent front face, or boundary edge (only 1 adjacent face total and it's front)
    if (v.front === 1) result.push({ from: v.from, to: v.to });
  }
  return result;
}

const SILHOUETTE_F = computeSilhouetteEdges(SURFACE_FACES_F);

const CH_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

/* ── K₈ edge color coding ── */
const K8_Q3_COLOR = "#60aaff";
const K8_STELLA_COLOR = "#ffaa60";
const K8_M4_COLOR = "#ff6080";

interface ViewData {
  pts: Record<number, { x: number; y: number }>;
  faceLighting: { isFront: boolean; diffuse: number }[];
  sortedFaces: ((typeof STELLA_FACES)[number] & { origIdx: number })[];
  backEdges: Set<string>;
  edgeSegments: EdgeSegment[][];
  faceOcclusions: FaceOcclusion[][];
  surfaceFaces: SurfaceFace[];
  silhouetteEdges: SilhouetteEdge[];
}

const VIEW_FRONT: ViewData = {
  pts: CUBE_POINTS,
  faceLighting: FACE_LIGHTING_F,
  sortedFaces: SORTED_FACES_F,
  backEdges: BACK_EDGES_F,
  edgeSegments: EDGE_SEGMENTS_F,
  faceOcclusions: FACE_OCCLUSIONS_F,
  surfaceFaces: SURFACE_FACES_F,
  silhouetteEdges: SILHOUETTE_F,
};

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const StellaOctangula = React.memo(function StellaOctangula({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  usePinReset(setPinned);
  const [viewMode, setViewMode] = useState<"compound" | "k8">("compound");
  const [showSurface, setShowSurface] = useState(false);
  const [hlFace, setHlFace] = useState<number | null>(null);

  const hl = hlLevel !== null && hlLevel >= 0 && hlLevel <= 7 ? hlLevel : pinned;

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

  /* ── Render helpers parameterized by view data ── */

  const renderVertices = (v: ViewData, viewId: string) =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((lv) => {
      const p = v.pts[lv];
      const info = THEORY_LEVELS[lv];
      const active = hl === lv || complementLv === lv;
      const dim = anyHl && !active;
      const isComplement = complementLv === lv;
      const t0 = TETRA_T0 as readonly number[];
      const t1 = TETRA_T1 as readonly number[];
      const sameTetra = hl !== null && ((t0.includes(hl) && t0.includes(lv)) || (t1.includes(hl) && t1.includes(lv)));
      const neighbour = sameTetra && lv !== hl;

      const r = vertexRadius(lv, VR);
      const hitR = vertexRadius(lv, HIT_R);
      const vDepth = vertexDepth(lv) / 3; // 0..1
      const vOpacity = 0.25 + vDepth * 0.6; // [0.25, 0.85]

      return (
        <g
          key={`${viewId}-v-${lv}`}
          onMouseEnter={() => onEnter(lv)}
          onMouseLeave={onLeave}
          onClick={() => onTap(lv)}
          style={{ cursor: "pointer" }}
        >
          <circle cx={p.x} cy={p.y} r={hitR} fill="transparent" />
          {neighbour && <circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke="#fff" strokeWidth={0.8} strokeOpacity={0.3} />}
          <circle
            cx={p.x}
            cy={p.y}
            r={r}
            fill={lv === 0 ? C.bgRoot : info.color}
            fillOpacity={active ? 0.85 : dim ? 0.15 : vOpacity}
            stroke={isComplement ? "#fff" : active ? "#fff" : lv === 0 ? "#666" : info.color}
            strokeWidth={active ? 2 : 1}
            strokeOpacity={dim ? 0.2 : 0.3 + vDepth * 0.5}
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
            opacity={dim ? 0.2 : 0.4 + vDepth * 0.5}
          >
            {lv}
          </text>
        </g>
      );
    });

  const renderCompound = (v: ViewData, viewId: string) => (
    <>
      {/* Depth-gradient defs for faces */}
      <defs>
        {v.sortedFaces.map((sf) => {
          const depths = sf.verts.map((vi) => ({ v: vi, d: vertexDepth(vi), p: v.pts[vi] }));
          const minD = depths.reduce((a, b) => (a.d < b.d ? a : b));
          const maxD = depths.reduce((a, b) => (a.d > b.d ? a : b));
          if (minD.d === maxD.d) return null;
          const info = THEORY_LEVELS[sf.color];
          const color = sf.color === 0 ? "#333" : info.color;
          const tetraScale = sf.tetra === 1 ? 0.5 : 1;
          const opMin = (0.03 + (minD.d / 3) * 0.22) * tetraScale;
          const opMax = (0.03 + (maxD.d / 3) * 0.22) * tetraScale;
          return (
            <linearGradient
              key={`${viewId}-fg-${sf.origIdx}`}
              id={`${viewId}-fg-${sf.origIdx}`}
              gradientUnits="userSpaceOnUse"
              x1={minD.p.x}
              y1={minD.p.y}
              x2={maxD.p.x}
              y2={maxD.p.y}
            >
              <stop offset="0%" stopColor={color} stopOpacity={opMin} />
              <stop offset="100%" stopColor={color} stopOpacity={opMax} />
            </linearGradient>
          );
        })}
      </defs>
      {v.sortedFaces.map((sf) => {
        const lighting = v.faceLighting[sf.origIdx];
        const faceActive = hlFace === sf.color || hlFaceSet.has(sf.origIdx);
        const faceDim = anyHl && !faceActive;
        const info = THEORY_LEVELS[sf.color];
        const pts = sf.verts.map((vi) => `${v.pts[vi].x},${v.pts[vi].y}`).join(" ");
        const p0 = v.pts[sf.verts[0]],
          p1 = v.pts[sf.verts[1]],
          p2 = v.pts[sf.verts[2]];
        const ctr = { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
        const depths = sf.verts.map((vi) => vertexDepth(vi));
        const hasDepthDiff = Math.max(...depths) !== Math.min(...depths);
        const tetraScale = sf.tetra === 1 ? 0.5 : 1;
        const baseOpacity = (0.04 + lighting.diffuse * 0.16) * tetraScale;
        const baseStrokeOpacity = (0.1 + lighting.diffuse * 0.3) * tetraScale;
        return (
          <g
            key={`${viewId}-f-${sf.origIdx}`}
            onMouseEnter={() => setHlFace(sf.color)}
            onMouseLeave={() => setHlFace(null)}
            style={{ cursor: "default" }}
          >
            <polygon points={pts} fill="transparent" />
            <polygon
              points={pts}
              fill={faceActive || faceDim || !hasDepthDiff ? (sf.color === 0 ? "#333" : info.color) : `url(#${viewId}-fg-${sf.origIdx})`}
              fillOpacity={faceActive ? 0.4 : faceDim ? 0.03 : hasDepthDiff ? 1 : baseOpacity}
              stroke={sf.color === 0 ? "#666" : info.color}
              strokeWidth={faceActive ? 1.5 : 0.5}
              strokeOpacity={faceActive ? 0.8 : faceDim ? 0.06 : baseStrokeOpacity}
              strokeLinejoin="round"
            />
            {/* Cross-body occlusion overlays */}
            {!faceActive &&
              !faceDim &&
              v.faceOcclusions[sf.origIdx].map((occ, oi) => (
                <polygon key={`occ-${oi}`} points={occ.clipPoints} fill="#000" fillOpacity={occ.dimAmount} stroke="none" />
              ))}
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
                {sf.tetra === 0 ? "T0" : "T1"}: {info.lv}
              </text>
            )}
          </g>
        );
      })}

      {/* Stella edges — segment-based with cross-body occlusion */}
      {STELLA_EDGES.map(([a, b], ei) => {
        const active = hlStellaEdgeSet.has(ei);
        const dim = anyHl && !active;
        const da = vertexDepth(a) / 3;
        const db = vertexDepth(b) / 3;
        const pa = v.pts[a],
          pb = v.pts[b];
        const edgeDx = pb.x - pa.x,
          edgeDy = pb.y - pa.y;
        const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
        const nx = -edgeDy / edgeLen,
          ny = edgeDx / edgeLen;
        const mx = (pa.x + pb.x) / 2,
          my = (pa.y + pb.y) / 2;
        const segments = v.edgeSegments[ei];

        return (
          <g key={`${viewId}-e-${ei}`}>
            {segments.map((seg, si) => {
              const sx = pa.x + seg.t0 * edgeDx;
              const sy = pa.y + seg.t0 * edgeDy;
              const ex = pa.x + seg.t1 * edgeDx;
              const ey = pa.y + seg.t1 * edgeDy;
              const segDa = da + seg.t0 * (db - da);
              const segDb = da + seg.t1 * (db - da);
              const segAvgDepth = (segDa + segDb) / 2;

              if (active) {
                return (
                  <line
                    key={si}
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke="#fff"
                    strokeWidth={1.8}
                    strokeDasharray={seg.hidden ? "2,3" : undefined}
                    opacity={seg.hidden ? 0.3 : 0.85}
                  />
                );
              }

              if (seg.hidden) {
                return (
                  <line
                    key={si}
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke={C.textDimmer}
                    strokeWidth={0.4 + segAvgDepth * 0.6}
                    strokeDasharray="4,4"
                    opacity={dim ? 0.05 : 0.12}
                  />
                );
              }

              // Visible segment with taper
              const hwS = 0.2 + segDa * 0.7;
              const hwE = 0.2 + segDb * 0.7;
              const opS = 0.05 + segDa * 0.4;
              const opE = 0.05 + segDb * 0.4;
              const opAvg = (opS + opE) / 2;

              if (Math.abs(segDa - segDb) > 0.01) {
                return (
                  <polygon
                    key={si}
                    points={`${sx + nx * hwS},${sy + ny * hwS} ${ex + nx * hwE},${ey + ny * hwE} ${ex - nx * hwE},${ey - ny * hwE} ${sx - nx * hwS},${sy - ny * hwS}`}
                    fill={C.textDimmer}
                    fillOpacity={dim ? 0.05 : opAvg}
                  />
                );
              }
              return (
                <line
                  key={si}
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={C.textDimmer}
                  strokeWidth={0.4 + segAvgDepth * 1.4}
                  opacity={dim ? 0.05 : opAvg}
                />
              );
            })}
            {active &&
              hl !== null &&
              (() => {
                const chs = stellaEdgeChannels(a, b);
                const ox = nx * 10,
                  oy = ny * 10;
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

      {/* Surface overlay (24 spike faces) */}
      {showSurface &&
        v.surfaceFaces.map((sf, si) => {
          if (!sf.isFront) return null;
          const info = THEORY_LEVELS[sf.color];
          const pts = sf.verts2D.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          const depthNorm = sf.depth / 3;
          const tetraScale = sf.tetra === 1 ? 0.5 : 1;
          const fillOp = (0.08 + depthNorm * 0.22) * tetraScale;
          const strokeOp = (0.15 + depthNorm * 0.35) * tetraScale;
          const tipActive = hl === sf.tipVertex;
          const dim = anyHl && !tipActive;
          return (
            <polygon
              key={`${viewId}-sf-${si}`}
              points={pts}
              fill={sf.color === 0 ? "#333" : info.color}
              fillOpacity={dim ? 0.02 : tipActive ? 0.35 : fillOp}
              stroke={sf.color === 0 ? "#666" : info.color}
              strokeWidth={tipActive ? 1.2 : 0.6}
              strokeOpacity={dim ? 0.05 : tipActive ? 0.7 : strokeOp}
              strokeLinejoin="round"
            />
          );
        })}

      {renderVertices(v, viewId)}
    </>
  );

  const renderK8 = (v: ViewData, viewId: string) => (
    <>
      {CUBE_EDGES.map(([a, b], i) => {
        const active = hlQ3.has(i);
        const dim = hl !== null && !active;
        return (
          <line
            key={`${viewId}-q3-${i}`}
            x1={v.pts[a].x}
            y1={v.pts[a].y}
            x2={v.pts[b].x}
            y2={v.pts[b].y}
            stroke={K8_Q3_COLOR}
            strokeWidth={active ? 2 : 1}
            opacity={dim ? 0.1 : active ? 0.9 : 0.4}
          />
        );
      })}
      {STELLA_EDGES.map(([a, b], i) => {
        const active = hlStella.has(i);
        const dim = hl !== null && !active;
        return (
          <line
            key={`${viewId}-st-${i}`}
            x1={v.pts[a].x}
            y1={v.pts[a].y}
            x2={v.pts[b].x}
            y2={v.pts[b].y}
            stroke={K8_STELLA_COLOR}
            strokeWidth={active ? 2.2 : 1.2}
            strokeDasharray="5,3"
            opacity={dim ? 0.1 : active ? 0.9 : 0.35}
          />
        );
      })}
      {COMPLEMENT_EDGES.map(([a, b], i) => {
        const active = hlM4.has(i);
        const dim = hl !== null && !active;
        return (
          <line
            key={`${viewId}-m4-${i}`}
            x1={v.pts[a].x}
            y1={v.pts[a].y}
            x2={v.pts[b].x}
            y2={v.pts[b].y}
            stroke={K8_M4_COLOR}
            strokeWidth={active ? 2.5 : 1.5}
            strokeDasharray="2,4"
            opacity={dim ? 0.1 : active ? 0.9 : 0.3}
          />
        );
      })}
      {renderVertices(v, viewId)}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox="40 45 220 180" style={{ width: "100%", maxWidth: VW }} role="img">
          {viewMode === "compound" ? renderCompound(VIEW_FRONT, "f") : renderK8(VIEW_FRONT, "f")}
        </svg>
      </div>

      {/* Annotation below SVG — fixed height to prevent layout shift on mode toggle */}
      <div style={{ minHeight: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {viewMode === "compound" ? (
          <p style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}>
            {t("theory_stella_annotation")}
          </p>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: FS.xxs, fontFamily: "monospace", margin: 0 }}>
              <span style={{ color: K8_Q3_COLOR }}>Q&#x2083;(12)</span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}> + </span>
              <span style={{ color: K8_STELLA_COLOR }}>&#x2606;(12)</span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}> + </span>
              <span style={{ color: K8_M4_COLOR }}>M&#x2084;(4)</span>
              <span style={{ color: "rgba(255,255,255,0.5)" }}> = 28</span>
            </p>
            <p style={{ fontSize: FS.xxs, fontFamily: "monospace", color: C.textDimmer, margin: 0 }}>{t("theory_stella_k8_degree")}</p>
          </div>
        )}
      </div>

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
            borderColor: showSurface && viewMode === "compound" ? C.accentBright : C.border,
            color: showSurface && viewMode === "compound" ? C.accentBright : C.textMuted,
            opacity: viewMode === "compound" ? 1 : 0.4,
          }}
          onClick={() => {
            if (viewMode !== "compound") setViewMode("compound");
            setShowSurface((v) => !v);
          }}
        >
          {t("theory_stella_surface")}
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

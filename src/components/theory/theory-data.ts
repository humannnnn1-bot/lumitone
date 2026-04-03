/* ═══════════════════════════════════════════
   THEORY TAB — SHARED DATA & GEOMETRY
   ═══════════════════════════════════════════ */

export interface TheoryLevel {
  lv: number;
  name: string;
  short: string; // single-letter abbreviation (K for Black to avoid clash with Blue's B)
  bits: [number, number, number]; // [G, R, B]
  color: string;
  hamming: string; // P1/P2/P4 for parity, D1-D4 for data, "—" for 0/7
}

export const THEORY_LEVELS: TheoryLevel[] = [
  { lv: 0, name: "Black", short: "K", bits: [0, 0, 0], color: "#000000", hamming: "—" },
  { lv: 1, name: "Blue", short: "B", bits: [0, 0, 1], color: "#0000ff", hamming: "P1" },
  { lv: 2, name: "Red", short: "R", bits: [0, 1, 0], color: "#ff0000", hamming: "P2" },
  { lv: 3, name: "Magenta", short: "M", bits: [0, 1, 1], color: "#ff00ff", hamming: "D1" },
  { lv: 4, name: "Green", short: "G", bits: [1, 0, 0], color: "#00ff00", hamming: "P4" },
  { lv: 5, name: "Cyan", short: "C", bits: [1, 0, 1], color: "#00ffff", hamming: "D2" },
  { lv: 6, name: "Yellow", short: "Y", bits: [1, 1, 0], color: "#ffff00", hamming: "D3" },
  { lv: 7, name: "White", short: "W", bits: [1, 1, 1], color: "#ffffff", hamming: "D4" },
];

/** 7 Fano plane lines — each [a, b, c] satisfies a XOR b = c */
export const FANO_LINES: [number, number, number][] = [
  [1, 2, 3], // B + R = M  (primary mixing)
  [1, 4, 5], // B + G = C
  [2, 4, 6], // R + G = Y
  [1, 6, 7], // B + Y = W  (complementary)
  [2, 5, 7], // R + C = W
  [3, 4, 7], // M + G = W
  [3, 5, 6], // M + C = Y  (CMY circle)
];

/** Line category for display */
export const FANO_LINE_CATEGORIES: ("primary" | "complement" | "secondary")[] = [
  "primary",
  "primary",
  "primary",
  "complement",
  "complement",
  "complement",
  "secondary",
];

/** Gray code hexagon path (level indices) — each step toggles 1 channel */
export const GRAY_PATH = [2, 6, 4, 5, 1, 3] as const;
export const GRAY_TOGGLES = ["G", "R", "B", "G", "R", "B"] as const;

/** 12 edges of the 3-cube (pairs of vertices differing by 1 bit) */
export const CUBE_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [1, 5],
  [2, 3],
  [2, 6],
  [3, 7],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7],
];

/** Channel name for a cube edge (which bit differs) */
export function edgeChannel(a: number, b: number): "G" | "R" | "B" {
  const d = a ^ b;
  if (d === 4) return "G";
  if (d === 2) return "R";
  return "B";
}

/* ── Fano Plane geometry ─────────────────── */

const FANO_CX = 150,
  FANO_CY = 160,
  FANO_OUTER_R = 120;

// Outer triangle vertices
const P2 = { x: FANO_CX, y: FANO_CY - FANO_OUTER_R }; // top
const P1 = { x: FANO_CX - FANO_OUTER_R * Math.sin(Math.PI / 3), y: FANO_CY + FANO_OUTER_R * 0.5 }; // bottom-left
const P4 = { x: FANO_CX + FANO_OUTER_R * Math.sin(Math.PI / 3), y: FANO_CY + FANO_OUTER_R * 0.5 }; // bottom-right

// Inner triangle vertices = midpoints of outer triangle sides
const P3 = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 }; // midpoint of 1→2 (left edge)
const P6 = { x: (P2.x + P4.x) / 2, y: (P2.y + P4.y) / 2 }; // midpoint of 2→4 (right edge)
const P5 = { x: (P1.x + P4.x) / 2, y: (P1.y + P4.y) / 2 }; // midpoint of 1→4 (bottom edge)

/** Fano point positions: outer triangle (2,1,4) + inner triangle (3,6,5) + center (7) */
export const FANO_POINTS: Record<number, { x: number; y: number }> = {
  2: P2,
  1: P1,
  4: P4, // outer triangle
  3: P3,
  6: P6,
  5: P5, // inner triangle (midpoints)
  7: { x: FANO_CX, y: FANO_CY }, // center
};

/** Inscribed circle: circumcircle of inner triangle 3,5,6 (radius = half outer) */
const FANO_INNER_R = Math.sqrt((P3.x - FANO_CX) ** 2 + (P3.y - FANO_CY) ** 2);
export const FANO_CIRCLE = { cx: FANO_CX, cy: FANO_CY, r: FANO_INNER_R };

/** Line endpoints for rendering: [from, to] for each of the 7 Fano lines */
export const FANO_LINE_ENDPOINTS: [number, number][] = [
  [1, 2], // {1,2,3}: left side of outer triangle (3 is midpoint)
  [1, 4], // {1,4,5}: bottom side of outer triangle (5 is midpoint)
  [2, 4], // {2,4,6}: right side of outer triangle (6 is midpoint)
  [1, 6], // {1,6,7}: diagonal through center
  [2, 5], // {2,5,7}: vertical through center
  [3, 4], // {3,4,7}: diagonal through center
  // line 6 = inscribed circle (no endpoints)
];

/* ── Color Cube isometric geometry ───────── */

const ISO_CX = 150,
  ISO_CY = 140;
const ISO_SCALE = 70;
// Isometric axes: R=up, G=down-right, B=down-left
// R-up matches color wheel convention (Red=0°) and produces standard hue order clockwise
const ISO_R = { dx: 0, dy: -1.2 };
const ISO_G = { dx: Math.cos(Math.PI / 6), dy: Math.sin(Math.PI / 6) };
const ISO_B = { dx: -Math.cos(Math.PI / 6), dy: Math.sin(Math.PI / 6) };

export const CUBE_POINTS: Record<number, { x: number; y: number }> = {};
for (let i = 0; i < 8; i++) {
  const g = (i >> 2) & 1,
    r = (i >> 1) & 1,
    b = i & 1;
  CUBE_POINTS[i] = {
    x: ISO_CX + ISO_SCALE * (g * ISO_G.dx + r * ISO_R.dx + b * ISO_B.dx),
    y: ISO_CY + ISO_SCALE * (g * ISO_G.dy + r * ISO_R.dy + b * ISO_B.dy),
  };
}

/** Determine if an edge is a "back edge" (behind the cube) for dashed rendering */
export function isBackEdge(a: number, b: number): boolean {
  // Back edges: those connecting to vertex 0 (Black, hidden corner)
  return a === 0 || b === 0;
}

/** White-pole projection: vertex v maps to where (v^7) sits in the standard view */
export const CUBE_POINTS_WHITE: Record<number, { x: number; y: number }> = {};
for (let i = 0; i < 8; i++) {
  CUBE_POINTS_WHITE[i] = CUBE_POINTS[i ^ 7];
}

/** Back-edge test for White-pole view (edges connecting to vertex 7) */
export function isBackEdgeWhite(a: number, b: number): boolean {
  return a === 7 || b === 7;
}

/* ── Octahedron (dual of cube) geometry ──── */

const OCTA_CX = 150,
  OCTA_CY = 150;
const OCTA_SCALE = 100;

// Normalized isometric axes (equal length) for regular octahedron
// ISO_R has magnitude 1.2 (up axis), ISO_G and ISO_B have magnitude 1.0
const OCTA_R = { dx: ISO_R.dx / 1.2, dy: ISO_R.dy / 1.2 }; // normalize to 1.0
const OCTA_G = { dx: ISO_G.dx, dy: ISO_G.dy }; // already magnitude 1.0
const OCTA_B = { dx: ISO_B.dx, dy: ISO_B.dy }; // already magnitude 1.0

/**
 * 6 chromatic colors as cross-polytope vertices.
 * Axis assignment follows hue-wheel convention (Red = top, clockwise = R→Y→G→C→B→M):
 *   R(2)=up, C(5)=down  (vertical axis — OCTA_R)
 *   Y(6)=upper-right, B(1)=lower-left  (right diagonal — OCTA_B)
 *   G(4)=lower-right, M(3)=upper-left  (left diagonal — OCTA_G)
 * Complement pairs remain antipodal on each axis.
 * Uses normalized axes (equal length) so the octahedron is regular.
 */
export const OCTA_POINTS: Record<number, { x: number; y: number }> = {
  2: { x: OCTA_CX + OCTA_SCALE * OCTA_R.dx, y: OCTA_CY + OCTA_SCALE * OCTA_R.dy }, // Red = top
  5: { x: OCTA_CX - OCTA_SCALE * OCTA_R.dx, y: OCTA_CY - OCTA_SCALE * OCTA_R.dy }, // Cyan = bottom
  4: { x: OCTA_CX + OCTA_SCALE * OCTA_G.dx, y: OCTA_CY + OCTA_SCALE * OCTA_G.dy }, // Green = lower-right
  3: { x: OCTA_CX - OCTA_SCALE * OCTA_G.dx, y: OCTA_CY - OCTA_SCALE * OCTA_G.dy }, // Magenta = upper-left
  1: { x: OCTA_CX + OCTA_SCALE * OCTA_B.dx, y: OCTA_CY + OCTA_SCALE * OCTA_B.dy }, // Blue = lower-left
  6: { x: OCTA_CX - OCTA_SCALE * OCTA_B.dx, y: OCTA_CY - OCTA_SCALE * OCTA_B.dy }, // Yellow = upper-right
};

/** 3 complement axes: R↔C, G↔M, B↔Y */
export const OCTA_COMPLEMENT_AXES: [number, number][] = [
  [2, 5],
  [4, 3],
  [1, 6],
];

/** 12 octahedron edges = all non-complement chromatic pairs */
export const OCTA_EDGES: [number, number][] = [
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [2, 3],
  [2, 4],
  [2, 6],
  [3, 5],
  [3, 6],
  [4, 5],
  [4, 6],
  [5, 6],
];

/** 8 octahedron faces — each octant maps to one GF(2)^3 color.
 *  Sign convention: vertex lv is on the + side of its axis if it's a primary (weight 1),
 *  and on the − side if it's a secondary (weight 2).
 *  For each axis i, the octant sign determines bit i of the face color. */
export const OCTA_FACES: { verts: [number, number, number]; color: number }[] = [
  { verts: [2, 4, 1], color: 7 }, // (+R,+G,+B) = White
  { verts: [2, 4, 6], color: 6 }, // (+R,+G,−B) = Yellow
  { verts: [2, 3, 1], color: 3 }, // (+R,−G,+B) = Magenta
  { verts: [2, 3, 6], color: 2 }, // (+R,−G,−B) = Red
  { verts: [5, 4, 1], color: 5 }, // (−R,+G,+B) = Cyan
  { verts: [5, 4, 6], color: 4 }, // (−R,+G,−B) = Green
  { verts: [5, 3, 1], color: 1 }, // (−R,−G,+B) = Blue
  { verts: [5, 3, 6], color: 0 }, // (−R,−G,−B) = Black
];

/* ── Inscribed Tetrahedra (T0 / T1) ──────── */

/** T0 = even-weight vectors = Klein four-group V₄ under XOR */
export const TETRA_T0 = [0, 3, 5, 6] as const;
/** T1 = odd-weight vectors = coset of V₄ */
export const TETRA_T1 = [1, 2, 4, 7] as const;

/** Edges of the T0 tetrahedron inscribed in the cube */
export const TETRA_T0_EDGES: [number, number][] = [
  [0, 3],
  [0, 5],
  [0, 6],
  [3, 5],
  [3, 6],
  [5, 6],
];
/** Edges of the T1 tetrahedron inscribed in the cube */
export const TETRA_T1_EDGES: [number, number][] = [
  [1, 2],
  [1, 4],
  [1, 7],
  [2, 4],
  [2, 7],
  [4, 7],
];

/* ── K₈ Three-Factor Decomposition ─────────
   K₈ = Q₃ (dist 1, 12 edges) ∪ Stella (dist 2, 12 edges) ∪ M₄ (dist 3, 4 edges)
   Degrees: 3 + 3 + 1 = 7 = deg(K₈)  */

/** Hamming distance between two GF(2)³ elements */
export function hammingDist(a: number, b: number): number {
  const d = a ^ b;
  return (d & 1) + ((d >> 1) & 1) + ((d >> 2) & 1);
}

/** Distance-2 edges (stella octangula): T0 internal + T1 internal */
export const STELLA_EDGES: [number, number][] = [...TETRA_T0_EDGES, ...TETRA_T1_EDGES];

/** Distance-3 edges (complement matching): 4 body diagonals */
export const COMPLEMENT_EDGES: [number, number][] = [
  [0, 7],
  [1, 6],
  [2, 5],
  [3, 4],
];

/* ── Stella Octangula face & 3D geometry ──
   Compound of T0 and T1 tetrahedra = first stellation of octahedron.
   8 vertices (all cube), 12 edges (STELLA_EDGES), 8 triangular faces.  */

export interface StellaFace {
  verts: [number, number, number];
  color: number; // XOR of 3 vertices = opposite vertex
  tetra: 0 | 1;
}

export const STELLA_FACES: StellaFace[] = [
  // T0 faces (even-weight tetrahedron)
  { verts: [0, 3, 5], color: 6, tetra: 0 },
  { verts: [0, 3, 6], color: 5, tetra: 0 },
  { verts: [0, 5, 6], color: 3, tetra: 0 },
  { verts: [3, 5, 6], color: 0, tetra: 0 },
  // T1 faces (odd-weight tetrahedron)
  { verts: [1, 2, 4], color: 7, tetra: 1 },
  { verts: [1, 2, 7], color: 4, tetra: 1 },
  { verts: [1, 4, 7], color: 2, tetra: 1 },
  { verts: [2, 4, 7], color: 1, tetra: 1 },
];

/** 3D coordinates of cube vertices in unit cube [G, R, B] */
export const STELLA_3D: Record<number, [number, number, number]> = {};
for (let i = 0; i < 8; i++) {
  STELLA_3D[i] = [(i >> 2) & 1, (i >> 1) & 1, i & 1];
}

const CH_NAMES = ["B", "R", "G"] as const;

/** Return the two channel names that flip for a Hamming-distance-2 edge */
export function stellaEdgeChannels(a: number, b: number): [string, string] {
  const d = a ^ b;
  const chs: string[] = [];
  for (let bit = 0; bit < 3; bit++) {
    if ((d >> bit) & 1) chs.push(CH_NAMES[bit]);
  }
  return chs as [string, string];
}

/* ── Cuboctahedron (rectified cube) geometry ──
   12 vertices = midpoints of 12 cube edges
   14 faces = 8 triangles (one per cube vertex) + 6 squares (one per cube face)  */

export interface CuboctaVertex {
  x: number;
  y: number;
  lv0: number; // first cube vertex of the edge
  lv1: number; // second cube vertex of the edge
  midColor: string; // averaged RGB color
}

function midColor(a: number, b: number): string {
  const ra = (a >> 1) & 1,
    ga = (a >> 2) & 1,
    ba2 = a & 1;
  const rb = (b >> 1) & 1,
    gb = (b >> 2) & 1,
    bb = b & 1;
  const r = Math.round(((ra + rb) / 2) * 255);
  const g = Math.round(((ga + gb) / 2) * 255);
  const bl = Math.round(((ba2 + bb) / 2) * 255);
  return `rgb(${r},${g},${bl})`;
}

export const CUBOCTA_VERTICES: CuboctaVertex[] = CUBE_EDGES.map(([a, b]) => {
  const pa = CUBE_POINTS[a],
    pb = CUBE_POINTS[b];
  return {
    x: (pa.x + pb.x) / 2,
    y: (pa.y + pb.y) / 2,
    lv0: a,
    lv1: b,
    midColor: midColor(a, b),
  };
});

/** 8 triangular faces: one per cube vertex. Each lists 3 cuboctahedron vertex indices. */
export const CUBOCTA_TRI_FACES: { color: number; verts: number[] }[] = [];
for (let v = 0; v < 8; v++) {
  const adj: number[] = [];
  CUBE_EDGES.forEach(([a, b], ei) => {
    if (a === v || b === v) adj.push(ei);
  });
  CUBOCTA_TRI_FACES.push({ color: v, verts: adj });
}

/** 6 square faces: one per cube face (pair of parallel edges sharing a coordinate plane).
 *  Cube faces are defined by fixing one coordinate (bit). */
export const CUBOCTA_SQ_FACES: { axis: "G" | "R" | "B"; value: 0 | 1; verts: number[] }[] = [];
for (const axis of ["G", "R", "B"] as const) {
  for (const val of [0, 1] as const) {
    const bit = axis === "G" ? 2 : axis === "R" ? 1 : 0;
    const mask = 1 << bit;
    const faceEdges: number[] = [];
    CUBE_EDGES.forEach(([a, b], ei) => {
      const ch = edgeChannel(a, b);
      if (ch !== axis && (a & mask) >> bit === val && (b & mask) >> bit === val) {
        faceEdges.push(ei);
      }
    });
    CUBOCTA_SQ_FACES.push({ axis, value: val, verts: faceEdges });
  }
}

/** White-pole cuboctahedron vertices: same topology, positions from CUBE_POINTS_WHITE */
export const CUBOCTA_VERTICES_WHITE: CuboctaVertex[] = CUBE_EDGES.map(([a, b]) => {
  const pa = CUBE_POINTS_WHITE[a],
    pb = CUBE_POINTS_WHITE[b];
  return {
    x: (pa.x + pb.x) / 2,
    y: (pa.y + pb.y) / 2,
    lv0: a,
    lv1: b,
    midColor: midColor(a, b),
  };
});

/** Cuboctahedron edges: two cuboctahedron vertices (edge midpoints) are connected
 *  if their original cube edges share a vertex and flip different bits */
export const CUBOCTA_EDGES: [number, number][] = [];
for (let i = 0; i < CUBOCTA_VERTICES.length; i++) {
  for (let j = i + 1; j < CUBOCTA_VERTICES.length; j++) {
    const vi = CUBOCTA_VERTICES[i],
      vj = CUBOCTA_VERTICES[j];
    const shared = [vi.lv0, vi.lv1].filter((v) => v === vj.lv0 || v === vj.lv1);
    if (shared.length === 1) {
      const chi = edgeChannel(vi.lv0, vi.lv1);
      const chj = edgeChannel(vj.lv0, vj.lv1);
      if (chi !== chj) CUBOCTA_EDGES.push([i, j]);
    }
  }
}

/* ── Rhombic Dodecahedron geometry ──────────
   14 vertices = 8 cube-type + 6 octahedron-type (face centers)
   12 rhombic faces = 12 cube edges (dual of cuboctahedron)
   24 edges: each connects a cube-type to an octahedron-type vertex  */

export interface RhombicOctaVertex {
  x: number;
  y: number;
  axis: "G" | "R" | "B";
  sign: 1 | -1;
  label: string; // e.g., "+R" or "−B"
}

// Octahedron-type vertices sit at midpoints of cube faces, pushed outward.
// In isometric projection, each is the average of 4 cube vertices on that face,
// scaled outward from center by factor 1.33 (to make rhombic proportions).
const RHOMBIC_CENTER = { x: ISO_CX, y: ISO_CY };
const RHOMBIC_SCALE = 1.33;

function cubeVerticesOnFace(axis: "G" | "R" | "B", val: 0 | 1): number[] {
  const bit = axis === "G" ? 2 : axis === "R" ? 1 : 0;
  const mask = 1 << bit;
  const result: number[] = [];
  for (let i = 0; i < 8; i++) {
    if ((i & mask) >> bit === val) result.push(i);
  }
  return result;
}

export const RHOMBIC_OCTA_VERTICES: RhombicOctaVertex[] = [];
for (const axis of ["G", "R", "B"] as const) {
  for (const val of [0, 1] as const) {
    const verts = cubeVerticesOnFace(axis, val);
    const avgX = verts.reduce((s, v) => s + CUBE_POINTS[v].x, 0) / 4;
    const avgY = verts.reduce((s, v) => s + CUBE_POINTS[v].y, 0) / 4;
    // Push outward from center
    const dx = avgX - RHOMBIC_CENTER.x;
    const dy = avgY - RHOMBIC_CENTER.y;
    const sign = val === 1 ? 1 : -1;
    const label = val === 1 ? `+${axis}` : `−${axis}`;
    RHOMBIC_OCTA_VERTICES.push({
      x: RHOMBIC_CENTER.x + dx * RHOMBIC_SCALE,
      y: RHOMBIC_CENTER.y + dy * RHOMBIC_SCALE,
      axis,
      sign: sign as 1 | -1,
      label,
    });
  }
}

/** White-pole rhombic octa vertices: same topology, positions from CUBE_POINTS_WHITE */
export const RHOMBIC_OCTA_VERTICES_WHITE: RhombicOctaVertex[] = [];
for (const axis of ["G", "R", "B"] as const) {
  for (const val of [0, 1] as const) {
    const verts = cubeVerticesOnFace(axis, val);
    const avgX = verts.reduce((s, v) => s + CUBE_POINTS_WHITE[v].x, 0) / 4;
    const avgY = verts.reduce((s, v) => s + CUBE_POINTS_WHITE[v].y, 0) / 4;
    const dx = avgX - RHOMBIC_CENTER.x;
    const dy = avgY - RHOMBIC_CENTER.y;
    const sign = val === 1 ? 1 : -1;
    const label = val === 1 ? `+${axis}` : `−${axis}`;
    RHOMBIC_OCTA_VERTICES_WHITE.push({
      x: RHOMBIC_CENTER.x + dx * RHOMBIC_SCALE,
      y: RHOMBIC_CENTER.y + dy * RHOMBIC_SCALE,
      axis,
      sign: sign as 1 | -1,
      label,
    });
  }
}

/** Rhombic dodecahedron edges: cube-type vertex v connects to octa-type vertex
 *  (axis, val) if the bit of v at axis equals val. Each cube vertex has 3 such edges. */
export const RHOMBIC_EDGES: { cubeVert: number; octaIdx: number }[] = [];
for (let v = 0; v < 8; v++) {
  RHOMBIC_OCTA_VERTICES.forEach((ov, oi) => {
    const bit = ov.axis === "G" ? 2 : ov.axis === "R" ? 1 : 0;
    const val = ov.sign === 1 ? 1 : 0;
    if (((v >> bit) & 1) === val) {
      RHOMBIC_EDGES.push({ cubeVert: v, octaIdx: oi });
    }
  });
}

/** 12 rhombic faces: one per cube edge. Each face has 4 vertices:
 *  2 cube-type (endpoints of the edge) + 2 octahedron-type (the two face-centers
 *  sharing that edge). */
export const RHOMBIC_FACES: { edge: [number, number]; cubeVerts: [number, number]; octaIdxs: [number, number] }[] = [];
CUBE_EDGES.forEach(([a, b]) => {
  const ch = edgeChannel(a, b);
  // The two octahedron vertices adjacent to this edge are on axes OTHER than ch
  const otherAxes = (["G", "R", "B"] as const).filter((ax) => ax !== ch);
  const octaIdxs: number[] = [];
  for (const ax of otherAxes) {
    const bit = ax === "G" ? 2 : ax === "R" ? 1 : 0;
    // Both endpoints share the same value on this axis (since they differ only on ch)
    const val = (a >> bit) & 1;
    const oi = RHOMBIC_OCTA_VERTICES.findIndex((ov) => ov.axis === ax && ov.sign === (val === 1 ? 1 : -1));
    if (oi >= 0) octaIdxs.push(oi);
  }
  if (octaIdxs.length === 2) {
    RHOMBIC_FACES.push({ edge: [a, b], cubeVerts: [a, b], octaIdxs: octaIdxs as [number, number] });
  }
});

/* ── Truncated Tetrahedron net layout ──────
   8 faces: 4 triangles (T0 vertices) + 4 hexagons (T1 colors via complement)
   Used in ColorDice expansion */

export interface TruncTetraFace {
  type: "tri" | "hex";
  color: number; // GF(2)³ level
  fromVertex: number; // T0 vertex that generated this face
}

/** Truncation of T0: triangles from vertices, hexagons from faces */
export const TRUNC_TETRA_FACES: TruncTetraFace[] = [
  // Triangles: one per T0 vertex (labeled by that vertex)
  { type: "tri", color: 0, fromVertex: 0 },
  { type: "tri", color: 3, fromVertex: 3 },
  { type: "tri", color: 5, fromVertex: 5 },
  { type: "tri", color: 6, fromVertex: 6 },
  // Hexagons: one per T0 face (labeled by complement of opposite vertex)
  { type: "hex", color: 7, fromVertex: 0 }, // face opp 000 → color 111
  { type: "hex", color: 4, fromVertex: 3 }, // face opp 011 → color 100
  { type: "hex", color: 2, fromVertex: 5 }, // face opp 101 → color 010
  { type: "hex", color: 1, fromVertex: 6 }, // face opp 110 → color 001
];

/** The 4 missing edges in the triakis tetrahedron = complement pairs */
export const TRUNC_MISSING_EDGES: [number, number][] = [
  [0, 7],
  [3, 4],
  [5, 2],
  [6, 1],
];

/* ── AG(3,2) Affine Planes ─────────────────
   14 planes = 7 parallel classes × 2 cosets
   Each plane is a 4-element subset of GF(2)³  */

export interface AffinePlane {
  elements: number[]; // 4 GF(2)³ elements
  isSubspace: boolean; // true if contains 0
  fanoLine: number; // index into FANO_LINES (0-6)
}

export const AG32_PLANES: AffinePlane[] = [
  // Class 0: L={1,2,3}={B,R,M}
  { elements: [0, 1, 2, 3], isSubspace: true, fanoLine: 0 },
  { elements: [4, 5, 6, 7], isSubspace: false, fanoLine: 0 },
  // Class 1: L={1,4,5}={B,G,C}
  { elements: [0, 1, 4, 5], isSubspace: true, fanoLine: 1 },
  { elements: [2, 3, 6, 7], isSubspace: false, fanoLine: 1 },
  // Class 2: L={2,4,6}={R,G,Y}
  { elements: [0, 2, 4, 6], isSubspace: true, fanoLine: 2 },
  { elements: [1, 3, 5, 7], isSubspace: false, fanoLine: 2 },
  // Class 3: L={1,6,7}={B,Y,W}
  { elements: [0, 1, 6, 7], isSubspace: true, fanoLine: 3 },
  { elements: [2, 3, 4, 5], isSubspace: false, fanoLine: 3 },
  // Class 4: L={2,5,7}={R,C,W}
  { elements: [0, 2, 5, 7], isSubspace: true, fanoLine: 4 },
  { elements: [1, 3, 4, 6], isSubspace: false, fanoLine: 4 },
  // Class 5: L={3,4,7}={M,G,W}
  { elements: [0, 4, 3, 7], isSubspace: true, fanoLine: 5 },
  { elements: [1, 2, 5, 6], isSubspace: false, fanoLine: 5 },
  // Class 6: L={3,5,6}={C,M,Y}
  { elements: [0, 3, 5, 6], isSubspace: true, fanoLine: 6 },
  { elements: [1, 2, 4, 7], isSubspace: false, fanoLine: 6 },
];

/* ── Gray Code Hexagon geometry ──────────── */

const GRAY_CX = 150,
  GRAY_CY = 150,
  GRAY_R = 110;

export const GRAY_POINTS: Record<number, { x: number; y: number }> = {};
GRAY_PATH.forEach((lv, i) => {
  const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
  GRAY_POINTS[lv] = {
    x: GRAY_CX + GRAY_R * Math.cos(angle),
    y: GRAY_CY + GRAY_R * Math.sin(angle),
  };
});

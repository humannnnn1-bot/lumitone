/* ═══════════════════════════════════════════
   THEORY TAB — SHARED DATA & GEOMETRY
   ═══════════════════════════════════════════ */

export interface TheoryLevel {
  lv: number;
  name: string;
  bits: [number, number, number]; // [G, R, B]
  color: string;
  hamming: string; // P1/P2/P4 for parity, D1-D4 for data, "—" for 0/7
}

export const THEORY_LEVELS: TheoryLevel[] = [
  { lv: 0, name: "Black", bits: [0, 0, 0], color: "#000000", hamming: "—" },
  { lv: 1, name: "Blue", bits: [0, 0, 1], color: "#0000ff", hamming: "P1" },
  { lv: 2, name: "Red", bits: [0, 1, 0], color: "#ff0000", hamming: "P2" },
  { lv: 3, name: "Magenta", bits: [0, 1, 1], color: "#ff00ff", hamming: "D1" },
  { lv: 4, name: "Green", bits: [1, 0, 0], color: "#00ff00", hamming: "P4" },
  { lv: 5, name: "Cyan", bits: [1, 0, 1], color: "#00ffff", hamming: "D2" },
  { lv: 6, name: "Yellow", bits: [1, 1, 0], color: "#ffff00", hamming: "D3" },
  { lv: 7, name: "White", bits: [1, 1, 1], color: "#ffffff", hamming: "D4" },
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
// Isometric axes: G=up, R=down-right, B=down-left
const ISO_G = { dx: 0, dy: -1.2 };
const ISO_R = { dx: Math.cos(Math.PI / 6), dy: Math.sin(Math.PI / 6) };
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

/**
 * 6 chromatic colors as cross-polytope vertices.
 * Axis assignment follows hue-wheel convention (Red = top, clockwise = R→Y→G→C→B→M):
 *   R(2)=up, C(5)=down  (vertical axis)
 *   Y(6)=upper-right, B(1)=lower-left  (right diagonal)
 *   M(3)=upper-left, G(4)=lower-right  (left diagonal)
 * Complement pairs remain antipodal on each axis.
 */
export const OCTA_POINTS: Record<number, { x: number; y: number }> = {
  2: { x: OCTA_CX + OCTA_SCALE * ISO_G.dx, y: OCTA_CY + OCTA_SCALE * ISO_G.dy }, // Red = top
  5: { x: OCTA_CX - OCTA_SCALE * ISO_G.dx, y: OCTA_CY - OCTA_SCALE * ISO_G.dy }, // Cyan = bottom
  4: { x: OCTA_CX + OCTA_SCALE * ISO_R.dx, y: OCTA_CY + OCTA_SCALE * ISO_R.dy }, // Green = lower-right
  3: { x: OCTA_CX - OCTA_SCALE * ISO_R.dx, y: OCTA_CY - OCTA_SCALE * ISO_R.dy }, // Magenta = upper-left
  1: { x: OCTA_CX + OCTA_SCALE * ISO_B.dx, y: OCTA_CY + OCTA_SCALE * ISO_B.dy }, // Blue = lower-left
  6: { x: OCTA_CX - OCTA_SCALE * ISO_B.dx, y: OCTA_CY - OCTA_SCALE * ISO_B.dy }, // Yellow = upper-right
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

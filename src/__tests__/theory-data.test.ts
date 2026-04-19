import { describe, expect, it } from "vitest";
import { LUMA_B, LUMA_G, LUMA_R } from "../color-engine";
import {
  COMPLEMENT_EDGES,
  CUBE_EDGES,
  DICE_NET_FACES,
  FANO_LINES,
  GRAY_PATH,
  GRAY_TOGGLES,
  STELLA_EDGES,
  TETRA_T0,
  THEORY_LEVELS,
  hammingDist,
} from "../components/theory/theory-data";

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

type FaceLv = 1 | 2 | 3 | 4 | 5 | 6;
type Channel = "G" | "R" | "B";
type BitAssignment = readonly [Channel, Channel, Channel]; // [bit2, bit1, bit0]
type DiceEdge = readonly [FaceLv, FaceLv];
type Vec3 = readonly [number, number, number];
type Dir = "E" | "W" | "S" | "N";

interface OrientedFace {
  n: Vec3; // outward normal
  u: Vec3; // local +x direction in the unfolded net
  v: Vec3; // local +y direction in the unfolded net
}

interface Pt {
  x: number;
  y: number;
}

const DICE_FACES: FaceLv[] = [1, 2, 3, 4, 5, 6];

// One concrete folded cube orientation matching ColorDice's staircase:
// R(+X) -> Y(+Y) -> G(+Z) -> C(-X) -> B(-Y) -> M(-Z).
// Opposite pairs are therefore R/C, Y/B, and G/M.
const DICE_NORMALS: Record<FaceLv, Vec3> = {
  1: [0, -1, 0], // Blue
  2: [1, 0, 0], // Red
  3: [0, 0, -1], // Magenta
  4: [0, 0, 1], // Green
  5: [-1, 0, 0], // Cyan
  6: [0, 1, 0], // Yellow
};

const DICE_ROOT: FaceLv = 2;
const DICE_ROOT_ORIENTATION: OrientedFace = {
  n: DICE_NORMALS[2],
  u: DICE_NORMALS[6],
  v: DICE_NORMALS[4],
};

const BT601_LUMA_WEIGHTS: Record<Channel, number> = {
  G: LUMA_G,
  R: LUMA_R,
  B: LUMA_B,
};

const DICE_FACE_EDGES: DiceEdge[] = DICE_FACES.flatMap((a, i) =>
  DICE_FACES.slice(i + 1)
    .filter((b) => (a ^ b) !== 7)
    .map((b) => [a, b] as const),
);

function vecEq(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function vecNeg(v: Vec3): Vec3 {
  return [-v[0], -v[1], -v[2]];
}

function directionToNeighbor(face: OrientedFace, neighborNormal: Vec3): Dir {
  if (vecEq(neighborNormal, face.u)) return "E";
  if (vecEq(neighborNormal, vecNeg(face.u))) return "W";
  if (vecEq(neighborNormal, face.v)) return "S";
  if (vecEq(neighborNormal, vecNeg(face.v))) return "N";
  throw new Error(`faces are not adjacent: ${face.n.join(",")} -> ${neighborNormal.join(",")}`);
}

function rotateAcross(face: OrientedFace, dir: Dir): OrientedFace {
  switch (dir) {
    case "E":
      return { n: face.u, u: vecNeg(face.n), v: face.v };
    case "W":
      return { n: vecNeg(face.u), u: face.n, v: face.v };
    case "S":
      return { n: face.v, u: face.u, v: vecNeg(face.n) };
    case "N":
      return { n: vecNeg(face.v), u: face.u, v: face.n };
  }
}

function stepFromDir({ x, y }: Pt, dir: Dir): Pt {
  if (dir === "E") return { x: x + 1, y };
  if (dir === "W") return { x: x - 1, y };
  if (dir === "S") return { x, y: y + 1 };
  return { x, y: y - 1 };
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, chosen: T[]) => {
    if (chosen.length === size) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i <= items.length - (size - chosen.length); i++) {
      chosen.push(items[i]);
      walk(i + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return out;
}

function lumaWeightForAssignment([bit2, bit1, bit0]: BitAssignment, lv: number): number {
  const channelBits: Record<Channel, number> = { G: 0, R: 0, B: 0 };
  channelBits[bit2] = (lv >> 2) & 1;
  channelBits[bit1] = (lv >> 1) & 1;
  channelBits[bit0] = lv & 1;
  return channelBits.G * BT601_LUMA_WEIGHTS.G + channelBits.R * BT601_LUMA_WEIGHTS.R + channelBits.B * BT601_LUMA_WEIGHTS.B;
}

function isStrictlyIncreasing(values: readonly number[]): boolean {
  return values.every((value, i) => i === 0 || value > values[i - 1]);
}

function isConnectedSpanningTree(edges: readonly DiceEdge[]): boolean {
  if (edges.length !== DICE_FACES.length - 1) return false;

  const adj = new Map<FaceLv, FaceLv[]>(DICE_FACES.map((f) => [f, []]));
  for (const [a, b] of edges) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }

  const seen = new Set<FaceLv>([DICE_ROOT]);
  const queue: FaceLv[] = [DICE_ROOT];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur)!) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size === DICE_FACES.length;
}

function enumerateDiceFaceSpanningTrees(): DiceEdge[][] {
  return combinations(DICE_FACE_EDGES, DICE_FACES.length - 1).filter(isConnectedSpanningTree);
}

function unfoldTree(edges: readonly DiceEdge[]): Map<FaceLv, Pt> {
  const adj = new Map<FaceLv, FaceLv[]>(DICE_FACES.map((f) => [f, []]));
  for (const [a, b] of edges) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }

  const positions = new Map<FaceLv, Pt>([[DICE_ROOT, { x: 0, y: 0 }]]);
  const orientations = new Map<FaceLv, OrientedFace>([[DICE_ROOT, DICE_ROOT_ORIENTATION]]);
  const queue: FaceLv[] = [DICE_ROOT];

  while (queue.length) {
    const cur = queue.shift()!;
    const curPos = positions.get(cur)!;
    const curOrientation = orientations.get(cur)!;

    for (const next of adj.get(cur)!) {
      if (positions.has(next)) continue;

      const dir = directionToNeighbor(curOrientation, DICE_NORMALS[next]);
      const nextOrientation = rotateAcross(curOrientation, dir);
      expect(vecEq(nextOrientation.n, DICE_NORMALS[next])).toBe(true);

      positions.set(next, stepFromDir(curPos, dir));
      orientations.set(next, nextOrientation);
      queue.push(next);
    }
  }

  expect(positions.size).toBe(DICE_FACES.length);
  return positions;
}

function canonicalShape(points: readonly Pt[]): string {
  const transforms = [
    ({ x, y }: Pt) => ({ x, y }),
    ({ x, y }: Pt) => ({ x, y: -y }),
    ({ x, y }: Pt) => ({ x: -x, y }),
    ({ x, y }: Pt) => ({ x: -x, y: -y }),
    ({ x, y }: Pt) => ({ x: y, y: x }),
    ({ x, y }: Pt) => ({ x: y, y: -x }),
    ({ x, y }: Pt) => ({ x: -y, y: x }),
    ({ x, y }: Pt) => ({ x: -y, y: -x }),
  ];

  return transforms
    .map((transform) => {
      const transformed = points.map(transform);
      const minX = Math.min(...transformed.map((p) => p.x));
      const minY = Math.min(...transformed.map((p) => p.y));
      return transformed
        .map((p) => ({ x: p.x - minX, y: p.y - minY }))
        .sort((a, b) => a.x - b.x || a.y - b.y)
        .map((p) => `${p.x},${p.y}`)
        .join(";");
    })
    .sort()[0];
}

function hasNoOverlappingFaces(positions: Map<FaceLv, Pt>): boolean {
  return new Set([...positions.values()].map((p) => `${p.x},${p.y}`)).size === positions.size;
}

function containsEdges(edges: readonly DiceEdge[], required: readonly DiceEdge[]): boolean {
  const present = new Set(edges.map(([a, b]) => edgeKey(a, b)));
  return required.every(([a, b]) => present.has(edgeKey(a, b)));
}

describe("theory-data invariants", () => {
  it("treats the CMY Fano line as an even-parity tetrahedron rather than a Euclidean plane slice", () => {
    const p3 = [0, 1, 1];
    const p5 = [1, 0, 1];
    const p6 = [1, 1, 0];
    const det = p3[0] * (p5[1] * p6[2] - p5[2] * p6[1]) - p3[1] * (p5[0] * p6[2] - p5[2] * p6[0]) + p3[2] * (p5[0] * p6[1] - p5[1] * p6[0]);

    expect(det).not.toBe(0);
    expect(new Set([0, 3, 5, 6])).toEqual(new Set(TETRA_T0));
  });

  it("models the Fano plane as a Steiner triple system", () => {
    const pairCounts = new Map<string, number>();

    for (const [a, b, c] of FANO_LINES) {
      expect(a ^ b ^ c).toBe(0);
      const points = [a, b, c];
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const key = edgeKey(points[i], points[j]);
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    expect(pairCounts.size).toBe(21);
    for (const count of pairCounts.values()) expect(count).toBe(1);
  });

  it("makes GRB the unique BT.601 luma-monotone bit assignment", () => {
    expect(BT601_LUMA_WEIGHTS.G).toBeGreaterThan(BT601_LUMA_WEIGHTS.R + BT601_LUMA_WEIGHTS.B);
    expect(BT601_LUMA_WEIGHTS.R).toBeGreaterThan(BT601_LUMA_WEIGHTS.B);
    expect(THEORY_LEVELS.map(({ bits }) => 4 * bits[0] + 2 * bits[1] + bits[2])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const assignments: BitAssignment[] = [
      ["G", "R", "B"],
      ["G", "B", "R"],
      ["R", "G", "B"],
      ["R", "B", "G"],
      ["B", "G", "R"],
      ["B", "R", "G"],
    ];
    const monotoneAssignments = assignments.filter((assignment) =>
      isStrictlyIncreasing(Array.from({ length: 8 }, (_, lv) => lumaWeightForAssignment(assignment, lv))),
    );

    expect(assignments).toHaveLength(6);
    expect(monotoneAssignments).toEqual([["G", "R", "B"]]);
    expect(Array.from({ length: 8 }, (_, lv) => Math.round(255 * lumaWeightForAssignment(["G", "R", "B"], lv)))).toEqual([
      0, 29, 76, 105, 150, 179, 226, 255,
    ]);
  });

  it("reverses chromatic BT.601 luma ranks under complement, matching die opposite sums", () => {
    const chromaticLevels = [1, 2, 3, 4, 5, 6];
    const ranked = chromaticLevels
      .map((lv) => ({ lv, luma: lumaWeightForAssignment(["G", "R", "B"], lv) }))
      .sort((a, b) => a.luma - b.luma);
    const rankByLv = new Map(ranked.map(({ lv }, i) => [lv, i + 1]));

    expect(ranked.map(({ lv }) => lv)).toEqual([1, 2, 3, 4, 5, 6]);

    for (const lv of chromaticLevels) {
      const complement = lv ^ 7;
      expect(chromaticLevels).toContain(complement);
      expect(lumaWeightForAssignment(["G", "R", "B"], lv) + lumaWeightForAssignment(["G", "R", "B"], complement)).toBeCloseTo(1);
      expect(rankByLv.get(lv)! + rankByLv.get(complement)!).toBe(7);
    }
  });

  it("keeps the Gray cycle on chromatic vertices with one bit flip per step", () => {
    expect(new Set(GRAY_PATH).size).toBe(6);
    expect([...GRAY_PATH].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);

    const diffToToggle: Record<number, string> = { 1: "B", 2: "R", 4: "G" };
    GRAY_PATH.forEach((lv, i) => {
      const next = GRAY_PATH[(i + 1) % GRAY_PATH.length];
      const diff = lv ^ next;
      expect(hammingDist(lv, next)).toBe(1);
      expect(GRAY_TOGGLES[i]).toBe(diffToToggle[diff]);
    });
  });

  it("partitions K8 edges by Hamming distance", () => {
    const q3 = new Set(CUBE_EDGES.map(([a, b]) => edgeKey(a, b)));
    const stella = new Set(STELLA_EDGES.map(([a, b]) => edgeKey(a, b)));
    const complements = new Set(COMPLEMENT_EDGES.map(([a, b]) => edgeKey(a, b)));
    const union = new Set([...q3, ...stella, ...complements]);

    expect(q3.size).toBe(12);
    expect(stella.size).toBe(12);
    expect(complements.size).toBe(4);
    expect(union.size).toBe(28);

    for (const [a, b] of CUBE_EDGES) expect(hammingDist(a, b)).toBe(1);
    for (const [a, b] of STELLA_EDGES) expect(hammingDist(a, b)).toBe(2);
    for (const [a, b] of COMPLEMENT_EDGES) expect(hammingDist(a, b)).toBe(3);

    expect(COMPLEMENT_EDGES).toEqual([
      [0, 7],
      [1, 6],
      [2, 5],
      [3, 4],
    ]);
  });

  it("keeps T0 closed under XOR", () => {
    const t0 = new Set<number>(TETRA_T0);
    for (const a of TETRA_T0) {
      for (const b of TETRA_T0) {
        expect(t0.has(a ^ b)).toBe(true);
      }
    }
  });

  it("matches the displayed subtractive CMY examples with Boolean AND", () => {
    const subtractivePairs: [number, number, number][] = [
      [3, 5, 1],
      [5, 6, 4],
      [6, 3, 2],
    ];

    for (const [a, b, expected] of subtractivePairs) {
      expect(a | b).toBe(7);
      expect(a + b - 7).toBe(expected);
      expect(a & b).toBe(expected);
      expect(a ^ b).not.toBe(expected);
    }
  });

  it("enumerates the 11 free cube nets from cube-face spanning trees", () => {
    expect(DICE_FACE_EDGES).toHaveLength(12);

    const trees = enumerateDiceFaceSpanningTrees();
    const unfolded = trees.map((edges) => unfoldTree(edges));
    const nonOverlapping = unfolded.filter(hasNoOverlappingFaces);
    const freeNets = new Set(nonOverlapping.map((positions) => canonicalShape([...positions.values()])));

    expect(trees).toHaveLength(384);
    expect(nonOverlapping).toHaveLength(384);
    expect(freeNets.size).toBe(11);
  });

  it("uniquely unfolds the hue-order die path as the 2-2-2 staircase net", () => {
    const huePathEdges = GRAY_PATH.slice(0, -1).map((lv, i) => [lv, GRAY_PATH[i + 1]] as DiceEdge);
    const displayedStaircaseShape = canonicalShape(DICE_NET_FACES.map(({ col, row }) => ({ x: col, y: row })));

    const trees = enumerateDiceFaceSpanningTrees();
    const matching = trees
      .filter((edges) => containsEdges(edges, huePathEdges))
      .map((edges) => {
        const positions = unfoldTree(edges);
        return { positions, shape: canonicalShape([...positions.values()]) };
      });

    expect(huePathEdges).toEqual([
      [2, 6],
      [6, 4],
      [4, 5],
      [5, 1],
      [1, 3],
    ]);
    expect(matching).toHaveLength(1);
    expect(hasNoOverlappingFaces(matching[0].positions)).toBe(true);
    expect(DICE_NET_FACES.map(({ lv }) => lv)).toEqual(GRAY_PATH);
    expect(matching[0].shape).toBe(displayedStaircaseShape);
  });
});

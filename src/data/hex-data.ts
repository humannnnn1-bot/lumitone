import { hue2rgb, LEVEL_CANDIDATES } from "../color-engine";
import { NUM_VERTICES } from "../constants";

/* ═══════════════════════════════════════════
   HEXAGON DIAGRAM DATA
   ═══════════════════════════════════════════ */

export const HEX_ANGLES: readonly number[] = [0, 60, 120, 180, 240, 300];

interface HexVertex {
  readonly label: string;
  readonly level: number;
  readonly rgb: string;
  readonly angleDeg: number;
}

export const HEX_VERTICES = [
  { label: "R", level: 2, rgb: "#ff0000", angleDeg: -90 },
  { label: "Y", level: 6, rgb: "#ffff00", angleDeg: -30 },
  { label: "G", level: 4, rgb: "#00ff00", angleDeg: 30 },
  { label: "C", level: 5, rgb: "#00ffff", angleDeg: 90 },
  { label: "B", level: 1, rgb: "#0000ff", angleDeg: 150 },
  { label: "M", level: 3, rgb: "#ff00ff", angleDeg: 210 },
] as const satisfies readonly HexVertex[];

interface HexEdge {
  readonly fromVertexIndex: number;
  readonly toVertexIndex: number;
  readonly levels: readonly number[];
}

/* t:6 is equivalent to t:0 (wraps via % NUM_VERTICES) — represents the edge from vertex 5 to vertex 0 */
export const HEX_EDGES = [
  { fromVertexIndex: 0, toVertexIndex: 1, levels: [3, 4, 5] },
  { fromVertexIndex: 1, toVertexIndex: 2, levels: [5] },
  { fromVertexIndex: 2, toVertexIndex: 3, levels: [] },
  { fromVertexIndex: 3, toVertexIndex: 4, levels: [4, 3, 2] },
  { fromVertexIndex: 4, toVertexIndex: 5, levels: [2] },
  { fromVertexIndex: 5, toVertexIndex: 6, levels: [] },
] as const satisfies readonly HexEdge[];

interface EdgeColor {
  readonly hex: string;
  readonly hue: number;
}

export const HEX_EDGE_COLORS: readonly (readonly EdgeColor[])[] = HEX_EDGES.map((e) => {
  const startHueDeg = HEX_ANGLES[e.fromVertexIndex],
    endHueDeg = e.toVertexIndex >= NUM_VERTICES ? 360 : HEX_ANGLES[e.toVertexIndex];
  const levelSpan = Math.abs(HEX_VERTICES[e.fromVertexIndex].level - HEX_VERTICES[e.toVertexIndex % NUM_VERTICES].level);
  if (levelSpan === 0)
    return e.levels.map(() => {
      const c = hue2rgb(startHueDeg);
      return { hex: "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""), hue: startHueDeg };
    });
  return e.levels.map((_, i) => {
    const t = (i + 1) / levelSpan,
      h = startHueDeg + (endHueDeg - startHueDeg) * t,
      c = hue2rgb(h);
    return { hex: "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""), hue: h };
  });
});

function calcCandidateIndex(level: number, hue: number): number {
  const candidates = LEVEL_CANDIDATES[level];
  if (!candidates || candidates.length <= 1) return 0;
  let best = 0,
    bestDist = Infinity;
  candidates.forEach((candidate, candidateIndex) => {
    if (candidate.hueAngleDeg < 0) return;
    let distanceDeg = Math.abs(candidate.hueAngleDeg - hue);
    if (distanceDeg > 180) distanceDeg = 360 - distanceDeg;
    if (distanceDeg < bestDist) {
      bestDist = distanceDeg;
      best = candidateIndex;
    }
  });
  return best;
}

export const HEX_VERTEX_CANDIDATE_INDICES: readonly number[] = HEX_VERTICES.map((v, i) => calcCandidateIndex(v.level, HEX_ANGLES[i]));
export const HEX_EDGE_CANDIDATE_INDICES: readonly (readonly number[])[] = HEX_EDGES.map((e, ei) =>
  e.levels.map((level, levelIndex) => calcCandidateIndex(level, HEX_EDGE_COLORS[ei][levelIndex].hue)),
);

interface HexDot {
  readonly level: number;
  readonly candidateIndex: number;
  readonly vertexIndex: number;
  readonly edgeIndex: number;
  readonly segmentIndex: number;
}

function buildHexDots(): readonly HexDot[] {
  const dots: HexDot[] = [];
  HEX_VERTICES.forEach((v, i) =>
    dots.push({ level: v.level, candidateIndex: HEX_VERTEX_CANDIDATE_INDICES[i], vertexIndex: i, edgeIndex: -1, segmentIndex: -1 }),
  );
  HEX_EDGES.forEach((e, edgeIndex) =>
    e.levels.forEach((level, segmentIndex) =>
      dots.push({
        level,
        candidateIndex: HEX_EDGE_CANDIDATE_INDICES[edgeIndex][segmentIndex],
        vertexIndex: -1,
        edgeIndex,
        segmentIndex,
      }),
    ),
  );
  return dots;
}

export const HEX_DOTS = buildHexDots();

/** Hex diagram angle for each (level, candidateIndex) — matches dot positions on the hex diagram */
function buildHexCandidateAngles(): readonly (readonly (number | null)[])[] {
  const angles: (number | null)[][] = LEVEL_CANDIDATES.map((alts) => alts.map(() => null));
  HEX_VERTICES.forEach((v, i) => {
    angles[v.level][HEX_VERTEX_CANDIDATE_INDICES[i]] = HEX_ANGLES[i];
  });
  HEX_EDGES.forEach((e, edgeIndex) => {
    e.levels.forEach((level, segmentIndex) => {
      angles[level][HEX_EDGE_CANDIDATE_INDICES[edgeIndex][segmentIndex]] = HEX_EDGE_COLORS[edgeIndex][segmentIndex].hue;
    });
  });
  return angles;
}

export const HEX_CANDIDATE_ANGLES = buildHexCandidateAngles();

export const HEX_CX = 200,
  HEX_CY = 175,
  HEX_R = 130;

interface HexVertexPosition {
  readonly x: number;
  readonly y: number;
}

export const HEX_VERTEX_POSITIONS: readonly HexVertexPosition[] = HEX_VERTICES.map((v) => {
  const angleRad = (v.angleDeg * Math.PI) / 180;
  return { x: HEX_CX + HEX_R * Math.cos(angleRad), y: HEX_CY + HEX_R * Math.sin(angleRad) };
});

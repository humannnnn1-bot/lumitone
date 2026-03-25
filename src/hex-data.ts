import { hue2rgb, LEVEL_CANDIDATES } from "./color-engine";
import { NUM_VERTICES } from "./constants";

/* ═══════════════════════════════════════════
   HEXAGON DIAGRAM DATA
   ═══════════════════════════════════════════ */

export const HEX_ANGLES = [0, 60, 120, 180, 240, 300];

export interface HexVertex {
  c: string;
  lv: number;
  rgb: string;
  a: number;
}

export const HEX_VERTICES: HexVertex[] = [
  { c: "R", lv: 2, rgb: "#ff0000", a: -90 }, { c: "Y", lv: 6, rgb: "#ffff00", a: -30 },
  { c: "G", lv: 4, rgb: "#00ff00", a: 30 },  { c: "C", lv: 5, rgb: "#00ffff", a: 90 },
  { c: "B", lv: 1, rgb: "#0000ff", a: 150 }, { c: "M", lv: 3, rgb: "#ff00ff", a: 210 },
];

export interface HexEdge {
  f: number;
  t: number;
  lv: number[];
}

/* t:6 is equivalent to t:0 (wraps via % NUM_VERTICES) — represents the edge from vertex 5 to vertex 0 */
export const HEX_EDGES: HexEdge[] = [
  { f: 0, t: 1, lv: [3,4,5] }, { f: 1, t: 2, lv: [5] }, { f: 2, t: 3, lv: [] },
  { f: 3, t: 4, lv: [4,3,2] }, { f: 4, t: 5, lv: [2] }, { f: 5, t: 6, lv: [] },
];

export interface EdgeColor {
  hex: string;
  hue: number;
}

export const HEX_EDGE_COLORS: EdgeColor[][] = HEX_EDGES.map(e => {
  const hs = HEX_ANGLES[e.f], he = e.t >= NUM_VERTICES ? 360 : HEX_ANGLES[e.t];
  const ts = Math.abs(HEX_VERTICES[e.f].lv - HEX_VERTICES[e.t % NUM_VERTICES].lv);
  if (ts === 0) return e.lv.map(() => {
    const c = hue2rgb(hs);
    return { hex: "#" + c.map(v => v.toString(16).padStart(2,"0")).join(""), hue: hs };
  });
  return e.lv.map((_, i) => {
    const t = (i+1) / ts, h = hs + (he - hs) * t, c = hue2rgb(h);
    return { hex: "#" + c.map(v => v.toString(16).padStart(2,"0")).join(""), hue: h };
  });
});

function calcAlt(lv: number, hue: number): number {
  const a = LEVEL_CANDIDATES[lv];
  if (!a || a.length <= 1) return 0;
  let best = 0, bestDist = Infinity;
  a.forEach((x, j) => { if (x.angle < 0) return; let d = Math.abs(x.angle - hue); if (d > 180) d = 360 - d; if (d < bestDist) { bestDist = d; best = j; } });
  return best;
}

export const HEX_VERTEX_ALTS = HEX_VERTICES.map((v, i) => calcAlt(v.lv, HEX_ANGLES[i]));
export const HEX_EDGE_ALTS = HEX_EDGES.map((e, ei) => e.lv.map((lv, li) => calcAlt(lv, HEX_EDGE_COLORS[ei][li].hue)));

export interface HexDot {
  lv: number;
  alt: number;
  vi: number;
  ei: number;
  si: number;
}

export const HEX_DOTS: HexDot[] = [];
HEX_VERTICES.forEach((v, i) => HEX_DOTS.push({ lv: v.lv, alt: HEX_VERTEX_ALTS[i], vi: i, ei: -1, si: -1 }));
HEX_EDGES.forEach((e, ei) => e.lv.forEach((lv, li) => HEX_DOTS.push({ lv, alt: HEX_EDGE_ALTS[ei][li], vi: -1, ei, si: li })));

export const HEX_CX = 200, HEX_CY = 175, HEX_R = 130;

export interface HexVP { x: number; y: number; }

export const HEX_VP: HexVP[] = HEX_VERTICES.map(v => {
  const a = v.a * Math.PI / 180;
  return { x: HEX_CX + HEX_R * Math.cos(a), y: HEX_CY + HEX_R * Math.sin(a) };
});

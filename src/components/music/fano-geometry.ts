import { FANO_LINES } from "../theory/theory-data";

export const FANO_VIEWBOX_WIDTH = 180;
export const FANO_VIEWBOX_HEIGHT = 162;

/* Equilateral triangle: base = 140, height = 70√3 ≈ 121.2 */
export const FANO_POINT_POSITIONS: Record<number, [number, number]> = {
  2: [90, 15],
  1: [20, 136.2],
  4: [160, 136.2],
  3: [55, 75.6],
  6: [125, 75.6],
  5: [90, 136.2],
  7: [90, 95.8],
};

export const FANO_LINE_DUAL_POINTS = [4, 2, 1, 6, 5, 3, 7] as const;

export const FANO_INSCRIBED_CIRCLE = (() => {
  const [x3, y3] = FANO_POINT_POSITIONS[3];
  const [x5, y5] = FANO_POINT_POSITIONS[5];
  const [x6, y6] = FANO_POINT_POSITIONS[6];
  const cx = (x3 + x5 + x6) / 3;
  const cy = (y3 + y5 + y6) / 3;
  const r = Math.sqrt((x3 - cx) ** 2 + (y3 - cy) ** 2);
  return { cx, cy, r };
})();

export const FANO_LINE_ENDPOINTS: ([number, number] | null)[] = [[1, 2], [1, 4], [2, 4], [1, 6], [2, 5], [3, 4], null];

const CIRCLE_LINE_INDEX = FANO_LINES.length - 1;

export function lineIndicesThroughPoint(point: number): number[] {
  return FANO_LINES.reduce<number[]>((acc, line, i) => {
    if (line.includes(point)) acc.push(i);
    return acc;
  }, []);
}

export function fanoLinePath(line: readonly number[]): string {
  const pts = line.map((lv) => FANO_POINT_POSITIONS[lv]);
  return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]} L${pts[2][0]},${pts[2][1]}`;
}

export function fanoCirclePath(): string {
  const [x3, y3] = FANO_POINT_POSITIONS[3];
  const [x5, y5] = FANO_POINT_POSITIONS[5];
  const [x6, y6] = FANO_POINT_POSITIONS[6];
  const { r } = FANO_INSCRIBED_CIRCLE;
  return `M${x3},${y3} A${r},${r} 0 1,0 ${x5},${y5} A${r},${r} 0 0,0 ${x6},${y6} A${r},${r} 0 0,0 ${x3},${y3}`;
}

export function fanoLineSvgPath(lineIndex: number): string {
  const line = FANO_LINES[lineIndex];
  return lineIndex === CIRCLE_LINE_INDEX ? fanoCirclePath() : fanoLinePath(line);
}

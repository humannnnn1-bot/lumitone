import React from "react";
import { C } from "../../tokens";

interface MiniFanoChordProps {
  hoveredLine: number | null;
  onLineHover: (lineIndex: number | null) => void;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  /** Currently playing level from Gray melody (1-7 or null) */
  playingLevel?: number | null;
  /** Currently playing line index from Fano rhythm (0-6 or null) */
  playingLine?: number | null;
}

const FANO_LINES = [
  [1, 2, 3], // 0: left edge   (B-R, midpoint M)
  [1, 4, 5], // 1: bottom edge (B-G, midpoint C)
  [2, 4, 6], // 2: right edge  (R-G, midpoint Y)
  [1, 6, 7], // 3: median from B through W to Y
  [2, 5, 7], // 4: median from R through W to C
  [3, 4, 7], // 5: median from M through W to G
  [3, 5, 6], // 6: inscribed circle (M-C-Y)
];

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

// Projective duality: each line's dual point in GF(2)³ (orthogonal complement).
// Line color = dual point's color, which changes dynamically with activeLevels.
const LINE_DUAL_POINTS = [
  4, // [1,2,3] left edge   → dual L4(Green)
  2, // [1,4,5] bottom edge → dual L2(Red)
  1, // [2,4,6] right edge  → dual L1(Blue)
  6, // [1,6,7] median      → dual L6(Yellow)
  5, // [2,5,7] median      → dual L5(Cyan)
  3, // [3,4,7] median      → dual L3(Magenta)
  7, // [3,5,6] circle      → dual L7(White)
];

// Standard Fano plane layout: equilateral triangle + midpoints + centroid
// Triangle vertices: L2(Red/top), L1(Blue/bottom-left), L4(Green/bottom-right)
// Edge midpoints:    L3(Magenta/left), L6(Yellow/right), L5(Cyan/bottom)
// Centroid:          L7(White)
//
// Mathematically exact coordinates:
//   Vertices: (100,20), (23,153), (177,153)
//   Midpoints: exact averages of vertex pairs
//   Centroid: exact average of all 3 vertices = (100, 108.67)
const PTS: Record<number, [number, number]> = {
  2: [100, 20], // Red - top vertex
  1: [23, 153], // Blue - bottom-left vertex
  4: [177, 153], // Green - bottom-right vertex
  3: [61.5, 86.5], // Magenta - midpoint of left edge (1↔2)
  6: [138.5, 86.5], // Yellow - midpoint of right edge (2↔4)
  5: [100, 153], // Cyan - midpoint of bottom edge (1↔4)
  7: [100, 108.67], // White - centroid (exact)
};

// Inscribed circle line index
const CIRCLE_LINE_INDEX = 6; // [3, 5, 6]

function pointColor(lv: number, activeLevels: MiniFanoChordProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function linePath(line: number[]): string {
  const pts = line.map((lv) => PTS[lv]);
  return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]} L${pts[2][0]},${pts[2][1]}`;
}

// Inscribed circle through the 3 midpoints (L3, L5, L6)
function inscribedCirclePath(): string {
  const [x3, y3] = PTS[3]; // Magenta
  const [x5, y5] = PTS[5]; // Cyan
  const [x6, y6] = PTS[6]; // Yellow
  // Circumcircle of the midpoint triangle — centroid coincides with triangle centroid
  const cx = (x3 + x5 + x6) / 3;
  const cy = (y3 + y5 + y6) / 3;
  const r = Math.sqrt((x3 - cx) ** 2 + (y3 - cy) ** 2);
  return `M${x3},${y3} A${r},${r} 0 1,0 ${x5},${y5} A${r},${r} 0 0,0 ${x6},${y6} A${r},${r} 0 0,0 ${x3},${y3}`;
}

export const MiniFanoChord = React.memo(function MiniFanoChord({
  hoveredLine,
  onLineHover,
  activeLevels,
  playingLevel,
  playingLine,
}: MiniFanoChordProps) {
  const anyHovered = hoveredLine !== null;
  const playingLineLevels = playingLine !== null ? FANO_LINES[playingLine] : null;

  return (
    <svg viewBox="0 0 200 190" style={{ width: "100%", maxWidth: 300, aspectRatio: "200/190" }}>
      <defs>
        <filter id="fano-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Lines */}
      {FANO_LINES.map((line, i) => {
        const isHovered = hoveredLine === i;
        const isPlayingLine = playingLine === i;
        const active = isHovered || isPlayingLine;
        const opacity = anyHovered ? (isHovered ? 1 : 0.2) : isPlayingLine ? 1 : 0.5;
        const sw = active ? 3 : 1.5;
        const isCircle = i === CIRCLE_LINE_INDEX;
        const d = isCircle ? inscribedCirclePath() : linePath(line);
        // Line color = dual point's color (dynamic via activeLevels)
        const baseColor = pointColor(LINE_DUAL_POINTS[i], activeLevels);
        const color = baseColor;

        return (
          <g key={i}>
            {/* Wide transparent hit area */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ cursor: "pointer" }}
              onPointerEnter={() => onLineHover(i)}
              onPointerLeave={() => onLineHover(null)}
            />
            {/* Visible line */}
            <path d={d} fill="none" stroke={color} strokeWidth={sw} opacity={opacity} strokeLinecap="round" pointerEvents="none" />
          </g>
        );
      })}

      {/* Points */}
      {[1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const [px, py] = PTS[lv];
        const isOnHoveredLine = hoveredLine !== null && FANO_LINES[hoveredLine].includes(lv);
        const isPlaying = playingLevel === lv || (playingLineLevels !== null && playingLineLevels.includes(lv));
        const highlighted = isOnHoveredLine || isPlaying;
        const r = highlighted ? 10 : 8;
        const col = pointColor(lv, activeLevels);
        const dimmed =
          (anyHovered && !isOnHoveredLine) || (isPlaying === false && (playingLevel !== null || playingLineLevels !== null) && !anyHovered);
        // Dark text for bright levels (G, C, Y, W), white for dark levels (B, R, M)
        const textColor = lv >= 4 ? "#000" : "#fff";

        return (
          <g key={lv} filter={highlighted ? "url(#fano-glow)" : undefined}>
            <circle cx={px} cy={py} r={r} fill={col} stroke="#fff" strokeWidth={isPlaying ? 2 : 1} opacity={dimmed ? 0.3 : 1} />
            <text x={px} y={py + 3.5} fontSize={9} fill={textColor} textAnchor="middle" pointerEvents="none" opacity={dimmed ? 0.3 : 1}>
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

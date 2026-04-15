import React from "react";
import { FANO_LINES } from "../theory/theory-data";
import { FANO_LINE_DUAL_POINTS, FANO_POINT_POSITIONS, FANO_VIEWBOX_HEIGHT, FANO_VIEWBOX_WIDTH, fanoLineSvgPath } from "./fano-geometry";

interface MiniFanoChordProps {
  hoveredLine: number | null;
  onLineHover: (lineIndex: number | null) => void;
  onNodeClick?: (lv: number) => void;
  onLineClick?: (lineIndex: number) => void;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  /** Currently playing level from Gray melody (1-7 or null) */
  playingLevel?: number | null;
  /** Currently playing line index from Fano rhythm (0-6 or null) */
  playingLine?: number | null;
  /** Line+Complement partition phase */
  partitionPhase?: "line" | "complement" | null;
  /** Which line index is being partitioned */
  partitionLineIndex?: number;
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

function pointColor(lv: number, activeLevels: MiniFanoChordProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

export const MiniFanoChord = React.memo(function MiniFanoChord({
  hoveredLine,
  onLineHover,
  onNodeClick,
  onLineClick,
  activeLevels,
  playingLevel,
  playingLine,
  partitionPhase,
  partitionLineIndex,
}: MiniFanoChordProps) {
  const anyHovered = hoveredLine !== null;
  const playingLineLevels = playingLine != null ? FANO_LINES[playingLine] : null;
  const partitionLine = partitionPhase != null && partitionLineIndex != null ? FANO_LINES[partitionLineIndex] : null;
  const partitionActive = partitionPhase != null;

  return (
    <svg
      viewBox={`0 0 ${FANO_VIEWBOX_WIDTH} ${FANO_VIEWBOX_HEIGHT}`}
      style={{ width: "100%", maxWidth: 220, aspectRatio: `${FANO_VIEWBOX_WIDTH}/${FANO_VIEWBOX_HEIGHT}` }}
    >
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
      {FANO_LINES.map((_, i) => {
        const isHovered = hoveredLine === i;
        const isPlayingLine = playingLine === i;
        const isPartitionLine = partitionActive && partitionLineIndex === i;
        const active = isHovered || isPlayingLine || isPartitionLine;
        const opacity = anyHovered ? (isHovered ? 1 : 0.2) : isPlayingLine || isPartitionLine ? 1 : partitionActive ? 0.2 : 0.5;
        const sw = active ? 3 : 1.5;
        const d = fanoLineSvgPath(i);
        const color = pointColor(FANO_LINE_DUAL_POINTS[i], activeLevels);

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
              onClick={() => onLineClick?.(i)}
            />
            {/* Visible line */}
            <path d={d} fill="none" stroke={color} strokeWidth={sw} opacity={opacity} strokeLinecap="round" pointerEvents="none" />
          </g>
        );
      })}

      {/* Points */}
      {[1, 2, 3, 4, 5, 6, 7].map((lv) => {
        const [px, py] = FANO_POINT_POSITIONS[lv];
        const isOnHoveredLine = hoveredLine !== null && FANO_LINES[hoveredLine].includes(lv);
        const isPlaying = playingLevel === lv || (playingLineLevels !== null && playingLineLevels.includes(lv));
        const isOnPartitionLine = partitionLine !== null && partitionLine.includes(lv);
        const isPartitionHighlighted =
          partitionActive && ((partitionPhase === "line" && isOnPartitionLine) || (partitionPhase === "complement" && !isOnPartitionLine));
        const highlighted = isOnHoveredLine || isPlaying || isPartitionHighlighted;
        const r = highlighted ? 10 : 8;
        const col = pointColor(lv, activeLevels);
        const dimmed =
          (anyHovered && !isOnHoveredLine) ||
          (isPlaying === false && (playingLevel !== null || playingLineLevels !== null) && !anyHovered) ||
          (partitionActive && !isPartitionHighlighted);
        // Dark text for bright levels (G, C, Y, W), white for dark levels (B, R, M)
        const textColor = lv >= 4 ? "#000" : "#fff";

        return (
          <g
            key={lv}
            filter={highlighted ? "url(#fano-glow)" : undefined}
            style={{ cursor: onNodeClick ? "pointer" : undefined }}
            onClick={() => onNodeClick?.(lv)}
          >
            <circle cx={px} cy={py} r={r} fill={col} stroke="#fff" strokeWidth={isPlaying ? 2 : 1} opacity={dimmed ? 0.3 : 1} />
            <text x={px} y={py + 3} fontSize={9} fill={textColor} textAnchor="middle" pointerEvents="none" opacity={dimmed ? 0.3 : 1}>
              {lv}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

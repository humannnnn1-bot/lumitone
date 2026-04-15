import React from "react";
import { C, R } from "../../tokens";
import { FANO_LINES } from "../theory/theory-data";

interface FanoRhythmGridProps {
  playing: boolean;
  currentBeat: number; // 0-6
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

// Line i has onsets at positions [(0+i)%7, (1+i)%7, (3+i)%7]
const FANO_RHYTHM_PATTERNS: number[][] = Array.from({ length: 7 }, (_, i) => [(0 + i) % 7, (1 + i) % 7, (3 + i) % 7]);

const CELL = 18;
const GAP = 2;
const LABEL_W = 26;
const HEADER_H = 14;
const COLS = 7;
const ROWS = 7;
const W = 170;
const H = 160;

function lineColor(lineIdx: number, activeLevels: FanoRhythmGridProps["activeLevels"]): string {
  const firstLv = FANO_LINES[lineIdx][0];
  const found = activeLevels.find((l) => l.lv === firstLv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[firstLv] ?? "#888";
}

export const FanoRhythmGrid = React.memo(function FanoRhythmGrid({ playing, currentBeat, activeLevels }: FanoRhythmGridProps) {
  const gridX = LABEL_W;
  const gridY = HEADER_H;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, aspectRatio: `${W}/${H}`, borderRadius: R.md, border: `1px solid ${C.border}` }}
    >
      <rect width={W} height={H} fill={C.bgPanel} rx={R.md} />

      <defs>
        <filter id="frg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Column headers */}
      {Array.from({ length: COLS }, (_, col) => (
        <text
          key={`h${col}`}
          x={gridX + col * (CELL + GAP) + CELL / 2}
          y={HEADER_H - 3}
          fontSize={8}
          fill={C.textDimmer}
          textAnchor="middle"
        >
          {col}
        </text>
      ))}

      {/* Row labels */}
      {Array.from({ length: ROWS }, (_, row) => (
        <text
          key={`r${row}`}
          x={LABEL_W - 3}
          y={gridY + row * (CELL + GAP) + CELL / 2 + 3}
          fontSize={7}
          fill={C.textDimmer}
          textAnchor="end"
        >
          {FANO_LINES[row].join("-")}
        </text>
      ))}

      {/* Beat highlight column */}
      {playing && (
        <rect
          x={gridX + currentBeat * (CELL + GAP) - 1}
          y={gridY - 1}
          width={CELL + 2}
          height={ROWS * (CELL + GAP)}
          fill={C.accent}
          opacity={0.15}
          rx={2}
        />
      )}

      {/* Grid cells */}
      {Array.from({ length: ROWS }, (_, row) => {
        const onsets = FANO_RHYTHM_PATTERNS[row];
        const color = lineColor(row, activeLevels);

        return Array.from({ length: COLS }, (_, col) => {
          const isOnset = onsets.includes(col);
          const cx = gridX + col * (CELL + GAP);
          const cy = gridY + row * (CELL + GAP);
          const isCurrent = playing && col === currentBeat;
          const isActivePulse = isOnset && isCurrent;

          if (isOnset) {
            return (
              <rect
                key={`${row}-${col}`}
                x={cx}
                y={cy}
                width={CELL}
                height={CELL}
                rx={2}
                fill={color}
                opacity={isActivePulse ? 1 : playing ? 0.4 : 0.4}
                filter={isActivePulse ? "url(#frg-glow)" : undefined}
              />
            );
          }

          return (
            <rect
              key={`${row}-${col}`}
              x={cx}
              y={cy}
              width={CELL}
              height={CELL}
              rx={2}
              fill="transparent"
              stroke={C.border}
              strokeWidth={0.5}
            />
          );
        });
      })}
    </svg>
  );
});

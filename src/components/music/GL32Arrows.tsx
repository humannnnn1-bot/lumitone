import React from "react";
import { C, R } from "../../tokens";

interface GL32ArrowsProps {
  perm: number[]; // current permutation [0,1,2,3,4,5,6,7] or permuted
  activeLevels: { lv: number; rgb: [number, number, number] }[];
  flash?: boolean; // true for ~500ms after a transform is applied
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

const LEVELS = [1, 2, 3, 4, 5, 6, 7];
const CR = 7;
const Y_TOP = 20;
const Y_BOT = 80;
const X_START = 16;
const X_GAP = 22;

function lvColor(lv: number, activeLevels: GL32ArrowsProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function isIdentity(perm: number[]): boolean {
  return LEVELS.every((lv) => perm[lv] === lv);
}

export const GL32Arrows = React.memo(function GL32Arrows({ perm, activeLevels, flash }: GL32ArrowsProps) {
  const identity = isIdentity(perm);

  // Build bottom row positions: perm[i] goes to position where it appears
  const bottomValues = LEVELS.map((lv) => perm[lv] ?? lv);

  return (
    <svg
      viewBox="0 0 180 100"
      style={{ width: "100%", maxWidth: 180, aspectRatio: "180/100", borderRadius: R.md, border: `1px solid ${C.border}` }}
    >
      <rect width={180} height={100} fill={C.bgPanel} rx={R.md} />

      <defs>
        <marker id="gl-arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4 Z" fill={C.textDimmer} />
        </marker>
        <marker id="gl-arrow-flash" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4 Z" fill="#fff" />
        </marker>
        <filter id="gl-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Identity label */}
      {identity && (
        <text x={170} y={52} fontSize={9} fill={C.accent} textAnchor="end" fontStyle="italic">
          e
        </text>
      )}

      {/* Arrows from top[i] to bottom position */}
      {LEVELS.map((lv, i) => {
        const topX = X_START + i * X_GAP;
        const permVal = perm[lv] ?? lv;

        // Find position in bottom row where permVal landed
        const botIdx = i; // bottom row shows perm[1..7] in order
        const botX = X_START + botIdx * X_GAP;
        const color = lvColor(lv, activeLevels);
        const moved = permVal !== lv;
        const isFlashing = flash && moved;

        if (!moved) {
          // Fixed point: small dot indicator
          return (
            <line
              key={`a${lv}`}
              x1={topX}
              y1={Y_TOP + CR + 2}
              x2={botX}
              y2={Y_BOT - CR - 2}
              stroke={color}
              strokeWidth={1}
              opacity={flash ? 0.2 : 0.5}
              strokeDasharray="2,2"
            />
          );
        }

        // Curved arrow
        const midX = (topX + botX) / 2;
        const curveOffset = (botIdx - i) * 3;
        const cpX = midX + curveOffset;
        const cpY = 50;

        return (
          <path
            key={`a${lv}`}
            d={`M${topX},${Y_TOP + CR + 2} Q${cpX},${cpY} ${botX},${Y_BOT - CR - 2}`}
            fill="none"
            stroke={isFlashing ? "#fff" : color}
            strokeWidth={isFlashing ? 2 : 1.2}
            opacity={isFlashing ? 1 : 0.7}
            markerEnd={isFlashing ? "url(#gl-arrow-flash)" : "url(#gl-arrow)"}
            filter={isFlashing ? "url(#gl-glow)" : undefined}
            style={{ transition: "stroke 0.3s, opacity 0.3s, stroke-width 0.3s" }}
          />
        );
      })}

      {/* Top row: identity order */}
      {LEVELS.map((lv, i) => {
        const x = X_START + i * X_GAP;
        const color = lvColor(lv, activeLevels);
        return (
          <g key={`t${lv}`}>
            <circle cx={x} cy={Y_TOP} r={CR} fill={color} stroke="#fff" strokeWidth={0.5} />
            <text x={x} y={Y_TOP + 2.5} fontSize={7} fill="#fff" textAnchor="middle" pointerEvents="none">
              {lv}
            </text>
          </g>
        );
      })}

      {/* Bottom row: permuted order */}
      {LEVELS.map((lv, i) => {
        const x = X_START + i * X_GAP;
        const val = bottomValues[i];
        const color = lvColor(val, activeLevels);
        const moved = val !== i + 1;
        const isFlashing = flash && moved;
        return (
          <g key={`b${lv}`} filter={isFlashing ? "url(#gl-glow)" : undefined}>
            <circle
              cx={x}
              cy={Y_BOT}
              r={isFlashing ? 8 : CR}
              fill={color}
              stroke="#fff"
              strokeWidth={isFlashing ? 1.5 : 0.5}
              style={{ transition: "r 0.3s" }}
            />
            <text x={x} y={Y_BOT + 2.5} fontSize={7} fill="#fff" textAnchor="middle" pointerEvents="none">
              {val}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

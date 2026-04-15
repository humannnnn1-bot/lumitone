import React from "react";
import { C } from "../../tokens";

interface SyndromeTimelineProps {
  phase: "original" | "corrupted" | "syndrome" | "corrected" | null;
  errorPos: number;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

const CIRCLE_R = 10;
const Y_CENTER = 30;
const X_START = 20;
const X_STEP = 26;

const PARITY_LABELS = ["P1", "P2", "P4"];
const PARITY_COLORS = ["#0000ff", "#ff0000", "#00ff00"];

function pointColor(lv: number, activeLevels: SyndromeTimelineProps["activeLevels"]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function circleX(pos: number): number {
  return X_START + (pos - 1) * X_STEP;
}

export const SyndromeTimeline = React.memo(function SyndromeTimeline({ phase, errorPos, activeLevels }: SyndromeTimelineProps) {
  const phaseLabel =
    phase === "original"
      ? "Original"
      : phase === "corrupted"
        ? "Corrupted"
        : phase === "syndrome"
          ? "Syndrome"
          : phase === "corrected"
            ? "Corrected"
            : "";

  // Syndrome bits: errorPos in binary (bit 0 = P1, bit 1 = P2, bit 2 = P4)
  const syndromeBits = [(errorPos & 1) !== 0, (errorPos & 2) !== 0, (errorPos & 4) !== 0];

  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", aspectRatio: "200/120" }}>
      <defs>
        <filter id="st-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        @keyframes st-flash {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        .st-flash { animation: st-flash 0.5s ease-in-out infinite; }
      `}</style>

      {/* Circles */}
      {[1, 2, 3, 4, 5, 6, 7].map((pos) => {
        const cx = circleX(pos);
        const isError = pos === errorPos;
        const col = pointColor(pos, activeLevels);

        let fill: string = C.bgSurface;
        let stroke: string = C.border;
        let opacity = 0.4;
        let icon: React.ReactNode = null;

        if (phase === null) {
          fill = col;
          opacity = 0.3;
        } else if (phase === "original") {
          fill = col;
          opacity = 1;
          icon = (
            <text x={cx} y={Y_CENTER + 4} fontSize={10} fill="#fff" textAnchor="middle">
              &#10003;
            </text>
          );
        } else if (phase === "corrupted") {
          if (isError) {
            fill = "#ff2020";
            stroke = "#ff4040";
            opacity = 1;
            icon = (
              <text x={cx} y={Y_CENTER + 4} fontSize={10} fill="#fff" textAnchor="middle" fontWeight={700}>
                &#10007;
              </text>
            );
          } else {
            fill = col;
            opacity = 1;
          }
        } else if (phase === "syndrome") {
          if (isError) {
            fill = "#ff2020";
            stroke = "#ff4040";
            opacity = 1;
            icon = (
              <text x={cx} y={Y_CENTER + 4} fontSize={10} fill="#fff" textAnchor="middle" fontWeight={700}>
                &#10007;
              </text>
            );
          } else {
            fill = col;
            opacity = 0.6;
          }
        } else if (phase === "corrected") {
          fill = col;
          opacity = 1;
          icon = (
            <text x={cx} y={Y_CENTER + 4} fontSize={10} fill={C.success} textAnchor="middle">
              &#10003;
            </text>
          );
        }

        return (
          <g key={pos}>
            <circle
              cx={cx}
              cy={Y_CENTER}
              r={CIRCLE_R}
              fill={fill}
              stroke={stroke}
              strokeWidth={1}
              opacity={opacity}
              filter={phase === "corrected" && isError ? "url(#st-glow)" : undefined}
            />
            {icon}
            {/* Position label */}
            <text x={cx} y={12} fontSize={7} fill={C.textDimmer} textAnchor="middle">
              {pos}
            </text>
          </g>
        );
      })}

      {/* Syndrome indicators (below circles) */}
      {phase === "syndrome" && (
        <g>
          {/* Indicator dots */}
          {syndromeBits.map((set, i) => {
            const dotX = 70 + i * 20;
            const dotY = 65;
            return (
              <g key={i}>
                <circle
                  className={set ? "st-flash" : undefined}
                  cx={dotX}
                  cy={dotY}
                  r={5}
                  fill={set ? PARITY_COLORS[i] : C.bgSurface}
                  stroke={set ? PARITY_COLORS[i] : C.border}
                  strokeWidth={1}
                  opacity={set ? 1 : 0.3}
                />
                <text x={dotX} y={dotY + 14} fontSize={6} fill={set ? PARITY_COLORS[i] : C.textDimmer} textAnchor="middle">
                  {PARITY_LABELS[i]}
                </text>
              </g>
            );
          })}

          {/* Arrow from indicators to error position */}
          <line
            x1={90}
            x2={circleX(errorPos)}
            y1={56}
            y2={Y_CENTER + CIRCLE_R + 4}
            stroke={C.error}
            strokeWidth={1.5}
            markerEnd="url(#st-arrow)"
            opacity={0.8}
          />
          <defs>
            <marker id="st-arrow" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
              <path d="M0,0 L6,3 L0,6 Z" fill={C.error} />
            </marker>
          </defs>
        </g>
      )}

      {/* Phase label */}
      <text x={100} y={110} fontSize={10} fill={C.textSecondary} textAnchor="middle">
        {phaseLabel}
      </text>
    </svg>
  );
});

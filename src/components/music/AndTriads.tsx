import React from "react";
import { C, FS, FW } from "../../tokens";

const TRIADS: [number, number, number][] = [
  [3, 5, 1],
  [5, 6, 4],
  [6, 3, 2],
];

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];
const ROW_Y = [26, 58, 90];

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function textColor(lv: number): string {
  return lv >= 4 ? "#000" : "#fff";
}

interface Props {
  activeStep: { pairIndex: number; phase: "operands" | "result" } | null;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

export const AndTriads = React.memo(function AndTriads({ activeStep, activeLevels }: Props) {
  return (
    <svg viewBox="0 0 180 118" style={{ width: "100%", maxWidth: 180 }}>
      <defs>
        <filter id="and-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {TRIADS.map(([a, b, r], i) => {
        const y = ROW_Y[i];
        const active = activeStep?.pairIndex === i;
        const phase = activeStep?.phase ?? null;
        const dimmed = activeStep !== null && !active;
        const opacity = dimmed ? 0.25 : 1;
        const operandGlow = active && phase === "operands";
        const resultGlow = active && phase === "result";

        return (
          <g key={`${a}-${b}-${r}`} opacity={opacity}>
            <circle
              cx={24}
              cy={y}
              r={operandGlow ? 11 : 9}
              fill={pointColor(a, activeLevels)}
              stroke="#fff"
              strokeWidth={operandGlow ? 2 : 1}
              filter={operandGlow ? "url(#and-glow)" : undefined}
            />
            <text x={24} y={y + 3.5} fontSize={FS.xs} fontWeight={FW.bold} fill={textColor(a)} textAnchor="middle">
              {a}
            </text>

            <text x={47} y={y + 3} fontSize={FS.sm} fill={C.textDim}>
              ∧
            </text>

            <circle
              cx={68}
              cy={y}
              r={operandGlow ? 11 : 9}
              fill={pointColor(b, activeLevels)}
              stroke="#fff"
              strokeWidth={operandGlow ? 2 : 1}
              filter={operandGlow ? "url(#and-glow)" : undefined}
            />
            <text x={68} y={y + 3.5} fontSize={FS.xs} fontWeight={FW.bold} fill={textColor(b)} textAnchor="middle">
              {b}
            </text>

            <text x={96} y={y + 3} fontSize={FS.sm} fill={C.textDim}>
              =
            </text>

            <circle
              cx={118}
              cy={y}
              r={resultGlow ? 11 : 9}
              fill={pointColor(r, activeLevels)}
              stroke="#fff"
              strokeWidth={resultGlow ? 2 : 1}
              filter={resultGlow ? "url(#and-glow)" : undefined}
            />
            <text x={118} y={y + 3.5} fontSize={FS.xs} fontWeight={FW.bold} fill={textColor(r)} textAnchor="middle">
              {r}
            </text>

            <text x={176} y={y + 3} textAnchor="end" fontSize={7} fontFamily="monospace" fill={C.textDimmer}>
              {a}∧{b}={r}
            </text>
          </g>
        );
      })}

      <text x={90} y={115} textAnchor="middle" fontSize={7} fontFamily="monospace" fill={C.textDimmer}>
        a∨b=7 ⇒ a+b−7 = a∧b
      </text>
    </svg>
  );
});

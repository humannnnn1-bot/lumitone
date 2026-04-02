import React from "react";
import { C, FS, FW } from "../../tokens";

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];
const LUMA = [0, 29, 76, 105, 150, 179, 226, 255];
const PATH = [2, 6, 4, 5, 1, 3]; // R -> Y -> G -> C -> B -> M
const NAMES = ["", "B", "R", "M", "G", "C", "Y"];
const SEG_CHANNELS = ["G", "R", "B", "G", "R", "B"];
const CH_COLORS: Record<string, string> = { G: "#00cc00", R: "#cc0000", B: "#4466ff" };

const W = 180,
  H = 100;
const ML = 24,
  MR = 8,
  MT = 12,
  MB = 16;
const PW = W - ML - MR,
  PH = H - MT - MB;

const xPos = (i: number) => ML + (i / (PATH.length - 1)) * PW;
const yPos = (luma: number) => MT + PH - (luma / 255) * PH;

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const al = activeLevels.find((a) => a.lv === lv);
  return al ? `rgb(${al.rgb.join(",")})` : LV_COLORS[lv];
}

interface Props {
  currentStep: number | null;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

export const ZigzagGraph = React.memo(function ZigzagGraph({ currentStep, activeLevels }: Props) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }}>
      <defs>
        <filter id="zg-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Y-axis midline (127.5) */}
      <line
        x1={ML}
        y1={yPos(127.5)}
        x2={W - MR}
        y2={yPos(127.5)}
        stroke={C.textDimmer}
        strokeWidth={0.5}
        strokeDasharray="3,2"
        opacity={0.4}
      />
      {/* Segments with channel-colored lines */}
      {PATH.slice(0, -1).map((lv, i) => {
        const nextLv = PATH[i + 1];
        const x0 = xPos(i),
          y0 = yPos(LUMA[lv]);
        const x1 = xPos(i + 1),
          y1 = yPos(LUMA[nextLv]);
        const ch = SEG_CHANNELS[i];
        const delta = LUMA[nextLv] - LUMA[lv];
        const isActive = currentStep === i || currentStep === i + 1;
        return (
          <g key={i}>
            <line
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke={CH_COLORS[ch]}
              strokeWidth={isActive ? 2.5 : 1.5}
              opacity={isActive ? 0.9 : 0.5}
            />
            <text
              x={(x0 + x1) / 2}
              y={(y0 + y1) / 2 + (delta > 0 ? -5 : 8)}
              textAnchor="middle"
              fontSize={7}
              fontFamily="monospace"
              fontWeight={FW.bold}
              fill={CH_COLORS[ch]}
              opacity={isActive ? 1 : 0.5}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </text>
          </g>
        );
      })}
      {/* Vertices */}
      {PATH.map((lv, i) => {
        const x = xPos(i),
          y = yPos(LUMA[lv]);
        const isActive = currentStep === i;
        return (
          <g key={lv} filter={isActive ? "url(#zg-glow)" : undefined}>
            <circle
              cx={x}
              cy={y}
              r={isActive ? 6 : 4}
              fill={pointColor(lv, activeLevels)}
              fillOpacity={0.85}
              stroke="#fff"
              strokeWidth={isActive ? 2 : 1}
            />
            <text x={x} y={y - 8} textAnchor="middle" fontSize={FS.xxs} fontFamily="monospace" fill={LV_COLORS[lv]} opacity={0.8}>
              {NAMES[lv]}
            </text>
          </g>
        );
      })}
      {/* Y-axis luma labels */}
      <text x={ML - 3} y={yPos(0)} textAnchor="end" dominantBaseline="central" fontSize={6} fontFamily="monospace" fill={C.textDimmer}>
        0
      </text>
      <text x={ML - 3} y={yPos(255)} textAnchor="end" dominantBaseline="central" fontSize={6} fontFamily="monospace" fill={C.textDimmer}>
        255
      </text>
    </svg>
  );
});

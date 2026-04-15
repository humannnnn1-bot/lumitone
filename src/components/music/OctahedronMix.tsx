import React from "react";
import { C, FS, FW } from "../../tokens";
import { useTranslation } from "../../i18n";
import { OCTA_EDGES } from "../theory/theory-data";

const PTS: Record<number, [number, number]> = {
  2: [90, 16],
  6: [136, 50],
  4: [136, 108],
  5: [90, 142],
  1: [44, 108],
  3: [44, 50],
};

const LV_COLORS = ["#000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#fff"];

function pointColor(lv: number, activeLevels: { lv: number; rgb: [number, number, number] }[]): string {
  const found = activeLevels.find((l) => l.lv === lv);
  if (found) return `rgb(${found.rgb.join(",")})`;
  return LV_COLORS[lv] ?? "#888";
}

function textColor(lv: number): string {
  return lv >= 4 ? "#000" : "#fff";
}

function isSameEdge(a: number, b: number, x: number, y: number): boolean {
  return (a === x && b === y) || (a === y && b === x);
}

interface Props {
  lvA: number | null;
  lvB: number | null;
  phase: "pair" | "result" | null;
  activeLevels: { lv: number; rgb: [number, number, number] }[];
}

export const OctahedronMix = React.memo(function OctahedronMix({ lvA, lvB, phase, activeLevels }: Props) {
  const { t } = useTranslation();
  const xorResult = lvA != null && lvB != null ? lvA ^ lvB : null;
  const valid = lvA != null && lvB != null && lvA !== lvB && xorResult !== null && xorResult >= 1 && xorResult <= 6;

  return (
    <svg viewBox="0 0 180 168" style={{ width: "100%", maxWidth: 180 }}>
      <defs>
        <filter id="octa-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {OCTA_EDGES.map(([a, b], i) => {
        const selected = valid && lvA != null && lvB != null && isSameEdge(a, b, lvA, lvB);
        return (
          <line
            key={`${a}-${b}-${i}`}
            x1={PTS[a][0]}
            y1={PTS[a][1]}
            x2={PTS[b][0]}
            y2={PTS[b][1]}
            stroke={selected ? pointColor(xorResult!, activeLevels) : "rgba(255,255,255,0.18)"}
            strokeWidth={selected ? 2.5 : 1}
            opacity={selected ? 1 : 0.6}
          />
        );
      })}

      {[1, 2, 3, 4, 5, 6].map((lv) => {
        const [x, y] = PTS[lv];
        const isOperand = valid && (lv === lvA || lv === lvB);
        const isResult = valid && phase === "result" && lv === xorResult;

        return (
          <g key={lv} filter={isOperand || isResult ? "url(#octa-glow)" : undefined}>
            {isResult && <circle cx={x} cy={y} r={13} fill="none" stroke={pointColor(lv, activeLevels)} strokeWidth={2} opacity={0.8} />}
            <circle
              cx={x}
              cy={y}
              r={isOperand || isResult ? 10 : 8}
              fill={pointColor(lv, activeLevels)}
              stroke="#fff"
              strokeWidth={isOperand || isResult ? 1.8 : 1}
            />
            <text x={x} y={y + 3.5} fontSize={FS.xs} fontWeight={FW.bold} fill={textColor(lv)} textAnchor="middle">
              {lv}
            </text>
          </g>
        );
      })}

      <text x={90} y={162} textAnchor="middle" fontSize={8} fontFamily="monospace" fill={C.textDimmer}>
        {valid && xorResult !== null ? `${lvA}⊕${lvB}=${xorResult}` : t("music_octa_hint_invalid")}
      </text>
    </svg>
  );
});

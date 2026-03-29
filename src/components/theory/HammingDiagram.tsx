import React, { useCallback } from "react";
import { THEORY_LEVELS } from "./theory-data";
import { C, FS, FW } from "../../tokens";
import { useTranslation } from "../../i18n";

const W = 340,
  H = 200;

// Parity check groups: each parity bit checks specific positions
const PARITY_GROUPS: { parity: number; checks: number[]; label: string }[] = [
  { parity: 1, checks: [1, 3, 5, 7], label: "P1 (B)" },
  { parity: 2, checks: [2, 3, 6, 7], label: "P2 (R)" },
  { parity: 4, checks: [4, 5, 6, 7], label: "P4 (G)" },
];

const DOT_R = 12;
const ROW_Y = [50, 100, 150];
const DATA_X = [80, 140, 200, 260]; // Positions for 4 data bits per row

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const HammingDiagram = React.memo(function HammingDiagram({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const enter = useCallback((lv: number) => onHover(lv), [onHover]);
  const leave = useCallback(() => onHover(null), [onHover]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_hamming_title")}>
      {/* Header */}
      <text x={30} y={22} textAnchor="middle" fontSize={FS.sm} fill={C.accentBright} fontFamily="monospace" fontWeight={FW.bold}>
        {t("theory_hamming_parity")}
      </text>
      <text x={170} y={22} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
        {t("theory_hamming_checks")}
      </text>

      {PARITY_GROUPS.map((pg, gi) => {
        const y = ROW_Y[gi];
        const parityInfo = THEORY_LEVELS[pg.parity];
        const parityActive = hlLevel === pg.parity;
        const anyHl = hlLevel !== null;
        const groupContainsHl = hlLevel !== null && pg.checks.includes(hlLevel);

        return (
          <g key={"pg" + gi}>
            {/* Connecting lines from parity to checked positions */}
            {pg.checks.map((lv, ci) => {
              const isHl = hlLevel === lv;
              return (
                <line
                  key={"ln" + ci}
                  x1={50}
                  y1={y}
                  x2={DATA_X[ci]}
                  y2={y}
                  stroke={parityInfo.color}
                  strokeWidth={isHl || parityActive ? 1.5 : 0.8}
                  opacity={anyHl ? (isHl || parityActive || groupContainsHl ? 0.5 : 0.08) : 0.2}
                />
              );
            })}

            {/* Parity bit (left) */}
            <g onMouseEnter={() => enter(pg.parity)} onMouseLeave={leave} style={{ cursor: "pointer" }}>
              <circle cx={30} cy={y} r={DOT_R + 4} fill="transparent" />
              <circle
                cx={30}
                cy={y}
                r={DOT_R}
                fill={parityInfo.color}
                fillOpacity={parityActive ? 0.9 : 0.7}
                stroke={parityActive ? "#fff" : parityInfo.color}
                strokeWidth={parityActive ? 2.5 : 1}
              />
              <text
                x={30}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fontWeight={900}
                fontFamily="monospace"
                fill="#fff"
              >
                {pg.parity}
              </text>
              <text
                x={30}
                y={y + DOT_R + 10}
                textAnchor="middle"
                fontSize={FS.xs}
                fontFamily="monospace"
                fill={parityInfo.color}
                opacity={0.7}
              >
                {pg.label}
              </text>
            </g>

            {/* Checked positions (right) */}
            {pg.checks.map((lv, ci) => {
              const info = THEORY_LEVELS[lv];
              const isHl = hlLevel === lv;
              const dim = anyHl && !isHl && !parityActive && !groupContainsHl;
              const isParity = lv === pg.parity;
              return (
                <g key={"cd" + ci} onMouseEnter={() => enter(lv)} onMouseLeave={leave} style={{ cursor: "pointer" }}>
                  <circle cx={DATA_X[ci]} cy={y} r={DOT_R + 4} fill="transparent" />
                  <circle
                    cx={DATA_X[ci]}
                    cy={y}
                    r={DOT_R - (isParity ? 0 : 2)}
                    fill={info.color}
                    fillOpacity={dim ? 0.15 : 0.8}
                    stroke={isHl ? "#fff" : info.color}
                    strokeWidth={isHl ? 2 : isParity ? 1.5 : 1}
                    strokeDasharray={isParity ? "3,2" : undefined}
                    opacity={dim ? 0.3 : 1}
                  />
                  <text
                    x={DATA_X[ci]}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isParity ? FS.md : FS.sm}
                    fontWeight={FW.bold}
                    fontFamily="monospace"
                    fill={lv >= 4 ? "#000" : "#fff"}
                    opacity={dim ? 0.3 : 1}
                  >
                    {lv}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});

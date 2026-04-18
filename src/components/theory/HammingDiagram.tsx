import React, { useCallback, useState, useEffect, useRef } from "react";
import { THEORY_LEVELS } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN_SM } from "../../styles";
import { useTranslation } from "../../i18n";

const W = 340,
  H = 215;

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
  const [errorPosition, setErrorPosition] = useState<number | null>(null);
  const [corrected, setCorrected] = useState(false);
  const correctedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enter = useCallback((lv: number) => onHover(lv), [onHover]);
  const leave = useCallback(() => onHover(null), [onHover]);

  // Reset corrected state when the injected error position changes
  useEffect(() => {
    setCorrected(false);
    return () => clearTimeout(correctedTimerRef.current);
  }, [errorPosition]);

  const handleCorrect = useCallback(() => {
    setCorrected(true);
    correctedTimerRef.current = setTimeout(() => {
      setErrorPosition(null);
      setCorrected(false);
    }, 1200);
  }, []);

  // The demo injects a single position error, so the syndrome is that position in binary.
  const syndrome = corrected ? 0 : errorPosition !== null ? errorPosition : 0;
  const parityResults = PARITY_GROUPS.map((pg) => ({
    ...pg,
    failed: (syndrome & pg.parity) !== 0,
  }));

  const handleFlip = useCallback((lv: number) => {
    setErrorPosition((prev) => (prev === lv ? null : lv));
  }, []);

  // Hamming role table data (positions 1-7)
  const roles = THEORY_LEVELS.slice(1); // exclude Black (0)

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      {/* Role reference table */}
      <svg viewBox="0 0 340 34" style={{ width: "100%", maxWidth: 340 }}>
        {roles.map((lv, i) => {
          const x = 24 + i * 44;
          const isParity = lv.hamming.startsWith("P");
          return (
            <g
              key={lv.lv}
              data-testid={`hamming-position-${lv.lv}`}
              onMouseEnter={() => enter(lv.lv)}
              onMouseLeave={leave}
              onClick={() => handleFlip(lv.lv)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={x}
                cy={12}
                r={9}
                fill={lv.color}
                fillOpacity={0.8}
                stroke={errorPosition === lv.lv ? C.error : isParity ? C.accentBright : "transparent"}
                strokeWidth={errorPosition === lv.lv ? 2 : 1.5}
              />
              <text
                x={x}
                y={12}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xs}
                fontWeight={FW.bold}
                fontFamily="monospace"
                fill={lv.lv >= 4 ? "#000" : "#fff"}
              >
                {lv.lv}
              </text>
              <text
                x={x}
                y={28}
                textAnchor="middle"
                fontSize={FS.xxs}
                fontFamily="monospace"
                fill={isParity ? C.accentBright : C.textDimmer}
              >
                {lv.hamming}
              </text>
            </g>
          );
        })}
      </svg>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_hamming_title")}>
        {/* Header */}
        <text x={30} y={22} textAnchor="middle" fontSize={FS.sm} fill={C.accentBright} fontFamily="monospace" fontWeight={FW.bold}>
          {t("theory_hamming_parity")}
        </text>
        <text x={170} y={22} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
          {t("theory_hamming_checks")}
        </text>

        {parityResults.map((pg, gi) => {
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
              <g
                onMouseEnter={() => enter(pg.parity)}
                onMouseLeave={leave}
                onClick={() => handleFlip(pg.parity)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={30} cy={y} r={DOT_R + 4} fill="transparent" />
                <circle
                  cx={30}
                  cy={y}
                  r={DOT_R}
                  fill={parityInfo.color}
                  fillOpacity={parityActive ? 0.9 : 0.7}
                  stroke={parityActive ? "#fff" : pg.failed ? C.error : parityInfo.color}
                  strokeWidth={parityActive ? 2.5 : pg.failed ? 2.5 : 1}
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
                  fill={pg.failed ? C.error : parityInfo.color}
                  opacity={0.7}
                >
                  {pg.label}
                </text>
                {/* Parity check result indicator — badge */}
                {errorPosition !== null && (
                  <g>
                    <circle cx={8} cy={y} r={6} fill={pg.failed ? C.error : C.success} />
                    <text
                      x={8}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={FS.sm}
                      fontFamily="monospace"
                      fontWeight={FW.bold}
                      fill="#fff"
                    >
                      {pg.failed ? "\u2717" : "\u2713"}
                    </text>
                  </g>
                )}
              </g>

              {/* Checked positions (right) */}
              {pg.checks.map((lv, ci) => {
                const info = THEORY_LEVELS[lv];
                const isHl = hlLevel === lv;
                const dim = anyHl && !isHl && !parityActive && !groupContainsHl;
                const isParity = lv === pg.parity;
                const isErrored = errorPosition === lv;
                return (
                  <g
                    key={"cd" + ci}
                    onMouseEnter={() => enter(lv)}
                    onMouseLeave={leave}
                    onClick={() => handleFlip(lv)}
                    style={{ cursor: "pointer" }}
                  >
                    <circle cx={DATA_X[ci]} cy={y} r={DOT_R + 4} fill="transparent" />
                    <circle
                      cx={DATA_X[ci]}
                      cy={y}
                      r={DOT_R - (isParity ? 0 : 2)}
                      fill={info.color}
                      fillOpacity={dim ? 0.15 : 0.8}
                      stroke={isErrored ? C.error : isHl ? "#fff" : info.color}
                      strokeWidth={isErrored ? 2.5 : isHl ? 2 : isParity ? 1.5 : 1}
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

        {/* Error detection result */}
        {errorPosition !== null && (
          <g>
            <text
              x={W / 2}
              y={188}
              textAnchor="middle"
              fontSize={FS.md}
              fontFamily="monospace"
              fontWeight={FW.bold}
              fill={corrected ? C.success : C.error}
            >
              {corrected
                ? t("theory_hamming_corrected", `${errorPosition} (${THEORY_LEVELS[errorPosition].name})`)
                : t("theory_hamming_error", `${syndrome} (${THEORY_LEVELS[syndrome].name})`)}
            </text>
            <text
              data-testid="hamming-syndrome"
              x={W / 2}
              y={204}
              textAnchor="middle"
              fontSize={FS.xs}
              fontFamily="monospace"
              fill={C.textDimmer}
            >
              {"syndrome = "}
              {[4, 2, 1].map((parity) => {
                const bit = (syndrome >> Math.log2(parity)) & 1;
                const bitActive = hlLevel === parity;
                const parityColor = THEORY_LEVELS[parity].color;
                return (
                  <tspan
                    key={`sb${parity}`}
                    fontWeight={FW.bold}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => enter(parity)}
                    onMouseLeave={leave}
                    fill={bitActive ? "#fff" : bit ? parityColor : C.textDimmer}
                  >
                    {bit}
                  </tspan>
                );
              })}
              {corrected ? " \u2192 corrected" : ""}
            </text>
          </g>
        )}
      </svg>

      <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center", minHeight: 28 }}>
        {errorPosition !== null ? (
          <>
            <button className="theory-annotation" style={S_BTN_SM} onClick={() => setErrorPosition(null)}>
              {t("theory_hamming_reset")} {"\u21ba"}
            </button>
            {!corrected && (
              <button
                className="theory-annotation"
                style={{ ...S_BTN_SM, color: C.success, borderColor: "rgba(64,204,96,0.4)" }}
                onClick={handleCorrect}
              >
                {t("theory_hamming_correct")}
              </button>
            )}
          </>
        ) : (
          <span
            className="theory-annotation"
            style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer, alignSelf: "center" }}
          >
            {t("theory_hamming_flip")}
          </span>
        )}
      </div>
    </div>
  );
});

import React, { useCallback } from "react";
import { THEORY_LEVELS } from "./theory-data";
import { C, FS, FW } from "../../tokens";
import { useTranslation } from "../../i18n";

const SVG_W = 390,
  H = 224;
const ROW_H = 24,
  HEADER_Y = 18;
const COL = { lv: 18, bin: 46, dot: 78, set: 120, g: 170, r: 196, b: 222, wt: 250, hamming: 282, luma: 340 };
const BIT_R = 6;
const CHANNEL_COLORS = ["#00ff00", "#ff0000", "#0000ff"];
const LUMA_VALUES = [0, 29, 76, 105, 150, 179, 226, 255];
const LUMA_MAX = 255;

function setNotation(bits: readonly number[]): string {
  const elems: string[] = [];
  if (bits[0]) elems.push("G");
  if (bits[1]) elems.push("R");
  if (bits[2]) elems.push("B");
  return elems.length === 0 ? "\u2205" : `{${elems.join(", ")}}`;
}

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const BinaryTable = React.memo(function BinaryTable({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const enter = useCallback((lv: number) => onHover(lv), [onHover]);
  const leave = useCallback(() => onHover(null), [onHover]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${H}`}
        className="theory-binary-svg"
        style={{ width: "100%", maxWidth: 480 }}
        role="img"
        aria-label={t("theory_binary_title")}
      >
        {/* Header */}
        <text x={COL.lv} y={HEADER_Y} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
          Lv
        </text>
        <text x={COL.bin} y={HEADER_Y} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
          GRB
        </text>
        <text x={COL.dot} y={HEADER_Y} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
          {t("theory_binary_color")}
        </text>
        {["G", "R", "B"].map((ch, i) => (
          <text
            key={ch}
            x={[COL.g, COL.r, COL.b][i]}
            y={HEADER_Y}
            textAnchor="middle"
            fontSize={FS.lg}
            fill={CHANNEL_COLORS[i]}
            fontFamily="monospace"
            fontWeight={FW.bold}
          >
            {ch}
          </text>
        ))}
        <text x={COL.set} y={HEADER_Y} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
          A
        </text>
        <text x={COL.wt} y={HEADER_Y} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
          Wt
        </text>
        <text
          x={COL.hamming}
          y={HEADER_Y}
          textAnchor="middle"
          fontSize={FS.sm}
          fill={C.textMuted}
          fontFamily="monospace"
          fontWeight={FW.bold}
        >
          Hamming
        </text>
        <text x={COL.luma} y={HEADER_Y} textAnchor="middle" fontSize={FS.sm} fill={C.textMuted} fontFamily="monospace" fontWeight={FW.bold}>
          Luma
        </text>

        {/* Data rows */}
        {THEORY_LEVELS.map((lv, i) => {
          const y = HEADER_Y + (i + 1) * ROW_H;
          const active = hlLevel === lv.lv;
          const dim = hlLevel !== null && !active;
          const opacity = dim ? 0.25 : 1;
          const binStr = lv.bits.join("");
          const lumaW = 40 * (LUMA_VALUES[i] / LUMA_MAX);
          const weight = lv.bits[0] + lv.bits[1] + lv.bits[2];
          return (
            <g
              key={lv.lv}
              onMouseEnter={() => enter(lv.lv)}
              onMouseLeave={leave}
              onClick={() => onHover(lv.lv)}
              style={{ cursor: "pointer" }}
              opacity={opacity}
            >
              <rect x={0} y={y - ROW_H / 2} width={SVG_W} height={ROW_H} fill="transparent" />
              {active && <rect x={2} y={y - ROW_H / 2 + 1} width={SVG_W - 4} height={ROW_H - 2} rx={3} fill="rgba(255,255,255,0.06)" />}
              <text
                x={COL.lv}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fill={C.textMuted}
                fontFamily="monospace"
                fontWeight={FW.bold}
              >
                {lv.lv}
              </text>
              <text
                x={COL.bin}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.sm}
                fill={C.textDimmer}
                fontFamily="monospace"
              >
                {binStr}
              </text>
              <circle
                cx={COL.dot}
                cy={y}
                r={BIT_R + 1}
                fill={lv.lv === 0 ? "none" : lv.color}
                stroke={lv.lv === 0 ? C.textDimmer : lv.color}
                strokeWidth={lv.lv === 0 ? 1 : 0}
                fillOpacity={0.9}
              />
              {lv.bits.map((bit, bi) => (
                <circle
                  key={bi}
                  cx={[COL.g, COL.r, COL.b][bi]}
                  cy={y}
                  r={BIT_R}
                  fill={bit ? CHANNEL_COLORS[bi] : "none"}
                  stroke={CHANNEL_COLORS[bi]}
                  strokeWidth={bit ? 0 : 1}
                  fillOpacity={bit ? 0.6 : 1}
                  opacity={bit ? 1 : 0.3}
                />
              ))}
              <text
                x={COL.set}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.sm}
                fill={C.textDimmer}
                fontFamily="monospace"
              >
                {setNotation(lv.bits)}
              </text>
              <text
                x={COL.wt}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.sm}
                fill={C.textDimmer}
                fontFamily="monospace"
              >
                {weight}
              </text>
              <text
                x={COL.hamming}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.sm}
                fill={lv.hamming.startsWith("P") ? C.accentBright : lv.hamming.startsWith("D") ? C.textMuted : C.textDimmer}
                fontFamily="monospace"
              >
                {lv.hamming}
              </text>
              {/* Luminance bar */}
              <rect
                x={COL.luma - 20}
                y={y - 4}
                width={lumaW}
                height={8}
                rx={2}
                fill={lv.lv === 0 ? C.textDimmer : lv.color}
                fillOpacity={0.8}
              />
              <text
                x={COL.luma + 26}
                y={y}
                textAnchor="start"
                dominantBaseline="central"
                fontSize={FS.xs}
                fill={C.textDimmer}
                fontFamily="monospace"
              >
                {LUMA_VALUES[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <p
        className="theory-annotation"
        style={{ fontSize: FS.md, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}
      >
        {t("theory_binary_luma_formula")}
      </p>
      <p
        className="theory-annotation"
        style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, margin: 0, textAlign: "center" }}
      >
        {t("theory_binary_luma_complement")}
      </p>
    </div>
  );
});

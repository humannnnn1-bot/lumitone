import React, { useState, useRef, useEffect } from "react";
import { THEORY_LEVELS } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { useTranslation } from "../../i18n";
import { CayleyTable } from "./CayleyTable";

const DOT_R = 18;
const CHANNEL_COLORS = ["#00ff00", "#ff0000", "#0000ff"];

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const XorDemo = React.memo(function XorDemo({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [a, setA] = useState(1);
  const [b, setB] = useState(2);
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setCompact(e.contentRect.width < 520);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const result = a ^ b;
  const complementA = a ^ 7;
  const complementB = b ^ 7;

  const infoA = THEORY_LEVELS[a];
  const infoB = THEORY_LEVELS[b];
  const infoR = THEORY_LEVELS[result];

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xl, width: "100%" }}>
      {/* Selectors */}
      <div style={{ display: "flex", gap: compact ? SP.sm : SP["3xl"], alignItems: "center" }}>
        <LevelSelector value={a} onChange={setA} label="A" onHover={onHover} compact={compact} />
        <span style={{ fontSize: compact ? FS.xl : FS["2xl"], fontFamily: "monospace", color: C.textMuted }}>{"\u2295"}</span>
        <LevelSelector value={b} onChange={setB} label="B" onHover={onHover} compact={compact} />
      </div>

      {/* Result visualization */}
      <svg viewBox="0 6 340 74" style={{ width: "100%", maxWidth: 340 }}>
        {/* A */}
        <g transform="translate(50, 40)">
          <circle r={DOT_R} fill={a === 0 ? C.bgRoot : infoA.color} fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
          <text
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={FS.xl}
            fontWeight={900}
            fontFamily="monospace"
            fill={a >= 4 ? "#000" : "#fff"}
          >
            {a}
          </text>
          <text y={DOT_R + 12} textAnchor="middle" fontSize={FS.xs} fontFamily="monospace" fill={C.textDimmer}>
            {infoA.bits.join("")}
          </text>
        </g>

        {/* XOR symbol */}
        <text x={110} y={40} textAnchor="middle" dominantBaseline="central" fontSize={FS["2xl"]} fontFamily="monospace" fill={C.textMuted}>
          {"\u2295"}
        </text>

        {/* B */}
        <g transform="translate(170, 40)">
          <circle r={DOT_R} fill={b === 0 ? C.bgRoot : infoB.color} fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
          <text
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={FS.xl}
            fontWeight={900}
            fontFamily="monospace"
            fill={b >= 4 ? "#000" : "#fff"}
          >
            {b}
          </text>
          <text y={DOT_R + 12} textAnchor="middle" fontSize={FS.xs} fontFamily="monospace" fill={C.textDimmer}>
            {infoB.bits.join("")}
          </text>
        </g>

        {/* Equals */}
        <text x={230} y={40} textAnchor="middle" dominantBaseline="central" fontSize={FS["2xl"]} fontFamily="monospace" fill={C.textMuted}>
          =
        </text>

        {/* Result */}
        <g transform="translate(290, 40)">
          <circle r={DOT_R} fill={result === 0 ? C.bgRoot : infoR.color} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
          <text
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={FS.xl}
            fontWeight={900}
            fontFamily="monospace"
            fill={result >= 4 ? "#000" : "#fff"}
          >
            {result}
          </text>
          <text y={DOT_R + 12} textAnchor="middle" fontSize={FS.xs} fontFamily="monospace" fill={C.textDimmer}>
            {infoR.bits.join("")}
          </text>
        </g>

        {/* Bit-by-bit XOR visualization */}
        {[0, 1, 2].map((bi) => {
          const ax = 50 + (bi - 1) * 10,
            bx = 170 + (bi - 1) * 10;
          const y = -4;
          const bitA = infoA.bits[bi],
            bitB = infoB.bits[bi],
            bitR = infoR.bits[bi];
          const chColor = CHANNEL_COLORS[bi];
          return (
            <g key={"bx" + bi}>
              <circle
                cx={ax}
                cy={y}
                r={3}
                fill={bitA ? chColor : "none"}
                stroke={chColor}
                strokeWidth={bitA ? 0 : 0.8}
                opacity={bitA ? 0.8 : 0.3}
              />
              <circle
                cx={bx}
                cy={y}
                r={3}
                fill={bitB ? chColor : "none"}
                stroke={chColor}
                strokeWidth={bitB ? 0 : 0.8}
                opacity={bitB ? 0.8 : 0.3}
              />
              <circle
                cx={290 + (bi - 1) * 10}
                cy={y}
                r={3}
                fill={bitR ? chColor : "none"}
                stroke={chColor}
                strokeWidth={bitR ? 0 : 0.8}
                opacity={bitR ? 0.8 : 0.3}
              />
            </g>
          );
        })}
      </svg>

      {/* Text summary */}
      <div className="theory-annotation" style={{ fontSize: FS.md, fontFamily: "monospace", color: C.textMuted, textAlign: "center" }}>
        {infoA.name} ({infoA.bits.join("")}) {"\u2295"} {infoB.name} ({infoB.bits.join("")}) = {infoR.name} ({infoR.bits.join("")})
      </div>

      {/* Complement pairs */}
      <div style={{ display: "flex", gap: SP["2xl"], justifyContent: "center", flexWrap: "wrap" }}>
        {a > 0 && a < 7 && (
          <div className="theory-annotation" style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, textAlign: "center" }}>
            {t("theory_xor_complement", infoA.name, THEORY_LEVELS[complementA].name)}
          </div>
        )}
        {b > 0 && b < 7 && b !== a && (
          <div className="theory-annotation" style={{ fontSize: FS.sm, fontFamily: "monospace", color: C.textDimmer, textAlign: "center" }}>
            {t("theory_xor_complement", infoB.name, THEORY_LEVELS[complementB].name)}
          </div>
        )}
      </div>

      <CayleyTable hlLevel={hlLevel} onHover={onHover} />
    </div>
  );
});

function LevelSelector({
  value,
  onChange,
  label,
  onHover,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  onHover?: (lv: number | null) => void;
  compact?: boolean;
}) {
  const sz = compact ? 20 : 32;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xs }}>
      <span style={{ fontSize: FS.xs, fontFamily: "monospace", color: C.textDimmer }}>{label}</span>
      <div style={{ display: "flex", gap: compact ? 2 : 3, justifyContent: "center" }}>
        {THEORY_LEVELS.map((lv) => {
          const active = lv.lv === value;
          return (
            <button
              key={lv.lv}
              onClick={() => onChange(lv.lv)}
              onMouseEnter={() => onHover?.(lv.lv)}
              onMouseLeave={() => onHover?.(null)}
              style={{
                width: sz,
                height: sz,
                borderRadius: "50%",
                border: active ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
                background: lv.lv === 0 ? C.bgRoot : lv.color,
                cursor: "pointer",
                padding: 0,
                fontSize: compact ? FS.xxs : FS.xs,
                fontWeight: FW.bold,
                fontFamily: "monospace",
                color: lv.lv >= 4 ? "#000" : "#fff",
                opacity: active ? 1 : 0.5,
              }}
            >
              {lv.lv}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from "react";
import { THEORY_LEVELS, GRAY_PATH, GRAY_TOGGLES, GRAY_POINTS } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 340;
const DOT_R = 16;
const WALKER_R = 8;
const STEP_MS = 900;
const CHANNEL_COLORS: Record<string, string> = { G: "#00ff00", R: "#ff0000", B: "#0000ff" };

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const GrayCodeHex = React.memo(function GrayCodeHex({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState<false | "cw" | "ccw">(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const reducedMotion = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (!playing) {
      clearInterval(timerRef.current);
      return;
    }
    const dir = playing === "cw" ? 1 : 5; // +1 = clockwise, +5 = counterclockwise (mod 6)
    timerRef.current = setInterval(() => setStep((s) => (s + dir) % 6), STEP_MS);
    return () => clearInterval(timerRef.current);
  }, [playing]);

  useEffect(() => {
    if (reducedMotion.current) setPlaying(false);
  }, []);

  // Sync from external highlight
  useEffect(() => {
    if (hlLevel !== null) {
      const idx = GRAY_PATH.indexOf(hlLevel as (typeof GRAY_PATH)[number]);
      if (idx >= 0) setStep(idx);
    }
  }, [hlLevel]);

  const handlePlayCW = useCallback(() => setPlaying("cw"), []);
  const handlePlayCCW = useCallback(() => setPlaying("ccw"), []);
  const handlePause = useCallback(() => setPlaying(false), []);

  const isCCW = playing === "ccw";
  const currentLv = GRAY_PATH[step];
  const fwdStep = (step + 1) % 6;
  const bwdStep = (step + 5) % 6;
  const nextStep = isCCW ? bwdStep : fwdStep;
  const nextLv = GRAY_PATH[nextStep];
  const toggle = isCCW ? GRAY_TOGGLES[bwdStep] : GRAY_TOGGLES[step];
  const toggleColor = CHANNEL_COLORS[toggle];
  const wp = GRAY_POINTS[currentLv];

  const currentBits = THEORY_LEVELS[currentLv].bits;
  const nextBits = THEORY_LEVELS[nextLv].bits;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_gray_title")}>
        {/* Edges */}
        {GRAY_PATH.map((lv, i) => {
          const nLv = GRAY_PATH[(i + 1) % 6];
          const p0 = GRAY_POINTS[lv],
            p1 = GRAY_POINTS[nLv];
          const tg = GRAY_TOGGLES[i];
          const tgColor = CHANNEL_COLORS[tg];
          const isCurrentEdge = i === step;
          const mx = (p0.x + p1.x) / 2,
            my = (p0.y + p1.y) / 2;
          const dx = mx - 150,
            dy = my - 150;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const lx = mx + (dx / dist) * 18,
            ly = my + (dy / dist) * 18;
          return (
            <g key={"ge" + i}>
              <line
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={isCurrentEdge ? tgColor : C.textDimmer}
                strokeWidth={isCurrentEdge ? 2.5 : 1.2}
                opacity={isCurrentEdge ? 0.9 : 0.35}
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.md}
                fontFamily="monospace"
                fontWeight={FW.bold}
                fill={tgColor}
                opacity={isCurrentEdge ? 1 : 0.5}
              >
                {tg}
              </text>
            </g>
          );
        })}

        {/* Direction arrow */}
        {(() => {
          const p0 = GRAY_POINTS[currentLv],
            p1 = GRAY_POINTS[nextLv];
          const mx = (p0.x + p1.x) / 2,
            my = (p0.y + p1.y) / 2;
          const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          const s = 6;
          return (
            <polygon
              points={`${mx},${my} ${mx - s * Math.cos(angle - 0.5)},${my - s * Math.sin(angle - 0.5)} ${mx - s * Math.cos(angle + 0.5)},${my - s * Math.sin(angle + 0.5)}`}
              fill={toggleColor}
              opacity={0.8}
            />
          );
        })()}

        {/* Vertices */}
        {GRAY_PATH.map((lv) => {
          const p = GRAY_POINTS[lv];
          const info = THEORY_LEVELS[lv];
          const isCurrent = lv === currentLv;
          const isHl = hlLevel === lv;
          return (
            <g
              key={"gv" + lv}
              onMouseEnter={() => onHover(lv)}
              onMouseLeave={() => onHover(null)}
              onClick={() => {
                setStep(GRAY_PATH.indexOf(lv as (typeof GRAY_PATH)[number]));
                onHover(lv);
              }}
              style={{ cursor: "pointer" }}
            >
              {(isCurrent || isHl) && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={DOT_R + 5}
                  fill="none"
                  stroke={isCurrent ? toggleColor : "rgba(255,255,255,0.4)"}
                  strokeWidth={2}
                  opacity={0.7}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={DOT_R}
                fill={info.color}
                fillOpacity={0.85}
                stroke="#fff"
                strokeWidth={isCurrent ? 2.5 : 1.5}
                strokeOpacity={0.8}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={FS.xl}
                fontWeight={900}
                fontFamily="monospace"
                fill={lv >= 4 ? "#000" : "#fff"}
              >
                {lv}
              </text>
              {(() => {
                const angle = Math.atan2(p.y - 150, p.x - 150);
                return (
                  <text
                    x={p.x + 28 * Math.cos(angle)}
                    y={p.y + 28 * Math.sin(angle)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={FS.sm}
                    fontFamily="monospace"
                    fontWeight={FW.bold}
                    fill={info.color}
                    opacity={0.8}
                  >
                    {info.name.charAt(0)}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Walker dot */}
        <circle cx={wp.x} cy={wp.y} r={WALKER_R} fill="#fff" fillOpacity={0.9} stroke={toggleColor} strokeWidth={2} />

        {/* Bit visualization in center */}
        {(() => {
          const cx = 150,
            cy = 150;
          const bitW = 14;
          const chNames = ["G", "R", "B"];
          const toggleIdx = toggle === "G" ? 0 : toggle === "R" ? 1 : 2;
          return (
            <g>
              {currentBits.map((bit, bi) => {
                const bx = cx + (bi - 1) * (bitW + 4);
                const chColor = CHANNEL_COLORS[chNames[bi]];
                const isToggling = bi === toggleIdx;
                return (
                  <g key={"bit" + bi}>
                    <circle
                      cx={bx}
                      cy={cy - 12}
                      r={5}
                      fill={bit ? chColor : "none"}
                      stroke={chColor}
                      strokeWidth={bit ? 0 : 1}
                      fillOpacity={0.8}
                      opacity={bit ? 1 : 0.3}
                    />
                    {isToggling && <circle cx={bx} cy={cy - 12} r={7} fill="none" stroke={toggleColor} strokeWidth={1.5} opacity={0.8} />}
                  </g>
                );
              })}
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={FS.xs} fontFamily="monospace" fill={toggleColor} fontWeight={FW.bold}>
                {t("theory_gray_toggle", toggle)}
              </text>
            </g>
          );
        })()}

        {/* Transition info at bottom */}
        <text x={150} y={H - 22} textAnchor="middle" fontSize={FS.xs} fontFamily="monospace" fill={C.textDimmer}>
          {currentBits.join("")} ({THEORY_LEVELS[currentLv].name}) → {nextBits.join("")} ({THEORY_LEVELS[nextLv].name})
        </text>
      </svg>

      {/* Controls */}
      <div style={{ display: "flex", gap: SP.lg }}>
        {playing === "cw" ? (
          <button style={S_BTN} onClick={handlePause}>
            {t("theory_gray_pause")}
          </button>
        ) : (
          <button style={S_BTN} onClick={handlePlayCW}>
            {t("theory_gray_cw")}
          </button>
        )}
        {playing === "ccw" ? (
          <button style={S_BTN} onClick={handlePause}>
            {t("theory_gray_pause")}
          </button>
        ) : (
          <button style={S_BTN} onClick={handlePlayCCW}>
            {t("theory_gray_ccw")}
          </button>
        )}
      </div>
    </div>
  );
});

import React, { useState, useCallback, useEffect, useRef } from "react";
import { THEORY_LEVELS, FANO_LINES, FANO_LINE_CATEGORIES, FANO_LINE_ENDPOINTS, FANO_POINTS, FANO_CIRCLE } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { S_BTN } from "../../styles";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 340;
const DOT_R = 16;
const CX = 150,
  CY = 160;

const COLOR_NAMES: Record<number, string> = { 1: "B", 2: "R", 3: "M", 4: "G", 5: "C", 6: "Y", 7: "W" };

type LineFilter = "all" | "primary" | "complement" | "secondary";

function linesThrough(point: number): number[] {
  return FANO_LINES.map((line, i) => (line.includes(point) ? i : -1)).filter((i) => i >= 0);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Target positions when CMY tries to become the outer triangle
const CMY_TRIANGLE_TARGETS: Record<number, { x: number; y: number }> = {
  3: { x: CX, y: CY - 120 }, // M → top
  5: { x: CX - 104, y: CY + 60 }, // C → bottom-left
  6: { x: CX + 104, y: CY + 60 }, // Y → bottom-right
};

// Collapsed line positions (all on one horizontal line — the CMY line)
const CMY_LINE_TARGETS: Record<number, { x: number; y: number }> = {
  3: { x: CX - 80, y: CY }, // M
  5: { x: CX, y: CY }, // C
  6: { x: CX + 80, y: CY }, // Y
};

interface Props {
  hlLevel: number | null;
  onHover: (lv: number | null) => void;
}

export const FanoPlane = React.memo(function FanoPlane({ hlLevel, onHover }: Props) {
  const { t } = useTranslation();
  const [pinned, setPinned] = useState<number | null>(null);
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [cmyMode, setCmyMode] = useState(false);
  const [animT, setAnimT] = useState(0); // 0=normal, 0.5=triangle attempt, 1=collapsed
  const animRef = useRef(0);
  const reducedMotion = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (reducedMotion.current) {
      setAnimT(cmyMode ? 1 : 0);
      return;
    }
    if (!cmyMode) {
      // Animate back to 0
      let raf: number;
      const animate = () => {
        setAnimT((prev) => {
          if (prev <= 0) return 0;
          const next = prev - 0.03;
          if (next <= 0) return 0;
          raf = requestAnimationFrame(animate);
          return next;
        });
      };
      raf = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(raf);
    }
    // Animate: 0 → 0.5 (triangle attempt) → 1 (collapse to line)
    let raf: number;
    const animate = () => {
      setAnimT((prev) => {
        if (prev >= 1) return 1;
        const next = prev + 0.02;
        if (next >= 1) return 1;
        raf = requestAnimationFrame(animate);
        return next;
      });
    };
    raf = requestAnimationFrame(animate);
    animRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [cmyMode]);

  // External highlight takes priority, then pinned, then null
  const hl = hlLevel !== null && hlLevel >= 1 && hlLevel <= 7 ? hlLevel : pinned;
  const hlLines = hl !== null ? linesThrough(hl) : [];
  const hlPoints = new Set<number>();
  if (hl !== null) {
    hlPoints.add(hl);
    for (const li of hlLines) for (const p of FANO_LINES[li]) hlPoints.add(p);
  }

  const onEnter = useCallback((lv: number) => onHover(lv), [onHover]);
  const onLeave = useCallback(() => onHover(null), [onHover]);
  const onTap = useCallback(
    (lv: number) => {
      setPinned((prev) => {
        const next = prev === lv ? null : lv;
        queueMicrotask(() => onHover(next));
        return next;
      });
    },
    [onHover],
  );

  const isLineVisible = (li: number) => {
    if (lineFilter === "all") return true;
    return FANO_LINE_CATEGORIES[li] === lineFilter;
  };

  // Compute animated positions for CMY points
  const getPos = (lv: number): { x: number; y: number } => {
    if (animT <= 0 || ![3, 5, 6].includes(lv)) return FANO_POINTS[lv];

    const orig = FANO_POINTS[lv];
    const triTarget = CMY_TRIANGLE_TARGETS[lv];
    const lineTarget = CMY_LINE_TARGETS[lv];

    if (animT <= 0.5) {
      // Phase 1: move toward triangle positions
      const t = animT / 0.5;
      return { x: lerp(orig.x, triTarget.x, t), y: lerp(orig.y, triTarget.y, t) };
    }
    // Phase 2: collapse from triangle to line
    const t = (animT - 0.5) / 0.5;
    return { x: lerp(triTarget.x, lineTarget.x, t), y: lerp(triTarget.y, lineTarget.y, t) };
  };

  const isCmyAnimating = animT > 0;
  // RGB points fade out during CMY animation
  const rgbOpacity = 1 - animT * 0.8;
  // Non-CMY lines fade out
  const lineOpacityMul = isCmyAnimating ? 1 - animT * 0.7 : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_fano_title")}>
        {/* Lines (fade during CMY animation) */}
        {FANO_LINES.map((_, li) => {
          if (!isLineVisible(li)) return null;
          const active = hlLines.includes(li);
          const dim = hl !== null && !active;
          const cat = FANO_LINE_CATEGORIES[li];
          const baseOpacity = dim ? 0.12 : active ? 0.9 : 0.3;
          const strokeColor = cat === "primary" ? "#80a0ff" : cat === "complement" ? "#ffa060" : "#60ffa0";
          const isCmyLine = li === 6; // The CMY circle/line
          const finalOpacity = isCmyLine ? baseOpacity : baseOpacity * lineOpacityMul;

          if (isCmyLine) {
            if (isCmyAnimating) {
              // Draw as a line through the animated CMY points
              const p3 = getPos(3),
                p5 = getPos(5),
                p6 = getPos(6);
              // Draw connecting path between the 3 CMY points
              const collapseT = Math.max(0, (animT - 0.5) / 0.5);
              const circleOpacity = baseOpacity * (1 - collapseT);
              const lineOp = baseOpacity * collapseT;
              return (
                <g key={"fl" + li}>
                  {/* Fading inscribed circle */}
                  {circleOpacity > 0.01 && (
                    <circle
                      cx={FANO_CIRCLE.cx}
                      cy={FANO_CIRCLE.cy}
                      r={FANO_CIRCLE.r}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={1.2}
                      opacity={circleOpacity}
                    />
                  )}
                  {/* Growing line through CMY */}
                  {lineOp > 0.01 && (
                    <line
                      x1={p3.x - (p3.x - p6.x) * 0.3}
                      y1={p3.y - (p3.y - p6.y) * 0.3}
                      x2={p6.x + (p6.x - p3.x) * 0.3}
                      y2={p6.y + (p6.y - p3.y) * 0.3}
                      stroke="#ff4444"
                      strokeWidth={2.5}
                      opacity={lineOp * 0.8}
                    />
                  )}
                  {/* Ghost triangle attempt (dashed) during phase 1 */}
                  {animT > 0.1 && animT < 0.8 && (
                    <polygon
                      points={`${p3.x},${p3.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`}
                      fill="none"
                      stroke="#ff4444"
                      strokeWidth={1}
                      strokeDasharray="4,4"
                      opacity={0.3 * (1 - collapseT)}
                    />
                  )}
                </g>
              );
            }
            return (
              <circle
                key={"fl" + li}
                cx={FANO_CIRCLE.cx}
                cy={FANO_CIRCLE.cy}
                r={FANO_CIRCLE.r}
                fill="none"
                stroke={strokeColor}
                strokeWidth={active ? 2 : 1.2}
                opacity={baseOpacity}
              />
            );
          }
          const ep = FANO_LINE_ENDPOINTS[li];
          const p0 = FANO_POINTS[ep[0]],
            p1 = FANO_POINTS[ep[1]];
          return (
            <line
              key={"fl" + li}
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke={strokeColor}
              strokeWidth={active ? 2 : 1.2}
              opacity={finalOpacity}
            />
          );
        })}

        {/* XOR equations + mixing labels for highlighted lines */}
        {!isCmyAnimating &&
          hlLines.filter(isLineVisible).map((li) => {
            const line = FANO_LINES[li];
            const mid = {
              x: (FANO_POINTS[line[0]].x + FANO_POINTS[line[1]].x + FANO_POINTS[line[2]].x) / 3,
              y: (FANO_POINTS[line[0]].y + FANO_POINTS[line[1]].y + FANO_POINTS[line[2]].y) / 3,
            };
            const dx = mid.x - FANO_CIRCLE.cx,
              dy = mid.y - FANO_CIRCLE.cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ox = mid.x + (dx / dist) * 32,
              oy = mid.y + (dy / dist) * 32;
            const cat = FANO_LINE_CATEGORIES[li];
            const labelColor = cat === "primary" ? "#80a0ff" : cat === "complement" ? "#ffa060" : "#60ffa0";
            const mixLabel = `${COLOR_NAMES[line[0]]} + ${COLOR_NAMES[line[1]]} = ${COLOR_NAMES[line[2]]}`;
            return (
              <g key={"eq" + li}>
                <text
                  x={ox}
                  y={oy - 6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.sm}
                  fontFamily="monospace"
                  fill={labelColor}
                  fontWeight={FW.bold}
                >
                  {t("theory_fano_xor", String(line[0]), String(line[1]), String(line[2]))}
                </text>
                <text
                  x={ox}
                  y={oy + 6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={FS.xs}
                  fontFamily="monospace"
                  fill={labelColor}
                  opacity={0.8}
                >
                  {mixLabel}
                </text>
              </g>
            );
          })}

        {/* CMY collapse equation label */}
        {isCmyAnimating && animT > 0.6 && (
          <g opacity={Math.min(1, (animT - 0.6) * 3)}>
            <text x={CX} y={CY - 136} textAnchor="middle" fontSize={FS.md} fontFamily="monospace" fontWeight={FW.bold} fill="#ff6644">
              {t("theory_fano_cmy_eq")}
            </text>
            {animT > 0.85 && (
              <text
                x={CX}
                y={CY - 122}
                textAnchor="middle"
                fontSize={FS.xs}
                fontFamily="monospace"
                fill={C.textDimmer}
                opacity={Math.min(1, (animT - 0.85) * 6)}
              >
                {t("theory_fano_cmy_why")}
              </text>
            )}
          </g>
        )}

        {/* Points */}
        {[1, 2, 3, 4, 5, 6, 7].map((lv) => {
          const p = getPos(lv);
          const info = THEORY_LEVELS[lv];
          const active = hlPoints.has(lv);
          const dim = hl !== null && !active;
          const isCmy = [3, 5, 6].includes(lv);
          const isRgbOrW = [1, 2, 4, 7].includes(lv);
          const pointOpacity = isCmyAnimating && isRgbOrW ? rgbOpacity : 1;
          const pointR = isCmyAnimating && isCmy ? DOT_R + animT * 2 : DOT_R;
          return (
            <g
              key={"fp" + lv}
              onMouseEnter={() => onEnter(lv)}
              onMouseLeave={onLeave}
              onClick={() => onTap(lv)}
              style={{ cursor: "pointer" }}
              opacity={pointOpacity}
            >
              <circle cx={p.x} cy={p.y} r={DOT_R + 6} fill="transparent" />
              {active && <circle cx={p.x} cy={p.y} r={DOT_R + 4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
              {/* Red border for CMY during animation */}
              {isCmyAnimating && isCmy && animT > 0.4 && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={pointR + 4}
                  fill="none"
                  stroke="#ff4444"
                  strokeWidth={1.5}
                  opacity={Math.min(1, (animT - 0.4) * 2)}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={pointR}
                fill={info.color}
                fillOpacity={dim ? 0.2 : 0.85}
                stroke={dim ? info.color : "#fff"}
                strokeWidth={active ? 2.5 : 1.5}
                strokeOpacity={dim ? 0.3 : 0.8}
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
                opacity={dim ? 0.3 : 1}
              >
                {lv}
              </text>
            </g>
          );
        })}

        {/* Bit labels under CMY points during animation */}
        {isCmyAnimating &&
          animT > 0.3 &&
          [3, 5, 6].map((lv) => {
            const p = getPos(lv);
            const info = THEORY_LEVELS[lv];
            return (
              <text
                key={"bl" + lv}
                x={p.x}
                y={p.y + DOT_R + 14}
                textAnchor="middle"
                fontSize={FS.xs}
                fontFamily="monospace"
                fill={info.color}
                opacity={Math.min(1, (animT - 0.3) * 3)}
              >
                {info.bits.join("")}
              </text>
            );
          })}

        {/* Legend */}
        {!isCmyAnimating &&
          [
            { label: t("theory_fano_primary"), color: "#80a0ff" },
            { label: t("theory_fano_complement"), color: "#ffa060" },
            { label: t("theory_fano_secondary"), color: "#60ffa0" },
          ].map((item, i) => (
            <g key={"lg" + i}>
              <line x1={20} y1={H - 42 + i * 14} x2={34} y2={H - 42 + i * 14} stroke={item.color} strokeWidth={2} />
              <text x={40} y={H - 42 + i * 14} dominantBaseline="central" fontSize={FS.xs} fill={item.color} fontFamily="monospace">
                {item.label}
              </text>
            </g>
          ))}
      </svg>

      {/* Buttons */}
      <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center" }}>
        {!cmyMode &&
          (["all", "primary", "complement", "secondary"] as const).map((f) => {
            const label =
              f === "all"
                ? t("theory_fano_show_all")
                : f === "primary"
                  ? t("theory_fano_show_primary")
                  : f === "complement"
                    ? t("theory_fano_show_complement")
                    : t("theory_fano_show_secondary");
            return (
              <button
                key={f}
                style={{
                  ...S_BTN,
                  opacity: lineFilter === f ? 1 : 0.5,
                  borderColor: lineFilter === f ? "rgba(255,255,255,0.5)" : undefined,
                }}
                onClick={() => setLineFilter(f)}
              >
                {label}
              </button>
            );
          })}
        <button
          style={{
            ...S_BTN,
            opacity: cmyMode ? 1 : 0.5,
            borderColor: cmyMode ? "rgba(255,100,100,0.6)" : undefined,
            color: cmyMode ? "#ff6644" : C.textMuted,
          }}
          onClick={() => setCmyMode((v) => !v)}
        >
          {t("theory_fano_cmy_collapse")} {cmyMode ? "\u25c0" : "\u25b6"}
        </button>
      </div>
    </div>
  );
});

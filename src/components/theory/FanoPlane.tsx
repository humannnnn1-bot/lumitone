import React, { useState, useCallback, useEffect, useRef } from "react";
import { THEORY_LEVELS, FANO_LINES, FANO_LINE_CATEGORIES, FANO_LINE_ENDPOINTS, FANO_POINTS, FANO_CIRCLE } from "./theory-data";
import { C, FS, FW, SP } from "../../tokens";
import { usePinReset } from "./pin-reset";
import { S_BTN } from "../../styles";
import { useTranslation } from "../../i18n";

const W = 300,
  H = 245,
  VB_Y = 10;
const DOT_R = 14;
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
  usePinReset(setPinned);
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [cmyMode, setCmyMode] = useState(false);
  const [animT, setAnimT] = useState(0); // 0=normal Fano, 1=CMY collapsed to line
  const animTRef = useRef(0);
  const reducedMotion = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (reducedMotion.current) {
      const target = cmyMode ? 1 : 0;
      animTRef.current = target;
      setAnimT(target);
      return;
    }
    let raf = 0;
    const step = cmyMode ? 0.02 : -0.03;
    const animate = () => {
      const prev = animTRef.current;
      const next = Math.max(0, Math.min(1, prev + step));
      animTRef.current = next;
      setAnimT(next);
      if ((cmyMode && next < 1) || (!cmyMode && next > 0)) {
        raf = requestAnimationFrame(animate);
      }
    };
    raf = requestAnimationFrame(animate);
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

  // Compute animated positions for CMY points: direct lerp from Fano midpoints to collapsed line
  const getPos = (lv: number): { x: number; y: number } => {
    if (animT <= 0 || ![3, 5, 6].includes(lv)) return FANO_POINTS[lv];
    const orig = FANO_POINTS[lv];
    const lineTarget = CMY_LINE_TARGETS[lv];
    return { x: lerp(orig.x, lineTarget.x, animT), y: lerp(orig.y, lineTarget.y, animT) };
  };

  const isCmyAnimating = animT > 0;
  // RGB points fade out during CMY animation
  const rgbOpacity = 1 - animT * 0.8;
  // Non-CMY lines fade out
  const lineOpacityMul = isCmyAnimating ? 1 - animT * 0.7 : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md }}>
      <svg viewBox={`0 ${VB_Y} ${W} ${H}`} style={{ width: "100%", maxWidth: W }} role="img" aria-label={t("theory_fano_title")}>
        {/* Lines (fade during CMY animation) */}
        {FANO_LINES.map((_, li) => {
          if (!isLineVisible(li)) return null;
          const active = hlLines.includes(li);
          const dim = hl !== null && !active;
          const cat = FANO_LINE_CATEGORIES[li];
          const baseOpacity = dim ? 0.12 : active ? 0.9 : 0.3;
          const strokeColor = cat === "primary" ? "#80a0ff" : cat === "complement" ? "#ffa060" : "#60ffa0";
          const strokeDash = "none";
          const isCmyLine = li === 6; // The CMY circle/line
          const finalOpacity = isCmyLine ? baseOpacity : baseOpacity * lineOpacityMul;

          if (isCmyLine) {
            if (isCmyAnimating) {
              const p3 = getPos(3),
                p6 = getPos(6);
              // Crossfade circle → straight line over second half of animation,
              // once points are near-collinear
              const collapseT = Math.max(0, (animT - 0.5) / 0.5);
              const circleOpacity = baseOpacity * (1 - collapseT);
              const lineOp = baseOpacity * collapseT;
              // Extend the line 30% beyond p3 and p6 on each side
              const dx = p6.x - p3.x,
                dy = p6.y - p3.y;
              return (
                <g key={"fl" + li}>
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
                  {lineOp > 0.01 && (
                    <line
                      x1={p3.x - dx * 0.3}
                      y1={p3.y - dy * 0.3}
                      x2={p6.x + dx * 0.3}
                      y2={p6.y + dy * 0.3}
                      stroke="#ff4444"
                      strokeWidth={2.5}
                      opacity={lineOp * 0.8}
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
                strokeDasharray={strokeDash}
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
              strokeDasharray={strokeDash}
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
            // For complement lines (through center 7), use midpoint of the two non-7 endpoints
            const cat = FANO_LINE_CATEGORIES[li];
            const isComplement = cat === "complement";
            const nonCenter = line.filter((p) => p !== 7);
            const anchor =
              isComplement && nonCenter.length === 2
                ? {
                    x: (FANO_POINTS[nonCenter[0]].x + FANO_POINTS[nonCenter[1]].x) / 2,
                    y: (FANO_POINTS[nonCenter[0]].y + FANO_POINTS[nonCenter[1]].y) / 2,
                  }
                : mid;
            const dx = anchor.x - FANO_CIRCLE.cx,
              dy = anchor.y - FANO_CIRCLE.cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const push = 32;
            const ox = anchor.x + (dx / dist) * push,
              oy = anchor.y + (dy / dist) * push;
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
            <text x={CX} y={CY - 60} textAnchor="middle" fontSize={FS.md} fontFamily="monospace" fontWeight={FW.bold} fill="#ff6644">
              {t("theory_fano_cmy_eq")}
            </text>
            {animT > 0.85 && (
              <text
                x={CX}
                y={CY - 46}
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
          // Dim node 7 when CMY closure line (li=6) is highlighted, so equation label is readable
          const cmyLineActive = hlLines.includes(6) && isLineVisible(6);
          const pointOpacity = isCmyAnimating && isRgbOrW ? rgbOpacity : lv === 7 && cmyLineActive ? 0.25 : 1;
          const pointR = DOT_R;
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
                fontSize={FS.lg}
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
                y={Math.min(p.y + DOT_R + 14, 244)}
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

        {/* XOR decomposition labels above each CMY point */}
        {isCmyAnimating &&
          animT > 0.65 &&
          (
            [
              [3, "M = C⊕Y"],
              [5, "C = M⊕Y"],
              [6, "Y = M⊕C"],
            ] as const
          ).map(([lv, eq]) => {
            const p = getPos(lv);
            const info = THEORY_LEVELS[lv];
            return (
              <text
                key={"xq" + lv}
                x={p.x}
                y={p.y - DOT_R - 6}
                textAnchor="middle"
                fontSize={FS.xs}
                fontFamily="monospace"
                fill={info.color}
                opacity={Math.min(1, (animT - 0.65) * 3) * 0.85}
              >
                {eq}
              </text>
            );
          })}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: SP.xl,
          justifyContent: "center",
          flexWrap: "wrap",
          visibility: isCmyAnimating ? "hidden" : "visible",
        }}
        aria-hidden={isCmyAnimating || undefined}
      >
        {[
          { label: t("theory_fano_primary"), color: "#80a0ff", dash: "none" },
          { label: t("theory_fano_complement"), color: "#ffa060", dash: "none" },
          { label: t("theory_fano_secondary"), color: "#60ffa0", dash: "none" },
        ].map((item, i) => (
          <span
            key={"lg" + i}
            className="theory-annotation"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: FS.xs, fontFamily: "monospace", color: item.color }}
          >
            <svg width={18} height={2}>
              <line x1={0} y1={1} x2={18} y2={1} stroke={item.color} strokeWidth={2} strokeDasharray={item.dash} />
            </svg>
            {item.label}
          </span>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: SP.sm, flexWrap: "wrap", justifyContent: "center" }}>
        {(["all", "primary", "complement", "secondary"] as const).map((f) => {
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
              className="theory-annotation"
              style={{
                ...S_BTN,
                opacity: lineFilter === f ? 1 : 0.5,
                borderColor: lineFilter === f ? "rgba(255,255,255,0.5)" : undefined,
                visibility: cmyMode ? "hidden" : "visible",
                marginLeft: f === "primary" ? SP.xl : undefined,
              }}
              onClick={() => setLineFilter(f)}
              disabled={cmyMode}
              aria-hidden={cmyMode || undefined}
              tabIndex={cmyMode ? -1 : undefined}
            >
              {label}
            </button>
          );
        })}
        <button
          className="theory-annotation"
          style={{
            ...S_BTN,
            opacity: cmyMode ? 1 : 0.5,
            borderColor: cmyMode ? "rgba(255,100,100,0.6)" : undefined,
            color: cmyMode ? "#ff6644" : C.textMuted,
            marginLeft: SP.xl,
          }}
          onClick={() => setCmyMode((v) => !v)}
        >
          {t("theory_fano_cmy_collapse")} <span aria-hidden="true">{cmyMode ? "\u25c0" : "\u25b6"}</span>
        </button>
      </div>
    </div>
  );
});

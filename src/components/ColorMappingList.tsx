import React, { memo, useState, useEffect } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES } from "../color-engine";
import { rgbStr, hexStr } from "../utils";
import { S_NAV_ARROW, S_SWATCH } from "../styles";
import type { ColorAction } from "../color-reducer";
import { useTranslation } from "../i18n";
import { C, SP, FS, R, DUR } from "../tokens";
import { THEORY_LEVELS } from "./theory/theory-data";
import { HEX_CANDIDATE_ANGLES } from "../hex-data";

const MOBILE_BP = 600;

/** Canonical hue angles for each level (L0/L7 are achromatic) */
const CANONICAL_ANGLES: (number | null)[] = [null, 240, 0, 300, 120, 180, 60, null];

/** Compute shortest signed delta between two hue angles (-180..+180) */
function hueDelta(current: number, canonical: number): number {
  let d = current - canonical;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.round(d);
}

/** Compute XOR decompositions: find all pairs (a, b) where a XOR b = lv, a < b, both non-zero */
interface Props {
  cc: number[];
  dispatch: React.Dispatch<ColorAction>;
  brushLevel: number;
  onSelectLevel?: (lv: number) => void;
}

export const ColorMappingList = memo(
  function ColorMappingList({ cc, dispatch, brushLevel, onSelectLevel }: Props) {
    const { t } = useTranslation();
    const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE_BP);
    useEffect(() => {
      const onResize = () => setMobile(window.innerWidth < MOBILE_BP);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, width: "100%" }}>
        {LEVEL_INFO.map((info, i) => {
          const alts = LEVEL_CANDIDATES[i],
            ci = cc[i] % alts.length,
            cur = alts[ci],
            has = alts.length > 1;
          const isActive = brushLevel === i;
          const tl = THEORY_LEVELS[i];
          // L1/L6 are single-candidate chromatic — size row height to the midpoint
          // of achromatic (L0/L7) and multi-candidate (L2–L5) neighbors.
          // L2–L5 height is driven by S_NAV_ARROW minHeight (tap target), constant across breakpoints.
          const isSingleChromatic = i === 1 || i === 6;
          const vPad = has ? 0 : isSingleChromatic ? SP.xl : mobile ? SP.sm : SP.md;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: mobile ? SP.md : SP.lg,
                padding: `${vPad}px ${mobile ? SP.xs : SP.lg}px`,
                background: isActive ? C.bgSurface : C.bgPanelAlt,
                borderRadius: R.lg,
                border: isActive ? `1px solid ${C.borderAccent}` : "1px solid transparent",
                transition: `border-color ${DUR.normal}`,
              }}
            >
              <div
                style={{
                  width: mobile ? 14 : 18,
                  height: mobile ? 14 : 18,
                  borderRadius: R.md,
                  background: `rgb(${info.gray},${info.gray},${info.gray})`,
                  border: `1px solid ${C.border}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: FS.lg, color: C.textDimmer, width: 30, flexShrink: 0 }}>
                L{i} {"KBRMGCYW"[i]}
              </span>
              <span style={{ fontSize: FS.sm, color: C.textDim, fontFamily: "monospace", flexShrink: 0 }}>{tl.bits.join("")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
                {has && (
                  <button
                    onClick={() => dispatch({ type: "cycle_color", lv: i, dir: -1 })}
                    aria-label={t("aria_prev_color", i, info.name)}
                    style={S_NAV_ARROW}
                  >
                    ◀
                  </button>
                )}
                <div
                  onClick={() => onSelectLevel?.(i)}
                  style={{
                    width: mobile ? 24 : 28,
                    height: mobile ? 18 : 20,
                    borderRadius: R.md,
                    background: rgbStr(cur.rgb),
                    border: `1px solid ${C.borderHover}`,
                    flexShrink: 0,
                    cursor: onSelectLevel ? "pointer" : undefined,
                  }}
                />
                {has && (
                  <button
                    onClick={() => dispatch({ type: "cycle_color", lv: i, dir: 1 })}
                    aria-label={t("aria_next_color", i, info.name)}
                    style={S_NAV_ARROW}
                  >
                    ▶
                  </button>
                )}
              </div>
              {CANONICAL_ANGLES[i] != null &&
                cur.angle >= 0 &&
                (() => {
                  const canon = CANONICAL_ANGLES[i]!;
                  const hexAngle = HEX_CANDIDATE_ANGLES[i]?.[ci];
                  if (hexAngle == null) return null;
                  const d = hueDelta(hexAngle, canon);
                  const ibs = { display: "inline-block" as const, textAlign: "right" as const };
                  const ibc = { display: "inline-block" as const, textAlign: "center" as const, width: 8 };
                  return (
                    <span style={{ fontSize: FS.sm, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      <span style={{ ...ibs, color: tl.color, width: 32 }}>
                        {"\u2B21"}
                        {canon}°
                      </span>
                      <span style={{ ...ibc, color: C.textDim }}>{d >= 0 ? "+" : "\u2212"}</span>
                      <span style={{ ...ibs, color: d === 0 ? C.textDim : C.textWhite, width: 32 }}>
                        {"\u0394"}
                        {Math.abs(d)}°
                      </span>
                      <span style={{ ...ibc, color: C.textDim }}>=</span>
                      <span style={{ ...ibs, color: rgbStr(cur.rgb), width: 28 }}>{hexAngle}°</span>
                    </span>
                  );
                })()}
              {cur.hueLabel && CANONICAL_ANGLES[i] == null && (
                <span style={{ fontSize: FS.sm, color: C.textDimmer, whiteSpace: "nowrap", fontFamily: "monospace" }}>{cur.hueLabel}</span>
              )}
              {has && (
                <div style={{ display: "flex", gap: mobile ? SP.xs : SP.sm, marginLeft: "auto" }}>
                  {alts.map((a, j) => (
                    <button
                      key={j}
                      onClick={() => dispatch({ type: "set_color", lv: i, idx: j })}
                      title={`${hexStr(a.rgb)} ${a.hueLabel}`}
                      aria-label={t("aria_color_candidate", i, hexStr(a.rgb), a.hueLabel)}
                      style={{
                        ...S_SWATCH,
                        width: mobile ? 18 : 24,
                        height: mobile ? 18 : 24,
                        borderRadius: R.md,
                        background: rgbStr(a.rgb),
                        border: j === ci ? `2px solid ${C.textWhite}` : `1px solid ${C.border}`,
                        opacity: 1,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  },
  (prev, next) =>
    prev.brushLevel === next.brushLevel &&
    prev.dispatch === next.dispatch &&
    prev.onSelectLevel === next.onSelectLevel &&
    prev.cc.length === next.cc.length &&
    prev.cc.every((v, i) => v === next.cc[i]),
);

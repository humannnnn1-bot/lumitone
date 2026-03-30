import React, { memo, useState, useEffect } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES } from "../color-engine";
import { rgbStr, hexStr } from "../utils";
import { S_NAV_ARROW, S_SWATCH } from "../styles";
import type { ColorAction } from "../color-reducer";
import { useTranslation } from "../i18n";
import { C, SP, FS, R, DUR } from "../tokens";
import { THEORY_LEVELS, FANO_LINES } from "./theory/theory-data";

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
function xorPairs(lv: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (const line of FANO_LINES) {
    const [a, b, c] = line;
    if (c === lv) pairs.push([a, b]);
    else if (b === lv) pairs.push([a, c]);
    else if (a === lv) pairs.push([b, c]);
  }
  return pairs;
}

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
          const pairs = xorPairs(i);
          const xorStr = i === 0 ? "—" : pairs.map(([a, b]) => `${a}⊕${b}`).join(",");
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: mobile ? SP.sm : SP.md,
                padding: mobile ? `${has ? 0 : SP.sm}px ${SP.xs}px` : `${has ? 0 : SP.md}px ${SP.lg}px`,
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
              {cur.hueLabel && <span style={{ fontSize: FS.sm, color: C.textDimmer, whiteSpace: "nowrap" }}>{cur.hueLabel}</span>}
              {CANONICAL_ANGLES[i] != null &&
                cur.angle >= 0 &&
                (() => {
                  const d = hueDelta(cur.angle, CANONICAL_ANGLES[i]!);
                  return (
                    <span style={{ fontSize: FS.sm, color: d === 0 ? C.textDim : C.accent, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      Δ{d >= 0 ? "+" : ""}
                      {d}°
                    </span>
                  );
                })()}
              <span style={{ fontSize: FS.sm, color: C.textDimmer, fontFamily: "monospace", whiteSpace: "nowrap" }}>{xorStr}</span>
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

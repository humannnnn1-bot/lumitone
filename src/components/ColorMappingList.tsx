import React, { memo } from "react";
import { LEVEL_INFO, LEVEL_CANDIDATES } from "../color-engine";
import { rgbStr, hexStr } from "../utils";
import { S_NAV_ARROW, S_SWATCH } from "../styles";
import type { ColorAction } from "../color-reducer";
import { useTranslation } from "../i18n";
import { C, SP, FS, R, DUR } from "../tokens";

interface Props {
  cc: number[];
  dispatch: React.Dispatch<ColorAction>;
  brushLevel: number;
  onSelectLevel?: (lv: number) => void;
}

export const ColorMappingList = memo(function ColorMappingList({ cc, dispatch, brushLevel, onSelectLevel }: Props) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, width: "100%" }}>
      {LEVEL_INFO.map((info, i) => {
        const alts = LEVEL_CANDIDATES[i], ci = cc[i] % alts.length, cur = alts[ci], has = alts.length > 1;
        const isActive = brushLevel === i;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: SP.md, padding: `${SP.md}px ${SP.lg}px`,
            background: isActive ? C.bgSurface : C.bgPanelAlt, borderRadius: R.lg,
            border: isActive ? `1px solid ${C.borderAccent}` : "1px solid transparent", transition: `border-color ${DUR.normal}` }}>
            <div style={{ width: 18, height: 18, borderRadius: R.md,
              background: `rgb(${info.gray},${info.gray},${info.gray})`,
              border: `1px solid ${C.border}`, flexShrink: 0 }} />
            <span style={{ fontSize: FS.md, color: C.textDimmer, width: 44 }}>L{i} {info.name.slice(0, 3)}</span>
            {has && <button onClick={() => dispatch({ type: "cycle_color", lv: i, dir: -1 })}
              aria-label={t("aria_prev_color", i, info.name)} style={S_NAV_ARROW}>◀</button>}
            <div onClick={() => onSelectLevel?.(i)}
              style={{ width: 28, height: 20, borderRadius: R.md, background: rgbStr(cur.rgb),
              border: `1px solid ${C.borderHover}`, flexShrink: 0, cursor: onSelectLevel ? "pointer" : undefined }} />
            {has && <button onClick={() => dispatch({ type: "cycle_color", lv: i, dir: 1 })}
              aria-label={t("aria_next_color", i, info.name)} style={S_NAV_ARROW}>▶</button>}
            <span style={{ fontSize: FS.xs, color: C.textDim }}>{hexStr(cur.rgb)}</span>
            {has && <span style={{ fontSize: FS.xxs, color: C.textDimmer, marginLeft: SP.xs }}>{cur.hueLabel}</span>}
            {has && <div style={{ display: "flex", gap: SP.sm, marginLeft: "auto" }}>
              {alts.map((a, j) =>
                <button key={j}
                  onClick={() => dispatch({ type: "set_color", lv: i, idx: j })}
                  title={`${hexStr(a.rgb)} ${a.hueLabel}`}
                  aria-label={t("aria_color_candidate", i, hexStr(a.rgb), a.hueLabel)}
                  style={{ ...S_SWATCH, width: 16, height: 16, borderRadius: R.md, background: rgbStr(a.rgb),
                    border: j === ci ? `2px solid ${C.textWhite}` : `1px solid ${C.border}`,
                    opacity: 1 }} />)}
            </div>}
          </div>);
      })}
    </div>
  );
}, (prev, next) =>
  prev.brushLevel === next.brushLevel &&
  prev.dispatch === next.dispatch &&
  prev.onSelectLevel === next.onSelectLevel &&
  prev.cc.length === next.cc.length &&
  prev.cc.every((v, i) => v === next.cc[i])
);

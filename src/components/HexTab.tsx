import React, { useMemo } from "react";
import { S_BTN } from "../styles";
import { LEVEL_CANDIDATES } from "../color-engine";
import { rgbStr } from "../utils";
import { C, SP, FS, R } from "../tokens";
import { HexDiag } from "./HexDiag";
import type { ColorAction } from "../color-reducer";
import type { TranslationFn } from "../i18n";

interface HexTabProps {
  hexPrvRef: React.RefObject<HTMLCanvasElement | null>;
  displayW: number;
  displayH: number;
  cc: number[];
  ccDispatch: React.Dispatch<ColorAction>;
  hist: number[];
  total: number;
  locked: boolean[];
  toggleLock: (lv: number) => void;
  handleRandomize: () => void;
  handleUnlockAll: () => void;
  canRandomize: boolean;
  patternInfo: { total: number; expanded: string; perLevel: number[] };
  t: TranslationFn;
  onPatternClick?: () => void;
}

const S_FLEX_COL_CENTER: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg };
const S_LABEL: React.CSSProperties = { fontSize: FS.md, color: C.textDim, lineHeight: "14px" };

export const HexTab = React.memo(function HexTab(props: HexTabProps) {
  const {
    hexPrvRef,
    displayW,
    displayH,
    cc,
    ccDispatch,
    hist,
    total,
    locked,
    toggleLock,
    handleRandomize,
    handleUnlockAll,
    canRandomize,
    patternInfo,
    t,
    onPatternClick,
  } = props;

  const hasLocked = useMemo(() => locked.some(Boolean), [locked]);

  return (
    <div style={S_FLEX_COL_CENTER}>
      <div className="panel-layout">
        <div className="panel-canvas" style={{ "--display-max": displayW + "px" } as React.CSSProperties}>
          <div style={S_LABEL}>{t("label_diagram")}</div>
          <div
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: R.lg,
              overflow: "hidden",
              position: "relative",
              width: displayW,
              height: displayH,
            }}
          >
            <canvas
              ref={hexPrvRef}
              role="img"
              aria-label={t("label_diagram")}
              style={{ width: displayW, height: displayH, display: "block", imageRendering: "pixelated" }}
            />
          </div>
        </div>
        <div className="panel-sidebar">
          <HexDiag
            cc={cc}
            dispatch={ccDispatch}
            hist={hist}
            total={total}
            locked={locked}
            onToggleLock={toggleLock}
            onRandomize={handleRandomize}
            canRandomize={canRandomize}
          />
          {/* Pattern info — 3 aligned rows: labels, dots, ∏ᵢcᵢ = counts × ... = total */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.xs, marginTop: -SP.lg }}>
            <div
              onClick={onPatternClick}
              role={onPatternClick ? "button" : undefined}
              tabIndex={onPatternClick ? 0 : undefined}
              onKeyDown={
                onPatternClick
                  ? (ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onPatternClick();
                      }
                    }
                  : undefined
              }
              aria-label={onPatternClick ? t("pattern_count_go_gallery", patternInfo.total) : undefined}
              style={{
                display: "grid",
                gridTemplateColumns: `auto repeat(15, auto) auto`,
                justifyContent: "center",
                justifyItems: "center",
                alignItems: "center",
                rowGap: 3,
                columnGap: 0,
                maxWidth: "100%",
                overflowX: "auto",
                ...(onPatternClick
                  ? { cursor: "pointer", borderRadius: R.md, padding: `${SP.xs}px ${SP.sm}px`, transition: "background 0.15s" }
                  : {}),
              }}
              onMouseEnter={
                onPatternClick
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                    }
                  : undefined
              }
              onMouseLeave={
                onPatternClick
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.background = "";
                    }
                  : undefined
              }
              onFocus={
                onPatternClick
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.outline = `2px solid ${C.accentBright}`;
                      (e.currentTarget as HTMLElement).style.outlineOffset = "2px";
                    }
                  : undefined
              }
              onBlur={
                onPatternClick
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.outline = "";
                    }
                  : undefined
              }
            >
              {/* Row 1: Level labels */}
              <span />
              {/* spacer for ∏ᵢcᵢ = column */}
              {patternInfo.perLevel.map((_, lv) => {
                const active = hist[lv] > 0;
                return (
                  <React.Fragment key={"l" + lv}>
                    {lv > 0 && <span />}
                    <span style={{ fontSize: FS.sm, color: active ? C.accentBright : C.textDimmer, minWidth: 22, textAlign: "center" }}>
                      L{lv}
                    </span>
                  </React.Fragment>
                );
              })}
              <span />
              {/* spacer for = total column */}
              {/* Row 2: Color dots — empty circle if unused */}
              <span />
              {patternInfo.perLevel.map((_, lv) => {
                const active = hist[lv] > 0;
                const cands = LEVEL_CANDIDATES[lv];
                const rgb = cands[cc[lv] % cands.length]?.rgb ?? [128, 128, 128];
                return (
                  <React.Fragment key={"d" + lv}>
                    {lv > 0 && <span />}
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        justifySelf: "center",
                        ...(active
                          ? { background: rgbStr(rgb) }
                          : { background: "none", border: `1px solid ${C.textDimmer}`, boxSizing: "border-box" as const }),
                      }}
                    />
                  </React.Fragment>
                );
              })}
              <span />
              {/* Row 3: ∏ᵢcᵢ = counts × ... = total */}
              <span style={{ fontSize: FS.sm, color: C.accentBright, paddingRight: SP.xs, whiteSpace: "nowrap" }}>
                {"\u220F\u1D62c\u1D62 ="}
              </span>
              {patternInfo.perLevel.map((c, lv) => {
                const active = hist[lv] > 0;
                const mulActive = lv > 0 && hist[lv - 1] > 0 && hist.slice(lv).some((h) => h > 0);
                return (
                  <React.Fragment key={"c" + lv}>
                    {lv > 0 && <span style={{ fontSize: FS.sm, color: mulActive ? C.accentBright : C.textDimmer }}>{"\u00d7"}</span>}
                    <span
                      style={{
                        fontSize: FS.md,
                        color: active ? C.accentBright : C.textDimmer,
                        fontWeight: active ? 700 : 400,
                        minWidth: 22,
                        textAlign: "center",
                      }}
                    >
                      {c}
                    </span>
                  </React.Fragment>
                );
              })}
              <span style={{ fontSize: FS.sm, color: C.accentBright, paddingLeft: SP.sm, whiteSpace: "nowrap" }}>
                = {t("random_patterns", patternInfo.total)}
              </span>
            </div>
            {hasLocked && (
              <button style={S_BTN} onClick={handleUnlockAll}>
                {t("btn_unlock_all")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

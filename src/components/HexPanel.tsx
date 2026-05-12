import React, { useCallback, useMemo, useEffect, useState } from "react";
import { S_BTN, S_CANVAS_STATUS_STABLE } from "../styles/shared";
import { LEVEL_CANDIDATES } from "../color-engine";
import { LEVEL_MASK } from "../constants";
import { rgbStr } from "../utils";
import { C, SP, FS, R } from "../styles/tokens";
import { HexDiagram } from "./HexDiagram";
import type { ColorAction } from "../state/color-reducer";
import type { TranslationFn } from "../i18n";
import type { CanvasData } from "../types";
import { formatHexPixelStatus } from "../utils/pixel-status";
import { getFullStatusText, getVisibleStatusText, type StatusText, useCompactStatus } from "../utils/status-display";

interface HexPanelProps {
  hexPrvRef: React.RefObject<HTMLCanvasElement | null>;
  canvasData: CanvasData;
  displayW: number;
  displayH: number;
  candidateIndexByLevel: readonly number[];
  candidateIndexDispatch: React.Dispatch<ColorAction>;
  levelHistogram: number[];
  total: number;
  lockedLevels: boolean[];
  toggleLevelLock: (levelIndex: number) => void;
  handleRandomize: () => void;
  handleUnlockAll: () => void;
  canRandomize: boolean;
  patternInfo: { total: number; expanded: string; perLevel: number[] };
  t: TranslationFn;
  onPatternClick?: () => void;
}

const S_FLEX_COL_CENTER: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg };
const S_LABEL: React.CSSProperties = { fontSize: FS.md, color: C.textDim, lineHeight: "14px" };
const S_UNLOCK_ALL_BUTTON: React.CSSProperties = {
  ...S_BTN,
  height: 22,
  minWidth: 72,
  padding: `0 ${SP.xl}px`,
  fontSize: FS.lg,
  lineHeight: "12px",
  whiteSpace: "nowrap",
};

export const HexPanel = React.memo(function HexPanel(props: HexPanelProps) {
  const {
    hexPrvRef,
    canvasData,
    displayW,
    displayH,
    candidateIndexByLevel,
    candidateIndexDispatch,
    levelHistogram,
    total,
    lockedLevels,
    toggleLevelLock,
    handleRandomize,
    handleUnlockAll,
    canRandomize,
    patternInfo,
    t,
    onPatternClick,
  } = props;

  const hasLocked = useMemo(() => lockedLevels.some(Boolean), [lockedLevels]);
  const compactStatus = useCompactStatus();
  const [hoverInfo, setHoverInfo] = useState<StatusText | null>(null);

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || canvasData.width === 0 || canvasData.height === 0) {
        setHoverInfo(null);
        return;
      }
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvasData.width);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvasData.height);
      if (x < 0 || x >= canvasData.width || y < 0 || y >= canvasData.height) {
        setHoverInfo(null);
        return;
      }
      const lv = canvasData.levelData[y * canvasData.width + x] & LEVEL_MASK;
      setHoverInfo(
        formatHexPixelStatus({
          x,
          y,
          lv,
          candidateIndexByLevel,
          levelHistogram,
          patternFactor: patternInfo.perLevel[lv] ?? 1,
          isLocked: lockedLevels[lv] ?? false,
        }),
      );
    },
    [candidateIndexByLevel, canvasData, levelHistogram, lockedLevels, patternInfo.perLevel],
  );

  const handleCanvasPointerLeave = useCallback(() => setHoverInfo(null), []);

  // Keyboard 2-5: cycle candidate color for that level
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k >= "2" && k <= "5") {
        candidateIndexDispatch({ type: "cycle_color", levelIndex: +k, direction: 1 });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [candidateIndexDispatch]);

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
              onPointerMove={handleCanvasPointerMove}
              onPointerLeave={handleCanvasPointerLeave}
              style={{ width: displayW, height: displayH, display: "block", imageRendering: "pixelated" }}
            />
          </div>
          <div
            aria-live="polite"
            aria-atomic="true"
            title={hoverInfo ? getFullStatusText(hoverInfo) : undefined}
            style={S_CANVAS_STATUS_STABLE}
          >
            {hoverInfo ? getVisibleStatusText(hoverInfo, compactStatus) : "\u2014"}
          </div>
        </div>
        <div className="panel-sidebar">
          <HexDiagram
            candidateIndexByLevel={candidateIndexByLevel}
            dispatch={candidateIndexDispatch}
            levelHistogram={levelHistogram}
            total={total}
            lockedLevels={lockedLevels}
            onToggleLock={toggleLevelLock}
            onRandomize={handleRandomize}
            canRandomize={canRandomize}
          />
          {/* Pattern info — 3 aligned rows: labels, dots, ∏ᵢcᵢ = counts × ... = total */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.lg, marginTop: -SP.lg }}>
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
                const active = levelHistogram[lv] > 0;
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
                const active = levelHistogram[lv] > 0;
                const cands = LEVEL_CANDIDATES[lv];
                const rgb = cands[candidateIndexByLevel[lv] % cands.length]?.rgb ?? [128, 128, 128];
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
                const active = levelHistogram[lv] > 0;
                const mulActive = lv > 0 && levelHistogram[lv - 1] > 0 && levelHistogram.slice(lv).some((h) => h > 0);
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
              <button style={S_UNLOCK_ALL_BUTTON} onClick={handleUnlockAll}>
                {t("btn_unlock_all")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

import React, { useMemo } from "react";
import { S_BTN } from "../styles";
import { C, SP, FS, FW, R } from "../tokens";
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
  patternInfo: { total: number; expanded: string };
  t: TranslationFn;
}

const S_FLEX_COL_CENTER: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center" };
const S_LABEL: React.CSSProperties = { fontSize: FS.md, color: C.textDim, minHeight: 16 };
const S_SUBLABEL: React.CSSProperties = { fontSize: FS.md, color: C.textSubtle, marginTop: SP.xl };
const S_HEX_ACTIONS: React.CSSProperties = { marginTop: 10, marginBottom: SP.md, display: "flex", alignItems: "center", justifyContent: "center", gap: SP.xl, flexWrap: "wrap" };
const S_PATTERN_TEXT: React.CSSProperties = { fontSize: FS.md, color: C.textDimmer };

export const HexTab = React.memo(function HexTab(props: HexTabProps) {
  const {
    hexPrvRef, displayW, displayH,
    cc, ccDispatch, hist, total, locked,
    toggleLock, handleRandomize, handleUnlockAll, patternInfo, t,
  } = props;

  const hasLocked = useMemo(() => locked.some(Boolean), [locked]);

  return (
    <div style={S_FLEX_COL_CENTER}>
      <div style={S_LABEL}>{t("label_colorized")}</div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: "hidden", position: "relative", width: displayW, height: displayH }}>
        <canvas ref={hexPrvRef}
          style={{ width: displayW, height: displayH, display: "block", imageRendering: "pixelated" }} />
      </div>
      <div style={S_SUBLABEL}>{t("hex_title")}</div>
      <HexDiag cc={cc} dispatch={ccDispatch} hist={hist} total={total} locked={locked} onToggleLock={toggleLock} />
      <div style={S_HEX_ACTIONS}>
        <button style={{ ...S_BTN, background: C.bgSurfaceAlt, color: C.accentBright, fontWeight: FW.bold }} title={t("title_random_color")} onClick={handleRandomize}>
          {t("btn_random_color")}
        </button>
        {hasLocked && (
          <button style={S_BTN} onClick={handleUnlockAll}>
            {t("btn_unlock_all")}
          </button>
        )}
        <span style={S_PATTERN_TEXT}>
          {"\u220F\u1D62c\u1D62 = "}{patternInfo.expanded}{" = "}{t("random_patterns", patternInfo.total)}
        </span>
      </div>
    </div>
  );
});

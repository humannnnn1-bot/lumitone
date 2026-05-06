import React from "react";

import type { TranslationFn } from "../i18n";
import { C, FS, FONT, FW, Z } from "../styles/tokens";

interface PwaUpdateToastProps {
  reloading: boolean;
  onReload: () => void;
  onDismiss: () => void;
  t: TranslationFn;
}

const S_UPDATE_TOAST: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  maxWidth: "calc(100vw - 24px)",
  padding: "10px 14px",
  borderRadius: 10,
  background: C.accent,
  color: C.textWhite,
  fontSize: FS.md,
  fontFamily: FONT.mono,
  fontWeight: FW.bold,
  zIndex: Z.toast,
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  animation: "toast-in 0.2s ease-out",
};

const S_UPDATE_ACTION: React.CSSProperties = {
  border: `1px solid rgba(255,255,255,0.65)`,
  borderRadius: 6,
  background: "rgba(255,255,255,0.14)",
  color: C.textWhite,
  cursor: "pointer",
  padding: "4px 8px",
  whiteSpace: "nowrap",
};

const S_UPDATE_MESSAGE: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const S_UPDATE_DISMISS: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: C.textWhite,
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
  padding: "2px 4px",
};

export const PwaUpdateToast = React.memo(function PwaUpdateToast({ reloading, onReload, onDismiss, t }: PwaUpdateToastProps) {
  return (
    <div role="status" aria-live="polite" style={S_UPDATE_TOAST}>
      <span style={S_UPDATE_MESSAGE}>{t("pwa_update_available")}</span>
      <button type="button" onClick={onReload} disabled={reloading} style={S_UPDATE_ACTION}>
        {reloading ? t("pwa_update_reloading") : t("pwa_update_reload")}
      </button>
      <button type="button" onClick={onDismiss} aria-label={t("pwa_update_dismiss")} style={S_UPDATE_DISMISS}>
        {"\u00d7"}
      </button>
    </div>
  );
});

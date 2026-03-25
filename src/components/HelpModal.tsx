import React, { useCallback } from "react";
import { S_BTN } from "../styles";
import { useTranslation } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { C, Z, SP, FS, FW, R } from "../tokens";

interface HelpModalProps {
  showHelp: boolean;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
  helpRef: React.RefObject<HTMLDivElement | null>;
}

export const HelpModal = React.memo(function HelpModal({ showHelp, setShowHelp, helpRef }: HelpModalProps) {
  const { t } = useTranslation();

  useFocusTrap(helpRef, showHelp);

  const handleClose = useCallback(() => setShowHelp(false), [setShowHelp]);
  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  if (!showHelp) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bgOverlay, zIndex: Z.modal, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={handleClose}>
      <div ref={helpRef} role="dialog" aria-modal="true" aria-label={t("help_title")}
        style={{ background: C.bgSurfaceHover, border: `1px solid ${C.borderHover}`, borderRadius: R["2xl"], padding: SP["4xl"], maxWidth: "min(360px, calc(100vw - 32px))", maxHeight: "80vh", overflowY: "auto", fontFamily: "monospace", fontSize: FS.lg, color: C.textPrimary }}
        onClick={stopPropagation}>
        <div style={{ fontSize: FS["2xl"], fontWeight: FW.bold, marginBottom: 12, color: C.accentBright }}>{t("help_title")}</div>
        {[
          ["B", t("help_brush")], ["E", t("help_eraser")], ["F", t("help_fill")],
          ["L", t("help_line")], ["R", t("help_rect")], ["O", t("help_ellipse")],
          ["0-7", t("help_level")], ["[ / ]", t("help_brush_size")],
          [t("help_pan_key"), t("help_pan")], [t("help_zoom_key"), t("help_zoom")],
          ["Ctrl+N", t("help_new_canvas")],
          ["Ctrl+Z", t("help_undo")], ["Ctrl+Y / \u2318\u21E7Z", t("help_redo")],
          [t("help_save_key"), t("help_save")],
          [t("help_save_as_key"), t("help_save_as")],
          ["Ctrl+V", t("help_paste")], ["?/F1", t("help_this_help")], ["Esc", t("help_close")],
          [t("help_eyedropper_key"), t("help_eyedropper")],
          [t("help_dblclick_level_key"), t("help_dblclick_level")],
          [t("help_zoom_pixel_key"), t("help_zoom_pixel")],
        ].map(([k, v]) =>
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.accentBright, fontWeight: FW.bold, minWidth: 120 }}>{k}</span>
            <span style={{ color: C.textSecondary }}>{v}</span>
          </div>)}
        <button onClick={handleClose} tabIndex={0}
          style={{ ...S_BTN, marginTop: 12, width: "100%", textAlign: "center" }}>{t("help_close")}</button>
      </div>
    </div>
  );
});

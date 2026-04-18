import React, { useState, useCallback, useEffect, useRef } from "react";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import { MAX_IMAGE_SIZE } from "../constants";
import { useTranslation } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { C, Z, SP, FS, R } from "../tokens";

interface NewCanvasModalProps {
  open: boolean;
  onConfirm: (w: number, h: number) => void;
  onCancel: () => void;
}

export const NewCanvasModal = React.memo(function NewCanvasModal({ open, onConfirm, onCancel }: NewCanvasModalProps) {
  const { t } = useTranslation();
  const [w, setW] = useState(320);
  const [h, setH] = useState(320);

  const widthRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setW(320);
      setH(320);
      // Focus width input on desktop only; skip on touch to avoid popping up the
      // virtual keyboard before the user asks for it.
      const isTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window || !window.matchMedia("(pointer: fine)").matches;
      if (!isTouch) {
        requestAnimationFrame(() => widthRef.current?.focus());
      }
    }
  }, [open]);

  useFocusTrap(modalRef, open, onCancel);

  const handleConfirm = useCallback(() => {
    const cw = Number.isFinite(w) ? Math.max(1, Math.min(MAX_IMAGE_SIZE, Math.round(w))) : 320;
    const ch = Number.isFinite(h) ? Math.max(1, Math.min(MAX_IMAGE_SIZE, Math.round(h))) : 320;
    onConfirm(cw, ch);
  }, [w, h, onConfirm]);

  if (!open) return null;

  const presets = [
    { label: "8\u00D78", w: 8, h: 8 },
    { label: "16\u00D716", w: 16, h: 16 },
    { label: "32\u00D732", w: 32, h: 32 },
    { label: "64\u00D764", w: 64, h: 64 },
    { label: "128\u00D7128", w: 128, h: 128 },
    { label: "256\u00D7256", w: 256, h: 256 },
    { label: "320\u00D7320", w: 320, h: 320 },
    { label: "512\u00D7512", w: 512, h: 512 },
    { label: "1024\u00D71024", w: 1024, h: 1024 },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: C.bgOverlay,
        zIndex: Z.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("new_canvas_title")}
        style={{
          background: C.bgModal,
          border: `1px solid ${C.borderHover}`,
          borderRadius: R["2xl"],
          padding: SP["4xl"],
          minWidth: "min(280px, calc(100vw - 32px))",
          maxHeight: "80vh",
          overflowY: "auto",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: FS["2xl"], fontWeight: 700, color: C.textPrimary, marginBottom: SP["2xl"] }}>{t("new_canvas_title")}</div>
        <div style={{ display: "flex", gap: SP.xl, justifyContent: "center", alignItems: "center", marginBottom: SP["2xl"] }}>
          <label style={{ fontSize: FS.lg, color: C.textSecondary }}>
            W:{" "}
            <input
              ref={widthRef}
              type="number"
              min={1}
              max={MAX_IMAGE_SIZE}
              value={w}
              onChange={(e) => setW(+e.target.value)}
              aria-label={t("aria_canvas_width")}
              style={{
                width: 60,
                background: C.bgInput,
                border: `1px solid ${C.border}`,
                color: C.textPrimary,
                borderRadius: R.lg,
                padding: "2px 6px",
                fontSize: FS.xl,
              }}
            />
          </label>
          <span style={{ color: C.textDimmer }}>{"\u00D7"}</span>
          <label style={{ fontSize: FS.lg, color: C.textSecondary }}>
            H:{" "}
            <input
              type="number"
              min={1}
              max={MAX_IMAGE_SIZE}
              value={h}
              onChange={(e) => setH(+e.target.value)}
              aria-label={t("aria_canvas_height")}
              style={{
                width: 60,
                background: C.bgInput,
                border: `1px solid ${C.border}`,
                color: C.textPrimary,
                borderRadius: R.lg,
                padding: "2px 6px",
                fontSize: FS.xl,
              }}
            />
          </label>
        </div>
        <div style={{ fontSize: FS.sm, color: C.textSubtle, marginBottom: 8 }}>
          {t("new_canvas_max")} {MAX_IMAGE_SIZE}
          {"\u00D7"}
          {MAX_IMAGE_SIZE}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, alignItems: "center", marginBottom: SP["2xl"] }}>
          {[presets.slice(0, 5), presets.slice(5)].map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: SP.md, justifyContent: "center" }}>
              {row.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setW(p.w);
                    setH(p.h);
                  }}
                  style={{
                    ...S_BTN,
                    padding: "2px 8px",
                    fontSize: FS.sm,
                    ...(w === p.w && h === p.h ? { border: `1px solid ${C.accent}`, color: C.accentBright } : {}),
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: SP.xl, justifyContent: "center" }}>
          <button onClick={handleConfirm} style={{ ...S_BTN_ACTIVE, padding: "6px 20px" }}>
            {t("btn_create")}
          </button>
          <button onClick={onCancel} style={{ ...S_BTN, padding: "6px 20px" }}>
            {t("btn_cancel")}
          </button>
        </div>
      </div>
    </div>
  );
});

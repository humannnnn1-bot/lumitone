import React, { useState, useEffect, useRef, useCallback } from "react";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import { useTranslation } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { C, Z, SP, FS, R } from "../tokens";

interface PromptModalProps {
  open: boolean;
  title: string;
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal = React.memo(function PromptModal({ open, title, defaultValue, onConfirm, onCancel }: PromptModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, defaultValue]);

  useFocusTrap(modalRef, open, onCancel);

  const handleConfirm = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }, [value, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
  }, [handleConfirm]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bgOverlay, zIndex: Z.modal, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onCancel}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={title}
        style={{ background: C.bgSurfaceHover, border: `1px solid ${C.borderHover}`, borderRadius: R["2xl"], padding: SP["4xl"], minWidth: "min(300px, calc(100vw - 32px))", maxHeight: "80vh", overflowY: "auto", textAlign: "center" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: FS.xl, fontWeight: 700, color: C.textPrimary, marginBottom: 12 }}>{title}</div>
        <input ref={inputRef} type="text" value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: "100%", boxSizing: "border-box", background: C.bgInput, border: `1px solid ${C.border}`, color: C.textPrimary, borderRadius: R.lg, padding: "6px 10px", fontSize: FS.xl, fontFamily: "monospace" }} />
        <div style={{ display: "flex", gap: SP.xl, justifyContent: "center", marginTop: 12 }}>
          <button onClick={handleConfirm} style={{ ...S_BTN_ACTIVE, padding: "6px 20px" }}>{t("btn_ok")}</button>
          <button onClick={onCancel} style={{ ...S_BTN, padding: "6px 20px" }}>{t("btn_cancel")}</button>
        </div>
      </div>
    </div>
  );
});

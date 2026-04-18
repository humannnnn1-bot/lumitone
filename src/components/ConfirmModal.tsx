import React, { useRef, useEffect } from "react";
import { S_BTN, S_BTN_ACTIVE } from "../styles";
import { useTranslation } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { C, Z, SP, FS, FW, R } from "../tokens";

interface ConfirmModalProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = React.memo(function ConfirmModal({ open, message, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const yesBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => yesBtnRef.current?.focus());
  }, [open]);

  useFocusTrap(modalRef, open, onCancel);

  if (!open) return null;

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
        aria-label={message}
        style={{
          background: C.bgModal,
          border: `1px solid ${C.borderHover}`,
          borderRadius: R["2xl"],
          padding: SP["4xl"],
          minWidth: "min(260px, calc(100vw - 32px))",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: FS.xl, fontWeight: FW.bold, color: C.textPrimary, marginBottom: SP["2xl"] }}>{message}</div>
        <div style={{ display: "flex", gap: SP.xl, justifyContent: "center" }}>
          <button ref={yesBtnRef} onClick={onConfirm} style={{ ...S_BTN_ACTIVE, padding: "6px 24px" }}>
            {t("btn_yes")}
          </button>
          <button onClick={onCancel} style={{ ...S_BTN, padding: "6px 24px" }}>
            {t("btn_no")}
          </button>
        </div>
      </div>
    </div>
  );
});

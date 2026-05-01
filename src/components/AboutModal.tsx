import React, { useCallback, useRef } from "react";
import { S_BTN } from "../styles/shared";
import { useTranslation } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { C, Z, SP, FS, FW, R, FONT } from "../styles/tokens";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export const AboutModal = React.memo(function AboutModal({ open, onClose }: AboutModalProps) {
  const { t } = useTranslation();
  const aboutRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(aboutRef, open, onClose);

  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

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
      onClick={onClose}
    >
      <div
        ref={aboutRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("about_title")}
        style={{
          background: C.bgModal,
          border: `1px solid ${C.borderHover}`,
          borderRadius: R["2xl"],
          padding: SP["4xl"],
          maxWidth: "min(520px, calc(100vw - 32px))",
          maxHeight: "80vh",
          overflowY: "auto",
          fontFamily: FONT.sans,
          fontSize: FS.xl,
          lineHeight: 1.6,
          color: C.textPrimary,
        }}
        onClick={stopPropagation}
      >
        <h2
          style={{
            fontFamily: FONT.mono,
            fontSize: FS["2xl"],
            fontWeight: FW.bold,
            margin: `0 0 ${SP["2xl"]}px`,
            color: C.accentBright,
            textAlign: "center",
          }}
        >
          {t("about_title")}
        </h2>
        {[t("about_body_1"), t("about_body_2"), t("about_body_3")].map((paragraph) => (
          <p key={paragraph} style={{ margin: `0 0 ${SP["2xl"]}px`, color: C.textSecondary }}>
            {paragraph}
          </p>
        ))}
        <button onClick={onClose} tabIndex={0} style={{ ...S_BTN, marginTop: SP.sm, width: "100%", textAlign: "center" }}>
          {t("help_close")}
        </button>
      </div>
    </div>
  );
});

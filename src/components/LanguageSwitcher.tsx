import React from "react";
import { useTranslation } from "../i18n";
import { C, FS, FW } from "../styles/tokens";

export const LanguageSwitcher = React.memo(function LanguageSwitcher() {
  const { lang, setLang, t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ja" ? "en" : "ja")}
      aria-label={t("lang_switch_label")}
      title={t("lang_switch_label")}
      style={{
        background: "none",
        border: "none",
        color: C.textDimmest,
        cursor: "pointer",
        padding: 0,
        fontSize: FS.sm,
        fontWeight: FW.bold,
        fontFamily: "inherit",
      }}
    >
      {t("lang_switch")}
    </button>
  );
});

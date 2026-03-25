import React from "react";
import { useTranslation } from "../i18n";
import { C, SP, FS, FW, R } from "../tokens";

export const LanguageSwitcher = React.memo(function LanguageSwitcher() {
  const { lang, setLang, t } = useTranslation();
  return (
    <button
      onClick={() => setLang(lang === "ja" ? "en" : "ja")}
      style={{ background: "none", border: `1px solid ${C.borderHover}`, color: C.textDimmest, borderRadius: R.md, cursor: "pointer", padding: `0 ${SP.md}px`, fontSize: FS.sm, fontWeight: FW.bold }}
    >
      {t("lang_switch")}
    </button>
  );
});

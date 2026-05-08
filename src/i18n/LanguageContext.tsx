import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { ja } from "./ja";
import { en } from "./en";
import type { Language, Translations, TranslationKey, TranslationFn } from "./types";

const dictionaries: Record<Language, Translations> = { ja, en };
const STORAGE_KEY = "chromalum_lang";

function getInitialLang(): Language {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "ja" || stored === "en") return stored;
  } catch {
    // Fall back to browser language when storage is unavailable.
  }
  return typeof navigator !== "undefined" && navigator.language.startsWith("ja") ? "ja" : "en";
}

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationFn;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(getInitialLang);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Language switching should still work when storage is blocked.
    }
  }, []);

  // Keep the document language in sync with the active UI language.
  // RTL support: add document.documentElement.dir = "rtl" here when adding RTL languages.
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey | (string & {}), ...params: (string | number)[]): string => {
      let str = dictionaries[lang][key] ?? key;
      for (let i = 0; i < params.length; i++) {
        str = str.replace(`{${i}}`, String(params[i]));
      }
      return str;
    },
    [lang],
  );

  return <LanguageContext value={{ lang, setLang, t }}>{children}</LanguageContext>;
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within a LanguageProvider");
  return ctx;
}

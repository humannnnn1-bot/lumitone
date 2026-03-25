import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { ja } from "./ja";
import { en } from "./en";
import type { Language, Translations, TranslationKey, TranslationFn } from "./types";

const dictionaries: Record<Language, Translations> = { ja, en };
const STORAGE_KEY = "chromalum_lang";

function getInitialLang(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "ja" || stored === "en") return stored;
  return navigator.language.startsWith("ja") ? "ja" : "en";
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
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  // Initial lang attribute set (setLang handles subsequent changes).
  // RTL support: add document.documentElement.dir = "rtl" here when adding RTL languages.
  useEffect(() => { document.documentElement.lang = lang; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = useCallback((key: TranslationKey | (string & {}), ...params: (string | number)[]): string => {
    let str = dictionaries[lang][key] ?? key;
    for (let i = 0; i < params.length; i++) {
      str = str.replace(`{${i}}`, String(params[i]));
    }
    return str;
  }, [lang]);

  return (
    <LanguageContext value={{ lang, setLang, t }}>
      {children}
    </LanguageContext>
  );
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within a LanguageProvider");
  return ctx;
}

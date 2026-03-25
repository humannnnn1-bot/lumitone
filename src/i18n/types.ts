export type Language = "ja" | "en";
export type Translations = Record<string, string>;

/** Type-safe translation key derived from en.ts (the source of truth). */
export type TranslationKey = keyof typeof import("./en").en;

/** Translation function type. Accepts known keys with autocomplete, plus arbitrary strings for dynamic usage. */
export type TranslationFn = (key: TranslationKey | (string & {}), ...params: (string | number)[]) => string;

import { useState, useRef, useCallback, useEffect } from "react";
import { TOAST_DURATION } from "../constants";
import { MAIN_TABS } from "../tabs";
import type { MapMode } from "../types";
import type { TranslationFn } from "../i18n";

const LS_TAB = "chromalum-active-tab-v2";
const LS_SCROLL = "chromalum-scroll-y";
const DEFAULT_TAB = 2;
const STATS_TAB = 5;
const HISTORY_TAB_STATE_KEY = "chromalumActiveTab";
const TAB_HASH_LOOKUP = new Map<string, number>(MAIN_TABS.map(({ hash }, tab) => [hash, tab]));
TAB_HASH_LOOKUP.set("stats", STATS_TAB);

function isValidTab(tab: unknown): tab is number {
  return typeof tab === "number" && Number.isInteger(tab) && tab >= 0 && tab < MAIN_TABS.length;
}

function normalizeHash(hash: string): string {
  let value = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw value when the URL contains malformed percent escapes.
  }
  return value.trim().toLowerCase().replace(/^\/+/, "");
}

function readTabFromHash(): number | null {
  if (typeof window === "undefined") return null;
  return TAB_HASH_LOOKUP.get(normalizeHash(window.location.hash)) ?? null;
}

function readStoredTab(): number | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const saved = localStorage.getItem(LS_TAB);
    if (saved === null) return null;
    const tab = Number(saved);
    return isValidTab(tab) ? tab : null;
  } catch {
    return null;
  }
}

function writeStoredTab(tab: number): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_TAB, String(tab));
  } catch {
    // URL/history state still preserves navigation when storage is unavailable.
  }
}

function readInitialActiveTab(): number {
  return readTabFromHash() ?? readStoredTab() ?? DEFAULT_TAB;
}

function getHistoryStateWithTab(tab: number): object {
  const state = typeof window !== "undefined" ? window.history.state : null;
  return state && typeof state === "object" ? { ...state, [HISTORY_TAB_STATE_KEY]: tab } : { [HISTORY_TAB_STATE_KEY]: tab };
}

function replaceCurrentHistoryState(tab: number): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(getHistoryStateWithTab(tab), "", window.location.href);
}

function pushTabHash(tab: number): void {
  if (typeof window === "undefined") return;
  const hash = MAIN_TABS[tab].hash;
  if (normalizeHash(window.location.hash) === hash) {
    replaceCurrentHistoryState(tab);
    return;
  }
  window.history.pushState(getHistoryStateWithTab(tab), "", `#${hash}`);
}

function readTabFromHistoryState(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const tab = (state as Record<string, unknown>)[HISTORY_TAB_STATE_KEY];
  return isValidTab(tab) ? tab : null;
}

export function useUIState(_t: TranslationFn) {
  const [activeTab, setActiveTabRaw] = useState(readInitialActiveTab);
  const [hasOpenedStats, setHasOpenedStats] = useState(() => activeTab === STATS_TAB);
  const setActiveTab = useCallback((tab: number) => {
    if (!isValidTab(tab)) return;
    setActiveTabRaw(tab);
    if (tab === STATS_TAB) setHasOpenedStats(true);
    writeStoredTab(tab);
    pushTabHash(tab);
  }, []);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("luminance");
  const [hueAngle, setHueAngle] = useState(0);
  const [directCandidates, setDirectCandidates] = useState<Map<number, number>>(new Map());

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialActiveTabRef = useRef(activeTab);

  useEffect(() => {
    replaceCurrentHistoryState(initialActiveTabRef.current);

    const applyTab = (tab: number) => {
      setActiveTabRaw(tab);
      if (tab === STATS_TAB) setHasOpenedStats(true);
      writeStoredTab(tab);
      replaceCurrentHistoryState(tab);
    };
    const onPopState = (event: PopStateEvent) => {
      const tab = readTabFromHistoryState(event.state) ?? readTabFromHash();
      if (tab !== null) applyTab(tab);
    };
    const onHashChange = () => {
      const tab = readTabFromHash();
      if (tab !== null) applyTab(tab);
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const showToast = useCallback((message: string, type: "error" | "success" | "info" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION);
  }, []);

  /* Persist scroll position on beforeunload, restore on mount */
  useEffect(() => {
    try {
      const savedY = localStorage.getItem(LS_SCROLL);
      if (savedY !== null) {
        const y = Number(savedY);
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    } catch {
      // Ignore blocked storage; scroll persistence is best-effort.
    }
    const onBeforeUnload = () => {
      try {
        localStorage.setItem(LS_SCROLL, String(window.scrollY));
      } catch {
        // Ignore blocked storage; scroll persistence is best-effort.
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    activeTab,
    setActiveTab,
    hasOpenedStats,
    showHelp,
    setShowHelp,
    toast,
    showToast,
    showNewCanvas,
    setShowNewCanvas,
    mapMode,
    setMapMode,
    hueAngle,
    setHueAngle,
    directCandidates,
    setDirectCandidates,
    toastTimerRef,
  };
}

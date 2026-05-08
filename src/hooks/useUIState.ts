import { useState, useRef, useCallback, useEffect } from "react";
import { TOAST_DURATION } from "../constants";
import { DEFAULT_TAB_ID, MAIN_TABS, STATS_TAB_ID, tabFromId, tabIdFromIndex, tabIndexFromId } from "../tabs";
import type { MainTabId } from "../tabs";
import type { MapMode } from "../types";
import type { TranslationFn } from "../i18n";

const LS_TAB = "chromalum-active-tab-v2";
const LS_SCROLL = "chromalum-scroll-y";
const HISTORY_TAB_STATE_KEY = "chromalumActiveTab";
const TAB_HASH_LOOKUP = new Map<string, MainTabId>(MAIN_TABS.map(({ hash, id }) => [hash, id]));
TAB_HASH_LOOKUP.set("stats", STATS_TAB_ID);

function isValidTabIndex(tab: unknown): tab is number {
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

function readTabFromHash(): MainTabId | null {
  if (typeof window === "undefined") return null;
  return TAB_HASH_LOOKUP.get(normalizeHash(window.location.hash)) ?? null;
}

function readStoredTab(): MainTabId | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const saved = localStorage.getItem(LS_TAB);
    if (saved === null) return null;
    const tab = Number(saved);
    return isValidTabIndex(tab) ? tabIdFromIndex(tab) : null;
  } catch {
    return null;
  }
}

function writeStoredTab(tabId: MainTabId): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_TAB, String(tabIndexFromId(tabId)));
  } catch {
    // URL/history state still preserves navigation when storage is unavailable.
  }
}

function readInitialActiveTab(): MainTabId {
  return readTabFromHash() ?? readStoredTab() ?? DEFAULT_TAB_ID;
}

function getHistoryStateWithTab(tabId: MainTabId): object {
  const state = typeof window !== "undefined" ? window.history.state : null;
  const tab = tabIndexFromId(tabId);
  return state && typeof state === "object" ? { ...state, [HISTORY_TAB_STATE_KEY]: tab } : { [HISTORY_TAB_STATE_KEY]: tab };
}

function replaceCurrentHistoryState(tabId: MainTabId): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(getHistoryStateWithTab(tabId), "", window.location.href);
}

function pushTabHash(tabId: MainTabId): void {
  if (typeof window === "undefined") return;
  const hash = tabFromId(tabId).hash;
  if (normalizeHash(window.location.hash) === hash) {
    replaceCurrentHistoryState(tabId);
    return;
  }
  window.history.pushState(getHistoryStateWithTab(tabId), "", `#${hash}`);
}

function readTabFromHistoryState(state: unknown): MainTabId | null {
  if (!state || typeof state !== "object") return null;
  const tab = (state as Record<string, unknown>)[HISTORY_TAB_STATE_KEY];
  return isValidTabIndex(tab) ? tabIdFromIndex(tab) : null;
}

export function useUIState(_t: TranslationFn) {
  const [activeTabId, setActiveTabIdRaw] = useState(readInitialActiveTab);
  const activeTab = tabIndexFromId(activeTabId);
  const [hasOpenedStats, setHasOpenedStats] = useState(() => activeTabId === STATS_TAB_ID);
  const setActiveTabId = useCallback((tabId: MainTabId) => {
    setActiveTabIdRaw(tabId);
    if (tabId === STATS_TAB_ID) setHasOpenedStats(true);
    writeStoredTab(tabId);
    pushTabHash(tabId);
  }, []);
  const setActiveTab = useCallback(
    (tab: number) => {
      const tabId = tabIdFromIndex(tab);
      if (tabId === null) return;
      setActiveTabId(tabId);
    },
    [setActiveTabId],
  );
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("luminance");
  const [hueAngle, setHueAngle] = useState(0);
  const [directCandidates, setDirectCandidates] = useState<Map<number, number>>(new Map());

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialActiveTabIdRef = useRef(activeTabId);

  useEffect(() => {
    replaceCurrentHistoryState(initialActiveTabIdRef.current);

    const applyTab = (tabId: MainTabId) => {
      setActiveTabIdRaw(tabId);
      if (tabId === STATS_TAB_ID) setHasOpenedStats(true);
      writeStoredTab(tabId);
      replaceCurrentHistoryState(tabId);
    };
    const onPopState = (event: PopStateEvent) => {
      const tabId = readTabFromHistoryState(event.state) ?? readTabFromHash();
      if (tabId !== null) applyTab(tabId);
    };
    const onHashChange = () => {
      const tabId = readTabFromHash();
      if (tabId !== null) applyTab(tabId);
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
    activeTabId,
    setActiveTab,
    setActiveTabId,
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

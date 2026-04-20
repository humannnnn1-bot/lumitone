import { useState, useRef, useCallback, useEffect } from "react";
import { TOAST_DURATION } from "../constants";
import type { MapMode } from "../components/analyze-types";
import type { TranslationFn } from "../i18n";

const LS_TAB = "chromalum-active-tab-v2";
const LS_SCROLL = "chromalum-scroll-y";

export function useUIState(_t: TranslationFn) {
  const [activeTab, setActiveTabRaw] = useState(() => {
    const saved = localStorage.getItem(LS_TAB);
    return saved !== null ? Number(saved) : 2;
  });
  const setActiveTab = useCallback((tab: number) => {
    setActiveTabRaw(tab);
    localStorage.setItem(LS_TAB, String(tab));
  }, []);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("luminance");
  const [hueAngle, setHueAngle] = useState(0);
  const [directCandidates, setDirectCandidates] = useState<Map<number, number>>(new Map());

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const savedY = localStorage.getItem(LS_SCROLL);
    if (savedY !== null) {
      const y = Number(savedY);
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
    const onBeforeUnload = () => {
      localStorage.setItem(LS_SCROLL, String(window.scrollY));
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    activeTab,
    setActiveTab,
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

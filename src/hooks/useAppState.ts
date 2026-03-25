import { useState, useRef, useEffect, useCallback, useReducer, useMemo } from "react";
import { buildColorLUT, DEFAULT_CC, LEVEL_CANDIDATES } from "../color-engine";
import { DISPLAY_MIN, DISPLAY_MAX_LIMIT, TOAST_DURATION, LEVEL_COUNT } from "../constants";
import type { ToolId, GlazeToolId } from "../constants";
import { canvasReducer, initialState } from "../canvas-reducer";
import { colorReducer } from "../color-reducer";
import { saveState, loadState } from "../utils/idb-persistence";
import { createErrorHandler } from "../error-handler";
import type { MapMode } from "../components/StatsPanel";

export function useAppState(t: import("../i18n").TranslationFn) {
  const [state, dispatch] = useReducer(canvasReducer, initialState);
  const { cvs } = state;
  const [cc, ccDispatch] = useReducer(colorReducer, [...DEFAULT_CC]);

  const [brushLevel, setBrushLevel] = useState(7);
  const [brushSize, setBrushSize] = useState(12);
  const [tool, setTool] = useState<ToolId>("brush");
  const [activeTab, setActiveTab] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState<boolean[]>(new Array(LEVEL_COUNT).fill(false));
  const [mapMode, setMapMode] = useState<MapMode>("region");
  const [hueAngle, setHueAngle] = useState(0);
  const [glazeTool, setGlazeTool] = useState<GlazeToolId>("glaze_brush");
  const [directCandidates, setDirectCandidates] = useState<Map<number, number>>(new Map());
  const [promptState, setPromptState] = useState<{ defaultValue: string; resolve: (v: string | null) => void } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ data: Uint8Array | null; colorMap: Uint8Array | null; cc: number[] | null; locked: boolean[] | null }>({ data: null, colorMap: null, cc: null, locked: null });

  const showToast = useCallback((message: string, type: "error" | "success" | "info" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, TOAST_DURATION);
  }, []);

  // Restore state from IndexedDB on mount
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    loadState().then(saved => {
      if (saved) {
        dispatch({ type: "load_image", w: saved.w, h: saved.h, data: saved.data, ...(saved.colorMap ? { colorMap: saved.colorMap } : {}) });
        ccDispatch({ type: "load_all", values: saved.cc });
        if (saved.locked) setLocked(saved.locked);
      }
    }).catch(
      createErrorHandler("Restore", () => showToast(t("toast_restore_failed"), "error")),
    ).finally(() => setLoaded(true));
  }, [showToast, t]);

  // Auto-save to IndexedDB on changes (debounced, skip if unchanged)
  useEffect(() => {
    if (!loaded) return;
    const prev = lastSavedRef.current;
    // Skip save if all references are identical (React immutable state pattern)
    if (prev.data === cvs.data && prev.colorMap === cvs.colorMap && prev.cc === cc && prev.locked === locked) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const _cvs = cvs, _cc = cc, _locked = locked;
    saveTimerRef.current = setTimeout(() => {
      lastSavedRef.current = { data: _cvs.data, colorMap: _cvs.colorMap, cc: _cc, locked: _locked };
      saveState({ w: _cvs.w, h: _cvs.h, data: _cvs.data, colorMap: new Uint8Array(_cvs.colorMap), cc: [..._cc], locked: [..._locked], version: 1 }).catch(
        createErrorHandler("AutoSave", () => showToast(t("toast_autosave_failed"), "error")),
      );
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [cvs, cc, locked, loaded, showToast, t]);

  const colorLUT = useMemo(() => buildColorLUT(cc), [cc]);

  // Responsive display size based on viewport width AND height
  const computeDisplayMax = () => {
    if (typeof window === "undefined") return 640;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const UI_OVERHEAD = 280; // ヘッダー + タブ + コントロール用の余白
    const fromW = Math.floor(w - 32);        // 左右パディング分
    const fromH = Math.floor(h - UI_OVERHEAD); // UI要素分
    return Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX_LIMIT, fromW, fromH));
  };
  const [displayMax, setDisplayMax] = useState(computeDisplayMax);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setDisplayMax(computeDisplayMax()), 200);
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (timer) clearTimeout(timer); };
  }, []);

  const { displayW, displayH } = useMemo(() => {
    const safeW = Math.max(1, cvs.w), safeH = Math.max(1, cvs.h);
    const asp = safeW / safeH, mx = displayMax;
    return {
      displayW: asp >= 1 ? mx : Math.round(mx * asp),
      displayH: asp >= 1 ? Math.round(mx / asp) : mx,
    };
  }, [cvs.w, cvs.h, displayMax]);

  const toggleLock = useCallback((lv: number) => {
    setLocked(prev => { const n = [...prev]; n[lv] = !n[lv]; return n; });
  }, []);

  const handleRandomize = useCallback(() => {
    ccDispatch({ type: "randomize", locked });
  }, [ccDispatch, locked]);

  const handleUnlockAll = useCallback(() => {
    setLocked(new Array(LEVEL_COUNT).fill(false));
  }, []);

  const patternInfo = useMemo(() => {
    const allC: number[] = [];
    for (let lv = 0; lv < LEVEL_CANDIDATES.length; lv++) {
      const c = LEVEL_CANDIDATES[lv].length;
      allC.push((state.hist[lv] > 0 && !locked[lv]) ? c : 1);
    }
    const total = allC.reduce((a, b) => a * b, 1);
    const expanded = allC.join("\u00d7");
    return { total, expanded };
  }, [state.hist, locked]);

  const requestFilename = useCallback((defaultValue: string): Promise<string | null> => {
    return new Promise(resolve => { setPromptState({ defaultValue, resolve }); });
  }, []);

  const handlePromptConfirm = useCallback((value: string) => {
    promptState?.resolve(value);
    setPromptState(null);
  }, [promptState]);

  const handlePromptCancel = useCallback(() => {
    promptState?.resolve(null);
    setPromptState(null);
  }, [promptState]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  return {
    state, dispatch, cvs, cc, ccDispatch,
    brushLevel, setBrushLevel, brushSize, setBrushSize,
    tool, setTool,
    activeTab, setActiveTab,
    showHelp, setShowHelp,
    toast, showToast,
    showNewCanvas, setShowNewCanvas,
    loaded, locked, setLocked,
    mapMode, setMapMode,
    hueAngle, setHueAngle, glazeTool, setGlazeTool, directCandidates, setDirectCandidates,
    promptState, setPromptState,
    colorLUT, displayW, displayH,
    toggleLock, handleRandomize, handleUnlockAll, patternInfo,
    requestFilename, handlePromptConfirm, handlePromptCancel,
  };
}

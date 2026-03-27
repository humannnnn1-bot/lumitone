import { useState, useRef, useEffect, useReducer, useMemo } from "react";
import { DISPLAY_MIN, DISPLAY_MAX_LIMIT } from "../constants";
import { canvasReducer, initialState } from "../canvas-reducer";
import { saveState, loadState } from "../utils/idb-persistence";
import { createErrorHandler } from "../error-handler";
import { useToolState } from "./useToolState";
import { useUIState } from "./useUIState";
import { useColorState } from "./useColorState";

export function useAppState(t: import("../i18n").TranslationFn) {
  const [state, dispatch] = useReducer(canvasReducer, initialState);
  const { cvs } = state;

  const toolState = useToolState();
  const uiState = useUIState(t);
  const colorState = useColorState(state.hist);

  const { showToast, toastTimerRef } = uiState;
  const { cc, ccDispatch, locked, setLocked } = colorState;

  const [loaded, setLoaded] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ data: Uint8Array | null; colorMap: Uint8Array | null; cc: number[] | null; locked: boolean[] | null }>({
    data: null,
    colorMap: null,
    cc: null,
    locked: null,
  });

  // Restore state from IndexedDB on mount
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    loadState()
      .then((saved) => {
        if (saved) {
          dispatch({
            type: "load_image",
            w: saved.w,
            h: saved.h,
            data: saved.data,
            ...(saved.colorMap ? { colorMap: saved.colorMap } : {}),
          });
          ccDispatch({ type: "load_all", values: saved.cc });
          if (saved.locked) setLocked(saved.locked);
        }
      })
      .catch(createErrorHandler("Restore", () => showToast(t("toast_restore_failed"), "error")))
      .finally(() => setLoaded(true));
  }, [showToast, t, ccDispatch, setLocked]);

  // Auto-save to IndexedDB on changes (debounced, skip if unchanged)
  useEffect(() => {
    if (!loaded) return;
    const prev = lastSavedRef.current;
    if (prev.data === cvs.data && prev.colorMap === cvs.colorMap && prev.cc === cc && prev.locked === locked) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const _cvs = cvs,
      _cc = cc,
      _locked = locked;
    saveTimerRef.current = setTimeout(() => {
      lastSavedRef.current = { data: _cvs.data, colorMap: _cvs.colorMap, cc: _cc, locked: _locked };
      saveState({
        w: _cvs.w,
        h: _cvs.h,
        data: _cvs.data,
        colorMap: new Uint8Array(_cvs.colorMap),
        cc: [..._cc],
        locked: [..._locked],
        version: 1,
      }).catch(createErrorHandler("AutoSave", () => showToast(t("toast_autosave_failed"), "error")));
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [cvs, cc, locked, loaded, showToast, t]);

  // Responsive display size based on viewport width AND height
  const computeDisplayMax = () => {
    if (typeof window === "undefined") return 640;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // On wide screens (>=1024px), reserve space for sidebar panel
    const isWide = w >= 1024;
    // Header ~50 + tabs ~40 + label ~20 + status ~15 + padding ~55 = ~180
    const UI_OVERHEAD = isWide ? 180 : Math.round(h * 0.3);
    const sidebarReserve = isWide ? 340 : 32;
    const fromW = Math.floor(w - sidebarReserve);
    const fromH = Math.floor(h - UI_OVERHEAD);
    return Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX_LIMIT, fromW, fromH));
  };
  const [displayMax, setDisplayMax] = useState(computeDisplayMax);
  useEffect(() => {
    const onResize = () => setDisplayMax(computeDisplayMax());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { displayW, displayH } = useMemo(() => {
    const safeW = Math.max(1, cvs.w),
      safeH = Math.max(1, cvs.h);
    const asp = safeW / safeH,
      mx = displayMax;
    return {
      displayW: asp >= 1 ? mx : Math.round(mx * asp),
      displayH: asp >= 1 ? Math.round(mx / asp) : mx,
    };
  }, [cvs.w, cvs.h, displayMax]);

  // Cleanup timers on unmount
  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [toastTimerRef],
  );

  return {
    state,
    dispatch,
    cvs,
    cc,
    ccDispatch,
    ...toolState,
    ...uiState,
    loaded,
    locked,
    setLocked,
    colorLUT: colorState.colorLUT,
    displayW,
    displayH,
    displayMax,
    toggleLock: colorState.toggleLock,
    handleRandomize: colorState.handleRandomize,
    handleUnlockAll: colorState.handleUnlockAll,
    patternInfo: colorState.patternInfo,
    requestFilename: uiState.requestFilename,
    handlePromptConfirm: uiState.handlePromptConfirm,
    handlePromptCancel: uiState.handlePromptCancel,
  };
}

import { useState, useRef, useEffect, useReducer, useMemo } from "react";
import { DISPLAY_MIN, DISPLAY_MAX_LIMIT } from "../constants";
import { canvasReducer, createInitialState } from "../state/canvas-reducer";
import { SAVED_STATE_VERSION, saveState, loadStateWithStatus, requestPersistentStorage } from "../utils/idb-persistence";
import { createErrorHandler } from "../utils/error-handler";
import { useToolState } from "./useToolState";
import { useUIState } from "./useUIState";
import { useColorState } from "./useColorState";

const STORAGE_PERSIST_REQUEST_KEY = "chromalum-storage-persist-requested-v1";

function hasRequestedPersistentStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_PERSIST_REQUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function markPersistentStorageRequested(): void {
  try {
    localStorage.setItem(STORAGE_PERSIST_REQUEST_KEY, "1");
  } catch {}
}

export function useAppState(t: import("../i18n").TranslationFn) {
  const [state, dispatch] = useReducer(canvasReducer, undefined, createInitialState);
  const { cvs } = state;

  const toolState = useToolState();
  const uiState = useUIState(t);
  const colorState = useColorState(state.hist);

  const { resetBrushSizeForCanvas } = toolState;
  const { showToast, toastTimerRef } = uiState;
  const { colorChoiceIndices, colorChoiceDispatch, locked, setLocked } = colorState;

  const [loaded, setLoaded] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSaveRef = useRef<(() => void) | null>(null);
  const saveRequestIdRef = useRef(0);
  const baselineSaveCompleteRef = useRef(false);
  const persistentStorageRequestInFlightRef = useRef(false);
  const lastSavedRef = useRef<{
    data: Uint8Array | null;
    colorMap: Uint8Array | null;
    colorChoiceIndices: number[] | null;
    locked: boolean[] | null;
  }>({
    data: null,
    colorMap: null,
    colorChoiceIndices: null,
    locked: null,
  });

  // Restore state from IndexedDB on mount
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    loadStateWithStatus()
      .then((result) => {
        if (result.state) {
          dispatch({
            type: "load_image",
            w: result.state.w,
            h: result.state.h,
            data: result.state.data,
            ...(result.state.colorMap ? { colorMap: result.state.colorMap } : {}),
          });
          colorChoiceDispatch({ type: "load_all", values: result.state.colorChoiceIndices });
          if (result.state.locked) setLocked(result.state.locked);
          return;
        }

        if (result.status === "invalid") {
          console.warn("CHROMALUM: saved state was ignored:", result.reason ?? "unknown reason");
          showToast(t("toast_restore_invalid"), "error");
          lastSavedRef.current = { data: cvs.data, colorMap: cvs.colorMap, colorChoiceIndices, locked };
          baselineSaveCompleteRef.current = true;
        }
      })
      .catch(createErrorHandler("Restore", () => showToast(t("toast_restore_failed"), "error")))
      .finally(() => setLoaded(true));
  }, [showToast, t, colorChoiceDispatch, setLocked, cvs.data, cvs.colorMap, colorChoiceIndices, locked]);

  // Auto-save to IndexedDB on changes (debounced, skip if unchanged)
  useEffect(() => {
    if (!loaded) return;
    const prev = lastSavedRef.current;
    if (
      prev.data === cvs.data &&
      prev.colorMap === cvs.colorMap &&
      prev.colorChoiceIndices === colorChoiceIndices &&
      prev.locked === locked
    )
      return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const pendingCanvas = cvs,
      pendingColorChoiceIndices = colorChoiceIndices,
      pendingLocked = locked;
    const doSave = () => {
      const requestId = ++saveRequestIdRef.current;
      saveState({
        w: pendingCanvas.w,
        h: pendingCanvas.h,
        data: pendingCanvas.data,
        colorMap: new Uint8Array(pendingCanvas.colorMap),
        colorChoiceIndices: [...pendingColorChoiceIndices],
        locked: [...pendingLocked],
        version: SAVED_STATE_VERSION,
      })
        .then(() => {
          if (requestId === saveRequestIdRef.current) {
            lastSavedRef.current = {
              data: pendingCanvas.data,
              colorMap: pendingCanvas.colorMap,
              colorChoiceIndices: pendingColorChoiceIndices,
              locked: pendingLocked,
            };
            if (!baselineSaveCompleteRef.current) {
              baselineSaveCompleteRef.current = true;
              return;
            }
            if (!persistentStorageRequestInFlightRef.current && !hasRequestedPersistentStorage()) {
              persistentStorageRequestInFlightRef.current = true;
              markPersistentStorageRequested();
              requestPersistentStorage()
                .catch((err: unknown) => {
                  console.warn("CHROMALUM: persistent storage request failed", err);
                })
                .finally(() => {
                  persistentStorageRequestInFlightRef.current = false;
                });
            }
          }
        })
        .catch(createErrorHandler("AutoSave", () => showToast(t("toast_autosave_failed"), "error")));
    };
    flushSaveRef.current = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      flushSaveRef.current = null;
      doSave();
    };
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      flushSaveRef.current = null;
      doSave();
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [cvs, colorChoiceIndices, locked, loaded, showToast, t]);

  // Flush pending save on tab hide / page unload to avoid data loss
  useEffect(() => {
    const flush = () => flushSaveRef.current?.();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

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

  useEffect(() => {
    resetBrushSizeForCanvas(cvs.w, cvs.h);
  }, [cvs.w, cvs.h, resetBrushSizeForCanvas]);

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
    colorChoiceIndices,
    colorChoiceDispatch,
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
    canRandomize: colorState.canRandomize,
    patternInfo: colorState.patternInfo,
  };
}

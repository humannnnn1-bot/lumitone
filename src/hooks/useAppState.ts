import { useState, useRef, useEffect, useReducer, useMemo } from "react";
import { DISPLAY_MIN, DISPLAY_MAX_LIMIT } from "../constants";
import { canvasReducer, createInitialState } from "../state/canvas-reducer";
import { SAVED_STATE_VERSION, saveState, loadStateWithStatus, requestPersistentStorage } from "../utils/idb-persistence";
import { createErrorHandler } from "../utils/error-handler";
import { useToolState } from "./useToolState";
import { useUIState } from "./useUIState";
import { useColorState } from "./useColorState";

const STORAGE_PERSIST_REQUEST_KEY = "chromalum-storage-persist-requested-v1";
const DESKTOP_LAYOUT_BP = 1024;
const PORTRAIT_LAYOUT_BP = 900;
const TALL_PORTRAIT_LAYOUT_BP = 820;
const DESKTOP_UI_OVERHEAD = 180;
const DESKTOP_PANEL_GAP = 32;
const DESKTOP_PANEL_SIDEBAR_WIDTH = 420;
const DESKTOP_ROOT_INLINE_PADDING = 32;
const MOBILE_WIDTH_RESERVE = 32;
const MOBILE_PORTRAIT_HEIGHT_BOOST = 1.2;

function clampDisplayMax(value: number): number {
  return Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX_LIMIT, value));
}

function getViewportSize() {
  if (typeof window === "undefined") return { width: 640, height: 640 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function getSideBySideLayoutBreakpoint(aspect: number): number {
  if (aspect <= 0.7) return TALL_PORTRAIT_LAYOUT_BP;
  if (aspect < 1) return PORTRAIT_LAYOUT_BP;
  return DESKTOP_LAYOUT_BP;
}

export function getCanvasDisplaySize(canvasWidth: number, canvasHeight: number, viewportWidth: number, viewportHeight: number) {
  const safeW = Math.max(1, canvasWidth);
  const safeH = Math.max(1, canvasHeight);
  const asp = safeW / safeH;
  const isSideBySide = viewportWidth >= getSideBySideLayoutBreakpoint(asp);
  const uiOverhead = isSideBySide ? DESKTOP_UI_OVERHEAD : Math.round(viewportHeight * 0.3);
  const heightLimit = Math.floor(viewportHeight - uiOverhead);

  if (isSideBySide) {
    const contentWidth = viewportWidth - DESKTOP_ROOT_INLINE_PADDING;
    const widthLimit = Math.floor(contentWidth - DESKTOP_PANEL_GAP - DESKTOP_PANEL_SIDEBAR_WIDTH);
    if (asp > 1) {
      const displayWidth = clampDisplayMax(Math.min(widthLimit, heightLimit * asp));
      return { displayWidth, displayHeight: Math.round(displayWidth / asp) };
    }
    const displayHeight = Math.round(clampDisplayMax(Math.min(heightLimit, widthLimit / asp)));
    return { displayWidth: Math.round(displayHeight * asp), displayHeight };
  }

  const displayMax = clampDisplayMax(Math.min(Math.floor(viewportWidth - MOBILE_WIDTH_RESERVE), heightLimit));
  if (asp < 1) {
    const portraitHeight = Math.round(Math.min(heightLimit, displayMax / asp, displayMax * MOBILE_PORTRAIT_HEIGHT_BOOST));
    const displayHeight = clampDisplayMax(portraitHeight);
    return { displayWidth: Math.round(displayHeight * asp), displayHeight };
  }

  return {
    displayWidth: displayMax,
    displayHeight: Math.round(displayMax / asp),
  };
}

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
  const { canvasData } = state;

  const toolState = useToolState();
  const uiState = useUIState(t);
  const colorState = useColorState(state.levelHistogram);

  const { resetBrushSizeForCanvas } = toolState;
  const { showToast, toastTimerRef } = uiState;
  const { candidateIndexByLevel, candidateIndexDispatch, lockedLevels, setLockedLevels } = colorState;

  const [loaded, setLoaded] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSaveRef = useRef<(() => void) | null>(null);
  const saveRequestIdRef = useRef(0);
  const baselineSaveCompleteRef = useRef(false);
  const persistentStorageRequestInFlightRef = useRef(false);
  const lastSavedRef = useRef<{
    levelData: Uint8Array | null;
    pixelCandidateOverrideMap: Uint8Array | null;
    candidateIndexByLevel: number[] | null;
    lockedLevels: boolean[] | null;
  }>({
    levelData: null,
    pixelCandidateOverrideMap: null,
    candidateIndexByLevel: null,
    lockedLevels: null,
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
            width: result.state.width,
            height: result.state.height,
            levelData: result.state.levelData,
            ...(result.state.pixelCandidateOverrideMap ? { pixelCandidateOverrideMap: result.state.pixelCandidateOverrideMap } : {}),
          });
          candidateIndexDispatch({ type: "load_all", values: result.state.candidateIndexByLevel });
          if (result.state.lockedLevels) setLockedLevels(result.state.lockedLevels);
          return;
        }

        if (result.status === "invalid") {
          console.warn("CHROMALUM: saved state was ignored:", result.reason ?? "unknown reason");
          showToast(t("toast_restore_invalid"), "error");
          lastSavedRef.current = {
            levelData: canvasData.levelData,
            pixelCandidateOverrideMap: canvasData.pixelCandidateOverrideMap,
            candidateIndexByLevel,
            lockedLevels,
          };
          baselineSaveCompleteRef.current = true;
        }
      })
      .catch(createErrorHandler("Restore", () => showToast(t("toast_restore_failed"), "error")))
      .finally(() => setLoaded(true));
  }, [
    showToast,
    t,
    candidateIndexDispatch,
    setLockedLevels,
    canvasData.levelData,
    canvasData.pixelCandidateOverrideMap,
    candidateIndexByLevel,
    lockedLevels,
  ]);

  // Auto-save to IndexedDB on changes (debounced, skip if unchanged)
  useEffect(() => {
    if (!loaded) return;
    const prev = lastSavedRef.current;
    if (
      prev.levelData === canvasData.levelData &&
      prev.pixelCandidateOverrideMap === canvasData.pixelCandidateOverrideMap &&
      prev.candidateIndexByLevel === candidateIndexByLevel &&
      prev.lockedLevels === lockedLevels
    )
      return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const pendingCanvas = canvasData,
      pendingCandidateIndexByLevel = candidateIndexByLevel,
      pendingLockedLevels = lockedLevels;
    const doSave = () => {
      const requestId = ++saveRequestIdRef.current;
      saveState({
        width: pendingCanvas.width,
        height: pendingCanvas.height,
        levelData: pendingCanvas.levelData,
        pixelCandidateOverrideMap: new Uint8Array(pendingCanvas.pixelCandidateOverrideMap),
        candidateIndexByLevel: [...pendingCandidateIndexByLevel],
        lockedLevels: [...pendingLockedLevels],
        version: SAVED_STATE_VERSION,
      })
        .then(() => {
          if (requestId === saveRequestIdRef.current) {
            lastSavedRef.current = {
              levelData: pendingCanvas.levelData,
              pixelCandidateOverrideMap: pendingCanvas.pixelCandidateOverrideMap,
              candidateIndexByLevel: pendingCandidateIndexByLevel,
              lockedLevels: pendingLockedLevels,
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
  }, [canvasData, candidateIndexByLevel, lockedLevels, loaded, showToast, t]);

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
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  useEffect(() => {
    const onResize = () => setViewportSize(getViewportSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    resetBrushSizeForCanvas(canvasData.width, canvasData.height);
  }, [canvasData.width, canvasData.height, resetBrushSizeForCanvas]);

  const { displayWidth, displayHeight } = useMemo(
    () => getCanvasDisplaySize(canvasData.width, canvasData.height, viewportSize.width, viewportSize.height),
    [canvasData.width, canvasData.height, viewportSize.width, viewportSize.height],
  );

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
    canvasData,
    candidateIndexByLevel,
    candidateIndexDispatch,
    ...toolState,
    ...uiState,
    loaded,
    lockedLevels,
    setLockedLevels,
    colorLUT: colorState.colorLUT,
    displayWidth,
    displayHeight,
    toggleLevelLock: colorState.toggleLevelLock,
    handleRandomize: colorState.handleRandomize,
    handleUnlockAll: colorState.handleUnlockAll,
    canRandomize: colorState.canRandomize,
    patternInfo: colorState.patternInfo,
  };
}

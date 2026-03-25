import { useState, useRef, useCallback } from "react";
import { TOAST_DURATION } from "../constants";
import type { MapMode } from "../components/AnalyzePanel";
import type { TranslationFn } from "../i18n";
import { useSyncRef } from "./useSyncRef";

export function useUIState(_t: TranslationFn) {
  const [activeTab, setActiveTab] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("region");
  const [hueAngle, setHueAngle] = useState(0);
  const [directCandidates, setDirectCandidates] = useState<Map<number, number>>(new Map());
  const [promptState, setPromptState] = useState<{ defaultValue: string; resolve: (v: string | null) => void } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "error" | "success" | "info" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, TOAST_DURATION);
  }, []);

  const requestFilename = useCallback((defaultValue: string): Promise<string | null> => {
    return new Promise(resolve => { setPromptState({ defaultValue, resolve }); });
  }, []);

  const promptRef = useSyncRef(promptState);

  const handlePromptConfirm = useCallback((value: string) => {
    promptRef.current?.resolve(value);
    setPromptState(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromptCancel = useCallback(() => {
    promptRef.current?.resolve(null);
    setPromptState(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    activeTab, setActiveTab,
    showHelp, setShowHelp,
    toast, showToast,
    showNewCanvas, setShowNewCanvas,
    mapMode, setMapMode,
    hueAngle, setHueAngle,
    directCandidates, setDirectCandidates,
    promptState, setPromptState,
    requestFilename, handlePromptConfirm, handlePromptCancel,
    toastTimerRef,
  };
}

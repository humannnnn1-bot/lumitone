import React, { createContext, useContext } from "react";
import type { TranslationFn } from "../i18n";

export interface DrawingContextValue {
  zoom: number;
  pan: { x: number; y: number };
  panningRef: React.MutableRefObject<boolean>;
  spaceRef: React.MutableRefObject<boolean>;
  zoomRef: React.MutableRefObject<number>;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  startPan: (e: React.PointerEvent) => void;
  movePan: (e: React.PointerEvent) => void;
  endPan: () => void;
  displayW: number;
  displayH: number;
  announce: (msg: string) => void;
  t: TranslationFn;
}

const DrawingContext = createContext<DrawingContextValue | null>(null);

export function useDrawingContext(): DrawingContextValue {
  const ctx = useContext(DrawingContext);
  if (!ctx) throw new Error("useDrawingContext must be used within DrawingContextProvider");
  return ctx;
}

export function DrawingContextProvider(props: DrawingContextValue & { children: React.ReactNode }) {
  const { children, ...value } = props;
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>;
}

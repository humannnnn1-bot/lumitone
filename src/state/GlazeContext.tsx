import React, { createContext, useContext } from "react";
import type { GlazeToolId } from "../constants";

export interface GlazeContextValue {
  hueAngle: number;
  setHueAngle: React.Dispatch<React.SetStateAction<number>>;
  glazeTool: GlazeToolId;
  setGlazeTool: React.Dispatch<React.SetStateAction<GlazeToolId>>;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  directCandidates: Map<number, number>;
  setDirectCandidates: React.Dispatch<React.SetStateAction<Map<number, number>>>;
}

const GlazeContext = createContext<GlazeContextValue | null>(null);

export function useGlazeContext(): GlazeContextValue {
  const ctx = useContext(GlazeContext);
  if (!ctx) throw new Error("useGlazeContext must be used within GlazeContextProvider");
  return ctx;
}

export function GlazeContextProvider(props: GlazeContextValue & { children: React.ReactNode }) {
  const { children, ...value } = props;
  return <GlazeContext.Provider value={value}>{children}</GlazeContext.Provider>;
}

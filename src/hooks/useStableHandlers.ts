import { useState, useLayoutEffect } from "react";
import type { PanZoomHandlers, DrawingHandlers } from "../types";

export function useStablePanZoomHandlers(handlers: PanZoomHandlers): PanZoomHandlers {
  const [stable] = useState(() => ({ ...handlers }));
  useLayoutEffect(() => {
    Object.assign(stable, handlers);
  });
  return stable;
}

export function useStableDrawingHandlers(handlers: DrawingHandlers): DrawingHandlers {
  const [stable] = useState(() => ({ ...handlers }));
  useLayoutEffect(() => {
    Object.assign(stable, handlers);
  });
  return stable;
}

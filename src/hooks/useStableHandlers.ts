import { useRef, useLayoutEffect } from "react";
import type { PanZoomHandlers, DrawingHandlers } from "../types";

export function useStablePanZoomHandlers(handlers: PanZoomHandlers): React.RefObject<PanZoomHandlers> {
  const ref = useRef(handlers);
  // Update ref properties after render (stable reference, fresh values)
  useLayoutEffect(() => {
    Object.assign(ref.current, handlers);
  });
  return ref;
}

export function useStableDrawingHandlers(handlers: DrawingHandlers): React.RefObject<DrawingHandlers> {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    Object.assign(ref.current, handlers);
  });
  return ref;
}

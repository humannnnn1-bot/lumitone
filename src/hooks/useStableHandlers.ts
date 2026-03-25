import { useRef } from "react";
import type { PanZoomHandlers, DrawingHandlers } from "../types";

export function useStablePanZoomHandlers(handlers: PanZoomHandlers): React.RefObject<PanZoomHandlers> {
  const ref = useRef(handlers);
  // Update ref properties each render (stable reference, fresh values)
  Object.assign(ref.current, handlers);
  return ref;
}

export function useStableDrawingHandlers(handlers: DrawingHandlers): React.RefObject<DrawingHandlers> {
  const ref = useRef(handlers);
  Object.assign(ref.current, handlers);
  return ref;
}

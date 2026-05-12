import { useCallback, useRef, useState, type SetStateAction } from "react";
import { defaultBrushSizeForCanvas, DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, type ToolId, type GlazeToolId } from "../constants";

export function useToolState() {
  const [tool, setTool] = useState<ToolId>("brush");
  const [brushLevel, setBrushLevel] = useState(7);
  const [brushSize, setBrushSizeState] = useState(() => defaultBrushSizeForCanvas(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT));
  const [glazeTool, setGlazeTool] = useState<GlazeToolId>("glaze_brush");
  const brushSizeManuallyChangedRef = useRef(false);

  const setBrushSize = useCallback((value: SetStateAction<number>) => {
    brushSizeManuallyChangedRef.current = true;
    setBrushSizeState(value);
  }, []);

  const resetBrushSizeForCanvas = useCallback((w: number, h: number) => {
    if (brushSizeManuallyChangedRef.current) return;
    setBrushSizeState(defaultBrushSizeForCanvas(w, h));
  }, []);

  return { tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize, resetBrushSizeForCanvas, glazeTool, setGlazeTool };
}

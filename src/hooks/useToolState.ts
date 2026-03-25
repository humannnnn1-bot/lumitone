import { useState } from "react";
import type { ToolId, GlazeToolId } from "../constants";

export function useToolState() {
  const [tool, setTool] = useState<ToolId>("brush");
  const [brushLevel, setBrushLevel] = useState(7);
  const [brushSize, setBrushSize] = useState(12);
  const [glazeTool, setGlazeTool] = useState<GlazeToolId>("glaze_brush");

  return { tool, setTool, brushLevel, setBrushLevel, brushSize, setBrushSize, glazeTool, setGlazeTool };
}

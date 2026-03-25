// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import type { ToolId } from "../constants";

function makeArgs() {
  // Use simple vi.fn() and cast via the args tuple to avoid Mock generics issues
  const setTool = vi.fn() as unknown as React.Dispatch<React.SetStateAction<ToolId>>;
  const setBrushLevel = vi.fn() as unknown as React.Dispatch<React.SetStateAction<number>>;
  const setBrushSize = vi.fn() as unknown as React.Dispatch<React.SetStateAction<number>>;
  const dispatch = vi.fn() as unknown as React.Dispatch<import("../types").CanvasAction>;
  const announce = vi.fn() as (msg: string) => void;
  const endPan = vi.fn() as () => void;
  const setShowHelp = vi.fn() as unknown as React.Dispatch<React.SetStateAction<boolean>>;
  const setCursorMode = vi.fn() as unknown as React.Dispatch<React.SetStateAction<null | "grab" | "grabbing">>;
  const spaceRef = { current: false };
  const panningRef = { current: false };
  const brushSizeRef = { current: 12 };
  const setShowNewCanvas = vi.fn() as unknown as React.Dispatch<React.SetStateAction<boolean>>;
  const t = ((key: string) => key) as import("../i18n").TranslationFn;
  const setZoom = vi.fn() as unknown as React.Dispatch<React.SetStateAction<number>>;
  const onSave = vi.fn() as () => void;
  const onSaveAs = vi.fn() as () => void;

  return {
    args: [
      setTool, setBrushLevel, setBrushSize, dispatch, announce,
      endPan, setShowHelp, setCursorMode, spaceRef, panningRef,
      brushSizeRef, setShowNewCanvas, t, setZoom, onSave, onSaveAs,
    ] as const,
    setTool, setBrushLevel, setBrushSize, dispatch, announce,
    endPan, setShowHelp, setCursorMode, spaceRef, panningRef,
    brushSizeRef, setShowNewCanvas, setZoom, onSave, onSaveAs,
  };
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
}

describe("useKeyboardShortcuts", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("can be called without error", () => {
    const { args } = makeArgs();
    const { unmount } = renderHook(() => useKeyboardShortcuts(...args));
    cleanup = unmount;
  });

  describe("tool switching shortcuts", () => {
    const toolKeys: [string, ToolId][] = [
      ["b", "brush"],
      ["e", "eraser"],
      ["f", "fill"],
      ["l", "line"],
      ["r", "rect"],
      ["o", "ellipse"],
    ];

    toolKeys.forEach(([key, expectedTool]) => {
      it(`pressing '${key}' switches to ${expectedTool}`, () => {
        const { args, setTool, announce } = makeArgs();
        const { unmount } = renderHook(() => useKeyboardShortcuts(...args));
        cleanup = unmount;

        fireKey(key);

        expect(vi.mocked(setTool)).toHaveBeenCalledWith(expectedTool);
        expect(vi.mocked(announce)).toHaveBeenCalled();
      });
    });
  });

  describe("level shortcuts", () => {
    for (let level = 0; level <= 7; level++) {
      it(`pressing '${level}' sets brush level to ${level}`, () => {
        const { args, setBrushLevel, announce } = makeArgs();
        const { unmount } = renderHook(() => useKeyboardShortcuts(...args));
        cleanup = unmount;

        fireKey(String(level));

        expect(vi.mocked(setBrushLevel)).toHaveBeenCalledWith(level);
        expect(vi.mocked(announce)).toHaveBeenCalled();
      });
    }
  });

  describe("undo/redo shortcuts", () => {
    it("Ctrl+Z dispatches undo", () => {
      const { args, dispatch } = makeArgs();
      const { unmount } = renderHook(() => useKeyboardShortcuts(...args));
      cleanup = unmount;

      fireKey("z", { ctrlKey: true });

      expect(vi.mocked(dispatch)).toHaveBeenCalledWith({ type: "undo" });
    });

    it("Ctrl+Shift+Z dispatches redo", () => {
      const { args, dispatch } = makeArgs();
      const { unmount } = renderHook(() => useKeyboardShortcuts(...args));
      cleanup = unmount;

      fireKey("z", { ctrlKey: true, shiftKey: true });

      expect(vi.mocked(dispatch)).toHaveBeenCalledWith({ type: "redo" });
    });
  });

  it("ignores keys when target is an input element", () => {
    const { args, setTool } = makeArgs();
    const { unmount } = renderHook(() => useKeyboardShortcuts(...args));
    cleanup = unmount;

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true }));
    document.body.removeChild(input);

    expect(vi.mocked(setTool)).not.toHaveBeenCalled();
  });
});

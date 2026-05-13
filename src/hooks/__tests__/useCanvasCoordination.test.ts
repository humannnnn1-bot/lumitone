// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCanvasCoordination } from "../useCanvasCoordination";
import type { CanvasDrawingResult } from "../useCanvasDrawing";
import type { GlazeDrawingResult } from "../useGlazeDrawing";
import type { CanvasData, ImageRenderCache } from "../../types";

function ref<T>(current: T): React.MutableRefObject<T> {
  return { current };
}

function makeImgCache(): ImageRenderCache {
  return { sourceImageData: null, previewImageData: null, sourcePixels32: null, previewPixels32: null };
}

function makeCanvasData(): CanvasData {
  return {
    width: 2,
    height: 2,
    levelData: new Uint8Array(4),
    pixelCandidateOverrideMap: new Uint8Array(4),
  };
}

function mockWrapRect(el: HTMLElement) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left: 10,
    top: 20,
    right: 110,
    bottom: 120,
    width: 100,
    height: 100,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  });
}

function makeDrawingResult(scheduleCursorRedraw: (() => void) | null): CanvasDrawingResult {
  return {
    sourceCanvasRef: ref<HTMLCanvasElement | null>(null),
    cursorCanvasRef: ref<HTMLCanvasElement | null>(null),
    previewCursorRef: ref<HTMLCanvasElement | null>(null),
    statusRef: ref<HTMLDivElement | null>(null),
    imgCacheRef: ref(makeImgCache()),
    strokeRef: ref(null),
    drawingRef: ref(false),
    lastRef: ref(null),
    cursorRafRef: ref(null),
    scheduleCursorRedrawRef: ref(scheduleCursorRedraw),
    cursorPosRef: ref(null),
    onDown: vi.fn(),
    onMove: vi.fn(),
    onUp: vi.fn(),
    onWorkspaceDown: vi.fn(),
    onWorkspaceMove: vi.fn(),
    onWorkspaceLeave: vi.fn(),
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
    onPreviewPointerDown: vi.fn(),
    onPreviewPointerMove: vi.fn(),
    onPreviewWorkspacePointerDown: vi.fn(),
    onPreviewWorkspacePointerMove: vi.fn(),
    onWorkspaceLeavePrv: vi.fn(),
    trackPreviewCursor: vi.fn(),
    clearPreviewCursor: vi.fn(),
  };
}

function makeGlazeDrawingResult(scheduleCursorRedraw: (() => void) | null = null): GlazeDrawingResult {
  return {
    sourceCanvasRef: ref<HTMLCanvasElement | null>(null),
    cursorCanvasRef: ref<HTMLCanvasElement | null>(null),
    statusRef: ref<HTMLDivElement | null>(null),
    imgCacheRef: ref(makeImgCache()),
    drawingRef: ref(false),
    cursorRafRef: ref(null),
    scheduleCursorRedrawRef: ref(scheduleCursorRedraw),
    cursorPosRef: ref(null),
    onDown: vi.fn(),
    onMove: vi.fn(),
    onUp: vi.fn(),
    onWorkspaceDown: vi.fn(),
    onWorkspaceMove: vi.fn(),
    onWorkspaceLeave: vi.fn(),
    pickHue: vi.fn(),
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
  };
}

describe("useCanvasCoordination", () => {
  it("bridges drawing and glaze cursor schedulers into the caller-owned shared ref", () => {
    const firstScheduler = vi.fn();
    const secondScheduler = vi.fn();
    const firstGlazeScheduler = vi.fn();
    const secondGlazeScheduler = vi.fn();
    const drawing = makeDrawingResult(firstScheduler);
    const glazeDrawing = makeGlazeDrawingResult(firstGlazeScheduler);
    const sharedScheduleCursorRedrawRef = ref<(() => void) | null>(null);
    const baseOptions = {
      canvasData: makeCanvasData(),
      colorLUT: Array.from({ length: 8 }, () => [0, 0, 0] as [number, number, number]),
      activeTabId: "source" as const,
      drawing,
      glazeDrawing,
      sourceCanvasWrapRef: ref<HTMLDivElement | null>(null),
      previewCanvasWrapRef: ref<HTMLDivElement | null>(null),
      glazeWrapRef: ref<HTMLDivElement | null>(null),
      previewCanvasRef: ref<HTMLCanvasElement | null>(null),
      hexPreviewCanvasRef: ref<HTMLCanvasElement | null>(null),
      glazePreviewCanvasRef: ref<HTMLCanvasElement | null>(null),
      sharedScheduleCursorRedrawRef,
      onWheel: vi.fn(),
    };

    const { rerender } = renderHook(() => useCanvasCoordination(baseOptions));

    sharedScheduleCursorRedrawRef.current?.();
    expect(firstScheduler).toHaveBeenCalledTimes(1);
    expect(firstGlazeScheduler).toHaveBeenCalledTimes(1);

    drawing.scheduleCursorRedrawRef.current = secondScheduler;
    glazeDrawing.scheduleCursorRedrawRef.current = secondGlazeScheduler;
    rerender();

    sharedScheduleCursorRedrawRef.current?.();
    expect(secondScheduler).toHaveBeenCalledTimes(1);
    expect(secondGlazeScheduler).toHaveBeenCalledTimes(1);
  });

  it("clears cursor overlays when the pointer leaves a mounted workspace", () => {
    const drawing = makeDrawingResult(null);
    const glazeDrawing = makeGlazeDrawingResult();
    const srcWrap = document.createElement("div");
    mockWrapRect(srcWrap);

    renderHook(() =>
      useCanvasCoordination({
        canvasData: makeCanvasData(),
        colorLUT: Array.from({ length: 8 }, () => [0, 0, 0] as [number, number, number]),
        activeTabId: "source",
        drawing,
        glazeDrawing,
        sourceCanvasWrapRef: ref(srcWrap),
        previewCanvasWrapRef: ref<HTMLDivElement | null>(null),
        glazeWrapRef: ref<HTMLDivElement | null>(null),
        previewCanvasRef: ref<HTMLCanvasElement | null>(null),
        hexPreviewCanvasRef: ref<HTMLCanvasElement | null>(null),
        glazePreviewCanvasRef: ref<HTMLCanvasElement | null>(null),
        sharedScheduleCursorRedrawRef: ref<(() => void) | null>(null),
        onWheel: vi.fn(),
      }),
    );

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 50 }));
    });
    expect(drawing.clearCursor).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 5, clientY: 50 }));
    });
    expect(drawing.clearCursor).toHaveBeenCalled();
    expect(drawing.clearPreviewCursor).not.toHaveBeenCalled();
    expect(glazeDrawing.clearCursor).not.toHaveBeenCalled();
  });
});

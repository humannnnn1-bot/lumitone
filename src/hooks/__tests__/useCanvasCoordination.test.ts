// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCanvasCoordination } from "../useCanvasCoordination";
import type { CanvasDrawingResult } from "../useCanvasDrawing";
import type { GlazeDrawingResult } from "../useGlazeDrawing";
import type { CanvasData, ImgCache } from "../../types";

function ref<T>(current: T): React.MutableRefObject<T> {
  return { current };
}

function makeImgCache(): ImgCache {
  return { src: null, prv: null, s32: null, p32: null };
}

function makeCanvasData(): CanvasData {
  return {
    w: 2,
    h: 2,
    data: new Uint8Array(4),
    colorMap: new Uint8Array(4),
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

function makeDrawingResult(schedCursor: (() => void) | null): CanvasDrawingResult {
  return {
    srcRef: ref<HTMLCanvasElement | null>(null),
    curRef: ref<HTMLCanvasElement | null>(null),
    prvCurRef: ref<HTMLCanvasElement | null>(null),
    statusRef: ref<HTMLDivElement | null>(null),
    imgCacheRef: ref(makeImgCache()),
    strokeRef: ref(null),
    drawingRef: ref(false),
    lastRef: ref(null),
    cursorRafRef: ref(null),
    schedCursorRef: ref(schedCursor),
    cursorPosRef: ref(null),
    onDown: vi.fn(),
    onMove: vi.fn(),
    onUp: vi.fn(),
    onWorkspaceDown: vi.fn(),
    onWorkspaceMove: vi.fn(),
    onWorkspaceLeave: vi.fn(),
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
    onDownPrv: vi.fn(),
    onMovePrv: vi.fn(),
    onWorkspaceDownPrv: vi.fn(),
    onWorkspaceMovePrv: vi.fn(),
    onWorkspaceLeavePrv: vi.fn(),
    trackCursorPrv: vi.fn(),
    clearCursorPrv: vi.fn(),
  };
}

function makeGlazeDrawingResult(schedCursor: (() => void) | null = null): GlazeDrawingResult {
  return {
    srcRef: ref<HTMLCanvasElement | null>(null),
    curRef: ref<HTMLCanvasElement | null>(null),
    statusRef: ref<HTMLDivElement | null>(null),
    imgCacheRef: ref(makeImgCache()),
    drawingRef: ref(false),
    cursorRafRef: ref(null),
    schedCursorRef: ref(schedCursor),
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
    const sharedSchedCursorRef = ref<(() => void) | null>(null);
    const baseOptions = {
      cvs: makeCanvasData(),
      colorLUT: Array.from({ length: 8 }, () => [0, 0, 0] as [number, number, number]),
      activeTabId: "source" as const,
      drawing,
      glazeDrawing,
      srcWrapRef: ref<HTMLDivElement | null>(null),
      prvWrapRef: ref<HTMLDivElement | null>(null),
      glazeWrapRef: ref<HTMLDivElement | null>(null),
      prvRef: ref<HTMLCanvasElement | null>(null),
      hexPrvRef: ref<HTMLCanvasElement | null>(null),
      glazePrvRef: ref<HTMLCanvasElement | null>(null),
      sharedSchedCursorRef,
      onWheel: vi.fn(),
    };

    const { rerender } = renderHook(() => useCanvasCoordination(baseOptions));

    sharedSchedCursorRef.current?.();
    expect(firstScheduler).toHaveBeenCalledTimes(1);
    expect(firstGlazeScheduler).toHaveBeenCalledTimes(1);

    drawing.schedCursorRef.current = secondScheduler;
    glazeDrawing.schedCursorRef.current = secondGlazeScheduler;
    rerender();

    sharedSchedCursorRef.current?.();
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
        cvs: makeCanvasData(),
        colorLUT: Array.from({ length: 8 }, () => [0, 0, 0] as [number, number, number]),
        activeTabId: "source",
        drawing,
        glazeDrawing,
        srcWrapRef: ref(srcWrap),
        prvWrapRef: ref<HTMLDivElement | null>(null),
        glazeWrapRef: ref<HTMLDivElement | null>(null),
        prvRef: ref<HTMLCanvasElement | null>(null),
        hexPrvRef: ref<HTMLCanvasElement | null>(null),
        glazePrvRef: ref<HTMLCanvasElement | null>(null),
        sharedSchedCursorRef: ref<(() => void) | null>(null),
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
    expect(drawing.clearCursorPrv).not.toHaveBeenCalled();
    expect(glazeDrawing.clearCursor).not.toHaveBeenCalled();
  });
});

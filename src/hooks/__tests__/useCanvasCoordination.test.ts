// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
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
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
    onDownPrv: vi.fn(),
    onMovePrv: vi.fn(),
    trackCursorPrv: vi.fn(),
    clearCursorPrv: vi.fn(),
  };
}

function makeGlazeDrawingResult(): GlazeDrawingResult {
  return {
    srcRef: ref<HTMLCanvasElement | null>(null),
    curRef: ref<HTMLCanvasElement | null>(null),
    statusRef: ref<HTMLDivElement | null>(null),
    imgCacheRef: ref(makeImgCache()),
    drawingRef: ref(false),
    cursorRafRef: ref(null),
    schedCursorRef: ref(null),
    cursorPosRef: ref(null),
    onDown: vi.fn(),
    onMove: vi.fn(),
    onUp: vi.fn(),
    pickHue: vi.fn(),
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
  };
}

describe("useCanvasCoordination", () => {
  it("bridges the drawing cursor scheduler into the caller-owned shared ref", () => {
    const firstScheduler = vi.fn();
    const secondScheduler = vi.fn();
    const drawing = makeDrawingResult(firstScheduler);
    const sharedSchedCursorRef = ref<(() => void) | null>(null);
    const baseOptions = {
      cvs: makeCanvasData(),
      colorLUT: Array.from({ length: 8 }, () => [0, 0, 0] as [number, number, number]),
      activeTabId: "source" as const,
      drawing,
      glazeDrawing: makeGlazeDrawingResult(),
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

    expect(sharedSchedCursorRef.current).toBe(firstScheduler);

    drawing.schedCursorRef.current = secondScheduler;
    rerender();

    expect(sharedSchedCursorRef.current).toBe(secondScheduler);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRectCache } from "../hooks/useRectCache";

// Polyfill ResizeObserver for jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

describe("useRectCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a getCurRect function", () => {
    const ref = { current: null } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() => useRectCache(ref));
    expect(typeof result.current).toBe("function");
  });

  it("returns empty DOMRect when ref is null", () => {
    const ref = { current: null } as React.RefObject<HTMLElement | null>;
    const { result } = renderHook(() => useRectCache(ref));
    const rect = result.current();
    expect(rect).toBeInstanceOf(DOMRect);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });

  it("calls getBoundingClientRect on the element", () => {
    const mockRect = new DOMRect(10, 20, 300, 400);
    const el = document.createElement("div");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect);
    const ref = { current: el } as React.RefObject<HTMLElement | null>;

    const { result } = renderHook(() => useRectCache(ref));
    const rect = result.current();
    expect(rect).toBe(mockRect);
    expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it("getCurRect uses cached value within TTL", () => {
    const mockRect = new DOMRect(10, 20, 300, 400);
    const el = document.createElement("div");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect);
    const ref = { current: el } as React.RefObject<HTMLElement | null>;

    // Mock performance.now to control TTL
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const { result } = renderHook(() => useRectCache(ref));

    // First call should hit getBoundingClientRect
    result.current();
    expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);

    // Second call within TTL (100ms) should use cache
    now = 1050;
    result.current();
    expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);

    // Third call after TTL should hit getBoundingClientRect again
    now = 1200;
    result.current();
    expect(el.getBoundingClientRect).toHaveBeenCalledTimes(2);
  });
});

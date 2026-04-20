// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUIState } from "../hooks/useUIState";
import { TOAST_DURATION } from "../constants";

// Minimal translation stub
const t = ((key: string) => key) as import("../i18n").TranslationFn;

describe("useUIState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial activeTab is 2 (Source)", () => {
    const { result } = renderHook(() => useUIState(t));
    expect(result.current.activeTab).toBe(2);
  });

  it("setActiveTab changes tab", () => {
    const { result } = renderHook(() => useUIState(t));
    act(() => {
      result.current.setActiveTab(2);
    });
    expect(result.current.activeTab).toBe(2);
  });

  it("showToast sets toast and auto-clears after TOAST_DURATION", () => {
    const { result } = renderHook(() => useUIState(t));

    act(() => {
      result.current.showToast("hello", "success");
    });
    expect(result.current.toast).toEqual({ message: "hello", type: "success" });

    // Advance time past TOAST_DURATION
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION + 100);
    });
    expect(result.current.toast).toBeNull();
  });

  it("showToast defaults to 'info' type", () => {
    const { result } = renderHook(() => useUIState(t));

    act(() => {
      result.current.showToast("msg");
    });
    expect(result.current.toast).toEqual({ message: "msg", type: "info" });
  });

  it("showToast replaces previous toast and resets timer", () => {
    const { result } = renderHook(() => useUIState(t));

    act(() => {
      result.current.showToast("first", "info");
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION - 100);
    });
    // Still visible
    expect(result.current.toast).not.toBeNull();

    // Replace with second toast
    act(() => {
      result.current.showToast("second", "error");
    });
    expect(result.current.toast).toEqual({ message: "second", type: "error" });

    // Original timer should not clear the new toast
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.toast).not.toBeNull();

    // New timer clears it
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION);
    });
    expect(result.current.toast).toBeNull();
  });

  it("showHelp toggles", () => {
    const { result } = renderHook(() => useUIState(t));
    expect(result.current.showHelp).toBe(false);

    act(() => {
      result.current.setShowHelp(true);
    });
    expect(result.current.showHelp).toBe(true);

    act(() => {
      result.current.setShowHelp(false);
    });
    expect(result.current.showHelp).toBe(false);
  });

  it("mapMode changes", () => {
    const { result } = renderHook(() => useUIState(t));
    expect(result.current.mapMode).toBe("luminance");

    act(() => {
      result.current.setMapMode("luminance");
    });
    expect(result.current.mapMode).toBe("luminance");
  });
});

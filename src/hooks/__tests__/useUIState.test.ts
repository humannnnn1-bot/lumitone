// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUIState } from "../useUIState";
import { TOAST_DURATION } from "../../constants";

// Minimal translation stub
const t = ((key: string) => key) as import("../../i18n").TranslationFn;

describe("useUIState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("initial activeTab is 2 (Source)", () => {
    const { result } = renderHook(() => useUIState(t));
    expect(result.current.activeTab).toBe(2);
    expect(result.current.activeTabId).toBe("source");
  });

  it("initial activeTab prefers a supported URL hash", () => {
    window.history.replaceState(null, "", "/#theory");

    const { result } = renderHook(() => useUIState(t));

    expect(result.current.activeTab).toBe(6);
    expect(result.current.activeTabId).toBe("theory");
  });

  it("tracks whether the stats tab has been opened from the initial hash", () => {
    window.history.replaceState(null, "", "/#map");

    const { result } = renderHook(() => useUIState(t));

    expect(result.current.activeTab).toBe(5);
    expect(result.current.activeTabId).toBe("stats");
    expect(result.current.hasOpenedStats).toBe(true);
  });

  it("initial activeTab supports the legacy stats URL hash alias", () => {
    window.history.replaceState(null, "", "/#stats");

    const { result } = renderHook(() => useUIState(t));

    expect(result.current.activeTab).toBe(5);
    expect(result.current.activeTabId).toBe("stats");
    expect(result.current.hasOpenedStats).toBe(true);
  });

  it("initial activeTab falls back to the stored tab when no hash is present", () => {
    localStorage.setItem("chromalum-active-tab-v2", "7");

    const { result } = renderHook(() => useUIState(t));

    expect(result.current.activeTab).toBe(7);
    expect(result.current.activeTabId).toBe("music");
  });

  it("initial activeTab falls back to Source when stored tab cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      if (key === "chromalum-active-tab-v2") throw new DOMException("Storage blocked", "SecurityError");
      return null;
    });

    const { result } = renderHook(() => useUIState(t));

    expect(result.current.activeTab).toBe(2);
    expect(result.current.activeTabId).toBe("source");
  });

  it("setActiveTab changes tab", () => {
    const { result } = renderHook(() => useUIState(t));
    act(() => {
      result.current.setActiveTab(6);
    });
    expect(result.current.activeTab).toBe(6);
    expect(result.current.activeTabId).toBe("theory");
    expect(window.location.hash).toBe("#theory");
    expect(localStorage.getItem("chromalum-active-tab-v2")).toBe("6");
  });

  it("setActiveTabId changes tab while preserving numeric storage compatibility", () => {
    const { result } = renderHook(() => useUIState(t));
    act(() => {
      result.current.setActiveTabId("theory");
    });
    expect(result.current.activeTab).toBe(6);
    expect(result.current.activeTabId).toBe("theory");
    expect(window.location.hash).toBe("#theory");
    expect(localStorage.getItem("chromalum-active-tab-v2")).toBe("6");
  });

  it("setActiveTab still changes tab when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === "chromalum-active-tab-v2") throw new DOMException("Storage blocked", "SecurityError");
    });
    const { result } = renderHook(() => useUIState(t));

    act(() => {
      result.current.setActiveTab(6);
    });

    expect(result.current.activeTab).toBe(6);
    expect(result.current.activeTabId).toBe("theory");
    expect(window.location.hash).toBe("#theory");
  });

  it("tracks whether the stats tab has been opened through tab changes", () => {
    const { result } = renderHook(() => useUIState(t));
    expect(result.current.hasOpenedStats).toBe(false);

    act(() => {
      result.current.setActiveTab(5);
    });
    expect(result.current.hasOpenedStats).toBe(true);
    expect(result.current.activeTabId).toBe("stats");

    act(() => {
      result.current.setActiveTab(2);
    });
    expect(result.current.hasOpenedStats).toBe(true);
    expect(result.current.activeTabId).toBe("source");
  });

  it("syncs activeTab from manual hash changes", () => {
    const { result } = renderHook(() => useUIState(t));

    act(() => {
      window.history.pushState(null, "", "#music");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(result.current.activeTab).toBe(7);
    expect(result.current.activeTabId).toBe("music");
    expect(localStorage.getItem("chromalum-active-tab-v2")).toBe("7");
  });

  it("tracks stats opening from manual hash changes", () => {
    const { result } = renderHook(() => useUIState(t));
    expect(result.current.hasOpenedStats).toBe(false);

    act(() => {
      window.history.pushState(null, "", "#map");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(result.current.activeTab).toBe(5);
    expect(result.current.activeTabId).toBe("stats");
    expect(result.current.hasOpenedStats).toBe(true);
  });

  it("syncs activeTab from browser history state", () => {
    const { result } = renderHook(() => useUIState(t));

    act(() => {
      result.current.setActiveTab(6);
    });
    act(() => {
      window.history.replaceState({ chromalumActiveTab: 2 }, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate", { state: { chromalumActiveTab: 2 } }));
    });

    expect(result.current.activeTab).toBe(2);
    expect(result.current.activeTabId).toBe("source");
    expect(window.location.hash).toBe("");
    expect(localStorage.getItem("chromalum-active-tab-v2")).toBe("2");
  });

  it("ignores storage failures while restoring scroll position", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      if (key === "chromalum-scroll-y") throw new DOMException("Storage blocked", "SecurityError");
      return null;
    });

    const { result } = renderHook(() => useUIState(t));

    expect(result.current.activeTab).toBe(2);
    expect(result.current.activeTabId).toBe("source");
  });

  it("ignores storage failures while saving scroll position", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === "chromalum-scroll-y") throw new DOMException("Storage blocked", "SecurityError");
    });
    renderHook(() => useUIState(t));

    expect(() => window.dispatchEvent(new Event("beforeunload"))).not.toThrow();
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

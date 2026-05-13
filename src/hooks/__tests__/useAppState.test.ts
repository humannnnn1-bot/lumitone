// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock idb-persistence so IndexedDB is not required
vi.mock("../../utils/idb-persistence", () => ({
  SAVED_STATE_VERSION: 1,
  loadState: vi.fn(() => Promise.resolve(null)),
  loadStateWithStatus: vi.fn(() => Promise.resolve({ status: "empty", state: null })),
  saveState: vi.fn(() => Promise.resolve()),
  requestPersistentStorage: vi.fn(() => Promise.resolve({ supported: true, persisted: true, requested: true })),
}));

import { getCanvasDisplaySize, useAppState } from "../useAppState";
import { loadStateWithStatus, requestPersistentStorage, saveState } from "../../utils/idb-persistence";
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from "../../constants";

// Minimal translation stub
const t = ((key: string) => key) as import("../../i18n").TranslationFn;
async function waitForLoaded(result: { current: ReturnType<typeof useAppState> }) {
  await waitFor(() => expect(result.current.loaded).toBe(true));
}

describe("useAppState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(loadStateWithStatus).mockResolvedValue({ status: "empty", state: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses desktop width for wide landscape canvases while preserving square and portrait sizing", () => {
    expect(getCanvasDisplaySize(320, 320, 1280, 720)).toEqual({ displayWidth: 540, displayHeight: 540 });
    expect(getCanvasDisplaySize(900, 1600, 1280, 720)).toEqual({ displayWidth: 304, displayHeight: 540 });
    expect(getCanvasDisplaySize(1600, 900, 1280, 720)).toEqual({ displayWidth: 796, displayHeight: 448 });
  });

  it("uses side-by-side sizing earlier for portrait canvases", () => {
    expect(getCanvasDisplaySize(900, 1600, 840, 720)).toEqual({ displayWidth: 304, displayHeight: 540 });
    expect(getCanvasDisplaySize(1200, 1600, 900, 1000)).toEqual({ displayWidth: 416, displayHeight: 555 });
    expect(getCanvasDisplaySize(320, 320, 900, 1000)).toEqual({ displayWidth: 700, displayHeight: 700 });
  });

  it("keeps mobile landscape canvases on the existing width-constrained sizing path", () => {
    expect(getCanvasDisplaySize(1600, 900, 390, 844)).toEqual({ displayWidth: 358, displayHeight: 201 });
    expect(getCanvasDisplaySize(320, 320, 390, 844)).toEqual({ displayWidth: 358, displayHeight: 358 });
  });

  it("gives mobile portrait canvases a modest height boost without exceeding the width budget", () => {
    expect(getCanvasDisplaySize(64, 512, 390, 844)).toEqual({ displayWidth: 54, displayHeight: 430 });
    expect(getCanvasDisplaySize(300, 320, 390, 844)).toEqual({ displayWidth: 358, displayHeight: 382 });
  });

  it("composes the initial app state needed by the canvas UI", async () => {
    const { result } = renderHook(() => useAppState(t));
    await waitForLoaded(result);
    const s = result.current;

    expect(s.canvasData.width).toBe(DEFAULT_CANVAS_WIDTH);
    expect(s.canvasData.height).toBe(DEFAULT_CANVAS_HEIGHT);
    expect(s.canvasData.levelData).toBeInstanceOf(Uint8Array);
    expect(s.canvasData.levelData.length).toBe(DEFAULT_CANVAS_WIDTH * DEFAULT_CANVAS_HEIGHT);
    expect(s.state.undoStack).toBeDefined();
    expect(s.state.redoStack).toBeDefined();
    expect(s.state.levelHistogram.length).toBe(8);
    expect(s.tool).toBe("brush");
    expect(s.brushLevel).toBe(7);
    expect(s.brushSize).toBe(12);
    expect(Array.isArray(s.lockedLevels)).toBe(true);
    expect(result.current.colorLUT).toHaveLength(8);
    for (const rgb of result.current.colorLUT) expect(rgb).toHaveLength(3);
  });

  it("passes through composed tool and color-state actions", async () => {
    const { result } = renderHook(() => useAppState(t));
    await waitForLoaded(result);

    act(() => {
      result.current.setTool("fill");
      result.current.setBrushLevel(3);
      result.current.setBrushSize(24);
      result.current.toggleLevelLock(2);
    });

    expect(result.current.tool).toBe("fill");
    expect(result.current.brushLevel).toBe(3);
    expect(result.current.brushSize).toBe(24);
    expect(result.current.lockedLevels[2]).toBe(true);
    expect(result.current.lockedLevels[0]).toBe(false);
  });

  it("updates the untouched brush size when canvas dimensions change", async () => {
    const { result } = renderHook(() => useAppState(t));
    await waitForLoaded(result);

    act(() => {
      result.current.dispatch({ type: "new_canvas", width: 64, height: 64 });
    });

    expect(result.current.brushSize).toBe(2);
  });

  it("keeps a manually selected brush size across canvas dimension changes", async () => {
    const { result } = renderHook(() => useAppState(t));
    await waitForLoaded(result);

    act(() => {
      result.current.setBrushSize(24);
      result.current.dispatch({ type: "new_canvas", width: 1024, height: 1024 });
    });

    expect(result.current.brushSize).toBe(24);
  });

  it("does not mark a failed autosave as saved", async () => {
    vi.useFakeTimers();
    const saveStateMock = vi.mocked(saveState);
    let rejectFirst!: (reason?: unknown) => void;
    saveStateMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    const t2 = ((key: string) => key) as import("../../i18n").TranslationFn;

    const { result, rerender, unmount } = renderHook(({ tr }) => useAppState(tr), { initialProps: { tr: t } });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveStateMock).toHaveBeenCalledTimes(1);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      rejectFirst(new Error("quota"));
      await Promise.resolve();
    });

    rerender({ tr: t2 });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(saveStateMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
    unmount();
  });

  it("does not overwrite an invalid saved state with the baseline autosave", async () => {
    vi.useFakeTimers();
    vi.mocked(loadStateWithStatus).mockResolvedValueOnce({
      status: "invalid",
      state: null,
      reason: "saved state has an unsupported shape",
    });
    const saveStateMock = vi.mocked(saveState);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useAppState(t));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(saveStateMock).not.toHaveBeenCalled();
    expect(result.current.toast).toEqual({ message: "toast_restore_invalid", type: "error" });
    expect(warnSpy).toHaveBeenCalledWith("CHROMALUM: saved state was ignored:", "saved state has an unsupported shape");

    act(() => {
      result.current.dispatch({ type: "new_canvas", width: 16, height: 16 });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(saveStateMock).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    unmount();
  });

  it("requests persistent storage once after the baseline autosave", async () => {
    vi.useFakeTimers();
    const saveStateMock = vi.mocked(saveState);
    const requestPersistentStorageMock = vi.mocked(requestPersistentStorage);

    const { result, unmount } = renderHook(() => useAppState(t));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(saveStateMock).toHaveBeenCalledTimes(1);
    expect(requestPersistentStorageMock).not.toHaveBeenCalled();

    act(() => {
      result.current.dispatch({ type: "new_canvas", width: 16, height: 16 });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveStateMock).toHaveBeenCalledTimes(2);
    expect(requestPersistentStorageMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("chromalum-storage-persist-requested-v1")).toBe("1");

    act(() => {
      result.current.dispatch({ type: "new_canvas", width: 32, height: 32 });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveStateMock).toHaveBeenCalledTimes(3);
    expect(requestPersistentStorageMock).toHaveBeenCalledTimes(1);
    unmount();
  });
});

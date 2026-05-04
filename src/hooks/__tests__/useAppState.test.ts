// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock idb-persistence so IndexedDB is not required
vi.mock("../../utils/idb-persistence", () => ({
  loadState: vi.fn(() => Promise.resolve(null)),
  saveState: vi.fn(() => Promise.resolve()),
  requestPersistentStorage: vi.fn(() => Promise.resolve({ supported: true, persisted: true, requested: true })),
}));

import { useAppState } from "../useAppState";
import { requestPersistentStorage, saveState } from "../../utils/idb-persistence";
import { W0, H0 } from "../../constants";

// Minimal translation stub
const t = ((key: string) => key) as import("../../i18n").TranslationFn;

describe("useAppState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("composes the initial app state needed by the canvas UI", () => {
    const { result } = renderHook(() => useAppState(t));
    const s = result.current;

    expect(s.cvs.w).toBe(W0);
    expect(s.cvs.h).toBe(H0);
    expect(s.cvs.data).toBeInstanceOf(Uint8Array);
    expect(s.cvs.data.length).toBe(W0 * H0);
    expect(s.state.undoStack).toBeDefined();
    expect(s.state.redoStack).toBeDefined();
    expect(s.state.hist.length).toBe(8);
    expect(s.tool).toBe("brush");
    expect(s.brushLevel).toBe(7);
    expect(s.brushSize).toBe(12);
    expect(Array.isArray(s.locked)).toBe(true);
    expect(result.current.colorLUT).toHaveLength(8);
    for (const rgb of result.current.colorLUT) expect(rgb).toHaveLength(3);
  });

  it("passes through composed tool and color-state actions", () => {
    const { result } = renderHook(() => useAppState(t));

    act(() => {
      result.current.setTool("fill");
      result.current.setBrushLevel(3);
      result.current.setBrushSize(24);
      result.current.toggleLock(2);
    });

    expect(result.current.tool).toBe("fill");
    expect(result.current.brushLevel).toBe(3);
    expect(result.current.brushSize).toBe(24);
    expect(result.current.locked[2]).toBe(true);
    expect(result.current.locked[0]).toBe(false);
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
      result.current.dispatch({ type: "new_canvas", w: 16, h: 16 });
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
      result.current.dispatch({ type: "new_canvas", w: 32, h: 32 });
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

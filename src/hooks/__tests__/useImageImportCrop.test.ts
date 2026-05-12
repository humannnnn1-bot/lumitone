// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useImageImportCrop } from "../useImageImportCrop";

describe("useImageImportCrop", () => {
  it("stores a crop request, loads the confirmed crop, and resets the viewport", () => {
    const dispatch = vi.fn();
    const setZoom = vi.fn();
    const setPan = vi.fn();

    const { result } = renderHook(() => useImageImportCrop({ dispatch, setZoom, setPan }));
    const img = document.createElement("img");

    act(() => {
      result.current.handleCropRequest(img, 4, 3);
    });

    expect(result.current.cropImage).toEqual({ img, w: 4, h: 3 });

    act(() => {
      result.current.handleCropConfirm(0, 0, 2, 2);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "load_image",
      width: 2,
      height: 2,
      levelData: expect.any(Uint8Array),
    });
    expect(dispatch.mock.calls[0][0].levelData).toHaveLength(4);
    expect(setZoom).toHaveBeenCalledWith(1);
    expect(setPan).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(result.current.cropImage).toBeNull();
  });

  it("clears a pending crop request when cancelled", () => {
    const { result } = renderHook(() => useImageImportCrop({ dispatch: vi.fn(), setZoom: vi.fn(), setPan: vi.fn() }));
    const img = document.createElement("img");

    act(() => {
      result.current.handleCropRequest(img, 4, 3);
      result.current.handleCropCancel();
    });

    expect(result.current.cropImage).toBeNull();
  });
});

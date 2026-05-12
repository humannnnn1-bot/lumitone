// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MAX_FILE_BYTES } from "../../constants";
import { useFileDrop } from "../useFileDrop";
import type { CanvasAction } from "../../types";

const t = ((key: string, ...params: (string | number)[]) =>
  params.length ? `${key}:${params.join(",")}` : key) as import("../../i18n").TranslationFn;

function makeFile(type: string, size = 4, name = "image.png"): File {
  return new File([new Uint8Array(size)], name, { type });
}

function makeLargeImageFile(): File {
  return new File([new Uint8Array(MAX_FILE_BYTES + 1)], "huge.png", { type: "image/png" });
}

function installImageBitmap(width = 3, height = 2) {
  const close = vi.fn();
  const bitmap = { width, height, close } as unknown as ImageBitmap;
  const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
  Object.defineProperty(window, "createImageBitmap", { value: createImageBitmap, configurable: true, writable: true });
  return { bitmap, close, createImageBitmap };
}

class AutoLoadImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 3;
  height = 2;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class AutoErrorImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 3;
  height = 2;

  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

function setup(onCropRequest?: (img: HTMLImageElement, w: number, h: number) => void) {
  const dispatch = vi.fn<React.Dispatch<CanvasAction>>();
  const setZoom = vi.fn<React.Dispatch<React.SetStateAction<number>>>();
  const setPan = vi.fn<React.Dispatch<React.SetStateAction<{ x: number; y: number }>>>();
  const showToast = vi.fn<(message: string, type: "error" | "success" | "info") => void>();
  const announce = vi.fn<(msg: string) => void>();
  const hook = renderHook(() => useFileDrop(dispatch, setZoom, setPan, showToast, announce, t, onCropRequest));
  return { ...hook, dispatch, setZoom, setPan, showToast, announce };
}

function makeDragEvent(files: File[] = []): React.DragEvent {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      files,
      dropEffect: "none",
    },
  } as unknown as React.DragEvent;
}

function makeClipboardEvent(items: Array<{ type: string; getAsFile: () => File | null }>): ClipboardEvent {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    configurable: true,
    value: { items },
  });
  return event;
}

describe("useFileDrop", () => {
  const originalImage = window.Image;

  beforeEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "createImageBitmap");
  });

  afterEach(() => {
    window.Image = originalImage;
  });

  it("ignores unsupported image types without user-visible side effects", async () => {
    const { result, dispatch, setZoom, setPan, showToast } = setup();

    await act(async () => {
      await result.current.loadImg(makeFile("text/plain", 8, "note.txt"));
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(setZoom).not.toHaveBeenCalled();
    expect(setPan).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not accept SVG files as image imports", async () => {
    const createImageBitmap = vi.fn();
    Object.defineProperty(window, "createImageBitmap", { value: createImageBitmap, configurable: true, writable: true });
    const { result, dispatch, showToast } = setup();

    await act(async () => {
      await result.current.loadImg(makeFile("image/svg+xml", 8, "vector.svg"));
    });

    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("rejects files above the size limit before decoding", async () => {
    const { result, dispatch, showToast } = setup();

    await act(async () => {
      await result.current.loadImg(makeLargeImageFile());
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("toast_image_too_large", "error");
  });

  it("does not expose file names in image decode failure toasts", async () => {
    Object.defineProperty(window, "createImageBitmap", {
      value: vi.fn().mockRejectedValue(new Error("decode failed")),
      configurable: true,
      writable: true,
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    window.Image = AutoErrorImage as unknown as typeof Image;
    const maliciousName = '<img src=x onerror="alert(1)">.png';
    const { result, dispatch, showToast } = setup();

    await act(async () => {
      await result.current.loadImg(makeFile("image/png", 8, maliciousName));
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("toast_image_load_failed", "error");
    expect(showToast.mock.calls.every(([message]) => !String(message).includes(maliciousName))).toBe(true);
  });

  it("loads a supported image into canvas state and resets pan/zoom", async () => {
    const { close, createImageBitmap } = installImageBitmap(3, 2);
    const { result, dispatch, setZoom, setPan, showToast } = setup();

    await act(async () => {
      await result.current.loadImg(makeFile("image/png"));
    });

    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0][0] as CanvasAction;
    expect(action.type).toBe("load_image");
    if (action.type === "load_image") {
      expect(action.width).toBe(3);
      expect(action.height).toBe(2);
      expect(action.levelData).toBeInstanceOf(Uint8Array);
      expect(action.levelData).toHaveLength(6);
    }
    expect(setZoom).toHaveBeenCalledWith(1);
    expect(setPan).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("routes decoded images to crop request without dispatching a canvas load", async () => {
    installImageBitmap(4, 3);
    window.Image = AutoLoadImage as unknown as typeof Image;
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,ok");
    const onCropRequest = vi.fn<(img: HTMLImageElement, w: number, h: number) => void>();
    const { result, dispatch, setZoom, setPan } = setup(onCropRequest);

    await act(async () => {
      await result.current.loadImg(makeFile("image/png"));
    });

    expect(onCropRequest).toHaveBeenCalledTimes(1);
    expect(onCropRequest.mock.calls[0][1]).toBe(4);
    expect(onCropRequest.mock.calls[0][2]).toBe(3);
    expect(dispatch).not.toHaveBeenCalled();
    expect(setZoom).not.toHaveBeenCalled();
    expect(setPan).not.toHaveBeenCalled();
  });

  it("reports processing failure when the canvas context cannot be created", async () => {
    installImageBitmap(3, 2);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { result, dispatch, showToast } = setup();

    await act(async () => {
      await result.current.loadImg(makeFile("image/png"));
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("toast_image_process_failed", "error");
  });

  it("tracks nested drag state and announces entry and final leave", () => {
    const { result, announce } = setup();
    const enter = makeDragEvent();
    const firstLeave = makeDragEvent();
    const secondLeave = makeDragEvent();

    act(() => {
      result.current.onDragEnter(enter);
      result.current.onDragEnter(makeDragEvent());
    });

    expect(enter.preventDefault).toHaveBeenCalled();
    expect(result.current.dragging).toBe(true);
    expect(announce).toHaveBeenCalledWith("drop_announce");

    act(() => {
      result.current.onDragLeave(firstLeave);
    });
    expect(result.current.dragging).toBe(true);
    expect(announce).not.toHaveBeenCalledWith("");

    act(() => {
      result.current.onDragLeave(secondLeave);
    });
    expect(result.current.dragging).toBe(false);
    expect(secondLeave.preventDefault).toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith("");
  });

  it("marks drag-over as copy and drops the first supported image file", async () => {
    installImageBitmap(2, 2);
    const { result, dispatch } = setup();
    const over = makeDragEvent();
    const drop = makeDragEvent([
      makeFile("text/plain", 4, "note.txt"),
      makeFile("image/png", 4, "image.png"),
      makeFile("image/jpeg", 4, "later.jpg"),
    ]);

    act(() => {
      result.current.onDragEnter(makeDragEvent());
      result.current.onDragOver(over);
    });
    expect(over.dataTransfer.dropEffect).toBe("copy");

    act(() => {
      result.current.onDrop(drop);
    });

    expect(drop.preventDefault).toHaveBeenCalled();
    expect(result.current.dragging).toBe(false);
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const action = dispatch.mock.calls[0][0] as CanvasAction;
    expect(action.type).toBe("load_image");
  });

  it("loads pasted images unless focus is inside an editable field", async () => {
    installImageBitmap(2, 2);
    const { dispatch } = setup();
    const pastedFile = makeFile("image/png", 4, "pasted.png");
    const paste = makeClipboardEvent([
      { type: "text/plain", getAsFile: () => makeFile("text/plain", 4, "note.txt") },
      { type: "image/png", getAsFile: () => pastedFile },
    ]);
    const preventDefault = vi.spyOn(paste, "preventDefault");

    act(() => {
      window.dispatchEvent(paste);
    });

    expect(preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));

    dispatch.mockClear();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const ignoredPaste = makeClipboardEvent([{ type: "image/png", getAsFile: () => pastedFile }]);
    const ignoredPreventDefault = vi.spyOn(ignoredPaste, "preventDefault");

    act(() => {
      window.dispatchEvent(ignoredPaste);
    });

    expect(ignoredPreventDefault).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});

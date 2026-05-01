// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MAX_UNDO } from "../../constants";
import type { AppState, CanvasData, CompressedDiff, MapMode, PanZoomHandlers } from "../../types";
import type { PixelMaps as PixelMapsType } from "../../hooks/usePixelMaps";
import { RingBuffer } from "../../utils/ring-buffer";
import { GlazeContextProvider, type GlazeContextValue } from "../../state/GlazeContext";
import type { GlazeDrawingResult } from "../../hooks/useGlazeDrawing";
import { SourcePanel } from "../SourcePanel";
import { ColorPanel } from "../ColorPanel";
import { GlazePanel } from "../GlazePanel";
import { CropModal } from "../CropModal";
import { MapCanvas } from "../MapCanvas";

vi.mock("../../i18n", () => ({
  useTranslation: () => ({
    t: (key: string, ...args: unknown[]) => (args.length ? `${key}(${args.join(",")})` : key),
  }),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => {},
}));

type PixelMaps = React.ComponentProps<typeof MapCanvas>["pixelMaps"];

const colorLUT: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 255],
  [255, 0, 0],
  [255, 0, 255],
  [0, 255, 0],
  [0, 255, 255],
  [255, 255, 0],
  [255, 255, 255],
];

function mockPointerFine(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("pointer: fine") ? matches : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function makeCanvasData(w = 4, h = 4): CanvasData {
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = i % 8;
  return { w, h, data, colorMap: new Uint8Array(w * h) };
}

function makeState(withUndo = false): AppState {
  const undoStack = new RingBuffer<CompressedDiff>(MAX_UNDO);
  if (withUndo) {
    undoStack.push({ runs: new Uint32Array([0, 1]), ov: new Uint8Array([0]), nv: new Uint8Array([1]) });
  }
  return {
    cvs: makeCanvasData(),
    undoStack,
    redoStack: new RingBuffer<CompressedDiff>(MAX_UNDO),
    hist: [2, 2, 2, 2, 2, 2, 2, 2],
  };
}

function makePanZoom(overrides?: Partial<PanZoomHandlers>): PanZoomHandlers {
  return {
    setZoom: vi.fn(),
    setPan: vi.fn(),
    schedCursorRef: { current: vi.fn() },
    spaceRef: { current: false },
    panningRef: { current: false },
    startPan: vi.fn(),
    handleMiddleDown: vi.fn(),
    movePan: vi.fn(),
    endPan: vi.fn(),
    ...overrides,
  };
}

function makeGlazeDrawing(overrides?: Partial<GlazeDrawingResult>): GlazeDrawingResult {
  return {
    srcRef: { current: null },
    curRef: { current: null },
    statusRef: { current: null },
    imgCacheRef: { current: { src: null, prv: null, s32: null, p32: null } },
    drawingRef: { current: false },
    cursorRafRef: { current: null },
    schedCursorRef: { current: null },
    cursorPosRef: { current: null },
    onDown: vi.fn(),
    onMove: vi.fn(),
    onUp: vi.fn(),
    pickHue: vi.fn(),
    trackCursor: vi.fn(),
    clearCursor: vi.fn(),
    ...overrides,
  };
}

function makePixelMaps(w = 2, h = 2): PixelMaps {
  return {
    w,
    h,
    noise: new Float32Array([0, 0.25, 0.5, 1]),
    depth: new Float32Array([0, 0.2, 0.8, 1]),
    gradAngle: new Float32Array([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    gradMag: new Float32Array([0, 0.2, 0.5, 1]),
    regionId: new Int32Array([1, 1, 2, 3]),
    isEdge: new Uint8Array([0, 1, 0, 0]),
    levelNorm: new Float32Array([0, 0.25, 0.5, 1]),
    localDiversity: new Float32Array([0, 0.25, 0.75, 1]),
  } satisfies PixelMapsType & { w: number; h: number };
}

describe("SourcePanel interactions", () => {
  beforeEach(() => {
    mockPointerFine(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderSource(overrides?: Partial<React.ComponentProps<typeof SourcePanel>>) {
    const srcRef = React.createRef<HTMLCanvasElement>();
    const prvRef = React.createRef<HTMLCanvasElement>();
    const setBrushSize = vi.fn();
    const setPan = vi.fn();
    const setZoom = vi.fn();
    const saveColor = vi.fn();
    const saveGlaze = vi.fn();
    const props: React.ComponentProps<typeof SourcePanel> = {
      srcRef,
      curRef: React.createRef<HTMLCanvasElement>(),
      srcWrapRef: React.createRef<HTMLDivElement>(),
      statusRef: React.createRef<HTMLDivElement>(),
      toolState: {
        tool: "brush",
        setTool: vi.fn(),
        brushLevel: 2,
        setBrushLevel: vi.fn(),
        brushSize: 4,
        setBrushSize,
      },
      viewState: {
        zoom: 1,
        setZoom,
        setPan,
        displayW: 64,
        displayH: 64,
        canvasTransform: {},
        canvasCursor: "crosshair",
      },
      saveActions: {
        saveColor,
        saveColorWithLUT: vi.fn(),
        saveGlaze,
        shareColor: vi.fn(),
        shareGlaze: vi.fn(),
      },
      colorLUT,
      state: makeState(true),
      onDown: vi.fn(),
      onMove: vi.fn(),
      onUp: vi.fn(),
      onPointerLeave: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      handleClear: vi.fn(),
      loadImg: vi.fn().mockResolvedValue(undefined),
      announce: vi.fn(),
      schedCursor: vi.fn(),
      prvRef,
      onNewCanvas: vi.fn(),
      panZoomMode: false,
      setPanZoomMode: vi.fn(),
      handleMiddleDown: vi.fn(),
      onPinchDown: vi.fn(),
      onPinchMove: vi.fn(),
      onPinchUp: vi.fn(),
      ...overrides,
    };
    const view = render(<SourcePanel {...props} />);
    return { ...view, props, setBrushSize, setPan, setZoom, saveColor, saveGlaze, srcRef, prvRef };
  }

  it("routes tool, brush-size, zoom, pan, and mobile save-confirm controls", () => {
    const { props, setBrushSize, setPan, setZoom, saveColor } = renderSource();

    fireEvent.click(screen.getByRole("radio", { name: /tool_eraser/ }));
    expect(props.toolState.setTool).toHaveBeenCalledWith("eraser");
    expect(props.announce).toHaveBeenCalledWith("announce_eraser");

    fireEvent.click(screen.getByLabelText("aria_brush_size_increase"));
    expect(setBrushSize).toHaveBeenCalledWith(expect.any(Function));
    expect((setBrushSize.mock.calls[0][0] as (value: number) => number)(4)).toBe(5);

    const zoomButton = screen.getByRole("button", { name: "aria_zoom_reset(100)" });
    fireEvent.click(zoomButton);
    expect(setZoom).toHaveBeenCalledWith(1);
    expect(setPan).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(props.schedCursor).toHaveBeenCalled();

    setPan.mockClear();
    const canvasWrap = screen.getByRole("application", { name: "aria_drawing_canvas" }).parentElement!;
    fireEvent.keyDown(canvasWrap, { key: "ArrowRight" });
    expect(setPan).toHaveBeenCalledWith(expect.any(Function));
    expect((setPan.mock.calls[0][0] as (value: { x: number; y: number }) => { x: number; y: number })({ x: 2, y: 3 })).toEqual({
      x: -8,
      y: 3,
    });

    fireEvent.click(screen.getByRole("button", { name: "btn_save_gray" }));
    expect(screen.getByRole("dialog", { name: "confirm_save_gray" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "btn_yes" }));
    expect(saveColor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^chromalum_gray_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );
  });

  it("uses immediate save/share actions on pointer-fine devices", () => {
    mockPointerFine(true);
    const { saveColor, saveGlaze } = renderSource();

    fireEvent.click(screen.getByRole("button", { name: "btn_save_color" }));
    expect(saveColor).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^chromalum_color_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/),
    );

    fireEvent.click(screen.getByRole("button", { name: "btn_save_glaze" }));
    expect(saveGlaze).toHaveBeenCalledWith(expect.stringMatching(/^chromalum_glaze_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/));
  });
});

describe("ColorPanel interactions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes keyboard pan/zoom and pointer drawing paths", () => {
    const setZoom = vi.fn();
    const panZoom = makePanZoom({ setZoom });
    const drawing = {
      onDownPrv: vi.fn(),
      onMovePrv: vi.fn(),
      onUp: vi.fn(),
      onPointerLeavePrv: vi.fn(),
      trackCursorPrv: vi.fn(),
      clearCursorPrv: vi.fn(),
    };
    render(
      <ColorPanel
        prvRef={React.createRef<HTMLCanvasElement>()}
        prvCurRef={React.createRef<HTMLCanvasElement>()}
        prvWrapRef={React.createRef<HTMLDivElement>()}
        displayW={64}
        displayH={64}
        canvasTransform={{}}
        canvasCursor="crosshair"
        cc={[0, 0, 0, 0, 0, 0, 0, 0]}
        ccDispatch={vi.fn()}
        brushLevel={2}
        setBrushLevel={vi.fn()}
        tool="brush"
        panZoom={panZoom}
        drawing={drawing}
      />,
    );

    const canvas = screen.getByRole("img", { name: "aria_color_preview_canvas" });
    fireEvent.pointerDown(canvas, { button: 0 });
    expect(drawing.onDownPrv).toHaveBeenCalled();

    panZoom.panningRef.current = true;
    fireEvent.pointerMove(canvas);
    fireEvent.pointerUp(canvas);
    expect(panZoom.movePan).toHaveBeenCalled();
    expect(panZoom.endPan).toHaveBeenCalled();

    const wrap = screen.getByLabelText("aria_color_preview");
    fireEvent.keyDown(wrap, { key: "+" });
    expect(setZoom).toHaveBeenCalledWith(expect.any(Function));
    expect((setZoom.mock.calls[0][0] as (value: number) => number)(1)).toBeCloseTo(1.15);
  });
});

describe("GlazePanel interactions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderGlaze(options?: { context?: Partial<GlazeContextValue>; props?: Partial<React.ComponentProps<typeof GlazePanel>> }) {
    const setHueAngle = vi.fn();
    const setGlazeTool = vi.fn();
    const setBrushSize = vi.fn();
    const setDirectCandidates = vi.fn();
    const context: GlazeContextValue = {
      hueAngle: 45,
      setHueAngle,
      glazeTool: "glaze_brush",
      setGlazeTool,
      brushSize: 4,
      setBrushSize,
      directCandidates: new Map([[2, 0]]),
      setDirectCandidates,
      ...options?.context,
    };
    const panZoom = makePanZoom();
    const glazeDrawing = makeGlazeDrawing();
    const props: React.ComponentProps<typeof GlazePanel> = {
      prvRef: React.createRef<HTMLCanvasElement>(),
      prvWrapRef: React.createRef<HTMLDivElement>(),
      displayW: 64,
      displayH: 64,
      canvasTransform: {},
      canvasCursor: "crosshair",
      cvs: { ...makeCanvasData(), colorMap: new Uint8Array([0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
      dispatch: vi.fn(),
      panZoom,
      glazeDrawing,
      announce: vi.fn(),
      showToast: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      zoom: 1,
      brushLevel: 2,
      panZoomMode: false,
      setPanZoomMode: vi.fn(),
      onPinchDown: vi.fn(),
      onPinchMove: vi.fn(),
      onPinchUp: vi.fn(),
      ...options?.props,
    };
    const view = render(
      <GlazeContextProvider {...context}>
        <GlazePanel {...props} />
      </GlazeContextProvider>,
    );
    return { ...view, props, context, panZoom, glazeDrawing, setHueAngle, setGlazeTool, setBrushSize, setDirectCandidates };
  }

  it("routes tool shortcuts, hue selection, clear action, and canvas pointer modes", () => {
    const { props, panZoom, glazeDrawing, setHueAngle, setGlazeTool, setBrushSize, setDirectCandidates } = renderGlaze();

    fireEvent.click(screen.getByRole("radio", { name: /tool_glaze_fill/ }));
    expect(setGlazeTool).toHaveBeenCalledWith("glaze_fill");
    expect(props.announce).toHaveBeenCalledWith("announce_glaze_fill");

    fireEvent.change(screen.getByLabelText("aria_hue_slider"), { target: { value: "120" } });
    expect(setHueAngle).toHaveBeenCalledWith(120);
    expect(setDirectCandidates).toHaveBeenCalledWith(new Map());

    fireEvent.click(screen.getByRole("button", { name: "btn_glaze_clear" }));
    expect(props.dispatch).toHaveBeenCalledWith({ type: "glaze_clear" });
    expect(screen.getByText("2px")).toBeTruthy();

    const canvas = screen.getByRole("img", { name: "label_glaze" });
    fireEvent.pointerDown(canvas, { button: 2 });
    expect(glazeDrawing.pickHue).toHaveBeenCalled();

    fireEvent.pointerDown(canvas, { button: 0 });
    expect(glazeDrawing.onDown).toHaveBeenCalled();

    panZoom.panningRef.current = true;
    fireEvent.pointerMove(canvas);
    fireEvent.pointerUp(canvas);
    expect(panZoom.movePan).toHaveBeenCalled();
    expect(panZoom.endPan).toHaveBeenCalled();

    const wrap = canvas.parentElement!;
    fireEvent.keyDown(wrap, { key: "]" });
    expect(setBrushSize).toHaveBeenCalledWith(expect.any(Function));
    expect((setBrushSize.mock.calls[0][0] as (value: number) => number)(4)).toBe(5);
  });

  it("keeps brush size controls visible for the glaze fill tool", () => {
    renderGlaze({ context: { glazeTool: "glaze_fill" } });

    expect(screen.getByLabelText("aria_brush_size")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("lets direct candidate swatches opt a level into and out of manual selection", () => {
    const { setDirectCandidates } = renderGlaze({ context: { directCandidates: new Map() } });
    const candidateButtons = screen.getAllByRole("button").filter((button) => button.getAttribute("title")?.startsWith("#"));
    expect(candidateButtons.length).toBeGreaterThan(0);

    fireEvent.click(candidateButtons[0]);
    expect(setDirectCandidates).toHaveBeenCalledWith(expect.any(Function));
    const updated = (setDirectCandidates.mock.calls[0][0] as (value: Map<number, number>) => Map<number, number>)(new Map());
    expect(updated.size).toBe(1);
  });
});

describe("CropModal interactions", () => {
  beforeEach(() => {
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = vi.fn();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clamps a corner resize and confirms the selected image crop", () => {
    const onConfirm = vi.fn();
    const { container } = render(
      <CropModal img={document.createElement("img")} imgW={64} imgH={64} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    const nwHandle = container.querySelector('div[style*="nw-resize"]') as HTMLElement;
    expect(nwHandle).toBeTruthy();

    fireEvent.pointerDown(nwHandle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(nwHandle, { clientX: 10, clientY: 12, pointerId: 1 });
    fireEvent.pointerUp(nwHandle, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "btn_ok" }));

    expect(onConfirm).toHaveBeenCalledWith(10, 12, 54, 52);
  });
});

describe("MapCanvas rendering and inspection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every map mode and reports per-pixel hover details", () => {
    const putImageData = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HTMLCanvasElement#getContext has incompatible overloads in tests
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (_contextId: string): any {
      return {
        createImageData: (w: number, h: number) => new ImageData(w, h),
        putImageData,
      };
    });

    const cvs = { ...makeCanvasData(2, 2), data: new Uint8Array([0, 2, 5, 7]) };
    const pixelMaps = makePixelMaps(2, 2);
    const { container, rerender } = render(
      <MapCanvas mode="luminance" pixelMaps={pixelMaps} colorLUT={colorLUT} cvs={cvs} displayW={20} displayH={20} />,
    );

    for (const mode of ["entropy", "noise", "depth", "luminance", "colorlum", "gradient", "region"] satisfies MapMode[]) {
      rerender(<MapCanvas mode={mode} pixelMaps={pixelMaps} colorLUT={colorLUT} cvs={cvs} displayW={20} displayH={20} />);
    }
    expect(putImageData).toHaveBeenCalledTimes(8);

    const canvas = container.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      right: 20,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseMove(canvas, { clientX: 5, clientY: 5 });
    expect(screen.getByText(/\(0,0\) Region:/)).toBeTruthy();
    fireEvent.mouseLeave(canvas);
    expect(screen.queryByText(/\(0,0\) Region:/)).toBeNull();
  });

  it("clears stale worker output instead of painting mismatched pixel-map dimensions", () => {
    const putImageData = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HTMLCanvasElement#getContext has incompatible overloads in tests
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (_contextId: string): any {
      return {
        createImageData: (w: number, h: number) => new ImageData(w, h),
        putImageData,
      };
    });

    render(
      <MapCanvas mode="noise" pixelMaps={makePixelMaps(1, 1)} colorLUT={colorLUT} cvs={makeCanvasData(2, 2)} displayW={20} displayH={20} />,
    );

    expect(putImageData).toHaveBeenCalledOnce();
    expect((putImageData.mock.calls[0][0] as ImageData).data.every((value) => value === 0)).toBe(true);
  });
});

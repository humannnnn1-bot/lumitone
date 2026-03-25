/* Shared test setup — polyfills for Node.js test environment */

if (typeof globalThis.ImageData === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polyfill requires global augmentation
  (globalThis as any).ImageData = class ImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches Web API ImageData constructor
    constructor(sw: number | Uint8ClampedArray, sh?: number, _settings?: any) {
      if (typeof sw === "number") {
        this.width = sw;
        this.height = sh!;
        this.data = new Uint8ClampedArray(sw * sh! * 4);
      } else {
        // ImageData(data, width, height?)
        this.data = sw;
        this.width = sh!;
        this.height = _settings ?? (sw.length / 4 / sh!);
      }
    }
  };
}

/* requestAnimationFrame / cancelAnimationFrame polyfill */
if (typeof globalThis.requestAnimationFrame === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polyfill
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 0) as unknown as number;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polyfill
  (globalThis as any).cancelAnimationFrame = (id: number): void => {
    clearTimeout(id);
  };
}

/* PointerEvent constructor polyfill (only in jsdom where MouseEvent exists) */
if (typeof globalThis.PointerEvent === "undefined" && typeof globalThis.MouseEvent !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- polyfill
  (globalThis as any).PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly tiltX: number;
    readonly tiltY: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.pointerType = params.pointerType ?? "";
      this.isPrimary = params.isPrimary ?? false;
    }
  };
}

/* HTMLCanvasElement.prototype.getContext mock */
if (typeof HTMLCanvasElement !== "undefined" && !(HTMLCanvasElement.prototype.getContext as any).__mocked) {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock override
  (HTMLCanvasElement.prototype as any).getContext = function (contextId: string, ...args: any[]) {
    try {
      return origGetContext.call(this, contextId, ...args);
    } catch {
      // jsdom does not support canvas contexts; return a mock 2d context
      if (contextId === "2d") {
        const noop = () => {};
        return {
          canvas: this,
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 1,
          font: "10px sans-serif",
          textAlign: "start",
          textBaseline: "alphabetic",
          globalAlpha: 1,
          globalCompositeOperation: "source-over",
          imageSmoothingEnabled: true,
          save: noop,
          restore: noop,
          beginPath: noop,
          closePath: noop,
          moveTo: noop,
          lineTo: noop,
          arc: noop,
          arcTo: noop,
          rect: noop,
          fill: noop,
          stroke: noop,
          clip: noop,
          clearRect: noop,
          fillRect: noop,
          strokeRect: noop,
          fillText: noop,
          strokeText: noop,
          measureText: () => ({ width: 0 }),
          scale: noop,
          rotate: noop,
          translate: noop,
          transform: noop,
          setTransform: noop,
          resetTransform: noop,
          drawImage: noop,
          createLinearGradient: () => ({ addColorStop: noop }),
          createRadialGradient: () => ({ addColorStop: noop }),
          createPattern: () => null,
          getImageData: (_x: number, _y: number, w: number, h: number) =>
            new ImageData(w, h),
          putImageData: noop,
          createImageData: (w: number, h: number) => new ImageData(w, h),
          setLineDash: noop,
          getLineDash: () => [],
          ellipse: noop,
          quadraticCurveTo: noop,
          bezierCurveTo: noop,
          isPointInPath: () => false,
          isPointInStroke: () => false,
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
        };
      }
      return null;
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tag as mocked
  (HTMLCanvasElement.prototype.getContext as any).__mocked = true;
}

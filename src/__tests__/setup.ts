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

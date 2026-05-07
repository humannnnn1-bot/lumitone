export interface PointerPressureSample {
  pointerType?: string;
  pressure?: number;
}

const PEN_PRESSURE_MIN_SCALE = 0.6;
const PEN_PRESSURE_MAX_SCALE = 1.2;
const PEN_PRESSURE_BASE = 0.5;

function penPressureScale(pressure: number): number {
  if (pressure <= PEN_PRESSURE_BASE) {
    const t = pressure / PEN_PRESSURE_BASE;
    return PEN_PRESSURE_MIN_SCALE + (1 - PEN_PRESSURE_MIN_SCALE) * t;
  }
  const t = (pressure - PEN_PRESSURE_BASE) / (1 - PEN_PRESSURE_BASE);
  return 1 + (PEN_PRESSURE_MAX_SCALE - 1) * t;
}

export function pressureAdjustedBrushSize(baseSize: number, sample: PointerPressureSample): number {
  if (sample.pointerType !== "pen") return baseSize;

  const rawPressure = sample.pressure;
  const pressure =
    typeof rawPressure === "number" && Number.isFinite(rawPressure) ? Math.max(0, Math.min(1, rawPressure)) : PEN_PRESSURE_BASE;
  return Math.max(1, Math.round(baseSize * penPressureScale(pressure)));
}

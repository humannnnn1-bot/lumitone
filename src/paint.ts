/* ═══════════════════════════════════════════
   PAINT FUNCTIONS
   ═══════════════════════════════════════════ */

export function paintCircle(data: Uint8Array, cx: number, cy: number, r: number, lv: number, w: number, h: number): void {
  if (r <= 0) {
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) data[cy * w + cx] = lv;
    return;
  }
  /* Midpoint Circle with horizontal scanline fill — O(r) outer pixels,
     total work proportional to filled area but avoids per-pixel distance checks. */
  const fillRow = (y: number, x0: number, x1: number) => {
    if (y < 0 || y >= h) return;
    const lo = Math.max(0, x0), hi = Math.min(w - 1, x1);
    for (let x = lo; x <= hi; x++) data[y * w + x] = lv;
  };
  let x = 0, y = r, d = 1 - r;
  while (x <= y) {
    fillRow(cy + y, cx - x, cx + x);
    fillRow(cy - y, cx - x, cx + x);
    if (x !== y) {
      fillRow(cy + x, cx - y, cx + y);
      fillRow(cy - x, cx - y, cx + y);
    }
    if (d < 0) { d += 2 * x + 3; } else { d += 2 * (x - y) + 5; y--; }
    x++;
  }
}

export function paintLine(data: Uint8Array, x0: number, y0: number, x1: number, y1: number, r: number, lv: number, w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  const ax = Math.abs(x1-x0), ay = Math.abs(y1-y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = ax - ay;
  // Sparse optimization: skip paintCircle when within r/2 of last painted point
  const skipDist = Math.max(1, Math.floor(r / 2));
  const skipDist2 = skipDist * skipDist;
  let lastPX = x0, lastPY = y0;
  paintCircle(data, x0, y0, r, lv, w, h);
  for (;;) {
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2*e;
    if (e2 > -ay) { e -= ay; x0 += sx; }
    if (e2 < ax) { e += ax; y0 += sy; }
    // Only paint if distance from last paint point exceeds threshold
    const dx = x0 - lastPX, dy = y0 - lastPY;
    if (dx * dx + dy * dy >= skipDist2) {
      paintCircle(data, x0, y0, r, lv, w, h);
      lastPX = x0; lastPY = y0;
    }
  }
  // Always paint final point
  paintCircle(data, x1, y1, r, lv, w, h);
}

/** Rectangle tool — draws four edges */
export function paintRect(data: Uint8Array, x0: number, y0: number, x1: number, y1: number, r: number, lv: number, w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  const left = Math.min(x0, x1), right = Math.max(x0, x1);
  const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
  paintLine(data, left, top, right, top, r, lv, w, h);
  paintLine(data, right, top, right, bottom, r, lv, w, h);
  paintLine(data, right, bottom, left, bottom, r, lv, w, h);
  paintLine(data, left, bottom, left, top, r, lv, w, h);
}

/** Ellipse tool — Midpoint Ellipse Algorithm */
export function paintEllipse(data: Uint8Array, x0: number, y0: number, x1: number, y1: number, r: number, lv: number, w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
  const rx = Math.abs(x1 - x0) >> 1, ry = Math.abs(y1 - y0) >> 1;
  if (rx === 0 && ry === 0) { paintCircle(data, cx, cy, r, lv, w, h); return; }
  if (rx === 0) { paintLine(data, cx, cy - ry, cx, cy + ry, r, lv, w, h); return; }
  if (ry === 0) { paintLine(data, cx - rx, cy, cx + rx, cy, r, lv, w, h); return; }
  let x = 0, y = ry;
  const rx2 = rx * rx, ry2 = ry * ry;
  let px = 0, py = 2 * rx2 * y;
  const plot4 = (ex: number, ey: number) => {
    paintCircle(data, cx+ex, cy+ey, r, lv, w, h);
    if (ex !== 0) paintCircle(data, cx-ex, cy+ey, r, lv, w, h);
    if (ey !== 0) {
      paintCircle(data, cx+ex, cy-ey, r, lv, w, h);
      if (ex !== 0) paintCircle(data, cx-ex, cy-ey, r, lv, w, h);
    }
  };
  /* Midpoint ellipse using scaled-integer arithmetic to avoid
     floating-point precision drift. Multiply decision params by 4. */
  let p1 = 4 * ry2 - 4 * rx2 * ry + rx2;
  while (px < py) {
    plot4(x, y);
    x++; px += 2 * ry2;
    if (p1 < 0) { p1 += 4 * (ry2 + px); }
    else { y--; py -= 2 * rx2; p1 += 4 * (ry2 + px - py); }
  }
  let p2 = ry2 * (2 * x + 1) * (2 * x + 1) + 4 * rx2 * (y - 1) * (y - 1) - 4 * rx2 * ry2;
  while (y >= 0) {
    plot4(x, y);
    y--; py -= 2 * rx2;
    if (p2 > 0) { p2 += 4 * (rx2 - py); }
    else { x++; px += 2 * ry2; p2 += 4 * (rx2 - py + px); }
  }
}

/** Shape tool painter dispatch table for type-safe dynamic tool selection. */
export const SHAPE_PAINTERS: Record<string, (data: Uint8Array, x0: number, y0: number, x1: number, y1: number, r: number, lv: number, w: number, h: number) => void> = {
  line: paintLine,
  rect: paintRect,
  ellipse: paintEllipse,
};

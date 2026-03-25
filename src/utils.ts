/* ═══════════════════════════════════════════
   UTILITY
   ═══════════════════════════════════════════ */
export const rgbStr = (c: [number, number, number]): string => `rgb(${c[0]},${c[1]},${c[2]})`;
export const hexStr = (c: [number, number, number]): string => "#" + c.map(v => v.toString(16).padStart(2,"0")).join("");

export function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

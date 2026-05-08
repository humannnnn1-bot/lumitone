import { useEffect, useState } from "react";

export interface StatusText {
  full: string;
  compact: string;
}

export type StatusTextLike = string | StatusText;

const COMPACT_STATUS_QUERY = "(max-width: 480px)";

function isStatusText(value: StatusTextLike): value is StatusText {
  return typeof value !== "string";
}

export function getFullStatusText(value: StatusTextLike): string {
  return isStatusText(value) ? value.full : value;
}

export function getVisibleStatusText(value: StatusTextLike, compact = shouldUseCompactStatus()): string {
  if (!isStatusText(value)) return value;
  return compact ? value.compact : value.full;
}

function shouldUseCompactStatus(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(COMPACT_STATUS_QUERY).matches;
}

export function applyStatusText(el: HTMLDivElement, value: StatusTextLike): void {
  const full = getFullStatusText(value);
  el.textContent = getVisibleStatusText(value);
  el.title = full;
}

export function useCompactStatus(): boolean {
  const [compact, setCompact] = useState(shouldUseCompactStatus);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(COMPACT_STATUS_QUERY);
    const onChange = () => setCompact(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return compact;
}

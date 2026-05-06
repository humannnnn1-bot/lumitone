type PerfDetail = Record<string, boolean | number | string | null | undefined>;

const DEBUG_QUERY_PARAM = "debugPerf";
const SAMPLE_LIMIT = 60;
const LOG_EVERY = 10;
const FRAME_BUDGET_MS = 16;

interface PerfBucket {
  count: number;
  samples: number[];
}

const buckets = new Map<string, PerfBucket>();
let enabledCache: boolean | null = null;

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

export function isDebugPerfEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  if (typeof window === "undefined") {
    enabledCache = false;
    return enabledCache;
  }
  enabledCache = new URLSearchParams(window.location.search).has(DEBUG_QUERY_PARAM);
  if (enabledCache) console.info("[debugPerf] enabled");
  return enabledCache;
}

export function startDebugPerf(): number | null {
  return isDebugPerfEnabled() ? nowMs() : null;
}

export function recordDebugPerf(label: string, startMs: number | null, detail?: PerfDetail): void {
  if (startMs === null || !isDebugPerfEnabled()) return;

  const durationMs = nowMs() - startMs;
  let bucket = buckets.get(label);
  if (!bucket) {
    bucket = { count: 0, samples: [] };
    buckets.set(label, bucket);
  }

  bucket.count++;
  bucket.samples.push(durationMs);
  if (bucket.samples.length > SAMPLE_LIMIT) bucket.samples.shift();

  if (bucket.count !== 1 && bucket.count % LOG_EVERY !== 0 && durationMs < FRAME_BUDGET_MS) return;

  const sorted = [...bucket.samples].sort((a, b) => a - b);
  const avg = bucket.samples.reduce((sum, value) => sum + value, 0) / bucket.samples.length;
  const max = sorted[sorted.length - 1] ?? 0;

  console.info(`[debugPerf] ${label}`, {
    lastMs: roundMs(durationMs),
    avgMs: roundMs(avg),
    p95Ms: roundMs(percentile(sorted, 0.95)),
    maxMs: roundMs(max),
    samples: bucket.samples.length,
    count: bucket.count,
    ...detail,
  });
}

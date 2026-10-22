import type { Dist } from "@/lib/dota/lab-refs";

// Small numeric helpers the analysis modules share.

// Where a value falls in a distribution, 0–1 (share of values below it, ties counted half).
export function percentileOf(d: Dist | null | undefined, v: number | null | undefined): number | null {
  if (!d?.n || v == null || !Number.isFinite(v)) return null;
  let below = 0;
  let equal = 0;
  for (const x of d.sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return (below + equal / 2) / d.n;
}

// The value at a percentile (0–1).
export function quantile(d: Dist | null | undefined, p: number): number | null {
  if (!d?.n) return null;
  const i = Math.min(d.n - 1, Math.max(0, Math.round(p * (d.n - 1))));
  return d.sorted[i];
}

export const median = (d: Dist | null | undefined) => quantile(d, 0.5);

// How unusual a value is against a spread (z-score), null when the spread is unknown or zero.
export function zScore(d: Dist | null | undefined, v: number | null | undefined): number | null {
  if (!d || d.n < 5 || !d.sd || v == null) return null;
  return (v - d.mean) / d.sd;
}

// A per-minute cumulative curve at a second (linear between minutes).
export function at(arr: (number | null)[] | undefined, t: number): number | null {
  if (!arr?.length) return null;
  const m = t / 60;
  if (m <= 0) return arr[0];
  const i = Math.floor(m);
  if (i >= arr.length - 1) return arr[arr.length - 1];
  const a = arr[i];
  const b = arr[i + 1];
  if (a == null || b == null) return a ?? b;
  return a + (b - a) * (m - i);
}

// Rate per minute of a cumulative curve between two seconds.
export function rate(arr: (number | null)[] | undefined, from: number, to: number): number | null {
  const a = at(arr, from);
  const b = at(arr, to);
  return a == null || b == null || to <= from ? null : ((b - a) / (to - from)) * 60;
}

export const sum = (list: number[]) => list.reduce((s, x) => s + x, 0);
export const mean = (list: number[]) => (list.length ? sum(list) / list.length : null);

// Map cells are about 128 game units.
export const CELL = 128;
export const cellDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

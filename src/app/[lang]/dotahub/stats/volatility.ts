import type { DetailMatch } from "@/lib/dota/admin";
import { quantile } from "./analysis";

// The numbers behind the 波动率 charts. A match's income is its GPM; a hero's volatility is how
// much that varies from match to match (coefficient of variation). The funnel's random draws use a
// fixed seed, so the same data always draws the same chart.

export const MIN_MATCHES = 3;
// Under this many matches a hero is drawn hollow / faded: its number is mostly luck.
export const FEW_MATCHES = 5;
const DRAWS = 500;

export const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
export function sd(v: number[]) {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}
export const cv = (v: number[]) => (v.length >= 2 && mean(v) ? sd(v) / Math.abs(mean(v)) : null);

// A small seeded generator (mulberry32).
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type HeroIncome = {
  id: number;
  matches: DetailMatch[]; // oldest first
  gpm: number[];
  n: number;
  median: number;
  mean: number;
  sd: number;
  cv: number;
};

export function byHero(list: DetailMatch[]): HeroIncome[] {
  const groups = new Map<number, DetailMatch[]>();
  for (const m of list) groups.set(m.heroId, [...(groups.get(m.heroId) ?? []), m]);
  return [...groups.entries()]
    .filter(([, matches]) => matches.length >= MIN_MATCHES)
    .map(([id, matches]) => {
      const ordered = [...matches].sort((a, b) => a.startTime - b.startTime);
      const gpm = ordered.map((m) => m.details.gpm);
      return {
        id,
        matches: ordered,
        gpm,
        n: gpm.length,
        median: quantile(
          [...gpm].sort((a, b) => a - b),
          0.5,
        )!,
        mean: mean(gpm),
        sd: sd(gpm),
        cv: cv(gpm) ?? 0,
      };
    })
    .sort((a, b) => b.n - a.n);
}

// The funnel: what volatility n matches would show from luck alone. Every match's GPM over its
// hero's average is pooled (taking out the hero), then samples of n are drawn from that pool.
export function funnel(heroes: HeroIncome[], maxN: number) {
  const pool = heroes.flatMap((h) => h.gpm.map((g) => g / h.mean));
  if (pool.length < 10) return null;
  const next = random(7);
  const points: { n: number; low: number; mid: number; high: number }[] = [];
  for (let n = MIN_MATCHES; n <= Math.max(maxN, MIN_MATCHES + 1); n++) {
    const draws: number[] = [];
    for (let i = 0; i < DRAWS; i++) {
      const sample = Array.from({ length: n }, () => pool[Math.floor(next() * pool.length)]);
      draws.push(cv(sample) ?? 0);
    }
    draws.sort((a, b) => a - b);
    points.push({
      n,
      low: quantile(draws, 0.025)!,
      mid: quantile(draws, 0.5)!,
      high: quantile(draws, 0.975)!,
    });
  }
  return { pooled: cv(pool) ?? 0, points };
}

// Volatility over the last `window` matches, match by match (oldest first).
export function rolling(gpm: number[], window: number) {
  return gpm.map((_, i) => (i + 1 < window ? null : cv(gpm.slice(i + 1 - window, i + 1))));
}

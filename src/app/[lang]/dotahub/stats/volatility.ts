import type { DetailMatch } from "@/lib/dota/admin";
import { FROM_MINUTE, LEAD_STATES, type LeadState, quantile, stateOf } from "./analysis";

// The numbers behind the 波动率 charts. A match's income is its GPM; a hero's volatility is how
// much that varies from match to match (coefficient of variation). Random draws (the funnel and the
// bootstrap) use a fixed seed, so the same data always draws the same chart.

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

// A steady jitter for a match's dot (the same match always lands in the same place).
export const jitter = (matchId: number) => (random(matchId)() - 0.5) * 0.7;

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

// The 95% range of a hero's volatility from resampling its own matches.
export function bootstrapCv(gpm: number[], seed: number) {
  const next = random(seed);
  const draws: number[] = [];
  for (let i = 0; i < DRAWS; i++) {
    const sample = gpm.map(() => gpm[Math.floor(next() * gpm.length)]);
    draws.push(cv(sample) ?? 0);
  }
  draws.sort((a, b) => a - b);
  return [quantile(draws, 0.025)!, quantile(draws, 0.975)!] as const;
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

// A match's average income over the minutes (from FROM_MINUTE) the team was in a state; null with
// fewer than 3 such minutes.
function stateIncome(m: DetailMatch, state: LeadState) {
  const { nwm, lead } = m.details;
  const gains: number[] = [];
  for (let minute = FROM_MINUTE; minute < nwm.length && minute < lead.length; minute++)
    if (stateOf(lead[minute]) === state) gains.push(nwm[minute] - nwm[minute - 1]);
  return gains.length >= 3 ? mean(gains) : null;
}

// Each hero's volatility while ahead, even and behind (matches with enough minutes in the state).
export function stateVolatility(hero: HeroIncome) {
  return Object.fromEntries(
    LEAD_STATES.map((state) => {
      const incomes = hero.matches.map((m) => stateIncome(m, state)).filter((v): v is number => v != null);
      return [state, incomes.length >= MIN_MATCHES ? { cv: cv(incomes)!, n: incomes.length } : null];
    }),
  ) as Record<LeadState, { cv: number; n: number } | null>;
}

// Volatility over the last `window` matches, match by match (oldest first).
export function rolling(gpm: number[], window: number) {
  return gpm.map((_, i) => (i + 1 < window ? null : cv(gpm.slice(i + 1 - window, i + 1))));
}

// A smoothed density (Gaussian kernel) of a hero's GPM, for the violins.
export function density(values: number[], from: number, to: number, steps = 40) {
  const bandwidth = 1.06 * (sd(values) || 50) * values.length ** -0.2;
  const xs = Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps);
  return xs.map((x) => [
    x,
    values.reduce((s, v) => s + Math.exp(-0.5 * ((x - v) / bandwidth) ** 2), 0) /
      (values.length * bandwidth * Math.sqrt(2 * Math.PI)),
  ]);
}

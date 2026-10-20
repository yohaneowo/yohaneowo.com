"use server";

import { getRankSample } from "@/lib/dota/admin";

// A hero's IMP minute by minute at a rank tier (medal 1–8), from admin's sample of that tier's
// matches: the average and the middle half (25–75%) at each minute with enough matches. Asking
// keeps the sample collected; count is short of target while it's still being collected.
export type RankImp = {
  count: number;
  target: number;
  mean: (number | null)[];
  low: (number | null)[];
  high: (number | null)[];
};

// Fewer matches than this still going at a minute: no point drawn there.
const MIN_AT_MINUTE = 5;

const quantile = (sorted: number[], q: number) => {
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  return sorted[lo] + (sorted[Math.ceil(at)] - sorted[lo]) * (at - lo);
};

export async function rankImp(heroId: number, tier: number): Promise<RankImp | null> {
  if (
    !Number.isInteger(heroId) ||
    heroId < 1 ||
    heroId > 1000 ||
    !Number.isInteger(tier) ||
    tier < 1 ||
    tier > 8
  )
    return null;
  const data = await getRankSample(heroId, tier).catch(() => null);
  if (!data) return null;
  const length = Math.max(0, ...data.matches.map((m) => m.details.impm.length));
  const mean: (number | null)[] = [];
  const low: (number | null)[] = [];
  const high: (number | null)[] = [];
  for (let minute = 0; minute < length; minute++) {
    const values = data.matches
      .map((m) => m.details.impm[minute])
      .filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
    const enough = values.length >= MIN_AT_MINUTE;
    mean.push(enough ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);
    low.push(enough ? Math.round(quantile(values, 0.25)) : null);
    high.push(enough ? Math.round(quantile(values, 0.75)) : null);
  }
  return { count: data.count, target: data.target, mean, low, high };
}

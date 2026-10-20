import type { DetailMatch } from "@/lib/dota/admin";

// Pure helpers for the 经济 and IMP pages: game state from the team's net worth lead, spreads,
// streaks. Everything is from the player's side.

export type LeadState = "ahead" | "even" | "behind";
export const LEAD_STATES: LeadState[] = ["ahead", "even", "behind"];
// Within this many gold either way the game counts as even.
export const EVEN_GOLD = 2000;
// Ahead / even / behind by minute starts here: in the laning stage the lead is nearly always small
// and the income low, which would make "even" look poor for reasons that aren't the lead.
export const FROM_MINUTE = 10;
// A match is a winning / losing game by the lead at this minute…
export const TILT_MINUTE = 15;
export const TILT_GOLD = 3000;
// …and a comeback / thrown game by how far behind / ahead it got.
export const SWING_GOLD = 10000;
// Earlier matches in the same sitting (for the streak table).
export const SITTING_GAP_SECONDS = 3 * 3600;

export const stateOf = (lead: number): LeadState =>
  lead > EVEN_GOLD ? "ahead" : lead < -EVEN_GOLD ? "behind" : "even";

export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  return sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * (at - low);
}

// Low and high ends (10th and 90th percentile, so one odd minute doesn't set them), quartiles and
// median.
export function spread(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
  };
}

// Coefficient of variation: the standard deviation as a share of the mean (how unsteady).
export function variation(values: number[]) {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (!mean) return null;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
  return sd / Math.abs(mean);
}

// Gold gained each minute (net worth minus the minute before), by whether the team was ahead,
// even or behind at that minute. Net worth counts items, so a minute with a sale can dip.
export function incomeByState(matches: DetailMatch[]) {
  const out: Record<LeadState, number[]> = { ahead: [], even: [], behind: [] };
  for (const m of matches) {
    const { nwm, lead } = m.details;
    for (let minute = FROM_MINUTE; minute < nwm.length && minute < lead.length; minute++)
      out[stateOf(lead[minute])].push(nwm[minute] - nwm[minute - 1]);
  }
  return out;
}

// IMP at each minute by the game state then.
export function impByState(matches: DetailMatch[]) {
  const out: Record<LeadState, number[]> = { ahead: [], even: [], behind: [] };
  for (const m of matches) {
    const { impm, lead } = m.details;
    for (let minute = FROM_MINUTE; minute < impm.length && minute < lead.length; minute++)
      out[stateOf(lead[minute])].push(impm[minute]);
  }
  return out;
}

// Winning, even or losing game by the lead at TILT_MINUTE (null: ended before or no data).
export function gameState(m: DetailMatch): LeadState | null {
  const lead = m.details.lead[TILT_MINUTE];
  if (lead == null) return null;
  return lead >= TILT_GOLD ? "ahead" : lead <= -TILT_GOLD ? "behind" : "even";
}

export const deepestDeficit = (m: DetailMatch) => Math.min(0, ...m.details.lead);
export const biggestLead = (m: DetailMatch) => Math.max(0, ...m.details.lead);
export const isComeback = (m: DetailMatch) => m.won && deepestDeficit(m) <= -SWING_GOLD;
export const isThrow = (m: DetailMatch) => !m.won && biggestLead(m) >= SWING_GOLD;
// The lowest / highest win chance STRATZ gave the player's team during the match.
export const lowestChance = (m: DetailMatch) => (m.details.wp.length ? Math.min(...m.details.wp) : null);
export const highestChance = (m: DetailMatch) => (m.details.wp.length ? Math.max(...m.details.wp) : null);

export type StreakKey = "fresh" | "afterWin" | "afterLoss" | "afterTwoLosses";
export const STREAK_KEYS: StreakKey[] = ["fresh", "afterWin", "afterLoss", "afterTwoLosses"];

// What came just before each match in the same sitting: nothing (the first game), a win, a loss,
// or two losses in a row. all: every loaded match, newest first, to look the previous ones up.
export function streakOf(m: DetailMatch, all: DetailMatch[]): StreakKey {
  const i = all.findIndex((x) => x.matchId === m.matchId);
  const previous = all[i + 1];
  const close = (a: DetailMatch, b: DetailMatch | undefined) =>
    b != null && a.startTime - (b.startTime + b.duration) <= SITTING_GAP_SECONDS;
  if (!close(m, previous)) return "fresh";
  if (previous.won) return "afterWin";
  return close(previous, all[i + 2]) && !all[i + 2].won ? "afterTwoLosses" : "afterLoss";
}

// The player's minute-10 / 20 / 30 net worth and last hits against the hero's average there.
export function againstAverage(matches: DetailMatch[], minute: 10 | 20 | 30, what: "nw" | "lh") {
  const ratios: number[] = [];
  for (const m of matches) {
    const bench = m.details.bench?.[String(minute)];
    if (!bench) continue;
    const [nw, lh] = bench;
    if (what === "nw" && m.details.nwm[minute] != null && nw > 0) ratios.push(m.details.nwm[minute] / nw - 1);
    if (what === "lh" && m.details.lhm.length >= minute && lh > 0)
      ratios.push(m.details.lhm.slice(0, minute).reduce((a, b) => a + b, 0) / lh - 1);
  }
  return ratios.length ? { n: ratios.length, diff: ratios.reduce((a, b) => a + b, 0) / ratios.length } : null;
}

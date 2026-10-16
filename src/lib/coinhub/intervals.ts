import type { Period } from "klinecharts";
import type { CoinSymbol } from "./types";

// "15m", "4h", "1D"… The standard set below plus anything typed on the chart ("7m", "2D") that
// a source can build by resampling a standard interval.
export type IntervalKey = string;

export type YahooBase = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1wk" | "1mo";

export interface IntervalDef {
  key: IntervalKey;
  period: Period;
  // Approximate length, for bucketing and "bars per range" maths (a month counts as 30 days).
  ms: number;
  binance: string;
  // Yahoo interval to request; bars are resampled when it is shorter than this interval.
  yahoo: YahooBase | null;
  group: "seconds" | "minutes" | "hours" | "days";
  // True when `binance` is a shorter interval that has to be resampled into this one.
  resample?: boolean;
}

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

export const INTERVALS: IntervalDef[] = [
  { key: "1s", period: { type: "second", span: 1 }, ms: S, binance: "1s", yahoo: null, group: "seconds" },
  { key: "1m", period: { type: "minute", span: 1 }, ms: M, binance: "1m", yahoo: "1m", group: "minutes" },
  { key: "3m", period: { type: "minute", span: 3 }, ms: 3 * M, binance: "3m", yahoo: "1m", group: "minutes" },
  { key: "5m", period: { type: "minute", span: 5 }, ms: 5 * M, binance: "5m", yahoo: "5m", group: "minutes" },
  {
    key: "15m",
    period: { type: "minute", span: 15 },
    ms: 15 * M,
    binance: "15m",
    yahoo: "15m",
    group: "minutes",
  },
  {
    key: "30m",
    period: { type: "minute", span: 30 },
    ms: 30 * M,
    binance: "30m",
    yahoo: "30m",
    group: "minutes",
  },
  { key: "1h", period: { type: "hour", span: 1 }, ms: H, binance: "1h", yahoo: "60m", group: "hours" },
  { key: "2h", period: { type: "hour", span: 2 }, ms: 2 * H, binance: "2h", yahoo: "60m", group: "hours" },
  { key: "4h", period: { type: "hour", span: 4 }, ms: 4 * H, binance: "4h", yahoo: "60m", group: "hours" },
  { key: "6h", period: { type: "hour", span: 6 }, ms: 6 * H, binance: "6h", yahoo: "60m", group: "hours" },
  { key: "8h", period: { type: "hour", span: 8 }, ms: 8 * H, binance: "8h", yahoo: "60m", group: "hours" },
  {
    key: "12h",
    period: { type: "hour", span: 12 },
    ms: 12 * H,
    binance: "12h",
    yahoo: "60m",
    group: "hours",
  },
  { key: "1D", period: { type: "day", span: 1 }, ms: D, binance: "1d", yahoo: "1d", group: "days" },
  { key: "3D", period: { type: "day", span: 3 }, ms: 3 * D, binance: "3d", yahoo: "1d", group: "days" },
  { key: "1W", period: { type: "week", span: 1 }, ms: 7 * D, binance: "1w", yahoo: "1wk", group: "days" },
  { key: "1M", period: { type: "month", span: 1 }, ms: 30 * D, binance: "1M", yahoo: "1mo", group: "days" },
];

export const INTERVAL_MAP = Object.fromEntries(INTERVALS.map((i) => [i.key, i])) as Record<
  string,
  IntervalDef
>;

export const DEFAULT_FAVORITE_INTERVALS: IntervalKey[] = ["15m", "1h", "4h", "1D", "1W"];

const KEY_RE = /^([1-9]\d{0,3})([smhDWM])$/;

export function isIntervalKey(value: unknown): value is IntervalKey {
  return typeof value === "string" && (value in INTERVAL_MAP || KEY_RE.test(value));
}

const custom = new Map<string, IntervalDef>();

// The largest standard interval of the same unit that divides `n` (so 7m comes from 1m, 90m from 30m).
function base(group: IntervalDef["group"], ms: number) {
  return INTERVALS.filter((i) => i.group === group && ms % i.ms === 0).sort((a, b) => b.ms - a.ms)[0];
}

// Definition for any key: a standard one, or a custom multiple built on a standard base.
export function getInterval(key: IntervalKey): IntervalDef {
  const known = INTERVAL_MAP[key] ?? custom.get(key);
  if (known) return known;
  const m = KEY_RE.exec(key);
  if (!m) return INTERVAL_MAP["1D"];
  const n = Number(m[1]);
  const unit = m[2];
  let def: IntervalDef;
  if (unit === "s") {
    def = {
      key,
      period: { type: "second", span: n },
      ms: n * S,
      binance: "1s",
      yahoo: null,
      group: "seconds",
    };
  } else if (unit === "m") {
    const b = base("minutes", n * M);
    const y = (["30m", "15m", "5m", "1m"] as const).find((k) => (n * M) % INTERVAL_MAP[k].ms === 0) ?? "1m";
    def = {
      key,
      period: { type: "minute", span: n },
      ms: n * M,
      binance: b.binance,
      yahoo: INTERVAL_MAP[y].yahoo,
      group: "minutes",
    };
  } else if (unit === "h") {
    const b = base("hours", n * H);
    def = {
      key,
      period: { type: "hour", span: n },
      ms: n * H,
      binance: b.binance,
      yahoo: "60m",
      group: "hours",
    };
  } else if (unit === "D") {
    def = { key, period: { type: "day", span: n }, ms: n * D, binance: "1d", yahoo: "1d", group: "days" };
  } else if (unit === "W") {
    def = {
      key,
      period: { type: "week", span: n },
      ms: n * 7 * D,
      binance: "1w",
      yahoo: "1wk",
      group: "days",
    };
  } else {
    def = {
      key,
      period: { type: "month", span: n },
      ms: n * 30 * D,
      binance: "1M",
      yahoo: "1mo",
      group: "days",
    };
  }
  def.resample = true;
  custom.set(key, def);
  return def;
}

// Sort keys by length, for favourites and menus.
export function sortIntervals(keys: IntervalKey[]): IntervalKey[] {
  return [...new Set(keys)].filter(isIntervalKey).sort((a, b) => getInterval(a).ms - getInterval(b).ms);
}

// Intervals a symbol's data source can serve.
export function supportsInterval(symbol: CoinSymbol | null, key: IntervalKey) {
  if (!symbol) return true;
  const group = getInterval(key).group;
  if (symbol.source === "index") return group === "days";
  if (symbol.source === "yahoo") return group !== "seconds";
  return true;
}

// Parses what people type on the chart ("5" → 5m, "4h", "1d", "w") into an interval.
export function parseInterval(text: string): IntervalKey | null {
  const value = text.trim();
  const match = /^(\d*)\s*([smhdwM]?)$/i.exec(value);
  if (!match) return null;
  const n = match[1] ? Number(match[1]) : 1;
  let unit = match[2];
  if (!unit) unit = "m";
  const key =
    unit === "s" || unit === "S"
      ? `${n}s`
      : unit === "m"
        ? n % 60 === 0 && n >= 60
          ? `${n / 60}h`
          : `${n}m`
        : unit === "M"
          ? `${n}M`
          : unit.toLowerCase() === "h"
            ? `${n}h`
            : unit.toLowerCase() === "d"
              ? `${n}D`
              : `${n}W`;
  return isIntervalKey(key) ? key : null;
}

// Bucket start for resampling, in UTC: weeks start on Monday, months on the 1st.
export function bucketStart(interval: IntervalDef, t: number) {
  const span = interval.period.span;
  if (interval.period.type === "month") {
    const d = new Date(t);
    const months = d.getUTCFullYear() * 12 + d.getUTCMonth();
    const start = Math.floor(months / span) * span;
    return Date.UTC(Math.floor(start / 12), start % 12, 1);
  }
  if (interval.period.type === "week") {
    const monday = 4 * D; // 1970-01-05 was a Monday
    const week = span * 7 * D;
    return Math.floor((t - monday) / week) * week + monday;
  }
  return Math.floor(t / interval.ms) * interval.ms;
}

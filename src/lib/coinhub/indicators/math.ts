import type { KLineData } from "klinecharts";

export type Series = Array<number | undefined>;

export function period(value: number) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

// Missing values reset the window, so chained indicators retain their warm-up periods.
export function sma(values: Series, length: number): Series {
  length = period(length);
  let sum = 0;
  let count = 0;
  return values.map((value, i) => {
    if (value === undefined) {
      sum = 0;
      count = 0;
      return undefined;
    }
    sum += value;
    count++;
    if (count > length) sum -= values[i - length]!;
    return count >= length ? sum / length : undefined;
  });
}

export function smooth(values: Series, length: number, wilder = false): Series {
  length = period(length);
  const seeds = sma(values, length);
  const alpha = wilder ? 1 / length : 2 / (length + 1);
  let previous: number | undefined;
  return values.map((value, i) => {
    if (value === undefined) previous = undefined;
    else previous = previous === undefined ? seeds[i] : previous + alpha * (value - previous);
    return previous;
  });
}

export function wma(values: Series, length: number): Series {
  length = period(length);
  return values.map((_, i) => {
    if (i < length - 1) return undefined;
    let sum = 0;
    for (let j = 0; j < length; j++) {
      const value = values[i - j];
      if (value === undefined) return undefined;
      sum += value * (length - j);
    }
    return sum / ((length * (length + 1)) / 2);
  });
}

export function extrema(values: Series, length: number, highest: boolean): Series {
  length = period(length);
  return values.map((_, i) => {
    if (i < length - 1) return undefined;
    let result = highest ? -Infinity : Infinity;
    for (let j = i - length + 1; j <= i; j++) {
      const value = values[j];
      if (value === undefined) return undefined;
      result = highest ? Math.max(result, value) : Math.min(result, value);
    }
    return result;
  });
}

// Population standard deviation, matching Bollinger Bands and Pine's default stdev.
export function stdev(values: Series, length: number): Series {
  length = period(length);
  const means = sma(values, length);
  return means.map((mean, i) => {
    if (mean === undefined) return undefined;
    let variance = 0;
    for (let j = i - length + 1; j <= i; j++) variance += (values[j]! - mean) ** 2;
    return Math.sqrt(variance / length);
  });
}

export function combine(a: Series, b: Series, fn: (a: number, b: number) => number): Series {
  return a.map((value, i) => (value === undefined || b[i] === undefined ? undefined : fn(value, b[i]!)));
}

export function rsi(values: Series, length: number): Series {
  const change = values.map((value, i) =>
    value === undefined || values[i - 1] === undefined ? undefined : value - values[i - 1]!,
  );
  const gains = smooth(
    change.map((value) => (value === undefined ? undefined : Math.max(value, 0))),
    length,
    true,
  );
  const losses = smooth(
    change.map((value) => (value === undefined ? undefined : Math.max(-value, 0))),
    length,
    true,
  );
  return combine(gains, losses, (gain, loss) =>
    loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss),
  );
}

export function trueRange(list: KLineData[]): number[] {
  return list.map((bar, i) =>
    Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - (list[i - 1]?.close ?? bar.close)),
      Math.abs(bar.low - (list[i - 1]?.close ?? bar.close)),
    ),
  );
}

export function midpoint(list: KLineData[], length: number): Series {
  return combine(
    extrema(
      list.map((bar) => bar.high),
      length,
      true,
    ),
    extrema(
      list.map((bar) => bar.low),
      length,
      false,
    ),
    (high, low) => (high + low) / 2,
  );
}

export function stochastic(values: Series, high: Series, low: Series, length: number): Series {
  const highs = extrema(high, length, true);
  const lows = extrema(low, length, false);
  return values.map((value, i) =>
    value === undefined || highs[i] === undefined || lows[i] === undefined
      ? undefined
      : highs[i] === lows[i]
        ? 0
        : (100 * (value - lows[i]!)) / (highs[i]! - lows[i]!),
  );
}

// Least-squares fitted value at the last sample (Pine linreg offset = 0).
export function linreg(values: Series, length: number): Series {
  length = period(length);
  const sumX = (length * (length - 1)) / 2;
  const sumXX = (length * (length - 1) * (2 * length - 1)) / 6;
  return values.map((value, i) => {
    if (i < length - 1) return undefined;
    if (length === 1) return value;
    let sumY = 0;
    let sumXY = 0;
    for (let x = 0; x < length; x++) {
      const y = values[i - length + 1 + x];
      if (y === undefined) return undefined;
      sumY += y;
      sumXY += x * y;
    }
    const slope = (length * sumXY - sumX * sumY) / (length * sumXX - sumX * sumX);
    return sumY / length + slope * (length - 1 - sumX / length);
  });
}

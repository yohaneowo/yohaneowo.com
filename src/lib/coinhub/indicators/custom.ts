import type { IndicatorDrawParams, IndicatorFigure, IndicatorTemplate, KLineData } from "klinecharts";
import type { IndicatorMeta } from "./index";
import {
  combine,
  extrema,
  linreg,
  midpoint,
  period,
  rsi,
  sma,
  smooth,
  stochastic,
  stdev,
  trueRange,
  wma,
  type Series,
} from "./math";

// CoinHub's own indicators (TradingView staples KLineChart doesn't ship). Each entry pairs the
// KLineChart template with its catalog entry; `calcParams` defaults match `meta.defaults`.

export interface CustomIndicator {
  meta: IndicatorMeta;
  template: IndicatorTemplate<Record<string, number | undefined>, number>;
}

const UP = "#089981";
const DOWN = "#f23645";

// Wilder's ATR.
export function atr(list: KLineData[], length: number) {
  length = period(length);
  const out: Array<number | undefined> = [];
  let prev: number | undefined;
  list.forEach((k, i) => {
    const prevClose = i > 0 ? list[i - 1].close : k.close;
    const tr = Math.max(k.high - k.low, Math.abs(k.high - prevClose), Math.abs(k.low - prevClose));
    if (i < length - 1) {
      prev = (prev ?? 0) + tr;
      out.push(undefined);
    } else if (i === length - 1) {
      prev = ((prev ?? 0) + tr) / length;
      out.push(prev);
    } else {
      prev = ((prev ?? tr) * (length - 1) + tr) / length;
      out.push(prev);
    }
  });
  return out;
}

const vwap: CustomIndicator = {
  meta: {
    name: "VWAP",
    title: "Volume Weighted Average Price",
    category: "volume",
    overlay: true,
    params: [],
    defaults: [],
  },
  template: {
    name: "VWAP",
    shortName: "VWAP",
    series: "price",
    precision: 2,
    calcParams: [],
    figures: [{ key: "vwap", title: "VWAP: ", type: "line" }],
    styles: { lines: [{ color: "#2962ff", size: 1 }] },
    // Resets every UTC day, like TradingView's session VWAP on crypto.
    calc: (list) => {
      let day = -1;
      let pv = 0;
      let vol = 0;
      return list.map((k) => {
        const d = Math.floor(k.timestamp / 86_400_000);
        if (d !== day) {
          day = d;
          pv = 0;
          vol = 0;
        }
        const tp = (k.high + k.low + k.close) / 3;
        pv += tp * (k.volume ?? 0);
        vol += k.volume ?? 0;
        return { vwap: vol ? pv / vol : tp };
      });
    },
  },
};

const supertrend: CustomIndicator = {
  meta: {
    name: "SUPERTREND",
    title: "Supertrend",
    category: "trend",
    overlay: true,
    params: ["ATR Length", "Factor"],
    defaults: [10, 3],
  },
  template: {
    name: "SUPERTREND",
    shortName: "Supertrend",
    series: "price",
    precision: 2,
    calcParams: [10, 3],
    figures: [
      { key: "up", title: "Up: ", type: "line", styles: () => ({ color: UP }) },
      { key: "down", title: "Down: ", type: "line", styles: () => ({ color: DOWN }) },
    ],
    calc: (list, indicator) => {
      const [length, factor] = indicator.calcParams;
      const a = atr(list, length);
      let upper = 0;
      let lower = 0;
      let trend = 1;
      return list.map((k, i) => {
        const value = a[i];
        if (value === undefined) return {};
        const hl2 = (k.high + k.low) / 2;
        const basicUpper = hl2 + factor * value;
        const basicLower = hl2 - factor * value;
        const prevClose = i > 0 ? list[i - 1].close : k.close;
        const first = a[i - 1] === undefined;
        upper = first || basicUpper < upper || prevClose > upper ? basicUpper : upper;
        lower = first || basicLower > lower || prevClose < lower ? basicLower : lower;
        if (trend === 1 && k.close < lower) trend = -1;
        else if (trend === -1 && k.close > upper) trend = 1;
        return trend === 1 ? { up: lower } : { down: upper };
      });
    },
  },
};

type Result = Record<string, number | undefined>;
type Template = CustomIndicator["template"];
type DrawParams = IndicatorDrawParams<Result, number, unknown>;
const BLUE = "#2962ff";
const ORANGE = "#ff6d00";
const PURPLE = "#7e57c2";

function line(key: string, color = BLUE, title = key): IndicatorFigure<Result> {
  return { key, title: `${title}: `, type: "line", styles: () => ({ color, size: 1 }) };
}

function rows(columns: Record<string, Series>): Result[] {
  const entries = Object.entries(columns);
  return Array.from({ length: entries[0]?.[1].length ?? 0 }, (_, i) =>
    Object.fromEntries(entries.map(([key, values]) => [key, values[i]])),
  );
}

function define(
  name: string,
  title: string,
  category: IndicatorMeta["category"],
  overlay: boolean,
  params: string[],
  defaults: number[],
  figures: IndicatorFigure<Result>[],
  calc: Template["calc"],
  extra: Partial<Template> = {},
): CustomIndicator {
  return {
    meta: { name, title, category, overlay, params, defaults },
    template: {
      name,
      shortName: name,
      series: overlay ? "price" : "normal",
      precision: 2,
      calcParams: [...defaults],
      figures,
      calc,
      ...extra,
    },
  };
}

function references(levels: number[], fill?: string, middle?: number): NonNullable<Template["draw"]> {
  return ({ ctx, bounding, yAxis }) => {
    ctx.save();
    if (fill && levels.length >= 2) {
      const a = yAxis.convertToPixel(levels[0]);
      const b = yAxis.convertToPixel(levels[1]);
      ctx.fillStyle = fill;
      ctx.fillRect(0, Math.min(a, b), bounding.width, Math.abs(b - a));
    }
    ctx.strokeStyle = "rgba(120,123,134,0.6)";
    ctx.lineWidth = 1;
    for (const level of middle === undefined ? levels : [...levels, middle]) {
      ctx.setLineDash(level === middle ? [1, 3] : [4, 4]);
      const y = yAxis.convertToPixel(level);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(bounding.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    return false;
  };
}

// Only visit visible segments. Split crossing segments to keep each side of the cloud's colour exact.
function bandFill(
  upper: string,
  lower: string,
  positive: string,
  negative = positive,
): NonNullable<Template["draw"]> {
  return ({ ctx, chart, indicator, xAxis, yAxis }) => {
    const { from, to } = chart.getVisibleRange();
    ctx.save();
    const polygon = (
      x0: number,
      x1: number,
      a0: number,
      a1: number,
      b0: number,
      b1: number,
      color: string,
    ) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x0, yAxis.convertToPixel(a0));
      ctx.lineTo(x1, yAxis.convertToPixel(a1));
      ctx.lineTo(x1, yAxis.convertToPixel(b1));
      ctx.lineTo(x0, yAxis.convertToPixel(b0));
      ctx.closePath();
      ctx.fill();
    };
    for (
      let i = Math.max(1, Math.floor(from));
      i < Math.min(indicator.result.length, Math.ceil(to) + 1);
      i++
    ) {
      const a0 = indicator.result[i - 1][upper],
        a1 = indicator.result[i][upper];
      const b0 = indicator.result[i - 1][lower],
        b1 = indicator.result[i][lower];
      if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
      const x0 = xAxis.convertToPixel(i - 1),
        x1 = xAxis.convertToPixel(i);
      const color = a0 >= b0 ? positive : negative;
      if ((a0 - b0) * (a1 - b1) < 0) {
        const fraction = (a0 - b0) / (a0 - b0 - a1 + b1);
        const x = x0 + fraction * (x1 - x0),
          y = a0 + fraction * (a1 - a0);
        polygon(x0, x, a0, y, b0, y, color);
        polygon(x, x1, y, a1, y, b1, a1 >= b1 ? positive : negative);
      } else polygon(x0, x1, a0, a1, b0, b1, color);
    }
    ctx.restore();
    return false;
  };
}

function histogram(key: string, colors: [string, string, string, string]): IndicatorFigure<Result> {
  return {
    key,
    title: `${key}: `,
    type: "bar",
    baseValue: 0,
    styles: ({ data }) => {
      const value = data.current?.[key] ?? 0,
        previous = data.prev?.[key] ?? 0;
      const color =
        value >= 0 ? (value > previous ? colors[0] : colors[1]) : value > previous ? colors[2] : colors[3];
      return { color, borderColor: color, style: "fill" };
    },
  };
}

const relativeStrength = define(
  "RSI",
  "Relative Strength Index",
  "oscillator",
  false,
  ["Length", "MA Length"],
  [14, 14],
  [line("rsi", PURPLE, "RSI"), line("ma", "#f7c35a", "RSI MA")],
  (list, { calcParams: [length, maLength] }) => {
    const values = rsi(
      list.map((bar) => bar.close),
      length,
    );
    return rows({ rsi: values, ma: sma(values, maLength) });
  },
  { minValue: 0, maxValue: 100, draw: references([70, 30], "rgba(126,87,194,0.1)", 50) },
);

const macd = define(
  "MACD",
  "MACD",
  "oscillator",
  false,
  ["Fast", "Slow", "Signal"],
  [12, 26, 9],
  [
    histogram("hist", ["#26a69a", "#b2dfdb", "#ffcdd2", "#ff5252"]),
    line("macd", BLUE, "MACD"),
    line("signal", ORANGE, "Signal"),
  ],
  (list, { calcParams: [fast, slow, length] }) => {
    const close = list.map((bar) => bar.close);
    const values = combine(smooth(close, fast), smooth(close, slow), (a, b) => a - b);
    const signal = smooth(values, length);
    return rows({ macd: values, signal, hist: combine(values, signal, (a, b) => a - b) });
  },
  { draw: references([0]) },
);

const stochRsi = define(
  "STOCHRSI",
  "Stochastic RSI",
  "oscillator",
  false,
  ["K", "D", "RSI Length", "Stochastic Length"],
  [3, 3, 14, 14],
  [line("k", BLUE, "%K"), line("d", ORANGE, "%D")],
  (list, { calcParams: [kLength, dLength, rsiLength, length] }) => {
    const values = rsi(
      list.map((bar) => bar.close),
      rsiLength,
    );
    const k = sma(stochastic(values, values, values, length), kLength);
    return rows({ k, d: sma(k, dLength) });
  },
  { minValue: 0, maxValue: 100, draw: references([80, 20], "rgba(41,98,255,0.08)") },
);

const stoch = define(
  "STOCH",
  "Stochastic",
  "oscillator",
  false,
  ["%K Length", "%K Smoothing", "%D Smoothing"],
  [14, 1, 3],
  [line("k", BLUE, "%K"), line("d", ORANGE, "%D")],
  (list, { calcParams: [length, kLength, dLength] }) => {
    const k = sma(
      stochastic(
        list.map((bar) => bar.close),
        list.map((bar) => bar.high),
        list.map((bar) => bar.low),
        length,
      ),
      kLength,
    );
    return rows({ k, d: sma(k, dLength) });
  },
  { minValue: 0, maxValue: 100, draw: references([80, 20], "rgba(41,98,255,0.08)") },
);

const averageTrueRange = define(
  "ATR",
  "Average True Range",
  "volatility",
  false,
  ["Length"],
  [14],
  [line("atr", "#b71c1c", "ATR")],
  (list, { calcParams: [length] }) => rows({ atr: atr(list, length) }),
);

const ichimoku = define(
  "ICHIMOKU",
  "Ichimoku Cloud",
  "trend",
  true,
  ["Conversion", "Base", "Lagging Span", "Displacement"],
  [9, 26, 52, 26],
  [
    line("conversion", BLUE),
    line("base", "#b71c1c"),
    line("spanA", "#43a047"),
    line("spanB", "#f23645"),
    line("lagging", "#43a047"),
  ],
  (list, { calcParams: [conversionLength, baseLength, spanLength, displacement] }) => {
    const conversion = midpoint(list, conversionLength),
      base = midpoint(list, baseLength),
      spanB = midpoint(list, spanLength);
    const spanA = combine(conversion, base, (a, b) => (a + b) / 2);
    const offset = period(displacement) - 1;
    return rows({
      conversion,
      base,
      spanA: list.map((_, i) => spanA[i - offset]),
      spanB: list.map((_, i) => spanB[i - offset]),
      lagging: list.map((_, i) => list[i + offset]?.close),
    });
  },
  { draw: bandFill("spanA", "spanB", "rgba(67,160,71,0.15)", "rgba(244,67,54,0.15)") },
);

const channelFigures = [line("upper"), line("basis", ORANGE), line("lower")];
const channelDraw = bandFill("upper", "lower", "rgba(41,98,255,0.08)");
const donchian = define(
  "DONCHIAN",
  "Donchian Channels",
  "volatility",
  true,
  ["Length"],
  [20],
  channelFigures,
  (list, { calcParams: [length] }) => {
    const upper = extrema(
        list.map((bar) => bar.high),
        length,
        true,
      ),
      lower = extrema(
        list.map((bar) => bar.low),
        length,
        false,
      );
    return rows({ upper, lower, basis: combine(upper, lower, (a, b) => (a + b) / 2) });
  },
  { draw: channelDraw },
);

const keltner = define(
  "KC",
  "Keltner Channels",
  "volatility",
  true,
  ["Length", "Multiplier", "ATR Length"],
  [20, 2, 10],
  channelFigures,
  (list, { calcParams: [length, multiplier, atrLength] }) => {
    const basis = smooth(
        list.map((bar) => bar.close),
        length,
      ),
      range = atr(list, atrLength);
    return rows({
      basis,
      upper: combine(basis, range, (a, b) => a + multiplier * b),
      lower: combine(basis, range, (a, b) => a - multiplier * b),
    });
  },
  { draw: channelDraw },
);

const weighted = define(
  "WMA",
  "Moving Average Weighted",
  "trend",
  true,
  ["Length"],
  [9],
  [line("wma")],
  (list, { calcParams: [length] }) =>
    rows({
      wma: wma(
        list.map((bar) => bar.close),
        length,
      ),
    }),
);
const hull = define(
  "HMA",
  "Hull Moving Average",
  "trend",
  true,
  ["Length"],
  [9],
  [line("hma")],
  (list, { calcParams: [length] }) => {
    length = period(length);
    const close = list.map((bar) => bar.close);
    return rows({
      hma: wma(
        combine(wma(close, Math.floor(length / 2)), wma(close, length), (a, b) => 2 * a - b),
        Math.round(Math.sqrt(length)),
      ),
    });
  },
);
const volumeWeighted = define(
  "VWMA",
  "Volume Weighted Moving Average",
  "trend",
  true,
  ["Length"],
  [20],
  [line("vwma")],
  (list, { calcParams: [length] }) => {
    const volume = sma(
        list.map((bar) => bar.volume ?? 0),
        length,
      ),
      pv = sma(
        list.map((bar) => bar.close * (bar.volume ?? 0)),
        length,
      );
    return rows({
      vwma: pv.map((value, i) => (value === undefined || !volume[i] ? undefined : value / volume[i]!)),
    });
  },
);

function multipleEma(triple: boolean) {
  const key = triple ? "tema" : "dema";
  return define(
    triple ? "TEMA" : "DEMA",
    triple ? "Triple EMA" : "Double EMA",
    "trend",
    true,
    ["Length"],
    [9],
    [line(key)],
    (list, { calcParams: [length] }) => {
      const first = smooth(
          list.map((bar) => bar.close),
          length,
        ),
        second = smooth(first, length);
      const values = triple
        ? combine(
            combine(first, second, (a, b) => 3 * (a - b)),
            smooth(second, length),
            (a, b) => a + b,
          )
        : combine(first, second, (a, b) => 2 * a - b);
      return rows({ [key]: values });
    },
  );
}

const envelope = define(
  "ENV",
  "Envelope",
  "trend",
  true,
  ["Length", "Percent (%)"],
  [20, 10],
  channelFigures,
  (list, { calcParams: [length, percent] }) => {
    const basis = sma(
      list.map((bar) => bar.close),
      length,
    );
    return rows({
      basis,
      upper: basis.map((value) => (value === undefined ? undefined : value * (1 + percent / 100))),
      lower: basis.map((value) => (value === undefined ? undefined : value * (1 - percent / 100))),
    });
  },
  { draw: channelDraw },
);

const moneyFlow = define(
  "MFI",
  "Money Flow Index",
  "volume",
  false,
  ["Length"],
  [14],
  [line("mfi", PURPLE)],
  (list, { calcParams: [length] }) => {
    const typical = list.map((bar) => (bar.high + bar.low + bar.close) / 3);
    const flow = (positive: boolean) =>
      sma(
        list.map((bar, i) =>
          i === 0
            ? undefined
            : (positive ? typical[i] > typical[i - 1] : typical[i] < typical[i - 1])
              ? typical[i] * (bar.volume ?? 0)
              : 0,
        ),
        length,
      );
    return rows({
      mfi: combine(flow(true), flow(false), (up, down) =>
        down === 0 ? (up === 0 ? 50 : 100) : 100 - 100 / (1 + up / down),
      ),
    });
  },
  { minValue: 0, maxValue: 100, draw: references([80, 20], "rgba(126,87,194,0.08)") },
);

const chaikin = define(
  "CMF",
  "Chaikin Money Flow",
  "volume",
  false,
  ["Length"],
  [20],
  [line("cmf", "#43a047")],
  (list, { calcParams: [length] }) => {
    const flow = sma(
      list.map((bar) =>
        bar.high === bar.low
          ? 0
          : ((2 * bar.close - bar.high - bar.low) / (bar.high - bar.low)) * (bar.volume ?? 0),
      ),
      length,
    );
    return rows({
      cmf: combine(
        flow,
        sma(
          list.map((bar) => bar.volume ?? 0),
          length,
        ),
        (a, b) => (b === 0 ? 0 : a / b),
      ),
    });
  },
  { draw: references([0]) },
);

const aroon = define(
  "AROON",
  "Aroon",
  "trend",
  false,
  ["Length"],
  [14],
  [line("up", ORANGE), line("down", BLUE)],
  (list, { calcParams: [length] }) => {
    length = period(length);
    return list.map((_, i) => {
      if (i < length) return {};
      let high = i,
        low = i;
      // Aroon includes today's bar plus Length preceding bars; ties use the latest extreme.
      for (let j = i - 1; j >= i - length; j--) {
        if (list[j].high > list[high].high) high = j;
        if (list[j].low < list[low].low) low = j;
      }
      return { up: (100 * (length - i + high)) / length, down: (100 * (length - i + low)) / length };
    });
  },
  { minValue: 0, maxValue: 100 },
);

const adx = define(
  "ADX",
  "Average Directional Index",
  "trend",
  false,
  ["ADX Smoothing", "DI Length"],
  [14, 14],
  [line("adx", "#ff5252")],
  (list, { calcParams: [smoothing, length] }) => {
    const dm = (positive: boolean) =>
      smooth(
        list.map((bar, i) => {
          if (!i) return undefined;
          const up = bar.high - list[i - 1].high,
            down = list[i - 1].low - bar.low;
          return positive ? (up > down && up > 0 ? up : 0) : down > up && down > 0 ? down : 0;
        }),
        length,
        true,
      );
    // The common smoothed TR divisor cancels when forming DX from +DI and -DI.
    const dx = combine(dm(true), dm(false), (up, down) =>
      up + down === 0 ? 0 : (100 * Math.abs(up - down)) / (up + down),
    );
    return rows({ adx: smooth(dx, smoothing, true) });
  },
);

function bollingerOscillator(percentB: boolean) {
  const key = percentB ? "bbp" : "bbw";
  return define(
    percentB ? "BBP" : "BBW",
    percentB ? "Bollinger Bands %B" : "Bollinger BandWidth",
    "volatility",
    false,
    ["Length", "StdDev"],
    [20, 2],
    [line(key)],
    (list, { calcParams: [length, multiplier] }) => {
      const close = list.map((bar) => bar.close),
        basis = sma(close, length),
        deviation = stdev(close, length);
      return rows({
        [key]: basis.map((mean, i) => {
          if (mean === undefined || deviation[i] === undefined) return undefined;
          const width = 2 * multiplier * deviation[i]!;
          return percentB
            ? width === 0
              ? 0.5
              : (close[i] - mean + width / 2) / width
            : mean === 0
              ? undefined
              : (width / mean) * 100;
        }),
      });
    },
    percentB ? { draw: references([1, 0], "rgba(41,98,255,0.08)") } : {},
  );
}

const ultimate = define(
  "UO",
  "Ultimate Oscillator",
  "oscillator",
  false,
  ["Fast", "Middle", "Slow"],
  [7, 14, 28],
  [line("uo")],
  (list, { calcParams: [fast, middle, slow] }) => {
    const bp = list.map((bar, i) => (i === 0 ? undefined : bar.close - Math.min(bar.low, list[i - 1].close)));
    const tr = trueRange(list).map((value, i) => (i === 0 ? undefined : value));
    const ratio = (length: number) =>
      combine(sma(bp, length), sma(tr, length), (a, b) => (b === 0 ? 0 : a / b));
    return rows({
      uo: combine(
        combine(ratio(fast), ratio(middle), (a, b) => 4 * a + 2 * b),
        ratio(slow),
        (a, b) => (100 * (a + b)) / 7,
      ),
    });
  },
  { minValue: 0, maxValue: 100 },
);

const choppiness = define(
  "CHOP",
  "Choppiness Index",
  "volatility",
  false,
  ["Length"],
  [14],
  [line("chop")],
  (list, { calcParams: [length] }) => {
    length = period(length);
    const range = combine(
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
      (a, b) => a - b,
    );
    const meanTr = sma(trueRange(list), length);
    return rows({
      chop: range.map((value, i) =>
        value === undefined || meanTr[i] === undefined || value <= 0 || length === 1
          ? undefined
          : (100 * Math.log10((meanTr[i]! * length) / value)) / Math.log10(length),
      ),
    });
  },
  { draw: references([61.8, 38.2]) },
);

const squeeze = define(
  "SQZMOM",
  "Squeeze Momentum (LazyBear)",
  "volatility",
  false,
  ["BB Length", "BB Mult", "KC Length", "KC Mult"],
  [20, 2, 20, 1.5],
  [histogram("hist", ["#00ff00", "#008000", "#800000", "#ff0000"])],
  (list, { calcParams: [bbLength, bbMult, kcLength, kcMult] }) => {
    const close = list.map((bar) => bar.close),
      bbBasis = sma(close, bbLength),
      deviation = stdev(close, bbLength);
    const kcBasis = sma(close, kcLength),
      range = sma(trueRange(list), kcLength);
    const center = combine(midpoint(list, kcLength), kcBasis, (a, b) => (a + b) / 2);
    return rows({
      hist: linreg(
        combine(close, center, (a, b) => a - b),
        kcLength,
      ),
      squeeze: list.map((_, i) => {
        const bb = bbBasis[i],
          sd = deviation[i],
          kc = kcBasis[i],
          tr = range[i];
        if (bb === undefined || sd === undefined || kc === undefined || tr === undefined) return undefined;
        const lowerBB = bb - bbMult * sd,
          upperBB = bb + bbMult * sd,
          lowerKC = kc - kcMult * tr,
          upperKC = kc + kcMult * tr;
        return lowerBB > lowerKC && upperBB < upperKC ? 1 : lowerBB < lowerKC && upperBB > upperKC ? -1 : 0;
      }),
    });
  },
  {
    draw: (params) => {
      references([0])(params);
      const { ctx, chart, indicator, xAxis, yAxis } = params,
        { from, to } = chart.getVisibleRange();
      ctx.save();
      for (let i = Math.max(0, Math.floor(from)); i < Math.min(indicator.result.length, Math.ceil(to)); i++) {
        const state = indicator.result[i].squeeze;
        if (state === undefined) continue;
        ctx.fillStyle = state === 1 ? "#000000" : state === -1 ? "#808080" : "#0000ff";
        ctx.beginPath();
        ctx.arc(xAxis.convertToPixel(i), yAxis.convertToPixel(0), 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return false;
    },
  },
);

const pivotColors: Record<string, string> = {
  p: "#ff9800",
  r1: "#f23645",
  r2: "#f23645",
  r3: "#f23645",
  s1: "#089981",
  s2: "#089981",
  s3: "#089981",
};
const pivot = define(
  "PIVOT",
  "Pivot Points Standard",
  "trend",
  true,
  [],
  [],
  // No figures: levels are drawn as steps below and, like TradingView, don't stretch the price scale.
  [],
  (list) => {
    const day = 86_400_000;
    const weekly = list.length > 1 && list[1].timestamp - list[0].timestamp >= day;
    // Unix epoch was Thursday; adding three days aligns UTC weeks to Monday.
    const bucket = (timestamp: number) =>
      weekly ? Math.floor((timestamp + 3 * day) / (7 * day)) : Math.floor(timestamp / day);
    let current: number | undefined,
      high = -Infinity,
      low = Infinity,
      close = 0;
    let levels: Result = {};
    return list.map((bar) => {
      const next = bucket(bar.timestamp);
      if (next !== current) {
        if (current !== undefined) {
          const p = (high + low + close) / 3,
            range = high - low;
          levels = {
            p,
            r1: 2 * p - low,
            s1: 2 * p - high,
            r2: p + range,
            s2: p - range,
            r3: high + 2 * (p - low),
            s3: low - 2 * (high - p),
          };
        }
        current = next;
        high = bar.high;
        low = bar.low;
      } else {
        high = Math.max(high, bar.high);
        low = Math.min(low, bar.low);
      }
      close = bar.close;
      return { ...levels };
    });
  },
  { draw: drawPivot },
);

function drawPivot({ ctx, chart, indicator, xAxis, yAxis }: DrawParams) {
  const { from, to } = chart.getVisibleRange();
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (const [key, color] of Object.entries(pivotColors)) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (
      let i = Math.max(0, Math.floor(from) - 1);
      i < Math.min(indicator.result.length, Math.ceil(to) + 1);
      i++
    ) {
      const value = indicator.result[i][key];
      if (value === undefined) continue;
      const x = xAxis.convertToPixel(i),
        y = yAxis.convertToPixel(value),
        previous = indicator.result[i - 1]?.[key];
      if (previous === undefined || i === Math.max(0, Math.floor(from) - 1)) ctx.moveTo(x, y);
      else {
        ctx.lineTo(x, yAxis.convertToPixel(previous));
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    const last = indicator.result[Math.min(indicator.result.length, Math.ceil(to)) - 1]?.[key];
    if (last !== undefined) {
      ctx.fillStyle = color;
      ctx.font = "11px sans-serif";
      ctx.fillText(
        key.toUpperCase(),
        xAxis.convertToPixel(Math.min(indicator.result.length, Math.ceil(to)) - 1) + 4,
        yAxis.convertToPixel(last) + 4,
      );
    }
  }
  ctx.restore();
  return true;
}

const piCycle = define(
  "PICYCLE",
  "Pi Cycle Top",
  "crypto",
  true,
  ["Fast", "Slow", "Multiplier"],
  [111, 350, 2],
  [line("fast", ORANGE), line("slow", "#43a047")],
  (list, { calcParams: [fast, slow, multiplier] }) => {
    const close = list.map((bar) => bar.close);
    return rows({
      fast: sma(close, fast),
      slow: sma(close, slow).map((value) => (value === undefined ? undefined : value * multiplier)),
    });
  },
);
const mayer = define(
  "MAYER",
  "Mayer Multiple",
  "crypto",
  false,
  ["Length"],
  [200],
  [line("mayer")],
  (list, { calcParams: [length] }) => {
    const close = list.map((bar) => bar.close),
      basis = sma(close, length);
    return rows({
      mayer: close.map((value, i) =>
        basis[i] === undefined || basis[i] === 0 ? undefined : value / basis[i]!,
      ),
    });
  },
  { draw: references([1, 2.4]) },
);
const zscore = define(
  "ZSCORE",
  "Z-Score",
  "oscillator",
  false,
  ["Length"],
  [20],
  [line("zscore")],
  (list, { calcParams: [length] }) => {
    const close = list.map((bar) => bar.close),
      basis = sma(close, length),
      deviation = stdev(close, length);
    return rows({
      zscore: basis.map((mean, i) =>
        mean === undefined || deviation[i] === undefined
          ? undefined
          : deviation[i] === 0
            ? 0
            : (close[i] - mean) / deviation[i]!,
      ),
    });
  },
  { draw: references([2, -2]) },
);
const volatility = define(
  "HV",
  "Historical Volatility",
  "volatility",
  false,
  ["Length"],
  [10],
  [line("hv")],
  (list, { calcParams: [length] }) => {
    const returns = list.map((bar, i) =>
      !i || bar.close <= 0 || list[i - 1].close <= 0 ? undefined : Math.log(bar.close / list[i - 1].close),
    );
    return rows({
      hv: stdev(returns, length).map((value) =>
        value === undefined ? undefined : value * Math.sqrt(365) * 100,
      ),
    });
  },
);

// Volume profile of the bars on screen, drawn from the right edge (TradingView's VPVR). Recomputed
// every frame from the visible range, so it follows scrolling and zooming.
const visibleProfile = define(
  "VPVR",
  "Volume Profile Visible Range",
  "volume",
  true,
  ["Rows", "Value Area %", "Width %"],
  [24, 70, 30],
  [],
  (list) => list.map(() => ({})),
  {
    draw: ({ ctx, chart, indicator, bounding, yAxis }) => {
      const list = chart.getDataList();
      const { from, to } = chart.getVisibleRange();
      const [rows, valueArea, widthPct] = indicator.calcParams;
      const n = Math.max(4, Math.round(rows));
      let low = Infinity;
      let high = -Infinity;
      for (let i = from; i < Math.min(to, list.length); i++) {
        low = Math.min(low, list[i].low);
        high = Math.max(high, list[i].high);
      }
      if (!Number.isFinite(low) || high <= low) return true;
      const step = (high - low) / n;
      const up = new Array<number>(n).fill(0);
      const down = new Array<number>(n).fill(0);
      for (let i = from; i < Math.min(to, list.length); i++) {
        const k = list[i];
        const r0 = Math.min(n - 1, Math.floor((k.low - low) / step));
        const r1 = Math.min(n - 1, Math.floor((k.high - low) / step));
        const share = (k.volume ?? 0) / (r1 - r0 + 1);
        for (let r = r0; r <= r1; r++) (k.close >= k.open ? up : down)[r] += share;
      }
      const totals = up.map((u, i) => u + down[i]);
      const max = Math.max(...totals);
      if (!max) return true;
      const poc = totals.indexOf(max);
      const all = totals.reduce((a, b) => a + b, 0);
      let lo = poc;
      let hi = poc;
      let inside = totals[poc];
      while (inside < (all * valueArea) / 100 && (lo > 0 || hi < n - 1)) {
        const below = lo > 0 ? totals[lo - 1] : -1;
        const above = hi < n - 1 ? totals[hi + 1] : -1;
        if (above >= below) inside += totals[++hi];
        else inside += totals[--lo];
      }
      const width = (bounding.width * widthPct) / 100;
      ctx.save();
      for (let r = 0; r < n; r++) {
        const top = yAxis.convertToPixel(low + step * (r + 1));
        const bottom = yAxis.convertToPixel(low + step * r);
        const h = Math.max(1, Math.abs(bottom - top) - 1);
        const y = Math.min(top, bottom);
        const wUp = (up[r] / max) * width;
        const wDown = (down[r] / max) * width;
        const alpha = r >= lo && r <= hi ? 0.45 : 0.2;
        ctx.fillStyle = `rgba(8,153,129,${alpha})`;
        ctx.fillRect(bounding.width - wUp - wDown, y, wUp, h);
        ctx.fillStyle = `rgba(242,54,69,${alpha})`;
        ctx.fillRect(bounding.width - wDown, y, wDown, h);
      }
      const pocY = yAxis.convertToPixel(low + step * (poc + 0.5));
      ctx.strokeStyle = "#ff9800";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, pocY);
      ctx.lineTo(bounding.width, pocY);
      ctx.stroke();
      ctx.restore();
      return true;
    },
  },
);

export const CUSTOM_INDICATORS: CustomIndicator[] = [
  visibleProfile,
  vwap,
  supertrend,
  relativeStrength,
  macd,
  stochRsi,
  stoch,
  averageTrueRange,
  ichimoku,
  donchian,
  keltner,
  weighted,
  hull,
  volumeWeighted,
  multipleEma(false),
  multipleEma(true),
  envelope,
  moneyFlow,
  chaikin,
  aroon,
  adx,
  bollingerOscillator(false),
  bollingerOscillator(true),
  ultimate,
  choppiness,
  squeeze,
  pivot,
  piCycle,
  mayer,
  zscore,
  volatility,
];

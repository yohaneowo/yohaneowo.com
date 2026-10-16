import { registerIndicator, type IndicatorTemplate, type KLineData } from "klinecharts";
import { CUSTOM_INDICATORS } from "./custom";

// Indicator catalog for the "Indicators" dialog: KLineChart's built-ins plus CoinHub's own
// (registered from ./custom). `params` labels the calcParams in the settings dialog, `defaults`
// are TradingView's default inputs, used when the indicator is added.

export type IndicatorCategory = "trend" | "oscillator" | "volatility" | "volume" | "crypto";

export interface IndicatorMeta {
  name: string;
  title: string;
  category: IndicatorCategory;
  // On the price pane (true) or in its own pane below.
  overlay: boolean;
  params: string[];
  defaults: number[];
}

export const INDICATORS: IndicatorMeta[] = [
  // Built-in (KLineChart)
  {
    name: "MA",
    title: "Moving Average",
    category: "trend",
    overlay: true,
    params: ["Length"],
    defaults: [9],
  },
  {
    name: "EMA",
    title: "Moving Average Exponential",
    category: "trend",
    overlay: true,
    params: ["Length"],
    defaults: [9],
  },
  {
    name: "SMA",
    title: "Smoothed Moving Average",
    category: "trend",
    overlay: true,
    params: ["Length", "Weight"],
    defaults: [12, 2],
  },
  {
    name: "BOLL",
    title: "Bollinger Bands",
    category: "volatility",
    overlay: true,
    params: ["Length", "StdDev"],
    defaults: [20, 2],
  },
  {
    name: "SAR",
    title: "Parabolic SAR",
    category: "trend",
    overlay: true,
    params: ["Start", "Increment", "Maximum"],
    defaults: [2, 2, 20],
  },
  {
    name: "BBI",
    title: "Bull and Bear Index",
    category: "trend",
    overlay: true,
    params: ["MA1", "MA2", "MA3", "MA4"],
    defaults: [3, 6, 12, 24],
  },
  { name: "AVP", title: "Average Price", category: "trend", overlay: true, params: [], defaults: [] },
  {
    name: "VOL",
    title: "Volume",
    category: "volume",
    overlay: false,
    params: ["MA1", "MA2", "MA3"],
    defaults: [20],
  },
  {
    name: "MACD",
    title: "MACD",
    category: "oscillator",
    overlay: false,
    params: ["Fast", "Slow", "Signal"],
    defaults: [12, 26, 9],
  },
  {
    name: "RSI",
    title: "Relative Strength Index",
    category: "oscillator",
    overlay: false,
    params: ["Length"],
    defaults: [14],
  },
  {
    name: "KDJ",
    title: "KDJ",
    category: "oscillator",
    overlay: false,
    params: ["Length", "K", "D"],
    defaults: [9, 3, 3],
  },
  {
    name: "CCI",
    title: "Commodity Channel Index",
    category: "oscillator",
    overlay: false,
    params: ["Length"],
    defaults: [20],
  },
  {
    name: "DMI",
    title: "Directional Movement Index (ADX)",
    category: "trend",
    overlay: false,
    params: ["DI Length", "ADX Smoothing"],
    defaults: [14, 14],
  },
  {
    name: "WR",
    title: "Williams %R",
    category: "oscillator",
    overlay: false,
    params: ["Length"],
    defaults: [14],
  },
  {
    name: "OBV",
    title: "On Balance Volume",
    category: "volume",
    overlay: false,
    params: ["MA"],
    defaults: [30],
  },
  { name: "PVT", title: "Price Volume Trend", category: "volume", overlay: false, params: [], defaults: [] },
  {
    name: "MTM",
    title: "Momentum",
    category: "oscillator",
    overlay: false,
    params: ["Length", "MA"],
    defaults: [10, 6],
  },
  {
    name: "ROC",
    title: "Rate of Change",
    category: "oscillator",
    overlay: false,
    params: ["Length", "MA"],
    defaults: [9, 6],
  },
  {
    name: "TRIX",
    title: "TRIX",
    category: "oscillator",
    overlay: false,
    params: ["Length", "Signal"],
    defaults: [18, 9],
  },
  {
    name: "AO",
    title: "Awesome Oscillator",
    category: "oscillator",
    overlay: false,
    params: ["Fast", "Slow"],
    defaults: [5, 34],
  },
  {
    name: "BIAS",
    title: "Bias",
    category: "oscillator",
    overlay: false,
    params: ["L1", "L2", "L3"],
    defaults: [6, 12, 24],
  },
  {
    name: "PSY",
    title: "Psychological Line",
    category: "oscillator",
    overlay: false,
    params: ["Length", "MA"],
    defaults: [12, 6],
  },
  {
    name: "EMV",
    title: "Ease of Movement",
    category: "volume",
    overlay: false,
    params: ["Length", "MA"],
    defaults: [14, 9],
  },
  {
    name: "VR",
    title: "Volume Ratio",
    category: "volume",
    overlay: false,
    params: ["Length", "MA"],
    defaults: [26, 6],
  },
  { name: "BRAR", title: "BRAR", category: "oscillator", overlay: false, params: ["Length"], defaults: [26] },
  {
    name: "CR",
    title: "Energy Index (CR)",
    category: "oscillator",
    overlay: false,
    params: ["Length", "MA1", "MA2", "MA3", "MA4"],
    defaults: [26, 10, 20, 40, 60],
  },
  {
    name: "DMA",
    title: "Different of Moving Average",
    category: "trend",
    overlay: false,
    params: ["Short", "Long", "MA"],
    defaults: [10, 50, 10],
  },
  // CoinHub
  ...CUSTOM_INDICATORS.map((c) => c.meta),
];

export const INDICATOR_MAP = Object.fromEntries(INDICATORS.map((m) => [m.name, m])) as Record<
  string,
  IndicatorMeta
>;

let registered = false;

export function registerIndicators() {
  if (registered) return;
  registered = true;
  CUSTOM_INDICATORS.forEach((c) => registerIndicator(c.template as IndicatorTemplate));
}

export type { KLineData };

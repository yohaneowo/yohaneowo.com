"use client";

import { useSyncExternalStore } from "react";
import { INDICATOR_MAP } from "./indicators";
import { DEFAULT_FAVORITE_INTERVALS, isIntervalKey, type IntervalKey } from "./intervals";

// CoinHub terminal state: layout, each chart's symbol / interval / indicators, watchlist, alerts,
// settings. Persisted to localStorage (per browser, like an unsaved TradingView layout).

export type ChartType =
  | "candles"
  | "hollow"
  | "bars"
  | "line"
  | "area"
  | "baseline"
  | "heikinAshi"
  | "columns"
  | "highLow"
  | "stepLine"
  | "lineMarkers";

export type ScaleMode = "normal" | "logarithm" | "percentage";

export interface IndicatorConfig {
  id: string;
  name: string;
  calcParams: number[];
  // "main" = price pane; otherwise the id of its own pane.
  pane: string;
  visible: boolean;
  colors?: string[];
  widths?: number[];
}

export interface ChartConfig {
  symbolId: string;
  interval: IntervalKey;
  chartType: ChartType;
  indicators: IndicatorConfig[];
  scale: ScaleMode;
  invert: boolean;
  compare: string[];
  // Compared symbols hidden from the chart but kept in the legend (eye off).
  compareHidden?: string[];
}

export type LayoutKey = "1" | "2h" | "2v" | "3" | "4";

export const LAYOUT_COUNT: Record<LayoutKey, number> = { "1": 1, "2h": 2, "2v": 2, "3": 3, "4": 4 };

export type MagnetMode = "normal" | "weak_magnet" | "strong_magnet";
export type CursorMode = "cross" | "dot" | "arrow" | "eraser";
export type SidePanel =
  "watchlist" | "hotlists" | "alerts" | "objects" | "data" | "trading" | "account" | "info" | null;

export interface ChartSettings {
  upColor: string;
  downColor: string;
  bodyUp: boolean;
  bodyDown: boolean;
  borders: boolean;
  wicks: boolean;
  grid: "both" | "vertical" | "horizontal" | "none";
  showHighLow: boolean;
  // Wheel over the price axis scales it like TradingView (up = zoom in); off: KLineChart's default.
  axisWheelTradingView: boolean;
  // Lines at what the account holds on this symbol: the cost of a spot / stock holding, a futures
  // position's break-even and liquidation prices.
  showHoldingLines: boolean;
  showLastPrice: boolean;
  countdown: boolean;
  showLegendValues: boolean;
  showIndicatorValues: boolean;
  watermark: boolean;
  rightOffset: number;
  crosshairStyle: "dashed" | "solid" | "dotted";
  priceLineColor: "auto" | string;
  timezone: string;
}

export type AlertCondition = "crossing" | "crossingUp" | "crossingDown" | "greater" | "less";

export interface PriceAlert {
  id: string;
  symbolId: string;
  display: string;
  condition: AlertCondition;
  price: number;
  // Trend-line alert: the threshold follows the line [t1, v1, t2, v2] over time.
  line?: [number, number, number, number];
  message: string;
  // once: deactivate after firing; every: fire on each cross (at most once a minute).
  trigger: "once" | "every";
  active: boolean;
  createdAt: number;
  firedAt?: number;
}

export interface AlertLog {
  id: string;
  alertId: string;
  display: string;
  message: string;
  price: number;
  at: number;
}

export interface PaperOrder {
  id: string;
  symbolId: string;
  display: string;
  side: "buy" | "sell";
  type: "limit" | "stop";
  price: number;
  qty: number;
  createdAt: number;
}

export interface PaperPosition {
  symbolId: string;
  display: string;
  qty: number; // negative = short
  avgPrice: number;
  takeProfit?: number;
  stopLoss?: number;
}

export interface PaperFill {
  id: string;
  symbolId: string;
  display: string;
  side: "buy" | "sell";
  price: number;
  qty: number;
  pnl: number;
  at: number;
}

export interface PaperAccount {
  balance: number;
  initial: number;
  positions: PaperPosition[];
  orders: PaperOrder[];
  fills: PaperFill[];
}

export interface TerminalState {
  layout: LayoutKey;
  charts: ChartConfig[];
  active: number;
  sync: { symbol: boolean; interval: boolean; crosshair: boolean; time: boolean };
  watchlist: string[];
  favorites: { intervals: IntervalKey[]; tools: string[]; indicators: string[]; chartTypes: ChartType[] };
  recentSymbols: string[];
  settings: ChartSettings;
  panel: SidePanel;
  tool: string | null;
  cursor: CursorMode;
  magnet: MagnetMode;
  stayInDrawing: boolean;
  drawingsLocked: boolean;
  drawingsHidden: boolean;
  indicatorsHidden: boolean;
  lastTools: Record<string, string>;
  alerts: PriceAlert[];
  alertLog: AlertLog[];
  indicatorTemplates: Array<{ name: string; indicators: IndicatorConfig[] }>;
  paper: PaperAccount;
  // The user's exchange accounts (lib/coinhub/trade.ts): whether the charts mark their fills, which
  // connection the marks and the account panel use (null: the first), and the currency the
  // holdings are valued in.
  trade: { show: boolean; connection: number | null; currency: string };
  // The floating market-indicators panel over the chart. x/y are its left/top in px inside the
  // chart area; null means the default spot (top right). `collapsed` lists folded group keys.
  marketPanel: { open: boolean; x: number | null; y: number | null; collapsed: string[] };
  // Whether the floating favourite-tools bar is shown over the chart, and where it was dragged to
  // (px inside the chart area; null: the default spot, top centre).
  favoritesBar: boolean;
  favoritesBarPos: { x: number; y: number } | null;
}

const uid = () => Math.random().toString(36).slice(2, 10);
export const newId = uid;

export function indicatorConfig(name: string, calcParams?: number[]): IndicatorConfig {
  const meta = INDICATOR_MAP[name];
  return {
    id: `${name}_${uid()}`,
    name,
    calcParams: calcParams ?? meta?.defaults ?? [],
    pane: meta?.overlay ? "main" : `pane_${uid()}`,
    visible: true,
  };
}

export function defaultChart(symbolId = "BINANCE:BTCUSDT", interval: IntervalKey = "1D"): ChartConfig {
  return {
    symbolId,
    interval,
    chartType: "candles",
    indicators: [indicatorConfig("VOL")],
    scale: "normal",
    invert: false,
    compare: [],
  };
}

export const DEFAULT_SETTINGS: ChartSettings = {
  upColor: "#089981",
  downColor: "#f23645",
  bodyUp: true,
  bodyDown: true,
  borders: true,
  wicks: true,
  grid: "both",
  showHighLow: true,
  axisWheelTradingView: true,
  showHoldingLines: true,
  showLastPrice: true,
  countdown: true,
  showLegendValues: true,
  showIndicatorValues: true,
  watermark: true,
  rightOffset: 80,
  crosshairStyle: "dashed",
  priceLineColor: "auto",
  timezone: "browser",
};

export const DEFAULT_WATCHLIST = [
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "BINANCE:SOLUSDT",
  "BINANCE:BNBUSDT",
  "BINANCE:XRPUSDT",
  "BINANCE:DOGEUSDT",
  "BINANCE:BTCUSDT.P",
  "BINANCE:ETHBTC",
  "INDEX:BTC.D",
  "INDEX:USDT.D",
  "INDEX:TOTAL",
  "INDEX:FEAR.GREED",
  "YAHOO:MSTR",
  "INDEX:MSTR.MNAV",
];

function initialState(): TerminalState {
  return {
    layout: "1",
    charts: [
      defaultChart(),
      defaultChart("BINANCE:ETHUSDT", "4h"),
      defaultChart("INDEX:BTC.D"),
      defaultChart("YAHOO:MSTR"),
    ],
    active: 0,
    sync: { symbol: false, interval: false, crosshair: true, time: false },
    watchlist: DEFAULT_WATCHLIST,
    favorites: {
      intervals: DEFAULT_FAVORITE_INTERVALS,
      tools: ["trendLine", "horizontalLine", "fibRetracement", "rectangle", "longPosition"],
      indicators: [],
      chartTypes: ["candles", "line"],
    },
    recentSymbols: [],
    settings: DEFAULT_SETTINGS,
    panel: "watchlist",
    tool: null,
    cursor: "cross",
    magnet: "normal",
    stayInDrawing: false,
    drawingsLocked: false,
    drawingsHidden: false,
    indicatorsHidden: false,
    lastTools: {},
    alerts: [],
    alertLog: [],
    indicatorTemplates: [],
    paper: { balance: 10_000, initial: 10_000, positions: [], orders: [], fills: [] },
    trade: { show: true, connection: null, currency: "USD" },
    marketPanel: { open: false, x: null, y: null, collapsed: [] },
    favoritesBar: true,
    favoritesBarPos: null,
  };
}

const STORAGE_KEY = "coinhub:v1:terminal";
// Transient UI state that shouldn't survive a reload.
const TRANSIENT: Array<keyof TerminalState> = ["tool"];

function load(): TerminalState {
  const base = initialState();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<TerminalState>;
    const merged: TerminalState = {
      ...base,
      ...saved,
      settings: { ...base.settings, ...saved.settings },
      sync: { ...base.sync, ...saved.sync },
      favorites: { ...base.favorites, ...saved.favorites },
      paper: { ...base.paper, ...saved.paper },
      trade: { ...base.trade, ...saved.trade },
      marketPanel: { ...base.marketPanel, ...saved.marketPanel },
      tool: null,
    };
    merged.charts = (saved.charts ?? base.charts).map((c, i) => ({
      ...(base.charts[i] ?? defaultChart()),
      ...c,
      interval: isIntervalKey(c.interval) ? c.interval : "1D",
    }));
    while (merged.charts.length < 4) merged.charts.push(defaultChart());
    if (merged.active >= LAYOUT_COUNT[merged.layout]) merged.active = 0;
    return merged;
  } catch {
    return base;
  }
}

type Listener = () => void;

let state: TerminalState | null = null;
const listeners = new Set<Listener>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getState(): TerminalState {
  if (!state) state = load();
  return state;
}

export function setState(update: Partial<TerminalState> | ((s: TerminalState) => Partial<TerminalState>)) {
  const current = getState();
  const patch = typeof update === "function" ? update(current) : update;
  state = { ...current, ...patch };
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const copy: Partial<TerminalState> = { ...state };
      TRANSIENT.forEach((k) => delete copy[k]);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
    } catch {
      // Private mode or quota: the layout just won't persist.
    }
  }, 300);
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverState = initialState();

export function useTerminal<T>(selector: (s: TerminalState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(serverState),
  );
}

// Updates one chart's config.
export function updateChart(
  index: number,
  patch: Partial<ChartConfig> | ((c: ChartConfig) => Partial<ChartConfig>),
) {
  setState((s) => {
    const charts = s.charts.slice();
    const current = charts[index];
    charts[index] = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
    return { charts };
  });
}

// Symbol / interval changes on the active chart, applied to linked charts when sync is on.
export function setChartSymbol(index: number, symbolId: string) {
  setState((s) => {
    const charts = s.charts.map((c, i) =>
      i === index || (s.sync.symbol && i < LAYOUT_COUNT[s.layout]) ? { ...c, symbolId, compare: [] } : c,
    );
    const recentSymbols = [symbolId, ...s.recentSymbols.filter((id) => id !== symbolId)].slice(0, 12);
    return { charts, recentSymbols };
  });
}

export function setChartInterval(index: number, interval: IntervalKey) {
  setState((s) => ({
    charts: s.charts.map((c, i) =>
      i === index || (s.sync.interval && i < LAYOUT_COUNT[s.layout]) ? { ...c, interval } : c,
    ),
  }));
}

// ---------------------------------------------------------------------------------------------
// Drawings, per symbol (shared by every chart of that symbol, across intervals).

export interface SavedDrawing {
  id: string;
  name: string;
  points: Array<{ timestamp?: number; value?: number }>;
  styles: unknown;
  extendData: unknown;
  lock: boolean;
  visible: boolean;
  zLevel?: number;
}

const drawingsKey = (symbolId: string) => `coinhub:v1:drawings:${symbolId}`;

export function loadDrawings(symbolId: string): SavedDrawing[] {
  try {
    const raw = window.localStorage.getItem(drawingsKey(symbolId));
    return raw ? (JSON.parse(raw) as SavedDrawing[]) : [];
  } catch {
    return [];
  }
}

export function saveDrawings(symbolId: string, drawings: SavedDrawing[]) {
  try {
    if (drawings.length) window.localStorage.setItem(drawingsKey(symbolId), JSON.stringify(drawings));
    else window.localStorage.removeItem(drawingsKey(symbolId));
  } catch {
    // Ignore quota errors.
  }
  drawingListeners.forEach((l) => l(symbolId));
}

const drawingListeners = new Set<(symbolId: string) => void>();

// Lets other charts showing the same symbol reload drawings saved elsewhere.
export function onDrawingsSaved(listener: (symbolId: string) => void) {
  drawingListeners.add(listener);
  return () => {
    drawingListeners.delete(listener);
  };
}

// The alert threshold now: fixed, or read off its trend line.
export function alertPrice(alert: Pick<PriceAlert, "price" | "line">, now = Date.now()) {
  if (!alert.line) return alert.price;
  const [t1, v1, t2, v2] = alert.line;
  return t2 === t1 ? v1 : v1 + ((v2 - v1) * (now - t1)) / (t2 - t1);
}

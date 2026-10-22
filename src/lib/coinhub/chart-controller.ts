import {
  dispose,
  init,
  type Chart,
  type Crosshair,
  type DataLoader,
  type DeepPartial,
  type KLineData,
  type Overlay,
  type OverlayCreate,
  type OverlayEvent,
  type Styles,
} from "klinecharts";
import { registerChartSeries, type CompareSeries, type SeriesType } from "./chart-series";
import { fetchBars, subscribeBars } from "./datafeed";
import { registerIndicators } from "./indicators";
import { bucketStart, type IntervalDef } from "./intervals";
import { registerDrawingTools } from "./overlays";
import { DEFAULT_COLOR, indexAt } from "./overlays/utils";
import type {
  ChartSettings,
  ChartType,
  IndicatorConfig,
  MagnetMode,
  PriceAlert,
  SavedDrawing,
  ScaleMode,
} from "./store";
import type { TradeFill } from "./trade";
import type { CoinSymbol } from "./types";

// Imperative wrapper around one KLineChart instance: data loading (with Heikin Ashi, replay and
// "go to date"), indicators, drawings (persistence, undo / redo), alert lines and comparisons.
// React components drive it and listen to its events.

export const CANDLE_PANE = "candle_pane";

// Default indicator line colours, in TradingView order.
export const LINE_PALETTE = ["#2962ff", "#ff6d00", "#e91e63", "#00bcd4", "#9c27b0", "#4caf50"];
const DRAWINGS = "drawings";

export type ControllerEvents = {
  crosshair: Crosshair | null;
  select: Overlay | null;
  drawings: void;
  toolDone: void;
  status: { loading: boolean; error: boolean; empty: boolean };
  layout: void;
  contextMenu: { x: number; y: number; price: number | null; timestamp: number | null; overlayId?: string };
  edit: string;
  bar: KLineData;
  replay: ReplayState;
  alertMoved: { id: string; price: number };
  orderMoved: { id: string; price: number };
  click: { price: number | null; timestamp: number | null };
  // A fill mark was clicked: the ids of the fills it stands for.
  fillMark: string[];
};

export interface ReplayState {
  mode: "off" | "selecting" | "playing" | "paused";
  speed: number;
  time: number | null;
  ended: boolean;
}

type Handler<T> = (payload: T) => void;

export interface ThemeColors {
  dark: boolean;
  text: string;
  grid: string;
  border: string;
  background: string;
  crosshairLabel: string;
  // The page font, so canvas text matches the site.
  font: string;
}

// Tool defaults: TradingView-like starting styles / options for some tools.
const TOOL_DEFAULTS: Record<
  string,
  { styles?: Record<string, unknown>; extendData?: Record<string, unknown> }
> = {
  text: { styles: { text: { size: 14 } } },
  highlighter: { styles: { line: { color: "#ffeb3b" } } },
  emoji: { styles: { text: { size: 28 } } },
  infoLine: {},
  arrowMarkUp: { styles: { line: { color: "#089981" } } },
  arrowMarkDown: { styles: { line: { color: "#f23645" } } },
  anchoredVwap: { styles: { line: { color: "#2962ff", size: 2 } } },
  note: {},
};

const toPoint = (p: Partial<{ timestamp: number; value: number }>) => ({
  timestamp: p.timestamp,
  value: p.value,
});

export class ChartController {
  readonly chart: Chart;
  private listeners = new Map<keyof ControllerEvents, Set<Handler<unknown>>>();
  private symbol: CoinSymbol | null = null;
  private interval: IntervalDef | null = null;
  private chartType: ChartType = "candles";
  private settings: ChartSettings | null = null;
  private theme: ThemeColors | null = null;
  private gen = 0;
  private raw: KLineData[] = [];
  private fillMarks: TradeFill[] = [];
  private unsubscribe: (() => void) | null = null;
  private liveCallback: ((bar: KLineData) => void) | null = null;
  private more = { forward: false };
  // Go to date: data loaded around a past date; live updates resume once newer pages reach now.
  private anchorEnd: number | null = null;
  private atRealtime = true;
  private replayState: ReplayState = { mode: "off", speed: 1, time: null, ended: false };
  private replayBars: KLineData[] = [];
  private replayIndex = 0;
  private replayTimer: ReturnType<typeof setInterval> | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private lastSnapshot = "[]";
  private drawingSymbol: string | null = null;
  private persist: ((symbolId: string, drawings: SavedDrawing[]) => void) | null = null;
  private activeDrawingId: string | null = null;
  private toolName: string | null = null;
  private magnet: MagnetMode = "normal";
  private stayInDrawing = false;
  private drawingsLocked = false;
  private drawingsHidden = false;
  private eraser = false;
  private overlayContextAt = 0;
  private selectedId: string | null = null;
  private compareSeries: CompareSeries[] = [];
  private resizeObserver: ResizeObserver;

  constructor(
    private readonly el: HTMLElement,
    options: { locale: string; timezone: string },
  ) {
    registerDrawingTools();
    registerIndicators();
    registerChartSeries();
    const chart = init(el, {
      locale: options.locale,
      timezone: options.timezone,
      layout: { pane: { minHeight: 40, height: 120 } },
      formatter: { formatExtendText: () => this.countdownText() },
    });
    if (!chart) throw new Error("chart init failed");
    this.chart = chart;
    chart.setDataLoader(this.loader);
    chart.subscribeAction("onCrosshairChange", (data) =>
      this.emit("crosshair", this.enrichCrosshair((data as Crosshair) ?? null)),
    );
    chart.subscribeAction("onPaneDrag", () => this.emit("layout", undefined));
    this.resizeObserver = new ResizeObserver(() => {
      chart.resize();
      requestAnimationFrame(() => this.emit("layout", undefined));
    });
    this.resizeObserver.observe(el);
    el.addEventListener("contextmenu", this.onContextMenu);
    el.addEventListener("click", this.onClick);
  }

  destroy() {
    this.stopReplayTimer();
    this.unsubscribe?.();
    this.resizeObserver.disconnect();
    this.el.removeEventListener("contextmenu", this.onContextMenu);
    this.el.removeEventListener("click", this.onClick);
    dispose(this.chart);
    this.listeners.clear();
  }

  on<K extends keyof ControllerEvents>(event: K, handler: Handler<ControllerEvents[K]>) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(handler as Handler<unknown>);
    return () => {
      set.delete(handler as Handler<unknown>);
    };
  }

  // KLineChart 10 hands this action the raw { x, y, paneId }; the bar under the cursor only lives on
  // its private crosshair, so look it up from the pixel for the legend and data window.
  private enrichCrosshair(raw: Crosshair | null): Crosshair | null {
    if (!raw || raw.x === undefined || !raw.paneId || raw.kLineData) return raw;
    const list = this.chart.getDataList();
    const converted = this.chart.convertFromPixel([{ x: raw.x, y: raw.y ?? 0 }], { paneId: raw.paneId });
    const point = (Array.isArray(converted) ? converted[0] : converted) as { dataIndex?: number } | undefined;
    const dataIndex = point?.dataIndex;
    if (dataIndex === undefined || dataIndex < 0 || dataIndex >= list.length) return raw;
    const bar = list[dataIndex];
    return {
      ...raw,
      dataIndex,
      realDataIndex: dataIndex,
      kLineData: bar,
      timestamp: bar.timestamp,
    } as Crosshair;
  }

  private emit<K extends keyof ControllerEvents>(event: K, payload: ControllerEvents[K]) {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }

  // -------------------------------------------------------------------------------------------
  // Data

  private loader: DataLoader = {
    getBars: async ({ type, timestamp, callback }) => {
      const symbol = this.symbol;
      const interval = this.interval;
      const gen = this.gen;
      if (!symbol || !interval) {
        callback([], false);
        return;
      }
      if (type === "init" && this.replayState.mode !== "off" && this.replayState.mode !== "selecting") {
        const shown = this.transform(this.replayBars.slice(0, this.replayIndex + 1));
        callback(shown, { forward: false, backward: false });
        return;
      }
      if (type === "backward") {
        if (this.atRealtime) {
          callback([], { backward: false });
          return;
        }
        // After "go to date": load newer bars until we reach the present.
        try {
          const last = this.raw[this.raw.length - 1]?.timestamp ?? Date.now();
          const end = last + interval.ms * 1001;
          const { bars } = await fetchBars(symbol, interval, Math.min(end, Date.now() + interval.ms));
          if (gen !== this.gen) return;
          const newer = bars.filter((b) => b.timestamp > last);
          this.raw = this.raw.concat(newer);
          const reached = end >= Date.now();
          if (reached) this.atRealtime = true;
          callback(this.transformAppend(newer), { backward: !reached && newer.length > 0 });
        } catch {
          if (gen === this.gen) callback([], { backward: false });
        }
        return;
      }
      if (type === "init") this.emit("status", { loading: true, error: false, empty: false });
      try {
        const end = type === "forward" ? timestamp : this.anchorEnd;
        const { bars, more } = await fetchBars(symbol, interval, end);
        if (gen !== this.gen) return;
        if (type === "init") {
          this.raw = bars;
          this.more.forward = more;
          this.atRealtime = this.anchorEnd === null;
          callback(this.transform(bars), { forward: more, backward: !this.atRealtime });
          this.emit("status", { loading: false, error: false, empty: bars.length === 0 });
          this.applyFillMarks();
          if (this.anchorEnd !== null) {
            const target = this.anchorEnd - interval.ms * 50;
            this.anchorEnd = null;
            requestAnimationFrame(() => this.chart.scrollToTimestamp(target));
          }
          this.refreshCompare();
        } else {
          const older = bars.filter((b) => b.timestamp < (this.raw[0]?.timestamp ?? Infinity));
          this.raw = older.concat(this.raw);
          callback(this.transform(older), { forward: more && older.length > 0 });
          // Older candles can now carry the fills that fell before the chart's start.
          if (older.length) this.applyFillMarks();
        }
      } catch {
        if (gen !== this.gen) return;
        callback([], type === "init" ? false : { forward: false });
        if (type === "init") this.emit("status", { loading: false, error: true, empty: true });
      }
    },
    subscribeBar: ({ callback }) => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.liveCallback = callback;
      const symbol = this.symbol;
      const interval = this.interval;
      if (!symbol || !interval || this.replayState.mode === "playing" || this.replayState.mode === "paused")
        return;
      const gen = this.gen;
      this.unsubscribe = subscribeBars(
        symbol,
        interval,
        (bar) => {
          if (gen !== this.gen || !this.atRealtime) return;
          this.pushBar(bar);
        },
        () => this.raw[this.raw.length - 1]?.timestamp ?? null,
      );
    },
    unsubscribeBar: () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    },
  };

  private pushBar(bar: KLineData) {
    const last = this.raw[this.raw.length - 1];
    if (last && bar.timestamp < last.timestamp) return;
    if (last && last.timestamp === bar.timestamp) this.raw[this.raw.length - 1] = bar;
    else this.raw.push(bar);
    this.liveCallback?.(this.transformLive(bar));
    this.emit("bar", bar);
  }

  private transform(bars: KLineData[]): KLineData[] {
    if (this.chartType !== "heikinAshi") return bars;
    const out: KLineData[] = [];
    let prev: KLineData | null = null;
    for (const b of bars) {
      const close = (b.open + b.high + b.low + b.close) / 4;
      const open: number = prev ? (prev.open + prev.close) / 2 : (b.open + b.close) / 2;
      const ha: KLineData = {
        ...b,
        open,
        close,
        high: Math.max(b.high, open, close),
        low: Math.min(b.low, open, close),
      };
      out.push(ha);
      prev = ha;
    }
    return out;
  }

  private transformAppend(bars: KLineData[]) {
    if (this.chartType !== "heikinAshi") return bars;
    const list = this.chart.getDataList();
    let prev = list[list.length - 1];
    return bars.map((b) => {
      const close = (b.open + b.high + b.low + b.close) / 4;
      const open = prev ? (prev.open + prev.close) / 2 : (b.open + b.close) / 2;
      prev = { ...b, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close) };
      return prev;
    });
  }

  private transformLive(bar: KLineData) {
    if (this.chartType !== "heikinAshi") return bar;
    const list = this.chart.getDataList();
    const last = list[list.length - 1];
    const prev = last && last.timestamp === bar.timestamp ? list[list.length - 2] : last;
    const close = (bar.open + bar.high + bar.low + bar.close) / 4;
    const open = prev ? (prev.open + prev.close) / 2 : (bar.open + bar.close) / 2;
    return {
      ...bar,
      open,
      close,
      high: Math.max(bar.high, open, close),
      low: Math.min(bar.low, open, close),
    };
  }

  private reload() {
    this.gen++;
    this.raw = [];
    this.chart.resetData();
  }

  setSymbol(symbol: CoinSymbol) {
    if (this.symbol?.id === symbol.id) return;
    this.stopReplay(false);
    this.symbol = symbol;
    this.anchorEnd = null;
    this.gen++;
    this.raw = [];
    this.chart.setSymbol({
      ticker: symbol.id,
      pricePrecision: symbol.pricePrecision,
      volumePrecision: symbol.volumePrecision,
    });
  }

  setInterval(interval: IntervalDef) {
    if (this.interval?.key === interval.key) return;
    this.stopReplay(false);
    this.interval = interval;
    this.anchorEnd = null;
    this.gen++;
    this.raw = [];
    this.chart.setPeriod(interval.period);
  }

  getSymbol() {
    return this.symbol;
  }

  getInterval() {
    return this.interval;
  }

  // Raw (not Heikin Ashi) bars as loaded.
  getRawBars() {
    return this.raw;
  }

  setChartType(type: ChartType) {
    const wasHa = this.chartType === "heikinAshi";
    this.chartType = type;
    this.applyStyles();
    this.syncSeriesIndicator();
    if (wasHa !== (type === "heikinAshi") && this.symbol) this.reload();
  }

  // Seconds left in the current bar, shown under the last price.
  private countdownText() {
    if (!this.settings?.countdown || !this.interval || this.replayState.mode !== "off") return "";
    const list = this.chart?.getDataList() ?? [];
    const last = list[list.length - 1];
    if (!last || this.interval.period.type === "second") return "";
    let end: number;
    if (this.interval.period.type === "month") {
      const d = new Date(last.timestamp);
      end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    } else end = last.timestamp + this.interval.ms;
    const left = Math.floor((end - Date.now()) / 1000);
    if (left < 0 || left > 40 * 86400) return "";
    const d = Math.floor(left / 86400);
    const h = Math.floor((left % 86400) / 3600);
    const m = Math.floor((left % 3600) / 60);
    const s = left % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (d > 0) return `${d}d ${pad(h)}h`;
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }

  // -------------------------------------------------------------------------------------------
  // Styles

  setAppearance(theme: ThemeColors, settings: ChartSettings) {
    this.theme = theme;
    this.settings = settings;
    this.applyStyles();
    this.syncSeriesIndicator();
    this.chart.setOffsetRightDistance(settings.rightOffset);
  }

  private applyStyles() {
    const theme = this.theme;
    const s = this.settings;
    if (!theme || !s) return;
    this.chart.setStyles(buildStyles(theme, s, this.chartType));
  }

  private syncSeriesIndicator() {
    const special: SeriesType[] = ["baseline", "columns", "highLow", "stepLine", "lineMarkers"];
    const exists = this.chart.getIndicators({ name: "CH_SERIES" }).length > 0;
    if (!special.includes(this.chartType as SeriesType)) {
      if (exists) this.chart.removeIndicator({ name: "CH_SERIES" });
      return;
    }
    const extendData = {
      type: this.chartType,
      upColor: this.settings?.upColor ?? "#089981",
      downColor: this.settings?.downColor ?? "#f23645",
      lineColor: DEFAULT_COLOR,
    };
    if (exists) this.chart.overrideIndicator({ name: "CH_SERIES", extendData });
    else
      this.chart.createIndicator(
        { name: "CH_SERIES", id: "CH_SERIES", paneId: CANDLE_PANE, extendData, zLevel: -1 },
        true,
      );
  }

  setScale(mode: ScaleMode, invert: boolean) {
    this.chart.overrideYAxis({ paneId: CANDLE_PANE, name: mode, reverse: invert });
  }

  setTimezone(timezone: string) {
    this.chart.setTimezone(timezone);
  }

  // -------------------------------------------------------------------------------------------
  // Indicators

  setIndicators(configs: IndicatorConfig[], hidden: boolean) {
    const wanted = new Set(configs.map((c) => c.id));
    for (const ind of this.chart.getIndicators()) {
      if (ind.name.startsWith("CH_")) continue;
      if (!wanted.has(ind.id)) this.chart.removeIndicator({ id: ind.id });
    }
    for (const c of configs) {
      // Always hand KLineChart a full palette: with fewer entries than lines (an EMA that grew
      // from one length to four after its colour was saved) it would paint every line the same.
      const styles =
        c.colors || c.widths
          ? {
              lines: LINE_PALETTE.map((fallback, i) => ({
                color: c.colors?.[i] ?? fallback,
                size: c.widths?.[i] ?? 1,
              })),
            }
          : undefined;
      const existing = this.chart.getIndicators({ id: c.id })[0];
      const visible = c.visible && !hidden;
      if (existing) {
        this.chart.overrideIndicator({ id: c.id, name: c.name, calcParams: c.calcParams, visible, styles });
      } else {
        this.chart.createIndicator(
          {
            id: c.id,
            name: c.name,
            calcParams: c.calcParams,
            visible,
            styles,
            paneId: c.pane === "main" ? CANDLE_PANE : c.pane,
          },
          c.pane === "main",
        );
      }
    }
    // Pane sizes settle on the next frame.
    requestAnimationFrame(() => this.emit("layout", undefined));
  }

  // Pane id → top offset / height, for the HTML legends.
  getPanes() {
    const out: Array<{ id: string; top: number; height: number }> = [];
    const panes = this.chart.getPaneOptions();
    for (const p of Array.isArray(panes) ? panes : panes ? [panes] : []) {
      const size = this.chart.getSize(p.id, "main");
      if (size && p.id !== "x_axis_pane") out.push({ id: p.id, top: size.top, height: size.height });
    }
    return out;
  }

  // -------------------------------------------------------------------------------------------
  // Comparison

  async setCompare(symbols: Array<{ symbol: CoinSymbol; color: string }>) {
    const interval = this.interval;
    if (!interval) return;
    const gen = this.gen;
    const series: CompareSeries[] = [];
    await Promise.all(
      symbols.map(async ({ symbol, color }) => {
        try {
          const first = this.raw[0]?.timestamp ?? 0;
          let { bars, more } = await fetchBars(symbol, interval, null);
          // A couple more pages so the comparison covers what's loaded.
          for (let i = 0; i < 3 && more && bars.length && bars[0].timestamp > first; i++) {
            const page = await fetchBars(symbol, interval, bars[0].timestamp);
            bars = page.bars.concat(bars);
            more = page.more;
          }
          series.push({
            id: symbol.id,
            display: symbol.display,
            color,
            closes: new Map(bars.map((b) => [bucketStart(interval, b.timestamp), b.close])),
          });
        } catch {
          // Skip symbols that fail to load.
        }
      }),
    );
    if (gen !== this.gen) return;
    this.compareSeries = series.sort(
      (a, b) =>
        symbols.findIndex((s) => s.symbol.id === a.id) - symbols.findIndex((s) => s.symbol.id === b.id),
    );
    this.refreshCompare();
  }

  private refreshCompare() {
    const exists = this.chart.getIndicators({ name: "CH_COMPARE" }).length > 0;
    if (!this.compareSeries.length || !this.interval) {
      if (exists) this.chart.removeIndicator({ name: "CH_COMPARE" });
      return;
    }
    const interval = this.interval;
    const extendData = { series: this.compareSeries, bucket: (t: number) => bucketStart(interval, t) };
    if (exists) this.chart.overrideIndicator({ name: "CH_COMPARE", extendData });
    else
      this.chart.createIndicator(
        { name: "CH_COMPARE", id: "CH_COMPARE", paneId: CANDLE_PANE, extendData },
        true,
      );
  }

  getCompareSeries() {
    return this.compareSeries;
  }

  // -------------------------------------------------------------------------------------------
  // Drawings

  setPersistence(persist: (symbolId: string, drawings: SavedDrawing[]) => void) {
    this.persist = persist;
  }

  setDrawingOptions(o: {
    magnet: MagnetMode;
    stayInDrawing: boolean;
    locked: boolean;
    hidden: boolean;
    eraser: boolean;
  }) {
    const lockChanged = o.locked !== this.drawingsLocked;
    const hiddenChanged = o.hidden !== this.drawingsHidden;
    this.magnet = o.magnet;
    this.stayInDrawing = o.stayInDrawing;
    this.drawingsLocked = o.locked;
    this.drawingsHidden = o.hidden;
    this.eraser = o.eraser;
    if (lockChanged || hiddenChanged) {
      for (const ov of this.getDrawings()) {
        this.chart.overrideOverlay({
          id: ov.id,
          lock: o.locked || this.isLocked(ov),
          visible: !o.hidden && this.isVisible(ov),
        });
      }
    }
    this.chart.overrideOverlay({ groupId: DRAWINGS, mode: o.magnet });
  }

  // Each drawing remembers its own lock / visibility in extendData so "lock all" can be undone.
  private isLocked(ov: Overlay) {
    return Boolean((ov.extendData as { locked?: boolean } | null)?.locked);
  }

  private isVisible(ov: Overlay) {
    return !(ov.extendData as { hidden?: boolean } | null)?.hidden;
  }

  getDrawings() {
    return this.chart.getOverlays({ groupId: DRAWINGS }).filter((o) => o.currentStep === -1);
  }

  private serialize(): SavedDrawing[] {
    return this.getDrawings()
      .filter((o) => !(o.extendData as { temporary?: boolean } | null)?.temporary)
      .map((o) => ({
        id: o.id,
        name: o.name,
        points: o.points.map(toPoint),
        styles: o.styles,
        extendData: o.extendData,
        lock: this.isLocked(o),
        visible: this.isVisible(o),
        zLevel: o.zLevel,
      }));
  }

  // Replaces the drawings with a saved set (on symbol change, undo / redo, or another chart's save).
  loadDrawings(symbolId: string, drawings: SavedDrawing[]) {
    this.drawingSymbol = symbolId;
    this.chart.removeOverlay({ groupId: DRAWINGS });
    for (const d of drawings) this.createDrawing(d);
    this.lastSnapshot = JSON.stringify(this.serialize());
    this.undoStack = [];
    this.redoStack = [];
    this.emit("drawings", undefined);
  }

  private restore(json: string) {
    this.chart.removeOverlay({ groupId: DRAWINGS });
    for (const d of JSON.parse(json) as SavedDrawing[]) this.createDrawing(d);
    this.lastSnapshot = json;
    this.save(false);
  }

  private createDrawing(d: SavedDrawing) {
    const extendData = { ...(d.extendData as object), locked: d.lock, hidden: !d.visible };
    this.chart.createOverlay({
      ...this.handlers(),
      id: d.id,
      name: d.name,
      groupId: DRAWINGS,
      points: d.points,
      styles: d.styles as OverlayCreate["styles"],
      extendData,
      lock: d.lock || this.drawingsLocked,
      visible: d.visible && !this.drawingsHidden,
      mode: this.magnet,
      zLevel: d.zLevel,
    });
  }

  // Saves the current drawings and records an undo step when they changed.
  private save(record = true) {
    const snapshot = JSON.stringify(this.serialize());
    if (snapshot === this.lastSnapshot) return;
    if (record) {
      this.undoStack.push(this.lastSnapshot);
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack = [];
    }
    this.lastSnapshot = snapshot;
    if (this.drawingSymbol) this.persist?.(this.drawingSymbol, JSON.parse(snapshot));
    this.emit("drawings", undefined);
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    const prev = this.undoStack.pop();
    if (prev === undefined) return;
    this.redoStack.push(this.lastSnapshot);
    this.restore(prev);
  }

  redo() {
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(this.lastSnapshot);
    this.restore(next);
  }

  private handlers(): Partial<OverlayCreate> {
    return {
      onDrawEnd: (e: OverlayEvent<unknown>) => this.onDrawEnd(e),
      onPressedMoveEnd: () => this.save(),
      onRemoved: () => queueMicrotask(() => this.save()),
      onSelected: (e: OverlayEvent<unknown>) => {
        this.selectedId = e.overlay.id;
        this.emit("select", e.overlay);
      },
      onDeselected: (e: OverlayEvent<unknown>) => {
        if (this.selectedId === e.overlay.id) {
          this.selectedId = null;
          this.emit("select", null);
        }
      },
      onClick: (e: OverlayEvent<unknown>) => {
        if (this.eraser) this.chart.removeOverlay({ id: e.overlay.id });
      },
      onDoubleClick: (e: OverlayEvent<unknown>) => this.emit("edit", e.overlay.id),
      onRightClick: (e: OverlayEvent<unknown>) => {
        e.preventDefault?.();
        this.overlayContextAt = Date.now();
        const rect = this.el.getBoundingClientRect();
        this.emit("contextMenu", {
          x: (e.pageX ?? 0) - window.scrollX - rect.left,
          y: (e.pageY ?? 0) - window.scrollY - rect.top,
          price: null,
          timestamp: null,
          overlayId: e.overlay.id,
        });
      },
    };
  }

  private onDrawEnd(e: OverlayEvent<unknown>) {
    const ov = e.overlay;
    this.activeDrawingId = null;
    if (ov.name === "positionPlacer") {
      // Swap the one-click placeholder for a long / short position with default target / stop.
      const side = (ov.extendData as { side: "long" | "short" }).side;
      const point = ov.points[0];
      this.chart.removeOverlay({ id: ov.id });
      const entry = point.value ?? 0;
      const interval = this.interval?.ms ?? 60_000;
      const width = Math.max(
        20,
        Math.round(this.chart.getVisibleRange().to - this.chart.getVisibleRange().from) / 6,
      );
      const end = (point.timestamp ?? Date.now()) + interval * Math.round(width);
      const s = side === "long" ? 1 : -1;
      this.chart.createOverlay({
        ...this.handlers(),
        name: side === "long" ? "longPosition" : "shortPosition",
        groupId: DRAWINGS,
        points: [
          { timestamp: point.timestamp, value: entry },
          { timestamp: end, value: entry * (1 + 0.04 * s) },
          { timestamp: end, value: entry * (1 - 0.02 * s) },
        ],
        mode: this.magnet,
        extendData: { accountSize: 1000, riskPercent: 1, quantityPrecision: 4 },
      });
    }
    this.save();
    if (this.stayInDrawing && this.toolName) {
      requestAnimationFrame(() => this.toolName && this.startTool(this.toolName));
    } else {
      this.toolName = null;
      this.emit("toolDone", undefined);
    }
  }

  startTool(
    name: string,
    overrides?: { styles?: Record<string, unknown>; extendData?: Record<string, unknown> },
  ) {
    this.cancelTool();
    this.toolName = name;
    const defaults = TOOL_DEFAULTS[name] ?? {};
    const isPosition = name === "longPosition" || name === "shortPosition";
    const id = this.chart.createOverlay({
      ...this.handlers(),
      name: isPosition ? "positionPlacer" : name,
      groupId: DRAWINGS,
      mode: this.magnet,
      styles: (overrides?.styles ?? defaults.styles) as OverlayCreate["styles"],
      extendData: isPosition
        ? { side: name === "longPosition" ? "long" : "short" }
        : {
            ...defaults.extendData,
            ...overrides?.extendData,
            ...(name === "measure" ? { temporary: true } : {}),
          },
    });
    this.activeDrawingId = typeof id === "string" ? id : null;
  }

  cancelTool() {
    if (this.activeDrawingId) {
      const ov = this.chart.getOverlays({ id: this.activeDrawingId })[0];
      if (ov && ov.currentStep !== -1) this.chart.removeOverlay({ id: this.activeDrawingId });
    }
    this.activeDrawingId = null;
    this.toolName = null;
  }

  getSelectedId() {
    return this.selectedId;
  }

  removeDrawing(id: string) {
    this.chart.removeOverlay({ id });
    if (this.selectedId === id) {
      this.selectedId = null;
      this.emit("select", null);
    }
  }

  removeAllDrawings() {
    this.chart.removeOverlay({ groupId: DRAWINGS });
    this.selectedId = null;
    this.emit("select", null);
    this.save();
  }

  removeMeasures() {
    for (const ov of this.chart.getOverlays({ groupId: DRAWINGS, name: "measure" }))
      this.chart.removeOverlay({ id: ov.id });
  }

  updateDrawing(
    id: string,
    patch: {
      styles?: Record<string, unknown>;
      extendData?: Record<string, unknown>;
      lock?: boolean;
      visible?: boolean;
      zLevel?: number;
    },
  ) {
    const ov = this.chart.getOverlays({ id })[0];
    if (!ov) return;
    const extendData = { ...(ov.extendData as object), ...patch.extendData };
    if (patch.lock !== undefined) Object.assign(extendData, { locked: patch.lock });
    if (patch.visible !== undefined) Object.assign(extendData, { hidden: !patch.visible });
    this.chart.overrideOverlay({
      id,
      styles: patch.styles as OverlayCreate["styles"],
      extendData,
      lock: patch.lock === undefined ? undefined : patch.lock || this.drawingsLocked,
      visible: patch.visible === undefined ? undefined : patch.visible && !this.drawingsHidden,
      zLevel: patch.zLevel,
    });
    this.save();
    const updated = this.chart.getOverlays({ id })[0];
    if (updated && this.selectedId === id) this.emit("select", updated);
  }

  // A finished drawing placed programmatically (e.g. "horizontal line here" from the context menu).
  addDrawing(name: string, points: Array<{ timestamp?: number; value?: number }>) {
    this.chart.createOverlay({ ...this.handlers(), name, groupId: DRAWINGS, points, mode: this.magnet });
    this.save();
  }

  cloneDrawing(id: string) {
    const ov = this.chart.getOverlays({ id })[0];
    if (!ov) return;
    const shift = (this.interval?.ms ?? 60_000) * 5;
    this.chart.createOverlay({
      ...this.handlers(),
      name: ov.name,
      groupId: DRAWINGS,
      points: ov.points.map((p) => ({ timestamp: (p.timestamp ?? 0) + shift, value: p.value })),
      styles: ov.styles as OverlayCreate["styles"],
      extendData: structuredClone(ov.extendData),
      mode: this.magnet,
    });
    this.save();
  }

  // -------------------------------------------------------------------------------------------
  // Alerts and paper orders as draggable lines.

  setAlertLines(
    alerts: PriceAlert[],
    orders: Array<{ id: string; price: number; text: string; color: string; draggable: boolean }>,
  ) {
    this.chart.removeOverlay({ groupId: "alerts" });
    this.chart.removeOverlay({ groupId: "orders" });
    const t = this.raw[this.raw.length - 1]?.timestamp;
    for (const a of alerts) {
      this.chart.createOverlay({
        id: `alert_${a.id}`,
        name: "alertLine",
        groupId: "alerts",
        points: [{ timestamp: t, value: a.price }],
        extendData: {
          text: `⏰ ${a.message || a.display}`,
          color: a.active ? "#ff9800" : "#787b86",
          dashed: true,
        },
        onPressedMoveEnd: (e) =>
          this.emit("alertMoved", { id: a.id, price: e.overlay.points[0].value ?? a.price }),
        onRightClick: (e) => e.preventDefault?.(),
      });
    }
    for (const o of orders) {
      this.chart.createOverlay({
        id: `order_${o.id}`,
        name: "orderLine",
        groupId: "orders",
        lock: !o.draggable,
        points: [{ timestamp: t, value: o.price }],
        extendData: { text: o.text, color: o.color, dashed: o.draggable },
        onPressedMoveEnd: (e) =>
          this.emit("orderMoved", { id: o.id, price: e.overlay.points[0].value ?? o.price }),
        onRightClick: (e) => e.preventDefault?.(),
      });
    }
  }

  // -------------------------------------------------------------------------------------------
  // Fills from the user's exchange account: one mark per candle and side, under the low for buys
  // and over the high for sells (like Binance's own chart).

  setFillMarks(fills: TradeFill[]) {
    this.fillMarks = fills;
    this.applyFillMarks();
  }

  private applyFillMarks() {
    this.chart.removeOverlay({ groupId: "fills" });
    if (!this.fillMarks.length || !this.raw.length) return;
    type Group = { bar: KLineData; side: "BUY" | "SELL"; hollow: boolean; ids: string[] };
    const groups = new Map<string, Group>();
    for (const f of this.fillMarks) {
      const i = indexAt(this.raw, f.time);
      if (i < 0) continue;
      // Futures fills are hollow marks (contracts, not coins).
      const hollow = f.product === "coinm";
      const key = `${this.raw[i].timestamp}_${f.side}_${hollow ? "f" : "s"}`;
      const g = groups.get(key) ?? { bar: this.raw[i], side: f.side, hollow, ids: [] };
      g.ids.push(f.id);
      groups.set(key, g);
    }
    for (const [key, g] of groups) {
      const buy = g.side === "BUY";
      this.chart.createOverlay({
        id: `fill_${key}`,
        name: "fillMark",
        groupId: "fills",
        lock: true,
        points: [{ timestamp: g.bar.timestamp, value: buy ? g.bar.low : g.bar.high }],
        extendData: { side: g.side, hollow: g.hollow, text: buy ? "B" : "S" },
        onClick: () => this.emit("fillMark", g.ids),
        onRightClick: (e) => e.preventDefault?.(),
      });
    }
  }

  // -------------------------------------------------------------------------------------------
  // Navigation

  private pixelToPoint(x: number, y: number) {
    const p = this.chart.convertFromPixel([{ x, y }], { paneId: CANDLE_PANE, absolute: true }) as Array<{
      timestamp?: number;
      value?: number;
    }>;
    const point = Array.isArray(p) ? p[0] : (p as { timestamp?: number; value?: number });
    return { price: point?.value ?? null, timestamp: point?.timestamp ?? null };
  }

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    const rect = this.el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // An overlay's own right-click handler runs first and opens the drawing's menu instead.
    setTimeout(() => {
      if (Date.now() - this.overlayContextAt < 300) return;
      const candle = this.chart.getSize(CANDLE_PANE, "main");
      const inCandle = candle && y >= candle.top && y <= candle.top + candle.height;
      const point = inCandle ? this.pixelToPoint(x, y) : { price: null, timestamp: null };
      this.emit("contextMenu", { x, y, ...point });
    }, 0);
  };

  private onClick = (event: MouseEvent) => {
    const rect = this.el.getBoundingClientRect();
    const point = this.pixelToPoint(event.clientX - rect.left, event.clientY - rect.top);
    if (this.replayState.mode === "selecting" && point.timestamp) {
      this.beginReplayAt(point.timestamp);
      return;
    }
    this.emit("click", point);
  };

  scrollToRealtime() {
    if (!this.atRealtime) {
      this.anchorEnd = null;
      this.reload();
      return;
    }
    this.chart.scrollToRealTime(200);
  }

  resetView() {
    this.chart.setBarSpace(8);
    this.chart.setOffsetRightDistance(this.settings?.rightOffset ?? 80);
    this.scrollToRealtime();
    this.chart.overrideYAxis({ paneId: CANDLE_PANE });
  }

  // Shows roughly `ms` of history up to now ("1D", "5D", "1M"… buttons).
  showRange(ms: number | "all") {
    const width = this.chart.getSize(CANDLE_PANE, "main")?.width ?? 800;
    const interval = this.interval?.ms ?? 86_400_000;
    const bars = ms === "all" ? this.raw.length : ms / interval;
    const space = Math.max(1, Math.min(50, (width - (this.settings?.rightOffset ?? 80)) / Math.max(1, bars)));
    this.chart.setBarSpace(space);
    this.chart.scrollToRealTime(0);
  }

  // Jumps to a date, reloading around it when it is older than what's loaded.
  goToDate(timestamp: number) {
    const first = this.raw[0]?.timestamp;
    if (first !== undefined && timestamp >= first) {
      this.chart.scrollToTimestamp(timestamp, 200);
      return;
    }
    if (!this.interval) return;
    this.anchorEnd = timestamp + this.interval.ms * 200;
    this.reload();
  }

  zoom(scale: number) {
    this.chart.zoomAtCoordinate(scale, undefined, 150);
  }

  screenshot() {
    return this.chart.getConvertPictureUrl(true, "png", this.theme?.background ?? "#ffffff");
  }

  // -------------------------------------------------------------------------------------------
  // Bar replay

  getReplay() {
    return this.replayState;
  }

  private setReplay(patch: Partial<ReplayState>) {
    this.replayState = { ...this.replayState, ...patch };
    this.emit("replay", this.replayState);
  }

  startReplaySelection() {
    if (!this.raw.length) return;
    this.setReplay({ mode: "selecting", ended: false });
  }

  private beginReplayAt(timestamp: number) {
    const all = this.raw.slice();
    let index = all.findIndex((b) => b.timestamp >= timestamp);
    if (index < 0) index = all.length - 1;
    this.replayBars = all;
    this.replayIndex = Math.max(1, index);
    this.setReplay({ mode: "paused", time: all[this.replayIndex].timestamp, ended: false });
    this.gen++;
    this.chart.resetData();
  }

  replayStep() {
    if (this.replayState.mode !== "paused" && this.replayState.mode !== "playing") return;
    if (this.replayIndex >= this.replayBars.length - 1) {
      this.stopReplayTimer();
      this.setReplay({ mode: "paused", ended: true });
      return;
    }
    this.replayIndex++;
    const bar = this.replayBars[this.replayIndex];
    this.liveCallback?.(this.transformLive(bar));
    this.emit("bar", bar);
    this.setReplay({ time: bar.timestamp });
  }

  replayPlay(speed = this.replayState.speed) {
    if (this.replayState.mode !== "paused" && this.replayState.mode !== "playing") return;
    this.stopReplayTimer();
    this.replayTimer = setInterval(() => this.replayStep(), 1000 / speed);
    this.setReplay({ mode: "playing", speed });
  }

  replayPause() {
    this.stopReplayTimer();
    if (this.replayState.mode === "playing") this.setReplay({ mode: "paused" });
  }

  setReplaySpeed(speed: number) {
    if (this.replayState.mode === "playing") this.replayPlay(speed);
    else this.setReplay({ speed });
  }

  private stopReplayTimer() {
    if (this.replayTimer) clearInterval(this.replayTimer);
    this.replayTimer = null;
  }

  stopReplay(reload = true) {
    if (this.replayState.mode === "off") return;
    const wasRunning = this.replayState.mode !== "selecting";
    this.stopReplayTimer();
    this.setReplay({ mode: "off", time: null, ended: false });
    this.replayBars = [];
    if (reload && wasRunning) this.reload();
  }
}

// ---------------------------------------------------------------------------------------------

export function buildStyles(theme: ThemeColors, s: ChartSettings, chartType: ChartType): DeepPartial<Styles> {
  const up = s.upColor;
  const down = s.downColor;
  const transparent = "rgba(0,0,0,0)";
  const lineColor = DEFAULT_COLOR;
  const custom = ["baseline", "columns", "highLow", "stepLine", "lineMarkers"].includes(chartType);
  const candleType =
    chartType === "hollow"
      ? "candle_up_stroke"
      : chartType === "bars"
        ? "ohlc"
        : chartType === "line" || chartType === "area" || custom
          ? "area"
          : "candle_solid";
  const dash = s.crosshairStyle === "solid" ? [] : s.crosshairStyle === "dotted" ? [1, 3] : [4, 4];
  const crossLine = {
    show: true,
    style: s.crosshairStyle === "solid" ? "solid" : "dashed",
    dashedValue: dash,
    size: 1,
    color: theme.dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
  } as const;
  const crossText = {
    show: true,
    color: "#fff",
    backgroundColor: theme.crosshairLabel,
    borderColor: theme.crosshairLabel,
    size: 11,
    family: theme.font,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 3,
  };
  const family = theme.font;
  const axisText = { color: theme.text, size: 11, family };
  return {
    grid: {
      show: s.grid !== "none",
      horizontal: { show: s.grid === "both" || s.grid === "horizontal", color: theme.grid, style: "solid" },
      vertical: { show: s.grid === "both" || s.grid === "vertical", color: theme.grid, style: "solid" },
    },
    candle: {
      type: candleType,
      bar: {
        compareRule: "current_open",
        upColor: s.bodyUp ? up : transparent,
        downColor: s.bodyDown ? down : transparent,
        noChangeColor: theme.text,
        upBorderColor: s.borders ? up : transparent,
        downBorderColor: s.borders ? down : transparent,
        noChangeBorderColor: theme.text,
        upWickColor: s.wicks ? up : transparent,
        downWickColor: s.wicks ? down : transparent,
        noChangeWickColor: theme.text,
      },
      area: {
        lineSize: custom ? 0 : 2,
        lineColor: custom ? transparent : lineColor,
        value: "close",
        smooth: false,
        backgroundColor:
          chartType === "area"
            ? [
                { offset: 0, color: "rgba(41,98,255,0.02)" },
                { offset: 1, color: "rgba(41,98,255,0.28)" },
              ]
            : transparent,
        point: {
          show: !custom,
          color: lineColor,
          rippleColor: "rgba(41,98,255,0.3)",
          radius: 3,
          rippleRadius: 7,
        },
      },
      priceMark: {
        show: true,
        high: { show: s.showHighLow, color: theme.text, textSize: 10, textFamily: family },
        low: { show: s.showHighLow, color: theme.text, textSize: 10, textFamily: family },
        last: {
          show: s.showLastPrice,
          upColor: up,
          downColor: down,
          noChangeColor: theme.text,
          line: { show: true, style: "dashed", dashedValue: [2, 2], size: 1 },
          text: {
            show: true,
            size: 11,
            family,
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 2,
          },
          extendTexts: s.countdown
            ? [
                {
                  show: true,
                  position: "below_price",
                  updateInterval: 1000,
                  size: 10,
                  family,
                  color: "#fff",
                  paddingLeft: 4,
                  paddingRight: 4,
                  paddingTop: 2,
                  paddingBottom: 3,
                },
              ]
            : [],
        },
      },
      tooltip: { showRule: "none" },
    },
    indicator: {
      tooltip: { showRule: "none" },
      lastValueMark: {
        show: true,
        text: {
          show: true,
          size: 10,
          family,
          paddingLeft: 3,
          paddingRight: 3,
          paddingTop: 2,
          paddingBottom: 2,
        },
      },
      bars: [
        {
          upColor: theme.dark ? "rgba(8,153,129,0.5)" : "rgba(8,153,129,0.45)",
          downColor: theme.dark ? "rgba(242,54,69,0.5)" : "rgba(242,54,69,0.45)",
          noChangeColor: theme.text,
        },
      ],
      lines: LINE_PALETTE.map((color) => ({
        color,
        size: 1,
        style: "solid",
        smooth: false,
      })),
    },
    xAxis: {
      axisLine: { color: theme.border },
      tickLine: { color: theme.border },
      tickText: axisText,
    },
    yAxis: {
      axisLine: { color: theme.border },
      tickLine: { color: theme.border },
      tickText: axisText,
    },
    separator: { color: theme.border, size: 1, activeBackgroundColor: "rgba(41,98,255,0.15)" },
    crosshair: {
      horizontal: { line: crossLine, text: crossText },
      vertical: { line: crossLine, text: crossText },
    },
    overlay: {
      point: {
        color: theme.background,
        borderColor: DEFAULT_COLOR,
        borderSize: 1,
        radius: 4,
        activeColor: theme.background,
        activeBorderColor: DEFAULT_COLOR,
        activeBorderSize: 2,
        activeRadius: 5,
      },
      line: { color: DEFAULT_COLOR, size: 1 },
      text: { color: DEFAULT_COLOR, size: 12, family, backgroundColor: transparent, borderSize: 0 },
      rect: { color: "rgba(41,98,255,0.12)", borderColor: DEFAULT_COLOR },
      polygon: { color: "rgba(41,98,255,0.12)", borderColor: DEFAULT_COLOR },
      circle: { color: "rgba(41,98,255,0.12)", borderColor: DEFAULT_COLOR },
      arc: { color: DEFAULT_COLOR },
    },
  };
}

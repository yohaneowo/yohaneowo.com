import type { KLineData } from "klinecharts";
import { futuresStream, spotStream, type Emit } from "./binance-stream";
import { bucketStart, type IntervalDef } from "./intervals";
import type { CoinSymbol, RawBar, SeriesResponse } from "./types";

// Bars and 24h tickers for every source. Binance is called straight from the browser (public,
// CORS-enabled, and it spreads rate limits over visitors); Yahoo and the indexes go through
// /api/coinhub because they need a server.

export interface BarsResult {
  bars: KLineData[];
  more: boolean;
}

export interface Ticker {
  last: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  change: number;
  changePercent: number;
}

const SPOT_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
let spotHost = 0;

async function binanceSpot<T>(path: string, signal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < SPOT_HOSTS.length; attempt++) {
    const host = SPOT_HOSTS[(spotHost + attempt) % SPOT_HOSTS.length];
    try {
      const res = await fetch(host + path, { signal });
      // 451/403: region-blocked; try the mirror and remember it.
      if (!res.ok) throw new Error(String(res.status));
      spotHost = (spotHost + attempt) % SPOT_HOSTS.length;
      return (await res.json()) as T;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

async function binanceFutures<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`https://fapi.binance.com${path}`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

const fromRaw = ([timestamp, open, high, low, close, volume]: RawBar): KLineData => ({
  timestamp,
  open,
  high,
  low,
  close,
  volume,
});

export function resample(bars: KLineData[], interval: IntervalDef): KLineData[] {
  const out: KLineData[] = [];
  for (const bar of bars) {
    const t = bucketStart(interval, bar.timestamp);
    const last = out[out.length - 1];
    if (last && last.timestamp === t) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      last.volume = (last.volume ?? 0) + (bar.volume ?? 0);
    } else {
      out.push({ ...bar, timestamp: t, volume: bar.volume ?? 0 });
    }
  }
  return out;
}

const NATIVE_YAHOO: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "60m",
  "1D": "1d",
  "1W": "1wk",
  "1M": "1mo",
};

// Indexes are small, daily and slow-moving: keep each response for a few minutes.
const indexCache = new Map<string, { at: number; data: Promise<SeriesResponse> }>();

function getIndex(symbol: CoinSymbol) {
  const cached = indexCache.get(symbol.id);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.data;
  const data = getJson<SeriesResponse>(`/api/coinhub/series?id=${encodeURIComponent(symbol.id)}`);
  indexCache.set(symbol.id, { at: Date.now(), data });
  data.catch(() => indexCache.delete(symbol.id));
  return data;
}

type BinanceKline = [number, string, string, string, string, string, ...unknown[]];

const fromKline = (k: BinanceKline): KLineData => ({
  timestamp: k[0],
  open: Number(k[1]),
  high: Number(k[2]),
  low: Number(k[3]),
  close: Number(k[4]),
  volume: Number(k[5]),
});

// Bars ending before `end` (or the latest ones when null).
export async function fetchBars(
  symbol: CoinSymbol,
  interval: IntervalDef,
  end: number | null,
  signal?: AbortSignal,
): Promise<BarsResult> {
  switch (symbol.source) {
    case "binance":
    case "binance-futures": {
      const futures = symbol.source === "binance-futures";
      const limit = futures ? 1500 : 1000;
      const query = `symbol=${symbol.ticker}&interval=${interval.binance}&limit=${limit}${end ? `&endTime=${end - 1}` : ""}`;
      const klines = futures
        ? await binanceFutures<BinanceKline[]>(`/fapi/v1/klines?${query}`, signal)
        : await binanceSpot<BinanceKline[]>(`/api/v3/klines?${query}`, signal);
      const more = klines.length === limit;
      if (!interval.resample) return { bars: klines.map(fromKline), more };
      // Custom interval: build it from the base bars; the oldest bucket may be incomplete.
      let bars = resample(klines.map(fromKline), interval);
      if (more && bars.length > 1 && klines[0][0] !== bars[0].timestamp) bars = bars.slice(1);
      return { bars, more };
    }
    case "yahoo": {
      const base = interval.yahoo;
      if (!base) return { bars: [], more: false };
      const res = await getJson<SeriesResponse>(
        `/api/coinhub/series?id=${encodeURIComponent(symbol.id)}&interval=${base}${end ? `&end=${end}` : ""}`,
        signal,
      );
      const bars = res.bars.map(fromRaw);
      return { bars: NATIVE_YAHOO[interval.key] === base ? bars : resample(bars, interval), more: res.more };
    }
    case "index": {
      if (end) return { bars: [], more: false };
      const res = await getIndex(symbol);
      const bars = res.bars.map(fromRaw);
      return { bars: interval.key === "1D" ? bars : resample(bars, interval), more: false };
    }
  }
}

type KlineEvent = { k: { t: number; o: string; h: string; l: string; c: string; v: string } };

// Bars from `since` onwards (inclusive), oldest first; used to backfill after a socket drop.
async function fetchBarsSince(
  symbol: CoinSymbol,
  interval: IntervalDef,
  since: number,
): Promise<KLineData[]> {
  const futures = symbol.source === "binance-futures";
  const limit = futures ? 1500 : 1000;
  const query = `symbol=${symbol.ticker}&interval=${interval.binance}&startTime=${since}&limit=${limit}`;
  const klines = futures
    ? await binanceFutures<BinanceKline[]>(`/fapi/v1/klines?${query}`)
    : await binanceSpot<BinanceKline[]>(`/api/v3/klines?${query}`);
  return klines.map(fromKline);
}

// Live updates of the latest bar. Returns the unsubscribe function. `since` tells the feed the
// newest bar the chart holds, so a reconnect can refetch the bars missed while offline before any
// live tick (KLineChart drops bars older than its last one).
export function subscribeBars(
  symbol: CoinSymbol,
  interval: IntervalDef,
  onBar: (bar: KLineData) => void,
  since?: () => number | null,
): () => void {
  if (symbol.source === "binance" || symbol.source === "binance-futures") {
    const hub = symbol.source === "binance" ? spotStream : futuresStream;
    let stopped = false;
    let filling = false;
    const queued: KLineData[] = [];
    // Custom intervals arrive as base bars; the current bucket is rebuilt from the ones seen.
    const bucket = new Map<number, KLineData>();
    let bucketTs = -1;
    const aggregate = (bar: KLineData): KLineData => {
      if (!interval.resample) return bar;
      const t = bucketStart(interval, bar.timestamp);
      if (t !== bucketTs) {
        bucketTs = t;
        bucket.clear();
      }
      bucket.set(bar.timestamp, bar);
      return resample(
        [...bucket.values()].sort((a, b) => a.timestamp - b.timestamp),
        interval,
      )[0];
    };
    const emit = (bar: KLineData) => onBar(aggregate(bar));
    const deliver = (bar: KLineData) => {
      if (stopped) return;
      if (filling) queued.push(bar);
      else emit(bar);
    };
    const backfill = async () => {
      const last = since?.() ?? null;
      if (last === null || filling) return;
      filling = true;
      try {
        const from = interval.resample ? bucketStart(interval, last) : last;
        const bars = await fetchBarsSince(symbol, interval, from);
        if (!stopped) bars.forEach(emit);
      } catch {
        // The live ticks still resume below; the gap just stays.
      } finally {
        filling = false;
        const pending = queued.splice(0).sort((a, b) => a.timestamp - b.timestamp);
        if (!stopped) pending.forEach(emit);
      }
    };
    const offReconnect = hub.onReconnect(() => void backfill());
    // Seed the current bucket so the first live update isn't missing the bars before it.
    if (interval.resample) setTimeout(() => void backfill(), 0);
    const offStream = hub.subscribe(`${symbol.ticker.toLowerCase()}@kline_${interval.binance}`, (data) => {
      const { k } = data as KlineEvent;
      deliver({
        timestamp: k.t,
        open: Number(k.o),
        high: Number(k.h),
        low: Number(k.l),
        close: Number(k.c),
        volume: Number(k.v),
      });
    });
    return () => {
      stopped = true;
      offReconnect();
      offStream();
    };
  }
  // Polling: Yahoo every 20 s (it updates about once a minute), indexes every 10 min.
  let stopped = false;
  const poll = async () => {
    try {
      const { bars } = await fetchBars(symbol, interval, null);
      if (!stopped) bars.slice(-2).forEach(onBar);
    } catch {
      // Try again on the next tick.
    }
  };
  const timer = setInterval(poll, symbol.source === "yahoo" ? 20_000 : 600_000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// ---------------------------------------------------------------------------------------------
// 24h tickers (header, watchlist, alerts)

type Binance24h = {
  symbol: string;
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
};

const fromBinance24h = (t: Binance24h): Ticker => {
  const last = Number(t.lastPrice);
  const open = Number(t.openPrice);
  return {
    last,
    open,
    high: Number(t.highPrice),
    low: Number(t.lowPrice),
    volume: Number(t.volume),
    quoteVolume: Number(t.quoteVolume),
    change: last - open,
    changePercent: open ? ((last - open) / open) * 100 : 0,
  };
};

// Snapshot for many symbols at once.
export async function fetchTickers(symbols: CoinSymbol[]): Promise<Map<string, Ticker>> {
  const out = new Map<string, Ticker>();
  const spot = symbols.filter((s) => s.source === "binance");
  const futures = symbols.filter((s) => s.source === "binance-futures");
  const other = symbols.filter((s) => s.source === "yahoo" || s.source === "index");
  await Promise.allSettled([
    (async () => {
      for (let i = 0; i < spot.length; i += 100) {
        const chunk = spot.slice(i, i + 100);
        const list = await binanceSpot<Binance24h[]>(
          `/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(chunk.map((s) => s.ticker)))}`,
        );
        const byTicker = new Map(list.map((t) => [t.symbol, t]));
        chunk.forEach((s) => {
          const t = byTicker.get(s.ticker);
          if (t) out.set(s.id, fromBinance24h(t));
        });
      }
    })(),
    (async () => {
      if (futures.length === 0) return;
      const list =
        futures.length === 1
          ? [await binanceFutures<Binance24h>(`/fapi/v1/ticker/24hr?symbol=${futures[0].ticker}`)]
          : await binanceFutures<Binance24h[]>("/fapi/v1/ticker/24hr");
      const byTicker = new Map(list.map((t) => [t.symbol, t]));
      futures.forEach((s) => {
        const t = byTicker.get(s.ticker);
        if (t) out.set(s.id, fromBinance24h(t));
      });
    })(),
    (async () => {
      if (other.length === 0) return;
      const quotes = await getJson<Record<string, Ticker>>(
        `/api/coinhub/quote?ids=${encodeURIComponent(other.map((s) => s.id).join(","))}`,
      );
      Object.entries(quotes).forEach(([id, t]) => out.set(id, t));
    })(),
  ]);
  return out;
}

type MiniTicker = { c: string; o: string; h: string; l: string; v: string; q: string };

// Live 24h ticker; Yahoo and indexes are polled.
export function subscribeTicker(symbol: CoinSymbol, onTicker: (ticker: Ticker) => void): () => void {
  if (symbol.source === "binance" || symbol.source === "binance-futures") {
    const hub = symbol.source === "binance" ? spotStream : futuresStream;
    return hub.subscribe(`${symbol.ticker.toLowerCase()}@miniTicker`, (data) => {
      const t = data as MiniTicker;
      const last = Number(t.c);
      const open = Number(t.o);
      onTicker({
        last,
        open,
        high: Number(t.h),
        low: Number(t.l),
        volume: Number(t.v),
        quoteVolume: Number(t.q),
        change: last - open,
        changePercent: open ? ((last - open) / open) * 100 : 0,
      });
    });
  }
  let stopped = false;
  const timer = setInterval(
    async () => {
      const map = await fetchTickers([symbol]).catch(() => null);
      const t = map?.get(symbol.id);
      if (t && !stopped) onTicker(t);
    },
    symbol.source === "yahoo" ? 30_000 : 600_000,
  );
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

// ---------------------------------------------------------------------------------------------
// Symbols

let symbolList: Promise<CoinSymbol[]> | null = null;

// Binance spot + perpetuals + indexes, sorted by 24h volume. Loaded once per page.
export function loadSymbols(): Promise<CoinSymbol[]> {
  if (!symbolList) {
    symbolList = getJson<CoinSymbol[]>("/api/coinhub/symbols");
    symbolList.catch(() => (symbolList = null));
  }
  return symbolList;
}

const resolved = new Map<string, Promise<CoinSymbol | null>>();

export function resolveSymbol(id: string): Promise<CoinSymbol | null> {
  let result = resolved.get(id);
  if (!result) {
    result = (async () => {
      if (!id.startsWith("YAHOO:")) {
        const list = await loadSymbols().catch(() => null);
        const found = list?.find((s) => s.id === id);
        if (found) return found;
      }
      return getJson<CoinSymbol>(`/api/coinhub/symbols?id=${encodeURIComponent(id)}`).catch(() => null);
    })();
    resolved.set(id, result);
    result.then((s) => s || resolved.delete(id));
  }
  return result;
}

export function rememberSymbol(symbol: CoinSymbol) {
  resolved.set(symbol.id, Promise.resolve(symbol));
}

export async function searchStocks(q: string, signal?: AbortSignal): Promise<CoinSymbol[]> {
  return getJson<CoinSymbol[]>(`/api/coinhub/search?q=${encodeURIComponent(q)}`, signal).catch(() => []);
}

// Every USDT spot pair's 24h ticker, for the hotlists.
export async function fetchSpotTickers(): Promise<Array<{ ticker: string } & Ticker>> {
  type Mini = {
    symbol: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
  };
  const list = await binanceSpot<Mini[]>("/api/v3/ticker/24hr?type=MINI");
  return list
    .filter((t) => t.symbol.endsWith("USDT"))
    .map((t) => ({ ticker: t.symbol, ...fromBinance24h({ ...t }) }))
    .filter((t) => t.quoteVolume > 0);
}

// REST stand-in for the futures socket when it stays silent (Binance blocks fstream in some
// regions while fapi still answers): the last two klines every 3 s per chart, and the 24h tickers
// every 5 s for the watchlist. The payloads mimic the stream events so subscribers don't care.
function pollFutures(streams: string[], emit: Emit) {
  const klines = streams.flatMap((stream) => {
    const m = /^(\w+)@kline_(\w+)$/.exec(stream);
    return m ? [{ stream, symbol: m[1].toUpperCase(), interval: m[2] }] : [];
  });
  const tickers = new Map(
    streams.flatMap((stream) => {
      const m = /^(\w+)@miniTicker$/.exec(stream);
      return m ? [[m[1].toUpperCase(), stream] as const] : [];
    }),
  );
  let stopped = false;
  const pollKlines = async () => {
    for (const k of klines) {
      if (stopped) return;
      try {
        const rows = await binanceFutures<BinanceKline[]>(
          `/fapi/v1/klines?symbol=${k.symbol}&interval=${k.interval}&limit=2`,
        );
        if (stopped) return;
        for (const row of rows)
          emit(k.stream, { k: { t: row[0], o: row[1], h: row[2], l: row[3], c: row[4], v: row[5] } });
      } catch {
        // Next tick.
      }
    }
  };
  const pollTickers = async () => {
    if (tickers.size === 0) return;
    try {
      // One all-market call costs 40 weight; per-symbol calls cost 1 each.
      const list =
        tickers.size <= 10
          ? await Promise.all(
              [...tickers.keys()].map((symbol) =>
                binanceFutures<Binance24h>(`/fapi/v1/ticker/24hr?symbol=${symbol}`),
              ),
            )
          : await binanceFutures<Binance24h[]>("/fapi/v1/ticker/24hr");
      if (stopped) return;
      for (const t of list) {
        const stream = tickers.get(t.symbol);
        if (stream)
          emit(stream, {
            c: t.lastPrice,
            o: t.openPrice,
            h: t.highPrice,
            l: t.lowPrice,
            v: t.volume,
            q: t.quoteVolume,
          });
      }
    } catch {
      // Next tick.
    }
  };
  void pollKlines();
  void pollTickers();
  const a = setInterval(pollKlines, 3_000);
  const b = setInterval(pollTickers, 5_000);
  return () => {
    stopped = true;
    clearInterval(a);
    clearInterval(b);
  };
}

futuresStream.setPoller(pollFutures);

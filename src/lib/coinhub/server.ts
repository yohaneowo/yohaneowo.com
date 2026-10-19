import "server-only";
import { cacheLife } from "next/cache";
import { indexSymbol, type IndexId } from "./indices";
import type { CoinSymbol, FearGreedPoint, MarketOverview, RawBar, SeriesResponse, SymbolKind } from "./types";

// Upstream data for CoinHub. Everything here is public market data; results are cached with
// `use cache` so many visitors cost one upstream request per cache window.

const DAY = 86_400_000;
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
  accept: "application/json",
};

export class UpstreamError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new UpstreamError(`${res.status} ${new URL(url).host}`);
  return (await res.json()) as T;
}

// Binance blocks some regions on api.binance.com; the public market-data mirror has the same API.
async function getBinanceSpot<T>(path: string): Promise<T> {
  try {
    return await getJson<T>(`https://api.binance.com${path}`);
  } catch {
    return await getJson<T>(`https://data-api.binance.vision${path}`);
  }
}

const num = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const dayStart = (ms: number) => Math.floor(ms / DAY) * DAY;

// "0.00001000" → 5
function decimals(step: string | undefined, fallback: number) {
  if (!step) return fallback;
  const trimmed = step.replace(/0+$/, "");
  const dot = trimmed.indexOf(".");
  return dot < 0 ? 0 : trimmed.length - dot - 1;
}

// Daily values → OHLC bars, opening at the previous close like TradingView's index charts.
function lineToBars(points: Array<[number, number, number?]>): RawBar[] {
  const bars: RawBar[] = [];
  let prev: number | null = null;
  for (const [t, value, volume] of points) {
    const open: number = prev ?? value;
    bars.push([t, open, Math.max(open, value), Math.min(open, value), value, volume ?? 0]);
    prev = value;
  }
  return bars;
}

// Last value per UTC day, sorted.
function byDay(points: Array<[number, number]>) {
  const map = new Map<number, number>();
  for (const [t, v] of points) if (Number.isFinite(v)) map.set(dayStart(t), v);
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

// ---------------------------------------------------------------------------------------------
// Binance symbols

type BinanceFilter = { filterType: string; tickSize?: string; stepSize?: string };
type BinanceSpotInfo = {
  symbols: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    filters: BinanceFilter[];
  }>;
};
type BinanceFuturesInfo = {
  symbols: Array<{
    symbol: string;
    status: string;
    contractType: string;
    baseAsset: string;
    quoteAsset: string;
    pricePrecision: number;
    quantityPrecision: number;
    filters: BinanceFilter[];
  }>;
};
type BinanceTicker = { symbol: string; lastPrice: string; quoteVolume: string };

const STABLES = new Set(["USDT", "USDC", "FDUSD", "TUSD", "USDP", "DAI", "BUSD", "USD1"]);

export async function getBinanceSymbols(): Promise<CoinSymbol[]> {
  "use cache";
  cacheLife("hours");
  const [spotInfo, spotTickers, futuresInfo, futuresTickers] = await Promise.allSettled([
    getBinanceSpot<BinanceSpotInfo>("/api/v3/exchangeInfo?permissions=SPOT&symbolStatus=TRADING"),
    getBinanceSpot<BinanceTicker[]>("/api/v3/ticker/24hr?type=MINI"),
    getJson<BinanceFuturesInfo>("https://fapi.binance.com/fapi/v1/exchangeInfo"),
    getJson<BinanceTicker[]>("https://fapi.binance.com/fapi/v1/ticker/24hr"),
  ]);
  if (spotInfo.status === "rejected") throw spotInfo.reason;

  const spotTickerMap = new Map(
    (spotTickers.status === "fulfilled" ? spotTickers.value : []).map((t) => [t.symbol, t]),
  );
  // Quote volumes in USD, so BTC pairs rank among USDT pairs.
  const usd = (quote: string, quoteVolume: number) => {
    if (STABLES.has(quote)) return quoteVolume;
    const price = num(spotTickerMap.get(`${quote}USDT`)?.lastPrice);
    return price ? quoteVolume * price : 0;
  };

  const symbols: CoinSymbol[] = spotInfo.value.symbols
    .filter((s) => s.status === "TRADING")
    .map((s) => {
      const tick = s.filters.find((f) => f.filterType === "PRICE_FILTER")?.tickSize;
      const step = s.filters.find((f) => f.filterType === "LOT_SIZE")?.stepSize;
      return {
        id: `BINANCE:${s.symbol}`,
        source: "binance",
        ticker: s.symbol,
        display: s.symbol,
        description: `${s.baseAsset} / ${s.quoteAsset}`,
        exchange: "Binance",
        kind: "spot",
        base: s.baseAsset,
        quote: s.quoteAsset,
        pricePrecision: decimals(tick, 2),
        volumePrecision: decimals(step, 4),
        volume: usd(s.quoteAsset, num(spotTickerMap.get(s.symbol)?.quoteVolume) ?? 0),
      };
    });

  if (futuresInfo.status === "fulfilled") {
    const futuresTickerMap = new Map(
      (futuresTickers.status === "fulfilled" ? futuresTickers.value : []).map((t) => [t.symbol, t]),
    );
    for (const s of futuresInfo.value.symbols) {
      if (s.status !== "TRADING" || s.contractType !== "PERPETUAL") continue;
      const tick = s.filters.find((f) => f.filterType === "PRICE_FILTER")?.tickSize;
      symbols.push({
        id: `BINANCE:${s.symbol}.P`,
        source: "binance-futures",
        ticker: s.symbol,
        display: `${s.symbol}.P`,
        description: `${s.baseAsset} / ${s.quoteAsset} Perpetual`,
        exchange: "Binance",
        kind: "perp",
        base: s.baseAsset,
        quote: s.quoteAsset,
        pricePrecision: decimals(tick, s.pricePrecision),
        volumePrecision: s.quantityPrecision,
        volume: usd(s.quoteAsset, num(futuresTickerMap.get(s.symbol)?.quoteVolume) ?? 0),
      });
    }
  }
  return symbols.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

// ---------------------------------------------------------------------------------------------
// CoinMarketCap history (public data API behind coinmarketcap.com charts; 2200 points a request)

const CMC_START = Date.UTC(2013, 3, 29);
const CMC_CHUNK = 1000 * DAY;

function cmcWindows() {
  const windows: Array<[number, number]> = [];
  for (let start = CMC_START; start < Date.now(); start += CMC_CHUNK) {
    windows.push([Math.floor(start / 1000), Math.floor(Math.min(start + CMC_CHUNK, Date.now()) / 1000)]);
  }
  return windows;
}

type CmcGlobalQuote = {
  timestamp: string;
  btcDominance: number;
  ethDominance: number;
  quote: Array<{ totalMarketCap: number; totalVolume24H: number; altcoinMarketCap: number }>;
};

type GlobalDay = { t: number; total: number; volume: number; btcD: number; ethD: number };

async function getCmcGlobal(): Promise<GlobalDay[]> {
  "use cache";
  cacheLife("hours");
  const chunks = await Promise.all(
    cmcWindows().map(([from, to]) =>
      getJson<{ data?: { quotes?: CmcGlobalQuote[] } }>(
        `https://api.coinmarketcap.com/data-api/v3/global-metrics/quotes/historical?format=chart_crypto_details&interval=1d&timeStart=${from}&timeEnd=${to}`,
      ),
    ),
  );
  const days = new Map<number, GlobalDay>();
  for (const chunk of chunks) {
    for (const q of chunk.data?.quotes ?? []) {
      const usd = q.quote?.[0];
      if (!usd?.totalMarketCap) continue;
      const t = dayStart(Date.parse(q.timestamp));
      days.set(t, {
        t,
        total: usd.totalMarketCap,
        volume: usd.totalVolume24H ?? 0,
        btcD: q.btcDominance,
        ethD: q.ethDominance,
      });
    }
  }
  return [...days.values()].sort((a, b) => a.t - b.t);
}

type CmcCoinQuote = {
  timeOpen: string;
  quote: { open: number; high: number; low: number; close: number; volume: number; marketCap: number };
};

// Daily OHLC + market cap for one coin (1 = BTC, 825 = USDT, 3408 = USDC).
async function getCmcCoin(
  id: number,
): Promise<Array<[number, number, number, number, number, number, number]>> {
  "use cache";
  cacheLife("hours");
  const chunks = await Promise.all(
    cmcWindows().map(([from, to]) =>
      getJson<{ data?: { quotes?: CmcCoinQuote[] } }>(
        `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/historical?id=${id}&convertId=2781&timeStart=${from}&timeEnd=${to}&interval=1d`,
      ),
    ),
  );
  const days = new Map<number, [number, number, number, number, number, number, number]>();
  for (const chunk of chunks) {
    for (const { timeOpen, quote: q } of chunk.data?.quotes ?? []) {
      const t = dayStart(Date.parse(timeOpen));
      days.set(t, [t, q.open, q.high, q.low, q.close, q.volume, q.marketCap]);
    }
  }
  return [...days.values()].sort((a, b) => a[0] - b[0]);
}

// ---------------------------------------------------------------------------------------------
// Fear & Greed (alternative.me)

type FngResponse = { data: Array<{ value: string; value_classification: string; timestamp: string }> };

async function getFearGreed(limit: number): Promise<FearGreedPoint[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
  const json = await getJson<FngResponse>(`https://api.alternative.me/fng/?limit=${limit}`);
  return json.data
    .map((d) => ({ t: Number(d.timestamp) * 1000, value: Number(d.value), label: d.value_classification }))
    .filter((d) => Number.isFinite(d.t) && Number.isFinite(d.value))
    .sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------------------------
// Strategy (MSTR)

type StrategyBitcoinKpis = { results: Record<string, unknown> };
type StrategyMstrKpi = Array<Record<string, unknown>>;

async function getStrategyKpis() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  const [btc, mstr] = await Promise.all([
    getJson<StrategyBitcoinKpis>("https://api.strategy.com/btc/bitcoinKpis"),
    getJson<StrategyMstrKpi>("https://api.strategy.com/btc/mstrKpiData"),
  ]);
  return { btc: btc.results, mstr: mstr[0] ?? {} };
}

// Strategy's BTC holdings at quarter ends (from its filings); between known points the count is
// interpolated, and the latest point comes live from strategy.com.
const MSTR_HOLDINGS: Array<[string, number]> = [
  ["2024-06-30", 226_331],
  ["2024-09-30", 252_220],
  ["2024-12-31", 446_400],
  ["2025-03-31", 528_185],
  ["2025-06-30", 597_325],
  ["2025-09-30", 640_031],
  ["2025-12-31", 672_497],
];

function interpolate(points: Array<[number, number]>, t: number) {
  if (points.length === 0) return null;
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
}

type YahooChart = {
  chart: {
    result?: Array<{
      meta: Record<string, unknown>;
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open: Array<number | null>;
          high: Array<number | null>;
          low: Array<number | null>;
          close: Array<number | null>;
          volume: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string } | null;
  };
};

type YahooTimeseries = {
  timeseries: {
    result?: Array<Record<string, Array<{ asOfDate: string; reportedValue: { raw: number } } | null>>>;
  };
};

// cebetracker.io publishes each treasury company's latest filed balance sheet (free with
// attribution). Senior claims = debt + preferred - cash - STRC held; they rank ahead of common stock.
type CebeCompany = Record<string, unknown>;
export type CebeBalance = {
  shares: number;
  holdings: number;
  debt: number;
  preferred: number;
  cash: number;
  strc: number;
  asOf: string | null;
};

async function getCebeBalance(): Promise<CebeBalance | null> {
  "use cache";
  cacheLife("hours");
  try {
    const json = await getJson<{ companies?: CebeCompany[] }>("https://cebetracker.io/api/v1/companies.json");
    const row = json.companies?.find((c) => c.ticker === "MSTR");
    const shares = num(row?.basic_shares);
    const holdings = num(row?.btc_holdings);
    if (!row || !shares || !holdings) return null;
    return {
      shares,
      holdings,
      debt: num(row.debt_usd) ?? 0,
      preferred: num(row.preferred_usd) ?? 0,
      cash: num(row.cash_usd) ?? 0,
      strc: num(row.strc_holdings_usd) ?? 0,
      asOf: typeof row.as_of === "string" ? row.as_of : null,
    };
  } catch {
    return null;
  }
}

// Market cap of the common stock over the BTC value left for it after senior claims.
function netMnav(b: CebeBalance, marketCap: number, btcValue: number) {
  if (!(btcValue > 0)) return null;
  const claims = Math.max(0, b.debt + b.preferred - b.cash - b.strc);
  const ratio = Math.min(0.95, claims / btcValue);
  return marketCap / (btcValue * (1 - ratio));
}

// Enterprise value (market cap + debt + preferred - cash - STRC) over the BTC holdings' value.
function evMnav(b: CebeBalance, marketCap: number, btcValue: number) {
  if (!(btcValue > 0)) return null;
  return (marketCap + b.debt + b.preferred - b.cash - b.strc) / btcValue;
}

type MstrSeries = {
  marketCap: Array<[number, number]>;
  net: Array<[number, number]>;
  ev: Array<[number, number]>;
};

// Daily MSTR mNAV variants. Shares and holdings are interpolated between filings; the senior
// claims use the latest balance sheet for the whole history (cebetracker does the same).
async function getMstrMnav(): Promise<MstrSeries> {
  "use cache";
  cacheLife("hours");
  const [chart, shares, kpis, btc, balance] = await Promise.all([
    getJson<YahooChart>("https://query1.finance.yahoo.com/v8/finance/chart/MSTR?range=5y&interval=1d"),
    getJson<YahooTimeseries>(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/MSTR?type=quarterlyOrdinarySharesNumber&period1=1500000000&period2=${Math.floor(Date.now() / 1000)}`,
    ),
    getStrategyKpis(),
    getCmcCoin(1),
    getCebeBalance(),
  ]);
  const result = chart.chart.result?.[0];
  if (!result?.timestamp) throw new UpstreamError("MSTR chart");

  const sharePoints: Array<[number, number]> = (
    shares.timeseries.result?.[0]?.quarterlyOrdinarySharesNumber ?? []
  )
    .flatMap((p) => (p ? [[Date.parse(p.asOfDate), p.reportedValue.raw] as [number, number]] : []))
    .sort((a, b) => a[0] - b[0]);
  const price = num(kpis.mstr.ufPrice);
  const marketCapMillions = num(kpis.mstr.marketCap);
  if (price && marketCapMillions) sharePoints.push([Date.now(), (marketCapMillions * 1e6) / price]);
  else if (balance) sharePoints.push([Date.now(), balance.shares]);

  const holdingPoints: Array<[number, number]> = MSTR_HOLDINGS.map(([d, v]) => [Date.parse(d), v]);
  const holdingsNow = num(kpis.btc.btcHoldings) ?? balance?.holdings;
  if (holdingsNow) holdingPoints.push([Date.now(), holdingsNow]);

  if (sharePoints.length === 0) throw new UpstreamError("MSTR shares");
  const btcClose = new Map(btc.map((b) => [b[0], b[4]]));
  const closes = result.indicators.quote[0].close;
  const out: MstrSeries = { marketCap: [], net: [], ev: [] };
  result.timestamp.forEach((ts, i) => {
    const t = dayStart(ts * 1000);
    const close = closes[i];
    // Only from the first reported share count; before it the share count is unknown.
    if (close == null || t < dayStart(sharePoints[0][0])) return;
    const btcPrice = btcClose.get(t) ?? btcClose.get(t - DAY);
    const sharesAt = interpolate(sharePoints, t);
    const holdingsAt = interpolate(holdingPoints, t);
    if (!btcPrice || !sharesAt || !holdingsAt) return;
    const marketCap = close * sharesAt;
    const btcValue = holdingsAt * btcPrice;
    out.marketCap.push([t, marketCap / btcValue]);
    if (!balance) return;
    const net = netMnav(balance, marketCap, btcValue);
    const ev = evMnav(balance, marketCap, btcValue);
    if (net !== null) out.net.push([t, net]);
    if (ev !== null) out.ev.push([t, ev]);
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// BTC valuation indexes

// AHR999 = (price / 200-day geometric mean) × (price / growth-curve valuation).
function btcValuation(closes: Array<[number, number]>) {
  const genesis = Date.UTC(2009, 0, 3);
  const ahr: Array<[number, number]> = [];
  const mayer: Array<[number, number]> = [];
  let logSum = 0;
  let sum = 0;
  closes.forEach(([t, close], i) => {
    logSum += Math.log(close);
    sum += close;
    if (i >= 200) {
      logSum -= Math.log(closes[i - 200][1]);
      sum -= closes[i - 200][1];
    }
    if (i < 199) return;
    const geoMean = Math.exp(logSum / 200);
    const age = (t - genesis) / DAY;
    const fitted = 10 ** (5.84 * Math.log10(age) - 17.01);
    ahr.push([t, (close / geoMean) * (close / fitted)]);
    mayer.push([t, close / (sum / 200)]);
  });
  return { ahr, mayer };
}

// ---------------------------------------------------------------------------------------------
// Index series

export async function getIndexSeries(id: IndexId): Promise<SeriesResponse> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 86_400 });
  const symbol = indexSymbol(id);
  let bars: RawBar[] = [];

  switch (id) {
    case "BTC.D":
    case "ETH.D":
    case "TOTAL":
    case "TOTAL2":
    case "TOTAL3": {
      const global = await getCmcGlobal();
      bars = lineToBars(
        global.map((d) => {
          const value =
            id === "BTC.D"
              ? d.btcD
              : id === "ETH.D"
                ? d.ethD
                : id === "TOTAL"
                  ? d.total
                  : id === "TOTAL2"
                    ? d.total * (1 - d.btcD / 100)
                    : d.total * (1 - (d.btcD + d.ethD) / 100);
          return [d.t, value, d.volume];
        }),
      );
      break;
    }
    case "USDT.D":
    case "USDC.D":
    case "STABLE.D":
    case "STABLE.C": {
      const [global, usdt, usdc] = await Promise.all([getCmcGlobal(), getCmcCoin(825), getCmcCoin(3408)]);
      const usdtCap = new Map(usdt.map((d) => [d[0], d[6]]));
      const usdcCap = new Map(usdc.map((d) => [d[0], d[6]]));
      const points: Array<[number, number]> = [];
      for (const d of global) {
        const a = usdtCap.get(d.t) ?? 0;
        const c = usdcCap.get(d.t) ?? 0;
        const cap = id === "USDT.D" ? a : id === "USDC.D" ? c : a + c;
        if (!cap) continue;
        points.push([d.t, id === "STABLE.C" ? cap : (cap / d.total) * 100]);
      }
      bars = lineToBars(points);
      break;
    }
    case "FEAR.GREED": {
      const fng = await getFearGreed(0);
      bars = lineToBars(byDay(fng.map((d) => [d.t, d.value])));
      break;
    }
    case "MSTR.MNAV":
    case "MSTR.MNAV.NET":
    case "MSTR.MNAV.EV": {
      const series = await getMstrMnav();
      bars = lineToBars(
        id === "MSTR.MNAV" ? series.marketCap : id === "MSTR.MNAV.NET" ? series.net : series.ev,
      );
      break;
    }
    case "BTC.AHR999":
    case "BTC.MAYER": {
      const btc = await getCmcCoin(1);
      const { ahr, mayer } = btcValuation(btc.map((d) => [d[0], d[4]]));
      bars = lineToBars(id === "BTC.AHR999" ? ahr : mayer);
      break;
    }
  }
  return { symbol, bars, more: false };
}

// ---------------------------------------------------------------------------------------------
// Yahoo Finance (stocks, ETFs, indexes, FX)

export const YAHOO_INTERVALS = ["1m", "5m", "15m", "30m", "60m", "1d", "1wk", "1mo"] as const;
export type YahooInterval = (typeof YAHOO_INTERVALS)[number];

// How far back one request reaches, and how far back Yahoo keeps the interval at all.
const YAHOO_WINDOW: Record<YahooInterval, { window: number; history: number } | null> = {
  "1m": { window: 7 * DAY, history: 29 * DAY },
  "5m": { window: 30 * DAY, history: 59 * DAY },
  "15m": { window: 30 * DAY, history: 59 * DAY },
  "30m": { window: 30 * DAY, history: 59 * DAY },
  "60m": { window: 365 * DAY, history: 729 * DAY },
  "1d": null,
  "1wk": null,
  "1mo": null,
};

const YAHOO_KIND: Record<string, SymbolKind> = {
  EQUITY: "stock",
  ETF: "etf",
  INDEX: "index",
  MUTUALFUND: "fund",
  CRYPTOCURRENCY: "crypto",
  CURRENCY: "fx",
  FUTURE: "index",
};

function yahooSymbol(meta: Record<string, unknown>, ticker: string): CoinSymbol {
  const hint = num(meta.priceHint);
  return {
    id: `YAHOO:${ticker}`,
    source: "yahoo",
    ticker,
    display: ticker,
    description: String(meta.longName ?? meta.shortName ?? ticker),
    exchange: String(meta.fullExchangeName ?? meta.exchangeName ?? "Yahoo"),
    kind: YAHOO_KIND[String(meta.instrumentType)] ?? "stock",
    quote: typeof meta.currency === "string" ? meta.currency : undefined,
    pricePrecision: hint ?? 2,
    volumePrecision: 0,
  };
}

export async function getYahooSeries(
  ticker: string,
  interval: YahooInterval,
  end: number | null,
): Promise<SeriesResponse> {
  "use cache";
  // The latest window changes every minute; older windows never do.
  if (end === null) cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  else cacheLife("days");
  const limits = YAHOO_WINDOW[interval];
  const now = Date.now();
  const to = end ?? now;
  let query: string;
  let more = false;
  if (limits) {
    const oldest = now - limits.history;
    const from = Math.max(oldest, to - limits.window);
    if (from >= to) return { symbol: yahooSymbol({}, ticker), bars: [], more: false };
    query = `period1=${Math.floor(from / 1000)}&period2=${Math.floor(to / 1000)}`;
    more = from > oldest + DAY;
  } else {
    // range=max thins daily bars out; an explicit period keeps every bar.
    query = `period1=0&period2=${Math.floor(to / 1000)}`;
  }
  const json = await getJson<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&${query}&includePrePost=false`,
  );
  const result = json.chart.result?.[0];
  if (!result) throw new UpstreamError(json.chart.error?.description ?? "yahoo");
  const q = result.indicators.quote[0];
  const bars: RawBar[] = [];
  (result.timestamp ?? []).forEach((ts, i) => {
    const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if (o == null || h == null || l == null || c == null) return;
    const t = ts * 1000;
    if (end !== null && t >= end) return;
    bars.push([t, o, h, l, c, q.volume[i] ?? 0]);
  });
  return { symbol: yahooSymbol(result.meta, ticker), bars, more };
}

type YahooSearch = {
  quotes?: Array<{
    symbol: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchDisp?: string;
  }>;
};

export async function searchYahoo(q: string): Promise<CoinSymbol[]> {
  "use cache";
  cacheLife("hours");
  const json = await getJson<YahooSearch>(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0`,
  );
  return (json.quotes ?? [])
    .filter((x) => x.symbol && x.quoteType && x.quoteType in YAHOO_KIND)
    .map((x) => ({
      id: `YAHOO:${x.symbol}`,
      source: "yahoo" as const,
      ticker: x.symbol,
      display: x.symbol,
      description: x.longname ?? x.shortname ?? x.symbol,
      exchange: x.exchDisp ?? "Yahoo",
      kind: YAHOO_KIND[x.quoteType!],
      pricePrecision: 2,
      volumePrecision: 0,
    }));
}

export async function getYahooSymbol(ticker: string): Promise<CoinSymbol> {
  "use cache";
  cacheLife("hours");
  const json = await getJson<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`,
  );
  const result = json.chart.result?.[0];
  if (!result) throw new UpstreamError(json.chart.error?.description ?? "yahoo");
  return yahooSymbol(result.meta, ticker);
}

// ---------------------------------------------------------------------------------------------
// Dashboard

type CoinGeckoGlobal = {
  data: {
    active_cryptocurrencies: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
  };
};
type PremiumIndex = { symbol: string; markPrice: string; lastFundingRate: string; nextFundingTime: number };
type LongShort = Array<{ longShortRatio: string; longAccount: string; shortAccount: string }>;

const MAJORS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "DOGEUSDT"];

export async function getMarketOverview(): Promise<MarketOverview> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 3600 });
  const [fng, strategy, gecko, premium, btc, cmcGlobal, symbols, balance, usdt, ...rest] =
    await Promise.allSettled([
      getFearGreed(400),
      getStrategyKpis(),
      getJson<CoinGeckoGlobal>("https://api.coingecko.com/api/v3/global"),
      getJson<PremiumIndex[]>("https://fapi.binance.com/fapi/v1/premiumIndex"),
      getCmcCoin(1),
      getCmcGlobal(),
      getBinanceSymbols(),
      getCebeBalance(),
      getCmcCoin(825),
      ...MAJORS.map((s) =>
        getJson<{ openInterest: string }>(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${s}`),
      ),
      ...MAJORS.map((s) =>
        getJson<LongShort>(
          `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${s}&period=5m&limit=1`,
        ),
      ),
    ]);
  const ok = <T>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);

  const fngList = ok(fng) ?? [];
  const at = (daysAgo: number) => fngList[fngList.length - 1 - daysAgo] ?? null;

  const s = ok(strategy);
  const g = ok(gecko)?.data;
  // Binance also lists stock perpetuals (SAMSUNGEM…); keep coins that trade spot too.
  const spotBases = new Set((ok(symbols) ?? []).filter((x) => x.kind === "spot").map((x) => x.base));
  const premiumList = (ok(premium) ?? []).filter(
    (p) => spotBases.size === 0 || spotBases.has(p.symbol.replace(/USDT$/, "")),
  );
  // CoinGecko's volume is sometimes off by orders of magnitude; fall back to CoinMarketCap's.
  const geckoVolume = g?.total_volume.usd ?? null;
  const totalVolume =
    geckoVolume !== null && g && geckoVolume < g.total_market_cap.usd
      ? geckoVolume
      : (ok(cmcGlobal)?.at(-1)?.volume ?? null);
  const markPrices = new Map(premiumList.map((p) => [p.symbol, num(p.markPrice) ?? 0]));
  const oi = rest.slice(0, MAJORS.length);
  const ls = rest.slice(MAJORS.length);

  const btcCloses = (ok(btc) ?? []).map((d) => [d[0], d[4]] as [number, number]);
  const btcPrice = num(s?.btc.ufPrice) ?? markPrices.get("BTCUSDT") ?? null;
  if (btcPrice && btcCloses.length) btcCloses.push([dayStart(Date.now()) + DAY, btcPrice]);
  const valuation = btcCloses.length > 200 ? btcValuation(btcCloses) : null;

  const mstrPrice = num(s?.mstr.ufPrice);
  const marketCap = num(s?.mstr.marketCap);
  const btcNav = num(s?.btc.btcNavNumber);
  const b = ok(balance) ?? null;
  const holdings = num(s?.btc.btcHoldings) ?? b?.holdings ?? null;
  const btcValue = holdings && btcPrice ? holdings * btcPrice : null;
  const marketCapUsd = marketCap ? marketCap * 1e6 : mstrPrice && b ? mstrPrice * b.shares : null;
  // Yesterday's dominance, for the change shown next to today's value.
  const days = ok(cmcGlobal) ?? [];
  const prevDay = days.length >= 2 ? days[days.length - 2] : null;
  const delta = (now: number | null | undefined, prev: number | null | undefined) =>
    now != null && prev != null ? now - prev : null;
  const prevUsdtCap = prevDay ? (ok(usdt) ?? []).find((d) => d[0] === prevDay.t)?.[6] : undefined;
  const prevUsdtD = prevDay && prevUsdtCap ? (prevUsdtCap / prevDay.total) * 100 : null;

  return {
    updatedAt: Date.now(),
    fearGreed: {
      now: at(0),
      yesterday: at(1),
      lastWeek: at(7),
      lastMonth: at(30),
      history: fngList.map((d) => [d.t, d.value]),
    },
    global: {
      totalMarketCap: g?.total_market_cap.usd ?? null,
      totalVolume,
      marketCapChange24h: g?.market_cap_change_percentage_24h_usd ?? null,
      btcDominance: g?.market_cap_percentage.btc ?? null,
      ethDominance: g?.market_cap_percentage.eth ?? null,
      usdtDominance: g?.market_cap_percentage.usdt ?? null,
      usdcDominance: g?.market_cap_percentage.usdc ?? null,
      btcDominanceChange: delta(g?.market_cap_percentage.btc, prevDay?.btcD),
      ethDominanceChange: delta(g?.market_cap_percentage.eth, prevDay?.ethD),
      usdtDominanceChange: delta(g?.market_cap_percentage.usdt, prevUsdtD),
      activeCryptocurrencies: g?.active_cryptocurrencies ?? null,
    },
    strategy: s
      ? {
          mNav: num(s.btc.mNav),
          mNavChangePercent:
            num(s.btc.mNavVarPerc) === null ? null : (s.btc.mNavNeg ? -1 : 1) * num(s.btc.mNavVarPerc)!,
          marketCapMNav: marketCap && btcNav ? marketCap / btcNav : null,
          netMNav: b && marketCapUsd && btcValue ? netMnav(b, marketCapUsd, btcValue) : null,
          evMNav: b && marketCapUsd && btcValue ? evMnav(b, marketCapUsd, btcValue) : null,
          balanceSheetDate: b?.asOf ?? null,
          btcHoldings: holdings,
          btcNav: btcNav ? btcNav * 1e6 : null,
          mstrPrice,
          mstrChangePercent:
            num(s.mstr.priceVarPerc) === null ? null : (s.mstr.negative ? -1 : 1) * num(s.mstr.priceVarPerc)!,
          marketCap: marketCap ? marketCap * 1e6 : null,
          enterpriseValue: num(s.mstr.entVal) ? num(s.mstr.entVal)! * 1e6 : null,
          debt: num(s.mstr.debt) ? num(s.mstr.debt)! * 1e6 : null,
          preferred: num(s.mstr.pref) ? num(s.mstr.pref)! * 1e6 : null,
          satsPerShare: num(s.btc.satsPerShare),
          btcYield: typeof s.mstr.bseAnnualizedString === "string" ? s.mstr.bseAnnualizedString : null,
          amplification: num(s.btc.amplification),
        }
      : null,
    bitcoin: {
      price: btcPrice,
      ath: num(s?.btc.ath),
      drawdownFromAth: num(s?.btc.drawdownFromAth),
      ma200w: num(s?.btc.ma200w),
      realizedPrice: num(s?.btc.realizedPrice),
      // strategy.com reports ETF flows in millions of dollars.
      etfNetFlows7d: num(s?.btc.etfNetFlows7d) === null ? null : num(s?.btc.etfNetFlows7d)! * 1e6,
      etfNetFlows30d: num(s?.btc.etfNetFlows30d) === null ? null : num(s?.btc.etfNetFlows30d)! * 1e6,
      etfBtcHeld: num(s?.btc.etfBtcHeld),
      hashrate: num(s?.btc.hashrate),
      costToMine: num(s?.btc.costToMine),
      futuresBasis3m: num(s?.btc.futuresBasis3m),
      ahr999: valuation?.ahr.at(-1)?.[1] ?? null,
      mayerMultiple: valuation?.mayer.at(-1)?.[1] ?? null,
    },
    derivatives: {
      funding: premiumList
        .filter((p) => p.symbol.endsWith("USDT"))
        .map((p) => ({
          symbol: p.symbol,
          rate: num(p.lastFundingRate) ?? 0,
          markPrice: num(p.markPrice) ?? 0,
          nextFundingTime: p.nextFundingTime,
        }))
        .sort((a, b) => (MAJORS.indexOf(a.symbol) + 1 || 99) - (MAJORS.indexOf(b.symbol) + 1 || 99))
        .slice(0, MAJORS.length)
        .concat(
          premiumList
            .filter((p) => p.symbol.endsWith("USDT") && !MAJORS.includes(p.symbol))
            .map((p) => ({
              symbol: p.symbol,
              rate: num(p.lastFundingRate) ?? 0,
              markPrice: num(p.markPrice) ?? 0,
              nextFundingTime: p.nextFundingTime,
            }))
            .sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate))
            .slice(0, 10),
        ),
      openInterest: MAJORS.flatMap((symbol, i) => {
        const r = ok(oi[i] as PromiseSettledResult<{ openInterest: string }>);
        const amount = num(r?.openInterest);
        const price = markPrices.get(symbol);
        return amount && price ? [{ symbol, value: amount * price }] : [];
      }),
      longShort: MAJORS.flatMap((symbol, i) => {
        const r = ok(ls[i] as PromiseSettledResult<LongShort>)?.[0];
        const ratio = num(r?.longShortRatio);
        return r && ratio
          ? [{ symbol, ratio, long: num(r.longAccount) ?? 0, short: num(r.shortAccount) ?? 0 }]
          : [];
      }),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Quotes for the watchlist (Yahoo and indexes; Binance tickers come from Binance)

export type Quote = {
  last: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  change: number;
  changePercent: number;
};

// The home page's market tile: BTC and ETH over the last 24 hours (Binance), BTC's hourly closes
// for a sparkline, and today's Fear & Greed. Each part is null when its upstream fails.
export type HomeMarket = {
  coins: { symbol: string; price: number; changePercent: number }[];
  btcCloses: number[];
  fearGreed: { value: number; label: string } | null;
};

export async function getHomeMarket(): Promise<HomeMarket> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 3600 });
  const symbols = encodeURIComponent(JSON.stringify(["BTCUSDT", "ETHUSDT"]));
  const [tickers, klines, fng] = await Promise.allSettled([
    getJson<Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>>(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`,
    ),
    getJson<Array<[number, string, string, string, string]>>(
      "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24",
    ),
    getFearGreed(1),
  ]);
  const coins =
    tickers.status === "fulfilled"
      ? tickers.value
          .map((t) => ({
            symbol: t.symbol.replace(/USDT$/, ""),
            price: Number(t.lastPrice),
            changePercent: Number(t.priceChangePercent),
          }))
          .filter((c) => Number.isFinite(c.price) && Number.isFinite(c.changePercent))
      : [];
  const btcCloses =
    klines.status === "fulfilled"
      ? klines.value.map((k) => Number(k[4])).filter((v) => Number.isFinite(v))
      : [];
  const today = fng.status === "fulfilled" ? fng.value.at(-1) : undefined;
  return { coins, btcCloses, fearGreed: today ? { value: today.value, label: today.label } : null };
}

export async function getYahooQuote(ticker: string): Promise<Quote | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  const json = await getJson<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`,
  );
  const meta = json.chart.result?.[0]?.meta;
  const last = num(meta?.regularMarketPrice);
  const prev = num(meta?.chartPreviousClose) ?? num(meta?.previousClose);
  if (!meta || last === null) return null;
  const open = prev ?? last;
  return {
    last,
    open,
    high: num(meta.regularMarketDayHigh) ?? last,
    low: num(meta.regularMarketDayLow) ?? last,
    volume: num(meta.regularMarketVolume) ?? 0,
    quoteVolume: 0,
    change: last - open,
    changePercent: open ? ((last - open) / open) * 100 : 0,
  };
}

export async function getIndexQuote(id: IndexId): Promise<Quote | null> {
  const { bars } = await getIndexSeries(id);
  const last = bars.at(-1);
  const prev = bars.at(-2);
  if (!last) return null;
  const open = prev?.[4] ?? last[1];
  return {
    last: last[4],
    open,
    high: last[2],
    low: last[3],
    volume: last[5],
    quoteVolume: 0,
    change: last[4] - open,
    changePercent: open ? ((last[4] - open) / open) * 100 : 0,
  };
}

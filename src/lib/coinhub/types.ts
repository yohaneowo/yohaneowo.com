// Shared between the CoinHub API routes and the client terminal.

export type SymbolSource = "binance" | "binance-futures" | "yahoo" | "index";

export type SymbolKind = "spot" | "perp" | "stock" | "etf" | "index" | "fund" | "crypto" | "fx";

export interface CoinSymbol {
  // Unique id across sources: "BINANCE:BTCUSDT", "BINANCE:BTCUSDT.P", "YAHOO:MSTR", "INDEX:BTC.D".
  id: string;
  source: SymbolSource;
  // The upstream symbol (BTCUSDT, MSTR, BTC.D).
  ticker: string;
  // What the chart and lists show (BTCUSDT.P for perpetuals, like TradingView).
  display: string;
  description: string;
  exchange: string;
  kind: SymbolKind;
  base?: string;
  quote?: string;
  pricePrecision: number;
  volumePrecision: number;
  // 24h quote volume, only used to rank search results.
  volume?: number;
  // Extra words the symbol search should match (indexes: "fear", "恐惧"…).
  keywords?: string[];
}

// [timestamp, open, high, low, close, volume] — compact on the wire.
export type RawBar = [number, number, number, number, number, number];

export interface SeriesResponse {
  symbol: CoinSymbol;
  bars: RawBar[];
  // True when older bars exist before the first returned one.
  more: boolean;
}

export interface FearGreedPoint {
  t: number;
  value: number;
  label: string;
}

export interface MarketOverview {
  updatedAt: number;
  fearGreed: {
    now: FearGreedPoint | null;
    yesterday: FearGreedPoint | null;
    lastWeek: FearGreedPoint | null;
    lastMonth: FearGreedPoint | null;
    history: Array<[number, number]>;
  };
  global: {
    totalMarketCap: number | null;
    totalVolume: number | null;
    marketCapChange24h: number | null;
    btcDominance: number | null;
    ethDominance: number | null;
    usdtDominance: number | null;
    usdcDominance: number | null;
    // Change versus the previous daily close, in percentage points.
    btcDominanceChange: number | null;
    ethDominanceChange: number | null;
    usdtDominanceChange: number | null;
    activeCryptocurrencies: number | null;
  };
  strategy: {
    mNav: number | null;
    mNavChangePercent: number | null;
    marketCapMNav: number | null;
    // cebetracker.io balance sheet: mNAV net of senior claims, and enterprise-value mNAV.
    netMNav: number | null;
    evMNav: number | null;
    balanceSheetDate: string | null;
    btcHoldings: number | null;
    btcNav: number | null;
    mstrPrice: number | null;
    mstrChangePercent: number | null;
    marketCap: number | null;
    enterpriseValue: number | null;
    debt: number | null;
    preferred: number | null;
    satsPerShare: number | null;
    btcYield: string | null;
    amplification: number | null;
  } | null;
  bitcoin: {
    price: number | null;
    ath: number | null;
    drawdownFromAth: number | null;
    ma200w: number | null;
    realizedPrice: number | null;
    etfNetFlows7d: number | null;
    etfNetFlows30d: number | null;
    etfBtcHeld: number | null;
    hashrate: number | null;
    costToMine: number | null;
    futuresBasis3m: number | null;
    ahr999: number | null;
    mayerMultiple: number | null;
  };
  derivatives: {
    funding: Array<{ symbol: string; rate: number; markPrice: number; nextFundingTime: number }>;
    openInterest: Array<{ symbol: string; value: number }>;
    longShort: Array<{ symbol: string; ratio: number; long: number; short: number }>;
  };
}

import { useSyncExternalStore } from "react";
import type { CoinSymbol } from "./types";

// Posts from the X accounts the owner follows, collected twice a day by a Grok bot into the private
// x-monitor repo (one posts.jsonl per account, index.jsonl for all; format in its SCHEMA.md). The
// site reads index.jsonl server-side (x-posts-server.ts) and the terminal marks each post on the
// candle it was written in, on every chart its symbols stand for. Only the viewers listed in
// X_MONITOR_VIEWERS get them; for everyone else the feature isn't there.

export type XBias = "bullish" | "bearish" | "neutral" | null;
export type XLevelType = "support" | "resistance" | "entry" | "stop" | "target" | "invalidation" | "other";
export type XAction =
  "open_long" | "open_short" | "add" | "take_profit" | "close" | "stop_hit" | "hold" | "none";

export interface XPost {
  id: string;
  account: string;
  // The account's folder in the repo (lower case), a stable key for filters.
  folder: string;
  url: string;
  // When it was posted, ms.
  time: number;
  text: string;
  // One line in Traditional Chinese (machine-written).
  summary: string;
  lang: string | null;
  // TradingView-style symbols (BINANCE:BTCUSDT, TVC:GOLD, NASDAQ:TSLA…) and plain names beside them.
  symbols: string[];
  assets: string[];
  stance: Array<{ symbol: string; bias: XBias }>;
  levels: Array<{ symbol: string; type: XLevelType; price: number; note: string }>;
  timeframe: string | null;
  action: XAction;
  // Repo-relative paths; shown through /api/coinhub/posts/image.
  images: string[];
  hasVideo: boolean;
  quotedId: string | null;
  replyTo: string | null;
}

// ── Symbols ───────────────────────────────────────────────────────────────────────────────────
// The bot names symbols the TradingView way; the terminal's charts are Binance pairs, Yahoo tickers
// and its own indexes. Both sides become a key and posts go on the charts with the same key: a coin
// against a dollar stablecoin is one key whatever the exchange, pair or contract (a BTC post shows
// on BTCUSDT, BTCUSDC and BTCUSDT.P alike).

const STABLES = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "USD"];

function stableBase(ticker: string): string | null {
  for (const quote of STABLES)
    if (ticker.length > quote.length && ticker.endsWith(quote)) return ticker.slice(0, -quote.length);
  return null;
}

// TradingView names whose Yahoo (or index) chart isn't the same ticker.
const SPECIAL: Record<string, string> = {
  "TVC:GOLD": "YAHOO:GC=F",
  "OANDA:XAUUSD": "YAHOO:GC=F",
  "TVC:SILVER": "YAHOO:SI=F",
  "OANDA:XAGUSD": "YAHOO:SI=F",
  "TVC:USOIL": "YAHOO:CL=F",
  "TVC:UKOIL": "YAHOO:BZ=F",
  "TVC:DXY": "YAHOO:DX-Y.NYB",
  "TVC:US10Y": "YAHOO:^TNX",
  "SP:SPX": "YAHOO:^GSPC",
  "TVC:SPX": "YAHOO:^GSPC",
  "NASDAQ:IXIC": "YAHOO:^IXIC",
  "NASDAQ:NDX": "YAHOO:^NDX",
  "TVC:NDX": "YAHOO:^NDX",
  "DJ:DJI": "YAHOO:^DJI",
  "TVC:DJI": "YAHOO:^DJI",
  "TVC:VIX": "YAHOO:^VIX",
  "CBOE:VIX": "YAHOO:^VIX",
  "TVC:HSI": "YAHOO:^HSI",
  "TVC:NI225": "YAHOO:^N225",
  "SSE:000001": "YAHOO:000001.SS",
};
const STOCK_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX", "ARCA", "NYSEARCA", "BATS", "CBOE"]);

// The chart key of a post's symbol.
export function postSymbolKey(tradingView: string): string | null {
  const id = tradingView.trim().toUpperCase();
  if (SPECIAL[id]) return SPECIAL[id];
  const [exchange, ticker] = id.split(":");
  if (!ticker) return null;
  if (exchange === "CRYPTOCAP") return `INDEX:${ticker}`;
  if (STOCK_EXCHANGES.has(exchange)) return `YAHOO:${ticker}`;
  if (exchange === "TWSE") return `YAHOO:${ticker}.TW`;
  if (exchange === "HKEX") return `YAHOO:${ticker.padStart(4, "0")}.HK`;
  const plain = ticker.replace(/\.P$/, "");
  const base = stableBase(plain);
  return base ? `COIN:${base}` : `PAIR:${plain}`;
}

// The key of a chart's symbol.
export function chartSymbolKey(symbol: CoinSymbol): string {
  if (symbol.source === "binance" || symbol.source === "binance-futures") {
    const base = stableBase(symbol.ticker);
    return base ? `COIN:${base}` : `PAIR:${symbol.ticker}`;
  }
  return symbol.id.toUpperCase();
}

// Whether a post is about the chart's symbol, and the author's view of it there.
export function postOnChart(post: XPost, key: string): { on: boolean; bias: XBias } {
  const i = post.symbols.findIndex((s) => postSymbolKey(s) === key);
  if (i < 0) return { on: false, bias: null };
  const stance = post.stance.find((s) => postSymbolKey(s.symbol) === key);
  return { on: true, bias: stance?.bias ?? null };
}

// The price levels a post gives for the chart's symbol.
export function postLevels(post: XPost, key: string) {
  return post.levels.filter((l) => postSymbolKey(l.symbol) === key && Number.isFinite(l.price));
}

// ── Accounts ──────────────────────────────────────────────────────────────────────────────────

// Two letters for an account's marks: the starts of its first two words (KayonTai → KT,
// Patrade_Buer → PB, CryptoBullet1 → CB), else its first two letters.
export function accountTag(handle: string): string {
  const words = handle
    .replace(/\d+$/, "")
    .split(/[_\-.]+|(?<=[a-z])(?=[A-Z])/)
    .filter(Boolean);
  const tag = words.length > 1 ? words[0][0] + words[1][0] : handle.slice(0, 2);
  return tag.toUpperCase();
}

// A colour per account for its avatar in the list (the marks on the chart are coloured by the
// post's view instead).
const ACCOUNT_COLORS = [
  "#2962ff",
  "#9c27b0",
  "#ff9800",
  "#00bcd4",
  "#e91e63",
  "#795548",
  "#607d8b",
  "#3f51b5",
];

export function accountColor(folder: string): string {
  let h = 0;
  for (const c of folder) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCOUNT_COLORS[h % ACCOUNT_COLORS.length];
}

export const BIAS_COLORS: Record<"bullish" | "bearish" | "neutral", string> = {
  bullish: "#089981",
  bearish: "#f23645",
  neutral: "#787b86",
};

export function biasColor(bias: XBias) {
  return BIAS_COLORS[bias ?? "neutral"];
}

export const LEVEL_COLORS: Record<XLevelType, string> = {
  support: "#089981",
  entry: "#089981",
  resistance: "#f23645",
  stop: "#f23645",
  invalidation: "#f23645",
  target: "#2962ff",
  other: "#787b86",
};

export const postImageUrl = (path: string) => `/api/coinhub/posts/image?p=${encodeURIComponent(path)}`;

// ── Store ─────────────────────────────────────────────────────────────────────────────────────

export interface XPostsState {
  // off: the visitor isn't a viewer (or the site has no token): no panel, no marks.
  status: "idle" | "loading" | "ready" | "off" | "error";
  posts: XPost[];
  at: number;
  // Posts to point out in the panel (a mark on the chart was clicked).
  highlight: string[];
  // The post whose levels are drawn on the charts.
  selected: string | null;
}

let state: XPostsState = { status: "idle", posts: [], at: 0, highlight: [], selected: null };
const listeners = new Set<() => void>();

export const xPosts = {
  get: () => state,
  set(patch: Partial<XPostsState> | ((s: XPostsState) => Partial<XPostsState>)) {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useXPosts<T>(selector: (s: XPostsState) => T): T {
  return useSyncExternalStore(
    xPosts.subscribe,
    () => selector(xPosts.get()),
    () => selector(xPosts.get()),
  );
}

// The bot updates the repo twice a day; the server keeps it ten minutes. Loaded when the terminal
// opens and again from the panel.
const TTL = 10 * 60_000;

export async function loadXPosts(force = false) {
  const s = xPosts.get();
  if (s.status === "loading" || s.status === "off") return;
  if (!force && s.status === "ready" && Date.now() - s.at < TTL) return;
  xPosts.set({ status: "loading" });
  try {
    const response = await fetch("/api/coinhub/posts");
    const result = (await response.json().catch(() => null)) as { data?: XPost[] | null } | null;
    if (!response.ok || !result) throw new Error(`HTTP ${response.status}`);
    if (!result.data) xPosts.set({ status: "off", posts: [] });
    else xPosts.set({ status: "ready", posts: result.data, at: Date.now() });
  } catch {
    xPosts.set({ status: s.posts.length ? "ready" : "error" });
  }
}

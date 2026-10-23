"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CoinSymbol } from "./types";

// The terminal's view of the user's exchange accounts (admin reads them in the background, see
// trade-admin.ts): what's connected, the balances, positions and bots, and the fills the charts
// mark. Amounts come as decimal strings and stay strings until they're shown.

export type TradeExchange = "binance" | "bybit" | "pionex";
export const EXCHANGES: TradeExchange[] = ["binance", "bybit", "pionex"];
export const EXCHANGE_NAMES: Record<TradeExchange, string> = {
  binance: "Binance",
  bybit: "Bybit",
  pionex: "Pionex",
};

// spot; coinm = coin-margined contracts (Binance COIN-M, Bybit inverse); usdm = USDⓈ-margined
// contracts (Bybit linear, Pionex futures); stock = Binance Stocks.
export type TradeProduct = "spot" | "coinm" | "usdm" | "stock";

export const isContract = (product: TradeProduct) => product === "coinm" || product === "usdm";

export interface TradeSync {
  product: TradeProduct;
  symbol: string;
  source: "balance" | "position" | "income" | "manual" | "stock" | "stream";
  count: number;
  backfilled: boolean;
  oldestTime: number | null;
  newestTime: number | null;
  lastOkAt: number | null;
  lastError: string | null;
}

export interface TradeConnection {
  id: number;
  exchange: TradeExchange;
  label: string;
  keyTail: string;
  permissions: Record<string, boolean>;
  tracked: Array<{ product: TradeProduct; symbol: string }>;
  status: "ok" | "error" | "disabled";
  lastError: string | null;
  createdAt: number | null;
  lastSyncAt: number | null;
  syncs: TradeSync[];
}

// Binance: spot, funding, earn, coinm. Bybit: unified (spot and contracts together), funding,
// earn. Pionex: spot (the trading account), usdm (the futures account), bot (what the bots hold),
// earn.
export type TradeWallet = "spot" | "funding" | "earn" | "coinm" | "usdm" | "unified" | "bot";

export interface TradeBalance {
  wallet: TradeWallet;
  asset: string;
  free: string;
  locked: string;
  total: string;
  unrealized: string | null;
  updatedAt: number | null;
}

export interface TradePosition {
  product: TradeProduct;
  symbol: string;
  positionSide: string;
  qty: string;
  entryPrice: string | null;
  markPrice: string | null;
  unrealizedPnl: string | null;
  liquidationPrice: string | null;
  breakEvenPrice: string | null;
  leverage: number | null;
  marginType: string | null;
  updatedAt: number | null;
}

// A trading bot (Pionex grids and smart copy): what it was given, what it holds and what it made.
export interface TradeBot {
  id: string;
  type: "futures_grid" | "future_hedge_grid" | "spot_grid" | "smart_copy" | string;
  name: string;
  symbol: string;
  base: string;
  quote: string;
  status: "running" | "finished";
  state: string | null;
  reason: string | null;
  side: "long" | "short" | "neutral" | null;
  leverage: number | null;
  investment: string | null;
  margin: string | null;
  qty: string | null;
  entryPrice: string | null;
  gridProfit: string | null;
  realizedPnl: string | null;
  fee: string | null;
  funding: string | null;
  pairs: number | null;
  top: string | null;
  bottom: string | null;
  rows: number | null;
  liquidationPrice: string | null;
  createdAt: number | null;
  closedAt: number | null;
  updatedAt: number | null;
}

export interface TradeFill {
  id: string;
  orderId: string;
  product: TradeProduct;
  symbol: string;
  time: number;
  side: "BUY" | "SELL";
  price: string;
  qty: string;
  quoteQty: string;
  fee: string;
  feeAsset: string;
  maker: boolean;
  realizedPnl: string | null;
  positionSide: string | null;
}

export class TradeApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export async function tradeApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`/api/coinhub/trade/${path}`, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const result = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
  if (!response.ok || !result || result.error)
    throw new TradeApiError(result?.error ?? `HTTP ${response.status}`, response.status);
  return result.data as T;
}

// ── Store ─────────────────────────────────────────────────────────────────────────────────────

export interface TradeWallets {
  balances: TradeBalance[];
  positions: TradePosition[];
  bots: TradeBot[];
  at: number;
}

export interface TradeState {
  // null until the first load; false when the visitor isn't signed in.
  signedIn: boolean | null;
  connections: TradeConnection[] | null;
  loading: boolean;
  error: string | null;
  // The connection the panel shows (the first one unless chosen).
  selected: number | null;
  wallets: Record<number, TradeWallets>;
  // Fills by connection, product and symbol; all of a symbol's fills, oldest first.
  fills: Record<string, { rows: TradeFill[]; at: number }>;
  ip: string | null;
  // USD prices of the wallet assets and USD exchange rates (api/coinhub/valuation), a minute old at most.
  valuation: { prices: Record<string, number>; rates: Record<string, number>; at: number } | null;
  // The panel's tab, switched to the fills when a mark on the chart is clicked.
  tab: "overview" | "wallets" | "fills" | "sync";
  // Fills to point out in the list (a mark on the chart was clicked).
  highlight: string[];
}

let state: TradeState = {
  signedIn: null,
  connections: null,
  loading: false,
  error: null,
  selected: null,
  wallets: {},
  fills: {},
  ip: null,
  valuation: null,
  tab: "overview",
  highlight: [],
};
const listeners = new Set<() => void>();

export const trade = {
  get: () => state,
  set(patch: Partial<TradeState> | ((s: TradeState) => Partial<TradeState>)) {
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

export function useTrade<T>(selector: (s: TradeState) => T): T {
  return useSyncExternalStore(
    trade.subscribe,
    () => selector(trade.get()),
    () => selector(trade.get()),
  );
}

export const fillsKey = (connection: number, product: TradeProduct, symbol: string) =>
  `${connection}:${product}:${symbol}`;

const WALLET_TTL = 60_000;
const FILLS_TTL = 60_000;

export async function loadConnections(): Promise<TradeConnection[] | null> {
  trade.set({ loading: true, error: null });
  try {
    const rows = await tradeApi<TradeConnection[] | null>("connections");
    if (rows === null) {
      // Not signed in.
      trade.set({ signedIn: false, connections: [], loading: false });
      return null;
    }
    trade.set((s) => ({
      signedIn: true,
      connections: rows,
      loading: false,
      selected: rows.some((c) => c.id === s.selected) ? s.selected : (rows[0]?.id ?? null),
    }));
    return rows;
  } catch (error) {
    const code = error instanceof TradeApiError ? error.code : "unavailable";
    trade.set({
      loading: false,
      signedIn: error instanceof TradeApiError && error.status === 401 ? false : trade.get().signedIn,
      error: code === "unauthorized" ? null : code,
      connections: code === "unauthorized" ? [] : trade.get().connections,
    });
    return null;
  }
}

function putConnection(row: TradeConnection) {
  trade.set((s) => ({
    connections: (s.connections ?? []).some((c) => c.id === row.id)
      ? (s.connections ?? []).map((c) => (c.id === row.id ? row : c))
      : [...(s.connections ?? []), row],
  }));
}

export async function connectExchange(form: {
  exchange: TradeExchange;
  label: string;
  apiKey: string;
  apiSecret: string;
}) {
  const row = await tradeApi<TradeConnection>("connections", { method: "POST", body: form });
  putConnection(row);
  trade.set({ selected: row.id, signedIn: true });
  return row;
}

export async function disconnectExchange(id: number) {
  await tradeApi(`connections/${id}`, { method: "DELETE" });
  trade.set((s) => {
    const connections = (s.connections ?? []).filter((c) => c.id !== id);
    const wallets = { ...s.wallets };
    delete wallets[id];
    const fills = Object.fromEntries(Object.entries(s.fills).filter(([key]) => !key.startsWith(`${id}:`)));
    return {
      connections,
      wallets,
      fills,
      selected: s.selected === id ? (connections[0]?.id ?? null) : s.selected,
    };
  });
}

export async function refreshConnection(id: number) {
  putConnection(await tradeApi<TradeConnection>(`connections/${id}/refresh`, { method: "POST" }));
}

export async function setTracked(
  id: number,
  add: Array<{ product: TradeProduct; symbol: string }>,
  remove: Array<{ product: TradeProduct; symbol: string }>,
) {
  putConnection(
    await tradeApi<TradeConnection>(`connections/${id}/tracked`, { method: "PUT", body: { add, remove } }),
  );
}

export async function loadWallets(id: number, force = false) {
  const have = trade.get().wallets[id];
  if (!force && have && Date.now() - have.at < WALLET_TTL) return have;
  const data = await tradeApi<{ balances: TradeBalance[]; positions: TradePosition[]; bots?: TradeBot[] }>(
    `connections/${id}/balances`,
  );
  const entry: TradeWallets = { ...data, bots: data.bots ?? [], at: Date.now() };
  trade.set((s) => ({ wallets: { ...s.wallets, [id]: entry } }));
  return entry;
}

const inflight = new Map<string, Promise<TradeFill[]>>();

export function loadFills(
  id: number,
  product: TradeProduct,
  symbol: string,
  force = false,
): Promise<TradeFill[]> {
  const key = fillsKey(id, product, symbol);
  const have = trade.get().fills[key];
  if (!force && have && Date.now() - have.at < FILLS_TTL) return Promise.resolve(have.rows);
  const pending = inflight.get(key);
  if (pending) return pending;
  const query = new URLSearchParams({ product, symbol, limit: "5000" });
  const promise = tradeApi<{ fills: TradeFill[] }>(`connections/${id}/fills?${query}`)
    .then(({ fills }) => {
      trade.set((s) => ({ fills: { ...s.fills, [key]: { rows: fills, at: Date.now() } } }));
      return fills;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

const VALUATION_TTL = 60_000;
let valuedAssets = "";

// Prices and rates for these assets; asked again when the assets change or a minute has passed.
export async function loadValuation(assets: string[]) {
  const key = assets.join(",");
  const have = trade.get().valuation;
  if (have && key === valuedAssets && Date.now() - have.at < VALUATION_TTL) return have;
  const response = await fetch(`/api/coinhub/valuation?assets=${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { prices: Record<string, number>; rates: Record<string, number> };
  const entry = { prices: data.prices, rates: data.rates, at: Date.now() };
  valuedAssets = key;
  trade.set({ valuation: entry });
  return entry;
}

export async function loadIp() {
  if (trade.get().ip) return trade.get().ip;
  try {
    const { ip } = await tradeApi<{ ip: string }>("ip");
    trade.set({ ip });
    return ip;
  } catch {
    return null;
  }
}

// ── Which fills belong on a chart ─────────────────────────────────────────────────────────────

export interface FillSource {
  product: TradeProduct;
  symbol: string;
}

// The exchange symbols whose fills a chart symbol shows, for an account at this exchange. The
// charts are Binance's (and Yahoo's), so another exchange's symbols are matched by base and quote:
// prices in USDT ≈ USD ≈ USDC, close enough for marks.
// - Binance: a spot chart has its own spot fills and the COIN-M perpetual of its base; a perpetual
//   chart the COIN-M perpetual; a Yahoo stock chart its Binance Stocks fills. Binance's tokenized
//   stocks (MSTRB) are their own symbols: no mapping to the stock they track.
// - Bybit: spot BTCUSDT, the USDT perpetual BTCUSDT (usdm) and the inverse perpetual BTCUSD (coinm).
// - Pionex: spot BTC_USDT and the perpetual BTC_USDT_PERP (usdm).
export function fillSources(symbol: CoinSymbol, exchange: TradeExchange = "binance"): FillSource[] {
  const base = symbol.base;
  const quote = symbol.quote ?? "USDT";
  if (exchange === "binance") {
    if (symbol.source === "binance") {
      const out: FillSource[] = [{ product: "spot", symbol: symbol.ticker }];
      if (base) out.push({ product: "coinm", symbol: `${base}USD_PERP` });
      return out;
    }
    if (symbol.source === "binance-futures" && base) return [{ product: "coinm", symbol: `${base}USD_PERP` }];
    if (symbol.source === "yahoo" && (symbol.kind === "stock" || symbol.kind === "etf"))
      return [{ product: "stock", symbol: symbol.ticker }];
    return [];
  }
  if (!base || (symbol.source !== "binance" && symbol.source !== "binance-futures")) return [];
  if (exchange === "bybit") {
    const out: FillSource[] = [];
    if (symbol.source === "binance") out.push({ product: "spot", symbol: `${base}${quote}` });
    out.push({ product: "usdm", symbol: `${base}${quote}` }, { product: "coinm", symbol: `${base}USD` });
    return out;
  }
  const out: FillSource[] = [];
  if (symbol.source === "binance") out.push({ product: "spot", symbol: `${base}_${quote}` });
  out.push({ product: "usdm", symbol: `${base}_${quote}_PERP` });
  return out;
}

// The wallet asset behind a chart: the base, or EQ_<ticker> for a stock.
export function holdingAsset(symbol: CoinSymbol): string | null {
  if (symbol.source === "yahoo") return `EQ_${symbol.ticker}`;
  return symbol.base ?? null;
}

// The base coin of an exchange symbol of any of the three formats: BTCUSDT, BTCUSD_PERP, BTCUSD,
// BTC_USDT, BTC_USDT_PERP.
export function symbolBase(symbol: string): string {
  if (symbol.includes("_")) return symbol.split("_")[0];
  return symbol.replace(/(USDT|USDC|USD|BUSD|FDUSD|PERP)+$/, "");
}

const EMPTY: TradeFill[] = [];

// The fills a chart marks (oldest first), loaded when the connection or symbol changes and cached
// a minute.
export function useChartFills(symbol: CoinSymbol | null, connection: number | null): TradeFill[] {
  const exchange = useTrade(
    (s) => s.connections?.find((c) => c.id === connection)?.exchange ?? ("binance" as TradeExchange),
  );
  const sources = useMemo(() => (symbol ? fillSources(symbol, exchange) : []), [symbol, exchange]);
  const keys = useMemo(
    () => (connection === null ? [] : sources.map((s) => fillsKey(connection, s.product, s.symbol))),
    [connection, sources],
  );
  useEffect(() => {
    if (connection === null) return;
    for (const s of sources) loadFills(connection, s.product, s.symbol).catch(() => {});
  }, [connection, sources]);
  // Changes whenever any of these fills are (re)loaded.
  const version = useTrade((s) => keys.map((k) => s.fills[k]?.at ?? 0).join(","));
  return useMemo(() => {
    const sets = keys.map((k) => trade.get().fills[k]?.rows ?? EMPTY);
    if (sets.length === 1) return sets[0];
    const all = sets.flat();
    return all.length ? all.sort((a, b) => a.time - b.time) : EMPTY;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` stands for the store's fills
  }, [keys, version]);
}

// The average cost of what's still held after these spot / stock fills (oldest first): buys move
// the average, sells take quantity out at it; null when nothing is held. Fees aren't counted.
export function costBasis(fills: TradeFill[]): { qty: number; avg: number } | null {
  let qty = 0;
  let avg = 0;
  for (const f of fills) {
    if (isContract(f.product)) continue;
    const q = Number(f.qty);
    const price = Number(f.price);
    if (!(q > 0) || !(price > 0)) continue;
    if (f.side === "BUY") {
      avg = (avg * qty + price * q) / (qty + q);
      qty += q;
    } else {
      qty = Math.max(0, qty - q);
      if (qty === 0) avg = 0;
    }
  }
  return qty > 1e-12 && avg > 0 ? { qty, avg } : null;
}

// A decimal string for display: at most `max` decimals, no trailing zeros, thousands separators
// on the integer part.
export function fmtDec(value: string | null | undefined, max = 8): string {
  if (value === null || value === undefined || value === "") return "–";
  const negative = value.startsWith("-");
  const [int, frac = ""] = (negative ? value.slice(1) : value).split(".");
  const decimals = frac.slice(0, max).replace(/0+$/, "");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${decimals ? `.${decimals}` : ""}`;
}

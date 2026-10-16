"use client";

import { useEffect, useState } from "react";
import { fetchTickers, subscribeTicker, type Ticker } from "./datafeed";
import type { CoinSymbol } from "./types";

// Shared live 24h tickers: the watchlist, symbol details, alerts and paper trading all watch the
// same symbols, so each symbol gets one subscription however many places use it.

type Listener = (ticker: Ticker) => void;

const latest = new Map<string, Ticker>();
const listeners = new Map<string, Set<Listener>>();
const live = new Map<string, () => void>();
let pending: CoinSymbol[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function publish(id: string, ticker: Ticker) {
  latest.set(id, ticker);
  listeners.get(id)?.forEach((l) => l(ticker));
}

function flush() {
  flushTimer = null;
  const batch = pending;
  pending = [];
  fetchTickers(batch)
    .then((map) => map.forEach((ticker, id) => publish(id, ticker)))
    .catch(() => {});
}

export function watchTicker(symbol: CoinSymbol, listener: Listener) {
  let set = listeners.get(symbol.id);
  if (!set) listeners.set(symbol.id, (set = new Set()));
  set.add(listener);
  const known = latest.get(symbol.id);
  if (known) listener(known);
  if (!live.has(symbol.id)) {
    live.set(
      symbol.id,
      subscribeTicker(symbol, (ticker) => publish(symbol.id, ticker)),
    );
    pending.push(symbol);
    if (!flushTimer) flushTimer = setTimeout(flush, 30);
  }
  return () => {
    set.delete(listener);
    if (set.size > 0) return;
    listeners.delete(symbol.id);
    // Keep the stream a little: switching back and forth is common.
    setTimeout(() => {
      if (listeners.has(symbol.id)) return;
      live.get(symbol.id)?.();
      live.delete(symbol.id);
    }, 10_000);
  };
}

export function getTicker(id: string) {
  return latest.get(id) ?? null;
}

export function useTicker(symbol: CoinSymbol | null) {
  const [state, setState] = useState<{ id: string; ticker: Ticker } | null>(null);
  useEffect(() => {
    if (!symbol) return;
    return watchTicker(symbol, (ticker) => setState({ id: symbol.id, ticker }));
  }, [symbol]);
  if (!symbol) return null;
  return state?.id === symbol.id ? state.ticker : (latest.get(symbol.id) ?? null);
}

"use client";

import { useEffect, useState } from "react";
import { resolveSymbol } from "@/lib/coinhub/datafeed";
import { useTerminal } from "@/lib/coinhub/store";
import type { CoinSymbol } from "@/lib/coinhub/types";

// Symbols for a list of ids (watchlist, alerts, positions), resolved once each.
export function useResolved(ids: string[]) {
  const [map, setMap] = useState<Record<string, CoinSymbol>>({});
  const key = ids.join(",");
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      key
        .split(",")
        .filter(Boolean)
        .map((id) => resolveSymbol(id)),
    ).then((list) => {
      if (cancelled) return;
      setMap(Object.fromEntries(list.flatMap((s) => (s ? [[s.id, s]] : []))));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return map;
}

// The active chart's index, symbol id and resolved symbol.
export function useActiveSymbol() {
  const active = useTerminal((s) => s.active);
  const symbolId = useTerminal((s) => s.charts[s.active].symbolId);
  const [state, setState] = useState<{ id: string; symbol: CoinSymbol | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveSymbol(symbolId).then((symbol) => !cancelled && setState({ id: symbolId, symbol }));
    return () => {
      cancelled = true;
    };
  }, [symbolId]);
  return { active, symbolId, symbol: state?.id === symbolId ? state.symbol : null };
}

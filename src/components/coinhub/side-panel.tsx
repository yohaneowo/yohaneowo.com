"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlarmClockIcon,
  DatabaseIcon,
  FlameIcon,
  InfoIcon,
  ListIcon,
  ListTreeIcon,
  PanelRightCloseIcon,
  PlusIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import { fmtCompact, fmtNumber, fmtPercent, fmtPrice } from "@/lib/coinhub/format";
import { setChartSymbol, setState, useTerminal, type SidePanel as Panel } from "@/lib/coinhub/store";
import { useTicker } from "@/lib/coinhub/tickers";
import type { CoinSymbol } from "@/lib/coinhub/types";
import { AlertsPanel } from "./alerts-panel";
import { HotlistsPanel } from "./hotlists-panel";
import { DataWindow, ObjectTree } from "./objects-panel";
import { useActiveSymbol, useResolved } from "./hooks";
import { TradingPanel } from "./trading-panel";
import { openDialog } from "./ui-store";

function WatchRow({ id, symbol, active }: { id: string; symbol: CoinSymbol | undefined; active: boolean }) {
  const { t } = useLocale();
  const ticker = useTicker(symbol ?? null);
  const activeChart = useTerminal((s) => s.active);
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (!ticker) return;
    const last = prev.current;
    prev.current = ticker.last;
    if (last === null || last === ticker.last) return;
    const dir = ticker.last > last ? "up" : "down";
    const start = setTimeout(() => setFlash(dir), 0);
    const end = setTimeout(() => setFlash(null), 600);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [ticker]);
  const up = (ticker?.change ?? 0) >= 0;
  const precision = symbol && symbol.source !== "yahoo" ? symbol.pricePrecision : undefined;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setChartSymbol(activeChart, id)}
      onKeyDown={(e) => e.key === "Enter" && setChartSymbol(activeChart, id)}
      className={cn(
        "group/row grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/60",
        active && "bg-primary/10",
      )}
    >
      <div className="min-w-0">
        <div className="truncate font-medium">{symbol?.display ?? id.split(":")[1]}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {symbol ? `${symbol.exchange} · ${t.coinhub.symbols.kinds[symbol.kind] ?? symbol.kind}` : ""}
        </div>
      </div>
      <div
        className={cn(
          "text-right tabular-nums transition-colors",
          flash === "up" && "text-[#089981]",
          flash === "down" && "text-[#f23645]",
        )}
      >
        {ticker ? fmtPrice(ticker.last, precision) : "—"}
      </div>
      <div className="flex w-16 items-center justify-end">
        <span
          className={cn(
            "tabular-nums group-hover/row:hidden",
            ticker && (up ? "text-[#089981]" : "text-[#f23645]"),
          )}
        >
          {ticker ? fmtPercent(ticker.changePercent) : ""}
        </span>
        <button
          type="button"
          className="hidden rounded p-0.5 text-muted-foreground group-hover/row:block hover:bg-background hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setState((s) => ({ watchlist: s.watchlist.filter((w) => w !== id) }));
          }}
          aria-label={t.coinhub.panels.remove}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function Watchlist() {
  const { t } = useLocale();
  const p = t.coinhub.panels;
  const watchlist = useTerminal((s) => s.watchlist);
  const { symbolId } = useActiveSymbol();
  const symbols = useResolved(watchlist);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">{p.watchlist}</span>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => openDialog({ type: "symbol", mode: "watchlist" })}
          aria-label={p.addSymbol}
        >
          <PlusIcon />
        </Button>
      </div>
      <div className="grid shrink-0 grid-cols-[1fr_auto_auto] gap-2 px-3 py-1 text-[10px] text-muted-foreground uppercase">
        <span>{p.symbol}</span>
        <span className="text-right">{p.last}</span>
        <span className="w-16 text-right">{p.changePercent}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {watchlist.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{p.empty}</p>
        )}
        {watchlist.map((id) => (
          <WatchRow key={id} id={id} symbol={symbols[id]} active={id === symbolId} />
        ))}
      </ScrollArea>
    </div>
  );
}

function tradingViewUrl(symbol: CoinSymbol) {
  if (symbol.source === "binance")
    return `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol.ticker}`;
  if (symbol.source === "binance-futures")
    return `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol.ticker}.P`;
  if (symbol.source === "yahoo") return `https://www.tradingview.com/chart/?symbol=${symbol.ticker}`;
  const map: Record<string, string> = {
    "BTC.D": "CRYPTOCAP:BTC.D",
    "ETH.D": "CRYPTOCAP:ETH.D",
    "USDT.D": "CRYPTOCAP:USDT.D",
    "USDC.D": "CRYPTOCAP:USDC.D",
    TOTAL: "CRYPTOCAP:TOTAL",
    TOTAL2: "CRYPTOCAP:TOTAL2",
    TOTAL3: "CRYPTOCAP:TOTAL3",
  };
  return map[symbol.ticker] ? `https://www.tradingview.com/chart/?symbol=${map[symbol.ticker]}` : null;
}

export function SymbolDetails({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const p = t.coinhub.panels;
  const { symbol } = useActiveSymbol();
  const ticker = useTicker(symbol);
  if (!symbol) return null;
  const up = (ticker?.change ?? 0) >= 0;
  const precision = symbol.source !== "yahoo" ? symbol.pricePrecision : undefined;
  const tv = tradingViewUrl(symbol);
  return (
    <div className={cn("shrink-0 space-y-2 px-3 py-3 text-xs", compact && "border-t")}>
      <div>
        <div className="text-sm font-semibold">{symbol.display}</div>
        <div className="text-muted-foreground">{symbol.description}</div>
        <div className="text-muted-foreground">
          {symbol.exchange} · {t.coinhub.symbols.kinds[symbol.kind] ?? symbol.kind}
        </div>
      </div>
      {ticker && (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{fmtPrice(ticker.last, precision)}</span>
            {symbol.quote && <span className="text-muted-foreground">{symbol.quote}</span>}
          </div>
          <div className={cn("tabular-nums", up ? "text-[#089981]" : "text-[#f23645]")}>
            {up ? "+" : ""}
            {fmtPrice(ticker.change, precision)} ({fmtPercent(ticker.changePercent)})
          </div>
          {!compact && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">{p.high24}</dt>
              <dd className="text-right tabular-nums">{fmtPrice(ticker.high, precision)}</dd>
              <dt className="text-muted-foreground">{p.low24}</dt>
              <dd className="text-right tabular-nums">{fmtPrice(ticker.low, precision)}</dd>
              <dt className="text-muted-foreground">{p.vol24}</dt>
              <dd className="text-right tabular-nums">{fmtCompact(ticker.volume)}</dd>
              {ticker.quoteVolume > 0 && (
                <>
                  <dt className="text-muted-foreground">{p.turnover24}</dt>
                  <dd className="text-right tabular-nums">{fmtCompact(ticker.quoteVolume)}</dd>
                </>
              )}
            </dl>
          )}
          {!compact && ticker.high > ticker.low && (
            <div className="space-y-1">
              <div className="relative h-1 rounded-full bg-muted">
                <div
                  className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                  style={{ left: `${((ticker.last - ticker.low) / (ticker.high - ticker.low)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{fmtNumber(ticker.low, precision ?? 2)}</span>
                <span>{fmtNumber(ticker.high, precision ?? 2)}</span>
              </div>
            </div>
          )}
        </>
      )}
      {tv && !compact && (
        <a href={tv} target="_blank" rel="noreferrer" className="inline-block text-primary hover:underline">
          {p.openInTradingView} ↗
        </a>
      )}
    </div>
  );
}

const PANELS: Array<{ key: Exclude<Panel, null>; icon: typeof ListIcon }> = [
  { key: "watchlist", icon: ListIcon },
  { key: "hotlists", icon: FlameIcon },
  { key: "alerts", icon: AlarmClockIcon },
  { key: "objects", icon: ListTreeIcon },
  { key: "data", icon: DatabaseIcon },
  { key: "trading", icon: WalletIcon },
  { key: "info", icon: InfoIcon },
];

export function SidePanelContent() {
  const panel = useTerminal((s) => s.panel);
  const { t } = useLocale();
  if (!panel) return null;
  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-l bg-background max-md:absolute max-md:inset-y-0 max-md:right-11 max-md:z-40 max-md:w-[min(300px,calc(100vw-3rem))] max-md:shadow-xl">
      {panel === "watchlist" && (
        <>
          <Watchlist />
          <SymbolDetails compact />
        </>
      )}
      {panel === "hotlists" && <HotlistsPanel />}
      {panel === "alerts" && <AlertsPanel />}
      {panel === "objects" && <ObjectTree />}
      {panel === "data" && <DataWindow />}
      {panel === "trading" && <TradingPanel />}
      {panel === "info" && (
        <>
          <div className="flex h-10 shrink-0 items-center border-b px-3 text-sm font-medium">
            {t.coinhub.panels.info}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <SymbolDetails />
          </ScrollArea>
        </>
      )}
    </div>
  );
}

export function SideIconBar() {
  const { t } = useLocale();
  const panel = useTerminal((s) => s.panel);
  const alerts = useTerminal((s) => s.alerts.filter((a) => a.active).length);
  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-l bg-background py-1">
      {PANELS.map(({ key, icon: Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-md text-foreground/75 hover:bg-muted hover:text-foreground",
                  panel === key && "bg-primary/10 text-primary",
                )}
                onClick={() => setState({ panel: panel === key ? null : key })}
                aria-label={t.coinhub.panels[key]}
              />
            }
          >
            <Icon className="size-[18px]" strokeWidth={1.6} />
            {key === "alerts" && alerts > 0 && (
              <span className="absolute top-1 right-1 rounded-full bg-amber-500 px-1 text-[9px] leading-tight text-white">
                {alerts}
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent side="left">{t.coinhub.panels[key]}</TooltipContent>
        </Tooltip>
      ))}
      {panel && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="mt-auto flex size-9 items-center justify-center rounded-md text-foreground/60 hover:bg-muted"
                onClick={() => setState({ panel: null })}
                aria-label={t.coinhub.panels.collapse}
              />
            }
          >
            <PanelRightCloseIcon className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="left">{t.coinhub.panels.collapse}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

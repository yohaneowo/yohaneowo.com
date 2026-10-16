"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "cn";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/i18n/locale-provider";
import { fetchSpotTickers, type Ticker } from "@/lib/coinhub/datafeed";
import { fmtCompact, fmtPercent, fmtPrice } from "@/lib/coinhub/format";
import { getState, setChartSymbol } from "@/lib/coinhub/store";

type Row = { ticker: string } & Ticker;
type Tab = "gainers" | "losers" | "active";

// TradingView's hotlists for Binance spot: biggest movers and the most traded pairs.
export function HotlistsPanel() {
  const { t } = useLocale();
  const p = t.coinhub.panels;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<Tab>("gainers");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchSpotTickers()
        .then((list) => !cancelled && setRows(list.filter((r) => r.quoteVolume > 1_000_000)))
        .catch(() => !cancelled && setRows((r) => r ?? []));
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const sorted = (rows ?? [])
    .slice()
    .sort((a, b) =>
      tab === "gainers"
        ? b.changePercent - a.changePercent
        : tab === "losers"
          ? a.changePercent - b.changePercent
          : b.quoteVolume - a.quoteVolume,
    )
    .slice(0, 50);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b px-3 text-sm font-medium">{p.hotlists}</div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="px-3 pt-2">
        <TabsList className="w-full">
          <TabsTrigger value="gainers">{p.gainers}</TabsTrigger>
          <TabsTrigger value="losers">{p.losers}</TabsTrigger>
          <TabsTrigger value="active">{p.active}</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="px-3 pt-2 text-[11px] text-muted-foreground">{p.hotlistsHint}</p>
      <ScrollArea className="min-h-0 flex-1">
        {!rows && (
          <div className="flex justify-center py-8">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {sorted.map((r, i) => (
          <button
            key={r.ticker}
            type="button"
            onClick={() => setChartSymbol(getState().active, `BINANCE:${r.ticker}`)}
            className="grid w-full grid-cols-[1.25rem_1fr_auto_4rem] items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/60"
          >
            <span className="text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{r.ticker.replace(/USDT$/, "")}</span>
              <span className="block text-[10px] text-muted-foreground">${fmtCompact(r.quoteVolume)}</span>
            </span>
            <span className="text-right tabular-nums">{fmtPrice(r.last)}</span>
            <span
              className={cn(
                "text-right tabular-nums",
                r.changePercent >= 0 ? "text-[#089981]" : "text-[#f23645]",
              )}
            >
              {fmtPercent(r.changePercent)}
            </span>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}

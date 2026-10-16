"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";
import { loadSymbols, rememberSymbol, resolveSymbol, searchStocks } from "@/lib/coinhub/datafeed";
import { getState, setChartSymbol, setState, updateChart, useTerminal } from "@/lib/coinhub/store";
import type { CoinSymbol } from "@/lib/coinhub/types";
import { closeDialog, useUi } from "./ui-store";

type Tab = "all" | "spot" | "perp" | "stocks" | "indices";

// Exact ticker > base asset match > prefix > substring; ties keep the volume order.
function rank(s: CoinSymbol, q: string) {
  const display = s.display.toUpperCase();
  const base = (s.base ?? s.ticker).toUpperCase();
  if (display === q || s.ticker.toUpperCase() === q) return 0;
  if (base === q) return 1;
  if (display.startsWith(q)) return 2;
  if (base.startsWith(q)) return 3;
  if (display.includes(q)) return 4;
  if (s.description.toUpperCase().includes(q)) return 5;
  if (s.keywords?.some((k) => k.toUpperCase().includes(q))) return 5;
  return -1;
}

function Avatar({ symbol }: { symbol: CoinSymbol }) {
  const letter = (symbol.base ?? symbol.ticker).replace(/[^A-Z0-9]/gi, "").slice(0, 1) || "?";
  const hue = [...(symbol.base ?? symbol.ticker)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ background: `hsl(${hue} 55% 45%)` }}
    >
      {letter}
    </span>
  );
}

export function SymbolDialog() {
  const dialog = useUi((u) => u.dialog);
  const open = dialog?.type === "symbol";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
      {dialog?.type === "symbol" && <SymbolSearch mode={dialog.mode} initialQuery={dialog.query ?? ""} />}
    </Dialog>
  );
}

function SymbolSearch({
  mode,
  initialQuery,
}: {
  mode: "change" | "compare" | "watchlist";
  initialQuery: string;
}) {
  const { t } = useLocale();
  const s = t.coinhub.symbols;
  const open = true;
  const recent = useTerminal((st) => st.recentSymbols);
  const compare = useTerminal((st) => st.charts[st.active].compare);
  const watchlist = useTerminal((st) => st.watchlist);
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("all");
  const [all, setAll] = useState<CoinSymbol[]>([]);
  const [stocks, setStocks] = useState<CoinSymbol[]>([]);
  const [recentSymbols, setRecentSymbols] = useState<CoinSymbol[]>([]);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    loadSymbols().then(setAll, () => {});
    Promise.all(recent.map((id) => resolveSymbol(id))).then((list) =>
      setRecentSymbols(list.filter((x): x is CoinSymbol => !!x)),
    );
  }, [open, recent]);

  const q = query.trim().toUpperCase();

  useEffect(() => {
    if (!open || !q || (tab !== "all" && tab !== "stocks")) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchStocks(q, controller.signal)
        .then(setStocks)
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, q, tab]);

  const results = useMemo(() => {
    if (!q) {
      const base = tab === "all" ? [...recentSymbols, ...all.filter((x) => !recent.includes(x.id))] : all;
      return base
        .filter((x) =>
          tab === "spot"
            ? x.kind === "spot"
            : tab === "perp"
              ? x.kind === "perp"
              : tab === "indices"
                ? x.source === "index"
                : tab === "stocks"
                  ? false
                  : true,
        )
        .slice(0, 80);
    }
    const local =
      tab === "stocks"
        ? []
        : all.filter((x) =>
            tab === "spot"
              ? x.kind === "spot"
              : tab === "perp"
                ? x.kind === "perp"
                : tab === "indices"
                  ? x.source === "index"
                  : true,
          );
    const ranked = local
      // Spot before perpetuals and USDT before other quotes when the match is equally good.
      .map((x) => [x, rank(x, q) + (x.kind === "perp" ? 0.5 : 0) + (x.quote === "USDT" ? 0 : 0.25)] as const)
      .filter(([, r]) => r >= 0)
      .sort((a, b) => a[1] - b[1])
      .map(([x]) => x)
      .slice(0, 80);
    const extra =
      tab === "all" || tab === "stocks" ? stocks.filter((x) => !ranked.some((r) => r.id === x.id)) : [];
    return tab === "stocks" ? extra : [...ranked.slice(0, 40), ...extra, ...ranked.slice(40)];
  }, [q, tab, all, stocks, recentSymbols, recent]);

  const close = () => closeDialog();

  const choose = (symbol: CoinSymbol) => {
    rememberSymbol(symbol);
    const active = getState().active;
    if (mode === "change") {
      setChartSymbol(active, symbol.id);
      close();
    } else if (mode === "compare") {
      updateChart(active, (c) => ({
        compare: c.compare.includes(symbol.id)
          ? c.compare.filter((id) => id !== symbol.id)
          : [...c.compare, symbol.id].slice(-5),
        scale: c.compare.includes(symbol.id) && c.compare.length === 1 ? "normal" : "percentage",
      }));
    } else {
      // Clicking a symbol that is already in the list takes it out again, like TradingView.
      setState((st) => ({
        watchlist: st.watchlist.includes(symbol.id)
          ? st.watchlist.filter((id) => id !== symbol.id)
          : [...st.watchlist, symbol.id],
      }));
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const tabs: Array<[Tab, string]> = [
    ["all", s.all],
    ["spot", s.spot],
    ["perp", s.perp],
    ["stocks", s.stocks],
    ["indices", s.indices],
  ];
  const checked = (id: string) =>
    mode === "compare" ? compare.includes(id) : mode === "watchlist" ? watchlist.includes(id) : false;

  return (
    <>
      <DialogContent
        className="flex h-[min(640px,85vh)] flex-col gap-0 p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle>{mode === "compare" ? s.compareTitle : s.title}</DialogTitle>
            <button type="button" className="rounded p-1 hover:bg-muted" onClick={close} aria-label="Close">
              <XIcon className="size-4" />
            </button>
          </div>
          <DialogDescription className={cn(mode !== "compare" && "sr-only")}>
            {mode === "compare" ? s.compareHint : s.placeholder}
          </DialogDescription>
          <div className="mt-2 flex items-center gap-2 rounded-lg border px-3">
            <SearchIcon className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(results.length - 1, c + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(0, c - 1));
                } else if (e.key === "Enter" && results[cursor]) {
                  e.preventDefault();
                  choose(results[cursor]);
                }
              }}
              placeholder={s.placeholder}
              className="h-10 flex-1 bg-transparent text-base uppercase outline-none placeholder:normal-case"
            />
            {searching && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs hover:bg-muted",
                  tab === key && "bg-primary text-primary-foreground hover:bg-primary",
                )}
                onClick={() => {
                  setTab(key);
                  setCursor(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </DialogHeader>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
          {!q && tab === "all" && recentSymbols.length > 0 && (
            <div className="px-4 py-1 text-[11px] text-muted-foreground uppercase">{s.recent}</div>
          )}
          {results.length === 0 && !searching && (
            <p className="py-10 text-center text-sm text-muted-foreground">{s.noResults}</p>
          )}
          {results.map((x, i) => (
            <button
              key={`${x.id}-${i}`}
              type="button"
              data-index={i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(x)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2 text-left text-sm",
                i === cursor && "bg-muted",
              )}
            >
              <Avatar symbol={x} />
              <span className="w-36 shrink-0 truncate font-semibold">{x.display}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{x.description}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{s.kinds[x.kind] ?? x.kind}</span>
              <span className="w-20 shrink-0 truncate text-right text-xs">{x.exchange}</span>
              {checked(x.id) && <CheckIcon className="size-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </>
  );
}

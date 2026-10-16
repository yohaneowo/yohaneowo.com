"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcwIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/i18n/locale-provider";
import { fmtNumber, fmtPrice } from "@/lib/coinhub/format";
import {
  getState,
  newId,
  setState,
  useTerminal,
  type PaperAccount,
  type PaperFill,
} from "@/lib/coinhub/store";
import { getTicker, useTicker, watchTicker } from "@/lib/coinhub/tickers";
import { useActiveSymbol, useResolved } from "./hooks";

// Paper trading: a local account filled at live prices (no exchange involved).

export function applyFill(paper: PaperAccount, f: Omit<PaperFill, "id" | "pnl" | "at">): PaperAccount | null {
  const positions = paper.positions.slice();
  const index = positions.findIndex((p) => p.symbolId === f.symbolId);
  const pos = positions[index];
  let qty = pos?.qty ?? 0;
  let avg = pos?.avgPrice ?? 0;
  const signed = f.side === "buy" ? f.qty : -f.qty;
  let pnl = 0;
  // Opening or adding to a long needs the cash.
  if (signed > 0 && qty >= 0 && f.qty * f.price > paper.balance + 1e-9) return null;
  if (qty === 0 || Math.sign(qty) === Math.sign(signed)) {
    avg = (avg * Math.abs(qty) + f.price * f.qty) / (Math.abs(qty) + f.qty);
    qty += signed;
  } else {
    const closing = Math.min(Math.abs(qty), f.qty);
    pnl = (f.price - avg) * closing * Math.sign(qty);
    const before = qty;
    qty += signed;
    if (qty !== 0 && Math.sign(qty) !== Math.sign(before)) avg = f.price;
  }
  const fill: PaperFill = { ...f, id: newId(), pnl, at: Date.now() };
  if (Math.abs(qty) < 1e-12) {
    if (index >= 0) positions.splice(index, 1);
  } else if (index >= 0) {
    positions[index] = { ...pos, qty, avgPrice: avg };
  } else {
    positions.push({ symbolId: f.symbolId, display: f.display, qty, avgPrice: avg });
  }
  return {
    ...paper,
    balance: paper.balance - signed * f.price,
    positions,
    fills: [fill, ...paper.fills].slice(0, 300),
  };
}

// Fills resting orders and take-profit / stop-loss levels as prices move.
export function usePaperEngine(labels: {
  filled: (side: string, qty: string, display: string, price: string) => string;
  buy: string;
  sell: string;
}) {
  const paper = useTerminal((s) => s.paper);
  const ids = [
    ...new Set([
      ...paper.orders.map((o) => o.symbolId),
      ...paper.positions.filter((p) => p.takeProfit || p.stopLoss).map((p) => p.symbolId),
    ]),
  ];
  const symbols = useResolved(ids);
  const key = Object.keys(symbols).sort().join(",");
  useEffect(() => {
    const offs = Object.values(symbols).map((symbol) =>
      watchTicker(symbol, (ticker) => {
        const price = ticker.last;
        let account = getState().paper;
        const done: string[] = [];
        for (const o of account.orders) {
          if (o.symbolId !== symbol.id) continue;
          const hit =
            o.type === "limit"
              ? o.side === "buy"
                ? price <= o.price
                : price >= o.price
              : o.side === "buy"
                ? price >= o.price
                : price <= o.price;
          if (!hit) continue;
          const next = applyFill(account, {
            symbolId: o.symbolId,
            display: o.display,
            side: o.side,
            qty: o.qty,
            price: o.type === "limit" ? o.price : price,
          });
          done.push(o.id);
          if (next) {
            account = next;
            toast.success(
              labels.filled(
                o.side === "buy" ? labels.buy : labels.sell,
                String(o.qty),
                o.display,
                fmtPrice(price),
              ),
            );
          }
        }
        if (done.length) account = { ...account, orders: account.orders.filter((o) => !done.includes(o.id)) };
        const pos = account.positions.find((p) => p.symbolId === symbol.id);
        if (pos) {
          const long = pos.qty > 0;
          const tp = pos.takeProfit && (long ? price >= pos.takeProfit : price <= pos.takeProfit);
          const sl = pos.stopLoss && (long ? price <= pos.stopLoss : price >= pos.stopLoss);
          if (tp || sl) {
            const next = applyFill(account, {
              symbolId: pos.symbolId,
              display: pos.display,
              side: long ? "sell" : "buy",
              qty: Math.abs(pos.qty),
              price,
            });
            if (next) {
              account = next;
              toast.success(
                labels.filled(
                  long ? labels.sell : labels.buy,
                  String(Math.abs(pos.qty)),
                  pos.display,
                  fmtPrice(price),
                ),
              );
            }
          }
        }
        if (account !== getState().paper) setState({ paper: account });
      }),
    );
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function PositionRow({
  symbolId,
  display,
  qty,
  avgPrice,
}: {
  symbolId: string;
  display: string;
  qty: number;
  avgPrice: number;
}) {
  const { t } = useLocale();
  const symbols = useResolved([symbolId]);
  const ticker = useTicker(symbols[symbolId] ?? null);
  const last = ticker?.last ?? avgPrice;
  const pnl = (last - avgPrice) * qty;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-2 border-b px-3 py-2 text-xs">
      <div className="font-medium">
        {display}{" "}
        <span className={qty > 0 ? "text-[#089981]" : "text-[#f23645]"}>
          {qty > 0 ? t.coinhub.trading.long : t.coinhub.trading.short} {Math.abs(qty)}
        </span>
      </div>
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          const next = applyFill(getState().paper, {
            symbolId,
            display,
            side: qty > 0 ? "sell" : "buy",
            qty: Math.abs(qty),
            price: last,
          });
          if (next) setState({ paper: next });
        }}
      >
        {t.coinhub.trading.close}
      </Button>
      <div className="text-muted-foreground">
        {t.coinhub.trading.avgPrice} {fmtPrice(avgPrice)} → {fmtPrice(last)}
      </div>
      <div className={cn("text-right tabular-nums", pnl >= 0 ? "text-[#089981]" : "text-[#f23645]")}>
        {pnl >= 0 ? "+" : ""}
        {fmtNumber(pnl)}
      </div>
    </div>
  );
}

export function TradingPanel() {
  const { t } = useLocale();
  const tr = t.coinhub.trading;
  const paper = useTerminal((s) => s.paper);
  const { symbol, symbolId } = useActiveSymbol();
  const ticker = useTicker(symbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit" | "stop">("market");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("0.01");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");

  const unrealized = paper.positions.reduce(
    (sum, p) => sum + ((getTicker(p.symbolId)?.last ?? p.avgPrice) - p.avgPrice) * p.qty,
    0,
  );
  const exposure = paper.positions.reduce(
    (sum, p) => sum + (getTicker(p.symbolId)?.last ?? p.avgPrice) * p.qty,
    0,
  );
  const equity = paper.balance + exposure;
  const realized = paper.fills.reduce((sum, f) => sum + f.pnl, 0);

  const place = () => {
    if (!symbol) return;
    const q = Number(qty);
    if (!(q > 0)) return;
    const display = symbol.display;
    if (type === "market") {
      const last = ticker?.last;
      if (!last) return;
      const next = applyFill(getState().paper, { symbolId, display, side, qty: q, price: last });
      if (!next) {
        toast.error(tr.insufficient);
        return;
      }
      const withLevels = {
        ...next,
        positions: next.positions.map((p) =>
          p.symbolId === symbolId
            ? { ...p, takeProfit: Number(tp) || p.takeProfit, stopLoss: Number(sl) || p.stopLoss }
            : p,
        ),
      };
      setState({ paper: withLevels });
      toast.success(tr.filled(side === "buy" ? tr.buy : tr.sell, String(q), display, fmtPrice(last)));
    } else {
      const p = Number(price);
      if (!(p > 0)) return;
      setState((s) => ({
        paper: {
          ...s.paper,
          orders: [
            ...s.paper.orders,
            { id: newId(), symbolId, display, side, type, price: p, qty: q, createdAt: Date.now() },
          ],
        },
      }));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">{tr.title}</span>
        <Button
          size="icon-sm"
          variant="ghost"
          title={tr.reset}
          onClick={() => {
            if (window.confirm(tr.resetConfirm))
              setState((s) => ({
                paper: {
                  balance: s.paper.initial,
                  initial: s.paper.initial,
                  positions: [],
                  orders: [],
                  fills: [],
                },
              }));
          }}
        >
          <RotateCcwIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 text-xs">
          <dt className="text-muted-foreground">{tr.equity}</dt>
          <dd className="text-right font-medium tabular-nums">{fmtNumber(equity)}</dd>
          <dt className="text-muted-foreground">{tr.balance}</dt>
          <dd className="text-right tabular-nums">{fmtNumber(paper.balance)}</dd>
          <dt className="text-muted-foreground">{tr.unrealized}</dt>
          <dd
            className={cn("text-right tabular-nums", unrealized >= 0 ? "text-[#089981]" : "text-[#f23645]")}
          >
            {fmtNumber(unrealized)}
          </dd>
          <dt className="text-muted-foreground">{tr.realized}</dt>
          <dd className={cn("text-right tabular-nums", realized >= 0 ? "text-[#089981]" : "text-[#f23645]")}>
            {fmtNumber(realized)}
          </dd>
        </dl>
        <div className="space-y-2 border-y px-3 py-3">
          <div className="text-xs font-medium">
            {symbol?.display}{" "}
            {ticker && <span className="text-muted-foreground">· {fmtPrice(ticker.last)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Button
              size="sm"
              variant={side === "buy" ? "default" : "outline"}
              className={cn(side === "buy" && "bg-[#089981] text-white hover:bg-[#089981]/90")}
              onClick={() => setSide("buy")}
            >
              {tr.buy}
            </Button>
            <Button
              size="sm"
              variant={side === "sell" ? "default" : "outline"}
              className={cn(side === "sell" && "bg-[#f23645] text-white hover:bg-[#f23645]/90")}
              onClick={() => setSide("sell")}
            >
              {tr.sell}
            </Button>
          </div>
          <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
            <TabsList className="w-full">
              <TabsTrigger value="market">{tr.market}</TabsTrigger>
              <TabsTrigger value="limit">{tr.limit}</TabsTrigger>
              <TabsTrigger value="stop">{tr.stop}</TabsTrigger>
            </TabsList>
          </Tabs>
          {type !== "market" && (
            <div className="space-y-1">
              <Label className="text-xs">{tr.price}</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder={ticker ? String(ticker.last) : ""}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">{tr.qty}</Label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
          </div>
          {type === "market" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{tr.takeProfit}</Label>
                <Input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{tr.stopLoss}</Label>
                <Input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" />
              </div>
            </div>
          )}
          <Button className="w-full" size="sm" onClick={place} disabled={!symbol}>
            {tr.place}
          </Button>
          <p className="text-[11px] text-muted-foreground">{tr.hint}</p>
        </div>
        <Tabs defaultValue="positions" className="gap-0">
          <TabsList variant="line" className="mx-3 mt-1">
            <TabsTrigger value="positions">
              {tr.positions} ({paper.positions.length})
            </TabsTrigger>
            <TabsTrigger value="orders">
              {tr.orders} ({paper.orders.length})
            </TabsTrigger>
            <TabsTrigger value="history">{tr.history}</TabsTrigger>
          </TabsList>
          <TabsContent value="positions">
            {paper.positions.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tr.noPositions}</p>
            )}
            {paper.positions.map((p) => (
              <PositionRow key={p.symbolId} {...p} />
            ))}
          </TabsContent>
          <TabsContent value="orders">
            {paper.orders.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tr.noOrders}</p>
            )}
            {paper.orders.map((o) => (
              <div key={o.id} className="flex items-center gap-2 border-b px-3 py-2 text-xs">
                <span className={o.side === "buy" ? "text-[#089981]" : "text-[#f23645]"}>
                  {o.side === "buy" ? tr.buy : tr.sell}
                </span>
                <span className="flex-1">
                  {o.display} {o.qty} @ {fmtPrice(o.price)}{" "}
                  <span className="text-muted-foreground">({o.type === "limit" ? tr.limit : tr.stop})</span>
                </span>
                <button
                  type="button"
                  className="rounded p-1 hover:bg-muted"
                  title={tr.cancel}
                  onClick={() =>
                    setState((s) => ({
                      paper: { ...s.paper, orders: s.paper.orders.filter((x) => x.id !== o.id) },
                    }))
                  }
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="history">
            {paper.fills.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tr.noFills}</p>
            )}
            {paper.fills.map((f) => (
              <div key={f.id} className="flex items-center gap-2 border-b px-3 py-1.5 text-xs">
                <span className={f.side === "buy" ? "text-[#089981]" : "text-[#f23645]"}>
                  {f.side === "buy" ? tr.buy : tr.sell}
                </span>
                <span className="flex-1">
                  {f.display} {f.qty} @ {fmtPrice(f.price)}
                </span>
                {f.pnl !== 0 && (
                  <span className={f.pnl >= 0 ? "text-[#089981]" : "text-[#f23645]"}>{fmtNumber(f.pnl)}</span>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}

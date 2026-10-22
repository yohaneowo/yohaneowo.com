"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, RefreshCwIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/i18n/locale-provider";
import { resolveSymbol } from "@/lib/coinhub/datafeed";
import { getState, setChartSymbol, setState, useTerminal } from "@/lib/coinhub/store";
import {
  connectExchange,
  disconnectExchange,
  fillSources,
  fillsKey,
  fmtDec,
  holdingAsset,
  loadConnections,
  loadFills,
  loadIp,
  loadWallets,
  refreshConnection,
  setTracked,
  trade,
  TradeApiError,
  type TradeConnection,
  type TradeFill,
  type TradeProduct,
  useChartFills,
  useTrade,
} from "@/lib/coinhub/trade";
import { useActiveSymbol } from "./hooks";

// The user's exchange accounts (read-only keys that admin reads in the background): what the
// current symbol's holding and fills are, the wallets and futures positions, the fills list, and
// the sync state with the key management.

const UP = "text-[#089981]";
const DOWN = "text-[#f23645]";

// Switches the active chart to the first of these symbols the terminal knows.
async function openChart(candidates: string[], noChart: string) {
  for (const id of candidates) {
    if (await resolveSymbol(id)) {
      setChartSymbol(getState().active, id);
      return;
    }
  }
  toast.error(noChart);
}

// A wallet asset's chart: a stock (EQ_<ticker>) on Yahoo, a coin against USDT (else USDC, BTC).
function openAssetChart(asset: string, noChart: string) {
  if (asset.startsWith("EQ_")) return openChart([`YAHOO:${asset.slice(3)}`], noChart);
  return openChart([`BINANCE:${asset}USDT`, `BINANCE:${asset}USDC`, `BINANCE:${asset}BTC`], noChart);
}

// A COIN-M position's chart: the USDT perpetual of its base, else the spot pair.
function openPositionChart(symbol: string, noChart: string) {
  const base = symbol.replace(/USD_.*$/, "");
  return openChart([`BINANCE:${base}USDT.P`, `BINANCE:${base}USDT`], noChart);
}

function useAgo() {
  const { t } = useLocale();
  const a = t.coinhub.account.ago;
  return (ms: number | null) => {
    if (!ms) return t.coinhub.account.never;
    const minutes = Math.round((Date.now() - ms) / 60_000);
    if (minutes < 1) return a.now;
    if (minutes < 60) return a.minutes(minutes);
    if (minutes < 60 * 48) return a.hours(Math.round(minutes / 60));
    return a.days(Math.round(minutes / 1440));
  };
}

function errorCode(error: unknown) {
  return error instanceof TradeApiError ? error.code : "unavailable";
}

export function AccountPanel() {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const signedIn = useTrade((s) => s.signedIn);
  const connections = useTrade((s) => s.connections);
  const loading = useTrade((s) => s.loading);
  const error = useTrade((s) => s.error);
  const selected = useTrade((s) => s.selected);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void loadConnections();
    const timer = setInterval(() => void loadConnections(), 60_000);
    return () => clearInterval(timer);
  }, []);

  const connection = connections?.find((c) => c.id === selected) ?? connections?.[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">{tr.title}</span>
        {connection && (
          <Button
            size="icon-sm"
            variant="ghost"
            title={tr.refresh}
            onClick={() =>
              refreshConnection(connection.id)
                .then(() => toast.success(tr.refreshed))
                .catch((e) =>
                  toast.error(tr.errors[errorCode(e) as keyof typeof tr.errors] ?? tr.errors.generic),
                )
            }
          >
            <RefreshCwIcon />
          </Button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {signedIn === false ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">{tr.signIn}</p>
        ) : connections === null ? (
          <p className="flex items-center gap-1.5 px-3 py-3 text-xs text-muted-foreground">
            {loading && <Loader2Icon className="size-3.5 animate-spin" aria-hidden />}
            {error ? tr.unavailable : tr.loading}
          </p>
        ) : !connection || adding ? (
          <ConnectForm cancel={adding ? () => setAdding(false) : undefined} done={() => setAdding(false)} />
        ) : (
          <ConnectionView connection={connection} all={connections} onAdd={() => setAdding(true)} />
        )}
      </ScrollArea>
    </div>
  );
}

// ── Connecting a key ──────────────────────────────────────────────────────────────────────────

function ConnectForm({ cancel, done }: { cancel?: () => void; done: () => void }) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const ip = useTrade((s) => s.ip);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    void loadIp();
  }, []);

  const submit = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await connectExchange({ label, apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
      toast.success(tr.connected);
      done();
    } catch (e) {
      const code = errorCode(e);
      setFailed(tr.errors[code as keyof typeof tr.errors] ?? tr.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2.5 px-3 py-3 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {!cancel && <p className="text-muted-foreground">{tr.none}</p>}
      <p className="font-medium">{tr.connect}</p>
      <p className="text-muted-foreground">{tr.connectHint}</p>
      {ip && <p className="text-muted-foreground">{tr.ipHint(ip)}</p>}
      <div className="flex flex-col gap-1">
        <Label htmlFor="trade-label" className="text-xs">
          {tr.label}
        </Label>
        <Input
          id="trade-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={tr.labelPlaceholder}
          maxLength={64}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="trade-key" className="text-xs">
          {tr.apiKey}
        </Label>
        <Input
          id="trade-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
          className="h-8 font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="trade-secret" className="text-xs">
          {tr.apiSecret}
        </Label>
        <Input
          id="trade-secret"
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          autoComplete="off"
          required
          className="h-8 font-mono text-xs"
        />
      </div>
      {failed && <p className={DOWN}>{failed}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || !apiKey || !apiSecret}>
          {busy && <Loader2Icon className="animate-spin" />}
          {busy ? tr.connecting : tr.submit}
        </Button>
        {cancel && (
          <Button type="button" size="sm" variant="ghost" onClick={cancel}>
            {tr.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

// ── A connected account ───────────────────────────────────────────────────────────────────────

function ConnectionView({
  connection,
  all,
  onAdd,
}: {
  connection: TradeConnection;
  all: TradeConnection[];
  onAdd: () => void;
}) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const tab = useTrade((s) => s.tab);
  const ago = useAgo();

  return (
    <div className="flex flex-col text-xs">
      <div className="flex flex-col gap-1 border-b px-3 py-2">
        {all.length > 1 ? (
          <select
            className="h-7 rounded-md border bg-background px-1 text-xs"
            value={connection.id}
            onChange={(e) => {
              const id = Number(e.target.value);
              trade.set({ selected: id });
              setState({ trade: { show: true, connection: id } });
            }}
          >
            {all.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} · {c.keyTail}
              </option>
            ))}
          </select>
        ) : (
          <div className="font-medium">
            {connection.label}{" "}
            <span className="font-normal text-muted-foreground">· {tr.keyTail(connection.keyTail)}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-2 text-muted-foreground">
          <span className={cn(connection.status === "error" && DOWN)}>{tr.status[connection.status]}</span>
          <span>{tr.lastSync(ago(connection.lastSyncAt))}</span>
        </div>
        {connection.lastError && <p className={DOWN}>{connection.lastError}</p>}
        {connection.permissions.trading && <p className="text-amber-600">{tr.permissions.trading}</p>}
      </div>
      <Tabs value={tab} onValueChange={(v) => trade.set({ tab: v as typeof tab })} className="gap-0">
        <TabsList className="mx-3 mt-2 grid h-7 w-auto grid-cols-4">
          {(["overview", "wallets", "fills", "sync"] as const).map((key) => (
            <TabsTrigger key={key} value={key} className="h-6 text-xs">
              {tr.tabs[key]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <Overview connection={connection} />
        </TabsContent>
        <TabsContent value="wallets">
          <Wallets connection={connection} />
        </TabsContent>
        <TabsContent value="fills">
          <Fills connection={connection} />
        </TabsContent>
        <TabsContent value="sync">
          <Sync connection={connection} onAdd={onAdd} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The symbol on the active chart: what's held of it and its fills in short.
function Overview({ connection }: { connection: TradeConnection }) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const show = useTerminal((s) => s.trade.show);
  const { symbol } = useActiveSymbol();
  const fills = useChartFills(symbol, connection.id);
  const wallets = useTrade((s) => s.wallets[connection.id]);
  useEffect(() => {
    loadWallets(connection.id).catch(() => {});
  }, [connection.id]);
  const sources = symbol ? fillSources(symbol) : [];
  // The spot or stock holding behind the chart across the wallets (stocks are EQ_<ticker>).
  const asset = symbol ? holdingAsset(symbol) : null;
  const held = wallets?.balances.filter((b) => b.asset === asset && b.wallet !== "coinm") ?? [];
  const position = wallets?.positions.find((p) =>
    sources.some((s) => s.product === "coinm" && s.symbol === p.symbol),
  );
  const totals = useMemo(() => {
    let bought = 0;
    let sold = 0;
    for (const f of fills) {
      if (f.product === "coinm") continue;
      if (f.side === "BUY") bought += Number(f.qty);
      else sold += Number(f.qty);
    }
    return { bought, sold };
  }, [fills]);

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <label className="flex items-center justify-between gap-2">
        <span>{tr.showOnChart}</span>
        <Switch
          checked={show}
          onCheckedChange={(checked) => setState((s) => ({ trade: { ...s.trade, show: checked } }))}
        />
      </label>
      <p className="text-muted-foreground">{tr.marker}</p>
      <div className="mt-1 font-medium">
        {tr.thisSymbol}
        {symbol && <span className="ml-1 text-muted-foreground">{symbol.display}</span>}
      </div>
      {!sources.length ? (
        <p className="text-muted-foreground">{tr.noSource}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {held.map((b) => (
            <Row
              key={`${b.wallet}:${b.asset}`}
              label={`${tr.holding} ${b.asset.replace(/^EQ_/, "")} · ${tr.wallets[b.wallet]}`}
              value={fmtDec(b.total)}
            />
          ))}
          {position && (
            <Row
              label={`${tr.positions} ${position.symbol}`}
              value={`${fmtDec(position.qty)} ${tr.contracts}`}
              tone={Number(position.qty) >= 0 ? UP : DOWN}
            />
          )}
          <Row label={tr.fillsCount(fills.length)} value="" />
          {fills.length > 0 && (
            <>
              <Row label={tr.bought} value={fmtDec(String(totals.bought))} tone={UP} />
              <Row label={tr.sold} value={fmtDec(String(totals.sold))} tone={DOWN} />
              <Row label={tr.firstFill} value={fmtDate(fills[0].time)} />
              <Row label={tr.lastFill} value={fmtDate(fills[fills.length - 1].time)} />
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: React.ReactNode; value: string; tone?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right tabular-nums", tone)}>{value}</dd>
    </>
  );
}

function fmtDate(ms: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(ms);
}

// Balances by wallet and the futures positions.
function Wallets({ connection }: { connection: TradeConnection }) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const wallets = useTrade((s) => s.wallets[connection.id]);
  useEffect(() => {
    loadWallets(connection.id).catch(() => {});
  }, [connection.id]);
  if (!wallets) return <p className="px-3 py-2 text-muted-foreground">{tr.noBalances}</p>;
  const byWallet = (["spot", "funding", "earn", "coinm"] as const).map((w) => ({
    wallet: w,
    rows: wallets.balances.filter((b) => b.wallet === w),
  }));
  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      {byWallet
        .filter((g) => g.rows.length)
        .map((g) => (
          <div key={g.wallet}>
            <div className="mb-1 font-medium">{tr.wallets[g.wallet]}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {g.rows.map((b) => (
                <Row
                  key={b.asset}
                  label={
                    <button
                      type="button"
                      className="hover:text-primary hover:underline"
                      onClick={() => void openAssetChart(b.asset, tr.noChart)}
                    >
                      {b.asset.replace(/^EQ_/, "")}
                    </button>
                  }
                  value={
                    b.unrealized && Number(b.unrealized) !== 0
                      ? `${fmtDec(b.total)} (${Number(b.unrealized) > 0 ? "+" : ""}${fmtDec(b.unrealized)})`
                      : fmtDec(b.total)
                  }
                />
              ))}
            </dl>
          </div>
        ))}
      <div>
        <div className="mb-1 font-medium">{tr.positions}</div>
        {wallets.positions.length === 0 ? (
          <p className="text-muted-foreground">{tr.noPositions}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {wallets.positions.map((p) => {
              const long = Number(p.qty) >= 0;
              const pnl = Number(p.unrealizedPnl ?? 0);
              return (
                <div
                  key={`${p.product}:${p.symbol}:${p.positionSide}`}
                  className="rounded-md border px-2 py-1.5"
                >
                  <div className="flex justify-between">
                    <button
                      type="button"
                      className="font-medium hover:text-primary hover:underline"
                      onClick={() => void openPositionChart(p.symbol, tr.noChart)}
                    >
                      {p.symbol}
                    </button>
                    <span className={long ? UP : DOWN}>
                      {fmtDec(p.qty)} {tr.contracts} · {p.leverage ?? "–"}x {p.marginType ?? ""}
                    </span>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-muted-foreground">
                    <Row label={tr.entry} value={fmtDec(p.entryPrice, 4)} />
                    <Row label={tr.mark} value={fmtDec(p.markPrice, 4)} />
                    <Row label={tr.upnl} value={fmtDec(p.unrealizedPnl, 6)} tone={pnl >= 0 ? UP : DOWN} />
                    <Row label={tr.liq} value={fmtDec(p.liquidationPrice, 4)} />
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// The chart symbol's fills, newest first; the ones a clicked mark stands for are highlighted.
function Fills({ connection }: { connection: TradeConnection }) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const { symbol } = useActiveSymbol();
  const fills = useChartFills(symbol, connection.id);
  const highlight = useTrade((s) => s.highlight);
  const loaded = useTrade((s) =>
    symbol
      ? fillSources(symbol).every((src) => s.fills[fillsKey(connection.id, src.product, src.symbol)])
      : true,
  );
  const rows = useMemo(() => fills.slice().reverse(), [fills]);
  if (!symbol || !fillSources(symbol).length)
    return <p className="px-3 py-2 text-muted-foreground">{tr.noSource}</p>;
  if (!loaded) return <p className="px-3 py-2 text-muted-foreground">{tr.loadingFills}</p>;
  if (!rows.length) return <p className="px-3 py-2 text-muted-foreground">{tr.noFills}</p>;
  return (
    <div className="flex flex-col">
      {rows.map((f) => (
        <FillRow key={`${f.product}:${f.symbol}:${f.id}`} fill={f} highlighted={highlight.includes(f.id)} />
      ))}
    </div>
  );
}

function FillRow({ fill, highlighted }: { fill: TradeFill; highlighted: boolean }) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const buy = fill.side === "BUY";
  return (
    <div className={cn("flex flex-col border-b px-3 py-1.5", highlighted && "bg-primary/10")}>
      <div className="flex items-center justify-between">
        <span>
          <span className={cn("font-medium", buy ? UP : DOWN)}>{tr.side[fill.side]}</span>
          <span className="ml-1 text-muted-foreground">
            {tr.product[fill.product]}
            {fill.positionSide && fill.positionSide !== "BOTH" ? ` ${fill.positionSide}` : ""}
          </span>
        </span>
        <span className="text-muted-foreground">{fmtDate(fill.time)}</span>
      </div>
      <div className="flex items-center justify-between tabular-nums">
        <span>
          {fmtDec(fill.qty)}
          {fill.product === "coinm" ? ` ${tr.contracts}` : ""} @ {fmtDec(fill.price)}
        </span>
        <span className="text-muted-foreground">
          {Number(fill.fee) ? `${tr.fee} ${fmtDec(fill.fee, 6)} ${fill.feeAsset}` : ""}
          {fill.realizedPnl && Number(fill.realizedPnl) !== 0 ? (
            <span className={cn("ml-1", Number(fill.realizedPnl) >= 0 ? UP : DOWN)}>
              {fmtDec(fill.realizedPnl, 6)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// How far the reading got, symbols followed by hand, and the key itself.
function Sync({ connection, onAdd }: { connection: TradeConnection; onAdd: () => void }) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const [product, setProduct] = useState<TradeProduct>("spot");
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);
  const syncs = connection.syncs;
  const done = syncs.filter((s) => s.backfilled).length;
  const total = syncs.reduce((n, s) => n + s.count, 0);
  const failed = syncs.filter((s) => s.lastError);

  const add = async () => {
    const id = symbol.trim().toUpperCase();
    if (!id) return;
    setBusy(true);
    try {
      await setTracked(connection.id, [{ product, symbol: id }], []);
      setSymbol("");
    } catch (e) {
      toast.error(tr.errors[errorCode(e) as keyof typeof tr.errors] ?? tr.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <div>
        <p>{tr.syncLine(done, syncs.length, total)}</p>
        {failed.length > 0 && (
          <div className="mt-1">
            <div className={cn("font-medium", DOWN)}>{tr.syncErrors}</div>
            {failed.map((s) => (
              <p key={`${s.product}:${s.symbol}`} className="text-muted-foreground">
                {s.symbol}: {s.lastError}
              </p>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="font-medium">{tr.tracked}</div>
        <p className="text-muted-foreground">{tr.trackedHint}</p>
        {connection.tracked.map((item) => (
          <div key={`${item.product}:${item.symbol}`} className="flex items-center justify-between py-0.5">
            <span>
              {item.symbol} <span className="text-muted-foreground">· {tr.product[item.product]}</span>
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() =>
                setTracked(connection.id, [], [item]).catch((e) =>
                  toast.error(tr.errors[errorCode(e) as keyof typeof tr.errors] ?? tr.errors.generic),
                )
              }
            >
              <XIcon />
            </Button>
          </div>
        ))}
        <form
          className="mt-1 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <select
            className="h-7 rounded-md border bg-background px-1 text-xs"
            value={product}
            onChange={(e) => setProduct(e.target.value as TradeProduct)}
          >
            <option value="spot">{tr.product.spot}</option>
            <option value="coinm">{tr.product.coinm}</option>
          </select>
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={tr.symbolPlaceholder}
            className="h-7 flex-1 font-mono text-xs uppercase"
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !symbol.trim()}>
            {tr.addSymbol}
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onAdd}>
          {tr.addAnother}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={DOWN}
          onClick={() => {
            if (!window.confirm(tr.disconnectConfirm)) return;
            disconnectExchange(connection.id).catch((e) =>
              toast.error(tr.errors[errorCode(e) as keyof typeof tr.errors] ?? tr.errors.generic),
            );
          }}
        >
          {tr.disconnect}
        </Button>
      </div>
    </div>
  );
}

// Reloads a symbol's fills (used after a refresh so the marks catch up).
export function reloadFills(connection: number, product: TradeProduct, symbol: string) {
  return loadFills(connection, product, symbol, true);
}

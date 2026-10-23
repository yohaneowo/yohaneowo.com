"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRightIcon, Loader2Icon, RefreshCwIcon, XIcon } from "lucide-react";
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
  EXCHANGE_NAMES,
  EXCHANGES,
  fillSources,
  fillsKey,
  fmtDec,
  holdingAsset,
  isContract,
  loadConnections,
  loadFills,
  loadIp,
  loadValuation,
  loadWallets,
  refreshConnection,
  setTracked,
  symbolBase,
  trade,
  TradeApiError,
  type TradeBalance,
  type TradeBot,
  type TradeConnection,
  type TradeExchange,
  type TradeFill,
  type TradeProduct,
  type TradeWallet,
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

// A contract position's chart (any exchange's symbol format): the USDT perpetual of its base, else
// the spot pair.
function openPositionChart(symbol: string, noChart: string) {
  const base = symbolBase(symbol);
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
  const [exchange, setExchange] = useState<TradeExchange>("binance");
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
      await connectExchange({ exchange, label, apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
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
      <p className="font-medium">{tr.connect(EXCHANGE_NAMES[exchange])}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={tr.exchange}>
        {EXCHANGES.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={exchange === key}
            className={cn(
              "rounded-md border px-2 py-0.5 hover:bg-muted",
              exchange === key
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "text-muted-foreground",
            )}
            onClick={() => setExchange(key)}
          >
            {EXCHANGE_NAMES[key]}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground">{tr.connectHints[exchange]}</p>
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
          {busy ? tr.connecting(EXCHANGE_NAMES[exchange]) : tr.submit}
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
              setState((s) => ({ trade: { ...s.trade, connection: id } }));
            }}
          >
            {all.map((c) => (
              <option key={c.id} value={c.id}>
                {EXCHANGE_NAMES[c.exchange] ?? c.exchange} · {c.label} · {c.keyTail}
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
          <span>{EXCHANGE_NAMES[connection.exchange] ?? connection.exchange}</span>
          <span className={cn(connection.status === "error" && DOWN)}>{tr.status[connection.status]}</span>
          <span>{tr.lastSync(ago(connection.lastSyncAt))}</span>
        </div>
        {connection.lastError && <p className={DOWN}>{connection.lastError}</p>}
        {connection.permissions.trading && <p className="text-amber-600">{tr.permissions.trading}</p>}
        {connection.exchange === "pionex" && connection.permissions.botReading === false && (
          <p className="text-amber-600">{tr.permissions.noBotReading}</p>
        )}
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
  const sources = symbol ? fillSources(symbol, connection.exchange) : [];
  // The spot or stock holding behind the chart across the wallets (stocks are EQ_<ticker>); the
  // contract wallets hold margin, not the coin.
  const asset = symbol ? holdingAsset(symbol) : null;
  const held =
    wallets?.balances.filter((b) => b.asset === asset && b.wallet !== "coinm" && b.wallet !== "usdm") ?? [];
  const position = wallets?.positions.find((p) =>
    sources.some((s) => isContract(s.product) && s.product === p.product && s.symbol === p.symbol),
  );
  const totals = useMemo(() => {
    let bought = 0;
    let sold = 0;
    for (const f of fills) {
      if (isContract(f.product)) continue;
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
              value={`${fmtDec(position.qty)}${position.product === "coinm" ? ` ${tr.contracts}` : ""}`}
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

// The sources a coin's logo is tried from, in order: Binance's own asset logos (every asset it
// lists, by symbol), then CoinCap's; a stock (EQ_<ticker>) from Parqet's symbol logos. The first
// letter when none has it.
function iconSources(asset: string): string[] {
  const ticker = asset.replace(/^EQ_/, "");
  if (asset.startsWith("EQ_")) return [`https://assets.parqet.com/logos/symbol/${ticker}?format=png`];
  return [
    `https://bin.bnbstatic.com/static/assets/logos/${ticker}.png`,
    `https://assets.coincap.io/assets/icons/${ticker.toLowerCase()}@2x.png`,
  ];
}

function CoinIcon({ asset }: { asset: string }) {
  const [attempt, setAttempt] = useState(0);
  const sources = iconSources(asset);
  const src = sources[attempt];
  if (!src)
    return (
      <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
        {asset.replace(/^EQ_/, "")[0]}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny third-party icon, not worth the optimizer
    <img
      key={src}
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className="size-4 shrink-0 rounded-full"
      onError={() => setAttempt((n) => n + 1)}
    />
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

// The currencies the holdings can be valued in (USD exchange rates from the valuation API).
const CURRENCIES = ["USD", "TWD", "CNY", "HKD", "JPY", "KRW", "EUR", "GBP", "SGD", "AUD", "CAD", "MYR"];
// Every wallet any exchange has; a connection shows the ones it filled.
const WALLETS: TradeWallet[] = ["unified", "coinm", "usdm", "bot", "funding", "earn", "spot", "other"];
type Wallet = TradeWallet;
// The wallets that hold contract margin: the positions are listed under them.
const CONTRACT_WALLETS: Wallet[] = ["unified", "coinm", "usdm"];
// A wallet header cycles its rows: all → none → the top three → all.
type Fold = "all" | "none" | "top";
const NEXT_FOLD: Record<Fold, Fold> = { all: "none", none: "top", top: "all" };
const TOP = 3;

// Balances by wallet with each asset's value in the chosen currency (coins at Binance's spot price,
// stocks at Yahoo's, futures wallets with their unrealized profit), the total on top, a picker for
// one wallet or the overview, and the futures positions.
function Wallets({ connection }: { connection: TradeConnection }) {
  const { t, lang } = useLocale();
  const tr = t.coinhub.account;
  const wallets = useTrade((s) => s.wallets[connection.id]);
  // Every account's wallets too: the panel shows what all of them add up to.
  const connections = useTrade((s) => s.connections ?? []);
  const allWallets = useTrade((s) => s.wallets);
  const valuation = useTrade((s) => s.valuation);
  const currency = useTerminal((s) => s.trade.currency);
  const [view, setView] = useState<"all" | Wallet>("all");
  const [folds, setFolds] = useState<Partial<Record<Wallet, Fold>>>({});
  const connectionIds = connections.map((c) => c.id).join(",");
  useEffect(() => {
    loadWallets(connection.id).catch(() => {});
    for (const id of connectionIds.split(",").filter(Boolean)) loadWallets(Number(id)).catch(() => {});
  }, [connection.id, connectionIds]);
  const assetKey = useMemo(
    () =>
      [...new Set(Object.values(allWallets).flatMap((w) => w.balances.map((b) => b.asset)))].sort().join(","),
    [allWallets],
  );
  useEffect(() => {
    if (assetKey) loadValuation(assetKey.split(",")).catch(() => {});
  }, [assetKey]);
  if (!wallets) return <p className="px-3 py-2 text-muted-foreground">{tr.noBalances}</p>;
  const rate = valuation?.rates[currency] ?? (currency === "USD" ? 1 : null);
  // The exchange's own price first (it values coins Binance doesn't list), Binance's otherwise.
  const valueOf = (b: TradeBalance) => {
    const price =
      b.priceUsd !== null && Number(b.priceUsd) > 0 ? Number(b.priceUsd) : valuation?.prices[b.asset];
    if (price === undefined || rate === null) return null;
    return (Number(b.total) + Number(b.unrealized ?? 0)) * price * rate;
  };
  const money = (v: number) =>
    new Intl.NumberFormat(lang === "zh" ? "zh-TW" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2,
    }).format(v);
  const groups = WALLETS.map((wallet) => {
    const rows = wallets.balances
      .filter((b) => b.wallet === wallet)
      .map((b) => ({ b, value: valueOf(b) }))
      .sort((x, y) => (y.value ?? -1) - (x.value ?? -1));
    return {
      wallet,
      rows,
      subtotal: rows.reduce((sum, r) => sum + (r.value ?? 0), 0),
      unknown: rows.some((r) => r.value === null),
    };
  }).filter((g) => g.rows.length);
  const shown = view === "all" ? groups : groups.filter((g) => g.wallet === view);
  const total = shown.reduce((sum, g) => sum + g.subtotal, 0);
  const unknown = shown.some((g) => g.unknown);
  const present = new Set(groups.map((g) => g.wallet));
  const tabs: Array<"all" | Wallet> = ["all", ...WALLETS.filter((w) => present.has(w))];
  const showPositions = view === "all" || CONTRACT_WALLETS.includes(view);
  const showBots = wallets.bots.length > 0 && (view === "all" || view === "bot");
  // Every connected account's worth, and all of them together (shown when there are several).
  const accounts = connections.map((c) => {
    const w = allWallets[c.id];
    const values = (w?.balances ?? []).map(valueOf);
    return {
      connection: c,
      loaded: Boolean(w),
      value: values.reduce<number>((sum, v) => sum + (v ?? 0), 0),
      unknown: values.some((v) => v === null),
    };
  });
  const grand = accounts.reduce((sum, a) => sum + a.value, 0);
  const grandUnknown = accounts.some((a) => a.unknown || !a.loaded);
  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      {connections.length > 1 && (
        <div className="rounded-md border px-2 py-1.5">
          <div className="text-muted-foreground">{tr.allAccounts}</div>
          <div className="text-lg font-semibold tabular-nums">
            {rate === null ? "–" : `${grandUnknown ? "≈ " : ""}${money(grand)}`}
          </div>
          <div className="mt-1 flex flex-col">
            {accounts.map((a) => (
              <button
                key={a.connection.id}
                type="button"
                className={cn(
                  "flex items-center justify-between rounded px-1 py-0.5 text-left hover:bg-muted/60",
                  a.connection.id === connection.id ? "font-medium" : "text-muted-foreground",
                )}
                onClick={() => {
                  trade.set({ selected: a.connection.id });
                  setState((s) => ({ trade: { ...s.trade, connection: a.connection.id } }));
                }}
              >
                <span>
                  {EXCHANGE_NAMES[a.connection.exchange] ?? a.connection.exchange} · {a.connection.label}
                </span>
                <span className="tabular-nums">
                  {!a.loaded || rate === null ? "–" : `${a.unknown ? "≈ " : ""}${money(a.value)}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            className={cn(
              "rounded-md px-2 py-0.5 hover:bg-muted",
              view === key ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
            )}
            onClick={() => setView(key)}
          >
            {tr.walletTabs[key]}
          </button>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{tr.total}</span>
          <select
            className="h-6 rounded-md border bg-background px-1 text-xs"
            value={currency}
            onChange={(e) => setState((s) => ({ trade: { ...s.trade, currency: e.target.value } }))}
            aria-label={tr.currency}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="text-lg font-semibold tabular-nums">
          {rate === null ? "–" : `${unknown ? "≈ " : ""}${money(total)}`}
        </div>
        <p className="text-muted-foreground">{tr.valueHint}</p>
      </div>
      {shown.map((g) => {
        const fold = folds[g.wallet] ?? "all";
        const rows = fold === "none" ? [] : fold === "top" ? g.rows.slice(0, TOP) : g.rows;
        const cycle = () => setFolds((f) => ({ ...f, [g.wallet]: NEXT_FOLD[fold] }));
        return (
          <div key={g.wallet}>
            <button
              type="button"
              className="mb-1 flex w-full items-center justify-between rounded font-medium hover:bg-muted/60"
              onClick={cycle}
              title={tr.foldHint}
            >
              <span className="inline-flex items-center gap-1">
                <ChevronRightIcon
                  className={cn("size-3.5 transition-transform", fold !== "none" && "rotate-90")}
                />
                {tr.wallets[g.wallet]}
                <span className="font-normal text-muted-foreground">· {g.rows.length}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {rate === null ? "" : money(g.subtotal)}
              </span>
            </button>
            <div className="flex flex-col">
              {rows.map(({ b, value }) => (
                <div key={b.asset} className="flex items-center justify-between gap-2 py-0.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                    onClick={() => void openAssetChart(b.asset, tr.noChart)}
                  >
                    <CoinIcon asset={b.asset} />
                    {b.asset.replace(/^EQ_/, "")}
                  </button>
                  <span className="text-right tabular-nums">
                    <span className="block">
                      {fmtDec(b.total)}
                      {b.unrealized && Number(b.unrealized) !== 0
                        ? ` (${Number(b.unrealized) > 0 ? "+" : ""}${fmtDec(b.unrealized)})`
                        : ""}
                    </span>
                    <span className="block text-muted-foreground">{value === null ? "–" : money(value)}</span>
                  </span>
                </div>
              ))}
              {fold === "top" && g.rows.length > TOP && (
                <button
                  type="button"
                  className="py-0.5 text-left text-muted-foreground hover:text-foreground"
                  onClick={cycle}
                >
                  {tr.more(g.rows.length - TOP)}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {showPositions && (
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
                        className="inline-flex items-center gap-1.5 font-medium hover:text-primary hover:underline"
                        onClick={() => void openPositionChart(p.symbol, tr.noChart)}
                      >
                        <CoinIcon asset={symbolBase(p.symbol)} />
                        {p.symbol}
                        <span className="font-normal text-muted-foreground">{tr.product[p.product]}</span>
                      </button>
                      <span className={long ? UP : DOWN}>
                        {fmtDec(p.qty)}
                        {p.product === "coinm" ? ` ${tr.contracts}` : ""} · {p.leverage ?? "–"}x{" "}
                        {p.marginType ?? ""}
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
      )}
      {showBots && <Bots bots={wallets.bots} prices={valuation?.prices} />}
    </div>
  );
}

// The exchange's trading bots (Pionex grids): the running ones as cards with what they were given,
// hold and made so far; the finished ones folded into a list. The unrealized part of a futures
// grid's position is estimated here from Binance's price (the exchange doesn't report it).
function Bots({ bots, prices }: { bots: TradeBot[]; prices?: Record<string, number> }) {
  const { t } = useLocale();
  const tr = t.coinhub.account;
  const [showFinished, setShowFinished] = useState(false);
  const running = bots.filter((b) => b.status === "running");
  const finished = bots.filter((b) => b.status !== "running");
  const money = (v: string | null, max = 4) => fmtDec(v, max);
  const signed = (v: string | null) => {
    if (v === null || v === undefined) return "–";
    return `${Number(v) > 0 ? "+" : ""}${fmtDec(v, 4)}`;
  };
  const tone = (v: string | null) => (v === null ? undefined : Number(v) >= 0 ? UP : DOWN);
  const card = (b: TradeBot) => {
    const qty = Number(b.qty ?? 0);
    const entry = Number(b.entryPrice ?? 0);
    const price = prices?.[b.base];
    const futures = b.type.startsWith("future");
    const unrealized =
      futures && qty && entry && price ? (price - entry) * qty * (b.side === "short" ? -1 : 1) : null;
    return (
      <div key={b.id} className="rounded-md border px-2 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-medium hover:text-primary hover:underline"
            onClick={() => void openPositionChart(b.symbol, tr.noChart)}
          >
            <CoinIcon asset={b.base} />
            {b.base}/{b.quote}
            <span className="font-normal text-muted-foreground">
              {tr.botTypes[b.type] ?? b.type}
              {b.side ? ` · ${tr.botSide[b.side] ?? b.side}` : ""}
              {b.leverage ? ` · ${b.leverage}x` : ""}
            </span>
          </button>
          <span className={cn("shrink-0", b.status === "running" ? UP : "text-muted-foreground")}>
            {b.status === "running" ? tr.botRunning : tr.botFinished}
          </span>
        </div>
        {b.name && <p className="text-muted-foreground">{b.name}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-muted-foreground">
          <Row label={tr.botInvestment} value={`${money(b.investment)} ${b.quote}`} />
          {b.margin && <Row label={tr.botMargin} value={`${money(b.margin)} ${b.quote}`} />}
          {qty !== 0 && (
            <Row
              label={tr.botPosition}
              value={`${fmtDec(b.qty)} ${b.base}${entry ? ` @ ${fmtDec(b.entryPrice, 4)}` : ""}`}
            />
          )}
          {unrealized !== null && (
            <Row
              label={tr.upnl}
              value={`${unrealized > 0 ? "+" : ""}${fmtDec(unrealized.toFixed(4), 4)} ${b.quote}`}
              tone={unrealized >= 0 ? UP : DOWN}
            />
          )}
          {b.gridProfit !== null && (
            <Row
              label={tr.botGridProfit}
              value={`${signed(b.gridProfit)} ${b.quote}`}
              tone={tone(b.gridProfit)}
            />
          )}
          {b.realizedPnl !== null && (
            <Row
              label={tr.botRealized}
              value={`${signed(b.realizedPnl)} ${b.quote}`}
              tone={tone(b.realizedPnl)}
            />
          )}
          {b.fee !== null && Number(b.fee) !== 0 && (
            <Row label={tr.botFee} value={`${money(b.fee)} ${b.quote}`} />
          )}
          {b.funding !== null && Number(b.funding) !== 0 && (
            <Row label={tr.botFunding} value={`${signed(b.funding)} ${b.quote}`} tone={tone(b.funding)} />
          )}
          {b.top && b.bottom && (
            <Row
              label={tr.botRange}
              value={`${fmtDec(b.bottom, 4)} – ${fmtDec(b.top, 4)}${b.rows ? ` · ${tr.botRows(b.rows)}` : ""}`}
            />
          )}
          {b.liquidationPrice && <Row label={tr.liq} value={fmtDec(b.liquidationPrice, 4)} />}
          {b.pairs !== null && <Row label={tr.botPairs(b.pairs)} value="" />}
        </dl>
        <p className="text-muted-foreground">
          {b.createdAt ? tr.botSince(fmtDate(b.createdAt)) : ""}
          {b.closedAt ? ` · ${tr.botClosed(fmtDate(b.closedAt))}` : ""}
        </p>
      </div>
    );
  };
  return (
    <div>
      <div className="mb-1 font-medium">{tr.bots}</div>
      <p className="mb-1 text-muted-foreground">{tr.botHint}</p>
      {running.length === 0 && finished.length === 0 ? (
        <p className="text-muted-foreground">{tr.noBots}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {running.map(card)}
          {finished.length > 0 && (
            <button
              type="button"
              className="flex items-center gap-1 text-left text-muted-foreground hover:text-foreground"
              onClick={() => setShowFinished((v) => !v)}
            >
              <ChevronRightIcon
                className={cn("size-3.5 transition-transform", showFinished && "rotate-90")}
              />
              {tr.showFinishedBots(finished.length)}
            </button>
          )}
          {showFinished && finished.map(card)}
        </div>
      )}
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
      ? fillSources(symbol, connection.exchange).every(
          (src) => s.fills[fillsKey(connection.id, src.product, src.symbol)],
        )
      : true,
  );
  const rows = useMemo(() => fills.slice().reverse(), [fills]);
  if (!symbol || !fillSources(symbol, connection.exchange).length)
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
            {fill.symbol ? ` · ${fill.symbol}` : ""}
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
  // The products read symbol by symbol at this exchange (none at Bybit: whole streams).
  const trackable: TradeProduct[] =
    connection.exchange === "binance"
      ? ["spot", "coinm"]
      : connection.exchange === "pionex"
        ? ["spot", "usdm"]
        : [];
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
        <p className="text-muted-foreground">{trackable.length ? tr.trackedHint : tr.trackedStream}</p>
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
        {trackable.length > 0 && (
          <form
            className="mt-1 flex gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <select
              className="h-7 rounded-md border bg-background px-1 text-xs"
              value={trackable.includes(product) ? product : trackable[0]}
              onChange={(e) => setProduct(e.target.value as TradeProduct)}
            >
              {trackable.map((p) => (
                <option key={p} value={p}>
                  {tr.product[p]}
                </option>
              ))}
            </select>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={tr.symbolPlaceholders[connection.exchange] ?? tr.symbolPlaceholder}
              className="h-7 flex-1 font-mono text-xs uppercase"
            />
            <Button type="submit" size="sm" variant="outline" disabled={busy || !symbol.trim()}>
              {tr.addSymbol}
            </Button>
          </form>
        )}
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

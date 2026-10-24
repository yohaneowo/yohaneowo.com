"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { Crosshair, Overlay } from "klinecharts";
import {
  BellPlusIcon,
  ChevronsRightIcon,
  CopyIcon,
  Loader2Icon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SettingsIcon,
  StepForwardIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/i18n/locale-provider";
import {
  ChartController,
  type GridLines,
  type ReplayState,
  type ThemeColors,
} from "@/lib/coinhub/chart-controller";
import { resolveSymbol } from "@/lib/coinhub/datafeed";
import { fmtNumber } from "@/lib/coinhub/format";
import { getInterval } from "@/lib/coinhub/intervals";
import {
  loadDrawings,
  onDrawingsSaved,
  saveDrawings,
  setState,
  updateChart,
  useTerminal,
  alertPrice,
  getState,
  type ChartConfig,
  type HoldingLineStyle,
} from "@/lib/coinhub/store";
import {
  costBasis,
  fillSources,
  gridLevels,
  isContract,
  loadWallets,
  trade,
  useChartFills,
  useTrade,
} from "@/lib/coinhub/trade";
import type { CoinSymbol } from "@/lib/coinhub/types";
import {
  accountTag,
  biasColor,
  chartSymbolKey,
  LEVEL_COLORS,
  postLevels,
  postOnChart,
  useXPosts,
  xPosts,
} from "@/lib/coinhub/x-posts";
import { COMPARE_COLORS, Legend } from "./legend";
import { SelectionToolbar } from "./selection-toolbar";
import { openDialog, registry, ui, useUi } from "./ui-store";

function themeColors(dark: boolean): ThemeColors {
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  return dark
    ? {
        dark,
        text: "#a1a1a1",
        grid: "rgba(255,255,255,0.05)",
        border: "rgba(255,255,255,0.1)",
        background: "#0a0a0a",
        crosshairLabel: "#404040",
        font,
      }
    : {
        dark,
        text: "#737373",
        grid: "rgba(0,0,0,0.05)",
        border: "#e5e5e5",
        background: "#ffffff",
        crosshairLabel: "#262626",
        font,
      };
}

export function timezoneOf(setting: string) {
  if (setting !== "browser") return setting;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type Menu = { x: number; y: number; price: number | null; timestamp: number | null; overlayId?: string };

export function ChartPanel({
  index,
  active,
  highlight,
}: {
  index: number;
  active: boolean;
  highlight: boolean;
}) {
  const { t, lang } = useLocale();
  const c = t.coinhub;
  const { resolvedTheme } = useTheme();
  const config: ChartConfig = useTerminal((s) => s.charts[index]);
  const settings = useTerminal((s) => s.settings);
  const tool = useTerminal((s) => s.tool);
  const cursor = useTerminal((s) => s.cursor);
  const magnet = useTerminal((s) => s.magnet);
  const stayInDrawing = useTerminal((s) => s.stayInDrawing);
  const drawingsLocked = useTerminal((s) => s.drawingsLocked);
  const drawingsHidden = useTerminal((s) => s.drawingsHidden);
  const indicatorsHidden = useTerminal((s) => s.indicatorsHidden);
  const alerts = useTerminal((s) => s.alerts);
  const paper = useTerminal((s) => s.paper);
  const selection = useUi((s) => s.selection);
  const emoji = useUi((s) => s.emoji);

  const containerRef = useRef<HTMLDivElement>(null);
  const [controller, setController] = useState<ChartController | null>(null);
  const [symbol, setSymbol] = useState<CoinSymbol | null>(null);
  const [status, setStatus] = useState({ loading: true, error: false, empty: false });
  const [crosshair, setCrosshair] = useState<Crosshair | null>(null);
  const [panes, setPanes] = useState<Array<{ id: string; top: number; height: number }>>([]);
  const [tick, setTick] = useState(0);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [replay, setReplay] = useState<ReplayState>({ mode: "off", speed: 1, time: null, ended: false });

  // Create the chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ctrl = new ChartController(el, {
      locale: lang === "zh" ? "zh-CN" : "en-US",
      timezone: timezoneOf(settings.timezone),
    });
    ctrl.setPersistence((symbolId, drawings) => saveDrawings(symbolId, drawings));
    registry.set(index, ctrl);
    setController(ctrl);
    let barTimer: ReturnType<typeof setTimeout> | null = null;
    const offs = [
      ctrl.on("status", setStatus),
      ctrl.on("crosshair", (ch) => setCrosshair(ch && ch.paneId ? ch : null)),
      ctrl.on("layout", () => setPanes(ctrl.getPanes())),
      ctrl.on("bar", () => {
        if (barTimer) return;
        barTimer = setTimeout(() => {
          barTimer = null;
          setTick((n) => n + 1);
        }, 250);
      }),
      ctrl.on("select", (overlay: Overlay | null) => {
        if (overlay) ui.set({ selection: { chart: index, overlay } });
        else if (ui.get().selection?.chart === index) ui.set({ selection: null });
      }),
      ctrl.on("drawings", () => {
        const sel = ui.get().selection;
        if (sel?.chart === index) {
          const fresh = ctrl.chart.getOverlays({ id: sel.overlay.id })[0];
          ui.set({ selection: fresh ? { chart: index, overlay: fresh } : null });
        }
      }),
      ctrl.on("toolDone", () => setState({ tool: null })),
      ctrl.on("contextMenu", (m) => setMenu(m)),
      ctrl.on("edit", (id) => openDialog({ type: "drawingSettings", chart: index, id })),
      ctrl.on("replay", setReplay),
      ctrl.on("alertMoved", ({ id, price }) =>
        setState((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, price } : a)) })),
      ),
      ctrl.on("orderMoved", ({ id, price }) =>
        setState((s) => ({
          paper: {
            ...s.paper,
            orders: s.paper.orders.map((o) => (o.id === id ? { ...o, price } : o)),
            positions: s.paper.positions.map((p) =>
              `tp_${p.symbolId}` === id
                ? { ...p, takeProfit: price }
                : `sl_${p.symbolId}` === id
                  ? { ...p, stopLoss: price }
                  : p,
            ),
          },
        })),
      ),
      // A fill mark opens the account panel on those fills.
      ctrl.on("fillMark", (ids) => {
        trade.set({ tab: "fills", highlight: ids });
        setState({ panel: "account", active: index });
      }),
      // A post mark opens the posts panel on those posts (the newest one's levels drawn).
      ctrl.on("postMark", (ids) => {
        xPosts.set({ highlight: ids, selected: ids[0] ?? null });
        setState((s) => ({ panel: "posts", active: index, posts: { ...s.posts, scope: "symbol" } }));
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      if (barTimer) clearTimeout(barTimer);
      registry.delete(index, ctrl);
      if (ui.get().selection?.chart === index) ui.set({ selection: null });
      ctrl.destroy();
    };
    // Settings / locale changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Symbol
  useEffect(() => {
    let cancelled = false;
    resolveSymbol(config.symbolId).then((s) => {
      if (cancelled) return;
      if (!s) {
        setStatus({ loading: false, error: true, empty: true });
        return;
      }
      setSymbol(s);
    });
    return () => {
      cancelled = true;
    };
  }, [config.symbolId]);

  useEffect(() => {
    if (!controller || !symbol) return;
    const interval = getInterval(config.interval);
    // Interval first so the symbol change triggers a single load.
    if (controller.getInterval()?.key !== interval.key && !controller.getSymbol())
      controller.setInterval(interval);
    controller.setSymbol(symbol);
    controller.setInterval(interval);
    controller.loadDrawings(symbol.id, loadDrawings(symbol.id));
  }, [controller, symbol, config.interval]);

  // Another chart showing the same symbol saved drawings: reload ours.
  useEffect(() => {
    if (!controller || !symbol) return;
    return onDrawingsSaved((symbolId) => {
      if (symbolId !== symbol.id) return;
      const saved = JSON.stringify(loadDrawings(symbolId));
      const mine = JSON.stringify(
        controller
          .getDrawings()
          .map((o) => o.id)
          .sort(),
      );
      const theirs = JSON.stringify((JSON.parse(saved) as Array<{ id: string }>).map((d) => d.id).sort());
      if (mine !== theirs || ui.get().selection?.chart !== index)
        controller.loadDrawings(symbolId, JSON.parse(saved));
    });
  }, [controller, symbol, index]);

  useEffect(() => {
    controller?.setChartType(config.chartType);
  }, [controller, config.chartType]);

  useEffect(() => {
    controller?.setAppearance(themeColors(resolvedTheme === "dark"), settings);
  }, [controller, resolvedTheme, settings]);

  useEffect(() => {
    controller?.setTimezone(timezoneOf(settings.timezone));
  }, [controller, settings.timezone]);

  useEffect(() => {
    controller?.setIndicators(config.indicators, indicatorsHidden);
  }, [controller, config.indicators, indicatorsHidden]);

  useEffect(() => {
    controller?.setScale(config.scale, config.invert);
  }, [controller, config.scale, config.invert]);

  useEffect(() => {
    controller?.setAxisWheel(settings.axisWheelTradingView);
  }, [controller, settings.axisWheelTradingView]);

  useEffect(() => {
    if (!controller || !symbol) return;
    let cancelled = false;
    const hidden = new Set(config.compareHidden ?? []);
    Promise.all(config.compare.map((id) => resolveSymbol(id))).then((list) => {
      if (cancelled) return;
      const symbols = list.flatMap((s, i) =>
        s && !hidden.has(s.id) ? [{ symbol: s, color: COMPARE_COLORS[i % COMPARE_COLORS.length] }] : [],
      );
      void controller.setCompare(symbols);
    });
    return () => {
      cancelled = true;
    };
  }, [controller, symbol, config.compare, config.compareHidden, config.interval]);

  useEffect(() => {
    controller?.setDrawingOptions({
      magnet,
      stayInDrawing,
      locked: drawingsLocked,
      hidden: drawingsHidden,
      eraser: cursor === "eraser",
    });
  }, [controller, magnet, stayInDrawing, drawingsLocked, drawingsHidden, cursor]);

  // The selected tool draws on the active chart.
  useEffect(() => {
    if (!controller) return;
    if (active && tool) controller.startTool(tool, tool === "emoji" ? { extendData: { emoji } } : undefined);
    else controller.cancelTool();
  }, [controller, active, tool, emoji]);

  // Alert and paper-trading lines for this symbol.
  const lines = useMemo(() => {
    if (!symbol) return { alerts: [], orders: [] };
    const orders = [
      ...paper.orders
        .filter((o) => o.symbolId === symbol.id)
        .map((o) => ({
          id: o.id,
          price: o.price,
          text: `${o.side === "buy" ? "BUY" : "SELL"} ${o.type.toUpperCase()} ${o.qty}`,
          color: o.side === "buy" ? "#089981" : "#f23645",
          draggable: true,
        })),
      ...paper.positions
        .filter((p) => p.symbolId === symbol.id)
        .flatMap((p) => [
          {
            id: `pos_${p.symbolId}`,
            price: p.avgPrice,
            text: `${p.qty > 0 ? "LONG" : "SHORT"} ${Math.abs(p.qty)}`,
            color: "#2962ff",
            draggable: false,
          },
          ...(p.takeProfit
            ? [{ id: `tp_${p.symbolId}`, price: p.takeProfit, text: "TP", color: "#089981", draggable: true }]
            : []),
          ...(p.stopLoss
            ? [{ id: `sl_${p.symbolId}`, price: p.stopLoss, text: "SL", color: "#f23645", draggable: true }]
            : []),
        ]),
    ];
    return { alerts: alerts.filter((a) => a.symbolId === symbol.id && !a.line), orders };
  }, [symbol, alerts, paper]);

  // The user's real fills on this symbol, from the exchange account the panel uses.
  const tradeShow = useTerminal((s) => s.trade.show);
  const tradeConnection = useTerminal((s) => s.trade.connection);
  const connections = useTrade((s) => s.connections);
  const accountId = tradeConnection ?? connections?.[0]?.id ?? null;
  const exchange = connections?.find((c) => c.id === accountId)?.exchange ?? "binance";
  const fillConnection = tradeShow || settings.showHoldingLines ? accountId : null;
  const fills = useChartFills(symbol, fillConnection);
  useEffect(() => {
    if (!controller) return;
    controller.setFillMarks(tradeShow ? fills : []);
  }, [controller, fills, tradeShow]);

  // X posts about this symbol: a mark on the candle each was written in, coloured by its view here;
  // the selected post's price levels as rays from that candle.
  const postsShow = useTerminal((s) => s.posts.show);
  const postsHidden = useTerminal((s) => s.posts.hidden);
  const allPosts = useXPosts((s) => s.posts);
  const selectedPost = useXPosts((s) => s.selected);
  const postKey = symbol ? chartSymbolKey(symbol) : null;
  const chartPosts = useMemo(() => {
    if (!postKey || !postsShow) return [];
    return allPosts
      .filter((p) => !postsHidden.includes(p.folder))
      .map((p) => ({ post: p, ...postOnChart(p, postKey) }))
      .filter((p) => p.on);
  }, [postKey, postsShow, postsHidden, allPosts]);
  useEffect(() => {
    if (!controller) return;
    controller.setPostMarks(
      chartPosts.map(({ post, bias }) => ({
        id: post.id,
        time: post.time,
        tag: accountTag(post.account),
        color: biasColor(bias),
      })),
      selectedPost,
    );
  }, [controller, chartPosts, selectedPost]);
  useEffect(() => {
    if (!controller) return;
    const post = postKey && postsShow ? allPosts.find((p) => p.id === selectedPost) : undefined;
    controller.setPostLevels(
      post && postKey
        ? postLevels(post, postKey).map((l) => ({
            time: post.time,
            price: l.price,
            text: `${accountTag(post.account)} ${c.posts.levelTypes[l.type]} ${l.price.toLocaleString("en-US", { maximumFractionDigits: 8 })}`,
            color: LEVEL_COLORS[l.type],
          }))
        : [],
    );
  }, [controller, postKey, postsShow, allPosts, selectedPost, c]);

  // Lines at what the account holds here: the cost of a spot / stock holding (from the fills), a
  // futures position's break-even and liquidation prices (from the exchange).
  const wallets = useTrade((s) => (accountId === null ? undefined : s.wallets[accountId]));
  useEffect(() => {
    if (accountId === null || !(settings.showHoldingLines || settings.showGridLines)) return;
    loadWallets(accountId).catch(() => {});
  }, [accountId, settings.showHoldingLines, settings.showGridLines]);
  const holdingLines = useMemo(() => {
    if (!symbol || !settings.showHoldingLines) return [];
    const l = c.account.lines;
    const st = settings.holdingStyles;
    const out: Array<{ id: string; price: number; title: string } & HoldingLineStyle> = [];
    const cost = costBasis(fills);
    if (cost) out.push({ id: "cost", price: cost.avg, title: l.cost, ...st.cost });
    const contracts = fillSources(symbol, exchange).filter((s) => isContract(s.product));
    const position = wallets?.positions.find(
      (p) => contracts.some((s) => s.product === p.product && s.symbol === p.symbol) && Number(p.qty) !== 0,
    );
    if (position) {
      const breakEven = Number(position.breakEvenPrice ?? position.entryPrice);
      if (breakEven > 0) out.push({ id: "breakEven", price: breakEven, title: l.breakEven, ...st.breakEven });
      const liquidation = Number(position.liquidationPrice);
      if (liquidation > 0)
        out.push({ id: "liquidation", price: liquidation, title: l.liquidation, ...st.liquidation });
    }
    return out;
  }, [symbol, exchange, settings.showHoldingLines, settings.holdingStyles, fills, wallets, c]);

  useEffect(() => {
    if (!controller || status.loading) return;
    controller.setAlertLines(lines.alerts, lines.orders);
  }, [controller, lines, status.loading]);

  useEffect(() => {
    if (!controller || status.loading) return;
    controller.setHoldingLines(holdingLines);
  }, [controller, holdingLines, status.loading]);

  // The levels of the account's running grid bots on this symbol (Pionex), tagged buy below the
  // price and sell above it, in the candle colours.
  const gridLines = useMemo<GridLines[]>(() => {
    if (!symbol || !settings.showGridLines || !wallets?.bots.length) return [];
    const sources = fillSources(symbol, exchange).map((s) => s.symbol);
    const side = c.account.side;
    return wallets.bots
      .filter((b) => b.status === "running" && sources.includes(b.symbol))
      .map((b) => ({
        id: b.id,
        levels: gridLevels(b),
        buy: { text: side.BUY, color: settings.upColor },
        sell: { text: side.SELL, color: settings.downColor },
      }))
      .filter((g) => g.levels.length);
  }, [symbol, exchange, settings.showGridLines, settings.upColor, settings.downColor, wallets, c]);
  useEffect(() => {
    if (!controller || status.loading) return;
    controller.setGridLines(gridLines);
  }, [controller, gridLines, status.loading]);

  const sel = selection?.chart === index ? selection.overlay : null;
  const precision = symbol?.pricePrecision ?? 2;
  const menuPrice = menu?.price != null ? fmtNumber(menu.price, precision) : null;
  const interval = getInterval(config.interval);
  // Alerts can be set on horizontal levels (fixed price) and trend lines (price along the line).
  const menuOverlay = menu?.overlayId ? controller?.chart.getOverlays({ id: menu.overlayId })[0] : undefined;
  const menuAlert: { price: number; line?: [number, number, number, number] } | null = (() => {
    const [p1, p2] = menuOverlay?.points ?? [];
    if (!menuOverlay || p1?.value === undefined) return null;
    if (
      ["horizontalLine", "horizontalRay", "priceLabel", "priceNote", "priceLine"].includes(menuOverlay.name)
    )
      return { price: p1.value };
    if (
      ["trendLine", "ray", "extendedLine"].includes(menuOverlay.name) &&
      p2?.value !== undefined &&
      p1.timestamp &&
      p2.timestamp
    ) {
      const line: [number, number, number, number] = [p1.timestamp, p1.value, p2.timestamp, p2.value];
      return { price: alertPrice({ price: p1.value, line }), line };
    }
    return null;
  })();

  const toggleIndicator = (id: string) =>
    updateChart(index, (cfg) => ({
      indicators: cfg.indicators.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)),
    }));
  const removeIndicator = (id: string) =>
    updateChart(index, (cfg) => ({ indicators: cfg.indicators.filter((i) => i.id !== id) }));
  // Compared symbols: hidden ones stay in the legend; removing the last one leaves the percentage scale.
  const toggleCompare = (id: string) =>
    updateChart(index, (cfg) => {
      const hidden = cfg.compareHidden ?? [];
      return { compareHidden: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id] };
    });
  const removeCompare = (id: string) =>
    updateChart(index, (cfg) => {
      const compare = cfg.compare.filter((c) => c !== id);
      return {
        compare,
        compareHidden: (cfg.compareHidden ?? []).filter((h) => h !== id),
        ...(compare.length === 0 && cfg.scale === "percentage" ? { scale: "normal" as const } : {}),
      };
    });

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-background",
        highlight && "ring-1 ring-primary/40 ring-inset",
      )}
      // Shift + click measures, like TradingView. Started here, before the chart sees the click.
      onPointerDownCapture={(e) => {
        if (e.shiftKey && !getState().tool) controller?.startTool("measure");
      }}
    >
      {settings.watermark && symbol && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center text-foreground/[0.05] select-none">
          <div className="text-5xl font-bold tracking-tight sm:text-7xl">{symbol.display}</div>
          <div className="text-xl font-medium sm:text-2xl">
            {interval.key} · {symbol.description}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0",
          cursor === "dot" && "cursor-none",
          cursor === "arrow" && "[&_canvas]:cursor-default!",
        )}
      />
      {controller && (
        <Legend
          controller={controller}
          config={config}
          symbol={symbol}
          crosshair={crosshair}
          settings={settings}
          panes={panes}
          tick={tick}
          onToggle={toggleIndicator}
          onSettings={(id) => openDialog({ type: "indicatorSettings", chart: index, id })}
          onRemove={removeIndicator}
          onCompareToggle={toggleCompare}
          onCompareRemove={removeCompare}
        />
      )}
      {status.loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {!status.loading && (status.error || status.empty) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>{status.error ? c.loadFailed : c.noData}</p>
          {status.error && (
            <Button size="sm" variant="outline" onClick={() => controller?.scrollToRealtime()}>
              <RotateCcwIcon />
              {c.retry}
            </Button>
          )}
        </div>
      )}
      {controller && sel && <SelectionToolbar chart={index} controller={controller} overlay={sel} />}
      {controller && replay.mode !== "off" && (
        <ReplayBar controller={controller} replay={replay} labels={c.replay} />
      )}
      <DropdownMenu open={!!menu} onOpenChange={(open) => !open && setMenu(null)}>
        <DropdownMenuTrigger
          nativeButton={false}
          render={
            <span
              className="pointer-events-none absolute size-px"
              style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
            />
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          {menu?.overlayId ? (
            <>
              <DropdownMenuItem
                onClick={() => openDialog({ type: "drawingSettings", chart: index, id: menu.overlayId! })}
              >
                <SettingsIcon />
                {c.drawing.settings}
              </DropdownMenuItem>
              {menuAlert && (
                <DropdownMenuItem
                  onClick={() => openDialog({ type: "alert", symbolId: symbol?.id, ...menuAlert })}
                >
                  <BellPlusIcon />
                  {c.alerts.create}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => controller?.cloneDrawing(menu.overlayId!)}>
                <CopyIcon />
                {c.drawing.clone}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => controller?.updateDrawing(menu.overlayId!, { zLevel: 100 })}>
                {c.drawing.bringToFront}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => controller?.updateDrawing(menu.overlayId!, { zLevel: -100 })}>
                {c.drawing.sendToBack}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => controller?.removeDrawing(menu.overlayId!)}
              >
                <Trash2Icon />
                {c.drawing.remove}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => controller?.resetView()}>
                <RotateCcwIcon />
                {c.context.resetChart}
              </DropdownMenuItem>
              {menuPrice && symbol && menu?.price != null && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => openDialog({ type: "alert", price: menu.price!, symbolId: symbol.id })}
                  >
                    <BellPlusIcon />
                    {c.context.addAlert(menuPrice)}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      controller?.addDrawing("horizontalLine", [
                        { timestamp: menu.timestamp ?? undefined, value: menu.price! },
                      ])
                    }
                  >
                    <MinusIcon />
                    {c.context.horizontalLine(menuPrice)}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void navigator.clipboard?.writeText(String(menu.price));
                      toast.success(c.toolbar.copied);
                    }}
                  >
                    <CopyIcon />
                    {c.context.copyPrice(menuPrice)}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => controller?.removeAllDrawings()}>
                <Trash2Icon />
                {c.context.removeDrawings}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateChart(index, { indicators: [] })}>
                <XIcon />
                {c.context.removeIndicators}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openDialog({ type: "settings" })}>
                <SettingsIcon />
                {c.context.settings}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ReplayBar({
  controller,
  replay,
  labels,
}: {
  controller: ChartController;
  replay: ReplayState;
  labels: {
    selectStart: string;
    play: string;
    pause: string;
    forward: string;
    speed: string;
    exit: string;
    ended: string;
  };
}) {
  if (replay.mode === "selecting") {
    return (
      <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-popover px-3 py-1.5 text-sm shadow-md">
        {labels.selectStart}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => controller.stopReplay()}
          aria-label={labels.exit}
        >
          <XIcon />
        </Button>
      </div>
    );
  }
  return (
    <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-popover p-1 text-sm shadow-md">
      {replay.mode === "playing" ? (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => controller.replayPause()}
          aria-label={labels.pause}
          title={labels.pause}
        >
          <PauseIcon />
        </Button>
      ) : (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => controller.replayPlay()}
          aria-label={labels.play}
          title={labels.play}
          disabled={replay.ended}
        >
          <PlayIcon />
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => controller.replayStep()}
        aria-label={labels.forward}
        title={labels.forward}
        disabled={replay.ended}
      >
        <StepForwardIcon />
      </Button>
      <span className="px-1 text-xs text-muted-foreground">{labels.speed}</span>
      {[1, 3, 10].map((speed) => (
        <Button
          key={speed}
          size="xs"
          variant={replay.speed === speed ? "secondary" : "ghost"}
          onClick={() => controller.setReplaySpeed(speed)}
        >
          {speed}x
        </Button>
      ))}
      {replay.ended && <span className="px-2 text-xs text-muted-foreground">{labels.ended}</span>}
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => controller.stopReplay()}
        aria-label={labels.exit}
        title={labels.exit}
      >
        <ChevronsRightIcon />
      </Button>
    </div>
  );
}

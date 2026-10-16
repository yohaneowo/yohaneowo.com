"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlarmClockPlusIcon,
  CloudAlertIcon,
  CloudCheckIcon,
  CloudOffIcon,
  CloudUploadIcon,
  CameraIcon,
  ChevronDownIcon,
  CirclePlusIcon,
  GaugeIcon,
  Link2Icon,
  MaximizeIcon,
  MinimizeIcon,
  Redo2Icon,
  RewindIcon,
  SearchIcon,
  SettingsIcon,
  SquareFunctionIcon,
  StarIcon,
  Undo2Icon,
} from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import { INTERVALS, sortIntervals, supportsInterval, type IntervalKey } from "@/lib/coinhub/intervals";
import {
  LAYOUT_COUNT,
  setChartInterval,
  setState,
  updateChart,
  useTerminal,
  type ChartType,
  type LayoutKey,
} from "@/lib/coinhub/store";
import type { SyncStatus } from "@/lib/coinhub/sync";
import { useActiveSymbol } from "./hooks";
import { ChartTypeIcon } from "./tool-icons";
import { openDialog, useController, useUi } from "./ui-store";

const btn =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-foreground/85 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 data-[active=true]:text-primary aria-expanded:bg-muted";

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

const CHART_TYPES: ChartType[] = [
  "bars",
  "candles",
  "hollow",
  "heikinAshi",
  "line",
  "lineMarkers",
  "stepLine",
  "area",
  "baseline",
  "columns",
  "highLow",
];

const LAYOUTS: Array<{ key: LayoutKey; cells: string }> = [
  { key: "1", cells: "M3 3h14v14H3z" },
  { key: "2h", cells: "M3 3h6.5v14H3zM10.5 3H17v14h-6.5z" },
  { key: "2v", cells: "M3 3h14v6.5H3zM3 10.5h14V17H3z" },
  { key: "3", cells: "M3 3h6.5v14H3zM10.5 3H17v6.5h-6.5zM10.5 10.5H17V17h-6.5z" },
  { key: "4", cells: "M3 3h6.5v6.5H3zM10.5 3H17v6.5h-6.5zM3 10.5h6.5V17H3zM10.5 10.5H17V17h-6.5z" },
];

export function toggleFullscreen() {
  const el = document.getElementById("coinhub-root");
  if (!document.fullscreenElement) void el?.requestFullscreen?.();
  else void document.exitFullscreen?.();
}

export function TopToolbar({ syncStatus }: { syncStatus: SyncStatus }) {
  const { t, href } = useLocale();
  const c = t.coinhub;
  const { active, symbol, symbolId } = useActiveSymbol();
  const config = useTerminal((s) => s.charts[s.active]);
  const favIntervals = useTerminal((s) => s.favorites.intervals);
  const layout = useTerminal((s) => s.layout);
  const sync = useTerminal((s) => s.sync);
  const marketPanelOpen = useTerminal((s) => s.marketPanel.open);
  const fullscreen = useUi((s) => s.fullscreen);
  const controller = useController(active);
  const [, setHistoryTick] = useState(0);

  useEffect(() => {
    if (!controller) return;
    return controller.on("drawings", () => setHistoryTick((n) => n + 1));
  }, [controller]);

  const intervalLabel = (key: IntervalKey) => key;
  const toggleFavInterval = (key: IntervalKey) =>
    setState((s) => {
      const list = s.favorites.intervals.includes(key)
        ? s.favorites.intervals.filter((k) => k !== key)
        : [...s.favorites.intervals, key];
      return { favorites: { ...s.favorites, intervals: sortIntervals(list) } };
    });
  const groups = [
    ["seconds", c.toolbar.seconds],
    ["minutes", c.toolbar.minutes],
    ["hours", c.toolbar.hours],
    ["days", c.toolbar.days],
  ] as const;

  const shot = async (mode: "download" | "copy" | "open") => {
    const url = controller?.screenshot();
    if (!url) return;
    if (mode === "download") {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${symbol?.display ?? "chart"}_${config.interval}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`;
      a.click();
    } else if (mode === "copy") {
      try {
        const blob = await (await fetch(url)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        toast.success(c.toolbar.copied);
      } catch {
        toast.error(c.toolbar.copyFailed);
      }
    } else {
      const win = window.open();
      win?.document.write(`<img src="${url}" style="max-width:100%">`);
    }
  };

  return (
    <div className="flex h-11 shrink-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto border-b bg-background px-1.5">
      <Tip label={c.toolbar.symbolSearch}>
        <button
          type="button"
          className={cn(btn, "font-semibold")}
          onClick={() => openDialog({ type: "symbol", mode: "change" })}
        >
          <SearchIcon className="size-4" />
          {symbol?.display ?? symbolId.split(":")[1]}
        </button>
      </Tip>
      <Tip label={c.toolbar.compare}>
        <button type="button" className={btn} onClick={() => openDialog({ type: "symbol", mode: "compare" })}>
          <CirclePlusIcon className="size-4" />
        </button>
      </Tip>
      <Separator orientation="vertical" className="mx-1 h-5" />
      {favIntervals.map((key) => (
        <button
          key={key}
          type="button"
          className={cn(btn, "px-1.5")}
          data-active={config.interval === key}
          disabled={!supportsInterval(symbol, key)}
          onClick={() => setChartInterval(active, key)}
        >
          {intervalLabel(key)}
        </button>
      ))}
      <DropdownMenu>
        <Tip label={c.toolbar.intervals}>
          <DropdownMenuTrigger className={cn(btn, "px-1")}>
            {!favIntervals.includes(config.interval) && (
              <span className="text-primary">{config.interval}</span>
            )}
            <ChevronDownIcon className="size-3.5" />
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent className="max-h-[70vh] w-52">
          <DropdownMenuItem onClick={() => openDialog({ type: "interval", text: "" })}>
            {c.toolbar.customIntervalItem}
          </DropdownMenuItem>
          {!INTERVALS.some((i) => i.key === config.interval) && (
            <DropdownMenuItem onClick={() => toggleFavInterval(config.interval)} className="text-primary">
              <span className="flex-1">{config.interval}</span>
              <StarIcon
                className={cn(
                  "size-3.5",
                  favIntervals.includes(config.interval)
                    ? "fill-amber-500 text-amber-500"
                    : "text-muted-foreground",
                )}
              />
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {groups.map(([group, label]) => (
            <DropdownMenuGroup key={group}>
              <DropdownMenuLabel>{label}</DropdownMenuLabel>
              {INTERVALS.filter((i) => i.group === group).map((i) => (
                <DropdownMenuItem
                  key={i.key}
                  disabled={!supportsInterval(symbol, i.key)}
                  onClick={() => setChartInterval(active, i.key)}
                  className={cn(config.interval === i.key && "text-primary")}
                >
                  <span className="flex-1">{i.key}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    className="rounded p-0.5 hover:bg-background"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavInterval(i.key);
                    }}
                    aria-label={
                      favIntervals.includes(i.key) ? c.toolbar.removeFavorite : c.toolbar.addFavorite
                    }
                  >
                    <StarIcon
                      className={cn(
                        "size-3.5",
                        favIntervals.includes(i.key)
                          ? "fill-amber-500 text-amber-500"
                          : "text-muted-foreground",
                      )}
                    />
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <DropdownMenu>
        <Tip label={c.toolbar.chartType}>
          <DropdownMenuTrigger className={btn}>
            <ChartTypeIcon type={config.chartType} />
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent className="w-52">
          {CHART_TYPES.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => updateChart(active, { chartType: type })}
              className={cn(config.chartType === type && "text-primary")}
            >
              <ChartTypeIcon type={type} />
              {c.chartTypes[type]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip label={c.toolbar.indicatorsHint}>
        <button type="button" className={btn} onClick={() => openDialog({ type: "indicators" })}>
          <SquareFunctionIcon className="size-4" />
          <span className="hidden md:inline">{c.toolbar.indicators}</span>
        </button>
      </Tip>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tip label={c.toolbar.alert}>
        <button
          type="button"
          className={btn}
          onClick={() => {
            const list = controller?.chart.getDataList() ?? [];
            openDialog({ type: "alert", price: list[list.length - 1]?.close, symbolId });
          }}
        >
          <AlarmClockPlusIcon className="size-4" />
          <span className="hidden lg:inline">{c.toolbar.alert}</span>
        </button>
      </Tip>
      <Tip label={c.toolbar.replay}>
        <button type="button" className={btn} onClick={() => controller?.startReplaySelection()}>
          <RewindIcon className="size-4" />
          <span className="hidden lg:inline">{c.toolbar.replay}</span>
        </button>
      </Tip>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tip label={`${c.toolbar.undo} (Ctrl+Z)`}>
        <button
          type="button"
          className={btn}
          disabled={!controller?.canUndo()}
          onClick={() => controller?.undo()}
        >
          <Undo2Icon className="size-4" />
        </button>
      </Tip>
      <Tip label={`${c.toolbar.redo} (Ctrl+Y)`}>
        <button
          type="button"
          className={btn}
          disabled={!controller?.canRedo()}
          onClick={() => controller?.redo()}
        >
          <Redo2Icon className="size-4" />
        </button>
      </Tip>
      <div className="flex-1" />
      <Tip label={c.sync[syncStatus]}>
        {syncStatus === "off" ? (
          <Link href={href("/login")} className={cn(btn, "text-muted-foreground")} aria-label={c.sync.off}>
            <CloudOffIcon className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, syncStatus === "error" && "text-destructive")}>
            {syncStatus === "syncing" ? (
              <CloudUploadIcon className="size-4" />
            ) : syncStatus === "error" ? (
              <CloudAlertIcon className="size-4" />
            ) : (
              <CloudCheckIcon className="size-4" />
            )}
          </span>
        )}
      </Tip>
      <Tip label={c.marketPanel.toggle}>
        <button
          type="button"
          className={btn}
          data-active={marketPanelOpen}
          aria-pressed={marketPanelOpen}
          onClick={() => setState((s) => ({ marketPanel: { ...s.marketPanel, open: !s.marketPanel.open } }))}
        >
          <GaugeIcon className="size-4" />
          <span className="hidden lg:inline">{c.markets}</span>
        </button>
      </Tip>
      <DropdownMenu>
        <Tip label={c.toolbar.layout}>
          <DropdownMenuTrigger className={btn}>
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.4}>
              <path d={LAYOUTS.find((l) => l.key === layout)?.cells} />
            </svg>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex gap-1 p-1">
            {LAYOUTS.map((l) => (
              <button
                key={l.key}
                type="button"
                className={cn(
                  "rounded-md p-1.5 hover:bg-muted",
                  layout === l.key && "bg-primary/10 text-primary",
                )}
                title={
                  c.layout[
                    { "1": "single", "2h": "twoH", "2v": "twoV", "3": "three", "4": "four" }[
                      l.key
                    ] as keyof typeof c.layout
                  ]
                }
                onClick={() =>
                  setState((s) => ({ layout: l.key, active: s.active < LAYOUT_COUNT[l.key] ? s.active : 0 }))
                }
              >
                <svg
                  viewBox="0 0 20 20"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.2}
                >
                  <path d={l.cells} />
                </svg>
              </button>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <Link2Icon className="size-3.5" />
            {c.toolbar.sync}
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={sync.symbol}
            onCheckedChange={(v) => setState((s) => ({ sync: { ...s.sync, symbol: v } }))}
          >
            {c.toolbar.syncSymbol}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={sync.interval}
            onCheckedChange={(v) => setState((s) => ({ sync: { ...s.sync, interval: v } }))}
          >
            {c.toolbar.syncInterval}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={sync.crosshair}
            onCheckedChange={(v) => setState((s) => ({ sync: { ...s.sync, crosshair: v } }))}
          >
            {c.toolbar.syncCrosshair}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip label={c.toolbar.settings}>
        <button type="button" className={btn} onClick={() => openDialog({ type: "settings" })}>
          <SettingsIcon className="size-4" />
        </button>
      </Tip>
      <Tip label={fullscreen ? c.toolbar.exitFullscreen : c.toolbar.fullscreen}>
        <button type="button" className={btn} onClick={toggleFullscreen}>
          {fullscreen ? <MinimizeIcon className="size-4" /> : <MaximizeIcon className="size-4" />}
        </button>
      </Tip>
      <DropdownMenu>
        <Tip label={c.toolbar.screenshot}>
          <DropdownMenuTrigger className={btn}>
            <CameraIcon className="size-4" />
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => shot("download")}>{c.toolbar.downloadImage}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => shot("copy")}>{c.toolbar.copyImage}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => shot("open")}>{c.toolbar.openImage}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

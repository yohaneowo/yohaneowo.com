"use client";

import { EyeIcon, EyeOffIcon, SettingsIcon, XIcon } from "lucide-react";
import type { Crosshair, Indicator, KLineData } from "klinecharts";
import { cn } from "cn";
import { useLocale } from "@/i18n/locale-provider";
import { CANDLE_PANE, type ChartController } from "@/lib/coinhub/chart-controller";
import { INDICATOR_MAP } from "@/lib/coinhub/indicators";
import { fmtNumber, fmtCompact } from "@/lib/coinhub/format";
import type { ChartConfig, ChartSettings } from "@/lib/coinhub/store";
import type { CoinSymbol } from "@/lib/coinhub/types";

// The colours the chart panel gives compared symbols, by their place in the list.
export const COMPARE_COLORS = ["#ff9800", "#e91e63", "#00bcd4", "#9c27b0", "#4caf50"];

const PALETTE = ["#2962ff", "#ff6d00", "#e91e63", "#00bcd4", "#9c27b0", "#4caf50"];

type Pane = { id: string; top: number; height: number };

interface LegendProps {
  controller: ChartController;
  config: ChartConfig;
  symbol: CoinSymbol | null;
  crosshair: Crosshair | null;
  settings: ChartSettings;
  panes: Pane[];
  // Re-render on live bars.
  tick: number;
  onToggle: (id: string) => void;
  onSettings: (id: string) => void;
  onRemove: (id: string) => void;
  onCompareToggle: (id: string) => void;
  onCompareRemove: (id: string) => void;
}

function figureColor(
  indicator: Indicator,
  index: number,
  data: { prev: unknown; current: unknown; next: unknown },
) {
  const figure = indicator.figures[index];
  const fromStyles = (indicator.styles?.lines?.[index] as { color?: string } | undefined)?.color;
  if (fromStyles) return fromStyles;
  try {
    const custom = figure?.styles?.({
      data: data as never,
      indicator,
      barSpace: { bar: 0, halfBar: 0, gapBar: 0, halfGapBar: 0 },
    }) as { color?: string } | null;
    if (custom?.color) return custom.color;
  } catch {
    // Styles callbacks may expect real bar data.
  }
  return PALETTE[index % PALETTE.length];
}

function IndicatorRow({
  indicator,
  dataIndex,
  showValues,
  onToggle,
  onSettings,
  onRemove,
}: {
  indicator: Indicator;
  dataIndex: number;
  showValues: boolean;
  onToggle: () => void;
  onSettings: () => void;
  onRemove: () => void;
}) {
  const { t } = useLocale();
  const result = indicator.result as Array<Record<string, number | undefined>>;
  const index = Math.min(Math.max(0, dataIndex), result.length - 1);
  const row = result[index] ?? {};
  const data = { prev: result[index - 1] ?? null, current: row, next: result[index + 1] ?? null };
  const meta = INDICATOR_MAP[indicator.name];
  const title = meta ? indicator.shortName || indicator.name : indicator.name;
  const params = indicator.calcParams.length ? ` ${indicator.calcParams.join(" ")}` : "";
  return (
    <div className="group/legend pointer-events-auto flex max-w-full items-center gap-1.5 rounded px-1 text-xs hover:bg-background/80">
      <span className={cn("shrink-0", !indicator.visible && "text-muted-foreground line-through")}>
        {title}
        <span className="text-muted-foreground">{params}</span>
      </span>
      <span className="hidden items-center gap-0.5 group-hover/legend:flex">
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          onClick={onToggle}
          title={indicator.visible ? t.coinhub.legend.hide : t.coinhub.legend.show}
        >
          {indicator.visible ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
        </button>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          onClick={onSettings}
          title={t.coinhub.legend.settings}
        >
          <SettingsIcon className="size-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          onClick={onRemove}
          title={t.coinhub.legend.remove}
        >
          <XIcon className="size-3.5" />
        </button>
      </span>
      {showValues && indicator.visible && (
        <span className="flex min-w-0 flex-wrap gap-x-1.5 tabular-nums">
          {indicator.figures.map((f, i) => {
            const value = row[f.key];
            if (!f.title && value === undefined) return null;
            const text =
              value === undefined || !Number.isFinite(value)
                ? "∅"
                : indicator.shouldFormatBigNumber || Math.abs(value) >= 1e6
                  ? fmtCompact(value)
                  : fmtNumber(value, indicator.precision);
            return (
              <span key={f.key} style={{ color: figureColor(indicator, i, data) }}>
                {text}
              </span>
            );
          })}
        </span>
      )}
    </div>
  );
}

export function Legend({
  controller,
  config,
  symbol,
  crosshair,
  settings,
  panes,
  tick,
  onToggle,
  onSettings,
  onRemove,
  onCompareToggle,
  onCompareRemove,
}: LegendProps) {
  const { t } = useLocale();
  void tick;
  const list = controller.chart.getDataList();
  const dataIndex = crosshair?.kLineData ? (crosshair.dataIndex ?? list.length - 1) : list.length - 1;
  const bar: KLineData | undefined = crosshair?.kLineData ?? list[list.length - 1];
  const prev = list[Math.min(dataIndex, list.length - 1) - 1];
  const precision = symbol?.pricePrecision ?? 2;
  const change = bar && prev ? bar.close - prev.close : 0;
  const changePct = bar && prev && prev.close ? (change / prev.close) * 100 : 0;
  const color = bar ? (bar.close >= bar.open ? settings.upColor : settings.downColor) : undefined;
  const indicators = controller.chart.getIndicators().filter((i) => !i.name.startsWith("CH_"));
  const byPane = (paneId: string) => indicators.filter((i) => i.paneId === paneId);
  const row = (indicator: Indicator) => (
    <IndicatorRow
      key={indicator.id}
      indicator={indicator}
      dataIndex={dataIndex}
      showValues={settings.showIndicatorValues}
      onToggle={() => onToggle(indicator.id)}
      onSettings={() => onSettings(indicator.id)}
      onRemove={() => onRemove(indicator.id)}
    />
  );
  const compare = controller.getCompareSeries();

  return (
    <>
      <div className="pointer-events-none absolute top-1 left-2 z-10 flex max-w-[calc(100%-5rem)] flex-col items-start gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-sm font-medium">
            {symbol?.display ?? config.symbolId} · {config.interval} · {symbol?.exchange ?? ""}
          </span>
          {settings.showLegendValues && bar && (
            <span className="flex flex-wrap gap-x-2 tabular-nums">
              {(
                [
                  [t.coinhub.legend.open, bar.open],
                  [t.coinhub.legend.high, bar.high],
                  [t.coinhub.legend.low, bar.low],
                  [t.coinhub.legend.close, bar.close],
                ] as const
              ).map(([label, value]) => (
                <span key={label}>
                  <span className="text-muted-foreground">{label}</span>{" "}
                  <span style={{ color }}>{fmtNumber(value, precision)}</span>
                </span>
              ))}
              {prev && (
                <span style={{ color }}>
                  {change >= 0 ? "+" : ""}
                  {fmtNumber(change, precision)} ({change >= 0 ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </span>
              )}
              {bar.volume !== undefined && bar.volume > 0 && (
                <span>
                  <span className="text-muted-foreground">{t.coinhub.legend.volume}</span>{" "}
                  {fmtCompact(bar.volume)}
                </span>
              )}
            </span>
          )}
        </div>
        {config.compare.map((id, i) => {
          const series = compare.find((c) => c.id === id);
          const hidden = (config.compareHidden ?? []).includes(id);
          const price = series && bar ? series.closes[series.bucket(bar.timestamp)] : undefined;
          return (
            <div
              key={id}
              className={cn(
                "group/legend pointer-events-auto flex items-center gap-1.5 rounded px-1 text-xs hover:bg-background/80",
                hidden && "opacity-50",
              )}
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: series?.color ?? COMPARE_COLORS[i % COMPARE_COLORS.length] }}
              />
              <span>{series?.display ?? id.split(":")[1]}</span>
              {settings.showLegendValues && price !== undefined && (
                <span className="tabular-nums" style={{ color: series?.color }}>
                  {fmtNumber(price, price >= 100 ? 2 : 4)}
                </span>
              )}
              <span className="hidden items-center gap-0.5 group-hover/legend:flex">
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  title={hidden ? t.coinhub.legend.show : t.coinhub.legend.hide}
                  onClick={() => onCompareToggle(id)}
                >
                  {hidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  title={t.coinhub.legend.remove}
                  onClick={() => onCompareRemove(id)}
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            </div>
          );
        })}
        {byPane(CANDLE_PANE).map(row)}
      </div>
      {panes
        .filter((p) => p.id !== CANDLE_PANE)
        .map((pane) => {
          const items = byPane(pane.id);
          if (!items.length) return null;
          return (
            <div
              key={pane.id}
              className="pointer-events-none absolute left-2 z-10 flex max-w-[calc(100%-5rem)] flex-col items-start"
              style={{ top: pane.top + 2 }}
            >
              {items.map(row)}
            </div>
          );
        })}
    </>
  );
}

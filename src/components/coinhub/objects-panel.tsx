"use client";

import { useEffect, useState } from "react";
import type { Crosshair } from "klinecharts";
import { EyeIcon, EyeOffIcon, LockIcon, LockOpenIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocale } from "@/i18n/locale-provider";
import { fmtCompact, fmtNumber } from "@/lib/coinhub/format";
import { INDICATOR_MAP } from "@/lib/coinhub/indicators";
import { updateChart, useTerminal } from "@/lib/coinhub/store";
import { timezoneOf } from "./chart-panel";
import { useActiveSymbol } from "./hooks";
import { ToolIcon } from "./tool-icons";
import { openDialog, useController } from "./ui-store";

const iconBtn = "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground";

export function ObjectTree() {
  const { t } = useLocale();
  const c = t.coinhub;
  const active = useTerminal((s) => s.active);
  const indicators = useTerminal((s) => s.charts[s.active].indicators);
  const controller = useController(active);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!controller) return;
    const offs = [
      controller.on("drawings", () => setTick((n) => n + 1)),
      controller.on("select", () => setTick((n) => n + 1)),
    ];
    return () => offs.forEach((off) => off());
  }, [controller]);

  const drawings = controller?.getDrawings() ?? [];
  const selected = controller?.getSelectedId();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b px-3 text-sm font-medium">
        {c.panels.objects}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {c.panels.indicators}
        </div>
        {indicators.map((ind) => (
          <div
            key={ind.id}
            className="group/obj flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/60"
          >
            <span className={cn("flex-1 truncate", !ind.visible && "text-muted-foreground line-through")}>
              {INDICATOR_MAP[ind.name]?.title ?? ind.name}
              <span className="text-muted-foreground"> {ind.calcParams.join(", ")}</span>
            </span>
            <button
              type="button"
              className={iconBtn}
              onClick={() =>
                updateChart(active, (cfg) => ({
                  indicators: cfg.indicators.map((i) =>
                    i.id === ind.id ? { ...i, visible: !i.visible } : i,
                  ),
                }))
              }
            >
              {ind.visible ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
            </button>
            <button
              type="button"
              className={iconBtn}
              onClick={() => openDialog({ type: "indicatorSettings", chart: active, id: ind.id })}
            >
              <SettingsIcon className="size-3.5" />
            </button>
            <button
              type="button"
              className={cn(iconBtn, "hover:text-destructive")}
              onClick={() =>
                updateChart(active, (cfg) => ({ indicators: cfg.indicators.filter((i) => i.id !== ind.id) }))
              }
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </div>
        ))}
        <div className="px-3 pt-4 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {c.panels.drawings}
        </div>
        {drawings.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">{c.panels.noDrawings}</p>
        )}
        {drawings.map((ov) => {
          const ext = (ov.extendData ?? {}) as {
            locked?: boolean;
            hidden?: boolean;
            text?: string;
            emoji?: string;
          };
          return (
            <div
              key={ov.id}
              className={cn(
                "group/obj flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/60",
                selected === ov.id && "bg-primary/10",
              )}
              onClick={() => openDialog({ type: "drawingSettings", chart: active, id: ov.id })}
            >
              <ToolIcon name={ov.name} className="size-4 shrink-0 text-muted-foreground" />
              <span className={cn("flex-1 truncate", ext.hidden && "text-muted-foreground")}>
                {ov.name === "emoji" ? ext.emoji : (c.tools.names[ov.name] ?? ov.name)}
                {ext.text && <span className="text-muted-foreground"> · {ext.text}</span>}
              </span>
              <button
                type="button"
                className={iconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  controller?.updateDrawing(ov.id, { visible: Boolean(ext.hidden) });
                }}
              >
                {ext.hidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  controller?.updateDrawing(ov.id, { lock: !ext.locked });
                }}
              >
                {ext.locked ? <LockIcon className="size-3.5" /> : <LockOpenIcon className="size-3.5" />}
              </button>
              <button
                type="button"
                className={cn(iconBtn, "hover:text-destructive")}
                onClick={(e) => {
                  e.stopPropagation();
                  controller?.removeDrawing(ov.id);
                }}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}

export function DataWindow() {
  const { t } = useLocale();
  const c = t.coinhub;
  const active = useTerminal((s) => s.active);
  const tz = useTerminal((s) => s.settings.timezone);
  const controller = useController(active);
  const { symbol } = useActiveSymbol();
  const [crosshair, setCrosshair] = useState<Crosshair | null>(null);

  useEffect(() => {
    if (!controller) return;
    return controller.on("crosshair", (ch) => setCrosshair(ch?.kLineData ? ch : null));
  }, [controller]);

  const list = controller?.chart.getDataList() ?? [];
  const index = crosshair?.dataIndex ?? list.length - 1;
  const bar = crosshair?.kLineData ?? list[list.length - 1];
  const prev = list[index - 1];
  const precision = symbol?.pricePrecision ?? 2;
  const indicators = controller?.chart.getIndicators().filter((i) => !i.name.startsWith("CH_")) ?? [];

  const row = (label: string, value: string, color?: string) => (
    <div key={label} className="flex justify-between gap-3 px-3 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center border-b px-3 text-sm font-medium">{c.panels.data}</div>
      <ScrollArea className="min-h-0 flex-1 py-2">
        {!bar && <p className="px-3 text-xs text-muted-foreground">{c.dataWindow.hint}</p>}
        {bar && (
          <>
            <div className="px-3 pb-1 text-xs font-medium">{symbol?.display}</div>
            {row(
              c.dataWindow.date,
              new Intl.DateTimeFormat("en-GB", {
                timeZone: timezoneOf(tz),
                dateStyle: "medium",
                timeStyle: "short",
              }).format(bar.timestamp),
            )}
            {row(c.legend.open, fmtNumber(bar.open, precision))}
            {row(c.legend.high, fmtNumber(bar.high, precision))}
            {row(c.legend.low, fmtNumber(bar.low, precision))}
            {row(c.legend.close, fmtNumber(bar.close, precision))}
            {prev &&
              row(
                c.legend.change,
                `${fmtNumber(bar.close - prev.close, precision)} (${(((bar.close - prev.close) / prev.close) * 100).toFixed(2)}%)`,
                bar.close >= prev.close ? "#089981" : "#f23645",
              )}
            {bar.volume !== undefined && row(c.legend.volume, fmtCompact(bar.volume))}
            {indicators.map((ind) => {
              const result = (ind.result[index] ?? {}) as Record<string, number | undefined>;
              return (
                <div key={ind.id} className="pt-2">
                  <div className="px-3 pb-0.5 text-xs font-medium">
                    {ind.shortName || ind.name}{" "}
                    <span className="text-muted-foreground">{ind.calcParams.join(", ")}</span>
                  </div>
                  {ind.figures.map((f) =>
                    row(
                      f.title?.replace(/:\s*$/, "") || f.key,
                      result[f.key] === undefined
                        ? "∅"
                        : ind.shouldFormatBigNumber
                          ? fmtCompact(result[f.key]!)
                          : fmtNumber(result[f.key]!, ind.precision),
                    ),
                  )}
                </div>
              );
            })}
          </>
        )}
      </ScrollArea>
    </div>
  );
}

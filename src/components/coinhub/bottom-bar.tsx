"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/i18n/locale-provider";
import { supportsInterval, type IntervalKey } from "@/lib/coinhub/intervals";
import { setChartInterval, setState, updateChart, useTerminal } from "@/lib/coinhub/store";
import { timezoneOf } from "./chart-panel";
import { useActiveSymbol } from "./hooks";
import { openDialog, registry } from "./ui-store";

const DAY = 86_400_000;

// TradingView's range buttons and the interval each one switches to.
const RANGES: Array<{ key: string; interval: IntervalKey; ms: () => number | "all" }> = [
  { key: "1D", interval: "1m", ms: () => DAY },
  { key: "5D", interval: "5m", ms: () => 5 * DAY },
  { key: "1M", interval: "30m", ms: () => 30 * DAY },
  { key: "3M", interval: "1h", ms: () => 90 * DAY },
  { key: "6M", interval: "2h", ms: () => 180 * DAY },
  { key: "YTD", interval: "1D", ms: () => Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1) },
  { key: "1Y", interval: "1D", ms: () => 365 * DAY },
  { key: "5Y", interval: "1W", ms: () => 5 * 365 * DAY },
  { key: "All", interval: "1M", ms: () => "all" },
];

export const TIMEZONES = [
  "browser",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
];

function offsetLabel(timezone: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return (part?.value ?? "UTC").replace("GMT", "UTC");
  } catch {
    return "UTC";
  }
}

function Clock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="tabular-nums">
      {new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(now)}{" "}
      ({offsetLabel(timezone)})
    </span>
  );
}

const btn =
  "flex h-7 items-center gap-1 rounded-md px-2 text-xs text-foreground/80 hover:bg-muted hover:text-foreground data-[active=true]:text-primary";

export function BottomBar() {
  const { t } = useLocale();
  const b = t.coinhub.bottom;
  const { active, symbol } = useActiveSymbol();
  const config = useTerminal((s) => s.charts[s.active]);
  const tz = useTerminal((s) => s.settings.timezone);
  const timezone = timezoneOf(tz);

  const applyRange = (range: (typeof RANGES)[number]) => {
    const interval = supportsInterval(symbol, range.interval) ? range.interval : "1D";
    const ctrl = registry.get(active);
    if (!ctrl) return;
    const ms = range.ms();
    if (interval === config.interval) {
      ctrl.showRange(ms);
      return;
    }
    const off = ctrl.on("status", (s) => {
      if (s.loading) return;
      off();
      requestAnimationFrame(() => ctrl.showRange(ms));
    });
    setChartInterval(active, interval);
  };

  return (
    <div className="flex h-8 shrink-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto border-t bg-background px-1.5">
      {RANGES.map((r) => (
        <Tooltip key={r.key}>
          <TooltipTrigger render={<button type="button" className={btn} onClick={() => applyRange(r)} />}>
            {r.key}
          </TooltipTrigger>
          <TooltipContent side="top">{b.ranges[r.key]}</TooltipContent>
        </Tooltip>
      ))}
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className={btn}
              onClick={() => openDialog({ type: "goto" })}
              aria-label={b.goTo}
            />
          }
        >
          <CalendarIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top">{b.goTo}</TooltipContent>
      </Tooltip>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger className={btn}>
          <Clock timezone={timezone} />
          <ChevronDownIcon className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="max-h-80 w-64">
          {TIMEZONES.map((zone) => (
            <DropdownMenuItem
              key={zone}
              className={cn(tz === zone && "text-primary")}
              onClick={() => setState((s) => ({ settings: { ...s.settings, timezone: zone } }))}
            >
              <span className="flex-1">{zone === "browser" ? b.browserTime : zone.replace("_", " ")}</span>
              <span className="text-xs text-muted-foreground">{offsetLabel(timezoneOf(zone))}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <button
        type="button"
        className={btn}
        data-active={config.scale === "percentage"}
        title={b.percent}
        onClick={() =>
          updateChart(active, { scale: config.scale === "percentage" ? "normal" : "percentage" })
        }
      >
        %
      </button>
      <button
        type="button"
        className={btn}
        data-active={config.scale === "logarithm"}
        title={`${b.log} (Alt+L)`}
        onClick={() => updateChart(active, { scale: config.scale === "logarithm" ? "normal" : "logarithm" })}
      >
        log
      </button>
      <button
        type="button"
        className={btn}
        data-active={config.invert}
        title={`${b.invert} (Alt+I)`}
        onClick={() => updateChart(active, { invert: !config.invert })}
      >
        inv
      </button>
      <button
        type="button"
        className={btn}
        title={b.auto}
        onClick={() => registry.get(active)?.setScale(config.scale, config.invert)}
      >
        auto
      </button>
    </div>
  );
}

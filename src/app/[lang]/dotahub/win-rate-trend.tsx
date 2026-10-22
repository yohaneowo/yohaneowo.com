"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

const LINE = "#3b82f6";

// How the ranked win rate has moved: each point is the win rate of the `window` matches ending
// there (the newest on the right), the number the newest window against the one before it.
// matches: [start, won] oldest first.
export function WinRateTrend({
  matches,
  window,
}: {
  matches: [start: number, won: 0 | 1][];
  window: number;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.overview;
  const rates: { start: number; rate: number }[] = [];
  let wins = 0;
  matches.forEach(([start, won], i) => {
    wins += won;
    if (i >= window) wins -= matches[i - window][1];
    if (i >= window - 1) rates.push({ start, rate: Math.round((wins / window) * 100) });
  });
  if (!rates.length) return null;
  const latest = rates[rates.length - 1].rate;
  const before = rates[rates.length - 1 - window]?.rate;
  const delta = before == null ? null : latest - before;
  const date = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "numeric",
      day: "numeric",
    });
  const option: EChartsOption = {
    grid: { left: 2, right: 2, top: 4, bottom: 2 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { opacity: 0.4 } },
      confine: true,
      formatter: (params) => {
        const p = (params as { dataIndex: number }[])[0];
        const r = p ? rates[p.dataIndex] : undefined;
        return r ? t.trendAt(date(r.start), r.rate) : "";
      },
    },
    xAxis: { type: "category", show: false, boundaryGap: false, data: rates.map((r) => date(r.start)) },
    yAxis: {
      type: "value",
      show: false,
      min: (v) => Math.max(0, v.min - 5),
      max: (v) => Math.min(100, v.max + 5),
    },
    series: [
      {
        type: "line",
        showSymbol: false,
        smooth: true,
        color: LINE,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.12 },
        data: rates.map((r) => r.rate),
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", opacity: 0.5 },
          label: { show: false },
          data: [{ yAxis: 50 }],
        },
      },
    ],
  };
  return (
    <div className="w-44" title={t.trendHint}>
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>{t.trend}</span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">{latest}%</span>
          {delta != null && (
            <span
              className={cn(
                "ml-1",
                delta > 0 && "text-emerald-600 dark:text-emerald-400",
                delta < 0 && "text-red-600 dark:text-red-400",
              )}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </span>
      </div>
      <div className="h-11">
        <EChart option={option} />
      </div>
      <p className="text-[10px] text-muted-foreground">{t.trendWindow(window)}</p>
    </div>
  );
}

"use client";

import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";

export type MonthRow = { month: string; wins: number; losses: number };

// Matches won and lost each month, stacked (one axis: matches).
export function MonthlyChart({ rows }: { rows: MonthRow[] }) {
  const t = useLocale().t.dotahub.goat.team;
  return (
    <EChart
      className="h-56 w-full"
      option={{
        grid: { left: 32, right: 8, top: 28, bottom: 24 },
        legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10 },
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        xAxis: { type: "category", data: rows.map((r) => r.month.slice(2)), axisTick: { show: false } },
        yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { opacity: 0.3 } } },
        series: [
          {
            name: t.wins,
            type: "bar",
            stack: "m",
            data: rows.map((r) => r.wins),
            itemStyle: { color: "#10b981" },
            barMaxWidth: 22,
          },
          {
            name: t.losses,
            type: "bar",
            stack: "m",
            data: rows.map((r) => r.losses),
            itemStyle: { color: "#ef4444", borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 22,
          },
        ],
      }}
    />
  );
}

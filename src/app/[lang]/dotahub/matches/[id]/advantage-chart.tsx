"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";

// Radiant's gold and XP lead per minute (negative: Dire ahead). One axis; both series are the
// same unit-kind (a lead), so they share it.
export function AdvantageChart({ gold, xp }: { gold: number[]; xp: number[] }) {
  const { t } = useLocale();
  const m = t.dotahub.match;
  const option: EChartsOption = {
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    legend: { top: 0, data: [m.gold, m.xp] },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => Number(value).toLocaleString("en-US"),
    },
    xAxis: {
      type: "category",
      data: gold.map((_, i) => String(i)),
      axisLabel: { formatter: (value: string) => m.minute(Number(value)) },
    },
    yAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.3 } } },
    series: [
      {
        name: m.gold,
        type: "line",
        data: gold,
        showSymbol: false,
        lineStyle: { width: 2 },
        color: "#d4a72c",
      },
      { name: m.xp, type: "line", data: xp, showSymbol: false, lineStyle: { width: 2 }, color: "#6b7cff" },
    ],
  };
  return (
    <div className="h-64">
      <EChart option={option} />
    </div>
  );
}

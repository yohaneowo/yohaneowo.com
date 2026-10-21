"use client";

import { EChart } from "@/components/charts/echart";

export type RadarSeries = { name: string; color: string; values: (number | null)[] };

// One polygon per person; each axis runs to the best value among them.
export function CompareRadar({ axes, series }: { axes: string[]; series: RadarSeries[] }) {
  const max = axes.map((_, i) => Math.max(1e-6, ...series.map((s) => s.values[i] ?? 0)));
  return (
    <EChart
      className="h-80 w-full"
      option={{
        legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
        tooltip: {
          trigger: "item",
          // The real numbers, not the scaled ones.
          formatter: (p: unknown) => {
            const item = p as { seriesIndex?: number; dataIndex?: number; name: string };
            const s = series[item.dataIndex ?? 0];
            return [
              `<b>${s.name}</b>`,
              ...axes.map((a, i) => `${a}: ${s.values[i] == null ? "–" : Number(s.values[i]!.toFixed(2))}`),
            ].join("<br/>");
          },
        },
        radar: {
          indicator: axes.map((name, i) => ({ name, max: max[i] })),
          radius: "62%",
          splitArea: { show: false },
          axisName: { fontSize: 11 },
        },
        series: [
          {
            type: "radar",
            data: series.map((s) => ({
              name: s.name,
              value: s.values.map((v) => v ?? 0),
              lineStyle: { color: s.color, width: 2 },
              itemStyle: { color: s.color },
              areaStyle: { color: s.color, opacity: 0.12 },
              symbolSize: 5,
            })),
          },
        ],
      }}
    />
  );
}

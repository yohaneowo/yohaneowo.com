"use client";

import { EChart } from "@/components/charts/echart";

// Placeholder data until the site reads real Trakt ratings.
const SAMPLE_COUNTS = [1, 0, 2, 4, 9, 18, 31, 42, 25, 8];

export function RatingChart() {
  return (
    <EChart
      option={{
        tooltip: { trigger: "axis" },
        grid: { left: 32, right: 16, top: 16, bottom: 24 },
        xAxis: { type: "category", data: SAMPLE_COUNTS.map((_, i) => `${i + 1}`) },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: SAMPLE_COUNTS, name: "部数" }],
      }}
    />
  );
}

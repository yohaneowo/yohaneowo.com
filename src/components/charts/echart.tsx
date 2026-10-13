"use client";

import { BarChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import { GridComponent, LegendComponent, RadarComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useTheme } from "next-themes";

// Register only what the site uses to keep the bundle small; add chart types here as needed.
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type EChartProps = {
  option: EChartsOption;
  className?: string;
};

export function EChart({ option, className }: EChartProps) {
  const { resolvedTheme } = useTheme();

  return (
    <ReactEChartsCore
      // ECharts can't switch theme in place, so remount when it changes.
      key={resolvedTheme}
      echarts={echarts}
      option={{ backgroundColor: "transparent", ...option }}
      theme={resolvedTheme === "dark" ? "dark" : undefined}
      className={className}
      style={{ height: "100%", width: "100%" }}
      notMerge
    />
  );
}

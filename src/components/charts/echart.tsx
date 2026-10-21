"use client";

import {
  BarChart,
  BoxplotChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  SunburstChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkPointComponent,
  GraphicComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useTheme } from "next-themes";

// Register only what the site uses to keep the bundle small; add chart types here as needed.
echarts.use([
  BarChart,
  BoxplotChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  SunburstChart,
  MarkLineComponent,
  MarkPointComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type EChartProps = {
  option: EChartsOption;
  className?: string;
  // ECharts event name → handler (mouseover, click…), as echarts-for-react takes them.
  onEvents?: Record<string, (params: never) => void>;
  // Charts in the same group share the axis pointer and tooltip (echarts.connect).
  group?: string;
};

export function EChart({ option, className, onEvents, group }: EChartProps) {
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
      onEvents={onEvents}
      onChartReady={
        group
          ? (chart) => {
              chart.group = group;
              echarts.connect(group);
            }
          : undefined
      }
      notMerge
    />
  );
}

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";

export const WIN = "#10b981";
export const LOSS = "#ef4444";
export const ALL = "#8b5cf6";
const AVERAGE_OF = 10;

type Events = Record<string, (params: never) => void>;

// One dot per match (green won, red lost) with a running average, oldest on the left; a click opens
// the match. baseline: a dashed reference line (IMP's 0, a GPM average).
export function TrendChart({
  points,
  averageLabel,
  baseline,
  matchHref,
  format = String,
  height = 240,
}: {
  points: { value: number; won: boolean; label: string; tip: string; matchId: number }[];
  averageLabel: string;
  baseline?: { value: number; label: string };
  matchHref: string;
  format?: (value: number) => string;
  height?: number;
}) {
  const router = useRouter();
  const option: EChartsOption = {
    grid: { left: 48, right: 16, top: 28, bottom: 28 },
    legend: { top: 0, data: [averageLabel], textStyle: { fontSize: 11 } },
    // Hovering anywhere over a match shows it (and the average there), like the minute charts.
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { opacity: 0.4 } },
      formatter: (params) => {
        const list = params as { seriesIndex: number; dataIndex: number; value: unknown }[];
        const dot = list.find((x) => x.seriesIndex === 0);
        const p = dot ? points[dot.dataIndex] : undefined;
        if (!p) return "";
        const average = list.find((x) => x.seriesIndex === 1)?.value;
        return typeof average === "number" ? `${p.tip}<br/>${averageLabel} <b>${format(average)}</b>` : p.tip;
      },
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.label),
      axisLabel: { fontSize: 10, hideOverlap: true },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      scale: !baseline || baseline.value !== 0,
      splitLine: { lineStyle: { opacity: 0.25 } },
      axisLabel: { fontSize: 10, formatter: (v: number) => format(v) },
    },
    series: [
      {
        type: "scatter",
        symbolSize: points.length > 60 ? 6 : 8,
        cursor: "pointer",
        data: points.map((p) => ({ value: p.value, itemStyle: { color: p.won ? WIN : LOSS } })),
        markLine: baseline
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { type: "dashed", opacity: 0.5 },
              label: { formatter: baseline.label, fontSize: 10, position: "insideEndTop" },
              data: [{ yAxis: baseline.value }],
            }
          : undefined,
      },
      {
        name: averageLabel,
        type: "line",
        smooth: true,
        showSymbol: false,
        color: ALL,
        lineStyle: { width: 2 },
        // Starts once there are enough matches to average (fewer swings wildly).
        data: points.map((_, i) => {
          if (i < AVERAGE_OF - 1) return null;
          const window = points.slice(i - AVERAGE_OF + 1, i + 1);
          return Math.round(window.reduce((s, p) => s + p.value, 0) / window.length);
        }),
      },
    ],
  };
  const events = useMemo(
    () => ({
      click: (params: { seriesIndex?: number; dataIndex?: number }) => {
        if (params.seriesIndex !== 0 || params.dataIndex == null) return;
        const p = points[params.dataIndex];
        if (p) router.push(`${matchHref}/${p.matchId}`);
      },
    }),
    [points, router, matchHref],
  );
  return (
    <div style={{ height }}>
      <EChart option={option} onEvents={events as Events} />
    </div>
  );
}

// Lines over the minutes of a match (an average per minute; null where too few matches got there).
export function MinuteChart({
  series,
  minuteLabel,
  format = String,
  zeroLine,
  height = 260,
}: {
  series: { name: string; color: string; values: (number | null)[]; dashed?: boolean }[];
  minuteLabel: (minute: number) => string;
  format?: (value: number) => string;
  zeroLine?: string;
  height?: number;
}) {
  const length = Math.max(0, ...series.map((s) => s.values.length));
  const option: EChartsOption = {
    grid: { left: 52, right: 16, top: 28, bottom: 28 },
    legend: { top: 0, data: series.map((s) => s.name), textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => (value == null ? "–" : format(Number(value))),
    },
    xAxis: {
      type: "category",
      data: Array.from({ length }, (_, i) => minuteLabel(i)),
      axisLabel: { fontSize: 10, hideOverlap: true },
      boundaryGap: false,
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { opacity: 0.25 } },
      axisLabel: { fontSize: 10, formatter: (v: number) => format(v) },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: "line" as const,
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      color: s.color,
      lineStyle: { width: 2, type: s.dashed ? ("dashed" as const) : ("solid" as const) },
      data: s.values,
      markLine:
        zeroLine && i === 0
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { type: "dashed" as const, opacity: 0.5, color: "#888" },
              label: { formatter: zeroLine, fontSize: 10, position: "insideEndTop" as const },
              data: [{ yAxis: 0 }],
            }
          : undefined,
    })),
  };
  return (
    <div style={{ height }}>
      <EChart option={option} />
    </div>
  );
}

// Horizontal bars, one row per category, positive green and negative red unless a color is given.
export function BarsChart({
  rows,
  format = String,
}: {
  rows: { label: string; value: number; note: string; color?: string }[];
  format?: (value: number) => string;
}) {
  const option: EChartsOption = {
    grid: { left: 8, right: 96, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const r = rows[(params as { dataIndex: number }).dataIndex];
        return r ? `${r.label}<br/><b>${format(r.value)}</b> · ${r.note}` : "";
      },
    },
    xAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.25 } }, axisLabel: { fontSize: 10 } },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.label),
      // The first row on top (a category axis starts at the bottom).
      inverse: true,
      axisTick: { show: false },
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 16,
        data: rows.map((r) => ({
          value: r.value,
          itemStyle: {
            color: r.color ?? (r.value >= 0 ? WIN : LOSS),
            borderRadius: r.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
          },
        })),
        label: {
          show: true,
          position: "right",
          fontSize: 10,
          formatter: (params) => {
            const r = rows[(params as { dataIndex: number }).dataIndex];
            return r ? `${format(r.value)} · ${r.note}` : "";
          },
        },
      },
    ],
  };
  return (
    <div style={{ height: Math.max(120, rows.length * 30 + 16) }}>
      <EChart option={option} />
    </div>
  );
}

// Box plots by category: each series is one box per category (low end, quartiles, median, high end);
// null where a category has too little data.
export function SpreadChart({
  categories,
  series,
  format = String,
  unit = "",
  fromZero = false,
  minWidthPerCategory = 0,
}: {
  categories: string[];
  series: {
    name: string;
    color: string;
    boxes: ([number, number, number, number, number] | null)[];
    // Per box: drawn faint (too few matches), and an extra tooltip line.
    faded?: boolean[];
    notes?: (string | null)[];
    dashed?: boolean;
  }[];
  format?: (value: number) => string;
  unit?: string;
  fromZero?: boolean;
  // Lets many categories scroll sideways instead of squeezing.
  minWidthPerCategory?: number;
}) {
  const option: EChartsOption = {
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    legend: { top: 0, data: series.map((s) => s.name), textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const p = params as {
          seriesIndex: number;
          dataIndex: number;
          seriesName: string;
          name: string;
          value: number[];
        };
        const [, low, q1, median, q3, high] = p.value;
        const note = series[p.seriesIndex]?.notes?.[p.dataIndex];
        return `${p.name} · ${p.seriesName}<br/>${format(low)} – ${format(high)}${unit}<br/>${format(q1)} – <b>${format(median)}</b> – ${format(q3)}${note ? `<br/>${note}` : ""}`;
      },
    },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { fontSize: 11, interval: 0 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: fromZero ? 0 : undefined,
      splitLine: { lineStyle: { opacity: 0.25 } },
      axisLabel: { fontSize: 10, formatter: (v: number) => format(v) },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "boxplot" as const,
      itemStyle: {
        color: `${s.color}33`,
        borderColor: s.color,
        borderType: s.dashed ? ("dashed" as const) : ("solid" as const),
      },
      boxWidth: [6, 18],
      data: s.boxes.map((b, i) => ({
        value: b ?? [NaN, NaN, NaN, NaN, NaN],
        itemStyle: s.faded?.[i] ? { opacity: 0.4 } : undefined,
      })),
    })),
  };
  return (
    <div className="overflow-x-auto">
      <div style={{ height: 300, minWidth: categories.length * minWidthPerCategory }}>
        <EChart option={option} />
      </div>
    </div>
  );
}

// Counts per bin, wins and losses stacked.
export function HistogramChart({
  bins,
  wonLabel,
  lostLabel,
}: {
  bins: { label: string; won: number; lost: number }[];
  wonLabel: string;
  lostLabel: string;
}) {
  const option: EChartsOption = {
    grid: { left: 36, right: 12, top: 28, bottom: 28 },
    legend: { top: 0, data: [wonLabel, lostLabel], textStyle: { fontSize: 11 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: bins.map((b) => b.label),
      axisLabel: { fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { opacity: 0.25 } },
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: wonLabel,
        type: "bar",
        stack: "n",
        color: WIN,
        barCategoryGap: "20%",
        data: bins.map((b) => b.won),
      },
      {
        name: lostLabel,
        type: "bar",
        stack: "n",
        color: LOSS,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        data: bins.map((b) => b.lost),
      },
    ],
  };
  return (
    <div style={{ height: 240 }}>
      <EChart option={option} />
    </div>
  );
}

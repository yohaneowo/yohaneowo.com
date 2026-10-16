"use client";

import { EChart } from "@/components/charts/echart";
import zh from "@/i18n/zh";
import { AXES, formatSigned } from "../stats";

const GOLD = "#c9a76a";
const UP = "#3fb68b";
const DOWN = "#e2694f";

export function StyleRadar({ scores }: { scores: number[] }) {
  return (
    <EChart
      className="h-full min-h-72"
      option={{
        tooltip: { trigger: "item" },
        radar: {
          indicator: AXES.map((axis) => ({ name: zh.style.axes[axis], max: 100 })),
          radius: "62%",
          splitNumber: 4,
        },
        series: [
          {
            type: "radar",
            data: [
              {
                value: scores,
                name: "窗口占比",
                areaStyle: { color: "rgba(201,167,106,0.22)" },
                lineStyle: { color: GOLD, width: 2 },
                itemStyle: { color: GOLD },
              },
            ],
          },
        ],
      }}
    />
  );
}

export function DiffBars({ diffs, labels }: { diffs: number[]; labels: string[] }) {
  return (
    <EChart
      className="h-full min-h-72"
      option={{
        tooltip: {
          trigger: "axis",
          formatter: (params: unknown) => {
            const item = (Array.isArray(params) ? params[0] : params) as { dataIndex?: number };
            const index = item.dataIndex ?? 0;
            return `${labels[index]}　${formatSigned(diffs[index] ?? 0)}`;
          },
        },
        grid: { left: 40, right: 12, top: 16, bottom: 16 },
        xAxis: {
          type: "category",
          data: labels,
          axisLabel: { show: false },
          axisTick: { show: false },
        },
        yAxis: { type: "value", min: -4, max: 4 },
        series: [
          {
            type: "bar",
            data: diffs.map((diff) => ({
              value: Math.max(-4, Math.min(4, diff)),
              itemStyle: { color: diff >= 0 ? UP : DOWN },
            })),
          },
        ],
      }}
    />
  );
}

"use client";

import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { RankDistribution } from "@/lib/dota/data";
import { LOSS, WIN } from "../stats/charts";
import type { RankPoint } from "./load";

// One colour per medal, Herald to Immortal: each medal's own colour in the game (Herald's green
// leaves, Guardian's bronze, Crusader's teal, Archon's gold, Legend's crimson, Ancient's purple,
// Divine's blue, Immortal's gold).
const MEDAL_COLORS = [
  "",
  "#5fa845",
  "#a4703d",
  "#2fb5b2",
  "#d6a93b",
  "#c2384f",
  "#9b4fd1",
  "#3f7ee8",
  "#f0c640",
];
// The player's own bar: the medal's colour at full strength with a bright edge.
const ME_BORDER = "#ffffff";
const MEDIAN_LINE = "#f59e0b";
const MEDIAN_WINDOW = 20;

// A rank tier (medal × 10 + stars) as a place on the medal axis: the medal at the integer, its
// five stars spread around it; Immortal has no stars and sits on 8.
export function rankPosition(tier: number) {
  const medal = Math.floor(tier / 10);
  const stars = tier % 10;
  return medal + (stars ? (stars - 3) / 5 : 0);
}

function useMedalName() {
  const { t } = useLocale();
  const medals = t.dotahub.medals;
  return (tier: number) => {
    const stars = tier % 10;
    return `${medals[Math.floor(tier / 10)] ?? ""}${stars ? ` ${stars}` : ""}`;
  };
}

// Every ranked player by tier, one bar per star, the player's own bar lit.
export function DistributionChart({ rows, total, tier }: RankDistribution & { tier: number | null }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.rankPage;
  const medalName = useMedalName();
  const sorted = [...rows].sort((a, b) => a.tier - b.tier);
  const option: EChartsOption = {
    grid: { left: 44, right: 12, top: 12, bottom: 28 },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const row = sorted[(params as { dataIndex: number }).dataIndex];
        return row
          ? `<b>${medalName(row.tier)}</b><br/>${t.players(row.count)} · ${((100 * row.count) / total).toFixed(1)}%`
          : "";
      },
    },
    xAxis: {
      type: "category",
      data: sorted.map((r) => String(r.tier)),
      axisTick: { show: false },
      axisLabel: {
        interval: 0,
        fontSize: 10,
        // The medal's name under its middle star (Immortal has one bar).
        formatter: (value: string) => {
          const tier = Number(value);
          const stars = tier % 10;
          return stars === 3 || Math.floor(tier / 10) === 8
            ? (dict.dotahub.medals[Math.floor(tier / 10)] ?? "")
            : "";
        },
      },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, formatter: (v: number) => `${Math.round(v / 1000)}k` },
      splitLine: { lineStyle: { opacity: 0.3 } },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((r) => ({
          value: r.count,
          itemStyle: {
            color: MEDAL_COLORS[Math.floor(r.tier / 10)],
            opacity: r.tier === tier ? 1 : 0.5,
            borderColor: r.tier === tier ? ME_BORDER : undefined,
            borderWidth: r.tier === tier ? 2 : 0,
          },
        })),
        barCategoryGap: "15%",
      },
    ],
  };
  return (
    <div className="h-56">
      <EChart option={option} />
    </div>
  );
}

// The average rank of each ranked match over time, a dot per match (won green, lost red) and the
// median of the newest MEDIAN_WINDOW matches at each point.
export function RankTrendChart({ points }: { points: RankPoint[] }) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.rankPage;
  const medalName = useMedalName();
  const medals = dict.dotahub.medals;
  const median: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const window = points
      .slice(Math.max(0, i - MEDIAN_WINDOW + 1), i + 1)
      .map((p) => rankPosition(p.tier))
      .sort((a, b) => a - b);
    if (window.length < 5) continue;
    const mid = Math.floor(window.length / 2);
    median.push([
      points[i].start * 1000,
      window.length % 2 ? window[mid] : (window[mid - 1] + window[mid]) / 2,
    ]);
  }
  const ys = points.map((p) => rankPosition(p.tier));
  const low = Math.max(1, Math.floor(Math.min(...ys)));
  const high = Math.min(8, Math.ceil(Math.max(...ys)));
  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const option: EChartsOption = {
    grid: { left: 64, right: 16, top: 28, bottom: 32 },
    legend: { top: 0, data: [t.trendMedian], textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const p = params as unknown as { seriesIndex: number; dataIndex: number; value: [number, number] };
        if (p.seriesIndex === 0) {
          const m = points[p.dataIndex];
          return m
            ? `${date(m.start * 1000)}<br/><b>${medalName(m.tier)}</b> · ${m.won ? dict.dotahub.impPage.won : dict.dotahub.impPage.lost}`
            : "";
        }
        const [ms, y] = p.value;
        return `${date(ms)}<br/>${t.trendMedian}: <b>${medals[Math.round(y)] ?? ""}</b>`;
      },
    },
    xAxis: { type: "time", axisLabel: { fontSize: 10 }, splitLine: { show: false } },
    yAxis: {
      type: "value",
      min: low,
      max: high,
      interval: 1,
      axisLabel: { fontSize: 10, formatter: (v: number) => medals[Math.round(v)] ?? "" },
      splitLine: { lineStyle: { opacity: 0.3 } },
    },
    series: [
      {
        type: "scatter",
        symbolSize: 5,
        data: points.map((p, i) => ({
          value: [p.start * 1000, rankPosition(p.tier) + (((i * 7919) % 100) / 100 - 0.5) * 0.08],
          itemStyle: { color: p.won ? WIN : LOSS, opacity: 0.55 },
        })),
      },
      {
        name: t.trendMedian,
        type: "line",
        data: median,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: MEDIAN_LINE, width: 2 },
        itemStyle: { color: MEDIAN_LINE },
      },
    ],
  };
  return (
    <div className="h-64">
      <EChart option={option} />
    </div>
  );
}

// Win rate in matches of each medal, the player's own medal marked.
export function BracketWinRateChart({
  rows,
  own,
}: {
  rows: { medal: number; games: number; wins: number }[];
  own: number | null;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.rankPage;
  const medals = dict.dotahub.medals;
  const option: EChartsOption = {
    grid: { left: 44, right: 12, top: 24, bottom: 28 },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const row = rows[(params as { dataIndex: number }).dataIndex];
        return row
          ? `<b>${medals[row.medal]}</b><br/>${t.winRate} ${Math.round((100 * row.wins) / row.games)}% · ${t.games(row.games)}`
          : "";
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((r) => medals[r.medal] ?? ""),
      axisTick: { show: false },
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { fontSize: 10, formatter: (v: number) => `${v}%` },
      splitLine: { lineStyle: { opacity: 0.3 } },
    },
    series: [
      {
        type: "bar",
        data: rows.map((r) => ({
          value: Math.round((100 * r.wins) / r.games),
          itemStyle: {
            color: MEDAL_COLORS[r.medal],
            opacity: own === r.medal ? 1 : 0.55,
            borderColor: own === r.medal ? ME_BORDER : undefined,
            borderWidth: own === r.medal ? 2 : 0,
          },
        })),
        label: {
          show: true,
          position: "top",
          fontSize: 10,
          formatter: (p) => `${rows[p.dataIndex]?.wins}/${rows[p.dataIndex]?.games}`,
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", color: "#9ca3af" },
          data: [{ yAxis: 50 }],
          label: { show: false },
        },
        barMaxWidth: 48,
      },
    ],
  };
  return (
    <div className="h-52">
      <EChart option={option} />
    </div>
  );
}

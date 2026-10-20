"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { LEAD_STATES } from "../stats/analysis";
import { ALL, LOSS, WIN } from "../stats/charts";
import { shortDate } from "../stats/rows";
import {
  bootstrapCv,
  byHero,
  density,
  FEW_MATCHES,
  funnel,
  jitter,
  mean,
  rolling,
  sd,
  stateVolatility,
} from "../stats/volatility";

const VIEWS = [
  "riskReturn",
  "ranked",
  "swarm",
  "errorBars",
  "funnel",
  "interval",
  "control",
  "violin",
  "heatmap",
  "cdf",
  "dumbbell",
  "rolling",
] as const;
type View = (typeof VIEWS)[number];

const ROLLING = 10;
const CDF_HEROES = 6;
const VIOLIN_MIN = 10;
const MAX_ROWS = 15;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const gold = (v: number) => Math.round(v).toLocaleString("en-US");
// ECharts' custom series are typed loosely here; the options are checked by drawing them.
type Api = {
  value: (i: number) => number;
  coord: (v: [number, number]) => [number, number];
  size: (v: [number, number]) => [number, number];
  style: (extra?: object) => object;
};
type Params = { dataIndex: number };

function Chart({ option, height }: { option: unknown; height: number }) {
  return (
    <div style={{ height }}>
      <EChart option={option as EChartsOption} />
    </div>
  );
}

// The 波动率 section: how steady each hero's income is, twelve ways. list: the matches under every
// filter but the hero (heroes are compared); shown: under every filter (the control chart and
// rolling volatility follow the picked hero).
export function VolatilityCharts({
  list,
  shown,
  heroes,
}: {
  list: DetailMatch[];
  shown: DetailMatch[];
  heroes: Record<number, HeroInfo>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.volatility;
  const e = dict.dotahub.economy;
  const [view, setView] = useState<View>("riskReturn");
  const name = (id: number) => heroes[id]?.[lang] ?? String(id);

  const all = useMemo(() => byHero(list), [list]);
  const rows = all.slice(0, MAX_ROWS);
  const few = (n: number) => n < FEW_MATCHES;
  const fade = (n: number, color: string) => (few(n) ? `${color}66` : color);

  const option = useMemo((): { option: unknown; height: number } | null => {
    if (!rows.length && view !== "control" && view !== "rolling") return null;
    const byCv = [...rows].sort((a, b) => a.cv - b.cv);
    const categoryHeight = (n: number) => Math.max(180, n * 30 + 60);
    switch (view) {
      case "riskReturn": {
        const xMid = mean(rows.map((h) => h.median));
        const yMid = mean(rows.map((h) => h.cv));
        // Room at both ends so the outermost dots and their labels aren't cut.
        const xs = rows.map((h) => h.median);
        const ys = rows.map((h) => h.cv);
        const xPad = Math.max(20, (Math.max(...xs) - Math.min(...xs)) * 0.12);
        const yPad = Math.max(0.01, (Math.max(...ys) - Math.min(...ys)) * 0.12);
        return {
          height: 380,
          option: {
            grid: { left: 56, right: 24, top: 32, bottom: 44 },
            tooltip: {
              formatter: (p: Params) => {
                const h = rows[p.dataIndex];
                return `${name(h.id)}<br/>${t.medianGpm} <b>${gold(h.median)}</b> · ${t.volatility} <b>${pct(h.cv)}</b><br/>${e.matchesColumn} ${h.n}`;
              },
            },
            xAxis: {
              name: t.medianGpm,
              nameLocation: "middle",
              nameGap: 28,
              type: "value",
              min: Math.floor(Math.min(...xs) - xPad),
              max: Math.ceil(Math.max(...xs) + xPad * 2),
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: {
              name: t.volatility,
              type: "value",
              min: Math.max(0, Math.min(...ys) - yPad),
              max: Math.max(...ys) + yPad,
              axisLabel: { formatter: pct },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            graphic: [
              {
                type: "text",
                right: 32,
                top: 36,
                style: { text: t.quadrants.richUnsteady, fill: "#888", fontSize: 11 },
              },
              {
                type: "text",
                right: 32,
                bottom: 52,
                style: { text: t.quadrants.richSteady, fill: "#888", fontSize: 11 },
              },
              {
                type: "text",
                left: 64,
                top: 36,
                style: { text: t.quadrants.poorUnsteady, fill: "#888", fontSize: 11 },
              },
              {
                type: "text",
                left: 64,
                bottom: 52,
                style: { text: t.quadrants.poorSteady, fill: "#888", fontSize: 11 },
              },
            ],
            series: [
              {
                type: "scatter",
                data: rows.map((h) => ({
                  value: [h.median, h.cv],
                  symbolSize: 8 + Math.sqrt(h.n) * 5,
                  itemStyle: { color: fade(h.n, ALL), borderColor: ALL, borderWidth: 1 },
                  label: { show: true, formatter: name(h.id), position: "right", fontSize: 10 },
                })),
                markLine: {
                  silent: true,
                  symbol: "none",
                  lineStyle: { type: "dashed", opacity: 0.4 },
                  label: { show: false },
                  data: [{ xAxis: xMid }, { yAxis: yMid }],
                },
              },
            ],
          },
        };
      }
      case "ranked":
        return {
          height: categoryHeight(byCv.length),
          option: {
            grid: { left: 8, right: 56, top: 8, bottom: 24, containLabel: true },
            tooltip: {
              formatter: (p: Params) =>
                `${name(byCv[p.dataIndex].id)} · ${pct(byCv[p.dataIndex].cv)} · ${e.matchesColumn} ${byCv[p.dataIndex].n}`,
            },
            xAxis: {
              type: "value",
              axisLabel: { formatter: pct },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: { type: "category", data: byCv.map((h) => name(h.id)), axisTick: { show: false } },
            series: [
              {
                type: "bar",
                barWidth: 2,
                silent: true,
                data: byCv.map((h) => ({ value: h.cv, itemStyle: { color: fade(h.n, "#94a3b8") } })),
              },
              {
                type: "scatter",
                symbolSize: 12,
                data: byCv.map((h) => ({
                  value: h.cv,
                  itemStyle: few(h.n)
                    ? { color: "transparent", borderColor: ALL, borderWidth: 2 }
                    : { color: ALL },
                  label: { show: true, position: "right", formatter: `${pct(h.cv)} · ${h.n}`, fontSize: 10 },
                })),
              },
            ],
          },
        };
      case "swarm": {
        const points = rows.flatMap((h, i) => h.matches.map((m) => ({ h, i, m })));
        return {
          height: categoryHeight(rows.length),
          option: {
            grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
            tooltip: {
              formatter: (p: Params) => {
                const { h, m } = points[p.dataIndex];
                return `${name(h.id)} · ${m.won ? e.won : e.lost} · ${shortDate(m.startTime, lang)}<br/>GPM <b>${m.details.gpm}</b>`;
              },
            },
            xAxis: {
              name: "GPM",
              nameLocation: "middle",
              nameGap: 24,
              type: "value",
              scale: true,
              axisLine: { onZero: false },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            // Hero names on a category axis; the dots on a hidden value axis over the same rows.
            yAxis: [
              {
                type: "category",
                data: rows.map((h) => name(h.id)),
                inverse: true,
                axisTick: { show: false },
              },
              { type: "value", min: -0.5, max: rows.length - 0.5, inverse: true, show: false },
            ],
            series: [
              {
                type: "scatter",
                yAxisIndex: 1,
                symbolSize: 7,
                data: points.map(({ i, m }) => ({
                  value: [m.details.gpm, i + jitter(m.matchId)],
                  itemStyle: { color: m.won ? WIN : LOSS, opacity: 0.8 },
                })),
              },
            ],
          },
        };
      }
      case "errorBars":
        return {
          height: categoryHeight(rows.length),
          option: {
            grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
            tooltip: {
              formatter: (p: Params) => {
                const h = rows[p.dataIndex];
                return h ? `${name(h.id)}<br/>${t.average} <b>${gold(h.mean)}</b> ± ${gold(h.sd)}` : "";
              },
            },
            xAxis: {
              name: "GPM",
              nameLocation: "middle",
              nameGap: 24,
              type: "value",
              scale: true,
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: {
              type: "category",
              data: rows.map((h) => name(h.id)),
              inverse: true,
              axisTick: { show: false },
            },
            series: [
              {
                type: "custom",
                renderItem: (_: unknown, api: Api) => {
                  const i = api.value(0);
                  const low = api.coord([api.value(1), i]);
                  const high = api.coord([api.value(2), i]);
                  const cap = 5;
                  const style = { stroke: ALL, lineWidth: 2 };
                  return {
                    type: "group",
                    children: [
                      { type: "line", shape: { x1: low[0], y1: low[1], x2: high[0], y2: high[1] }, style },
                      {
                        type: "line",
                        shape: { x1: low[0], y1: low[1] - cap, x2: low[0], y2: low[1] + cap },
                        style,
                      },
                      {
                        type: "line",
                        shape: { x1: high[0], y1: high[1] - cap, x2: high[0], y2: high[1] + cap },
                        style,
                      },
                    ],
                  };
                },
                encode: { x: [1, 2], y: 0 },
                data: rows.map((h, i) => [i, h.mean - h.sd, h.mean + h.sd]),
              },
              {
                type: "scatter",
                symbolSize: 10,
                data: rows.map((h, i) => ({ value: [h.mean, i], itemStyle: { color: fade(h.n, ALL) } })),
              },
            ],
          },
        };
      case "funnel": {
        const maxN = Math.max(...rows.map((h) => h.n), 10);
        const f = funnel(all, maxN);
        if (!f) return null;
        return {
          height: 360,
          option: {
            grid: { left: 56, right: 24, top: 32, bottom: 44 },
            legend: { top: 0, data: [t.luckRange, t.luckMiddle], textStyle: { fontSize: 11 } },
            tooltip: {
              trigger: "item",
              formatter: (p: Params & { seriesIndex: number }) => {
                if (p.seriesIndex !== 3) return "";
                const h = all[p.dataIndex];
                return `${name(h.id)} · ${pct(h.cv)} · ${e.matchesColumn} ${h.n}`;
              },
            },
            xAxis: {
              name: e.matchesColumn,
              nameLocation: "middle",
              nameGap: 28,
              type: "value",
              min: 2,
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: {
              name: t.volatility,
              type: "value",
              axisLabel: { formatter: pct },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            series: [
              {
                name: t.luckRange,
                type: "line",
                smooth: true,
                showSymbol: false,
                color: "#94a3b8",
                lineStyle: { type: "dashed" },
                data: f.points.map((p) => [p.n, p.high]),
              },
              {
                name: t.luckRange,
                type: "line",
                smooth: true,
                showSymbol: false,
                color: "#94a3b8",
                lineStyle: { type: "dashed" },
                data: f.points.map((p) => [p.n, p.low]),
              },
              {
                name: t.luckMiddle,
                type: "line",
                smooth: true,
                showSymbol: false,
                color: "#94a3b8",
                lineStyle: { opacity: 0.5 },
                data: f.points.map((p) => [p.n, p.mid]),
              },
              {
                type: "scatter",
                data: all.map((h) => {
                  const bound = f.points.find((p) => p.n === h.n);
                  const outside = bound ? h.cv > bound.high || h.cv < bound.low : false;
                  return {
                    value: [h.n, h.cv],
                    symbolSize: 10,
                    itemStyle: { color: outside ? LOSS : ALL },
                    label: { show: true, formatter: name(h.id), position: "right", fontSize: 10 },
                  };
                }),
              },
            ],
          },
        };
      }
      case "interval": {
        const intervals = byCv.map((h) => ({ h, ci: bootstrapCv(h.gpm, h.id) }));
        return {
          height: categoryHeight(intervals.length),
          option: {
            grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
            tooltip: {
              formatter: (p: Params) => {
                const x = intervals[p.dataIndex];
                return x
                  ? `${name(x.h.id)}<br/>${t.volatility} <b>${pct(x.h.cv)}</b> (${pct(x.ci[0])}–${pct(x.ci[1])})<br/>${e.matchesColumn} ${x.h.n}`
                  : "";
              },
            },
            xAxis: {
              type: "value",
              axisLabel: { formatter: pct },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: { type: "category", data: intervals.map((x) => name(x.h.id)), axisTick: { show: false } },
            series: [
              {
                type: "custom",
                renderItem: (_: unknown, api: Api) => {
                  const i = api.value(0);
                  const low = api.coord([api.value(1), i]);
                  const high = api.coord([api.value(2), i]);
                  return {
                    type: "line",
                    shape: { x1: low[0], y1: low[1], x2: high[0], y2: high[1] },
                    style: { stroke: "#94a3b8", lineWidth: 3, opacity: 0.7 },
                  };
                },
                encode: { x: [1, 2], y: 0 },
                data: intervals.map((x, i) => [i, x.ci[0], x.ci[1]]),
              },
              {
                type: "scatter",
                symbolSize: 10,
                data: intervals.map((x, i) => ({
                  value: [x.h.cv, i],
                  itemStyle: { color: fade(x.h.n, ALL) },
                })),
              },
            ],
          },
        };
      }
      case "control": {
        const ordered = [...shown].sort((a, b) => a.startTime - b.startTime);
        if (ordered.length < 3) return null;
        const gpm = ordered.map((m) => m.details.gpm);
        const m0 = mean(gpm);
        const s0 = sd(gpm);
        return {
          height: 300,
          option: {
            grid: { left: 48, right: 72, top: 16, bottom: 28 },
            tooltip: {
              trigger: "item",
              formatter: (p: Params) => {
                const m = ordered[p.dataIndex];
                return m
                  ? `${name(m.heroId)} · ${m.won ? e.won : e.lost} · ${shortDate(m.startTime, lang)}<br/>GPM <b>${m.details.gpm}</b>`
                  : "";
              },
            },
            xAxis: {
              type: "category",
              data: ordered.map((m) => shortDate(m.startTime, lang)),
              axisLabel: { fontSize: 10, hideOverlap: true },
            },
            yAxis: { type: "value", scale: true, splitLine: { lineStyle: { opacity: 0.2 } } },
            series: [
              {
                type: "line",
                color: "#94a3b8",
                symbolSize: 7,
                data: gpm.map((g, i) => ({
                  value: g,
                  itemStyle: { color: Math.abs(g - m0) > 2 * s0 ? LOSS : ordered[i].won ? WIN : "#94a3b8" },
                })),
                markLine: {
                  silent: true,
                  symbol: "none",
                  data: [
                    {
                      yAxis: m0,
                      label: { formatter: `${t.average} ${gold(m0)}`, position: "end", fontSize: 10 },
                      lineStyle: { color: ALL },
                    },
                    {
                      yAxis: m0 + 2 * s0,
                      label: { formatter: `+2σ ${gold(m0 + 2 * s0)}`, position: "end", fontSize: 10 },
                      lineStyle: { color: LOSS, type: "dashed" },
                    },
                    {
                      yAxis: m0 - 2 * s0,
                      label: { formatter: `−2σ ${gold(m0 - 2 * s0)}`, position: "end", fontSize: 10 },
                      lineStyle: { color: LOSS, type: "dashed" },
                    },
                  ],
                },
              },
            ],
          },
        };
      }
      case "violin": {
        const enough = rows.filter((h) => h.n >= VIOLIN_MIN);
        if (!enough.length) return null;
        const lo = Math.min(...enough.flatMap((h) => h.gpm)) - 50;
        const hi = Math.max(...enough.flatMap((h) => h.gpm)) + 50;
        const shapes = enough.map((h) => density(h.gpm, lo, hi));
        const peak = Math.max(...shapes.flatMap((s) => s.map((p) => p[1])));
        return {
          height: categoryHeight(enough.length) + 40,
          option: {
            grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
            tooltip: {
              formatter: (p: Params) => {
                const h = enough[p.dataIndex];
                return h ? `${name(h.id)} · ${e.matchesColumn} ${h.n}<br/>${t.average} ${gold(h.mean)}` : "";
              },
            },
            xAxis: {
              name: "GPM",
              nameLocation: "middle",
              nameGap: 24,
              type: "value",
              min: lo,
              max: hi,
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: {
              type: "category",
              data: enough.map((h) => name(h.id)),
              inverse: true,
              axisTick: { show: false },
            },
            series: [
              {
                type: "custom",
                renderItem: (params: Params, api: Api) => {
                  const shape = shapes[params.dataIndex];
                  const half = api.size([0, 1])[1] * 0.45;
                  const top = shape.map(([x, d]) => {
                    const c = api.coord([x, params.dataIndex]);
                    return [c[0], c[1] - (d / peak) * half];
                  });
                  const bottom = shape
                    .map(([x, d]) => {
                      const c = api.coord([x, params.dataIndex]);
                      return [c[0], c[1] + (d / peak) * half];
                    })
                    .reverse();
                  return {
                    type: "polygon",
                    shape: { points: [...top, ...bottom] },
                    style: { fill: `${ALL}55`, stroke: ALL, lineWidth: 1 },
                  };
                },
                encode: { y: 0 },
                data: enough.map((_, i) => [i]),
              },
              {
                type: "scatter",
                symbolSize: 4,
                silent: true,
                data: enough.flatMap((h, i) =>
                  h.gpm.map((g) => ({ value: [g, i], itemStyle: { color: "#64748b" } })),
                ),
              },
            ],
          },
        };
      }
      case "cdf": {
        const top = rows.slice(0, CDF_HEROES);
        const palette = ["#8b5cf6", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#64748b"];
        return {
          height: 340,
          option: {
            grid: { left: 48, right: 24, top: 40, bottom: 44 },
            legend: { top: 0, data: top.map((h) => name(h.id)), textStyle: { fontSize: 11 } },
            tooltip: { trigger: "axis", valueFormatter: (v: unknown) => pct(Number(v)) },
            xAxis: {
              name: "GPM",
              nameLocation: "middle",
              nameGap: 28,
              type: "value",
              scale: true,
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: {
              type: "value",
              min: 0,
              max: 1,
              axisLabel: { formatter: pct },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            series: top.map((h, k) => {
              const sorted = [...h.gpm].sort((a, b) => a - b);
              return {
                name: name(h.id),
                type: "line",
                step: "end",
                showSymbol: false,
                color: palette[k],
                lineStyle: { width: few(h.n) ? 1 : 2, type: few(h.n) ? "dashed" : "solid" },
                data: [[sorted[0], 0], ...sorted.map((g, i) => [g, (i + 1) / sorted.length])],
              };
            }),
          },
        };
      }
      case "dumbbell": {
        const pairs = rows.map((h) => ({ h, v: stateVolatility(h) })).filter((x) => x.v.ahead && x.v.behind);
        if (!pairs.length) return null;
        return {
          height: categoryHeight(pairs.length),
          option: {
            grid: { left: 8, right: 24, top: 32, bottom: 24, containLabel: true },
            legend: { top: 0, data: [e.states.ahead, e.states.behind], textStyle: { fontSize: 11 } },
            tooltip: { trigger: "item" },
            xAxis: {
              name: t.volatility,
              nameLocation: "middle",
              nameGap: 24,
              type: "value",
              axisLabel: { formatter: pct },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            yAxis: {
              type: "category",
              data: pairs.map((x) => name(x.h.id)),
              inverse: true,
              axisTick: { show: false },
            },
            series: [
              {
                type: "custom",
                silent: true,
                renderItem: (_: unknown, api: Api) => {
                  const i = api.value(0);
                  const a = api.coord([api.value(1), i]);
                  const b = api.coord([api.value(2), i]);
                  return {
                    type: "line",
                    shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] },
                    style: { stroke: "#94a3b8", lineWidth: 3, opacity: 0.6 },
                  };
                },
                encode: { x: [1, 2], y: 0 },
                data: pairs.map((x, i) => [i, x.v.ahead!.cv, x.v.behind!.cv]),
              },
              {
                name: e.states.ahead,
                type: "scatter",
                symbolSize: 11,
                color: WIN,
                data: pairs.map((x, i) => [x.v.ahead!.cv, i]),
                tooltip: { valueFormatter: (v: unknown) => pct(Number(v)) },
              },
              {
                name: e.states.behind,
                type: "scatter",
                symbolSize: 11,
                color: LOSS,
                data: pairs.map((x, i) => [x.v.behind!.cv, i]),
              },
            ],
          },
        };
      }
      case "rolling": {
        const ordered = [...shown].sort((a, b) => a.startTime - b.startTime);
        const values = rolling(
          ordered.map((m) => m.details.gpm),
          ROLLING,
        );
        if (!values.some((v) => v != null)) return null;
        return {
          height: 280,
          option: {
            grid: { left: 48, right: 16, top: 16, bottom: 28 },
            tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (v == null ? "–" : pct(Number(v))) },
            xAxis: {
              type: "category",
              data: ordered.map((m) => shortDate(m.startTime, lang)),
              axisLabel: { fontSize: 10, hideOverlap: true },
            },
            yAxis: {
              type: "value",
              axisLabel: { formatter: pct },
              splitLine: { lineStyle: { opacity: 0.2 } },
            },
            series: [
              {
                type: "line",
                smooth: true,
                showSymbol: false,
                color: ALL,
                areaStyle: { opacity: 0.12 },
                data: values,
              },
            ],
          },
        };
      }
      default:
        return null;
    }
  }, [view, rows, all, shown, lang, t, e]); // eslint-disable-line react-hooks/exhaustive-deps

  // The heat map is a plain grid: heroes by ahead / even / behind, coloured by volatility.
  const heat = view === "heatmap" ? rows.map((h) => ({ h, v: stateVolatility(h) })) : [];
  const heatMax = Math.max(0.01, ...heat.flatMap((x) => LEAD_STATES.map((s) => x.v[s]?.cv ?? 0)));

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t.chart} className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              view === v
                ? "border-foreground/40 bg-muted font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.views[v]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t.explain[view]}</p>
      {view === "heatmap" ? (
        heat.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th />
                  {LEAD_STATES.map((s) => (
                    <th key={s} className="font-normal text-muted-foreground">
                      {e.states[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat.map(({ h, v }) => (
                  <tr key={h.id}>
                    <th className="pr-2 text-right font-normal whitespace-nowrap">{name(h.id)}</th>
                    {LEAD_STATES.map((s) => (
                      <td
                        key={s}
                        title={v[s] ? `${pct(v[s]!.cv)} · ${e.matchesColumn} ${v[s]!.n}` : undefined}
                        className="h-8 rounded-md text-center tabular-nums"
                        style={
                          v[s]
                            ? { background: `rgba(139, 92, 246, ${0.12 + 0.75 * (v[s]!.cv / heatMax)})` }
                            : undefined
                        }
                      >
                        {v[s] ? pct(v[s]!.cv) : <span className="text-muted-foreground/40">–</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.notEnough}</p>
        )
      ) : option ? (
        <Chart option={option.option} height={option.height} />
      ) : (
        <p className="text-sm text-muted-foreground">{view === "violin" ? t.notEnoughViolin : t.notEnough}</p>
      )}
      {(view === "control" || view === "rolling") && (
        <p className="text-xs text-muted-foreground">{t.followsHero}</p>
      )}
    </div>
  );
}

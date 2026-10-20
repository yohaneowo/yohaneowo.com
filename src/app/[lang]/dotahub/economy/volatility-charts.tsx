"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { ALL, LOSS, WIN } from "../stats/charts";
import { shortDate } from "../stats/rows";
import { byHero, FEW_MATCHES, funnel, mean, rolling, sd } from "../stats/volatility";

const VIEWS = ["riskReturn", "funnel", "control", "rolling"] as const;
type View = (typeof VIEWS)[number];

const ROLLING = 10;
const MAX_ROWS = 15;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const gold = (v: number) => Math.round(v).toLocaleString("en-US");
type Params = { dataIndex: number };

function Chart({ option, height }: { option: unknown; height: number }) {
  return (
    <div style={{ height }}>
      <EChart option={option as EChartsOption} />
    </div>
  );
}

// The 波动率 section: how steady each hero's income is, four ways. list: the matches under every
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
      {option ? (
        <Chart option={option.option} height={option.height} />
      ) : (
        <p className="text-sm text-muted-foreground">{t.notEnough}</p>
      )}
      {(view === "control" || view === "rolling") && (
        <p className="text-xs text-muted-foreground">{t.followsHero}</p>
      )}
    </div>
  );
}

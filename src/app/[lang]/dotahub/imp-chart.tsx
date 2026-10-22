"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type ImpMatch = {
  matchId: number;
  heroId: number;
  won: boolean;
  imp: number;
  startTime: number;
  kills: number;
  deaths: number;
  assists: number;
};

const RANGES = [20, 50, 100];
const AVERAGE_OF = 10;
const MIN_HERO_MATCHES = 3;
const WIN = "#10b981";
const LOSS = "#ef4444";
const AVERAGE_LINE = "#8b5cf6";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Tabs<V extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: [V, string][];
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            value === v
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// STRATZ's IMP over the newest ranked matches: a trend (each match, coloured by result, with a
// running average) or the average per hero. matches: newest first, only ones with an IMP.
export function ImpChart({
  matches,
  heroes,
  matchHref,
}: {
  matches: ImpMatch[];
  heroes: Record<number, { zh: string; en: string }>;
  // The match page's address without the id (the language prefix included).
  matchHref: string;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.imp;
  const router = useRouter();
  const [n, setN] = useState(RANGES.find((r) => r >= matches.length) ?? 50);
  const [view, setView] = useState<"trend" | "heroes">("trend");

  const shown = useMemo(() => matches.slice(0, n).reverse(), [matches, n]);
  const average = shown.reduce((sum, m) => sum + m.imp, 0) / shown.length;
  const above = shown.filter((m) => m.imp > 0).length / shown.length;
  const recent = shown.slice(-AVERAGE_OF);
  const before = shown.slice(0, -AVERAGE_OF);
  const change =
    before.length >= AVERAGE_OF
      ? Math.round(
          recent.reduce((s, m) => s + m.imp, 0) / recent.length -
            before.reduce((s, m) => s + m.imp, 0) / before.length,
        )
      : null;

  const perHero = useMemo(() => {
    const groups = new Map<number, number[]>();
    for (const m of shown) groups.set(m.heroId, [...(groups.get(m.heroId) ?? []), m.imp]);
    const all = [...groups.entries()].map(([id, list]) => ({
      id,
      n: list.length,
      avg: Math.round(list.reduce((a, b) => a + b, 0) / list.length),
    }));
    const enough = all.filter((h) => h.n >= MIN_HERO_MATCHES);
    return (enough.length ? enough : all).sort((a, b) => a.avg - b.avg);
  }, [shown]);

  const heroName = (id: number) => heroes[id]?.[lang] ?? String(id);
  const date = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "numeric",
      day: "numeric",
    });

  const option: EChartsOption =
    view === "trend"
      ? {
          grid: { left: 40, right: 12, top: 28, bottom: 28 },
          legend: { top: 0, data: [t.movingAverage], textStyle: { fontSize: 11 } },
          // Hovering anywhere over a match shows it, with the average there.
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "line", lineStyle: { opacity: 0.4 } },
            formatter: (params) => {
              const list = params as { seriesIndex: number; dataIndex: number; value: unknown }[];
              const dot = list.find((x) => x.seriesIndex === 0);
              const m = dot ? shown[dot.dataIndex] : undefined;
              if (!m) return "";
              const average = list.find((x) => x.seriesIndex === 1)?.value;
              return `${heroName(m.heroId)} · ${m.won ? t.win : t.loss} · ${date(m.startTime)}<br/>${m.kills} / ${m.deaths} / ${m.assists} · IMP <b>${signed(m.imp)}</b>${typeof average === "number" ? `<br/>${t.movingAverage} <b>${signed(average)}</b>` : ""}`;
            },
          },
          xAxis: {
            type: "category",
            data: shown.map((m) => date(m.startTime)),
            axisLabel: { fontSize: 10, hideOverlap: true },
            axisTick: { show: false },
          },
          yAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.25 } }, axisLabel: { fontSize: 10 } },
          series: [
            {
              type: "scatter",
              symbolSize: n > 50 ? 6 : 8,
              cursor: "pointer",
              data: shown.map((m) => ({ value: m.imp, itemStyle: { color: m.won ? WIN : LOSS } })),
              markLine: {
                silent: true,
                symbol: "none",
                lineStyle: { type: "dashed", opacity: 0.5 },
                label: { formatter: t.zero, fontSize: 10, position: "insideEndTop" },
                data: [{ yAxis: 0 }],
              },
            },
            {
              name: t.movingAverage,
              type: "line",
              smooth: true,
              showSymbol: false,
              color: AVERAGE_LINE,
              lineStyle: { width: 2 },
              // Starts once there are AVERAGE_OF matches to average (fewer swings wildly).
              data: shown.map((_, i) => {
                if (i < AVERAGE_OF - 1) return null;
                const window = shown.slice(i - AVERAGE_OF + 1, i + 1);
                return Math.round(window.reduce((s, m) => s + m.imp, 0) / window.length);
              }),
            },
          ],
        }
      : {
          grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            trigger: "item",
            formatter: (params) => {
              const h = perHero[(params as { dataIndex: number }).dataIndex];
              return h ? `${heroName(h.id)}<br/>IMP <b>${signed(h.avg)}</b> · ${t.matches(h.n)}` : "";
            },
          },
          xAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.25 } }, axisLabel: { fontSize: 10 } },
          yAxis: {
            type: "category",
            data: perHero.map((h) => heroName(h.id)),
            axisTick: { show: false },
            axisLabel: { fontSize: 11 },
          },
          series: [
            {
              type: "bar",
              barMaxWidth: 16,
              data: perHero.map((h) => ({
                value: h.avg,
                itemStyle: {
                  color: h.avg >= 0 ? WIN : LOSS,
                  borderRadius: h.avg >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
                },
              })),
              label: {
                show: true,
                position: "right",
                fontSize: 10,
                formatter: (params) => {
                  const h = perHero[(params as { dataIndex: number }).dataIndex];
                  return h ? `${signed(h.avg)} · ${t.matches(h.n)}` : "";
                },
              },
            },
          ],
        };

  const onEvents = useMemo(
    () => ({
      click: (params: { seriesIndex?: number; dataIndex?: number }) => {
        if (view !== "trend" || params.seriesIndex !== 0 || params.dataIndex == null) return;
        const m = shown[params.dataIndex];
        if (m) router.push(`${matchHref}/${m.matchId}`);
      },
    }),
    [view, shown, router, matchHref],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          label={t.view}
          value={view}
          onChange={setView}
          options={[
            ["trend", t.trend],
            ["heroes", t.heroes],
          ]}
        />
        <Tabs label={t.range} value={n} onChange={setN} options={RANGES.map((r) => [r, t.recent(r)])} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg border px-3 py-2">
          <dt className="text-xs text-muted-foreground">{t.average}</dt>
          <dd
            className={cn(
              "text-lg font-semibold tabular-nums",
              average >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
            )}
          >
            {signed(Math.round(average))}
          </dd>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <dt className="text-xs text-muted-foreground">{t.above}</dt>
          <dd className="text-lg font-semibold tabular-nums">{Math.round(above * 100)}%</dd>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <dt className="text-xs text-muted-foreground">{t.recentChange}</dt>
          <dd
            className={cn(
              "text-lg font-semibold tabular-nums",
              change == null
                ? ""
                : change >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
            )}
          >
            {change == null ? "–" : signed(change)}
          </dd>
        </div>
      </dl>
      <div style={{ height: view === "trend" ? 240 : Math.max(160, perHero.length * 26 + 16) }}>
        <EChart option={option} onEvents={onEvents as Record<string, (params: never) => void>} />
      </div>
      <p className="text-xs text-muted-foreground">{view === "trend" ? t.trendHint : t.heroesHint}</p>
    </div>
  );
}

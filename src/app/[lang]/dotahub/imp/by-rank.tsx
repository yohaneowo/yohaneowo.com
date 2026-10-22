"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { LOSS, WIN } from "../stats/charts";
import { signed } from "../stats/controls";

const MIN_POINTS = 10;
const MIN_PER_MEDAL = 3;
// IMP per medal (one medal up) beyond which the trend counts as rising or falling.
const FLAT_SLOPE = 3;
// Less than this many medals' worth of spread and no trend can be read.
const MIN_SPREAD = 0.6;
const MEDAL_LINE = "#8b5cf6";
const FIT_LINE = "#9ca3af";

// A match's average rank tier (medal × 10 + stars) as a place on the medal axis: the medal at the
// integer, its five stars spread around it; Immortal has no stars and sits on 8.
function rankPosition(tier: number) {
  const medal = Math.floor(tier / 10);
  const stars = tier % 10;
  return medal + (stars ? (stars - 3) / 5 : 0);
}

// IMP against the match's average rank tier, which stands in for MMR (not public; a player's
// matches are made at their own rating, so as their rating climbs so does the rank of their
// matches): one dot a match, the average per medal, and a straight fit whose slope says whether IMP
// rises, falls or holds as the rank goes up.
export function ImpByRank({
  list,
  ranks,
  heroes,
  matchHref,
}: {
  // Matches with an IMP.
  list: DetailMatch[];
  // Match id → average rank tier (the matches OpenDota has one for).
  ranks: Record<number, number>;
  heroes: Record<number, HeroInfo>;
  matchHref: string;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.impPage;
  const medals = dict.dotahub.medals;
  const router = useRouter();
  const points = useMemo(
    () =>
      list
        .filter((m) => m.imp != null && ranks[m.matchId])
        .map((m) => ({ m, tier: ranks[m.matchId], x: rankPosition(ranks[m.matchId]), y: m.imp! })),
    [list, ranks],
  );
  // A click on a dot opens the match.
  const events = useMemo(
    () => ({
      click: (params: { seriesIndex?: number; dataIndex?: number }) => {
        if (params.seriesIndex !== 0 || params.dataIndex == null) return;
        const p = points[params.dataIndex];
        if (p) router.push(`${matchHref}/${p.m.matchId}`);
      },
    }),
    [points, router, matchHref],
  );
  if (points.length < MIN_POINTS)
    return (
      <p className="text-sm text-muted-foreground">
        {t.rankTooFew} {t.rankCovered(points.length, list.length)}
      </p>
    );

  const perMedal = [1, 2, 3, 4, 5, 6, 7, 8]
    .map((medal) => {
      const own = points.filter((p) => Math.floor(p.tier / 10) === medal);
      return { medal, n: own.length, avg: own.reduce((s, p) => s + p.y, 0) / (own.length || 1) };
    })
    .filter((x) => x.n >= MIN_PER_MEDAL);

  // A straight line through the dots: its slope is IMP per medal.
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const slope = sxx ? points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0;
  const xs = points.map((p) => p.x);
  const low = Math.min(...xs);
  const high = Math.max(...xs);
  const spread = high - low;
  const verdict: keyof typeof t.rankVerdict =
    spread < MIN_SPREAD ? "narrow" : slope >= FLAT_SLOPE ? "up" : slope <= -FLAT_SLOPE ? "down" : "flat";

  const medalName = (tier: number) => {
    const stars = tier % 10;
    return `${medals[Math.floor(tier / 10)] ?? ""}${stars ? ` ${stars}` : ""}`;
  };
  const heroName = (id: number) => heroes[id]?.[lang] ?? String(id);
  const date = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "numeric",
      day: "numeric",
    });
  // Dots of one match's tier would pile up, so each is nudged a little sideways.
  const jitter = (i: number) => ((i * 7919) % 100) / 100 - 0.5;

  const option: EChartsOption = {
    grid: { left: 48, right: 16, top: 28, bottom: 32 },
    legend: { top: 0, data: [t.rankAverageSeries], textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const p = params as { seriesIndex: number; dataIndex: number };
        if (p.seriesIndex === 0) {
          const d = points[p.dataIndex];
          if (!d) return "";
          return `${heroName(d.m.heroId)} · ${d.m.won ? t.won : t.lost} · ${date(d.m.startTime)}<br/>${t.rankOf(medalName(d.tier))} · IMP <b>${signed(d.y)}</b>`;
        }
        if (p.seriesIndex === 1) {
          const x = perMedal[p.dataIndex];
          return x
            ? `${t.rankAverage(medals[x.medal] ?? "", x.n)}<br/>IMP <b>${signed(Math.round(x.avg))}</b>`
            : "";
        }
        return "";
      },
    },
    xAxis: {
      type: "value",
      // Whole numbers, so the ticks (and the medal names on them) sit where the medals are; a
      // medal's stars spread 0.4 either side of it.
      min: Math.max(0, Math.floor(low)),
      max: Math.min(9, Math.ceil(high)),
      interval: 1,
      axisLabel: { fontSize: 10, formatter: (v: number) => medals[v] ?? "" },
      splitLine: { lineStyle: { opacity: 0.15 } },
      axisTick: { show: false },
    },
    yAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.25 } }, axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "scatter",
        symbolSize: points.length > 60 ? 6 : 8,
        cursor: "pointer",
        data: points.map((p, i) => ({
          value: [p.x + jitter(i) * 0.12, p.y],
          itemStyle: { color: p.m.won ? WIN : LOSS, opacity: 0.8 },
        })),
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", opacity: 0.5 },
          label: { formatter: t.zero, fontSize: 10, position: "insideEndTop" },
          data: [{ yAxis: 0 }],
        },
      },
      {
        name: t.rankAverageSeries,
        type: "line",
        color: MEDAL_LINE,
        symbol: "circle",
        symbolSize: 10,
        lineStyle: { width: 2 },
        label: {
          show: true,
          position: "top",
          fontSize: 10,
          formatter: (p) => signed(Math.round(Number((p.value as number[])[1]))),
        },
        data: perMedal.map((x) => [x.medal, Math.round(x.avg)]),
        z: 3,
      },
      {
        type: "line",
        silent: true,
        showSymbol: false,
        color: FIT_LINE,
        lineStyle: { width: 1.5, type: "dotted" },
        tooltip: { show: false },
        data: [
          [low, my + slope * (low - mx)],
          [high, my + slope * (high - mx)],
        ],
      },
    ],
  };
  return (
    <div className="flex flex-col gap-2">
      <div style={{ height: 260 }}>
        <EChart option={option} onEvents={events as Record<string, (params: never) => void>} />
      </div>
      <p className="text-sm">
        <span
          className={cn(
            "font-medium",
            verdict === "up" && "text-emerald-600 dark:text-emerald-400",
            verdict === "down" && "text-red-600 dark:text-red-400",
          )}
        >
          {t.rankVerdict[verdict]}
        </span>
        {verdict !== "narrow" && (
          <span className="text-muted-foreground">
            {" · "}
            {t.rankSlope(signed(Math.round(slope * 10) / 10))}
          </span>
        )}
        <span className="text-muted-foreground">
          {" · "}
          {t.rankCovered(points.length, list.length)}
        </span>
      </p>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { gameState, impByState, LEAD_STATES, spread } from "../stats/analysis";
import { MinuteChart, SpreadChart } from "../stats/charts";
import { avg, FILTER_PAGE, FilterBar, perMinute, Section, signed, useFilterState } from "../stats/controls";
import { CompareMenu, type CompareProps } from "../economy/compare/compare-menu";
import { bestOf, SideTable } from "../economy/compare/compare-view";
import { type FilteredSeries, filterSeries, isCrowd, type Series } from "../economy/compare/series";
import { HistoryNotes } from "../economy/compare/history-notes";

const pct = (v: number) => `${Math.round(v * 100)}%`;
// IMP in whole points, with its sign.
const points = (v: number) => signed(Math.round(v));
const rated = (list: DetailMatch[]) => list.filter((m) => m.imp != null);
const impOf = (list: DetailMatch[]) => avg(rated(list).map((m) => m.imp!));
const winRate = (list: DetailMatch[]) =>
  list.length ? list.filter((m) => m.won).length / list.length : null;
// A side without per-minute IMP (我的对局 keeps each match's IMP only).
const hasMinutes = (x: FilteredSeries) => x.matches.some((m) => m.details.impm.length > 0);
const MIN_HERO_MATCHES = 3;
const MIN_STATE_MINUTES = 10;
const MAX_HEROES = 10;
const ROLLING = 10;

// The IMP page compared: the page's player against up to two others (players, 我的对局, a hero's
// players at a rank tier), all under the same filters. series[0] is the page's player. Each match's
// IMP for everyone; per minute (the curve, ahead and behind) only for sides that have it.
export function ImpCompareView({
  series,
  heroes,
  ranges,
  compare,
}: {
  series: Series[];
  heroes: Record<number, HeroInfo>;
  ranges: number[];
  compare: CompareProps;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.impCompare;
  const p = dict.dotahub.impPage;
  const c = dict.dotahub.compare;
  const e = dict.dotahub.economy;
  const s = dict.dotahub.stats;
  // A rank compares one hero: start on it.
  const rank = series.find((x) => x.kind === "rank");
  const state = useFilterState(ranges, rank?.heroId ?? 0, rank?.position ?? 0);
  const { n, pos, side, hero, result } = state;
  // A rank's name says which position the filter compares (as on the economy page).
  const sides = useMemo(
    () =>
      filterSeries(series, { n, pos, side, hero, result }).map((x) =>
        x.kind === "rank" && pos
          ? { ...x, label: `${x.label} · ${dict.dotahub.stats.positions[pos - 1]}` }
          : x,
      ),
    [series, n, pos, side, hero, result, dict],
  );
  const [me] = sides;
  const name = (id: number) => heroes[id]?.[lang] ?? String(id);
  const withMinutes = sides.filter(hasMinutes);
  const people = sides.filter((x) => !isCrowd(x));

  // The numbers.
  const metrics: { key: string; label: string; values: (number | null)[]; format: (v: number) => string }[] =
    [
      { key: "n", label: c.matches, values: sides.map((x) => x.lists.shown.length), format: String },
      { key: "win", label: c.winRate, values: sides.map((x) => winRate(x.lists.bothResults)), format: pct },
      { key: "imp", label: t.average, values: sides.map((x) => impOf(x.lists.shown)), format: points },
      {
        key: "wins",
        label: t.inWins,
        values: sides.map((x) => impOf(x.lists.bothResults.filter((m) => m.won))),
        format: points,
      },
      {
        key: "losses",
        label: t.inLosses,
        values: sides.map((x) => impOf(x.lists.bothResults.filter((m) => !m.won))),
        format: points,
      },
      {
        key: "positive",
        label: t.positive,
        values: sides.map((x) => {
          const list = rated(x.lists.shown);
          return list.length ? list.filter((m) => m.imp! > 0).length / list.length : null;
        }),
        format: pct,
      },
    ];

  // IMP by minute, one line each (sides with per-minute IMP).
  const curves = withMinutes
    .map((x) => {
      const list = x.lists.shown.map((m) => m.details.impm).filter((v) => v.length);
      return list.length
        ? { name: x.label, color: x.color, values: perMinute(list), dashed: isCrowd(x) }
        : null;
    })
    .filter((v) => v != null);

  // Each match's IMP by hero: heroes the page's player and at least one other side played.
  const heroMatches = sides.map((x) => {
    const map = new Map<number, number[]>();
    for (const m of rated(x.lists.anyHero)) map.set(m.heroId, [...(map.get(m.heroId) ?? []), m.imp!]);
    return map;
  });
  const boxHeroes = [...heroMatches[0].keys()]
    .filter(
      (h) =>
        (heroMatches[0].get(h)?.length ?? 0) >= MIN_HERO_MATCHES &&
        heroMatches.slice(1).some((map) => (map.get(h)?.length ?? 0) >= MIN_HERO_MATCHES),
    )
    .sort(
      (a, b) =>
        heroMatches.reduce((sum, map) => sum + (map.get(b)?.length ?? 0), 0) -
        heroMatches.reduce((sum, map) => sum + (map.get(a)?.length ?? 0), 0),
    )
    .slice(0, MAX_HEROES);
  const box = (values: number[]) => {
    if (values.length < MIN_HERO_MATCHES) return null;
    const sp = spread(values);
    return [sp.p10!, sp.p25!, sp.median!, sp.p75!, sp.p90!] as [number, number, number, number, number];
  };

  // Average IMP with the matches underneath, for the tables.
  const cell = (list: DetailMatch[]) => {
    const value = impOf(list);
    return value == null ? (
      <span className="text-muted-foreground">–</span>
    ) : (
      <span className="flex flex-col items-end leading-tight">
        <span>{points(value)}</span>
        <span className="text-[11px] text-muted-foreground">{rated(list).length}</span>
      </span>
    );
  };

  return (
    <div className={FILTER_PAGE}>
      <FilterBar
        f={{ ...state, ...me.lists }}
        heroes={heroes}
        ranges={ranges}
        compare={(variant) => (
          <CompareMenu
            {...compare}
            heroes={heroes}
            hero={hero}
            position={pos}
            counts={me.lists.counts}
            onHero={state.setHero}
            variant={variant}
          />
        )}
      />
      <p className="text-xs text-muted-foreground">{sides.some(isCrowd) ? t.howCrowd : c.how}</p>
      <HistoryNotes sides={sides} />
      {sides
        .filter((x) => x.progress && x.progress.count < x.progress.target)
        .map((x) => (
          <p key={x.key} className="text-xs text-muted-foreground">
            {c.collecting(x.label, x.progress!.count, x.progress!.target)}
          </p>
        ))}

      <Section title={c.numbers}>
        <SideTable
          sides={sides}
          rows={metrics.map((metric) => ({
            key: metric.key,
            label: metric.label,
            best: metric.key === "n" ? undefined : bestOf(metric.values),
            cells: metric.values.map((v) => (v == null ? "–" : metric.format(v))),
          }))}
        />
      </Section>

      <Section title={p.inMatch} hint={t.curveHint}>
        {curves.length ? (
          <MinuteChart series={curves} minuteLabel={(m) => s.minute(m)} format={points} />
        ) : (
          <p className="text-sm text-muted-foreground">{s.empty}</p>
        )}
      </Section>

      <Section title={t.heroesTitle} hint={t.heroesHint}>
        {boxHeroes.length ? (
          <SpreadChart
            categories={boxHeroes.map(name)}
            series={sides.map((x, k) => ({
              name: x.label,
              color: x.color,
              dashed: isCrowd(x),
              boxes: boxHeroes.map((h) => box(heroMatches[k].get(h) ?? [])),
              notes: boxHeroes.map((h) => c.gamesUnitNote(heroMatches[k].get(h)?.length ?? 0)),
            }))}
            format={points}
            minWidthPerCategory={sides.length * 40 + 30}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{c.noCommon}</p>
        )}
      </Section>

      <Section title={p.byState} hint={t.statesHint}>
        {withMinutes.length ? (
          <SpreadChart
            categories={LEAD_STATES.map((st) => e.states[st])}
            series={withMinutes.map((x) => {
              const values = impByState(x.lists.shown);
              return {
                name: x.label,
                color: x.color,
                dashed: isCrowd(x),
                boxes: LEAD_STATES.map((st) => {
                  if (values[st].length < MIN_STATE_MINUTES) return null;
                  const sp = spread(values[st]);
                  return [sp.p10!, sp.p25!, sp.median!, sp.p75!, sp.p90!] as [
                    number,
                    number,
                    number,
                    number,
                    number,
                  ];
                }),
              };
            })}
            format={points}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{s.empty}</p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={e.gameStatesTitle} hint={t.tableHint}>
          <SideTable
            sides={sides}
            rows={LEAD_STATES.map((st) => ({
              key: st,
              label: e.gameStates[st],
              cells: sides.map((x) => cell(x.lists.bothResults.filter((m) => gameState(m) === st))),
            }))}
          />
        </Section>
        <Section title={p.byLane} hint={t.tableHint}>
          <SideTable
            sides={sides}
            rows={[2, 1, 0, -1, -2].map((score) => ({
              key: String(score),
              label: e.laneOutcomes[String(score) as keyof typeof e.laneOutcomes],
              cells: sides.map((x) => cell(x.lists.bothResults.filter((m) => m.details.laneOut === score))),
            }))}
          />
        </Section>
      </div>

      <Section title={e.byPosition} hint={t.tableHint}>
        <SideTable
          sides={sides}
          rows={[1, 2, 3, 4, 5].map((position) => ({
            key: String(position),
            label: s.positions[position - 1],
            cells: sides.map((x) => cell(x.lists.anyPosition.filter((m) => m.details.pos === position))),
          }))}
        />
      </Section>

      <Section title={p.trend} hint={t.trendHint}>
        <Trend people={people} />
      </Section>
    </div>
  );
}

// Each player's IMP over their matches in order, as a rolling average of ROLLING matches.
function Trend({ people }: { people: FilteredSeries[] }) {
  const { t: dict } = useLocale();
  const c = dict.dotahub.compare;
  const lines = people.map((x) => {
    const imps = rated([...x.lists.shown].sort((a, b) => a.startTime - b.startTime)).map((m) => m.imp!);
    return {
      x,
      values: imps.map((_, i) =>
        i + 1 < Math.min(ROLLING, imps.length)
          ? null
          : Math.round(avg(imps.slice(Math.max(0, i + 1 - ROLLING), i + 1))!),
      ),
    };
  });
  const length = Math.max(0, ...lines.map((l) => l.values.length));
  if (!length) return <p className="text-sm text-muted-foreground">{dict.dotahub.stats.empty}</p>;
  const option: EChartsOption = {
    grid: { left: 44, right: 16, top: 32, bottom: 32 },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "–" : points(Number(v))) },
    xAxis: {
      type: "category",
      name: c.matchOrder,
      nameLocation: "middle",
      nameGap: 20,
      data: Array.from({ length }, (_, i) => String(i + 1)),
      axisLabel: { fontSize: 10 },
    },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { opacity: 0.25 } } },
    series: lines.map(({ x, values }, k) => ({
      name: x.label,
      type: "line" as const,
      color: x.color,
      data: values,
      showSymbol: false,
      smooth: true,
      markLine:
        k === 0
          ? {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: { type: "dashed" as const, color: "#94a3b8", opacity: 0.6 },
              data: [{ yAxis: 0 }],
            }
          : undefined,
    })),
  };
  return (
    <div style={{ height: 280 }}>
      <EChart option={option} />
    </div>
  );
}

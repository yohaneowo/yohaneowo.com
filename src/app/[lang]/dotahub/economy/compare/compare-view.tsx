"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { gameState, incomeByState, LEAD_STATES, type LeadState, spread } from "../../stats/analysis";
import { MinuteChart, SpreadChart } from "../../stats/charts";
import { avg, FilterBar, perMinute, Section, Tabs, useFilterState } from "../../stats/controls";
import { byHero, funnel, mean, rolling, sd } from "../../stats/volatility";
import type { KeyItem } from "../economy-explorer";
import { Forest, LOW_GAMES, MIN_GAMES } from "./forest";
import { type FilteredSeries, filterSeries, type Series } from "./series";

const thousands = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (v: number) => `${Math.round(v * 100)}%`;
const lastHitsBy = (m: DetailMatch, minute: number) =>
  m.details.lhm.length >= minute ? m.details.lhm.slice(0, minute).reduce((a, b) => a + b, 0) : null;
const present = (values: (number | null)[]) => values.filter((v): v is number => v != null);
const running = (values: number[]) => values.map((_, i) => values.slice(0, i + 1).reduce((a, b) => a + b, 0));
const winRate = (list: DetailMatch[]) =>
  list.length ? list.filter((m) => m.won).length / list.length : null;
const MIN_STATE_MINUTES = 10;
const MAX_HEROES = 10;

// A table with one column per side; cells are whatever each metric shows.
function SideTable({
  sides,
  rows,
}: {
  sides: FilteredSeries[];
  rows: { key: string; label: React.ReactNode; cells: React.ReactNode[]; best?: number }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th />
            {sides.map((s) => (
              <th key={s.key} className="px-3 py-2 text-right font-normal whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn("size-2 rounded-full", s.kind === "bracket" && "border bg-transparent")}
                    style={s.kind === "bracket" ? { borderColor: s.color } : { background: s.color }}
                    aria-hidden
                  />
                  {s.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b last:border-0">
              <td className="px-3 py-1.5 whitespace-nowrap">{row.label}</td>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-1.5 text-right whitespace-nowrap tabular-nums",
                    row.best === i && "font-semibold",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Which column has the largest (or smallest) value.
function bestOf(values: (number | null)[], lowest = false) {
  let best = -1;
  values.forEach((v, i) => {
    if (v == null) return;
    if (best < 0 || (lowest ? v < values[best]! : v > values[best]!)) best = i;
  });
  return best < 0 ? undefined : best;
}

// The economy page compared: the page's player against up to two others and / or the bracket,
// all under the same filters. series[0] is the page's player.
export function CompareView({
  series,
  heroes,
  items,
  ranges,
  bracketCv,
}: {
  series: Series[];
  heroes: Record<number, HeroInfo>;
  items: Record<number, KeyItem>;
  ranges: number[];
  bracketCv: Record<number, number[]>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.compare;
  const e = dict.dotahub.economy;
  const s = dict.dotahub.stats;
  const state = useFilterState(ranges);
  const { n, pos, side, hero, result } = state;
  const sides = useMemo(
    () => filterSeries(series, { n, pos, side, hero, result }),
    [series, n, pos, side, hero, result],
  );
  const [me] = sides;
  const [curve, setCurve] = useState<"networth" | "lastHits">("networth");
  const [leadState, setLeadState] = useState<LeadState>("ahead");
  const [view, setView] = useState<"forest" | "riskReturn" | "funnel" | "control" | "rolling">("forest");
  const name = (id: number) => heroes[id]?.[lang] ?? String(id);
  const people = sides.filter((x) => x.kind !== "bracket");
  const bracket = sides.find((x) => x.kind === "bracket");

  // The numbers.
  const metrics: { key: string; label: string; values: (number | null)[]; format: (v: number) => string }[] =
    [
      { key: "n", label: t.matches, values: sides.map((x) => x.lists.shown.length), format: String },
      { key: "win", label: t.winRate, values: sides.map((x) => winRate(x.lists.bothResults)), format: pct },
      {
        key: "gpm",
        label: "GPM",
        values: sides.map((x) => avg(x.lists.shown.map((m) => m.details.gpm))),
        format: thousands,
      },
      {
        key: "xpm",
        label: "XPM",
        values: sides.map((x) => avg(x.lists.shown.map((m) => m.details.xpm))),
        format: thousands,
      },
      {
        key: "lh10",
        label: e.lastHits10,
        values: sides.map((x) => avg(present(x.lists.shown.map((m) => lastHitsBy(m, 10))))),
        format: (v) => String(Math.round(v)),
      },
      {
        key: "nw10",
        label: e.netWorth10,
        values: sides.map((x) => avg(present(x.lists.shown.map((m) => m.details.nwm[10] ?? null)))),
        format: thousands,
      },
      {
        key: "nw20",
        label: e.netWorth20,
        values: sides.map((x) => avg(present(x.lists.shown.map((m) => m.details.nwm[20] ?? null)))),
        format: thousands,
      },
    ];

  // Net worth or last hits by minute, one line each.
  const curves = sides
    .map((x) => {
      const list = x.lists.shown.map((m) => (curve === "networth" ? m.details.nwm : running(m.details.lhm)));
      return list.length
        ? { name: x.label, color: x.color, values: perMinute(list), dashed: x.kind === "bracket" }
        : null;
    })
    .filter((c) => c != null);

  // The side-by-side boxes: heroes the page's player and at least one other side played.
  const heroMatches = sides.map((x) => {
    const map = new Map<number, DetailMatch[]>();
    for (const m of x.lists.anyHero) map.set(m.heroId, [...(map.get(m.heroId) ?? []), m]);
    return map;
  });
  const boxHeroes = [...heroMatches[0].keys()]
    .filter((h) => heroMatches.slice(1).some((map) => map.has(h)))
    .sort(
      (a, b) =>
        heroMatches.reduce((sum, map) => sum + (map.get(b)?.length ?? 0), 0) -
        heroMatches.reduce((sum, map) => sum + (map.get(a)?.length ?? 0), 0),
    )
    .slice(0, MAX_HEROES);

  // Game state, lane outcome, position: win rate with GPM underneath, per side.
  const cell = (list: DetailMatch[]) =>
    list.length ? (
      <span className="flex flex-col items-end leading-tight">
        <span>{pct(winRate(list)!)}</span>
        <span className="text-[11px] text-muted-foreground">
          {thousands(avg(list.map((m) => m.details.gpm))!)} · {list.length}
        </span>
      </span>
    ) : (
      <span className="text-muted-foreground">–</span>
    );

  // Key items: the page player's most built, each side's average first-purchase time.
  const itemTimes = sides.map((x) => {
    const map = new Map<number, number[]>();
    for (const m of x.lists.shown)
      for (const [time, id] of m.details.items)
        if (items[id] && time > 0) map.set(id, [...(map.get(id) ?? []), time]);
    return map;
  });
  const itemIds = [...itemTimes[0].entries()]
    .filter(([, times]) => times.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([id]) => id);

  return (
    <div className="relative flex flex-col gap-6">
      <FilterBar f={{ ...state, ...me.lists }} heroes={heroes} ranges={ranges} />
      <p className="text-xs text-muted-foreground">{bracket ? t.howBracket : t.how}</p>

      <Section title={t.numbers}>
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

      <Section title={curve === "networth" ? e.netWorthCurve : e.lastHitsCurve} hint={t.curveHint}>
        <Tabs
          label={e.curve}
          value={curve}
          onChange={setCurve}
          options={[
            ["networth", e.netWorth],
            ["lastHits", e.lastHitsShort],
          ]}
        />
        <MinuteChart series={curves} minuteLabel={(m) => s.minute(m)} format={thousands} />
      </Section>

      <Section title={t.boxesTitle} hint={t.boxesHint}>
        <Tabs
          label={e.gameState}
          value={leadState}
          onChange={setLeadState}
          options={LEAD_STATES.map((st) => [st, e.states[st]])}
        />
        {boxHeroes.length ? (
          <SpreadChart
            categories={boxHeroes.map(name)}
            series={sides.map((x, k) => {
              const per = boxHeroes.map((h) => {
                const list = heroMatches[k].get(h) ?? [];
                const income = incomeByState(list)[leadState];
                return { list, income, sp: income.length >= MIN_STATE_MINUTES ? spread(income) : null };
              });
              return {
                name: x.label,
                color: x.color,
                dashed: x.kind === "bracket",
                boxes: per.map(({ sp }) => (sp ? [sp.p10!, sp.p25!, sp.median!, sp.p75!, sp.p90!] : null)),
                faded: per.map(({ list }) => x.kind !== "bracket" && list.length < LOW_GAMES),
                notes: per.map(({ list, income }) => t.boxNote(list.length, income.length)),
              };
            })}
            format={thousands}
            unit={e.perMinute}
            fromZero
            minWidthPerCategory={sides.length * 40 + 30}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t.noCommon}</p>
        )}
      </Section>

      <Section title={dict.dotahub.volatility.title} hint={dict.dotahub.volatility.hint}>
        <div role="group" aria-label={dict.dotahub.volatility.chart} className="flex flex-wrap gap-1">
          {(["forest", "riskReturn", "funnel", "control", "rolling"] as const).map((v) => (
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
              {v === "forest" ? t.forest : dict.dotahub.volatility.views[v]}
            </button>
          ))}
        </div>
        {view === "forest" ? (
          <Forest series={sides} heroes={heroes} bracketCv={bracketCv} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {dict.dotahub.volatility.explain[view]} {bracket ? t.peopleOnly : ""}
            </p>
            <VolatilityLines view={view} people={people} bracket={bracket} name={name} />
          </>
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
        <Section title={e.laneTitle} hint={t.tableHint}>
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
          rows={[1, 2, 3, 4, 5].map((p) => ({
            key: String(p),
            label: s.positions[p - 1],
            cells: sides.map((x) => cell(x.lists.anyPosition.filter((m) => m.details.pos === p))),
          }))}
        />
      </Section>

      <Section title={e.items} hint={t.itemsHint}>
        {itemIds.length ? (
          <SideTable
            sides={sides}
            rows={itemIds.map((id) => {
              const values = itemTimes.map((map) => avg(map.get(id) ?? []));
              return {
                key: String(id),
                label: (
                  <span className="flex items-center gap-2">
                    <Image
                      src={items[id].img}
                      alt=""
                      width={28}
                      height={20}
                      unoptimized
                      className="h-5 w-7 rounded-sm"
                    />
                    {items[id].name}
                  </span>
                ),
                best: bestOf(values, true),
                cells: values.map((v, k) =>
                  v == null ? (
                    <span key={k} className="text-muted-foreground">
                      –
                    </span>
                  ) : (
                    <span key={k} className="flex flex-col items-end leading-tight">
                      <span>{clock(Math.round(v))}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {pct((itemTimes[k].get(id)?.length ?? 0) / Math.max(1, sides[k].lists.shown.length))}
                      </span>
                    </span>
                  ),
                ),
              };
            })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{s.empty}</p>
        )}
      </Section>
      <p className="text-xs text-muted-foreground">{t.minGames(MIN_GAMES)}</p>
    </div>
  );
}

// Income × volatility, the funnel, the control chart and rolling volatility with one colour per
// player. The bracket mixes many players, so it has no volatility of its own; the control chart
// shows its average as a band.
function VolatilityLines({
  view,
  people,
  bracket,
  name,
}: {
  view: "riskReturn" | "funnel" | "control" | "rolling";
  people: FilteredSeries[];
  bracket: FilteredSeries | undefined;
  name: (id: number) => string;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.volatility;
  const c = dict.dotahub.compare;
  const e = dict.dotahub.economy;
  const option = useMemo((): EChartsOption | null => {
    const perPerson = people.map((p) => ({ p, heroes: byHero(p.lists.anyHero) }));
    if (view === "riskReturn") {
      const all = perPerson.flatMap((x) => x.heroes);
      if (!all.length) return null;
      return {
        grid: { left: 56, right: 24, top: 32, bottom: 44 },
        legend: { top: 0, data: people.map((p) => p.label), textStyle: { fontSize: 11 } },
        tooltip: { trigger: "item" },
        xAxis: {
          name: t.medianGpm,
          nameLocation: "middle",
          nameGap: 28,
          type: "value",
          scale: true,
          splitLine: { lineStyle: { opacity: 0.2 } },
        },
        yAxis: {
          name: t.volatility,
          type: "value",
          scale: true,
          axisLabel: { formatter: pct },
          splitLine: { lineStyle: { opacity: 0.2 } },
        },
        series: perPerson.map(({ p, heroes }) => ({
          name: p.label,
          type: "scatter",
          color: p.color,
          data: heroes.map((h) => ({
            value: [h.median, h.cv],
            symbolSize: 8 + Math.sqrt(h.n) * 4,
            label: { show: true, formatter: name(h.id), position: "right", fontSize: 10 },
            tooltip: {
              formatter: `${p.label} · ${name(h.id)}<br/>${t.medianGpm} ${thousands(h.median)} · ${t.volatility} ${pct(h.cv)} · ${e.matchesColumn} ${h.n}`,
            },
          })),
        })),
      };
    }
    if (view === "funnel") {
      const all = perPerson.flatMap((x) => x.heroes);
      const f = funnel(all, Math.max(10, ...all.map((h) => h.n)));
      if (!f) return null;
      return {
        grid: { left: 56, right: 24, top: 32, bottom: 44 },
        legend: { top: 0, data: [...people.map((p) => p.label), t.luckRange], textStyle: { fontSize: 11 } },
        tooltip: { trigger: "item" },
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
            data: f.points.map((x) => [x.n, x.high]),
            tooltip: { show: false },
          },
          {
            name: t.luckRange,
            type: "line",
            smooth: true,
            showSymbol: false,
            color: "#94a3b8",
            lineStyle: { type: "dashed" },
            data: f.points.map((x) => [x.n, x.low]),
            tooltip: { show: false },
          },
          ...perPerson.map(({ p, heroes }) => ({
            name: p.label,
            type: "scatter" as const,
            color: p.color,
            symbolSize: 10,
            data: heroes.map((h) => ({
              value: [h.n, h.cv],
              label: { show: true, formatter: name(h.id), position: "right" as const, fontSize: 10 },
              tooltip: { formatter: `${p.label} · ${name(h.id)} · ${pct(h.cv)} · ${e.matchesColumn} ${h.n}` },
            })),
          })),
        ],
      };
    }
    // Control chart and rolling volatility: match by match, each player on their own count.
    const lines = people.map((p) => {
      const gpm = [...p.lists.shown].sort((a, b) => a.startTime - b.startTime).map((m) => m.details.gpm);
      return { p, gpm };
    });
    const length = Math.max(0, ...lines.map((l) => l.gpm.length));
    if (!length) return null;
    const bracketGpm = bracket?.lists.shown.map((m) => m.details.gpm) ?? [];
    const band =
      view === "control" && bracketGpm.length >= 10 ? { mean: mean(bracketGpm), sd: sd(bracketGpm) } : null;
    return {
      grid: { left: 48, right: 24, top: 32, bottom: 32 },
      legend: { top: 0, data: people.map((p) => p.label), textStyle: { fontSize: 11 } },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => (v == null ? "–" : view === "rolling" ? pct(Number(v)) : thousands(Number(v))),
      },
      xAxis: {
        name: c.matchOrder,
        nameLocation: "middle",
        nameGap: 20,
        type: "category",
        data: Array.from({ length }, (_, i) => String(i + 1)),
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { formatter: view === "rolling" ? pct : undefined },
        splitLine: { lineStyle: { opacity: 0.2 } },
      },
      series: lines.map(({ p, gpm }, k) => ({
        name: p.label,
        type: "line" as const,
        color: p.color,
        smooth: view === "rolling",
        showSymbol: view === "control",
        symbolSize: 5,
        data: view === "rolling" ? rolling(gpm, 10) : gpm,
        markArea:
          band && k === 0
            ? {
                silent: true,
                itemStyle: { color: `${bracket!.color}22` },
                label: {
                  show: true,
                  position: "insideTopRight" as const,
                  formatter: c.bracketBand(thousands(band.mean)),
                  fontSize: 10,
                },
                data: [[{ yAxis: band.mean - 2 * band.sd }, { yAxis: band.mean + 2 * band.sd }]],
              }
            : undefined,
      })),
    } as EChartsOption;
  }, [view, people, bracket, name, t, c, e]);
  if (!option) return <p className="text-sm text-muted-foreground">{t.notEnough}</p>;
  return (
    <div style={{ height: view === "riskReturn" || view === "funnel" ? 380 : 300 }}>
      <EChart option={option} />
    </div>
  );
}

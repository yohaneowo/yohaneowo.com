"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { BarsChart, LOSS, MinuteChart, TrendChart, WIN } from "../stats/charts";
import { avg, FilterBar, perMinute, Section, signed, Stat, useMatchFilters } from "../stats/controls";
import { ByLength, Distribution, ImpByLane, ImpByState, Predicted, Streaks, WhenBest } from "./more";

const PHASES = [
  ["laning", 0, 10],
  ["mid", 10, 30],
  ["late", 30, Infinity],
] as const;
const AWARDS = ["MVP", "TOP_CORE", "TOP_SUPPORT"] as const;
type SortKey = "n" | "winRate" | "imp" | "best";

// One match in the best / worst lists.
function MatchLine({
  m,
  heroes,
  matchHref,
  wonLabel,
  lostLabel,
  date,
}: {
  m: DetailMatch;
  heroes: Record<number, HeroInfo>;
  matchHref: string;
  wonLabel: string;
  lostLabel: string;
  date: string;
}) {
  const { lang } = useLocale();
  return (
    <li>
      <Link
        href={`${matchHref}/${m.matchId}`}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
      >
        {heroes[m.heroId] && (
          <Image src={heroes[m.heroId].icon} alt="" width={20} height={20} unoptimized className="size-5" />
        )}
        <span className="min-w-0 flex-1 truncate">{heroes[m.heroId]?.[lang] ?? m.heroId}</span>
        <span
          className={cn(
            "text-xs",
            m.won ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {m.won ? wonLabel : lostLabel}
        </span>
        <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
          {m.kills}/{m.deaths}/{m.assists}
        </span>
        <span className="w-12 text-right text-xs text-muted-foreground">{date}</span>
        <span
          className={cn(
            "w-10 text-right font-medium tabular-nums",
            m.imp! >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {signed(m.imp!)}
        </span>
      </Link>
    </li>
  );
}

// The IMP page: STRATZ's performance score over the filtered ranked matches, as a trend, through a
// match minute by minute, per position, per hero, and the best and worst games.
export function ImpExplorer({
  matches,
  sides,
  heroes,
  ranges,
  matchHref,
}: {
  matches: DetailMatch[];
  sides: Record<number, boolean>;
  heroes: Record<number, HeroInfo>;
  ranges: number[];
  matchHref: string;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.impPage;
  const s = dict.dotahub.stats;
  const f = useMatchFilters(matches, sides, ranges);
  const [sort, setSort] = useState<{ key: SortKey; down: boolean }>({ key: "n", down: true });

  // Matches with an IMP, oldest first for the charts.
  const rated = f.shown.filter((m) => m.imp != null);
  const ordered = [...rated].reverse();
  const imps = rated.map((m) => m.imp!);
  const average = avg(imps);
  const recent = imps.slice(0, 10);
  const before = imps.slice(10);
  const change = before.length >= 10 ? Math.round(avg(recent)! - avg(before)!) : null;
  const awards = AWARDS.map((a) => [a, f.shown.filter((m) => m.details.award === a).length] as const);

  const heroName = (id: number) => heroes[id]?.[lang] ?? String(id);
  const date = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "numeric",
      day: "numeric",
    });

  // IMP through the match, minute by minute, wins against losses.
  const won = f.shown.filter((m) => m.won).map((m) => m.details.impm);
  const lost = f.shown.filter((m) => !m.won).map((m) => m.details.impm);
  const curves = [
    ...(won.length ? [{ name: t.won, color: WIN, values: perMinute(won) }] : []),
    ...(lost.length ? [{ name: t.lost, color: LOSS, values: perMinute(lost) }] : []),
  ];
  const phaseAverage = (from: number, to: number) =>
    avg(f.shown.flatMap((m) => m.details.impm.filter((_, minute) => minute >= from && minute < to)));

  // Per position: everything but the position filter.
  const positions = [1, 2, 3, 4, 5]
    .map((pos) => {
      const list = f.anyPosition.filter((m) => m.details.pos === pos && m.imp != null);
      return {
        pos,
        n: list.length,
        imp: avg(list.map((m) => m.imp!)),
        wins: list.filter((m) => m.won).length,
      };
    })
    .filter((p) => p.n > 0);

  // Per hero: everything but the hero filter.
  const byHero = new Map<number, DetailMatch[]>();
  for (const m of f.anyHero) if (m.imp != null) byHero.set(m.heroId, [...(byHero.get(m.heroId) ?? []), m]);
  const heroRows = [...byHero.entries()].map(([id, list]) => ({
    id,
    n: list.length,
    winRate: list.filter((m) => m.won).length / list.length,
    imp: avg(list.map((m) => m.imp!))!,
    best: Math.max(...list.map((m) => m.imp!)),
  }));
  heroRows.sort((a, b) => (sort.down ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]));

  const best = [...rated].sort((a, b) => b.imp! - a.imp!).slice(0, 5);
  const worst = [...rated].sort((a, b) => a.imp! - b.imp!).slice(0, 5);

  const header = (key: SortKey, label: string) => (
    <th className="px-3 py-2 text-right font-normal">
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, down: s.key === key ? !s.down : true }))}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          sort.key === key && "text-foreground",
        )}
      >
        {label}
        {sort.key === key &&
          (sort.down ? (
            <ArrowDownIcon className="size-3" aria-hidden />
          ) : (
            <ArrowUpIcon className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-6">
      <FilterBar f={f} heroes={heroes} ranges={ranges} />
      {!rated.length ? (
        <p className="text-sm text-muted-foreground">{s.empty}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat
              label={t.average}
              value={signed(Math.round(average!))}
              tone={average! >= 0 ? "good" : "bad"}
              hint={s.matches(rated.length)}
            />
            <Stat
              label={t.above}
              value={`${Math.round((imps.filter((v) => v > 0).length / imps.length) * 100)}%`}
              hint={t.aboveHint}
            />
            <Stat
              label={t.recentChange}
              value={change == null ? "–" : signed(change)}
              tone={change == null ? undefined : change >= 0 ? "good" : "bad"}
              hint={t.recentChangeHint}
            />
            <Stat
              label={t.awards}
              value={awards.reduce((sum, [, n]) => sum + n, 0)}
              hint={awards.map(([a, n]) => `${t.award[a]} ${n}`).join(" · ")}
            />
          </div>

          <Section title={t.trend} hint={t.trendHint}>
            <TrendChart
              points={ordered.map((m) => ({
                value: m.imp!,
                won: m.won,
                label: date(m.startTime),
                matchId: m.matchId,
                tip: `${heroName(m.heroId)} · ${m.won ? t.won : t.lost} · ${date(m.startTime)}<br/>${m.kills} / ${m.deaths} / ${m.assists} · IMP <b>${signed(m.imp!)}</b>`,
              }))}
              averageLabel={t.movingAverage}
              baseline={{ value: 0, label: t.zero }}
              matchHref={matchHref}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t.inMatch} hint={t.inMatchHint}>
              <MinuteChart
                series={curves}
                minuteLabel={(m) => s.minute(m)}
                format={(v) => signed(Math.round(v))}
                zeroLine={t.zero}
              />
              <div className="grid grid-cols-3 gap-2">
                {PHASES.map(([key, from, to]) => {
                  const value = phaseAverage(from, to);
                  return (
                    <Stat
                      key={key}
                      label={dict.dotahub.deaths.phases[key]}
                      value={value == null ? "–" : signed(Math.round(value))}
                      tone={value == null ? undefined : value >= 0 ? "good" : "bad"}
                    />
                  );
                })}
              </div>
            </Section>
            <Section title={t.byPosition} hint={t.byPositionHint}>
              {positions.length ? (
                <BarsChart
                  rows={positions.map((p) => ({
                    label: s.positions[p.pos - 1],
                    value: Math.round(p.imp!),
                    note: `${s.matches(p.n)} · ${s.winRate(Math.round((p.wins / p.n) * 100))}`,
                  }))}
                  format={signed}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{s.empty}</p>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t.byState} hint={t.byStateHint}>
              <ImpByState list={f.shown} />
            </Section>
            <Section title={t.byLane} hint={t.byLaneHint}>
              <ImpByLane list={f.bothResults} />
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t.length} hint={t.lengthHint}>
              <ByLength list={f.bothResults} />
            </Section>
            <Section title={t.distribution} hint={t.distributionHint}>
              <Distribution list={f.shown} />
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t.streak} hint={t.streakHint}>
              <Streaks list={f.bothResults} all={matches} />
            </Section>
            <Section title={t.when} hint={t.whenHint}>
              <WhenBest list={f.bothResults} />
            </Section>
          </div>

          <Section title={t.heroes} hint={t.heroesHint}>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-normal">{t.hero}</th>
                    {header("n", t.matchesColumn)}
                    {header("winRate", t.winRateColumn)}
                    {header("imp", t.impColumn)}
                    {header("best", t.bestColumn)}
                  </tr>
                </thead>
                <tbody>
                  {heroRows.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => f.setHero(f.hero === h.id ? 0 : h.id)}
                      className={cn(
                        "cursor-pointer border-b last:border-0 hover:bg-muted/50",
                        f.hero === h.id && "bg-muted",
                      )}
                    >
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          {heroes[h.id] && (
                            <Image
                              src={heroes[h.id].icon}
                              alt=""
                              width={20}
                              height={20}
                              unoptimized
                              className="size-5"
                            />
                          )}
                          {heroName(h.id)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{h.n}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{Math.round(h.winRate * 100)}%</td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-right font-medium tabular-nums",
                          h.imp >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {signed(Math.round(h.imp))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{signed(h.best)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t.best}>
              <ul className="flex flex-col">
                {best.map((m) => (
                  <MatchLine
                    key={m.matchId}
                    m={m}
                    heroes={heroes}
                    matchHref={matchHref}
                    wonLabel={t.won}
                    lostLabel={t.lost}
                    date={date(m.startTime)}
                  />
                ))}
              </ul>
            </Section>
            <Section title={t.worst}>
              <ul className="flex flex-col">
                {worst.map((m) => (
                  <MatchLine
                    key={m.matchId}
                    m={m}
                    heroes={heroes}
                    matchHref={matchHref}
                    wonLabel={t.won}
                    lostLabel={t.lost}
                    date={date(m.startTime)}
                  />
                ))}
              </ul>
            </Section>
          </div>
        </>
      )}
      {rated.length > 0 && (
        <Section title={t.predicted} hint={t.predictedHint}>
          <Predicted list={f.bothResults} heroes={heroes} matchHref={matchHref} />
        </Section>
      )}
      <p className="text-xs text-muted-foreground">{t.about}</p>
    </div>
  );
}

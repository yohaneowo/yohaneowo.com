"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { LOSS, MinuteChart, TrendChart, WIN } from "../stats/charts";
import { avg, FilterBar, perMinute, Section, Stat, Tabs, useMatchFilters } from "../stats/controls";

export type KeyItem = { name: string; img: string };

const thousands = (n: number) => Math.round(n).toLocaleString("en-US");
// Last hits by minute N: the per-minute counts added up to there.
const lastHitsBy = (m: DetailMatch, minute: number) =>
  m.details.lhm.length >= minute ? m.details.lhm.slice(0, minute).reduce((a, b) => a + b, 0) : null;
const netWorthAt = (m: DetailMatch, minute: number) => m.details.nwm[minute] ?? null;
const running = (values: number[]) => values.map((_, i) => values.slice(0, i + 1).reduce((a, b) => a + b, 0));
const present = (values: (number | null)[]) => values.filter((v): v is number => v != null);

// The economy page: GPM, XPM, last hits and net worth over the filtered ranked matches, how the net
// worth grows in wins and losses, per position, and when the big items come.
export function EconomyExplorer({
  matches,
  sides,
  heroes,
  items,
  ranges,
  matchHref,
}: {
  matches: DetailMatch[];
  sides: Record<number, boolean>;
  heroes: Record<number, HeroInfo>;
  // The key items (finished, pricey) by id; other purchases are left out of the timings.
  items: Record<number, KeyItem>;
  ranges: number[];
  matchHref: string;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.economy;
  const s = dict.dotahub.stats;
  const f = useMatchFilters(matches, sides, ranges);
  const [curve, setCurve] = useState<"networth" | "lastHits">("networth");

  const shown = f.shown;
  const ordered = [...shown].reverse();
  const heroName = (id: number) => heroes[id]?.[lang] ?? String(id);
  const date = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "numeric",
      day: "numeric",
    });

  const gpm = avg(shown.map((m) => m.details.gpm));
  const xpm = avg(shown.map((m) => m.details.xpm));
  const lh10 = avg(present(shown.map((m) => lastHitsBy(m, 10))));
  const nw10 = avg(present(shown.map((m) => netWorthAt(m, 10))));
  const nw20 = avg(present(shown.map((m) => netWorthAt(m, 20))));
  const denies = avg(shown.map((m) => m.details.dn));

  const pick = (m: DetailMatch) => (curve === "networth" ? m.details.nwm : running(m.details.lhm));
  const won = shown.filter((m) => m.won).map(pick);
  const lost = shown.filter((m) => !m.won).map(pick);
  const curves = [
    ...(won.length ? [{ name: t.won, color: WIN, values: perMinute(won) }] : []),
    ...(lost.length ? [{ name: t.lost, color: LOSS, values: perMinute(lost) }] : []),
  ];

  // Per position: everything but the position filter.
  const positions = [1, 2, 3, 4, 5]
    .map((pos) => {
      const list = f.anyPosition.filter((m) => m.details.pos === pos);
      return {
        pos,
        n: list.length,
        wins: list.filter((m) => m.won).length,
        gpm: avg(list.map((m) => m.details.gpm)),
        xpm: avg(list.map((m) => m.details.xpm)),
        lh10: avg(present(list.map((m) => lastHitsBy(m, 10)))),
        nw20: avg(present(list.map((m) => netWorthAt(m, 20)))),
      };
    })
    .filter((p) => p.n > 0);

  // Key item timings: each item's first purchase in the matches where it was bought at all.
  const timings = new Map<number, { won: number[]; lost: number[] }>();
  for (const m of shown)
    for (const [time, id] of m.details.items)
      if (items[id] && time > 0) {
        const entry = timings.get(id) ?? { won: [], lost: [] };
        (m.won ? entry.won : entry.lost).push(time);
        timings.set(id, entry);
      }
  const itemRows = [...timings.entries()]
    .map(([id, { won, lost }]) => {
      const all = [...won, ...lost];
      return {
        id,
        n: all.length,
        share: all.length / shown.length,
        avg: avg(all)!,
        won: avg(won),
        lost: avg(lost),
        fastest: Math.min(...all),
      };
    })
    .filter((r) => r.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 15);

  return (
    <div className="flex flex-col gap-6">
      <FilterBar f={f} heroes={heroes} ranges={ranges} />
      {!shown.length ? (
        <p className="text-sm text-muted-foreground">{s.empty}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="GPM" value={thousands(gpm!)} hint={s.matches(shown.length)} />
            <Stat label="XPM" value={thousands(xpm!)} />
            <Stat label={t.lastHits10} value={lh10 == null ? "–" : Math.round(lh10)} />
            <Stat label={t.netWorth10} value={nw10 == null ? "–" : thousands(nw10)} />
            <Stat label={t.netWorth20} value={nw20 == null ? "–" : thousands(nw20)} />
            <Stat label={t.denies} value={Math.round(denies!)} />
          </div>

          <Section title={curve === "networth" ? t.netWorthCurve : t.lastHitsCurve} hint={t.curveHint}>
            <Tabs
              label={t.curve}
              value={curve}
              onChange={setCurve}
              options={[
                ["networth", t.netWorth],
                ["lastHits", t.lastHitsShort],
              ]}
            />
            <MinuteChart series={curves} minuteLabel={(m) => s.minute(m)} format={thousands} />
          </Section>

          <Section title={t.gpmTrend} hint={t.gpmTrendHint}>
            <TrendChart
              points={ordered.map((m) => ({
                value: m.details.gpm,
                won: m.won,
                label: date(m.startTime),
                matchId: m.matchId,
                tip: `${heroName(m.heroId)} · ${m.won ? t.won : t.lost} · ${date(m.startTime)}<br/>GPM <b>${m.details.gpm}</b> · XPM ${m.details.xpm} · ${t.lastHitsShort} ${m.details.lh}`,
              }))}
              averageLabel={t.movingAverage}
              baseline={{ value: Math.round(gpm!), label: t.averageLine(Math.round(gpm!)) }}
              matchHref={matchHref}
            />
          </Section>

          <Section title={t.byPosition} hint={t.byPositionHint}>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-normal">{s.position}</th>
                    <th className="px-3 py-2 text-right font-normal">{t.matchesColumn}</th>
                    <th className="px-3 py-2 text-right font-normal">{t.winRateColumn}</th>
                    <th className="px-3 py-2 text-right font-normal">GPM</th>
                    <th className="px-3 py-2 text-right font-normal">XPM</th>
                    <th className="px-3 py-2 text-right font-normal">{t.lastHits10}</th>
                    <th className="px-3 py-2 text-right font-normal">{t.netWorth20}</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr
                      key={p.pos}
                      onClick={() => f.setPos(f.pos === p.pos ? 0 : p.pos)}
                      className={cn(
                        "cursor-pointer border-b last:border-0 hover:bg-muted/50",
                        f.pos === p.pos && "bg-muted",
                      )}
                    >
                      <td className="px-3 py-1.5">{s.positions[p.pos - 1]}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.n}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {Math.round((p.wins / p.n) * 100)}%
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{thousands(p.gpm!)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{thousands(p.xpm!)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {p.lh10 == null ? "–" : Math.round(p.lh10)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {p.nw20 == null ? "–" : thousands(p.nw20)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={t.items} hint={f.hero ? t.itemsHint : t.itemsPickHero}>
            {itemRows.length ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-3 py-2 font-normal">{t.item}</th>
                      <th className="px-3 py-2 text-right font-normal">{t.built}</th>
                      <th className="px-3 py-2 text-right font-normal">{t.averageTime}</th>
                      <th className="px-3 py-2 text-right font-normal">{t.inWins}</th>
                      <th className="px-3 py-2 text-right font-normal">{t.inLosses}</th>
                      <th className="px-3 py-2 text-right font-normal">{t.fastest}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemRows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-2">
                            <Image
                              src={items[r.id].img}
                              alt=""
                              width={28}
                              height={20}
                              unoptimized
                              className="h-5 w-7 rounded-sm"
                            />
                            {items[r.id].name}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {Math.round(r.share * 100)}%
                          <span className="ml-1 text-xs text-muted-foreground">({r.n})</span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {clock(Math.round(r.avg))}
                        </td>
                        <td className="px-3 py-1.5 text-right text-emerald-600 tabular-nums dark:text-emerald-400">
                          {r.won == null ? "–" : clock(Math.round(r.won))}
                        </td>
                        <td className="px-3 py-1.5 text-right text-red-600 tabular-nums dark:text-red-400">
                          {r.lost == null ? "–" : clock(Math.round(r.lost))}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{clock(r.fastest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{s.empty}</p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

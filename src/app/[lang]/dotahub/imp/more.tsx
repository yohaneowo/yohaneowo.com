"use client";

import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import {
  highestChance,
  impByState,
  LEAD_STATES,
  lowestChance,
  STREAK_KEYS,
  streakOf,
} from "../stats/analysis";
import { BarsChart, HistogramChart } from "../stats/charts";
import { avg, Section, signed, Stat } from "../stats/controls";
import { MatchRow, Table, toneOf } from "../stats/rows";

const rated = (list: DetailMatch[]) => list.filter((m) => m.imp != null);
const winRate = (list: DetailMatch[]) =>
  list.length ? Math.round((list.filter((m) => m.won).length / list.length) * 100) : 0;
const impOf = (list: DetailMatch[]) => avg(rated(list).map((m) => m.imp!));

// IMP minute by minute while the team was ahead, even and behind.
export function ImpByState({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.impPage;
  const e = dict.dotahub.economy;
  const byState = impByState(list);
  if (LEAD_STATES.every((state) => !byState[state].length))
    return <p className="text-sm text-muted-foreground">{e.noLead}</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {LEAD_STATES.map((state) => {
        const value = avg(byState[state]);
        return (
          <Stat
            key={state}
            label={e.states[state]}
            value={value == null ? "–" : signed(Math.round(value))}
            tone={value == null ? undefined : value >= 0 ? "good" : "bad"}
            hint={t.minutes(byState[state].length)}
          />
        );
      })}
    </div>
  );
}

export function ImpByLane({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const e = dict.dotahub.economy;
  const s = dict.dotahub.stats;
  const rows = [2, 1, 0, -1, -2]
    .map((score) => {
      const matches = rated(list.filter((m) => m.details.laneOut === score));
      return { score, matches, imp: impOf(matches) };
    })
    .filter((r) => r.matches.length);
  if (!rows.length) return <p className="text-sm text-muted-foreground">{e.noLead}</p>;
  return (
    <BarsChart
      rows={rows.map((r) => ({
        label: e.laneOutcomes[String(r.score) as keyof typeof e.laneOutcomes],
        value: Math.round(r.imp!),
        note: `${s.matches(r.matches.length)} · ${s.winRate(winRate(r.matches))}`,
      }))}
      format={signed}
    />
  );
}

// What came just before: the first game of a sitting, after a win, after a loss, after two losses.
export function Streaks({ list, all }: { list: DetailMatch[]; all: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.impPage;
  const groups = STREAK_KEYS.map((key) => [key, list.filter((m) => streakOf(m, all) === key)] as const);
  return (
    <Table
      head={[t.before, t.matchesColumn, t.winRateColumn, t.impColumn]}
      rows={groups.map(([key, matches]) => {
        const imp = impOf(matches);
        return {
          key,
          cells: [
            t.streaks[key],
            matches.length,
            matches.length ? `${winRate(matches)}%` : "–",
            imp == null ? "–" : <span className={toneOf(imp)}>{signed(Math.round(imp))}</span>,
          ],
        };
      })}
    />
  );
}

const BLOCKS = [0, 4, 8, 12, 16, 20];

// Average IMP by weekday and four-hour block, in the viewer's own time zone.
export function WhenBest({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.impPage;
  const s = dict.dotahub.stats;
  const cells = new Map<string, DetailMatch[]>();
  for (const m of rated(list)) {
    const d = new Date(m.startTime * 1000);
    const key = `${(d.getDay() + 6) % 7}-${Math.floor(d.getHours() / 4)}`;
    cells.set(key, [...(cells.get(key) ?? []), m]);
  }
  const color = (imp: number) =>
    imp >= 0
      ? `rgba(16, 185, 129, ${Math.min(0.85, 0.15 + imp / 30)})`
      : `rgba(239, 68, 68, ${Math.min(0.85, 0.15 - imp / 30)})`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {BLOCKS.map((h) => (
              <th key={h} className="font-normal text-muted-foreground">
                {t.block(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.weekdays.map((day, d) => (
            <tr key={day}>
              <th className="pr-1 text-right font-normal text-muted-foreground">{day}</th>
              {BLOCKS.map((_, b) => {
                const matches = cells.get(`${d}-${b}`) ?? [];
                const imp = impOf(matches);
                return (
                  <td
                    key={b}
                    title={
                      imp == null
                        ? undefined
                        : `${day} ${t.block(BLOCKS[b])} · IMP ${signed(Math.round(imp))} · ${s.matches(matches.length)} · ${s.winRate(winRate(matches))}`
                    }
                    className={cn(
                      "h-9 rounded-md text-center tabular-nums",
                      imp == null && "bg-muted/40 text-muted-foreground/40",
                    )}
                    style={imp == null ? undefined : { background: color(imp) }}
                  >
                    {imp == null ? (
                      ""
                    ) : (
                      <>
                        <div className="font-medium">{signed(Math.round(imp))}</div>
                        <div className="text-[10px] opacity-70">{matches.length}</div>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LENGTHS = [0, 30, 40, 50];

export function ByLength({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.impPage;
  const s = dict.dotahub.stats;
  const rows = LENGTHS.map((from, i) => {
    const to = LENGTHS[i + 1] ?? Infinity;
    const matches = rated(list.filter((m) => m.duration / 60 >= from && m.duration / 60 < to));
    return { label: t.lengths[i], matches, imp: impOf(matches) };
  }).filter((r) => r.matches.length);
  return (
    <BarsChart
      rows={rows.map((r) => ({
        label: r.label,
        value: Math.round(r.imp!),
        note: `${s.matches(r.matches.length)} · ${s.winRate(winRate(r.matches))}`,
      }))}
      format={signed}
    />
  );
}

const BIN = 10;

export function Distribution({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.impPage;
  const imps = rated(list);
  if (!imps.length) return null;
  const low = Math.max(-60, Math.floor(Math.min(...imps.map((m) => m.imp!)) / BIN) * BIN);
  const high = Math.min(60, Math.floor(Math.max(...imps.map((m) => m.imp!)) / BIN) * BIN);
  const bins = [];
  for (let from = low; from <= high; from += BIN) {
    const inBin = imps.filter((m) => {
      const v = Math.max(-60, Math.min(60, m.imp!));
      return v >= from && (v < from + BIN || (from === high && v <= from + BIN));
    });
    bins.push({
      label: `${signed(from)}`,
      won: inBin.filter((m) => m.won).length,
      lost: inBin.filter((m) => !m.won).length,
    });
  }
  return <HistogramChart bins={bins} wonLabel={t.won} lostLabel={t.lost} />;
}

const UNDERDOG = 30;
const FAVOURITE = 70;

// Games won after STRATZ gave them under 30%, and games lost after it gave them over 70%.
export function Predicted({
  list,
  heroes,
  matchHref,
}: {
  list: DetailMatch[];
  heroes: Record<number, HeroInfo>;
  matchHref: string;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.impPage;
  const underdog = list
    .filter((m) => m.won && (lowestChance(m) ?? 100) <= UNDERDOG)
    .sort((a, b) => lowestChance(a)! - lowestChance(b)!);
  const thrown = list
    .filter((m) => !m.won && (highestChance(m) ?? 0) >= FAVOURITE)
    .sort((a, b) => highestChance(b)! - highestChance(a)!);
  const block = (
    title: string,
    matches: DetailMatch[],
    extra: (m: DetailMatch) => string,
    avgLabel: string,
  ) => {
    const imp = impOf(matches);
    return (
      <Section
        title={`${title} · ${matches.length}`}
        hint={imp == null ? undefined : avgLabel + signed(Math.round(imp))}
      >
        {matches.length ? (
          <ul className="flex flex-col">
            {matches.slice(0, 8).map((m) => (
              <MatchRow key={m.matchId} m={m} heroes={heroes} matchHref={matchHref} extra={extra(m)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t.noneOfThese}</p>
        )}
      </Section>
    );
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {block(t.underdog, underdog, (m) => t.lowestChance(lowestChance(m)!), t.averageImp)}
      {block(t.favourite, thrown, (m) => t.highestChance(highestChance(m)!), t.averageImp)}
    </div>
  );
}

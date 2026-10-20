"use client";

import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import {
  againstAverage,
  biggestLead,
  deepestDeficit,
  gameState,
  incomeByState,
  isComeback,
  isThrow,
  LEAD_STATES,
  type LeadState,
  spread,
  variation,
} from "../stats/analysis";
import { LOSS, SpreadChart, WIN } from "../stats/charts";
import { avg, Section, signed, Stat } from "../stats/controls";
import { MatchRow, Table, toneOf } from "../stats/rows";

const STATE_COLORS: Record<LeadState, string> = { ahead: WIN, even: "#94a3b8", behind: LOSS };
const MIN_MINUTES = 30;
const MIN_HERO_MATCHES = 3;
const thousands = (n: number) => Math.round(n).toLocaleString("en-US");
const percent = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100)}%`;
const winRate = (list: DetailMatch[]) =>
  list.length ? Math.round((list.filter((m) => m.won).length / list.length) * 100) : 0;

// Net worth and last hits against the hero's average at the same position (STRATZ).
export function AgainstAverage({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.economy;
  const s = dict.dotahub.stats;
  const cards = [
    [t.vsAverage(t.netWorth10), againstAverage(list, 10, "nw")],
    [t.vsAverage(t.netWorth20), againstAverage(list, 20, "nw")],
    [t.vsAverage(t.lastHits10), againstAverage(list, 10, "lh")],
  ] as const;
  if (cards.every(([, c]) => !c)) return null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {cards.map(([label, c]) => (
        <Stat
          key={label}
          label={label}
          value={c ? percent(c.diff) : "–"}
          tone={c ? (c.diff >= 0 ? "good" : "bad") : undefined}
          hint={c ? `${s.matches(c.n)} · ${t.vsAverageHint}` : undefined}
        />
      ))}
    </div>
  );
}

// Gold per minute while ahead, even and behind, per hero: the box plot for the most played and the
// table for all with enough matches, with how unsteady each hero's GPM is.
export function IncomeSpread({
  list,
  heroes,
  hero,
}: {
  list: DetailMatch[];
  heroes: Record<number, HeroInfo>;
  hero: number;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.economy;
  const s = dict.dotahub.stats;
  const byHero = new Map<number, DetailMatch[]>();
  for (const m of list) if (m.details.lead.length) byHero.set(m.heroId, [...(byHero.get(m.heroId) ?? []), m]);
  const rows = [...byHero.entries()]
    .filter(([id, matches]) => matches.length >= MIN_HERO_MATCHES || id === hero)
    .map(([id, matches]) => {
      const income = incomeByState(matches);
      return {
        id,
        n: matches.length,
        spreads: Object.fromEntries(
          LEAD_STATES.map((state) => [
            state,
            income[state].length >= MIN_MINUTES ? spread(income[state]) : null,
          ]),
        ) as Record<LeadState, ReturnType<typeof spread> | null>,
        volatility: variation(matches.map((m) => m.details.gpm)),
      };
    })
    .sort((a, b) => b.n - a.n);
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t.noLead}</p>;
  const charted = (hero ? rows.filter((r) => r.id === hero) : rows).slice(0, 8);
  const cell = (sp: ReturnType<typeof spread> | null) =>
    sp ? (
      <>
        <span className="font-medium">{thousands(sp.median!)}</span>
        <span className="ml-1 text-xs text-muted-foreground">
          {thousands(sp.p10!)}–{thousands(sp.p90!)}
        </span>
      </>
    ) : (
      "–"
    );
  return (
    <div className="flex flex-col gap-3">
      <SpreadChart
        categories={charted.map((r) => heroes[r.id]?.[lang] ?? String(r.id))}
        series={LEAD_STATES.map((state) => ({
          name: t.states[state],
          color: STATE_COLORS[state],
          boxes: charted.map((r) => {
            const sp = r.spreads[state];
            return sp ? [sp.p10!, sp.p25!, sp.median!, sp.p75!, sp.p90!] : null;
          }),
        }))}
        format={thousands}
        unit={t.perMinute}
      />
      <Table
        head={[s.hero, t.matchesColumn, t.states.ahead, t.states.even, t.states.behind, t.volatility]}
        rows={rows.map((r) => ({
          key: r.id,
          cells: [
            heroes[r.id]?.[lang] ?? r.id,
            r.n,
            cell(r.spreads.ahead),
            cell(r.spreads.even),
            cell(r.spreads.behind),
            r.volatility == null ? "–" : `${Math.round(r.volatility * 100)}%`,
          ],
        }))}
      />
    </div>
  );
}

// Winning, even and losing games by the lead at minute 15.
export function GameStates({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.economy;
  const groups = LEAD_STATES.map((state) => [state, list.filter((m) => gameState(m) === state)] as const);
  return (
    <Table
      head={[t.gameState, t.matchesColumn, t.winRateColumn, "GPM", t.impColumn]}
      rows={groups.map(([state, matches]) => {
        const imp = avg(matches.filter((m) => m.imp != null).map((m) => m.imp!));
        return {
          key: state,
          cells: [
            t.gameStates[state],
            matches.length,
            matches.length ? `${winRate(matches)}%` : "–",
            matches.length ? thousands(avg(matches.map((m) => m.details.gpm))!) : "–",
            imp == null ? "–" : <span className={toneOf(imp)}>{signed(Math.round(imp))}</span>,
          ],
        };
      })}
    />
  );
}

// How the player's own lane went, and what came of it.
export function LaneOutcomes({ list }: { list: DetailMatch[] }) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.economy;
  const outcomes = [2, 1, 0, -1, -2]
    .map((score) => [score, list.filter((m) => m.details.laneOut === score)] as const)
    .filter(([, matches]) => matches.length);
  if (!outcomes.length) return <p className="text-sm text-muted-foreground">{t.noLead}</p>;
  return (
    <Table
      head={[t.laneOutcome, t.matchesColumn, t.winRateColumn, "GPM", t.lastHits10, t.impColumn]}
      rows={outcomes.map(([score, matches]) => {
        const imp = avg(matches.filter((m) => m.imp != null).map((m) => m.imp!));
        const lh10 = avg(
          matches
            .filter((m) => m.details.lhm.length >= 10)
            .map((m) => m.details.lhm.slice(0, 10).reduce((a, b) => a + b, 0)),
        );
        return {
          key: score,
          cells: [
            t.laneOutcomes[String(score) as keyof typeof t.laneOutcomes],
            matches.length,
            `${winRate(matches)}%`,
            thousands(avg(matches.map((m) => m.details.gpm))!),
            lh10 == null ? "–" : Math.round(lh10),
            imp == null ? "–" : <span className={toneOf(imp)}>{signed(Math.round(imp))}</span>,
          ],
        };
      })}
    />
  );
}

// Games won from far behind and games lost from far ahead.
export function Swings({
  list,
  heroes,
  matchHref,
}: {
  list: DetailMatch[];
  heroes: Record<number, HeroInfo>;
  matchHref: string;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.economy;
  const comebacks = list.filter(isComeback).sort((a, b) => deepestDeficit(a) - deepestDeficit(b));
  const throws = list.filter(isThrow).sort((a, b) => biggestLead(b) - biggestLead(a));
  const block = (title: string, matches: DetailMatch[], extra: (m: DetailMatch) => string) => (
    <Section title={`${title} · ${matches.length}`}>
      {matches.length ? (
        <ul className="flex flex-col">
          {matches.slice(0, 8).map((m) => (
            <MatchRow
              key={m.matchId}
              m={m}
              heroes={heroes}
              matchHref={matchHref}
              extra={extra(m)}
              value={<span className="text-xs text-muted-foreground">GPM {m.details.gpm}</span>}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t.noSwings}</p>
      )}
    </Section>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {block(t.comebacks, comebacks, (m) => t.deficit(thousands(-deepestDeficit(m))))}
      {block(t.throws, throws, (m) => t.leadMax(thousands(biggestLead(m))))}
    </div>
  );
}

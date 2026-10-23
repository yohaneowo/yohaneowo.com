"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import {
  ALL_BRACKETS,
  BRACKET_MEDALS,
  DEFAULT_MATCHUP_WEEKS,
  MATCHUP_BRACKETS,
  MATCHUP_WEEKS,
  type MatchupBracket,
  type MatchupBracketChoice,
  type MatchupWeeks,
} from "@/lib/dota/matchup-range";
import type { HeroMatchup } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { HeroPicker } from "../deaths/hero-picker";
import { HeroImage } from "../parts";
import { heroMatchups, ownMatchupsAs } from "./actions";
import type { Matchups, Rec } from "./load";

// Bracket rows with fewer sampled matches than this say little.
const MIN_BRACKET_MATCHES = 30;
// The player's record is shrunk towards the bracket rate by this many pseudo-matches before the
// two are compared, so a 0–2 doesn't scream.
const SHRINK = 8;
const MIN_OWN_GAMES = 5;
const FLAG_GAP = 0.08;
// The short lists: the hardest counters, the easiest targets, the player's own worst.
const LIST_ROWS = 8;
const OWN_LIST_MIN_GAMES = 3;
const TABLE_ROWS = 25;

const UP = "text-emerald-600 dark:text-emerald-400";
const DOWN = "text-red-600 dark:text-red-400";

type Sort = "counters" | "targets" | "met";

type Row = {
  hero: number;
  bracket: HeroMatchup | null;
  mine: Rec | null;
  // The player's rate shrunk towards the bracket's, and how far it sits from it.
  shrunk: number | null;
  verdict: "worse" | "better" | null;
};

export type InitialMatchups = {
  hero: number;
  bracket: MatchupBracketChoice;
  weeks: MatchupWeeks;
  // null: STRATZ didn't answer.
  rows: HeroMatchup[] | null;
};

const BRACKET_CHOICES: MatchupBracketChoice[] = [...MATCHUP_BRACKETS, ALL_BRACKETS];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signedPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const keyOf = (hero: number, bracket: MatchupBracketChoice, weeks: MatchupWeeks) =>
  `${hero}-${bracket}-${weeks}`;

export function HeroMatchups({
  heroes,
  ownBracket,
  top,
  initial,
  mine,
  accountId,
}: {
  heroes: Record<number, HeroInfo>;
  // The player's own bracket (null: unranked), the default choice.
  ownBracket: MatchupBracket | null;
  // The player's most played heroes, most played first.
  top: { hero: number; games: number }[];
  // The server already loaded the first hero's matchups at the default bracket and range.
  initial: InitialMatchups | null;
  mine: Matchups;
  // For players shown from OpenDota: their account, to fetch their record on a hero not loaded yet.
  accountId: number | null;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.rankPage;
  const medals = dict.dotahub.medals;
  const [hero, setHero] = useState(initial?.hero ?? top[0]?.hero ?? 0);
  const [bracket, setBracket] = useState<MatchupBracketChoice>(
    initial?.bracket ?? ownBracket ?? ALL_BRACKETS,
  );
  const [weeks, setWeeks] = useState<MatchupWeeks>(initial?.weeks ?? DEFAULT_MATCHUP_WEEKS);
  const [sort, setSort] = useState<Sort>("counters");
  const [onlyMet, setOnlyMet] = useState(false);
  const [table, setTable] = useState(false);
  const [all, setAll] = useState(false);
  // STRATZ's matchups by hero, bracket and range (null: STRATZ didn't answer), and the player's
  // own record by hero, as they're fetched.
  const [fetched, setFetched] = useState<Map<string, HeroMatchup[] | null>>(
    () => new Map(initial ? [[keyOf(initial.hero, initial.bracket, initial.weeks), initial.rows]] : []),
  );
  const [own, setOwn] = useState<Record<number, Record<number, Rec>>>(mine.byHero);
  const [pending, startTransition] = useTransition();

  const key = keyOf(hero, bracket, weeks);
  const known = fetched.has(key);
  const ownKnown = !accountId || hero in own;

  useEffect(() => {
    if (!hero || known) return;
    let stop = false;
    startTransition(async () => {
      const rows = await heroMatchups(hero, bracket, weeks);
      if (!stop) setFetched((m) => new Map(m).set(keyOf(hero, bracket, weeks), rows));
    });
    return () => {
      stop = true;
    };
  }, [hero, bracket, weeks, known]);

  useEffect(() => {
    if (!hero || !accountId || ownKnown) return;
    let stop = false;
    startTransition(async () => {
      const rec = await ownMatchupsAs(accountId, hero);
      if (!stop) setOwn((o) => ({ ...o, [hero]: rec ?? {} }));
    });
    return () => {
      stop = true;
    };
  }, [hero, accountId, ownKnown]);

  const stratz = fetched.get(key) ?? null;
  const failed = known && stratz === null;

  // Every opponent STRATZ or the player's own matches know, with both sides' numbers.
  const rows = useMemo<Row[]>(() => {
    if (!hero) return [];
    const ownRecs = own[hero] ?? {};
    const ids = new Set<number>([
      ...(stratz ?? []).filter((b) => b.matches >= MIN_BRACKET_MATCHES).map((b) => b.hero),
      ...Object.keys(ownRecs).map(Number),
    ]);
    const out: Row[] = [];
    for (const id of ids) {
      if (!heroes[id]) continue;
      const b = stratz?.find((b) => b.hero === id && b.matches >= MIN_BRACKET_MATCHES) ?? null;
      const rec = ownRecs[id] ?? null;
      let shrunk: number | null = null;
      let verdict: Row["verdict"] = null;
      if (b && rec) {
        shrunk = (rec.w + SHRINK * b.rate) / (rec.g + SHRINK);
        if (rec.g >= MIN_OWN_GAMES) {
          const gap = shrunk - b.rate;
          verdict = gap <= -FLAG_GAP ? "worse" : gap >= FLAG_GAP ? "better" : null;
        }
      }
      out.push({ hero: id, bracket: b, mine: rec, shrunk, verdict });
    }
    return out;
  }, [hero, stratz, own, heroes]);

  const name = (id: number) => heroes[id]?.[lang] ?? String(id);
  const bracketName = (b: MatchupBracketChoice) =>
    b === ALL_BRACKETS ? t.allBrackets : `${medals[BRACKET_MEDALS[b][0]]}–${medals[BRACKET_MEDALS[b][1]]}`;
  // The counters and targets follow STRATZ's ranking; "only met" just drops the unmet.
  const ranked = rows.filter((r): r is Row & { bracket: HeroMatchup } => r.bracket !== null);
  const met = ranked.filter((r) => r.mine !== null);
  const shown = onlyMet ? met : ranked;
  const counters = [...shown].sort((a, b) => a.bracket.advantage - b.bracket.advantage).slice(0, LIST_ROWS);
  const targets = [...shown].sort((a, b) => b.bracket.advantage - a.bracket.advantage).slice(0, LIST_ROWS);
  // The player's own worst on this hero: met at least a few times, worst shrunk rate first.
  const ownWorst = rows
    .filter((r): r is Row & { mine: Rec } => r.mine !== null && r.mine.g >= OWN_LIST_MIN_GAMES)
    .map((r) => ({ ...r, ownShrunk: (r.mine.w + 2) / (r.mine.g + 4) }))
    .sort((a, b) => a.ownShrunk - b.ownShrunk || b.mine.g - a.mine.g)
    .slice(0, LIST_ROWS);
  const largest = Math.max(1, ...ranked.map((r) => Math.abs(r.bracket.advantage)));

  const tableRows = useMemo(() => {
    const filtered = onlyMet ? rows.filter((r) => r.mine) : rows;
    // Sorted by STRATZ's advantage, like the cards above.
    const rate = (r: Row) => r.bracket?.advantage ?? null;
    return [...filtered].sort((a, b) => {
      if (sort === "met") return (b.mine?.g ?? 0) - (a.mine?.g ?? 0) || (rate(a) ?? 0) - (rate(b) ?? 0);
      const ra = rate(a);
      const rb = rate(b);
      if (ra == null || rb == null) return ra == null ? (rb == null ? 0 : 1) : -1;
      return sort === "counters" ? ra - rb : rb - ra;
    });
  }, [rows, sort, onlyMet]);

  const pick = (id: number) => {
    if (!id) return;
    setHero(id);
    setAll(false);
  };
  const retry = () =>
    setFetched((m) => {
      const next = new Map(m);
      next.delete(key);
      return next;
    });
  const heroGames = new Map(Object.entries(mine.heroGames).map(([id, n]) => [Number(id), n]));
  const loading = pending || (hero > 0 && (!known || !ownKnown));
  // What an empty counters / targets list means.
  const rankedEmpty = failed ? t.stratzDown : !stratz?.length ? t.bracketMissing : t.noneMet;

  // One opponent card: the hero and STRATZ's advantage (the bar is its size), then the bracket's
  // win rate with its sample and the player's own record, and the two win rates as thin bars.
  const Item = ({ r }: { r: Row }) => {
    const advantage = r.bracket?.advantage ?? 0;
    const width = r.bracket ? Math.round((Math.abs(advantage) / largest) * 100) : 0;
    const ownRate = r.mine ? r.mine.w / r.mine.g : null;
    return (
      <li className="flex flex-col gap-1.5 rounded-lg border px-2 py-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <HeroImage hero={heroes[r.hero]} lang={lang} className="h-6 w-10 shrink-0" />
            <span className="truncate">{name(r.hero)}</span>
          </span>
          {r.bracket ? (
            <span className={cn("shrink-0 text-xs font-medium tabular-nums", advantage < 0 ? DOWN : UP)}>
              {t.advantage(signedPct(advantage))}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">–</span>
          )}
        </div>
        {r.bracket && (
          <div className="h-1 rounded-full bg-muted" title={t.barHint}>
            <div
              className={cn("h-1 rounded-full", advantage < 0 ? "bg-red-500/70" : "bg-emerald-500/70")}
              style={{ width: `${width}%` }}
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{r.bracket ? t.bracketLine(pct(r.bracket.rate), r.bracket.matches) : "–"}</span>
          <span className="text-right">
            {r.mine && ownRate !== null ? (
              <>
                {t.yourShort(r.mine.w, r.mine.g)}{" "}
                <span className={cn(ownRate < 0.47 && DOWN, ownRate > 0.53 && UP)}>{pct(ownRate)}</span>
              </>
            ) : (
              t.notMet
            )}
          </span>
        </div>
        {r.bracket && ownRate !== null && (
          <div className="flex flex-col gap-0.5" title={t.rateBarsHint}>
            <div className="h-1 rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-muted-foreground/50"
                style={{ width: `${Math.round(r.bracket.rate * 100)}%` }}
              />
            </div>
            <div className="h-1 rounded-full bg-muted">
              <div
                className={cn(
                  "h-1 rounded-full",
                  ownRate < r.bracket.rate ? "bg-red-500/70" : "bg-emerald-500/70",
                )}
                style={{ width: `${Math.round(ownRate * 100)}%` }}
              />
            </div>
          </div>
        )}
        {r.verdict && (
          <div className="flex text-xs">
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5",
                r.verdict === "worse"
                  ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              )}
            >
              {r.verdict === "worse" ? t.worse : t.better}
            </span>
          </div>
        )}
      </li>
    );
  };

  // A short list, rendered as a plain function (not a component made during render).
  const list = ({
    title,
    rows,
    tone,
    empty,
  }: {
    title: string;
    rows: Row[];
    tone: "counter" | "target" | "own";
    empty: string;
  }) => (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length ? (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => (
            <Item key={r.hero} r={r} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          {loading ? t.loading : empty}
          {!loading && failed && tone !== "own" && (
            <>
              {" "}
              <button type="button" className="underline" onClick={retry}>
                {t.retry}
              </button>
            </>
          )}
        </p>
      )}
    </section>
  );

  const segment = (active: boolean) =>
    cn(
      "cursor-pointer rounded-md px-2.5 py-1 transition-colors",
      active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <HeroPicker
          value={hero}
          onChange={pick}
          heroes={heroes}
          counts={heroGames}
          allowAll={false}
          anyHero
        />
        <div
          role="tablist"
          aria-label={t.bracketChoice}
          className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-xs"
        >
          {BRACKET_CHOICES.map((b) => (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={bracket === b}
              onClick={() => setBracket(b)}
              title={b === ownBracket ? t.yourBracket : undefined}
              className={segment(bracket === b)}
            >
              {bracketName(b)}
              {b === ownBracket && <span className="ml-1 text-muted-foreground">★</span>}
            </button>
          ))}
        </div>
        <div
          role="tablist"
          aria-label={t.range}
          title={t.rangeHint}
          className="flex gap-1 rounded-lg bg-muted p-1 text-xs"
        >
          {MATCHUP_WEEKS.map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={weeks === w}
              onClick={() => setWeeks(w)}
              className={segment(weeks === w)}
            >
              {t.ranges[w]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={onlyMet} onChange={(e) => setOnlyMet(e.target.checked)} />
          {t.onlyMet}
          {ranked.length > 0 && <span className="tabular-nums">{t.metOf(met.length, ranked.length)}</span>}
        </label>
      </div>
      {top.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t.mostPlayed}</span>
          {top.map((h) => (
            <button
              key={h.hero}
              type="button"
              aria-pressed={h.hero === hero}
              onClick={() => pick(h.hero)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition-colors",
                h.hero === hero ? "border-primary bg-primary/10" : "hover:bg-muted",
              )}
            >
              <HeroImage hero={heroes[h.hero]} lang={lang} className="h-6 w-10" />
              <span>{name(h.hero)}</span>
              <span className="text-muted-foreground">{t.heroGames(h.games)}</span>
            </button>
          ))}
        </div>
      )}
      {!hero ? (
        <p className="text-sm text-muted-foreground">{t.pickAHero}</p>
      ) : (
        <>
          <p className="text-sm">
            {t.intro(name(hero), bracketName(bracket))}{" "}
            <span className="text-muted-foreground">
              {t.introHint(t.ranges[weeks])}
              {weeks <= 1 && ` ${t.rangeHint}`}
            </span>
            {loading && <span className="ml-2 text-xs text-muted-foreground">{t.loading}</span>}
          </p>
          <div className={cn("flex flex-col gap-5", pending && "opacity-60 transition-opacity")}>
            {list({ title: t.countersOf(name(hero)), rows: counters, tone: "counter", empty: rankedEmpty })}
            {list({ title: t.targetsOf(name(hero)), rows: targets, tone: "target", empty: rankedEmpty })}
            {list({ title: t.yoursOf(name(hero)), rows: ownWorst, tone: "own", empty: t.tooFewOwn })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t.verdictHint} {t.matchupsSource[mine.source]}
          </p>
          <button
            type="button"
            className="self-start text-xs text-muted-foreground underline"
            onClick={() => setTable((v) => !v)}
          >
            {table ? t.hideTable : t.showTable}
          </button>
          {table && (
            <>
              <p className="text-xs text-muted-foreground">{t.tableHint}</p>
              <div role="group" className="flex flex-wrap gap-1 text-xs">
                {(["counters", "targets", "met"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                    className={cn(
                      "rounded-md border px-2 py-0.5",
                      sort === key ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {t.sortBy[key]}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.opponent}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.advantageColumn}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.bracketRate}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.sampleColumn}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.yourRecord}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.yourRate}</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {(all ? tableRows : tableRows.slice(0, TABLE_ROWS)).map((r) => (
                      <tr key={r.hero} className="border-t">
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-2">
                            <HeroImage hero={heroes[r.hero]} lang={lang} className="h-6 w-10" />
                            {name(r.hero)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {r.bracket ? (
                            <span className={cn(r.bracket.advantage < 0 ? DOWN : UP)}>
                              {signedPct(r.bracket.advantage)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {r.bracket ? pct(r.bracket.rate) : <span className="text-muted-foreground">–</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                          {r.bracket ? r.bracket.matches.toLocaleString() : "–"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                          {r.mine ? t.record(r.mine.w, r.mine.g) : t.notMet}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {r.mine ? (
                            <span
                              className={cn(
                                r.mine.w / r.mine.g < 0.47 && DOWN,
                                r.mine.w / r.mine.g > 0.53 && UP,
                              )}
                            >
                              {pct(r.mine.w / r.mine.g)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {r.verdict && (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5",
                                r.verdict === "worse"
                                  ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {r.verdict === "worse" ? t.worse : t.better}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tableRows.length > TABLE_ROWS && !all && (
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline"
                  onClick={() => setAll(true)}
                >
                  {t.more}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

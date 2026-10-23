"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import type { HeroMatchup } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { HeroImage } from "../parts";
import type { Matchups, Rec } from "./load";

// Bracket rows with fewer sampled matches than this say little.
const MIN_BRACKET_MATCHES = 30;
// The player's record is shrunk towards the bracket rate by this many pseudo-matches before the
// two are compared, so a 0–2 doesn't scream.
const SHRINK = 8;
const MIN_OWN_GAMES = 5;
const FLAG_GAP = 0.08;
const ROWS = 25;
const OVERALL_MIN_GAMES = 8;
const OVERALL_ROWS = 10;

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

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function HeroMatchups({
  heroes,
  bracketName,
  top,
  mine,
}: {
  heroes: Record<number, HeroInfo>;
  bracketName: string | null;
  // The shown heroes, most played first, each with STRATZ's bracket matchups (null: none).
  top: { hero: number; games: number; bracket: HeroMatchup[] | null }[];
  mine: Matchups;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.rankPage;
  const [hero, setHero] = useState(top[0]?.hero ?? 0);
  const [sort, setSort] = useState<Sort>("counters");
  const [onlyMet, setOnlyMet] = useState(false);
  const [all, setAll] = useState(false);
  const current = top.find((h) => h.hero === hero) ?? top[0];

  const rows = useMemo<Row[]>(() => {
    if (!current) return [];
    const own = mine.byHero[current.hero] ?? {};
    const ids = new Set<number>([
      ...(current.bracket ?? []).filter((b) => b.matches >= MIN_BRACKET_MATCHES).map((b) => b.hero),
      ...Object.keys(own).map(Number),
    ]);
    const out: Row[] = [];
    for (const id of ids) {
      if (!heroes[id]) continue;
      const bracket = current.bracket?.find((b) => b.hero === id && b.matches >= MIN_BRACKET_MATCHES) ?? null;
      const rec = own[id] ?? null;
      let shrunk: number | null = null;
      let verdict: Row["verdict"] = null;
      if (bracket && rec) {
        shrunk = (rec.w + SHRINK * bracket.rate) / (rec.g + SHRINK);
        if (rec.g >= MIN_OWN_GAMES) {
          const gap = shrunk - bracket.rate;
          verdict = gap <= -FLAG_GAP ? "worse" : gap >= FLAG_GAP ? "better" : null;
        }
      }
      out.push({ hero: id, bracket, mine: rec, shrunk, verdict });
    }
    const filtered = onlyMet ? out.filter((r) => r.mine) : out;
    const rate = (r: Row) => r.bracket?.rate ?? null;
    filtered.sort((a, b) => {
      if (sort === "met") return (b.mine?.g ?? 0) - (a.mine?.g ?? 0) || (rate(a) ?? 1) - (rate(b) ?? 1);
      const ra = rate(a);
      const rb = rate(b);
      if (ra == null || rb == null) return ra == null ? (rb == null ? 0 : 1) : -1;
      return sort === "counters" ? ra - rb : rb - ra;
    });
    return filtered;
  }, [current, mine, heroes, sort, onlyMet]);

  const overall = useMemo(
    () =>
      Object.entries(mine.overall)
        .map(([id, rec]) => ({ hero: Number(id), rec }))
        .filter((r) => heroes[r.hero] && r.rec.g >= OVERALL_MIN_GAMES)
        .sort((a, b) => a.rec.w / a.rec.g - b.rec.w / b.rec.g || b.rec.g - a.rec.g)
        .slice(0, OVERALL_ROWS),
    [mine, heroes],
  );

  if (!top.length) return <p className="text-sm text-muted-foreground">{t.noHeroes}</p>;
  const shown = all ? rows : rows.slice(0, ROWS);
  const name = (id: number) => heroes[id]?.[lang] ?? String(id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {top.map((h) => (
          <button
            key={h.hero}
            type="button"
            aria-pressed={h.hero === current?.hero}
            onClick={() => {
              setHero(h.hero);
              setAll(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition-colors",
              h.hero === current?.hero ? "border-primary bg-primary/10" : "hover:bg-muted",
            )}
          >
            <HeroImage hero={heroes[h.hero]} lang={lang} className="h-6 w-10" />
            <span>{name(h.hero)}</span>
            <span className="text-muted-foreground">{t.heroGames(h.games)}</span>
          </button>
        ))}
      </div>
      {current && !current.bracket && <p className="text-sm text-muted-foreground">{t.bracketMissing}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div role="group" className="flex flex-wrap gap-1">
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
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input type="checkbox" checked={onlyMet} onChange={(e) => setOnlyMet(e.target.checked)} />
          {t.onlyMet}
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t.opponent}</th>
              <th className="px-3 py-2 text-right font-medium">{t.bracketRate}</th>
              <th className="px-3 py-2 text-right font-medium">{t.yourRecord}</th>
              <th className="px-3 py-2 text-right font-medium">{t.yourRate}</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.hero} className="border-t">
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <HeroImage hero={heroes[r.hero]} lang={lang} className="h-6 w-10" />
                    {name(r.hero)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {r.bracket ? (
                    <span
                      className={cn(r.bracket.rate < 0.47 && DOWN, r.bracket.rate > 0.53 && UP)}
                      title={t.sampled(r.bracket.matches)}
                    >
                      {pct(r.bracket.rate)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                  {r.mine ? t.record(r.mine.w, r.mine.g) : t.notMet}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {r.mine ? (
                    <span
                      className={cn(r.mine.w / r.mine.g < 0.47 && DOWN, r.mine.w / r.mine.g > 0.53 && UP)}
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
      {rows.length > ROWS && !all && (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground underline"
          onClick={() => setAll(true)}
        >
          {t.more}
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        {bracketName ? t.matchupsHint(bracketName) : t.bracketMissing} {t.verdictHint}{" "}
        {t.matchupsSource[mine.source]}
      </p>
      {overall.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t.overall}</h3>
          <p className="text-xs text-muted-foreground">{t.overallHint}</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {overall.map(({ hero: id, rec }) => (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-sm"
              >
                <span className="flex items-center gap-2">
                  <HeroImage hero={heroes[id]} lang={lang} className="h-6 w-10" />
                  {name(id)}
                </span>
                <span className="tabular-nums">
                  <span className={cn(rec.w / rec.g < 0.47 && DOWN, rec.w / rec.g > 0.53 && UP)}>
                    {pct(rec.w / rec.g)}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{t.record(rec.w, rec.g)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

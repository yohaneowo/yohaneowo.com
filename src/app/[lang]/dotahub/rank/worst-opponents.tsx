"use client";

import { useMemo } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { HeroImage } from "../parts";
import type { Rec } from "./load";

const MIN_GAMES = 8;
const ROWS = 12;
// A record is shrunk towards a coin flip by this many pseudo-matches before ranking, so a 2–8 on
// ten matches doesn't outrank an 11–23 on thirty-four: the fewer the matches, the closer to 50%.
const SHRINK = 10;

const UP = "text-emerald-600 dark:text-emerald-400";
const DOWN = "text-red-600 dark:text-red-400";

// Whatever the player played: the heroes they lose to most when those are on the other side,
// worst first by the shrunk win rate, the bar showing how often they're met.
export function WorstOpponents({
  heroes,
  overall,
}: {
  heroes: Record<number, HeroInfo>;
  overall: Record<number, Rec>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.rankPage;
  const rows = useMemo(() => {
    const list = Object.entries(overall)
      .map(([id, rec]) => ({
        hero: Number(id),
        rec,
        rate: rec.w / rec.g,
        shrunk: (rec.w + SHRINK / 2) / (rec.g + SHRINK),
      }))
      .filter((r) => heroes[r.hero] && r.rec.g >= MIN_GAMES)
      .sort((a, b) => a.shrunk - b.shrunk || b.rec.g - a.rec.g)
      .slice(0, ROWS);
    const most = Math.max(1, ...list.map((r) => r.rec.g));
    return list.map((r) => ({ ...r, share: r.rec.g / most }));
  }, [overall, heroes]);
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t.noHeroes}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ hero, rec, rate, share }) => (
        <li key={hero} className="relative overflow-hidden rounded-lg border px-2 py-1 text-sm">
          {/* How often the hero is met, as a bar behind the row. */}
          <span
            className="absolute inset-y-0 left-0 bg-muted/60"
            style={{ width: `${Math.round(share * 100)}%` }}
            aria-hidden
          />
          <span className="relative flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <HeroImage hero={heroes[hero]} lang={lang} className="h-6 w-10" />
              {heroes[hero]?.[lang] ?? hero}
            </span>
            <span className="tabular-nums">
              <span className={cn(rate < 0.47 && DOWN, rate > 0.53 && UP)}>{Math.round(rate * 100)}%</span>
              <span className="ml-2 text-xs text-muted-foreground">{t.record(rec.w, rec.g)}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

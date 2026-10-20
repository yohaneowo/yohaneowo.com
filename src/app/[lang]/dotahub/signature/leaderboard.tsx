"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import type { LeaderboardRow } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { HeroPicker } from "../deaths/hero-picker";
import { Medal, medalName } from "../parts";
import { heroLeaderboard } from "./actions";

const points = (v: number) => (Math.round(v) > 0 ? `+${Math.round(v)}` : String(Math.round(v)));

// STRATZ's leaderboard of a hero at a rank: the best average IMP over recent matches of it. Pick a
// hero and a medal (the player's own first); the player's own recent IMP on the hero for scale.
export function HeroLeaderboard({
  heroes,
  hero: firstHero,
  tier,
  counts,
  accountId,
  recentImp,
  comparePath,
  own,
}: {
  heroes: Record<number, HeroInfo>;
  hero: number;
  // The player's rank tier (medal × 10 + stars).
  tier: number | null;
  counts: [number, number][];
  accountId: number;
  // The player's newest rated matches per hero (up to 25): how many and the mean IMP.
  recentImp: Record<number, { matches: number; imp: number }>;
  // The economy page to compare from (the page player's).
  comparePath: string;
  own: boolean;
}) {
  const { t: dict, lang, href } = useLocale();
  const t = dict.dotahub.signature;
  const positions = dict.dotahub.stats.positions;
  const myMedal = tier ? Math.min(8, Math.max(1, Math.floor(tier / 10))) : 5;
  const [hero, setHero] = useState(firstHero);
  const [medal, setMedal] = useState(myMedal);
  const [loaded, setLoaded] = useState<{ key: string; rows: LeaderboardRow[] | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const key = `${hero}-${medal}`;
  const rows = loaded?.key === key ? loaded.rows : null;

  useEffect(() => {
    let stop = false;
    startTransition(async () => {
      const next = await heroLeaderboard(hero, medal);
      if (!stop) setLoaded({ key: `${hero}-${medal}`, rows: next });
    });
    return () => {
      stop = true;
    };
  }, [hero, medal]);

  const mine = recentImp[hero];
  const last = rows?.[rows.length - 1];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <HeroPicker
          value={hero}
          onChange={(id) => id && setHero(id)}
          heroes={heroes}
          counts={new Map(counts)}
        />
        <div role="group" aria-label={t.rank} className="flex flex-wrap gap-0.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={medal === m}
              onClick={() => setMedal(m)}
              title={`${medalName(m * 10, dict.dotahub)}${m === myMedal ? ` · ${t.yourRank}` : ""}`}
              className={cn(
                "relative cursor-pointer rounded-md border p-0.5 transition-opacity",
                medal === m
                  ? "border-foreground/50 bg-muted"
                  : "border-transparent opacity-50 hover:opacity-100",
              )}
            >
              <Medal tier={m * 10} t={dict.dotahub} size={28} />
              {m === myMedal && (
                <span
                  className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-foreground"
                  aria-hidden
                />
              )}
            </button>
          ))}
        </div>
        {pending && (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label={t.loading} />
        )}
      </div>
      {mine && (
        <p className="text-xs text-muted-foreground">
          {t.yourImp(own, heroes[hero]?.[lang] ?? "", mine.matches, points(mine.imp))}
          {last ? ` ${t.cutoff(rows!.length, points(last.imp))}` : ""}
        </p>
      )}
      {rows === null ? (
        <p className="text-sm text-muted-foreground">{pending ? t.loading : t.unavailable}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.emptyBoard}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-normal">#</th>
                <th className="px-3 py-2 text-left font-normal">{t.player}</th>
                <th className="px-3 py-2 text-left font-normal">{t.position}</th>
                <th className="px-3 py-2 text-right font-normal">{t.record}</th>
                <th className="px-3 py-2 text-right font-normal">{t.winRate}</th>
                <th className="px-3 py-2 text-right font-normal">{t.imp}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const games = r.wins + r.losses;
                const self = r.account === accountId;
                return (
                  <tr key={r.account} className={cn("border-b last:border-0", self && "bg-muted/60")}>
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <Link
                        href={href(`/dotahub/players/${r.account}`)}
                        className="flex min-w-0 items-center gap-2 hover:underline"
                      >
                        {r.avatar ? (
                          <Image
                            src={r.avatar}
                            alt=""
                            width={24}
                            height={24}
                            unoptimized
                            className="size-6 rounded-full"
                          />
                        ) : (
                          <span className="size-6 rounded-full bg-muted" />
                        )}
                        <span className="max-w-48 truncate">{r.name ?? r.account}</span>
                        {r.tier ? <Medal tier={r.tier} t={dict.dotahub} size={22} /> : null}
                        {self && (
                          <span className="text-xs text-muted-foreground">{own ? t.you : t.thisPlayer}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {r.pos ? positions[r.pos - 1] : "–"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.wins}–{r.losses}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {games ? `${Math.round((r.wins / games) * 100)}%` : "–"}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">{points(r.imp)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {!self && (
                        <Link
                          href={`${comparePath}?vs=${r.account}`}
                          className="rounded-md border px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground"
                        >
                          {t.compare}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

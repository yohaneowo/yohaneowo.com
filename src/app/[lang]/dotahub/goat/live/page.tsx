import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RadioIcon } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getHeroes, type HeroInfo } from "@/lib/dota/data";
import { getLivePros, type LiveGame } from "@/lib/dota/pro";
import { cn } from "@/lib/utils";
import { duration, HeroImage, Notice } from "../../parts";
import { AddToCompare } from "../compare-tray";
import { AutoRefresh } from "./auto-refresh";

type T = Dictionary["dotahub"];

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  return { title: `${t.tabs.live} · ${t.title}` };
}

const gold = (n: number) =>
  Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : String(Math.abs(n));

function Side({
  game,
  radiant,
  heroes,
  t,
  lang,
}: {
  game: LiveGame;
  radiant: boolean;
  heroes: Record<number, HeroInfo>;
  t: T;
  lang: Locale;
}) {
  const g = t.goat.live;
  const team = radiant ? game.radiantTeam : game.direTeam;
  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          "text-xs font-medium",
          radiant ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        )}
      >
        {team ?? (radiant ? g.radiant : g.dire)}
      </p>
      <ul className="flex flex-col gap-1">
        {game.players
          .filter((p) => p.radiant === radiant)
          .map((p) => (
            <li key={`${p.accountId}-${p.heroId}`} className="flex items-center gap-2 text-sm">
              <HeroImage hero={heroes[p.heroId]} lang={lang} className="h-6 w-10 shrink-0 rounded-sm" />
              {p.accountId ? (
                <Link
                  href={localePath(lang, `/dotahub/players/${p.accountId}`)}
                  className={cn(
                    "min-w-0 flex-1 truncate hover:underline",
                    p.pro ? "font-semibold" : "text-muted-foreground",
                  )}
                >
                  {p.name ?? heroes[p.heroId]?.[lang] ?? p.accountId}
                  {p.pro && p.teamName && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{p.teamName}</span>
                  )}
                </Link>
              ) : (
                <span className="flex-1 text-muted-foreground">{heroes[p.heroId]?.[lang]}</span>
              )}
              {p.pro && p.accountId > 0 && (
                <AddToCompare
                  pick={{ id: p.accountId, name: p.name ?? String(p.accountId), avatar: null }}
                  className="px-1.5 py-0.5"
                />
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}

async function Body({ t, lang }: { t: T; lang: Locale }) {
  await connection();
  const g = t.goat.live;
  const [live, heroes] = await Promise.all([
    getLivePros().catch(() => null),
    getHeroes().catch(() => ({}) as Record<number, HeroInfo>),
  ]);
  if (!live) return <Notice>{t.goat.unavailable}</Notice>;
  return (
    <div className="flex flex-col gap-3">
      <AutoRefresh seconds={60} />
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <RadioIcon className="size-4 animate-pulse text-red-500" aria-hidden />
          {g.title}
        </h2>
        <p className="text-xs text-muted-foreground">
          {g.hint} {g.refreshing}
        </p>
      </div>
      {live.games.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {live.games.map((game) => {
            const lead = game.radiantLead;
            return (
              <li key={game.matchId} className="flex flex-col gap-3 rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="rounded bg-red-500/15 px-1.5 font-semibold text-red-600 dark:text-red-400">
                    LIVE
                  </span>
                  <span className="font-mono text-sm text-foreground tabular-nums">
                    {duration(Math.max(0, game.gameTime))}
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">{game.radiantScore}</span> :{" "}
                    <span className="text-red-600 dark:text-red-400">{game.direScore}</span>
                  </span>
                  <span>{lead === 0 ? g.even : g.lead(lead > 0 ? g.radiant : g.dire, gold(lead))}</span>
                  {game.averageMmr && <span>{g.averageMmr(game.averageMmr)}</span>}
                  <span>{game.leagueId ? `${g.league} ${game.leagueId}` : g.pub}</span>
                  {game.spectators > 0 && <span>{g.spectators(game.spectators)}</span>}
                </div>
                {/* The gold lead as a bar: green to the left for Radiant, red to the right for Dire. */}
                <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "absolute top-0 h-full",
                      lead >= 0 ? "right-1/2 bg-emerald-500" : "left-1/2 bg-red-500",
                    )}
                    style={{ width: `${Math.min(50, (Math.abs(lead) / 30000) * 50)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Side game={game} radiant heroes={heroes} t={t} lang={lang} />
                  <Side game={game} radiant={false} heroes={heroes} t={t} lang={lang} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">{g.none}</p>
      )}
    </div>
  );
}

export default async function Page() {
  const [dict, lang] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <Body t={dict.dotahub} lang={lang} />
    </Suspense>
  );
}

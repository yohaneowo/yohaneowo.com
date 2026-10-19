import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  getHeroes,
  getLaneRoles,
  getPlayer,
  getPlayerHeroes,
  getRecentMatches,
  getWinLoss,
} from "@/lib/dota/data";
import { DisconnectSteam } from "./buttons";
import { LatestMatch } from "./latest-match";
import { HeroImage, Medal, medalName, Notice } from "./parts";

type T = Dictionary["dotahub"];

// own: the viewer's linked account (the Steam disconnect button, their match list); otherwise
// someone's public page, /dotahub/players/<account id>.
export async function Overview({
  t,
  lang,
  accountId,
  steamId,
  own,
}: {
  t: T;
  lang: Locale;
  accountId: number;
  steamId: string;
  own: boolean;
}) {
  let data;
  try {
    data = await Promise.all([
      getPlayer(accountId),
      // Only the win rate needs it: without it the rest of the overview still shows.
      getWinLoss(accountId).catch(() => null),
      getRecentMatches(accountId),
      getPlayerHeroes(accountId),
      getLaneRoles(accountId),
      getHeroes(),
    ]);
  } catch {
    return <Notice>{t.unavailable}</Notice>;
  }
  const [player, wl, recent, heroStats, lanes, heroes] = data;
  const games = wl ? wl.win + wl.lose : null;
  if (!player.profile || games === 0)
    return own ? (
      <div className="flex flex-col gap-3">
        <Notice>{t.noData}</Notice>
        <div className="self-start">
          <DisconnectSteam />
        </div>
      </div>
    ) : (
      <Notice>{t.player.noData}</Notice>
    );
  const topHeroes = [...heroStats].sort((a, b) => b.games - a.games).slice(0, 10);
  const laneTotal = Object.entries(lanes)
    .filter(([role]) => role !== "0")
    .reduce((sum, [, v]) => sum + v.games, 0);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-5">
          {player.profile.avatarfull && (
            <Image
              src={player.profile.avatarfull}
              alt=""
              width={72}
              height={72}
              unoptimized
              className="size-16 rounded-full"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold">{player.profile.personaname}</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <a
                href={player.profile.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {t.overview.steamProfile}
                <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
              <a
                href={`https://www.opendota.com/players/${accountId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {t.overview.openDota}
                <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Medal tier={player.rank_tier} t={t} />
            <div>
              <div className="text-xs text-muted-foreground">{t.overview.rank}</div>
              <div className="font-medium">{medalName(player.rank_tier, t)}</div>
              {player.leaderboard_rank && (
                <div className="text-xs text-muted-foreground">
                  {t.overview.leaderboard(player.leaderboard_rank)}
                </div>
              )}
            </div>
          </div>
          {wl && games ? (
            <div>
              <div className="text-xs text-muted-foreground">{t.overview.winRate}</div>
              <div className="text-2xl font-semibold tabular-nums">
                {((wl.win / games) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {t.overview.record(wl.win, wl.lose)}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">{t.latest.title}</h2>
            <Link
              href={localePath(lang, own ? "/dotahub/matches" : `/dotahub/players/${accountId}/matches`)}
              className="text-xs text-muted-foreground hover:underline"
            >
              {t.overview.allMatches}
            </Link>
          </div>
          {recent[0] && (
            <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted/40" />}>
              <LatestMatch match={recent[0]} accountId={accountId} heroes={heroes} t={t} lang={lang} />
            </Suspense>
          )}
        </section>
        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">{t.overview.heroes}</h2>
            <ul className="flex flex-col gap-2">
              {topHeroes.map((h) => {
                const hero = heroes[Number(h.hero_id)];
                const heroRate = h.games ? (h.win / h.games) * 100 : 0;
                return (
                  <li key={h.hero_id} className="flex items-center gap-3 text-sm">
                    <HeroImage hero={hero} lang={lang} className="h-8 w-14" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{hero?.[lang] ?? h.hero_id}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {t.overview.games(h.games)} · {heroRate.toFixed(0)}%
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          {laneTotal > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-medium">{t.overview.lanes}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {[1, 2, 3, 4].map((role) => {
                  const lane = lanes[String(role)];
                  if (!lane?.games) return null;
                  const share = (lane.games / laneTotal) * 100;
                  return (
                    <li key={role} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span>{t.lanes[role]}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {share.toFixed(0)}% · {t.overview.winRate}{" "}
                          {((lane.win / lane.games) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary/70"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {own && (
            <div>
              <DisconnectSteam />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

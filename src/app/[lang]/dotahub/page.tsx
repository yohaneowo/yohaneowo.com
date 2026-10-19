import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import {
  DotaUnavailable,
  getHeroes,
  getLaneRoles,
  getPlayer,
  getPlayerHeroes,
  getRecentMatches,
  getWinLoss,
} from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { dotaViewer } from "./account";
import { DisconnectSteam } from "./buttons";
import { MatchTable } from "./match-table";
import { HeroImage, Medal, medalName, Notice } from "./parts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.title };
}

type SearchParams = Promise<{ steam?: string | string[] }>;
type T = Dictionary["dotahub"];

function ConnectCard({ t, lang, signedIn }: { t: T; lang: Locale; signedIn: boolean }) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>{t.connect.title}</CardTitle>
        <CardDescription>{signedIn ? t.connect.description : t.connect.signedOut}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {signedIn ? (
          <a href={`/api/steam/connect?lang=${lang}`} className={cn(buttonVariants(), "self-start")}>
            {t.connect.action}
          </a>
        ) : (
          <Link
            href={localePath(lang, "/login?next=/dotahub")}
            className={cn(buttonVariants(), "self-start")}
          >
            {t.connect.signIn}
          </Link>
        )}
        <p className="text-xs text-muted-foreground">{t.connect.publicData}</p>
      </CardContent>
    </Card>
  );
}

async function Overview({
  t,
  lang,
  accountId,
  steamId,
}: {
  t: T;
  lang: Locale;
  accountId: number;
  steamId: string;
}) {
  let data;
  try {
    data = await Promise.all([
      getPlayer(accountId),
      getWinLoss(accountId),
      getRecentMatches(accountId),
      getPlayerHeroes(accountId),
      getLaneRoles(accountId),
      getHeroes(),
    ]);
  } catch (error) {
    if (!(error instanceof DotaUnavailable)) throw error;
    return <Notice>{t.unavailable}</Notice>;
  }
  const [player, wl, recent, heroStats, lanes, heroes] = data;
  const games = wl.win + wl.lose;
  if (!player.profile || games === 0)
    return (
      <div className="flex flex-col gap-3">
        <Notice>{t.noData}</Notice>
        <div className="self-start">
          <DisconnectSteam />
        </div>
      </div>
    );
  const rate = games ? (wl.win / games) * 100 : 0;
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
          <div>
            <div className="text-xs text-muted-foreground">{t.overview.winRate}</div>
            <div className="text-2xl font-semibold tabular-nums">{rate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {t.overview.record(wl.win, wl.lose)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">{t.overview.recent}</h2>
            <Link
              href={localePath(lang, "/dotahub/matches")}
              className="text-xs text-muted-foreground hover:underline"
            >
              {t.overview.allMatches}
            </Link>
          </div>
          <MatchTable matches={recent} heroes={heroes} t={t} lang={lang} />
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
          <div>
            <DisconnectSteam />
          </div>
        </aside>
      </div>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const raw = (await searchParams).steam;
  const result = Array.isArray(raw) ? raw[0] : raw;
  const notice = result && result in t.notices ? t.notices[result as keyof T["notices"]] : null;
  const viewer = await dotaViewer();
  return (
    <>
      {notice && (
        <p role="status" className="rounded-lg border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {viewer.state === "linked" ? (
        <Overview t={t} lang={lang} accountId={viewer.accountId} steamId={viewer.steamId} />
      ) : (
        <ConnectCard t={t} lang={lang} signedIn={viewer.state === "notLinked"} />
      )}
    </>
  );
}

export default async function DotaHubPage({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

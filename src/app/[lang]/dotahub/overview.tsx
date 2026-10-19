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
  QUICK,
  SLOW,
} from "@/lib/dota/data";
import { DisconnectSteam } from "./buttons";
import { type DeathsSource, loadDeaths } from "./deaths/deaths-view";
import { Freshness } from "./freshness";
import { ImpChart, type ImpMatch } from "./imp-chart";
import { LatestMatch } from "./latest-match";
import { HeroImage, Medal, medalName, Notice } from "./parts";

type T = Dictionary["dotahub"];
type Props = { t: T; lang: Locale; accountId: number };

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/40 ${className}`} />;
}

function SectionError({ t }: { t: T }) {
  return <p className="text-sm text-muted-foreground">{t.overview.sectionUnavailable}</p>;
}

async function WinRate({ t, accountId }: Omit<Props, "lang">) {
  const wl = await getWinLoss(accountId).catch(() => null);
  if (!wl) return <SectionError t={t} />;
  const games = wl.data.win + wl.data.lose;
  if (!games) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground">{t.overview.winRate}</div>
      <div className="text-2xl font-semibold tabular-nums">{((wl.data.win / games) * 100).toFixed(1)}%</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {t.overview.record(wl.data.win, wl.data.lose)}
      </div>
      <Freshness id="wl" at={wl.at} staleAfter={QUICK.revalidate} />
    </div>
  );
}

// Name, links and rank (fast on OpenDota), with the win rate (often slow) loading on its own.
async function Profile({
  t,
  accountId,
  steamId,
  own,
}: Omit<Props, "lang"> & { steamId: string; own: boolean }) {
  const player = await getPlayer(accountId).catch(() => null);
  if (!player) return <Notice>{t.unavailable}</Notice>;
  const profile = player.data.profile;
  if (!profile)
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
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-5">
        {profile.avatarfull && (
          <Image
            src={profile.avatarfull}
            alt=""
            width={72}
            height={72}
            unoptimized
            className="size-16 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{profile.personaname}</h2>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <a
              href={profile.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`}
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
          <Medal tier={player.data.rank_tier} t={t} />
          <div>
            <div className="text-xs text-muted-foreground">{t.overview.rank}</div>
            <div className="font-medium">{medalName(player.data.rank_tier, t)}</div>
            {player.data.leaderboard_rank && (
              <div className="text-xs text-muted-foreground">
                {t.overview.leaderboard(player.data.leaderboard_rank)}
              </div>
            )}
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-16 w-28" />}>
          <WinRate t={t} accountId={accountId} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="font-medium">{title}</h2>
      {children}
    </div>
  );
}

async function Latest({ t, lang, accountId, own }: Props & { own: boolean }) {
  const [recent, heroes] = await Promise.all([
    getRecentMatches(accountId).catch(() => null),
    getHeroes().catch(() => null),
  ]);
  const all = (
    <Link
      href={localePath(lang, own ? "/dotahub/matches" : `/dotahub/players/${accountId}/matches`)}
      className="text-xs text-muted-foreground hover:underline"
    >
      {t.overview.allMatches}
    </Link>
  );
  return (
    <>
      <Heading title={t.latest.title}>
        <span className="flex items-baseline gap-3">
          {recent && <Freshness id="recent" at={recent.at} staleAfter={QUICK.revalidate} />}
          {all}
        </span>
      </Heading>
      {!recent || !heroes ? (
        <SectionError t={t} />
      ) : recent.data[0] ? (
        <Suspense fallback={<Skeleton className="h-80" />}>
          <LatestMatch match={recent.data[0]} accountId={accountId} heroes={heroes} t={t} lang={lang} />
        </Suspense>
      ) : null}
    </>
  );
}

async function Heroes({ t, lang, accountId }: Props) {
  const [stats, heroes] = await Promise.all([
    getPlayerHeroes(accountId).catch(() => null),
    getHeroes().catch(() => null),
  ]);
  return (
    <>
      <Heading title={t.overview.heroes}>
        {stats && <Freshness id="heroes" at={stats.at} staleAfter={SLOW.revalidate} />}
      </Heading>
      {!stats || !heroes ? (
        <SectionError t={t} />
      ) : (
        <ul className="flex flex-col gap-2">
          {[...stats.data]
            .sort((a, b) => b.games - a.games)
            .slice(0, 10)
            .map((h) => {
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
      )}
    </>
  );
}

async function Lanes({ t, accountId }: Omit<Props, "lang">) {
  const lanes = await getLaneRoles(accountId).catch(() => null);
  if (!lanes) return null;
  const total = Object.entries(lanes.data)
    .filter(([role]) => role !== "0")
    .reduce((sum, [, v]) => sum + v.games, 0);
  if (!total) return null;
  return (
    <section className="flex flex-col gap-3">
      <Heading title={t.overview.lanes}>
        <Freshness id="lanes" at={lanes.at} staleAfter={SLOW.revalidate} />
      </Heading>
      <ul className="flex flex-col gap-2 text-sm">
        {[1, 2, 3, 4].map((role) => {
          const lane = lanes.data[String(role)];
          if (!lane?.games) return null;
          const share = (lane.games / total) * 100;
          return (
            <li key={role} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span>{t.lanes[role]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {share.toFixed(0)}% · {t.overview.winRate} {((lane.win / lane.games) * 100).toFixed(0)}%
                </span>
              </div>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary/70" style={{ width: `${share}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// STRATZ's IMP over the newest ranked matches, from the same place as the death heat map (admin's
// stored history for players linked here, STRATZ asked directly for anyone else).
async function Imp({ t, lang, accountId, source }: Props & { source: DeathsSource }) {
  const [data, heroes] = await Promise.all([
    loadDeaths(source, accountId, 100).catch(() => null),
    getHeroes().catch(() => null),
  ]);
  const heading = <Heading title={t.imp.title} />;
  if (!data || !heroes)
    return (
      <>
        {heading}
        <SectionError t={t} />
      </>
    );
  const matches: ImpMatch[] = data.matches
    .filter((m) => m.parsed && m.imp != null)
    .slice(0, 100)
    .map((m) => ({
      matchId: m.matchId,
      heroId: m.heroId,
      won: m.won,
      imp: m.imp!,
      startTime: m.startTime,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
    }));
  return (
    <>
      {heading}
      {matches.length ? (
        <ImpChart
          matches={matches}
          // Only the names of the heroes in these matches go to the client.
          heroes={Object.fromEntries(
            [...new Set(matches.map((m) => m.heroId))].map((id) => [
              id,
              { zh: heroes[id]?.zh ?? String(id), en: heroes[id]?.en ?? String(id) },
            ]),
          )}
          matchHref={localePath(lang, "/dotahub/matches")}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t.imp.empty}</p>
      )}
    </>
  );
}

// own: the viewer's linked account (the Steam disconnect button, their match list); otherwise
// someone's public page, /dotahub/players/<account id>. Each part loads on its own: OpenDota answers
// some of these in a second and others in half a minute, so one slow part never holds up the page.
export function Overview({
  t,
  lang,
  accountId,
  steamId,
  own,
  source,
}: Props & {
  steamId: string;
  own: boolean;
  source: DeathsSource;
}) {
  const props = { t, lang, accountId };
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <Profile {...props} steamId={steamId} own={own} />
      </Suspense>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex min-w-0 flex-col gap-3">
            <Suspense
              fallback={
                <>
                  <Heading title={t.latest.title} />
                  <Skeleton className="h-80" />
                </>
              }
            >
              <Latest {...props} own={own} />
            </Suspense>
          </section>
          <section className="flex min-w-0 flex-col gap-3">
            <Suspense
              fallback={
                <>
                  <Heading title={t.imp.title} />
                  <Skeleton className="h-80" />
                </>
              }
            >
              <Imp {...props} source={source} />
            </Suspense>
          </section>
        </div>
        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <Suspense
              fallback={
                <>
                  <Heading title={t.overview.heroes} />
                  <Skeleton className="h-96" />
                </>
              }
            >
              <Heroes {...props} />
            </Suspense>
          </section>
          <Suspense fallback={<Skeleton className="h-32" />}>
            <Lanes t={t} accountId={accountId} />
          </Suspense>
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

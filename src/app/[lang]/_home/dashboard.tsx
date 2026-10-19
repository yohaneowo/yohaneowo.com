import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDiscordAccount } from "@/lib/discord-account";
import { getMovieStatistics, getPicks, MoviesUnavailable } from "@/lib/movies";
import { myVotes } from "@/lib/roadmap-store";
import { cn } from "@/lib/utils";
import { BotCard, LatestUpdates, MarketBody, RoadmapSnippet, Tile, TileSkeleton } from "./parts";

type Props = { lang: Locale; t: Dictionary; userId: string };

// The home page once signed in: the account's own numbers first, then the market, the roadmap
// and the bot. Each tile loads on its own.
export function Dashboard({ lang, t, name, userId }: Props & { name: string }) {
  const d = t.home.dashboard;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{d.greeting(name)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{d.subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<TileSkeleton />}>
          <StatsTile lang={lang} t={t} userId={userId} />
        </Suspense>
        <Suspense fallback={<TileSkeleton />}>
          <PicksTile lang={lang} t={t} userId={userId} />
        </Suspense>
        <Tile title={t.nav.coinhub.title} href={localePath(lang, "/tradehub")} action={d.open}>
          <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted/40" />}>
            <MarketBody t={t.home} />
          </Suspense>
        </Tile>
        <Suspense fallback={<TileSkeleton />}>
          <RoadmapTile lang={lang} t={t} userId={userId} />
        </Suspense>
        <Tile title={t.home.latest} href={localePath(lang, "/roadmap/changelog")} action={t.home.allUpdates}>
          <LatestUpdates lang={lang} />
        </Tile>
        <Suspense fallback={<TileSkeleton />}>
          <BotTile t={t} userId={userId} lang={lang} />
        </Suspense>
      </div>
    </div>
  );
}

async function StatsTile({ lang, t, userId }: Props) {
  const d = t.home.dashboard;
  const href = localePath(lang, "/moviehub");
  let result;
  try {
    const linked = await getDiscordAccount(userId);
    result = await getMovieStatistics(userId, linked?.accountId ?? null);
  } catch (error) {
    if (!(error instanceof MoviesUnavailable)) throw error;
    return (
      <Tile title={d.stats} href={href} action={d.open}>
        <p className="text-sm text-muted-foreground">{d.unavailable}</p>
      </Tile>
    );
  }
  const { subscription, snapshot } = result;
  if (!subscription)
    return (
      <Tile title={d.stats}>
        <p className="text-sm text-muted-foreground">{d.noProfile}</p>
        <Link href={href} className={cn(buttonVariants({ size: "sm" }), "self-start")}>
          {d.createProfile}
        </Link>
      </Tile>
    );
  const numbers = [
    [snapshot?.watchedCount ?? 0, d.films],
    [snapshot?.shows?.watchedCount ?? 0, d.shows],
    [snapshot?.anime?.watchedCount ?? 0, d.anime],
  ] as const;
  return (
    <Tile title={d.stats} href={href} action={d.open}>
      <div className="grid grid-cols-3 gap-2">
        {numbers.map(([value, label]) => (
          <div key={label}>
            <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString("en-US")}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {subscription.syncedAt && (
        <p className="text-xs text-muted-foreground">{d.syncedAt(subscription.syncedAt.slice(0, 10))}</p>
      )}
    </Tile>
  );
}

async function PicksTile({ lang, t, userId }: Props) {
  const d = t.home.dashboard;
  const href = localePath(lang, "/moviehub/picks");
  let movie, anime;
  try {
    [movie, anime] = await Promise.all((["movie", "anime"] as const).map((kind) => getPicks(userId, kind)));
  } catch (error) {
    if (!(error instanceof MoviesUnavailable)) throw error;
    console.warn(`[home] picks unavailable: ${error.code}`);
    return (
      <Tile title={d.picks} href={href} action={d.open}>
        <p className="text-sm text-muted-foreground">{d.unavailable}</p>
      </Tile>
    );
  }
  if (!movie && !anime)
    return (
      <Tile title={d.picks} href={href} action={d.open}>
        <p className="text-sm text-muted-foreground">{d.noProfile}</p>
      </Tile>
    );
  const rows = [
    [d.filmPicks, movie],
    [d.animePicks, anime],
  ] as const;
  return (
    <Tile title={d.picks} href={href} action={d.open}>
      <ul className="flex flex-col gap-3">
        {rows.map(([label, view]) =>
          view ? (
            <li key={label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {d.left(view.remainingToday, view.quota)} · {d.bonus(view.bonus)}
                </span>
              </div>
              <Progress value={(view.remainingToday / Math.max(1, view.quota)) * 100} aria-label={label} />
            </li>
          ) : null,
        )}
      </ul>
      <p className="text-xs text-muted-foreground">{d.drawOnDiscord}</p>
    </Tile>
  );
}

async function RoadmapTile({ lang, t, userId }: Props) {
  const d = t.home.dashboard;
  const voted = await myVotes(userId).catch(() => []);
  return (
    <Tile title={t.nav.roadmap.title} href={localePath(lang, "/roadmap")} action={d.open}>
      <p className="text-xs text-muted-foreground">{voted.length ? d.myVotes(voted.length) : d.noVotes}</p>
      <RoadmapSnippet lang={lang} t={t.home} />
    </Tile>
  );
}

async function BotTile({ lang, t, userId }: Props) {
  const linked = await getDiscordAccount(userId).catch(() => null);
  if (linked) return <BotCard t={t.home} compact />;
  const d = t.home.dashboard;
  return (
    <Tile title={t.home.bot.title}>
      <p className="text-sm text-muted-foreground">{d.linkDiscord}</p>
      <Link
        href={localePath(lang, "/connect/discord")}
        className={cn(buttonVariants({ size: "sm" }), "self-start")}
      >
        {d.linkAction}
      </Link>
    </Tile>
  );
}

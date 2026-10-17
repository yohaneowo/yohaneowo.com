import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { FilmIcon, LockKeyholeIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { getScoreSource } from "@/lib/movie-preference";
import { getMovieStatistics, MoviesUnavailable } from "@/lib/movies";
import { isRegionCode, listRegions } from "@/lib/regions";
import { MovieProfile } from "./profile";
import { ProfileSetup } from "./profile-setup";
import { RefreshButton } from "./refresh-button";
import { TraktConnectBanner } from "./trakt-connect-banner";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).movies.title };
}

function taipeiToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}

// admin stores its sync error in Chinese; the English page shows its own wording.
function syncErrorText(error: string | null, t: Dictionary) {
  return error ? t.movies.errors.sync : null;
}

function Gate({ t, children }: { t: Dictionary; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start gap-3">
        <FilmIcon className="mt-1 size-7 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.movies.heading}</h1>
          <p className="mt-2 text-muted-foreground">{t.movies.subheading}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

type SearchParams = Promise<{ error?: string | string[]; connected?: string | string[] }>;

// After the Trakt callback: say it worked, and point back to Discord (or to linking it).
function ConnectedNotice({
  t,
  lang,
  discordLinked,
}: {
  t: Dictionary;
  lang: "zh" | "en";
  discordLinked: boolean;
}) {
  const c = t.movies.connected;
  return (
    <div className="notice" role="status">
      <div className="notice-text">
        <strong>{c.title}</strong>
        <span>{discordLinked ? c.discord : c.linkDiscord}</span>
      </div>
      {!discordLinked && (
        <Link href={localePath(lang, "/connect/discord")} className="notice-button">
          {c.linkAction}
        </Link>
      )}
    </div>
  );
}

// A code from the Trakt callback's redirect, if it names one of our messages.
function errorText(value: string | string[] | undefined, t: Dictionary) {
  const code = Array.isArray(value) ? value[0] : value;
  return code && code in t.movies.errors ? t.movies.errors[code as keyof typeof t.movies.errors] : null;
}

async function MyStatistics({ searchParams }: { searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = await getDictionary();
  const session = await getSession();
  if (!session)
    return (
      <Gate t={t}>
        <Card className="mx-auto w-full max-w-xl">
          <CardHeader>
            <LockKeyholeIcon className="mb-3 size-8 text-muted-foreground" />
            <CardTitle>{t.movies.signedOut.title}</CardTitle>
            <CardDescription>{t.movies.signedOut.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href={localePath(lang, "/login?next=/moviehub")} className={buttonVariants()}>
              {t.movies.signedOut.action}
            </Link>
            <p className="text-sm text-muted-foreground">{t.movies.signedOut.hint}</p>
          </CardContent>
        </Card>
      </Gate>
    );
  // Discord is optional: a linked account lets the bot find this profile (and picks up one the
  // bot created before the site existed).
  const linked = await getDiscordAccount(session.user.id);
  let result;
  try {
    result = await getMovieStatistics(session.user.id, linked?.accountId ?? null);
  } catch (error) {
    return (
      <Gate t={t}>
        <Card>
          <CardHeader>
            <CardTitle>{t.movies.unavailable.title}</CardTitle>
            <CardDescription>
              {error instanceof MoviesUnavailable
                ? t.movies.errors[error.code]
                : t.movies.unavailable.fallback}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RefreshButton checkOnly />
          </CardContent>
        </Card>
      </Gate>
    );
  }
  const { error, connected } = await searchParams;
  const justConnected = Boolean(connected);
  if (!result.subscription || result.subscription.traktReauth) {
    // Cloudflare tells us the visitor's country; it pre-selects the region, which they can change.
    const country = ((await headers()).get("cf-ipcountry") ?? "").toUpperCase();
    const current = result.subscription?.region;
    return (
      <Gate t={t}>
        <ProfileSetup
          regions={listRegions(lang)}
          defaultRegion={current && isRegionCode(current) ? current : isRegionCode(country) ? country : "TW"}
          initialError={errorText(error, t)}
          reauth={Boolean(result.subscription)}
        />
      </Gate>
    );
  }
  const { subscription, snapshot, platform } = result;
  const waiting = subscription.syncRequested || subscription.syncing;
  const syncError = syncErrorText(subscription.syncError, t);
  if (!snapshot)
    return (
      <Gate t={t}>
        <Card>
          <CardHeader>
            <CardTitle>{t.movies.preparing.title}</CardTitle>
            <CardDescription>{t.movies.preparing.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {justConnected && (
              <p className="text-sm">
                {linked ? t.movies.connected.discord : t.movies.connected.linkDiscord}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {subscription.traktName} · {waiting ? t.movies.preparing.syncing : t.movies.preparing.waiting}{" "}
              {t.movies.preparing.noBot}
            </p>
            {syncError && (
              <p role="status" className="text-sm text-muted-foreground">
                {syncError}
              </p>
            )}
            <RefreshButton queued={waiting} poll={waiting && !subscription.syncError} />
          </CardContent>
        </Card>
      </Gate>
    );
  return (
    <MovieProfile
      name={subscription.traktName}
      avatar={subscription.traktAvatar}
      notice={
        !subscription.traktConnected ? (
          <TraktConnectBanner region={subscription.region} />
        ) : justConnected ? (
          <ConnectedNotice t={t} lang={lang} discordLinked={Boolean(linked)} />
        ) : null
      }
      traktUser={subscription.traktUser}
      region={subscription.region}
      syncedAt={subscription.syncedAt}
      syncError={syncError}
      waiting={waiting}
      poll={waiting && !subscription.syncError}
      watchedCount={snapshot.watchedCount}
      plays={snapshot.plays}
      showMean={snapshot.showMean}
      showRatingCount={snapshot.showRatingCount}
      mean={snapshot.mean}
      distribution={snapshot.distribution}
      sampleCount={snapshot.sampleCount}
      genres={snapshot.genres}
      films={snapshot.films}
      people={snapshot.people}
      today={taipeiToday()}
      ratedIds={snapshot.ratedIds}
      depth={snapshot.depth}
      depthGroups={snapshot.depthGroups}
      watchedPercentile={platform?.watchedPercentile ?? null}
      platformUsers={platform?.users ?? 0}
      shows={snapshot.shows}
      showsPercentile={platform?.showsPercentile ?? null}
      showUsers={platform?.showUsers ?? 0}
      anime={snapshot.anime}
      animePercentile={platform?.animePercentile ?? null}
      animeUsers={platform?.animeUsers ?? 0}
      scoreSource={await getScoreSource(session.user.id)}
    />
  );
}

export default async function MovieHubPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">
          {t.movies.loading}
        </div>
      }
    >
      <MyStatistics searchParams={searchParams} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilmIcon, LinkIcon, LockKeyholeIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { getScoreSource } from "@/lib/movie-preference";
import { getMovieStatistics, MoviesUnavailable } from "@/lib/movies";
import { MovieProfile } from "./profile";
import { RefreshButton } from "./refresh-button";

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

async function MyStatistics() {
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
            <Link href={localePath(lang, "/login")} className={buttonVariants()}>
              {t.movies.signedOut.action}
            </Link>
            <p className="text-sm text-muted-foreground">{t.movies.signedOut.hint}</p>
          </CardContent>
        </Card>
      </Gate>
    );
  const linked = await getDiscordAccount(session.user.id);
  if (!linked)
    return (
      <Gate t={t}>
        <Card>
          <CardHeader>
            <LinkIcon className="mb-2 size-7" />
            <CardTitle>{t.movies.unlinked.title}</CardTitle>
            <CardDescription>{t.movies.unlinked.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={localePath(lang, "/settings")} className={buttonVariants()}>
              {t.movies.unlinked.action}
            </Link>
          </CardContent>
        </Card>
      </Gate>
    );
  let result;
  try {
    result = await getMovieStatistics(linked.accountId);
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
  if (!result.subscription)
    return (
      <Gate t={t}>
        <Card>
          <CardHeader>
            <CardTitle>{t.movies.unsubscribed.title}</CardTitle>
            <CardDescription>{t.movies.unsubscribed.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {t.movies.unsubscribed.before}{" "}
              <code className="rounded bg-muted px-2 py-1">/movie subscribe</code>
              {t.movies.unsubscribed.after}
            </p>
            <RefreshButton checkOnly />
            <Link href={localePath(lang, "/settings")} className="text-sm text-muted-foreground underline">
              {t.movies.unsubscribed.check}
            </Link>
          </CardContent>
        </Card>
      </Gate>
    );
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

export default async function MovieHubPage() {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">
          {t.movies.loading}
        </div>
      }
    >
      <MyStatistics />
    </Suspense>
  );
}

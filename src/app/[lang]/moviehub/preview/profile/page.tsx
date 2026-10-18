import { readFile } from "node:fs/promises";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { movieResponseSchema } from "@/lib/movie-types";
import { styleProfile } from "../../compare";
import { MovieProfile } from "../../profile";

export const metadata: Metadata = { title: "档案预览" };

// Design sandbox for the full profile page without signing in: development only, fed by a saved
// admin response (`GET /website/movies/users/{id}`'s `data`) whose path is in
// MOVIE_PREVIEW_FIXTURE. Lets the page be screenshotted in both themes with real data. ?view=1
// shows it as someone else's page, compared with the same data oldest-first.
type SearchParams = Promise<{ view?: string }>;

export default function ProfilePreviewPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

// Reads the fixture at request time, so it lives under <Suspense> like the real page's data.
async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const path = process.env.MOVIE_PREVIEW_FIXTURE;
  if (process.env.NODE_ENV === "production" || !path) notFound();
  const raw = JSON.parse(await readFile(path, "utf8")) as { data?: unknown };
  const { subscription, snapshot, platform } = movieResponseSchema.parse(raw.data ?? raw);
  if (!subscription || !snapshot) notFound();
  const view = Boolean((await searchParams).view);
  const reversed = {
    ...snapshot,
    films: [...snapshot.films].reverse(),
    shows: snapshot.shows && { ...snapshot.shows, items: [...snapshot.shows.items].reverse() },
    anime: snapshot.anime && { ...snapshot.anime, items: [...snapshot.anime.items].reverse() },
  };
  return (
    <MovieProfile
      viewing={
        view
          ? {
              subject: subscription.traktName,
              compare: styleProfile("Preview visitor", reversed, platform),
              saveSource: false,
              viewerId: null,
            }
          : null
      }
      shareId={view ? null : "preview"}
      name={subscription.traktName}
      avatar={subscription.traktAvatar}
      traktUser={subscription.traktUser}
      region={subscription.region}
      syncedAt={subscription.syncedAt}
      syncError={null}
      waiting={false}
      poll={false}
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
      today={new Date().toISOString().slice(0, 10)}
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
      scoreSource="imdb"
    />
  );
}

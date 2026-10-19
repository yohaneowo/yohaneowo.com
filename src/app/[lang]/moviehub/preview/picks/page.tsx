import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/server";
import type { PicksView } from "@/lib/movies";
import { PicksBody } from "../../picks/picks-body";

export const metadata: Metadata = { title: "推荐预览" };

// Design sandbox for the 推荐 page without signing in: development only, fed by saved admin
// responses (`GET /website/movies/users/{id}/picks?kind=…`'s `data`) as picks_movie.json and
// picks_anime.json in the folder named by MOVIE_PREVIEW_PICKS. ?kind=anime shows the anime ones.
type SearchParams = Promise<{ kind?: string }>;

export default function PicksPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: { searchParams: SearchParams }) {
  const dir = process.env.MOVIE_PREVIEW_PICKS;
  if (process.env.NODE_ENV === "production" || !dir) notFound();
  const kind = (await searchParams).kind === "anime" ? "anime" : "movie";
  const view = JSON.parse(await readFile(path.join(dir, `picks_${kind}.json`), "utf8")) as PicksView;
  const t = (await getDictionary()).moviehub.picks;
  return (
    <div className="flex flex-col gap-6">
      <PicksBody t={t} lang={await getLocale()} view={view} />
    </div>
  );
}

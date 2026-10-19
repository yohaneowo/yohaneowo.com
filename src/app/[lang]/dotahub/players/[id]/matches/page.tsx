import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirectIfOwn } from "../../../account";
import { accountParam, MatchList, pageParam } from "../../../match-list";
import { Notice } from "../../../parts";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ page?: string | string[] }>;

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.matches.title };
}

async function Matches({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/matches");
  return (
    <MatchList
      t={t}
      lang={lang}
      accountId={id}
      page={pageParam((await searchParams).page)}
      path={`/dotahub/players/${id}/matches`}
    />
  );
}

// Anyone's match list, like the viewer's own /dotahub/matches.
export default async function PlayerMatchesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.matches.title}</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Matches params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

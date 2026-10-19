import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
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
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={localePath(lang, `/dotahub/players/${id}`)}
        className="self-start text-sm text-muted-foreground hover:underline"
      >
        {t.player.back}
      </Link>
      <MatchList
        t={t}
        lang={lang}
        accountId={id}
        page={pageParam((await searchParams).page)}
        path={`/dotahub/players/${id}/matches`}
      />
    </div>
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

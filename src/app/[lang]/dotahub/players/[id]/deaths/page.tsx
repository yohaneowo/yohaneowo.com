import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSteamOwner, steamIdOf } from "@/lib/steam-link";
import { redirectIfOwn } from "../../../account";
import { DeathsView, rangeParam } from "../../../deaths/deaths-view";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ n?: string | string[] }>;

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.deaths.title };
}

async function Deaths({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/deaths");
  // Deaths are only stored for players who linked Steam on this site.
  const userId = await getSteamOwner(steamIdOf(id));
  if (!userId) return <Notice>{t.player.noDeaths}</Notice>;
  return (
    <DeathsView
      t={t}
      lang={lang}
      userId={userId}
      accountId={id}
      n={rangeParam((await searchParams).n)}
      path={`/dotahub/players/${id}/deaths`}
      status={null}
    />
  );
}

// Someone's death heat map, when they linked Steam here too.
export default async function PlayerDeathsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.deaths.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.player.deathsDescription}</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Deaths params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

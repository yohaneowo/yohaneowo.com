import type { Metadata } from "next";
import { Suspense } from "react";
import { DEATHS_TITLE_SLOT } from "../../../deaths/insights";
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
  // Players who linked Steam here have their whole history stored; anyone else's newest ranked
  // matches are asked from STRATZ directly.
  const userId = await getSteamOwner(steamIdOf(id));
  return (
    <DeathsView
      t={t}
      lang={lang}
      source={userId ? { kind: "stored", userId } : { kind: "stratz" }}
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.deaths.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.player.deathsDescription}</p>
        </div>
        {/* The win rate for the chosen range and hero, put here by DeathsExplorer. */}
        <div id={DEATHS_TITLE_SLOT} className="shrink-0" />
      </div>
      <Suspense
        fallback={
          <div className="flex h-96 animate-pulse items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
            {t.player.loadingDeaths}
          </div>
        }
      >
        <Deaths params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

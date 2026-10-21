import type { Metadata } from "next";
import { Suspense } from "react";
import { DEATHS_TITLE_SLOT } from "../../../deaths/insights";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirectIfOwn } from "../../../account";
import { DeathsView, rangeParam } from "../../../deaths/deaths-view";
import { PlayerChip } from "../../../deaths/player-chip";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { prewarm } from "../../../prewarm";
import { LoadingPanel } from "../../../loading-panel";
import { sourceOf } from "../../../source";
import { FullHistoryBanner } from "../../../full-history";
import { getRankedCount } from "@/lib/dota/data";

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
  const { source, guest } = await sourceOf(id);
  await prewarm(id, source);
  return (
    <div className="flex flex-col gap-4">
      {source.kind !== "stored" && (
        <FullHistoryBanner
          accountId={id}
          guest={guest}
          estimate={guest ? null : await getRankedCount(id).catch(() => null)}
        />
      )}
      <DeathsView
        t={t}
        lang={lang}
        source={source}
        accountId={id}
        n={rangeParam((await searchParams).n)}
        path={`/dotahub/players/${id}/deaths`}
        status={null}
      />
    </div>
  );
}

async function OtherChip({ params }: { params: Params }) {
  const id = accountParam((await params).id);
  if (!id) return null;
  return (
    <div className="mt-2">
      <PlayerChip accountId={id} lang={await getLocale()} own={false} />
    </div>
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
          <Suspense fallback={<div className="mt-2 h-8" />}>
            <OtherChip params={params} />
          </Suspense>
          <p className="mt-1 text-sm text-muted-foreground">{t.player.deathsDescription}</p>
        </div>
        {/* The win rate for the chosen range and hero, put here by DeathsExplorer. */}
        <div id={DEATHS_TITLE_SLOT} className="shrink-0" />
      </div>
      <Suspense fallback={<LoadingPanel kind="deaths" />}>
        <Deaths params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

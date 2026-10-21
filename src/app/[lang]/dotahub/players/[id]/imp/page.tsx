import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirectIfOwn } from "../../../account";
import { PlayerChip } from "../../../deaths/player-chip";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { StatsBody } from "../../../stats/body";
import { SIDE_PANEL_PAGE } from "../../../stats/panel";
import { prewarm } from "../../../prewarm";
import { LoadingPanel } from "../../../loading-panel";
import { sourceOf } from "../../../source";
import { FullHistoryBanner } from "../../../full-history";
import { getRankedCount } from "@/lib/dota/data";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ vs?: string | string[] }>;

// Any account id can be opened, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.impPage.title };
}

async function Body({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/imp");
  // Linked here: admin's stored history; anyone else: STRATZ asked directly.
  const { source, guest } = await sourceOf(id);
  await prewarm(id, source);
  const vs = (await searchParams).vs;
  return (
    <div className="flex flex-col gap-4">
      {source.kind !== "stored" && (
        <FullHistoryBanner
          accountId={id}
          guest={guest}
          estimate={guest ? null : await getRankedCount(id).catch(() => null)}
        />
      )}
      <StatsBody kind="imp" source={source} accountId={id} vs={Array.isArray(vs) ? vs[0] : vs} />
    </div>
  );
}

async function Chip({ params }: { params: Params }) {
  const id = accountParam((await params).id);
  if (!id) return null;
  return (
    <div className="mt-2">
      <PlayerChip accountId={id} lang={await getLocale()} own={false} />
    </div>
  );
}

// Someone's imp page.
export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className={SIDE_PANEL_PAGE}>
      <div>
        <h1 className="text-2xl font-semibold">{t.impPage.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip params={params} />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.impPage.playerDescription}</p>
      </div>
      <Suspense fallback={<LoadingPanel kind="imp" />}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

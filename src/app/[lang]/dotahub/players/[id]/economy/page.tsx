import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSteamOwner, steamIdOf } from "@/lib/steam-link";
import { redirectIfOwn } from "../../../account";
import { PlayerChip } from "../../../deaths/player-chip";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { StatsBody } from "../../../stats/body";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ vs?: string | string[] }>;

// Any account id can be opened, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.economy.title };
}

async function Body({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/economy");
  // Linked here: admin's stored history; anyone else: STRATZ asked directly.
  const userId = await getSteamOwner(steamIdOf(id));
  const vs = (await searchParams).vs;
  return (
    <StatsBody
      kind="economy"
      source={userId ? { kind: "stored", userId } : { kind: "stratz" }}
      accountId={id}
      vs={Array.isArray(vs) ? vs[0] : vs}
    />
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

// Someone's economy page.
export default async function PlayerPage({
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
        <h1 className="text-2xl font-semibold">{t.economy.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip params={params} />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.economy.playerDescription}</p>
      </div>
      <Suspense
        fallback={
          <div className="flex h-96 animate-pulse items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
            {t.player.loadingDeaths}
          </div>
        }
      >
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

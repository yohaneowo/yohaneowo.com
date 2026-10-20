import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSteamOwner, steamIdOf } from "@/lib/steam-link";
import { redirectIfOwn } from "../../../account";
import { PlayerChip } from "../../../deaths/player-chip";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { StatsBody } from "../../../stats/body";
import { SIDE_PANEL_PAGE } from "../../../stats/panel";

type Params = Promise<{ id: string }>;

// Any account id can be opened, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.impPage.title };
}

async function Body({ params }: { params: Params }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/imp");
  // Linked here: admin's stored history; anyone else: STRATZ asked directly.
  const userId = await getSteamOwner(steamIdOf(id));
  return (
    <StatsBody kind="imp" source={userId ? { kind: "stored", userId } : { kind: "stratz" }} accountId={id} />
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
export default async function PlayerPage({ params }: { params: Params }) {
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
      <Suspense
        fallback={
          <div className="flex h-96 animate-pulse items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
            {t.player.loadingDeaths}
          </div>
        }
      >
        <Body params={params} />
      </Suspense>
    </div>
  );
}

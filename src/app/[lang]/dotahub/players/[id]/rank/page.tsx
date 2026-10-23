import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirectIfOwn } from "../../../account";
import { PlayerChip } from "../../../deaths/player-chip";
import { LoadingPanel } from "../../../loading-panel";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { prewarm } from "../../../prewarm";
import { RankBody } from "../../../rank/body";
import { sourceOf } from "../../../source";

type Params = Promise<{ id: string }>;

// Any account id can be opened, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.rankPage.title };
}

async function Body({ params }: { params: Params }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/rank");
  const { source } = await sourceOf(id);
  await prewarm(id, source);
  return <RankBody t={t} accountId={id} source={source} />;
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

// Someone's 段位.
export default async function PlayerPage({ params }: { params: Params }) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.rankPage.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip params={params} />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.rankPage.playerDescription}</p>
      </div>
      <Suspense fallback={<LoadingPanel kind="rank" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}

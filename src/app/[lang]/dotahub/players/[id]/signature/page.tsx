import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirectIfOwn } from "../../../account";
import { PlayerChip } from "../../../deaths/player-chip";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { SignatureBody } from "../../../signature/body";
import { getSteamOwner, steamIdOf } from "@/lib/steam-link";
import { prewarm } from "../../../prewarm";
import { LoadingPanel } from "../../../loading-panel";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ hero?: string | string[] }>;

// Any account id can be opened, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.signature.title };
}

async function Body({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/signature");
  const userId = await getSteamOwner(steamIdOf(id));
  await prewarm(id, userId ? { kind: "stored", userId } : { kind: "stratz" });
  const hero = Number((await searchParams).hero);
  return (
    <SignatureBody
      t={t}
      lang={lang}
      accountId={id}
      own={false}
      hero={Number.isInteger(hero) && hero > 0 ? hero : null}
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

// Someone's 绝活.
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
        <h1 className="text-2xl font-semibold">{t.signature.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip params={params} />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.signature.playerDescription}</p>
      </div>
      <Suspense fallback={<LoadingPanel kind="signature" />}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

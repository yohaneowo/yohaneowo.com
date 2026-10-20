import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirectIfOwn } from "../../../account";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { PeerList } from "../../../peer-list";

type Params = Promise<{ id: string }>;

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.peers.title };
}

async function Peers({ params }: { params: Params }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  await redirectIfOwn(id, lang, "/dotahub/peers");
  return <PeerList t={t} lang={lang} accountId={id} economyPath={`/dotahub/players/${id}/economy`} />;
}

// The people someone plays with most.
export default async function PlayerPeersPage({ params }: { params: Params }) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.peers.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.player.peersDescription}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Peers params={params} />
      </Suspense>
    </div>
  );
}

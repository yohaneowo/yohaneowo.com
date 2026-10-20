import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer } from "../account";
import { Notice } from "../parts";
import { PeerList } from "../peer-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.peers.title };
}

async function Peers() {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const viewer = await dotaViewer();
  if (viewer.state !== "linked")
    return (
      <Notice>
        <Link href={localePath(lang, "/dotahub")} className="underline underline-offset-2">
          {t.connect.title}
        </Link>
      </Notice>
    );
  return <PeerList t={t} lang={lang} accountId={viewer.accountId} economyPath="/dotahub/economy" />;
}

export default async function PeersPage() {
  const t = (await getDictionary()).dotahub.peers;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Peers />
      </Suspense>
    </div>
  );
}

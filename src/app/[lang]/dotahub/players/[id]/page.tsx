import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { steamIdOf } from "@/lib/steam-link";
import { dotaViewer } from "../../account";
import { accountParam } from "../../match-list";
import { Overview } from "../../overview";
import { Notice } from "../../parts";

type Params = Promise<{ id: string }>;

// Any account id can be opened, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.player.title };
}

async function Player({ params }: { params: Params }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  // Their own public page is their overview.
  const viewer = await dotaViewer();
  if (viewer.state === "linked" && viewer.accountId === id) redirect(localePath(lang, "/dotahub"));
  return <Overview t={t} lang={lang} accountId={id} steamId={steamIdOf(id)} own={false} />;
}

// Someone's public DotaHub page (a teammate, a player in a match), from OpenDota's public data;
// anyone can open it, signed in or not.
export default async function PlayerPage({ params }: { params: Params }) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.player.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.player.description}</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Player params={params} />
      </Suspense>
    </div>
  );
}

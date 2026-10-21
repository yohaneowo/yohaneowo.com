import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DEATHS_TITLE_SLOT } from "./insights";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer, syncDotaLink } from "../account";
import { Notice } from "../parts";
import { DeathsView, rangeParam } from "./deaths-view";
import { PlayerChip } from "./player-chip";
import { prewarm } from "../prewarm";
import { LoadingPanel } from "../loading-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.deaths.title };
}

type SearchParams = Promise<{ n?: string | string[] }>;

async function Deaths({ searchParams }: { searchParams: SearchParams }) {
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
  await prewarm(viewer.accountId, { kind: "stored", userId: viewer.userId });
  return (
    <DeathsView
      t={t}
      lang={lang}
      source={{ kind: "stored", userId: viewer.userId }}
      accountId={viewer.accountId}
      n={rangeParam((await searchParams).n)}
      path="/dotahub/deaths"
      status={await syncDotaLink(viewer)}
    />
  );
}

async function OwnChip() {
  const viewer = await dotaViewer();
  if (viewer.state !== "linked") return null;
  return (
    <div className="mt-2">
      <PlayerChip accountId={viewer.accountId} lang={await getLocale()} own />
    </div>
  );
}

// Where the linked player dies in ranked matches, from admin's stored STRATZ deaths.
export default async function DeathsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).dotahub.deaths;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <Suspense fallback={<div className="mt-2 h-8" />}>
            <OwnChip />
          </Suspense>
          <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
        </div>
        {/* The win rate for the chosen range and hero, put here by DeathsExplorer. */}
        <div id={DEATHS_TITLE_SLOT} className="shrink-0" />
      </div>
      <Suspense fallback={<LoadingPanel kind="deaths" />}>
        <Deaths searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

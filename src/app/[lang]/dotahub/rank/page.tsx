import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer, syncDotaLink } from "../account";
import { ViewerChip } from "../deaths/player-chip";
import { LoadingPanel } from "../loading-panel";
import { Notice } from "../parts";
import { prewarm } from "../prewarm";
import { RankBody } from "./body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.rankPage.title };
}

async function Body() {
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
  const source = { kind: "stored", userId: viewer.userId } as const;
  await prewarm(viewer.accountId, source);
  await syncDotaLink(viewer);
  return <RankBody t={t} accountId={viewer.accountId} source={source} />;
}

async function Chip() {
  return <ViewerChip lang={await getLocale()} />;
}

// The viewer's 段位: their rank among everyone, their matches' rank over time and by bracket, and
// the bracket's hero matchups against their own record.
export default async function Page() {
  const t = (await getDictionary()).dotahub.rankPage;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<LoadingPanel kind="rank" />}>
        <Body />
      </Suspense>
    </div>
  );
}

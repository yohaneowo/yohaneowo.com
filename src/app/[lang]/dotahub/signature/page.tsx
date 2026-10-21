import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer } from "../account";
import { ViewerChip } from "../deaths/player-chip";
import { Notice } from "../parts";
import { SignatureBody } from "./body";
import { prewarm } from "../prewarm";
import { LoadingPanel } from "../loading-panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.signature.title };
}

type SearchParams = Promise<{ hero?: string | string[] }>;

async function Body({ searchParams }: { searchParams: SearchParams }) {
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
  const hero = Number((await searchParams).hero);
  return (
    <SignatureBody
      t={t}
      lang={lang}
      accountId={viewer.accountId}
      own
      hero={Number.isInteger(hero) && hero > 0 ? hero : null}
    />
  );
}

async function Chip() {
  return <ViewerChip lang={await getLocale()} />;
}

// The viewer's 绝活: their signature heroes, the ones they play a lot, and the heroes' leaderboards.
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).dotahub.signature;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<LoadingPanel kind="signature" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer, syncDotaLink } from "../account";
import { ViewerChip } from "../deaths/player-chip";
import { Notice } from "../parts";
import { StatsBody } from "../stats/body";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.economy.title };
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
  // Make sure admin tracks this account (it fills in the details).
  await syncDotaLink(viewer);
  return (
    <StatsBody
      kind="economy"
      source={{ kind: "stored", userId: viewer.userId }}
      accountId={viewer.accountId}
    />
  );
}

async function Chip() {
  return <ViewerChip lang={await getLocale()} />;
}

export default async function Page() {
  const t = (await getDictionary()).dotahub.economy;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Body />
      </Suspense>
    </div>
  );
}

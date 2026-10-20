import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer, syncDotaLink } from "../account";
import { ViewerChip } from "../deaths/player-chip";
import { Notice } from "../parts";
import { StatsBody } from "../stats/body";
import { SIDE_PANEL_PAGE } from "../stats/panel";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.impPage.title };
}

type SearchParams = Promise<{ vs?: string | string[] }>;

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
  // Make sure admin tracks this account (it fills in the details).
  await syncDotaLink(viewer);
  const vs = (await searchParams).vs;
  return (
    <StatsBody
      kind="imp"
      source={{ kind: "stored", userId: viewer.userId }}
      accountId={viewer.accountId}
      vs={Array.isArray(vs) ? vs[0] : vs}
      own
    />
  );
}

async function Chip() {
  return <ViewerChip lang={await getLocale()} />;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).dotahub.impPage;
  return (
    <div className={SIDE_PANEL_PAGE}>
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Suspense fallback={<div className="mt-2 h-8" />}>
          <Chip />
        </Suspense>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

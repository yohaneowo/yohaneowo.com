import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer, syncDotaLink } from "../account";
import { Notice } from "../parts";
import { DeathsView, rangeParam } from "./deaths-view";

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

// Where the linked player dies in ranked matches, from admin's stored STRATZ deaths.
export default async function DeathsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).dotahub.deaths;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Deaths searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

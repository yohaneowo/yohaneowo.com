import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { dotaViewer } from "../account";
import { MatchList, pageParam } from "../match-list";
import { Notice } from "../parts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.matches.title };
}

type SearchParams = Promise<{ page?: string | string[] }>;

async function Matches({ searchParams }: { searchParams: SearchParams }) {
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
    <MatchList
      t={t}
      lang={lang}
      accountId={viewer.accountId}
      page={pageParam((await searchParams).page)}
      path="/dotahub/matches"
    />
  );
}

export default async function MatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = (await getDictionary()).dotahub;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.matches.title}</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        <Matches searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

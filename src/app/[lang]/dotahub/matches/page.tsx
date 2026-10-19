import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getHeroes, getPlayerMatches, MATCHES_PER_PAGE } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { dotaViewer } from "../account";
import { MatchTable } from "../match-table";
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
  const raw = (await searchParams).page;
  const page = Math.max(
    0,
    Math.min(200, Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "1"), 10) - 1 || 0),
  );
  let matches, heroes;
  try {
    [matches, heroes] = await Promise.all([getPlayerMatches(viewer.accountId, page), getHeroes()]);
  } catch {
    return <Notice>{t.unavailable}</Notice>;
  }
  const pageHref = (n: number) => localePath(lang, `/dotahub/matches?page=${n + 1}`);
  return (
    <div className="flex flex-col gap-4">
      {matches.length ? (
        <MatchTable matches={matches} heroes={heroes} t={t} lang={lang} />
      ) : (
        <Notice>{t.matches.empty}</Notice>
      )}
      <nav className="flex items-center justify-between text-sm">
        {page > 0 ? (
          <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t.matches.previous}
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">{t.matches.page(page + 1)}</span>
        <Link
          href={pageHref(page + 1)}
          aria-disabled={matches.length < MATCHES_PER_PAGE}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            matches.length < MATCHES_PER_PAGE && "pointer-events-none opacity-50",
          )}
        >
          {t.matches.next}
        </Link>
      </nav>
    </div>
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

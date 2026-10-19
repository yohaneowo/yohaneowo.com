import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getStoredDeaths } from "@/lib/dota/admin";
import { getHeroes, getRankedSides } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { dotaViewer, syncDotaLink } from "../account";
import { Notice } from "../parts";
import { DeathsExplorer } from "./deaths-explorer";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.deaths.title };
}

type SearchParams = Promise<{ n?: string | string[] }>;
// How many of the newest stored ranked matches; 0 is all of them.
const RANGES = [20, 50, 100, 0];

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
  const raw = (await searchParams).n;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = value === "all" ? 0 : RANGES.includes(Number(value)) ? Number(value) : 50;
  const status = await syncDotaLink(viewer);
  let data, heroes, sides: Record<number, boolean>;
  try {
    [data, heroes, sides] = await Promise.all([
      getStoredDeaths(viewer.userId, n),
      getHeroes(),
      // Without OpenDota the map areas are named absolutely (Radiant / Dire) instead.
      getRankedSides(viewer.accountId).catch(() => ({})),
    ]);
  } catch {
    return <Notice>{t.deaths.unavailable}</Notice>;
  }
  if (!data) return <Notice>{t.deaths.unavailable}</Notice>;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t.deaths.range} className="flex gap-1 self-start rounded-lg bg-muted p-1 text-sm">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={localePath(lang, `/dotahub/deaths?n=${r || "all"}`)}
            aria-current={r === n ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 transition-colors",
              r === n ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r ? t.deaths.recent(r) : t.deaths.all}
          </Link>
        ))}
      </nav>
      {status?.linked && !status.historyDone && (
        <p className="text-xs text-muted-foreground">{t.deaths.history(status.historyRead)}</p>
      )}
      <DeathsExplorer
        matches={data.matches}
        heroes={heroes}
        // Only the shown matches' sides go to the client.
        sides={Object.fromEntries(
          data.matches.filter((m) => m.matchId in sides).map((m) => [m.matchId, sides[m.matchId]]),
        )}
      />
    </div>
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

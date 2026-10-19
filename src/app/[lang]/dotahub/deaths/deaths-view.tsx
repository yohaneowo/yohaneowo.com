import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { type DotaStatus, getStoredDeaths } from "@/lib/dota/admin";
import { getHeroes, getRankedSides } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { Notice } from "../parts";
import { DeathsExplorer } from "./deaths-explorer";

// How many of the newest stored ranked matches; 0 is all of them.
const RANGES = [20, 50, 100, 0];

export function rangeParam(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "all" ? 0 : RANGES.includes(Number(value)) ? Number(value) : 50;
}

// The heat map of a site account's stored ranked deaths; path is the page's own address (the
// viewer's /dotahub/deaths or /dotahub/players/<id>/deaths), status admin's view of the history.
export async function DeathsView({
  t,
  lang,
  userId,
  accountId,
  n,
  path,
  status,
}: {
  t: Dictionary["dotahub"];
  lang: Locale;
  userId: string;
  accountId: number;
  n: number;
  path: string;
  status: DotaStatus | null;
}) {
  let data, heroes, sides: Record<number, boolean>;
  try {
    [data, heroes, sides] = await Promise.all([
      getStoredDeaths(userId, n),
      getHeroes(),
      // Without OpenDota the map areas are named absolutely (Radiant / Dire) instead.
      getRankedSides(accountId).catch(() => ({})),
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
            href={localePath(lang, `${path}?n=${r || "all"}`)}
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

import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { type DotaStatus, getStoredDeaths } from "@/lib/dota/admin";
import { getHeroes, getRankedSides } from "@/lib/dota/data";
import { getStratzRanked } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { Notice } from "../parts";
import { DeathsExplorer } from "./deaths-explorer";

// How many of the newest stored ranked matches; 0 is all of them.
const RANGES = [20, 50, 100, 0];

export function rangeParam(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "all" ? 0 : RANGES.includes(Number(value)) ? Number(value) : 50;
}

// Where the deaths come from: admin's stored history for a player who linked Steam here (every
// ranked match, kept up to date), or STRATZ asked directly for anyone else (the newest 100).
export type DeathsSource = { kind: "stored"; userId: string } | { kind: "stratz" };

export async function loadDeaths(source: DeathsSource, accountId: number, n: number) {
  if (source.kind === "stored") return getStoredDeaths(source.userId, n);
  // Without the details: the heat map doesn't use them, and they'd only weigh on the page.
  const matches = (await getStratzRanked(accountId)).map((match) => {
    const { details, ...rest } = match;
    void details;
    return rest;
  });
  return { historyDone: true, matches: n ? matches.slice(0, n) : matches };
}

// The heat map of a player's ranked deaths; path is the page's own address (the viewer's
// /dotahub/deaths or /dotahub/players/<id>/deaths), status admin's view of the history.
export async function DeathsView({
  t,
  lang,
  source,
  accountId,
  n: asked,
  path,
  status,
}: {
  t: Dictionary["dotahub"];
  lang: Locale;
  source: DeathsSource;
  accountId: number;
  n: number;
  path: string;
  status: DotaStatus | null;
}) {
  // Asked directly, there is no "all": the newest 100 are as far back as it goes.
  const ranges = source.kind === "stored" ? RANGES : RANGES.filter(Boolean);
  const n = ranges.includes(asked) ? asked : 100;
  let data, heroes, sides: Record<number, boolean>;
  try {
    [data, heroes, sides] = await Promise.all([
      loadDeaths(source, accountId, n),
      getHeroes(),
      // Without OpenDota the map areas are named absolutely (Radiant / Dire) instead.
      getRankedSides(accountId).catch(() => ({})),
    ]);
  } catch {
    return <Notice>{t.deaths.unavailable}</Notice>;
  }
  if (!data) return <Notice>{t.deaths.unavailable}</Notice>;
  if (source.kind === "stratz" && !data.matches.length) return <Notice>{t.player.noStratz}</Notice>;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t.deaths.range} className="flex gap-1 self-start rounded-lg bg-muted p-1 text-sm">
        {ranges.map((r) => (
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
      {source.kind === "stratz" && <p className="text-xs text-muted-foreground">{t.player.stratzRecent}</p>}
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

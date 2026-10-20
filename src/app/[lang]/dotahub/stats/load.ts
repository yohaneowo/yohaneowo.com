import "server-only";
import { type DetailMatch, getStoredDetails } from "@/lib/dota/admin";
import { getHeroes, getRankedSides } from "@/lib/dota/data";
import { getStratzRanked } from "@/lib/dota/stratz";
import type { DeathsSource } from "../deaths/deaths-view";

// The ranked matches with economy and IMP details for the 经济 and IMP pages, newest first: admin's
// stored history for a player linked here (all of it), STRATZ asked directly for anyone else (the
// newest 100). complete: false while admin is still reading the history.
export async function loadDetailMatches(source: DeathsSource, accountId: number) {
  const [data, heroes, sides] = await Promise.all([
    source.kind === "stored"
      ? getStoredDetails(source.userId, 0).then((d) =>
          d ? { matches: d.matches, complete: d.historyDone } : null,
        )
      : getStratzRanked(accountId).then((all) => ({
          matches: all
            .filter((m) => m.details)
            .map((m): DetailMatch => ({
              matchId: m.matchId,
              heroId: m.heroId,
              won: m.won,
              startTime: m.startTime,
              duration: m.duration,
              kills: m.kills,
              deaths: m.deaths,
              assists: m.assists,
              imp: m.imp,
              details: m.details!,
            })),
          complete: true,
        })),
    getHeroes(),
    // Without OpenDota the side filter simply has nothing to go on.
    getRankedSides(accountId).catch(() => ({}) as Record<number, boolean>),
  ]);
  if (!data) return null;
  return {
    ...data,
    heroes,
    // Only these matches' sides go to the client.
    sides: Object.fromEntries(
      data.matches.filter((m) => m.matchId in sides).map((m) => [m.matchId, sides[m.matchId]]),
    ),
  };
}

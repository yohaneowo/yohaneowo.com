import "server-only";
import { getStoredBracket, getStoredDetails } from "@/lib/dota/admin";
import { getPlayerHeroes, getPlayerHeroesAs, type PlayerHero, type RankedEntry } from "@/lib/dota/data";
import type { DeathsSource } from "../deaths/deaths-view";

// What the 段位 page computes on the server: the player's own matchups (who they beat and lose to,
// on each hero and on any) and their ranked matches by bracket.

export type Rec = { g: number; w: number };

// The player's record against each hero: on each of their heroes (byHero[mine][theirs]) and on
// any (overall[theirs]); heroGames counts their matches per hero, to pick the heroes shown.
export type Matchups = {
  source: "stored" | "opendota";
  overall: Record<number, Rec>;
  byHero: Record<number, Record<number, Rec>>;
  heroGames: Record<number, number>;
};

export const TOP_HEROES = 6;
export const MIN_HERO_GAMES = 5;

function bump(map: Record<number, Rec>, hero: number, won: boolean) {
  const r = (map[hero] ??= { g: 0, w: 0 });
  r.g++;
  if (won) r.w++;
}

// The heroes the matchups are shown for: the player's most played with enough matches.
export function topHeroes(m: Matchups): number[] {
  return Object.entries(m.heroGames)
    .filter(([, games]) => games >= MIN_HERO_GAMES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_HEROES)
    .map(([hero]) => Number(hero));
}

// A player linked here: from the stored ranked matches, the five heroes on the other side of each
// (admin keeps the other nine players). Anyone else: OpenDota's per-hero statistics, overall and
// then once per shown hero (its rows' against_* are then the record on that hero).
export async function loadMatchups(source: DeathsSource, accountId: number): Promise<Matchups | null> {
  if (source.kind === "stored") {
    const [details, bracket] = await Promise.all([
      getStoredDetails(source.userId, 0),
      getStoredBracket(source.userId, 0),
    ]);
    if (!details || !bracket) return null;
    const mine = new Map(details.matches.map((m) => [m.matchId, m]));
    const out: Matchups = { source: "stored", overall: {}, byHero: {}, heroGames: {} };
    for (const m of bracket.matches) {
      const me = mine.get(m.matchId);
      if (!me || m.rad == null) continue;
      out.heroGames[me.heroId] = (out.heroGames[me.heroId] ?? 0) + 1;
      const onHero = (out.byHero[me.heroId] ??= {});
      for (const o of m.others) {
        if (o.rad === m.rad) continue;
        bump(out.overall, o.hero, me.won);
        bump(onHero, o.hero, me.won);
      }
    }
    return out;
  }
  const rows = (await getPlayerHeroes(accountId)).data;
  const out: Matchups = { source: "opendota", overall: {}, byHero: {}, heroGames: {} };
  for (const r of rows) {
    const hero = Number(r.hero_id);
    if (!hero) continue;
    if (r.games) out.heroGames[hero] = r.games;
    if (r.against_games) out.overall[hero] = { g: r.against_games, w: r.against_win ?? 0 };
  }
  await Promise.all(
    topHeroes(out).map(async (hero) => {
      out.byHero[hero] = againstOf(await getPlayerHeroesAs(accountId, hero).catch(() => []));
    }),
  );
  return out;
}

// OpenDota's per-hero rows (queried as one hero) as the record against each of them.
export function againstOf(rows: PlayerHero[]): Record<number, Rec> {
  const out: Record<number, Rec> = {};
  for (const r of rows) {
    const theirs = Number(r.hero_id);
    if (theirs && r.against_games) out[theirs] = { g: r.against_games, w: r.against_win ?? 0 };
  }
  return out;
}

// The ranked matches with an average rank, oldest first, and how they went by the match's medal.
export type RankPoint = { start: number; tier: number; won: boolean };

export function rankPoints(index: Record<number, RankedEntry>): RankPoint[] {
  return Object.values(index)
    .filter((e): e is RankedEntry & { rank: number } => e.rank != null && e.rank > 0)
    .map((e) => ({ start: e.start, tier: e.rank, won: e.won }))
    .sort((a, b) => a.start - b.start);
}

export function byMedal(points: RankPoint[]): { medal: number; games: number; wins: number }[] {
  const out = Array.from({ length: 9 }, (_, medal) => ({ medal, games: 0, wins: 0 }));
  for (const p of points) {
    const medal = Math.floor(p.tier / 10);
    if (medal >= 1 && medal <= 8) {
      out[medal].games++;
      if (p.won) out[medal].wins++;
    }
  }
  return out.filter((row) => row.medal >= 1 && row.games > 0);
}

// How the player did in matches above, at and below their own medal, over the newest
// AROUND_RECENT matches: older ones were played at whatever rank they had then.
export const AROUND_RECENT = 100;

export function aroundOwn(
  points: RankPoint[],
  tier: number | null,
): Record<"above" | "same" | "below", Rec> | null {
  if (!tier) return null;
  const own = Math.floor(tier / 10);
  const out = { above: { g: 0, w: 0 }, same: { g: 0, w: 0 }, below: { g: 0, w: 0 } };
  for (const p of points.slice(-AROUND_RECENT)) {
    const medal = Math.floor(p.tier / 10);
    const key = medal > own ? "above" : medal < own ? "below" : "same";
    out[key].g++;
    if (p.won) out[key].w++;
  }
  return out;
}

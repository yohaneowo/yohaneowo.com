import "server-only";
import {
  type BracketMatch,
  type DetailMatch,
  getRankSample,
  getStoredBracket,
  getGuestDetails,
  getStoredDetails,
} from "@/lib/dota/admin";
import { getHeroes, getRankedSides } from "@/lib/dota/data";
import { getHeroCvSample, getStratzRanked } from "@/lib/dota/stratz";
import type { DeathsSource } from "../deaths/deaths-view";

// The ranked matches with economy and IMP details for the 经济 and IMP pages, newest first: admin's
// stored history for a player linked here (all of it), STRATZ asked directly for anyone else (the
// newest 100). complete: false while admin is still reading the history.
export async function loadDetailMatches(source: DeathsSource, accountId: number) {
  const [data, heroes, sides] = await Promise.all([
    source.kind === "stored" || source.kind === "guest"
      ? (source.kind === "stored" ? getStoredDetails(source.userId, 0) : getGuestDetails(accountId, 0)).then(
          (d) => (d ? { matches: d.matches, complete: d.historyDone } : null),
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

// Every other player of the player's stored matches as a match of their own (the same bracket,
// by matchmaking): the lead flips sign for the other side. matchId repeats (nine per match).
export function bracketMatches(matches: BracketMatch[]): DetailMatch[] {
  return matches.flatMap((m) =>
    m.others
      .filter((o) => o.nwm.length)
      .map((o): DetailMatch => ({
        matchId: m.matchId,
        heroId: o.hero,
        won: o.won,
        startTime: m.startTime,
        duration: m.duration,
        kills: 0,
        deaths: 0,
        assists: 0,
        imp: o.imp,
        details: {
          pos: o.pos,
          lane: null,
          award: null,
          gpm: o.gpm,
          xpm: o.xpm,
          nw: o.nwm[o.nwm.length - 1] ?? 0,
          lh: o.lh,
          dn: 0,
          hd: 0,
          nwm: o.nwm,
          impm: [],
          lhm: o.lhm,
          items: o.items,
          rad: o.rad,
          lead: m.rad == null ? [] : o.rad === m.rad ? m.lead : m.lead.map((v) => -v),
          wp: [],
          laneOut: o.laneOut,
          outcome: null,
          bench: null,
        },
      })),
  );
}

// The bracket of a player linked here, with who played which hero (for sampling).
export async function loadBracket(userId: string) {
  const data = await getStoredBracket(userId, 0);
  if (!data) return null;
  const accounts = new Map<number, Set<number>>();
  for (const m of data.matches)
    for (const o of m.others) if (o.acc) accounts.set(o.hero, (accounts.get(o.hero) ?? new Set()).add(o.acc));
  return { matches: bracketMatches(data.matches), accounts };
}

const SAMPLED_PLAYERS = 20;

// The forest chart's background: how steady other players of each hero in the bracket are.
export async function bracketVolatility(
  heroIds: number[],
  accounts: Map<number, Set<number>>,
  exclude: number[],
) {
  const entries = await Promise.all(
    heroIds.map(async (hero) => {
      // A steady, sorted pick, so the cached sample is reused.
      const pool = [...(accounts.get(hero) ?? [])]
        .filter((a) => !exclude.includes(a))
        .sort((a, b) => a - b)
        .slice(0, SAMPLED_PLAYERS);
      const cvs = pool.length ? await getHeroCvSample(hero, pool).catch(() => []) : [];
      return [hero, cvs] as const;
    }),
  );
  return Object.fromEntries(entries.filter(([, cvs]) => cvs.length));
}

// A hero's players at a rank tier (medal 1–8): admin's sample of their ranked matches
// (still being collected while count is short of target) as pseudo matches, and the volatility of
// each sampled player with enough matches (the forest chart's background).
const CROWD_MIN_GAMES = 5;

export async function loadRank(heroId: number, tier: number) {
  const data = await getRankSample(heroId, tier);
  if (!data) return null;
  const matches = data.matches.map((m): DetailMatch => ({
    matchId: m.matchId,
    heroId: m.heroId,
    won: m.won,
    startTime: m.startTime,
    duration: m.duration,
    kills: 0,
    deaths: 0,
    assists: 0,
    imp: m.imp,
    details: m.details,
  }));
  const byPlayer = new Map<number, number[]>();
  for (const m of data.matches)
    if (m.acc && m.details.gpm > 0) byPlayer.set(m.acc, [...(byPlayer.get(m.acc) ?? []), m.details.gpm]);
  const cv: number[] = [];
  for (const gpm of byPlayer.values()) {
    if (gpm.length < CROWD_MIN_GAMES) continue;
    const mean = gpm.reduce((a, b) => a + b, 0) / gpm.length;
    const sd = Math.sqrt(gpm.reduce((a, g) => a + (g - mean) ** 2, 0) / (gpm.length - 1));
    cv.push(sd / mean);
  }
  return { matches, cv, progress: { count: data.count, target: data.target } };
}

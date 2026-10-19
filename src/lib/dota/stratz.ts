import "server-only";
import { cacheLife } from "next/cache";
import type { DeathEvent, StoredMatch } from "./admin";
import { recordCall } from "./health";

// STRATZ (GraphQL, STRATZ_API_TOKEN): one match's IMP scores and every player's deaths, with
// where on the map each happened. Only parsed matches have them (usually minutes after the end).

export type StratzPlayer = {
  steamAccountId: number | null;
  heroId: number;
  isRadiant: boolean;
  imp: number | null;
  deathEvents: DeathEvent[];
};
export type StratzMatch = { parsed: boolean; players: StratzPlayer[] };

type Raw = {
  data?: {
    match?: {
      parsedDateTime: number | null;
      players: {
        steamAccountId: number | null;
        heroId: number;
        isRadiant: boolean;
        imp: number | null;
        stats: {
          deathEvents:
            | {
                time: number;
                positionX: number;
                positionY: number;
                attacker: number | null;
                goldLost: number | null;
                timeDead: number | null;
              }[]
            | null;
        } | null;
      }[];
    } | null;
  };
};

export async function getStratzMatch(matchId: number): Promise<StratzMatch | null> {
  "use cache";
  const token = process.env.STRATZ_API_TOKEN;
  if (!token) return null;
  const started = Date.now();
  const response = await fetch("https://api.stratz.com/graphql", {
    method: "POST",
    // STRATZ asks API clients to send this exact user agent.
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({
      query: `{ match(id: ${Math.trunc(matchId)}) { parsedDateTime players { steamAccountId heroId isRadiant imp stats { deathEvents { time positionX positionY attacker goldLost timeDead } } } } }`,
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((error) => {
    recordCall("stratz", started, { ok: false, error: error instanceof Error ? error.name : "failed" });
    throw error;
  });
  recordCall("stratz", started, {
    ok: response.ok,
    error: response.ok ? null : `HTTP ${response.status}`,
    headers: response.headers,
  });
  if (!response.ok) {
    cacheLife("minutes");
    return null;
  }
  const match = ((await response.json()) as Raw).data?.match;
  if (!match) {
    cacheLife("minutes");
    return null;
  }
  const parsed = Boolean(match.parsedDateTime);
  // A parsed match never changes; an unparsed one is asked again soon.
  if (parsed) cacheLife("days");
  else cacheLife("minutes");
  return {
    parsed,
    players: match.players.map((p) => ({
      steamAccountId: p.steamAccountId,
      heroId: p.heroId,
      isRadiant: p.isRadiant,
      imp: typeof p.imp === "number" ? p.imp : null,
      deathEvents: (p.stats?.deathEvents ?? []).map((e) => ({
        t: e.time,
        x: e.positionX,
        y: e.positionY,
        by: e.attacker ?? 0,
        gold: e.goldLost ?? 0,
        dead: e.timeDead ?? 0,
      })),
    })),
  };
}

type RawRanked = {
  data?: {
    player?: {
      matches:
        | {
            id: number;
            startDateTime: number | null;
            durationSeconds: number | null;
            parsedDateTime: number | null;
            players:
              | {
                  heroId: number;
                  isVictory: boolean;
                  kills: number | null;
                  deaths: number | null;
                  assists: number | null;
                  imp: number | null;
                  stats: {
                    deathEvents:
                      | {
                          time: number;
                          positionX: number | null;
                          positionY: number | null;
                          attacker: number | null;
                          goldLost: number | null;
                          timeDead: number | null;
                        }[]
                      | null;
                  } | null;
                }[]
              | null;
          }[]
        | null;
    } | null;
  };
  errors?: unknown[];
};

// Up to RECENT_RANKED of a player's newest ranked matches with their deaths, in the shape admin
// stores for linked players: the heat map of someone who never linked Steam here. One request,
// kept for hours (STRATZ's quota is shared with admin's checks).
export const RECENT_RANKED = 100;

export async function getStratzRankedDeaths(accountId: number): Promise<StoredMatch[]> {
  "use cache";
  cacheLife("hours");
  const token = process.env.STRATZ_API_TOKEN;
  if (!token) throw new Error("STRATZ_API_TOKEN is not set");
  const id = Math.trunc(accountId);
  const started = Date.now();
  const response = await fetch("https://api.stratz.com/graphql", {
    method: "POST",
    // STRATZ asks API clients to send this exact user agent.
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({
      query: `{ player(steamAccountId: ${id}) { matches(request: { take: ${RECENT_RANKED}, skip: 0, lobbyTypeIds: [7] }) { id startDateTime durationSeconds parsedDateTime players(steamAccountId: ${id}) { heroId isVictory kills deaths assists imp stats { deathEvents { time positionX positionY attacker goldLost timeDead } } } } } }`,
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch((error) => {
    recordCall("stratz", started, { ok: false, error: error instanceof Error ? error.name : "failed" });
    throw error;
  });
  recordCall("stratz", started, {
    ok: response.ok,
    error: response.ok ? null : `HTTP ${response.status}`,
    headers: response.headers,
  });
  if (!response.ok) throw new Error(`STRATZ ${response.status}`);
  const body = (await response.json()) as RawRanked;
  if (body.errors?.length) throw new Error("STRATZ query failed");
  const matches: StoredMatch[] = [];
  for (const m of body.data?.player?.matches ?? []) {
    const p = m.players?.[0];
    if (!p || !m.startDateTime) continue;
    matches.push({
      matchId: m.id,
      heroId: p.heroId,
      won: p.isVictory,
      startTime: m.startDateTime,
      duration: m.durationSeconds ?? 0,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      imp: typeof p.imp === "number" ? p.imp : null,
      parsed: Boolean(m.parsedDateTime),
      deathEvents: (p.stats?.deathEvents ?? [])
        .filter((e) => e.positionX != null && e.positionY != null)
        .map((e) => ({
          t: e.time,
          x: e.positionX!,
          y: e.positionY!,
          by: e.attacker ?? 0,
          gold: e.goldLost ?? 0,
          dead: e.timeDead ?? 0,
        })),
    });
  }
  return matches.sort((a, b) => b.startTime - a.startTime);
}

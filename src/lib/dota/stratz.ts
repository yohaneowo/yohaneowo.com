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
      firstBloodTime: number | null;
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
      query: `{ match(id: ${Math.trunc(matchId)}) { parsedDateTime firstBloodTime players { steamAccountId heroId isRadiant imp stats { deathEvents { time positionX positionY attacker goldLost timeDead } } } } }`,
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
        fb: match.firstBloodTime != null && e.time === match.firstBloodTime,
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
            firstBloodTime: number | null;
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
      query: `{ player(steamAccountId: ${id}) { matches(request: { take: ${RECENT_RANKED}, skip: 0, lobbyTypeIds: [7] }) { id startDateTime durationSeconds parsedDateTime firstBloodTime players(steamAccountId: ${id}) { heroId isVictory kills deaths assists imp stats { deathEvents { time positionX positionY attacker goldLost timeDead } } } } } }`,
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
          fb: m.firstBloodTime != null && e.time === m.firstBloodTime,
        })),
    });
  }
  return matches.sort((a, b) => b.startTime - a.startTime);
}

// Asks STRATZ to fetch and parse a match again (the 重新提交解析 button on its site). Anyone can press
// it on a public page, so each match is sent at most once every REPARSE_EVERY_MS from this server.
const REPARSE_EVERY_MS = 10 * 60 * 1000;
const reparsed = ((globalThis as { __stratzReparsed?: Map<number, number> }).__stratzReparsed ??= new Map());

export async function requestStratzParse(matchId: number): Promise<"sent" | "throttled" | "failed"> {
  const token = process.env.STRATZ_API_TOKEN;
  if (!token) return "failed";
  const id = Math.trunc(matchId);
  const last = reparsed.get(id);
  if (last && Date.now() - last < REPARSE_EVERY_MS) return "throttled";
  reparsed.set(id, Date.now());
  const started = Date.now();
  try {
    const response = await fetch("https://api.stratz.com/graphql", {
      method: "POST",
      // STRATZ asks API clients to send this exact user agent.
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "STRATZ_API",
      },
      body: JSON.stringify({ query: `mutation { retryMatchDownload(matchId: ${id}) }` }),
      signal: AbortSignal.timeout(15_000),
    });
    recordCall("stratz", started, {
      ok: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`,
      headers: response.headers,
    });
    const body = (await response.json()) as { data?: { retryMatchDownload?: boolean } };
    if (body.data?.retryMatchDownload) return "sent";
  } catch (error) {
    recordCall("stratz", started, { ok: false, error: error instanceof Error ? error.name : "failed" });
  }
  // Let it be tried again right away when the request itself failed.
  reparsed.delete(id);
  return "failed";
}

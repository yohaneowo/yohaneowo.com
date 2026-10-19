import "server-only";
import { cacheLife } from "next/cache";
import type { DeathEvent } from "./admin";
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

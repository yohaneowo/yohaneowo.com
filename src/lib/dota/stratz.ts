import "server-only";
import { cacheLife } from "next/cache";
import type { DeathEvent, MatchDetails, StoredMatch } from "./admin";
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
            radiantNetworthLeads: number[] | null;
            winRates: number[] | null;
            topLaneOutcome: string | null;
            midLaneOutcome: string | null;
            bottomLaneOutcome: string | null;
            analysisOutcome: string | null;
            players:
              | {
                  heroId: number;
                  isVictory: boolean;
                  isRadiant: boolean;
                  heroAverage: { time: number; networth: number | null; cs: number | null }[] | null;
                  kills: number | null;
                  deaths: number | null;
                  assists: number | null;
                  imp: number | null;
                  position: string | null;
                  lane: string | null;
                  award: string | null;
                  goldPerMinute: number | null;
                  experiencePerMinute: number | null;
                  networth: number | null;
                  numLastHits: number | null;
                  numDenies: number | null;
                  heroDamage: number | null;
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
                    networthPerMinute: number[] | null;
                    impPerMinute: number[] | null;
                    lastHitsPerMinute: number[] | null;
                    itemPurchases: { time: number | null; itemId: number | null }[] | null;
                  } | null;
                }[]
              | null;
          }[]
        | null;
    } | null;
  };
  errors?: unknown[];
};
type RawRankedPlayer = NonNullable<
  NonNullable<NonNullable<NonNullable<RawRanked["data"]>["player"]>["matches"]>[number]["players"]
>[number];

type RawRankedMatch = NonNullable<NonNullable<NonNullable<RawRanked["data"]>["player"]>["matches"]>[number];

const LANE_SCORE: Record<string, number> = {
  RADIANT_STOMP: 2,
  RADIANT_VICTORY: 1,
  TIE: 0,
  DIRE_VICTORY: -1,
  DIRE_STOMP: -2,
};
const BENCH_MINUTES = [10, 20, 30];

// The same details admin stores (stratz.details there).
function toDetails(p: RawRankedPlayer, m: RawRankedMatch): MatchDetails | null {
  const s = p.stats;
  if (!s?.networthPerMinute?.length) return null;
  const first = new Map<number, number>();
  for (const purchase of s.itemPurchases ?? [])
    if (purchase.itemId != null && purchase.time != null && !first.has(purchase.itemId))
      first.set(purchase.itemId, purchase.time);
  const position = p.position ?? "";
  return {
    pos: /^POSITION_[1-5]$/.test(position) ? Number(position.slice(-1)) : null,
    lane: p.lane,
    award: p.award && p.award !== "NONE" ? p.award : null,
    gpm: p.goldPerMinute ?? 0,
    xpm: p.experiencePerMinute ?? 0,
    nw: p.networth ?? 0,
    lh: p.numLastHits ?? 0,
    dn: p.numDenies ?? 0,
    hd: p.heroDamage ?? 0,
    nwm: s.networthPerMinute.map((v) => v ?? 0),
    impm: (s.impPerMinute ?? []).map((v) => v ?? 0),
    lhm: (s.lastHitsPerMinute ?? []).map((v) => v ?? 0),
    items: [...first.entries()].map(([id, t]) => [t, id] as [number, number]).sort((a, b) => a[0] - b[0]),
    ...side(p, m),
  };
}

// From the player's side: lead and win chance per minute, lane outcome, the hero's averages.
function side(p: RawRankedPlayer, m: RawRankedMatch) {
  const sign = p.isRadiant ? 1 : -1;
  const lane =
    p.lane === "MID_LANE"
      ? m.midLaneOutcome
      : p.lane === "SAFE_LANE"
        ? p.isRadiant
          ? m.bottomLaneOutcome
          : m.topLaneOutcome
        : p.lane === "OFF_LANE"
          ? p.isRadiant
            ? m.topLaneOutcome
            : m.bottomLaneOutcome
          : null;
  const score = lane != null && lane in LANE_SCORE ? LANE_SCORE[lane] * sign : null;
  const averages = new Map((p.heroAverage ?? []).map((a) => [a.time, a]));
  const bench = Object.fromEntries(
    BENCH_MINUTES.filter((minute) => averages.has(minute)).map((minute) => {
      const a = averages.get(minute)!;
      return [
        String(minute),
        [Math.round(a.networth ?? 0), Math.round((a.cs ?? 0) * 10) / 10] as [number, number],
      ];
    }),
  );
  return {
    rad: p.isRadiant,
    lead: (m.radiantNetworthLeads ?? []).map((v) => sign * (v ?? 0)),
    wp: (m.winRates ?? []).filter((v) => v != null).map((v) => Math.round(100 * (sign > 0 ? v : 1 - v))),
    laneOut: score === 0 ? 0 : score,
    outcome: m.analysisOutcome && m.analysisOutcome !== "NONE" ? m.analysisOutcome : null,
    bench: Object.keys(bench).length ? bench : null,
  };
}

// A ranked match asked from STRATZ directly: what admin stores for linked players, deaths and
// details together.
export type RankedMatch = StoredMatch & { details: MatchDetails | null };

// Up to RECENT_RANKED of a player's newest ranked matches with their deaths, in the shape admin
// stores for linked players: the heat map of someone who never linked Steam here. One request,
// kept for hours (STRATZ's quota is shared with admin's checks).
export const RECENT_RANKED = 100;

export async function getStratzRanked(accountId: number): Promise<RankedMatch[]> {
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
      query: `{ player(steamAccountId: ${id}) { matches(request: { take: ${RECENT_RANKED}, skip: 0, lobbyTypeIds: [7] }) { id startDateTime durationSeconds parsedDateTime firstBloodTime radiantNetworthLeads winRates topLaneOutcome midLaneOutcome bottomLaneOutcome analysisOutcome players(steamAccountId: ${id}) { heroId isVictory isRadiant heroAverage { time networth cs } kills deaths assists imp position lane award goldPerMinute experiencePerMinute networth numLastHits numDenies heroDamage stats { deathEvents { time positionX positionY attacker goldLost timeDead } networthPerMinute impPerMinute lastHitsPerMinute itemPurchases { time itemId } } } } } }`,
    }),
    signal: AbortSignal.timeout(45_000),
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
  const matches: RankedMatch[] = [];
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
      details: m.parsedDateTime ? toDetails(p, m) : null,
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

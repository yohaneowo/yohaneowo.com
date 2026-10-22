import "server-only";
import { cacheLife } from "next/cache";
import type { DeathEvent, MatchDetails, StoredMatch } from "./admin";
import type { Peer } from "./data";
import { recordCall } from "./health";

// After a query for a player fails, the same query isn't sent again for COOLDOWN_MS: a failure
// isn't cached, so every view of their pages (and the prewarm behind it) would otherwise send it
// again — thousands of calls on a day STRATZ is flaky, all against the quota shared with admin.
const COOLDOWN_MS = 5 * 60 * 1000;
const coolingDown = ((globalThis as { __stratzCooldown?: Map<string, number> }).__stratzCooldown ??= new Map<
  string,
  number
>());

export class StratzCoolingDown extends Error {}

async function guarded<T>(key: string, run: () => Promise<T>): Promise<T> {
  const until = coolingDown.get(key);
  if (until && until > Date.now()) throw new StratzCoolingDown(`STRATZ ${key} failed recently`);
  try {
    const out = await run();
    coolingDown.delete(key);
    return out;
  } catch (error) {
    coolingDown.set(key, Date.now() + COOLDOWN_MS);
    throw error;
  }
}

// STRATZ (GraphQL, STRATZ_API_TOKEN): one match's IMP scores and every player's deaths, with
// where on the map each happened. Only parsed matches have them (usually minutes after the end).

export type StratzPlayer = {
  steamAccountId: number | null;
  heroId: number;
  isRadiant: boolean;
  imp: number | null;
  // IMP at each minute (where the player stood then).
  impm: number[];
  deathEvents: DeathEvent[];
};
// rank: the match's average rank tier (medal × 10 + stars). picks: in draft order; bans: the heroes
// banned (in ranked All Pick everyone nominates and some go through, so they have no side).
export type StratzMatch = {
  parsed: boolean;
  rank: number | null;
  picks: { heroId: number; radiant: boolean; order: number }[];
  bans: number[];
  players: StratzPlayer[];
};

type Raw = {
  data?: {
    match?: {
      parsedDateTime: number | null;
      firstBloodTime: number | null;
      rank: number | null;
      pickBans:
        | {
            isPick: boolean;
            heroId: number | null;
            bannedHeroId: number | null;
            isRadiant: boolean | null;
            order: number | null;
            wasBannedSuccessfully: boolean | null;
          }[]
        | null;
      players: {
        steamAccountId: number | null;
        heroId: number;
        isRadiant: boolean;
        imp: number | null;
        stats: {
          impPerMinute: (number | null)[] | null;
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
  return guarded(`match:${matchId}`, async () => {
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
        query: `{ match(id: ${Math.trunc(matchId)}) { parsedDateTime firstBloodTime rank pickBans { isPick heroId bannedHeroId isRadiant order wasBannedSuccessfully } players { steamAccountId heroId isRadiant imp stats { impPerMinute deathEvents { time positionX positionY attacker goldLost timeDead } } } } }`,
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch((error) => {
      recordCall("stratz", started, {
        label: "getStratzMatch",
        ok: false,
        error: error instanceof Error ? error.name : "failed",
      });
      throw error;
    });
    recordCall("stratz", started, {
      label: "getStratzMatch",
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
    const pickBans = match.pickBans ?? [];
    return {
      parsed,
      rank: match.rank ?? null,
      picks: pickBans
        .filter((x) => x.isPick && x.heroId && x.order != null && x.isRadiant != null)
        .map((x) => ({ heroId: x.heroId!, radiant: x.isRadiant!, order: x.order! }))
        .sort((a, b) => a.order - b.order),
      bans: pickBans
        .filter((x) => !x.isPick && x.bannedHeroId && x.wasBannedSuccessfully !== false)
        .map((x) => x.bannedHeroId!),
      players: match.players.map((p) => ({
        steamAccountId: p.steamAccountId,
        heroId: p.heroId,
        isRadiant: p.isRadiant,
        imp: typeof p.imp === "number" ? p.imp : null,
        impm: (p.stats?.impPerMinute ?? []).map((v) => v ?? 0),
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
  });
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

// A player's STRATZ data: refetched in the background after an hour, the older copy served at once
// meanwhile for up to a week (the built-in "hours" profile drops it after a day).
const KEPT = { stale: 300, revalidate: 3600, expire: 7 * 24 * 3600 };

export async function getStratzRanked(accountId: number): Promise<RankedMatch[]> {
  "use cache";
  cacheLife(KEPT);
  return guarded(`ranked:${accountId}`, async () => {
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
      recordCall("stratz", started, {
        label: "getStratzRanked",
        ok: false,
        error: error instanceof Error ? error.name : "failed",
      });
      throw error;
    });
    recordCall("stratz", started, {
      label: "getStratzRanked",
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
  });
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
      label: "requestStratzParse",
      ok: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`,
      headers: response.headers,
    });
    const body = (await response.json()) as { data?: { retryMatchDownload?: boolean } };
    if (body.data?.retryMatchDownload) return "sent";
  } catch (error) {
    recordCall("stratz", started, {
      label: "requestStratzParse",
      ok: false,
      error: error instanceof Error ? error.name : "failed",
    });
  }
  // Let it be tried again right away when the request itself failed.
  reparsed.delete(id);
  return "failed";
}

// How steady other players of a hero are, for the forest chart's background: each account's GPM
// over its newest ranked matches on the hero, as a coefficient of variation (accounts with at
// least MIN_SAMPLE_GAMES). One request (aliases) per hero; kept for days.
const SAMPLE_GAMES = 10;
const MIN_SAMPLE_GAMES = 5;

export async function getHeroCvSample(heroId: number, accounts: number[]): Promise<number[]> {
  "use cache";
  cacheLife("days");
  const token = process.env.STRATZ_API_TOKEN;
  if (!token || !accounts.length) return [];
  const hero = Math.trunc(heroId);
  const query = accounts
    .map((a, i) => {
      const id = Math.trunc(a);
      return `p${i}: player(steamAccountId: ${id}) { matches(request: { heroIds: [${hero}], take: ${SAMPLE_GAMES}, lobbyTypeIds: [7] }) { players(steamAccountId: ${id}) { goldPerMinute } } }`;
    })
    .join(" ");
  const started = Date.now();
  const response = await fetch("https://api.stratz.com/graphql", {
    method: "POST",
    // STRATZ asks API clients to send this exact user agent.
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({ query: `{ ${query} }` }),
    signal: AbortSignal.timeout(30_000),
  }).catch((error) => {
    recordCall("stratz", started, {
      label: "getHeroCvSample",
      ok: false,
      error: error instanceof Error ? error.name : "failed",
    });
    throw error;
  });
  recordCall("stratz", started, {
    label: "getHeroCvSample",
    ok: response.ok,
    error: response.ok ? null : `HTTP ${response.status}`,
    headers: response.headers,
  });
  if (!response.ok) throw new Error(`STRATZ ${response.status}`);
  const body = (await response.json()) as {
    data?: Record<
      string,
      { matches: { players: { goldPerMinute: number | null }[] | null }[] | null } | null
    >;
  };
  const cvs: number[] = [];
  for (const player of Object.values(body.data ?? {})) {
    const gpm = (player?.matches ?? [])
      .map((m) => m.players?.[0]?.goldPerMinute)
      .filter((g): g is number => typeof g === "number" && g > 0);
    if (gpm.length < MIN_SAMPLE_GAMES) continue;
    const mean = gpm.reduce((a, b) => a + b, 0) / gpm.length;
    const sd = Math.sqrt(gpm.reduce((a, g) => a + (g - mean) ** 2, 0) / (gpm.length - 1));
    cvs.push(sd / mean);
  }
  return cvs;
}

// A hero's averages at a rank: STRATZ's statistics over its recent ranked matches, by its four
// brackets (two medals each). Per minute the net worth, last hits and experience (of the matches
// still going at that minute); each item's average first-purchase time and how often it's bought.
export type RankAverages = {
  matches: number;
  wins: number;
  networth: (number | null)[];
  lastHits: (number | null)[];
  xp: (number | null)[];
  items: Record<number, { time: number; rate: number }>;
};
// By position: 0 every position together, 1–5 each one (null: STRATZ has none).
export type RankAverageSet = Record<number, RankAverages | null>;

// STRATZ's brackets by medal (1 Herald … 8 Immortal).
const BRACKETS = [
  "",
  "HERALD_GUARDIAN",
  "HERALD_GUARDIAN",
  "CRUSADER_ARCHON",
  "CRUSADER_ARCHON",
  "LEGEND_ANCIENT",
  "LEGEND_ANCIENT",
  "DIVINE_IMMORTAL",
  "DIVINE_IMMORTAL",
];
const POSITIONS = [0, 1, 2, 3, 4, 5];

type RawTimes = {
  time: number;
  matchCount: number;
  winCount: number;
  networth: number;
  cs: number;
  xp: number;
}[];
type RawItems = { itemId: number; instance: number | null; time: number; matchCount: number }[];

function toAverages(rawTimes: RawTimes | null | undefined, rawItems: RawItems | null | undefined) {
  const times = [...(rawTimes ?? [])].sort((a, b) => a.time - b.time);
  // Minute 0 counts every match (later minutes only those still going).
  const start = times.find((x) => x.time === 0) ?? times[0];
  if (!start?.matchCount) return null;
  const byMinute = (pick: (x: (typeof times)[number]) => number) => {
    const out: (number | null)[] = [];
    for (const x of times) out[x.time] = pick(x);
    return Array.from(out, (v) => v ?? null);
  };
  // Purchases by minute; later copies of an item (instance 2 and on) are not its first purchase.
  const buys = new Map<number, { count: number; minutes: number }>();
  for (const row of rawItems ?? []) {
    if ((row.instance ?? 1) > 1) continue;
    const item = buys.get(row.itemId) ?? { count: 0, minutes: 0 };
    item.count += row.matchCount;
    item.minutes += row.time * row.matchCount;
    buys.set(row.itemId, item);
  }
  const items: RankAverages["items"] = {};
  for (const [id, { count, minutes }] of buys)
    items[id] = {
      time: Math.round((minutes / count) * 60 + 30),
      rate: Math.min(1, count / start.matchCount),
    };
  return {
    matches: start.matchCount,
    wins: start.winCount,
    networth: byMinute((x) => x.networth),
    lastHits: byMinute((x) => x.cs),
    xp: byMinute((x) => x.xp),
    items,
  };
}

// Every position in one request (aliases), so the page can follow its position filter. Kept for a
// day.
export async function getRankAverages(heroId: number, tier: number): Promise<RankAverageSet | null> {
  "use cache";
  cacheLife("days");
  const token = process.env.STRATZ_API_TOKEN;
  const bracket = BRACKETS[Math.trunc(tier)];
  if (!token || !bracket) return null;
  const hero = Math.trunc(heroId);
  const query = POSITIONS.map((p) => {
    const where = `bracketBasicIds: [${bracket}]${p ? `, positionIds: [POSITION_${p}]` : ""}`;
    return `t${p}: stats(heroIds: [${hero}], ${where}, groupByTime: true) { time matchCount winCount networth cs xp } i${p}: itemFullPurchase(heroId: ${hero}, ${where}) { itemId instance time matchCount }`;
  }).join(" ");
  const started = Date.now();
  const response = await fetch("https://api.stratz.com/graphql", {
    method: "POST",
    // STRATZ asks API clients to send this exact user agent.
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({ query: `{ heroStats { ${query} } }` }),
    signal: AbortSignal.timeout(30_000),
  }).catch((error) => {
    recordCall("stratz", started, {
      label: "getRankAverages",
      ok: false,
      error: error instanceof Error ? error.name : "failed",
    });
    throw error;
  });
  recordCall("stratz", started, {
    label: "getRankAverages",
    ok: response.ok,
    error: response.ok ? null : `HTTP ${response.status}`,
    headers: response.headers,
  });
  if (!response.ok) throw new Error(`STRATZ ${response.status}`);
  const body = (await response.json()) as {
    errors?: unknown[];
    data?: { heroStats?: Record<string, RawTimes | RawItems | null> };
  };
  if (body.errors?.length) throw new Error("STRATZ query failed");
  const stats = body.data?.heroStats ?? {};
  const set: RankAverageSet = {};
  for (const p of POSITIONS) set[p] = toAverages(stats[`t${p}`] as RawTimes, stats[`i${p}`] as RawItems);
  return set[0] ? set : null;
}

// The people played with and against most, over the newest PEER_MATCHES matches: the stand-in for
// OpenDota's peers when its player statistics are down (they sometimes time out while the rest of
// OpenDota answers). In OpenDota's shape.
const PEER_MATCHES = 2000;
const PEERS = 50;

type RawPeer = {
  steamAccountId: number;
  matchCount: number;
  winCount: number;
  lastMatchDateTime: number | null;
  steamAccount: { name: string | null; avatar: string | null } | null;
};

export async function getStratzPeers(accountId: number): Promise<Peer[]> {
  return guarded(`peers:${accountId}`, async () => {
    const token = process.env.STRATZ_API_TOKEN;
    if (!token) throw new Error("STRATZ_API_TOKEN is not set");
    const id = Math.trunc(accountId);
    const peers = (sort: "WITH" | "AGAINST") =>
      `${sort.toLowerCase()}: peers(request: { playerTeammateSort: ${sort}, matchGroupOrderBy: MATCH_COUNT, take: ${PEER_MATCHES} }, take: ${PEERS}) { steamAccountId matchCount winCount lastMatchDateTime steamAccount { name avatar } }`;
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
        query: `{ stratz { page { player(steamAccountId: ${id}) { ${peers("WITH")} ${peers("AGAINST")} } } } }`,
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch((error) => {
      recordCall("stratz", started, {
        label: "getStratzPeers",
        ok: false,
        error: error instanceof Error ? error.name : "failed",
      });
      throw error;
    });
    recordCall("stratz", started, {
      label: "getStratzPeers",
      ok: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`,
      headers: response.headers,
    });
    if (!response.ok) throw new Error(`STRATZ ${response.status}`);
    const body = (await response.json()) as {
      errors?: unknown[];
      data?: {
        stratz?: { page?: { player?: { with: RawPeer[] | null; against: RawPeer[] | null } | null } };
      };
    };
    if (body.errors?.length) throw new Error("STRATZ query failed");
    const player = body.data?.stratz?.page?.player;
    const out = new Map<number, Peer>();
    const add = (list: RawPeer[] | null | undefined, side: "with" | "against") => {
      for (const p of list ?? []) {
        if (!p.steamAccountId || p.steamAccountId === id) continue;
        const peer = out.get(p.steamAccountId) ?? {
          account_id: p.steamAccountId,
          personaname: p.steamAccount?.name ?? null,
          avatarfull: p.steamAccount?.avatar ?? null,
          last_played: 0,
          with_games: 0,
          with_win: 0,
          against_games: 0,
          against_win: 0,
        };
        peer[`${side}_games`] = p.matchCount;
        peer[`${side}_win`] = p.winCount;
        peer.last_played = Math.max(peer.last_played, p.lastMatchDateTime ?? 0);
        out.set(p.steamAccountId, peer);
      }
    };
    add(player?.with, "with");
    add(player?.against, "against");
    return [...out.values()];
  });
}

// A player's name, avatar and rank tier from STRATZ: the stand-in for OpenDota's profile when it's
// down. Kept for hours.
export async function getStratzProfile(
  accountId: number,
): Promise<{ name: string | null; avatar: string | null; tier: number | null } | null> {
  "use cache";
  return guarded(`profile:${accountId}`, async () => {
    cacheLife(KEPT);
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
        query: `{ player(steamAccountId: ${Math.trunc(accountId)}) { steamAccount { name avatar seasonRank } } }`,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch((error) => {
      recordCall("stratz", started, {
        label: "getStratzProfile",
        ok: false,
        error: error instanceof Error ? error.name : "failed",
      });
      throw error;
    });
    recordCall("stratz", started, {
      label: "getStratzProfile",
      ok: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`,
      headers: response.headers,
    });
    if (!response.ok) throw new Error(`STRATZ ${response.status}`);
    const body = (await response.json()) as {
      data?: {
        player?: {
          steamAccount: { name: string | null; avatar: string | null; seasonRank: number | null } | null;
        } | null;
      };
    };
    const account = body.data?.player?.steamAccount;
    return account ? { name: account.name, avatar: account.avatar, tier: account.seasonRank } : null;
  });
}

// A player's whole ranked history as STRATZ has it, lean (the 绝活 page): when, hero, won, IMP and
// position of each match, newest first. HISTORY_PAGES pages of 100 per request (aliases), until a
// page comes back short. Kept a week, refetched hourly (KEPT).
export type HistoryMatch = {
  start: number;
  hero: number;
  won: boolean;
  imp: number | null;
  pos: number | null;
};

const HISTORY_PAGE = 100;
const HISTORY_PAGES = 20;
const HISTORY_REQUESTS = 5;

type RawHistory = {
  errors?: unknown[];
  data?: Record<
    string,
    {
      matches:
        | {
            startDateTime: number | null;
            players:
              { heroId: number; isVictory: boolean; imp: number | null; position: string | null }[] | null;
          }[]
        | null;
    } | null
  >;
};

export async function getRankedHistory(accountId: number): Promise<HistoryMatch[]> {
  "use cache";
  cacheLife(KEPT);
  return guarded(`history:${accountId}`, async () => {
    const token = process.env.STRATZ_API_TOKEN;
    if (!token) throw new Error("STRATZ_API_TOKEN is not set");
    const id = Math.trunc(accountId);
    const out: HistoryMatch[] = [];
    for (let request = 0; request < HISTORY_REQUESTS; request++) {
      const first = request * HISTORY_PAGES;
      const query = Array.from(
        { length: HISTORY_PAGES },
        (_, i) =>
          `p${i}: player(steamAccountId: ${id}) { matches(request: { take: ${HISTORY_PAGE}, skip: ${(first + i) * HISTORY_PAGE}, lobbyTypeIds: [7] }) { startDateTime players(steamAccountId: ${id}) { heroId isVictory imp position } } }`,
      ).join(" ");
      const started = Date.now();
      const response = await fetch("https://api.stratz.com/graphql", {
        method: "POST",
        // STRATZ asks API clients to send this exact user agent.
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "STRATZ_API",
        },
        body: JSON.stringify({ query: `{ ${query} }` }),
        signal: AbortSignal.timeout(45_000),
      }).catch((error) => {
        recordCall("stratz", started, {
          label: "getRankedHistory",
          ok: false,
          error: error instanceof Error ? error.name : "failed",
        });
        throw error;
      });
      recordCall("stratz", started, {
        label: "getRankedHistory",
        ok: response.ok,
        error: response.ok ? null : `HTTP ${response.status}`,
        headers: response.headers,
      });
      if (!response.ok) throw new Error(`STRATZ ${response.status}`);
      const body = (await response.json()) as RawHistory;
      if (body.errors?.length) throw new Error("STRATZ query failed");
      let short = false;
      for (let i = 0; i < HISTORY_PAGES; i++) {
        const matches = body.data?.[`p${i}`]?.matches ?? [];
        for (const m of matches) {
          const p = m.players?.[0];
          if (!p || !m.startDateTime) continue;
          const position = p.position?.startsWith("POSITION_") ? Number(p.position.slice(9)) : null;
          out.push({
            start: m.startDateTime,
            hero: p.heroId,
            won: p.isVictory,
            imp: typeof p.imp === "number" ? p.imp : null,
            pos: position && position >= 1 && position <= 5 ? position : null,
          });
        }
        if (matches.length < HISTORY_PAGE) {
          short = true;
          break;
        }
      }
      if (short) break;
    }
    return out;
  });
}

// A player's newest captains mode matches in practice lobbies (up to 500, one request): where pros
// play their scrims and tournament games, which ranked history leaves out. Kept like the ranked one.
export async function getPracticeHistory(accountId: number): Promise<HistoryMatch[]> {
  "use cache";
  cacheLife(KEPT);
  return guarded(`practice:${accountId}`, async () => {
    const id = Math.trunc(accountId);
    const query = Array.from(
      { length: 5 },
      (_, i) =>
        `p${i}: player(steamAccountId: ${id}) { matches(request: { take: ${HISTORY_PAGE}, skip: ${i * HISTORY_PAGE}, lobbyTypeIds: [1], gameModeIds: [2] }) { startDateTime players(steamAccountId: ${id}) { heroId isVictory imp position } } }`,
    ).join(" ");
    const data = await stratzQuery<NonNullable<RawHistory["data"]>>(`{ ${query} }`, 45_000);
    const out: HistoryMatch[] = [];
    for (let i = 0; i < 5; i++)
      for (const m of data[`p${i}`]?.matches ?? []) {
        const p = m.players?.[0];
        if (!p || !m.startDateTime) continue;
        const position = p.position?.startsWith("POSITION_") ? Number(p.position.slice(9)) : null;
        out.push({
          start: m.startDateTime,
          hero: p.heroId,
          won: p.isVictory,
          imp: typeof p.imp === "number" ? p.imp : null,
          pos: position && position >= 1 && position <= 5 ? position : null,
        });
      }
    return out;
  });
}

// A hero's leaderboard at a rank (STRATZ's, as on its hero pages): the players with the best
// average IMP over their recent matches of the hero, with wins and losses. Kept for hours.
export type LeaderboardRow = {
  account: number;
  name: string | null;
  avatar: string | null;
  tier: number | null;
  pos: number | null;
  wins: number;
  losses: number;
  imp: number;
  change: number | null;
};

const RANK_BRACKETS = [
  "",
  "HERALD",
  "GUARDIAN",
  "CRUSADER",
  "ARCHON",
  "LEGEND",
  "ANCIENT",
  "DIVINE",
  "IMMORTAL",
];
const LEADERBOARD_TAKE = 50;

export async function getHeroLeaderboard(heroId: number, tier: number): Promise<LeaderboardRow[]> {
  "use cache";
  cacheLife("hours");
  const token = process.env.STRATZ_API_TOKEN;
  const bracket = RANK_BRACKETS[Math.trunc(tier)];
  if (!token || !bracket) return [];
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
      query: `{ leaderboard { hero(request: { heroIds: [${Math.trunc(heroId)}], bracketIds: [${bracket}], take: ${LEADERBOARD_TAKE} }) { steamAccountId impAverage wins losses position changeInRanking steamAccount { name avatar seasonRank } } } }`,
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((error) => {
    recordCall("stratz", started, {
      label: "getHeroLeaderboard",
      ok: false,
      error: error instanceof Error ? error.name : "failed",
    });
    throw error;
  });
  recordCall("stratz", started, {
    label: "getHeroLeaderboard",
    ok: response.ok,
    error: response.ok ? null : `HTTP ${response.status}`,
    headers: response.headers,
  });
  if (!response.ok) throw new Error(`STRATZ ${response.status}`);
  const body = (await response.json()) as {
    errors?: unknown[];
    data?: {
      leaderboard?: {
        hero:
          | {
              steamAccountId: number;
              impAverage: number | null;
              wins: number | null;
              losses: number | null;
              position: string | null;
              changeInRanking: number | null;
              steamAccount: { name: string | null; avatar: string | null; seasonRank: number | null } | null;
            }[]
          | null;
      };
    };
  };
  if (body.errors?.length) throw new Error("STRATZ query failed");
  return (body.data?.leaderboard?.hero ?? []).map((p) => ({
    account: p.steamAccountId,
    name: p.steamAccount?.name ?? null,
    avatar: p.steamAccount?.avatar ?? null,
    tier: p.steamAccount?.seasonRank ?? null,
    pos: p.position?.startsWith("POSITION_") ? Number(p.position.slice(9)) : null,
    wins: p.wins ?? 0,
    losses: p.losses ?? 0,
    imp: p.impAverage ?? 0,
    change: p.changeInRanking,
  }));
}

// A hero's Dota Plus level leaderboard at a rank (30 is Grandmaster). STRATZ's board is worldwide
// with no rank filter and 100 rows a request, so a pool of LEVEL_POOL_PAGES pages (the highest
// levels, aliases) is read and split by each player's rank; each rank's top LEVEL_TAKE then get
// their ranked matches, win rate and average IMP on the hero (a second request). Levels come from
// playing the hero a lot, not from playing it well; the IMP and win rate show which. Kept for hours.
export type LevelRow = {
  account: number;
  name: string | null;
  avatar: string | null;
  tier: number | null;
  level: number;
  reached: number | null;
  matches: number | null;
  wins: number | null;
  imp: number | null;
};

const LEVEL_TAKE = 50;
const LEVEL_POOL_PAGES = 30;

// The first field of a GraphQL query (an alias stripped): what a generic query asked for.
function queryLabel(query: string) {
  return /\{\s*(?:\w+:\s*)?(\w+)/.exec(query)?.[1] ?? "?";
}

export async function stratzQuery<T>(query: string, timeout: number): Promise<T> {
  const token = process.env.STRATZ_API_TOKEN;
  if (!token) throw new Error("STRATZ_API_TOKEN is not set");
  const started = Date.now();
  const response = await fetch("https://api.stratz.com/graphql", {
    method: "POST",
    // STRATZ asks API clients to send this exact user agent.
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(timeout),
  }).catch((error) => {
    recordCall("stratz", started, {
      label: `query:${queryLabel(query)}`,
      ok: false,
      error: error instanceof Error ? error.name : "failed",
    });
    throw error;
  });
  recordCall("stratz", started, {
    label: `query:${queryLabel(query)}`,
    ok: response.ok,
    error: response.ok ? null : `HTTP ${response.status}`,
    headers: response.headers,
  });
  if (!response.ok) throw new Error(`STRATZ ${response.status}`);
  const body = (await response.json()) as { errors?: unknown[]; data?: T };
  if (body.errors?.length || !body.data) throw new Error("STRATZ query failed");
  return body.data;
}

type LevelPoolRow = Omit<LevelRow, "matches" | "wins" | "imp">;

// The pool: one row per player (a player is listed once per level reached), their highest level.
async function getHeroLevelPool(heroId: number): Promise<LevelPoolRow[]> {
  "use cache";
  cacheLife("hours");
  const hero = Math.trunc(heroId);
  type Page = {
    players:
      | {
          steamAccountId: number;
          level: number;
          createdDateTime: number | null;
          steamAccount: { name: string | null; avatar: string | null; seasonRank: number | null } | null;
        }[]
      | null;
  };
  const data = await stratzQuery<{ leaderboard?: Record<string, Page | null> }>(
    `{ leaderboard { ${Array.from(
      { length: LEVEL_POOL_PAGES },
      (_, i) =>
        `p${i}: dotaPlus(heroId: ${hero}, take: 100, skip: ${i * 100}, orderBy: LEVEL) { players { steamAccountId level createdDateTime steamAccount { name avatar seasonRank } } }`,
    ).join(" ")} } }`,
    45_000,
  );
  const best = new Map<number, LevelPoolRow>();
  for (let i = 0; i < LEVEL_POOL_PAGES; i++)
    for (const p of data.leaderboard?.[`p${i}`]?.players ?? []) {
      const known = best.get(p.steamAccountId);
      if (known && known.level >= p.level) continue;
      best.set(p.steamAccountId, {
        account: p.steamAccountId,
        name: p.steamAccount?.name ?? null,
        avatar: p.steamAccount?.avatar ?? null,
        tier: p.steamAccount?.seasonRank ?? null,
        level: p.level,
        reached: p.createdDateTime,
      });
    }
  return [...best.values()];
}

export async function getHeroLevelBoard(heroId: number, tier: number): Promise<LevelRow[]> {
  "use cache";
  cacheLife("hours");
  const hero = Math.trunc(heroId);
  const medal = Math.trunc(tier);
  const rows: LevelRow[] = (await getHeroLevelPool(hero))
    .filter((r) => r.tier != null && Math.floor(r.tier / 10) === medal)
    .sort((a, b) => b.level - a.level)
    .slice(0, LEVEL_TAKE)
    .map((r) => ({ ...r, matches: null, wins: null, imp: null }));
  if (!rows.length) return rows;
  const perf = await stratzQuery<
    Record<
      string,
      { heroPerformance: { matchCount: number; winCount: number; imp: number | null } | null } | null
    >
  >(
    `{ ${rows
      .map(
        (r, i) =>
          `p${i}: player(steamAccountId: ${Math.trunc(r.account)}) { heroPerformance(heroId: ${hero}, request: { lobbyTypeIds: [7], take: 10000 }) { matchCount winCount imp } }`,
      )
      .join(" ")} }`,
    45_000,
  ).catch(() => null);
  rows.forEach((r, i) => {
    const p = perf?.[`p${i}`]?.heroPerformance;
    if (!p) return;
    r.matches = p.matchCount;
    r.wins = p.winCount;
    r.imp = p.imp;
  });
  return rows;
}

// A player's Dota Plus hero levels (hero id → level; heroes never levelled are missing). STRATZ lists
// each level reached; the highest is the level now. Kept for hours.
export async function getHeroLevels(accountId: number): Promise<Record<number, number>> {
  "use cache";
  cacheLife(KEPT);
  return guarded(`levels:${accountId}`, async () => {
    const data = await stratzQuery<{
      player?: { dotaPlus: { heroId: number; level: number }[] | null } | null;
    }>(`{ player(steamAccountId: ${Math.trunc(accountId)}) { dotaPlus { heroId level } } }`, 20_000);
    const out: Record<number, number> = {};
    for (const x of data.player?.dotaPlus ?? []) out[x.heroId] = Math.max(out[x.heroId] ?? 0, x.level);
    return out;
  });
}

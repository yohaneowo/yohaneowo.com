import "server-only";
import { cacheLife } from "next/cache";
import { getJson } from "./data";
import { stratzQuery } from "./stratz";

// 局内科研's references outside the match: the hero's averages at the match's rank and position
// (STRATZ heroStats: curves to 75 minutes, item timings with their win rates, lane results against
// and with each hero, talents, skill builds, starting items, boots, matchups), OpenDota's hero
// benchmarks and win rate by game length, the player's own history on the hero (OpenDota totals,
// STRATZ parsed games) and against the lane opponents, and pro games on the hero in the match's
// patch (OpenDota explorer). Each is cached on its own; any that fails is left out.

const OPENDOTA = "https://api.opendota.com/api";

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
export const bracketOf = (medal: number) =>
  BRACKETS[Math.min(8, Math.max(1, Math.trunc(medal)))] || "DIVINE_IMMORTAL";

export type BaselineKey =
  | "networth"
  | "xp"
  | "cs"
  | "dn"
  | "heroDamage"
  | "towerDamage"
  | "level"
  | "kills"
  | "deaths"
  | "assists"
  | "campsStacked"
  | "stunDuration"
  | "apm"
  | "casts"
  | "abilityCasts"
  | "neutrals"
  | "ancients"
  | "attackDamage"
  | "castDamage"
  | "damageReceived"
  | "physicalDamageReceived"
  | "magicalDamageReceived"
  | "pureDamageReceived"
  | "goldFed"
  | "xpFed"
  | "goldLost"
  | "teamKills"
  | "runeBounty"
  | "runePower"
  | "healingItemSelf"
  | "healingAllies"
  | "invisibleCount";

const BASELINE_KEYS: BaselineKey[] = [
  "networth",
  "xp",
  "cs",
  "dn",
  "heroDamage",
  "towerDamage",
  "level",
  "kills",
  "deaths",
  "assists",
  "campsStacked",
  "stunDuration",
  "apm",
  "casts",
  "abilityCasts",
  "neutrals",
  "ancients",
  "attackDamage",
  "castDamage",
  "damageReceived",
  "physicalDamageReceived",
  "magicalDamageReceived",
  "pureDamageReceived",
  "goldFed",
  "xpFed",
  "goldLost",
  "teamKills",
  "runeBounty",
  "runePower",
  "healingItemSelf",
  "healingAllies",
  "invisibleCount",
];

export type LaneRecord = {
  n: number;
  win: number;
  draw: number;
  loss: number;
  stompWin: number;
  stompLoss: number;
};

export type LabBaseline = {
  bracket: string;
  position: number | null;
  // The week the numbers come from (the match's own when STRATZ still has it), null for 'recent'.
  week: number | null;
  matches: number;
  winRate: number | null;
  // Per minute (index = minute, 0–75), cumulative like the player's curves. Each minute averages
  // only the games still going then, so late minutes lean on long games.
  minutes: Record<BaselineKey, (number | null)[]>;
  // Games still going at each minute.
  counts: number[];
  // Item key → average first purchase (seconds), how often it's bought, the win rate when bought,
  // and the win rate by purchase minute.
  items: Record<
    string,
    { time: number; rate: number; winRate: number | null; curve: { m: number; n: number; w: number }[] }
  >;
  // Lane results against (vs) and with (with) each hero, by hero id.
  laneVs: Record<string, LaneRecord>;
  laneWith: Record<string, LaneRecord>;
  talents: { key: string; n: number; w: number; time: number }[];
  // Ability key → how often it's maxed at each hero level.
  abilityMax: Record<string, { level: number; n: number; w: number }[]>;
  starting: { key: string; n: number; w: number; given: boolean }[];
  boots: { key: string; n: number; w: number; time: number; activations: number }[];
  // Hero id → games and wins of the hero against (vs) / with (with) it, and STRATZ's synergy.
  matchUp: {
    vs: Record<string, { n: number; w: number; synergy: number }>;
    with: Record<string, { n: number; w: number; synergy: number }>;
  };
};

type StatRow = { time: number; matchCount: number; winCount: number } & Record<BaselineKey, number | null>;
type ItemRow = {
  itemId: number;
  instance: number | null;
  time: number;
  matchCount: number;
  winCount: number;
};
type LaneRow = {
  heroId2: number;
  matchCount: number;
  winCount: number;
  drawCount: number;
  lossCount: number;
  stompWinCount: number;
  stompLossCount: number;
};
type DryadRow = { heroId2: number; matchCount: number; winCount: number; synergy: number | null };

const laneRecords = (rows: LaneRow[] | null | undefined) =>
  Object.fromEntries(
    (rows ?? []).map((r) => [
      String(r.heroId2),
      {
        n: r.matchCount,
        win: r.winCount,
        draw: r.drawCount,
        loss: r.lossCount,
        stompWin: r.stompWinCount,
        stompLoss: r.stompLossCount,
      },
    ]),
  );

// The hero's averages at a rank and position (and week, when given). Kept for a day.
export async function getLabBaseline(
  heroId: number,
  position: number | null,
  medal: number,
  week: number | null,
  itemById: Record<number, string>,
  abilityById: Record<number, string>,
): Promise<LabBaseline | null> {
  "use cache";
  cacheLife("days");
  const hero = Math.trunc(heroId);
  const bracket = bracketOf(medal);
  const at = `${week ? `week: ${Math.trunc(week)}, ` : ""}bracketBasicIds: [${bracket}]`;
  const where = `${at}${position ? `, positionIds: [POSITION_${position}]` : ""}`;
  const lane = (isWith: boolean) =>
    `laneOutcome(heroId: ${hero}, isWith: ${isWith}, ${where}) { heroId2 matchCount winCount drawCount lossCount stompWinCount stompLossCount }`;
  const data = await stratzQuery<{
    heroStats: {
      s: StatRow[] | null;
      i: ItemRow[] | null;
      lv: LaneRow[] | null;
      lw: LaneRow[] | null;
      t: { abilityId: number; matchCount: number; winCount: number; timeAverage: number | null }[] | null;
      am: { abilityId: number; level: number; matchCount: number; winCount: number }[] | null;
      st: { itemId: number; wasGiven: boolean | null; matchCount: number; winCount: number }[] | null;
      bo:
        | {
            itemId: number;
            timeAverage: number | null;
            matchCount: number;
            winCount: number;
            activationsAverage: number | null;
          }[]
        | null;
      mu: { vs: DryadRow[] | null; with: DryadRow[] | null }[] | null;
    } | null;
  }>(
    `{ heroStats {
      s: stats(heroIds: [${hero}], ${where}, groupByTime: true, minTime: 0, maxTime: 75) { time matchCount winCount ${BASELINE_KEYS.join(" ")} }
      i: itemFullPurchase(heroId: ${hero}, ${where}, minTime: 0, maxTime: 75) { itemId instance time matchCount winCount }
      lv: ${lane(false)}
      lw: ${lane(true)}
      t: talent(heroId: ${hero}, ${where}) { abilityId matchCount winCount timeAverage }
      am: abilityMaxLevel(heroId: ${hero}, ${where}) { abilityId level matchCount winCount }
      st: itemStartingPurchase(heroId: ${hero}, ${where}) { itemId wasGiven matchCount winCount }
      bo: itemBootPurchase(heroId: ${hero}, ${where}) { itemId timeAverage matchCount winCount activationsAverage }
      mu: matchUp(heroId: ${hero}, ${at}, take: 200) { vs { heroId2 matchCount winCount synergy } with { heroId2 matchCount winCount synergy } }
    } }`,
    30_000,
  ).catch(() => null);
  const hs = data?.heroStats;
  const rows = [...(hs?.s ?? [])].sort((a, b) => a.time - b.time);
  const start = rows.find((r) => r.time === 0) ?? rows[0];
  if (!start?.matchCount) return null;
  // STRATZ's row t is the state at (t − 1):00 — row 1 is the start (600 net worth, level 1), row 0
  // comes before the heroes spawn, the bounty runes taken at 0:00 first show in row 2 — so row t
  // goes to minute t − 1.
  const minutes = Object.fromEntries(
    BASELINE_KEYS.map((k) => {
      const out: (number | null)[] = [];
      for (const r of rows) if (r.time >= 1) out[r.time - 1] = r[k];
      return [k, Array.from(out, (v) => v ?? null)];
    }),
  ) as Record<BaselineKey, (number | null)[]>;
  const counts: number[] = [];
  for (const r of rows) if (r.time >= 1) counts[r.time - 1] = r.matchCount;

  // First purchases only (later copies are instance 2 and on).
  const buys = new Map<
    string,
    { n: number; w: number; minutes: number; curve: Map<number, { n: number; w: number }> }
  >();
  for (const row of hs?.i ?? []) {
    if ((row.instance ?? 0) > 1) continue;
    const key = itemById[row.itemId];
    if (!key) continue;
    const it = buys.get(key) ?? { n: 0, w: 0, minutes: 0, curve: new Map() };
    it.n += row.matchCount;
    it.w += row.winCount;
    it.minutes += row.time * row.matchCount;
    const c = it.curve.get(row.time) ?? { n: 0, w: 0 };
    it.curve.set(row.time, { n: c.n + row.matchCount, w: c.w + row.winCount });
    buys.set(key, it);
  }
  const items: LabBaseline["items"] = {};
  for (const [key, it] of buys)
    items[key] = {
      time: Math.round((it.minutes / it.n) * 60 + 30),
      rate: Math.min(1, it.n / start.matchCount),
      winRate: it.n ? it.w / it.n : null,
      curve: [...it.curve.entries()].map(([m, c]) => ({ m, n: c.n, w: c.w })).sort((a, b) => a.m - b.m),
    };

  const abilityMax: LabBaseline["abilityMax"] = {};
  for (const r of hs?.am ?? []) {
    const key = abilityById[r.abilityId];
    if (!key) continue;
    (abilityMax[key] ??= []).push({ level: r.level, n: r.matchCount, w: r.winCount });
  }
  for (const list of Object.values(abilityMax)) list.sort((a, b) => b.n - a.n);
  const dryad = (list: DryadRow[] | null | undefined) =>
    Object.fromEntries(
      (list ?? []).map((r) => [
        String(r.heroId2),
        { n: r.matchCount, w: r.winCount, synergy: r.synergy ?? 0 },
      ]),
    );
  const mu = hs?.mu?.[0];
  return {
    bracket,
    position,
    week,
    matches: start.matchCount,
    winRate: start.matchCount ? start.winCount / start.matchCount : null,
    minutes,
    counts: Array.from(counts, (v) => v ?? 0),
    items,
    laneVs: laneRecords(hs?.lv),
    laneWith: laneRecords(hs?.lw),
    talents: (hs?.t ?? [])
      .map((r) => ({
        key: abilityById[r.abilityId] ?? "",
        n: r.matchCount,
        w: r.winCount,
        time: Math.round(r.timeAverage ?? 0),
      }))
      .filter((x) => x.key && !x.key.startsWith("special_bonus_attributes")),
    abilityMax,
    starting: (hs?.st ?? [])
      .map((r) => ({ key: itemById[r.itemId] ?? "", n: r.matchCount, w: r.winCount, given: !!r.wasGiven }))
      .filter((x) => x.key)
      .sort((a, b) => b.n - a.n),
    boots: (hs?.bo ?? [])
      .map((r) => ({
        key: itemById[r.itemId] ?? "",
        n: r.matchCount,
        w: r.winCount,
        time: Math.round(r.timeAverage ?? 0),
        activations: r.activationsAverage ?? 0,
      }))
      .filter((x) => x.key)
      .sort((a, b) => b.n - a.n),
    matchUp: { vs: dryad(mu?.vs), with: dryad(mu?.with) },
  };
}

// ── OpenDota's hero references ──────────────────────────────────────────────────────────────

export type LabOdHero = {
  // Metric → value at each percentile (0.1 … 0.99).
  benchmarks: Record<string, { p: number; v: number }[]>;
  // Win rate by game length (seconds bin, games, wins), all-time.
  durations: { t: number; n: number; w: number }[];
  pro: { pick: number; win: number; ban: number } | null;
  // Picks and wins in the match's bracket (1–8) across public games.
  pub: { pick: number; win: number } | null;
};

export async function getOdHero(heroId: number, medal: number): Promise<LabOdHero> {
  "use cache";
  cacheLife("days");
  const hero = Math.trunc(heroId);
  type Bench = { result: Record<string, { percentile: number; value: number }[]> };
  const [bench, durations, stats] = await Promise.all([
    getJson<Bench>(`${OPENDOTA}/benchmarks?hero_id=${hero}`).catch(() => null),
    getJson<{ duration_bin: number; games_played: number; wins: number }[]>(
      `${OPENDOTA}/heroes/${hero}/durations`,
    ).catch(() => []),
    getJson<Record<string, number | string | null>[]>(`${OPENDOTA}/heroStats`).catch(() => []),
  ]);
  const row = stats.find((s) => s.id === hero);
  const num = (k: string) => (row && typeof row[k] === "number" ? (row[k] as number) : null);
  const b = Math.min(8, Math.max(1, Math.trunc(medal)));
  return {
    benchmarks: Object.fromEntries(
      Object.entries(bench?.result ?? {}).map(([k, list]) => [
        k,
        list.map((x) => ({ p: x.percentile, v: x.value })),
      ]),
    ),
    durations: durations
      .map((d) => ({ t: d.duration_bin, n: d.games_played, w: d.wins }))
      .filter((d) => d.n > 0)
      .sort((a, b) => a.t - b.t),
    pro: row ? { pick: num("pro_pick") ?? 0, win: num("pro_win") ?? 0, ban: num("pro_ban") ?? 0 } : null,
    pub: num(`${b}_pick`) != null ? { pick: num(`${b}_pick`) ?? 0, win: num(`${b}_win`) ?? 0 } : null,
  };
}

// ── The player's own history ─────────────────────────────────────────────────────────────────

// A metric's values sorted ascending, with its mean and spread, for percentiles and z-scores.
export type Dist = { n: number; sorted: number[]; mean: number; sd: number };

const dist = (values: (number | null | undefined)[]): Dist | null => {
  const v = values
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    .sort((a, b) => a - b);
  if (!v.length) return null;
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, v.length - 1));
  return { n: v.length, sorted: v, mean, sd };
};

export type LabPersonal = {
  // OpenDota: the latest games on the hero (this match left out).
  games: number;
  wins: number;
  laneRoles: Record<string, number>;
  od: Record<
    | "gpm"
    | "xpm"
    | "lh"
    | "dn"
    | "kills"
    | "deaths"
    | "assists"
    | "heroDamage"
    | "towerDamage"
    | "duration"
    | "lhpm",
    Dist | null
  >;
  // STRATZ parsed games: net worth and last hits at 10, first purchases of key items (seconds).
  parsed: { n: number; nw10: Dist | null; lh10: Dist | null; items: Record<string, Dist> };
};

export async function getPersonal(
  accountId: number,
  heroId: number,
  excludeMatch: number,
): Promise<LabPersonal | null> {
  "use cache";
  cacheLife("hours");
  const id = Math.trunc(accountId);
  const hero = Math.trunc(heroId);
  const fields = [
    "gold_per_min",
    "xp_per_min",
    "last_hits",
    "denies",
    "kills",
    "deaths",
    "assists",
    "hero_damage",
    "tower_damage",
    "duration",
    "radiant_win",
    "player_slot",
    "lane_role",
  ];
  type OdRow = Record<string, number | boolean | null> & { match_id: number };
  type SzMatch = {
    id: number;
    durationSeconds: number;
    players: {
      stats: {
        networthPerMinute: number[] | null;
        lastHitsPerMinute: number[] | null;
        itemPurchases: { time: number; itemId: number }[] | null;
      } | null;
    }[];
  };
  const [rows, heroesRow, counts, parsed] = await Promise.all([
    getJson<OdRow[]>(
      `${OPENDOTA}/players/${id}/matches?hero_id=${hero}&limit=100${fields.map((f) => `&project=${f}`).join("")}`,
    ).catch(() => [] as OdRow[]),
    getJson<{ hero_id: number; games: number; win: number }[]>(
      `${OPENDOTA}/players/${id}/heroes?hero_id=${hero}`,
    ).catch(() => []),
    getJson<{ lane_role?: Record<string, { games: number }> }>(
      `${OPENDOTA}/players/${id}/counts?hero_id=${hero}`,
    ).catch(() => null),
    stratzQuery<{ player: { matches: SzMatch[] | null } | null }>(
      `{ player(steamAccountId: ${id}) { matches(request: { heroIds: [${hero}], isParsed: true, take: 30 }) { id durationSeconds players(steamAccountId: ${id}) { stats { networthPerMinute lastHitsPerMinute itemPurchases { time itemId } } } } } }`,
      30_000,
    ).catch(() => null),
  ]);
  const others = rows.filter((r) => r.match_id !== excludeMatch);
  const n = (r: OdRow, k: string) => (typeof r[k] === "number" ? (r[k] as number) : null);
  const h = heroesRow.find((x) => x.hero_id === hero);
  const sz = (parsed?.player?.matches ?? []).filter((m) => m.id !== excludeMatch);
  const nw10 = sz.map((m) => m.players[0]?.stats?.networthPerMinute?.[10] ?? null);
  const lh10 = sz.map((m) => {
    const lh = m.players[0]?.stats?.lastHitsPerMinute;
    return lh && lh.length >= 10 ? lh.slice(0, 10).reduce((s, v) => s + v, 0) : null;
  });
  const firstBuys = new Map<number, number[]>();
  for (const m of sz) {
    const seen = new Set<number>();
    for (const b of m.players[0]?.stats?.itemPurchases ?? []) {
      if (seen.has(b.itemId)) continue;
      seen.add(b.itemId);
      firstBuys.set(b.itemId, [...(firstBuys.get(b.itemId) ?? []), b.time]);
    }
  }
  if (!others.length && !sz.length) return null;
  return {
    games: h?.games ?? others.length,
    wins: h?.win ?? 0,
    laneRoles: Object.fromEntries(Object.entries(counts?.lane_role ?? {}).map(([k, v]) => [k, v.games])),
    od: {
      gpm: dist(others.map((r) => n(r, "gold_per_min"))),
      xpm: dist(others.map((r) => n(r, "xp_per_min"))),
      lh: dist(others.map((r) => n(r, "last_hits"))),
      dn: dist(others.map((r) => n(r, "denies"))),
      kills: dist(others.map((r) => n(r, "kills"))),
      deaths: dist(others.map((r) => n(r, "deaths"))),
      assists: dist(others.map((r) => n(r, "assists"))),
      heroDamage: dist(others.map((r) => n(r, "hero_damage"))),
      towerDamage: dist(others.map((r) => n(r, "tower_damage"))),
      duration: dist(others.map((r) => n(r, "duration"))),
      lhpm: dist(
        others.map((r) => {
          const lh = n(r, "last_hits");
          const d = n(r, "duration");
          return lh != null && d ? (lh / d) * 60 : null;
        }),
      ),
    },
    // Item ids are mapped to keys by the caller (they need the catalog).
    parsed: {
      n: sz.length,
      nw10: dist(nw10),
      lh10: dist(lh10),
      items: Object.fromEntries(
        [...firstBuys.entries()].map(([itemId, times]) => [String(itemId), dist(times)!]),
      ),
    },
  };
}

// Where the player usually places wards on the hero, over all their games (OpenDota), as map
// cells with counts.
export type LabWardmap = {
  obs: { x: number; y: number; n: number }[];
  sen: { x: number; y: number; n: number }[];
};

export async function getWardmap(accountId: number, heroId: number): Promise<LabWardmap | null> {
  "use cache";
  cacheLife("hours");
  type Raw = Record<"obs" | "sen", Record<string, Record<string, number>>>;
  const raw = await getJson<Raw>(
    `${OPENDOTA}/players/${Math.trunc(accountId)}/wardmap?hero_id=${Math.trunc(heroId)}`,
  ).catch(() => null);
  if (!raw) return null;
  const cells = (m: Record<string, Record<string, number>> | undefined) =>
    Object.entries(m ?? {}).flatMap(([x, ys]) =>
      Object.entries(ys).map(([y, n]) => ({ x: Number(x), y: Number(y), n })),
    );
  const out = { obs: cells(raw.obs), sen: cells(raw.sen) };
  return out.obs.length || out.sen.length ? out : null;
}

// The player's games on the hero against one enemy hero (OpenDota).
export type LabVsHero = {
  hero: number;
  n: number;
  wins: number;
  gpm: number | null;
  lh: number | null;
  deaths: number | null;
};

export async function getVsHero(
  accountId: number,
  heroId: number,
  againstHero: number,
): Promise<LabVsHero | null> {
  "use cache";
  cacheLife("hours");
  type Row = {
    gold_per_min?: number;
    last_hits?: number;
    deaths?: number;
    radiant_win?: boolean;
    player_slot?: number;
  };
  const rows = await getJson<Row[]>(
    `${OPENDOTA}/players/${Math.trunc(accountId)}/matches?hero_id=${Math.trunc(heroId)}&against_hero_id=${Math.trunc(againstHero)}&limit=50&project=gold_per_min&project=last_hits&project=deaths&project=radiant_win&project=player_slot`,
  ).catch(() => [] as Row[]);
  if (!rows.length) return null;
  const avg = (k: keyof Row) => {
    const v = rows.map((r) => r[k]).filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  return {
    hero: againstHero,
    n: rows.length,
    wins: rows.filter(
      (r) => r.player_slot != null && r.radiant_win != null && r.player_slot < 128 === r.radiant_win,
    ).length,
    gpm: avg("gold_per_min"),
    lh: avg("last_hits"),
    deaths: avg("deaths"),
  };
}

// ── Pro games on the hero in the patch ───────────────────────────────────────────────────────

export type LabPro = {
  patch: string;
  n: number;
  // Metric → distribution over the pro games (this match left out), and medians in wins and losses.
  metrics: Record<string, Dist>;
  winMedian: Record<string, number>;
  lossMedian: Record<string, number>;
  // Item key → first purchase times (seconds) in the games that bought it.
  items: Record<string, Dist>;
  // Neutral item → how many games ended with it (ids here; lab.ts turns them into item keys).
  neutrals: Record<string, number>;
};

const PRO_METRICS = [
  "lh10",
  "dn10",
  "g10",
  "xp10",
  "tp",
  "stacks",
  "stuns",
  "gpm",
  "xpm",
  "kills",
  "deaths",
  "assists",
  "hd",
  "td",
  "lh",
  "duration",
] as const;

export async function getPro(heroId: number, patch: string, excludeMatch: number): Promise<LabPro | null> {
  "use cache";
  cacheLife("days");
  const hero = Math.trunc(heroId);
  if (!/^\d+\.\d+[a-z]?$/.test(patch)) return null;
  const sql = `SELECT pm.match_id, pm.lh_t[11] lh10, pm.dn_t[11] dn10, pm.gold_t[11] g10, pm.xp_t[11] xp10, pm.teamfight_participation tp, pm.camps_stacked stacks, pm.stuns, pm.gold_per_min gpm, pm.xp_per_min xpm, pm.kills, pm.deaths, pm.assists, pm.hero_damage hd, pm.tower_damage td, pm.last_hits lh, pm.item_neutral neutral, m.duration, ((pm.player_slot < 128) = m.radiant_win) win, (SELECT json_object_agg(k, t) FROM (SELECT p->>'key' k, min((p->>'time')::int) t FROM unnest(pm.purchase_log) p GROUP BY 1) x) firsts FROM player_matches pm JOIN matches m USING(match_id) JOIN match_patch mp USING(match_id) WHERE pm.hero_id = ${hero} AND mp.patch = '${patch}' AND pm.lh_t IS NOT NULL ORDER BY m.start_time DESC LIMIT 400`;
  type Row = Record<(typeof PRO_METRICS)[number], number | null> & {
    match_id: number;
    neutral: number | null;
    win: boolean;
    firsts: Record<string, number> | null;
  };
  const res = await getJson<{ rows?: Row[] }>(`${OPENDOTA}/explorer?sql=${encodeURIComponent(sql)}`).catch(
    () => null,
  );
  const rows = (res?.rows ?? []).filter((r) => r.match_id !== excludeMatch);
  if (!rows.length) return null;
  const median = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const metrics: LabPro["metrics"] = {};
  const winMedian: Record<string, number> = {};
  const lossMedian: Record<string, number> = {};
  for (const k of PRO_METRICS) {
    const d = dist(rows.map((r) => r[k]));
    if (d) metrics[k] = d;
    const pick = (won: boolean) =>
      rows
        .filter((r) => r.win === won)
        .map((r) => r[k])
        .filter((x): x is number => typeof x === "number");
    winMedian[k] = median(pick(true));
    lossMedian[k] = median(pick(false));
  }
  const firsts = new Map<string, number[]>();
  for (const r of rows)
    for (const [k, t] of Object.entries(r.firsts ?? {})) firsts.set(k, [...(firsts.get(k) ?? []), t]);
  const neutrals: Record<string, number> = {};
  for (const r of rows) if (r.neutral) neutrals[String(r.neutral)] = (neutrals[String(r.neutral)] ?? 0) + 1;
  return {
    patch,
    n: rows.length,
    metrics,
    winMedian,
    lossMedian,
    items: Object.fromEntries(
      [...firsts.entries()].filter(([, v]) => v.length >= 5).map(([k, v]) => [k, dist(v)!]),
    ),
    neutrals,
  };
}

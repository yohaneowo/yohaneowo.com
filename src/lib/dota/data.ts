import "server-only";
import { cacheLife } from "next/cache";
import { callLabel, recordCall, sourceOf } from "./health";
import { opendotaFetch } from "./opendota-key";
import { getStratzPeers } from "./stratz";

// DotaHub's upstream data. OpenDota (its free tier, about 60 requests a minute; the paid key only
// when that's spent, see opendota-key.ts) gives players and matches; Valve's own Dota 2 data feed gives hero and item names in Chinese and
// English. Everything is cached, so a page view costs few upstream calls.

const OPENDOTA = "https://api.opendota.com/api";
const DATAFEED = "https://www.dota2.com/datafeed";
const CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react";

export class DotaUnavailable extends Error {}

// Every failure (an error status, a timeout, no connection, a broken body) is DotaUnavailable, so
// the pages can show a notice instead of failing: OpenDota sometimes stalls on single endpoints.
// Errors thrown inside a "use cache" function reach the caller as plain Errors, so pages treat any
// error from these calls as "unavailable" rather than checking the class.
export async function getJson<T>(url: string, options: { notFound?: "null" } = {}): Promise<T> {
  const host = new URL(url).host;
  const source = sourceOf(url);
  const started = Date.now();
  let response;
  try {
    response =
      source === "opendota"
        ? await opendotaFetch(url, () => ({ signal: AbortSignal.timeout(12_000) }))
        : await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch (error) {
    const reason = error instanceof Error ? error.name : "fetch failed";
    recordCall(source, started, { ok: false, error: reason, label: callLabel(url) });
    throw new DotaUnavailable(`${reason} ${host}`);
  }
  // A 404 is an answer (no such match), not the source failing.
  const answered = response.ok || response.status === 404;
  recordCall(source, started, {
    ok: answered,
    error: answered ? null : `HTTP ${response.status}`,
    headers: response.headers,
    label: callLabel(url),
  });
  if (response.status === 404 && options.notFound === "null") return null as T;
  if (!response.ok) throw new DotaUnavailable(`${response.status} ${host}`);
  try {
    return (await response.json()) as T;
  } catch {
    throw new DotaUnavailable(`bad response ${host}`);
  }
}

// ── Heroes and items ─────────────────────────────────────────────────────────────────────────

// attr is the primary attribute: 0 strength, 1 agility, 2 intelligence, 3 universal. render is the
// full-body picture (1440px, transparent), only for next/image to scale down. key is the unit name
// replays use (npc_dota_hero_antimage).
export type HeroInfo = {
  key: string;
  zh: string;
  en: string;
  img: string;
  icon: string;
  render: string;
  attr: number;
};
export type ItemInfo = { zh: string; en: string; img: string };

type FeedHero = {
  id: number;
  name: string;
  name_loc: string;
  name_english_loc: string;
  primary_attr: number;
};
type FeedItem = { id: number; name: string; name_loc: string; name_english_loc: string };

export async function getHeroes(): Promise<Record<number, HeroInfo>> {
  "use cache";
  cacheLife("days");
  const feed = await getJson<{ result: { data: { heroes: FeedHero[] } } }>(
    `${DATAFEED}/herolist?language=schinese`,
  );
  return Object.fromEntries(
    feed.result.data.heroes.map((hero) => {
      const slug = hero.name.replace(/^npc_dota_hero_/, "");
      return [
        hero.id,
        {
          key: hero.name,
          zh: hero.name_loc || hero.name_english_loc,
          en: hero.name_english_loc,
          img: `${CDN}/heroes/${slug}.png`,
          icon: `${CDN}/heroes/icons/${slug}.png`,
          render: `${CDN.replace("/images/", "/videos/")}/heroes/renders/${slug}.png`,
          attr: hero.primary_attr,
        },
      ];
    }),
  );
}

// What OpenDota knows of each item beyond its name: price, shop quality and whether it's made from
// a recipe. Used to pick the "key items" whose timings are worth showing.
export type ItemCost = { cost: number; qual: string | null; created: boolean };

export async function getItemCosts(): Promise<Record<number, ItemCost>> {
  "use cache";
  cacheLife("days");
  const items = await getJson<
    Record<string, { id: number; cost: number | null; qual?: string; created?: boolean }>
  >(`${OPENDOTA}/constants/items`);
  return Object.fromEntries(
    Object.entries(items)
      .filter(([name]) => !name.startsWith("recipe_"))
      .map(([, item]) => [
        item.id,
        { cost: item.cost ?? 0, qual: item.qual ?? null, created: Boolean(item.created) },
      ]),
  );
}

// A finished item worth timing: not a consumable or a secret-shop component, and either pricey
// (2000+, e.g. Blink) or assembled from a recipe (1000+, e.g. BKB, Arcane Boots).
export function isKeyItem(item: ItemCost | undefined) {
  if (!item || item.qual === "consumable" || item.qual === "secret_shop") return false;
  return item.cost >= 2000 || (item.created && item.cost >= 1000);
}

export async function getItems(): Promise<Record<number, ItemInfo>> {
  "use cache";
  cacheLife("days");
  const feed = await getJson<{ result: { data: { itemabilities: FeedItem[] } } }>(
    `${DATAFEED}/itemlist?language=schinese`,
  );
  return Object.fromEntries(
    feed.result.data.itemabilities.map((item) => {
      const slug = item.name.replace(/^item_/, "");
      return [
        item.id,
        {
          zh: item.name_loc || item.name_english_loc,
          en: item.name_english_loc,
          img: `${CDN}/items/${slug.startsWith("recipe_") ? "recipe" : slug}.png`,
        },
      ];
    }),
  );
}

// ── Players ──────────────────────────────────────────────────────────────────────────────────

export type DotaPlayer = {
  profile: {
    account_id: number;
    personaname: string | null;
    avatarfull: string | null;
    profileurl: string | null;
    plus: boolean | null;
  } | null;
  rank_tier: number | null;
  leaderboard_rank: number | null;
};

export type PlayerMatch = {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  duration: number;
  game_mode: number;
  lobby_type: number;
  hero_id: number;
  start_time: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min?: number;
  xp_per_min?: number;
  last_hits?: number;
  hero_damage?: number;
  lane_role?: number | null;
  party_size?: number | null;
  average_rank?: number | null;
};

export type PlayerHero = {
  hero_id: number | string;
  games: number;
  win: number;
  last_played: number;
  // Matches with / against the hero (on the other team) and how many of those were won.
  with_games?: number;
  with_win?: number;
  against_games?: number;
  against_win?: number;
};
export type Peer = {
  account_id: number;
  personaname: string | null;
  avatarfull: string | null;
  last_played: number;
  with_games: number;
  with_win: number;
  against_games: number;
  against_win: number;
};
export type LaneRoles = Record<string, { games: number; win: number }>;

// How a player's OpenDota data is cached. Once `revalidate` seconds old an entry is still served
// at once while a fresh copy is fetched in the background, for up to `expire` (a week): pages open
// right away even when OpenDota takes half a minute, and only the very first view waits.
export const QUICK = { stale: 60, revalidate: 15 * 60, expire: 7 * 24 * 3600 };
export const SLOW = { stale: 60, revalidate: 6 * 3600, expire: 7 * 24 * 3600 };

// Cached data with when it was fetched, so a page can say how old it is (and that it's updating).
export type Fresh<T> = { data: T; at: number };

async function fresh<T>(load: Promise<T>): Promise<Fresh<T>> {
  return { data: await load, at: Date.now() };
}

export async function getPlayer(accountId: number) {
  "use cache";
  cacheLife(QUICK);
  return fresh(getJson<DotaPlayer>(`${OPENDOTA}/players/${accountId}`));
}

export async function getWinLoss(accountId: number) {
  "use cache";
  cacheLife(QUICK);
  return fresh(getJson<{ win: number; lose: number }>(`${OPENDOTA}/players/${accountId}/wl`));
}

// How many ranked matches a player has (OpenDota's count), to say how long reading them all takes.
export async function getRankedCount(accountId: number) {
  "use cache";
  cacheLife(SLOW);
  const wl = await getJson<{ win: number; lose: number }>(`${OPENDOTA}/players/${accountId}/wl?lobby_type=7`);
  return wl.win + wl.lose;
}

export async function getRecentMatches(accountId: number) {
  "use cache";
  cacheLife(QUICK);
  return fresh(getJson<PlayerMatch[]>(`${OPENDOTA}/players/${accountId}/recentMatches`));
}

export const MATCHES_PER_PAGE = 50;

// The match list's filters, applied by OpenDota: a hero, and won or lost (null: both).
export type MatchFilter = { hero?: number; win?: boolean | null };

export async function getPlayerMatches(accountId: number, page: number, filter: MatchFilter = {}) {
  "use cache";
  cacheLife(QUICK);
  const params = new URLSearchParams({
    limit: String(MATCHES_PER_PAGE),
    offset: String(page * MATCHES_PER_PAGE),
  });
  if (filter.hero) params.set("hero_id", String(filter.hero));
  if (filter.win != null) params.set("win", filter.win ? "1" : "0");
  return getJson<PlayerMatch[]>(`${OPENDOTA}/players/${accountId}/matches?${params}`);
}

// Every ranked match of a player in one call: the side (true is Radiant), the result, when it
// started and the match's average rank tier (medal × 10 + stars, OpenDota's average_rank; null when
// it has none). The last stands in for MMR, which isn't public: a player's matches are made at
// their own rating. Sides, the win-rate trend and the IMP × rank chart all read this.
export type RankedEntry = { rad: boolean; won: boolean; start: number; rank: number | null };

export async function getRankedIndex(accountId: number): Promise<Record<number, RankedEntry>> {
  "use cache";
  cacheLife(SLOW);
  const rows = await getJson<
    {
      match_id: number;
      player_slot: number;
      radiant_win: boolean | null;
      start_time: number;
      average_rank: number | null;
    }[]
  >(
    `${OPENDOTA}/players/${accountId}/matches?lobby_type=7&project=player_slot&project=radiant_win&project=start_time&project=average_rank`,
  );
  return Object.fromEntries(
    rows.map((row) => {
      const rad = isRadiant(row.player_slot);
      return [
        row.match_id,
        { rad, won: rad === Boolean(row.radiant_win), start: row.start_time, rank: row.average_rank ?? null },
      ];
    }),
  );
}

// Which side the player was on in each ranked match (true is Radiant).
export async function getRankedSides(accountId: number): Promise<Record<number, boolean>> {
  const index = await getRankedIndex(accountId);
  return Object.fromEntries(Object.entries(index).map(([id, entry]) => [id, entry.rad]));
}

export async function getPlayerHeroes(accountId: number) {
  "use cache";
  cacheLife(SLOW);
  return fresh(getJson<PlayerHero[]>(`${OPENDOTA}/players/${accountId}/heroes`));
}

// The same statistics over the ranked matches the player played one hero in: each row's
// against_games / against_win are then the player's record on that hero against each other hero
// (the 段位 page's own matchups when admin doesn't store the player's matches).
export async function getPlayerHeroesAs(accountId: number, heroId: number) {
  "use cache";
  cacheLife(SLOW);
  return getJson<PlayerHero[]>(
    `${OPENDOTA}/players/${accountId}/heroes?hero_id=${Math.trunc(heroId)}&lobby_type=7`,
  );
}

// How every player is spread over the rank tiers (OpenDota's distributions): one row per tier
// (medal × 10 + stars) with its count and the running total, and the total of all players. Kept
// a day: it moves slowly.
export type RankDistribution = {
  rows: { tier: number; count: number; cumulative: number }[];
  total: number;
};

export async function getRankDistribution(): Promise<RankDistribution> {
  "use cache";
  cacheLife("days");
  const data = await getJson<{
    ranks: { rows: { bin: number; count: number; cumulative_sum: number }[]; sum: { count: number } };
  }>(`${OPENDOTA}/distributions`);
  return {
    rows: data.ranks.rows.map((r) => ({ tier: r.bin, count: r.count, cumulative: r.cumulative_sum })),
    total: data.ranks.sum.count,
  };
}

// OpenDota's player statistics sometimes time out while the rest of it answers: STRATZ's teammates
// over the newest matches stand in then.
export async function getPeers(accountId: number) {
  "use cache";
  cacheLife(SLOW);
  try {
    return await getJson<Peer[]>(`${OPENDOTA}/players/${accountId}/peers`);
  } catch (error) {
    const fallback = await getStratzPeers(accountId).catch(() => null);
    if (fallback?.length) return fallback;
    throw error;
  }
}

export async function getLaneRoles(accountId: number) {
  "use cache";
  cacheLife(SLOW);
  const counts = await getJson<{ lane_role: LaneRoles }>(`${OPENDOTA}/players/${accountId}/counts`);
  return { data: counts.lane_role, at: Date.now() };
}

// ── Matches ──────────────────────────────────────────────────────────────────────────────────

export type MatchPlayer = {
  account_id: number | null;
  player_slot: number;
  hero_id: number;
  personaname?: string | null;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
  net_worth?: number;
  hero_damage?: number;
  tower_damage?: number;
  hero_healing?: number;
  level: number;
  item_0: number;
  item_1: number;
  item_2: number;
  item_3: number;
  item_4: number;
  item_5: number;
  item_neutral?: number;
  aghanims_scepter?: number;
  aghanims_shard?: number;
  rank_tier?: number | null;
  lane_role?: number | null;
};

export type Match = {
  match_id: number;
  radiant_win: boolean;
  duration: number;
  start_time: number;
  game_mode: number;
  lobby_type: number;
  radiant_score: number;
  dire_score: number;
  // Set once OpenDota has parsed the replay; then the advantage curves are there too.
  version: number | null;
  radiant_gold_adv: number[] | null;
  radiant_xp_adv: number[] | null;
  picks_bans: { is_pick: boolean; hero_id: number; team: number; order: number }[] | null;
  players: MatchPlayer[];
};

export async function getMatch(matchId: number) {
  "use cache";
  // Null when OpenDota doesn't know the match id.
  const match = await getJson<Match | null>(`${OPENDOTA}/matches/${matchId}`, { notFound: "null" });
  if (!match) {
    cacheLife("minutes");
    return null;
  }
  // A parsed match no longer changes; an unparsed one may be parsed soon after a request.
  if (match.version) cacheLife("days");
  else cacheLife("minutes");
  return match;
}

// Asks OpenDota to fetch and parse the replay (for the advantage curves); takes a few minutes.
export async function requestParse(matchId: number) {
  const response = await opendotaFetch(`${OPENDOTA}/request/${matchId}`, () => ({
    method: "POST",
    signal: AbortSignal.timeout(20_000),
  }));
  return response.ok;
}

export const isRadiant = (slot: number) => slot < 128;
export const won = (match: { player_slot: number; radiant_win: boolean }) =>
  isRadiant(match.player_slot) === match.radiant_win;

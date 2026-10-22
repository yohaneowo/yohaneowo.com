import "server-only";
import { cacheLife } from "next/cache";
import { getHeroes, getJson, getMatch } from "./data";
import { dropKept, keep, kept } from "./kept";
import { type AbilityMeta, getLabConsts, type ItemMeta } from "./lab-consts";
import {
  buildExtra,
  HEAVY_EXTRA,
  type LabAdvanced,
  LIGHT_EXTRA,
  LIGHT_PLAYBACK_EXTRA,
  LIGHT_PLAYER_EXTRA,
  STATS_EXTRA,
  type SzDamage,
  type SzHeal,
  type SzHeavyExtra,
  type SzLightExtra,
  type SzLightPlayerExtra,
  type SzStatsExtra,
} from "./lab-extra";
import { buildMatch, isKeyItemKey, type LabMatch } from "./lab-match";
import {
  type Dist,
  getLabBaseline,
  getOdHero,
  getPersonal,
  getPro,
  getVsHero,
  getWardmap,
  type LabOdHero,
  type LabPersonal,
  type LabPro,
  type LabVsHero,
  type LabWardmap,
} from "./lab-refs";
import { mapZone, type MapZone } from "./map";
import { stratzQuery } from "./stratz";

// 局内科研: everything about one player in one match, put together from OpenDota's parsed replay
// (the per-minute curves, purchases, damage by source, gold and XP by reason, wards, teamfights)
// and STRATZ's (when each skill and item was used, when each level came, where the hero was over
// time, kills and deaths with where and how, runes, last hits with their places). Both are needed
// for the whole page: without OpenDota's parse there is nothing to show; without STRATZ's the
// timed parts are left out. A match, once parsed, never changes, so the result is cached for days.

const DATAFEED = "https://www.dota2.com/datafeed";
const CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react";
const OPENDOTA = "https://api.opendota.com/api";

// Total XP to reach each level (index 0 = level 1), for levels when STRATZ has no level events.
const LEVEL_XP = [
  0, 240, 640, 1160, 1760, 2440, 3200, 4000, 4900, 5900, 7000, 8200, 9500, 10900, 12400, 14000, 15700, 17500,
  19400, 21400, 23600, 26000, 28600, 31400, 34400, 38400, 43400, 49400, 56400, 63900,
];
const levelOf = (xp: number) => {
  let level = 1;
  LEVEL_XP.forEach((need, i) => {
    if (xp >= need) level = i + 1;
  });
  return level;
};

// ── What OpenDota gives (only the fields used) ───────────────────────────────────────────────

type Counts = Record<string, number>;
type OdWard = {
  time: number;
  x: number;
  y: number;
  ehandle?: number;
  attackername?: string | null;
};
export type OdPlayer = {
  player_slot: number;
  account_id?: number | null;
  personaname?: string | null;
  name?: string | null;
  hero_id: number;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
  level: number;
  net_worth?: number;
  hero_damage?: number;
  tower_damage?: number;
  hero_healing?: number;
  stuns?: number | null;
  actions_per_min?: number;
  rank_tier?: number | null;
  item_0: number;
  item_1: number;
  item_2: number;
  item_3: number;
  item_4: number;
  item_5: number;
  backpack_0?: number;
  backpack_1?: number;
  backpack_2?: number;
  item_neutral?: number;
  aghanims_scepter?: number;
  aghanims_shard?: number;
  moonshard?: number;
  gold_t?: number[];
  xp_t?: number[];
  lh_t?: number[];
  dn_t?: number[];
  networth_t?: number[];
  hero_damage_t?: number[];
  tower_damage_t?: number[];
  hero_healing_t?: number[];
  camps_stacked_t?: number[];
  purchase_log?: { time: number; key: string }[];
  item_uses?: Counts;
  ability_uses?: Counts;
  ability_targets?: Record<string, Counts>;
  neutral_item_history?: { time: number; item_neutral?: string; item_neutral_enhancement?: string }[];
  damage?: Counts;
  damage_taken?: Counts;
  damage_inflictor?: Counts;
  damage_inflictor_received?: Counts;
  damage_targets?: Record<string, Counts>;
  hero_hits?: Counts;
  kills_log?: { time: number; key: string }[];
  buyback_log?: { time: number }[];
  obs_log?: OdWard[];
  sen_log?: OdWard[];
  obs_left_log?: OdWard[];
  sen_left_log?: OdWard[];
  runes_log?: { time: number; key: string }[];
  gold_reasons?: Counts;
  xp_reasons?: Counts;
  teamfight_participation?: number | null;
  camps_stacked?: number;
  creeps_stacked?: number;
  rune_pickups?: number;
  roshan_kills?: number;
  towers_killed?: number;
  observer_kills?: number;
  sentry_kills?: number;
  courier_kills?: number;
  neutral_kills?: number;
  ancient_kills?: number;
  lane_kills?: number;
  lane_efficiency_pct?: number;
  life_state_dead?: number;
  pings?: number;
  purchase_tpscroll?: number;
  total_gold?: number;
  total_xp?: number;
  multi_kills?: Counts;
  kill_streaks?: Counts;
  max_hero_hit?: { time: number; value: number; key: string; inflictor?: string | null } | null;
  benchmarks?: Record<string, { raw: number | null; pct: number | null }>;
  gold?: number;
  gold_spent?: number;
  obs_placed?: number;
  sen_placed?: number;
  lane_role?: number | null;
  // OpenDota's lane estimate (1 bottom, 2 mid, 3 top, 4 and 5 the jungles) and roaming flag.
  lane?: number | null;
  is_roaming?: boolean | null;
  // The abilities in the order points went into them (talents too).
  ability_upgrades_arr?: number[] | null;
  leaver_status?: number | null;
  killed?: Counts;
  actions?: Counts;
  connection_log?: { time: number; event?: string }[];
  deaths_log?: { time: number; key: string; gold_lost?: number; gold_fed?: number; time_dead?: number }[];
  permanent_buffs?: { permanent_buff: number; stack_count: number; grant_time?: number }[] | null;
  additional_units?: Record<string, number | string | null>[] | null;
};
type OdTeamfight = {
  start: number;
  end: number;
  deaths: number;
  players: {
    deaths: number;
    damage: number;
    healing: number;
    gold_delta: number;
    xp_delta: number;
    buybacks: number;
    killed: Counts;
    ability_uses: Counts;
    item_uses: Counts;
    xp_start?: number;
    xp_end?: number;
  }[];
};
type OdObjective = {
  time: number;
  type: string;
  team?: number;
  key?: string | number;
  player_slot?: number;
  victim_player_slot?: number;
  unit?: string;
  killer?: number;
  value?: number;
};
export type OdMatch = {
  match_id: number;
  duration: number;
  start_time: number;
  radiant_win: boolean;
  game_mode: number;
  lobby_type: number;
  version: number | null;
  patch?: number;
  radiant_name?: string | null;
  dire_name?: string | null;
  league?: { name?: string | null } | null;
  players: OdPlayer[];
  teamfights?: OdTeamfight[] | null;
  objectives?: OdObjective[] | null;
  picks_bans?: { is_pick: boolean; hero_id: number; team: number; order: number }[] | null;
  radiant_gold_adv?: number[] | null;
  radiant_xp_adv?: number[] | null;
  pauses?: { time: number; duration: number }[] | null;
  replay_url?: string | null;
  throw?: number | null;
  loss?: number | null;
  chat?: { time: number; type: string; key: string; player_slot?: number }[] | null;
};

// ── What STRATZ gives ────────────────────────────────────────────────────────────────────────

type SzPos = { time: number; x: number; y: number };
export type SzLight = SzLightExtra & {
  parsedDateTime: number | null;
  rank: number | null;
  players: (SzLightPlayerExtra & {
    playerSlot: number;
    heroId: number;
    isRadiant: boolean;
    lane: string | null;
    position: string | null;
    steamAccountId: number | null;
    playbackData: {
      killEvents: { time: number; target: number; positionX: number; positionY: number }[] | null;
      assistEvents: { time: number; target: number }[] | null;
      deathEvents:
        { time: number; attacker: number; positionX: number | null; positionY: number | null }[] | null;
      playerUpdatePositionEvents: SzPos[] | null;
      // Everyone's hero damage dealt: the damage taken by the player is in the others' lists.
      heroDamageEvents: SzDamage[] | null;
      // Everyone's heals: the heals the player got are in the others' lists.
      healEvents: SzHeal[] | null;
    } | null;
  })[];
};
type SzHeavy = {
  playerSlot: number;
  imp: number | null;
  award: string | null;
  playbackData:
    | (SzHeavyExtra & {
        abilityLearnEvents:
          | {
              time: number;
              abilityId: number;
              levelObtained: number;
              isTalent: boolean;
              isUltimate: boolean | null;
            }[]
          | null;
        abilityUsedEvents: { time: number; abilityId: number; target: number | null }[] | null;
        itemUsedEvents: { time: number; itemId: number; target: number | null }[] | null;
        playerUpdateLevelEvents: { time: number; level: number }[] | null;
        playerUpdateHealthEvents:
          { time: number; hp: number; maxHp: number; mp: number; maxMp: number }[] | null;
        killEvents:
          | {
              time: number;
              target: number;
              byAbility: number | null;
              byItem: number | null;
              isSolo: boolean | null;
              isGank: boolean | null;
              isSmoke: boolean | null;
              isInvisible: boolean | null;
              isTpRecently: boolean | null;
              isRuneEffected: boolean | null;
              gold: number | null;
              xp: number | null;
            }[]
          | null;
        deathEvents:
          | {
              time: number;
              attacker: number;
              byAbility: number | null;
              byItem: number | null;
              positionX: number;
              positionY: number;
              goldLost: number | null;
              goldFed: number | null;
              timeDead: number | null;
              isWardWalkThrough: boolean | null;
              isAttemptTpOut: boolean | null;
              isDieBack: boolean | null;
              isBurst: boolean | null;
              isEngagedOnDeath: boolean | null;
              hasHealAvailable: boolean | null;
              isTracked: boolean | null;
              isFeed: boolean | null;
              xpFed: number | null;
              assist: number[] | null;
              reliableGold: number | null;
              unreliableGold: number | null;
            }[]
          | null;
        assistEvents: { time: number; target: number; positionX: number; positionY: number }[] | null;
        runeEvents:
          { time: number; rune: string; action: string; positionX: number; positionY: number }[] | null;
        buyBackEvents: { time: number; cost: number | null; deathTimeRemaining: number | null }[] | null;
        purchaseEvents: { time: number; itemId: number }[] | null;
        csEvents:
          | {
              time: number;
              npcId: number | null;
              isCreep: boolean | null;
              isNeutral: boolean | null;
              isAncient: boolean | null;
              positionX: number;
              positionY: number;
              gold: number | null;
              attacker: number | null;
              byAbility: number | null;
              byItem: number | null;
              isFromIllusion: boolean | null;
            }[]
          | null;
      })
    | null;
  stats:
    | (SzStatsExtra & {
        tripsFountainPerMinute: number[] | null;
        impPerMinute: number[] | null;
        heroDamageReceivedPerMinute: number[] | null;
        actionReport: Record<string, number | null> | null;
      })
    | null;
};

const HEAVY = `playerSlot imp award playbackData { abilityLearnEvents { time abilityId levelObtained isTalent isUltimate } abilityUsedEvents { time abilityId target } itemUsedEvents { time itemId target } playerUpdateLevelEvents { time level } playerUpdateHealthEvents { time hp maxHp mp maxMp } killEvents { time target byAbility byItem isSolo isGank isSmoke isInvisible isTpRecently isRuneEffected gold xp } deathEvents { time attacker byAbility byItem positionX positionY goldLost goldFed timeDead isWardWalkThrough isAttemptTpOut isDieBack isBurst isEngagedOnDeath hasHealAvailable isTracked isFeed xpFed assist reliableGold unreliableGold } assistEvents { time target positionX positionY } runeEvents { time rune action positionX positionY } buyBackEvents { time cost deathTimeRemaining } purchaseEvents { time itemId } csEvents { time npcId isCreep isNeutral isAncient positionX positionY gold attacker byAbility byItem isFromIllusion } ${HEAVY_EXTRA} } stats { ${STATS_EXTRA} tripsFountainPerMinute impPerMinute heroDamageReceivedPerMinute actionReport { moveToPosition moveToTarget attackPosition attackTarget castPosition castTarget castNoTarget heldPosition glyphCast scanUsed pingUsed } }`;

async function stratzLight(matchId: number): Promise<SzLight | null> {
  const data = await stratzQuery<{ match: SzLight | null }>(
    `{ match(id: ${matchId}) { parsedDateTime rank ${LIGHT_EXTRA} players { playerSlot heroId isRadiant lane position steamAccountId ${LIGHT_PLAYER_EXTRA} playbackData { killEvents { time target positionX positionY } assistEvents { time target } deathEvents { time attacker positionX positionY } playerUpdatePositionEvents { time x y } ${LIGHT_PLAYBACK_EXTRA} heroDamageEvents { time attacker target value byAbility byItem damageType isPhysicalAttack isSourceMainHero isTargetMainHero } } } } }`,
    30_000,
  );
  return data.match;
}

// One player's events; by account when known (STRATZ knows anonymous players' accounts too), else
// all ten and pick the slot.
async function stratzHeavy(matchId: number, slot: number, accountId: number | null): Promise<SzHeavy | null> {
  const filter = accountId ? `(steamAccountId: ${accountId})` : "";
  const data = await stratzQuery<{ match: { players: SzHeavy[] } | null }>(
    `{ match(id: ${matchId}) { players${filter} { ${HEAVY} } } }`,
    40_000,
  );
  return data.match?.players.find((p) => p.playerSlot === slot) ?? null;
}

// ── Names and pictures ───────────────────────────────────────────────────────────────────────

export type LabName = { zh: string; en: string; img: string };
export type LabItemInfo = LabName & { cost: number; consumable: boolean };
export type LabAbilityInfo = LabName & { talent: boolean };

type FeedEntry = { id: number; name: string; name_loc: string; name_english_loc: string };

// Items and abilities by id and by their key (what OpenDota's logs use: "blink", "antimage_blink").
async function getCatalog() {
  "use cache";
  cacheLife("days");
  const [items, abilities, costs] = await Promise.all([
    getJson<{ result: { data: { itemabilities: FeedEntry[] } } }>(`${DATAFEED}/itemlist?language=schinese`),
    getJson<{ result: { data: { itemabilities: FeedEntry[] } } }>(
      `${DATAFEED}/abilitylist?language=schinese`,
    ),
    getJson<Record<string, { id: number; cost: number | null; qual?: string }>>(
      `${OPENDOTA}/constants/items`,
    ).catch(() => ({}) as Record<string, { id: number; cost: number | null; qual?: string }>),
  ]);
  const itemById: Record<number, string> = {};
  const itemByKey: Record<string, LabItemInfo> = {};
  for (const it of items.result.data.itemabilities) {
    const key = it.name.replace(/^item_/, "");
    itemById[it.id] = key;
    const c = costs[key];
    itemByKey[key] = {
      zh: it.name_loc || it.name_english_loc || key,
      en: it.name_english_loc || key,
      img: `${CDN}/items/${key.startsWith("recipe_") ? "recipe" : key}.png`,
      cost: c?.cost ?? 0,
      consumable: c?.qual === "consumable",
    };
  }
  const abilityById: Record<number, string> = {};
  const abilityByKey: Record<string, LabAbilityInfo> = {};
  for (const ab of abilities.result.data.itemabilities) {
    if (!ab.name || ab.name.startsWith("dota_")) continue;
    abilityById[ab.id] = ab.name;
    abilityByKey[ab.name] = {
      // Talent texts carry the game's value templates ("+{s:value} 生命恢复"): an X stands in.
      zh: (ab.name_loc || ab.name_english_loc || ab.name).replace(/\{s:[^}]+\}/g, "X"),
      en: (ab.name_english_loc || ab.name).replace(/\{s:[^}]+\}/g, "X"),
      img: `${CDN}/abilities/${ab.name}.png`,
      talent: ab.name.startsWith("special_bonus"),
    };
  }
  return { itemById, itemByKey, abilityById, abilityByKey };
}

// ── The result ───────────────────────────────────────────────────────────────────────────────

export type LabZone = MapZone;
export type LabLane = "top" | "mid" | "bot" | "jungle" | "roam" | null;

export type LabFight = {
  kind: "kill" | "death" | "assist";
  t: number;
  x: number | null;
  y: number | null;
  // The hero killed (kill, assist) or who landed the kill (death).
  hero: number | null;
  allies: number[];
  enemies: number[];
  // How: the ability or item key, when not a right-click.
  by: string | null;
  flags: string[];
  // Kill: gold and XP earned. Death: gold lost, gold and XP given to the enemy.
  gold: number | null;
  xp: number | null;
  goldFed: number | null;
  timeDead: number | null;
};

export type LabWard = {
  kind: "obs" | "sen";
  t: number;
  x: number;
  y: number;
  // When it went away, and the hero who destroyed it (null: it expired, or not known).
  end: number | null;
  killedBy: number | null;
};

export type LabSide = {
  matchId: number;
  slot: number;
  radiant: boolean;
  win: boolean;
  duration: number;
  startTime: number;
  gameMode: number;
  lobbyType: number;
  rank: number | null;
  teams: { radiant: string | null; dire: string | null; league: string | null };
  accountId: number | null;
  name: string | null;
  heroId: number;
  // STRATZ's lane and position (1–5); null without STRATZ's parse.
  lane: LabLane;
  position: number | null;
  laneAllies: number[];
  laneOpponents: number[];
  team: number[];
  enemies: number[];
  parsed: { opendota: boolean; stratz: boolean };
  totals: {
    kills: number;
    deaths: number;
    assists: number;
    lastHits: number;
    denies: number;
    gpm: number;
    xpm: number;
    level: number;
    netWorth: number;
    heroDamage: number;
    towerDamage: number;
    healing: number;
    stuns: number | null;
    apm: number | null;
    totalGold: number | null;
    totalXp: number | null;
    deadSeconds: number | null;
    // Gold spent and left at the end, everything earned (the ledger: what was spent and kept, plus
    // what deaths and buybacks took, less sells and the starting gold), items sold, and the earned
    // gold no reason accounts for (passive income).
    goldSpent: number | null;
    goldEnd: number | null;
    earned: number | null;
    sells: number;
    passiveGold: number | null;
    imp: number | null;
    award: string | null;
    teamKills: number;
    teamNetWorthShare: number | null;
  };
  benchmarks: Record<string, number>;
  // The values behind the percentiles.
  benchmarksRaw: Record<string, number>;
  patch: { id: number; name: string } | null;
  // Where the position (and so the rank average) came from.
  positionFrom: "stratz" | "override" | "opendota" | null;
  // Per minute (index = minute), all cumulative except level and imp.
  minutes: {
    gold: number[];
    xp: number[];
    lh: number[];
    dn: number[];
    netWorth: number[];
    level: number[];
    heroDamage: number[];
    towerDamage: number[];
    healing: number[];
    campsStacked: number[];
    imp: number[];
    damageTaken: number[];
    fountainTrips: number[];
    // The hero's lowest and average health (fraction of max) in each minute.
    hpMin: number[];
    hpAvg: number[];
    teamNetWorth: number[];
    enemyNetWorth: number[];
  };
  levelTimes: number[];
  items: {
    purchases: { t: number; key: string }[];
    final: string[];
    backpack: string[];
    neutral: string | null;
    neutralHistory: { t: number; key: string; enhancement: string | null }[];
    uses: { key: string; count: number }[];
    useTimes: { key: string; times: number[] }[];
    buffs: { scepter: boolean; shard: boolean; moonshard: boolean };
    // The items of other units the player controlled (Spirit Bear…), as OpenDota lists them.
    additionalUnits: string[];
  };
  skills: {
    learned: { t: number; key: string; level: number; talent: boolean }[];
    uses: { key: string; count: number }[];
    useTimes: { key: string; times: number[] }[];
    targets: { key: string; heroes: { hero: number; count: number }[] }[];
    // The ultimate: the ability first taken at hero level 6 or later with at most three points.
    ult: string | null;
    // Every ability and item use aimed at a hero (STRATZ; point and no-target casts have no target).
    casts: { t: number; key: string; target: number; item: boolean }[];
  };
  laning: {
    at10: { lh: number; dn: number; gold: number; xp: number; netWorth: number; level: number } | null;
    // The lane's enemies at 10 minutes, with their net worth by minute for the first 13.
    opponents10: { hero: number; lh: number; dn: number; netWorth: number; xp: number; curve: number[] }[];
    lanes: (LabLane | null)[];
    swaps: { t: number; from: LabLane; to: LabLane }[];
    efficiency: number | null;
    killsBefore10: number;
    deathsBefore10: number;
  };
  fights: {
    events: LabFight[];
    participation: number | null;
    teamfights: {
      start: number;
      end: number;
      teamDeaths: number;
      enemyDeaths: number;
      joined: boolean;
      died: boolean;
      kills: number;
      damage: number;
      healing: number;
      goldDelta: number;
      xpDelta: number;
      buyback: boolean;
    }[];
    multiKills: Counts;
    streaks: Counts;
    maxHit: { t: number; value: number; hero: number | null; by: string | null } | null;
  };
  damage: {
    dealtBySource: { key: string; value: number }[];
    receivedBySource: { key: string; value: number }[];
    toHeroes: { hero: number; value: number }[];
    fromHeroes: { hero: number; value: number }[];
    dealtByKind: Counts;
    takenByKind: Counts;
    buildings: { key: string; value: number }[];
    hits: { key: string; value: number }[];
    // Damage to heroes by source and target ("null" = right-clicks), from OpenDota.
    matrix: { key: string; targets: { hero: number; value: number }[] }[];
  };
  vision: {
    wards: LabWard[];
    dewards: { kind: "obs" | "sen"; t: number; x: number; y: number }[];
    observerKills: number;
    sentryKills: number;
  };
  // Where the hero was, every 10 seconds (carried forward), for the heat maps and the cursor.
  path: { t: number[]; x: number[]; y: number[] };
  resources: {
    runes: { t: number; rune: string; action: string; x: number | null; y: number | null }[];
    campsStacked: number;
    creepsStacked: number;
    // Lane creeps last-hit in the own jungle before 15:00, grouped by wave: pulled = the player was at
    // that camp a while before the creeps came (a pull), else a pulled wave the player farmed.
    pulls: { t: number; x: number; y: number; n: number; pulled: boolean }[];
    // Last hits: kind 0 lane creep, 1 neutral, 2 ancient; src 0 right-click, 1 item, 2 ability,
    // 3 illusion or other unit.
    farm: {
      t: number;
      x: number;
      y: number;
      kind: 0 | 1 | 2;
      src: 0 | 1 | 2 | 3;
      gold: number;
      by: string | null;
    }[];
    roshan: { t: number; kind: "teamKill" | "enemyKill" | "aegis" | "aegisEnemy" | "stolen" | "denied" }[];
    buybacks: { t: number; cost: number | null }[];
    roshanKills: number;
    towersKilled: number;
    courierKills: number;
    neutralKills: number;
    ancientKills: number;
    laneKills: number;
    buildingKills: { t: number; key: string }[];
  };
  goldReasons: Counts;
  xpReasons: Counts;
  // Units killed by unit name (npc_dota_neutral_…, npc_dota_creep_…), from OpenDota.
  killed: Counts;
  actions: Record<string, number>;
  pings: number | null;
  firstBlood: { t: number; mine: boolean; victim: boolean } | null;
  // Stacks of permanent buffs (Duel, Flesh Heap, Shard, Scepter…), from OpenDota.
  buffs: { key: string; stacks: number }[];
  // OpenDota's order counts by order type.
  orders: { key: string; count: number }[];
  advanced: LabAdvanced;
  match: LabMatch;
  refs: LabRefs;
};

export type LabRefs = {
  od: LabOdHero | null;
  personal:
    | (Omit<LabPersonal, "parsed"> & {
        parsed: { n: number; nw10: Dist | null; lh10: Dist | null; items: Record<string, Dist> };
      })
    | null;
  pro: LabPro | null;
  vs: LabVsHero[];
  // The rank average is from the match's own week (false: recent games, the week is no longer kept).
  baselineWeek: boolean;
  // The player's usual ward spots on the hero (all their games).
  wardmap: LabWardmap | null;
};

export type LabAssets = {
  items: Record<string, LabItemInfo>;
  abilities: Record<string, LabAbilityInfo>;
  itemMeta: Record<string, ItemMeta>;
  abilityMeta: Record<string, AbilityMeta>;
  // Talent key → tier (1 = level 10 … 4 = level 25).
  talentTier: Record<string, number>;
  // Hero id → its abilities in slot order (for the skill builds).
  heroAbilities: Record<string, string[]>;
};

// The answer for one player: the side, the parse state when it's missing, or null for no such match.
export type LabResult =
  | { state: "ok"; side: LabSide; assets: LabAssets }
  | { state: "unparsed"; matchId: number; slot: number; heroId: number | null; name: string | null }
  | { state: "noPlayer"; matchId: number }
  | null;

const ITEM_SLOTS = ["item_0", "item_1", "item_2", "item_3", "item_4", "item_5"] as const;

// Absolute lane from STRATZ's lane and side: Radiant's safe lane is the bottom one.
// The frog camps' units by STRATZ npc id, for when STRATZ's unit list can't be had.
const FROG_NPCS: Record<number, string> = {
  895: "npc_dota_neutral_tadpole",
  896: "npc_dota_neutral_froglet",
  897: "npc_dota_neutral_grown_frog",
  898: "npc_dota_neutral_ancient_frog",
  899: "npc_dota_neutral_froglet_mage",
  900: "npc_dota_neutral_grown_frog_mage",
  901: "npc_dota_neutral_ancient_frog_mage",
};

// The hero levels that give a skill point, in order (17, 19 and 21–24 give none; 26–30 take the
// talents left).
const POINT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 25, 26, 27, 28, 29, 30];

// OpenDota's points in the order they were placed, at the earliest hero level each could have been:
// the next level that gives a point, no earlier than the one before (points can be saved) and, for
// a talent, its tier's level.
function odLearned(
  ids: number[],
  abilityKey: (id: number) => string | null,
  tiers: Record<string, number>,
): { key: string | null; level: number; talent: boolean }[] {
  let level = 0;
  return ids.map((id, i) => {
    const key = abilityKey(id);
    const talent = !!key?.startsWith("special_bonus");
    const slotLevel = POINT_LEVELS[i] ?? POINT_LEVELS[POINT_LEVELS.length - 1] + i - POINT_LEVELS.length + 1;
    const tierLevel = talent && key && tiers[key] ? 5 + 5 * tiers[key] : 0;
    level = Math.max(level, slotLevel, tierLevel);
    return { key, level, talent };
  });
}

// OpenDota's lane estimate as an absolute lane.
function odLane(p: { lane?: number | null; is_roaming?: boolean | null }): LabLane {
  if (p.is_roaming) return "roam";
  if (p.lane === 1) return "bot";
  if (p.lane === 2) return "mid";
  if (p.lane === 3) return "top";
  if (p.lane === 4 || p.lane === 5) return "jungle";
  return null;
}

function laneOf(lane: string | null, radiant: boolean): LabLane {
  if (lane === "MID_LANE") return "mid";
  if (lane === "SAFE_LANE") return radiant ? "bot" : "top";
  if (lane === "OFF_LANE") return radiant ? "top" : "bot";
  if (lane === "JUNGLE") return "jungle";
  if (lane === "ROAMING") return "roam";
  return null;
}

function zoneLane(zone: MapZone): LabLane | null {
  if (zone === "top" || zone === "mid" || zone === "bot") return zone;
  if (zone === "radiantJungle" || zone === "direJungle") return "jungle";
  return null;
}

// Positions every 10 s from first to last, the last known one carried forward.
function samplePath(events: SzPos[], duration: number) {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const out = { t: [] as number[], x: [] as number[], y: [] as number[] };
  if (!sorted.length) return out;
  let i = 0;
  let cur = sorted[0];
  for (let t = Math.ceil(sorted[0].time / 10) * 10; t <= duration; t += 10) {
    while (i < sorted.length && sorted[i].time <= t) cur = sorted[i++];
    out.t.push(t);
    out.x.push(cur.x);
    out.y.push(cur.y);
  }
  return out;
}

const heroKind = (key: string) => {
  if (key.startsWith("npc_dota_hero_")) return "heroes";
  if (key.startsWith("npc_dota_neutral_")) return "neutrals";
  if (key.includes("roshan")) return "roshan";
  if (
    /tower|rax|melee_rax|range_rax|fort|healers|filler|badguys_[a-z]*_?shrine|goodguys_[a-z]*_?shrine/.test(
      key,
    )
  )
    return "buildings";
  if (key.includes("creep") || key.includes("siege") || key.includes("lane")) return "creeps";
  if (key.includes("ward")) return "wards";
  if (key.includes("courier")) return "couriers";
  return "other";
};

const sumBy = (counts: Counts | undefined, pick: (key: string) => string) => {
  const out: Counts = {};
  for (const [key, value] of Object.entries(counts ?? {})) {
    const kind = pick(key);
    out[kind] = (out[kind] ?? 0) + value;
  }
  return out;
};

const sortedCounts = (counts: Counts | undefined) =>
  Object.entries(counts ?? {})
    .map(([key, value]) => ({ key, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

const perMinute = <T>(duration: number, fill: (minute: number) => T) =>
  Array.from({ length: Math.floor(duration / 60) + 1 }, (_, m) => fill(m));

const OD_RUNES: Record<string, string> = {
  "0": "DOUBLE_DAMAGE",
  "1": "HASTE",
  "2": "ILLUSION",
  "3": "INVISIBILITY",
  "4": "REGEN",
  "5": "BOUNTY",
  "6": "ARCANE",
  "7": "WATER",
  "8": "WISDOM",
  "9": "SHIELD",
};

// position: an override of STRATZ's position (1–5), which sets the rank average compared against.
// Bump when what getLabSide returns changes: the kept results of other versions are dropped. After a
// month the references (personal games, pro matches, the average) are fetched again.
const LAB_VERSION = "1";
const LAB_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

export async function getLabSide(
  matchId: number,
  slot: number,
  position?: number | null,
): Promise<LabResult> {
  "use cache";
  const id = Math.trunc(matchId);
  // A finished side (STRATZ parsed it too) is also kept in Postgres, so a deploy, which empties this
  // cache, doesn't fetch it all again.
  const key = `lab:${LAB_VERSION}:${id}:${slot}:${Math.trunc(position ?? 0)}`;
  const saved = await kept<LabResult>(key).catch(() => null);
  if (saved && Date.now() - saved.at < LAB_KEEP_MS) {
    cacheLife("days");
    return saved.data;
  }
  const raw = (await getMatch(id)) as unknown as OdMatch | null;
  if (!raw) {
    cacheLife("minutes");
    return null;
  }
  const index = raw.players.findIndex((p) => p.player_slot === slot);
  const p = raw.players[index];
  if (!p) {
    cacheLife("hours");
    return { state: "noPlayer", matchId: id };
  }
  const name = p.name ?? p.personaname ?? null;
  if (!raw.version || !p.gold_t?.length) {
    cacheLife("minutes");
    return { state: "unparsed", matchId: id, slot, heroId: p.hero_id, name };
  }

  const accountId = p.account_id && p.account_id !== 4294967295 ? p.account_id : null;
  const [heroes, catalog, light, consts] = await Promise.all([
    getHeroes(),
    getCatalog(),
    stratzLight(id).catch(() => stratzLight(id).catch(() => null)),
    getLabConsts(),
  ]);
  const lightMine = light?.players.find((x) => x.playerSlot === slot);
  const medal = Math.floor((light?.rank ?? p.rank_tier ?? 80) / 10);
  // STRATZ's position, else the one asked for, else OpenDota's lane role for cores (1–3).
  const override = position && position >= 1 && position <= 5 ? Math.trunc(position) : null;
  const stratzPosition = Number(lightMine?.position?.replace("POSITION_", "")) || null;
  const positionFrom: LabSide["positionFrom"] = override
    ? "override"
    : stratzPosition
      ? "stratz"
      : p.lane_role
        ? "opendota"
        : null;
  const pos = override ?? stratzPosition ?? (p.lane_role && p.lane_role <= 3 ? p.lane_role : null);
  const patchName = raw.patch != null ? (consts.patches[String(raw.patch)]?.name ?? null) : null;
  const [heavyFirst, weekBaseline, odHero, personal, pro, wardmap] = await Promise.all([
    stratzHeavy(id, slot, lightMine?.steamAccountId ?? accountId).catch(() => null),
    getLabBaseline(p.hero_id, pos, medal, raw.start_time, catalog.itemById, catalog.abilityById).catch(
      () => null,
    ),
    getOdHero(p.hero_id, medal).catch(() => null),
    accountId ? getPersonal(accountId, p.hero_id, id).catch(() => null) : null,
    patchName ? getPro(p.hero_id, patchName, id).catch(() => null) : null,
    // The usual ward spots matter for supports and for whoever placed wards in this game.
    accountId && ((pos ?? 0) >= 4 || (p.obs_log?.length ?? 0) + (p.sen_log?.length ?? 0) >= 3)
      ? getWardmap(accountId, p.hero_id).catch(() => null)
      : null,
  ]);
  // STRATZ sometimes times out on the big per-player query when it's busy: once more before going
  // without it.
  const heavy =
    heavyFirst ??
    (light?.parsedDateTime
      ? await stratzHeavy(id, slot, lightMine?.steamAccountId ?? accountId).catch(() => null)
      : null);
  // The match's week when STRATZ still has it (with enough games), else recent games.
  const baselineWeek = !!weekBaseline && weekBaseline.matches >= 500;
  const baseline = baselineWeek
    ? weekBaseline
    : await getLabBaseline(p.hero_id, pos, medal, null, catalog.itemById, catalog.abilityById).catch(
        () => null,
      );
  const stratzParsed = Boolean(light?.parsedDateTime && heavy?.playbackData);
  if (stratzParsed) cacheLife("days");
  else cacheLife("minutes");

  const heroByKey = new Map(Object.entries(heroes).map(([hid, h]) => [h.key, Number(hid)]));
  const heroOfKey = (key: string | null | undefined) => (key ? (heroByKey.get(key) ?? null) : null);
  const radiant = p.player_slot < 128;
  const duration = raw.duration;
  const mates = raw.players.filter((x) => x.player_slot < 128 === radiant);
  const foes = raw.players.filter((x) => x.player_slot < 128 !== radiant);
  const minutesLen = p.gold_t.length;
  const items = new Set<string>();
  const abilities = new Set<string>();
  const itemKey = (itemId: number | null | undefined) => (itemId ? (catalog.itemById[itemId] ?? null) : null);
  const abilityKey = (abilityId: number | null | undefined) =>
    abilityId ? (catalog.abilityById[abilityId] ?? null) : null;

  // Levels: STRATZ's level events, else from the XP curve.
  const levelEvents = (heavy?.playbackData?.playerUpdateLevelEvents ?? []).sort((a, b) => a.time - b.time);
  const levelTimes: number[] = [];
  if (levelEvents.length) {
    for (const e of levelEvents) if (!levelTimes[e.level - 1]) levelTimes[e.level - 1] = e.time;
  } else {
    const xp = p.xp_t ?? [];
    for (let m = 0; m < xp.length; m++) {
      const level = levelOf(xp[m]);
      for (let l = 1; l <= level; l++) if (levelTimes[l - 1] == null) levelTimes[l - 1] = m * 60;
    }
  }
  const levelAt = (t: number) => {
    let level = 1;
    levelTimes.forEach((at, i) => {
      if (at != null && at <= t) level = i + 1;
    });
    return level;
  };

  // Health per minute.
  const health = heavy?.playbackData?.playerUpdateHealthEvents ?? [];
  const hpMin = perMinute(duration, () => 1);
  const hpSum = perMinute(duration, () => 0);
  const hpN = perMinute(duration, () => 0);
  for (const h of health) {
    if (h.time < 0 || !h.maxHp) continue;
    const m = Math.min(hpMin.length - 1, Math.floor(h.time / 60));
    const f = h.hp / h.maxHp;
    hpMin[m] = Math.min(hpMin[m], f);
    hpSum[m] += f;
    hpN[m]++;
  }

  const sumT = (list: OdPlayer[], m: number) =>
    list.reduce((s, x) => s + (x.networth_t?.[m] ?? x.gold_t?.[m] ?? 0), 0);

  // Positions (STRATZ, everyone's, for lanes and the path).
  const lightOf = (s: number) => light?.players.find((x) => x.playerSlot === s);
  const mine = lightOf(slot);
  const path = samplePath(mine?.playbackData?.playerUpdatePositionEvents ?? [], duration);
  const lanes: (LabLane | null)[] = [];
  for (let m = 0; m <= 12 && m * 60 <= duration; m++) {
    const counts = new Map<LabLane, number>();
    path.t.forEach((t, i) => {
      if (t < m * 60 || t >= (m + 1) * 60) return;
      const lane = zoneLane(mapZone(path.x[i], path.y[i]));
      if (lane) counts.set(lane, (counts.get(lane) ?? 0) + 1);
    });
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    lanes.push(best ? best[0] : null);
  }
  // A swap: a different lane (not the jungle) held for two minutes or more after the start.
  const swaps: LabSide["laning"]["swaps"] = [];
  let held: LabLane | null = null;
  for (let m = 1; m < lanes.length; m++) {
    const lane = lanes[m];
    if (!lane || lane === "jungle") continue;
    if (held == null) {
      held = lane;
      continue;
    }
    if (lane !== held && lanes[m + 1] === lane) {
      swaps.push({ t: m * 60, from: held, to: lane });
      held = lane;
    }
  }

  // STRATZ's lanes, else (not parsed there) OpenDota's estimate from the early positions.
  const laneOfSlot = (x: OdPlayer) => {
    const l = light?.players.find((y) => y.playerSlot === x.player_slot);
    return (l ? laneOf(l.lane, l.isRadiant) : null) ?? odLane(x);
  };
  const lane = laneOfSlot(p);
  const lanePlayers = raw.players.map((x) => ({
    playerSlot: x.player_slot,
    heroId: x.hero_id,
    isRadiant: x.player_slot < 128,
    lane: laneOfSlot(x),
  }));
  const laneMates = lanePlayers.filter(
    (x) => x.playerSlot !== slot && x.isRadiant === radiant && lane && x.lane === lane,
  );
  const laneFoes = lanePlayers.filter(
    (x) => x.isRadiant !== radiant && lane && lane !== "jungle" && lane !== "roam" && x.lane === lane,
  );

  // Kills and deaths with everyone involved (from everyone's events at the same second).
  type Ev = { slot: number; hero: number; radiant: boolean; t: number; target: number };
  const killsAll: (Ev & { x: number; y: number })[] = [];
  const assistsAll: Ev[] = [];
  for (const x of light?.players ?? []) {
    for (const k of x.playbackData?.killEvents ?? [])
      killsAll.push({
        slot: x.playerSlot,
        hero: x.heroId,
        radiant: x.isRadiant,
        t: k.time,
        target: k.target,
        x: k.positionX,
        y: k.positionY,
      });
    for (const a of x.playbackData?.assistEvents ?? [])
      assistsAll.push({
        slot: x.playerSlot,
        hero: x.heroId,
        radiant: x.isRadiant,
        t: a.time,
        target: a.target,
      });
  }
  const near = (a: number, b: number) => Math.abs(a - b) <= 2;
  const involved = (t: number, target: number) => {
    const killers = killsAll.filter((k) => near(k.t, t) && k.target === target);
    const helpers = assistsAll.filter((a) => near(a.t, t) && a.target === target);
    return [...new Set([...killers, ...helpers].map((e) => e.hero))];
  };
  const teamHeroes = mates.map((x) => x.hero_id);
  const foeHeroes = foes.map((x) => x.hero_id);
  const fights: LabFight[] = [];
  const pb = heavy?.playbackData;
  // What each last hit was. STRATZ flags the frog camps' units as neither neutral nor creep, and
  // Roshan, buildings and summons come in csEvents too: units named npc_dota_neutral_* are neutrals
  // (the ancient frogs and the ones flagged ancient are ancients), units flagged as creeps are lane
  // creeps, and anything else isn't farm.
  const csEvents = (pb?.csEvents ?? []).flatMap((c) => {
    const name = c.npcId != null ? (consts.npcs[String(c.npcId)] ?? FROG_NPCS[c.npcId] ?? "") : "";
    const kind: 0 | 1 | 2 | null =
      c.isAncient || name.startsWith("npc_dota_neutral_ancient_frog")
        ? 2
        : c.isNeutral || name.startsWith("npc_dota_neutral_")
          ? 1
          : c.isCreep
            ? 0
            : null;
    return kind == null ? [] : [{ ...c, kind, isNeutral: kind === 1, isAncient: kind === 2 }];
  });
  if (pb) {
    for (const k of pb.killEvents ?? []) {
      const at = killsAll.find((e) => e.slot === slot && near(e.t, k.time) && e.target === k.target);
      const by = itemKey(k.byItem) ?? abilityKey(k.byAbility);
      if (by) (k.byItem ? items : abilities).add(by);
      const who = involved(k.time, k.target);
      fights.push({
        kind: "kill",
        t: k.time,
        x: at?.x ?? null,
        y: at?.y ?? null,
        hero: k.target,
        allies: who.filter((h) => teamHeroes.includes(h) && h !== p.hero_id),
        enemies: [],
        by,
        flags: [
          k.isSolo && "solo",
          k.isGank && "gank",
          k.isSmoke && "smoke",
          k.isInvisible && "invisible",
          k.isTpRecently && "tp",
          k.isRuneEffected && "rune",
        ].filter(Boolean) as string[],
        gold: k.gold ?? null,
        xp: k.xp ?? null,
        goldFed: null,
        timeDead: null,
      });
    }
    for (const d of pb.deathEvents ?? []) {
      const by = itemKey(d.byItem) ?? abilityKey(d.byAbility);
      if (by) (d.byItem ? items : abilities).add(by);
      const who = involved(d.time, p.hero_id);
      fights.push({
        kind: "death",
        t: d.time,
        x: d.positionX,
        y: d.positionY,
        hero: d.attacker && heroes[d.attacker] ? d.attacker : null,
        allies: [],
        enemies: who.filter((h) => foeHeroes.includes(h)),
        by,
        flags: [
          d.isWardWalkThrough && "warded",
          d.isTracked && "tracked",
          d.isAttemptTpOut && "tpOut",
          d.isDieBack && "dieBack",
          d.isBurst && "burst",
          d.isEngagedOnDeath && "engaged",
          d.hasHealAvailable && "healUnused",
          d.isFeed && "feed",
        ].filter(Boolean) as string[],
        gold: d.goldLost ?? null,
        xp: d.xpFed ?? null,
        goldFed: d.goldFed ?? null,
        timeDead: d.timeDead ?? null,
      });
    }
    for (const a of pb.assistEvents ?? []) {
      const who = involved(a.time, a.target);
      fights.push({
        kind: "assist",
        t: a.time,
        x: a.positionX,
        y: a.positionY,
        hero: a.target,
        allies: who.filter((h) => teamHeroes.includes(h) && h !== p.hero_id),
        enemies: [],
        by: null,
        flags: [],
        gold: null,
        xp: null,
        goldFed: null,
        timeDead: null,
      });
    }
  } else {
    // Without STRATZ: OpenDota's kill and death logs (no places, no helpers).
    for (const k of p.kills_log ?? [])
      fights.push({
        kind: "kill",
        t: k.time,
        x: null,
        y: null,
        hero: heroOfKey(k.key),
        allies: [],
        enemies: [],
        by: null,
        flags: [],
        gold: null,
        xp: null,
        goldFed: null,
        timeDead: null,
      });
    for (const d of p.deaths_log ?? []) {
      const killer = heroOfKey(d.key);
      fights.push({
        kind: "death",
        t: d.time,
        x: null,
        y: null,
        hero: killer,
        allies: [],
        enemies: killer ? [killer] : [],
        by: null,
        flags: [],
        gold: d.gold_lost ?? null,
        xp: null,
        goldFed: d.gold_fed ?? null,
        timeDead: d.time_dead ?? null,
      });
    }
  }
  fights.sort((a, b) => a.t - b.t);

  // Teamfights from OpenDota, with this player's share.
  const teamIdx = raw.players.map((x, i) => (x.player_slot < 128 === radiant ? i : -1)).filter((i) => i >= 0);
  const foeIdx = raw.players.map((x, i) => (x.player_slot < 128 !== radiant ? i : -1)).filter((i) => i >= 0);
  const teamfights = (raw.teamfights ?? []).map((f) => {
    const me = f.players[index];
    // Healing alone is mostly regeneration, not taking part.
    const joined = !!me && (me.damage > 0 || me.deaths > 0 || Object.keys(me.killed ?? {}).length > 0);
    return {
      start: f.start,
      end: f.end,
      teamDeaths: teamIdx.reduce((s, i) => s + (f.players[i]?.deaths ?? 0), 0),
      enemyDeaths: foeIdx.reduce((s, i) => s + (f.players[i]?.deaths ?? 0), 0),
      joined,
      died: (me?.deaths ?? 0) > 0,
      kills: Object.values(me?.killed ?? {}).reduce((s, v) => s + v, 0),
      damage: me?.damage ?? 0,
      healing: me?.healing ?? 0,
      goldDelta: me?.gold_delta ?? 0,
      xpDelta: me?.xp_delta ?? 0,
      buyback: (me?.buybacks ?? 0) > 0,
    };
  });

  // Purchases (OpenDota's log; STRATZ's as a fallback).
  const purchases = (p.purchase_log ?? []).map((x) => ({ t: x.time, key: x.key }));
  if (!purchases.length)
    for (const e of pb?.purchaseEvents ?? []) {
      const key = itemKey(e.itemId);
      if (key) purchases.push({ t: e.time, key });
    }
  purchases.forEach((x) => items.add(x.key));
  const final = ITEM_SLOTS.map((s) => itemKey(p[s])).filter(Boolean) as string[];
  const backpack = [p.backpack_0, p.backpack_1, p.backpack_2].map(itemKey).filter(Boolean) as string[];
  const neutral = itemKey(p.item_neutral);
  [...final, ...backpack, neutral].forEach((k) => k && items.add(k));
  const neutralHistory = (p.neutral_item_history ?? [])
    .filter((x) => x.item_neutral)
    .map((x) => ({ t: x.time, key: x.item_neutral!, enhancement: x.item_neutral_enhancement ?? null }));
  neutralHistory.forEach((x) => {
    items.add(x.key);
    if (x.enhancement) items.add(x.enhancement);
  });
  const itemUses = sortedCounts(p.item_uses).map((x) => ({ key: x.key, count: x.value }));
  itemUses.forEach((x) => items.add(x.key));
  const itemTimes = new Map<string, number[]>();
  for (const e of pb?.itemUsedEvents ?? []) {
    const key = itemKey(e.itemId);
    if (!key) continue;
    items.add(key);
    itemTimes.set(key, [...(itemTimes.get(key) ?? []), e.time]);
  }

  const talentTiers = Object.fromEntries(
    (consts.heroes[heroes[p.hero_id]?.key ?? ""]?.talents ?? []).map((x) => [x.key, x.tier]),
  );
  // Skills: STRATZ's (with times), else OpenDota's order of points placed at the hero levels that
  // give a point, timed by the level times.
  const learned = (
    pb?.abilityLearnEvents?.length
      ? pb.abilityLearnEvents.map((e) => ({
          t: e.time,
          key: abilityKey(e.abilityId),
          level: e.levelObtained,
          talent: e.isTalent,
        }))
      : odLearned(p.ability_upgrades_arr ?? [], abilityKey, talentTiers).map((x) => ({
          ...x,
          t: levelTimes[x.level - 1] ?? levelTimes[levelTimes.length - 1] ?? 0,
        }))
  )
    .filter((e): e is { t: number; key: string; level: number; talent: boolean } => !!e.key)
    .sort((a, b) => a.t - b.t || a.level - b.level);
  learned.forEach((e) => abilities.add(e.key));
  const abilityUses = sortedCounts(p.ability_uses).map((x) => ({ key: x.key, count: x.value }));
  abilityUses.forEach((x) => abilities.add(x.key));
  const abilityTimes = new Map<string, number[]>();
  for (const e of pb?.abilityUsedEvents ?? []) {
    const key = abilityKey(e.abilityId);
    if (!key) continue;
    abilities.add(key);
    abilityTimes.set(key, [...(abilityTimes.get(key) ?? []), e.time]);
  }
  // The ultimate: first taken at hero level 6 or later, never more than three points; STRATZ's flag
  // when it has one.
  const pointsOf = new Map<string, number[]>();
  for (const l of learned) if (!l.talent) pointsOf.set(l.key, [...(pointsOf.get(l.key) ?? []), l.level]);
  const flagged = (pb?.abilityLearnEvents ?? []).find((e) => e.isUltimate);
  const ult =
    (flagged ? abilityKey(flagged.abilityId) : null) ??
    [...pointsOf.entries()]
      .filter(([, lv]) => lv[0] >= 6 && lv.length <= 3)
      .sort((a, b) => a[1][0] - b[1][0])[0]?.[0] ??
    null;
  const targets = Object.entries(p.ability_targets ?? {}).map(([key, list]) => ({
    key,
    heroes: Object.entries(list)
      .map(([hk, count]) => ({ hero: heroOfKey(hk) ?? 0, count }))
      .filter((x) => x.hero)
      .sort((a, b) => b.count - a.count),
  }));

  // Laning at 10 minutes, against the lane's enemies.
  const at = (arr: number[] | undefined, m: number) => arr?.[Math.min(m, (arr?.length ?? 1) - 1)] ?? 0;
  const ten = minutesLen > 10 ? 10 : minutesLen - 1;
  const opponents10 = (laneFoes ?? []).map((f) => {
    const o = raw.players.find((x) => x.player_slot === f.playerSlot);
    return {
      hero: f.heroId,
      lh: at(o?.lh_t, ten),
      dn: at(o?.dn_t, ten),
      netWorth: at(o?.networth_t ?? o?.gold_t, ten),
      xp: at(o?.xp_t, ten),
      curve: (o?.networth_t ?? o?.gold_t ?? []).slice(0, 13),
    };
  });

  // Wards this player placed (with when they went away and who killed them), and the enemy wards
  // they destroyed.
  const myKey = heroes[p.hero_id]?.key ?? "";
  const wardsOf = (log: OdWard[] | undefined, left: OdWard[] | undefined, kind: "obs" | "sen"): LabWard[] =>
    (log ?? []).map((w) => {
      const gone = (left ?? []).find((l) => l.ehandle != null && l.ehandle === w.ehandle);
      const lived = gone ? gone.time - w.time : null;
      const full = kind === "obs" ? 360 : 420;
      const by = gone?.attackername ? heroOfKey(gone.attackername) : null;
      return {
        kind,
        t: w.time,
        x: w.x,
        y: w.y,
        end: gone?.time ?? null,
        killedBy: by && foeHeroes.includes(by) && lived != null && lived < full - 3 ? by : null,
      };
    });
  const wards = [
    ...wardsOf(p.obs_log, p.obs_left_log, "obs"),
    ...wardsOf(p.sen_log, p.sen_left_log, "sen"),
  ].sort((a, b) => a.t - b.t);
  const dewards = foes
    .flatMap((f) => [
      ...(f.obs_left_log ?? []).map((w) => ({ ...w, kind: "obs" as const })),
      ...(f.sen_left_log ?? []).map((w) => ({ ...w, kind: "sen" as const })),
    ])
    .filter((w) => w.attackername === myKey)
    .map((w) => ({ kind: w.kind, t: w.time, x: w.x, y: w.y }))
    .sort((a, b) => a.t - b.t);

  // Runes: STRATZ's (with place), else OpenDota's.
  const runes = pb?.runeEvents?.length
    ? pb.runeEvents.map((r) => ({
        t: r.time,
        rune: r.rune,
        action: r.action,
        x: r.positionX,
        y: r.positionY,
      }))
    : (p.runes_log ?? []).map((r) => ({
        t: r.time,
        rune: OD_RUNES[r.key] ?? r.key,
        action: "PICKUP",
        x: null,
        y: null,
      }));

  // Last hits by place: lane creeps (0), neutrals (1), ancients (2), and how they were made.
  const farm: LabSide["resources"]["farm"] = [];
  for (const c of csEvents) {
    const kind = c.kind;
    const byItem = itemKey(c.byItem);
    const byAbility = abilityKey(c.byAbility);
    const src =
      c.isFromIllusion || (c.attacker != null && c.attacker !== p.hero_id)
        ? 3
        : byItem
          ? 1
          : byAbility
            ? 2
            : 0;
    farm.push({
      t: c.time,
      x: c.positionX,
      y: c.positionY,
      kind,
      src,
      gold: c.gold ?? 0,
      by: byItem ?? byAbility,
    });
  }
  // Pulls: lane creeps last-hit in the own jungle before 15:00 (lane creeps killed in the enemy's
  // were a fight or a push), grouped into waves (within 20 s and 8 cells). A wave counts as pulled
  // by the player when they stood near that spot 15–40 s before its first last hit.
  const pulls: LabSide["resources"]["pulls"] = [];
  for (const c of farm) {
    if (c.kind !== 0 || c.t >= 900 || mapZone(c.x, c.y) !== (radiant ? "radiantJungle" : "direJungle"))
      continue;
    const wave = pulls.find((w) => c.t - w.t <= 20 && Math.hypot(c.x - w.x, c.y - w.y) <= 8);
    if (wave) wave.n++;
    else pulls.push({ t: c.t, x: c.x, y: c.y, n: 1, pulled: false });
  }
  for (const w of pulls)
    w.pulled = path.t.some(
      (t, i) => t >= w.t - 40 && t <= w.t - 15 && Math.hypot(path.x[i] - w.x, path.y[i] - w.y) <= 6,
    );

  const myTeam = radiant ? 2 : 3;
  const roshan: LabSide["resources"]["roshan"] = [];
  const buildingKills: LabSide["resources"]["buildingKills"] = [];
  let firstBlood: LabSide["firstBlood"] = null;
  for (const o of raw.objectives ?? []) {
    if (o.type === "CHAT_MESSAGE_ROSHAN_KILL")
      roshan.push({ t: o.time, kind: o.team === myTeam ? "teamKill" : "enemyKill" });
    // A teammate's aegis is the team's Roshan, already listed.
    else if (o.type === "CHAT_MESSAGE_AEGIS" && o.player_slot === slot)
      roshan.push({ t: o.time, kind: "aegis" });
    else if (o.type === "CHAT_MESSAGE_AEGIS" && (o.player_slot ?? 0) < 128 !== radiant)
      roshan.push({ t: o.time, kind: "aegisEnemy" });
    else if (o.type === "CHAT_MESSAGE_AEGIS_STOLEN") roshan.push({ t: o.time, kind: "stolen" });
    else if (o.type === "CHAT_MESSAGE_DENIED_AEGIS") roshan.push({ t: o.time, kind: "denied" });
    else if (o.type === "building_kill" && o.player_slot === slot && typeof o.key === "string")
      buildingKills.push({ t: o.time, key: o.key });
    else if (o.type === "CHAT_MESSAGE_FIRSTBLOOD")
      firstBlood = { t: o.time, mine: o.player_slot === slot, victim: o.victim_player_slot === slot };
  }

  const actionsReport = heavy?.stats?.actionReport ?? null;
  const teamNw = perMinute(duration, (m) => sumT(mates, m));
  const enemyNw = perMinute(duration, (m) => sumT(foes, m));
  const fin = minutesLen - 1;

  // Gold: what was earned by the ledger (spent + kept + taken by deaths and buybacks − sells − the
  // starting gold), and the part no reason accounts for (passive income).
  const reasons = p.gold_reasons ?? {};
  const sells = Math.max(0, reasons["6"] ?? 0);
  const logged = Object.entries(reasons)
    .filter(([k, v]) => Number(k) >= 11 && Number(k) <= 21 && v > 0)
    .reduce((sum, [, v]) => sum + v, 0);
  const earned =
    p.gold_spent != null && p.gold != null
      ? p.gold +
        p.gold_spent -
        Math.min(0, reasons["1"] ?? 0) -
        Math.min(0, reasons["2"] ?? 0) -
        sells -
        (reasons["0"] ?? 600)
      : (p.total_gold ?? null);
  const passiveGold = earned != null ? Math.max(0, earned - logged) : null;

  const ownBuilding = radiant ? "goodguys" : "badguys";
  const enemyObjectives = (raw.objectives ?? []).flatMap(
    (o): { t: number; type: string; key: string | null }[] => {
      const enemySlot = o.player_slot != null && o.player_slot < 128 !== radiant;
      if (o.type === "building_kill" && typeof o.key === "string" && o.key.includes(ownBuilding))
        return [{ t: o.time, type: "building", key: o.key }];
      if (o.type === "CHAT_MESSAGE_ROSHAN_KILL" && o.team === (radiant ? 3 : 2))
        return [{ t: o.time, type: "roshan", key: null }];
      if (o.type === "CHAT_MESSAGE_MINIBOSS_KILL" && (o.team === (radiant ? 3 : 2) || enemySlot))
        return [{ t: o.time, type: "tormentor", key: null }];
      return [];
    },
  );
  const deathsHeavy = new Map((pb?.deathEvents ?? []).map((d) => [d.time, d] as const));
  const lightPlayers = light?.players ?? [];

  const advanced = buildExtra({
    duration,
    radiant,
    heroId: p.hero_id,
    slot,
    teamHeroes,
    foeHeroes,
    path,
    everyone: lightPlayers.map((x) => ({
      slot: x.playerSlot,
      heroId: x.heroId,
      radiant: x.isRadiant,
      positions: x.playbackData?.playerUpdatePositionEvents ?? [],
    })),
    enemyDamage: lightPlayers
      .filter((x) => x.isRadiant !== radiant)
      .flatMap((x) => x.playbackData?.heroDamageEvents ?? []),
    allyDamage: lightPlayers
      .filter((x) => x.isRadiant === radiant && x.playerSlot !== slot)
      .flatMap((x) => x.playbackData?.heroDamageEvents ?? []),
    heals: lightPlayers.flatMap((x) => x.playbackData?.healEvents ?? []),
    light,
    heavy: pb ? { ...pb, csEvents } : null,
    stats: heavy?.stats ?? null,
    odPicks: raw.picks_bans ?? null,
    odGoldAdv: raw.radiant_gold_adv ?? [],
    odXpAdv: raw.radiant_xp_adv ?? [],
    odTeamfights: raw.teamfights ?? [],
    index,
    teamfights,
    deaths: fights
      .filter((f) => f.kind === "death")
      .map((f) => ({
        t: f.t,
        timeDead: f.timeDead,
        enemies: f.enemies,
        goldLost: f.gold,
        goldFed: f.goldFed ?? deathsHeavy.get(f.t)?.goldFed ?? null,
        xpFed: f.xp,
      })),
    buybacks: (pb?.buyBackEvents ?? p.buyback_log ?? []).map((b) => b.time),
    enemyObjectives,
    fightTimes: fights.map((f) => f.t),
    useTimes: [
      ...(pb?.abilityUsedEvents ?? []).map((e) => e.time),
      ...(pb?.itemUsedEvents ?? []).filter((e) => itemKey(e.itemId) !== "power_treads").map((e) => e.time),
    ],
    fightDeaths: lightPlayers.flatMap((x) =>
      (x.playbackData?.deathEvents ?? [])
        .filter((d) => d.positionX != null && d.positionY != null)
        .map((d) => ({ t: d.time, x: d.positionX!, y: d.positionY! })),
    ),
    netWorth: p.networth_t ?? p.gold_t,
    passiveGold: passiveGold ?? 0,
    laneAbs: lane,
    itemKey,
    abilityKey,
    baseline,
    cooldowns: Object.fromEntries(
      [...new Set([...learned.map((l) => l.key), ...abilityUses.map((u) => u.key)])]
        .filter((k) => consts.abilities[k]?.cd.length)
        .map((k) => [k, consts.abilities[k].cd]),
    ),
  });
  // Joined a teamfight: damage, a death or a kill, or (support work that deals no damage) an ability
  // or item used within reach of an enemy during it.
  advanced.fightDetails.forEach((d, i) => {
    if (!teamfights[i].joined && d.usedNearEnemy) teamfights[i].joined = true;
  });
  // The rank average's tables, cut to the heroes in this match.
  if (baseline) {
    const inMatch = new Set(raw.players.map((x) => String(x.hero_id)));
    const cut = <T>(r: Record<string, T>) =>
      Object.fromEntries(Object.entries(r).filter(([k]) => inMatch.has(k)));
    advanced.baseline = {
      ...baseline,
      laneVs: cut(baseline.laneVs),
      laneWith: cut(baseline.laneWith),
      matchUp: { vs: cut(baseline.matchUp.vs), with: cut(baseline.matchUp.with) },
    };
  }

  // Against whom the player's history is worth showing: the lane opponents and the hero who hurt
  // them most.
  const threat = Object.entries(p.damage_taken ?? {})
    .filter(([k]) => k.startsWith("npc_dota_hero_"))
    .sort((a, b) => b[1] - a[1])[0];
  const vsHeroes = [
    ...new Set([...(laneFoes ?? []).map((x) => x.heroId), ...(threat ? [heroOfKey(threat[0])] : [])]),
  ].filter((h): h is number => !!h);
  const vs = accountId
    ? (
        await Promise.all(
          vsHeroes.slice(0, 3).map((h) => getVsHero(accountId, p.hero_id, h).catch(() => null)),
        )
      ).filter((v): v is LabVsHero => !!v)
    : [];
  const keyItem = (k: string) => isKeyItemKey(k, consts);
  const refs: LabRefs = {
    od: odHero,
    personal: personal
      ? {
          ...personal,
          parsed: {
            ...personal.parsed,
            items: Object.fromEntries(
              Object.entries(personal.parsed.items)
                .map(([itemId, d]) => [itemKey(Number(itemId)) ?? "", d] as const)
                .filter(([k]) => k && keyItem(k)),
            ),
          },
        }
      : null,
    pro: pro
      ? {
          ...pro,
          items: Object.fromEntries(Object.entries(pro.items).filter(([k]) => keyItem(k))),
          // The neutral items by item key (the explorer gives ids).
          neutrals: Object.fromEntries(
            Object.entries(pro.neutrals).map(([id, n]) => [itemKey(Number(id)) ?? id, n] as const),
          ),
        }
      : null,
    vs,
    baselineWeek,
    wardmap,
  };
  const match = buildMatch(raw, light, heroes, consts);

  const side: LabSide = {
    matchId: id,
    slot,
    radiant,
    win: radiant === raw.radiant_win,
    duration,
    startTime: raw.start_time,
    gameMode: raw.game_mode,
    lobbyType: raw.lobby_type,
    rank: light?.rank ?? null,
    teams: {
      radiant: raw.radiant_name ?? null,
      dire: raw.dire_name ?? null,
      league: raw.league?.name ?? null,
    },
    accountId,
    name,
    heroId: p.hero_id,
    lane,
    position: pos,
    laneAllies: (laneMates ?? []).map((x) => x.heroId),
    laneOpponents: (laneFoes ?? []).map((x) => x.heroId),
    team: teamHeroes.filter((h) => h !== p.hero_id),
    enemies: foeHeroes,
    parsed: { opendota: true, stratz: stratzParsed },
    totals: {
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      lastHits: p.last_hits,
      denies: p.denies,
      gpm: p.gold_per_min,
      xpm: p.xp_per_min,
      level: p.level,
      netWorth: p.net_worth ?? at(p.networth_t, fin),
      heroDamage: p.hero_damage ?? 0,
      towerDamage: p.tower_damage ?? 0,
      healing: p.hero_healing ?? 0,
      stuns: p.stuns ?? null,
      apm: p.actions_per_min ?? null,
      totalGold: p.total_gold ?? null,
      totalXp: p.total_xp ?? null,
      deadSeconds: p.life_state_dead ?? null,
      goldSpent: p.gold_spent ?? null,
      goldEnd: p.gold ?? null,
      earned,
      sells,
      passiveGold,
      imp: heavy?.imp ?? null,
      award: heavy?.award && heavy.award !== "NONE" ? heavy.award : null,
      teamKills: mates.reduce((s, x) => s + x.kills, 0),
      teamNetWorthShare: teamNw[fin] ? at(p.networth_t, fin) / teamNw[fin] : null,
    },
    benchmarks: Object.fromEntries(
      Object.entries(p.benchmarks ?? {})
        .filter(([, v]) => v.pct != null)
        .map(([k, v]) => [k, v.pct!]),
    ),
    benchmarksRaw: Object.fromEntries(
      Object.entries(p.benchmarks ?? {})
        .filter(([, v]) => v.raw != null)
        .map(([k, v]) => [k, v.raw!]),
    ),
    patch: match.patch,
    positionFrom,
    minutes: {
      gold: p.gold_t,
      xp: p.xp_t ?? [],
      lh: p.lh_t ?? [],
      dn: p.dn_t ?? [],
      netWorth: p.networth_t ?? p.gold_t,
      level: perMinute(duration, (m) => levelAt(m * 60)),
      heroDamage: p.hero_damage_t ?? [],
      towerDamage: p.tower_damage_t ?? [],
      healing: p.hero_healing_t ?? [],
      campsStacked: p.camps_stacked_t ?? [],
      imp: heavy?.stats?.impPerMinute ?? [],
      damageTaken: heavy?.stats?.heroDamageReceivedPerMinute ?? [],
      fountainTrips: heavy?.stats?.tripsFountainPerMinute ?? [],
      hpMin: health.length ? hpMin : [],
      hpAvg: health.length ? hpSum.map((s, i) => (hpN[i] ? s / hpN[i] : 1)) : [],
      teamNetWorth: teamNw,
      enemyNetWorth: enemyNw,
    },
    levelTimes,
    items: {
      purchases,
      final,
      backpack,
      neutral,
      neutralHistory,
      uses: itemUses,
      useTimes: [...itemTimes.entries()]
        .map(([key, times]) => ({ key, times }))
        .sort((a, b) => b.times.length - a.times.length),
      buffs: { scepter: !!p.aghanims_scepter, shard: !!p.aghanims_shard, moonshard: !!p.moonshard },
      additionalUnits: (p.additional_units ?? []).flatMap((u) =>
        ["item_0", "item_1", "item_2", "item_3", "item_4", "item_5", "item_neutral"]
          .map((k) => (typeof u[k] === "number" ? itemKey(u[k] as number) : null))
          .filter((k): k is string => !!k),
      ),
    },
    skills: {
      learned,
      uses: abilityUses,
      useTimes: [...abilityTimes.entries()]
        .map(([key, times]) => ({ key, times }))
        .sort((a, b) => b.times.length - a.times.length),
      targets,
      ult,
      casts: [
        ...(pb?.abilityUsedEvents ?? []).flatMap((e) => {
          const key = abilityKey(e.abilityId);
          return key && e.target && heroes[e.target]
            ? [{ t: e.time, key, target: e.target, item: false }]
            : [];
        }),
        ...(pb?.itemUsedEvents ?? []).flatMap((e) => {
          const key = itemKey(e.itemId);
          return key && e.target && heroes[e.target]
            ? [{ t: e.time, key, target: e.target, item: true }]
            : [];
        }),
      ].sort((a, b) => a.t - b.t),
    },
    laning: {
      at10:
        minutesLen > 1
          ? {
              lh: at(p.lh_t, ten),
              dn: at(p.dn_t, ten),
              gold: at(p.gold_t, ten),
              xp: at(p.xp_t, ten),
              netWorth: at(p.networth_t ?? p.gold_t, ten),
              level: levelAt(ten * 60),
            }
          : null,
      opponents10,
      lanes,
      swaps,
      efficiency: p.lane_efficiency_pct ?? null,
      killsBefore10: fights.filter((f) => f.kind === "kill" && f.t < 600).length,
      deathsBefore10: fights.filter((f) => f.kind === "death" && f.t < 600).length,
    },
    fights: {
      events: fights,
      participation: p.teamfight_participation ?? null,
      teamfights,
      multiKills: p.multi_kills ?? {},
      streaks: p.kill_streaks ?? {},
      maxHit: p.max_hero_hit
        ? {
            t: p.max_hero_hit.time,
            value: p.max_hero_hit.value,
            hero: heroOfKey(p.max_hero_hit.key),
            by: p.max_hero_hit.inflictor ?? null,
          }
        : null,
    },
    damage: {
      dealtBySource: sortedCounts(p.damage_inflictor),
      receivedBySource: sortedCounts(p.damage_inflictor_received),
      toHeroes: Object.entries(
        Object.values(p.damage_targets ?? {}).reduce<Counts>((acc, targets) => {
          for (const [k, v] of Object.entries(targets)) acc[k] = (acc[k] ?? 0) + v;
          return acc;
        }, {}),
      )
        .map(([k, v]) => ({ hero: heroOfKey(k) ?? 0, value: v }))
        .filter((x) => x.hero)
        .sort((a, b) => b.value - a.value),
      fromHeroes: Object.entries(p.damage_taken ?? {})
        .map(([k, v]) => ({ hero: heroOfKey(k) ?? 0, value: v }))
        .filter((x) => x.hero)
        .sort((a, b) => b.value - a.value),
      dealtByKind: sumBy(p.damage, heroKind),
      takenByKind: sumBy(p.damage_taken, heroKind),
      buildings: sortedCounts(p.damage).filter((x) => heroKind(x.key) === "buildings"),
      hits: sortedCounts(p.hero_hits),
      matrix: Object.entries(p.damage_targets ?? {})
        .map(([key, list]) => ({
          key,
          targets: Object.entries(list)
            .map(([k, v]) => ({ hero: heroOfKey(k) ?? 0, value: v }))
            .filter((x) => x.hero)
            .sort((a, b) => b.value - a.value),
        }))
        .filter((x) => x.targets.length)
        .sort(
          (a, b) => b.targets.reduce((s, x) => s + x.value, 0) - a.targets.reduce((s, x) => s + x.value, 0),
        ),
    },
    vision: { wards, dewards, observerKills: p.observer_kills ?? 0, sentryKills: p.sentry_kills ?? 0 },
    path,
    resources: {
      runes,
      campsStacked: p.camps_stacked ?? 0,
      creepsStacked: p.creeps_stacked ?? 0,
      pulls,
      farm,
      roshan,
      buybacks: pb?.buyBackEvents?.length
        ? pb.buyBackEvents.map((b) => ({ t: b.time, cost: b.cost }))
        : (p.buyback_log ?? []).map((b) => ({ t: b.time, cost: null })),
      roshanKills: p.roshan_kills ?? 0,
      towersKilled: p.towers_killed ?? 0,
      courierKills: p.courier_kills ?? 0,
      neutralKills: p.neutral_kills ?? 0,
      ancientKills: p.ancient_kills ?? 0,
      laneKills: p.lane_kills ?? 0,
      buildingKills,
    },
    goldReasons: p.gold_reasons ?? {},
    xpReasons: p.xp_reasons ?? {},
    killed: p.killed ?? {},
    actions: Object.fromEntries(Object.entries(actionsReport ?? {}).filter(([, v]) => v != null)) as Record<
      string,
      number
    >,
    pings: p.pings ?? null,
    firstBlood,
    buffs: (p.permanent_buffs ?? [])
      .map((b) => ({
        key: consts.permanentBuffs[String(b.permanent_buff)] ?? String(b.permanent_buff),
        stacks: b.stack_count,
      }))
      .filter((b) => b.key),
    orders: Object.entries(p.actions ?? {})
      .map(([k, count]) => ({
        key: (consts.orders[k] ?? `ORDER_${k}`).replace(/^DOTA_UNIT_ORDER_/, "").toLowerCase(),
        count,
      }))
      .sort((a, b) => b.count - a.count),
    advanced,
    match,
    refs,
  };

  const adv = advanced;
  for (const f of adv.fightDetails) {
    f.abilities.forEach((a) => (catalog.itemByKey[a.key] ? items : abilities).add(a.key));
    f.items.forEach((a) => items.add(a.key));
    f.carried.forEach((k) => items.add(k));
  }
  for (const e of adv.inventory) [...e.items, ...e.backpack, e.neutral].forEach((k) => k && items.add(k));
  for (const d of adv.damage) if (d.by) (catalog.itemByKey[d.by] ? items : abilities).add(d.by);

  // Damage sources and hits are ability or item keys ("null" is a right-click).
  for (const x of [...side.damage.dealtBySource, ...side.damage.receivedBySource, ...side.damage.hits]) {
    if (catalog.itemByKey[x.key]) items.add(x.key);
    else abilities.add(x.key);
  }
  for (const x of side.skills.targets) abilities.add(x.key);
  for (const c of side.skills.casts) (c.item ? items : abilities).add(c.key);
  for (const x of side.damage.matrix)
    if (x.key !== "null") (catalog.itemByKey[x.key] ? items : abilities).add(x.key);
  if (side.fights.maxHit?.by) abilities.add(side.fights.maxHit.by);
  for (const f of side.resources.farm) if (f.by) (catalog.itemByKey[f.by] ? items : abilities).add(f.by);
  for (const h of [...advanced.heals.received, ...advanced.heals.given])
    if (h.by) (catalog.itemByKey[h.by] ? items : abilities).add(h.by);
  side.items.additionalUnits.forEach((k) => items.add(k));
  for (const mp of match.players) mp.keyItems.forEach((k) => items.add(k.key));
  for (const mf of match.teamfights)
    for (const pl of mf.players) {
      Object.keys(pl.items).forEach((k) => items.add(k));
      Object.keys(pl.abilities).forEach((k) => (catalog.itemByKey[k] ? items : abilities).add(k));
    }
  if (baseline) {
    for (const [k, it] of Object.entries(baseline.items))
      if (it.rate >= 0.05 || purchases.some((b) => b.key === k)) items.add(k);
    baseline.starting.forEach((x) => items.add(x.key));
    baseline.boots.forEach((x) => items.add(x.key));
    baseline.talents.forEach((x) => abilities.add(x.key));
    Object.keys(baseline.abilityMax).forEach((k) => abilities.add(k));
  }
  Object.keys(refs.pro?.items ?? {}).forEach((k) => items.add(k));
  Object.keys(refs.pro?.neutrals ?? {}).forEach((k) => items.add(k));
  Object.keys(refs.personal?.parsed.items ?? {}).forEach((k) => items.add(k));
  const heroAbilities = consts.heroes[heroes[p.hero_id]?.key ?? ""];
  heroAbilities?.abilities.forEach((k) => abilities.add(k));
  heroAbilities?.talents.forEach((k) => abilities.add(k.key));

  const assets: LabAssets = {
    items: Object.fromEntries(
      [...items].filter((k) => catalog.itemByKey[k]).map((k) => [k, catalog.itemByKey[k]]),
    ),
    abilities: Object.fromEntries(
      [...abilities].filter((k) => catalog.abilityByKey[k]).map((k) => [k, catalog.abilityByKey[k]]),
    ),
    itemMeta: Object.fromEntries([...items].filter((k) => consts.items[k]).map((k) => [k, consts.items[k]])),
    abilityMeta: Object.fromEntries(
      [...abilities].filter((k) => consts.abilities[k]).map((k) => [k, consts.abilities[k]]),
    ),
    talentTier: Object.fromEntries((heroAbilities?.talents ?? []).map((x) => [x.key, x.tier])),
    heroAbilities: { [String(p.hero_id)]: heroAbilities?.abilities ?? [] },
  };
  const result: LabResult = { state: "ok", side, assets };
  if (stratzParsed) {
    await keep(key, result).catch(() => {});
    await dropKept("lab", LAB_VERSION, LAB_KEEP_MS).catch(() => {});
  }
  return result;
}

// "9040578015-0" (match id and player slot) → the pair, or null.
export function labParam(value: string | string[] | undefined): { matchId: number; slot: number } | null {
  const v = Array.isArray(value) ? value[0] : value;
  const m = /^(\d{6,12})-(\d{1,3})$/.exec(v ?? "");
  if (!m) return null;
  const slot = Number(m[2]);
  if (!(slot <= 4 || (slot >= 128 && slot <= 132))) return null;
  return { matchId: Number(m[1]), slot };
}

// The ten players of a match, to choose whose game to study.
export type LabPick = {
  slot: number;
  heroId: number;
  name: string | null;
  accountId: number | null;
  radiant: boolean;
};

export async function getLabPicks(
  matchId: number,
): Promise<{ parsed: boolean; duration: number; win: boolean; players: LabPick[] } | null> {
  const raw = (await getMatch(Math.trunc(matchId))) as unknown as OdMatch | null;
  if (!raw) return null;
  return {
    parsed: Boolean(raw.version),
    duration: raw.duration,
    win: raw.radiant_win,
    players: raw.players.map((x) => ({
      slot: x.player_slot,
      heroId: x.hero_id,
      name: x.name ?? x.personaname ?? null,
      accountId: x.account_id && x.account_id !== 4294967295 ? x.account_id : null,
      radiant: x.player_slot < 128,
    })),
  };
}

// Matches to set beside one: the same hero played by pros lately (OpenDota's pro matches), and in
// the viewer's own matches.
export type LabSuggestion = {
  matchId: number;
  slot: number | null;
  accountId: number | null;
  heroId: number;
  start: number;
  win: boolean | null;
  label: string | null;
  duration: number | null;
  gameMode: number | null;
};

export async function getHeroProMatches(heroId: number): Promise<LabSuggestion[]> {
  "use cache";
  cacheLife("hours");
  type Raw = {
    match_id: number;
    start_time: number;
    account_id: number;
    radiant: boolean;
    radiant_win: boolean;
    league_name: string | null;
    player_slot?: number;
    duration?: number;
  };
  const list = await getJson<Raw[]>(`${OPENDOTA}/heroes/${Math.trunc(heroId)}/matches`).catch(
    () => [] as Raw[],
  );
  return list.slice(0, 20).map((m) => ({
    matchId: m.match_id,
    slot: m.player_slot ?? null,
    accountId: m.account_id ?? null,
    heroId,
    start: m.start_time,
    win: m.radiant === m.radiant_win,
    label: m.league_name,
    duration: m.duration ?? null,
    gameMode: null,
  }));
}

// One account's latest matches on a hero.
export async function getHeroMatchesOf(accountId: number, heroId: number): Promise<LabSuggestion[]> {
  "use cache";
  cacheLife("minutes");
  type Raw = {
    match_id: number;
    player_slot: number;
    radiant_win: boolean;
    start_time: number;
    hero_id: number;
    duration?: number;
    game_mode?: number;
  };
  const list = await getJson<Raw[]>(
    `${OPENDOTA}/players/${Math.trunc(accountId)}/matches?hero_id=${Math.trunc(heroId)}&limit=20`,
  ).catch(() => [] as Raw[]);
  return list.map((m) => ({
    matchId: m.match_id,
    slot: m.player_slot,
    accountId,
    heroId: m.hero_id,
    start: m.start_time,
    win: m.player_slot < 128 === m.radiant_win,
    label: null,
    duration: m.duration ?? null,
    gameMode: m.game_mode ?? null,
  }));
}

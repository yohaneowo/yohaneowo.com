import "server-only";
import type { HeroInfo } from "./data";
import type { LabConsts } from "./lab-consts";
import type { LabLane, OdMatch, SzLight } from "./lab";

// The whole match around the studied player, for the analyses that need everyone: all ten
// players' curves and key items, where everyone was every 10 seconds, every death, the buildings
// with their health over time, every ward placed, the objectives, the teamfights with every
// player's share, pauses and disconnects, and the draft with STRATZ's grades. From OpenDota's
// parse and STRATZ's (positions, buildings, grades); what's missing from one is left empty.

export type LabMatchPlayer = {
  slot: number;
  heroId: number;
  radiant: boolean;
  name: string | null;
  // OpenDota's account (null when the player is anonymous there).
  accountId: number | null;
  // STRATZ's position (1–5) and absolute lane.
  position: number | null;
  lane: LabLane;
  seasonRank: number | null;
  smurf: number | null;
  heroXp: number | null;
  party: number | null;
  imp: number | null;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  heroDamage: number;
  towerDamage: number;
  healing: number;
  totalGold: number | null;
  netWorth: number;
  gpm: number;
  xpm: number;
  stuns: number | null;
  campsStacked: number;
  observers: number;
  sentries: number;
  level: number;
  // Per minute, cumulative (net worth and XP as is).
  curves: { nw: number[]; xp: number[]; lh: number[]; dn: number[]; gold: number[] };
  // First purchase of each finished item worth timing (1,800 gold or more, not a consumable).
  keyItems: { t: number; key: string }[];
  // When level 6 came (from the XP curve).
  level6: number | null;
  runes: { t: number; rune: string }[];
};

export type LabBuilding = {
  id: number;
  // STRATZ's npc id (fixed per building, see BUILDING_NAMES).
  npc: number;
  type: "tower" | "barracks" | "fort" | "outpost" | "other";
  radiant: boolean;
  x: number;
  y: number;
  // tower1_bot, melee_rax_mid, fort… (null for outposts and others).
  name: string | null;
  maxHp: number;
  // Health over time [seconds, hp]: only the changes.
  hp: [number, number][];
  died: number | null;
};

export type LabMatchWard = {
  kind: "obs" | "sen";
  radiant: boolean;
  slot: number;
  x: number;
  y: number;
  t: number;
  end: number | null;
  // The slot of the hero who destroyed it (null: it expired or isn't known).
  destroyedBy: number | null;
};

export type LabObjective = {
  t: number;
  type:
    "building" | "roshan" | "aegis" | "aegisStolen" | "aegisDenied" | "tormentor" | "courier" | "firstBlood";
  // The side that got it (for 'courier', the side whose courier died).
  radiant: boolean | null;
  slot: number | null;
  key: string | null;
  value: number | null;
};

export type LabMatchFight = {
  start: number;
  end: number;
  deaths: number;
  players: {
    slot: number;
    damage: number;
    healing: number;
    gold: number;
    xp: number;
    deaths: number;
    kills: number;
    xpStart: number | null;
    xpEnd: number | null;
    abilities: Record<string, number>;
    items: Record<string, number>;
  }[];
};

export type LabMatchDeath = {
  t: number;
  slot: number;
  hero: number;
  // The hero who got the kill (null: creeps, towers, neutrals).
  killer: number | null;
  // Heroes credited (killer and assists).
  involved: number[];
  x: number | null;
  y: number | null;
};

export type LabMatch = {
  players: LabMatchPlayer[];
  // Everyone's position every 10 s (carried forward), by slot; t is shared.
  grid: { t: number[]; pos: Record<string, { x: number[]; y: number[] }> };
  deaths: LabMatchDeath[];
  buildings: LabBuilding[];
  wards: LabMatchWard[];
  objectives: LabObjective[];
  teamfights: LabMatchFight[];
  pauses: { t: number; d: number }[];
  disconnects: { t: number; slot: number; event: string }[];
  // Slots that left the game (OpenDota's leaver status 2 or more).
  leavers: number[];
  draft: {
    hero: number;
    radiant: boolean;
    pick: boolean;
    order: number;
    base: number | null;
    adjusted: number | null;
  }[];
  // STRATZ's draft-only win chance for Radiant by minute, and the live one.
  predictedWin: number[];
  // OpenDota's Radiant gold and XP advantage by minute (the fallback when STRATZ has none).
  radiantGoldAdv: number[];
  radiantXpAdv: number[];
  // OpenDota's biggest leads: the losing side's best ('throw') and the winning side's worst ('loss').
  shape: { throwGold: number | null; lossGold: number | null };
  replayUrl: string | null;
  patch: { id: number; name: string } | null;
  // What the players typed and the chat wheel calls (the wheel's phrase in English), from OpenDota.
  chat: { t: number; slot: number; wheel: boolean; text: string }[];
};

const KEY_ITEM_COST = 1800;
const NOT_KEY = new Set([
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "tpscroll",
  "dust",
  "smoke_of_deceit",
  "aegis",
  "cheese",
  "refresher_shard",
]);

export function isKeyItemKey(key: string, consts: LabConsts) {
  const it = consts.items[key];
  return (
    !!it && !it.consumable && it.cost >= KEY_ITEM_COST && !key.startsWith("recipe_") && !NOT_KEY.has(key)
  );
}

// Total XP to reach level 6.
const LEVEL6_XP = 1760;

function levelSix(xp: number[] | undefined) {
  if (!xp?.length) return null;
  for (let m = 1; m < xp.length; m++)
    if (xp[m] >= LEVEL6_XP) {
      const f = (LEVEL6_XP - xp[m - 1]) / Math.max(1, xp[m] - xp[m - 1]);
      return Math.round((m - 1 + f) * 60);
    }
  return null;
}

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

// OpenDota's lane estimate (1 bottom, 2 mid, 3 top, 4 and 5 the jungles), when STRATZ has none.
function odLane(p: { lane?: number | null; is_roaming?: boolean | null }): LabLane {
  if (p.is_roaming) return "roam";
  if (p.lane === 1) return "bot";
  if (p.lane === 2) return "mid";
  if (p.lane === 3) return "top";
  if (p.lane === 4 || p.lane === 5) return "jungle";
  return null;
}

function laneOf(lane: string | null | undefined, radiant: boolean): LabLane {
  if (lane === "MID_LANE") return "mid";
  if (lane === "SAFE_LANE") return radiant ? "bot" : "top";
  if (lane === "OFF_LANE") return radiant ? "top" : "bot";
  if (lane === "JUNGLE") return "jungle";
  if (lane === "ROAMING") return "roam";
  return null;
}

// Buildings by STRATZ's npc id (the same ids every game): Radiant 16–25 towers (tier 1 top, mid,
// bot, then tier 2, tier 3, tier 4), 38–43 barracks (melee top, mid, bot, then ranged), 50 the
// Ancient; Dire 26–35, 44–49 and 51 the same way.
const BUILDING_NAMES: Record<number, string> = {};
for (const [base, rax, fort] of [
  [16, 38, 50],
  [26, 44, 51],
] as const) {
  ["top", "mid", "bot"].forEach((lane, i) => {
    BUILDING_NAMES[base + i] = `tower1_${lane}`;
    BUILDING_NAMES[base + 3 + i] = `tower2_${lane}`;
    BUILDING_NAMES[base + 6 + i] = `tower3_${lane}`;
    BUILDING_NAMES[rax + i] = `melee_rax_${lane}`;
    BUILDING_NAMES[rax + 3 + i] = `range_rax_${lane}`;
  });
  BUILDING_NAMES[base + 9] = "tower4";
  BUILDING_NAMES[fort] = "fort";
}

// Positions on a shared 10-second grid, carried forward.
function onGrid(events: { time: number; x: number; y: number }[], ts: number[]) {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const out = { x: [] as number[], y: [] as number[] };
  if (!sorted.length) return out;
  let i = 0;
  let cur = sorted[0];
  for (const t of ts) {
    while (i < sorted.length && sorted[i].time <= t) cur = sorted[i++];
    out.x.push(cur.x);
    out.y.push(cur.y);
  }
  return out;
}

export function buildMatch(
  raw: OdMatch,
  light: SzLight | null,
  heroes: Record<number, HeroInfo>,
  consts: LabConsts,
): LabMatch {
  const heroByKey = new Map(Object.entries(heroes).map(([id, h]) => [h.key, Number(id)]));
  const heroOfKey = (key: string | null | undefined) => (key ? (heroByKey.get(key) ?? null) : null);
  const slotOfHero = new Map(raw.players.map((p) => [p.hero_id, p.player_slot]));
  const lightOf = (slot: number) => light?.players.find((x) => x.playerSlot === slot);

  const players: LabMatchPlayer[] = raw.players.map((p) => {
    const l = lightOf(p.player_slot);
    const radiant = p.player_slot < 128;
    const keyItems: LabMatchPlayer["keyItems"] = [];
    for (const b of p.purchase_log ?? [])
      if (isKeyItemKey(b.key, consts) && !keyItems.some((k) => k.key === b.key))
        keyItems.push({ t: b.time, key: b.key });
    const last = (arr: number[] | undefined) => (arr?.length ? arr[arr.length - 1] : 0);
    return {
      slot: p.player_slot,
      heroId: p.hero_id,
      radiant,
      name: p.name ?? p.personaname ?? null,
      accountId: p.account_id && p.account_id !== 4294967295 ? p.account_id : null,
      position: Number(l?.position?.replace("POSITION_", "")) || null,
      lane: laneOf(l?.lane, radiant) ?? odLane(p),
      seasonRank: l?.steamAccount?.seasonRank ?? null,
      smurf: l?.steamAccount?.smurfFlag ?? null,
      heroXp: l?.dotaPlusHeroXp ?? null,
      party: l?.partyId ?? null,
      imp: l?.imp ?? null,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      lastHits: p.last_hits,
      denies: p.denies,
      heroDamage: p.hero_damage ?? 0,
      towerDamage: p.tower_damage ?? 0,
      healing: p.hero_healing ?? 0,
      totalGold: p.total_gold ?? null,
      netWorth: p.net_worth ?? last(p.networth_t),
      gpm: p.gold_per_min,
      xpm: p.xp_per_min,
      stuns: p.stuns ?? null,
      campsStacked: p.camps_stacked ?? 0,
      observers: p.obs_placed ?? p.obs_log?.length ?? 0,
      sentries: p.sen_placed ?? p.sen_log?.length ?? 0,
      level: p.level,
      curves: {
        nw: p.networth_t ?? p.gold_t ?? [],
        xp: p.xp_t ?? [],
        lh: p.lh_t ?? [],
        dn: p.dn_t ?? [],
        gold: p.gold_t ?? [],
      },
      keyItems,
      level6: levelSix(p.xp_t),
      runes: (p.runes_log ?? []).map((r) => ({ t: r.time, rune: OD_RUNES[r.key] ?? r.key })),
    };
  });

  // Everyone's positions on one grid.
  const allPos = (light?.players ?? []).map((x) => ({
    slot: x.playerSlot,
    events: x.playbackData?.playerUpdatePositionEvents ?? [],
  }));
  const first = Math.min(...allPos.flatMap((x) => (x.events.length ? [x.events[0].time] : [])), 0);
  const ts: number[] = [];
  if (allPos.some((x) => x.events.length))
    for (let t = Math.ceil(first / 10) * 10; t <= raw.duration; t += 10) ts.push(t);
  const grid = {
    t: ts,
    pos: Object.fromEntries(allPos.map((x) => [String(x.slot), onGrid(x.events, ts)])),
  };

  // Every death, with the heroes credited (the killer's and helpers' events at the same second).
  type Ev = { hero: number; t: number; target: number };
  const kills: Ev[] = [];
  const assists: Ev[] = [];
  for (const x of light?.players ?? []) {
    for (const k of x.playbackData?.killEvents ?? [])
      kills.push({ hero: x.heroId, t: k.time, target: k.target });
    for (const a of x.playbackData?.assistEvents ?? [])
      assists.push({ hero: x.heroId, t: a.time, target: a.target });
  }
  const near = (a: number, b: number) => Math.abs(a - b) <= 2;
  const deaths: LabMatchDeath[] = [];
  for (const x of light?.players ?? [])
    for (const d of x.playbackData?.deathEvents ?? []) {
      const credited = [...kills, ...assists].filter((e) => near(e.t, d.time) && e.target === x.heroId);
      deaths.push({
        t: d.time,
        slot: x.playerSlot,
        hero: x.heroId,
        killer: d.attacker && heroes[d.attacker] ? d.attacker : null,
        involved: [...new Set(credited.map((e) => e.hero))],
        x: d.positionX ?? null,
        y: d.positionY ?? null,
      });
    }
  // Without STRATZ: OpenDota's death logs (killer only, no place).
  if (!deaths.length)
    for (const p of raw.players)
      for (const d of p.deaths_log ?? []) {
        const killer = heroOfKey(d.key);
        deaths.push({
          t: d.time,
          slot: p.player_slot,
          hero: p.hero_id,
          killer,
          involved: killer ? [killer] : [],
          x: null,
          y: null,
        });
      }
  deaths.sort((a, b) => a.t - b.t);

  // Buildings: the header rows carry type and place; later rows only health, by index.
  const header = new Map<number, Omit<LabBuilding, "name">>();
  for (const e of light?.playbackData?.buildingEvents ?? []) {
    if (e.type && !header.has(e.indexId)) {
      const type =
        e.type === "TOWER"
          ? "tower"
          : e.type === "BARRACKS"
            ? "barracks"
            : e.type === "FORT"
              ? "fort"
              : e.type === "OUTPOST"
                ? "outpost"
                : "other";
      header.set(e.indexId, {
        id: e.indexId,
        npc: e.npcId ?? 0,
        type,
        radiant: !!e.isRadiant,
        x: e.positionX ?? 0,
        y: e.positionY ?? 0,
        maxHp: e.maxHp ?? e.hp ?? 0,
        hp: [],
        died: null,
      });
    }
    const b = header.get(e.indexId);
    if (b && e.hp != null) {
      const prev = b.hp[b.hp.length - 1];
      if (!prev || prev[1] !== e.hp) b.hp.push([e.time, e.hp]);
      if (e.hp <= 0 && b.died == null) b.died = e.time;
    }
  }
  const buildings: LabBuilding[] = [...header.values()].map((b) => ({
    ...b,
    name: BUILDING_NAMES[b.npc] ?? null,
  }));

  // Every ward placed (OpenDota's logs for all ten), with who destroyed it before it expired.
  const wards: LabMatchWard[] = [];
  for (const p of raw.players) {
    const radiant = p.player_slot < 128;
    for (const [kind, log, left] of [
      ["obs", p.obs_log, p.obs_left_log],
      ["sen", p.sen_log, p.sen_left_log],
    ] as const)
      for (const w of log ?? []) {
        const gone = (left ?? []).find((l) => l.ehandle != null && l.ehandle === w.ehandle);
        const lived = gone ? gone.time - w.time : null;
        const full = kind === "obs" ? 360 : 420;
        const byHero = gone?.attackername ? heroOfKey(gone.attackername) : null;
        const bySlot = byHero != null ? (slotOfHero.get(byHero) ?? null) : null;
        wards.push({
          kind,
          radiant,
          slot: p.player_slot,
          x: w.x,
          y: w.y,
          t: w.time,
          end: gone?.time ?? null,
          destroyedBy:
            bySlot != null && bySlot < 128 !== radiant && lived != null && lived < full - 3 ? bySlot : null,
        });
      }
  }
  wards.sort((a, b) => a.t - b.t);

  const objectives: LabObjective[] = [];
  for (const o of raw.objectives ?? []) {
    const slot = o.player_slot ?? null;
    const bySlot = slot != null ? slot < 128 : null;
    const team = o.team === 2 ? true : o.team === 3 ? false : null;
    if (o.type === "building_kill" && typeof o.key === "string")
      objectives.push({
        t: o.time,
        type: "building",
        // The side that destroyed it: the other side from the building's own.
        radiant: o.key.includes("badguys") ? true : o.key.includes("goodguys") ? false : null,
        slot,
        key: o.key,
        value: null,
      });
    else if (o.type === "CHAT_MESSAGE_ROSHAN_KILL")
      objectives.push({ t: o.time, type: "roshan", radiant: team, slot: null, key: null, value: null });
    else if (o.type === "CHAT_MESSAGE_AEGIS")
      objectives.push({ t: o.time, type: "aegis", radiant: bySlot, slot, key: null, value: null });
    else if (o.type === "CHAT_MESSAGE_AEGIS_STOLEN")
      objectives.push({ t: o.time, type: "aegisStolen", radiant: bySlot, slot, key: null, value: null });
    else if (o.type === "CHAT_MESSAGE_DENIED_AEGIS")
      objectives.push({ t: o.time, type: "aegisDenied", radiant: bySlot, slot, key: null, value: null });
    else if (o.type === "CHAT_MESSAGE_MINIBOSS_KILL")
      objectives.push({
        t: o.time,
        type: "tormentor",
        radiant: team ?? bySlot,
        slot,
        key: null,
        value: null,
      });
    else if (o.type === "CHAT_MESSAGE_COURIER_LOST")
      objectives.push({
        t: o.time,
        type: "courier",
        radiant: team,
        // The killer is an index into the players list.
        slot: typeof o.killer === "number" ? (raw.players[o.killer]?.player_slot ?? null) : null,
        key: null,
        value: typeof o.value === "number" ? o.value : null,
      });
    else if (o.type === "CHAT_MESSAGE_FIRSTBLOOD")
      objectives.push({ t: o.time, type: "firstBlood", radiant: bySlot, slot, key: null, value: null });
  }

  const teamfights: LabMatchFight[] = (raw.teamfights ?? []).map((f) => ({
    start: f.start,
    end: f.end,
    deaths: f.deaths,
    players: f.players.map((x, i) => ({
      slot: raw.players[i]?.player_slot ?? i,
      damage: x.damage,
      healing: x.healing,
      gold: x.gold_delta,
      xp: x.xp_delta,
      deaths: x.deaths,
      kills: Object.values(x.killed ?? {}).reduce((s, v) => s + v, 0),
      xpStart: x.xp_start ?? null,
      xpEnd: x.xp_end ?? null,
      abilities: x.ability_uses ?? {},
      items: x.item_uses ?? {},
    })),
  }));

  const disconnects: LabMatch["disconnects"] = [];
  for (const p of raw.players)
    for (const c of p.connection_log ?? [])
      disconnects.push({ t: c.time, slot: p.player_slot, event: c.event ?? "" });

  const grades = new Map(
    (light?.pickBans ?? []).filter((x) => x.isPick && x.heroId).map((x) => [x.heroId!, x] as const),
  );
  const draft = (raw.picks_bans ?? []).map((d) => {
    const g = d.is_pick ? grades.get(d.hero_id) : undefined;
    return {
      hero: d.hero_id,
      radiant: d.team === 0,
      pick: d.is_pick,
      order: d.order,
      base: g?.baseWinRate ?? null,
      adjusted: g?.adjustedWinRate ?? null,
    };
  });

  const patchName = raw.patch != null ? (consts.patches[String(raw.patch)]?.name ?? null) : null;
  return {
    players,
    grid,
    deaths,
    buildings,
    wards,
    objectives,
    teamfights,
    pauses: (raw.pauses ?? []).map((x) => ({ t: x.time, d: x.duration })),
    disconnects,
    leavers: raw.players.filter((p) => (p.leaver_status ?? 0) >= 2).map((p) => p.player_slot),
    draft,
    predictedWin: light?.predictedWinRates ?? [],
    radiantGoldAdv: raw.radiant_gold_adv ?? [],
    radiantXpAdv: raw.radiant_xp_adv ?? [],
    shape: { throwGold: raw.throw ?? null, lossGold: raw.loss ?? null },
    replayUrl: raw.replay_url ?? null,
    patch: raw.patch != null && patchName ? { id: raw.patch, name: patchName } : null,
    chat: (raw.chat ?? []).flatMap((c) => {
      if (c.player_slot == null || (c.type !== "chat" && c.type !== "chatwheel")) return [];
      const wheel = c.type === "chatwheel";
      const text = wheel ? consts.chatWheel[String(c.key)] : String(c.key);
      return text ? [{ t: c.time, slot: c.player_slot, wheel, text }] : [];
    }),
  };
}

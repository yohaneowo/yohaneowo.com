import "server-only";
import type { LabBaseline } from "./lab-refs";
import { mapZone } from "./map";

export type { BaselineKey, LabBaseline } from "./lab-refs";

// 局内科研's deeper layer: the game's context (win probability, leads, lane outcomes, the draft),
// gold and XP by source over time, gold left unspent, every hero damage and heal instance,
// inventories over time, mana, attack power, and what's worked out from them — how the time was
// spent, who was nearby, each teamfight and each death in detail. Fed by lab.ts.

// What lab.ts adds to its STRATZ queries for this layer: match fields, fields for every player, and
// the studied player's events and stats.
export const LIGHT_EXTRA =
  "winRates radiantNetworthLeads radiantExperienceLeads bottomLaneOutcome midLaneOutcome topLaneOutcome gameVersionId predictedWinRates pickBans { isPick heroId order isRadiant baseWinRate adjustedWinRate } playbackData { buildingEvents { time indexId type hp maxHp positionX positionY isRadiant npcId } }";
export const LIGHT_PLAYER_EXTRA =
  "partyId imp dotaPlusHeroXp steamAccount { seasonRank smurfFlag isAnonymous }";
export const LIGHT_PLAYBACK_EXTRA = "healEvents { time attacker target value byAbility byItem }";
const SLOT = "{ itemId charges }";
export const HEAVY_EXTRA = `goldEvents { time amount reason } experienceEvents { time amount reason } heroDamageEvents { time attacker target value byAbility byItem damageType isPhysicalAttack isSourceMainHero isTargetMainHero fromIllusion } inventoryEvents { time item0 ${SLOT} item1 ${SLOT} item2 ${SLOT} item3 ${SLOT} item4 ${SLOT} item5 ${SLOT} backPack0 ${SLOT} backPack1 ${SLOT} backPack2 ${SLOT} teleport0 ${SLOT} neutral0 ${SLOT} } playerUpdateGoldEvents { time gold unreliableGold networth } playerUpdateAttributeEvents { time agi int str } playerUpdateBattleEvents { time damageMinMax damageBonus hpRegen mpRegen } towerDamageEvents { time npcId damage byAbility byItem }`;
export const STATS_EXTRA =
  "actionsPerMinute heroDamageReport { dealtTotal { physicalDamage magicalDamage pureDamage selfHeal allyHeal stunCount stunDuration disableCount disableDuration slowCount slowDuration } receivedTotal { physicalDamage magicalDamage pureDamage heal stunCount stunDuration disableCount disableDuration slowCount slowDuration } }";

export type SzLightExtra = {
  winRates: number[] | null;
  radiantNetworthLeads: number[] | null;
  radiantExperienceLeads: number[] | null;
  bottomLaneOutcome: string | null;
  midLaneOutcome: string | null;
  topLaneOutcome: string | null;
  gameVersionId: number | null;
  predictedWinRates: number[] | null;
  pickBans:
    | {
        isPick: boolean;
        heroId: number | null;
        order: number | null;
        isRadiant: boolean | null;
        baseWinRate: number | null;
        adjustedWinRate: number | null;
      }[]
    | null;
  playbackData: {
    buildingEvents:
      | {
          time: number;
          indexId: number;
          type: string | null;
          hp: number | null;
          maxHp: number | null;
          positionX: number | null;
          positionY: number | null;
          isRadiant: boolean | null;
          npcId: number | null;
        }[]
      | null;
  } | null;
};
export type SzLightPlayerExtra = {
  partyId: number | null;
  imp: number | null;
  dotaPlusHeroXp: number | null;
  steamAccount: { seasonRank: number | null; smurfFlag: number | null; isAnonymous: boolean | null } | null;
};
export type SzHeal = {
  time: number;
  attacker: number;
  target: number;
  value: number;
  byAbility: number | null;
  byItem: number | null;
};
type Slot = { itemId: number | null; charges: number | null } | null;
export type SzDamage = {
  time: number;
  attacker: number;
  target: number;
  value: number;
  byAbility: number | null;
  byItem: number | null;
  damageType: string | null;
  isPhysicalAttack: boolean | null;
  isSourceMainHero: boolean | null;
  isTargetMainHero: boolean | null;
  fromIllusion?: boolean | null;
};
export type SzHeavyExtra = {
  goldEvents: { time: number; amount: number; reason: string }[] | null;
  experienceEvents: { time: number; amount: number; reason: string }[] | null;
  heroDamageEvents: SzDamage[] | null;
  inventoryEvents:
    | {
        time: number;
        item0: Slot;
        item1: Slot;
        item2: Slot;
        item3: Slot;
        item4: Slot;
        item5: Slot;
        backPack0: Slot;
        backPack1: Slot;
        backPack2: Slot;
        teleport0: Slot;
        neutral0: Slot;
      }[]
    | null;
  playerUpdateGoldEvents: { time: number; gold: number; unreliableGold: number; networth: number }[] | null;
  playerUpdateAttributeEvents: { time: number; agi: number; int: number; str: number }[] | null;
  playerUpdateBattleEvents:
    { time: number; damageMinMax: number; damageBonus: number; hpRegen: number; mpRegen: number }[] | null;
  towerDamageEvents:
    | {
        time: number;
        npcId: number | null;
        damage: number;
        byAbility: number | null;
        byItem: number | null;
      }[]
    | null;
};
export type SzStatsExtra = {
  actionsPerMinute: number[] | null;
  heroDamageReport: {
    dealtTotal: Record<string, number | null> | null;
    receivedTotal: Record<string, number | null> | null;
  } | null;
};

// ── The result ───────────────────────────────────────────────────────────────────────────────

export type LaneResult = "stompWin" | "win" | "tie" | "loss" | "stompLoss";
export type GoldSource =
  | "creeps"
  | "neutrals"
  | "heroes"
  | "buildings"
  | "roshan"
  | "runes"
  | "couriers"
  | "wards"
  | "passive"
  | "other";
export type XpSource = "heroes" | "creeps" | "roshan" | "other";
export type Activity = "dead" | "fight" | "farmLane" | "farmJungle" | "base" | "move";

export type LabDamage = {
  t: number;
  out: boolean;
  hero: number;
  v: number;
  by: string | null;
  // 0 right-click, 1 physical spell, 2 magical, 3 pure.
  type: 0 | 1 | 2 | 3;
  // Dealt by (or to) an illusion or another unit the hero controls.
  ill?: boolean;
};

export type LabHeal = { t: number; hero: number; v: number; by: string | null };

export type LabFightDetail = {
  // Index into fights.teamfights.
  idx: number;
  // Nearest enemy at the start, the closest the player got and the average over the fight (game units).
  distEnemy: number | null;
  closest: number | null;
  avgDist: number | null;
  // Seconds after the start when the player first came within reach (null: never).
  arrival: number | null;
  // 1 = the nearest of the team to the enemy when the fight began, and how many teammates were ranked.
  frontRank: number | null;
  frontOf: number;
  // The player's first hit came before any teammate's.
  firstOnTeam: boolean | null;
  // An ability or item used during the fight within reach of an enemy (support work counts as taking
  // part even without damage).
  usedNearEnemy: boolean;
  alliesNear: number;
  enemiesNear: number;
  firstDealt: number | null;
  firstTaken: number | null;
  burst: number;
  dealt: number;
  taken: number;
  abilities: { key: string; count: number }[];
  items: { key: string; count: number }[];
  carried: string[];
};

export type LabDeathDetail = {
  t: number;
  kind: "fight" | "gank" | "pickoff" | "other";
  alliesNear: number | null;
  enemiesNear: number | null;
  // Buyback affordable and off cooldown.
  buyback: boolean | null;
  // Team win chance a minute after against a minute before (the whole team's swing, not this death's).
  swing: number | null;
  netWorth: number | null;
  unspent: number | null;
  goldLost: number | null;
  goldFed: number | null;
  xpFed: number | null;
  timeDead: number | null;
  // Farm the player would have had while dead (their recent farm rate × time dead).
  farmMissed: number | null;
  // The enemy's objectives during the respawn time.
  objectivesLost: { t: number; type: string; key: string | null }[];
  // Gold equivalent: gold lost + farm missed.
  cost: number | null;
};

export type LabInventory = {
  t: number;
  items: (string | null)[];
  charges: (number | null)[];
  backpack: (string | null)[];
  neutral: string | null;
  tp: number | null;
};

export type LabAdvanced = {
  context: {
    winProb: number[];
    nwLead: number[];
    xpLead: number[];
    laneOutcome: LaneResult | null;
    lanes: { lane: "top" | "mid" | "bot"; outcome: LaneResult }[];
    draft: { hero: number; ours: boolean; pick: boolean; order: number }[];
    // STRATZ (true) or OpenDota's advantage curves (false) behind the leads.
    fromStratz: boolean;
  };
  baseline: LabBaseline | null;
  goldByMinute: Record<GoldSource, number[]>;
  xpByMinute: Record<XpSource, number[]>;
  // On the path's 10-second grid (same t as path.t).
  unspent: number[];
  activity: Activity[];
  alliesNear: number[];
  enemiesNear: number[];
  attributes: { str: number[]; agi: number[]; int: number[] };
  // Per minute: attack damage (base and bonus), health and mana regeneration.
  battle: { damage: number[]; bonus: number[]; hpRegen: number[]; mpRegen: number[] };
  // Per minute: lowest and average mana (fraction of max), and seconds alive under 20% mana.
  mana: { min: number[]; avg: number[]; lowSeconds: number };
  apm: number[];
  // Heals the player received from someone or something (not natural regeneration) per minute, and
  // the heals themselves both ways.
  healIn: number[];
  heals: { received: LabHeal[]; given: LabHeal[]; regen: number };
  damage: LabDamage[];
  towerHits: { t: number; npc: number | null; v: number }[];
  report: { dealt: Record<string, number>; received: Record<string, number> } | null;
  inventory: LabInventory[];
  cooldowns: Record<string, number[]>;
  fightDetails: LabFightDetail[];
  deathDetails: LabDeathDetail[];
};

// ── Working it out ───────────────────────────────────────────────────────────────────────────

// Gold that counts as earned (sells and the starting gold are not income).
const GOLD_REASON: Record<string, GoldSource> = {
  CREEPS: "creeps",
  NEUTRAL: "neutrals",
  HEROES: "heroes",
  STRUCTURES: "buildings",
  ROSHAN: "roshan",
  BOUNTY: "runes",
  COURIERS: "couriers",
  COURIERS_2: "couriers",
  WARD_DESTRUCTION: "wards",
  DOOM_DEVOURER: "other",
};
const XP_REASON: Record<string, XpSource> = { HEROES: "heroes", CREEPS: "creeps", ROSHAN: "roshan" };

function laneResult(outcome: string | null | undefined, radiant: boolean): LaneResult | null {
  if (!outcome) return null;
  if (outcome === "TIE") return "tie";
  const radiantWon = outcome.startsWith("RADIANT");
  const stomp = outcome.endsWith("STOMP");
  const won = radiantWon === radiant;
  return won ? (stomp ? "stompWin" : "win") : stomp ? "stompLoss" : "loss";
}

// Within this many map cells (about 1,500 units) counts as nearby; map cells are ~128 units.
const NEAR = 12;
const CELL = 128;
// Buyback cooldown (seconds) and cost formula.
const BUYBACK_COOLDOWN = 480;
export const buybackCost = (netWorth: number) => 200 + netWorth / 13;

type Pos = { time: number; x: number; y: number };
type Grid = Map<number, { x: number; y: number }>;

// Positions on the 10-second grid, carried forward.
function grid(events: Pos[], duration: number): Grid {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const out: Grid = new Map();
  if (!sorted.length) return out;
  let i = 0;
  let cur = sorted[0];
  for (let t = Math.ceil(sorted[0].time / 10) * 10; t <= duration; t += 10) {
    while (i < sorted.length && sorted[i].time <= t) cur = sorted[i++];
    out.set(t, { x: cur.x, y: cur.y });
  }
  return out;
}

// The position at any second: between two updates, linearly.
function exactAt(sorted: Pos[], t: number): { x: number; y: number } | null {
  if (!sorted.length) return null;
  if (t <= sorted[0].time) return sorted[0];
  let lo = 0;
  let hi = sorted.length - 1;
  if (t >= sorted[hi].time) return sorted[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].time <= t) lo = mid;
    else hi = mid;
  }
  const a = sorted[lo];
  const b = sorted[hi];
  const f = (t - a.time) / Math.max(1, b.time - a.time);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

// Events in the same second with the same key, summed (keeps the order).
function bySecond<T extends { t: number; v: number }>(list: T[], key: (x: T) => string): T[] {
  const out: T[] = [];
  const at = new Map<string, T>();
  for (const x of list) {
    const k = key(x);
    const prev = at.get(k);
    if (prev) prev.v += x.v;
    else {
      const copy = { ...x };
      at.set(k, copy);
      out.push(copy);
    }
  }
  return out;
}

export type ExtraInput = {
  duration: number;
  radiant: boolean;
  heroId: number;
  slot: number;
  teamHeroes: number[];
  foeHeroes: number[];
  path: { t: number[]; x: number[]; y: number[] };
  // Everyone's positions (STRATZ), by slot and side.
  everyone: { slot: number; heroId: number; radiant: boolean; positions: Pos[] }[];
  // Hero damage dealt by the enemies (the player's damage taken is in their lists) and by allies
  // (to tell who hit first).
  enemyDamage: SzDamage[];
  allyDamage: SzDamage[];
  // Everyone's heals.
  heals: SzHeal[];
  light: SzLightExtra | null;
  heavy:
    | (SzHeavyExtra & {
        csEvents?: { time: number; isNeutral: boolean | null; isAncient: boolean | null }[] | null;
        playerUpdateHealthEvents?:
          { time: number; hp: number; maxHp: number; mp: number; maxMp: number }[] | null;
      })
    | null;
  stats: SzStatsExtra | null;
  odPicks: { is_pick: boolean; hero_id: number; team: number; order: number }[] | null;
  // OpenDota's Radiant gold and XP advantage (the leads when STRATZ has none).
  odGoldAdv: number[];
  odXpAdv: number[];
  odTeamfights: {
    start: number;
    end: number;
    players: { ability_uses?: Record<string, number>; item_uses?: Record<string, number> }[];
  }[];
  index: number;
  teamfights: { start: number; end: number; joined: boolean }[];
  deaths: {
    t: number;
    timeDead: number | null;
    enemies: number[];
    goldLost: number | null;
    goldFed: number | null;
    xpFed: number | null;
  }[];
  buybacks: number[];
  // Every hero death in the match with its place (for where each fight was decided).
  fightDeaths: { t: number; x: number; y: number }[];
  // The enemy's objectives (for what the player's deaths let them take).
  enemyObjectives: { t: number; type: string; key: string | null }[];
  fightTimes: number[];
  // Times of the player's ability and item uses (not Power Treads switches), from STRATZ.
  useTimes: number[];
  netWorth: number[];
  // Earned gold not logged as any reason (passive income), spread evenly over the game.
  passiveGold: number;
  laneAbs: "top" | "mid" | "bot" | "jungle" | "roam" | null;
  itemKey: (id: number | null | undefined) => string | null;
  abilityKey: (id: number | null | undefined) => string | null;
  baseline: LabBaseline | null;
  cooldowns: Record<string, number[]>;
};

export function buildExtra(x: ExtraInput): LabAdvanced {
  const { duration, radiant, path } = x;
  const minutes = Math.floor(duration / 60) + 1;
  const zeros = () => Array.from({ length: minutes }, () => 0);
  const minuteOf = (t: number) => Math.min(minutes - 1, Math.max(0, Math.floor(t / 60)));
  const side = (v: number) => (radiant ? v : -v);

  // Context: STRATZ's leads, else OpenDota's.
  const fromStratz = !!x.light?.radiantNetworthLeads?.length;
  const winProb = (x.light?.winRates ?? []).map((w) => (radiant ? w : 1 - w));
  // STRATZ's leads are one minute late, like its heroStats rows (index k is the state at (k − 1):00:
  // shifted by one they equal the ten players' net worth sums exactly); its win rates and OpenDota's
  // advantages are on time.
  const nwLead = (fromStratz ? (x.light?.radiantNetworthLeads ?? []).slice(1) : x.odGoldAdv).map(side);
  const xpLead = (
    x.light?.radiantExperienceLeads?.length ? x.light.radiantExperienceLeads.slice(1) : x.odXpAdv
  ).map(side);
  const lanes = (
    [
      ["top", x.light?.topLaneOutcome],
      ["mid", x.light?.midLaneOutcome],
      ["bot", x.light?.bottomLaneOutcome],
    ] as const
  )
    .map(([lane, o]) => ({ lane, outcome: laneResult(o, radiant) }))
    .filter((l): l is { lane: "top" | "mid" | "bot"; outcome: LaneResult } => l.outcome != null);
  const laneOutcome = lanes.find((l) => l.lane === x.laneAbs)?.outcome ?? null;
  const draft = (x.odPicks ?? []).map((d) => ({
    hero: d.hero_id,
    ours: (d.team === 0) === radiant,
    pick: d.is_pick,
    order: d.order,
  }));

  // Gold and XP by source, per minute; passive income evenly.
  const goldByMinute = Object.fromEntries(
    [
      "creeps",
      "neutrals",
      "heroes",
      "buildings",
      "roshan",
      "runes",
      "couriers",
      "wards",
      "passive",
      "other",
    ].map((k) => [k, zeros()]),
  ) as Record<GoldSource, number[]>;
  for (const g of x.heavy?.goldEvents ?? []) {
    if (g.amount <= 0 || g.time < 0) continue;
    const kind = GOLD_REASON[g.reason];
    if (kind) goldByMinute[kind][minuteOf(g.time)] += g.amount;
  }
  if (x.heavy?.goldEvents?.length && x.passiveGold > 0) {
    const perSecond = x.passiveGold / Math.max(1, duration);
    for (let m = 0; m < minutes; m++)
      goldByMinute.passive[m] = Math.round(perSecond * Math.max(0, Math.min(60, duration - m * 60)));
  }
  const xpByMinute = Object.fromEntries(
    ["heroes", "creeps", "roshan", "other"].map((k) => [k, zeros()]),
  ) as Record<XpSource, number[]>;
  for (const e of x.heavy?.experienceEvents ?? []) {
    if (e.amount <= 0) continue;
    xpByMinute[XP_REASON[e.reason] ?? "other"][minuteOf(e.time)] += e.amount;
  }

  // Gold on hand on the path's grid.
  const goldEvents = [...(x.heavy?.playerUpdateGoldEvents ?? [])].sort((a, b) => a.time - b.time);
  const unspent: number[] = [];
  {
    let i = 0;
    let cur = 0;
    for (const t of path.t) {
      while (i < goldEvents.length && goldEvents[i].time <= t) {
        cur = goldEvents[i].gold + goldEvents[i].unreliableGold;
        i++;
      }
      unspent.push(cur);
    }
  }
  const onHandAt = (t: number) => {
    let cur: number | null = null;
    for (const g of goldEvents) {
      if (g.time > t) break;
      cur = g.gold + g.unreliableGold;
    }
    return cur;
  };

  // Attributes, attack power and regeneration, per minute (the last value in each minute).
  const carry = (list: number[]) => {
    for (let m = 1; m < list.length; m++) if (!list[m]) list[m] = list[m - 1];
    return list;
  };
  const attributes = { str: zeros(), agi: zeros(), int: zeros() };
  for (const a of [...(x.heavy?.playerUpdateAttributeEvents ?? [])].sort((p, q) => p.time - q.time)) {
    const m = minuteOf(a.time);
    attributes.str[m] = a.str;
    attributes.agi[m] = a.agi;
    attributes.int[m] = a.int;
  }
  for (const k of ["str", "agi", "int"] as const) carry(attributes[k]);
  const battle = { damage: zeros(), bonus: zeros(), hpRegen: zeros(), mpRegen: zeros() };
  for (const b of [...(x.heavy?.playerUpdateBattleEvents ?? [])].sort((p, q) => p.time - q.time)) {
    const m = minuteOf(b.time);
    battle.damage[m] = b.damageMinMax;
    battle.bonus[m] = b.damageBonus;
    battle.hpRegen[m] = b.hpRegen;
    battle.mpRegen[m] = b.mpRegen;
  }
  for (const k of ["damage", "bonus", "hpRegen", "mpRegen"] as const) carry(battle[k]);

  // Mana, from the health updates.
  const health = (x.heavy?.playerUpdateHealthEvents ?? []).filter((h) => h.time >= 0 && h.maxMp > 0);
  const manaMin = zeros().map(() => 1);
  const manaSum = zeros();
  const manaN = zeros();
  let lowSeconds = 0;
  health.forEach((h, i) => {
    const m = minuteOf(h.time);
    const f = h.mp / h.maxMp;
    manaMin[m] = Math.min(manaMin[m], f);
    manaSum[m] += f;
    manaN[m]++;
    const next = health[i + 1];
    if (next && f < 0.2 && h.hp > 0) lowSeconds += Math.min(10, next.time - h.time);
  });
  const mana = health.length
    ? { min: manaMin, avg: manaSum.map((s, i) => (manaN[i] ? s / manaN[i] : 1)), lowSeconds }
    : { min: [], avg: [], lowSeconds: 0 };

  // Heals: received from the player's own items and abilities and from teammates (natural and
  // fountain regeneration, with no source, apart), and given to allies. Sources: an ability or item key, hero = who healed (or was healed).
  const received: LabHeal[] = [];
  const given: LabHeal[] = [];
  let regen = 0;
  for (const h of x.heals) {
    const by = x.itemKey(h.byItem) ?? x.abilityKey(h.byAbility);
    if (h.target === x.heroId) {
      const own = h.attacker === x.heroId;
      if (own ? !!by : x.teamHeroes.includes(h.attacker))
        received.push({ t: h.time, hero: h.attacker, v: h.value, by });
      else if (!by && !x.foeHeroes.includes(h.attacker)) regen += h.value;
    } else if (h.attacker === x.heroId && x.teamHeroes.includes(h.target))
      given.push({ t: h.time, hero: h.target, v: h.value, by });
  }
  received.sort((a, b) => a.t - b.t);
  given.sort((a, b) => a.t - b.t);
  const healKey = (h: LabHeal) => `${h.t}|${h.hero}|${h.by}`;
  const healIn = zeros();
  for (const h of received) if (h.t >= 0) healIn[minuteOf(h.t)] += h.v;

  // Hero damage, both ways: dealt from the player's own list (illusions and other units included,
  // flagged), taken from the enemies' lists.
  const damage: LabDamage[] = [];
  const typeOf = (d: SzDamage): LabDamage["type"] =>
    d.isPhysicalAttack ? 0 : d.damageType === "PHYSICAL" ? 1 : d.damageType === "PURE" ? 3 : 2;
  for (const d of x.heavy?.heroDamageEvents ?? []) {
    if (d.attacker !== x.heroId || d.isTargetMainHero === false) continue;
    damage.push({
      t: d.time,
      out: true,
      hero: d.target,
      v: d.value,
      by: x.itemKey(d.byItem) ?? x.abilityKey(d.byAbility),
      type: typeOf(d),
      ...(d.isSourceMainHero === false ? { ill: true } : {}),
    });
  }
  for (const d of x.enemyDamage) {
    if (d.target !== x.heroId || d.isTargetMainHero === false) continue;
    damage.push({
      t: d.time,
      out: false,
      hero: d.attacker,
      v: d.value,
      by: x.itemKey(d.byItem) ?? x.abilityKey(d.byAbility),
      type: typeOf(d),
      ...(d.isSourceMainHero === false ? { ill: true } : {}),
    });
  }
  damage.sort((a, b) => a.t - b.t);
  const damageBySecond = bySecond(
    damage,
    (d) => `${d.t}|${d.out}|${d.hero}|${d.by}|${d.type}|${d.ill ? 1 : 0}`,
  );

  const towerHits = (x.heavy?.towerDamageEvents ?? [])
    .map((e) => ({ t: e.time, npc: e.npcId, v: e.damage }))
    .sort((a, b) => a.t - b.t);

  const rep = x.stats?.heroDamageReport;
  const clean = (r: Record<string, number | null> | null | undefined) =>
    Object.fromEntries(Object.entries(r ?? {}).filter(([, v]) => v != null)) as Record<string, number>;
  const report = rep ? { dealt: clean(rep.dealtTotal), received: clean(rep.receivedTotal) } : null;

  const inventory: LabInventory[] = (x.heavy?.inventoryEvents ?? [])
    .map((e) => {
      const main = [e.item0, e.item1, e.item2, e.item3, e.item4, e.item5];
      return {
        t: e.time,
        items: main.map((s) => x.itemKey(s?.itemId)),
        charges: main.map((s) => s?.charges ?? null),
        backpack: [e.backPack0, e.backPack1, e.backPack2].map((s) => x.itemKey(s?.itemId)),
        neutral: x.itemKey(e.neutral0?.itemId),
        tp: e.teleport0?.itemId ? (e.teleport0.charges ?? 1) : null,
      };
    })
    .sort((a, b) => a.t - b.t);
  const carriedAt = (t: number) => {
    let last: LabInventory | undefined;
    for (const e of inventory) if (e.t <= t) last = e;
    return (last?.items ?? []).filter((k): k is string => !!k);
  };

  // Everyone's positions: on the grid for counts, exact for distances.
  const people = x.everyone.map((p) => ({
    ...p,
    g: grid(p.positions, duration),
    sorted: [...p.positions].sort((a, b) => a.time - b.time),
  }));
  const me = people.find((p) => p.slot === x.slot);
  const allies = people.filter((p) => p.radiant === radiant && p.slot !== x.slot);
  const enemies = people.filter((p) => p.radiant !== radiant);
  const nearAt = (t: number, list: typeof people, at: { x: number; y: number }) =>
    list.filter((p) => {
      const q = p.g.get(Math.round(t / 10) * 10);
      return q && dist(q, at) <= NEAR;
    }).length;
  const nearExact = (t: number, list: typeof people, at: { x: number; y: number }) =>
    list.filter((p) => {
      const q = exactAt(p.sorted, t);
      return q && dist(q, at) <= NEAR;
    }).length;
  const myAt = (t: number) => (me ? exactAt(me.sorted, t) : null);
  const alliesNear = path.t.map((t, i) => nearAt(t, allies, { x: path.x[i], y: path.y[i] }));
  const enemiesNear = path.t.map((t, i) => nearAt(t, enemies, { x: path.x[i], y: path.y[i] }));
  const nearestEnemy = (t: number, at: { x: number; y: number }) => {
    let best: number | null = null;
    for (const e of enemies) {
      const q = exactAt(e.sorted, t);
      if (q) best = Math.min(best ?? Infinity, dist(q, at));
    }
    return best;
  };

  // What each 10 seconds went on.
  const cs = [...(x.heavy?.csEvents ?? [])].sort((a, b) => a.time - b.time);
  const ownBase = radiant ? "radiantBase" : "direBase";
  const activity: Activity[] = path.t.map((t, i) => {
    if (x.deaths.some((d) => t > d.t && t <= d.t + (d.timeDead ?? 0))) return "dead";
    const inWindow = (v: number) => v > t - 10 && v <= t;
    // A fight: a kill, death or assist, or real trading (lane harass alone doesn't count).
    const traded = damage.filter((d) => inWindow(d.t)).reduce((sum, d) => sum + d.v, 0);
    if (x.fightTimes.some(inWindow) || traded >= 250) return "fight";
    const hits = cs.filter((c) => inWindow(c.time));
    if (hits.length) {
      const jungle = hits.filter((c) => c.isNeutral || c.isAncient).length;
      return jungle * 2 >= hits.length ? "farmJungle" : "farmLane";
    }
    if (mapZone(path.x[i], path.y[i]) === ownBase) return "base";
    return "move";
  });

  // Each teamfight in detail: positions over the whole fight, not only its first second.
  const allyFirstHits = [...x.allyDamage]
    .filter((d) => d.isTargetMainHero !== false)
    .sort((a, b) => a.time - b.time);
  const fightDetails: LabFightDetail[] = x.teamfights.map((f, idx) => {
    const start = myAt(f.start);
    const distEnemy = start ? nearestEnemy(f.start, start) : null;
    let closest: number | null = null;
    let sum = 0;
    let n = 0;
    let arrival: number | null = null;
    for (let t = f.start - 5; t <= f.end; t += 2) {
      const at = myAt(t);
      if (!at) continue;
      const d = nearestEnemy(t, at);
      if (d == null) continue;
      closest = Math.min(closest ?? Infinity, d);
      if (t >= f.start) {
        sum += d;
        n++;
      }
      if (arrival == null && d <= NEAR && t >= f.start - 5) arrival = Math.max(0, t - f.start);
    }
    // Front rank, at the first death of the fight (where it was decided): the teammates near it,
    // ranked by their distance to the nearest enemy (1 = in front).
    let frontRank: number | null = null;
    let frontOf = 0;
    const firstDeath = x.fightDeaths.find((d) => d.t >= f.start - 2 && d.t <= f.end + 2);
    if (firstDeath) {
      const t = Math.max(f.start, firstDeath.t - 3);
      const team = [me, ...allies]
        .map((p) => (p ? { slot: p.slot, at: exactAt(p.sorted, t) } : null))
        .filter((p): p is { slot: number; at: { x: number; y: number } } => !!p?.at)
        .filter((p) => dist(p.at, firstDeath) <= 20)
        .map((p) => ({ ...p, d: nearestEnemy(t, p.at) ?? Infinity }));
      frontOf = team.length;
      const i = team.sort((a, b) => a.d - b.d).findIndex((p) => p.slot === x.slot);
      frontRank = i >= 0 ? i + 1 : null;
    }
    const usedNearEnemy = x.useTimes.some((u) => {
      if (u < f.start || u > f.end) return false;
      const at = myAt(u);
      const d = at ? nearestEnemy(u, at) : null;
      return d != null && d <= NEAR;
    });
    const within = damage.filter((d) => d.t >= f.start - 3 && d.t <= f.end);
    const outs = within.filter((d) => d.out);
    const ins = within.filter((d) => !d.out);
    const allyFirst = allyFirstHits.find((d) => d.time >= f.start - 3 && d.time <= f.end);
    let burst = 0;
    for (const d of outs)
      burst = Math.max(
        burst,
        outs.filter((e) => e.t >= d.t && e.t < d.t + 3).reduce((s, e) => s + e.v, 0),
      );
    const odp = x.odTeamfights[idx]?.players[x.index];
    return {
      idx,
      distEnemy: distEnemy == null ? null : Math.round(distEnemy * CELL),
      closest: closest == null ? null : Math.round(closest * CELL),
      avgDist: n ? Math.round((sum / n) * CELL) : null,
      arrival,
      frontRank,
      frontOf,
      firstOnTeam: outs.length ? !allyFirst || outs[0].t <= allyFirst.time : null,
      usedNearEnemy,
      alliesNear: start ? nearExact(f.start, allies, start) : 0,
      enemiesNear: start ? nearExact(f.start, enemies, start) : 0,
      firstDealt: outs.length ? outs[0].t - f.start : null,
      firstTaken: ins.length ? ins[0].t - f.start : null,
      burst,
      dealt: outs.reduce((s, d) => s + d.v, 0),
      taken: ins.reduce((s, d) => s + d.v, 0),
      abilities: Object.entries(odp?.ability_uses ?? {}).map(([key, count]) => ({ key, count })),
      items: Object.entries(odp?.item_uses ?? {}).map(([key, count]) => ({ key, count })),
      carried: carriedAt(f.start),
    };
  });

  // Each death in detail: in a teamfight, a gank (two or more on them) or a pick-off; who was around
  // a second before (not after: the heroes arriving to clean up would count); whether buyback was
  // affordable and off cooldown; what it cost; what the enemy took during the respawn.
  const farmRate = (t: number) => {
    // Creep and neutral gold per minute over the five minutes before.
    const m = minuteOf(t);
    let sum = 0;
    let span = 0;
    for (let k = Math.max(0, m - 5); k < m; k++) {
      sum += goldByMinute.creeps[k] + goldByMinute.neutrals[k];
      span++;
    }
    return span ? sum / span : 0;
  };
  const deathDetails: LabDeathDetail[] = x.deaths.map((d) => {
    const at = myAt(d.t - 1);
    const inFight = x.teamfights.some((f) => d.t >= f.start - 5 && d.t <= f.end + 5);
    const kind = inFight
      ? "fight"
      : d.enemies.length >= 2
        ? "gank"
        : d.enemies.length === 1
          ? "pickoff"
          : "other";
    const m = minuteOf(d.t);
    const nw = x.netWorth[m] ?? null;
    const onHand = goldEvents.length ? onHandAt(d.t - 1) : null;
    const lastBuyback = x.buybacks.filter((b) => b < d.t).pop();
    const offCooldown = lastBuyback == null || d.t - lastBuyback >= BUYBACK_COOLDOWN;
    const farmMissed =
      d.timeDead != null && goldEvents.length ? Math.round((farmRate(d.t) * d.timeDead) / 60) : null;
    const end = d.t + (d.timeDead ?? 0);
    return {
      t: d.t,
      kind,
      alliesNear: at ? nearExact(d.t - 1, allies, at) : null,
      enemiesNear: at ? nearExact(d.t - 1, enemies, at) : null,
      buyback: onHand != null && nw != null ? onHand >= buybackCost(nw) && offCooldown : null,
      swing: winProb.length > m + 1 && m >= 1 ? winProb[m + 1] - winProb[m - 1] : null,
      netWorth: nw,
      unspent: onHand,
      goldLost: d.goldLost,
      goldFed: d.goldFed,
      xpFed: d.xpFed,
      timeDead: d.timeDead,
      farmMissed,
      objectivesLost: x.enemyObjectives.filter((o) => o.t >= d.t && o.t <= end),
      cost: d.goldLost != null || farmMissed != null ? (d.goldLost ?? 0) + (farmMissed ?? 0) : null,
    };
  });

  return {
    context: { winProb, nwLead, xpLead, laneOutcome, lanes, draft, fromStratz },
    baseline: x.baseline,
    goldByMinute,
    xpByMinute,
    unspent: goldEvents.length ? unspent : [],
    activity: path.t.length ? activity : [],
    alliesNear,
    enemiesNear,
    attributes: x.heavy?.playerUpdateAttributeEvents?.length ? attributes : { str: [], agi: [], int: [] },
    battle: x.heavy?.playerUpdateBattleEvents?.length
      ? battle
      : { damage: [], bonus: [], hpRegen: [], mpRegen: [] },
    mana,
    apm: x.stats?.actionsPerMinute ?? [],
    healIn: x.heals.length ? healIn : [],
    heals: { received: bySecond(received, healKey), given: bySecond(given, healKey), regen },
    damage: damageBySecond,
    towerHits,
    report,
    inventory,
    cooldowns: x.cooldowns,
    fightDetails,
    deathDetails,
  };
}

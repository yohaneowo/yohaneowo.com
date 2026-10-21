import "server-only";
import { cacheLife } from "next/cache";
import { getJson } from "./data";
import { mapZone } from "./map";
import { stratzQuery } from "./stratz";

// 局内科研's deeper layer: the game's context (win probability, leads, lane outcomes, the draft),
// the same hero's averages at the match's rank, gold and XP by source over time, gold left unspent,
// every hero damage instance, inventories over time, and what's worked out from them — how the
// time was spent, who was nearby, each teamfight and each death in detail. Fed by lab.ts.

const OPENDOTA = "https://api.opendota.com/api";

// What lab.ts adds to its STRATZ queries for this layer.
export const LIGHT_EXTRA =
  "winRates radiantNetworthLeads radiantExperienceLeads bottomLaneOutcome midLaneOutcome topLaneOutcome";
export const HEAVY_EXTRA =
  "goldEvents { time amount reason } experienceEvents { time amount reason } heroDamageEvents { time attacker target value byAbility byItem damageType isPhysicalAttack isSourceMainHero isTargetMainHero } inventoryEvents { time item0 { itemId } item1 { itemId } item2 { itemId } item3 { itemId } item4 { itemId } item5 { itemId } backPack0 { itemId } backPack1 { itemId } backPack2 { itemId } neutral0 { itemId } } playerUpdateGoldEvents { time gold unreliableGold networth } playerUpdateAttributeEvents { time agi int str } healEvents { time value }";
export const STATS_EXTRA =
  "heroDamageReport { dealtTotal { physicalDamage magicalDamage pureDamage selfHeal allyHeal stunCount stunDuration disableCount disableDuration slowCount slowDuration } receivedTotal { physicalDamage magicalDamage pureDamage heal stunCount stunDuration disableCount disableDuration slowCount slowDuration } }";

export type SzLightExtra = {
  winRates: number[] | null;
  radiantNetworthLeads: number[] | null;
  radiantExperienceLeads: number[] | null;
  bottomLaneOutcome: string | null;
  midLaneOutcome: string | null;
  topLaneOutcome: string | null;
};
type Slot = { itemId: number | null } | null;
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
};
export type SzHeavyExtra = {
  goldEvents: { time: number; amount: number; reason: string }[] | null;
  experienceEvents: { time: number; amount: number; reason: string }[] | null;
  heroDamageEvents:
    | {
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
      }[]
    | null;
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
        neutral0: Slot;
      }[]
    | null;
  playerUpdateGoldEvents: { time: number; gold: number; unreliableGold: number; networth: number }[] | null;
  playerUpdateAttributeEvents: { time: number; agi: number; int: number; str: number }[] | null;
  healEvents: { time: number; value: number }[] | null;
};
export type SzStatsExtra = {
  heroDamageReport: {
    dealtTotal: Record<string, number | null> | null;
    receivedTotal: Record<string, number | null> | null;
  } | null;
};

// ── The result ───────────────────────────────────────────────────────────────────────────────

export type LaneResult = "stompWin" | "win" | "tie" | "loss" | "stompLoss";
export type GoldSource =
  "creeps" | "neutrals" | "heroes" | "buildings" | "roshan" | "runes" | "couriers" | "wards" | "other";
export type XpSource = "heroes" | "creeps" | "roshan" | "other";
export type Activity = "dead" | "fight" | "farmLane" | "farmJungle" | "base" | "move";

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
  | "stunDuration";

export type LabBaseline = {
  bracket: string;
  position: number | null;
  matches: number;
  winRate: number | null;
  // Per minute (index = minute), cumulative like the player's curves.
  minutes: Record<BaselineKey, (number | null)[]>;
  // Item key → average first purchase (seconds) and how often it's bought.
  items: Record<string, { time: number; rate: number }>;
};

export type LabDamage = {
  t: number;
  out: boolean;
  hero: number;
  v: number;
  by: string | null;
  // 0 right-click, 1 physical spell, 2 magical, 3 pure.
  type: 0 | 1 | 2 | 3;
};

export type LabFightDetail = {
  // Index into fights.teamfights.
  idx: number;
  distEnemy: number | null;
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
  buyback: boolean | null;
  swing: number | null;
  netWorth: number | null;
  unspent: number | null;
};

export type LabAdvanced = {
  context: {
    winProb: number[];
    nwLead: number[];
    xpLead: number[];
    laneOutcome: LaneResult | null;
    lanes: { lane: "top" | "mid" | "bot"; outcome: LaneResult }[];
    draft: { hero: number; ours: boolean; pick: boolean; order: number }[];
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
  healIn: number[];
  damage: LabDamage[];
  report: { dealt: Record<string, number>; received: Record<string, number> } | null;
  inventory: { t: number; items: (string | null)[]; backpack: (string | null)[]; neutral: string | null }[];
  cooldowns: Record<string, number[]>;
  fightDetails: LabFightDetail[];
  deathDetails: LabDeathDetail[];
};

// ── Sources outside the match ────────────────────────────────────────────────────────────────

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
];

// The hero's averages at a rank and position (STRATZ's recent ranked matches), minute by minute,
// with the usual first-purchase time of each item. Kept for a day.
export async function getLabBaseline(
  heroId: number,
  position: number | null,
  medal: number,
  itemById: Record<number, string>,
): Promise<LabBaseline | null> {
  "use cache";
  cacheLife("days");
  const bracket = BRACKETS[Math.min(8, Math.max(1, Math.trunc(medal)))] || "DIVINE_IMMORTAL";
  const where = `bracketBasicIds: [${bracket}]${position ? `, positionIds: [POSITION_${position}]` : ""}`;
  type Row = { time: number; matchCount: number; winCount: number } & Record<BaselineKey, number | null>;
  type Item = { itemId: number; instance: number | null; time: number; matchCount: number };
  const data = await stratzQuery<{ heroStats: { s: Row[] | null; i: Item[] | null } | null }>(
    `{ heroStats { s: stats(heroIds: [${Math.trunc(heroId)}], ${where}, groupByTime: true) { time matchCount winCount ${BASELINE_KEYS.join(" ")} } i: itemFullPurchase(heroId: ${Math.trunc(heroId)}, ${where}) { itemId instance time matchCount } } }`,
    20_000,
  ).catch(() => null);
  const rows = [...(data?.heroStats?.s ?? [])].sort((a, b) => a.time - b.time);
  const start = rows.find((r) => r.time === 0) ?? rows[0];
  if (!start?.matchCount) return null;
  const minutes = Object.fromEntries(
    BASELINE_KEYS.map((k) => {
      const out: (number | null)[] = [];
      for (const r of rows) out[r.time] = r[k];
      return [k, Array.from(out, (v) => v ?? null)];
    }),
  ) as Record<BaselineKey, (number | null)[]>;
  const buys = new Map<string, { count: number; minutes: number }>();
  for (const row of data?.heroStats?.i ?? []) {
    if ((row.instance ?? 0) > 1) continue;
    const key = itemById[row.itemId];
    if (!key) continue;
    const it = buys.get(key) ?? { count: 0, minutes: 0 };
    it.count += row.matchCount;
    it.minutes += row.time * row.matchCount;
    buys.set(key, it);
  }
  const items: LabBaseline["items"] = {};
  for (const [key, { count, minutes: m }] of buys)
    items[key] = { time: Math.round((m / count) * 60 + 30), rate: Math.min(1, count / start.matchCount) };
  return {
    bracket,
    position,
    matches: start.matchCount,
    winRate: start.matchCount ? start.winCount / start.matchCount : null,
    minutes,
    items,
  };
}

// Each ability's cooldown by level (OpenDota's constants), for how often it could have been cast.
export async function getCooldowns(): Promise<Record<string, number[]>> {
  "use cache";
  cacheLife("days");
  const all = await getJson<Record<string, { cd?: string | string[] | number }>>(
    `${OPENDOTA}/constants/abilities`,
  ).catch(() => ({}) as Record<string, { cd?: string | string[] | number }>);
  const out: Record<string, number[]> = {};
  for (const [key, ab] of Object.entries(all)) {
    if (ab.cd == null) continue;
    const list = (Array.isArray(ab.cd) ? ab.cd : String(ab.cd).split(/\s+/)).map(Number).filter((v) => v > 0);
    if (list.length) out[key] = list;
  }
  return out;
}

// ── Working it out ───────────────────────────────────────────────────────────────────────────

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
  OTHER: "other",
  SELLS: "other",
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

// Within this many map cells (about 1,500 units) counts as nearby.
const NEAR = 12;

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

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export type ExtraInput = {
  duration: number;
  radiant: boolean;
  heroId: number;
  slot: number;
  teamHeroes: number[];
  foeHeroes: number[];
  path: { t: number[]; x: number[]; y: number[] };
  // Everyone's positions (STRATZ), by slot and side.
  everyone: { slot: number; radiant: boolean; positions: Pos[] }[];
  // The enemies' hero damage that landed on the player.
  incoming: SzDamage[];
  light: SzLightExtra | null;
  heavy:
    | (SzHeavyExtra & {
        csEvents?: { time: number; isNeutral: boolean | null; isAncient: boolean | null }[] | null;
      })
    | null;
  stats: SzStatsExtra | null;
  odPicks: { is_pick: boolean; hero_id: number; team: number; order: number }[] | null;
  odTeamfights: {
    start: number;
    end: number;
    players: { ability_uses?: Record<string, number>; item_uses?: Record<string, number> }[];
  }[];
  index: number;
  teamfights: { start: number; end: number; joined: boolean }[];
  deaths: { t: number; timeDead: number | null; enemies: number[] }[];
  fightTimes: number[];
  netWorth: number[];
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

  // Context.
  const winProb = (x.light?.winRates ?? []).map((w) => (radiant ? w : 1 - w));
  const nwLead = (x.light?.radiantNetworthLeads ?? []).map(side);
  const xpLead = (x.light?.radiantExperienceLeads ?? []).map(side);
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

  // Gold and XP by source, per minute.
  const goldByMinute = Object.fromEntries(
    ["creeps", "neutrals", "heroes", "buildings", "roshan", "runes", "couriers", "wards", "other"].map(
      (k) => [k, zeros()],
    ),
  ) as Record<GoldSource, number[]>;
  for (const g of x.heavy?.goldEvents ?? []) {
    if (g.amount <= 0 || g.time < 0) continue;
    const kind = GOLD_REASON[g.reason];
    if (kind) goldByMinute[kind][minuteOf(g.time)] += g.amount;
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

  // Attributes and healing received, per minute.
  const attributes = { str: zeros(), agi: zeros(), int: zeros() };
  for (const a of [...(x.heavy?.playerUpdateAttributeEvents ?? [])].sort((p, q) => p.time - q.time)) {
    const m = minuteOf(a.time);
    attributes.str[m] = a.str;
    attributes.agi[m] = a.agi;
    attributes.int[m] = a.int;
  }
  for (const k of ["str", "agi", "int"] as const)
    for (let m = 1; m < minutes; m++) if (!attributes[k][m]) attributes[k][m] = attributes[k][m - 1];
  const healIn = zeros();
  for (const h of x.heavy?.healEvents ?? []) if (h.time >= 0) healIn[minuteOf(h.time)] += h.value;

  // Hero damage, both ways, main heroes only: dealt from the player's own list, taken from the
  // enemies' lists.
  const damage: LabDamage[] = [];
  for (const d of [
    ...(x.heavy?.heroDamageEvents ?? []).filter((e) => e.attacker === x.heroId),
    ...x.incoming,
  ]) {
    if (d.isSourceMainHero === false || d.isTargetMainHero === false) continue;
    const out = d.attacker === x.heroId;
    if (!out && d.target !== x.heroId) continue;
    const type: LabDamage["type"] = d.isPhysicalAttack
      ? 0
      : d.damageType === "PHYSICAL"
        ? 1
        : d.damageType === "PURE"
          ? 3
          : 2;
    damage.push({
      t: d.time,
      out,
      hero: out ? d.target : d.attacker,
      v: d.value,
      by: x.itemKey(d.byItem) ?? x.abilityKey(d.byAbility),
      type,
    });
  }
  damage.sort((a, b) => a.t - b.t);

  const rep = x.stats?.heroDamageReport;
  const clean = (r: Record<string, number | null> | null | undefined) =>
    Object.fromEntries(Object.entries(r ?? {}).filter(([, v]) => v != null)) as Record<string, number>;
  const report = rep ? { dealt: clean(rep.dealtTotal), received: clean(rep.receivedTotal) } : null;

  const inventory = (x.heavy?.inventoryEvents ?? [])
    .map((e) => ({
      t: e.time,
      items: [e.item0, e.item1, e.item2, e.item3, e.item4, e.item5].map((s) => x.itemKey(s?.itemId)),
      backpack: [e.backPack0, e.backPack1, e.backPack2].map((s) => x.itemKey(s?.itemId)),
      neutral: x.itemKey(e.neutral0?.itemId),
    }))
    .sort((a, b) => a.t - b.t);
  const carriedAt = (t: number) => {
    let last: (typeof inventory)[number] | undefined;
    for (const e of inventory) if (e.t <= t) last = e;
    return (last?.items ?? []).filter((k): k is string => !!k);
  };

  // Everyone on the grid, for who was nearby.
  const grids = x.everyone.map((p) => ({ ...p, g: grid(p.positions, duration) }));
  const allies = grids.filter((p) => p.radiant === radiant && p.slot !== x.slot);
  const enemies = grids.filter((p) => p.radiant !== radiant);
  const nearAt = (t: number, list: typeof grids, me: { x: number; y: number }) =>
    list.filter((p) => {
      const q = p.g.get(Math.round(t / 10) * 10);
      return q && dist(q, me) <= NEAR;
    }).length;
  const posAt = (t: number) => {
    let i = path.t.findIndex((v) => v >= t);
    if (i < 0) i = path.t.length - 1;
    return i >= 0 ? { x: path.x[i], y: path.y[i] } : null;
  };
  const alliesNear = path.t.map((t, i) => nearAt(t, allies, { x: path.x[i], y: path.y[i] }));
  const enemiesNear = path.t.map((t, i) => nearAt(t, enemies, { x: path.x[i], y: path.y[i] }));

  // What each 10 seconds went on.
  const cs = [...(x.heavy?.csEvents ?? [])].sort((a, b) => a.time - b.time);
  const ownBase = radiant ? "radiantBase" : "direBase";
  const activity: Activity[] = path.t.map((t, i) => {
    if (x.deaths.some((d) => t >= d.t && t <= d.t + (d.timeDead ?? 0))) return "dead";
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

  // Each teamfight in detail.
  const fightDetails: LabFightDetail[] = x.teamfights.map((f, idx) => {
    const me = posAt(f.start);
    let distEnemy: number | null = null;
    if (me)
      for (const e of enemies) {
        const q = e.g.get(Math.round(f.start / 10) * 10);
        if (q) distEnemy = Math.min(distEnemy ?? Infinity, dist(q, me));
      }
    const within = damage.filter((d) => d.t >= f.start - 3 && d.t <= f.end);
    const outs = within.filter((d) => d.out);
    const ins = within.filter((d) => !d.out);
    let burst = 0;
    for (const d of outs)
      burst = Math.max(
        burst,
        outs.filter((e) => e.t >= d.t && e.t < d.t + 3).reduce((s, e) => s + e.v, 0),
      );
    const odp = x.odTeamfights[idx]?.players[x.index];
    return {
      idx,
      // Map cells are about 128 game units.
      distEnemy: distEnemy == null ? null : Math.round(distEnemy * 128),
      alliesNear: me ? nearAt(f.start, allies, me) : 0,
      enemiesNear: me ? nearAt(f.start, enemies, me) : 0,
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

  // Each death in detail: in a teamfight, a gank (two or more on them) or a pick-off, who was
  // around, whether buyback was affordable, and what it did to the win chance.
  const deathDetails: LabDeathDetail[] = x.deaths.map((d) => {
    const me = posAt(d.t);
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
    const gi = path.t.findIndex((t) => t >= d.t);
    const onHand = gi >= 0 ? (unspent[Math.max(0, gi - 1)] ?? null) : null;
    return {
      t: d.t,
      kind,
      alliesNear: me ? nearAt(d.t, allies, me) : null,
      enemiesNear: me ? nearAt(d.t, enemies, me) : null,
      buyback: onHand != null && nw != null && goldEvents.length ? onHand >= 200 + nw / 13 : null,
      swing: winProb.length > m + 1 && m >= 1 ? winProb[m + 1] - winProb[m - 1] : null,
      netWorth: nw,
      unspent: onHand,
    };
  });

  return {
    context: { winProb, nwLead, xpLead, laneOutcome, lanes, draft },
    baseline: x.baseline,
    goldByMinute,
    xpByMinute,
    unspent: goldEvents.length ? unspent : [],
    activity: path.t.length ? activity : [],
    alliesNear,
    enemiesNear,
    attributes: x.heavy?.playerUpdateAttributeEvents?.length ? attributes : { str: [], agi: [], int: [] },
    healIn: x.heavy?.healEvents?.length ? healIn : [],
    damage,
    report,
    inventory,
    cooldowns: x.cooldowns,
    fightDetails,
    deathDetails,
  };
}

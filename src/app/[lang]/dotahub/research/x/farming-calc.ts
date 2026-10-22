import type { LabAssets, LabSide } from "@/lib/dota/lab";
import type { Activity } from "@/lib/dota/lab-extra";
import { activityShares, BUYBACK_FROM, buybackCost, PHASES } from "../advanced";
import { areaOf, isKeyItem, valueAt } from "../insights";
import { at, cellDist, rate, sum } from "./util";

// The farming module's numbers: how much of the time went to farming and how fast it went, the
// driest stretch, jungle routes, the farming rhythm, how and where the last hits were made, how long
// the gold for each key item sat before it was spent, and the rates in the same game state (ahead,
// even, behind). Pure, cached per side.

const memo = new WeakMap<LabSide, Map<string, unknown>>();
function cached<T>(s: LabSide, key: string, f: () => T): T {
  let m = memo.get(s);
  if (!m) memo.set(s, (m = new Map()));
  if (!m.has(key)) m.set(key, f());
  return m.get(key) as T;
}

const med = (list: number[]) => {
  if (!list.length) return null;
  const v = [...list].sort((a, b) => a - b);
  const i = v.length >> 1;
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
};

export const isCore = (s: LabSide) => s.position != null && s.position <= 3;
// Farming is a core's job: for supports more or faster is neither better nor worse.
export const coreDir = (s: LabSide) => (isCore(s) ? true : null);

export const hasActivity = (s: LabSide) =>
  s.advanced.activity.length > 0 && s.advanced.activity.length === s.path.t.length;
// STRATZ's gold log (bounties by reason) came with the parse.
export const hasGoldLog = (s: LabSide) =>
  Object.values(s.advanced.goldByMinute).some((list) => list.some((v) => v > 0));

// Last hits that paid a bounty: STRATZ's list also holds the buildings, wards, couriers and summons
// the hero finished off, at no gold.
export const lastHits = (s: LabSide) =>
  cached(s, "hits", () => s.resources.farm.filter((f) => f.gold > 0).sort((a, b) => a.t - b.t));

// The 10-second sample a moment falls in (each covers the ten seconds up to its time).
export function cellAt(s: LabSide, t: number) {
  const ts = s.path.t;
  if (!ts.length) return -1;
  let lo = 0;
  let hi = ts.length - 1;
  if (t > ts[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] >= t) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export const phaseOf = (t: number) =>
  Math.max(
    0,
    PHASES.findIndex(([a, b]) => t >= a && t < b),
  );

// STRATZ's last hits mark the frog camps' creeps (tadpoles to ancient frogs) as lane creeps: OpenDota's
// neutral kills less those frogs come to STRATZ's neutral last hits. The frogs killed, when that's so.
export function misfiledFrogs(s: LabSide) {
  return cached(s, "misfiled", () => {
    if (!s.resources.farm.length) return 0;
    let neutrals = 0;
    let frogs = 0;
    for (const [name, n] of Object.entries(s.killed)) {
      if (!name.startsWith("npc_dota_neutral_")) continue;
      neutrals += n;
      if (/frog|tadpole/.test(name)) frogs += n;
    }
    const gap = neutrals - lastHits(s).filter((h) => h.kind > 0).length;
    return frogs >= 5 && gap >= frogs * 0.7 ? frogs : 0;
  });
}

// ── Farm time and farm speed ─────────────────────────────────────────────────────────────────

// OpenDota's per-minute curves stop at the last full minute: a rate over a span running past it is
// taken up to there (else the last seconds' gold and last hits are missing but their time counted).
const curveEnd = (arr: number[], t: number) => Math.min(t, (arr.length - 1) * 60);

// How much of minute m (an index of the per-minute lists; the last one runs to the end) lies inside
// [from, to].
function minuteShare(s: LabSide, m: number, from: number, to: number) {
  const a = m * 60;
  const b = Math.max(a + 1, Math.min(a + 60, s.duration));
  return Math.max(0, Math.min(b, to) - Math.max(a, from)) / (b - a);
}

type MinuteFarm = { lane: number; jungle: number; other: number };

// Creep and neutral gold of each minute from the gold log (it has every bounty; the last hits' own
// gold falls a little short), shared out between lane farming, jungle farming and the rest of the
// time (fights, moving) by the gold of that minute's last hits in each.
function farmGoldByMinute(s: LabSide): MinuteFarm[] {
  return cached(s, "farmGold", () => {
    const g = s.advanced.goldByMinute;
    const weights = g.creeps.map(() => ({ lane: 0, jungle: 0, other: 0 }));
    if (!weights.length) return [];
    for (const h of lastHits(s)) {
      const m = Math.min(weights.length - 1, Math.max(0, Math.floor(h.t / 60)));
      const a = s.advanced.activity[cellAt(s, h.t)];
      weights[m][a === "farmLane" ? "lane" : a === "farmJungle" ? "jungle" : "other"] += h.gold;
    }
    return weights.map((w, m) => {
      const total = g.creeps[m] + g.neutrals[m];
      const all = w.lane + w.jungle + w.other;
      return all
        ? { lane: (total * w.lane) / all, jungle: (total * w.jungle) / all, other: (total * w.other) / all }
        : { lane: 0, jungle: 0, other: total };
    });
  });
}

export type FarmSpan = {
  from: number;
  to: number;
  // Share of the span alive, and of the time alive spent farming (a 10-second sample with a last hit
  // and no fight).
  alive: number;
  farm: number;
  farmMin: number;
  // Creep and neutral gold per game minute, and per farming minute while farming (all, lane, jungle).
  farmPm: number;
  speed: number | null;
  laneSpeed: number | null;
  jungleSpeed: number | null;
  // Last hits while farming per farming minute.
  lhRate: number | null;
  // Share of the creep and neutral gold that came outside farming time (last hits in fights).
  otherShare: number | null;
  // Gold from kills (heroes, couriers) and objectives (buildings, Roshan) per game minute.
  kills: number;
  objectives: number;
  gpm: number | null;
};

export function farmSpan(s: LabSide, from: number, to: number): FarmSpan | null {
  if (!hasActivity(s) || !hasGoldLog(s)) return null;
  const a = Math.max(0, from);
  const b = Math.min(s.duration, to);
  if (b - a < 60) return null;
  let cells = 0;
  let alive = 0;
  let lane = 0;
  let jungle = 0;
  s.path.t.forEach((t, i) => {
    if (t <= a || t > b) return;
    cells++;
    const x = s.advanced.activity[i];
    if (x !== "dead") alive++;
    if (x === "farmLane") lane++;
    else if (x === "farmJungle") jungle++;
  });
  if (!cells) return null;
  const g = s.advanced.goldByMinute;
  let laneGold = 0;
  let jungleGold = 0;
  let otherGold = 0;
  let kills = 0;
  let objectives = 0;
  farmGoldByMinute(s).forEach((x, m) => {
    const f = minuteShare(s, m, a, b);
    if (!f) return;
    laneGold += x.lane * f;
    jungleGold += x.jungle * f;
    otherGold += x.other * f;
    kills += (g.heroes[m] + g.couriers[m]) * f;
    objectives += (g.buildings[m] + g.roshan[m]) * f;
  });
  let farmLh = 0;
  for (const h of lastHits(s)) {
    if (h.t <= a || h.t > b) continue;
    const x = s.advanced.activity[cellAt(s, h.t)];
    if (x === "farmLane" || x === "farmJungle") farmLh++;
  }
  const minutes = (b - a) / 60;
  const farmMin = (lane + jungle) / 6;
  const gold = laneGold + jungleGold + otherGold;
  return {
    from: a,
    to: b,
    alive: alive / cells,
    farm: alive ? (lane + jungle) / alive : 0,
    farmMin,
    farmPm: gold / minutes,
    speed: farmMin ? (laneGold + jungleGold) / farmMin : null,
    laneSpeed: lane ? laneGold / (lane / 6) : null,
    jungleSpeed: jungle ? jungleGold / (jungle / 6) : null,
    lhRate: farmMin ? farmLh / farmMin : null,
    otherShare: gold ? otherGold / gold : null,
    kills: kills / minutes,
    objectives: objectives / minutes,
    gpm: rate(s.minutes.gold, a, curveEnd(s.minutes.gold, b)),
  };
}

// Last hits per minute and net worth at the end of a span, the player's and the rank average's (with
// how many of the average's games were still going then), both up to the player's last minute.
export function vsAverage(s: LabSide, from: number, to: number) {
  const a = Math.max(0, from);
  const b = Math.min(s.duration, to);
  if (b - a < 60) return null;
  const bl = s.advanced.baseline;
  const lhEnd = curveEnd(s.minutes.lh, b);
  const nwEnd = curveEnd(s.minutes.netWorth, b);
  return {
    lh: rate(s.minutes.lh, a, lhEnd),
    avgLh: bl ? rate(bl.minutes.cs, a, lhEnd) : null,
    nw: at(s.minutes.netWorth, nwEnd),
    avgNw: bl ? at(bl.minutes.networth, nwEnd) : null,
    n: bl ? (bl.counts[Math.min(bl.counts.length - 1, Math.round(nwEnd / 60))] ?? null) : null,
  };
}

// Why one farm rate beats the other: the creep and neutral gold earned while farming, per game minute,
// is the share of the time spent farming times the speed while farming. The ratio of each part.
export function farmGap(a: FarmSpan, b: FarmSpan) {
  const time = (x: FarmSpan) => x.alive * x.farm;
  if (!a.speed || !b.speed || !time(a) || !time(b)) return null;
  return {
    total: (time(a) * a.speed) / (time(b) * b.speed),
    time: time(a) / time(b),
    speed: a.speed / b.speed,
  };
}

export type Drought = {
  from: number;
  to: number;
  // Creep and neutral gold (else last hits, without STRATZ) per minute in the driest five minutes after
  // the laning stage, and the middle of all five-minute windows.
  value: number;
  median: number | null;
  unit: "gold" | "lh";
  shares: Record<Activity, number> | null;
};

export function drought(s: LabSide, until = Infinity): Drought | null {
  return cached(s, `drought:${until}`, () => {
    const full = Math.floor(Math.min(s.duration, until) / 60);
    if (full < 15) return null;
    const gold = hasGoldLog(s);
    const g = s.advanced.goldByMinute;
    const lh = s.minutes.lh;
    const values: { m: number; v: number }[] = [];
    for (let m = 10; m + 5 <= full; m++) {
      if (gold)
        values.push({ m, v: sum([0, 1, 2, 3, 4].map((k) => g.creeps[m + k] + g.neutrals[m + k])) / 5 });
      else if (lh[m + 5] != null && lh[m] != null) values.push({ m, v: (lh[m + 5] - lh[m]) / 5 });
    }
    if (!values.length) return null;
    const low = values.reduce((x, y) => (y.v < x.v ? y : x));
    return {
      from: low.m * 60,
      to: low.m * 60 + 300,
      value: low.v,
      median: med(values.map((x) => x.v)),
      unit: gold ? "gold" : "lh",
      shares: hasActivity(s) ? activityShares(s, low.m * 60 + 1, low.m * 60 + 300).shares : null,
    };
  });
}

// ── Jungle routes ────────────────────────────────────────────────────────────────────────────

export type Visit = {
  t: number;
  end: number;
  x: number;
  y: number;
  n: number;
  gold: number;
  ancient: boolean;
};
// A clear of this many creeps or more at one spot is about a stacked camp (or two camps at once).
export const LARGE_CLEAR = 7;

// Camp visits: neutral last hits each within 12 s of the one before and within 6 cells (~770 units)
// of the visit's first; the mark goes at their middle. (A last hit STRATZ gives no place is left out.)
export function campVisits(s: LabSide): Visit[] {
  return cached(s, "visits", () => {
    const out: { v: Visit; x0: number; y0: number; sx: number; sy: number }[] = [];
    for (const h of lastHits(s)) {
      if (h.kind === 0 || h.x == null || h.y == null) continue;
      const cur = out[out.length - 1];
      if (cur && h.t - cur.v.end <= 12 && cellDist(h, { x: cur.x0, y: cur.y0 }) <= 6) {
        cur.v.n++;
        cur.v.end = h.t;
        cur.v.gold += h.gold;
        cur.v.ancient ||= h.kind === 2;
        cur.sx += h.x;
        cur.sy += h.y;
      } else
        out.push({
          v: { t: h.t, end: h.t, x: h.x, y: h.y, n: 1, gold: h.gold, ancient: h.kind === 2 },
          x0: h.x,
          y0: h.y,
          sx: h.x,
          sy: h.y,
        });
    }
    return out.map((c) => ({ ...c.v, x: c.sx / c.v.n, y: c.sy / c.v.n }));
  });
}

// Within [from, to]: camps cleared, creeps per camp, and the route's pace — consecutive camps less
// than a minute apart (longer is a break, not the route): the walk from one camp's last creep to the
// next camp's first, the time from camp to camp, and camps per minute of that time.
export function routeStats(s: LabSide, from: number, to: number) {
  if (!s.resources.farm.length) return null;
  const list = campVisits(s).filter((v) => v.t > from && v.t <= to);
  const steps = list.slice(1).flatMap((v, i) => {
    const walk = v.t - list[i].end;
    return walk <= 60 ? [{ walk, cycle: v.t - list[i].t }] : [];
  });
  const cycles = sum(steps.map((x) => x.cycle));
  return {
    visits: list.length,
    perVisit: list.length ? sum(list.map((v) => v.n)) / list.length : null,
    walk: med(steps.map((x) => x.walk)),
    cycle: med(steps.map((x) => x.cycle)),
    perMin: cycles > 0 ? (steps.length / cycles) * 60 : null,
    steps: steps.length,
    large: list.filter((v) => v.n >= LARGE_CLEAR),
    ancient: list.filter((v) => v.ancient).length,
  };
}

// Camps the team stacked (everyone's, the player's own included).
export const teamStacks = (s: LabSide) =>
  s.match.players.filter((p) => p.radiant === s.radiant).reduce((a, p) => a + p.campsStacked, 0);

// ── Rhythm ───────────────────────────────────────────────────────────────────────────────────

export const AFTER_LANE = 600;
// Walking to the next camp or wave takes this long; an idle stretch counts beyond it.
export const WALK_ALLOWANCE = 20;

export type Rhythm = {
  // Last hits from 10:00, and when the player went from a wave to a nearby camp or back within 40 s.
  lh: number;
  switches: number[];
  // Gaps of 45 s or more between last hits while alive and out of fights.
  gaps: { t: number; d: number }[];
  // 40 s or more of only moving or standing in base (not hitting buildings, at Roshan or just respawned).
  idle: { t: number; d: number }[];
};

export function rhythm(s: LabSide): Rhythm | null {
  if (!hasActivity(s) || !s.resources.farm.length) return null;
  return cached(s, "rhythm", () => {
    const act = s.advanced.activity;
    const ts = s.path.t;
    const hits = lastHits(s).filter((h) => h.t >= AFTER_LANE);
    const switches: number[] = [];
    for (let i = 1; i < hits.length; i++) {
      const p = hits[i - 1];
      const q = hits[i];
      if (p.x == null || q.x == null || p.y == null || q.y == null) continue;
      if ((p.kind === 0) !== (q.kind === 0) && q.t - p.t <= 40 && cellDist(p, q) <= 20) switches.push(q.t);
    }
    const dead = s.fights.events
      .filter((f) => f.kind === "death")
      .map((f) => [f.t, f.t + (f.timeDead ?? 0)] as const);
    const gaps: { t: number; d: number }[] = [];
    for (let i = 1; i < hits.length; i++) {
      const p = hits[i - 1].t;
      const q = hits[i].t;
      if (q - p < 45 || dead.some(([d0, d1]) => d0 < q && d1 > p)) continue;
      let fought = false;
      for (let j = Math.max(0, cellAt(s, p)); j < ts.length && ts[j] - 10 < q; j++)
        if (ts[j] > p && act[j] === "fight") fought = true;
      if (!fought) gaps.push({ t: p, d: q - p });
    }
    const towers = new Set(s.advanced.towerHits.map((h) => cellAt(s, h.t)));
    const roshan = s.resources.roshan.filter((r) => r.kind === "teamKill").map((r) => r.t);
    const busy = (i: number) =>
      towers.has(i) ||
      roshan.some((r) => ts[i] <= r && ts[i] > r - 90) ||
      dead.some(([, d1]) => ts[i] > d1 && ts[i] <= d1 + 30);
    const idle: { t: number; d: number }[] = [];
    let start = -1;
    const close = (end: number) => {
      if (start >= 0 && end - start >= 4) idle.push({ t: ts[start] - 10, d: (end - start) * 10 });
      start = -1;
    };
    ts.forEach((t, i) => {
      const still = t > AFTER_LANE && (act[i] === "move" || act[i] === "base") && !busy(i);
      if (still && start < 0) start = i;
      else if (!still) close(i);
    });
    close(ts.length);
    return { lh: hits.length, switches, gaps, idle };
  });
}

// ── How and where ────────────────────────────────────────────────────────────────────────────

export type MethodRow = {
  key: string;
  src: 0 | 1 | 2 | 3;
  by: string | null;
  n: number[];
  total: number;
  gold: number;
};

// Last hits by how they were made (right-click, an item such as Battle Fury's cleave, an ability, an
// illusion or other unit), per phase.
export function lastHitMethods(s: LabSide): MethodRow[] {
  return cached(s, "methods", () => {
    const rows = new Map<string, MethodRow>();
    for (const h of lastHits(s)) {
      const by = h.src === 1 || h.src === 2 ? h.by : null;
      const key = h.src === 0 ? "rightClick" : h.src === 3 ? "units" : (by ?? `src${h.src}`);
      let row = rows.get(key);
      if (!row) rows.set(key, (row = { key, src: h.src, by, n: PHASES.map(() => 0), total: 0, gold: 0 }));
      row.n[phaseOf(h.t)]++;
      row.total++;
      row.gold += h.gold;
    }
    return [...rows.values()].sort((a, b) => b.total - a.total);
  });
}

export type CampSize = "small" | "medium" | "mediumLarge" | "large" | "ancient" | "other";
export const CAMP_SIZES: CampSize[] = ["small", "medium", "mediumLarge", "large", "ancient", "other"];

// Neutral units by the size of camp they spawn in (7.41). The flooded camps' frogs grow a size every
// few minutes, so each counts at its own size; centaurs and the two lesser satyrs come in both medium
// and large camps. Units not listed (new ones) count as 'other'.
const CAMP: Record<string, CampSize> = {
  kobold: "small",
  kobold_tunneler: "small",
  kobold_taskmaster: "small",
  forest_troll_berserker: "small",
  forest_troll_high_priest: "small",
  gnoll_assassin: "small",
  ghost: "small",
  fel_beast: "small",
  harpy_scout: "small",
  harpy_storm: "small",
  tadpole: "small",
  giant_wolf: "medium",
  alpha_wolf: "medium",
  ogre_mauler: "medium",
  ogre_magi: "medium",
  mud_golem: "medium",
  mud_golem_split: "medium",
  mud_golem_split_doom: "medium",
  froglet: "medium",
  froglet_mage: "medium",
  centaur_outrunner: "mediumLarge",
  centaur_khan: "mediumLarge",
  satyr_trickster: "mediumLarge",
  satyr_soulstealer: "mediumLarge",
  satyr_hellcaller: "large",
  polar_furbolg_champion: "large",
  polar_furbolg_ursa_warrior: "large",
  wildkin: "large",
  enraged_wildkin: "large",
  dark_troll: "large",
  dark_troll_warlord: "large",
  warpine_raider: "large",
  grown_frog: "large",
  grown_frog_mage: "large",
  black_drake: "ancient",
  black_dragon: "ancient",
  rock_golem: "ancient",
  granite_golem: "ancient",
  small_thunder_lizard: "ancient",
  big_thunder_lizard: "ancient",
  frostbitten_golem: "ancient",
  ice_shaman: "ancient",
  prowler_acolyte: "ancient",
  prowler_shaman: "ancient",
  ancient_frog: "ancient",
  ancient_frog_mage: "ancient",
  jungle_stalker: "ancient",
  elder_jungle_stalker: "ancient",
};

// Neutrals killed by camp size, from OpenDota's units killed (by name, so the frogs count right).
export function campKills(s: LabSide) {
  const out = Object.fromEntries(CAMP_SIZES.map((k) => [k, 0])) as Record<CampSize, number>;
  for (const [name, n] of Object.entries(s.killed))
    if (name.startsWith("npc_dota_neutral_")) out[CAMP[name.slice(17)] ?? "other"] += n;
  return out;
}

// Lane creeps killed by kind (super and mega creeps among them), and the own creeps denied.
export function creepKills(s: LabSide) {
  const enemy = s.radiant ? "badguys" : "goodguys";
  const out = { melee: 0, ranged: 0, siege: 0, flagbearer: 0, upgraded: 0, mega: 0, denied: 0 };
  for (const [name, n] of Object.entries(s.killed)) {
    const m =
      /^npc_dota_(?:creep_)?(goodguys|badguys)_(melee|ranged|siege|flagbearer)(_upgraded(_mega)?)?$/.exec(
        name,
      );
    if (!m) continue;
    if (m[1] !== enemy) {
      out.denied += n;
      continue;
    }
    out[m[2] as "melee" | "ranged" | "siege" | "flagbearer"] += n;
    if (m[4]) out.mega += n;
    else if (m[3]) out.upgraded += n;
  }
  return out;
}

export type Places = {
  ownJungle: number;
  enemyJungle: number;
  ancients: number;
  ownBase: number;
  ownHalf: number;
  enemyHalf: number;
  enemyBase: number;
  // Nearer a standing enemy tower than any standing tower of the team (null: no towers known).
  enemyTowers: number | null;
  n: number;
};
const emptyPlaces = (towers: boolean): Places => ({
  ownJungle: 0,
  enemyJungle: 0,
  ancients: 0,
  ownBase: 0,
  ownHalf: 0,
  enemyHalf: 0,
  enemyBase: 0,
  enemyTowers: towers ? 0 : null,
  n: 0,
});

// Where the last hits were, per phase and in all: neutrals on the own or the enemy's side of the
// river (the map's diagonal; ancients also counted apart), lane creeps in a base or on either half
// of their lane; and whose towers were nearer, counting only those still standing — a rough line
// of territory that moves as towers fall.
export function farmPlaces(s: LabSide): { phases: Places[]; all: Places } {
  return cached(s, "places", () => {
    const towers = s.match.buildings.filter((b) => b.type === "tower");
    const known = towers.some((b) => b.radiant === s.radiant) && towers.some((b) => b.radiant !== s.radiant);
    const phases = PHASES.map(() => emptyPlaces(known));
    const all = emptyPlaces(known);
    const nearest = (h: { t: number; x: number; y: number }, ours: boolean) =>
      Math.min(
        ...towers
          .filter((b) => (b.radiant === s.radiant) === ours && (b.died == null || b.died > h.t))
          .map((b) => cellDist(b, h)),
      );
    for (const h of lastHits(s)) {
      // Only the last hits with a place.
      if (h.x == null || h.y == null) continue;
      const own = h.x + h.y < 256 === s.radiant;
      const area = areaOf(h.x, h.y, s.radiant);
      const key: keyof Places =
        h.kind > 0
          ? own
            ? "ownJungle"
            : "enemyJungle"
          : area === "ownBase" || area === "enemyBase"
            ? area
            : own
              ? "ownHalf"
              : "enemyHalf";
      const theirs = known && nearest(h, false) < nearest(h, true);
      for (const p of [phases[phaseOf(h.t)], all]) {
        p[key]++;
        p.n++;
        if (h.kind === 2) p.ancients++;
        if (theirs && p.enemyTowers != null) p.enemyTowers++;
      }
    }
    return { phases, all };
  });
}

// ── From affordable to bought ────────────────────────────────────────────────────────────────

export type Afford = {
  key: string;
  t: number;
  // When the gold on hand first covered what was left to pay (the cost less the parts already bought)
  // in the run-up to buying, and for how long it sat; from 30:00 also with buyback gold kept.
  from: number | null;
  held: number;
  heldBuyback: number | null;
  // All parts and the recipe bought, the item still came together this much later (the courier, or a
  // trip to the stash); null when when the recipe was bought can't be told.
  wait: number | null;
  // Where the player was when it was bought.
  place: "base" | "dead" | null;
};

// Each key item: what was left to pay at each 10-second sample (its cost less the parts already bought,
// matched to the purchases), and the stretch right before paying in which the gold on hand covered it.
export function affordDelays(s: LabSide, assets: LabAssets): Afford[] {
  return cached(s, "afford", () => {
    const ts = s.path.t;
    const u = s.advanced.unspent;
    if (!u.length || u.length !== ts.length) return [];
    const buys = [...s.items.purchases].map((p, i) => ({ ...p, i })).sort((a, b) => a.t - b.t);
    const costOf = (k: string) => assets.itemMeta[k]?.cost ?? assets.items[k]?.cost ?? 0;
    // (OpenDota's component lists hold an empty name here and there.)
    const partsOf = (k: string) => (assets.itemMeta[k]?.components ?? []).filter(Boolean);
    // What an item costs beyond its parts: its recipe.
    const recipeOf = (k: string) => Math.max(0, costOf(k) - sum(partsOf(k).map(costOf)));
    const deaths = s.fights.events.filter((f) => f.kind === "death").map((f) => f.t);
    const taken = new Set<number>();
    const seen = new Set<string>();
    const out: Afford[] = [];
    type Part = { t: number | null; cost: number; sub: Part[] };
    for (const item of buys) {
      if (!isKeyItem(item.key, assets) || seen.has(item.key) || item.t <= 120 || item.t <= ts[0] + 10)
        continue;
      seen.add(item.key);
      const at = item.t;
      // The latest purchase of a part at or before the item that no earlier item used. A part never
      // bought as such stands for its own parts, and so does one logged at the item's own second (put
      // together on the way, as Perseverance into Battle Fury).
      const take = (k: string) => {
        for (let j = buys.length - 1; j >= 0; j--) {
          const p = buys[j];
          if (p.key !== k || p.t > at || p.i === item.i || taken.has(p.i)) continue;
          taken.add(p.i);
          return at - p.t <= 1 && partsOf(k).length ? null : p.t;
        }
        return null;
      };
      const build = (k: string): Part => {
        const t = take(k);
        return { t, cost: costOf(k), sub: t == null ? partsOf(k).map(build) : [] };
      };
      const parts = partsOf(item.key).map(build);
      const recipe = parts.length ? recipeOf(item.key) : 0;
      const owned = (p: Part, t: number): number =>
        p.t != null && p.t <= t ? p.cost : sum(p.sub.map((x) => owned(x, t)));
      const lastOf = (p: Part): number | null => {
        if (p.t != null) return p.t;
        if (!p.sub.length) return null;
        const xs = p.sub.map(lastOf);
        return xs.some((x) => x == null) ? null : Math.max(...(xs as number[]));
      };
      const times = parts.map(lastOf);
      const lastPart =
        times.length && times.every((x) => x != null) ? Math.max(...(times as number[])) : null;
      // OpenDota logs no recipes: the recipe was bought where the gold on hand, from a sample before the
      // last part on, has fallen by most of the recipe's cost more than the logged purchases (the parts,
      // and the recipes of other items put together then) and buybacks explain (the 10 s with a death,
      // which took gold, are left out).
      let recipeAt: number | null = null;
      if (recipe > 0 && lastPart != null) {
        const i0 = Math.max(0, cellAt(s, lastPart) - 2);
        let drop = 0;
        for (let i = i0 + 1; i < ts.length && ts[i - 1] <= at + 10; i++) {
          if (deaths.some((d) => d > ts[i - 1] && d <= ts[i])) continue;
          drop += Math.max(0, u[i - 1] - u[i]);
          const explained =
            sum(
              buys
                .filter((p) => p.t > ts[i0] && p.t <= ts[i] && p.i !== item.i)
                .map((p) => (partsOf(p.key).length ? recipeOf(p.key) : costOf(p.key))),
            ) + sum(s.resources.buybacks.filter((b) => b.t > ts[i0] && b.t <= ts[i]).map((b) => b.cost ?? 0));
          if (drop - explained >= recipe * 0.6) {
            recipeAt = ts[i];
            break;
          }
        }
      }
      const ready = !parts.length
        ? at
        : lastPart == null || (recipe > 0 && recipeAt == null)
          ? null
          : Math.max(lastPart, recipeAt ?? lastPart);
      const paid = Math.min(at, ready ?? at);
      const left = (t: number) =>
        costOf(item.key) -
        sum(parts.map((p) => owned(p, t))) -
        (recipeAt != null && t >= recipeAt ? recipe : 0);
      const stretch = (reserve: (t: number) => number) => {
        let i = cellAt(s, paid);
        if (ts[i] >= paid) i--;
        let first: number | null = null;
        while (i >= 0 && left(ts[i]) > 0 && u[i] >= left(ts[i]) + reserve(ts[i])) first = ts[i--];
        return first;
      };
      const from = stretch(() => 0);
      const fromBuyback =
        paid >= BUYBACK_FROM ? stretch((t) => buybackCost(valueAt(s.minutes.netWorth, t) ?? 0)) : null;
      const cell = cellAt(s, at);
      const a = s.advanced.activity[cell];
      out.push({
        key: item.key,
        t: at,
        from,
        held: from == null ? 0 : paid - from,
        heldBuyback: paid >= BUYBACK_FROM ? (fromBuyback == null ? 0 : paid - fromBuyback) : null,
        wait: ready == null ? null : Math.max(0, at - ready),
        place:
          a === "dead"
            ? "dead"
            : cell >= 0 && areaOf(s.path.x[cell], s.path.y[cell], s.radiant) === "ownBase"
              ? "base"
              : null,
      });
    }
    return out;
  });
}

// ── The same game state ──────────────────────────────────────────────────────────────────────

export type GameState = "ahead" | "even" | "behind";
export const GAME_STATES: GameState[] = ["ahead", "even", "behind"];
// The team's net-worth lead: ahead above +5,000, behind below −2,000, else even.
export const AHEAD = 5000;
export const BEHIND = -2000;

// The team's state in each full minute, by the lead at its start.
export function minuteStates(s: LabSide): (GameState | null)[] {
  return cached(s, "states", () => {
    const lead = s.advanced.context.nwLead;
    return Array.from({ length: Math.floor(s.duration / 60) }, (_, m) => {
      const v = lead[m];
      if (v == null || !Number.isFinite(v)) return null;
      return v > AHEAD ? "ahead" : v < BEHIND ? "behind" : "even";
    });
  });
}

export type StateRates = {
  minutes: number;
  // Per minute: creep and neutral gold, last hits, hero and building damage; deaths per 10 minutes;
  // the share of the time alive spent farming and fighting.
  farm: number | null;
  lh: number | null;
  hd: number | null;
  td: number | null;
  deaths: number;
  farmPct: number | null;
  fightPct: number | null;
};

const inPhase = (m: number, p: number | null) =>
  p == null || (m * 60 >= PHASES[p][0] && m * 60 < PHASES[p][1]);

export function stateRates(s: LabSide, state: GameState, phase: number | null): StateRates {
  return cached(s, `state:${state}:${phase}`, () => {
    const ms = minuteStates(s)
      .map((x, m) => (x === state && inPhase(m, phase) ? m : -1))
      .filter((m) => m >= 0);
    const set = new Set(ms);
    const n = ms.length;
    const g = s.advanced.goldByMinute;
    const per = (list: number[]) =>
      n && list.length > Math.max(...ms) + 1 ? sum(ms.map((m) => list[m + 1] - list[m])) / n : null;
    let cells = 0;
    let farm = 0;
    let fight = 0;
    if (hasActivity(s))
      s.path.t.forEach((t, i) => {
        if (!set.has(Math.floor((t - 1) / 60))) return;
        const x = s.advanced.activity[i];
        if (x === "dead") return;
        cells++;
        if (x === "farmLane" || x === "farmJungle") farm++;
        else if (x === "fight") fight++;
      });
    return {
      minutes: n,
      farm: n && hasGoldLog(s) ? sum(ms.map((m) => g.creeps[m] + g.neutrals[m])) / n : null,
      lh: per(s.minutes.lh),
      hd: per(s.minutes.heroDamage),
      td: per(s.minutes.towerDamage),
      deaths: n
        ? (s.fights.events.filter((f) => f.kind === "death" && set.has(Math.floor(f.t / 60))).length / n) * 10
        : 0,
      farmPct: cells ? farm / cells : null,
      fightPct: cells ? fight / cells : null,
    };
  });
}

// Share of the full minutes in each state.
export function stateShares(s: LabSide) {
  const list = minuteStates(s).filter((x): x is GameState => x != null);
  return Object.fromEntries(
    GAME_STATES.map((k) => [k, list.length ? list.filter((x) => x === k).length / list.length : 0]),
  ) as Record<GameState, number>;
}

// Stretches of at least this many minutes in a state and phase are compared.
export const STATE_MIN = 3;

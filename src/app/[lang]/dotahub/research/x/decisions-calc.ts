import type { LabSide } from "@/lib/dota/lab";
import type { Activity } from "@/lib/dota/lab-extra";
import type { LabBuilding, LabObjective } from "@/lib/dota/lab-match";
import { mapZone } from "@/lib/dota/map";
import { BUYBACK_FROM, buybackCost } from "../advanced";
import { aliveAt, type Area, areaOf } from "../insights";
import { at, CELL, mean } from "./util";

// 局内科研 · decisions: the readings behind the key moments, what came after fights, the phases set
// by the game's events, buybacks and respawns, skirmishes, answers to ally deaths, space, risk,
// objectives and building defence. Pure. Positions are map cells on the match's 10-second grid
// (one cell ≈ 128 game units); a hero counts as dead from its death until it shows up again (STRATZ
// sends no positions while a hero is dead), the studied player from the exact respawn times.

type Pt = { x: number; y: number };

// Near: within 12 cells (~1,500 units), as elsewhere on the page. At an objective: ~2,000 units.
// Away from the team: no ally within ~3,000 units. Attention (space): enemies within ~1,800 units.
export const NEAR = 12;
const AT_SPOT = 16;
const FAR = 24;
const ATTENTION = 14;
const RESPAWN_MAX = 130;
const TP_KEYS = new Set(["tpscroll", "travel_boots", "travel_boots_2"]);

const cells = (d: number) => Math.round(d * CELL);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (t: number, from: number, to: number) => t >= from && t <= to;
const isFarm = (a: Activity | null | undefined) => a === "farmLane" || a === "farmJungle";

// When a death of the player ended: the buyback within its dead time (STRATZ's dead time can stop a
// second or two before the buyback is logged), else the respawn.
function backAt(s: LabSide, d: { t: number; timeDead: number | null }) {
  if (d.timeDead == null) return null;
  const bb = s.resources.buybacks.find((b) => b.t >= d.t && b.t <= d.t + d.timeDead! + 2);
  return { t: bb ? bb.t : d.t + d.timeDead, buyback: !!bb };
}

// ── The grid, who was alive, who was near ────────────────────────────────────────────────────

type Grid = {
  t: number[];
  pos: Map<number, { x: number[]; y: number[] }>;
  alive: Map<number, boolean[]>;
  allies: number[];
  enemies: number[];
};

const grids = new WeakMap<LabSide, Grid>();

export function grid(s: LabSide): Grid {
  const cached = grids.get(s);
  if (cached) return cached;
  const t = s.match.grid.t;
  const pos = new Map<number, { x: number[]; y: number[] }>();
  const alive = new Map<number, boolean[]>();
  for (const p of s.match.players) {
    const xy = s.match.grid.pos[String(p.slot)];
    if (!xy?.x.length || xy.x.length !== t.length) continue;
    pos.set(p.slot, xy);
    const spans: [number, number][] = [];
    if (p.slot === s.slot) {
      // The studied player: dead from each death to its respawn (or buyback).
      for (const d of s.fights.events) {
        const back = d.kind === "death" ? backAt(s, d) : null;
        if (back) spans.push([d.t, back.t]);
      }
    } else {
      // Others: from the death until the position changes again.
      for (const d of s.match.deaths) {
        if (d.slot !== p.slot) continue;
        const i0 = t.findIndex((x) => x > d.t);
        if (i0 < 0) continue;
        let i = i0;
        while (i < t.length && xy.x[i] === xy.x[i0] && xy.y[i] === xy.y[i0] && t[i] - d.t <= RESPAWN_MAX) i++;
        if (i > i0) spans.push([d.t, t[i - 1]]);
      }
    }
    alive.set(
      p.slot,
      t.map((x) => !spans.some(([a, b]) => x > a && x <= b)),
    );
  }
  const g: Grid = {
    t,
    pos,
    alive,
    allies: s.match.players.filter((p) => p.radiant === s.radiant && p.slot !== s.slot).map((p) => p.slot),
    enemies: s.match.players.filter((p) => p.radiant !== s.radiant).map((p) => p.slot),
  };
  grids.set(s, g);
  return g;
}

// The grid sample nearest a moment (null outside the grid).
function idx(g: Grid, t: number) {
  if (!g.t.length || t < g.t[0] - 10 || t > g.t[g.t.length - 1] + 10) return null;
  return Math.min(g.t.length - 1, Math.max(0, Math.round((t - g.t[0]) / 10)));
}

function posAt(g: Grid, slot: number, i: number): Pt | null {
  const p = g.pos.get(slot);
  return p ? { x: p.x[i], y: p.y[i] } : null;
}

const isAlive = (g: Grid, slot: number, i: number) => g.alive.get(slot)?.[i] ?? false;

// Alive heroes of a list within r cells of a point, at a sample.
function countNear(g: Grid, slots: number[], i: number, p: Pt, r: number) {
  let n = 0;
  for (const slot of slots) {
    if (!isAlive(g, slot, i)) continue;
    const q = posAt(g, slot, i);
    if (q && dist(p, q) <= r) n++;
  }
  return n;
}

// The studied player at a moment: alive, where, allies and enemies near.
function me(s: LabSide, g: Grid, t: number) {
  const i = idx(g, t);
  if (i == null) return null;
  const p = posAt(g, s.slot, i);
  if (!p) return null;
  return {
    i,
    p,
    alive: isAlive(g, s.slot, i),
    allies: countNear(g, g.allies, i, p, NEAR),
    enemies: countNear(g, g.enemies, i, p, NEAR),
  };
}

// The player's activity on the path's grid (the 10 seconds up to each sample).
function activityIn(s: LabSide, from: number, to: number) {
  const out: Activity[] = [];
  s.path.t.forEach((t, i) => {
    const a = s.advanced.activity[i];
    if (a && t > from && t <= to + 5) out.push(a);
  });
  return out;
}

function topActivity(list: Activity[]): Activity | null {
  const counts = new Map<Activity, number>();
  for (const a of list) {
    const k = a === "farmJungle" ? "farmLane" : a;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  if (!best) return null;
  if (best[0] === "farmLane") {
    const jungle = list.filter((a) => a === "farmJungle").length;
    return jungle * 2 >= best[1] ? "farmJungle" : "farmLane";
  }
  return best[0];
}

const tpTimes = (s: LabSide) =>
  s.items.useTimes
    .filter((u) => TP_KEYS.has(u.key))
    .flatMap((u) => u.times)
    .sort((a, b) => a - b);

const myDeaths = (s: LabSide) => s.fights.events.filter((e) => e.kind === "death");

// Dead at an exact moment (the grid sample nearest it can be from just before a death).
function deadAt(s: LabSide, t: number) {
  return myDeaths(s).some((d) => {
    const back = t >= d.t ? backAt(s, d) : null;
    return !!back && t < back.t;
  });
}
const ours = (s: LabSide, slot: number) => slot < 128 === s.radiant;
const sorted = (list: LabObjective[]) => [...list].sort((a, b) => a.t - b.t);

// Objectives that count for a team: buildings, Roshan, Tormentor (not couriers).
const BIG = new Set<LabObjective["type"]>(["building", "roshan", "tormentor"]);
const teamTook = (s: LabSide, o: LabObjective) =>
  BIG.has(o.type) && o.radiant != null && o.radiant === s.radiant;
const enemyTook = (s: LabSide, o: LabObjective) =>
  BIG.has(o.type) && o.radiant != null && o.radiant !== s.radiant;

// ── Phases from the game's events ────────────────────────────────────────────────────────────

export type PhaseKey = "laning" | "mid" | "late";
export type Phase = { key: PhaseKey; from: number; to: number };
export type Phases = {
  list: Phase[];
  // Why the laning stage ended: the own tier-1 tower in the lane fell, the player left the lane,
  // or the 15:00 cap.
  laneWhy: "tower" | "left" | "cap";
  rax: number | null;
};

const phaseCache = new WeakMap<LabSide, Phases>();

export function phases(s: LabSide): Phases {
  const cached = phaseCache.get(s);
  if (cached) return cached;
  const own = s.radiant ? "goodguys" : "badguys";
  const objs = sorted(s.match.objectives).filter((o) => o.type === "building" && o.key);
  const lane = s.lane === "top" || s.lane === "mid" || s.lane === "bot" ? s.lane : null;
  const t1s = objs.filter((o) => o.key!.includes(own) && o.key!.includes("tower1"));
  const tower = (lane ? t1s.find((o) => o.key!.endsWith(`tower1_${lane}`)) : t1s[0])?.t ?? null;
  // In the lane: within ~2,500 units of either tier-1 tower of it (the map's zones are too coarse
  // for the safe lane's tower area). Left it for good: under half of a minute's living samples
  // there, under a third over that minute and the next two, and no later minute (to 20:00) back
  // at half or more (from 4:00).
  let left: number | null = null;
  if (lane && s.advanced.activity.length) {
    const t1 = s.match.buildings.filter((b) => b.name === `tower1_${lane}`);
    const inLane = (p: Pt) => (t1.length ? t1.some((b) => dist(b, p) <= 20) : mapZone(p.x, p.y) === lane);
    const share: (number | null)[] = [];
    for (let m = 0; m <= 20; m++) {
      let n = 0;
      let k = 0;
      s.path.t.forEach((t, i) => {
        if (t < m * 60 || t >= (m + 1) * 60 || !aliveAt(s, i)) return;
        n++;
        if (inLane({ x: s.path.x[i], y: s.path.y[i] })) k++;
      });
      share.push(n ? k / n : null);
    }
    for (let m = 4; m <= 18; m++) {
      const next = share.slice(m, m + 3).filter((v): v is number => v != null);
      const back = share.slice(m + 1).some((v) => v != null && v >= 0.5);
      if (share[m] != null && share[m]! < 0.5 && next.length && (mean(next) ?? 1) < 0.34 && !back) {
        left = m * 60;
        break;
      }
    }
  }
  const cap = Math.min(900, s.duration);
  let laneEnd = cap;
  let laneWhy: Phases["laneWhy"] = "cap";
  if (tower != null && tower < laneEnd) {
    laneEnd = tower;
    laneWhy = "tower";
  }
  if (left != null && left < laneEnd) {
    laneEnd = left;
    laneWhy = "left";
  }
  const raxObj = objs.find((o) => o.key!.includes("_rax_"))?.t ?? null;
  const raxBuilding = s.match.buildings
    .filter((b) => b.type === "barracks" && b.died != null)
    .map((b) => b.died!)
    .sort((a, b) => a - b)[0];
  const rax = raxObj ?? raxBuilding ?? null;
  const list: Phase[] = [{ key: "laning", from: 0, to: laneEnd }];
  if (rax != null && rax > laneEnd && rax < s.duration) {
    list.push({ key: "mid", from: laneEnd, to: rax }, { key: "late", from: rax, to: s.duration });
  } else list.push({ key: "mid", from: laneEnd, to: s.duration });
  const out = { list: list.filter((p) => p.to > p.from), laneWhy, rax };
  phaseCache.set(s, out);
  return out;
}

const phaseOf = (ph: Phases, t: number) => ph.list.findIndex((p) => t >= p.from && t < p.to);

// Time use, the game's pace and the player's part in each phase.
export function phaseStats(s: LabSide) {
  const ph = phases(s);
  const deaths = myDeaths(s);
  return ph.list.map((p) => {
    const acts = activityIn(s, p.from, p.to);
    const n = acts.length;
    const share = (keys: Activity[]) => (n ? acts.filter((a) => keys.includes(a)).length / n : null);
    const minutes = Math.max(1 / 60, (Math.min(p.to, s.duration) - Math.max(0, p.from)) / 60);
    const inP = (t: number) => t >= p.from && t < p.to;
    const heroDeaths = s.match.deaths.filter((d) => inP(d.t));
    const ourDeaths = heroDeaths.filter((d) => ours(s, d.slot)).length;
    const theirDeaths = heroDeaths.length - ourDeaths;
    const nw = (m: number) => (at(s.minutes.teamNetWorth, m) ?? 0) + (at(s.minutes.enemyNetWorth, m) ?? 0);
    const ka = s.fights.events.filter((e) => e.kind !== "death" && inP(e.t)).length;
    const died = deaths.filter((e) => inP(e.t)).length;
    return {
      ...p,
      minutes,
      samples: n,
      farm: share(["farmLane", "farmJungle"]),
      fight: share(["fight"]),
      move: share(["move", "base"]),
      dead: share(["dead"]),
      killsPm: heroDeaths.length / minutes,
      nwPm: s.minutes.teamNetWorth.length
        ? (nw(Math.min(p.to, s.duration)) - nw(Math.max(0, p.from))) / minutes
        : null,
      died,
      deathShare: ourDeaths ? died / ourDeaths : null,
      kp: theirDeaths ? Math.min(1, ka / theirDeaths) : null,
      ourDeaths,
      theirDeaths,
    };
  });
}
export type PhaseStat = ReturnType<typeof phaseStats>[number];

// ── Key moments: the biggest swings of the team's win chance ─────────────────────────────────

export type SwingKind = "win" | "nw";

// The team's win chance by minute (STRATZ), else its net-worth lead.
export function swingSeries(s: LabSide): { kind: SwingKind; values: number[] } | null {
  const w = s.advanced.context.winProb;
  if (w.length >= 3) return { kind: "win", values: w };
  const nw = s.advanced.context.nwLead;
  if (nw.length >= 3) return { kind: "nw", values: nw };
  return null;
}

// Other heroes' deaths and objectives with a place, for 'where the action was'.
function spots(s: LabSide, from: number, to: number) {
  const out: { t: number; p: Pt }[] = [];
  for (const d of s.match.deaths)
    if (d.slot !== s.slot && d.x != null && d.y != null && d.t >= from && d.t < to)
      out.push({ t: d.t, p: { x: d.x, y: d.y } });
  for (const o of s.match.objectives) {
    if (o.t < from || o.t >= to || !BIG.has(o.type)) continue;
    const p = objectivePlace(s, o);
    if (p) out.push({ t: o.t, p: p.p });
  }
  return out;
}

export type Moment = {
  m: number;
  from: number;
  to: number;
  swing: number;
  fights: number[];
  ours: number;
  theirs: number;
  objectives: LabObjective[];
  dead: number;
  activity: Activity | null;
  area: Area | null;
  dist: number | null;
  kills: number;
  deaths: number;
  assists: number;
  dealt: number;
  joined: boolean;
  // Took part (joined a teamfight, a kill, death or assist) or was alive within ~1,500 units of a
  // death or objective; null when the minute had neither (the model read the gold and XP), or when
  // there are no positions to tell 'not there' apart.
  present: boolean | null;
  // No teamfight, hero death or objective in the minute.
  quiet: boolean;
  watch: number;
};

function moment(s: LabSide, m: number, swing: number): Moment {
  const g = grid(s);
  const from = (m - 1) * 60;
  const to = Math.min(m * 60, s.duration);
  const fights = s.fights.teamfights
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.start < to && f.end >= from);
  const heroDeaths = s.match.deaths.filter((d) => d.t >= from && d.t < to);
  const objectives = sorted(s.match.objectives).filter(
    (o) => o.t >= from && o.t < to && (BIG.has(o.type) || o.type === "courier"),
  );
  const ev = s.fights.events.filter((e) => e.t >= from && e.t < to);
  // How far the player was from the nearest death or objective, at its time (alive only).
  let best: number | null = null;
  for (const x of spots(s, from, to)) {
    const at = me(s, g, x.t);
    if (!at?.alive) continue;
    const d = dist(at.p, x.p);
    if (best == null || d < best) best = d;
  }
  const acts = activityIn(s, from, to);
  const mid = me(s, g, (from + to) / 2);
  const joined = fights.some(({ f }) => f.joined);
  const kills = ev.filter((e) => e.kind === "kill").length;
  const deaths = ev.filter((e) => e.kind === "death").length;
  const assists = ev.filter((e) => e.kind === "assist").length;
  const firsts = [
    ...fights.map(({ f }) => f.start),
    ...heroDeaths.map((d) => d.t - 15),
    ...objectives.map((o) => o.t - 15),
  ];
  const quiet = !fights.length && !heroDeaths.length && !objectives.some((o) => BIG.has(o.type));
  return {
    m,
    from,
    to,
    swing,
    fights: fights.map(({ i }) => i),
    ours: heroDeaths.filter((d) => ours(s, d.slot)).length,
    theirs: heroDeaths.filter((d) => !ours(s, d.slot)).length,
    objectives,
    dead: myDeaths(s).reduce(
      (a, e) => a + Math.max(0, Math.min(to, e.t + (e.timeDead ?? 0)) - Math.max(from, e.t)),
      0,
    ),
    activity: topActivity(acts),
    // Where the player was mid-minute (not where they lay dead).
    area: mid?.alive && !deadAt(s, (from + to) / 2) ? areaOf(mid.p.x, mid.p.y, s.radiant) : null,
    dist: best == null ? null : cells(best),
    kills,
    deaths,
    assists,
    dealt: s.advanced.damage.filter((d) => d.out && d.t >= from && d.t < to).reduce((a, d) => a + d.v, 0),
    joined,
    present:
      joined || kills + deaths + assists > 0 || (best != null && best <= NEAR)
        ? true
        : g.pos.has(s.slot) && !quiet
          ? false
          : null,
    quiet,
    watch: Math.max(from - 60, Math.min(from, ...firsts)),
  };
}

// The largest drops (up to four) and gains (up to three) inside a time window.
export function keyMoments(s: LabSide, from = -Infinity, to = Infinity) {
  const series = swingSeries(s);
  if (!series) return null;
  const v = series.values;
  const floor = series.kind === "win" ? 0.05 : 1000;
  const all: { m: number; d: number }[] = [];
  for (let m = 1; m < v.length; m++) {
    if ((m - 1) * 60 >= s.duration || m * 60 <= from || (m - 1) * 60 >= to) continue;
    all.push({ m, d: v[m] - v[m - 1] });
  }
  const drops = all
    .filter((x) => x.d <= -floor)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4)
    .map((x) => moment(s, x.m, x.d));
  const gains = all
    .filter((x) => x.d >= floor)
    .sort((a, b) => b.d - a.d)
    .slice(0, 3)
    .map((x) => moment(s, x.m, x.d));
  return {
    kind: series.kind,
    drops,
    gains,
    list: [...drops, ...gains].sort((a, b) => a.m - b.m),
  };
}

// ── The swing while something happened, by phase ─────────────────────────────────────────────

export const SWING_CATS = ["kills", "deaths", "joined", "missed", "taken", "lost", "quiet"] as const;
export type SwingCat = (typeof SWING_CATS)[number];

// Each minute's change in the team's win chance, added to every thing the player did (or the
// team got) in that minute: the swing while it happened, not the player's credit.
export function swingWhile(s: LabSide) {
  const series = swingSeries(s);
  if (!series) return null;
  const ph = phases(s);
  const rows = Object.fromEntries(
    SWING_CATS.map((k) => [k, { sum: ph.list.map(() => 0), n: ph.list.map(() => 0) }]),
  ) as Record<SwingCat, { sum: number[]; n: number[] }>;
  const v = series.values;
  for (let m = 1; m < v.length; m++) {
    const from = (m - 1) * 60;
    const to = Math.min(m * 60, s.duration);
    if (from >= s.duration) break;
    const p = phaseOf(ph, (from + to) / 2);
    if (p < 0) continue;
    const ev = s.fights.events.filter((e) => e.t >= from && e.t < to);
    const fights = s.fights.teamfights.filter((f) => f.start < to && f.end >= from);
    const objs = s.match.objectives.filter((o) => o.t >= from && o.t < to);
    const cats: SwingCat[] = [];
    if (ev.some((e) => e.kind !== "death")) cats.push("kills");
    if (ev.some((e) => e.kind === "death")) cats.push("deaths");
    if (fights.some((f) => f.joined)) cats.push("joined");
    // Alive at its start (from the exact death times, so it holds without positions too).
    if (fights.some((f) => !f.joined && !deadAt(s, f.start))) cats.push("missed");
    if (objs.some((o) => teamTook(s, o))) cats.push("taken");
    if (objs.some((o) => enemyTook(s, o))) cats.push("lost");
    if (!cats.length) cats.push("quiet");
    for (const c of cats) {
      rows[c].sum[p] += v[m] - v[m - 1];
      rows[c].n[p]++;
    }
  }
  return { kind: series.kind, phases: ph.list, rows };
}

// ── After a won fight or a kill ──────────────────────────────────────────────────────────────

type Doing = "dead" | "hit" | "farm" | "base" | "other";

function afterWindow(s: LabSide, from: number, to: number) {
  const acts = activityIn(s, from, to);
  const alive = acts.filter((a) => a !== "dead");
  const time = {
    farm: alive.filter(isFarm).length * 10,
    fight: alive.filter((a) => a === "fight").length * 10,
    move: alive.filter((a) => a === "move").length * 10,
    base: alive.filter((a) => a === "base").length * 10,
    dead: (acts.length - alive.length) * 10,
  };
  const hit = s.advanced.towerHits.filter((h) => h.t > from && h.t <= to).reduce((a, h) => a + h.v, 0);
  const died = myDeaths(s).some((e) => e.t > from && e.t <= to);
  const taken = sorted(s.match.objectives).filter((o) => o.t > from && o.t <= to && teamTook(s, o));
  const doing: Doing | null = died
    ? "dead"
    : hit >= 100
      ? "hit"
      : !alive.length
        ? null
        : time.farm >= alive.length * 5
          ? "farm"
          : time.base >= alive.length * 3
            ? "base"
            : "other";
  return { time, hit, died, taken, doing };
}

// Won teamfights (more enemy deaths than ours) and the player's kills outside them, with what the
// next 150 s (fights) or 90 s (kills) brought: the team's objectives and what the player did.
export function afterFights(s: LabSide, from = -Infinity, to = Infinity) {
  const won = s.fights.teamfights
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.enemyDeaths > f.teamDeaths && inside(f.end, from, to))
    .map(({ f, i }) => ({
      i,
      start: f.start,
      end: f.end,
      ours: f.teamDeaths,
      theirs: f.enemyDeaths,
      ...afterWindow(s, f.end, f.end + 150),
    }));
  // Kills outside the won fights, grouped when within 20 s of each other.
  const kills = s.fights.events.filter(
    (e) =>
      e.kind === "kill" && inside(e.t, from, to) && !won.some((w) => e.t >= w.start - 5 && e.t <= w.end + 5),
  );
  const picks: { t: number; n: number }[] = [];
  for (const k of kills) {
    const last = picks[picks.length - 1];
    if (last && k.t - last.t <= 20) {
      last.t = k.t;
      last.n++;
    } else picks.push({ t: k.t, n: 1 });
  }
  const after = picks.map((p) => ({ ...p, ...afterWindow(s, p.t, p.t + 90) }));
  // The player's deaths and what the enemy took within 90 s.
  const deaths = myDeaths(s)
    .filter((e) => inside(e.t, from, to))
    .map((e) => ({
      t: e.t,
      lost: sorted(s.match.objectives).filter((o) => o.t >= e.t && o.t <= e.t + 90 && enemyTook(s, o)),
    }));
  return {
    won,
    converted: won.filter((w) => w.taken.length).length,
    hit: won.filter((w) => w.hit >= 100).length,
    picks: after,
    deaths,
  };
}

// ── Buybacks late in the game ────────────────────────────────────────────────────────────────

// From 30:00, or earlier once an own tier-3 tower takes damage (high ground under threat): how much
// of the living time the gold on hand covered a buyback, the deaths without the gold for one, and
// those with buyback ready (gold and cooldown) but not used while own buildings fell before the
// respawn. The per-death numbers are in the death table; this keeps the counts and those deaths.
export function buybackLate(s: LabSide, from = -Infinity, to = Infinity) {
  const t3 = s.match.buildings
    .filter((b) => b.radiant === s.radiant && b.type === "tower" && b.name?.startsWith("tower3"))
    .flatMap((b) => b.hp.filter(([t, hp]) => t > 0 && hp < b.maxHp).map(([t]) => t))
    .sort((a, b) => a - b)[0];
  const start = t3 != null && t3 < BUYBACK_FROM ? t3 : BUYBACK_FROM;
  if (s.duration <= start + 60) return null;
  const u = s.advanced.unspent;
  let alive = 0;
  let held = 0;
  if (u.length) {
    s.path.t.forEach((t, i) => {
      if (t < Math.max(start, from) || t > to || !aliveAt(s, i)) return;
      const nw = at(s.minutes.netWorth, t);
      if (nw == null) return;
      alive++;
      if (u[i] >= buybackCost(nw)) held++;
    });
  }
  const deaths = s.advanced.deathDetails
    .filter((d) => d.t >= start && inside(d.t, from, to))
    .map((d) => {
      const end = d.t + (d.timeDead ?? 0);
      const cost = d.netWorth != null ? Math.round(buybackCost(d.netWorth)) : null;
      return {
        t: d.t,
        gold: d.unspent,
        cost,
        // Short of the gold (null: gold on hand unknown).
        short: d.unspent != null && cost != null ? d.unspent < cost : null,
        ready: d.buyback,
        used: s.resources.buybacks.some((b) => b.t >= d.t && b.t <= end + 2),
        lost: d.objectivesLost.filter((o) => o.type === "building"),
      };
    });
  const known = deaths.filter((d) => d.short != null);
  return {
    start,
    byTower: start < BUYBACK_FROM,
    alive,
    held: u.length ? held : null,
    deaths,
    known: known.length,
    noGold: known.filter((d) => d.short && !d.used),
    unused: deaths.filter((d) => d.ready && !d.used && d.lost.length),
    buybacks: s.resources.buybacks.filter((b) => b.t >= start && inside(b.t, from, to)).length,
  };
}

// ── After each respawn ───────────────────────────────────────────────────────────────────────

export type Respawn = {
  death: number;
  t: number;
  buyback: boolean;
  tp: number | null;
  lh: number | null;
  fight: number | null;
  went: "farm" | "fight" | "base" | "move" | null;
  alone: boolean;
  diedAgain: boolean;
};

export function respawns(s: LabSide, from = -Infinity, to = Infinity): Respawn[] {
  const g = grid(s);
  const tps = tpTimes(s);
  const deaths = myDeaths(s);
  const ownBase = s.radiant ? "radiantBase" : "direBase";
  const out: Respawn[] = [];
  for (const d of deaths) {
    const back = backAt(s, d);
    if (!back || !inside(d.t, from, to)) continue;
    const r = back.t;
    if (r >= s.duration - 10) continue;
    const tp = tps.find((u) => u >= r - 2 && u <= r + 40);
    const lh = s.resources.farm.find((f) => f.t >= r)?.t;
    const fightAt = [
      s.fights.events.find((e) => e.t >= r)?.t,
      s.advanced.damage.find((x) => x.t >= r)?.t,
    ].filter((x): x is number => x != null);
    const fight = fightAt.length ? Math.min(...fightAt) : null;
    const lhIn = lh != null && lh - r <= 180 ? lh - r : null;
    const fightIn = fight != null && fight - r <= 180 ? fight - r : null;
    let went: Respawn["went"] = null;
    if (lhIn != null && lhIn <= 60 && (fightIn == null || lhIn <= fightIn)) went = "farm";
    else if (fightIn != null && fightIn <= 60) went = "fight";
    else {
      const later = me(s, g, r + 60);
      if (later) went = mapZone(later.p.x, later.p.y) === ownBase ? "base" : "move";
    }
    // Rejoined a teamfight under way with no living ally near.
    let alone = false;
    for (const f of s.fights.teamfights) {
      if (f.end < r || f.start > r + 45) continue;
      for (let t = Math.max(r, f.start); t <= Math.min(f.end, r + 60); t += 10) {
        const at = me(s, g, t);
        if (at?.alive && at.enemies >= 1 && at.allies === 0) alone = true;
      }
    }
    out.push({
      death: d.t,
      t: r,
      buyback: back.buyback,
      tp: tp != null ? Math.max(0, tp - r) : null,
      lh: lhIn,
      fight: fightIn,
      went,
      alone,
      diedAgain: deaths.some((e) => e.t > r && e.t <= r + 60),
    });
  }
  return out;
}

// Time between respawn and the first last hit beyond 30 s of walking, when the player neither
// teleported out within 15 s nor fought first, valued at their creep and neutral gold per second
// over the five minutes before the death.
export function respawnIdle(s: LabSide) {
  const g = s.advanced.goldByMinute;
  if (!g.creeps.some((v) => v > 0)) return null;
  let seconds = 0;
  let gold = 0;
  for (const r of respawns(s)) {
    if (r.lh == null || (r.tp != null && r.tp <= 15) || (r.fight != null && r.fight < r.lh)) continue;
    const idle = Math.min(120, Math.max(0, r.lh - 30));
    if (!idle) continue;
    const m = Math.floor(r.death / 60);
    let sum = 0;
    let span = 0;
    for (let k = Math.max(0, m - 5); k < m; k++) {
      sum += g.creeps[k] + g.neutrals[k];
      span++;
    }
    seconds += idle;
    gold += span ? (sum / span / 60) * idle : 0;
  }
  return { seconds, gold: Math.round(gold) };
}

// ── Skirmishes: every exchange of hero damage ────────────────────────────────────────────────

export type Encounter = {
  start: number;
  end: number;
  dealt: number;
  taken: number;
  first: "me" | "them" | "both";
  enemies: number[];
  allies: number;
  died: boolean;
  enemyDeaths: number;
  teamfight: boolean;
  // One enemy hero, no teammate near, outside teamfights.
  duel: boolean;
  result: "won" | "lost" | "traded" | "even";
  byDamage: boolean;
};

// The player's hero damage both ways, cut into exchanges where 6 s pass without any; kept when
// 300 or more damage changed hands or someone died. Who came out ahead: by deaths, else by a 1.5×
// damage edge. Only the player's own damage is in the data, so allies' share is not counted.
export function encounters(s: LabSide): Encounter[] {
  const dmg = s.advanced.damage;
  if (!dmg.length) return [];
  const g = grid(s);
  const groups: (typeof dmg)[] = [];
  for (const d of dmg) {
    const last = groups[groups.length - 1];
    if (last && d.t - last[last.length - 1].t <= 6) last.push(d);
    else groups.push([d]);
  }
  const deaths = myDeaths(s);
  const out: Encounter[] = [];
  for (const list of groups) {
    const start = list[0].t;
    const end = list[list.length - 1].t;
    const dealt = list.filter((d) => d.out).reduce((a, d) => a + d.v, 0);
    const taken = list.filter((d) => !d.out).reduce((a, d) => a + d.v, 0);
    const enemies = [...new Set(list.map((d) => d.hero))];
    const died = deaths.some((e) => e.t >= start && e.t <= end + 3);
    const enemyDeaths = s.match.deaths.filter(
      (d) => !ours(s, d.slot) && enemies.includes(d.hero) && d.t >= start && d.t <= end + 3,
    ).length;
    if (dealt + taken < 300 && !died && !enemyDeaths) continue;
    const firstOut = list.find((d) => d.out)?.t ?? Infinity;
    const firstIn = list.find((d) => !d.out)?.t ?? Infinity;
    const at = me(s, g, start);
    let result: Encounter["result"];
    let byDamage = false;
    if (enemyDeaths && died) result = "traded";
    else if (enemyDeaths) result = "won";
    else if (died) result = "lost";
    else {
      byDamage = true;
      result = dealt >= taken * 1.5 ? "won" : taken >= dealt * 1.5 ? "lost" : "even";
    }
    const teamfight = s.fights.teamfights.some((f) => start <= f.end + 5 && end >= f.start - 5);
    out.push({
      start,
      end,
      dealt,
      taken,
      first: firstOut < firstIn ? "me" : firstIn < firstOut ? "them" : "both",
      enemies,
      allies: at?.allies ?? 0,
      died,
      enemyDeaths,
      teamfight,
      duel: enemies.length === 1 && !!at && at.allies === 0 && !teamfight,
      result,
      byDamage,
    });
  }
  return out;
}

export function encountersByPhase(s: LabSide, list: Encounter[]) {
  const ph = phases(s);
  return ph.list.map((p) => {
    const inP = list.filter((e) => e.start >= p.from && e.start < p.to);
    const small = inP.filter((e) => !e.teamfight);
    return {
      ...p,
      n: inP.length,
      won: inP.filter((e) => e.result === "won").length,
      lost: inP.filter((e) => e.result === "lost").length,
      even: inP.filter((e) => e.result === "even" || e.result === "traded").length,
      small: small.length,
      smallWon: small.filter((e) => e.result === "won").length,
      noDeaths: inP.filter((e) => e.byDamage).length,
      first: inP.filter((e) => e.first === "me").length,
    };
  });
}

// ── Ally deaths: where the player was ────────────────────────────────────────────────────────

export type AllyCls = "dead" | "helped" | "late" | "couldHelp" | "tooFar";
export type AllyDeath = {
  t: number;
  hero: number;
  killer: number | null;
  dist: number | null;
  dist20: number | null;
  dealt: number;
  tp: boolean;
  near: boolean;
  cls: AllyCls;
};

// Each teammate's death: how far the player was then and 20 s before, whether they hit an enemy
// hero in the 10 s before it from within ~3,000 units of it, or teleported within 25 s to near it.
// Helped: hit someone from within ~2,500 units. Could help: within ~1,500 units without a hit. Came
// late: closed in by 1,000+ units to within ~5,000, teleported in, or got within ~2,500 units in the
// 20 s after. Could help (did not come): within ~4,000 units 20 s before. Else too far.
export function allyDeaths(s: LabSide, from = -Infinity, to = Infinity): AllyDeath[] | null {
  const g = grid(s);
  if (!g.pos.has(s.slot)) return null;
  const tps = tpTimes(s);
  return s.match.deaths
    .filter((d) => d.slot !== s.slot && ours(s, d.slot) && inside(d.t, from, to))
    .map((d) => {
      const i = idx(g, d.t);
      const spot = d.x != null && d.y != null ? { x: d.x, y: d.y } : i != null ? posAt(g, d.slot, i) : null;
      const now = me(s, g, d.t);
      const before = me(s, g, d.t - 20);
      const dealt = spot
        ? s.advanced.damage
            .filter((x) => {
              if (!x.out || x.t < d.t - 10 || x.t > d.t + 2) return false;
              const at = me(s, g, x.t);
              return !!at && dist(at.p, spot) <= FAR;
            })
            .reduce((a, x) => a + x.v, 0)
        : 0;
      const base = { t: d.t, hero: d.hero, killer: d.killer, dealt };
      if (!now || !spot)
        return { ...base, dist: null, dist20: null, tp: false, near: false, cls: "tooFar" as const };
      const dNow = dist(now.p, spot);
      const dBefore = before ? dist(before.p, spot) : dNow;
      const tp = tps.some((u) => {
        if (u < d.t - 25 || u > d.t + 5) return false;
        const land = me(s, g, u + 8);
        return !!land && dist(land.p, spot) <= FAR;
      });
      const near = dNow <= NEAR;
      const arrived = [10, 20].some((dt) => {
        const at = me(s, g, d.t + dt);
        return !!at?.alive && dist(at.p, spot) <= 20;
      });
      let cls: AllyCls;
      if (!now.alive) cls = "dead";
      else if (dealt > 0 && dNow <= 20) cls = "helped";
      else if (near) cls = "couldHelp";
      else if (tp || arrived || (dBefore - dNow >= 8 && dNow <= 40)) cls = "late";
      else if (dBefore <= 32) cls = "couldHelp";
      else cls = "tooFar";
      return { ...base, dist: cells(dNow), dist20: cells(dBefore), tp, near, cls };
    });
}

// ── Space: the enemies drawn ─────────────────────────────────────────────────────────────────

// Enemies alive within ~1,800 units of each living hero of the team, every 10 s: the player's share
// of that attention, by phase. With a pos-1 teammate, the carry's gold per minute in the minutes
// the player drew two or more enemies while the carry had none near, against the other minutes.
// The player's deaths away from the team (no ally within ~3,000 units): to three or more enemies
// (drawing them), to one (a pick-off), else.
export function space(s: LabSide, until = Infinity) {
  const g = grid(s);
  if (!g.pos.has(s.slot)) return null;
  const ph = phases(s);
  const team = [s.slot, ...g.allies];
  const attention = (slot: number, i: number) => {
    if (!isAlive(g, slot, i)) return 0;
    const p = posAt(g, slot, i);
    return p ? countNear(g, g.enemies, i, p, ATTENTION) : 0;
  };
  const per = ph.list.map(() => ({ mine: 0, team: 0, alive: 0 }));
  g.t.forEach((t, i) => {
    const k = phaseOf(ph, t);
    if (k < 0 || t > until) return;
    const mine = attention(s.slot, i);
    per[k].mine += mine;
    per[k].team += team.reduce((a, slot) => a + attention(slot, i), 0);
    if (isAlive(g, s.slot, i)) per[k].alive++;
  });
  // The carry's farm while the player drew enemies.
  const carry =
    s.position !== 1
      ? s.match.players.find((p) => ours(s, p.slot) && p.slot !== s.slot && p.position === 1)
      : undefined;
  let carryFarm: { hero: number; minutes: number; gpm: number; other: number } | null = null;
  if (carry && g.pos.has(carry.slot) && carry.curves.gold.length > 2) {
    const drew: number[] = [];
    const other: number[] = [];
    const start = Math.ceil(ph.list[0].to / 60);
    for (let m = start; m < carry.curves.gold.length - 1; m++) {
      let n = 0;
      g.t.forEach((t, i) => {
        if (t < m * 60 || t >= (m + 1) * 60) return;
        if (attention(s.slot, i) >= 2 && isAlive(g, carry.slot, i) && attention(carry.slot, i) === 0) n++;
      });
      (n >= 3 ? drew : other).push(carry.curves.gold[m + 1] - carry.curves.gold[m]);
    }
    if (drew.length >= 3 && other.length >= 3)
      carryFarm = { hero: carry.heroId, minutes: drew.length, gpm: mean(drew)!, other: mean(other)! };
  }
  const deaths = myDeaths(s).map((e) => {
    const at = me(s, g, e.t - 1);
    if (!at) return { t: e.t, kind: "unknown" as const, enemies: null };
    const far = countNear(g, g.allies, at.i, at.p, FAR) === 0;
    const enemies = at.enemies;
    const kind = !far ? "team" : enemies >= 3 ? "space" : enemies === 1 ? "feed" : "other";
    return { t: e.t, kind, enemies };
  });
  return {
    phases: ph.list.map((p, k) => ({
      ...p,
      avg: per[k].alive ? per[k].mine / per[k].alive : null,
      share: per[k].team ? per[k].mine / per[k].team : null,
    })),
    share: (() => {
      const mine = per.reduce((a, x) => a + x.mine, 0);
      const all = per.reduce((a, x) => a + x.team, 0);
      return all ? mine / all : null;
    })(),
    carry: carryFarm,
    deaths,
  };
}

// ── Risk: alone among enemies, away from the towers ──────────────────────────────────────────

// Fallen times of buildings by key (OpenDota's kills, which STRATZ's health doesn't always reach).
function fallen(s: LabSide) {
  const out = new Map<string, number>();
  for (const o of s.match.objectives)
    if (o.type === "building" && o.key && !out.has(o.key)) out.set(o.key, o.t);
  return out;
}

function buildingDied(s: LabSide, b: LabBuilding, fell: Map<string, number>) {
  const key = b.name ? `npc_dota_${b.radiant ? "goodguys" : "badguys"}_${b.name}` : null;
  const od = key ? fell.get(key) : undefined;
  return b.died ?? (b.name === "tower4" ? null : (od ?? null));
}

// A living player with two or more enemies near, no ally near and no own tower within ~2,000 units,
// every 10 s; runs of these are episodes, ending in a death within 15 s or an escape. A minute
// whose lowest health was under 30% (without a death) marks a close call.
export function risk(s: LabSide, until = Infinity) {
  const g = grid(s);
  if (!g.pos.has(s.slot)) return null;
  const ph = phases(s);
  const fell = fallen(s);
  const towers = s.match.buildings
    .filter((b) => b.radiant === s.radiant && (b.type === "tower" || b.type === "fort"))
    .map((b) => ({ p: { x: b.x, y: b.y }, died: buildingDied(s, b, fell) }));
  const deaths = myDeaths(s);
  const risky = g.t.map((t) => {
    if (t < 0 || t > until) return false;
    const at = me(s, g, t);
    if (!at?.alive || at.enemies < 2 || at.allies > 0) return false;
    if (!towers.length) return true;
    return !towers.some((w) => (w.died == null || w.died > t) && dist(w.p, at.p) <= AT_SPOT);
  });
  const episodes: { start: number; end: number; died: boolean; close: boolean; enemies: number }[] = [];
  risky.forEach((r, i) => {
    if (!r) return;
    const t = g.t[i];
    const enemies = me(s, g, t)?.enemies ?? 0;
    const last = episodes[episodes.length - 1];
    if (last && t - last.end <= 10) {
      last.end = t;
      last.enemies = Math.max(last.enemies, enemies);
    } else episodes.push({ start: t, end: t, died: false, close: false, enemies });
  });
  for (const e of episodes) {
    e.died = deaths.some((d) => d.t >= e.start - 10 && d.t <= e.end + 15);
    if (!e.died)
      for (let m = Math.floor((e.start - 10) / 60); m <= Math.floor(e.end / 60); m++) {
        const hp = s.minutes.hpMin[m];
        const deathThen = deaths.some((d) => Math.floor(d.t / 60) === m);
        if (hp != null && hp < 0.3 && !deathThen) e.close = true;
      }
  }
  return {
    episodes,
    phases: ph.list.map((p) => {
      const inP = (t: number) => t >= p.from && t < p.to;
      const list = episodes.filter((e) => inP(e.start));
      let alive = 0;
      let n = 0;
      g.t.forEach((t, i) => {
        if (!inP(t) || t < 0 || t > until || !isAlive(g, s.slot, i)) return;
        alive++;
        if (risky[i]) n++;
      });
      return {
        ...p,
        seconds: n * 10,
        alive: alive * 10,
        share: alive ? n / alive : null,
        episodes: list.length,
        died: list.filter((e) => e.died).length,
        escaped: list.filter((e) => !e.died).length,
        close: list.filter((e) => e.close).length,
      };
    }),
  };
}

// ── Objectives ───────────────────────────────────────────────────────────────────────────────

// Where an objective was: a building's place (STRATZ); Roshan's and the Tormentor's from the hero who
// took the Aegis or the kill (else the middle of the team that took it), a courier's from its killer.
// Roshan's and the Tormentor's pits move between patches, so these are approximate.
export function objectivePlace(s: LabSide, o: LabObjective): { p: Pt; approx: boolean } | null {
  if (o.type === "building") {
    const b = buildingOf(s, o.key, o.t);
    return b ? { p: { x: b.x, y: b.y }, approx: false } : null;
  }
  const g = grid(s);
  const i = idx(g, o.t);
  if (i == null) return null;
  let slot = o.slot;
  if (o.type === "roshan")
    slot =
      s.match.objectives.find((a) => a.type === "aegis" && Math.abs(a.t - o.t) <= 10 && a.slot != null)
        ?.slot ?? null;
  if (slot != null) {
    const p = posAt(g, slot, i);
    if (p) return { p, approx: true };
  }
  if (o.type === "courier" || o.radiant == null) return null;
  // The team's living heroes: the one nearest the others.
  const pts = s.match.players
    .filter((p) => p.radiant === o.radiant && isAlive(g, p.slot, i))
    .map((p) => posAt(g, p.slot, i))
    .filter((p): p is Pt => !!p);
  if (!pts.length) return null;
  const best = pts
    .map((p) => ({ p, d: pts.reduce((a, q) => a + dist(p, q), 0) }))
    .sort((a, b) => a.d - b.d)[0];
  return { p: best.p, approx: true };
}

export function buildingOf(s: LabSide, key: string | null, t: number): LabBuilding | null {
  const m = key ? /^npc_dota_(good|bad)guys_(.+)$/.exec(key) : null;
  if (!m) return null;
  const list = s.match.buildings.filter((b) => b.radiant === (m[1] === "good") && b.name === m[2]);
  // The two tier-4 towers share a name: the one that fell nearest that time.
  const score = (b: LabBuilding) => (b.died == null ? 1e9 : Math.abs(b.died - t));
  return [...list].sort((a, b) => score(a) - score(b))[0] ?? null;
}

export type ObjRow = {
  o: LabObjective;
  ours: boolean;
  place: Pt | null;
  approx: boolean;
  // Alive: the closest of the 20 s before; dead: from where the player lay (for the chart only).
  dist: number | null;
  raw: number | null;
  alive: boolean | null;
  activity: Activity | null;
  present: boolean | null;
  aegis: number | null;
};

// Every building, Roshan, Tormentor and courier kill of both teams, with the player's distance (the
// closest of the 20 s before) and state.
export function objectiveRows(s: LabSide, from = -Infinity, to = Infinity): ObjRow[] {
  const g = grid(s);
  return sorted(s.match.objectives)
    .filter((o) => (BIG.has(o.type) || o.type === "courier") && inside(o.t, from, to))
    .map((o) => {
      const place = objectivePlace(s, o);
      const mine = o.type === "courier" ? o.radiant !== s.radiant : o.radiant === s.radiant;
      let best: number | null = null;
      let raw: number | null = null;
      let alive: boolean | null = null;
      for (const dt of [0, 10, 20]) {
        const at = me(s, g, o.t - dt);
        if (!at) continue;
        // A position counts only from a living sample at a living moment (the sample can be from
        // just before a death or a respawn).
        const up = at.alive && !deadAt(s, o.t - dt);
        if (dt === 0) {
          alive = !deadAt(s, o.t);
          if (place && (up || !alive)) raw = dist(at.p, place.p);
        }
        if (!up || !place) continue;
        const d = dist(at.p, place.p);
        if (best == null || d < best) best = d;
      }
      const aegis =
        o.type === "roshan"
          ? (s.match.objectives.find((a) => a.type === "aegis" && Math.abs(a.t - o.t) <= 10)?.slot ?? null)
          : null;
      // Alive then (just respawned or bought back): the samples from before it don't count.
      const acts = activityIn(s, o.t - 10, o.t).filter((a) => alive === false || a !== "dead");
      return {
        o,
        ours: mine,
        place: place?.p ?? null,
        approx: place?.approx ?? false,
        dist: best == null ? null : cells(best),
        raw: raw == null ? null : cells(raw),
        alive,
        activity: topActivity(acts),
        present: alive == null ? null : alive && best != null && best <= AT_SPOT,
        aegis,
      };
    });
}

// ── Building defence ─────────────────────────────────────────────────────────────────────────

export type Defense = {
  b: LabBuilding;
  start: number;
  end: number;
  lost: number;
  died: boolean;
  dist: number | null;
  alive: boolean | null;
  arrival: number | null;
  tp: boolean;
  activity: Activity | null;
  farAway: boolean;
};

// Each own building's spells of damage (drops within 25 s of each other, 250+ health and 12% of its
// maximum, or the one it fell in; the health lost is from before the first drop to the lowest): how
// far the player was when it began, whether and how soon they came within ~2,000 units, by teleport
// or on foot, and buildings that fell while the player farmed ~5,000+ units away. Trades: each
// building lost paired with the nearest one taken within 90 s.
export function defense(s: LabSide, from = -Infinity, to = Infinity) {
  const g = grid(s);
  const fell = fallen(s);
  const tps = tpTimes(s);
  const out: Defense[] = [];
  for (const b of s.match.buildings) {
    if (b.radiant !== s.radiant || (b.type !== "tower" && b.type !== "barracks" && b.type !== "fort"))
      continue;
    const died = buildingDied(s, b, fell);
    const spells: { start: number; end: number; top: number; low: number }[] = [];
    let prev = b.hp[0]?.[1] ?? b.maxHp;
    for (const [t, hp] of b.hp.slice(1)) {
      if (hp < prev) {
        const last = spells[spells.length - 1];
        if (last && t - last.end <= 25) {
          last.end = t;
          last.low = Math.min(last.low, hp);
        } else spells.push({ start: t, end: t, top: prev, low: hp });
      }
      prev = hp;
    }
    for (const w of spells) {
      const lost = w.top - w.low;
      const fellNow = died != null && died >= w.start && died <= w.end + 30;
      if ((!fellNow && lost < Math.max(250, b.maxHp * 0.12)) || !inside(w.start, from, to)) continue;
      const atStart = me(s, g, w.start);
      let arrival: number | null = null;
      for (let t = w.start; t <= w.end + 10; t += 10) {
        const at = me(s, g, t);
        if (at?.alive && !deadAt(s, t) && dist(at.p, b) <= AT_SPOT) {
          arrival = Math.max(0, Math.round(t - w.start));
          break;
        }
      }
      const until = arrival != null ? w.start + arrival : w.end + 10;
      const activity = topActivity(activityIn(s, w.start, w.end));
      const d = atStart ? dist(atStart.p, b) : null;
      out.push({
        b,
        start: w.start,
        end: w.end,
        lost: Math.round(lost),
        died: fellNow,
        dist: d == null ? null : cells(d),
        alive: atStart?.alive ?? null,
        arrival,
        tp: tps.some((u) => u >= w.start - 10 && u <= until),
        activity,
        farAway: fellNow && arrival == null && d != null && d >= 40 && isFarm(activity),
      });
    }
  }
  out.sort((a, b) => a.start - b.start);
  const objs = sorted(s.match.objectives).filter((o) => o.type === "building" && inside(o.t, from, to));
  const used = new Set<LabObjective>();
  const trades: { lost: LabObjective; took: LabObjective }[] = [];
  for (const o of objs.filter((x) => enemyTook(s, x))) {
    const took = objs
      .filter((x) => teamTook(s, x) && !used.has(x) && Math.abs(x.t - o.t) <= 90)
      .sort((a, b) => Math.abs(a.t - o.t) - Math.abs(b.t - o.t))[0];
    if (!took) continue;
    used.add(took);
    trades.push({ lost: o, took });
  }
  return { list: out, trades, lostFarming: out.filter((d) => d.farAway).length };
}

// ── Split pushing ────────────────────────────────────────────────────────────────────────────

// The player's damage to buildings with no living ally near against with the team, the buildings
// they finished either way, the living time in the enemy half with no ally within ~3,000 units, and
// what they did during each teamfight they didn't join.
export function splitPush(s: LabSide, from = -Infinity, to = Infinity) {
  const g = grid(s);
  if (!g.pos.has(s.slot)) return null;
  const alone = (t: number) => {
    const at = me(s, g, t);
    return at ? at.allies === 0 : null;
  };
  let soloDmg = 0;
  let teamDmg = 0;
  for (const h of s.advanced.towerHits) {
    if (!inside(h.t, from, to)) continue;
    if (alone(h.t)) soloDmg += h.v;
    else teamDmg += h.v;
  }
  const kills = s.resources.buildingKills.filter((k) => inside(k.t, from, to));
  const soloKills = kills.filter((k) => alone(k.t)).length;
  let enemyHalf = 0;
  let aliveN = 0;
  g.t.forEach((t, i) => {
    if (t < 0 || !inside(t, from, to) || !isAlive(g, s.slot, i)) return;
    aliveN++;
    const p = posAt(g, s.slot, i)!;
    const deep = s.radiant ? p.x + p.y > 262 : p.x + p.y < 250;
    if (deep && countNear(g, g.allies, i, p, FAR) === 0) enemyHalf++;
  });
  const skipped = s.fights.teamfights
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !f.joined && inside(f.start, from, to))
    .map(({ f, i }) => {
      const where = s.match.deaths.filter(
        (d) => d.t >= f.start && d.t <= f.end + 2 && d.x != null && d.y != null,
      );
      const c = where.length ? { x: mean(where.map((d) => d.x!))!, y: mean(where.map((d) => d.y!))! } : null;
      const at = me(s, g, (f.start + f.end) / 2);
      return {
        i,
        start: f.start,
        end: f.end,
        ours: f.teamDeaths,
        theirs: f.enemyDeaths,
        hit: s.advanced.towerHits
          .filter((h) => h.t >= f.start - 10 && h.t <= f.end + 10)
          .reduce((a, h) => a + h.v, 0),
        dist: at && c ? cells(dist(at.p, c)) : null,
        alive: at?.alive ?? null,
        activity: topActivity(activityIn(s, f.start, f.end)),
      };
    });
  return {
    solo: soloDmg,
    team: teamDmg,
    kills: kills.length,
    soloKills,
    enemyHalf: enemyHalf * 10,
    alive: aliveN * 10,
    skipped,
  };
}

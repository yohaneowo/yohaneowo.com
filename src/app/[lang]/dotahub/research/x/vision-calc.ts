import type { LabSide } from "@/lib/dota/lab";
import type { Activity } from "@/lib/dota/lab-extra";
import type { LabMatchWard } from "@/lib/dota/lab-match";
import { aliveAt, type Area, areaOf } from "../insights";
import { CELL, cellDist, sum } from "./util";
import {
  deadSpans,
  isDead,
  isNight,
  OBSERVER_RADIUS,
  positionAt,
  SENTRY_TRUE_SIGHT,
  sightAt,
  sightShare,
  standing,
  teamSight,
  wardEnd,
  wardLive,
} from "./vision-fog";

// The vision module's numbers: time spent inside enemy (and own) observers' vision, what the
// player's own wards saw, how their wards compare with their usual spots, the whole board at a
// moment, and the two players' direct dealings when both are in the same match. Pure, cached per side.

const OBS_R = OBSERVER_RADIUS / CELL;
const SENTRY_R = SENTRY_TRUE_SIGHT / CELL;
// Within this many map cells (about 1,500 units) counts as nearby, as elsewhere in the lab.
export const NEAR = 12;
// A minute before a death: exposed when half of it or more was inside enemy observer vision.
const BEFORE = 60;
const EXPOSED = 30;

const memo = new WeakMap<LabSide, Map<string, unknown>>();
function cached<T>(s: LabSide, key: string, f: () => T): T {
  let m = memo.get(s);
  if (!m) memo.set(s, (m = new Map()));
  if (!m.has(key)) m.set(key, f());
  return m.get(key) as T;
}

const observers = (s: LabSide, enemy: boolean) =>
  s.match.wards.filter((w) => w.kind === "obs" && w.radiant === (enemy ? !s.radiant : s.radiant));

// For each of the player's 10-second samples: inside a live enemy (or own) observer's radius.
function cover(s: LabSide, enemy: boolean): boolean[] {
  return cached(s, `cover${enemy}`, () => {
    const wards = observers(s, enemy);
    return s.path.t.map((t, i) => {
      const at = { x: s.path.x[i], y: s.path.y[i] };
      return wards.some((w) => wardLive(w, t) && cellDist(w, at) <= OBS_R);
    });
  });
}

export const enemyCover = (s: LabSide) => cover(s, true);

// ── Exposure ─────────────────────────────────────────────────────────────────────────────────

export type ExposureRow = "alive" | "farmLane" | "farmJungle" | "fight" | "move";
export const EXPOSURE_ROWS: ExposureRow[] = ["alive", "farmLane", "farmJungle", "fight", "move"];
const inRow = (row: ExposureRow, a: Activity) => (row === "alive" ? a !== "dead" : a === row);

// Alive time after the horn in [from, to], by what the player was doing: samples, and how many were
// inside enemy observer vision and inside own observer vision.
export function exposure(s: LabSide, from = -Infinity, to = Infinity) {
  const act = s.advanced.activity;
  if (!act.length || act.length !== s.path.t.length) return null;
  const enemy = cover(s, true);
  const own = cover(s, false);
  const rows = Object.fromEntries(EXPOSURE_ROWS.map((r) => [r, { n: 0, enemy: 0, own: 0 }])) as Record<
    ExposureRow,
    { n: number; enemy: number; own: number }
  >;
  s.path.t.forEach((t, i) => {
    if (t < Math.max(0, from) || t > to) return;
    for (const r of EXPOSURE_ROWS)
      if (inRow(r, act[i])) {
        rows[r].n++;
        if (enemy[i]) rows[r].enemy++;
        if (own[i]) rows[r].own++;
      }
  });
  const share = (r: ExposureRow, k: "enemy" | "own") => (rows[r].n ? rows[r][k] / rows[r].n : null);
  const farm = {
    n: rows.farmLane.n + rows.farmJungle.n,
    enemy: rows.farmLane.enemy + rows.farmJungle.enemy,
    own: rows.farmLane.own + rows.farmJungle.own,
  };
  return {
    rows,
    share,
    farmEnemy: farm.n ? farm.enemy / farm.n : null,
    farmOwn: farm.n ? farm.own / farm.n : null,
    farmN: farm.n,
  };
}

// Each death: seconds of the minute before spent alive inside enemy observer vision.
export function deathExposure(s: LabSide) {
  return cached(s, "deaths", () => {
    const enemy = cover(s, true);
    return s.fights.events
      .filter((f) => f.kind === "death")
      .map((d) => {
        let secs = 0;
        let n = 0;
        s.path.t.forEach((t, i) => {
          if (t < d.t - BEFORE || t >= d.t || !aliveAt(s, i)) return;
          n++;
          if (enemy[i]) secs += 10;
        });
        return {
          t: d.t,
          kind: s.advanced.deathDetails.find((x) => x.t === d.t)?.kind ?? null,
          secs,
          n,
          exposed: n > 0 && secs >= EXPOSED,
        };
      })
      .filter((d) => d.n > 0);
  });
}

// ── What the player's wards saw ──────────────────────────────────────────────────────────────

// Each observer the player placed: enemy hero-seconds inside its radius over its life (dead heroes
// left out), and enemy heroes killed inside it (null when the deaths have no places: no STRATZ). Each
// sentry: enemy wards the team destroyed within its true sight while it stood. No line of sight:
// trees and high ground block a ward, not counted here.
export function wardValue(s: LabSide) {
  return cached(s, "wardValue", () => {
    const m = s.match;
    const spans = deadSpans(m);
    const enemies = m.players.filter((p) => p.radiant !== s.radiant);
    const mine = m.wards.filter((w) => w.slot === s.slot);
    const hasGrid = m.grid.t.length > 0;
    const placed = m.deaths.some((d) => d.x != null && d.y != null);
    const obs = mine
      .filter((w) => w.kind === "obs")
      .map((w) => {
        const end = Math.min(wardEnd(w), s.duration);
        let samples = 0;
        if (hasGrid)
          m.grid.t.forEach((t, k) => {
            if (t < w.t || t >= end) return;
            for (const e of enemies) {
              const p = m.grid.pos[String(e.slot)];
              if (!p?.x.length || isDead(spans, e.slot, t)) continue;
              if (cellDist(w, { x: p.x[k], y: p.y[k] }) <= OBS_R) samples++;
            }
          });
        const kills = placed
          ? m.deaths.filter(
              (d) =>
                d.slot >= 128 === s.radiant &&
                d.x != null &&
                d.y != null &&
                d.t >= w.t &&
                d.t <= end &&
                cellDist(w, { x: d.x, y: d.y }) <= OBS_R,
            ).length
          : null;
        return { ward: w, end, heroSeconds: hasGrid ? samples * 10 : null, kills };
      });
    const sen = mine
      .filter((w) => w.kind === "sen")
      .map((w) => {
        const end = Math.min(wardEnd(w), s.duration);
        const cleared = m.wards.filter(
          (e) =>
            e.radiant !== s.radiant &&
            e.destroyedBy != null &&
            e.destroyedBy < 128 === s.radiant &&
            e.end != null &&
            e.end >= w.t &&
            e.end <= end &&
            cellDist(e, w) <= SENTRY_R,
        );
        return {
          ward: w,
          end,
          cleared: cleared.length,
          observers: cleared.filter((e) => e.kind === "obs").length,
        };
      });
    const seen = obs.filter((o) => o.heroSeconds != null).map((o) => o.heroSeconds!);
    return {
      obs,
      sen,
      totalSeconds: seen.length ? sum(seen) : null,
      perObserver: seen.length ? sum(seen) / seen.length : null,
      kills: placed ? sum(obs.map((o) => o.kills ?? 0)) : null,
      cleared: sum(sen.map((x) => x.cleared)),
    };
  });
}

// ── Usual ward spots ─────────────────────────────────────────────────────────────────────────

// A spot is usual when the player put at least this many observers within ~500 units of it in their
// other games on the hero.
const USUAL_R = 4;
const USUAL_N = 3;

// The player's ward map from their other games (OpenDota keys it by the rounded cell, this game's
// wards included, so those are taken out), and which of this game's observers were at usual spots.
export function wardHabits(s: LabSide) {
  return cached(s, "habits", () => {
    const wm = s.refs.wardmap;
    if (!wm) return null;
    const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
    const past = (kind: "obs" | "sen", cells: { x: number; y: number; n: number }[]) => {
      const own = new Map<string, number>();
      for (const w of s.vision.wards)
        if (w.kind === kind) own.set(key(w.x, w.y), (own.get(key(w.x, w.y)) ?? 0) + 1);
      return cells
        .map((c) => ({ ...c, n: Math.max(0, c.n - (own.get(key(c.x, c.y)) ?? 0)) }))
        .filter((c) => c.n > 0);
    };
    const obs = past("obs", wm.obs);
    const sen = past("sen", wm.sen);
    const spots = s.vision.wards
      .filter((w) => w.kind === "obs")
      .map((w) => {
        const near = sum(obs.filter((c) => cellDist(c, w) <= USUAL_R).map((c) => c.n));
        return { t: w.t, x: w.x, y: w.y, near, usual: near >= USUAL_N };
      });
    return {
      obs,
      sen,
      obsTotal: sum(obs.map((c) => c.n)),
      senTotal: sum(sen.map((c) => c.n)),
      spots,
      usual: spots.filter((x) => x.usual).length,
    };
  });
}

// ── What the team could see ──────────────────────────────────────────────────────────────────

// Share of the enemy heroes' living time the player's team saw, and of the player's own living time
// the enemy saw, within [from, to] seconds.
export function fogShares(s: LabSide, from = -Infinity, to = Infinity) {
  const ours = teamSight(s.match, s.radiant);
  const theirs = teamSight(s.match, !s.radiant);
  if (!ours || !theirs) return null;
  const mine = theirs.seen.get(s.slot) ?? [];
  let n = 0;
  let seen = 0;
  mine.forEach((v, k) => {
    const t = theirs.t[k];
    if (v == null || t < Math.max(0, from) || t > to) return;
    n++;
    if (v) seen++;
  });
  return {
    team: sightShare(ours, from, to),
    day: sightShare(ours, from, to, (t) => !isNight(t)).share,
    night: sightShare(ours, from, to, isNight).share,
    seenByEnemy: n ? seen / n : null,
    n,
  };
}

// At each of the player's deaths: the enemies within reach a second before, and whether the team saw
// each of them then and ten seconds earlier.
export function deathSight(s: LabSide) {
  return cached(s, "deathSight", () => {
    const m = s.match;
    if (!m.grid.t.length) return [];
    const spans = deadSpans(m);
    return s.fights.events
      .filter((f) => f.kind === "death")
      .map((d) => {
        const t = d.t - 1;
        const me = positionAt(m, s.slot, t);
        const now = sightAt(m, s.radiant, t);
        const before = sightAt(m, s.radiant, d.t - 10);
        const near = m.players
          .filter((p) => p.radiant !== s.radiant && !isDead(spans, p.slot, t))
          .flatMap((p) => {
            const at = positionAt(m, p.slot, t);
            if (!me || !at || cellDist(me, at) > NEAR) return [];
            return [
              {
                slot: p.slot,
                hero: p.heroId,
                seen: now.get(p.slot) === true,
                before: before.get(p.slot) === true,
                credited: d.enemies.includes(p.heroId) || d.hero === p.heroId,
              },
            ];
          });
        return {
          t: d.t,
          night: isNight(t),
          kind: s.advanced.deathDetails.find((x) => x.t === d.t)?.kind ?? null,
          near,
        };
      });
  });
}

// ── The whole board at a moment ──────────────────────────────────────────────────────────────

export function boardAt(s: LabSide, t: number) {
  const m = s.match;
  const spans = deadSpans(m);
  const sight = sightAt(m, s.radiant, t);
  const heroes = m.players.map((p) => {
    const at = positionAt(m, p.slot, t);
    return {
      slot: p.slot,
      hero: p.heroId,
      radiant: p.radiant,
      at,
      dead: isDead(spans, p.slot, t),
      // Enemies only: whether the studied player's team saw them.
      seen: p.radiant === s.radiant ? null : sight.get(p.slot) === true,
    };
  });
  const wards = m.wards.filter((w) => wardLive(w, t));
  const buildings = m.buildings.filter(
    (b) => b.type !== "outpost" && b.type !== "other" && standing(m, b, t),
  );
  const before = m.objectives.filter((o) => o.t <= t);
  const lastOf = (type: string) => before.filter((o) => o.type === type).pop() ?? null;
  const roshan = lastOf("roshan");
  // The Aegis lasts five minutes, and goes with its holder's next death.
  const aegis = before.filter((o) => o.type === "aegis" || o.type === "aegisStolen").pop() ?? null;
  const holder =
    aegis?.slot != null &&
    t - aegis.t < 300 &&
    !m.deaths.some((d) => d.slot === aegis.slot && d.t > aegis.t && d.t <= t)
      ? { slot: aegis.slot, until: aegis.t + 300 }
      : null;
  return {
    heroes,
    wards,
    buildings,
    night: isNight(t),
    roshan: roshan ? { t: roshan.t, radiant: roshan.radiant } : null,
    aegis: holder,
    tormentors: before.filter((o) => o.type === "tormentor").map((o) => ({ t: o.t, radiant: o.radiant })),
  };
}

// The moments worth a look: each teamfight's start and each of the player's deaths.
export function moments(s: LabSide) {
  return [
    ...s.match.teamfights.map((f) => ({ kind: "fight" as const, t: f.start })),
    ...s.fights.events.filter((f) => f.kind === "death").map((f) => ({ kind: "death" as const, t: f.t })),
  ].sort((a, b) => a.t - b.t);
}

// ── Two players in the same match ────────────────────────────────────────────────────────────

const FARMING: Activity[] = ["farmLane", "farmJungle"];

const duels = new WeakMap<LabSide, WeakMap<LabSide, ReturnType<typeof duelOf>>>();
export function duel(a: LabSide, b: LabSide) {
  const byB = duels.get(a) ?? new WeakMap<LabSide, ReturnType<typeof duelOf>>();
  duels.set(a, byB);
  if (!byB.has(b)) byB.set(b, duelOf(a, b));
  return byB.get(b) ?? null;
}

function duelOf(a: LabSide, b: LabSide) {
  if (a.matchId !== b.matchId || a.slot === b.slot) return null;
  const opponents = a.radiant !== b.radiant;
  // Damage between the two, from A's events (both ways), else B's.
  const fromA = a.advanced.damage.length > 0;
  const hits = (fromA ? a.advanced.damage : b.advanced.damage).filter(
    (d) => d.hero === (fromA ? b.heroId : a.heroId),
  );
  const aToB = hits.filter((d) => d.out === fromA);
  const bToA = hits.filter((d) => d.out !== fromA);
  const cumulative = (list: { t: number; v: number }[], len: number) => {
    const out = Array.from({ length: len }, () => 0);
    for (const d of list) for (let m = Math.max(0, Math.ceil(d.t / 60)); m < len; m++) out[m] += d.v;
    return out;
  };
  const len = Math.max(a.minutes.netWorth.length, b.minutes.netWorth.length);
  // Kills between them: the one who got the kill, or helped.
  const deathsOf = (victim: LabSide, by: LabSide) =>
    a.match.deaths
      .filter((d) => d.slot === victim.slot && (d.killer === by.heroId || d.involved.includes(by.heroId)))
      .map((d) => ({ t: d.t, killer: d.killer === by.heroId }));
  const items = (s: LabSide) => a.match.players.find((p) => p.slot === s.slot)?.keyItems ?? [];
  // Neutral last hits by jungle: on the side's own side of the river (the map's diagonal, as in the
  // farming section) or the other side's. Camps by the side lanes and the river count too. Null
  // without STRATZ's last hits.
  const jungle = (s: LabSide) => {
    if (!s.resources.farm.length) return null;
    const out: Record<"own" | "enemy", { n: number; gold: number }> = {
      own: { n: 0, gold: 0 },
      enemy: { n: 0, gold: 0 },
    };
    for (const f of s.resources.farm) {
      if (f.kind === 0 || f.x == null || f.y == null) continue;
      const k = f.x + f.y < 256 === s.radiant ? "own" : "enemy";
      out[k].n++;
      out[k].gold += f.gold;
    }
    return out;
  };
  // While one farmed, what the other did, where they were (alive) and how often within reach.
  const whileFarmed = (s: LabSide, o: LabSide) => {
    const at = new Map(s.path.t.map((t, i) => [t, i]));
    const counts: Partial<Record<Activity, number>> = {};
    const areas: Partial<Record<Area, number>> = {};
    let n = 0;
    let alive = 0;
    let near = 0;
    o.path.t.forEach((t, j) => {
      if (t < 0 || !FARMING.includes(o.advanced.activity[j])) return;
      const i = at.get(t);
      if (i == null || !s.advanced.activity[i]) return;
      n++;
      const act = s.advanced.activity[i];
      counts[act] = (counts[act] ?? 0) + 1;
      if (!aliveAt(s, i)) return;
      alive++;
      const area = areaOf(s.path.x[i], s.path.y[i], s.radiant);
      areas[area] = (areas[area] ?? 0) + 1;
      if (cellDist({ x: s.path.x[i], y: s.path.y[i] }, { x: o.path.x[j], y: o.path.y[j] }) <= NEAR) near++;
    });
    return { n, counts, alive, areas, near: n ? near / n : null };
  };
  return {
    opponents,
    damage: hits.length
      ? {
          aToB: sum(aToB.map((d) => d.v)),
          // Dealt by A's illusions or other units.
          aToBUnits: sum(aToB.filter((d) => d.ill).map((d) => d.v)),
          bToA: sum(bToA.map((d) => d.v)),
          bToAUnits: sum(bToA.filter((d) => d.ill).map((d) => d.v)),
          aToB10: sum(aToB.filter((d) => d.t < 600).map((d) => d.v)),
          bToA10: sum(bToA.filter((d) => d.t < 600).map((d) => d.v)),
          curves: { a: cumulative(aToB, len), b: cumulative(bToA, len) },
        }
      : null,
    aKills: deathsOf(b, a),
    bKills: deathsOf(a, b),
    nwGap: a.minutes.netWorth
      .slice(0, Math.min(a.minutes.netWorth.length, b.minutes.netWorth.length))
      .map((v, m) => v - b.minutes.netWorth[m]),
    items: { a: items(a), b: items(b) },
    jungle: { a: jungle(a), b: jungle(b) },
    whileFarmed: a.path.t.length && b.path.t.length ? { a: whileFarmed(a, b), b: whileFarmed(b, a) } : null,
  };
}

// The enemy observers live in [from, to] (for the exposure map).
export const enemyObservers = (s: LabSide, from: number, to: number): LabMatchWard[] =>
  observers(s, true).filter((w) => w.t <= to && wardEnd(w) >= from);

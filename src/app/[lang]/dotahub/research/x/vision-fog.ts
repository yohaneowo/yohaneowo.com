import type { LabBuilding, LabMatch, LabMatchWard } from "@/lib/dota/lab-match";
import { CELL } from "./util";

// What a team could see, roughly: an enemy hero counts as seen when it stands within the vision of
// an allied hero who is alive, an allied observer ward or a standing allied tower. Positions are
// everyone's 10-second grid (STRATZ). Trees, high ground, invisibility, creeps, summons and spells
// aren't modelled, so it errs both ways: an estimate, in hindsight.

// Patch 7.41, in game units: wards and heroes from the game's data (OpenDota's constants), towers
// from the Dota 2 wiki.
export const OBSERVER_RADIUS = 1600;
export const OBSERVER_LIFE = 360;
export const SENTRY_TRUE_SIGHT = 1050;
export const SENTRY_LIFE = 420;
export const HERO_VISION = { day: 1800, night: 800 };
const HERO_VISION_OF: Record<number, { day: number; night: number }> = {
  3: { day: 1800, night: 1200 }, // Bane
  35: { day: 1800, night: 1400 }, // Sniper
  60: { day: 800, night: 1800 }, // Night Stalker
  62: { day: 1800, night: 1000 }, // Bounty Hunter
  93: { day: 1800, night: 1800 }, // Slark
  112: { day: 1800, night: 1200 }, // Winter Wyvern
};
export const TOWER_VISION = { tier1: { day: 1900, night: 600 }, other: { day: 1900, night: 1100 } };
// Respawning heroes reappear within this long of dying (the longest respawn, with some margin).
const MAX_DEAD = 150;

// Day and night take turns every five minutes from the horn (0:00 day, 5:00 night, 10:00 day…);
// before the horn it's night.
export const isNight = (t: number) => t < 0 || Math.floor(t / 300) % 2 === 1;

export function heroVision(heroId: number, t: number) {
  const v = HERO_VISION_OF[heroId] ?? HERO_VISION;
  return isNight(t) ? v.night : v.day;
}

export const wardEnd = (w: LabMatchWard) => w.end ?? w.t + (w.kind === "obs" ? OBSERVER_LIFE : SENTRY_LIFE);
export const wardLive = (w: LabMatchWard, t: number) => w.t <= t && t < wardEnd(w);

// When each hero was dead, by slot: from the death until they reappear. A dead hero's position
// stays frozen where they died until the respawn, so the respawn is put halfway between the last
// frozen sample and the next one (within 5 s of the game's own respawn time for the studied player).
export type DeadSpans = Map<number, [number, number][]>;

const spansCache = new WeakMap<LabMatch, DeadSpans>();
export function deadSpans(m: LabMatch): DeadSpans {
  const hit = spansCache.get(m);
  if (hit) return hit;
  const out: DeadSpans = new Map();
  const g = m.grid;
  for (const d of m.deaths) {
    const p = g.pos[String(d.slot)];
    const k = p?.x.length ? g.t.findIndex((t) => t > d.t) : -1;
    if (k < 0) continue;
    let last = g.t[k];
    for (let j = k + 1; j < g.t.length && g.t[j] <= d.t + MAX_DEAD; j++) {
      if (p.x[j] !== p.x[k] || p.y[j] !== p.y[k]) break;
      last = g.t[j];
    }
    out.set(d.slot, [...(out.get(d.slot) ?? []), [d.t, last + 5]]);
  }
  spansCache.set(m, out);
  return out;
}

export const isDead = (spans: DeadSpans, slot: number, t: number) =>
  (spans.get(slot) ?? []).some(([a, b]) => t > a && t < b);

// A hero's position at any second: the grid sample, or linearly between two samples.
export function positionAt(m: LabMatch, slot: number, t: number): { x: number; y: number } | null {
  const g = m.grid;
  const p = g.pos[String(slot)];
  if (!p?.x.length || !g.t.length) return null;
  const last = g.t.length - 1;
  if (t <= g.t[0]) return { x: p.x[0], y: p.y[0] };
  if (t >= g.t[last]) return { x: p.x[last], y: p.y[last] };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.t[mid] <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - g.t[lo]) / Math.max(1, g.t[hi] - g.t[lo]);
  return { x: p.x[lo] + (p.x[hi] - p.x[lo]) * f, y: p.y[lo] + (p.y[hi] - p.y[lo]) * f };
}

// When each building fell: STRATZ's last health update, else OpenDota's kill message (STRATZ often
// stops short of zero for barracks).
const fallCache = new WeakMap<LabMatch, Map<number, number | null>>();
export function buildingFalls(m: LabMatch): Map<number, number | null> {
  const hit = fallCache.get(m);
  if (hit) return hit;
  const kills = m.objectives.filter((o) => o.type === "building" && o.key);
  const used = new Set<number>();
  const out = new Map<number, number | null>();
  for (const b of m.buildings) {
    let died = b.died;
    if (died == null && b.name) {
      const key = `npc_dota_${b.radiant ? "goodguys" : "badguys"}_${b.name}`;
      const i = kills.findIndex((o, j) => !used.has(j) && o.key === key);
      if (i >= 0) {
        used.add(i);
        died = kills[i].t;
      }
    }
    out.set(b.id, died);
  }
  fallCache.set(m, out);
  return out;
}

export const standing = (m: LabMatch, b: LabBuilding, t: number) => {
  const died = buildingFalls(m).get(b.id);
  return died == null || t < died;
};

export function towerVision(b: LabBuilding, t: number) {
  const v = b.name?.startsWith("tower1") ? TOWER_VISION.tier1 : TOWER_VISION.other;
  return isNight(t) ? v.night : v.day;
}

// Everything giving a team vision at a moment: where it is and how far it sees (map cells).
export type Source = { x: number; y: number; r: number };

export function sourcesAt(m: LabMatch, radiant: boolean, t: number): Source[] {
  const spans = deadSpans(m);
  const out: Source[] = [];
  for (const p of m.players) {
    if (p.radiant !== radiant || isDead(spans, p.slot, t)) continue;
    const at = positionAt(m, p.slot, t);
    if (at) out.push({ ...at, r: heroVision(p.heroId, t) / CELL });
  }
  for (const w of m.wards)
    if (w.kind === "obs" && w.radiant === radiant && wardLive(w, t))
      out.push({ x: w.x, y: w.y, r: OBSERVER_RADIUS / CELL });
  for (const b of m.buildings)
    if (b.type === "tower" && b.radiant === radiant && standing(m, b, t))
      out.push({ x: b.x, y: b.y, r: towerVision(b, t) / CELL });
  return out;
}

export const covered = (sources: Source[], p: { x: number; y: number }) =>
  sources.some((s) => Math.hypot(s.x - p.x, s.y - p.y) <= s.r);

// Which heroes of the other side a team saw at a moment: by slot, null while that hero is dead.
export function sightAt(m: LabMatch, radiant: boolean, t: number): Map<number, boolean | null> {
  const spans = deadSpans(m);
  const sources = sourcesAt(m, radiant, t);
  const out = new Map<number, boolean | null>();
  for (const p of m.players) {
    if (p.radiant === radiant) continue;
    const at = positionAt(m, p.slot, t);
    out.set(p.slot, !at || isDead(spans, p.slot, t) ? null : covered(sources, at));
  }
  return out;
}

// The same on every grid sample: for each hero of the other side, seen (true), in the fog (false)
// or dead (null), on the grid's times.
export type Sight = { t: number[]; seen: Map<number, (boolean | null)[]> };

const sightCache = new WeakMap<LabMatch, Map<boolean, Sight | null>>();
export function teamSight(m: LabMatch, radiant: boolean): Sight | null {
  const byTeam = sightCache.get(m) ?? new Map<boolean, Sight | null>();
  sightCache.set(m, byTeam);
  if (byTeam.has(radiant)) return byTeam.get(radiant)!;
  let out: Sight | null = null;
  if (m.grid.t.length) {
    const seen = new Map<number, (boolean | null)[]>();
    for (const p of m.players) if (p.radiant !== radiant) seen.set(p.slot, []);
    for (const t of m.grid.t) for (const [slot, v] of sightAt(m, radiant, t)) seen.get(slot)?.push(v);
    out = { t: m.grid.t, seen };
  }
  byTeam.set(radiant, out);
  return out;
}

// Share of the other side's living hero-time a team saw, within [from, to] seconds (after the horn)
// and the moments picked, overall and by slot.
export function sightShare(
  sight: Sight,
  from = -Infinity,
  to = Infinity,
  pick: (t: number) => boolean = () => true,
) {
  let seen = 0;
  let n = 0;
  const bySlot = new Map<number, { seen: number; n: number }>();
  for (const [slot, list] of sight.seen) {
    const row = { seen: 0, n: 0 };
    list.forEach((v, k) => {
      const t = sight.t[k];
      if (v == null || t < Math.max(0, from) || t > to || !pick(t)) return;
      row.n++;
      if (v) row.seen++;
    });
    bySlot.set(slot, row);
    seen += row.seen;
    n += row.n;
  }
  return { share: n ? seen / n : null, n, bySlot };
}

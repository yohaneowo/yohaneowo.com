import type { DeathEvent, StoredMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { mapZone } from "@/lib/dota/map";

// Map areas from the player's point of view when their side is known, else in absolute terms.
export type Zone =
  | "top"
  | "mid"
  | "bot"
  | "river"
  | "ownJungle"
  | "enemyJungle"
  | "ownBase"
  | "enemyBase"
  | "radiantJungle"
  | "direJungle"
  | "radiantBase"
  | "direBase";

export function zoneOf(e: DeathEvent, radiant: boolean | undefined): Zone {
  const zone = mapZone(e.x, e.y);
  if (radiant === undefined) return zone;
  if (zone === "radiantJungle" || zone === "direJungle")
    return (zone === "radiantJungle") === radiant ? "ownJungle" : "enemyJungle";
  if (zone === "radiantBase" || zone === "direBase")
    return (zone === "radiantBase") === radiant ? "ownBase" : "enemyBase";
  return zone;
}

// How the deaths split over the map areas, most first.
export function zoneShares(
  matches: StoredMatch[],
  sides: Record<number, boolean>,
  keep: (e: DeathEvent) => boolean,
) {
  const counts = new Map<Zone, number>();
  let total = 0;
  for (const m of matches)
    for (const e of m.deathEvents)
      if (keep(e)) {
        const zone = zoneOf(e, sides[m.matchId]);
        counts.set(zone, (counts.get(zone) ?? 0) + 1);
        total++;
      }
  return [...counts.entries()].map(([zone, n]) => ({ zone, n, share: n / total })).sort((a, b) => b.n - a.n);
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const PHASES = { laning: [-Infinity, 600], mid: [600, 1800], late: [1800, Infinity] } as const;
// A death this soon after respawning counts as dying again right away.
const CHAIN_SECONDS = 60;
const MANY_DEATHS = 8;
const MIN_HERO_MATCHES = 3;
const TREND_RECENT = 20;

// The highlights under the map. matches: the shown ones (hero and result filters); byHero: the
// same hero filter on both results, for the win/loss comparisons.
export function insights(matches: StoredMatch[], byHero: StoredMatch[], heroes: Record<number, HeroInfo>) {
  const all = matches.flatMap((m) => m.deathEvents);
  const deathsOf = (m: StoredMatch) => m.deathEvents.length;

  const firstDeaths = matches
    .filter((m) => m.deathEvents.length)
    .map((m) => Math.min(...m.deathEvents.map((e) => e.t)));
  let chains = 0;
  for (const m of matches) {
    const ordered = [...m.deathEvents].sort((a, b) => a.t - b.t);
    for (let i = 1; i < ordered.length; i++)
      if (ordered[i].t - (ordered[i - 1].t + ordered[i - 1].dead) <= CHAIN_SECONDS) chains++;
  }

  const buckets = new Map<number, number>();
  for (const e of all)
    if (e.t >= 0) buckets.set(Math.floor(e.t / 300) * 5, (buckets.get(Math.floor(e.t / 300) * 5) ?? 0) + 1);
  const deadliest = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
  const phase = (Object.keys(PHASES) as (keyof typeof PHASES)[])
    .map((p) => ({ phase: p, n: all.filter((e) => e.t >= PHASES[p][0] && e.t < PHASES[p][1]).length }))
    .sort((a, b) => b.n - a.n)[0];

  const killerCounts = new Map<number, number>();
  let structures = 0;
  for (const e of all)
    if (heroes[e.by]) killerCounts.set(e.by, (killerCounts.get(e.by) ?? 0) + 1);
    else structures++;
  const killers = [...killerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ id, n }));

  const wins = byHero.filter((m) => m.won);
  const losses = byHero.filter((m) => !m.won);
  const many = byHero.filter((m) => deathsOf(m) >= MANY_DEATHS);

  const perHero = new Map<number, number[]>();
  for (const m of matches) perHero.set(m.heroId, [...(perHero.get(m.heroId) ?? []), deathsOf(m)]);
  // Always three when there are three heroes: the ones with enough matches to mean something come
  // first, heroes played less fill the rest (the card shows how many matches each is from).
  const yourHeroes = [...perHero.entries()]
    .map(([id, list]) => ({ id, avg: avg(list)!, n: list.length }))
    .sort((a, b) => Number(b.n >= MIN_HERO_MATCHES) - Number(a.n >= MIN_HERO_MATCHES) || b.avg - a.avg)
    .slice(0, 3);

  const newest = [...matches].sort((a, b) => b.startTime - a.startTime);
  const trend =
    newest.length >= TREND_RECENT + 10
      ? {
          recent: avg(newest.slice(0, TREND_RECENT).map(deathsOf))!,
          before: avg(newest.slice(TREND_RECENT).map(deathsOf))!,
        }
      : null;

  return {
    perMatch: avg(matches.map(deathsOf)),
    zero: matches.filter((m) => !m.deathEvents.length).length,
    firstDeath: avg(firstDeaths),
    chains,
    deadliest: deadliest ? deadliest[0] : null,
    phase: phase && all.length ? { phase: phase.phase, share: phase.n / all.length } : null,
    killers,
    structures,
    winLoss:
      wins.length && losses.length
        ? { win: avg(wins.map(deathsOf))!, loss: avg(losses.map(deathsOf))! }
        : null,
    many:
      many.length >= 3 ? { n: many.length, winRate: many.filter((m) => m.won).length / many.length } : null,
    yourHeroes,
    trend,
  };
}

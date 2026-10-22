import type { LabAssets, LabSide } from "@/lib/dota/lab";
import { skillEfficiency } from "../advanced";
import { aliveAt, MAP_INTERACTIONS, minutesOf } from "../insights";
import { mean, sum } from "./util";

// The skills module's numbers: how to read the use rates, talent tiers and max levels against the
// rank, mana, what the ultimate and the big spells led to, who the targeted spells and items went to
// in each teamfight, stacking buffs, a few hero-specific metrics, the map's features, OpenDota's
// command counts and the player's chat. Pure, so the blocks and the sentences share them.

export const castTimes = (s: LabSide, key: string) =>
  s.skills.useTimes.find((u) => u.key === key)?.times ?? null;
export const castCount = (s: LabSide, key: string) =>
  s.skills.useTimes.find((u) => u.key === key)?.times.length ??
  s.skills.uses.find((u) => u.key === key)?.count ??
  0;

// Every hero's position (1–5, STRATZ) by hero id; 1–3 are cores.
const positionsOf = (s: LabSide) => new Map(s.match.players.map((p) => [p.heroId, p.position]));

const aliveSeconds = (s: LabSide) => {
  const dead =
    s.totals.deadSeconds ??
    sum(s.fights.events.filter((f) => f.kind === "death").map((f) => f.timeDead ?? 0));
  return Math.max(60, s.duration - dead);
};

// The player's kills and assists (STRATZ's events, or OpenDota's kill log).
const killTimes = (s: LabSide) => s.fights.events.filter((f) => f.kind !== "death").map((f) => f.t);

// ── How to read the use rates ────────────────────────────────────────────────────────────────

export type UseKind = "nuke" | "utility" | "ult";

// The abilities of the use-rate table by kind: damage spells (farming and nukes) can be used on
// cooldown, utility spells (movement, saves, disables, buffs) wait for the moment, the ultimate for
// the fights. Low: a core's main damage spell (the one cast most; others may be disables that also
// deal damage) used under 40% of what its cooldown allowed, with 5 casts or more allowed.
export function kindsOf(s: LabSide, assets: LabAssets) {
  const core = s.position == null || s.position <= 3;
  const list = skillEfficiency(s).map((e) => ({
    ...e,
    kind: (e.key === s.skills.ult
      ? "ult"
      : assets.abilityMeta[e.key]?.damaging
        ? "nuke"
        : "utility") as UseKind,
  }));
  const main = list.filter((e) => e.kind === "nuke").sort((x, y) => y.casts - x.casts)[0];
  return list.map((e) => ({
    key: e.key,
    kind: e.kind,
    ratio: e.ratio,
    low: e === main && core && e.possible >= 5 && e.ratio < 0.4,
  }));
}

// ── Talents ──────────────────────────────────────────────────────────────────────────────────

export const TIER_LEVEL = [10, 15, 20, 25];

export type TalentChoice = { key: string; t: number; level: number };
export type TalentOption = {
  key: string;
  n: number | null;
  w: number | null;
  share: number | null;
  time: number | null;
};
export type TalentTier = {
  tier: number;
  level: number;
  options: TalentOption[];
  pick: TalentChoice | null;
  later: TalentChoice | null;
  // When the hero reached the tier's level.
  reached: number | null;
};

// Talents by tier with the rank's record of each (games, wins, the average time it was taken, and
// its share of the tier's games — only when the rank has every talent of the tier), the one the
// player took first in the tier and the other if taken later (from level 26 the rest can be
// learned). allKeys: every talent in assets.talentTier is this hero's (one hero on the page);
// otherwise only the rank's and the learned ones are.
export function talentTiers(s: LabSide, assets: LabAssets, allKeys: boolean): TalentTier[] {
  const bl = s.advanced.baseline?.talents ?? [];
  const learned = s.skills.learned.filter((l) => l.talent && assets.talentTier[l.key]);
  const own = new Set([...bl.map((x) => x.key), ...learned.map((l) => l.key)]);
  const keys = Object.keys(assets.talentTier).filter((k) => allKeys || own.has(k));
  const out: TalentTier[] = [];
  for (let tier = 1; tier <= 4; tier++) {
    const inTier = keys.filter((k) => assets.talentTier[k] === tier);
    if (!inTier.length) continue;
    const recs = inTier.map((k) => bl.find((x) => x.key === k) ?? null);
    // A tier left with one talent (two heroes on the page and the other talent neither in the
    // rank's list nor learned) has no share: alone it would read 100%.
    const total = inTier.length > 1 && recs.every((r) => r != null) ? sum(recs.map((r) => r!.n)) : 0;
    const taken = learned.filter((l) => assets.talentTier[l.key] === tier);
    const first = taken[0] ?? null;
    const second = taken.find((l) => first && l.key !== first.key) ?? null;
    const level = TIER_LEVEL[tier - 1];
    out.push({
      tier,
      level,
      options: inTier.map((key, i) => {
        const r = recs[i];
        return {
          key,
          n: r?.n ?? null,
          w: r?.w ?? null,
          share: r && total ? r.n / total : null,
          time: r?.time || null,
        };
      }),
      pick: first ? { key: first.key, t: first.t, level: first.level } : null,
      later: second ? { key: second.key, t: second.t, level: second.level } : null,
      reached: s.levelTimes[level - 1] ?? null,
    });
  }
  return out;
}

// The talents two sides on the same hero took differently, tier by tier.
export function talentDiffs(a: LabSide, b: LabSide, assets: LabAssets) {
  if (a.heroId !== b.heroId) return [];
  const ta = talentTiers(a, assets, true);
  const tb = talentTiers(b, assets, true);
  return ta.flatMap((x) => {
    const y = tb.find((z) => z.tier === x.tier);
    if (!x.pick || !y?.pick || x.pick.key === y.pick.key) return [];
    const share = (tiers: TalentTier, key: string) => tiers.options.find((o) => o.key === key)?.share ?? null;
    return [
      { level: x.level, a: x.pick.key, b: y.pick.key, sa: share(x, x.pick.key), sb: share(y, y.pick.key) },
    ];
  });
}

// A talent taken that few at the rank take (under 25% of the tier's games, with 300 or more games).
export function rareTalent(s: LabSide, assets: LabAssets, allKeys: boolean) {
  for (const tier of talentTiers(s, assets, allKeys)) {
    const o = tier.options.find((x) => x.key === tier.pick?.key);
    if (o?.share != null && o.share < 0.25 && (o.n ?? 0) >= 300 && tier.options.length > 1)
      return { level: tier.level, key: o.key, share: o.share };
  }
  return null;
}

// ── Skill build against the rank ─────────────────────────────────────────────────────────────

export type MaxRow = {
  key: string;
  // The hero level of each point put in.
  points: number[];
  maxAt: number | null;
  // The rank's games that maxed it at the same hero level: share of the games that maxed it, win
  // rate, and that level's place among the levels (1 = the most common).
  ref: { n: number; share: number; win: number | null; rank: number } | null;
  common: { level: number; share: number; win: number | null } | null;
  total: number;
};

// Each ability's points by hero level and the level it was maxed at (3 points for the ultimate, 4 for
// the others; with more points than that the ability has more levels, so no max is claimed), against
// how often the rank maxes it at each hero level (STRATZ: games and wins by the hero level the
// ability reached its last level).
export function maxOrder(s: LabSide, assets: LabAssets): MaxRow[] {
  const pts = new Map<string, number[]>();
  for (const l of s.skills.learned)
    if (!l.talent && !l.key.startsWith("special_bonus")) pts.set(l.key, [...(pts.get(l.key) ?? []), l.level]);
  const order = assets.heroAbilities[String(s.heroId)] ?? [];
  const slot = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  const table = s.advanced.baseline?.abilityMax ?? {};
  return [...pts.entries()]
    .sort((x, y) => slot(x[0]) - slot(y[0]))
    .map(([key, levels]) => {
      const full = key === s.skills.ult ? 3 : 4;
      const maxAt = levels.length === full ? levels[full - 1] : null;
      const list = [...(table[key] ?? [])].sort((x, y) => y.n - x.n);
      const total = sum(list.map((x) => x.n));
      const i = maxAt == null ? -1 : list.findIndex((x) => x.level === maxAt);
      const e = i >= 0 ? list[i] : null;
      return {
        key,
        points: levels,
        maxAt,
        ref:
          maxAt != null && total
            ? {
                n: e?.n ?? 0,
                share: (e?.n ?? 0) / total,
                win: e?.n ? e.w / e.n : null,
                rank: i >= 0 ? i + 1 : list.length + 1,
              }
            : null,
        common:
          list[0] && total
            ? {
                level: list[0].level,
                share: list[0].n / total,
                win: list[0].n ? list[0].w / list[0].n : null,
              }
            : null,
        total,
      };
    });
}

// An ability maxed at a level few at the rank max it at (under 10%, with 500 or more games).
export function rareMax(s: LabSide, assets: LabAssets) {
  return maxOrder(s, assets).find((r) => r.ref && r.ref.share < 0.1 && r.total >= 500) ?? null;
}

// ── Mana ─────────────────────────────────────────────────────────────────────────────────────

// Minutes the hero was dead throughout (no mana updates come then).
function deadMinutes(s: LabSide) {
  const seen = new Map<number, boolean>();
  s.path.t.forEach((t, i) => {
    // A sample covers the 10 seconds up to its time.
    const m = Math.floor((t - 1) / 60);
    seen.set(m, (seen.get(m) ?? true) && !aliveAt(s, i));
  });
  return new Set([...seen.entries()].filter(([, dead]) => dead).map(([m]) => m));
}

// The per-minute mana curves (average and lowest) with the minutes dead throughout left out (NaN
// breaks the line): with no updates they would read as full mana.
export function manaCurves(s: LabSide) {
  const { min, avg } = s.advanced.mana;
  if (!min.length) return null;
  const dead = deadMinutes(s);
  const gap = (v: number, m: number) => (dead.has(m) ? NaN : v);
  return { min: min.map(gap), avg: avg.map(gap) };
}

export type ManaStats = {
  lowest: number;
  avg: number;
  lowSeconds: number;
  lowShare: number;
  // Minutes whose lowest point was under 10%.
  dips: number;
  lane: { avg: number; lowest: number } | null;
  // Teamfights joined: how many started with under 30% mana (the minute before's average).
  fights: { n: number; low: number; avg: number | null };
  // Casts of the spells that cost mana and have a cooldown, per alive minute, and how many would
  // have fallen in the low-mana time at that rate.
  rate: number | null;
  held: number | null;
};

// Share of the alive time spent under 20% mana (null without STRATZ's mana updates).
export const lowManaShare = (s: LabSide) =>
  s.advanced.mana.min.length ? s.advanced.mana.lowSeconds / aliveSeconds(s) : null;

export function manaStats(s: LabSide, assets: LabAssets): ManaStats | null {
  const { min, avg, lowSeconds } = s.advanced.mana;
  if (!min.length) return null;
  const dead = deadMinutes(s);
  const alive = min.map((_, m) => m).filter((m) => !dead.has(m) && m * 60 < s.duration);
  if (!alive.length) return null;
  const lane = alive.filter((m) => m < 10);
  const secs = aliveSeconds(s);
  const joined = s.fights.teamfights.filter((f) => f.joined && Math.floor(f.start / 60) >= 1);
  const before = joined.map((f) => avg[Math.floor(f.start / 60) - 1]).filter((v) => v != null);
  const blockable = s.skills.uses.filter((u) => {
    const meta = assets.abilityMeta[u.key];
    return (
      !MAP_INTERACTIONS.has(u.key) &&
      !u.key.startsWith("special_bonus") &&
      !!meta &&
      !meta.passive &&
      meta.cd.length > 0 &&
      meta.mc.some((v) => v > 0)
    );
  });
  const casts = sum(blockable.map((u) => castCount(s, u.key)));
  const rate = blockable.length ? (casts / secs) * 60 : null;
  return {
    lowest: Math.min(...alive.map((m) => min[m])),
    avg: mean(alive.map((m) => avg[m])) ?? 1,
    lowSeconds,
    lowShare: lowSeconds / secs,
    dips: alive.filter((m) => min[m] < 0.1).length,
    lane: lane.length
      ? { avg: mean(lane.map((m) => avg[m])) ?? 1, lowest: Math.min(...lane.map((m) => min[m])) }
      : null,
    fights: { n: before.length, low: before.filter((v) => v < 0.3).length, avg: mean(before) },
    rate,
    held: rate != null ? (rate * lowSeconds) / 60 : null,
  };
}

// ── What the big spells led to ───────────────────────────────────────────────────────────────

export type SpellConversion = {
  key: string;
  ult: boolean;
  casts: number;
  // Followed by the player's kill or assist within 4 s.
  converted: number;
  // Casts that reached no enemy hero (null: the spell's damage isn't credited to it, so unknown).
  nobody: number | null;
  // Enemy heroes reached (summed over the casts), those that are cores, those whose position is
  // known, and those that died within 10 s.
  hits: number;
  cores: number;
  known: number;
  died: number;
};

// The enemy heroes each cast of a spell reached: its target when aimed at a hero, and the heroes its
// damage reached within `window` seconds (up to the next cast, so overlapping casts aren't counted
// twice). Null without STRATZ's cast times.
export function castHits(s: LabSide, key: string, window = 4): { t: number; heroes: number[] }[] | null {
  const times = castTimes(s, key);
  if (!times?.length) return null;
  const enemies = new Set(s.enemies);
  const dmg = s.advanced.damage.filter((d) => d.out && !d.ill && d.by === key && enemies.has(d.hero));
  const aimed = s.skills.casts.filter((c) => c.key === key && enemies.has(c.target));
  const sorted = [...times].sort((x, y) => x - y);
  return sorted.map((t, i) => {
    const end = Math.min(t + window, (sorted[i + 1] ?? Infinity) - 0.5);
    const heroes = new Set<number>();
    for (const c of aimed) if (c.t === t) heroes.add(c.target);
    for (const d of dmg) if (d.t >= t && d.t <= end) heroes.add(d.hero);
    return { t, heroes: [...heroes] };
  });
}

// Whether a spell's effect is credited to it (its damage, or a hero target), so 'reached no one'
// can be told apart from 'not recorded'.
const credited = (s: LabSide, key: string) =>
  s.advanced.damage.some((d) => d.out && d.by === key) || s.skills.casts.some((c) => c.key === key);

// The ultimate and up to two other big spells (a cooldown of 15 s or more that deals damage or is
// aimed at heroes).
export function bigSpells(s: LabSide, assets: LabAssets) {
  const ult = s.skills.ult;
  const others = s.skills.useTimes
    .map((u) => u.key)
    .filter((k) => {
      const m = assets.abilityMeta[k];
      if (k === ult || MAP_INTERACTIONS.has(k) || !m || m.passive || (m.cd[0] ?? 0) < 15) return false;
      return m.damaging || s.skills.casts.some((c) => c.key === k && !c.item);
    })
    .sort((x, y) => (assets.abilityMeta[y].cd[0] ?? 0) - (assets.abilityMeta[x].cd[0] ?? 0))
    .slice(0, 2);
  return [...(ult && castTimes(s, ult)?.length ? [ult] : []), ...others];
}

export function conversion(
  s: LabSide,
  assets: LabAssets,
  from = -Infinity,
  to = Infinity,
): SpellConversion[] {
  const kills = killTimes(s);
  const pos = positionsOf(s);
  return bigSpells(s, assets).flatMap((key) => {
    const list = (castHits(s, key) ?? []).filter((c) => c.t >= from && c.t <= to);
    if (!list.length) return [];
    const known = credited(s, key);
    let hits = 0;
    let cores = 0;
    let withPos = 0;
    let died = 0;
    for (const c of list)
      for (const h of c.heroes) {
        hits++;
        const p = pos.get(h);
        if (p != null) {
          withPos++;
          if (p <= 3) cores++;
        }
        if (s.match.deaths.some((d) => d.hero === h && d.t >= c.t && d.t <= c.t + 10)) died++;
      }
    return [
      {
        key,
        ult: key === s.skills.ult,
        casts: list.length,
        converted: list.filter((c) => kills.some((k) => k >= c.t && k <= c.t + 4)).length,
        nobody: known ? list.filter((c) => !c.heroes.length).length : null,
        hits,
        cores,
        known: withPos,
        died,
      },
    ];
  });
}

// The ultimate's casts followed by a kill or assist within 4 s, over the first `until` seconds.
export function ultConversion(s: LabSide, until = Infinity) {
  const ult = s.skills.ult;
  const times = ult ? (castTimes(s, ult) ?? []).filter((t) => t <= until) : [];
  if (!times.length) return null;
  const kills = killTimes(s);
  return {
    casts: times.length,
    converted: times.filter((t) => kills.some((k) => k >= t && k <= t + 4)).length,
  };
}

// Enemy heroes reached per cast of the ultimate, over the first `until` seconds (when its effect is
// credited to it).
export function ultHeroes(s: LabSide, until = Infinity) {
  const ult = s.skills.ult;
  if (!ult || !credited(s, ult)) return null;
  const list = (castHits(s, ult) ?? []).filter((c) => c.t <= until);
  return list.length ? sum(list.map((c) => c.heroes.length)) / list.length : null;
}

// ── Targets in each teamfight ────────────────────────────────────────────────────────────────

export type FightUse = { key: string; item: boolean; hero: number };
export type FightCasts = {
  idx: number;
  start: number;
  end: number;
  joined: boolean;
  teamDeaths: number;
  enemyDeaths: number;
  // The heroes the ultimate and the big spells reached, then the other spells and items aimed at
  // enemy heroes.
  enemy: FightUse[];
  // Spells and items aimed at allies (not the player).
  ally: FightUse[];
};

export function fightCasts(s: LabSide, assets: LabAssets, from = -Infinity, to = Infinity): FightCasts[] {
  const enemies = new Set(s.enemies);
  const team = new Set(s.team);
  const big = bigSpells(s, assets);
  const reach = big.map((key) => ({ key, casts: castHits(s, key) ?? [] }));
  return s.fights.teamfights.flatMap((f, idx) => {
    if (f.end < from || f.start > to) return [];
    const a = f.start - 3;
    const b = f.end + 3;
    const within = s.skills.casts.filter((c) => c.t >= a && c.t <= b && !MAP_INTERACTIONS.has(c.key));
    const enemy: FightUse[] = [];
    for (const r of reach)
      for (const c of r.casts)
        if (c.t >= a && c.t <= b) for (const h of c.heroes) enemy.push({ key: r.key, item: false, hero: h });
    for (const c of within)
      if (enemies.has(c.target) && !big.includes(c.key))
        enemy.push({ key: c.key, item: c.item, hero: c.target });
    const ally = within
      .filter((c) => team.has(c.target) && c.target !== s.heroId)
      .map((c) => ({ key: c.key, item: c.item, hero: c.target }));
    return [
      {
        idx,
        start: f.start,
        end: f.end,
        joined: f.joined,
        teamDeaths: f.teamDeaths,
        enemyDeaths: f.enemyDeaths,
        enemy,
        ally,
      },
    ];
  });
}

// Over the teamfights: how many spell and item uses went to enemy cores, and how many to allies.
export function targetShares(s: LabSide, fights: FightCasts[]) {
  const pos = positionsOf(s);
  const enemy = fights.flatMap((f) => f.enemy);
  const known = enemy.filter((u) => pos.get(u.hero) != null);
  const ally = fights.flatMap((f) => f.ally);
  return {
    enemy: enemy.length,
    known: known.length,
    cores: known.filter((u) => (pos.get(u.hero) ?? 9) <= 3).length,
    ally: ally.length,
    allyCores: ally.filter((u) => (pos.get(u.hero) ?? 9) <= 3).length,
  };
}

// ── Stacking buffs ───────────────────────────────────────────────────────────────────────────

// Item buffs (shown with the items) and ids OpenDota can't name are left out.
const ITEM_BUFFS = new Set(["moon_shard", "ultimate_scepter", "aghanims_shard"]);
export const stackBuffs = (s: LabSide) =>
  s.buffs.filter((b) => !ITEM_BUFFS.has(b.key) && !/^\d+$/.test(b.key));

// ── Hero-specific metrics ────────────────────────────────────────────────────────────────────

// The value with what it is made of: casts (count), heroes reached over casts (hits), a part of a
// whole (share) or uses over teamfights (perFight).
export type HeroValue = { v: number; n: number; of?: number; unit: "count" | "hits" | "share" | "perFight" };
export type HeroMetric = {
  key: string;
  fmt: "pct" | "dec";
  // Higher is better (hit rates, heroes per cast); null for counts that only describe.
  higher: boolean | null;
  get: (s: LabSide) => HeroValue | null;
};

const perMin = (s: LabSide, key: string): HeroValue | null => {
  const n = castCount(s, key);
  return n ? { v: n / minutesOf(s), n, unit: "count" } : null;
};

// Enemy heroes reached per cast (STRATZ), else OpenDota's hero hits per cast for spells that hit
// each hero once.
const perCast = (s: LabSide, key: string, window: number, once: boolean): HeroValue | null => {
  const list = credited(s, key) ? castHits(s, key, window) : null;
  if (list?.length) {
    const hits = sum(list.map((c) => c.heroes.length));
    return { v: hits / list.length, n: hits, of: list.length, unit: "hits" };
  }
  const casts = s.skills.uses.find((u) => u.key === key)?.count ?? 0;
  const hits = s.damage.hits.find((h) => h.key === key)?.value;
  return once && casts && hits != null ? { v: hits / casts, n: hits, of: casts, unit: "hits" } : null;
};

// Share of casts that reached at least one enemy hero; without STRATZ, OpenDota's hero hits per
// cast for spells that can hit one hero only.
const hitRate = (s: LabSide, key: string, window: number, single: boolean): HeroValue | null => {
  const list = credited(s, key) ? castHits(s, key, window) : null;
  if (list?.length) {
    const hit = list.filter((c) => c.heroes.length).length;
    return { v: hit / list.length, n: hit, of: list.length, unit: "share" };
  }
  const casts = s.skills.uses.find((u) => u.key === key)?.count ?? 0;
  const hits = s.damage.hits.find((h) => h.key === key)?.value;
  return single && casts && hits != null
    ? { v: Math.min(1, hits / casts), n: Math.min(hits, casts), of: casts, unit: "share" }
    : null;
};

// Share of a spell's casts made while farming or fighting (the time-use reading of their 10 s).
const castWhile = (s: LabSide, key: string, kinds: string[]): HeroValue | null => {
  const times = castTimes(s, key);
  if (!times?.length || !s.advanced.activity.length) return null;
  let n = 0;
  let hit = 0;
  for (const t of times) {
    const i = s.path.t.findIndex((x) => x >= t);
    if (i < 0) continue;
    n++;
    if (kinds.includes(s.advanced.activity[i])) hit++;
  }
  return n ? { v: hit / n, n: hit, of: n, unit: "share" } : null;
};

// Hooks that reached a hero, followed by the player's kill or assist within 6 s.
const hookKills = (s: LabSide): HeroValue | null => {
  const hit = (castHits(s, "pudge_meat_hook", 2) ?? []).filter((c) => c.heroes.length);
  if (!hit.length) return null;
  const kills = killTimes(s);
  const n = hit.filter((c) => kills.some((k) => k >= c.t && k <= c.t + 6)).length;
  return { v: n / hit.length, n, of: hit.length, unit: "share" };
};

// Rearms per teamfight joined (OpenDota's teamfight ability counts).
const rearms = (s: LabSide): HeroValue | null => {
  let n = 0;
  let fights = 0;
  s.fights.teamfights.forEach((f, i) => {
    if (!f.joined) return;
    fights++;
    n += s.match.teamfights[i]?.players.find((p) => p.slot === s.slot)?.abilities.tinker_rearm ?? 0;
  });
  return fights ? { v: n / fights, n, of: fights, unit: "perFight" } : null;
};

export const HERO_METRICS: Record<number, HeroMetric[]> = {
  // Anti-Mage
  1: [
    { key: "amBlinkPm", fmt: "dec", higher: null, get: (s) => perMin(s, "antimage_blink") },
    {
      key: "amBlinkFarm",
      fmt: "pct",
      higher: null,
      get: (s) => castWhile(s, "antimage_blink", ["farmLane", "farmJungle"]),
    },
    { key: "amBlinkFight", fmt: "pct", higher: null, get: (s) => castWhile(s, "antimage_blink", ["fight"]) },
    { key: "amVoidHeroes", fmt: "dec", higher: true, get: (s) => perCast(s, "antimage_mana_void", 1, true) },
  ],
  // Earthshaker
  7: [
    { key: "esFissure", fmt: "dec", higher: true, get: (s) => perCast(s, "earthshaker_fissure", 1, true) },
    { key: "esEcho", fmt: "dec", higher: true, get: (s) => perCast(s, "earthshaker_echo_slam", 1, false) },
  ],
  // Mirana
  9: [
    { key: "miranaArrow", fmt: "pct", higher: true, get: (s) => hitRate(s, "mirana_arrow", 4, true) },
    { key: "miranaArrowPm", fmt: "dec", higher: null, get: (s) => perMin(s, "mirana_arrow") },
  ],
  // Pudge
  14: [
    { key: "pudgeHook", fmt: "pct", higher: true, get: (s) => hitRate(s, "pudge_meat_hook", 2, true) },
    { key: "pudgeHookKill", fmt: "pct", higher: true, get: hookKills },
    { key: "pudgeHookPm", fmt: "dec", higher: null, get: (s) => perMin(s, "pudge_meat_hook") },
  ],
  // Windranger
  21: [
    { key: "wrPowershot", fmt: "dec", higher: true, get: (s) => perCast(s, "windrunner_powershot", 3, true) },
    {
      key: "wrPowershotHit",
      fmt: "pct",
      higher: true,
      get: (s) => hitRate(s, "windrunner_powershot", 3, false),
    },
  ],
  // Tidehunter
  29: [{ key: "tideRavage", fmt: "dec", higher: true, get: (s) => perCast(s, "tidehunter_ravage", 2, true) }],
  // Enigma
  33: [
    { key: "enigmaHole", fmt: "dec", higher: true, get: (s) => perCast(s, "enigma_black_hole", 5, false) },
  ],
  // Tinker
  34: [
    { key: "tinkerRearmFight", fmt: "dec", higher: null, get: rearms },
    { key: "tinkerRearmPm", fmt: "dec", higher: null, get: (s) => perMin(s, "tinker_rearm") },
  ],
  // Invoker
  74: [
    { key: "invokerInvokePm", fmt: "dec", higher: null, get: (s) => perMin(s, "invoker_invoke") },
    {
      key: "invokerSunStrike",
      fmt: "pct",
      higher: true,
      get: (s) => hitRate(s, "invoker_sun_strike", 3, false),
    },
    {
      key: "invokerMeteor",
      fmt: "dec",
      higher: true,
      get: (s) => perCast(s, "invoker_chaos_meteor", 4, false),
    },
    { key: "invokerTornado", fmt: "dec", higher: true, get: (s) => perCast(s, "invoker_tornado", 4, false) },
  ],
  // Magnus
  97: [
    {
      key: "magnusRp",
      fmt: "dec",
      higher: true,
      get: (s) => perCast(s, "magnataur_reverse_polarity", 1, true),
    },
    { key: "magnusSkewer", fmt: "dec", higher: true, get: (s) => perCast(s, "magnataur_skewer", 2, true) },
    {
      key: "magnusShockwave",
      fmt: "dec",
      higher: true,
      get: (s) => perCast(s, "magnataur_shockwave", 2, true),
    },
  ],
};

// Without a curated set: the hero's three abilities used most (not map interactions or portals
// others opened), per minute and heroes reached per cast.
export function topAbilities(s: LabSide, assets: LabAssets) {
  const own = assets.heroAbilities[String(s.heroId)];
  return s.skills.uses
    .filter((u) =>
      own?.length ? own.includes(u.key) : !MAP_INTERACTIONS.has(u.key) && !u.key.startsWith("special_bonus"),
    )
    .sort((x, y) => castCount(s, y.key) - castCount(s, x.key))
    .slice(0, 3)
    .map((u) => ({
      key: u.key,
      perMin: castCount(s, u.key) / minutesOf(s),
      heroes: perCast(s, u.key, 4, false),
    }));
}

// ── Map features ─────────────────────────────────────────────────────────────────────────────

// Movement speed for the walking-time estimate of a twin gate trip.
export const WALK_SPEED = 330;
const LOTUSES = ["famango", "great_famango", "greater_famango"];

export type MapFeatures = {
  watchers: number[] | number;
  gateUses: number;
  // Twin gate trips: the path jumping 60 map cells or more right after a use (uses within 15 s of
  // each other are one attempt), with the distance jumped in game units.
  trips: { t: number; dist: number }[] | null;
  // Lotuses the player used (on themselves or an ally), of them on allies, and those allies used on
  // the player.
  lotuses: number[] | number;
  lotusGiven: number;
  lotusFrom: number;
  plucks: number;
  outposts: number;
  wisdom: number[];
  // XP OpenDota logs under its 'tome of knowledge' reason, which wisdom runes come under; players who
  // picked none can have some too, so it isn't only the player's own runes.
  wisdomXp: number | null;
  tormentor: { ours: number[]; theirs: number[]; mine: number };
};

// Times within the window when STRATZ has them, else the whole game's count.
function timesOr(times: number[] | null, count: number, from: number, to: number): number[] | number {
  return times ? times.filter((t) => t >= from && t <= to) : count;
}
export const countOf = (v: number[] | number) => (typeof v === "number" ? v : v.length);

export function mapFeatures(s: LabSide, from = -Infinity, to = Infinity): MapFeatures {
  const inside = (t: number) => t >= from && t <= to;
  const uses = (k: string) => s.skills.uses.find((u) => u.key === k)?.count ?? 0;
  const gate = castTimes(s, "twin_gate_portal_warp");
  let trips: MapFeatures["trips"] = null;
  if (gate?.length && s.path.t.length) {
    trips = [];
    const sorted = [...gate].sort((x, y) => x - y);
    const groups: [number, number][] = [];
    for (const t of sorted) {
      const g = groups[groups.length - 1];
      if (g && t - g[1] <= 15) g[1] = t;
      else groups.push([t, t]);
    }
    const { t: pt, x, y } = s.path;
    for (const [first, last] of groups) {
      for (let i = 1; i < pt.length; i++) {
        if (pt[i - 1] < first - 10 || pt[i] > last + 20) continue;
        const d = Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
        if (d >= 60) {
          if (inside(first)) trips.push({ t: first, dist: Math.round(d * 128) });
          break;
        }
      }
    }
  }
  const lotusTimes = LOTUSES.flatMap((k) => s.items.useTimes.find((u) => u.key === k)?.times ?? []);
  const lotusCount = sum(LOTUSES.map((k) => s.items.uses.find((u) => u.key === k)?.count ?? 0));
  // Lotuses used on an ally, or by an ally on the player (STRATZ's heals, one per use).
  const lotusHeals = (list: { t: number; by: string | null; hero: number }[], other: boolean) =>
    new Set(
      list
        .filter((h) => LOTUSES.includes(h.by ?? "") && (h.hero !== s.heroId) === other && inside(h.t))
        .map((h) => h.t),
    ).size;
  const tor = s.match.objectives.filter((o) => o.type === "tormentor" && inside(o.t));
  return {
    watchers: timesOr(castTimes(s, "ability_lamp_use"), uses("ability_lamp_use"), from, to),
    gateUses: gate ? gate.filter(inside).length : uses("twin_gate_portal_warp"),
    trips,
    lotuses: lotusTimes.length || !lotusCount ? lotusTimes.filter(inside).sort((p, q) => p - q) : lotusCount,
    lotusGiven: lotusHeals(s.advanced.heals.given, true),
    lotusFrom: lotusHeals(s.advanced.heals.received, true),
    plucks: uses("ability_pluck_famango"),
    outposts: uses("ability_capture"),
    wisdom: s.resources.runes.filter((r) => r.rune === "WISDOM" && inside(r.t)).map((r) => r.t),
    wisdomXp: s.resources.runes.some((r) => r.rune === "WISDOM") ? (s.xpReasons["4"] ?? null) : null,
    tormentor: {
      ours: tor.filter((o) => o.radiant === s.radiant).map((o) => o.t),
      theirs: tor.filter((o) => o.radiant != null && o.radiant !== s.radiant).map((o) => o.t),
      mine: tor.filter((o) => o.slot === s.slot).length,
    },
  };
}

// ── Commands ─────────────────────────────────────────────────────────────────────────────────

// OpenDota's order counts by kind: what STRATZ's action report doesn't separate. Orders 41 and 42
// (consume an item, mark one for sale) aren't in OpenDota's constants yet, so they come as order_41
// and order_42. Ability pings (alt-click on an ability) aren't STRATZ's pings on the map.
export const ORDER_GROUPS: [string, string[]][] = [
  ["stop", ["stop"]],
  ["tree", ["cast_target_tree"]],
  ["toggle", ["cast_toggle", "cast_toggle_auto", "cast_toggle_alt"]],
  [
    "itemManage",
    [
      "move_item",
      "eject_item_from_stash",
      "take_item_from_neutral_item_stash",
      "consume_item",
      "order_41",
      "set_item_mark_for_sell",
      "order_42",
    ],
  ],
  ["dropGive", ["drop_item", "give_item", "pickup_item", "drop_item_at_fountain"]],
  ["rune", ["pickup_rune"]],
  ["ping", ["ping_ability"]],
];
// The kinds STRATZ's report has too (the same counts), listed only when a side is without it.
export const MAIN_GROUPS: [string, string[]][] = [
  ["move", ["move_to_position", "move_to_target", "move_to_direction", "move_relative", "patrol"]],
  ["attack", ["attack_move", "attack_target"]],
  ["cast", ["cast_position", "cast_target", "cast_no_target", "vector_target_position"]],
  ["hold", ["hold_position"]],
  ["scan", ["radar"]],
];

export const orderCount = (s: LabSide, keys: string[]) =>
  sum(s.orders.filter((o) => keys.includes(o.key)).map((o) => o.count));

// ── Chat ─────────────────────────────────────────────────────────────────────────────────────

const WELL_PLAYED = /well played/i;
const GOOD_GAME = /^good game/i;
const MISSING = /missing/i;

// The player's own lines and chat wheel calls, and the teammates' 'missing' and 'well played' calls
// (times only: what others typed isn't shown).
export function chatOf(s: LabSide, from = -Infinity, to = Infinity) {
  const team = new Set(s.match.players.filter((p) => p.radiant === s.radiant).map((p) => p.slot));
  const inside = s.match.chat.filter((c) => c.t >= from && c.t <= to);
  const mates = inside.filter((c) => c.wheel && team.has(c.slot) && c.slot !== s.slot);
  return {
    own: inside.filter((c) => c.slot === s.slot),
    missing: mates.filter((c) => MISSING.test(c.text)).map((c) => c.t),
    wellPlayed: mates.filter((c) => WELL_PLAYED.test(c.text) && !GOOD_GAME.test(c.text)).map((c) => c.t),
  };
}

import type { LabAssets, LabSide } from "@/lib/dota/lab";
import type { BaselineKey, LabBaseline } from "@/lib/dota/lab-extra";
import { firstBuys, MAP_INTERACTIONS } from "../insights";
import { median, percentileOf } from "./util";

// The rank average read against this game: the same moments, the same units, the player's own
// numbers mapped onto STRATZ's heroStats fields. Pure, so the blocks and the sentences share it.

// STRATZ's heroStats row t holds the state at (t − 1):00: level is 1.00 at t = 1 and 1.02 at t = 2
// (players have 34–183 XP at 1:00, 307–403 at 2:00; the rows have 110 at t = 2 and 393 at t = 3),
// net worth 605 at t = 1, the 0:00 bounty runes show up at t = 2, and t = 0 is a nearly empty
// pre-game row. Worked out from the data, so it turns itself off once the rows are re-indexed.
export function shiftOf(bl: LabBaseline) {
  const lv = bl.minutes.level;
  return (lv[0] ?? 0) < 0.5 && (lv[1] ?? 0) >= 0.5 ? 1 : 0;
}

// The average at a game minute.
export function avgAt(bl: LabBaseline, key: BaselineKey, m: number): number | null {
  const v = bl.minutes[key]?.[m + shiftOf(bl)];
  return v == null || !Number.isFinite(v) ? null : v;
}

// The rows as STRATZ sends them, for LineCompare's `baseline` (it places each row by the row's own
// level, net worth or item time, and fades it by the row's own count).
export function avgCurve(bl: LabBaseline | null, key: BaselineKey): (number | null)[] | null {
  const list = bl?.minutes[key];
  return list?.length ? list : null;
}

// Games still going at a game minute, the count at the start, and the last minute with any.
export function gamesAt(bl: LabBaseline, m: number) {
  return bl.counts[m + shiftOf(bl)] ?? 0;
}
export function gamesAtStart(bl: LabBaseline) {
  return gamesAt(bl, 0) || bl.matches;
}
export function lastMinute(bl: LabBaseline) {
  let last = -1;
  bl.counts.forEach((c, i) => {
    if (c > 0) last = i;
  });
  return last - shiftOf(bl);
}

// From this minute fewer than 15% of the games (and at least 30) are left: the rule LineCompare fades
// the average's line by.
export const LONG_GAME_SHARE = 0.15;
export const thinBelow = (bl: LabBaseline) => Math.max(30, gamesAtStart(bl) * LONG_GAME_SHARE);
export function thinFrom(bl: LabBaseline) {
  const few = thinBelow(bl);
  for (let m = 1; m <= lastMinute(bl); m++) if (gamesAt(bl, m) < few) return m;
  return null;
}

// Baselines are the same when hero, position, rank and week are (kind: all but the week).
export const baselineKind = (s: LabSide) => {
  const bl = s.advanced.baseline;
  return bl ? `${s.heroId}-${bl.position}-${bl.bracket}` : null;
};
export const baselineId = (s: LabSide) => {
  const bl = s.advanced.baseline;
  return bl ? `${baselineKind(s)}-${bl.week ?? "recent"}` : null;
};

// STRATZ's week holding a moment (weeks are counted in whole 7-day spans from 1970, so they start
// on Thursdays, UTC: the start time 1791743534 is its week 2962): its first and last day.
export function weekOf(seconds: number) {
  const start = Math.floor(seconds / 604800) * 604800;
  return {
    from: new Date(start * 1000).toISOString().slice(0, 10),
    to: new Date((start + 6 * 86400) * 1000).toISOString().slice(5, 10),
  };
}

// ── The player's numbers at a minute ─────────────────────────────────────────────────────────

// A value, flagged when it's the whole game's number (no timestamps to cut it at the minute).
export type Val = { v: number; whole?: boolean } | null;

type Kind = "kill" | "death" | "assist";
const TOTAL: Record<Kind, "kills" | "deaths" | "assists"> = {
  kill: "kills",
  death: "deaths",
  assist: "assists",
};

// The timed events of a kind when they're (nearly) all there: OpenDota's logs have no assists, and
// STRATZ's lists can miss one against OpenDota's counts.
export function eventsOf(s: LabSide, kind: Kind) {
  const list = s.fights.events.filter((e) => e.kind === kind);
  const total = s.totals[TOTAL[kind]];
  return Math.abs(list.length - total) <= Math.max(1, Math.round(total * 0.1)) ? list : null;
}

// Kills credited to the player's team (killer or helper on it), as times.
export function teamKillTimes(s: LabSide) {
  const team = s.match.players.filter((p) => p.radiant === s.radiant);
  const heroes = new Set(team.map((p) => p.heroId));
  const slots = new Set(team.map((p) => p.slot));
  return s.match.deaths
    .filter(
      (d) =>
        !slots.has(d.slot) &&
        ((d.killer != null && heroes.has(d.killer)) || d.involved.some((h) => heroes.has(h))),
    )
    .map((d) => d.t);
}

const POWER_RUNES = new Set([
  "DOUBLE_DAMAGE",
  "HASTE",
  "ILLUSION",
  "INVISIBILITY",
  "REGEN",
  "ARCANE",
  "SHIELD",
]);

// Runes taken by a second: bounties picked up, and power runes picked up or bottled (a bottled
// rune used later shows up again as a pickup: counted once). Repeated rows are dropped.
export function runesBy(s: LabSide, t: number) {
  const seen = new Set<string>();
  const bottled: { t: number; rune: string }[] = [];
  let bounty = 0;
  let power = 0;
  for (const r of [...s.resources.runes].sort((a, b) => a.t - b.t)) {
    if (r.t > t) break;
    const id = `${r.t}|${r.rune}|${r.action}|${r.x}|${r.y}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (r.rune === "BOUNTY") {
      if (r.action === "PICKUP") bounty++;
    } else if (POWER_RUNES.has(r.rune)) {
      if (r.action === "BOTTLE") {
        bottled.push(r);
        power++;
      } else if (r.action === "PICKUP") {
        const i = bottled.findIndex((b) => b.rune === r.rune && r.t - b.t <= 120);
        if (i >= 0) bottled.splice(i, 1);
        else power++;
      }
    }
  }
  return { bounty, power };
}

// Camps cleared by a second, estimated from the last hits: neutral (or ancient) last hits in one
// place (within 6 map cells) less than 25 s apart are one camp. STRATZ's heroStats counts camps
// here, not creeps (its averages match this estimate, a creep count is three times higher). A last
// hit without a place (STRATZ leaves a few out) goes by the time alone.
export function campsBy(s: LabSide, kind: 1 | 2, t: number) {
  let n = 0;
  let last: { t: number; x: number; y: number } | null = null;
  const placed = (e: { x: number; y: number }) => Number.isFinite(e.x) && Number.isFinite(e.y);
  for (const e of s.resources.farm.filter((f) => f.kind === kind).sort((a, b) => a.t - b.t)) {
    if (e.t > t) break;
    const moved = !!last && placed(e) && placed(last) && Math.hypot(e.x - last.x, e.y - last.y) > 6;
    if (!last || e.t - last.t > 25 || moved) n++;
    last = e;
  }
  return n;
}

const at = (list: number[] | undefined, i: number): Val =>
  list && i >= 0 && i < list.length && Number.isFinite(list[i]) ? { v: list[i] } : null;
const whole = (v: number | null | undefined, end: boolean): Val =>
  end && v != null && Number.isFinite(v) ? { v, whole: true } : null;

// Hero damage dealt (out) or taken before a second. Each way comes from its own STRATZ list, and
// one can be there without the other: a way with no events at all is unknown, not zero.
function damageBy(
  s: LabSide,
  t: number,
  out: boolean,
  keep: (d: LabSide["advanced"]["damage"][number]) => boolean,
): Val {
  const list = s.advanced.damage.filter((d) => d.out === out);
  if (!list.length) return null;
  let sum = 0;
  for (const d of list) if (d.t < t && keep(d)) sum += d.v;
  return { v: sum };
}

// What deaths gave away by a second (every death has to carry the number).
function deathsBy(
  s: LabSide,
  t: number,
  pick: (d: LabSide["fights"]["events"][number]) => number | null,
): Val {
  const list = eventsOf(s, "death");
  if (!list) return null;
  let sum = 0;
  for (const d of list) {
    if (d.t > t) continue;
    const v = pick(d);
    if (v == null) return null;
    sum += v;
  }
  return { v: sum };
}

const countBy = (list: { t: number }[] | null, t: number): Val =>
  list ? { v: list.filter((e) => e.t <= t).length } : null;

// Uses up to a second (timed lists) or for the whole game (counts), map interactions left out.
// Power Treads toggles stay in: STRATZ's average AM toggles 115 times a game (its boots list), and
// its casts minus ability casts is about the item uses that leaves (WD at 20:00: 44 against 51).
function usesBy(
  s: LabSide,
  t: number,
  end: boolean,
  timed: { key: string; times: number[] }[],
  counts: { key: string; count: number }[],
): Val {
  const keep = (u: { key: string }) => !MAP_INTERACTIONS.has(u.key);
  if (timed.length)
    return { v: timed.filter(keep).reduce((a, u) => a + u.times.filter((x) => x <= t).length, 0) };
  const list = counts.filter(keep);
  return whole(
    list.reduce((a, u) => a + u.count, 0),
    end && list.length > 0,
  );
}

// Runes are known when STRATZ parsed the game or OpenDota logged any: an empty OpenDota log can't
// tell 'none' from 'not recorded'.
const runesKnown = (s: LabSide) => s.parsed.stratz || s.resources.runes.length > 0;

// ── The rows ─────────────────────────────────────────────────────────────────────────────────

export type RowKey =
  | "networth"
  | "xp"
  | "cs"
  | "dn"
  | "level"
  | "neutrals"
  | "ancients"
  | "towerDamage"
  | "kills"
  | "deaths"
  | "assists"
  | "kp"
  | "heroDamage"
  | "attackDamage"
  | "castDamage"
  | "stunDuration"
  | "damageReceived"
  | "physicalDamageReceived"
  | "magicalDamageReceived"
  | "pureDamageReceived"
  | "goldFed"
  | "xpFed"
  | "goldLost"
  | "campsStacked"
  | "healingAllies"
  | "runeBounty"
  | "runePower"
  | "apm"
  | "casts"
  | "abilityCasts";

export type RowGroup = "economy" | "fighting" | "taken" | "feeding" | "support" | "misc";
// int: whole numbers; count: whole for the game, one decimal for the average; pct; sec (one decimal).
export type RowFmt = "int" | "count" | "pct" | "sec";

export type Row = {
  key: RowKey;
  group: RowGroup;
  fmt: RowFmt;
  // Below this average the hero hardly does it at this rank and position: the row is left out.
  min: number;
  // Estimated from a rule, not read from the game.
  estimate?: boolean;
  // The player's value at minute m (end: m is the game's last minute).
  mine: (s: LabSide, m: number, end: boolean) => Val;
  // The average in the same units (default: the field of the same name).
  avg?: (bl: LabBaseline, m: number) => number | null;
};

const field =
  (key: BaselineKey, f = (v: number) => v) =>
  (bl: LabBaseline, m: number) => {
    const v = avgAt(bl, key, m);
    return v == null ? null : f(v);
  };

export const ROWS: Row[] = [
  // Economy.
  { key: "networth", group: "economy", fmt: "int", min: 1, mine: (s, m) => at(s.minutes.netWorth, m) },
  { key: "xp", group: "economy", fmt: "int", min: 1, mine: (s, m) => at(s.minutes.xp, m) },
  { key: "cs", group: "economy", fmt: "int", min: 1, mine: (s, m) => at(s.minutes.lh, m) },
  { key: "dn", group: "economy", fmt: "count", min: 0.5, mine: (s, m) => at(s.minutes.dn, m) },
  { key: "level", group: "economy", fmt: "count", min: 1, mine: (s, m) => at(s.minutes.level, m) },
  {
    key: "neutrals",
    group: "economy",
    fmt: "count",
    min: 1,
    estimate: true,
    mine: (s, m) => (s.resources.farm.length ? { v: campsBy(s, 1, m * 60) } : null),
  },
  {
    key: "ancients",
    group: "economy",
    fmt: "count",
    min: 0.3,
    estimate: true,
    mine: (s, m) => (s.resources.farm.length ? { v: campsBy(s, 2, m * 60) } : null),
  },
  { key: "towerDamage", group: "economy", fmt: "int", min: 50, mine: (s, m) => at(s.minutes.towerDamage, m) },
  // Fighting.
  {
    key: "kills",
    group: "fighting",
    fmt: "count",
    min: 0.5,
    mine: (s, m, end) => countBy(eventsOf(s, "kill"), m * 60) ?? whole(s.totals.kills, end),
  },
  {
    key: "deaths",
    group: "fighting",
    fmt: "count",
    min: 0.5,
    mine: (s, m, end) => countBy(eventsOf(s, "death"), m * 60) ?? whole(s.totals.deaths, end),
  },
  {
    key: "assists",
    group: "fighting",
    fmt: "count",
    min: 0.5,
    mine: (s, m, end) => countBy(eventsOf(s, "assist"), m * 60) ?? whole(s.totals.assists, end),
  },
  {
    key: "kp",
    group: "fighting",
    fmt: "pct",
    min: 0.05,
    mine: (s, m, end) => {
      const k = eventsOf(s, "kill");
      const a = eventsOf(s, "assist");
      if (k && a) {
        const team = teamKillTimes(s).filter((x) => x <= m * 60).length;
        const mineKa = k.filter((e) => e.t <= m * 60).length + a.filter((e) => e.t <= m * 60).length;
        return team ? { v: Math.min(1, mineKa / team) } : null;
      }
      return s.totals.teamKills
        ? whole(Math.min(1, (s.totals.kills + s.totals.assists) / s.totals.teamKills), end)
        : null;
    },
    // The share from the averages (STRATZ's own participation field comes back empty).
    avg: (bl, m) => {
      const k = avgAt(bl, "kills", m);
      const a = avgAt(bl, "assists", m);
      const team = avgAt(bl, "teamKills", m);
      return k != null && a != null && team && team >= 1 ? Math.min(1, (k + a) / team) : null;
    },
  },
  { key: "heroDamage", group: "fighting", fmt: "int", min: 100, mine: (s, m) => at(s.minutes.heroDamage, m) },
  {
    key: "attackDamage",
    group: "fighting",
    fmt: "int",
    min: 100,
    mine: (s, m) => damageBy(s, m * 60, true, (d) => !d.ill && d.type === 0),
  },
  {
    key: "castDamage",
    group: "fighting",
    fmt: "int",
    min: 100,
    mine: (s, m) => damageBy(s, m * 60, true, (d) => !d.ill && d.type > 0),
  },
  {
    // STRATZ's own stun seconds (OpenDota's count roots and other disables too), for the whole game.
    key: "stunDuration",
    group: "fighting",
    fmt: "sec",
    min: 1,
    mine: (s, m, end) => {
      const v = s.advanced.report?.dealt.stunDuration;
      return whole(v != null ? v / 100 : null, end);
    },
    avg: field("stunDuration", (v) => v / 100),
  },
  // Hero damage taken (STRATZ's running total is through the end of each minute).
  {
    key: "damageReceived",
    group: "taken",
    fmt: "int",
    min: 100,
    mine: (s, m) => at(s.minutes.damageTaken, m - 1) ?? damageBy(s, m * 60, false, () => true),
  },
  {
    key: "physicalDamageReceived",
    group: "taken",
    fmt: "int",
    min: 50,
    mine: (s, m) => damageBy(s, m * 60, false, (d) => d.type <= 1),
  },
  {
    key: "magicalDamageReceived",
    group: "taken",
    fmt: "int",
    min: 50,
    mine: (s, m) => damageBy(s, m * 60, false, (d) => d.type === 2),
  },
  {
    key: "pureDamageReceived",
    group: "taken",
    fmt: "int",
    min: 50,
    mine: (s, m) => damageBy(s, m * 60, false, (d) => d.type === 3),
  },
  // What deaths gave away.
  {
    key: "goldFed",
    group: "feeding",
    fmt: "int",
    min: 50,
    mine: (s, m) => deathsBy(s, m * 60, (d) => d.goldFed),
  },
  { key: "xpFed", group: "feeding", fmt: "int", min: 50, mine: (s, m) => deathsBy(s, m * 60, (d) => d.xp) },
  {
    // STRATZ keeps it negative.
    key: "goldLost",
    group: "feeding",
    fmt: "int",
    min: 20,
    mine: (s, m) => deathsBy(s, m * 60, (d) => d.gold),
    avg: field("goldLost", (v) => Math.abs(v)),
  },
  // Support and runes.
  {
    key: "campsStacked",
    group: "support",
    fmt: "count",
    min: 0.3,
    mine: (s, m, end) => at(s.minutes.campsStacked, m) ?? whole(s.resources.campsStacked, end),
  },
  { key: "healingAllies", group: "support", fmt: "int", min: 100, mine: (s, m) => at(s.minutes.healing, m) },
  {
    key: "runeBounty",
    group: "support",
    fmt: "count",
    min: 0.3,
    mine: (s, m) => (runesKnown(s) ? { v: runesBy(s, m * 60).bounty } : null),
  },
  {
    key: "runePower",
    group: "support",
    fmt: "count",
    min: 0.3,
    mine: (s, m) => (runesKnown(s) ? { v: runesBy(s, m * 60).power } : null),
  },
  {
    // STRATZ's APM is the minute's own (late rows dip and rise by 20, which a running mean can't), so
    // both sides are the mean over the minutes so far.
    key: "apm",
    group: "misc",
    fmt: "int",
    min: 1,
    mine: (s, m, end) => {
      const list = s.advanced.apm;
      if (m > 0 && list.length >= m) return { v: list.slice(0, m).reduce((a, b) => a + b, 0) / m };
      return whole(s.totals.apm, end);
    },
    avg: (bl, m) => {
      let sum = 0;
      for (let g = 0; g < m; g++) {
        const v = avgAt(bl, "apm", g);
        if (v == null) return null;
        sum += v;
      }
      return m > 0 ? sum / m : null;
    },
  },
  {
    key: "casts",
    group: "misc",
    fmt: "int",
    min: 5,
    mine: (s, m, end) =>
      usesBy(
        s,
        m * 60,
        end,
        [...s.skills.useTimes, ...s.items.useTimes],
        [...s.skills.uses, ...s.items.uses],
      ),
  },
  {
    key: "abilityCasts",
    group: "misc",
    fmt: "int",
    min: 5,
    mine: (s, m, end) => usesBy(s, m * 60, end, s.skills.useTimes, s.skills.uses),
  },
];

export const GROUPS: RowGroup[] = ["economy", "fighting", "taken", "feeding", "support", "misc"];

export type RowValue = { row: Row; mine: NonNullable<Val>; avg: number; ratio: number | null };

export const ROW_BY = Object.fromEntries(ROWS.map((r) => [r.key, r])) as Record<RowKey, Row>;

// The side's minute to compare at: the given second's minute, within the game, its per-minute
// curves and the average's reach.
export function compareMinute(s: LabSide, untilSeconds: number) {
  const bl = s.advanced.baseline;
  if (!bl) return null;
  const end = Math.min(Number.isFinite(untilSeconds) ? untilSeconds : s.duration, s.duration);
  const m = Math.min(
    Math.floor(end / 60),
    Math.floor(s.duration / 60),
    s.minutes.netWorth.length - 1,
    lastMinute(bl),
  );
  return m >= 1 ? m : null;
}

// Every row with both values at minute m (rows the hero hardly does are left out).
export function tableAt(s: LabSide, m: number): RowValue[] {
  const bl = s.advanced.baseline;
  if (!bl) return [];
  const end = m >= Math.floor(s.duration / 60);
  const out: RowValue[] = [];
  for (const row of ROWS) {
    const avg = row.avg ? row.avg(bl, m) : avgAt(bl, row.key as BaselineKey, m);
    if (avg == null || avg < row.min) continue;
    const mine = row.mine(s, m, end);
    if (!mine) continue;
    out.push({ row, mine, avg, ratio: avg ? mine.v / avg : null });
  }
  return out;
}

// ── OpenDota's benchmarks ────────────────────────────────────────────────────────────────────

// Fewer is better: OpenDota's list runs from few to many, its match percentile is the other way.
const FEWER_BETTER = new Set(["deaths_per_min"]);

// The value at a percentile (0–1) of OpenDota's list, linear between the listed steps.
export function valueAtP(list: { p: number; v: number }[], p: number) {
  if (!list.length) return null;
  if (p <= list[0].p) return list[0].v;
  for (let i = 1; i < list.length; i++)
    if (p <= list[i].p) {
      const a = list[i - 1];
      const b = list[i];
      return a.v + ((b.v - a.v) * (p - a.p)) / (b.p - a.p);
    }
  return list[list.length - 1].v;
}

export const TARGETS = [0.5, 0.75, 0.9] as const;

// Per metric: this game's value, the share of players it beats (OpenDota's own), and the values that
// beat 50 / 75 / 90% (left out when they're all zero: the hero doesn't do it).
export function benchmarkRows(s: LabSide) {
  const bench = s.refs.od?.benchmarks ?? {};
  return Object.entries(bench)
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.p - b.p);
      const fewer = FEWER_BETTER.has(key);
      const targets = TARGETS.map((q) => valueAtP(sorted, fewer ? 1 - q : q));
      return {
        key,
        value: s.benchmarksRaw[key] ?? null,
        better: s.benchmarks[key] ?? null,
        targets,
      };
    })
    .filter((r) => r.value != null && r.targets.some((v) => v != null && v > 0));
}

// ── Item timings ─────────────────────────────────────────────────────────────────────────────

// A purchase minute's games and wins (w is a count: lab-refs sums STRATZ's winCount).
type Bucket = { m: number; n: number; w: number };
// The win rate of a purchase minute (STRATZ keeps only minutes with enough games: an earlier or
// later timing reads the nearest kept minute, flagged).
export function bucketAt(curve: Bucket[] | undefined, m: number) {
  if (!curve?.length) return null;
  const first = curve[0].m;
  const last = curve[curve.length - 1].m;
  const mm = Math.min(last, Math.max(first, m));
  const c = curve.find((x) => x.m === mm);
  if (!c || !c.n) return null;
  return { m: mm, n: c.n, rate: c.w / c.n, edge: m < first ? -1 : m > last ? 1 : 0 };
}

// The items whose timing is read: the key items, plus the items STRATZ tracks for the hero at this
// rank and position that a fifth of its games buy (a support's wand or ring), bought after the horn
// and not together with a key item they go into (Perseverance in a Battle Fury bought at once).
export function timedItems(s: LabSide, assets: LabAssets) {
  const out = firstBuys(s, assets);
  const bl = s.advanced.baseline;
  if (bl) {
    const first = new Map<string, number>();
    for (const p of s.items.purchases) if (!first.has(p.key)) first.set(p.key, p.t);
    for (const [key, t] of first) {
      if (out.has(key) || t < 0 || (bl.items[key]?.rate ?? 0) < 0.2) continue;
      const into = [...out.entries()].some(
        ([k, at]) => Math.abs(at - t) <= 10 && (assets.itemMeta[k]?.components ?? []).includes(key),
      );
      if (!into) out.set(key, t);
    }
  }
  return new Map([...out.entries()].sort((p, q) => p[1] - q[1]));
}

// Each item's first purchase against the rank average (time, how often it's bought, the win rate at
// both minutes), the player's own recent games and pros on the patch.
export function itemTimings(s: LabSide, assets: LabAssets) {
  const bl = s.advanced.baseline;
  return [...timedItems(s, assets).entries()].map(([key, t]) => {
    const it = bl?.items[key] ?? null;
    const personal = s.refs.personal?.parsed.items[key] ?? null;
    const pro = s.refs.pro?.items[key] ?? null;
    const proPct = pro ? percentileOf(pro, t) : null;
    return {
      key,
      t,
      avg: it?.time ?? null,
      rate: it?.rate ?? null,
      atMine: it ? bucketAt(it.curve, Math.floor(t / 60)) : null,
      atAvg: it ? bucketAt(it.curve, Math.floor(it.time / 60)) : null,
      curve: it?.curve ?? null,
      personal: personal ? { median: median(personal), n: personal.n } : null,
      pro: pro ? { median: median(pro), n: pro.n, fasterThan: proPct == null ? null : 1 - proPct } : null,
    };
  });
}

// The side's core item: the key item most often bought at this rank and position that the player
// bought too (key items from the match's list, so the metrics need no item catalog).
export function coreItem(s: LabSide) {
  const bl = s.advanced.baseline;
  const me = s.match.players.find((p) => p.slot === s.slot);
  if (!bl || !me) return null;
  const mine = new Map(me.keyItems.map((k) => [k.key, k.t]));
  const key = Object.entries(bl.items)
    .filter(([k]) => mine.has(k))
    .sort((x, y) => y[1].rate - x[1].rate)[0]?.[0];
  if (!key) return null;
  const it = bl.items[key];
  return {
    key,
    t: mine.get(key)!,
    avg: it.time,
    atMine: bucketAt(it.curve, Math.floor(mine.get(key)! / 60)),
    atAvg: bucketAt(it.curve, Math.floor(it.time / 60)),
  };
}

// ── Curves by minute ─────────────────────────────────────────────────────────────────────────

const minutesOfGame = (s: LabSide) => Math.floor(s.duration / 60) + 1;

// Events counted up to each minute (null when they aren't all there).
export function eventCurve(s: LabSide, kind: Kind) {
  const list = eventsOf(s, kind);
  if (!list) return null;
  return Array.from({ length: minutesOfGame(s) }, (_, m) => list.filter((e) => e.t <= m * 60).length);
}

// Gold given away by deaths, up to each minute.
export function goldFedCurve(s: LabSide) {
  const list = eventsOf(s, "death");
  if (!list || list.some((d) => d.goldFed == null)) return null;
  return Array.from({ length: minutesOfGame(s) }, (_, m) =>
    list.filter((d) => d.t <= m * 60).reduce((a, d) => a + (d.goldFed ?? 0), 0),
  );
}

// The hero's own hero damage by right-clicks (attack) or spells and items (cast), before each minute
// (none when the damage dealt wasn't fetched).
export function damageCurve(s: LabSide, attack: boolean) {
  if (!s.advanced.damage.some((d) => d.out)) return null;
  const out = Array.from({ length: minutesOfGame(s) }, () => 0);
  for (const d of s.advanced.damage) {
    if (!d.out || d.ill || (d.type === 0) !== attack) continue;
    const from = Math.max(0, Math.floor(d.t / 60) + 1);
    for (let m = from; m < out.length; m++) out[m] += d.v;
  }
  return out;
}

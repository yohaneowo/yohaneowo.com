import type { Dictionary } from "@/i18n/dictionaries";
import type { LabAssets, LabSide } from "@/lib/dota/lab";
import { clock, mapZone } from "@/lib/dota/map";

// The reading of the numbers: shares, key item timings, the differences that stand out, and one
// sentence per section. Pure, so the page computes it in the browser as the choices change.

type R = Dictionary["dotahub"]["research"];

export const minutesOf = (s: LabSide) => Math.max(1, s.duration / 60);
export const pct = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v) ? "–" : `${(v * 100).toFixed(digits)}%`;
export const num = (v: number | null | undefined, digits = 0) =>
  v == null || !Number.isFinite(v)
    ? "–"
    : v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const signed = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v).toLocaleString()}`;

// A per-minute cumulative curve at any second (linear between minutes).
export function valueAt(arr: number[], t: number) {
  if (!arr.length) return null;
  const m = t / 60;
  if (m <= 0) return arr[0];
  const i = Math.floor(m);
  if (i >= arr.length - 1) return arr[arr.length - 1];
  return arr[i] + (arr[i + 1] - arr[i]) * (m - i);
}

// ── Areas of the map, relative to the player's side ──────────────────────────────────────────

export type Area = "lane" | "ownJungle" | "enemyJungle" | "river" | "ownBase" | "enemyBase";
export const AREAS: Area[] = ["lane", "ownJungle", "enemyJungle", "river", "ownBase", "enemyBase"];

export function areaOf(x: number, y: number, radiant: boolean): Area {
  const z = mapZone(x, y);
  if (z === "top" || z === "mid" || z === "bot") return "lane";
  if (z === "river") return "river";
  if (z === "radiantJungle") return radiant ? "ownJungle" : "enemyJungle";
  if (z === "direJungle") return radiant ? "enemyJungle" : "ownJungle";
  if (z === "radiantBase") return radiant ? "ownBase" : "enemyBase";
  return radiant ? "enemyBase" : "ownBase";
}

// Whether the hero was alive at a path sample (the position is carried forward while dead).
export const aliveAt = (s: LabSide, i: number) => s.advanced.activity[i] !== "dead";

// Share of the path's samples in each area, within [from, to] seconds, while alive.
export function areaShares(s: LabSide, from = -Infinity, to = Infinity) {
  const counts = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  let n = 0;
  s.path.t.forEach((t, i) => {
    if (t < Math.max(0, from) || t > to || !aliveAt(s, i)) return;
    counts[areaOf(s.path.x[i], s.path.y[i], s.radiant)]++;
    n++;
  });
  return {
    n,
    shares: Object.fromEntries(AREAS.map((a) => [a, n ? counts[a] / n : 0])) as Record<Area, number>,
  };
}

// ── Gold sources ─────────────────────────────────────────────────────────────────────────────

export type GoldKind =
  "creeps" | "neutrals" | "heroes" | "buildings" | "roshan" | "runes" | "couriers" | "passive" | "other";
export const GOLD_KINDS: GoldKind[] = [
  "creeps",
  "neutrals",
  "heroes",
  "buildings",
  "roshan",
  "runes",
  "couriers",
  "passive",
  "other",
];
const REASON: Record<string, GoldKind> = {
  "11": "buildings",
  "12": "heroes",
  "13": "creeps",
  "14": "neutrals",
  "15": "roshan",
  "16": "couriers",
  "17": "runes",
  "18": "heroes",
  "19": "other",
  "20": "other",
  // The bonus for the courier kill itself (16 is the share every hero gets).
  "21": "couriers",
};

// Gold earned by kind: the income reasons (11–21) and passive income, which isn't logged as a
// reason — what the ledger's earned gold (spent + kept + lost to deaths and buybacks, less sells and
// the starting gold) leaves once the reasons are taken off. Sells are money back, not income: their
// own line, outside the shares.
export function goldShares(s: LabSide) {
  const out = Object.fromEntries(GOLD_KINDS.map((k) => [k, 0])) as Record<GoldKind, number>;
  for (const [reason, value] of Object.entries(s.goldReasons)) {
    const kind = REASON[reason];
    if (kind && value > 0) out[kind] += value;
  }
  const logged = Object.values(out).reduce((a, b) => a + b, 0);
  const earned = s.totals.earned ?? s.totals.totalGold ?? s.minutes.gold[s.minutes.gold.length - 1] ?? 0;
  out.passive = Math.max(0, s.totals.passiveGold ?? earned - logged);
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  return {
    values: out,
    total,
    shares: Object.fromEntries(GOLD_KINDS.map((k) => [k, total ? out[k] / total : 0])) as Record<
      GoldKind,
      number
    >,
    lost: -(s.goldReasons["1"] ?? 0),
    sells: s.totals.sells,
  };
}

export function xpShares(s: LabSide) {
  const r = s.xpReasons;
  const values = {
    heroes: r["1"] ?? 0,
    creeps: r["2"] ?? 0,
    roshan: r["3"] ?? 0,
    other: (r["0"] ?? 0) + (r["4"] ?? 0) + (r["5"] ?? 0),
  };
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  return { values, total };
}

// ── Items ────────────────────────────────────────────────────────────────────────────────────

const NOT_KEY = new Set([
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "tpscroll",
  "travel_boots",
  "dust",
  "smoke_of_deceit",
  "aegis",
  "cheese",
  "refresher_shard",
]);

// A finished item worth timing: 1800 gold or more, not a consumable or recipe.
export function isKeyItem(key: string, assets: LabAssets) {
  const it = assets.items[key];
  return !!it && !it.consumable && it.cost >= 1800 && !key.startsWith("recipe_") && !NOT_KEY.has(key);
}

// ── Alignment ────────────────────────────────────────────────────────────────────────────────

export type Align = { kind: "time" } | { kind: "level" } | { kind: "item"; key: string } | { kind: "nw" };

// Net worth in thousands at a second (the side's own resources as the x axis).
const nwAt = (s: LabSide, t: number) => (valueAt(s.minutes.netWorth, t) ?? 0) / 1000;

// The x value of a moment for a side (minutes, levels, minutes from the item, or net worth in
// thousands), and back.
export function xOf(s: LabSide, t: number, align: Align): number | null {
  if (align.kind === "time") return t / 60;
  if (align.kind === "nw") {
    // Net worth drops on deaths: the axis keeps the highest reached so far, so it only goes forward.
    const m = Math.min(s.minutes.netWorth.length - 1, Math.max(0, Math.floor(t / 60)));
    let peak = 0;
    for (let i = 0; i <= m; i++) peak = Math.max(peak, s.minutes.netWorth[i] ?? 0);
    return Math.max(peak / 1000, nwAt(s, t));
  }
  if (align.kind === "level") {
    const lt = s.levelTimes;
    let level = 1;
    for (let i = 0; i < lt.length; i++) {
      if (lt[i] == null || lt[i] > t) break;
      level = i + 1;
      const next = lt[i + 1];
      if (next != null && next > t) return level + (t - lt[i]) / Math.max(1, next - lt[i]);
    }
    return level;
  }
  const at = itemTime(s, align.key);
  return at == null ? null : (t - at) / 60;
}

export function timeOf(s: LabSide, x: number, align: Align): number | null {
  if (align.kind === "time") return x * 60;
  if (align.kind === "nw") {
    // The first moment the net worth reached x thousand (between minutes, linearly).
    const nw = s.minutes.netWorth;
    const goal = x * 1000;
    if (!nw.length) return null;
    if (goal <= (nw[0] ?? 0)) return 0;
    for (let m = 1; m < nw.length; m++)
      if (nw[m] >= goal) {
        const a = nw[m - 1];
        return (m - 1 + (goal - a) / Math.max(1, nw[m] - a)) * 60;
      }
    return s.duration;
  }
  if (align.kind === "level") {
    const i = Math.floor(x) - 1;
    const lt = s.levelTimes;
    if (i < 0) return lt[0] ?? 0;
    if (i >= lt.length - 1) return lt[lt.length - 1] ?? null;
    const a = lt[i];
    const b = lt[i + 1];
    if (a == null) return null;
    return b == null ? a : a + (b - a) * (x - Math.floor(x));
  }
  const at = itemTime(s, align.key);
  return at == null ? null : at + x * 60;
}

export function itemTime(s: LabSide, key: string) {
  return s.items.purchases.find((p) => p.key === key)?.t ?? null;
}

export function commonKeyItems(a: LabSide, b: LabSide | null, assets: LabAssets) {
  const ka = new Map<string, number>();
  for (const p of a.items.purchases) if (isKeyItem(p.key, assets) && !ka.has(p.key)) ka.set(p.key, p.t);
  if (!b) return [...ka.keys()];
  const kb = new Set(b.items.purchases.filter((p) => isKeyItem(p.key, assets)).map((p) => p.key));
  return [...ka.keys()].filter((k) => kb.has(k));
}

export function firstBuys(s: LabSide, assets: LabAssets) {
  const out = new Map<string, number>();
  for (const p of s.items.purchases) if (isKeyItem(p.key, assets) && !out.has(p.key)) out.set(p.key, p.t);
  return out;
}

// ── Metrics compared ─────────────────────────────────────────────────────────────────────────

export type Fmt = "int" | "dec" | "pct" | "clock" | "signed";
export type Metric = {
  key: string;
  fmt: Fmt;
  // Which way is better (null: neither, e.g. it depends on the role).
  higher: boolean | null;
  get: (s: LabSide) => number | null;
  // The value over the first `until` seconds, so games of different lengths compare over the same
  // window.
  getUntil?: (s: LabSide, until: number) => number | null;
  // Which way is better for this side (by its role), overriding `higher`; null when neither.
  dir?: (s: LabSide) => boolean | null;
  // Where a value falls among the side's references (0–1), to rank gaps by how unusual they are.
  pct?: (s: LabSide, v: number) => number | null;
  // The side's own game-to-game spread (standard deviation over their games on the hero, in the
  // metric's units): a gap smaller than it is within normal variation.
  spread?: (s: LabSide) => number | null;
  // Only compared between two games on the same hero (casts, item uses…).
  sameHero?: boolean;
  // The row's label when it isn't in t.metrics.
  label?: (t: R) => string;
};

// Where a value falls on OpenDota's benchmark curve for the hero (percentile 0–1, between its
// points; below the 10th linearly towards 0).
export function benchPct(s: LabSide, key: string, v: number | null | undefined): number | null {
  const list = s.refs.od?.benchmarks[key];
  if (!list?.length || v == null || !Number.isFinite(v)) return null;
  const pts = [...list].sort((a, b) => a.p - b.p);
  if (v <= pts[0].v) return pts[0].v > 0 ? Math.max(0, pts[0].p * (v / pts[0].v)) : pts[0].p;
  for (let i = 1; i < pts.length; i++)
    if (v <= pts[i].v) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.p + ((b.p - a.p) * (v - a.v)) / Math.max(1e-9, b.v - a.v);
    }
  return pts[pts.length - 1].p;
}

// Map interactions logged as abilities (twin gates, watchers, lotus pools, outposts, walking
// through Underlord's portal): not casts.
export const MAP_INTERACTIONS = new Set([
  "twin_gate_portal_warp",
  "ability_lamp_use",
  "ability_pluck_famango",
  "ability_capture",
  "abyssal_underlord_portal_warp",
]);

// Per minute of a cumulative per-minute curve over the first `until` seconds. The game that ends
// first is compared over all of it, and its curves stop at the last whole minute: its whole-game
// rate (`whole`) stands in, else the minutes after the last one would count with nothing in them.
const perMinUntil = (s: LabSide, arr: number[], until: number, whole: number | null) => {
  if (until >= s.duration && whole != null) return whole;
  const v = valueAt(arr, until);
  return v == null || until <= 0 ? null : (v - (arr[0] ?? 0)) / (until / 60);
};
// Without STRATZ's parse the events are OpenDota's kill and death logs, which have no assists.
const eventsUntil = (s: LabSide, kind: "kill" | "death" | "assist", until: number) => {
  if (kind === "assist" && !s.parsed.stratz)
    return until >= s.duration ? s.totals.assists / minutesOf(s) : null;
  return s.fights.events.filter((f) => f.kind === kind && f.t <= until).length / Math.max(1, until / 60);
};
// STRATZ's damage taken is a running total by the end of each minute (index m = (m + 1):00).
const takenUntil = (s: LabSide, until: number) => {
  if (!s.minutes.damageTaken.length) return null;
  if (until >= s.duration && s.damage.takenByKind.heroes != null)
    return s.damage.takenByKind.heroes / minutesOf(s);
  const v = valueAt([0, ...s.minutes.damageTaken], until);
  return v == null || until <= 0 ? null : v / (until / 60);
};
const sd = (s: LabSide, key: keyof NonNullable<LabSide["refs"]["personal"]>["od"]) =>
  s.refs.personal?.od[key]?.sd ?? null;
const isCore = (s: LabSide) => s.position != null && s.position <= 3;
const isSupport = (s: LabSide) => s.position != null && s.position >= 4;

const castsPerMin = (s: LabSide) =>
  s.skills.uses.filter((u) => !MAP_INTERACTIONS.has(u.key)).reduce((a, b) => a + b.count, 0) / minutesOf(s);
const itemUsesPerMin = (s: LabSide) =>
  s.items.uses.filter((u) => u.key !== "power_treads").reduce((a, b) => a + b.count, 0) / minutesOf(s);
const kaPerMin = (s: LabSide) => (s.totals.kills + s.totals.assists) / minutesOf(s);

// Seconds dead over the first `until` seconds.
const deadUntil = (s: LabSide, until: number) =>
  s.fights.events
    .filter((f) => f.kind === "death" && f.t <= until)
    .reduce((a, f) => a + Math.max(0, Math.min(until, f.t + (f.timeDead ?? 0)) - f.t), 0);

// Rates over the whole game, or over the first `until` seconds when the two games differ in length
// (getUntil); percentiles against OpenDota's benchmarks for the hero (pct), the player's own spread on
// the hero (spread); 'better' by role where it depends on it (dir: null = neither).
export const METRICS: Metric[] = [
  {
    key: "gpm",
    fmt: "int",
    higher: true,
    get: (s) => s.totals.gpm,
    getUntil: (s, u) => perMinUntil(s, s.minutes.gold, u, s.totals.gpm),
    pct: (s, v) => benchPct(s, "gold_per_min", v),
    spread: (s) => sd(s, "gpm"),
    dir: (s) => (isSupport(s) ? null : true),
  },
  {
    key: "xpm",
    fmt: "int",
    higher: true,
    get: (s) => s.totals.xpm,
    getUntil: (s, u) => perMinUntil(s, s.minutes.xp, u, s.totals.xpm),
    pct: (s, v) => benchPct(s, "xp_per_min", v),
    spread: (s) => sd(s, "xpm"),
  },
  {
    key: "lhpm",
    fmt: "dec",
    higher: true,
    get: (s) => s.totals.lastHits / minutesOf(s),
    getUntil: (s, u) => perMinUntil(s, s.minutes.lh, u, s.totals.lastHits / minutesOf(s)),
    pct: (s, v) => benchPct(s, "last_hits_per_min", v),
    spread: (s) => sd(s, "lhpm"),
    dir: (s) => (isSupport(s) ? null : true),
  },
  {
    key: "dnpm",
    fmt: "dec",
    higher: true,
    get: (s) => s.totals.denies / minutesOf(s),
    getUntil: (s, u) => perMinUntil(s, s.minutes.dn, u, s.totals.denies / minutesOf(s)),
    pct: (s, v) => benchPct(s, "denies_per_min", v),
  },
  {
    key: "kpm",
    fmt: "dec",
    higher: true,
    get: (s) => s.totals.kills / minutesOf(s),
    getUntil: (s, u) => eventsUntil(s, "kill", u),
    pct: (s, v) => benchPct(s, "kills_per_min", v),
  },
  {
    key: "dpm",
    fmt: "dec",
    higher: false,
    get: (s) => s.totals.deaths / minutesOf(s),
    getUntil: (s, u) => eventsUntil(s, "death", u),
    pct: (s, v) => benchPct(s, "deaths_per_min", v),
  },
  {
    key: "apm",
    fmt: "dec",
    higher: true,
    get: (s) => s.totals.assists / minutesOf(s),
    getUntil: (s, u) => eventsUntil(s, "assist", u),
    pct: (s, v) => benchPct(s, "assists_per_min", v),
  },
  {
    key: "hdpm",
    fmt: "int",
    higher: true,
    get: (s) => s.totals.heroDamage / minutesOf(s),
    getUntil: (s, u) => perMinUntil(s, s.minutes.heroDamage, u, s.totals.heroDamage / minutesOf(s)),
    pct: (s, v) => benchPct(s, "hero_damage_per_min", v),
  },
  {
    key: "tdpm",
    fmt: "int",
    higher: true,
    get: (s) => s.totals.towerDamage / minutesOf(s),
    getUntil: (s, u) => perMinUntil(s, s.minutes.towerDamage, u, s.totals.towerDamage / minutesOf(s)),
    dir: (s) => (isSupport(s) ? null : true),
  },
  {
    key: "tkpm",
    fmt: "int",
    higher: null,
    get: (s) => (s.damage.takenByKind.heroes != null ? s.damage.takenByKind.heroes / minutesOf(s) : null),
    getUntil: takenUntil,
  },
  {
    key: "participation",
    fmt: "pct",
    higher: true,
    get: (s) => s.fights.participation,
    getUntil: (s, u) => {
      // OpenDota's logs (no STRATZ parse) have no assists: only the whole game, when it's the window.
      if (!s.parsed.stratz) return u >= s.duration ? s.fights.participation : null;
      const enemy = new Set(s.enemies);
      const team = s.match.deaths.filter((d) => enemy.has(d.hero) && d.t <= u).length;
      const mine = s.fights.events.filter(
        (f) => (f.kind === "kill" || f.kind === "assist") && f.t <= u,
      ).length;
      return team ? Math.min(1, mine / team) : null;
    },
  },
  {
    key: "lh10",
    fmt: "int",
    higher: true,
    get: (s) => s.laning.at10?.lh ?? null,
    dir: (s) => (isSupport(s) ? null : true),
  },
  {
    key: "nw10",
    fmt: "int",
    higher: true,
    get: (s) => s.laning.at10?.netWorth ?? null,
    dir: (s) => (isSupport(s) ? null : true),
  },
  { key: "lvl6", fmt: "clock", higher: false, get: (s) => s.levelTimes[5] ?? null },
  { key: "lvl12", fmt: "clock", higher: false, get: (s) => s.levelTimes[11] ?? null },
  { key: "lvl18", fmt: "clock", higher: false, get: (s) => s.levelTimes[17] ?? null },
  // How the gold came: a style, not better or worse.
  { key: "creepShare", fmt: "pct", higher: null, get: (s) => goldShares(s).shares.creeps },
  { key: "neutralShare", fmt: "pct", higher: null, get: (s) => goldShares(s).shares.neutrals },
  { key: "killShare", fmt: "pct", higher: null, get: (s) => goldShares(s).shares.heroes },
  {
    key: "deadPct",
    fmt: "pct",
    higher: false,
    get: (s) => (s.totals.deadSeconds != null ? s.totals.deadSeconds / s.duration : null),
    getUntil: (s, u) => (s.totals.deadSeconds != null ? deadUntil(s, u) / u : null),
  },
  {
    key: "wards",
    fmt: "dec",
    higher: null,
    get: (s) => (s.vision.wards.length * 10) / minutesOf(s),
    getUntil: (s, u) => (s.vision.wards.filter((w) => w.t <= u).length * 10) / Math.max(1, u / 60),
    dir: (s) => (isSupport(s) ? true : null),
  },
  {
    key: "dewards",
    fmt: "int",
    higher: null,
    get: (s) => s.vision.observerKills + s.vision.sentryKills,
    dir: (s) => (isSupport(s) ? true : null),
  },
  {
    key: "stacks",
    fmt: "int",
    higher: null,
    get: (s) => s.resources.campsStacked,
    dir: (s) => (isSupport(s) ? true : null),
  },
  {
    key: "runes",
    fmt: "int",
    higher: null,
    get: (s) => s.resources.runes.filter((r) => r.action === "PICKUP" || r.action === "BOTTLE").length,
    dir: (s) => (s.position === 2 || isSupport(s) ? true : null),
  },
  { key: "castpm", fmt: "dec", higher: null, get: castsPerMin, sameHero: true },
  { key: "itempm", fmt: "dec", higher: null, get: itemUsesPerMin, sameHero: true },
  {
    key: "stunpm",
    fmt: "dec",
    higher: true,
    get: (s) => (s.totals.stuns != null ? s.totals.stuns / minutesOf(s) : null),
    sameHero: true,
  },
  { key: "actionspm", fmt: "int", higher: null, get: (s) => s.totals.apm },
  {
    key: "enemyJungle",
    fmt: "pct",
    higher: null,
    get: (s) => (s.path.t.length ? areaShares(s).shares.enemyJungle : null),
    getUntil: (s, u) => (s.path.t.length ? areaShares(s, 0, u).shares.enemyJungle : null),
  },
  {
    key: "lanePct",
    fmt: "pct",
    higher: null,
    get: (s) => (s.path.t.length ? areaShares(s).shares.lane : null),
    getUntil: (s, u) => (s.path.t.length ? areaShares(s, 0, u).shares.lane : null),
  },
  {
    key: "nwShare",
    fmt: "pct",
    higher: null,
    get: (s) => s.totals.teamNetWorthShare,
    getUntil: (s, u) => {
      const m = Math.min(s.minutes.netWorth.length - 1, Math.floor(u / 60));
      return s.minutes.teamNetWorth[m] ? s.minutes.netWorth[m] / s.minutes.teamNetWorth[m] : null;
    },
    dir: (s) => (isCore(s) ? true : null),
  },
];

export function fmtMetric(v: number | null, fmt: Fmt) {
  if (v == null) return "–";
  if (fmt === "pct") return pct(v, 1);
  if (fmt === "clock") return clock(Math.round(v));
  if (fmt === "dec") return num(v, 2);
  if (fmt === "signed") return signed(v);
  return num(v);
}

export type Diff = {
  key: string;
  a: number;
  b: number;
  fmt: Fmt;
  score: number;
  better: "a" | "b" | null;
  label?: (t: R) => string;
  // The window compared (seconds from the start), when the metric was taken over the same window.
  until: number | null;
  // Ranked by the gap in percentiles against the references (else by the relative gap).
  byPct: boolean;
  // The gap is smaller than the players' own game-to-game spread on the hero.
  noise: boolean;
};

// The differences that stand out, largest first. Where the metric can be taken over the same
// window, both sides are (the shorter game's length). Where both values have a percentile against
// their references, the gap in percentiles ranks them (how unusual, not how big); else relative for
// counts and rates, in points for shares, in proportion to the slower time for timings. 'Better' only
// where the direction is the same for both sides' roles; a gap inside the players' usual spread is
// marked and ranked lower.
export function biggestDiffs(a: LabSide, b: LabSide, extra: Metric[] = []): Diff[] {
  const out: Diff[] = [];
  const until = Math.min(a.duration, b.duration);
  const sameLength = Math.abs(a.duration - b.duration) / Math.max(a.duration, b.duration) < 0.1;
  for (const m of [...METRICS, ...extra]) {
    if (m.sameHero && a.heroId !== b.heroId) continue;
    const windowed = !sameLength && !!m.getUntil;
    const va = windowed ? m.getUntil!(a, until) : m.get(a);
    const vb = windowed ? m.getUntil!(b, until) : m.get(b);
    if (va == null || vb == null) continue;
    const pa = m.pct?.(a, va);
    const pb = m.pct?.(b, vb);
    const byPct = pa != null && pb != null;
    let score: number;
    if (byPct) score = Math.abs(pa - pb);
    else if (m.fmt === "pct") score = Math.abs(va - vb) / Math.max(0.15, Math.max(va, vb));
    else if (m.fmt === "signed")
      score = Math.abs(va - vb) / Math.max(800, Math.abs(va), Math.abs(vb), Math.abs(va - vb));
    else score = Math.abs(va - vb) / Math.max(1e-6, Math.abs(va), Math.abs(vb), Math.abs(va - vb));
    if (!Number.isFinite(score) || score < 0.12) continue;
    // Tiny absolute values (0.1 deaths a minute against 0.05) say little.
    if (!byPct && m.fmt === "dec" && Math.max(va, vb) < 0.15) continue;
    if (!byPct && m.fmt === "int" && Math.max(Math.abs(va), Math.abs(vb)) < 3) continue;
    const da = m.dir ? m.dir(a) : m.higher;
    const db = m.dir ? m.dir(b) : m.higher;
    const dirSame = da != null && da === db;
    const aBetter = da ? va > vb : va < vb;
    // Windowed values aren't on the same footing as whole-game spreads.
    const spread = windowed ? null : Math.max(m.spread?.(a) ?? 0, m.spread?.(b) ?? 0) || null;
    const noise = spread != null && Math.abs(va - vb) < spread;
    out.push({
      key: m.key,
      a: va,
      b: vb,
      fmt: m.fmt,
      score: noise ? score / 2 : score,
      better: !dirSame || va === vb ? null : aBetter ? "a" : "b",
      label: m.label,
      until: windowed ? until : null,
      byPct,
      noise,
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

// ── One sentence per section ─────────────────────────────────────────────────────────────────

type Names = {
  items: (k: string) => string;
  abilities: (k: string) => string;
  heroes: (id: number) => string;
};

export function timelineInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  if (!b) {
    const pctile = a.benchmarks.gold_per_min;
    return i.timelineSingle(
      a.totals.gpm,
      pctile != null ? pct(1 - pctile) : "–",
      num(a.minutes.netWorth[10]),
      num(a.minutes.netWorth[20]),
    );
  }
  const len = Math.min(a.minutes.netWorth.length, b.minutes.netWorth.length);
  let max = 0;
  let maxAt = 0;
  let leadFrom: number | null = null;
  let leader: "a" | "b" | null = null;
  let swings = 0;
  let close = true;
  for (let m = 1; m < len; m++) {
    const d = a.minutes.netWorth[m] - b.minutes.netWorth[m];
    if (Math.abs(d) > Math.abs(max)) {
      max = d;
      maxAt = m;
    }
    if (Math.abs(d) > 0.1 * Math.max(a.minutes.netWorth[m], b.minutes.netWorth[m])) close = false;
    const now: "a" | "b" | null = d > 0 ? "a" : d < 0 ? "b" : leader;
    if (now !== leader) {
      if (leader) swings++;
      leader = now;
      leadFrom = m;
    }
  }
  if (close) return i.timelineClose;
  const final = a.minutes.netWorth[len - 1] - b.minutes.netWorth[len - 1];
  if (swings <= 1 && leader && leadFrom != null)
    return i.timelineLead(
      leader === "a" ? i.a : i.b,
      clock(leadFrom * 60),
      num(Math.abs(max)),
      clock(maxAt * 60),
    );
  return i.timelineSwing(num(Math.abs(max)), clock(maxAt * 60), num(Math.abs(final)));
}

export function laningInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  const swaps = [a, b]
    .filter(Boolean)
    .map((s, k) => (s!.laning.swaps.length ? i.laneSwap(k ? i.b : i.a, s!.laning.swaps.length) : ""));
  const at10 = (s: LabSide) => (s.laning.at10 ? `${s.laning.at10.lh} / ${s.laning.at10.dn}` : "–");
  if (!a.laning.at10 && !b?.laning.at10) return i.laneNone;
  return [b ? i.lanePair(at10(a), at10(b)) : i.laneSingle(at10(a)), ...swaps].filter(Boolean).join(" ");
}

export function itemsInsight(a: LabSide, b: LabSide | null, assets: LabAssets, t: R, n: Names) {
  const i = t.insight;
  const fa = firstBuys(a, assets);
  if (!b) {
    const list = [...fa.entries()].slice(0, 4).map(([k, at]) => `${n.items(k)} ${clock(at)}`);
    return list.length ? i.itemsSingle(list.join(t.insight.sep)) : i.itemsNoCommon;
  }
  const fb = firstBuys(b, assets);
  const common = [...fa.keys()].filter((k) => fb.has(k));
  if (!common.length) return i.itemsNoCommon;
  const parts = common
    .map((k) => ({ k, d: fa.get(k)! - fb.get(k)! }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
    .slice(0, 2)
    .map(({ k, d }) => i.itemsPair(n.items(k), d < 0 ? i.a : i.b, clock(Math.abs(d))));
  return parts.join(" ");
}

// The ability maxed first (the first to reach its top level among the basic ones).
function firstMaxed(s: LabSide) {
  const levels = new Map<string, number>();
  for (const l of s.skills.learned) {
    if (l.talent) continue;
    levels.set(l.key, (levels.get(l.key) ?? 0) + 1);
    if (levels.get(l.key) === 4) return l.key;
  }
  return null;
}

const topCast = (s: LabSide) => s.skills.uses.find((u) => !MAP_INTERACTIONS.has(u.key));

export function skillsInsight(a: LabSide, b: LabSide | null, t: R, n: Names) {
  const i = t.insight;
  const top = (s: LabSide) => {
    const u = topCast(s);
    return u ? n.abilities(u.key) : "–";
  };
  if (!b) return i.skillsSingle(num(castsPerMin(a), 1), top(a));
  // Casts mean different things on different heroes: each side on its own.
  if (a.heroId !== b.heroId)
    return [
      i.skillsOther(i.a, num(castsPerMin(a), 1), top(a)),
      i.skillsOther(i.b, num(castsPerMin(b), 1), top(b)),
    ].join(" ");
  const parts = [i.skillsPair(num(castsPerMin(a), 1), num(castsPerMin(b), 1))];
  const ma = firstMaxed(a);
  const mb = firstMaxed(b);
  if (a.heroId === b.heroId && ma && mb && ma !== mb)
    parts.push(i.skillsOrder(n.abilities(ma), n.abilities(mb)));
  return parts.join(" ");
}

function deathArea(s: LabSide) {
  const counts = new Map<Area, number>();
  for (const f of s.fights.events)
    if (f.kind === "death" && f.x != null && f.y != null) {
      const area = areaOf(f.x, f.y, s.radiant);
      counts.set(area, (counts.get(area) ?? 0) + 1);
    }
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0] ?? null;
}

export function fightsInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  const zones = t.movement.zoneNames;
  const where = [a, b]
    .map((s, k) => {
      if (!s) return "";
      const d = deathArea(s);
      return d && d[1] >= 2 ? i.deathsWhere(k ? i.b : i.a, zones[d[0]], d[1]) : "";
    })
    .filter(Boolean);
  if (!b)
    return [i.fightsSingle(pct(a.fights.participation), num(kaPerMin(a), 2), a.totals.deaths), ...where].join(
      " ",
    );
  return [
    i.fightsPair(
      pct(a.fights.participation),
      pct(b.fights.participation),
      num(kaPerMin(a), 2),
      num(kaPerMin(b), 2),
    ),
    ...where,
  ].join(" ");
}

const rightClickShare = (s: LabSide) => {
  const total = s.damage.dealtBySource.reduce((x, y) => x + y.value, 0);
  return total ? (s.damage.dealtBySource.find((x) => x.key === "null")?.value ?? 0) / total : null;
};

export function damageInsight(a: LabSide, b: LabSide | null, t: R, n: Names) {
  const i = t.insight;
  if (!b) {
    const top = a.damage.toHeroes[0];
    return i.damageSingle(
      num(a.totals.heroDamage / minutesOf(a)),
      pct(rightClickShare(a)),
      top ? n.heroes(top.hero) : "–",
    );
  }
  return i.damagePair(
    num(a.totals.heroDamage / minutesOf(a)),
    num(b.totals.heroDamage / minutesOf(b)),
    pct(rightClickShare(a)),
    pct(rightClickShare(b)),
  );
}

const visionLine = (s: LabSide, t: R) =>
  t.vision.counts(
    s.vision.wards.filter((w) => w.kind === "obs").length,
    s.vision.wards.filter((w) => w.kind === "sen").length,
    s.vision.dewards.length || s.vision.observerKills + s.vision.sentryKills,
  );

export function visionInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  const total = a.vision.wards.length + (b?.vision.wards.length ?? 0);
  const dew = a.vision.dewards.length + (b?.vision.dewards.length ?? 0);
  if (total + dew <= 1) return i.visionNone;
  return b ? i.visionPair(visionLine(a, t), visionLine(b, t)) : i.visionSingle(visionLine(a, t));
}

function topArea(s: LabSide) {
  const { n, shares } = areaShares(s);
  if (!n) return null;
  return (Object.entries(shares) as [Area, number][]).sort((x, y) => y[1] - x[1])[0];
}

export function movementInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  const zones = t.movement.zoneNames;
  const ta = topArea(a);
  if (!b)
    return ta
      ? i.movementSingle(zones[ta[0]], pct(ta[1]), pct(areaShares(a).shares.enemyJungle))
      : i.movementNone;
  const tb = topArea(b);
  if (ta && tb) return i.movementPair(zones[ta[0]], pct(ta[1]), zones[tb[0]], pct(tb[1]));
  if (!ta && !tb) return i.movementNone;
  // One side without positions (no STRATZ parse): the other side's alone.
  const [who, top, other] = ta ? [i.a, ta, i.b] : [i.b, tb!, i.a];
  return i.movementOne(who, zones[top[0]], pct(top[1]), other);
}

// Pulls are found from STRATZ's last hits: unknown without its parse.
const resourceLine = (s: LabSide, t: R) =>
  t.insight.resourcesLine(
    s.resources.runes.length,
    s.resources.campsStacked,
    s.parsed.stratz ? s.resources.pulls.length : null,
  );

export function resourcesInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  return b ? i.resourcesPair(resourceLine(a, t), resourceLine(b, t)) : i.resourcesSingle(resourceLine(a, t));
}

function goldTop(s: LabSide, t: R) {
  const g = goldShares(s);
  return (Object.entries(g.shares) as [GoldKind, number][])
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([k, v]) => t.insight.farmStyle(t.gold.reasons[k], pct(v)))
    .join(t.insight.sep);
}

export function goldInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  return b ? i.goldPair(goldTop(a, t), goldTop(b, t)) : i.goldSingle(goldTop(a, t));
}

export function miscInsight(a: LabSide, b: LabSide | null, t: R) {
  const i = t.insight;
  const dead = (s: LabSide) =>
    s.totals.deadSeconds != null ? pct(s.totals.deadSeconds / s.duration, 1) : "–";
  return b
    ? i.miscPair(num(a.totals.apm), num(b.totals.apm), dead(a), dead(b))
    : i.miscSingle(num(a.totals.apm), dead(a));
}

// The top summary: the strongest contrasts in how the two played, or what stands out in one game.
export function summary(a: LabSide, b: LabSide | null, assets: LabAssets, t: R, n: Names): string[] {
  const i = t.insight;
  if (!b)
    return [
      timelineInsight(a, null, t),
      laningInsight(a, null, t),
      goldInsight(a, null, t),
      movementInsight(a, null, t),
      fightsInsight(a, null, t),
    ];
  const out: { text: string; w: number }[] = [];
  const who = (d: number) => (d > 0 ? i.a : i.b);

  const ga = goldShares(a).shares;
  const gb = goldShares(b).shares;
  const farmGap =
    Math.abs(ga.neutrals - gb.neutrals) + Math.abs(ga.creeps - gb.creeps) + Math.abs(ga.heroes - gb.heroes);
  out.push({ text: i.summaryFarm(goldTop(a, t), goldTop(b, t)), w: farmGap * 2 });

  const ta = topArea(a);
  const tb = topArea(b);
  if (ta && tb) {
    const sa = areaShares(a).shares;
    const sb = areaShares(b).shares;
    const gap = AREAS.reduce((s, k) => s + Math.abs(sa[k] - sb[k]), 0);
    out.push({
      text: i.summaryMove(
        i.moveStyle(t.movement.zoneNames[ta[0]], pct(ta[1])),
        i.moveStyle(t.movement.zoneNames[tb[0]], pct(tb[1])),
      ),
      w: gap * 1.5,
    });
  }

  const ka = kaPerMin(a) - kaPerMin(b);
  out.push({
    text: i.summaryFight(who(ka), num(Math.abs(ka), 2)),
    w: Math.abs(ka) / Math.max(0.1, kaPerMin(a), kaPerMin(b)),
  });

  const fa = firstBuys(a, assets);
  const fb = firstBuys(b, assets);
  const common = [...fa.keys()].filter((k) => fb.has(k));
  if (common.length) {
    const k = common.sort((x, y) => Math.abs(fb.get(y)! - fa.get(y)!) - Math.abs(fb.get(x)! - fa.get(x)!))[0];
    const d = fb.get(k)! - fa.get(k)!;
    out.push({
      text: i.summaryItem(who(d), n.items(k), clock(Math.abs(d))),
      w: Math.abs(d) / Math.max(300, fa.get(k)!, fb.get(k)!),
    });
  }

  // 'More time dead' only when the dead-time shares say so too.
  const dd = a.totals.deaths / minutesOf(a) - b.totals.deaths / minutesOf(b);
  const deadShare = (s: LabSide) => (s.totals.deadSeconds != null ? s.totals.deadSeconds / s.duration : null);
  const da = deadShare(a);
  const db = deadShare(b);
  const deadToo = da != null && db != null && (dd > 0 ? da > db : da < db);
  out.push({
    text: (deadToo ? i.summaryDeaths : i.summaryDeathsOnly)(who(dd), num(Math.abs(dd), 2)),
    w: (Math.abs(dd) / Math.max(0.05, a.totals.deaths / minutesOf(a), b.totals.deaths / minutesOf(b))) * 0.8,
  });

  const wd = a.vision.wards.length - b.vision.wards.length;
  if (Math.abs(wd) >= 3)
    out.push({
      text: i.summaryVision(who(wd), Math.abs(wd)),
      w: Math.abs(wd) / Math.max(a.vision.wards.length, b.vision.wards.length),
    });

  if (a.heroId === b.heroId) {
    const cd = castsPerMin(a) - castsPerMin(b);
    out.push({
      text: i.summaryCast(who(cd), num(Math.abs(cd), 1)),
      w: (Math.abs(cd) / Math.max(0.5, castsPerMin(a), castsPerMin(b))) * 0.7,
    });
  }

  return out
    .filter((x) => x.w >= 0.15)
    .sort((x, y) => y.w - x.w)
    .slice(0, 5)
    .map((x) => x.text);
}

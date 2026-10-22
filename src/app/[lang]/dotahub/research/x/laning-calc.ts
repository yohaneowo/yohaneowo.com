import type { LabSide } from "@/lib/dota/lab";
import type { LaneResult } from "@/lib/dota/lab-extra";
import type { LabBuilding, LabMatchPlayer } from "@/lib/dota/lab-match";
import type { LaneRecord } from "@/lib/dota/lab-refs";
import { aliveAt } from "../insights";

// The laning module's numbers, pure and cached per side: the lane result the rank's records lead to
// expect, the 10-minute gaps (whole lane, lane counterpart, same position), where the waves met,
// how the lane's creeps were shared, rotations both ways, rune control, and the matchup threats.

export type LaneKey = "top" | "mid" | "bot";

const LANES: LaneKey[] = ["top", "mid", "bot"];
const cache = <T>(f: (s: LabSide) => T) => {
  const memo = new WeakMap<LabSide, T>();
  return (s: LabSide): T => {
    if (!memo.has(s)) memo.set(s, f(s));
    return memo.get(s)!;
  };
};
const sumOf = (list: number[]) => list.reduce((a, b) => a + b, 0);
const medianOf = (list: number[]) => {
  if (!list.length) return null;
  const v = [...list].sort((a, b) => a - b);
  const i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
};
export const homeLane = (s: LabSide): LaneKey | null =>
  s.lane === "top" || s.lane === "mid" || s.lane === "bot" ? s.lane : null;
const playerOf = (s: LabSide, hero: number) => s.match.players.find((p) => p.heroId === hero) ?? null;

// ── Expected lane result ─────────────────────────────────────────────────────────────────────

// A record needs this many lanes to count; fewer are shown but left out.
export const MIN_LANES = 50;
// Expected wins minus losses beyond this is a favoured (or unfavoured) lane.
const EVEN = 0.12;

export type LaneOdds = "favoured" | "even" | "unfavoured";
export type LaneExpect = {
  records: (LaneRecord & { hero: number; with: boolean; used: boolean })[];
  // Shares of lanes won, drawn and lost (stomps counted in), averaged over the usable records.
  win: number;
  draw: number;
  loss: number;
  stompWin: number;
  stompLoss: number;
  used: number;
  // Lanes behind the usable records.
  n: number;
  expected: LaneOdds | null;
  actual: LaneResult | null;
  // The result against the expectation: −2 (far worse) … +2 (far better), when both are known.
  vsExpected: number | null;
  // −1 worse, 0 as expected, 1 better (by category).
  verdict: -1 | 0 | 1 | null;
};

const resultScore = (r: LaneResult) => (r === "win" || r === "stompWin" ? 1 : r === "tie" ? 0 : -1);
const oddsScore = (o: LaneOdds) => (o === "favoured" ? 1 : o === "even" ? 0 : -1);

export const laneExpect = cache((s: LabSide): LaneExpect | null => {
  const bl = s.advanced.baseline;
  if (!bl || !s.laneOpponents.length) return null;
  const records = [
    ...s.laneOpponents.map((hero) => ({ hero, with: false, r: bl.laneVs[String(hero)] })),
    ...s.laneAllies.map((hero) => ({ hero, with: true, r: bl.laneWith[String(hero)] })),
  ]
    .filter((x) => x.r && x.r.n > 0)
    .map((x) => ({ ...x.r, hero: x.hero, with: x.with, used: x.r.n >= MIN_LANES }));
  const usable = records.filter((r) => r.used);
  const avg = (f: (r: LaneRecord) => number) =>
    usable.length ? sumOf(usable.map((r) => f(r) / r.n)) / usable.length : 0;
  const win = avg((r) => r.win + r.stompWin);
  const loss = avg((r) => r.loss + r.stompLoss);
  const expected: LaneOdds | null = usable.length
    ? win - loss >= EVEN
      ? "favoured"
      : win - loss <= -EVEN
        ? "unfavoured"
        : "even"
    : null;
  const actual = s.advanced.context.laneOutcome;
  return {
    records,
    win,
    draw: avg((r) => r.draw),
    loss,
    stompWin: avg((r) => r.stompWin),
    stompLoss: avg((r) => r.stompLoss),
    used: usable.length,
    n: sumOf(usable.map((r) => r.n)),
    expected,
    actual,
    vsExpected: expected && actual ? resultScore(actual) - (win - loss) : null,
    verdict: expected && actual ? (Math.sign(resultScore(actual) - oddsScore(expected)) as -1 | 0 | 1) : null,
  };
});

// ── Lane gaps at 10 minutes ──────────────────────────────────────────────────────────────────

// The enemy who lanes against each position: safe lane against off lane, mid against mid, the
// supports against each other.
const COUNTERPART: Record<number, number> = { 1: 3, 2: 2, 3: 1, 4: 5, 5: 4 };

export type GapRow = { hero: number; position: number | null; inLane: boolean; nw: number; xp: number };
export type LaneGaps = {
  // The minute compared (10, or the last one in a shorter game).
  minute: number;
  me: GapRow;
  ours: GapRow[];
  theirs: GapRow[];
  total: { nw: number; xp: number } | null;
  role: (GapRow & { gapNw: number; gapXp: number }) | null;
  same: (GapRow & { gapNw: number; gapXp: number }) | null;
  // Whether positions are known (STRATZ), which the counterpart and same-position rows need.
  positions: boolean;
};

export const laneGaps = cache((s: LabSide): LaneGaps | null => {
  const me = s.match.players.find((p) => p.slot === s.slot);
  if (!me?.curves.nw.length) return null;
  const minute = Math.min(10, me.curves.nw.length - 1);
  const at = (arr: number[]) => arr[Math.min(minute, arr.length - 1)] ?? 0;
  const row = (p: LabMatchPlayer): GapRow => ({
    hero: p.heroId,
    position: p.position,
    inLane: !!s.lane && p.lane === s.lane,
    nw: at(p.curves.nw),
    xp: at(p.curves.xp),
  });
  const mine = row(me);
  const ours = [
    mine,
    ...s.laneAllies
      .map((h) => playerOf(s, h))
      .filter((p) => !!p)
      .map(row),
  ];
  const theirs = s.laneOpponents
    .map((h) => playerOf(s, h))
    .filter((p) => !!p)
    .map(row);
  const enemyAt = (position: number | null | undefined) => {
    const p = position
      ? s.match.players.find((x) => x.radiant !== s.radiant && x.position === position)
      : undefined;
    if (!p) return null;
    const r = row(p);
    return { ...r, gapNw: mine.nw - r.nw, gapXp: mine.xp - r.xp };
  };
  return {
    minute,
    me: mine,
    ours,
    theirs,
    total: theirs.length
      ? {
          nw: sumOf(ours.map((r) => r.nw)) - sumOf(theirs.map((r) => r.nw)),
          xp: sumOf(ours.map((r) => r.xp)) - sumOf(theirs.map((r) => r.xp)),
        }
      : null,
    role: s.position ? enemyAt(COUNTERPART[s.position]) : null,
    same: enemyAt(s.position),
    positions: !!s.position && s.match.players.some((p) => p.radiant !== s.radiant && p.position != null),
  };
});

// ── The lanes' geometry ──────────────────────────────────────────────────────────────────────

// Each lane as a line from the side's own tier-3 tower to the enemy's, through the tier-1 towers
// (and the corner for the side lanes), in map cells, with the distance along it.
type LaneLine = {
  pts: { x: number; y: number }[];
  // Distance along the line (cells) at each point, and at the towers.
  arcs: number[];
  ownT1: number;
  enemyT1: number;
  ownT2: number;
  enemyT2: number;
};

function laneLine(buildings: LabBuilding[], lane: LaneKey, radiant: boolean): LaneLine | null {
  const tower = (tier: number, radiantSide: boolean) =>
    buildings.find(
      (b) => b.type === "tower" && b.name === `tower${tier}_${lane}` && b.radiant === radiantSide,
    );
  const r1 = tower(1, true);
  const d1 = tower(1, false);
  if (!r1 || !d1) return null;
  const at = (b: LabBuilding | undefined, tag?: string) => (b ? { x: b.x, y: b.y, tag } : null);
  // The side lanes turn a corner: top runs up the west edge then along the north, bot along the
  // south then up the east edge.
  const corner = lane === "top" ? { x: r1.x, y: d1.y } : lane === "bot" ? { x: d1.x, y: r1.y } : null;
  const pts = [
    at(tower(3, radiant)),
    at(tower(2, radiant), "own2"),
    at(radiant ? r1 : d1, "own1"),
    corner,
    at(radiant ? d1 : r1, "enemy1"),
    at(tower(2, !radiant), "enemy2"),
    at(tower(3, !radiant)),
  ].filter((p): p is { x: number; y: number; tag: string | undefined } => !!p);
  const arcs = [0];
  for (let i = 1; i < pts.length; i++)
    arcs.push(arcs[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const arcOf = (tag: string) => {
    const i = pts.findIndex((p) => p.tag === tag);
    return i >= 0 ? arcs[i] : null;
  };
  const ownT1 = arcOf("own1")!;
  const enemyT1 = arcOf("enemy1")!;
  return {
    pts,
    arcs,
    ownT1,
    enemyT1,
    // Without the tier-2 towers, the laning stretch is taken as 15 cells past each tier 1.
    ownT2: arcOf("own2") ?? ownT1 - 15,
    enemyT2: arcOf("enemy2") ?? enemyT1 + 15,
  };
}

// The nearest point on the line: distance along it (cells; past either end it runs on) and how far
// off it the point is.
function project(line: LaneLine, x: number, y: number) {
  let best = { arc: 0, d: Infinity };
  const last = line.pts.length - 2;
  for (let i = 0; i <= last; i++) {
    const a = line.pts[i];
    const b = line.pts[i + 1];
    const len = line.arcs[i + 1] - line.arcs[i];
    if (len <= 0) continue;
    let u = ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (len * len);
    if (i > 0) u = Math.max(0, u);
    if (i < last) u = Math.min(1, u);
    const d = Math.hypot(x - (a.x + u * (b.x - a.x)), y - (a.y + u * (b.y - a.y)));
    if (d < best.d) best = { arc: line.arcs[i] + u * len, d };
  }
  return best;
}

// In a lane: within this many cells (about 1,000 units) of its line, between the two tier-2 towers;
// lane creeps pulled into the jungle die 10–12 cells off it. Kills and deaths count within a wider
// reach, for the fights at the river mouths.
const BAND = 8;
const NEAR = 12;

type Geo = Record<LaneKey, LaneLine | null>;
const geoOf = cache(
  (s: LabSide): Geo =>
    Object.fromEntries(LANES.map((l) => [l, laneLine(s.match.buildings, l, s.radiant)])) as Geo,
);

function inLane(line: LaneLine | null, x: number, y: number, band = BAND) {
  if (!line) return null;
  const p = project(line, x, y);
  return p.d <= band && p.arc >= line.ownT2 - 3 && p.arc <= line.enemyT2 + 3 ? p : null;
}

// The lane a position is in (the nearest lane line within reach), else null.
function laneAt(geo: Geo, x: number, y: number, band = BAND): LaneKey | null {
  let best: { lane: LaneKey; d: number } | null = null;
  for (const l of LANES) {
    const p = inLane(geo[l], x, y, band);
    if (p && (!best || p.d < best.d)) best = { lane: l, d: p.d };
  }
  return best?.lane ?? null;
}

// ── Where the waves met ──────────────────────────────────────────────────────────────────────

// A tower's attack range (700 units) in cells.
const TOWER_RANGE = 700 / 128;
// Standing more than this many cells (about 400 units) past the meeting point is ahead of the wave.
const AHEAD = 3;
export const MIN_WAVE_MINUTES = 4;
// Into a tower: within its range; near a tower: the rest of that side's third of the lane.
export const WAVE_STATES = ["intoOwn", "nearOwn", "middle", "nearEnemy", "intoEnemy"] as const;
export type WaveState = (typeof WAVE_STATES)[number];

export type Equilibrium = {
  lane: LaneKey;
  // Cells between the two tier-1 towers along the lane.
  length: number;
  // By minute (each minute ± 30 s), 1–12: where the waves met (0 = own tier 1, 1 = the enemy's), the
  // hero's average place on the same line, the last hits behind it, and the wave's state.
  minutes: {
    m: number;
    wave: number | null;
    hero: number | null;
    n: number;
    state: WaveState | null;
    ahead: boolean;
  }[];
  wave: number | null;
  hero: number | null;
  counts: Record<WaveState, number>;
  ahead: number;
  hits: number;
  // Per-minute values for the chart (NaN where unknown).
  waveSeries: number[];
  heroSeries: number[];
};

const stateOf = (cells: number, length: number): WaveState =>
  cells <= TOWER_RANGE
    ? "intoOwn"
    : cells >= length - TOWER_RANGE
      ? "intoEnemy"
      : cells < length / 3
        ? "nearOwn"
        : cells <= (2 * length) / 3
          ? "middle"
          : "nearEnemy";

export const equilibrium = cache((s: LabSide): Equilibrium | null => {
  const lane = homeLane(s);
  const line = lane ? geoOf(s)[lane] : null;
  if (!lane || !line || !s.resources.farm.length) return null;
  const length = line.enemyT1 - line.ownT1;
  const frac = (arc: number) => (arc - line.ownT1) / length;
  const hits = s.resources.farm.flatMap((c) => {
    if (c.kind !== 0 || c.x == null || c.y == null || c.t < 0 || c.t >= 750) return [];
    const p = inLane(line, c.x, c.y);
    return p ? [{ t: c.t, p: frac(p.arc) }] : [];
  });
  const places = s.path.t.flatMap((t, i) => {
    if (t < 0 || t >= 750 || !aliveAt(s, i)) return [];
    const p = inLane(line, s.path.x[i], s.path.y[i]);
    return p ? [{ t, p: frac(p.arc) }] : [];
  });
  const minutes: Equilibrium["minutes"] = [];
  for (let m = 1; m <= 12; m++) {
    const inMinute = (t: number) => t >= m * 60 - 30 && t < m * 60 + 30;
    const h = hits.filter((x) => inMinute(x.t)).map((x) => x.p);
    const at = places.filter((x) => inMinute(x.t)).map((x) => x.p);
    // One last hit says little about where the wave was.
    const wave = h.length >= 2 ? medianOf(h) : null;
    const hero = at.length ? sumOf(at) / at.length : null;
    minutes.push({
      m,
      wave,
      hero,
      n: h.length,
      state: wave != null ? stateOf(wave * length, length) : null,
      ahead: wave != null && hero != null && (hero - wave) * length > AHEAD,
    });
  }
  const known = minutes.filter((x) => x.wave != null);
  if (!known.length) return null;
  // The whole lane's reading needs a third of the minutes placed.
  const enough = known.length >= MIN_WAVE_MINUTES;
  const counts = Object.fromEntries(WAVE_STATES.map((k) => [k, 0])) as Record<WaveState, number>;
  for (const x of known) counts[x.state!]++;
  const heroes = minutes.filter((x) => x.hero != null).map((x) => x.hero!);
  const series = (f: (x: Equilibrium["minutes"][number]) => number | null) => {
    const out = [NaN];
    for (const x of minutes) out[x.m] = f(x) ?? NaN;
    return out;
  };
  return {
    lane,
    length,
    minutes,
    wave: enough ? medianOf(known.map((x) => x.wave!)) : null,
    hero: heroes.length ? sumOf(heroes) / heroes.length : null,
    counts,
    ahead: minutes.filter((x) => x.ahead).length,
    hits: known.reduce((a, x) => a + x.n, 0),
    waveSeries: series((x) => x.wave),
    heroSeries: series((x) => x.hero),
  };
});

// ── The lane's creeps ────────────────────────────────────────────────────────────────────────

// The patch the spawn rules below (creep waves, runes) are taken from.
export const RULES_PATCH = "7.41";

// Assumed for 7.41 (not in the replay data): a wave every 30 s from 0:00 on each side of each lane,
// 3 melee (one may be a flagbearer) and 1 ranged, a siege creep with the 5:00 and 10:00 waves, and a
// wave dead about 45 s after it spawns.
export const WAVE = { every: 30, creeps: 4, siegeEvery: 300, dies: 45 };
const reachedBy = (t: number) => {
  let n = 0;
  for (let at = 0; at <= t - WAVE.dies; at += WAVE.every)
    n += WAVE.creeps + (at > 0 && at % WAVE.siegeEvery === 0 ? 1 : 0);
  return n;
};

export type CreepMinute = {
  m: number;
  reached: number;
  // The enemy's creeps: taken by the player, by lane allies, denied by the lane's enemies, the rest.
  you: number;
  ally: number;
  denied: number;
  rest: number;
  // The side's own creeps: last-hit by the lane's enemies, denied by the side, the rest.
  theirs: number;
  ourDenies: number;
  ourRest: number;
};
export type CreepShare = {
  until: number;
  minutes: CreepMinute[];
  total: Omit<CreepMinute, "m">;
  // The player's last hits by then: all, and lane creeps in this lane (STRATZ's places).
  lhAll: number;
  lhLane: number | null;
  allies: number[];
  opponents: number[];
  // By minute, cumulative: the player's share of the enemy creeps that reached the lane, and the
  // side's (the player and lane allies).
  youSeries: number[];
  laneSeries: number[];
};

export const creepShare = cache((s: LabSide): CreepShare | null => {
  const me = s.match.players.find((p) => p.slot === s.slot);
  const lane = homeLane(s);
  if (!me?.curves.lh.length || !lane || !s.laneOpponents.length) return null;
  const allies = s.laneAllies.map((h) => playerOf(s, h)).filter((p) => !!p);
  const opponents = s.laneOpponents.map((h) => playerOf(s, h)).filter((p) => !!p);
  const until = Math.min(10, me.curves.lh.length - 1);
  if (until < 1) return null;
  const line = geoOf(s)[lane];
  // The player's own lane last hits from their places (STRATZ), else all of OpenDota's.
  const laneHits = line
    ? s.resources.farm.filter((c) => c.kind === 0 && c.x != null && c.y != null && inLane(line, c.x, c.y))
    : [];
  const fromPlaces = laneHits.length > 0;
  const at = (arr: number[], m: number) => arr[Math.min(m, arr.length - 1)] ?? 0;
  const step = (arr: number[], m: number) => at(arr, m) - at(arr, m - 1);
  const minutes: CreepMinute[] = [];
  for (let m = 1; m <= until; m++) {
    const reached = reachedBy(m * 60) - reachedBy((m - 1) * 60);
    const you = fromPlaces
      ? laneHits.filter((c) => c.t >= (m - 1) * 60 && c.t < m * 60).length
      : step(me.curves.lh, m);
    const ally = sumOf(allies.map((p) => step(p.curves.lh, m)));
    const denied = sumOf(opponents.map((p) => step(p.curves.dn, m)));
    const theirs = sumOf(opponents.map((p) => step(p.curves.lh, m)));
    const ourDenies = step(me.curves.dn, m) + sumOf(allies.map((p) => step(p.curves.dn, m)));
    minutes.push({
      m,
      reached,
      you,
      ally,
      denied,
      rest: reached - you - ally - denied,
      theirs,
      ourDenies,
      ourRest: reached - theirs - ourDenies,
    });
  }
  const add = (k: keyof Omit<CreepMinute, "m">) => sumOf(minutes.map((x) => x[k]));
  const youSeries = [NaN];
  const laneSeries = [NaN];
  let reached = 0;
  let you = 0;
  let side = 0;
  for (const x of minutes) {
    reached += x.reached;
    you += x.you;
    side += x.you + x.ally;
    youSeries.push(reached ? you / reached : NaN);
    laneSeries.push(reached ? side / reached : NaN);
  }
  return {
    youSeries,
    laneSeries,
    until: until * 60,
    minutes,
    total: {
      reached: add("reached"),
      you: add("you"),
      ally: add("ally"),
      denied: add("denied"),
      rest: add("rest"),
      theirs: add("theirs"),
      ourDenies: add("ourDenies"),
      ourRest: add("ourRest"),
    },
    lhAll: at(me.curves.lh, until),
    lhLane: fromPlaces ? laneHits.filter((c) => c.t < until * 60).length : null,
    allies: allies.map((p) => p.heroId),
    opponents: opponents.map((p) => p.heroId),
  };
});

// ── Rotations ────────────────────────────────────────────────────────────────────────────────

// The laning stretch studied for rotations and runes.
export const EARLY = 900;
// What a rotation led to is looked for this long after arriving.
const PAYOFF = 45;
// Walking to the other lane and back, at most (seconds), counted in the time away.
const TRAVEL = 40;

export type Rotation = {
  // Arrival in the other lane and the last moment there.
  start: number;
  end: number;
  lane: LaneKey;
  tp: boolean;
  kills: number[];
  assists: number[];
  died: boolean;
  outcome: "kill" | "assist" | "nothing";
  killGold: number;
  // Seconds away from the own lane, and the farm gold and XP given up meanwhile (estimates).
  away: number | null;
  gold: number | null;
  xp: number | null;
};
export type EnemyRotation = {
  t: number;
  heroes: number[];
  tp: boolean;
  youThere: boolean;
  ourDeaths: number[];
  theirDeaths: number[];
  youDied: boolean;
};
export type Rotations = {
  home: LaneKey | null;
  mine: Rotation[];
  enemies: EnemyRotation[];
  // Last-hit gold (lane creeps and neutrals) and creep XP a minute in the own lane (what time away
  // costs).
  rate: { gold: number; xp: number } | null;
};

// Runs of at least two samples in a row in one lane other than home; runs with no sample at home
// between them are one trip (without a home lane: runs of the same lane 30 s apart or less). A death
// ends a trip: after the respawn it's another.
function visits(lanes: (LaneKey | null)[], home: LaneKey | null, alive: boolean[]) {
  const runs: { from: number; to: number; lane: LaneKey }[] = [];
  let i = 0;
  while (i < lanes.length) {
    const l = lanes[i];
    if (!l || l === home) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < lanes.length && lanes[j + 1] === l) j++;
    if (j > i) runs.push({ from: i, to: j, lane: l });
    i = j + 1;
  }
  const out: (typeof runs)[number][] = [];
  for (const r of runs) {
    const prev = out[out.length - 1];
    const joined =
      !!prev &&
      !alive.slice(prev.to + 1, r.from).includes(false) &&
      (home
        ? !lanes.slice(prev.to + 1, r.from).includes(home)
        : prev.lane === r.lane && r.from - prev.to <= 3);
    if (!joined) {
      out.push({ ...r });
      continue;
    }
    // The trip's lane is where it spent longest.
    if (r.to - r.from > prev.to - prev.from) prev.lane = r.lane;
    prev.to = r.to;
  }
  return out;
}

export const rotations = cache((s: LabSide): Rotations | null => {
  if (!s.path.t.length || !s.match.buildings.length) return null;
  const geo = geoOf(s);
  const home = homeLane(s);
  const idx = s.path.t.flatMap((t, i) => (t >= 0 && t <= EARLY ? [i] : []));
  const ts = idx.map((i) => s.path.t[i]);
  const alive = idx.map((i) => aliveAt(s, i));
  const lanes = idx.map((i, k) => (alive[k] ? laneAt(geo, s.path.x[i], s.path.y[i]) : null));
  const atHome = lanes.map((l) => !!home && l === home);
  const homeLine = home ? geo[home] : null;
  // Gold of the player's last hits between two seconds (STRATZ, each last hit's own), lane creeps and
  // neutrals alike, as the creep XP counts both; optionally only what was farmed away from the own
  // lane (its lane creeps left out).
  const lhGold = (a: number, b: number, away = false) =>
    sumOf(
      s.resources.farm
        .filter(
          (c) =>
            c.t >= a &&
            c.t < b &&
            !(away && c.kind === 0 && c.x != null && c.y != null && inLane(homeLine, c.x, c.y)),
        )
        .map((c) => c.gold),
    );
  const creepXp = s.advanced.xpByMinute.creeps;

  // The own lane's farm gold and creep XP per minute, over the minutes mostly spent there (1–10).
  let rate: Rotations["rate"] = null;
  if (home) {
    const gold: number[] = [];
    const xp: number[] = [];
    for (let m = 1; m <= 10; m++) {
      const inMinute = ts.map((t, k) => (t >= m * 60 && t < (m + 1) * 60 ? k : -1)).filter((k) => k >= 0);
      if (inMinute.length && inMinute.filter((k) => atHome[k]).length * 2 >= inMinute.length) {
        gold.push(lhGold(m * 60, (m + 1) * 60));
        xp.push(creepXp[m] ?? 0);
      }
    }
    if (gold.some((g) => g > 0) || xp.some((v) => v > 0))
      rate = { gold: sumOf(gold) / gold.length, xp: sumOf(xp) / xp.length };
  }
  // Creep XP made between two seconds: XP is only known per minute, so each minute's in proportion.
  const xpIn = (a: number, b: number) => {
    let sum = 0;
    for (let m = Math.max(0, Math.floor(a / 60)); m * 60 < b && m < creepXp.length; m++)
      sum += ((creepXp[m] ?? 0) * Math.max(0, Math.min(b, (m + 1) * 60) - Math.max(a, m * 60))) / 60;
    return sum;
  };

  const tps = s.items.useTimes
    .filter((u) => u.key === "tpscroll" || u.key.startsWith("travel_boots"))
    .flatMap((u) => u.times)
    .filter((t) => t >= 0 && t <= EARLY);
  // Kills, assists and deaths in a window, away from the own lane (when the place is known).
  const evIn = (kind: "kill" | "assist" | "death", a: number, b: number) =>
    s.fights.events.filter(
      (e) =>
        e.kind === kind &&
        e.t >= a &&
        e.t <= b &&
        (e.x == null || e.y == null || !inLane(homeLine, e.x, e.y, NEAR)),
    );
  const mine: Rotation[] = visits(lanes, home, alive).map((v) => {
    let start = ts[v.from];
    const end = ts[v.to];
    // Came by teleport: a TP shortly before the first sample there.
    const tp = tps.find((t) => t <= start && start - t <= 16);
    if (tp != null) start = Math.min(start, tp + 4);
    // Away: from the last sample at home (or the respawn) before the trip to the first one at home
    // (or the death) after it, with at most TRAVEL seconds of walking either side.
    let span: [number, number] | null = null;
    if (home) {
      let left = v.from;
      while (left > 0 && alive[left - 1] && !atHome[left - 1]) left--;
      let back = v.to;
      while (back < lanes.length - 1 && alive[back + 1] && !atHome[back + 1]) back++;
      const leftAt = left > 0 ? Math.max(ts[left - 1], start - TRAVEL) : start;
      const backAt =
        back < lanes.length - 1 ? Math.min(ts[back + 1], end + TRAVEL) : Math.min(EARLY, end + TRAVEL);
      span = [leftAt, Math.max(leftAt, backAt)];
    }
    // What the own lane would have given meanwhile, less the farm made while away.
    const minutesAway = span ? (span[1] - span[0]) / 60 : 0;
    const kills = evIn("kill", start - 10, start + PAYOFF);
    const assists = evIn("assist", start - 10, start + PAYOFF);
    const died = evIn("death", start - 10, Math.max(start + PAYOFF, end + 10)).length > 0;
    return {
      start,
      end,
      lane: v.lane,
      tp: tp != null,
      kills: kills.map((e) => e.hero ?? 0),
      assists: assists.map((e) => e.hero ?? 0),
      died,
      outcome: kills.length ? "kill" : assists.length ? "assist" : "nothing",
      killGold: sumOf(kills.map((e) => e.gold ?? 0)),
      away: span ? span[1] - span[0] : null,
      gold: rate && span ? Math.max(0, rate.gold * minutesAway - lhGold(span[0], span[1], true)) : null,
      xp: rate && span ? Math.max(0, rate.xp * minutesAway - xpIn(span[0], span[1])) : null,
    };
  });

  // Enemies who weren't in the lane coming into it (positions every 10 s, from the replay).
  const enemies: EnemyRotation[] = [];
  const line = home ? geo[home] : null;
  if (line && s.match.grid.t.length) {
    const g = s.match.grid;
    const gi = g.t.flatMap((t, i) => (t >= 0 && t <= EARLY ? [i] : []));
    const arrivals: { t: number; hero: number; slot: number }[] = [];
    for (const p of s.match.players) {
      if (p.radiant === s.radiant || s.laneOpponents.includes(p.heroId)) continue;
      const pos = g.pos[String(p.slot)];
      if (!pos?.x.length) continue;
      const deaths = s.match.deaths.filter((d) => d.slot === p.slot).map((d) => d.t);
      // While dead the position stays where they fell.
      let fell: { x: number; y: number } | null = null;
      const there = gi.map((i) => {
        const t = g.t[i];
        const x = pos.x[i];
        const y = pos.y[i];
        if (deaths.some((d) => d <= t && t - d < 10)) fell = { x, y };
        if (fell && Math.hypot(x - fell.x, y - fell.y) <= 1.5) return false;
        fell = null;
        return !!inLane(line, x, y);
      });
      // An arrival: two samples in a row there, after 30 s away (a step out and back is the same visit).
      for (let k = 0; k + 1 < there.length; k++)
        if (there[k] && there[k + 1] && !there.slice(Math.max(0, k - 3), k).some(Boolean))
          arrivals.push({ t: g.t[gi[k]], hero: p.heroId, slot: p.slot });
    }
    arrivals.sort((a, b) => a.t - b.t);
    // A jump of 30 cells or more in 10 s: a teleport or a long blink.
    const enemyTps = (slot: number, t: number) => {
      const pos = g.pos[String(slot)];
      const i = g.t.indexOf(t);
      return i > 0 && Math.hypot(pos.x[i] - pos.x[i - 1], pos.y[i] - pos.y[i - 1]) >= 30;
    };
    for (const a of arrivals) {
      const last = enemies[enemies.length - 1];
      if (last && a.t - last.t <= 20) {
        if (!last.heroes.includes(a.hero)) last.heroes.push(a.hero);
        last.tp ||= enemyTps(a.slot, a.t);
        continue;
      }
      // There at the arrival's sample or the one before (they came within those 10 s; a death in
      // between would otherwise read as not there).
      const i = s.path.t.findIndex((t) => t >= a.t);
      const there = (j: number) => j >= 0 && aliveAt(s, j) && !!inLane(line, s.path.x[j], s.path.y[j]);
      enemies.push({
        t: a.t,
        heroes: [a.hero],
        tp: enemyTps(a.slot, a.t),
        youThere: i >= 0 && (there(i) || there(i - 1)),
        ourDeaths: [],
        theirDeaths: [],
        youDied: false,
      });
    }
    // What followed in the lane (deaths there, or with the visitors credited), each death once.
    const counted = new Set<LabSide["match"]["deaths"][number]>();
    for (const e of enemies) {
      const soon = s.match.deaths.filter((d) => d.t >= e.t - 5 && d.t <= e.t + PAYOFF && !counted.has(d));
      for (const d of soon) {
        const here =
          d.x != null && d.y != null
            ? !!inLane(line, d.x, d.y, NEAR)
            : e.heroes.some((h) => d.involved.includes(h));
        if (!here) continue;
        counted.add(d);
        const ours = s.match.players.find((p) => p.slot === d.slot)?.radiant === s.radiant;
        (ours ? e.ourDeaths : e.theirDeaths).push(d.hero);
        if (d.slot === s.slot) e.youDied = true;
      }
    }
  }
  return { home, mine, enemies, rate };
});

// ── Runes ────────────────────────────────────────────────────────────────────────────────────

export const RUNE_KINDS = ["power", "bounty", "water", "wisdom"] as const;
export type RuneKind = (typeof RUNE_KINDS)[number];
export const runeKind = (rune: string): RuneKind =>
  rune === "BOUNTY" ? "bounty" : rune === "WATER" ? "water" : rune === "WISDOM" ? "wisdom" : "power";
// Picked within this many seconds of the spawn counts as on time.
export const ON_TIME = 15;

// Spawns assumed for 7.41 (they fit the pickups in 7.41 games; not in the replay data): bounty runes
// at 0:00 and every 4 minutes, water runes at 2:00 and 4:00, a power rune every 2 minutes from 6:00,
// wisdom runes every 7 minutes.
export function lastSpawn(kind: RuneKind, t: number): number | null {
  if (t < 0) return null;
  if (kind === "bounty") return Math.floor(t / 240) * 240;
  if (kind === "water") return t >= 240 ? 240 : t >= 120 ? 120 : null;
  if (kind === "power") return t >= 360 ? Math.floor(t / 120) * 120 : null;
  return t >= 420 ? Math.floor(t / 420) * 420 : null;
}

export type RunePick = {
  t: number;
  slot: number;
  hero: number;
  ours: boolean;
  rune: string;
  kind: RuneKind;
  delay: number | null;
};
export type RuneControl = {
  picks: RunePick[];
  kinds: Record<
    RuneKind,
    { ours: number; theirs: number; mine: number; oursOnTime: number; theirsOnTime: number }
  >;
  share: number | null;
  // Power runes, with the taker's kills in the 60 s after.
  power: (RunePick & { kills: number[]; involved: number })[];
};

export const runeControl = cache((s: LabSide): RuneControl | null => {
  const picks: RunePick[] = s.match.players
    .flatMap((p) =>
      p.runes
        .filter((r) => r.t <= EARLY)
        .map((r) => {
          const kind = runeKind(r.rune);
          const spawn = lastSpawn(kind, r.t);
          return {
            t: r.t,
            slot: p.slot,
            hero: p.heroId,
            ours: p.radiant === s.radiant,
            rune: r.rune,
            kind,
            delay: spawn != null ? r.t - spawn : null,
          };
        }),
    )
    .sort((a, b) => a.t - b.t);
  if (!picks.length) return null;
  const kinds = Object.fromEntries(
    RUNE_KINDS.map((k) => {
      const list = picks.filter((p) => p.kind === k);
      const onTime = (x: RunePick) => x.delay != null && x.delay <= ON_TIME;
      return [
        k,
        {
          ours: list.filter((p) => p.ours).length,
          theirs: list.filter((p) => !p.ours).length,
          mine: list.filter((p) => p.slot === s.slot).length,
          oursOnTime: list.filter((p) => p.ours && onTime(p)).length,
          theirsOnTime: list.filter((p) => !p.ours && onTime(p)).length,
        },
      ];
    }),
  ) as RuneControl["kinds"];
  const power = picks
    .filter((p) => p.kind === "power")
    .map((p) => {
      const after = s.match.deaths.filter((d) => d.t > p.t && d.t <= p.t + 60);
      return {
        ...p,
        kills: after.filter((d) => d.killer === p.hero).map((d) => d.hero),
        involved: after.filter((d) => d.involved.includes(p.hero)).length,
      };
    });
  return { picks, kinds, share: picks.filter((p) => p.ours).length / picks.length, power };
});

// ── Matchup threats ──────────────────────────────────────────────────────────────────────────

// A matchup record needs this many games to count.
export const MIN_GAMES = 50;
// An advantage (STRATZ's synergy, in win-rate points) of this size or more is a counter.
export const COUNTER = 1.5;

export type ThreatRow = {
  hero: number;
  lane: boolean;
  n: number;
  winRate: number | null;
  synergy: number | null;
  taken: number;
  takenShare: number | null;
  dealt: number;
  dealtShare: number | null;
  kills: number;
  involved: number;
};
export type Threat = {
  rows: ThreatRow[];
  // Mean advantage over the enemies with enough games.
  avg: number | null;
  used: number;
  // Share of the player's hero damage that went to heroes they counter, and how many there were.
  counteredDealt: number | null;
  countered: number;
  // Share of the damage taken that came from heroes who counter them.
  countersTaken: number | null;
  counters: number;
  // The worst matchup with enough games.
  worst: ThreatRow | null;
};

export const threat = cache((s: LabSide): Threat | null => {
  const vs = s.advanced.baseline?.matchUp.vs;
  if (!vs || !s.enemies.length) return null;
  const takenTotal = sumOf(s.damage.fromHeroes.filter((x) => s.enemies.includes(x.hero)).map((x) => x.value));
  const dealtTotal = sumOf(s.damage.toHeroes.filter((x) => s.enemies.includes(x.hero)).map((x) => x.value));
  const deaths = s.fights.events.filter((e) => e.kind === "death");
  const rows: ThreatRow[] = s.enemies.map((hero) => {
    const r = vs[String(hero)];
    const taken = s.damage.fromHeroes.find((x) => x.hero === hero)?.value ?? 0;
    const dealt = s.damage.toHeroes.find((x) => x.hero === hero)?.value ?? 0;
    return {
      hero,
      lane: s.laneOpponents.includes(hero),
      n: r?.n ?? 0,
      winRate: r?.n ? r.w / r.n : null,
      synergy: r?.n ? r.synergy : null,
      taken,
      takenShare: takenTotal ? taken / takenTotal : null,
      dealt,
      dealtShare: dealtTotal ? dealt / dealtTotal : null,
      kills: deaths.filter((e) => e.hero === hero).length,
      involved: deaths.filter((e) => e.hero === hero || e.enemies.includes(hero)).length,
    };
  });
  rows.sort((a, b) => (a.synergy ?? 0) - (b.synergy ?? 0));
  const used = rows.filter((r) => r.n >= MIN_GAMES && r.synergy != null);
  const countered = used.filter((r) => r.synergy! >= COUNTER);
  const counters = used.filter((r) => r.synergy! <= -COUNTER);
  return {
    rows,
    avg: used.length ? sumOf(used.map((r) => r.synergy!)) / used.length : null,
    used: used.length,
    counteredDealt: countered.length && dealtTotal ? sumOf(countered.map((r) => r.dealt)) / dealtTotal : null,
    countered: countered.length,
    countersTaken: counters.length && takenTotal ? sumOf(counters.map((r) => r.taken)) / takenTotal : null,
    counters: counters.length,
    worst: used[0] ?? null,
  };
});

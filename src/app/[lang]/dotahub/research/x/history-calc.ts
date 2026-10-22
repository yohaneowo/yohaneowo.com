import type { LabSide } from "@/lib/dota/lab";
import type { Dist, LabVsHero } from "@/lib/dota/lab-refs";
import { percentileOf, quantile } from "./util";

// The numbers behind the history blocks: this game against the player's own games and pro games on
// the hero, the history against each enemy hero, the game's shape from the gold lead, the draft's
// grades, pauses and disconnects, parties, and how alike A and B are. Pure, for the blocks and the
// sentences alike.

// A distribution with fewer games gives no percentile (median and range only).
export const MIN_N = 5;
// getPersonal sums STRATZ's per-minute last hits over minutes 0–9, which is the last hits at 10:00
// (OpenDota's lh_t[10]), so this game is read at the same minute.
export const PERSONAL_LH_MINUTE = 10;

export type RowFmt = "int" | "dec" | "pct" | "clock";
export type RefRow = {
  key: string;
  value: number | null;
  d: Dist;
  // Which way is better for this side's role (null: neither).
  better: boolean | null;
  fmt: RowFmt;
  // A whole-game total, so it grows with the game's length.
  total?: boolean;
  // From STRATZ's parsed games (a smaller sample than OpenDota's).
  parsed?: boolean;
  // Pro games: the medians in wins and in losses.
  win?: number;
  loss?: number;
};

// Last hits and denies are a core's job, stacks a support's; with no position, neither.
const forCores = (s: LabSide) => (s.position == null ? null : s.position <= 3 ? true : null);
const forSupports = (s: LabSide) => (s.position == null ? null : s.position >= 4 ? true : null);
// Farm is a support's measure only loosely (as GPM in the difference table).
const forNonSupports = (s: LabSide) => (s.position != null && s.position >= 4 ? null : true);
const minuteOf = (arr: number[], m: number) => (m < arr.length && Number.isFinite(arr[m]) ? arr[m] : null);

type Draft = Omit<RefRow, "d"> & { d: Dist | null | undefined };
const keep = (rows: Draft[]) => rows.filter((r): r is RefRow => !!r.d?.n);

// This game against the player's latest games on the hero (OpenDota, this game left out) and their
// STRATZ-parsed ones (net worth and last hits early on).
export function personalRows(s: LabSide): RefRow[] {
  const p = s.refs.personal;
  if (!p) return [];
  const o = p.od;
  const t = s.totals;
  return keep([
    { key: "gpm", value: t.gpm, d: o.gpm, better: forNonSupports(s), fmt: "int" },
    { key: "xpm", value: t.xpm, d: o.xpm, better: true, fmt: "int" },
    {
      key: "lhpm",
      value: t.lastHits / Math.max(1, s.duration / 60),
      d: o.lhpm,
      better: forCores(s),
      fmt: "dec",
    },
    {
      key: "nw10",
      value: minuteOf(s.minutes.netWorth, 10),
      d: p.parsed.nw10,
      better: true,
      fmt: "int",
      parsed: true,
    },
    {
      key: "lhEarly",
      value: minuteOf(s.minutes.lh, PERSONAL_LH_MINUTE),
      d: p.parsed.lh10,
      better: forCores(s),
      fmt: "int",
      parsed: true,
    },
    { key: "lh", value: t.lastHits, d: o.lh, better: forCores(s), fmt: "int", total: true },
    { key: "dn", value: t.denies, d: o.dn, better: forCores(s), fmt: "int", total: true },
    { key: "kills", value: t.kills, d: o.kills, better: true, fmt: "int", total: true },
    { key: "deaths", value: t.deaths, d: o.deaths, better: false, fmt: "int", total: true },
    { key: "assists", value: t.assists, d: o.assists, better: true, fmt: "int", total: true },
    { key: "heroDamage", value: t.heroDamage, d: o.heroDamage, better: true, fmt: "int", total: true },
    { key: "towerDamage", value: t.towerDamage, d: o.towerDamage, better: true, fmt: "int", total: true },
    { key: "duration", value: s.duration, d: o.duration, better: null, fmt: "clock" },
  ]);
}

// This game against pro games on the hero in the match's patch (OpenDota's parsed league games, this
// game left out). Teamfight participation is a fraction; stuns are seconds, as OpenDota counts both
// for this game too.
export function proRows(s: LabSide): RefRow[] {
  const pro = s.refs.pro;
  if (!pro) return [];
  const m = pro.metrics;
  const t = s.totals;
  const rows: Draft[] = [
    { key: "lh10", value: minuteOf(s.minutes.lh, 10), d: m.lh10, better: forCores(s), fmt: "int" },
    { key: "dn10", value: minuteOf(s.minutes.dn, 10), d: m.dn10, better: forCores(s), fmt: "int" },
    { key: "g10", value: minuteOf(s.minutes.gold, 10), d: m.g10, better: forNonSupports(s), fmt: "int" },
    { key: "xp10", value: minuteOf(s.minutes.xp, 10), d: m.xp10, better: true, fmt: "int" },
    { key: "tp", value: s.fights.participation, d: m.tp, better: true, fmt: "pct" },
    {
      key: "stacks",
      value: s.resources.campsStacked,
      d: m.stacks,
      better: forSupports(s),
      fmt: "int",
      total: true,
    },
    { key: "stuns", value: t.stuns, d: m.stuns, better: true, fmt: "dec", total: true },
    { key: "gpm", value: t.gpm, d: m.gpm, better: forNonSupports(s), fmt: "int" },
    { key: "xpm", value: t.xpm, d: m.xpm, better: true, fmt: "int" },
    { key: "kills", value: t.kills, d: m.kills, better: true, fmt: "int", total: true },
    { key: "deaths", value: t.deaths, d: m.deaths, better: false, fmt: "int", total: true },
    { key: "assists", value: t.assists, d: m.assists, better: true, fmt: "int", total: true },
    { key: "hd", value: t.heroDamage, d: m.hd, better: true, fmt: "int", total: true },
    { key: "td", value: t.towerDamage, d: m.td, better: true, fmt: "int", total: true },
    { key: "lh", value: t.lastHits, d: m.lh, better: forCores(s), fmt: "int", total: true },
    { key: "duration", value: s.duration, d: m.duration, better: null, fmt: "clock" },
  ];
  return keep(rows.map((r) => ({ ...r, win: pro.winMedian[r.key], loss: pro.lossMedian[r.key] })));
}

export type RowStats = {
  pct: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
};

export function rowStats(r: RefRow): RowStats {
  return {
    pct: r.d.n >= MIN_N ? percentileOf(r.d, r.value) : null,
    median: quantile(r.d, 0.5),
    p10: quantile(r.d, 0.1),
    p90: quantile(r.d, 0.9),
  };
}

// Whether the value sits on the good side of the median for the role (null: no direction).
export function tone(r: RefRow, st: RowStats): "good" | "bad" | null {
  if (r.better == null || st.pct == null || Math.abs(st.pct - 0.5) < 0.15) return null;
  return st.pct > 0.5 === r.better ? "good" : "bad";
}

// This game's percentile among the player's own games on the hero, for a personal metric.
export function ownPercentile(s: LabSide, key: "gpm" | "xpm" | "lhpm"): { pct: number; n: number } | null {
  const row = personalRows(s).find((r) => r.key === key);
  if (!row || row.d.n < MIN_N) return null;
  const pct = percentileOf(row.d, row.value);
  return pct == null ? null : { pct, n: row.d.n };
}

// Per-minute rates rise with the game's length (levels, bounties, late items), so a rate at an
// extreme of the reference games (the player's own, or the pros') says less when the length sits at
// the same extreme: the length's percentile then, else null.
const LENGTH_EXTREME = 0.4;
export function lengthExplains(
  s: LabSide,
  pct: number,
  pro: boolean,
): { longer: boolean; pct: number } | null {
  const row = (pro ? proRows(s) : personalRows(s)).find((r) => r.key === "duration");
  if (!row || row.d.n < MIN_N) return null;
  const p = percentileOf(row.d, row.value);
  if (p == null || Math.abs(p - 0.5) < LENGTH_EXTREME || p > 0.5 !== pct > 0.5) return null;
  return { longer: p > 0.5, pct: p };
}

export function proPercentile(s: LabSide, key: string): { pct: number; n: number; value: number } | null {
  const row = proRows(s).find((r) => r.key === key);
  if (!row || row.value == null || row.d.n < MIN_N) return null;
  const pct = percentileOf(row.d, row.value);
  return pct == null ? null : { pct, n: row.d.n, value: row.value };
}

// The pro metric that stands out most (cores: early last hits and GPM; supports: XPM, as farm isn't
// their measure), for the sentences.
export function proStandout(s: LabSide) {
  const keys = forCores(s)
    ? ["lh10", "xp10", "gpm", "tp"]
    : forSupports(s)
      ? ["xp10", "xpm", "tp"]
      : ["xp10", "gpm", "tp"];
  return (
    keys
      .map((k) => ({ key: k, r: proPercentile(s, k) }))
      .filter((x): x is { key: string; r: NonNullable<ReturnType<typeof proPercentile>> } => !!x.r)
      .sort((x, y) => Math.abs(y.r.pct - 0.5) - Math.abs(x.r.pct - 0.5))[0] ?? null
  );
}

// ── Against one enemy hero ───────────────────────────────────────────────────────────────────

// OpenDota's list of the player's games against a hero includes this game: it's taken out of the
// count and the averages. When the record can't contain it (a win with no win listed, say), the list
// is already the other games and is kept as is.
export function vsOthers(v: LabVsHero, s: LabSide): LabVsHero {
  const has = s.win ? v.wins >= 1 : v.n - v.wins >= 1;
  if (!has) return v;
  const n = v.n - 1;
  const minus = (avg: number | null, x: number) => (avg == null || n < 1 ? null : (avg * v.n - x) / n);
  return {
    hero: v.hero,
    n,
    wins: v.wins - (s.win ? 1 : 0),
    gpm: minus(v.gpm, s.totals.gpm),
    lh: minus(v.lh, s.totals.lastHits),
    deaths: minus(v.deaths, s.totals.deaths),
  };
}

// ── The game's shape ─────────────────────────────────────────────────────────────────────────

export type ShapeKind = "stomp" | "stomped" | "comeback" | "throw" | "contested" | "close";
export type GameShape = {
  kind: ShapeKind;
  // The side's team's biggest lead and biggest deficit (gold, the deficit as a positive number; 0 or
  // less: never), with the minute.
  lead: number;
  leadAt: number | null;
  deficit: number;
  deficitAt: number | null;
  // How often the lead changed hands (a team at least SWAP ahead), and the share of minutes ahead.
  changes: number | null;
  ahead: number | null;
  final: number | null;
  // OpenDota's gold advantage, STRATZ's net worth lead, or only OpenDota's throw / loss.
  source: "od" | "stratz" | "shape";
};

const SWAP = 1000;
// The losing team led by this much: a comeback (or a throw). Never led by more than STOMP_LOSER while
// the winner got STOMP_WINNER ahead: a stomp. The winner never more than CLOSE ahead: close.
const COMEBACK = 5000;
const STOMP_LOSER = 1500;
const STOMP_WINNER = 10000;
const CLOSE = 8000;

function shapeKind(win: boolean, lead: number, deficit: number): ShapeKind {
  const loserBest = win ? deficit : lead;
  const winnerBest = win ? lead : deficit;
  if (loserBest >= COMEBACK) return win ? "comeback" : "throw";
  if (loserBest < STOMP_LOSER && winnerBest >= STOMP_WINNER) return win ? "stomp" : "stomped";
  if (winnerBest < CLOSE) return "close";
  return "contested";
}

export function gameShape(s: LabSide): GameShape | null {
  const od = s.match.radiantGoldAdv;
  const curve = od.length ? od.map((v) => (s.radiant ? v : -v)) : s.advanced.context.nwLead;
  if (curve.length < 3) {
    // OpenDota's throw is the losing team's biggest lead, its loss the losing team's biggest deficit.
    const { throwGold, lossGold } = s.match.shape;
    if (throwGold == null || lossGold == null) return null;
    const lead = s.win ? lossGold : throwGold;
    const deficit = s.win ? throwGold : lossGold;
    return {
      kind: shapeKind(s.win, lead, deficit),
      lead,
      leadAt: null,
      deficit,
      deficitAt: null,
      changes: null,
      ahead: null,
      final: null,
      source: "shape",
    };
  }
  let lead = -Infinity;
  let leadAt = 0;
  let deficit = -Infinity;
  let deficitAt = 0;
  let leader = 0;
  let changes = 0;
  let ahead = 0;
  curve.forEach((v, m) => {
    if (v > lead) {
      lead = v;
      leadAt = m;
    }
    if (-v > deficit) {
      deficit = -v;
      deficitAt = m;
    }
    if (m > 0 && v > 0) ahead++;
    const now = v >= SWAP ? 1 : v <= -SWAP ? -1 : leader;
    if (now !== leader) {
      if (leader !== 0) changes++;
      leader = now;
    }
  });
  return {
    kind: shapeKind(s.win, lead, deficit),
    lead,
    leadAt,
    deficit,
    deficitAt,
    changes,
    ahead: ahead / (curve.length - 1),
    final: curve[curve.length - 1],
    source: od.length ? "od" : "stratz",
  };
}

// One-sided games against games where both teams had a say.
export const oneSided = (k: ShapeKind) => k === "stomp" || k === "stomped";

// ── The draft ────────────────────────────────────────────────────────────────────────────────

// STRATZ's grade of each pick: the hero's win rate (base) and the one adjusted for the draft so far,
// in percent. The side's team's and the enemy's total change.
export function draftGrades(s: LabSide) {
  const rows = s.match.draft
    .filter((d) => d.pick && d.base != null && d.adjusted != null)
    .map((d) => ({
      hero: d.hero,
      ours: d.radiant === s.radiant,
      order: d.order,
      base: d.base!,
      adjusted: d.adjusted!,
      delta: d.adjusted! - d.base!,
    }))
    .sort((a, b) => a.order - b.order);
  if (!rows.length) return null;
  const total = (ours: boolean) => rows.filter((r) => r.ours === ours).reduce((a, r) => a + r.delta, 0);
  // The grade most unchanged picks share (a default rather than a grade, it seems).
  const flat = new Map<number, number>();
  for (const r of rows) if (!r.delta) flat.set(r.base, (flat.get(r.base) ?? 0) + 1);
  const common = [...flat.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  return {
    rows,
    ours: total(true),
    theirs: total(false),
    unchanged: rows.filter((r) => !r.delta).length,
    common,
  };
}

// STRATZ's draft-only win chance by minute, for the side's team (it's given for Radiant).
export function draftCurve(s: LabSide): number[] | null {
  const p = s.match.predictedWin;
  return p.length ? p.map((v) => (s.radiant ? v : 1 - v)) : null;
}

// Where the draft-only chance starts and ends, and the minute it reaches 50% from the side it
// started on (null: it never does).
export function draftReading(curve: number[]) {
  const start = curve[0];
  const end = curve[curve.length - 1];
  const i =
    start < 0.5 ? curve.findIndex((v) => v >= 0.5) : start > 0.5 ? curve.findIndex((v) => v <= 0.5) : 0;
  return { start, end, even: i < 0 ? null : i };
}

// ── Pauses, disconnects, leavers ─────────────────────────────────────────────────────────────

// A pause stops the game clock, so it sits at one moment; pre-game moments are never in a window.
export const inWindow = (t: number, from: number, to: number) => t >= 0 && t >= from && t <= to;

// Each player's disconnects with the reconnect that ended them (null: none came).
export function disconnectSpans(s: LabSide) {
  const bySlot = new Map<number, { t: number; event: string }[]>();
  for (const d of [...s.match.disconnects].sort((a, b) => a.t - b.t))
    bySlot.set(d.slot, [...(bySlot.get(d.slot) ?? []), { t: d.t, event: d.event }]);
  const out: { slot: number; t: number; event: string; back: number | null }[] = [];
  for (const [slot, list] of bySlot)
    list.forEach((e, i) => {
      if (e.event === "reconnect" && list[i - 1]?.event === "disconnect") return;
      const next = e.event === "disconnect" ? list.slice(i + 1).find((x) => x.event === "reconnect") : null;
      out.push({ slot, t: e.t, event: e.event, back: next ? next.t : null });
    });
  return out.sort((a, b) => a.t - b.t);
}

// ── Players ──────────────────────────────────────────────────────────────────────────────────

// Parties of two or more by STRATZ's party id, numbered in slot order (a party of one is none).
export function parties(s: LabSide): Map<number, number> {
  const groups = new Map<number, number[]>();
  for (const p of s.match.players)
    if (p.party != null) groups.set(p.party, [...(groups.get(p.party) ?? []), p.slot]);
  const out = new Map<number, number>();
  let n = 0;
  for (const slots of groups.values()) {
    if (slots.length < 2) continue;
    n++;
    for (const slot of slots) out.set(slot, n);
  }
  return out;
}

// How many played together with the studied player (1: alone; null: STRATZ has no parties).
export function partySize(s: LabSide): number | null {
  if (!s.match.players.some((p) => p.party != null)) return null;
  const me = s.match.players.find((p) => p.slot === s.slot);
  if (me?.party == null) return 1;
  return s.match.players.filter((p) => p.party === me.party).length;
}

export const me = (s: LabSide) => s.match.players.find((p) => p.slot === s.slot) ?? null;

// Enemies STRATZ flags as possible smurfs (null: no flags known).
export function smurfEnemies(s: LabSide): number | null {
  const foes = s.match.players.filter((p) => p.radiant !== s.radiant);
  if (!foes.some((p) => p.smurf != null)) return null;
  return foes.filter((p) => (p.smurf ?? 0) > 0).length;
}

// Games and wins on the hero (OpenDota, this game included); wins is null when OpenDota's hero
// record was missing (then the count is only the latest games listed, this one left out).
export function heroRecord(s: LabSide) {
  const p = s.refs.personal;
  if (!p) return null;
  const listed = p.od.gpm?.n ?? 0;
  const winsKnown = p.wins > 0 || p.games > listed;
  return { games: p.games, wins: winsKnown ? p.wins : null };
}

// This game's lane as OpenDota's lane role (1 safe, 2 mid, 3 off, 4 jungle): Radiant's safe lane is
// the bottom one, Dire's the top one; roaming has no role.
export function laneRole(s: LabSide): string | null {
  if (s.lane === "mid") return "2";
  if (s.lane === "jungle") return "4";
  if (s.lane === "bot") return s.radiant ? "1" : "3";
  if (s.lane === "top") return s.radiant ? "3" : "1";
  return null;
}

// ── How alike A and B are ────────────────────────────────────────────────────────────────────

export type CompareKey =
  | "match"
  | "hero"
  | "position"
  | "patch"
  | "mode"
  | "lobby"
  | "side"
  | "result"
  | "rank"
  | "duration"
  | "shape"
  | "experience"
  | "party"
  | "smurfs";

// 0: fine or only to know, 1: read with care, 2: changes what the numbers mean.
export type CompareRow = { key: CompareKey; same: boolean | null; level: 0 | 1 | 2 };

const RANK_GAP = 2;
const LENGTH_RATIO = 1.5;
const EXPERIENCE_RATIO = 4;
// Turbo (doubled gold and XP) and Ability Draft play by other rules; other modes differ in the draft.
const OTHER_RULES = new Set([18, 23]);

export function comparability(a: LabSide, b: LabSide): CompareRow[] {
  const sameMatch = a.matchId === b.matchId;
  const known = <T>(x: T | null | undefined, y: T | null | undefined) => x != null && y != null;
  const medal = (r: number | null | undefined) => (r ? Math.floor(r / 10) : null);
  const ra = medal(a.rank);
  const rb = medal(b.rank);
  const sa = gameShape(a);
  const sb = gameShape(b);
  const ea = heroRecord(a)?.games;
  const eb = heroRecord(b)?.games;
  const pa = partySize(a);
  const pb = partySize(b);
  const fa = smurfEnemies(a);
  const fb = smurfEnemies(b);
  const ratio = Math.max(a.duration, b.duration) / Math.max(1, Math.min(a.duration, b.duration));
  const rows: CompareRow[] = [
    { key: "match", same: sameMatch, level: 0 },
    { key: "hero", same: a.heroId === b.heroId, level: a.heroId === b.heroId ? 0 : 2 },
    {
      key: "position",
      same: known(a.position, b.position) ? a.position === b.position : null,
      level: known(a.position, b.position) && a.position !== b.position ? 2 : 0,
    },
    {
      key: "patch",
      same: known(a.patch, b.patch) ? a.patch!.id === b.patch!.id : null,
      level: known(a.patch, b.patch) && a.patch!.id !== b.patch!.id ? 1 : 0,
    },
    {
      key: "mode",
      same: a.gameMode === b.gameMode,
      level:
        a.gameMode === b.gameMode ? 0 : OTHER_RULES.has(a.gameMode) || OTHER_RULES.has(b.gameMode) ? 2 : 1,
    },
    { key: "lobby", same: a.lobbyType === b.lobbyType, level: a.lobbyType === b.lobbyType ? 0 : 1 },
    { key: "side", same: a.radiant === b.radiant, level: 0 },
    { key: "result", same: a.win === b.win, level: 0 },
    {
      key: "rank",
      same: known(ra, rb) ? ra === rb : null,
      level: known(ra, rb) && Math.abs(ra! - rb!) >= RANK_GAP ? 1 : 0,
    },
    { key: "duration", same: ratio < 1.1, level: ratio >= LENGTH_RATIO ? 1 : 0 },
    {
      key: "shape",
      same: sa && sb ? sa.kind === sb.kind : null,
      level: sa && sb && oneSided(sa.kind) !== oneSided(sb.kind) ? 1 : 0,
    },
    {
      key: "experience",
      same: known(ea, eb) ? Math.max(ea!, eb!) / Math.max(1, Math.min(ea!, eb!)) < 1.5 : null,
      level:
        known(ea, eb) && Math.max(ea!, eb!) / Math.max(1, Math.min(ea!, eb!)) >= EXPERIENCE_RATIO ? 1 : 0,
    },
    { key: "party", same: known(pa, pb) ? pa! > 1 === pb! > 1 : null, level: 0 },
    {
      key: "smurfs",
      same: known(fa, fb) ? fa === fb : null,
      level: (fa ?? 0) > 0 || (fb ?? 0) > 0 ? 1 : 0,
    },
  ];
  // In one match the game's context is shared: only the players differ.
  return sameMatch
    ? rows.filter((r) => !["patch", "mode", "lobby", "duration", "shape", "rank"].includes(r.key))
    : rows;
}

// The one-line reading: the first thing that changes what the numbers mean, then the rest of them
// and the cautions.
export function verdict(rows: CompareRow[]) {
  const major = rows.filter((r) => r.level === 2).map((r) => r.key);
  const caution = rows.filter((r) => r.level === 1).map((r) => r.key);
  const sameMatch = rows.find((r) => r.key === "match")?.same === true;
  const kind: "mode" | "hero" | "position" | "caution" | "fine" = major.includes("mode")
    ? "mode"
    : major.includes("hero")
      ? "hero"
      : major.includes("position")
        ? "position"
        : caution.length
          ? "caution"
          : "fine";
  return { kind, sameMatch, caution: [...major.filter((k) => k !== kind), ...caution] };
}

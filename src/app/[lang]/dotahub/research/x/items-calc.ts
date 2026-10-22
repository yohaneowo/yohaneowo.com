import type { LabAssets, LabSide } from "@/lib/dota/lab";
import type { ItemMeta } from "@/lib/dota/lab-consts";
import type { LabInventory } from "@/lib/dota/lab-extra";
import type { LabBaseline } from "@/lib/dota/lab-refs";
import { isKeyItem } from "../insights";
import { NEUTRAL_POOL, NEUTRAL_TIER } from "./items-neutrals";
import { at } from "./util";

// The items module's numbers, pure: the build against the rank's and the pros' games, starting
// items and boots, carrying a TP, the threats faced and the items that answer them, power spikes
// on both teams and what followed the player's own, and neutral items against the pros'.

// ── Shared ───────────────────────────────────────────────────────────────────────────────────

export const BOOTS = [
  "power_treads",
  "phase_boots",
  "arcane_boots",
  "tranquil_boots",
  "travel_boots",
  "travel_boots_2",
  "guardian_greaves",
  "boots_of_bearing",
  "boots",
];
const BOOT_SET = new Set(BOOTS);
// Bought for the map or the moment, not the build.
const NOT_BUILD = new Set([
  "tpscroll",
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "dust",
  "smoke_of_deceit",
  "aegis",
  "cheese",
  "refresher_shard",
]);

export function firstPurchases(s: LabSide) {
  const out = new Map<string, number>();
  for (const p of s.items.purchases) {
    const was = out.get(p.key);
    if (was == null || p.t < was) out.set(p.key, p.t);
  }
  return out;
}

// Items built into another item bought within five minutes (Yasha into Manta): parts, not choices.
// A Blink upgraded half an hour later still counts as its own spike.
export function builtInto(list: { key: string; t: number }[], assets: LabAssets, within = 300) {
  const out = new Set<string>();
  for (const x of list)
    if (
      list.some(
        (y) =>
          y.key !== x.key &&
          y.t >= x.t &&
          y.t - x.t <= within &&
          (assets.itemMeta[y.key]?.components ?? []).includes(x.key),
      )
    )
      out.add(x.key);
  return out;
}

// OpenDota's item popularity phases: before the horn, the first 10 minutes, 10–25, after 25.
export type Phase = "start" | "early" | "mid" | "late";
export const phaseOf = (t: number): Phase =>
  t <= 0 ? "start" : t < 600 ? "early" : t < 1500 ? "mid" : "late";

// Seconds dead (respawn times), to leave out of time-based shares.
function deadSpans(s: LabSide) {
  return s.fights.events
    .filter((f) => f.kind === "death" && f.timeDead)
    .map((f) => [f.t, f.t + (f.timeDead ?? 0)] as const);
}

// ── The build against the field ──────────────────────────────────────────────────────────────

// Shares of games: bought by most (staple), by few (rare); pros: bought in the same phase in a
// quarter of their games (common), in under 5% (off-meta).
export const STAPLE = 0.6;
export const RARE = 0.12;
export const PRO_COMMON = 0.25;
export const PRO_RARE = 0.05;
// STRATZ leaves out the purchase minutes with few buys, so an item bought at scattered times keeps
// only a row or two and its share reads far too low ('thin': not called rare).
const THIN_ROWS = 3;

export type ChoiceRow = {
  key: string;
  t: number;
  phase: Phase;
  // The rank's games that bought it and their win rate (null: not listed, or no rank table).
  rank: { rate: number; win: number | null } | null;
  rankTag: "staple" | "common" | "rare" | "thin" | "unlisted" | null;
  // Pro games on the patch that bought it (n null: fewer than 5) and those whose first came in the
  // same phase; null when there are no pro games or the item isn't one they're counted for.
  pro: { n: number | null; phase: number | null; of: number } | null;
  // By the pro games that bought it in the same phase; 'otherPhase': a quarter of them buy it, mostly
  // in another phase (`usual`).
  proTag: "common" | "uncommon" | "offMeta" | "otherPhase" | null;
  usual: Phase | null;
};

export type SkippedRow = {
  key: string;
  rate: number | null;
  win: number | null;
  pro: number | null;
  of: number | null;
  // The game ended before the item's usual time.
  late: boolean;
};

// The phase most of the given first purchases fall in.
function usualPhase(times: number[]) {
  const counts = new Map<Phase, number>();
  for (const v of times) counts.set(phaseOf(v), (counts.get(phaseOf(v)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function itemChoices(s: LabSide, assets: LabAssets) {
  const bl = s.advanced.baseline;
  const pro = s.refs.pro;
  const firsts = firstPurchases(s);
  const list = [...firsts.entries()].map(([key, t]) => ({ key, t })).sort((a, b) => a.t - b.t);
  const built = builtInto(list, assets);
  const rows: ChoiceRow[] = [];
  for (const { key, t } of list) {
    const info = assets.items[key];
    const meta = assets.itemMeta[key];
    if (
      !info ||
      info.consumable ||
      meta?.consumable ||
      key.startsWith("recipe_") ||
      NOT_BUILD.has(key) ||
      BOOT_SET.has(key) ||
      built.has(key)
    )
      continue;
    const r = bl?.items[key];
    // Off the rank's table only a finished item of some cost says anything.
    if (!r && !((meta?.components.length ?? 0) > 0 && info.cost >= 1000)) continue;
    const phase = phaseOf(t);
    const d = pro?.items[key];
    const counted = isKeyItem(key, assets);
    const inPhase = d ? d.sorted.filter((v) => phaseOf(v) === phase).length : 0;
    const usual = d ? usualPhase(d.sorted) : null;
    const proTag: ChoiceRow["proTag"] = !pro
      ? null
      : d
        ? inPhase / pro.n >= PRO_COMMON
          ? "common"
          : d.n / pro.n >= PRO_COMMON && usual !== phase
            ? "otherPhase"
            : inPhase / pro.n >= PRO_RARE
              ? "uncommon"
              : "offMeta"
        : counted
          ? "offMeta"
          : null;
    rows.push({
      key,
      t,
      phase,
      rank: r ? { rate: r.rate, win: r.winRate } : null,
      rankTag: !bl
        ? null
        : !r
          ? "unlisted"
          : r.rate >= STAPLE
            ? "staple"
            : r.rate >= RARE
              ? "common"
              : r.curve.length < THIN_ROWS
                ? "thin"
                : "rare",
      pro: !pro
        ? null
        : d
          ? { n: d.n, phase: inPhase, of: pro.n }
          : counted
            ? { n: null, phase: null, of: pro.n }
            : null,
      proTag,
      usual: proTag === "otherPhase" ? usual : null,
    });
  }

  // What most of the rank's (or the pros') games buy and this one didn't.
  const skip = (key: string) =>
    firsts.has(key) || BOOT_SET.has(key) || NOT_BUILD.has(key) || !!assets.items[key]?.consumable;
  const skipped: SkippedRow[] = [];
  if (bl)
    for (const [key, r] of Object.entries(bl.items))
      if (r.rate >= STAPLE && !skip(key))
        skipped.push({
          key,
          rate: r.rate,
          win: r.winRate,
          pro: pro?.items[key]?.n ?? null,
          of: pro?.n ?? null,
          late: s.duration < r.time,
        });
  if (pro)
    for (const [key, d] of Object.entries(pro.items))
      if (d.n / pro.n >= STAPLE && !skip(key) && !skipped.some((x) => x.key === key))
        skipped.push({
          key,
          rate: bl?.items[key]?.rate ?? null,
          win: bl?.items[key]?.winRate ?? null,
          pro: d.n,
          of: pro.n,
          late: s.duration < d.sorted[Math.floor((d.n - 1) / 2)],
        });
  const share = (x: SkippedRow) => x.rate ?? (x.pro != null && x.of ? x.pro / x.of : 0);
  skipped.sort((a, b) => share(b) - share(a));
  return { rows, skipped };
}

// ── Starting items and boots ─────────────────────────────────────────────────────────────────

export type StartRow = {
  key: string;
  count: number;
  // Share of the rank's games that bought one at the start (null: not in the rank's list, which
  // leaves out rare buys).
  rate: number | null;
};

export function startingItems(s: LabSide) {
  const bl = s.advanced.baseline;
  const m = bl?.matches ?? 0;
  const listed = !!bl?.starting.length && m > 0;
  const counts = new Map<string, number>();
  for (const p of s.items.purchases) if (p.t <= 0) counts.set(p.key, (counts.get(p.key) ?? 0) + 1);
  // STRATZ has a row per copy and per bought / given; the biggest bought row is the first copy (the
  // rows don't say which copy they are, so further copies aren't compared).
  const bought = (key: string) =>
    Math.max(0, ...(bl?.starting ?? []).filter((r) => r.key === key && !r.given).map((r) => r.n));
  const mine: StartRow[] = [...counts.entries()].map(([key, count]) => {
    const n = bought(key);
    return { key, count, rate: listed && n ? n / m : null };
  });
  const firsts = firstPurchases(s);
  const skipped = listed
    ? [...new Set((bl?.starting ?? []).filter((r) => !r.given).map((r) => r.key))]
        .filter((key) => !counts.has(key))
        .map((key) => ({ key, rate: bought(key) / m, later: firsts.get(key) ?? null }))
        .filter((x) => x.rate >= 0.5)
        .sort((a, b) => b.rate - a.rate)
    : [];
  return { mine, skipped, listed };
}

// The rank's average game length in minutes: the share of games still going, summed over the minutes.
export function avgMinutes(bl: LabBaseline | null) {
  const c = bl?.counts;
  if (!c?.length || !c[0]) return null;
  let sum = 0.5;
  for (let m = 1; m < c.length; m++) sum += c[m] / c[0];
  return sum;
}

export type BootRow = {
  key: string;
  t: number;
  uses: number;
  usesPm: number | null;
  rank: { share: number; time: number; win: number | null; act: number; actPm: number | null } | null;
};

// Uses a minute are taken the same way on both sides, from the purchase to the end of the game (the
// rank's: from its average purchase to its average game's end), whether or not the boots were kept.
export function bootsTable(s: LabSide) {
  const bl = s.advanced.baseline;
  const m = bl?.matches ?? 0;
  const avg = avgMinutes(bl);
  const firsts = firstPurchases(s);
  const rankOf = (key: string): BootRow["rank"] => {
    const r = bl?.boots.find((b) => b.key === key);
    if (!r || !m) return null;
    const held = avg != null ? avg - r.time / 60 : null;
    return {
      share: r.n / m,
      time: r.time,
      win: r.n ? r.w / r.n : null,
      act: r.activations,
      actPm: r.activations > 0 && held != null && held > 1 ? r.activations / held : null,
    };
  };
  // Plain boots only when they were never upgraded.
  let keys = BOOTS.filter((k) => k !== "boots" && firsts.has(k));
  if (!keys.length && firsts.has("boots")) keys = ["boots"];
  const mine: BootRow[] = keys
    .map((key) => {
      const t = firsts.get(key)!;
      const uses = s.items.uses.find((u) => u.key === key)?.count ?? 0;
      const span = s.duration - Math.max(0, t);
      return { key, t, uses, usesPm: uses && span >= 60 ? uses / (span / 60) : null, rank: rankOf(key) };
    })
    .sort((a, b) => a.t - b.t);
  const common = m
    ? (bl?.boots ?? [])
        .filter((b) => b.key !== "boots")
        .slice(0, 3)
        .map((b) => ({ key: b.key, share: b.n / m, time: b.time }))
    : [];
  return { mine, common, avg };
}

// ── Carrying a TP ────────────────────────────────────────────────────────────────────────────

export type TpCheck = { t: number; has: boolean | null };

// After laning (10:00) within [from, to]: the runs without a TP scroll (Boots of Travel count as
// one), alive seconds only, and whether one was on hand at each death (5 s before, a TP tried while
// dying spends the charge), each teamfight joined, and each own tower lost (30 s before it fell).
export function tpCarry(s: LabSide, from = -Infinity, to = Infinity) {
  const inv = s.advanced.inventory;
  if (!inv.length) return null;
  const lo = Math.max(600, from);
  const hi = Math.min(s.duration, to);
  const has = (e: LabInventory) =>
    e.tp != null || e.items.some((k) => k === "travel_boots" || k === "travel_boots_2");
  const hasAt = (t: number) => {
    let last: LabInventory | null = null;
    for (const e of inv) {
      if (e.t > t) break;
      last = e;
    }
    return last ? has(last) : null;
  };
  const dead = deadSpans(s);
  const deadAt = (t: number) => dead.some(([a, b]) => t > a && t <= b);
  const alive = (a: number, b: number) =>
    Math.max(0, b - a - dead.reduce((sum, [x, y]) => sum + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0));
  const gaps: { from: number; to: number; alive: number }[] = [];
  inv.forEach((e, i) => {
    const a = Math.max(lo, e.t);
    const b = Math.min(hi, inv[i + 1]?.t ?? s.duration);
    if (has(e) || b <= a) return;
    const last = gaps[gaps.length - 1];
    if (last && last.to === a) {
      last.to = b;
      last.alive += alive(a, b);
    } else gaps.push({ from: a, to: b, alive: alive(a, b) });
  });
  const real = gaps.filter((g) => g.alive > 0);
  const longest = real.reduce<(typeof real)[number] | null>(
    (m, g) => (!m || g.alive > m.alive ? g : m),
    null,
  );
  const inside = (t: number) => t >= lo && t <= hi;
  const own = s.radiant ? "goodguys" : "badguys";
  return {
    lo,
    hi,
    alive: hi > lo ? alive(lo, hi) : 0,
    total: real.reduce((sum, g) => sum + g.alive, 0),
    longest,
    gaps: real,
    deaths: s.fights.events
      .filter((f) => f.kind === "death" && inside(f.t))
      .map((f): TpCheck => ({ t: f.t, has: hasAt(f.t - 5) })),
    fights: s.fights.teamfights
      .filter((f) => f.joined && inside(f.start))
      .map((f): TpCheck => ({ t: f.start, has: hasAt(f.start) })),
    towers: s.match.objectives
      .filter(
        (o) => o.type === "building" && !!o.key?.includes(own) && o.key.includes("tower") && inside(o.t),
      )
      .map((o) => ({ t: o.t, key: o.key ?? "", has: hasAt(o.t - 30), dead: deadAt(o.t - 30) })),
  };
}

// ── Threats and the items that answer them (rules, an estimate) ─────────────────────────────

export type ThreatKind =
  "magic" | "physical" | "control" | "evasion" | "invis" | "heal" | "passives" | "illusions";
export const THREATS: ThreatKind[] = [
  "magic",
  "physical",
  "control",
  "evasion",
  "invis",
  "heal",
  "passives",
  "illusions",
];

const COUNTERS: Record<ThreatKind, string[]> = {
  magic: ["black_king_bar", "pipe", "eternal_shroud", "glimmer_cape", "sphere", "lotus_orb"],
  physical: [
    "ghost",
    "force_staff",
    "heavens_halberd",
    "shivas_guard",
    "crimson_guard",
    "blade_mail",
    "solar_crest",
    "butterfly",
    "assault",
  ],
  control: ["black_king_bar", "sphere", "lotus_orb", "manta", "cyclone", "aeon_disk"],
  evasion: ["monkey_king_bar", "bloodthorn"],
  invis: ["dust", "ward_sentry", "gem"],
  heal: ["spirit_vessel", "skadi", "shivas_guard"],
  passives: ["silver_edge"],
  illusions: ["mjollnir", "gungir", "radiance", "shivas_guard", "bfury"],
};
// Anyone can carry these; the others count only when the hero buys them at all (the player, the
// rank's games, the pros or the player's own history), so a carry isn't told to buy Glimmer Cape.
export const ANYONE = new Set(["dust", "ward_sentry", "gem"]);
// Riki, Clinkz, Bounty Hunter, Weaver, Nyx Assassin, Mirana, Templar Assassin.
const INVIS_HEROES = new Set([32, 56, 62, 63, 88, 9, 46]);
const INVIS_ITEMS = ["invis_sword", "silver_edge", "glimmer_cape"];
// Phantom Assassin, Windranger, Brewmaster.
const EVASION_HEROES = new Set([44, 21, 78]);
const EVASION_ITEMS = ["butterfly", "heavens_halberd"];
// Bristleback, Phantom Assassin, Spectre, Huskar, Medusa, Ursa, Viper, Slark, Mars.
const PASSIVE_HEROES = new Set([99, 44, 67, 59, 94, 70, 47, 93, 129]);
// Phantom Lancer, Naga Siren, Terrorblade, Chaos Knight, Meepo.
const ILLUSION_HEROES = new Set([12, 89, 109, 81, 82]);
const ILLUSION_ITEMS = ["manta"];
// Thresholds: share of the hero damage taken, stun and disable seconds a minute, healing a minute.
const MAGIC_SHARE = 0.45;
const RIGHT_CLICK_SHARE = 0.5;
const CONTROL_PER_MIN = 1.5;
const HEAL_PER_MIN = 100;

// The hero damage taken by kind: STRATZ's events carry the type; OpenDota's sources only tell
// right-clicks ("null") from the rest (magical and pure are then null).
export function damageTaken(
  s: LabSide,
): { total: number; rightClick: number; magical: number | null; pure: number | null } | null {
  const ins = s.advanced.damage.filter((d) => !d.out);
  if (ins.length) {
    const by = [0, 0, 0, 0];
    for (const d of ins) by[d.type] += d.v;
    const total = by[0] + by[1] + by[2] + by[3];
    return total ? { total, rightClick: by[0] / total, magical: by[2] / total, pure: by[3] / total } : null;
  }
  const total = s.damage.receivedBySource.reduce((sum, x) => sum + x.value, 0);
  if (!total) return null;
  const rc = s.damage.receivedBySource.find((x) => x.key === "null")?.value ?? 0;
  return { total, rightClick: rc / total, magical: null, pure: null };
}

export type Threat = {
  kind: ThreatKind;
  // The share, or seconds or healing a minute, behind it (null for the list-based ones).
  value: number | null;
  // The enemy heroes behind it, with the item and when it came (null: the hero itself).
  from: { hero: number; key: string | null; t: number | null; perMin?: number }[];
  counters: { key: string; t: number | null; rate: number | null }[];
};

export function threats(s: LabSide): Threat[] {
  const bl = s.advanced.baseline;
  const pro = s.refs.pro;
  const firsts = firstPurchases(s);
  const minutes = Math.max(1, s.duration / 60);
  const foes = s.match.players.filter((p) => p.radiant !== s.radiant);
  const relevant = (key: string) =>
    firsts.has(key) ||
    ANYONE.has(key) ||
    !!bl?.items[key] ||
    !!pro?.items[key] ||
    !!s.refs.personal?.parsed.items[key];
  const counters = (kind: ThreatKind) =>
    COUNTERS[kind]
      .filter(relevant)
      .map((key) => ({ key, t: firsts.get(key) ?? null, rate: bl?.items[key]?.rate ?? null }));
  const byHeroOrItem = (heroes: Set<number>, items: string[]) =>
    foes.flatMap((p) => {
      const got = p.keyItems
        .filter((k) => items.includes(k.key))
        .map((k) => ({ hero: p.heroId, key: k.key, t: k.t }));
      return heroes.has(p.heroId) ? [{ hero: p.heroId, key: null, t: null }, ...got] : got;
    });
  // A threat the hero has no usual answer to (evasion for a support) is left out.
  const out: Threat[] = [];
  const add = (kind: ThreatKind, value: number | null, from: Threat["from"]) => {
    const list = counters(kind);
    if (list.length) out.push({ kind, value, from, counters: list });
  };

  const dmg = damageTaken(s);
  if (dmg?.magical != null && dmg.magical >= MAGIC_SHARE) add("magic", dmg.magical, []);
  if (dmg && dmg.rightClick >= RIGHT_CLICK_SHARE) add("physical", dmg.rightClick, []);
  const rec = s.advanced.report?.received;
  // STRATZ keeps durations in hundredths of a second.
  const control = rec ? ((rec.stunDuration ?? 0) + (rec.disableDuration ?? 0)) / 100 / minutes : null;
  if (control != null && control >= CONTROL_PER_MIN) add("control", control, []);
  const evasion = byHeroOrItem(EVASION_HEROES, EVASION_ITEMS);
  if (evasion.length) add("evasion", null, evasion);
  const invis = byHeroOrItem(INVIS_HEROES, INVIS_ITEMS);
  if (invis.length) add("invis", null, invis);
  const healers = foes
    .filter((p) => p.healing / minutes >= HEAL_PER_MIN)
    .map((p) => ({ hero: p.heroId, key: null, t: null, perMin: p.healing / minutes }));
  if (healers.length) add("heal", null, healers);
  const passives = byHeroOrItem(PASSIVE_HEROES, []);
  if (passives.length) add("passives", null, passives);
  const illusions = byHeroOrItem(ILLUSION_HEROES, ILLUSION_ITEMS);
  if (illusions.length) add("illusions", null, illusions);
  return out;
}

// ── Power spikes ─────────────────────────────────────────────────────────────────────────────

export const SPIKE_ITEMS = new Set([
  "black_king_bar",
  "blink",
  "overwhelming_blink",
  "swift_blink",
  "arcane_blink",
  "ultimate_scepter",
]);
const BLINKS = new Set(["blink", "overwhelming_blink", "swift_blink", "arcane_blink"]);
// What came of a key item: the next four minutes.
export const SPIKE_WINDOW = 240;
// An enemy core's BKB or Blink 'just before' a fight: within two minutes.
export const ENEMY_SPIKE_WINDOW = 120;

// Every hero's key items (the parts built into another within minutes left out) and level 6: the
// player first, then the teammates, then the enemies.
export function spikeRows(s: LabSide, assets: LabAssets) {
  const order = (p: { slot: number; radiant: boolean }) =>
    p.slot === s.slot ? 0 : p.radiant === s.radiant ? 1 : 2;
  return [...s.match.players]
    .sort((a, b) => order(a) - order(b) || a.slot - b.slot)
    .map((p) => {
      const built = builtInto(p.keyItems, assets);
      return {
        slot: p.slot,
        hero: p.heroId,
        ours: p.radiant === s.radiant,
        me: p.slot === s.slot,
        items: p.keyItems.filter((k) => !built.has(k.key)),
        level6: p.level6,
      };
    });
}

export type ObjectiveKind = "tower" | "rax" | "fort" | "roshan" | "tormentor" | "other";

// In the four minutes after each of the player's key items (bought within [from, to]): the
// teamfights (joined of all), kills and assists, what the team took, and the player's damage to
// buildings (STRATZ's hits, else OpenDota's per-minute curve between the two moments).
export function spikeUse(s: LabSide, assets: LabAssets, from = -Infinity, to = Infinity) {
  const me = spikeRows(s, assets).find((r) => r.me);
  const enemy = s.radiant ? "badguys" : "goodguys";
  const kindOf = (type: string, key: string | null): ObjectiveKind =>
    type === "roshan"
      ? "roshan"
      : type === "tormentor"
        ? "tormentor"
        : key?.includes("tower")
          ? "tower"
          : key?.includes("rax")
            ? "rax"
            : key?.includes("fort")
              ? "fort"
              : "other";
  return (me?.items ?? [])
    .filter((k) => k.t >= from && k.t <= to)
    .map(({ key, t }) => {
      const end = Math.min(s.duration, t + SPIKE_WINDOW);
      const inside = (x: number) => x > t && x <= end;
      const fights = s.fights.teamfights.filter((f) => inside(f.start));
      const objectives = s.match.objectives
        .filter(
          (o) =>
            inside(o.t) &&
            ((o.type === "building" && !!o.key?.includes(enemy)) ||
              ((o.type === "roshan" || o.type === "tormentor") && o.radiant === s.radiant)),
        )
        .map((o) => kindOf(o.type, o.key));
      const hits = s.advanced.towerHits;
      const towerDamage = hits.length
        ? hits.filter((h) => inside(h.t)).reduce((sum, h) => sum + h.v, 0)
        : s.minutes.towerDamage.length
          ? Math.max(0, (at(s.minutes.towerDamage, end) ?? 0) - (at(s.minutes.towerDamage, t) ?? 0))
          : null;
      return {
        key,
        t,
        // Shorter than the window when the game ended first.
        span: end - t,
        fights: fights.length,
        joined: fights.filter((f) => f.joined).length,
        kills: s.fights.events.filter((e) => e.kind === "kill" && inside(e.t)).length,
        assists: s.fights.events.filter((e) => e.kind === "assist" && inside(e.t)).length,
        objectives,
        towerDamage,
      };
    });
}

// Teamfights (starting within [from, to]) that came right after an enemy core's BKB or Blink, with
// the BKBs each side had bought by then. Cores: STRATZ's positions 1–3, else the three richest.
export function fightsAfterEnemySpike(s: LabSide, from = -Infinity, to = Infinity) {
  const foes = s.match.players.filter((p) => p.radiant !== s.radiant);
  const cores = foes.some((p) => p.position != null)
    ? foes.filter((p) => p.position != null && p.position <= 3)
    : [...foes].sort((a, b) => b.netWorth - a.netWorth).slice(0, 3);
  const spikes = cores.flatMap((p) =>
    p.keyItems
      .filter((k) => k.key === "black_king_bar" || BLINKS.has(k.key))
      .map((k) => ({ hero: p.heroId, key: k.key, t: k.t })),
  );
  const bkbs = (radiant: boolean, t: number) =>
    s.match.players.filter(
      (p) => p.radiant === radiant && p.keyItems.some((k) => k.key === "black_king_bar" && k.t < t),
    ).length;
  return s.fights.teamfights.flatMap((f, i) => {
    if (f.start < from || f.start > to) return [];
    const hits = spikes
      .filter((x) => f.start >= x.t && f.start - x.t <= ENEMY_SPIKE_WINDOW)
      .map((x) => ({ ...x, before: f.start - x.t }));
    if (!hits.length) return [];
    return [
      {
        i,
        start: f.start,
        joined: f.joined,
        died: f.died,
        teamDeaths: f.teamDeaths,
        enemyDeaths: f.enemyDeaths,
        spikes: hits,
        bkb: [bkbs(s.radiant, f.start), bkbs(!s.radiant, f.start)] as [number, number],
      },
    ];
  });
}

// ── Neutral items ────────────────────────────────────────────────────────────────────────────

// The pros' counts are keyed by item id (or by key, should the data name them).
function neutralKey(k: string, assets: LabAssets) {
  if (assets.items[k]) return k;
  const key = NEUTRAL_POOL[Number(k)]?.[0];
  return key && assets.items[key] ? key : null;
}

// A neutral item's tier: the constants' when they carry it, else the 7.41 pool's.
const tierOf = (assets: LabAssets, key: string) =>
  (assets.itemMeta[key] as (ItemMeta & { tier?: number | null }) | undefined)?.tier ??
  NEUTRAL_TIER.get(key) ??
  null;

// The neutral items the player held, in the order picked up, against the pros' games on the hero
// that ended holding each, among those that ended holding one of the same tier (with the tier's
// most common); null without the pros' counts.
export function neutralMeta(s: LabSide, assets: LabAssets) {
  const pro = s.refs.pro;
  if (!pro) return null;
  const counts = new Map<string, number>();
  for (const [k, n] of Object.entries(pro.neutrals)) {
    const key = neutralKey(k, assets);
    if (key) counts.set(key, (counts.get(key) ?? 0) + n);
  }
  if (!counts.size) return null;
  const tiers = new Map<number, { n: number; top: { key: string; n: number } | null }>();
  for (const [key, n] of counts) {
    const tier = tierOf(assets, key);
    if (tier == null) continue;
    const row = tiers.get(tier) ?? { n: 0, top: null };
    row.n += n;
    if (!row.top || n > row.top.n) row.top = { key, n };
    tiers.set(tier, row);
  }
  const held: { key: string; t: number | null }[] = s.items.neutralHistory
    .filter((x, i, list) => list.findIndex((y) => y.key === x.key) === i)
    .map((x) => ({ key: x.key, t: x.t }));
  const last = s.items.neutral;
  if (last && !held.some((x) => x.key === last)) held.push({ key: last, t: null });
  const rows = held.map(({ key, t }) => {
    const tier = tierOf(assets, key);
    const same = tier != null ? tiers.get(tier) : undefined;
    return {
      key,
      t,
      tier,
      n: counts.get(key) ?? 0,
      ofTier: same?.n ?? null,
      // The tier's most common, when it's another item (a tie counts as this one).
      top: same?.top && same.top.n > (counts.get(key) ?? 0) ? same.top : null,
      final: key === last,
    };
  });
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, n]) => ({ key, n, tier: tierOf(assets, key) }));
  return { rows, top, of: pro.n };
}

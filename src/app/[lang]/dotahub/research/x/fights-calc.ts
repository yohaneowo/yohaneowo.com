import type { LabAssets, LabSide } from "@/lib/dota/lab";
import type { Activity, LabDamage, LabHeal, LabInventory } from "@/lib/dota/lab-extra";
import { mapZone } from "@/lib/dota/map";
import { PHASES } from "../advanced";
import { at, CELL, mean, sum } from "./util";

// The fights module's numbers: each teamfight's result for the team and the player's part in it,
// the fights missed, readiness on the way in, deaths taken apart, what deaths and kills were worth,
// grouping, and for the damage section whom the damage went to, what it was worth per net worth,
// heals both ways and the damage that wasn't the hero's own. Pure, so insights can reuse it.

// Totals by key, largest first.
function sumBy<T, K>(list: T[], key: (x: T) => K, value: (x: T) => number): [K, number][] {
  const m = new Map<K, number>();
  for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + value(x));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ── Levels ───────────────────────────────────────────────────────────────────────────────────

// Total XP to reach each level (index 0 = level 1), the table lab.ts uses: the level read from the
// XP curve matches STRATZ's level events minute by minute in the sample matches.
export const LEVEL_XP = [
  0, 240, 640, 1160, 1760, 2440, 3200, 4000, 4900, 5900, 7000, 8200, 9500, 10900, 12400, 14000, 15700, 17500,
  19400, 21400, 23600, 26000, 28600, 31400, 34400, 38400, 43400, 49400, 56400, 63900,
];

// The level for an XP total with the way to the next (17.4 = level 17, 40% of the way to 18).
export function levelAt(xp: number) {
  let i = 0;
  while (i + 1 < LEVEL_XP.length && xp >= LEVEL_XP[i + 1]) i++;
  if (i + 1 >= LEVEL_XP.length) return LEVEL_XP.length;
  return i + 1 + (xp - LEVEL_XP[i]) / (LEVEL_XP[i + 1] - LEVEL_XP[i]);
}

// ── Teamfights ───────────────────────────────────────────────────────────────────────────────

export type FightResult = "won" | "lost" | "traded";
export type Presence = "joined" | "absent" | "dead";

// A share of the team's fight damage this big counts as carrying the fight.
export const BIG_SHARE = 0.35;

const ours = (s: LabSide, slot: number) => slot < 128 === s.radiant;

// When the player was dead: each death to its respawn.
export function deadSpans(s: LabSide): [number, number][] {
  return s.fights.events
    .filter((f) => f.kind === "death" && (f.timeDead ?? 0) > 0)
    .map((f) => [f.t, f.t + (f.timeDead ?? 0)]);
}

const overlap = (spans: [number, number][], a: number, b: number) =>
  spans.reduce((total, [x, y]) => total + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);

export type FightOutcome = {
  i: number;
  start: number;
  end: number;
  // By the deaths: the side that lost more heroes lost it, the same number is a trade.
  result: FightResult;
  teamDeaths: number;
  enemyDeaths: number;
  // The team's gold and XP swing: what the team gained in the fight less what the enemy did.
  gold: number | null;
  xp: number | null;
  dmgShare: number | null;
  healShare: number | null;
  // Average level of the team against the enemy's at the start (from everyone's XP).
  levelEdge: number | null;
  level: number | null;
  gained: number | null;
  // Absent while alive, or dead through most of it.
  presence: Presence;
  died: boolean;
};

type FightRow = LabSide["match"]["teamfights"][number]["players"][number];
const total = (list: FightRow[], pick: (p: FightRow) => number) => list.reduce((a, p) => a + pick(p), 0);

// Kept per side (the sides don't change while the page is open), as most readings start from it.
const outcomeCache = new WeakMap<LabSide, FightOutcome[]>();

export function fightOutcomes(s: LabSide): FightOutcome[] {
  const cached = outcomeCache.get(s);
  if (cached) return cached;
  const out = buildOutcomes(s);
  outcomeCache.set(s, out);
  return out;
}

function buildOutcomes(s: LabSide): FightOutcome[] {
  const spans = deadSpans(s);
  return s.fights.teamfights.map((f, i) => {
    const mf =
      s.match.teamfights.find((m) => m.start === f.start && m.end === f.end) ?? s.match.teamfights[i] ?? null;
    const rows = mf?.players ?? [];
    const us = rows.filter((p) => ours(s, p.slot));
    const them = rows.filter((p) => !ours(s, p.slot));
    const me = rows.find((p) => p.slot === s.slot) ?? null;
    const teamDamage = total(us, (p) => p.damage);
    const teamHealing = total(us, (p) => p.healing);
    const avgLevel = (list: FightRow[]) =>
      list.length && list.every((p) => p.xpStart != null)
        ? list.reduce((a, p) => a + levelAt(p.xpStart ?? 0), 0) / list.length
        : null;
    const lu = avgLevel(us);
    const lt = avgLevel(them);
    const level = me?.xpStart != null ? Math.floor(levelAt(me.xpStart)) : null;
    const presence: Presence = f.joined
      ? "joined"
      : overlap(spans, f.start, f.end) >= (f.end - f.start) / 2
        ? "dead"
        : "absent";
    return {
      i,
      start: f.start,
      end: f.end,
      result: f.enemyDeaths > f.teamDeaths ? "won" : f.teamDeaths > f.enemyDeaths ? "lost" : "traded",
      teamDeaths: f.teamDeaths,
      enemyDeaths: f.enemyDeaths,
      gold: rows.length ? total(us, (p) => p.gold) - total(them, (p) => p.gold) : null,
      xp: rows.length ? total(us, (p) => p.xp) - total(them, (p) => p.xp) : null,
      dmgShare: me && teamDamage > 0 ? me.damage / teamDamage : null,
      healShare: me && teamHealing > 0 ? me.healing / teamHealing : null,
      levelEdge: lu != null && lt != null ? lu - lt : null,
      level,
      gained: level != null && me?.xpEnd != null ? Math.floor(levelAt(me.xpEnd)) - level : null,
      presence,
      died: f.died,
    };
  });
}

export type RecordGroup = {
  n: number;
  won: number;
  lost: number;
  traded: number;
  // The team's average gold and XP swing per fight.
  gold: number | null;
  xp: number | null;
};

export function fightRecord(list: FightOutcome[]) {
  const group = (p: Presence): RecordGroup => {
    const l = list.filter((f) => f.presence === p);
    return {
      n: l.length,
      won: l.filter((f) => f.result === "won").length,
      lost: l.filter((f) => f.result === "lost").length,
      traded: l.filter((f) => f.result === "traded").length,
      gold: mean(l.flatMap((f) => (f.gold != null ? [f.gold] : []))),
      xp: mean(l.flatMap((f) => (f.xp != null ? [f.xp] : []))),
    };
  };
  const big = list.filter((f) => f.presence === "joined" && (f.dmgShare ?? 0) >= BIG_SHARE);
  return {
    joined: group("joined"),
    absent: group("absent"),
    dead: group("dead"),
    big: big.length,
    bigWon: big.filter((f) => f.result === "won").length,
    bigLost: big.filter((f) => f.result === "lost").length,
  };
}

// ── Fights missed ────────────────────────────────────────────────────────────────────────────

export type MissedFight = {
  o: FightOutcome;
  // From the player at the fight's start to the centre of where its heroes died (game units).
  dist: number | null;
  // The closest the player got to any enemy during it (the fight table's figure, game units).
  closest: number | null;
  // What most of the fight's 10-second samples were spent on.
  activity: Activity | null;
  // The player's own gold and XP meanwhile (OpenDota's teamfight rows).
  gold: number;
  xp: number;
  // The team's win chance after against before (the whole team's swing).
  win: number | null;
};

export function missedFights(s: LabSide, outcomes: FightOutcome[]): MissedFight[] {
  const wp = s.advanced.context.winProb;
  return outcomes
    .filter((o) => o.presence === "absent")
    .map((o) => {
      const f = s.fights.teamfights[o.i];
      const places = s.match.deaths.filter(
        (d) => d.t >= o.start - 2 && d.t <= o.end + 2 && d.x != null && d.y != null,
      );
      // The path sample nearest the start.
      let k = -1;
      s.path.t.forEach((t, n) => {
        if (k < 0 || Math.abs(t - o.start) < Math.abs(s.path.t[k] - o.start)) k = n;
      });
      const cx = mean(places.map((d) => d.x ?? 0));
      const cy = mean(places.map((d) => d.y ?? 0));
      const dist =
        k >= 0 && cx != null && cy != null
          ? Math.round(Math.hypot(s.path.x[k] - cx, s.path.y[k] - cy) * CELL)
          : null;
      // A sample covers the 10 seconds before it.
      const counts = new Map<Activity, number>();
      s.path.t.forEach((t, n) => {
        const a = s.advanced.activity[n];
        if (a && t > o.start && t < o.end + 10) counts.set(a, (counts.get(a) ?? 0) + 1);
      });
      const activity = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      const m0 = Math.floor(o.start / 60);
      const m1 = Math.min(wp.length - 1, Math.ceil(o.end / 60));
      return {
        o,
        dist,
        closest: s.advanced.fightDetails.find((d) => d.idx === o.i)?.closest ?? null,
        activity,
        gold: f?.goldDelta ?? 0,
        xp: f?.xpDelta ?? 0,
        win: wp.length > m0 && m1 > m0 ? wp[m1] - wp[m0] : null,
      };
    });
}

// ── Readiness and execution ──────────────────────────────────────────────────────────────────

const BLINKS = ["blink", "overwhelming_blink", "swift_blink", "arcane_blink"];
// Active items that decide a fight or save their carrier (passives such as Linken's Sphere and Aeon
// Disk can't be "used", so they're left out).
export const SAVE_ITEMS = [
  "black_king_bar",
  "manta",
  "satanic",
  ...BLINKS,
  "glimmer_cape",
  "force_staff",
  "hurricane_pike",
  "cyclone",
  "wind_waker",
  "ghost",
  "ethereal_blade",
  "lotus_orb",
  "pavise",
  "shadow_amulet",
  "invis_sword",
  "silver_edge",
  "blade_mail",
  "pipe",
  "crimson_guard",
  "guardian_greaves",
  "mekansm",
  "bloodstone",
  "disperser",
  "heavens_halberd",
  "sheepstick",
  "abyssal_blade",
];
// The ones whose cooldown (or a backpack slot) at a fight's start counts as not ready.
const KEY_READY = new Set(["black_king_bar", "manta", ...BLINKS]);
// Defensive items whose timing is read: before the first damage taken or after.
export const DEFENSIVE = ["black_king_bar", "manta", "satanic"];
// Used this many seconds before the start (or the death) counts as used for it.
const PRE = 15;
// Seconds of cooldown left at the start still counted as ready.
export const GRACE = 5;

export type ItemReady = { key: string; state: "ready" | "used" | "cooldown" | "backpack"; left: number };
export type UltReady = { key: string; state: "ready" | "used" | "cooldown" | "none"; left: number };

// The inventory at a moment: the last snapshot at or before it (STRATZ writes one on every change).
export function inventoryAt(s: LabSide, t: number): LabInventory | null {
  let last: LabInventory | null = null;
  for (const e of s.advanced.inventory) {
    if (e.t > t) break;
    last = e;
  }
  return last;
}

const itemUses = (s: LabSide, key: string) => s.items.useTimes.find((u) => u.key === key)?.times ?? [];
const lastBefore = (times: number[], t: number) => {
  let last: number | null = null;
  for (const x of times) if (x <= t && (last == null || x > last)) last = x;
  return last;
};

// An item's state at a moment, from the inventory, its last use and its base cooldown (cooldown cuts
// such as Octarine Core aren't counted).
export function itemReady(
  s: LabSide,
  assets: LabAssets,
  key: string,
  t: number,
  inv: LabInventory,
): ItemReady | null {
  const main = inv.items.includes(key);
  if (!main && !inv.backpack.includes(key)) return null;
  const last = lastBefore(itemUses(s, key), t);
  if (last != null && t - last <= PRE) return { key, state: "used", left: 0 };
  if (!main) return { key, state: "backpack", left: 0 };
  const cd = assets.itemMeta[key]?.cd ?? null;
  const left = last != null && cd != null ? Math.round(last + cd - t) : 0;
  return { key, state: left > 0 ? "cooldown" : "ready", left: Math.max(0, left) };
}

// The ultimate at a moment: learned yet, cast just before, or how long its cooldown still ran (the
// cooldown of the level it was cast at; talents and items that cut it aren't counted).
export function ultReady(s: LabSide, assets: LabAssets, t: number): UltReady | null {
  const key = s.skills.ult;
  if (!key) return null;
  const meta = assets.abilityMeta[key];
  if (meta?.passive) return null;
  const cds = s.advanced.cooldowns[key]?.length ? s.advanced.cooldowns[key] : (meta?.cd ?? []);
  const learned = s.skills.learned.filter((l) => l.key === key && !l.talent).map((l) => l.t);
  if (!cds.length || !learned.length) return null;
  if (!learned.some((x) => x <= t)) return { key, state: "none", left: 0 };
  const last = lastBefore(s.skills.useTimes.find((u) => u.key === key)?.times ?? [], t);
  if (last == null) return { key, state: "ready", left: 0 };
  if (t - last <= PRE) return { key, state: "used", left: 0 };
  const level = Math.max(1, learned.filter((x) => x <= last).length);
  const left = Math.round(last + cds[Math.min(level, cds.length) - 1] - t);
  return { key, state: left > 0 ? "cooldown" : "ready", left: Math.max(0, left) };
}

export type DefensiveUse = {
  key: string;
  // Seconds from the fight's start, and from the first damage taken in it (null: never hit).
  at: number | null;
  afterHit: number | null;
  kind: "proactive" | "reactive" | "unused";
};

export type FightPrep = {
  o: FightOutcome;
  ult: UltReady | null;
  items: ItemReady[];
  defensive: DefensiveUse[];
  // Seconds with right-click damage on a hero (the hero itself, not illusions), and with any damage
  // or a cast aimed at a hero, from the first such moment to the fight's end or the death.
  uptime: number | null;
  active: number | null;
  targets: number;
  notReady: boolean;
};

// The fight's window for the player: from 3 s before its start to its end, or the player's death.
function fightWindow(s: LabSide, o: FightOutcome): [number, number] {
  const death = s.fights.events.find((f) => f.kind === "death" && f.t >= o.start - 3 && f.t <= o.end);
  return [o.start - 3, death?.t ?? o.end];
}

// Uptime in a fight: seconds with the hero's own right-click damage on a hero, and with any of its
// damage or a cast aimed at a hero, over the seconds from its first such moment to the window's end
// (left out when that's under 3 s); targets: the heroes its right-clicks landed on.
export function uptimeOf(s: LabSide, o: FightOutcome) {
  const [from, end] = fightWindow(s, o);
  const hits = s.advanced.damage.filter((d) => d.out && !d.ill && d.t >= from && d.t <= end);
  const clicks = hits.filter((d) => d.type === 0);
  const casts = s.skills.casts.filter((c) => c.t >= from && c.t <= end).map((c) => c.t);
  const first = Math.min(...hits.map((d) => d.t), ...casts);
  const span = end - first + 1;
  const ok = Number.isFinite(first) && span >= 3;
  return {
    uptime: ok ? new Set(clicks.map((d) => d.t)).size / span : null,
    active: ok ? new Set([...hits.map((d) => d.t), ...casts]).size / span : null,
    targets: new Set(clicks.map((d) => d.hero)).size,
  };
}

export function fightPrep(s: LabSide, assets: LabAssets, outcomes: FightOutcome[]): FightPrep[] {
  if (!s.parsed.stratz || (!s.advanced.inventory.length && !s.advanced.damage.length)) return [];
  return outcomes
    .filter((o) => o.presence === "joined")
    .map((o) => {
      const inv = inventoryAt(s, o.start);
      const items = inv
        ? SAVE_ITEMS.map((k) => itemReady(s, assets, k, o.start, inv)).filter((x): x is ItemReady => !!x)
        : [];
      const ult = ultReady(s, assets, o.start);
      const [from, end] = fightWindow(s, o);
      const firstHit = s.advanced.damage.find((d) => !d.out && d.t >= from && d.t <= end)?.t ?? null;
      const defensive = DEFENSIVE.flatMap((key): DefensiveUse[] => {
        const state = items.find((x) => x.key === key);
        if (!state) return [];
        const use = itemUses(s, key)
          .filter((u) => u >= o.start - PRE && u <= end)
          .sort((a, b) => a - b)[0];
        if (use == null)
          return state.state === "ready" && firstHit != null
            ? [{ key, at: null, afterHit: null, kind: "unused" }]
            : [];
        const afterHit = firstHit != null ? use - firstHit : null;
        return [
          {
            key,
            at: use - o.start,
            afterHit,
            kind: afterHit != null && afterHit >= 0 ? "reactive" : "proactive",
          },
        ];
      });
      const notReady =
        (ult?.state === "cooldown" && ult.left > GRACE) ||
        items.some(
          (x) =>
            KEY_READY.has(x.key) && (x.state === "backpack" || (x.state === "cooldown" && x.left > GRACE)),
        );
      return { o, ult, items, defensive, ...uptimeOf(s, o), notReady };
    });
}

// ── Deaths ───────────────────────────────────────────────────────────────────────────────────

// Healing items and their full charges (null: no fixed top).
const CHARGES: Record<string, number | null> = {
  magic_wand: 20,
  magic_stick: 10,
  holy_locket: 20,
  bottle: 3,
  flask: null,
  tango: null,
  faerie_fire: null,
  cheese: null,
  famango: null,
  great_famango: null,
  greater_famango: null,
};
// Of the last 10 seconds' damage, this much in the last 3 counts as a burst.
export const BURST = 0.6;

export type DeathRecap = {
  t: number;
  // Damage taken in the last 10 s (illusions' and summons' included), and in the last 3 s.
  total: number;
  last3: number;
  // By type: right-click, physical spell, magical, pure.
  types: [number, number, number, number];
  heroes: { hero: number; v: number }[];
  sources: { key: string; v: number }[];
  killers: number[];
  killer: number | null;
  // Saving items carried: 'ready' here means off cooldown and not used in the last 15 s.
  items: ItemReady[];
  charges: { key: string; n: number; max: number | null }[];
};

// Without assets (no item cooldowns), the saving items are left out.
export function deathRecaps(s: LabSide, assets: LabAssets | null): DeathRecap[] {
  const hasDamage = s.advanced.damage.length > 0;
  return s.fights.events
    .filter((f) => f.kind === "death")
    .map((f) => {
      const ins = hasDamage ? s.advanced.damage.filter((d) => !d.out && d.t >= f.t - 10 && d.t <= f.t) : [];
      const types: [number, number, number, number] = [0, 0, 0, 0];
      for (const d of ins) types[d.type] += d.v;
      const md = s.match.deaths.find((d) => d.slot === s.slot && Math.abs(d.t - f.t) <= 2);
      const inv = inventoryAt(s, f.t);
      return {
        t: f.t,
        total: sum(ins.map((d) => d.v)),
        last3: sum(ins.filter((d) => d.t >= f.t - 3).map((d) => d.v)),
        types,
        heroes: sumBy(
          ins,
          (d) => d.hero,
          (d) => d.v,
        ).map(([hero, v]) => ({ hero, v })),
        sources: sumBy(
          ins,
          (d) => d.by ?? "null",
          (d) => d.v,
        ).map(([key, v]) => ({ key, v })),
        killers: md?.involved.length ? md.involved : f.enemies,
        killer: md?.killer ?? f.hero,
        items:
          inv && assets
            ? SAVE_ITEMS.map((k) => itemReady(s, assets, k, f.t, inv)).filter((x): x is ItemReady => !!x)
            : [],
        charges: inv
          ? inv.items.flatMap((k, i) => {
              const n = inv.charges[i];
              return k && k in CHARGES && n != null && n > 0 ? [{ key: k, n, max: CHARGES[k] }] : [];
            })
          : [],
      };
    });
}

export const isBurst = (d: DeathRecap) => d.total > 0 && d.last3 / d.total >= BURST;
// Blinks are left out: hero damage disables them for 3 seconds, so 'ready' says little at a death.
export const unusedAtDeath = (d: DeathRecap) =>
  d.items.filter((x) => x.state === "ready" && !BLINKS.includes(x.key));
export const wandLeft = (d: DeathRecap) =>
  d.charges.find((c) => c.key === "magic_wand" || c.key === "magic_stick" || c.key === "holy_locket") ?? null;

// What the deaths cost (gold lost plus farm missed while dead, as the death table has it), what they
// fed the enemy, and the hero's rank average at the same minute.
export function deathCost(s: LabSide, until = Infinity) {
  const list = s.advanced.deathDetails.filter((d) => d.t <= until);
  const pick = (f: (d: (typeof list)[number]) => number | null) => {
    const v = list.map(f).filter((x): x is number => x != null);
    return v.length ? sum(v) : null;
  };
  const minutes = Math.max(1, Math.min(until, s.duration) / 60);
  const cost = pick((d) => d.cost);
  const missed = pick((d) => d.farmMissed);
  const income = s.totals.earned ?? s.totals.totalGold;
  const bl = s.advanced.baseline;
  const m = bl ? Math.min(Math.floor(s.duration / 60), bl.minutes.goldLost.length - 1) : -1;
  // STRATZ keeps gold lost as a negative running total.
  const bLost = bl && m >= 0 ? bl.minutes.goldLost[m] : null;
  const bFed = bl && m >= 0 ? bl.minutes.goldFed[m] : null;
  const bXp = bl && m >= 0 ? (bl.minutes.xpFed[m] ?? null) : null;
  return {
    n: list.length,
    lost: pick((d) => d.goldLost),
    missed,
    cost,
    // Without the farm missed (no STRATZ gold data) the cost is gold lost alone: not comparable.
    full: list.length === 0 || missed != null,
    fed: pick((d) => d.goldFed),
    xpFed: pick((d) => d.xpFed),
    // No deaths at all is a real zero; deaths without details are unknown.
    perMin:
      cost != null
        ? cost / minutes
        : !list.length && !s.fights.events.some((f) => f.kind === "death" && f.t <= until)
          ? 0
          : null,
    share: cost != null && income ? cost / income : null,
    baseline:
      bl && bLost != null && bFed != null
        ? { minute: m, lost: Math.abs(bLost), fed: bFed, xpFed: bXp, n: bl.counts[m] ?? 0 }
        : null,
  };
}

// The gold and XP each kill brought (STRATZ), the richest first. Some kills come without XP (those
// at level 30, for one), so its average is over the kills that have it (xpN).
export function killValue(s: LabSide) {
  const kills = s.fights.events.filter((f) => f.kind === "kill" && f.gold != null);
  const xps = kills.flatMap((k) => (k.xp != null ? [k.xp] : []));
  return {
    n: kills.length,
    gold: mean(kills.map((k) => k.gold ?? 0)),
    xp: mean(xps),
    xpN: xps.length,
    top: [...kills].sort((a, b) => (b.gold ?? 0) - (a.gold ?? 0)).slice(0, 3),
  };
}

// ── Grouping ─────────────────────────────────────────────────────────────────────────────────

type Cohesion = { zonesPerMin: number | null; centroid: number | null };
type CohesionOver = (a: number, b: number) => Cohesion;
const cohesionCache = new WeakMap<
  LabSide,
  { over: CohesionOver; phases: Cohesion[]; whole: Cohesion } | null
>();

export function cohesion(s: LabSide) {
  if (!cohesionCache.has(s)) {
    const over = cohesionOver(s);
    cohesionCache.set(
      s,
      over ? { over, phases: PHASES.map(([a, b]) => over(a, b)), whole: over(0, Infinity) } : null,
    );
  }
  return cohesionCache.get(s) ?? null;
}

// Over the first `until` seconds (games of different lengths compared over the same part).
export const cohesionUntil = (s: LabSide, until: number) => cohesion(s)?.over(0, until) ?? null;

// Zone changes per minute alive (the eight map zones, on the 10-second samples) and the distance to
// the other living teammates' centre, between two moments. A hero counts as dead from a death until
// their position moves again (positions stand still while dead).
function cohesionOver(s: LabSide): CohesionOver | null {
  const g = s.match.grid;
  const me = g.pos[String(s.slot)];
  if (!g.t.length || !me?.x.length) return null;
  const activityAt = new Map(s.path.t.map((t, i) => [t, s.advanced.activity[i]] as const));
  const deadMask = (slot: number) => {
    const pos = g.pos[String(slot)];
    const mask = g.t.map(() => false);
    if (!pos?.x.length) return g.t.map(() => true);
    for (const d of s.match.deaths) {
      if (d.slot !== slot) continue;
      const i0 = g.t.findIndex((t) => t >= d.t);
      if (i0 < 0) continue;
      for (let i = i0; i < g.t.length && g.t[i] <= d.t + 150; i++) {
        if (Math.hypot(pos.x[i] - pos.x[i0], pos.y[i] - pos.y[i0]) > 1) break;
        mask[i] = true;
      }
    }
    return mask;
  };
  const mates = s.match.players.filter((p) => p.radiant === s.radiant && p.slot !== s.slot);
  const masks = mates.map((p) => deadMask(p.slot));
  const myDead = g.t.map((t) => activityAt.get(t) === "dead");
  const over = (a: number, b: number): Cohesion => {
    let changes = 0;
    let alive = 0;
    let prev: string | null = null;
    let dist = 0;
    let n = 0;
    g.t.forEach((t, i) => {
      if (t < Math.max(0, a) || t >= b || myDead[i]) {
        prev = null;
        return;
      }
      alive++;
      const zone = mapZone(me.x[i], me.y[i]);
      if (prev != null && zone !== prev) changes++;
      prev = zone;
      const living = mates.flatMap((p, k) => {
        const pos = g.pos[String(p.slot)];
        return !masks[k][i] && pos?.x.length ? [{ x: pos.x[i], y: pos.y[i] }] : [];
      });
      if (living.length < 2) return;
      const cx = sum(living.map((p) => p.x)) / living.length;
      const cy = sum(living.map((p) => p.y)) / living.length;
      dist += Math.hypot(me.x[i] - cx, me.y[i] - cy) * CELL;
      n++;
    });
    return {
      zonesPerMin: alive >= 6 ? changes / ((alive * 10) / 60) : null,
      centroid: n >= 6 ? dist / n : null,
    };
  };
  return over;
}

// ── Damage ───────────────────────────────────────────────────────────────────────────────────

// The enemies' positions: STRATZ's, else ranked by net worth (an estimate: richest = 1).
export function enemyPositions(s: LabSide) {
  const foes = s.match.players.filter((p) => p.radiant !== s.radiant);
  const given = foes.map((p) => p.position).filter((p): p is number => p != null);
  if (foes.length && given.length === foes.length && new Set(given).size === foes.length)
    return { pos: new Map(foes.map((p) => [p.heroId, p.position ?? 0])), estimated: false };
  const ranked = [...foes].sort((a, b) => b.netWorth - a.netWorth);
  return { pos: new Map(ranked.map((p, i) => [p.heroId, i + 1])), estimated: true };
}

// A fight's damage share is read only above this much damage.
export const MIN_FIGHT_DAMAGE = 300;

const conversion = (hits: LabDamage[], deathsOf: Map<number, number[]>) => {
  const all = sum(hits.map((d) => d.v));
  const conv = sum(
    hits.filter((d) => (deathsOf.get(d.hero) ?? []).some((t) => t >= d.t && t <= d.t + 10)).map((d) => d.v),
  );
  return all > 0 ? conv / all : null;
};

// Damage by the enemy's position, overall (OpenDota's totals) and per fight (STRATZ's hits), and the
// share of the damage on enemies who died within 10 seconds of it (by anyone).
export function targetPriority(s: LabSide, outcomes: FightOutcome[]) {
  const { pos, estimated } = enemyPositions(s);
  const dealt = s.damage.toHeroes.filter((x) => pos.has(x.hero));
  const taken = s.damage.fromHeroes.filter((x) => pos.has(x.hero));
  const core = (hero: number) => (pos.get(hero) ?? 9) <= 3;
  const value = (list: { hero: number; value: number }[], keep: (hero: number) => boolean) =>
    sum(list.filter((x) => keep(x.hero)).map((x) => x.value));
  const dealtAll = value(dealt, () => true);
  const takenAll = value(taken, () => true);
  const deathsOf = new Map<number, number[]>();
  for (const d of s.match.deaths)
    if (pos.has(d.hero)) deathsOf.set(d.hero, [...(deathsOf.get(d.hero) ?? []), d.t]);
  const hits = s.advanced.damage.filter((d) => pos.has(d.hero));
  const out = hits.filter((d) => d.out);
  return {
    estimated,
    rows: [1, 2, 3, 4, 5].map((p) => {
      const hero = [...pos.entries()].find(([, v]) => v === p)?.[0] ?? null;
      return {
        pos: p,
        hero,
        dealt: hero != null ? value(dealt, (h) => h === hero) : 0,
        taken: hero != null ? value(taken, (h) => h === hero) : 0,
      };
    }),
    dealt: dealtAll,
    taken: takenAll,
    coreDealt: dealtAll ? value(dealt, core) / dealtAll : null,
    coreTaken: takenAll ? value(taken, core) / takenAll : null,
    carryMid: dealtAll ? value(dealt, (h) => (pos.get(h) ?? 9) <= 2) / dealtAll : null,
    converted: conversion(out, deathsOf),
    // Per fight (the fight table has the amounts), leaving out shares of under MIN_FIGHT_DAMAGE.
    fights: outcomes
      .filter((o) => o.presence === "joined")
      .flatMap((o) => {
        const w = hits.filter((d) => d.t >= o.start - 3 && d.t <= o.end);
        const wo = w.filter((d) => d.out);
        const wi = w.filter((d) => !d.out);
        const dv = sum(wo.map((d) => d.v));
        const tv = sum(wi.map((d) => d.v));
        const dealtOk = dv >= MIN_FIGHT_DAMAGE;
        const takenOk = tv >= MIN_FIGHT_DAMAGE;
        if (!dealtOk && !takenOk) return [];
        return [
          {
            o,
            coreDealt: dealtOk ? sum(wo.filter((d) => core(d.hero)).map((d) => d.v)) / dv : null,
            coreTaken: takenOk ? sum(wi.filter((d) => core(d.hero)).map((d) => d.v)) / tv : null,
            converted: dealtOk ? conversion(wo, deathsOf) : null,
          },
        ];
      }),
  };
}

// A per-minute curve's average over [a, b] seconds (10-second steps).
function timeAverage(arr: number[], a: number, b: number) {
  let total = 0;
  let n = 0;
  for (let t = a; t <= b; t += 10) {
    const v = at(arr, t);
    if (v != null) {
      total += v;
      n++;
    }
  }
  return n ? total / n : null;
}

// Hero damage per minute for each 1,000 of net worth (the phase's average), by phase and over the
// whole game, and the player's share of the team's hero damage, tower damage, gold and net worth.
export function damageEfficiency(s: LabSide, until = Infinity) {
  const per1k = (a: number, b: number) => {
    if (b - a < 60) return null;
    const d0 = at(s.minutes.heroDamage, a);
    const d1 = at(s.minutes.heroDamage, b);
    const nw = timeAverage(s.minutes.netWorth, a, b);
    if (d0 == null || d1 == null || !nw) return null;
    const dpm = ((d1 - d0) / (b - a)) * 60;
    return { dpm, nw, per1k: dpm / (nw / 1000) };
  };
  const end = Math.min(until, s.duration);
  const team = s.match.players.filter((p) => p.radiant === s.radiant);
  const me = s.match.players.find((p) => p.slot === s.slot) ?? null;
  const share = (pick: (p: (typeof team)[number]) => number | null) => {
    const all = sum(team.map((p) => pick(p) ?? 0));
    return me && all > 0 ? (pick(me) ?? 0) / all : null;
  };
  return {
    phases: PHASES.map(([a, b]) => per1k(Math.max(0, a), Math.min(b, end))),
    whole: per1k(0, end),
    shares: {
      heroDamage: share((p) => p.heroDamage),
      towerDamage: share((p) => p.towerDamage),
      gold: share((p) => p.totalGold),
      netWorth: share((p) => p.netWorth),
    },
  };
}

// OpenDota's source × target table, enemies only (self-damage such as Soul Ring's is left out).
export function abilityMatrix(s: LabSide) {
  const foes = new Set(s.enemies);
  const rows = s.damage.matrix
    .map((r) => {
      const targets = r.targets.filter((x) => foes.has(x.hero));
      return { key: r.key, targets, total: sum(targets.map((x) => x.value)) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const byHero = new Map<number, number>();
  for (const r of rows) for (const x of r.targets) byHero.set(x.hero, (byHero.get(x.hero) ?? 0) + x.value);
  const cols = [...s.enemies].sort((a, b) => (byHero.get(b) ?? 0) - (byHero.get(a) ?? 0));
  return { rows, cols, total: sum(rows.map((r) => r.total)) };
}

// Heals both ways (STRATZ's heal events): received from own items, own abilities and each ally;
// natural regeneration; given to each ally; and STRATZ's own totals to check against.
export function healBreakdown(s: LabSide, assets: LabAssets) {
  const h = s.advanced.heals;
  const isItem = (k: string | null) => !!k && (!!assets.items[k] || !!assets.itemMeta[k]);
  const own = h.received.filter((x) => x.hero === s.heroId);
  const others = h.received.filter((x) => x.hero !== s.heroId);
  const bySource = (list: LabHeal[]) =>
    sumBy(
      list,
      (x) => x.by ?? "",
      (x) => x.v,
    ).map(([key, v]) => ({ key, v }));
  return {
    ownItems: bySource(own.filter((x) => isItem(x.by))),
    ownAbilities: bySource(own.filter((x) => !isItem(x.by))),
    allies: sumBy(
      others,
      (x) => x.hero,
      (x) => x.v,
    ).map(([hero, v]) => ({ hero, v, top: bySource(others.filter((x) => x.hero === hero))[0]?.key || null })),
    regen: h.regen,
    given: sumBy(
      h.given,
      (x) => x.hero,
      (x) => x.v,
    ).map(([hero, v]) => ({ hero, v })),
    stratzIn: s.advanced.report?.received.heal ?? null,
    stratzGiven: s.advanced.report?.dealt.allyHeal ?? null,
    any: h.received.length > 0 || h.given.length > 0 || h.regen > 0,
  };
}

// Damage that wasn't the hero's own: enemy spells credited to the player (reflected by Counterspell
// or Lotus Orb, or stolen), the player's own spells that came back at them, and what illusions and
// controlled units dealt and took. Prefixes: the enemy heroes' ability key prefixes ("sven_").
export function foreignDamage(
  s: LabSide,
  assets: LabAssets,
  ownPrefix: string | null,
  enemyPrefixes: string[],
) {
  const own = new Set(assets.heroAbilities[String(s.heroId)] ?? []);
  const isOwn = (k: string) => own.has(k) || (!!ownPrefix && k.startsWith(ownPrefix));
  const isItem = (k: string) => !!assets.items[k] || !!assets.itemMeta[k];
  const reflected = s.damage.dealtBySource.filter(
    (x) =>
      x.key !== "null" && !isItem(x.key) && !isOwn(x.key) && enemyPrefixes.some((p) => x.key.startsWith(p)),
  );
  const back = s.damage.receivedBySource.filter((x) => x.key !== "null" && !isItem(x.key) && isOwn(x.key));
  const via = own.has("antimage_counterspell")
    ? "counterspell"
    : s.items.purchases.some((p) => p.key === "lotus_orb")
      ? "lotus"
      : own.has("rubick_spell_steal")
        ? "stolen"
        : null;
  const d = s.advanced.damage;
  const outAll = sum(d.filter((x) => x.out).map((x) => x.v));
  const inAll = sum(d.filter((x) => !x.out).map((x) => x.v));
  const outIll = sum(d.filter((x) => x.out && x.ill).map((x) => x.v));
  const inIll = sum(d.filter((x) => !x.out && x.ill).map((x) => x.v));
  return {
    reflected,
    reflectedTotal: sum(reflected.map((x) => x.value)),
    reflectedHits: sum(
      s.damage.hits.filter((h) => reflected.some((r) => r.key === h.key)).map((h) => h.value),
    ),
    back,
    backTotal: sum(back.map((x) => x.value)),
    via,
    units: d.length
      ? {
          dealt: outIll,
          dealtShare: outAll ? outIll / outAll : null,
          taken: inIll,
          takenShare: inAll ? inIll / inAll : null,
        }
      : null,
  };
}

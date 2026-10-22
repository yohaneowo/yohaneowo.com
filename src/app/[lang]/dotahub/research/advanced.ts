import type { Dictionary } from "@/i18n/dictionaries";
import type { Activity } from "@/lib/dota/lab-extra";
import type { LabAssets, LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { areaOf, firstBuys, MAP_INTERACTIONS, type Metric, minutesOf, num, pct, valueAt } from "./insights";
import { at } from "./x/util";

// The deeper reading: how the time went, what each key item changed, how fully the abilities were
// used, movement and grouping, ward quality, laning trades, gold left unspent, deaths, the game's
// course — and the sentences that say so. Pure, computed in the browser.

type R = Dictionary["dotahub"]["research"];

export const ACTIVITIES: Activity[] = ["farmLane", "farmJungle", "fight", "move", "base", "dead"];

export const PHASES: [number, number][] = [
  [-90, 600],
  [600, 1200],
  [1200, 1800],
  [1800, 99999],
];

// ── Time ─────────────────────────────────────────────────────────────────────────────────────

export function activityShares(s: LabSide, from = -Infinity, to = Infinity) {
  const counts = Object.fromEntries(ACTIVITIES.map((a) => [a, 0])) as Record<Activity, number>;
  let n = 0;
  s.advanced.activity.forEach((a, i) => {
    const t = s.path.t[i];
    if (t < Math.max(0, from) || t > to) return;
    counts[a]++;
    n++;
  });
  return {
    n,
    shares: Object.fromEntries(ACTIVITIES.map((a) => [a, n ? counts[a] / n : 0])) as Record<Activity, number>,
  };
}

// ── Items ────────────────────────────────────────────────────────────────────────────────────

// Five minutes before a key item and five after: gold, last hits and hero damage per minute, and
// the rank average's change over the same minutes of the game (everyone farms faster as the game
// goes on, so what stands out is the change beyond the average's). Fights and deaths inside the
// windows are counted: they move these numbers as much as the item does.
export function itemEffects(s: LabSide, assets: LabAssets) {
  const rate = (arr: (number | null)[] | undefined, a: number, b: number) => {
    const va = at(arr, a);
    const vb = at(arr, b);
    return va == null || vb == null || b <= a ? null : ((vb - va) / (b - a)) * 60;
  };
  const bl = s.advanced.baseline?.minutes;
  // The average's income: its net worth plus what it lost on deaths.
  const blIncome = bl ? bl.networth.map((v, m) => (v == null ? null : v + (bl.goldLost[m] ?? 0))) : undefined;
  const change = (pair: readonly [number | null, number | null]) =>
    pair[0] != null && pair[1] != null ? pair[1] - pair[0] : null;
  // The curves stop at the last whole minute: a window running into the end of the game stops there
  // too (past it the rate would count seconds with no data).
  const end = Math.min(s.duration, Math.max(0, s.minutes.gold.length - 1) * 60);
  return [...firstBuys(s, assets).entries()]
    .filter(([, t]) => t > 120)
    .map(([key, t]) => {
      const before = Math.max(0, t - 300);
      const after = Math.min(end, t + 300);
      const pair = (arr: (number | null)[] | undefined) =>
        [rate(arr, before, t), rate(arr, t, after)] as const;
      const gold = pair(s.minutes.gold);
      const lh = pair(s.minutes.lh);
      const dmg = pair(s.minutes.heroDamage);
      const avg = {
        gold: change(pair(blIncome)),
        lh: change(pair(bl?.cs)),
        dmg: change(pair(bl?.heroDamage)),
      };
      const excess = (mine: readonly [number | null, number | null], a: number | null) => {
        const c = change(mine);
        return c == null || a == null ? null : c - a;
      };
      return {
        key,
        t,
        baseline: s.advanced.baseline?.items[key]?.time ?? null,
        gold,
        lh,
        dmg,
        // Beyond the average's change (per minute), when the average reaches these minutes.
        excess: { gold: excess(gold, avg.gold), lh: excess(lh, avg.lh), dmg: excess(dmg, avg.dmg) },
        fights: s.fights.teamfights.filter((f) => f.start < after && f.end > before).length,
        deaths: s.fights.events.filter((f) => f.kind === "death" && f.t >= before && f.t <= after).length,
      };
    });
}

// Active items' use in the teamfights joined after buying them (OpenDota's teamfight log, so it
// works without STRATZ's parse too).
export function itemFightUse(s: LabSide, assets: LabAssets) {
  const buys = firstBuys(s, assets);
  const out: { key: string; fights: number; used: number }[] = [];
  for (const [key, t] of buys) {
    if (!s.items.useTimes.some((u) => u.key === key) && !s.items.uses.some((u) => u.key === key)) continue;
    const joined = s.fights.teamfights
      .map((f, i) => ({ f, d: s.advanced.fightDetails[i] }))
      .filter(({ f }) => f.joined && f.start > t);
    if (!joined.length) continue;
    out.push({
      key,
      fights: joined.length,
      used: joined.filter(({ d }) => d?.items.some((x) => x.key === key)).length,
    });
  }
  return out;
}

// ── Skills ───────────────────────────────────────────────────────────────────────────────────

// How many times each ability could have been cast (its cooldown at each level, from when it was
// learned, minus time dead) against how many times it was. Cooldown cuts (talents, items) are not
// counted, so a ratio above 100% is possible.
export function skillEfficiency(s: LabSide) {
  const deadSpans = s.fights.events
    .filter((f) => f.kind === "death" && f.timeDead)
    .map((f) => [f.t, f.t + (f.timeDead ?? 0)] as const);
  const alive = (a: number, b: number) =>
    Math.max(
      0,
      b - a - deadSpans.reduce((sum, [x, y]) => sum + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0),
    );
  const out: {
    key: string;
    casts: number;
    possible: number;
    ratio: number;
    ult: boolean;
    fights: [number, number] | null;
  }[] = [];
  for (const [key, cds] of Object.entries(s.advanced.cooldowns)) {
    const levels = s.skills.learned.filter((l) => l.key === key).map((l) => l.t);
    if (!levels.length) continue;
    let possible = 0;
    levels.forEach((t, i) => {
      const end = levels[i + 1] ?? s.duration;
      possible += alive(Math.max(0, t), end) / (cds[Math.min(i, cds.length - 1)] || 1);
    });
    if (MAP_INTERACTIONS.has(key)) continue;
    const casts =
      s.skills.useTimes.find((u) => u.key === key)?.times.length ??
      s.skills.uses.find((u) => u.key === key)?.count ??
      0;
    const ult = key === s.skills.ult;
    let fights: [number, number] | null = null;
    if (ult) {
      const joined = s.fights.teamfights
        .map((f, i) => ({ f, d: s.advanced.fightDetails[i] }))
        .filter(({ f }) => f.joined && f.start > levels[0]);
      fights = [joined.filter(({ d }) => d?.abilities.some((a) => a.key === key)).length, joined.length];
    }
    out.push({
      key,
      casts,
      possible: Math.max(1, Math.round(possible)),
      ratio: possible ? casts / possible : 0,
      ult,
      fights,
    });
  }
  return out.sort((a, b) => b.casts - a.casts);
}

// Heroes hit per cast, for abilities with both counts.
export function hitsPerCast(s: LabSide) {
  return s.damage.hits
    .map((h) => ({
      key: h.key,
      hits: h.value,
      casts: s.skills.uses.find((u) => u.key === h.key)?.count ?? 0,
    }))
    .filter((x) => x.casts > 0 && x.key !== "null")
    .map((x) => ({ ...x, per: x.hits / x.casts }));
}

// ── Movement ─────────────────────────────────────────────────────────────────────────────────

// Distance covered (game units, map cells being ~128) per phase, and how often teammates were near.
// A 10-second step counts unless it holds a teleport (TP scroll, Boots of Travel, a twin gate — the
// jump lands a few seconds after the use) or a death and respawn; blinks and fast heroes stay in.
// The path is sampled every 10 s, so turns inside a step are cut short: a lower bound.
export function movement(s: LabSide) {
  const { t, x, y } = s.path;
  const dist = PHASES.map(() => 0);
  const jumps = [
    ...s.items.useTimes
      .filter((u) => u.key === "tpscroll" || u.key.startsWith("travel_boots"))
      .flatMap((u) => u.times),
    ...(s.skills.useTimes.find((u) => u.key === "twin_gate_portal_warp")?.times ?? []),
  ];
  const dead = s.advanced.activity;
  for (let i = 1; i < t.length; i++) {
    const d = Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]) * 128;
    const teleported = jumps.some((j) => j > t[i - 1] - 8 && j <= t[i]);
    if (teleported || dead[i] === "dead" || dead[i - 1] === "dead" || d > 7000) continue;
    const p = PHASES.findIndex(([a, b]) => t[i] >= a && t[i] < b);
    if (p >= 0) dist[p] += d;
  }
  const allies = s.advanced.alliesNear;
  const alive = s.advanced.activity.map((a) => a !== "dead");
  const aliveN = alive.filter(Boolean).length || 1;
  const group = {
    alone: allies.filter((v, i) => alive[i] && v === 0).length / aliveN,
    one: allies.filter((v, i) => alive[i] && v === 1).length / aliveN,
    two: allies.filter((v, i) => alive[i] && v >= 2).length / aliveN,
  };
  const at = (tt: number) => {
    let i = t.findIndex((v) => v >= tt);
    if (i < 0) i = t.length - 1;
    return i >= 0 ? { x: x[i], y: y[i] } : null;
  };
  const tps = s.items.useTimes
    .filter((u) => u.key === "tpscroll" || u.key.startsWith("travel_boots"))
    .flatMap((u) => u.times)
    .sort((a, b) => a - b)
    .map((tt) => ({ t: tt, from: at(tt - 2), to: at(tt + 8) }));
  const smokes = s.items.useTimes.find((u) => u.key === "smoke_of_deceit")?.times ?? [];
  return { dist, group, tps, smokes, total: dist.reduce((a, b) => a + b, 0) };
}

// ── Vision ───────────────────────────────────────────────────────────────────────────────────

export type WardRole = "defensive" | "river" | "aggressive" | "base";

export function wardRole(x: number, y: number, radiant: boolean): WardRole {
  const area = areaOf(x, y, radiant);
  if (area === "ownBase" || area === "enemyBase") return "base";
  if (area === "river") return "river";
  if (area === "enemyJungle") return "aggressive";
  if (area === "ownJungle") return "defensive";
  // Lanes: by which half of the map.
  const own = radiant ? x + y < 256 : x + y > 256;
  return own ? "defensive" : "aggressive";
}

// A ward's full life (seconds).
export const wardLife = (kind: "obs" | "sen") => (kind === "obs" ? 360 : 420);
// OpenDota closes the wards still standing when the game ends at their full life, after the end.
export const wardUpAtEnd = (s: LabSide, w: LabSide["vision"]["wards"][number]) =>
  w.end != null && w.end > s.duration;
// Gone before its time: destroyed by an enemy hero, or by creeps and summons (no hero recorded).
export const wardDestroyed = (s: LabSide, w: LabSide["vision"]["wards"][number]) =>
  w.killedBy != null || (w.end != null && !wardUpAtEnd(s, w) && w.end - w.t < wardLife(w.kind) - 3);

export function visionQuality(s: LabSide) {
  const wards = s.vision.wards;
  const objectives = [
    ...s.fights.teamfights.map((f) => f.start),
    ...s.resources.roshan.filter((r) => r.kind === "teamKill" || r.kind === "enemyKill").map((r) => r.t),
  ];
  const roles = { defensive: 0, river: 0, aggressive: 0, base: 0 } as Record<WardRole, number>;
  let beforeObjective = 0;
  for (const w of wards) {
    roles[wardRole(w.x, w.y, s.radiant)]++;
    if (objectives.some((o) => o > w.t && o - w.t <= 120)) beforeObjective++;
  }
  // The wards still up at the end didn't live out their time: left out of the average life.
  const lived = (kind: "obs" | "sen") => {
    const list = wards
      .filter((w) => w.kind === kind && w.end != null && !wardUpAtEnd(s, w))
      .map((w) => w.end! - w.t);
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
  };
  const killed = wards.filter((w) => wardDestroyed(s, w)).length;
  return {
    roles,
    beforeObjective,
    avgObs: lived("obs"),
    avgSen: lived("sen"),
    dewardedShare: wards.length ? killed / wards.length : null,
    count: wards.length,
  };
}

// ── Laning trades ────────────────────────────────────────────────────────────────────────────

export function laneTrades(s: LabSide) {
  const opp = new Set(s.laneOpponents);
  const early = s.advanced.damage.filter((d) => d.t < 600);
  const out = early.filter((d) => d.out).reduce((a, d) => a + d.v, 0);
  const inn = early.filter((d) => !d.out).reduce((a, d) => a + d.v, 0);
  const vsLane = early.filter((d) => opp.has(d.hero));
  return {
    out,
    in: inn,
    laneOut: vsLane.filter((d) => d.out).reduce((a, d) => a + d.v, 0),
    laneIn: vsLane.filter((d) => !d.out).reduce((a, d) => a + d.v, 0),
    // Alive only: a death's zero says nothing about the trades.
    lowHp: s.minutes.hpMin.slice(0, 11).some((v) => v > 0.001)
      ? Math.min(...s.minutes.hpMin.slice(0, 11).filter((v) => v > 0.001))
      : null,
    perOpponent: [...opp].map((hero) => ({
      hero,
      out: early.filter((d) => d.out && d.hero === hero).reduce((a, d) => a + d.v, 0),
      in: early.filter((d) => !d.out && d.hero === hero).reduce((a, d) => a + d.v, 0),
    })),
  };
}

// ── Gold on hand ─────────────────────────────────────────────────────────────────────────────

// Buyback: 200 + net worth / 13 (as lab-extra.ts has it, which the browser can't import).
export const buybackCost = (netWorth: number) => 200 + netWorth / 13;
// From 30:00 a core keeps buyback gold on purpose.
export const BUYBACK_FROM = 1800;

// Gold on hand that sat idle: alive, above the buyback reserve once buyback matters; and (with the
// item costs) the share of that time the next item the player went on to buy was already paid for —
// waiting on a trip to the shop or the courier, or banking. `until`: the average over the first
// seconds only (games of different lengths compared over the same part).
export function banking(s: LabSide, assets?: LabAssets, until = Infinity) {
  const u = s.advanced.unspent;
  if (!u.length) return null;
  const alive = s.advanced.activity.length ? s.advanced.activity.map((a) => a !== "dead") : u.map(() => true);
  const reserveAt = (t: number) => (t >= BUYBACK_FROM ? buybackCost(valueAt(s.minutes.netWorth, t) ?? 0) : 0);
  const idle = u.map((v, i) => Math.max(0, v - reserveAt(s.path.t[i])));
  const live = idle.filter((_, i) => alive[i] && s.path.t[i] > 0 && s.path.t[i] <= until);
  const cost = (k: string) => assets?.itemMeta[k]?.cost ?? assets?.items[k]?.cost ?? 0;
  const buys = assets
    ? s.items.purchases.filter(
        (p) =>
          !(assets.items[p.key]?.consumable ?? false) && !p.key.startsWith("recipe_") && cost(p.key) >= 500,
      )
    : [];
  let ready = 0;
  let n = 0;
  idle.forEach((v, i) => {
    const t = s.path.t[i];
    if (!alive[i] || t <= 0) return;
    n++;
    const next = buys.find((p) => p.t > t);
    if (next && v >= cost(next.key)) ready++;
  });
  const minutes = Math.floor(s.duration / 60) + 1;
  const perMinute = (vals: number[]) =>
    Array.from({ length: minutes }, (_, m) => {
      const inMinute = vals.filter((_, i) => s.path.t[i] >= m * 60 && s.path.t[i] < (m + 1) * 60);
      return inMinute.length ? inMinute.reduce((a, b) => a + b, 0) / inMinute.length : 0;
    });
  const spent = s.totals.goldSpent;
  const earned = s.totals.earned;
  return {
    avg: live.length ? live.reduce((a, b) => a + b, 0) / live.length : 0,
    max: Math.max(0, ...live),
    readyShare: assets && n ? ready / n : null,
    perMinute: perMinute(u),
    reservePerMinute: Array.from({ length: minutes }, (_, m) => reserveAt(m * 60)),
    spendRatio: spent != null && earned ? spent / earned : null,
    end: s.totals.goldEnd,
  };
}

// ── Deaths and the game ──────────────────────────────────────────────────────────────────────

// The costliest death by its own cost (gold lost and farm missed while dead), not by the team's
// win-chance swing around it, which the whole team's play moved.
export function deathSummary(s: LabSide) {
  const d = s.advanced.deathDetails;
  const kinds = { fight: 0, gank: 0, pickoff: 0, other: 0 };
  for (const x of d) kinds[x.kind]++;
  const costly = [...d].filter((x) => x.cost != null).sort((a, b) => b.cost! - a.cost!)[0] ?? null;
  return {
    kinds,
    alone: d.filter((x) => x.alliesNear === 0).length,
    buybackReady: d.filter((x) => x.buyback).length,
    costly,
  };
}

export function contextFacts(s: LabSide) {
  const w = s.advanced.context.winProb;
  if (!w.length) return null;
  let swingAt = 0;
  let swing = 0;
  for (let m = 1; m < w.length; m++)
    if (Math.abs(w[m] - w[m - 1]) > Math.abs(swing)) {
      swing = w[m] - w[m - 1];
      swingAt = m;
    }
  return { max: Math.max(...w), min: Math.min(...w), swing, swingAt, final: w[w.length - 1] };
}

// ── Sentences ────────────────────────────────────────────────────────────────────────────────

type Names = {
  items: (k: string) => string;
  abilities: (k: string) => string;
  heroes: (id: number) => string;
};
const sides = (a: LabSide, b: LabSide | null) => (b ? [a, b] : [a]);
const who = (t: R, i: number) => (i ? t.insight.b : t.insight.a);

export function contextInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  return (
    sides(a, b)
      .map((s, i) => {
        const c = contextFacts(s);
        if (!c) return "";
        const lane = s.advanced.context.laneOutcome;
        return d.contextLine(
          who(t, i),
          pct(c.max),
          pct(c.min),
          clock(c.swingAt * 60),
          pct(Math.abs(c.swing)),
          lane ? d.laneResults[lane] : "–",
        );
      })
      .filter(Boolean)
      .join(" ") || d.noContext
  );
}

// A side without STRATZ's parse has no time breakdown: left out, not shown as zeros.
export function timeInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  const parts = sides(a, b).map((s, i) => {
    if (!s.advanced.activity.length) return "";
    const sh = activityShares(s).shares;
    return d.timeLine(who(t, i), pct(sh.farmLane + sh.farmJungle), pct(sh.fight), pct(sh.move), pct(sh.dead));
  });
  return parts.filter(Boolean).join(" ") || d.noTime;
}

export function deepItemsInsight(a: LabSide, b: LabSide | null, assets: LabAssets, t: R, n: Names) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      const fx = itemEffects(s, assets).filter((e) => e.lh[0] != null && e.lh[1] != null);
      const best = fx.sort((x, y) => y.lh[1]! - y.lh[0]! - (x.lh[1]! - x.lh[0]!))[0];
      if (!best) return "";
      return d.itemEffect(who(t, i), n.items(best.key), num(best.lh[0], 1), num(best.lh[1], 1));
    })
    .filter(Boolean)
    .join(" ");
}

export function deepSkillsInsight(a: LabSide, b: LabSide | null, t: R, n: Names) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      const ult = skillEfficiency(s).find((e) => e.ult && e.fights && e.fights[1] > 0);
      return ult ? d.ultLine(who(t, i), n.abilities(ult.key), ult.fights![0], ult.fights![1]) : "";
    })
    .filter(Boolean)
    .join(" ");
}

// Without STRATZ's parse a death's killer is known but not who else took part or was near: only
// teamfight or not, and the cost is the gold lost alone (no farm rate to price the time dead).
export function deepFightsInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      const ds = deathSummary(s);
      if (!s.advanced.deathDetails.length) return "";
      const near = s.advanced.deathDetails.some((x) => x.alliesNear != null);
      const parts = [
        s.parsed.stratz
          ? d.deathKinds(who(t, i), ds.kinds.fight, ds.kinds.gank, ds.kinds.pickoff, near ? ds.alone : null)
          : d.deathKindsOd(who(t, i), ds.kinds.fight, ds.kinds.gank + ds.kinds.pickoff + ds.kinds.other),
      ];
      if (ds.costly && ds.costly.cost! >= 300)
        parts.push(
          (ds.costly.farmMissed != null ? d.costlyDeath : d.costlyDeathLost)(
            clock(ds.costly.t),
            num(ds.costly.cost),
          ),
        );
      return parts.join("");
    })
    .filter(Boolean)
    .join(" ");
}

// Sides without positions (no STRATZ parse) are left out rather than shown as zeros.
export function deepMovementInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      if (!s.path.t.length || !s.advanced.alliesNear.length) return "";
      const m = movement(s);
      return d.moveLine(who(t, i), num(m.total / minutesOf(s)), pct(m.group.alone), m.tps.length);
    })
    .filter(Boolean)
    .join(" ");
}

export function deepVisionInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  return sides(a, b)
    .filter((s) => s.vision.wards.length >= 3)
    .map((s) => {
      const q = visionQuality(s);
      return d.visionLine(
        who(t, s === a ? 0 : 1),
        q.roles.aggressive,
        q.roles.defensive + q.roles.river,
        q.beforeObjective,
        pct(q.dewardedShare),
      );
    })
    .join(" ");
}

export function deepGoldInsight(a: LabSide, b: LabSide | null, assets: LabAssets, t: R) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      const bk = banking(s, assets);
      return bk ? d.bankLine(who(t, i), num(bk.avg), bk.readyShare != null ? pct(bk.readyShare) : "–") : "";
    })
    .filter(Boolean)
    .join(" ");
}

export function deepLaningInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      if (!s.advanced.damage.length) return "";
      const tr = laneTrades(s);
      return d.tradeLine(who(t, i), num(tr.out), num(tr.in));
    })
    .filter(Boolean)
    .join(" ");
}

// Against the same hero's average at the match's rank: the curve gaps that matter.
export function baselineInsight(s: LabSide, t: R, label: string) {
  const bl = s.advanced.baseline;
  if (!bl) return "";
  const at = (arr: (number | null)[], m: number) => arr[Math.min(m, arr.length - 1)] ?? null;
  const parts: string[] = [];
  for (const m of [10, 20]) {
    const mine = s.minutes.netWorth[m];
    const avg = at(bl.minutes.networth, m);
    if (mine != null && avg) {
      const d = mine / avg - 1;
      parts.push(
        Math.abs(d) < 0.005
          ? t.deep.vsAverageEven(label, m)
          : t.deep.vsAverage(label, m, `${d > 0 ? "+" : "−"}${pct(Math.abs(d))}`),
      );
    }
  }
  return parts.join(" ");
}

// Kept in one place so the summary can draw on it.
export function deepSummary(a: LabSide, b: LabSide | null, assets: LabAssets, t: R, n: Names) {
  const lines = [
    baselineInsight(a, t, t.insight.a),
    b ? baselineInsight(b, t, t.insight.b) : "",
    timeInsight(a, b, t),
    deepItemsInsight(a, b, assets, t, n),
    deepFightsInsight(a, b, t),
  ];
  return lines.filter(Boolean);
}

// The deeper numbers for "biggest differences".
// Time use, grouping and movement depend on the role: no side is 'better' (except farming for
// cores); the windowed versions take the first `until` seconds.
const farmShare = (s: LabSide, until = Infinity) => {
  if (!s.advanced.activity.length) return null;
  const sh = activityShares(s, -Infinity, until).shares;
  return sh.farmLane + sh.farmJungle;
};
export const DEEP_METRICS: Metric[] = [
  {
    key: "farmPct",
    fmt: "pct",
    higher: null,
    get: (s) => farmShare(s),
    getUntil: (s, u) => farmShare(s, u),
    dir: (s) => (s.position != null && s.position <= 3 ? true : null),
  },
  {
    key: "fightPct",
    fmt: "pct",
    higher: null,
    get: (s) => (s.advanced.activity.length ? activityShares(s).shares.fight : null),
    getUntil: (s, u) => (s.advanced.activity.length ? activityShares(s, -Infinity, u).shares.fight : null),
  },
  {
    key: "movePct",
    fmt: "pct",
    higher: null,
    get: (s) => (s.advanced.activity.length ? activityShares(s).shares.move : null),
    getUntil: (s, u) => (s.advanced.activity.length ? activityShares(s, -Infinity, u).shares.move : null),
  },
  {
    key: "unspentAvg",
    fmt: "int",
    higher: false,
    get: (s) => banking(s)?.avg ?? null,
    getUntil: (s, u) => banking(s, undefined, u)?.avg ?? null,
  },
  {
    key: "alonePct",
    fmt: "pct",
    higher: null,
    get: (s) => (s.advanced.alliesNear.length ? movement(s).group.alone : null),
  },
  {
    key: "distPm",
    fmt: "int",
    higher: null,
    get: (s) => (s.path.t.length ? movement(s).total / minutesOf(s) : null),
  },
  {
    key: "trade10",
    fmt: "int",
    higher: true,
    get: (s) => (s.advanced.damage.length ? laneTrades(s).out : null),
  },
  {
    key: "taken10",
    fmt: "int",
    higher: false,
    get: (s) => (s.advanced.damage.length ? laneTrades(s).in : null),
  },
  {
    key: "ultUse",
    fmt: "pct",
    higher: true,
    sameHero: true,
    get: (s) => {
      const u = skillEfficiency(s).find((e) => e.ult && e.fights && e.fights[1] > 0);
      return u ? u.fights![0] / u.fights![1] : null;
    },
  },
];

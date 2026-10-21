import type { Dictionary } from "@/i18n/dictionaries";
import type { Activity } from "@/lib/dota/lab-extra";
import type { LabAssets, LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { areaOf, firstBuys, type Metric, minutesOf, num, pct, valueAt } from "./insights";

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

// Five minutes before a key item and five after: gold, last hits and hero damage per minute.
export function itemEffects(s: LabSide, assets: LabAssets) {
  const rate = (arr: number[], a: number, b: number) => {
    const va = valueAt(arr, a);
    const vb = valueAt(arr, b);
    return va == null || vb == null || b <= a ? null : ((vb - va) / (b - a)) * 60;
  };
  return [...firstBuys(s, assets).entries()]
    .filter(([, t]) => t > 120)
    .map(([key, t]) => {
      const before = Math.max(0, t - 300);
      const after = Math.min(s.duration, t + 300);
      return {
        key,
        t,
        baseline: s.advanced.baseline?.items[key]?.time ?? null,
        gold: [rate(s.minutes.gold, before, t), rate(s.minutes.gold, t, after)] as const,
        lh: [rate(s.minutes.lh, before, t), rate(s.minutes.lh, t, after)] as const,
        dmg: [rate(s.minutes.heroDamage, before, t), rate(s.minutes.heroDamage, t, after)] as const,
      };
    });
}

// Active items' use in the teamfights joined after buying them.
export function itemFightUse(s: LabSide, assets: LabAssets) {
  const buys = firstBuys(s, assets);
  const out: { key: string; fights: number; used: number }[] = [];
  for (const [key, t] of buys) {
    if (!s.items.useTimes.some((u) => u.key === key)) continue;
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
    const casts =
      s.skills.useTimes.find((u) => u.key === key)?.times.length ??
      s.skills.uses.find((u) => u.key === key)?.count ??
      0;
    const ult = cds.length === 3 && levels[0] >= 300;
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
export function movement(s: LabSide) {
  const { t, x, y } = s.path;
  const dist = PHASES.map(() => 0);
  for (let i = 1; i < t.length; i++) {
    const d = Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]) * 128;
    // A jump of more than 3,000 units in 10 s is a teleport or respawn, not walking.
    if (d > 3000) continue;
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
  const lived = (kind: "obs" | "sen") => {
    const list = wards.filter((w) => w.kind === kind && w.end != null).map((w) => w.end! - w.t);
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
  };
  const killed = wards.filter((w) => w.killedBy != null).length;
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

export function banking(s: LabSide) {
  const u = s.advanced.unspent;
  if (!u.length) return null;
  const alive = s.advanced.activity.length ? s.advanced.activity.map((a) => a !== "dead") : u.map(() => true);
  const live = u.filter((_, i) => alive[i] && s.path.t[i] > 0);
  const perMinute = Array.from({ length: Math.floor(s.duration / 60) + 1 }, (_, m) => {
    const vals = u.filter((_, i) => s.path.t[i] >= m * 60 && s.path.t[i] < (m + 1) * 60);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  return {
    avg: live.length ? live.reduce((a, b) => a + b, 0) / live.length : 0,
    max: Math.max(0, ...u),
    over1500: live.length ? live.filter((v) => v >= 1500).length / live.length : 0,
    perMinute,
  };
}

// ── Deaths and the game ──────────────────────────────────────────────────────────────────────

export function deathSummary(s: LabSide) {
  const d = s.advanced.deathDetails;
  const kinds = { fight: 0, gank: 0, pickoff: 0, other: 0 };
  for (const x of d) kinds[x.kind]++;
  const costly = [...d].filter((x) => x.swing != null).sort((a, b) => a.swing! - b.swing!)[0] ?? null;
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

export function timeInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  const parts = sides(a, b).map((s, i) => {
    const sh = activityShares(s).shares;
    return d.timeLine(who(t, i), pct(sh.farmLane + sh.farmJungle), pct(sh.fight), pct(sh.move), pct(sh.dead));
  });
  return a.advanced.activity.length ? parts.join(" ") : d.noTime;
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

export function deepFightsInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      const ds = deathSummary(s);
      const parts = [d.deathKinds(who(t, i), ds.kinds.fight, ds.kinds.gank, ds.kinds.pickoff, ds.alone)];
      if (ds.costly && ds.costly.swing! < -0.05)
        parts.push(d.costlyDeath(clock(ds.costly.t), pct(-ds.costly.swing!)));
      return parts.join("");
    })
    .join(" ");
}

export function deepMovementInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  if (!a.advanced.alliesNear.length) return "";
  return sides(a, b)
    .map((s, i) => {
      const m = movement(s);
      return d.moveLine(who(t, i), num(m.total / minutesOf(s)), pct(m.group.alone), m.tps.length);
    })
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

export function deepGoldInsight(a: LabSide, b: LabSide | null, t: R) {
  const d = t.deep;
  return sides(a, b)
    .map((s, i) => {
      const bk = banking(s);
      return bk ? d.bankLine(who(t, i), num(bk.avg), pct(bk.over1500)) : "";
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
      parts.push(t.deep.vsAverage(label, m, `${d > 0 ? "+" : d < 0 ? "−" : ""}${pct(Math.abs(d))}`));
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
export const DEEP_METRICS: Metric[] = [
  {
    key: "farmPct",
    fmt: "pct",
    higher: true,
    get: (s) =>
      s.advanced.activity.length
        ? activityShares(s).shares.farmLane + activityShares(s).shares.farmJungle
        : null,
  },
  {
    key: "fightPct",
    fmt: "pct",
    higher: true,
    get: (s) => (s.advanced.activity.length ? activityShares(s).shares.fight : null),
  },
  {
    key: "movePct",
    fmt: "pct",
    higher: false,
    get: (s) => (s.advanced.activity.length ? activityShares(s).shares.move : null),
  },
  { key: "unspentAvg", fmt: "int", higher: false, get: (s) => banking(s)?.avg ?? null },
  {
    key: "alonePct",
    fmt: "pct",
    higher: false,
    get: (s) => (s.advanced.alliesNear.length ? movement(s).group.alone : null),
  },
  {
    key: "distPm",
    fmt: "int",
    higher: true,
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
    get: (s) => {
      const u = skillEfficiency(s).find((e) => e.ult && e.fights && e.fights[1] > 0);
      return u ? u.fights![0] / u.fights![1] : null;
    },
  },
];

"use client";

import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { type Metric, num, pct } from "../insights";
import { FarmingBlocks } from "./farming-blocks";
import {
  affordDelays,
  AFTER_LANE,
  coreDir,
  drought,
  farmSpan,
  isCore,
  lastHits,
  rhythm,
  routeStats,
  vsAverage,
  WALK_ALLOWANCE,
} from "./farming-calc";
import {
  droughtSentence,
  farmGapParts,
  gapSentence,
  signedPct,
  stateMatches,
  stateSentence,
} from "./farming-text";
import type { Ctx, LabModule, Lesson } from "./types";
import { sum } from "./util";

// Farming in depth: farm time against farm speed, the same game state, jungle routes, the farming
// rhythm, how and where the last hits were made, and how long the gold for each key item waited.

const sidesOf = (ctx: Ctx) => (ctx.b ? [ctx.a, ctx.b] : [ctx.a]);
const sideKey = (ctx: Ctx, s: LabSide) => (s === ctx.a ? "a" : "b");
// "A：" before a side's sentence when comparing, nothing for one side alone.
const lead = (ctx: Ctx, s: LabSide) =>
  ctx.b ? `${s === ctx.a ? ctx.t.insight.a : ctx.t.insight.b}${ctx.t.insight.colon}` : "";
// Two games compare over the shorter one's length.
const common = (ctx: Ctx) => Math.min(ctx.a.duration, ctx.b?.duration ?? ctx.a.duration);
// A core and a support farm apart by design: their farm is read side by side, not as a gap.
const sameRole = (ctx: Ctx) => !ctx.b || isCore(ctx.a) === isCore(ctx.b);
const relGap = (m: { va: number; vb: number }) =>
  Math.abs(m.va - m.vb) / Math.max(1, Math.abs(m.va), Math.abs(m.vb));

function farmingLines(ctx: Ctx): string[] {
  const x = ctx.t.x.farming;
  const out: string[] = [];
  if (ctx.b && sameRole(ctx)) {
    const until = common(ctx);
    const gap = gapSentence(
      farmSpan(ctx.a, 0, until),
      farmSpan(ctx.b, 0, until),
      ctx.t,
      `0:00–${clock(until)}`,
    );
    if (gap) out.push(gap);
    // The same state and phase where the two games' farm differs most.
    const m = stateMatches(ctx.a, ctx.b).sort((p, q) => relGap(q) - relGap(p))[0];
    if (m && relGap(m) >= 0.15) out.push(stateSentence(m, ctx.t));
  } else if (ctx.b) {
    for (const s of sidesOf(ctx)) {
      const sp = farmSpan(s, 0, s.duration);
      if (sp?.speed != null)
        out.push(lead(ctx, s) + x.insight.single(pct(sp.farm), num(sp.speed), num(sp.lhRate, 1)));
    }
  } else {
    const sp = farmSpan(ctx.a, 0, ctx.a.duration);
    if (sp?.speed != null) out.push(x.insight.single(pct(sp.farm), num(sp.speed), num(sp.lhRate, 1)));
    const d = droughtSentence(ctx.a, ctx.t);
    if (d) out.push(d);
  }
  // Without STRATZ: last hits per minute against the rank average.
  if (!out.length)
    for (const s of sidesOf(ctx)) {
      const v = vsAverage(s, 0, s.duration);
      if (v?.lh != null && v.avgLh != null)
        out.push(lead(ctx, s) + x.insight.lhOnly(num(v.lh, 1), num(v.avgLh, 1)));
    }
  return out.slice(0, 2);
}

// The item whose gold waited longest (above the buyback reserve from 30:00), when it's 90 s or more.
function longestHeld(s: LabSide, ctx: Ctx) {
  let best: { key: string; held: number } | null = null;
  for (const a of affordDelays(s, ctx.assets)) {
    const held = a.heldBuyback ?? a.held;
    if (held >= 90 && (!best || held > best.held)) best = { key: a.key, held };
  }
  return best;
}

function summary(ctx: Ctx) {
  const x = ctx.t.x.farming;
  const out: { text: string; w: number }[] = [];
  if (ctx.b) {
    const until = common(ctx);
    const p = farmGapParts(farmSpan(ctx.a, 0, until), farmSpan(ctx.b, 0, until));
    if (p && p.total >= 0.15 && sameRole(ctx)) {
      const who = p.who === "a" ? ctx.t.insight.a : ctx.t.insight.b;
      out.push({
        text:
          p.lever === "speed"
            ? x.summary.speed(who, pct(p.total), signedPct(p.speed), signedPct(p.time))
            : x.summary.time(who, pct(p.total), signedPct(p.time), signedPct(p.speed)),
        w: Math.min(1, 0.4 + 1.5 * p.size),
      });
    }
  } else if (isCore(ctx.a)) {
    const sp = farmSpan(ctx.a, 0, ctx.a.duration);
    if (sp?.speed != null) out.push({ text: x.summary.single(num(sp.speed), pct(sp.farm)), w: 0.2 });
  }
  for (const s of sidesOf(ctx)) {
    // A five-minute stretch at under half the usual farm (cores, whose job it is).
    const d = isCore(s) ? drought(s) : null;
    if (d?.unit === "gold" && d.median && d.value < d.median * 0.5)
      out.push({
        text: lead(ctx, s) + x.summary.drought(clock(d.from), clock(d.to), num(d.value), num(d.median)),
        w: Math.min(0.5, 0.2 + (1 - d.value / d.median) * 0.3),
      });
    const held = longestHeld(s, ctx);
    if (held)
      out.push({
        text: lead(ctx, s) + x.summary.held(ctx.names.items(held.key), x.seconds(held.held)),
        w: Math.min(0.4, 0.15 + held.held / 1200),
      });
  }
  return out;
}

// Time only moving or in base after 10:00, beyond 20 s of walking a stretch, at the player's own
// average farm while alive after 10:00 (cores).
function lessons(ctx: Ctx): Lesson[] {
  const x = ctx.t.x.farming;
  return sidesOf(ctx).flatMap((s): Lesson[] => {
    if (!isCore(s)) return [];
    const r = rhythm(s);
    const sp = farmSpan(s, AFTER_LANE, s.duration);
    if (!r?.idle.length || !sp?.alive) return [];
    const extra = sum(r.idle.map((g) => Math.max(0, g.d - WALK_ALLOWANCE)));
    const perAlive = sp.farmPm / sp.alive;
    const gold = Math.round((extra / 60) * perAlive);
    return gold > 0
      ? [
          {
            side: sideKey(ctx, s),
            text: x.lessons.idle(r.idle.length, x.seconds(extra), num(perAlive), num(gold)),
            gold,
          },
        ]
      : [];
  });
}

const goldDrought = (s: LabSide, until: number) => {
  const d = drought(s, until);
  return d?.unit === "gold" ? d.value : null;
};
// Last hits not by right-click (items, abilities, illusions and units), with 20 or more last hits.
const notRightClick = (s: LabSide, until: number) => {
  const hits = lastHits(s).filter((h) => h.t <= until);
  return hits.length >= 20 ? hits.filter((h) => h.src !== 0).length / hits.length : null;
};
const creepsPerCamp = (s: LabSide, until: number) => {
  const r = routeStats(s, -Infinity, until);
  return r && r.visits >= 5 ? r.perVisit : null;
};

const metrics: Metric[] = [
  {
    key: "farmSpeed",
    fmt: "int",
    higher: null,
    dir: coreDir,
    get: (s) => farmSpan(s, 0, s.duration)?.speed ?? null,
    getUntil: (s, u) => farmSpan(s, 0, u)?.speed ?? null,
    label: (t) => t.x.farming.metrics.farmSpeed,
  },
  {
    key: "farmDrought",
    fmt: "int",
    higher: null,
    dir: coreDir,
    get: (s) => goldDrought(s, Infinity),
    getUntil: goldDrought,
    label: (t) => t.x.farming.metrics.drought,
  },
  {
    key: "campCreeps",
    fmt: "dec",
    higher: null,
    get: (s) => creepsPerCamp(s, Infinity),
    getUntil: creepsPerCamp,
    label: (t) => t.x.farming.metrics.perVisit,
  },
  {
    key: "skillLh",
    fmt: "pct",
    higher: null,
    get: (s) => notRightClick(s, Infinity),
    getUntil: notRightClick,
    label: (t) => t.x.farming.metrics.skillLh,
  },
];

export const farmingModule: LabModule = {
  blocks: { farming: FarmingBlocks },
  insights: (ctx) => ({ farming: farmingLines(ctx) }),
  summary,
  metrics,
  lessons,
};

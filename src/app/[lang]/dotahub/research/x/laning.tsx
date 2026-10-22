"use client";

import type { LabSide } from "@/lib/dota/lab";
import { type Metric, num, pct, signed } from "../insights";
import { LaningBlocks, points, ThreatBlock } from "./laning-blocks";
import {
  creepShare,
  equilibrium,
  type LaneExpect,
  laneExpect,
  laneGaps,
  rotations,
  runeControl,
  threat,
} from "./laning-calc";
import type { Ctx, LabModule, Lesson } from "./types";

// Laning in depth: the matchup, the lane's totals, the wave, rotations and runes.

const sidesOf = (ctx: Ctx) => (ctx.b ? [ctx.a, ctx.b] : [ctx.a]);
const sideKey = (ctx: Ctx, s: LabSide) => (s === ctx.a ? "a" : "b");
// "A：" before a side's sentence when comparing, nothing for one side alone.
const lead = (ctx: Ctx, s: LabSide) =>
  ctx.b ? `${s === ctx.a ? ctx.t.insight.a : ctx.t.insight.b}${ctx.t.insight.colon}` : "";

// "favoured → won (as expected)", when the expectation and the result are both known.
function expectShort(ctx: Ctx, e: LaneExpect | null) {
  const x = ctx.t.x.laning;
  return e?.expected && e.actual && e.verdict != null
    ? x.expectShort(x.odds[e.expected], ctx.t.deep.laneResults[e.actual], x.verdicts[String(e.verdict)])
    : null;
}

function laningLines(ctx: Ctx): string[] {
  const x = ctx.t.x.laning;
  const d = ctx.t.deep;
  const out: string[] = [];
  if (ctx.b) {
    const a = expectShort(ctx, laneExpect(ctx.a));
    const b = expectShort(ctx, laneExpect(ctx.b));
    if (a || b) out.push(x.insightExpectPair(a ?? "–", b ?? "–"));
    const ga = laneGaps(ctx.a);
    const gb = laneGaps(ctx.b);
    if (ga?.total || gb?.total)
      out.push(
        x.insightGapsPair(
          ga?.total ? signed(ga.total.nw) : "–",
          gb?.total ? signed(gb.total.nw) : "–",
          ga?.same ? signed(ga.same.gapNw) : null,
          gb?.same ? signed(gb.same.gapNw) : null,
        ),
      );
  } else {
    const e = laneExpect(ctx.a);
    if (e?.expected && e.actual && e.verdict != null)
      out.push(
        x.insightExpect(
          "",
          x.odds[e.expected],
          pct(e.win),
          pct(e.loss),
          d.laneResults[e.actual],
          x.verdicts[String(e.verdict)],
        ),
      );
    const g = laneGaps(ctx.a);
    if (g?.total)
      out.push(
        x.insightGaps(
          "",
          g.minute,
          signed(g.total.nw),
          g.ours.length,
          g.theirs.length,
          g.same ? signed(g.same.gapNw) : null,
        ),
      );
  }
  // Without those: a wave held under the own tower.
  if (out.length < 2)
    for (const s of sidesOf(ctx)) {
      const q = equilibrium(s);
      if (q?.wave != null && q.counts.intoOwn >= 4) {
        out.push(x.insightWave(lead(ctx, s), q.counts.intoOwn));
        break;
      }
    }
  return out.slice(0, 2);
}

function contextLines(ctx: Ctx): string[] {
  const x = ctx.t.x.laning;
  if (ctx.b) {
    const ta = threat(ctx.a)?.avg;
    const tb = threat(ctx.b)?.avg;
    return ta != null || tb != null
      ? [x.insightDraftPair(ta != null ? points(ta) : "–", tb != null ? points(tb) : "–")]
      : [];
  }
  const th = threat(ctx.a);
  const w = th?.worst;
  if (!th || th.avg == null || !w || w.synergy == null || w.synergy >= 0) return [];
  return [
    x.insightThreat(
      "",
      ctx.names.heroes(w.hero),
      x.pp(points(w.synergy)),
      pct(w.takenShare),
      w.kills,
      points(th.avg),
    ),
  ];
}

function summary(ctx: Ctx) {
  const x = ctx.t.x.laning;
  const d = ctx.t.deep;
  const out: { text: string; w: number }[] = [];
  if (!ctx.b) {
    const s = ctx.a;
    const e = laneExpect(s);
    if (e?.expected && e.actual && e.verdict)
      out.push({
        text: (e.verdict < 0 ? x.sumExpectWorse : x.sumExpectBetter)(
          "",
          x.odds[e.expected],
          pct(e.win),
          d.laneResults[e.actual],
        ),
        w: 0.3 + 0.25 * Math.min(2, Math.abs(e.vsExpected ?? 0)),
      });
    const q = equilibrium(s);
    if (q?.wave != null && q.counts.intoOwn >= 4)
      out.push({ text: x.sumWave("", q.counts.intoOwn), w: Math.min(0.7, 0.2 + 0.05 * q.counts.intoOwn) });
    const r = rotations(s);
    if (r && r.mine.length >= 2)
      out.push({
        text: x.sumRotations("", r.mine.length, r.mine.filter((v) => v.outcome !== "nothing").length),
        w: Math.min(0.45, 0.15 + 0.05 * r.mine.length),
      });
    const power = runeControl(s)?.kinds.power;
    if (power && power.ours + power.theirs >= 3) {
      const share = power.ours / (power.ours + power.theirs);
      if (share <= 0.25 || share >= 0.75)
        out.push({ text: x.sumPower("", power.ours, power.ours + power.theirs), w: 0.2 });
    }
    const w = threat(s)?.worst;
    if (w?.synergy != null && w.synergy <= -2 && (w.takenShare ?? 0) >= 0.3)
      out.push({
        text: x.sumThreat("", ctx.names.heroes(w.hero), x.pp(points(w.synergy)), pct(w.takenShare)),
        w: 0.25 + (w.takenShare ?? 0) * 0.4,
      });
    return out;
  }
  const { a, b } = ctx;
  const ea = laneExpect(a);
  const eb = laneExpect(b);
  if (ea?.vsExpected != null && eb?.vsExpected != null) {
    const gap = Math.abs(ea.vsExpected - eb.vsExpected);
    if (gap >= 0.5)
      out.push({
        text: x.sumExpectPair(expectShort(ctx, ea) ?? "–", expectShort(ctx, eb) ?? "–"),
        w: Math.min(1, 0.25 + gap * 0.3),
      });
  }
  const ga = laneGaps(a);
  const gb = laneGaps(b);
  // Worth a line from 500 gold apart (two players of one lane share its total).
  if (ga?.total && gb?.total && Math.abs(ga.total.nw - gb.total.nw) >= 500)
    out.push({
      text: x.sumGaps(
        signed(ga.total.nw),
        signed(gb.total.nw),
        ga.same ? signed(ga.same.gapNw) : null,
        gb.same ? signed(gb.same.gapNw) : null,
      ),
      w: Math.min(1, Math.abs(ga.total.nw - gb.total.nw) / 4000),
    });
  const qa = equilibrium(a)?.wave;
  const qb = equilibrium(b)?.wave;
  if (qa != null && qb != null && Math.abs(qa - qb) >= 0.2)
    out.push({ text: x.sumWavePair(pct(qa), pct(qb)), w: Math.min(0.8, Math.abs(qa - qb) * 1.2) });
  const ra = rotations(a)?.mine.length;
  const rb = rotations(b)?.mine.length;
  if (ra != null && rb != null && Math.abs(ra - rb) >= 2)
    out.push({ text: x.sumRotationsPair(ra, rb), w: Math.min(0.6, 0.15 * Math.abs(ra - rb)) });
  const ta = threat(a)?.avg;
  const tb = threat(b)?.avg;
  if (ta != null && tb != null && Math.abs(ta - tb) >= 1.5)
    out.push({ text: x.sumDraft(points(ta), points(tb)), w: Math.min(0.7, Math.abs(ta - tb) / 4) });
  return out;
}

// The farm given up on rotations that brought nothing (an estimate from the lane's farm rate, less
// what was farmed elsewhere meanwhile), from 100 gold on.
function lessons(ctx: Ctx): Lesson[] {
  const x = ctx.t.x.laning;
  return sidesOf(ctx).flatMap((s): Lesson[] => {
    const r = rotations(s);
    if (!r?.home) return [];
    const empty = r.mine.filter((v) => v.outcome === "nothing" && (v.gold ?? 0) > 0);
    const gold = Math.round(empty.reduce((a, v) => a + (v.gold ?? 0), 0));
    return gold >= 100
      ? [{ side: sideKey(ctx, s), text: x.lessonRotation(empty.length, num(gold)), gold }]
      : [];
  });
}

const metrics: Metric[] = [
  {
    key: "laneTotal10",
    fmt: "signed",
    higher: true,
    get: (s) => laneGaps(s)?.total?.nw ?? null,
    label: (t) => t.x.laning.metrics.laneTotal10,
  },
  {
    key: "laneRole10",
    fmt: "signed",
    higher: true,
    get: (s) => laneGaps(s)?.role?.gapNw ?? null,
    label: (t) => t.x.laning.metrics.laneRole10,
  },
  {
    key: "lanePos10",
    fmt: "signed",
    higher: true,
    get: (s) => laneGaps(s)?.same?.gapNw ?? null,
    label: (t) => t.x.laning.metrics.lanePos10,
  },
  {
    key: "laneVsExp",
    fmt: "dec",
    higher: true,
    get: (s) => laneExpect(s)?.vsExpected ?? null,
    label: (t) => t.x.laning.metrics.laneVsExp,
  },
  {
    key: "wave12",
    fmt: "pct",
    higher: null,
    get: (s) => equilibrium(s)?.wave ?? null,
    label: (t) => t.x.laning.metrics.wave12,
  },
  {
    key: "creepShare10",
    fmt: "pct",
    higher: null,
    // Taking the lane's creeps is the cores' job.
    dir: (s) => (s.position != null && s.position <= 3 ? true : null),
    get: (s) => {
      const c = creepShare(s);
      return c?.total.reached ? c.total.you / c.total.reached : null;
    },
    label: (t) => t.x.laning.metrics.creepShare10,
  },
  {
    key: "rotations15",
    fmt: "int",
    higher: null,
    get: (s) => rotations(s)?.mine.length ?? null,
    label: (t) => t.x.laning.metrics.rotations15,
  },
  {
    key: "runeShare15",
    fmt: "pct",
    higher: true,
    get: (s) => runeControl(s)?.share ?? null,
    label: (t) => t.x.laning.metrics.runeShare15,
  },
];

export const laningModule: LabModule = {
  blocks: { context: ThreatBlock, laning: LaningBlocks },
  insights: (ctx) => ({ laning: laningLines(ctx), context: contextLines(ctx) }),
  summary,
  metrics,
  lessons,
};

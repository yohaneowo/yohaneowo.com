import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { type Metric, num, pct, signed } from "../insights";
import {
  cohesion,
  cohesionUntil,
  damageEfficiency,
  deathCost,
  deathRecaps,
  fightOutcomes,
  fightPrep,
  fightRecord,
  foreignDamage,
  isBurst,
  targetPriority,
  unusedAtDeath,
  uptimeOf,
} from "./fights-calc";
import type { Ctx, Lesson, SectionKey } from "./types";
import { mean } from "./util";

// The fights module's readings: one or two sentences for the fights and damage sections, lines for
// the top summary, rows for the differences table, and each death as a gold-valued lesson.

type Side = ["a" | "b", LabSide];
const sidesOf = (ctx: Ctx): Side[] =>
  ctx.b
    ? [
        ["a", ctx.a],
        ["b", ctx.b],
      ]
    : [["a", ctx.a]];
const who = (ctx: Ctx, k: "a" | "b") =>
  ctx.b ? ctx.t.x.fights.who(k === "a" ? ctx.t.insight.a : ctx.t.insight.b) : "";
const itemList = (ctx: Ctx, keys: string[]) => keys.map((k) => ctx.names.items(k)).join(ctx.t.insight.sep);

export function fightsInsights(ctx: Ctx): Partial<Record<SectionKey, string[]>> {
  const x = ctx.t.x.fights;
  const fights: string[] = [];
  const records = sidesOf(ctx).flatMap(([k, s]) => {
    const rec = fightRecord(fightOutcomes(s));
    if (rec.joined.n < 2) return [];
    return [
      x.inRecord(who(ctx, k), rec.joined.n, rec.joined.won, rec.joined.lost) +
        (rec.absent.n ? x.inAbsent(rec.absent.n, rec.absent.lost) : ""),
    ];
  });
  if (records.length) fights.push(records.join(x.sep) + x.end);
  const unused = sidesOf(ctx).flatMap(([k, s]) => {
    const list = deathRecaps(s, ctx.assets).filter((d) => unusedAtDeath(d).length);
    const last = list[list.length - 1];
    if (!last) return [];
    return [
      x.inUnused(
        who(ctx, k),
        list.length,
        clock(last.t),
        itemList(
          ctx,
          unusedAtDeath(last).map((i) => i.key),
        ),
      ),
    ];
  });
  if (unused.length) fights.push(unused.join(" "));

  const damage: string[] = [];
  const targets = sidesOf(ctx).flatMap(([k, s]) => {
    const tp = targetPriority(s, []);
    if (tp.coreDealt == null || tp.estimated) return [];
    return [
      x.inTargets(who(ctx, k), pct(tp.coreDealt)) +
        (tp.converted != null ? x.inConverted(pct(tp.converted)) : ""),
    ];
  });
  if (targets.length) damage.push(targets.join(x.sep) + x.end);
  const units = sidesOf(ctx).flatMap(([k, s]) => {
    const u = foreignDamage(s, ctx.assets, null, []).units;
    return u?.dealtShare != null && u.dealtShare >= 0.15 ? [x.inUnits(who(ctx, k), pct(u.dealtShare))] : [];
  });
  if (units.length) damage.push(units.join(" "));
  return { fights, damage };
}

const lostOf = (list: { o: { result: string } }[]) => list.filter((p) => p.o.result === "lost").length;
// Death cost per minute, only where the farm missed is known (else it's gold lost alone).
const costPerMin = (s: LabSide, until?: number) => {
  const c = deathCost(s, until);
  return c.full ? c.perMin : null;
};

export function fightsSummary(ctx: Ctx): { text: string; w: number }[] {
  const x = ctx.t.x.fights;
  const out: { text: string; w: number }[] = [];
  const per = sidesOf(ctx).map(([k, s]) => {
    const outcomes = fightOutcomes(s);
    return {
      k,
      s,
      rec: fightRecord(outcomes),
      unused: deathRecaps(s, ctx.assets).filter((d) => unusedAtDeath(d).length),
      prep: fightPrep(s, ctx.assets, outcomes),
    };
  });
  if (!ctx.b) {
    const { k, rec, unused, prep } = per[0];
    // Weighed by how many were lost and how much gold the team gave up in them.
    if (rec.absent.lost && rec.absent.gold != null && rec.absent.gold < 0)
      out.push({
        text: x.sumAbsent(who(ctx, k), rec.absent.n, signed(rec.absent.gold)),
        w: Math.min(0.8, 0.2 + 0.1 * rec.absent.lost + -rec.absent.gold / 5000),
      });
    const last = unused[unused.length - 1];
    if (last)
      out.push({
        text: x.sumUnused(
          who(ctx, k),
          unused.length,
          clock(last.t),
          itemList(
            ctx,
            unusedAtDeath(last).map((i) => i.key),
          ),
        ),
        w: Math.min(0.95, 0.45 + 0.15 * unused.length),
      });
    const notReady = prep.filter((p) => p.notReady);
    if (notReady.length >= 2)
      out.push({
        text: x.sumNotReady(who(ctx, k), notReady.length, lostOf(notReady)),
        w: Math.min(0.7, 0.25 + 0.08 * notReady.length),
      });
    return out;
  }

  const [pa, pb] = per;
  // Games whose lengths differ by 10% or more are compared over the part both have, as the
  // differences table does.
  const windowed = Math.abs(pa.s.duration - pb.s.duration) / Math.max(pa.s.duration, pb.s.duration, 1) >= 0.1;
  const until = windowed ? Math.min(pa.s.duration, pb.s.duration) : Infinity;
  const win = windowed ? x.window(clock(until)) : "";
  const ra = winRate(pa.s, until);
  const rb = winRate(pb.s, until);
  if (ra != null && rb != null && Math.abs(ra - rb) >= 0.2)
    out.push({ text: x.sumWin(pct(ra), pct(rb), win), w: Math.min(1, Math.abs(ra - rb) * 1.2) });
  // Items at deaths are only known with STRATZ's inventory on both sides.
  const ua = pa.unused.filter((d) => d.t <= until).length;
  const ub = pb.unused.filter((d) => d.t <= until).length;
  if (ua !== ub && [pa.s, pb.s].every((s) => s.advanced.inventory.length > 0))
    out.push({ text: x.sumUnusedPair(ua, ub, win), w: Math.min(0.9, 0.3 + 0.15 * Math.abs(ua - ub)) });
  const cores = [pa.s, pb.s].every((s) => s.position != null && s.position <= 3);
  const supports = [pa.s, pb.s].every((s) => s.position != null && s.position >= 4);
  const ea = damageEfficiency(pa.s, until).whole?.per1k;
  const eb = damageEfficiency(pb.s, until).whole?.per1k;
  if (ea && eb && (cores || supports)) {
    const rel = Math.abs(ea - eb) / Math.max(ea, eb);
    if (rel >= 0.25) out.push({ text: x.sumEff(num(ea, 1), num(eb, 1), win), w: Math.min(0.8, rel) });
  }
  // Right-click uptime says how a hero fights, so only between two players of the same hero.
  const up = (p: typeof pa) =>
    mean(p.prep.flatMap((f) => (f.uptime != null && f.o.start <= until ? [f.uptime] : [])));
  const upa = up(pa);
  const upb = up(pb);
  if (cores && pa.s.heroId === pb.s.heroId && upa != null && upb != null && Math.abs(upa - upb) >= 0.08)
    out.push({ text: x.sumUptime(pct(upa), pct(upb), win), w: Math.min(0.7, Math.abs(upa - upb) * 3) });
  const ca = costPerMin(pa.s, until);
  const cb = costPerMin(pb.s, until);
  if (ca != null && cb != null) {
    const rel = Math.abs(ca - cb) / Math.max(ca, cb, 1);
    if (rel >= 0.3) out.push({ text: x.sumCost(num(ca), num(cb), win), w: Math.min(0.75, rel * 0.8) });
  }
  return out;
}

// Higher is better for cores (positions 1–3); for supports neither way.
const coreDir = (s: LabSide) => (s.position != null && s.position <= 3 ? true : null);
const joined = (s: LabSide, until = Infinity) =>
  fightOutcomes(s).filter((o) => o.presence === "joined" && o.start <= until);
const meanOf = (list: (number | null)[]) => mean(list.filter((v): v is number => v != null));
const winRate = (s: LabSide, until?: number) => {
  const list = joined(s, until);
  return list.length >= 3 ? list.filter((o) => o.result === "won").length / list.length : null;
};
const uptimes = (s: LabSide, pick: "uptime" | "active", until?: number) =>
  s.parsed.stratz && s.advanced.damage.length
    ? meanOf(joined(s, until).map((o) => uptimeOf(s, o)[pick]))
    : null;

export const FIGHTS_METRICS: Metric[] = [
  {
    key: "fx.fightWin",
    fmt: "pct",
    higher: true,
    get: (s) => winRate(s),
    getUntil: winRate,
    label: (t) => t.x.fights.metrics.fightWin,
  },
  {
    key: "fx.fightDmgShare",
    fmt: "pct",
    higher: null,
    dir: coreDir,
    get: (s) => meanOf(joined(s).map((o) => o.dmgShare)),
    getUntil: (s, until) => meanOf(joined(s, until).map((o) => o.dmgShare)),
    label: (t) => t.x.fights.metrics.fightDmgShare,
  },
  {
    key: "fx.uptime",
    fmt: "pct",
    higher: null,
    dir: coreDir,
    // How much a hero right-clicks depends on the hero (spellcasters, Primal Split's spirits…).
    sameHero: true,
    get: (s) => uptimes(s, "uptime"),
    getUntil: (s, until) => uptimes(s, "uptime", until),
    label: (t) => t.x.fights.metrics.uptime,
  },
  {
    key: "fx.activeUptime",
    fmt: "pct",
    higher: true,
    get: (s) => uptimes(s, "active"),
    getUntil: (s, until) => uptimes(s, "active", until),
    label: (t) => t.x.fights.metrics.activeUptime,
  },
  {
    key: "fx.burstDeaths",
    fmt: "pct",
    higher: null,
    get: (s) => {
      if (!s.parsed.stratz || !s.advanced.damage.length) return null;
      const list = deathRecaps(s, null);
      return list.length >= 3 ? list.filter(isBurst).length / list.length : null;
    },
    label: (t) => t.x.fights.metrics.burstDeaths,
  },
  {
    key: "fx.converted",
    fmt: "pct",
    higher: true,
    get: (s) => targetPriority(s, []).converted,
    label: (t) => t.x.fights.metrics.converted,
  },
  {
    key: "fx.coreDamage",
    fmt: "pct",
    higher: null,
    dir: coreDir,
    // Only with STRATZ's positions (the net worth ranking is a guess).
    get: (s) => {
      const tp = targetPriority(s, []);
      return tp.estimated ? null : tp.coreDealt;
    },
    label: (t) => t.x.fights.metrics.coreDamage,
  },
  {
    key: "fx.dmgPer1k",
    fmt: "dec",
    // A support's small net worth makes the ratio large, so it's only judged between cores.
    higher: null,
    dir: coreDir,
    get: (s) => damageEfficiency(s).whole?.per1k ?? null,
    getUntil: (s, until) => damageEfficiency(s, until).whole?.per1k ?? null,
    label: (t) => t.x.fights.metrics.dmgPer1k,
  },
  {
    key: "fx.hdShare",
    fmt: "pct",
    higher: null,
    dir: coreDir,
    get: (s) => damageEfficiency(s).shares.heroDamage,
    label: (t) => t.x.fights.metrics.hdShare,
  },
  {
    key: "fx.deathCostPm",
    fmt: "int",
    higher: false,
    get: (s) => costPerMin(s),
    getUntil: (s, until) => costPerMin(s, until),
    label: (t) => t.x.fights.metrics.deathCostPm,
  },
  {
    key: "fx.zonesPm",
    fmt: "dec",
    higher: null,
    get: (s) => cohesion(s)?.whole.zonesPerMin ?? null,
    getUntil: (s, until) => cohesionUntil(s, until)?.zonesPerMin ?? null,
    label: (t) => t.x.fights.metrics.zonesPm,
  },
  {
    key: "fx.centroid",
    fmt: "int",
    higher: null,
    get: (s) => cohesion(s)?.whole.centroid ?? null,
    getUntil: (s, until) => cohesionUntil(s, until)?.centroid ?? null,
    label: (t) => t.x.fights.metrics.centroid,
  },
];

// Each death, valued at what the death table counts as its cost: gold lost plus farm missed while
// dead (gold and XP fed to the enemy named apart, not added).
export function fightsLessons(ctx: Ctx): Lesson[] {
  const x = ctx.t.x.fights;
  return sidesOf(ctx).flatMap(([k, s]) => {
    const recaps = new Map(deathRecaps(s, ctx.assets).map((d) => [d.t, d]));
    return s.advanced.deathDetails.flatMap((d): Lesson[] => {
      if (d.cost == null || d.cost <= 0) return [];
      const lost = num(d.goldLost ?? 0);
      const head =
        d.farmMissed == null
          ? x.lessonNoMissed(clock(d.t), lost)
          : d.goldLost
            ? x.lesson(clock(d.t), lost, num(d.farmMissed))
            : x.lessonMissedOnly(clock(d.t), num(d.farmMissed));
      const fed =
        d.goldFed != null
          ? x.lessonFed(x.fedValue(num(d.goldFed), d.xpFed != null ? num(d.xpFed) : null))
          : "";
      const recap = recaps.get(d.t);
      const unused = recap ? unusedAtDeath(recap).map((i) => i.key) : [];
      return [
        {
          side: k,
          text: head + fed + (unused.length ? x.lessonUnused(itemList(ctx, unused)) : "") + x.end,
          gold: d.cost,
        },
      ];
    });
  });
}

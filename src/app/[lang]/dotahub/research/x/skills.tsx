"use client";

import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { type Metric, pct } from "../insights";
import {
  BuffsBlock,
  BuildBlock,
  ConversionBlock,
  FightTargetsBlock,
  Guard,
  HeroBlock,
  ManaBlock,
  ReadingBlock,
  TalentBlock,
} from "./skills-blocks";
import {
  countOf,
  HERO_METRICS,
  kindsOf,
  lowManaShare,
  manaStats,
  mapFeatures,
  rareMax,
  rareTalent,
  talentDiffs,
  ultConversion,
  ultHeroes,
} from "./skills-calc";
import { BattleBlock, ChatBlock, MapBlock, OrdersBlock } from "./skills-misc";
import type { Ctx, LabModule, R } from "./types";

// Skills in depth: how to read the use rates, talents and the build against the rank, what the
// ultimate and the big spells led to and who they went to, mana, hero-specific metrics and stacks;
// and in 'misc', attack damage and regeneration, the map's features, more commands and the chat.

function SkillsBlocks() {
  return (
    <>
      <Guard>
        <ReadingBlock />
      </Guard>
      <Guard>
        <TalentBlock />
      </Guard>
      <Guard>
        <BuildBlock />
      </Guard>
      <Guard>
        <ConversionBlock />
      </Guard>
      <Guard>
        <FightTargetsBlock />
      </Guard>
      <Guard>
        <ManaBlock />
      </Guard>
      <Guard>
        <HeroBlock />
      </Guard>
      <Guard>
        <BuffsBlock />
      </Guard>
    </>
  );
}

function MiscBlocks() {
  return (
    <>
      <Guard>
        <BattleBlock />
      </Guard>
      <Guard>
        <MapBlock />
      </Guard>
      <Guard>
        <OrdersBlock />
      </Guard>
      <Guard>
        <ChatBlock />
      </Guard>
    </>
  );
}

const who = (t: R, i: number) => (i ? t.insight.b : t.insight.a);
const mmss = (v: number) => clock(Math.round(v));
const ratio = (c: { casts: number; converted: number } | null) => (c ? c.converted / c.casts : 0);

// ── Sentences ────────────────────────────────────────────────────────────────────────────────

// The two strongest readings of the section: what followed the ultimate, talents taken differently
// (or rarely), time short of mana, a core's damage spell used little, a rare max level.
function skillsInsights(ctx: Ctx): string[] {
  const { a, b, assets, t, names } = ctx;
  const x = t.x.skills;
  const sides = b ? [a, b] : [a];
  const same = !b || a.heroId === b.heroId;
  const out: { text: string; w: number }[] = [];
  // Two heroes: the numbers side by side, with a note that they don't compare directly.
  const apart = same ? "" : x.diffHero;

  const conv = sides.map((s) => ultConversion(s));
  if (b && conv[0] && conv[1])
    out.push({
      text: x.conv.pair(
        x.conv.ofCasts(conv[0].converted, conv[0].casts),
        x.conv.ofCasts(conv[1].converted, conv[1].casts),
        apart,
      ),
      w: 0.7,
    });
  else
    sides.forEach((s, i) => {
      const c = conv[i];
      if (c && c.casts >= 3 && s.skills.ult)
        out.push({
          text: x.conv.line(who(t, i), names.abilities(s.skills.ult), c.casts, c.converted),
          w: 0.6,
        });
    });

  const diffs = b ? talentDiffs(a, b, assets) : [];
  if (diffs[0])
    out.push({
      text: x.talents.differ(
        diffs[0].level,
        names.abilities(diffs[0].a),
        names.abilities(diffs[0].b),
        pct(diffs[0].sa),
        pct(diffs[0].sb),
      ),
      w: 0.55,
    });
  else if (!b || !same)
    sides.forEach((s, i) => {
      const r = rareTalent(s, assets, same);
      if (r)
        out.push({ text: x.talents.rare(who(t, i), r.level, names.abilities(r.key), pct(r.share)), w: 0.4 });
    });

  const low = sides.map((s) => {
    const share = lowManaShare(s);
    return share == null ? null : { secs: s.advanced.mana.lowSeconds, share };
  });
  if (b && low[0] && low[1] && Math.max(low[0].secs, low[1].secs) >= 60)
    out.push({
      text: x.mana.pair(
        x.mana.withShare(mmss(low[0].secs), pct(low[0].share, 1)),
        x.mana.withShare(mmss(low[1].secs), pct(low[1].share, 1)),
        apart,
      ),
      w: 0.5,
    });
  else
    low.forEach((l, i) => {
      if (l && l.secs >= 60)
        out.push({ text: x.mana.line(who(t, i), mmss(l.secs), pct(l.share, 1)), w: 0.5 });
    });

  sides.forEach((s, i) => {
    const e = kindsOf(s, assets).find((k) => k.low);
    if (e) out.push({ text: x.reading.low(who(t, i), names.abilities(e.key), pct(e.ratio)), w: 0.45 });
    const r = rareMax(s, assets);
    if (r?.ref && r.maxAt != null)
      out.push({
        text: x.build.rare(who(t, i), names.abilities(r.key), r.maxAt, pct(r.ref.share, 1)),
        w: 0.35,
      });
  });
  return out
    .sort((p, q) => q.w - p.w)
    .slice(0, 2)
    .map((p) => p.text);
}

// The map's features each side used, in one sentence.
function miscInsights(ctx: Ctx): string[] {
  const { a, b, t } = ctx;
  const x = t.x.skills.map;
  const c = x.counts;
  const parts = (b ? [a, b] : [a])
    .map((s, i) => {
      const f = mapFeatures(s);
      const items = (
        [
          [c.gates, f.trips ? f.trips.length : f.gateUses],
          [c.watchers, countOf(f.watchers)],
          [c.lotuses, countOf(f.lotuses)],
          [c.wisdom, f.wisdom.length],
          [c.outposts, f.outposts],
        ] as [(n: number) => string, number][]
      )
        .filter(([, n]) => n > 0)
        .map(([phrase, n]) => phrase(n));
      return items.length ? x.side(who(t, i), items.join(t.insight.sep)) : "";
    })
    .filter(Boolean);
  return parts.length ? [x.line(parts.join(x.join))] : [];
}

function summaryLines(ctx: Ctx) {
  const { a, b, assets, t, names } = ctx;
  const x = t.x.skills;
  const out: { text: string; w: number }[] = [];
  const ca = ultConversion(a);
  // Ultimates and mana only compare on the same hero.
  if (b && a.heroId !== b.heroId) return out;
  if (b) {
    const cb = ultConversion(b);
    if (ca && cb && ca.casts >= 3 && cb.casts >= 3) {
      const d = ratio(ca) - ratio(cb);
      if (Math.abs(d) >= 0.2)
        out.push({
          text: x.conv.summary(
            d > 0 ? t.insight.a : t.insight.b,
            x.conv.ofCasts(ca.converted, ca.casts),
            x.conv.ofCasts(cb.converted, cb.casts),
          ),
          w: Math.min(1, 0.3 + Math.abs(d)),
        });
    }
    const diffs = talentDiffs(a, b, assets);
    if (diffs.length)
      out.push({
        text: x.talents.summary(diffs.length, x.talents.levels(diffs.map((d) => d.level))),
        w: Math.min(0.6, 0.2 + 0.1 * diffs.length),
      });
    const la = lowManaShare(a);
    const lb = lowManaShare(b);
    if (la != null && lb != null) {
      const d = la - lb;
      if (Math.abs(d) >= 0.03 && Math.max(a.advanced.mana.lowSeconds, b.advanced.mana.lowSeconds) >= 60)
        out.push({
          text: x.mana.summary(
            d > 0 ? t.insight.a : t.insight.b,
            x.mana.withShare(mmss(a.advanced.mana.lowSeconds), pct(la, 1)),
            x.mana.withShare(mmss(b.advanced.mana.lowSeconds), pct(lb, 1)),
          ),
          w: Math.min(0.7, 0.2 + Math.abs(d) * 5),
        });
    }
    return out;
  }
  if (ca && ca.casts >= 4 && a.skills.ult)
    out.push({
      text: x.conv.line(t.insight.a, names.abilities(a.skills.ult), ca.casts, ca.converted),
      w: 0.3,
    });
  const m = manaStats(a, assets);
  if (m && m.lowShare >= 0.05)
    out.push({ text: x.mana.summarySingle(mmss(m.lowSeconds), pct(m.lowShare, 1)), w: 0.35 });
  return out;
}

// ── The rows for 'biggest differences' ───────────────────────────────────────────────────────

const ultConv = (s: LabSide, until = Infinity) => {
  const u = ultConversion(s, until);
  return u && u.casts >= 2 ? u.converted / u.casts : null;
};
const wisdom = (s: LabSide, until = Infinity) =>
  s.resources.runes.filter((r) => r.rune === "WISDOM" && r.t <= until).length;

const METRICS: Metric[] = [
  {
    key: "skillsUltConv",
    fmt: "pct",
    higher: true,
    sameHero: true,
    get: (s) => ultConv(s),
    getUntil: (s, until) => ultConv(s, until),
    label: (t) => t.x.skills.metrics.ultConv,
  },
  {
    key: "skillsUltHeroes",
    fmt: "dec",
    higher: true,
    sameHero: true,
    get: (s) => ultHeroes(s),
    getUntil: (s, until) => ultHeroes(s, until),
    label: (t) => t.x.skills.metrics.ultHeroes,
  },
  {
    // Mana pools and costs differ by hero.
    key: "skillsLowMana",
    fmt: "pct",
    higher: false,
    sameHero: true,
    get: lowManaShare,
    label: (t) => t.x.skills.metrics.lowMana,
  },
  {
    // Wisdom runes are a support's job.
    key: "skillsWisdom",
    fmt: "int",
    higher: null,
    dir: (s) => (s.position != null && s.position >= 4 ? true : null),
    get: (s) => wisdom(s),
    getUntil: (s, until) => wisdom(s, until),
    label: (t) => t.x.skills.metrics.wisdom,
  },
  // The hero-specific rates with a better side (hit rates, heroes per cast), when both are that hero.
  ...Object.entries(HERO_METRICS).flatMap(([hero, list]) =>
    list
      .filter((m) => m.higher != null)
      .map((m): Metric => ({
        key: `skillsHero_${m.key}`,
        fmt: m.fmt,
        higher: m.higher,
        sameHero: true,
        get: (s) => (s.heroId === Number(hero) ? (m.get(s)?.v ?? null) : null),
        label: (t) => t.x.skills.hero.names[m.key] ?? m.key,
      })),
  ),
];

export const skillsModule: LabModule = {
  blocks: { skills: SkillsBlocks, misc: MiscBlocks },
  insights: (ctx) => ({ skills: skillsInsights(ctx), misc: miscInsights(ctx) }),
  summary: summaryLines,
  metrics: METRICS,
};

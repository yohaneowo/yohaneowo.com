import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { num, pct } from "../insights";
import {
  comparability,
  type CompareKey,
  disconnectSpans,
  gameShape,
  type GameShape,
  heroRecord,
  lengthExplains,
  oneSided,
  ownPercentile,
  proPercentile,
  proRows,
  proStandout,
  type RowFmt,
  verdict,
} from "./history-calc";
import type { Ctx, R } from "./types";

// The history module's sentences: the section readings, the summary lines and the A–B verdict.

const P = (p: number) => Math.round(p * 100);
// Fewer games than this behind a percentile: the sentence says so.
const FEW = 10;

export function fmtValue(v: number | null | undefined, fmt: RowFmt) {
  if (v == null || !Number.isFinite(v)) return "–";
  if (fmt === "clock") return clock(Math.round(v));
  if (fmt === "pct") return pct(v);
  if (fmt === "dec") return num(v, 1);
  return num(v);
}

const few = (t: R, who: string, n: number) => (n < FEW ? t.x.history.few(who, n) : "");
const isMajor = (k: string) => k === "mode" || k === "hero" || k === "position";

// ── The verdict on A against B ───────────────────────────────────────────────────────────────

// The first thing that changes what the numbers mean, else the cautions (less those in `skip`,
// which the summary says on their own lines).
export function verdictText(a: LabSide, b: LabSide, t: R, skip: CompareKey[] = []) {
  const h = t.x.history;
  const v = verdict(comparability(a, b));
  const pos = (s: LabSide) => (s.position ? t.header.position(s.position) : h.unknown);
  const listed = v.caution.filter((k) => !skip.includes(k));
  const cautions = listed.map((k) => h.cautions[k] ?? k).join(t.insight.sep);
  const parts: string[] = [];
  if (v.sameMatch) parts.push(h.verdicts.sameMatch);
  if (v.kind === "mode") parts.push(h.verdicts.mode);
  else if (v.kind === "hero") parts.push(h.verdicts.hero);
  else if (v.kind === "position") parts.push(h.verdicts.position(pos(a), pos(b)));
  else if (v.kind === "caution" && listed.length) parts.push(h.verdicts.caution(cautions));
  else if (v.kind === "fine" && !v.sameMatch) parts.push(h.verdicts.fine);
  if (isMajor(v.kind) && listed.length) parts.push(h.verdicts.also(cautions));
  return { text: parts.join(""), kind: v.kind, listed: listed.length };
}

// ── The game's shape ─────────────────────────────────────────────────────────────────────────

export function shapeDetail(g: GameShape, t: R) {
  const h = t.x.history;
  const at = (m: number | null) => (m == null ? null : clock(m * 60));
  const lead =
    g.lead <= 0
      ? h.neverLed
      : g.leadAt != null
        ? h.lead(num(g.lead), at(g.leadAt)!)
        : h.leadOnly(num(g.lead));
  const deficit =
    g.deficit <= 0
      ? h.neverBehind
      : g.deficitAt != null
        ? h.deficit(num(g.deficit), at(g.deficitAt)!)
        : h.deficitOnly(num(g.deficit));
  return [lead, deficit, g.changes ? h.changes(g.changes) : ""].filter(Boolean).join(t.insight.sep);
}

// ── Section readings ─────────────────────────────────────────────────────────────────────────

// The rate the sentences read: GPM, or XPM once a support is involved (farm isn't their measure).
type Rate = "gpm" | "xpm";
const RATE_LABEL: Record<Rate, string> = { gpm: "GPM", xpm: "XPM" };
const rateOf = (...sides: LabSide[]): Rate =>
  sides.some((s) => s.position != null && s.position >= 4) ? "xpm" : "gpm";

// The sentence's ending: a caution when the game's length sits at the same extreme as the rate
// (per-minute numbers move with it), else a full stop.
function lengthEnd(t: R, s: LabSide, p: number, pro: boolean) {
  const l = lengthExplains(s, p, pro);
  return l ? t.x.history.lengthToo(l.longer, P(l.pct), pro) : null;
}
function pairLengthEnd(t: R, a: LabSide, pa: number, b: LabSide, pb: number, pro: boolean) {
  const h = t.x.history;
  const la = lengthExplains(a, pa, pro);
  const lb = lengthExplains(b, pb, pro);
  if (la && lb && la.longer === lb.longer) return h.lengthBoth(la.longer, pro);
  const list = [
    la ? h.lengthPart(t.insight.a, la.longer, pro) : "",
    lb ? h.lengthPart(t.insight.b, lb.longer, pro) : "",
  ].filter(Boolean);
  return list.length ? h.lengthPair(list.join(t.insight.sep)) : null;
}

// The player's own games: the rate's percentile, and whether the length caution was said.
function ownPart(ctx: Ctx): { text: string; length: boolean } {
  const { a, b, t } = ctx;
  const h = t.x.history;
  const none = { text: "", length: false };
  const say = (head: string, end: string | null) => ({ text: `${head}${end ?? h.end}`, length: end != null });
  if (!b) {
    const k = rateOf(a);
    const o = ownPercentile(a, k);
    return o
      ? say(h.ownSingle(RATE_LABEL[k], num(a.totals[k]), P(o.pct), o.n), lengthEnd(t, a, o.pct, false))
      : none;
  }
  const k = rateOf(a, b);
  const oa = ownPercentile(a, k);
  const ob = ownPercentile(b, k);
  if (oa && ob)
    return say(
      `${h.ownPair(RATE_LABEL[k], P(oa.pct), P(ob.pct))}${few(t, t.insight.a, oa.n)}${few(t, t.insight.b, ob.n)}`,
      pairLengthEnd(t, a, oa.pct, b, ob.pct, false),
    );
  const one = oa ? { who: t.insight.a, s: a, o: oa } : ob ? { who: t.insight.b, s: b, o: ob } : null;
  return one
    ? say(
        h.ownSide(one.who, RATE_LABEL[k], num(one.s.totals[k]), P(one.o.pct), one.o.n),
        lengthEnd(t, one.s, one.o.pct, false),
      )
    : none;
}

// The pro metric that stands out; the length caution once (`said`: the sentence before had it).
function proSingleLine(s: LabSide, t: R, said = false) {
  const h = t.x.history;
  const top = proStandout(s);
  if (!top) return null;
  const row = proRows(s).find((r) => r.key === top.key);
  // Only the whole-game rates move with the length (10-minute values and shares don't).
  const rate = top.key === "gpm" || top.key === "xpm";
  const end = rate && !said ? lengthEnd(t, s, top.r.pct, true) : null;
  return {
    pct: top.r.pct,
    n: top.r.n,
    length: rate && lengthExplains(s, top.r.pct, true) != null,
    text: `${h.proSingle(h.rows[top.key] ?? top.key, fmtValue(top.r.value, row?.fmt ?? "int"), P(top.r.pct), top.r.n)}${end ?? h.end}`,
  };
}

function proPart(ctx: Ctx, said: boolean) {
  const { a, b, t } = ctx;
  if (!b) return proSingleLine(a, t, said)?.text ?? "";
  const k = rateOf(a, b);
  const pa = proPercentile(a, k);
  const pb = proPercentile(b, k);
  if (!pa || !pb) return "";
  // One reference when both played the hero in the same patch, else each side's own.
  const shared = a.heroId === b.heroId && a.refs.pro?.patch === b.refs.pro?.patch;
  const end = said ? null : pairLengthEnd(t, a, pa.pct, b, pb.pct, true);
  return `${t.x.history.proPair(RATE_LABEL[k], P(pa.pct), P(pb.pct), shared)}${end ?? t.x.history.end}`;
}

export function refsInsight(ctx: Ctx): string[] {
  const own = ownPart(ctx);
  return [own.text, proPart(ctx, own.length)].filter(Boolean);
}

// Pauses, disconnects and leavers once the game started.
function inGameEvents(s: LabSide) {
  return {
    pauses: s.match.pauses.filter((p) => p.t >= 0).length,
    drops: disconnectSpans(s).filter((d) => d.t >= 0 && d.event !== "reconnect").length,
    leavers: s.match.leavers.length,
  };
}

// Two games' shapes: said when they differ (one match has one shape, whoever's side it's seen from).
function shapePairLine(a: LabSide, b: LabSide, t: R) {
  if (a.matchId === b.matchId) return null;
  const h = t.x.history;
  const ga = gameShape(a);
  const gb = gameShape(b);
  if (!ga || !gb) return null;
  return {
    text:
      ga.kind === gb.kind
        ? h.shapeSame(h.shapeKinds[ga.kind])
        : h.shapePair(h.shapeKinds[ga.kind], h.shapeKinds[gb.kind]),
    differ: oneSided(ga.kind) !== oneSided(gb.kind),
  };
}

export function contextInsight(ctx: Ctx): string[] {
  const { a, b, t } = ctx;
  const h = t.x.history;
  if (b) {
    // The shapes get their own sentence, so the verdict leaves them out.
    const shape = shapePairLine(a, b, t);
    return [verdictText(a, b, t, shape ? ["shape"] : []).text, shape?.text ?? ""].filter(Boolean);
  }
  const out: string[] = [];
  const g = gameShape(a);
  if (g) out.push(h.shapeSingle(h.shapeKinds[g.kind], shapeDetail(g, t)));
  const q = inGameEvents(a);
  if (q.pauses || q.drops || q.leavers) out.push(h.qualityLine(q.pauses, q.drops, q.leavers));
  return out;
}

// ── Summary lines ────────────────────────────────────────────────────────────────────────────

export function historySummary(ctx: Ctx): { text: string; w: number }[] {
  const { a, b, t } = ctx;
  const h = t.x.history;
  const out: { text: string; w: number }[] = [];

  if (!b) {
    // How unusual the game was for the player, on the rate that stands out most (a support's farm
    // isn't their measure; last hits are a core's).
    const keys: ("gpm" | "xpm" | "lhpm")[] =
      a.position == null ? ["gpm", "xpm"] : a.position <= 3 ? ["gpm", "xpm", "lhpm"] : ["xpm"];
    const top = keys
      .map((k) => ({ k, o: ownPercentile(a, k) }))
      .filter((x): x is { k: "gpm" | "xpm" | "lhpm"; o: { pct: number; n: number } } => !!x.o && x.o.n >= FEW)
      .sort((x, y) => Math.abs(y.o.pct - 0.5) - Math.abs(x.o.pct - 0.5))[0];
    let said = false;
    if (top && Math.abs(top.o.pct - 0.5) >= 0.35) {
      const v =
        top.k === "lhpm" ? num(a.totals.lastHits / Math.max(1, a.duration / 60), 1) : num(a.totals[top.k]);
      const label = top.k === "lhpm" ? h.rows.lhpm : top.k.toUpperCase();
      // A length at the same extreme explains part of it: said, and weighed less.
      const end = lengthEnd(t, a, top.o.pct, false);
      said = end != null;
      out.push({
        text: `${h.ownSingle(label, v, P(top.o.pct), top.o.n)}${end ?? (top.o.pct > 0.5 ? h.unusualGood : h.unusualBad)}`,
        w: (0.3 + (Math.abs(top.o.pct - 0.5) - 0.35) * 2) * (end ? 0.5 : 1),
      });
    }
    // Against the pros, when it is far from their middle (not when the length explains both).
    const pro = proSingleLine(a, t);
    if (pro && pro.n >= 20 && Math.abs(pro.pct - 0.5) >= 0.4 && !(said && pro.length))
      out.push({ text: pro.text, w: pro.length ? 0.15 : 0.3 });
    // A one-sided game or a comeback frames everything else.
    const g = gameShape(a);
    if (g && g.kind !== "close" && g.kind !== "contested")
      out.push({ text: h.shapeSingle(h.shapeKinds[g.kind], shapeDetail(g, t)), w: 0.2 });
    return out;
  }

  // Whose game was the more unusual one for them (unless the lengths explain it).
  const k = rateOf(a, b);
  const oa = ownPercentile(a, k);
  const ob = ownPercentile(b, k);
  if (oa && ob && Math.abs(oa.pct - ob.pct) >= 0.3) {
    const aHigher = oa.pct > ob.pct;
    const [hi, lo] = aHigher ? [oa, ob] : [ob, oa];
    const length = pairLengthEnd(t, a, oa.pct, b, ob.pct, false);
    const meaning =
      length ??
      (hi.pct >= 0.6 && lo.pct <= 0.4
        ? h.pairMeaning(aHigher ? t.insight.a : t.insight.b, aHigher ? t.insight.b : t.insight.a)
        : h.end);
    out.push({
      text: `${h.ownPair(RATE_LABEL[k], P(oa.pct), P(ob.pct))}${few(t, t.insight.a, oa.n)}${few(t, t.insight.b, ob.n)}${meaning}`,
      w: Math.abs(oa.pct - ob.pct) * (length ? 0.4 : 0.7),
    });
  }

  // Experience on the hero.
  const ea = heroRecord(a)?.games;
  const eb = heroRecord(b)?.games;
  const expGap = ea != null && eb != null && Math.max(ea, eb) / Math.max(1, Math.min(ea, eb)) >= 4;
  if (expGap) out.push({ text: h.expGap(num(ea), num(eb), a.heroId === b.heroId), w: 0.35 });

  // The games' shapes, when one was one-sided and the other not.
  const shape = shapePairLine(a, b, t);
  if (shape?.differ) out.push({ text: shape.text, w: 0.4 });

  // How alike the two games are (what has its own line above is left out).
  const skip: CompareKey[] = [
    ...(expGap ? (["experience"] as const) : []),
    ...(shape?.differ ? (["shape"] as const) : []),
  ];
  const v = verdictText(a, b, t, skip);
  if (isMajor(v.kind)) out.push({ text: v.text, w: 0.85 });
  else if (v.kind === "caution" && v.listed) out.push({ text: v.text, w: 0.3 });
  return out;
}

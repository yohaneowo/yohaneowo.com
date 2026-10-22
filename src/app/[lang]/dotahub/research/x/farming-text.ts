import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { ACTIVITIES, PHASES } from "../advanced";
import { num, pct } from "../insights";
import {
  drought,
  type FarmSpan,
  farmGap,
  GAME_STATES,
  type GameState,
  hasGoldLog,
  STATE_MIN,
  stateRates,
} from "./farming-calc";
import type { R } from "./types";

// The farming module's sentences, shared by its blocks and its readings. Sentences about one side have
// no subject: the caller puts "A：" before them when comparing.

export const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.round(Math.abs(v) * 100)}%`;

// Which side farms more while farming over the same span, and whether the time spent farming or the
// speed explains more of it (the parts multiply: compared in logs).
export function farmGapParts(sa: FarmSpan | null, sb: FarmSpan | null) {
  const g = sa && sb ? farmGap(sa, sb) : null;
  if (!g) return null;
  const aMore = g.total >= 1;
  const flip = (v: number) => (aMore ? v : 1 / v);
  return {
    who: aMore ? ("a" as const) : ("b" as const),
    total: flip(g.total) - 1,
    time: flip(g.time) - 1,
    speed: flip(g.speed) - 1,
    lever: Math.abs(Math.log(g.time)) >= Math.abs(Math.log(g.speed)) ? ("time" as const) : ("speed" as const),
    size: Math.abs(Math.log(g.total)),
  };
}

export function gapSentence(sa: FarmSpan | null, sb: FarmSpan | null, t: R, window: string | null) {
  const p = farmGapParts(sa, sb);
  if (!p) return null;
  const f = t.x.farming.speed;
  return (
    f.gap(p.who === "a" ? t.insight.a : t.insight.b, pct(p.total), signedPct(p.time), signedPct(p.speed)) +
    (window ? f.gapWindow(window) : "") +
    f.gapBy[p.lever]
  );
}

export function droughtSentence(s: LabSide, t: R) {
  const d = drought(s);
  if (!d) return null;
  const f = t.x.farming.speed;
  if (d.unit === "lh") return f.droughtLh(clock(d.from), clock(d.to), num(d.value, 1), num(d.median, 1));
  const sh = d.shares;
  const doing = sh
    ? ACTIVITIES.filter((x) => sh[x] >= 0.1)
        .sort((x, y) => sh[y] - sh[x])
        .map((x) => `${t.deep.activities[x]} ${pct(sh[x])}`)
        .join(t.insight.sep)
    : "";
  return f.drought(clock(d.from), clock(d.to), num(d.value), num(d.median), doing ? f.doing(doing) : "");
}

// The state and phase cells both games spent at least STATE_MIN minutes in, with their farm per minute
// (creep and neutral gold with STRATZ's gold log on both sides, else last hits).
export function stateMatches(a: LabSide, b: LabSide) {
  const gold = hasGoldLog(a) && hasGoldLog(b);
  const out: { state: GameState; phase: number; minutes: number; va: number; vb: number; gold: boolean }[] =
    [];
  for (const state of GAME_STATES)
    PHASES.forEach((_, phase) => {
      const ra = stateRates(a, state, phase);
      const rb = stateRates(b, state, phase);
      const va = gold ? ra.farm : ra.lh;
      const vb = gold ? rb.farm : rb.lh;
      if (ra.minutes >= STATE_MIN && rb.minutes >= STATE_MIN && va != null && vb != null)
        out.push({ state, phase, minutes: Math.min(ra.minutes, rb.minutes), va, vb, gold });
    });
  return out;
}

// Farm gold a minute, or last hits a minute when a side has no gold log.
export function stateSentence(m: ReturnType<typeof stateMatches>[number], t: R) {
  const f = t.x.farming;
  const v = (x: number) => (m.gold ? num(x) : num(x, 1));
  return (m.gold ? f.insight.state : f.insight.stateLh)(
    f.state.states[m.state],
    t.deep.phaseNames[m.phase],
    v(m.va),
    v(m.vb),
  );
}

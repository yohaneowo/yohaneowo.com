// 绝活 (signature heroes): which heroes, at which position, a player is clearly good at, from their
// ranked history. Two ways in, both needing evidence (playing a hero a lot alone isn't enough):
//   advantage  better on it than on the player's other heroes (win rate or IMP), by probability;
//   mastery    steadily above the hero's own average (STRATZ IMP: 0 is the same hero and position's
//              average), over several half-years.
// Many matches without that evidence is 高熟练 (skilled / frequent), shown apart. The method and its
// reasons are in docs/dota-signature-heroes-v2.md. Every number below is a starting point to calibrate,
// not a validated standard.

export const SIGNATURE = {
  // The pool: a hero × position with this many ranked matches, and the recent window.
  minHistory: 50,
  recentDays: 180,
  minRecent: 20,
  // Shrinking: pseudo-matches pulling a win rate (to the baseline) and a mean IMP (to the baseline
  // or 0) in, so few matches can't look extreme.
  kWin: 30,
  kImp: 20,
  // How far above the baseline counts (win rate as a share, IMP in points), and how sure.
  winDelta: 0.03,
  impDelta: 2,
  probability: 0.8,
  // The other heroes need this many matches to be a baseline.
  minBaseline: 50,
  // Leave out each hero's first matches when judging how good (0: off).
  learningSkip: 0,
  // Mastery holds over time: half-years with enough matches, most of them above 0.
  windowDays: 182,
  minWindow: 10,
  windowShare: 0.6,
  // Without evidence: close (this sure) or too little IMP to tell makes a 高熟练候选.
  nearProbability: 0.6,
  minImpCoverage: 0.5,
  // Recent IMP this much above or below the older matches: rising or falling.
  trendImp: 5,
} as const;

import type { HistoryMatch } from "./stratz";

export type { HistoryMatch };
export type SignatureLabel = "current" | "historic" | "potential" | "skilled" | "frequent";
export type SignaturePath = "advantage" | "mastery";

export type Signature = {
  hero: number;
  // 1–5; 0 when STRATZ doesn't know the position.
  pos: number;
  label: SignatureLabel;
  paths: SignaturePath[];
  matches: number;
  wins: number;
  winRate: number;
  shrunkWinRate: number;
  // The other heroes' win rate and mean IMP (null: too few to be a baseline).
  baselineWinRate: number | null;
  baselineImp: number | null;
  winProbability: number | null;
  impProbability: number | null;
  masteryProbability: number | null;
  imp: { matches: number; mean: number; shrunk: number } | null;
  windows: { positive: number; total: number };
  recent: { matches: number; wins: number; imp: number | null };
  trend: "up" | "down" | null;
  first: number;
  last: number;
};

export type SignatureReport = {
  signatures: Signature[];
  coverage: { matches: number; withImp: number; withPosition: number; since: number | null };
};

// The standard normal CDF (Abramowitz–Stegun 7.1.26 for erf).
function phi(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
function sd(values: number[]) {
  if (values.length < 2) return 25;
  const m = mean(values);
  return Math.max(1, Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1)));
}

// A Beta's mean and variance.
const beta = (a: number, b: number) => ({
  mean: a / (a + b),
  variance: (a * b) / ((a + b) ** 2 * (a + b + 1)),
});

// P(the hero's true win rate − the baseline's > winDelta): the hero's wins shrunk to the baseline
// (kWin pseudo-matches), against the baseline's own uncertainty; normal approximation of the two Betas.
function winProbability(wins: number, n: number, baseWins: number, baseN: number) {
  const base = (baseWins + 1) / (baseN + 2);
  const h = beta(wins + SIGNATURE.kWin * base, n - wins + SIGNATURE.kWin * (1 - base));
  const b = beta(baseWins + 1, baseN - baseWins + 1);
  return 1 - phi((SIGNATURE.winDelta - (h.mean - b.mean)) / Math.sqrt(h.variance + b.variance));
}

// P(the hero's true mean IMP − the baseline's > impDelta), the hero's shrunk to the baseline.
function impProbability(imps: number[], base: number[]) {
  const mb = mean(base);
  const n = imps.length + SIGNATURE.kImp;
  const mh = (imps.reduce((a, b) => a + b, 0) + SIGNATURE.kImp * mb) / n;
  const se = Math.sqrt(sd(imps) ** 2 / n + sd(base) ** 2 / base.length);
  return 1 - phi((SIGNATURE.impDelta - (mh - mb)) / se);
}

// The mean IMP shrunk to 0 (the hero's average player) and P(it's really above 0).
function mastery(imps: number[]) {
  const n = imps.length + SIGNATURE.kImp;
  const shrunk = imps.reduce((a, b) => a + b, 0) / n;
  return { shrunk, probability: phi(shrunk / (sd(imps) / Math.sqrt(n))) };
}

// Half-years (counted back from now) with enough rated matches, and how many had a mean IMP above 0.
function windows(rated: HistoryMatch[], now: number) {
  const seconds = SIGNATURE.windowDays * 86400;
  const by = new Map<number, number[]>();
  for (const m of rated) {
    const k = Math.floor((now - m.start) / seconds);
    by.set(k, [...(by.get(k) ?? []), m.imp!]);
  }
  const enough = [...by.values()].filter((v) => v.length >= SIGNATURE.minWindow);
  return { positive: enough.filter((v) => mean(v) > 0).length, total: enough.length };
}

const ORDER: SignatureLabel[] = ["current", "historic", "potential", "skilled", "frequent"];

// Every hero × position in the pool with its label (none of either when there's no evidence: no
// filling up to a count).
export function signatures(history: HistoryMatch[], now = Math.floor(Date.now() / 1000)): SignatureReport {
  const recentFrom = now - SIGNATURE.recentDays * 86400;
  const units = new Map<string, HistoryMatch[]>();
  for (const m of history) {
    const key = `${m.hero}-${m.pos ?? 0}`;
    units.set(key, [...(units.get(key) ?? []), m]);
  }
  const out: Signature[] = [];
  for (const [key, all] of units) {
    const [hero, pos] = key.split("-").map(Number);
    const n = all.length;
    const recent = all.filter((m) => m.start >= recentFrom);
    if (n < SIGNATURE.minHistory && recent.length < SIGNATURE.minRecent) continue;

    const wins = all.filter((m) => m.won).length;
    // The baseline: the same window's matches on other heroes (any position).
    const others = history.filter((m) => m.hero !== hero);
    const baseWins = others.filter((m) => m.won).length;
    const baseImps = others.filter((m) => m.imp != null).map((m) => m.imp!);
    const hasBaseline = others.length >= SIGNATURE.minBaseline;
    const base = (baseWins + 1) / (others.length + 2);

    // How good: the rated matches, the first few left out when learningSkip says so.
    const ordered = [...all].sort((a, b) => a.start - b.start).slice(SIGNATURE.learningSkip);
    const rated = ordered.filter((m) => m.imp != null);
    const imps = rated.map((m) => m.imp!);
    const coverage = rated.length / Math.max(1, ordered.length);
    const judgedWins = ordered.filter((m) => m.won).length;

    const winP = hasBaseline ? winProbability(judgedWins, ordered.length, baseWins, others.length) : null;
    const impP =
      hasBaseline && imps.length && baseImps.length >= SIGNATURE.minBaseline
        ? impProbability(imps, baseImps)
        : null;
    const m = imps.length ? mastery(imps) : null;
    const span = windows(rated, now);
    const persistent = span.total >= 2 && span.positive / span.total >= SIGNATURE.windowShare;
    const advantage = (winP ?? 0) >= SIGNATURE.probability || (impP ?? 0) >= SIGNATURE.probability;
    const mastered =
      m != null &&
      coverage >= SIGNATURE.minImpCoverage &&
      m.probability >= SIGNATURE.probability &&
      persistent;

    // Recent form: the recent IMP (shrunk to 0) above 0, or without IMP the recent win rate (shrunk to
    // the baseline) at least the baseline.
    const recentWins = recent.filter((x) => x.won).length;
    const recentImps = recent.filter((x) => x.imp != null).map((x) => x.imp!);
    const recentImp = recentImps.length ? mean(recentImps) : null;
    const recentOk = recentImps.length
      ? recentImps.reduce((a, b) => a + b, 0) / (recentImps.length + SIGNATURE.kImp) > 0
      : (recentWins + SIGNATURE.kWin * base) / (recent.length + SIGNATURE.kWin) >= base;
    const olderImps = rated.filter((x) => x.start < recentFrom).map((x) => x.imp!);
    const trend =
      recentImps.length >= SIGNATURE.minWindow && olderImps.length >= SIGNATURE.minWindow
        ? mean(recentImps) - mean(olderImps) >= SIGNATURE.trendImp
          ? "up"
          : mean(recentImps) - mean(olderImps) <= -SIGNATURE.trendImp
            ? "down"
            : null
        : null;

    const paths: SignaturePath[] = [
      ...(advantage ? (["advantage"] as const) : []),
      ...(mastered ? (["mastery"] as const) : []),
    ];
    let label: SignatureLabel | null = null;
    if (n >= SIGNATURE.minHistory) {
      if (paths.length) label = recent.length >= SIGNATURE.minRecent && recentOk ? "current" : "historic";
      else {
        const near = Math.max(winP ?? 0, impP ?? 0, m?.probability ?? 0) >= SIGNATURE.nearProbability;
        label = near || coverage < SIGNATURE.minImpCoverage ? "skilled" : "frequent";
      }
    } else if (recent.length >= SIGNATURE.minRecent) {
      // Not enough history yet: standing out recently (by the same measures, without the
      // half-years) makes a 潜力绝活; otherwise not shown.
      const recentMastery = recentImps.length
        ? mastery(recentImps).probability >= SIGNATURE.probability
        : false;
      if (advantage || recentMastery) {
        label = "potential";
        if (recentMastery && !paths.includes("mastery")) paths.push("mastery");
      }
    }
    if (!label) continue;

    out.push({
      hero,
      pos,
      label,
      paths,
      matches: n,
      wins,
      winRate: wins / n,
      shrunkWinRate: (wins + SIGNATURE.kWin * base) / (n + SIGNATURE.kWin),
      baselineWinRate: hasBaseline ? baseWins / others.length : null,
      baselineImp: baseImps.length ? mean(baseImps) : null,
      winProbability: winP,
      impProbability: impP,
      masteryProbability: m?.probability ?? null,
      imp: imps.length ? { matches: imps.length, mean: mean(imps), shrunk: m!.shrunk } : null,
      windows: span,
      recent: { matches: recent.length, wins: recentWins, imp: recentImp },
      trend,
      first: Math.min(...all.map((x) => x.start)),
      last: Math.max(...all.map((x) => x.start)),
    });
  }
  // The strongest evidence first within each label (it orders, it doesn't pick).
  const strength = (s: Signature) =>
    Math.max(s.winProbability ?? 0, s.impProbability ?? 0, s.masteryProbability ?? 0);
  out.sort(
    (a, b) =>
      ORDER.indexOf(a.label) - ORDER.indexOf(b.label) || strength(b) - strength(a) || b.matches - a.matches,
  );
  const starts = history.map((m) => m.start);
  return {
    signatures: out,
    coverage: {
      matches: history.length,
      withImp: history.filter((m) => m.imp != null).length,
      withPosition: history.filter((m) => m.pos != null).length,
      since: starts.length ? Math.min(...starts) : null,
    },
  };
}

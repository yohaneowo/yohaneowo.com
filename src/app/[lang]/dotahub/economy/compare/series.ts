import type { DetailMatch } from "@/lib/dota/admin";
import type { RankAverages, RankAverageSet } from "@/lib/dota/stratz";
import { applyFilters, type FilterState } from "../../stats/controls";

// Who's being compared: the page's player ("me"), other players, and crowds: "bracket" (the other
// nine players of the page player's own matches, 我的对局) and "rank" (a hero's players at a rank
// tier: admin's sample of their matches, and STRATZ's averages over many more). Blue for the page's
// player, orange / pink for other players, violet / cyan drawn hollow or dashed for crowds. Green,
// grey and red stay for ahead, even and behind.
export type SeriesKind = "me" | "player" | "bracket" | "rank";
export type Series = {
  key: string;
  kind: SeriesKind;
  label: string;
  color: string;
  matches: DetailMatch[];
  sides: Record<number, boolean>;
  // A player's avatar; a rank's rank_tier (medal × 10, for its medal icon).
  avatar?: string | null;
  tier?: number | null;
  // rank: the hero, STRATZ's averages by position (0: all) with the one the page player plays it
  // most, and how far admin's sample has got. averages: the ones for the position filter (set by
  // the page).
  heroId?: number;
  averageSet?: RankAverageSet | null;
  position?: number | null;
  averages?: RankAverages | null;
  progress?: { count: number; target: number };
  // rank: the volatility of each sampled player with enough matches.
  cv?: number[];
};

export const ME_COLOR = "#3b82f6";
export const PLAYER_COLORS = ["#f97316", "#ec4899"];
export const CROWD_COLORS = ["#8b5cf6", "#06b6d4"];
export const MAX_TARGETS = 2;

export const isCrowd = (s: { kind: SeriesKind }) => s.kind === "bracket" || s.kind === "rank";

// The filters applied to every series: people by their own newest n matches, 我的对局 by the page
// player's (the same matches' other players), a rank sample whole (it's other people's matches).
export function filterSeries(series: Series[], state: FilterState) {
  const me = series[0];
  const since = state.n && me.matches.length >= state.n ? me.matches[state.n - 1].startTime : undefined;
  return series.map((s) => ({
    ...s,
    lists:
      s.kind === "rank"
        ? applyFilters(s.matches, s.sides, { ...state, n: 0 })
        : applyFilters(
            s.matches,
            s.sides,
            state,
            s.kind === "bracket" ? (state.n ? (since ?? 0) : undefined) : undefined,
          ),
  }));
}

export type FilteredSeries = ReturnType<typeof filterSeries>[number];

// ?vs= keys: an account id, "bracket" (我的对局), or a rank tier with a hero ("r5h31": Legend Lich).
export function rankKey(tier: number, heroId: number) {
  return `r${tier}h${heroId}`;
}

export function parseRankKey(key: string) {
  const match = /^r([1-8])h(\d{1,4})$/.exec(key);
  return match ? { tier: Number(match[1]), heroId: Number(match[2]) } : null;
}

// A Dota account id out of whatever was pasted: the id, a SteamID64, or a profile address with
// either.
export function parseAccount(input: string): number | null {
  const digits = input.match(/\d{5,20}/g);
  if (!digits) return null;
  const value = BigInt(digits[digits.length - 1]);
  const base = BigInt("76561197960265728");
  const id = value > base ? value - base : value;
  return id > BigInt(0) && id < BigInt(2) ** BigInt(32) ? Number(id) : null;
}

// A rank's averages for the position filter: that position's, or with every position (0) mixed by
// how many matches the page player has in each (so the averages play the hero as they do), or
// STRATZ's all-positions averages when that's unknown.
export function averagesFor(
  set: RankAverageSet | null | undefined,
  position: number,
  weights: Map<number, number>,
): RankAverages | null {
  if (!set) return null;
  if (position) return set[position] ?? null;
  const parts = [...weights.entries()]
    .map(([p, w]) => [set[p], w] as const)
    .filter((x): x is readonly [RankAverages, number] => x[0] != null && x[1] > 0);
  if (!parts.length) return set[0] ?? null;
  if (parts.length === 1) return parts[0][0];
  const total = parts.reduce((a, [, w]) => a + w, 0);
  const mix = (pick: (a: RankAverages) => (number | null)[]) => {
    const length = Math.max(...parts.map(([a]) => pick(a).length));
    return Array.from({ length }, (_, i) => {
      const present = parts.filter(([a]) => pick(a)[i] != null);
      const weight = present.reduce((a, [, w]) => a + w, 0);
      return weight ? present.reduce((a, [x, w]) => a + pick(x)[i]! * w, 0) / weight : null;
    });
  };
  const items: RankAverages["items"] = {};
  for (const id of new Set(parts.flatMap(([a]) => Object.keys(a.items).map(Number)))) {
    const having = parts.filter(([a]) => a.items[id]);
    const weight = having.reduce((a, [, w]) => a + w, 0);
    items[id] = {
      time: Math.round(having.reduce((a, [x, w]) => a + x.items[id].time * w, 0) / weight),
      rate: having.reduce((a, [x, w]) => a + x.items[id].rate * w, 0) / total,
    };
  }
  const matches = parts.reduce((a, [x]) => a + x.matches, 0);
  const winRate = parts.reduce((a, [x, w]) => a + (x.wins / x.matches) * w, 0) / total;
  return {
    matches,
    wins: winRate * matches,
    networth: mix((a) => a.networth),
    lastHits: mix((a) => a.lastHits),
    xp: mix((a) => a.xp),
    items,
  };
}

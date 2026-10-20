import type { DetailMatch } from "@/lib/dota/admin";
import { applyFilters, type FilterState } from "../../stats/controls";

// Who's being compared: the page's player ("me"), up to two other players, and the bracket (the
// other nine players of the page player's own matches). Blue / orange / pink for people, violet
// drawn hollow or dashed for the bracket (a crowd, not a person). Green, grey and red stay for
// ahead, even and behind.
export type SeriesKind = "me" | "player" | "bracket";
export type Series = {
  key: string;
  kind: SeriesKind;
  label: string;
  color: string;
  matches: DetailMatch[];
  sides: Record<number, boolean>;
};

export const ME_COLOR = "#3b82f6";
export const PLAYER_COLORS = ["#f97316", "#ec4899"];
export const BRACKET_COLOR = "#8b5cf6";
export const MAX_TARGETS = 2;

// The filters applied to every series: people by their own newest n matches, the bracket by the
// page player's (the same matches' other players).
export function filterSeries(series: Series[], state: FilterState) {
  const me = series[0];
  const since = state.n && me.matches.length >= state.n ? me.matches[state.n - 1].startTime : undefined;
  return series.map((s) => ({
    ...s,
    lists: applyFilters(
      s.matches,
      s.sides,
      state,
      s.kind === "bracket" ? (state.n ? (since ?? 0) : undefined) : undefined,
    ),
  }));
}

export type FilteredSeries = ReturnType<typeof filterSeries>[number];

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

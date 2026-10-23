// The choices of the 段位 page's hero matchups: the time range, as full weeks before the current
// one (STRATZ counts matchups per week), and the bracket (STRATZ's pairs of medals, or every
// bracket together). Shared by the client (the buttons) and the server (the query), so it holds no
// server code.
// 0 is the current week alone (what stratz.com's hero page shows).
export const MATCHUP_WEEKS = [0, 1, 4, 12] as const;
export type MatchupWeeks = (typeof MATCHUP_WEEKS)[number];
export const DEFAULT_MATCHUP_WEEKS: MatchupWeeks = 4;

export const MATCHUP_BRACKETS = [
  "HERALD_GUARDIAN",
  "CRUSADER_ARCHON",
  "LEGEND_ANCIENT",
  "DIVINE_IMMORTAL",
] as const;
export type MatchupBracket = (typeof MATCHUP_BRACKETS)[number];
// Every bracket at once (no bracket filter in the query).
export const ALL_BRACKETS = "ALL";
export type MatchupBracketChoice = MatchupBracket | typeof ALL_BRACKETS;
// The two medals (1–8) a bracket spans.
export const BRACKET_MEDALS: Record<MatchupBracket, [number, number]> = {
  HERALD_GUARDIAN: [1, 2],
  CRUSADER_ARCHON: [3, 4],
  LEGEND_ANCIENT: [5, 6],
  DIVINE_IMMORTAL: [7, 8],
};

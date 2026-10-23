// The time ranges of the 段位 page's hero matchups, as full weeks before the current one (STRATZ
// counts matchups per week). Shared by the client (the range buttons) and the server (the query),
// so it holds no server code.
export const MATCHUP_WEEKS = [1, 4, 12] as const;
export type MatchupWeeks = (typeof MATCHUP_WEEKS)[number];
export const DEFAULT_MATCHUP_WEEKS: MatchupWeeks = 4;

import type historyZh from "./history-zh";

// A metric's name inside a sentence: lower case, unless it starts with an acronym (GPM, XP at 10).
const low = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
// 1st, 2nd, 3rd, 4th… 11th–13th.
const ord = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

const historyEn: typeof historyZh = {
  // ── References ──
  personal: "Against their own games on the hero",
  personalHint: (n: number) => `Their latest ${n} games on this hero on OpenDota (this one left out)`,
  parsedHint: (n: number) => `early net worth and last hits from ${n} games STRATZ parsed`,
  personalAnon: "An anonymous player: no history to compare with.",
  personalNone:
    "OpenDota shows no history: the account is private, or there are no other games on this hero.",
  pro: "Against pro games (same hero, same patch)",
  proHint: (n: number, patch: string) =>
    `Parsed pro league games on OpenDota: ${n} on patch ${patch}, this one left out (the latest 400 at most)`,
  proNone: "OpenDota has no pro games on this hero in this patch.",
  metric: "Metric",
  thisGame: "This game",
  pctile: "Pctile",
  median: "Median",
  proMedian: "Pro median",
  range: "P10–P90",
  winLoss: "Median in wins / losses",
  n: (n: number) => `${n} games`,
  totalTag: "game total",
  parsedTag: "STRATZ",
  pctNote:
    "Percentile: the share of games this one beats (50 is the middle); green is better than usual, red worse (by role; some metrics have no better side).",
  totalsNote: (p: string) =>
    `Rows marked “game total” are whole-game totals and grow with the game's length (this game's length percentile: ${p}).`,
  rows: {
    gpm: "GPM",
    xpm: "XPM",
    lhpm: "Last hits / min",
    nw10: "Net worth at 10",
    lh: "Last hits",
    dn: "Denies",
    kills: "Kills",
    deaths: "Deaths",
    assists: "Assists",
    heroDamage: "Hero damage",
    towerDamage: "Building damage",
    duration: "Game length",
    lh10: "Last hits at 10",
    dn10: "Denies at 10",
    g10: "Gold earned by 10",
    xp10: "XP at 10",
    tp: "Teamfight participation",
    stacks: "Camps stacked",
    stuns: "Stun seconds",
    hd: "Hero damage",
    td: "Building damage",
  } as Record<string, string>,
  lhAt: (m: number) => `Last hits at ${m}`,

  vs: "Their games on this hero against these heroes",
  vsHint:
    "OpenDota: games on this hero with that hero on the other side (50 at most, this one taken out); each cell is “usual → here”, last hits and deaths are game totals",
  vsAnon: "An anonymous player: no history to compare with.",
  vsNone: "OpenDota has no games of theirs against the lane opponents or the hero who hurt them most.",
  opponent: "Opponent",
  vsGames: "Games (won)",
  vsWon: (wr: string) => ` (${wr})`,
  vsGpm: "GPM",
  vsLh: "Last hits",
  vsDeaths: "Deaths",
  laneTag: "lane",
  threatTag: "most damage",
  noOther: "no other games",

  durations: "The hero's win rate by game length",
  durationsHint: (n: string) =>
    `OpenDota's games, all patches and ranks (${n} in all); spans with fewer than 30 games are left out`,
  durationsAt: (who: string, len: string, from: number, to: number, wr: string, n: string) =>
    `${who} (${len}) falls in ${from}–${to} min: the hero wins ${wr} there (${n} games).`,
  durationsOut: (who: string, len: string) => `${who} (${len}) falls in a span with fewer than 30 games.`,
  durationsNone: "OpenDota has no game-length data for this hero.",
  binLine: (hero: string, wr: string, n: string) => `${hero} ${wr} (${n} games)`,
  lengthAxis: "Game length (min)",
  bin: (from: number, to: number) => `${from}–${to} min`,

  rates: "The hero's win rate and pro presence",
  pubLine: (bracket: string | null, wr: string, n: string) =>
    `Public games (${bracket ?? "the match's bracket"}, OpenDota): ${wr} won (${n} games)`,
  pubNone: (bracket: string | null) => `Public games: OpenDota has no data for ${bracket ?? "this bracket"}`,
  proLine: (pick: number, win: number, wr: string, ban: number) =>
    `Pro games (OpenDota): picked ${pick} times, won ${win} (${wr}), banned ${ban} times`,
  ratesNote: (rankTable: boolean) =>
    `OpenDota's public and pro counts are its recent totals (the period is OpenDota's, across patches)${rankTable ? "; the win rate at the rank and position (STRATZ) is in the rank-average reference table above" : ""}.`,

  // ── The game ──
  compare: "How far A and B compare",
  compareRows: {
    match: "Same match",
    hero: "Hero",
    position: "Position",
    patch: "Patch",
    mode: "Game mode",
    lobby: "Lobby",
    side: "Side",
    result: "Result",
    rank: "Match rank",
    duration: "Game length",
    shape: "Game shape",
    experience: "Games on the hero",
    party: "Party",
    smurfs: "Suspected smurfs among the enemies",
  } as Record<string, string>,
  lobbies: {
    "0": "Normal matchmaking",
    "1": "Practice (league or lobby)",
    "2": "Tournament",
    "4": "Co-op vs bots",
    "5": "Team ranked",
    "6": "Solo ranked",
    "7": "Ranked",
    "8": "1v1 mid",
    "9": "Battle Cup",
  } as Record<string, string>,
  verdicts: {
    mode: "The game modes play by different rules (Turbo doubles gold and XP, Ability Draft mixes the heroes): per-minute numbers and timings don't compare.",
    hero: "Different heroes: compare the overall approach (fights, movement, time use), not the numbers themselves.",
    position: (a: string, b: string) =>
      `Different positions (${a} vs ${b}): read the role-dependent numbers (last hits, wards, fights, stacks) with care.`,
    caution: (list: string) => `Mostly comparable, but note: ${list}.`,
    also: (list: string) => ` Also note: ${list}.`,
    fine: "The two games are alike: compare them directly.",
    sameMatch:
      "The same match: patch, length and the game's course are shared, so the differences are the players'. ",
  },
  cautions: {
    hero: "different heroes too",
    position: "different positions too",
    mode: "different modes",
    patch: "different patches",
    lobby: "a pro or lobby game against a ranked one",
    rank: "two or more medals apart",
    duration: "very different lengths",
    shape: "a one-sided game against a contested one",
    experience: "very different experience on the hero",
    smurfs: "suspected smurfs among the opponents",
  } as Record<string, string>,
  same: "same",
  differ: "differs",
  unknown: "unknown",
  solo: "solo",
  partyOf: (n: number) => `party of ${n}`,
  noFlags: "none",
  flagged: (n: number) => `${n}`,

  experience: "Experience and rank",
  heroGamesLabel: "Games on the hero",
  heroGames: (games: string, wins: number, wr: string) => `${games} games, ${wins} won (${wr})`,
  heroGamesOnly: (games: string) => `${games} games`,
  heroGamesHint: " (OpenDota, this one included)",
  heroGamesListed: " (the latest games OpenDota lists, this one left out; no hero record, so wins unknown)",
  usualLane: "Usual lane (OpenDota, all their games on the hero)",
  laneRoles: { "1": "Safe lane", "2": "Mid", "3": "Off lane", "4": "Jungle", "0": "Unknown" } as Record<
    string,
    string
  >,
  thisGameTag: "this game",
  plusXp: "Dota Plus hero XP",
  plusHint: "0 without Dota Plus",
  seasonRank: "Season rank",
  smurf: "STRATZ smurf flag",
  smurfYes: (n: number) => `suspected smurf (${n})`,
  smurfNo: "none",
  laneFoesXp: "Lane opponents' hero XP",

  players: "All ten players",
  playersHint:
    "Rank, smurf flag, Dota Plus hero XP, party and IMP from STRATZ; only parties of two or more are marked",
  missing: (cols: string, parsed: boolean) =>
    parsed
      ? `Not on STRATZ for this match: ${cols}.`
      : `STRATZ hasn't parsed this match, so these are empty: ${cols}.`,
  noSmurfs: "STRATZ flags nobody as a suspected smurf.",
  colPlayer: "Player",
  colRank: "Rank",
  colSmurf: "Smurf",
  colXp: "Hero XP",
  colParty: "Party",
  colImp: "IMP",
  colKda: "KDA",
  party: (n: number) => `P${n}`,
  suspect: "suspected",
  laneOf: (who: string) => `${who}'s lane opponent`,
  anonymous: "Anonymous",

  shape: "Game shape",
  shapeKinds: {
    stomp: "stomp win",
    stomped: "stomped",
    comeback: "comeback win",
    throw: "lead lost",
    contested: "back and forth",
    close: "close",
  } as Record<string, string>,
  lead: (v: string, at: string) => `ahead by up to ${v} (${at})`,
  leadOnly: (v: string) => `ahead by up to ${v}`,
  neverLed: "never ahead",
  deficit: (v: string, at: string) => `behind by up to ${v} (${at})`,
  deficitOnly: (v: string) => `behind by up to ${v}`,
  neverBehind: "never behind",
  changes: (n: number) => `the lead changed hands ${n === 1 ? "once" : n === 2 ? "twice" : `${n} times`}`,
  ahead: (p: string) => `ahead ${p} of the time`,
  final: (v: string) => `${v} at the end`,
  shapeSource: {
    od: "The team's gold lead (OpenDota)",
    stratz: "The team's net worth lead (STRATZ)",
    shape: "OpenDota's biggest leads",
  } as Record<string, string>,
  shapeRule:
    "From the gold lead: the losing team once 5,000 or more ahead is a comeback (or a lost lead); the loser never more than 1,500 ahead while the winner got 10,000 ahead is a stomp; the winner never 8,000 ahead is close; anything else is back and forth. The lead changes hands only once a team is 1,000 ahead.",

  draft: "Draft grades and the draft-only win chance",
  draftHint:
    "STRATZ's grade of each pick: the hero's own win rate → the one adjusted for the draft so far (%)",
  draftNone: "STRATZ has no draft grades for this match.",
  draftTotal: (ours: string, theirs: string) => `Total adjustment (points): ours ${ours}, theirs ${theirs}.`,
  draftFlat: (n: number, total: number, v: number) =>
    `${n} of ${total} picks are unchanged (mostly ${v} → ${v}), which looks like a default rather than a grade: read the grades loosely.`,
  draftCurve: "The team's draft-only win chance (solid) and the live one (dashed)",
  live: "live win chance",
  draftReading: (who: string, start: string, even: string | null, end: string) =>
    even
      ? `${who}: on the draft alone, ${start} at the start, 50% by ${even}, ${end} at the curve's end.`
      : `${who}: on the draft alone, ${start} at the start, ${end} at the curve's end.`,
  draftUndocumented:
    "STRATZ doesn't document this curve; it reads as the win chance on the draft alone if the game is at that minute.",

  quality: "Pauses, disconnects and leavers",
  qualityNone: "No pauses, disconnects or leavers.",
  pause: (at: string, secs: number) => `pause at ${at} (${secs} s)`,
  pauseNote:
    "The game clock stops in a pause, so per-minute numbers aren't affected; disconnects and leavers leave a team short.",
  pregame: "pre-game",
  inRange: "inside the current time range",
  events: { disconnect: "disconnect", reconnect: "reconnect", abandon: "abandon" } as Record<string, string>,
  back: (at: string) => `back at ${at}`,
  noBack: "no reconnect logged",
  leaver: "left the game",

  // ── Sentences ──
  end: ".",
  few: (who: string, n: number) => ` (${who ? `${who}: ` : ""}only ${n} games)`,
  ownSingle: (metric: string, v: string, p: number, n: number) =>
    `${metric} (${v}) is at the ${ord(p)} percentile of their latest ${n} games on the hero`,
  ownSide: (who: string, metric: string, v: string, p: number, n: number) =>
    `${who}'s ${low(metric)} (${v}) is at the ${ord(p)} percentile of their latest ${n} games on the hero`,
  ownPair: (metric: string, pa: number, pb: number) =>
    `Against their own games, ${low(metric)} is at A's ${ord(pa)} and B's ${ord(pb)} percentile`,
  proSingle: (metric: string, v: string, p: number, n: number) =>
    `Against ${n} pro games in the patch, ${low(metric)} (${v}) is at the ${ord(p)} percentile`,
  proPair: (metric: string, pa: number, pb: number, shared: boolean) =>
    `Against pro games ${shared ? "in the patch" : "on each one's hero and patch"}, ${low(metric)} is at the ${ord(pa)} percentile for A and the ${ord(pb)} for B`,
  unusualGood: ": a much better game than usual.",
  unusualBad: ": a much worse game than usual.",
  pairMeaning: (better: string, worse: string) =>
    `: ${better} had a better game than usual, ${worse} a worse one.`,
  lengthToo: (longer: boolean, p: number, pro: boolean) =>
    `, but the game was also much ${longer ? "longer" : "shorter"} than ${pro ? "those pro games" : "usual"} (length at the ${ord(p)} percentile), which pushes per-minute numbers ${longer ? "up" : "down"}.`,
  lengthPart: (who: string, longer: boolean, pro: boolean) =>
    `${who}'s game was also much ${longer ? "longer" : "shorter"} than ${pro ? "those pro games" : "usual"}`,
  lengthPair: (parts: string) => `; but ${parts}, which moves per-minute numbers.`,
  lengthBoth: (longer: boolean, pro: boolean) =>
    `; but both players' games were much ${longer ? "longer" : "shorter"} than ${pro ? "those pro games" : "usual"}, which moves per-minute numbers.`,
  expGap: (a: string, b: string, sameHero: boolean) =>
    sameHero
      ? `A has ${a} games on the hero, B ${b}: experience may explain part of the gap.`
      : `A has ${a} games on their hero, B ${b} on theirs: experience may explain part of the gap.`,
  shapePair: (a: string, b: string) =>
    `The games went differently (A: ${a}; B: ${b}); per-minute numbers move with the game's course.`,
  shapeSame: (kind: string) => `Both games went alike (${kind}).`,
  shapeSingle: (kind: string, detail: string) => `This game: ${kind}; ${detail}.`,
  qualityLine: (pauses: number, drops: number, leavers: number) =>
    `During the game: ${[
      pauses ? `${pauses} pause${pauses > 1 ? "s" : ""}` : "",
      drops ? `${drops} disconnect${drops > 1 ? "s" : ""}` : "",
      leavers ? `${leavers} leaver${leavers > 1 ? "s" : ""}` : "",
    ]
      .filter(Boolean)
      .join(", ")}.`,
  metricOwnGpm: "GPM, percentile of their own games on the hero",
  metricOwnXpm: "XPM, percentile of their own games on the hero",
  metricOwnLhpm: "Last hits / min, percentile of their own games on the hero",
};

export default historyEn;

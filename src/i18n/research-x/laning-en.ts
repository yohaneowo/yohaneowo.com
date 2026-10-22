import type laningZh from "./laning-zh";

const laningEn: typeof laningZh = {
  // The expected lane result.
  expect: "Lane expectation: records at the same rank",
  expectHint:
    "This hero's lane results at the same rank and position against (or with) each hero; wins and losses include stomps, and records under 50 lanes are left out of the expectation. Expected = the plain average of the records: favoured when wins exceed losses by 12 points or more, unfavoured when they fall 12 or more short.",
  hero: "Hero",
  role: "Role",
  vs: "Opponent",
  with: "Partner",
  lanes: "Lanes",
  win: "Win",
  draw: "Draw",
  loss: "Loss",
  thin: "few lanes",
  odds: { favoured: "favoured", even: "even", unfavoured: "unfavoured" } as Record<string, string>,
  verdicts: { "-1": "worse than expected", "0": "as expected", "1": "better than expected" } as Record<
    string,
    string
  >,
  expectLine: (odds: string, win: string, draw: string, loss: string, n: string) =>
    `Expected: ${odds} — win ${win}, draw ${draw}, loss ${loss} (${n} lanes across the records)`,
  actualLine: (result: string, verdict: string) => `Result: ${result}, ${verdict}`,
  noActual: "STRATZ has no result for this lane",
  tooThin: "Every record is too small for an expectation.",
  noExpect: "No lane opponents, or no lane records at this rank.",
  expectSource: (bracket: string, position: string, week: boolean) =>
    `STRATZ heroStats lane records: ${bracket}${position}, public games from ${week ? "the match's week" : "recent weeks"}, not these players' own.`,

  // The 10-minute gaps.
  gaps: "Lane gaps: whole lane, lane counterpart, same position",
  gapsHint:
    "Whole lane: the player and lane partners against the lane opponents; counterpart: the enemy in the matching lane role (1 vs 3, 2 vs 2, 4 vs 5); same position: the enemy with the same position.",
  atMinute: (m: number) => `${m} min`,
  ours: "Ours",
  theirs: "Theirs",
  nwGap: "Net worth gap",
  xpGap: "XP gap",
  wholeLane: (a: number, b: number) => `Whole lane (${a} vs ${b})`,
  counterpart: (n: number) => `Counterpart (pos ${n})`,
  samePosition: (n: number) => `Same position (pos ${n})`,
  notInLane: "not in this lane",
  noGaps: "No lane opponents found (no STRATZ parse, or jungling / roaming).",
  noPositions: "No STRATZ positions (1–5), so no counterpart or same-position rows.",

  // Where the waves met.
  wave: "Where the waves met (solid) and where the player stood (dashed): 0% = own tier 1, 100% = enemy tier 1",
  heroPlace: "Player",
  waveStates: {
    intoOwn: "pushed into your tower",
    nearOwn: "held near your tower",
    middle: "in the middle",
    nearEnemy: "pushed towards their tower",
    intoEnemy: "pushed into their tower",
  } as Record<string, string>,
  ahead: "stood ahead of the creep line",
  waveMedian: "Median meeting point",
  heroMean: "Player's average place",
  fromTower: (share: string, units: string) => `${share} (about ${units} units from your tier 1)`,
  minutes: (n: number) => `${n} min`,
  fewHits: "Too few last hits (at least 2 a minute in at least 4 minutes) to place the wave over the lane.",
  noWave: "No STRATZ last-hit positions, or not in one of the three lanes.",
  waveNote:
    "Where the two waves met is estimated from where the player last-hit lane creeps (the median within 30 s of each minute); denies and the lane partners' last hits have no positions, so they're left out. Into a tower = within 700 units of a tier 1; near a tower = the rest of that side's third of the lane; ahead of the creep line = the player's average place 400 units or more past the meeting point.",

  // The lane's creeps.
  creeps: "Lane creeps in the first 10 minutes",
  creepChart:
    "Share of the enemy lane creeps the player last-hit (cumulative, solid); dashed: the whole lane",
  laneTeam: "whole lane",
  enemyCreeps: (n: number) => `Enemy creeps (about ${n} reached the lane)`,
  ownCreeps: (n: number) => `Own creeps (about ${n})`,
  you: "Player",
  allies: "Lane partners",
  deniedByThem: "Denied by them",
  rest: "Rest",
  theirLh: "Their last hits",
  ourDenies: "Our denies",
  restHint: "killed by creeps or towers, taken by someone else, or still alive",
  lhNote: (all: number, lane: number, m: number) =>
    `${all} last hits by ${m} min, ${lane} of them lane creeps in this lane (by where they died).`,
  lhNoPlaces:
    "No last-hit positions (no STRATZ parse): the player's last hits are OpenDota's per-minute totals too and may include neutrals or other lanes.",
  noCreeps: "No lane opponents found (no STRATZ parse, or jungling / roaming).",
  creepNote:
    "The creeps reaching the lane are worked out from the spawn rules (assumed for 7.41: a wave every 30 s of 3 melee + 1 ranged, a siege creep with the 5:00, 10:00… waves, all dead about 45 s after spawning), not from the replay; partners' and opponents' last hits and denies are OpenDota's per-minute totals and may include neutrals or other lanes.",

  // Rotations.
  rotations: "Rotations in the first 15 minutes",
  rotationsHint:
    "Leaving the own lane with two position samples in a row (one every 10 s) in another counts once, and a death ends it; what it led to is looked for in the 45 s after arriving.",
  time: "Time",
  where: "To",
  how: "How",
  result: "Result",
  away: "Away",
  killGold: "Kill gold",
  givenUp: "Farm gold / XP given up",
  tp: "TP",
  walk: "walked",
  outcomes: { kill: "kill", assist: "assist", nothing: "nothing" } as Record<string, string>,
  died: "died",
  noRotation: "Never left the own lane in the first 15 minutes.",
  noHome: "STRATZ gave this player no lane (jungle or roaming): every visit to a lane counts.",
  rotationLine: (n: number, per10: string, paid: number, died: number) =>
    `${n} rotation${n === 1 ? "" : "s"} (${per10} per 10 min), ${paid} with a kill or assist, ${died} with a death.`,
  givenLine: (gold: string, xp: string, kill: string | null) =>
    `About ${gold} gold and ${xp} XP of farm given up while away${kill ? `; ${kill} gold from kills` : ""}.`,
  enemyIn: "Enemies coming to this lane (enemy heroes not laning here)",
  who: "Who",
  youThere: "You there",
  then: "In the next 45 s: our deaths / their deaths",
  here: "yes",
  notHere: "no",
  jump: "TP / jump",
  noEnemyIn: "No enemy from another lane came here in the first 15 minutes.",
  noPath: "No STRATZ positions, so no rotations.",
  rotationNote:
    "Farm gold given up = the gold a minute from last hits (lane creeps and neutrals) while in the own lane × the time away (not counting time dead), less the lane creeps and neutrals last-hit elsewhere meanwhile (each last hit's gold); XP likewise, but creep XP is only known per minute, so the seconds away get their share by time.",
  positionsNote:
    "Positions from the replay (one every 10 s), including heroes hidden in the fog at the time.",

  // Runes.
  runes: "Runes in the first 15 minutes (both teams)",
  runesHint: "On time = picked within 15 s of the spawn.",
  kind: "Kind",
  runeKinds: { power: "Power", bounty: "Bounty", water: "Water", wisdom: "Wisdom" } as Record<string, string>,
  total: "Total",
  share: "Our share",
  mine: "Player",
  onTime: "On time (ours / theirs)",
  afterPower: "Kills within 60 s of a power rune",
  noKill: "no kill",
  noRunes: "No rune pickups in the first 15 minutes.",
  runeNote:
    "Spawn times are assumed (7.41: bounty runes from 0:00 every 4 minutes, water runes at 2:00 and 4:00, a power rune every 2 minutes from 6:00, wisdom runes every 7 minutes), only to tell on-time pickups; the pickups are OpenDota's, for all ten players.",
  otherPatch: (patch: string) => `This match is on ${patch}; the rules may differ.`,

  // Matchup threats (the game's context).
  threat: "Matchup threats: the rank's records and what happened",
  threatHint:
    "Advantage: how many points the hero's win rate against this one is above (or below) what the two heroes' own win rates predict (STRATZ), any position; records under 50 games are left out.",
  games: "Games",
  winRate: "Win rate",
  advantage: "Advantage",
  takenShare: "Damage taken",
  killedYou: "Killed you",
  dealtShare: "Your damage",
  laneTag: "lane",
  draftLine: (avg: string, n: number) => `Average draft advantage ${avg} points (${n} heroes).`,
  countersLine: (heroes: string, share: string) => `Counter you: ${heroes}, ${share} of the damage taken.`,
  counteredLine: (heroes: string, share: string) =>
    `You counter: ${heroes}, ${share} of your hero damage went to them.`,
  noThreat: "No matchup records at this rank.",
  threatSource: (bracket: string, week: boolean) =>
    `STRATZ heroStats matchups: ${bracket}, any position, public games from ${week ? "the match's week" : "recent weeks"}; damage and kills are this match's.`,

  // Sentences.
  insightExpect: (who: string, odds: string, win: string, loss: string, result: string, verdict: string) =>
    `${who}By the rank's records this lane was ${odds} (win ${win}, loss ${loss}); result: ${result}, ${verdict}.`,
  insightExpectPair: (a: string, b: string) => `Lane expectation and result: A ${a}; B ${b}.`,
  expectShort: (odds: string, result: string, verdict: string) => `${odds} → ${result} (${verdict})`,
  insightGaps: (who: string, m: number, total: string, a: number, b: number, same: string | null) =>
    `${who}At ${m} min the whole lane's net worth gap was ${total} (${a} vs ${b})${same ? `, ${same} against the same position` : ""}.`,
  insightGapsPair: (ta: string, tb: string, sa: string | null, sb: string | null) =>
    `Whole-lane net worth gap at 10 min: A ${ta}, B ${tb}${sa || sb ? `; same position: A ${sa ?? "–"}, B ${sb ?? "–"}` : ""}.`,
  insightWave: (who: string, n: number) =>
    `${who}The wave sat under the own tower in ${n} of the first 12 minutes.`,
  insightThreat: (who: string, hero: string, adv: string, share: string, kills: number, avg: string) =>
    `${who}The hardest matchup was ${hero} (${adv}): ${share} of the damage taken, killed you ${kills} time${kills === 1 ? "" : "s"}; average draft advantage ${avg} points.`,
  insightDraftPair: (a: string, b: string) => `Average draft advantage: A ${a}, B ${b} points.`,
  sumExpectWorse: (who: string, odds: string, win: string, result: string) =>
    `${who}Lane below expectation: ${odds} by the rank's records (win ${win}), result: ${result}.`,
  sumExpectBetter: (who: string, odds: string, win: string, result: string) =>
    `${who}Lane above expectation: ${odds} by the rank's records (win ${win}), result: ${result}.`,
  sumExpectPair: (a: string, b: string) => `Lane against expectation: A ${a}, B ${b}.`,
  sumGaps: (ta: string, tb: string, sa: string | null, sb: string | null) =>
    `Whole-lane net worth gap at 10 min: A ${ta}, B ${tb}${sa || sb ? ` (same position: A ${sa ?? "–"}, B ${sb ?? "–"})` : ""}.`,
  sumWave: (who: string, n: number) =>
    `${who}The wave sat under the own tower in ${n} of the first 12 minutes.`,
  sumWavePair: (a: string, b: string) =>
    `Median meeting point of the waves in the first 12 minutes (0% = own tier 1): A ${a}, B ${b}.`,
  sumRotations: (who: string, n: number, paid: number) =>
    `${who}${n} rotations in the first 15 minutes, ${paid} with a kill or assist.`,
  sumRotationsPair: (a: number, b: number) => `Rotations in the first 15 minutes: A ${a}, B ${b}.`,
  sumPower: (who: string, ours: number, all: number) =>
    `${who}The team took ${ours} of ${all} power runes in the first 15 minutes.`,
  sumThreat: (who: string, hero: string, adv: string, share: string) =>
    `${who}${hero} was the hardest matchup (${adv}) and dealt ${share} of the damage taken.`,
  sumDraft: (a: string, b: string) => `Draft advantage: A ${a}, B ${b} points on average.`,
  lessonRotation: (n: number, gold: string) =>
    `${n} rotation${n === 1 ? "" : "s"} in the first 15 minutes brought no kill or assist, giving up about ${gold} gold of farm (estimate).`,
  pp: (v: string) => `${v} pts`,

  metrics: {
    laneTotal10: "Whole-lane net worth gap at 10 min",
    laneRole10: "Counterpart net worth gap at 10 min",
    lanePos10: "Same-position net worth gap at 10 min",
    laneVsExp: "Lane result against expectation (−2 to +2)",
    wave12: "Where the waves met (0% = own tier 1)",
    creepShare10: "Enemy lane creeps last-hit by 10 min",
    rotations15: "Rotations in the first 15 minutes",
    runeShare15: "Team's rune share, first 15 minutes",
  },
};

export default laningEn;

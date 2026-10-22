import type itemsZh from "./items-zh";

const itemsEn: typeof itemsZh = {
  // The build against the rank's and the pros' games.
  choice: "The build against the rank and the pros",
  choiceHint:
    "Rank: STRATZ games on the same hero and position; pros: pro games on the patch (OpenDota). Finished items only, not their parts",
  item: "Item",
  bought: "Bought",
  rank: "Rank",
  rankWin: "Win rate when bought",
  pro: "Pros (same phase)",
  proShort: "pros",
  reading: "Reading",
  phases: { start: "start", early: "early", mid: "mid", late: "late" } as Record<string, string>,
  phasesHint: "Start: before the horn; early: 0–10 min; mid: 10–25 min; late: after 25 min",
  rankTags: {
    staple: "staple",
    common: "common",
    rare: "rare",
    thin: "thin data",
    unlisted: "not listed",
  } as Record<string, string>,
  rankTagHints: {
    staple: "Bought in more than 60% of the rank's games",
    common: "Bought in 12–60% of the rank's games",
    rare: "Bought in fewer than 12% of the rank's games",
    thin: "STRATZ kept only a purchase minute or two, so the share reads far too low; not called rare",
    unlisted: "STRATZ lists only items bought often enough; this one isn't there, so it's likely rare",
  } as Record<string, string>,
  proTags: {
    common: "pro staple",
    uncommon: "rare in pros",
    offMeta: "off-meta",
    otherPhase: "pros buy it in another phase",
  } as Record<string, string>,
  proTagHints: {
    common: "A quarter or more of the pro games bought it in the same phase",
    uncommon: "5% to a quarter of the pro games bought it in the same phase",
    offMeta: "Under 5% of the pro games bought it in the same phase, or fewer than 5 in all",
    otherPhase: "A quarter or more of the pro games buy it, mostly in another phase",
  } as Record<string, string>,
  proUsual: (phase: string) => `pros buy it ${phase}`,
  phasesIn: { start: "at the start", early: "early", mid: "mid-game", late: "late" } as Record<
    string,
    string
  >,
  proValue: (n: number, of: number, phase: number) => `${n}/${of} (${phase})`,
  proFew: (of: number) => `<5/${of}`,
  skipped: "Bought by most of the rank or the pros, not here",
  notReached: "The game ended before the usual time for it",
  choiceNote:
    "STRATZ lists only items and purchase minutes with enough buys, so rare items are missing and the shares read low; the win rate is that of the games where it was bought, which depends on how those games were going, not the item's effect.",

  // Starting items and boots.
  start: "Starting items and boots",
  startItems: "Starting items (the number: share of the rank's games that bought it at the start)",
  startSkipped: "Most of the rank buy these at the start, not here",
  later: (at: string) => `bought at ${at}`,
  never: "never bought",
  unlisted: "not listed",
  boots: "Boots",
  bootsCols: {
    bought: "Bought",
    share: "Rank share",
    time: "Rank average",
    win: "Win rate",
    uses: "Uses (a minute)",
    rankUses: "Rank uses (a minute)",
  },
  countPm: (n: string, pm: string) => `${n} (${pm})`,
  rankBoots: "The rank's most common boots",
  bootsNote: (avg: string) =>
    `Uses from OpenDota; uses a minute run from the purchase to the end of the game, the rank's from its average purchase to its average game length (about ${avg} min), so boots sold or upgraded read low.`,

  // Carrying a TP.
  tp: "Carrying a TP (after 10:00)",
  tpHint: "Follows the range above; time dead left out",
  tpNone: "No STRATZ parse: whether a TP was carried isn't known.",
  tpEarly: "The chosen range ends before 10:00.",
  tpLess: "Without a TP",
  tpLessValue: (time: string, share: string) => `${time} (${share} of the time alive)`,
  tpLongest: "Longest stretch",
  tpLongestValue: (time: string, at: string) => `${time} (from ${at})`,
  tpGaps: "Times",
  tpChecks: {
    deaths: "Deaths (5 s before)",
    fights: "Teamfights joined (at the start)",
    towers: "Own towers lost (30 s before)",
  } as Record<string, string>,
  tpWithout: (n: number, of: number) => `${n}/${of} without`,
  tpDead: "dead",
  tpBand: "Red: no TP; grey: deaths; yellow: own towers lost",
  tpNote:
    "STRATZ writes an inventory snapshot only when something changes, so each holds until the next; Boots of Travel count as a TP.",

  // Threats and the items that answer them.
  counter: "Items against the enemy lineup",
  counterHint: "From the damage taken and the enemy heroes and items",
  threats: {
    magic: "Magic damage",
    physical: "Right-clicks",
    control: "Disables",
    evasion: "Evasion",
    invis: "Invisibility",
    heal: "Healing",
    passives: "Passives",
    illusions: "Illusions",
  } as Record<string, string>,
  magicLine: (share: string) => `${share} of the hero damage taken was magical`,
  physicalLine: (share: string) => `${share} of the hero damage taken was right-clicks`,
  controlLine: (sec: string) => `stunned or disabled ${sec} s a minute`,
  healLine: (v: string) => `heals ${v} a minute`,
  notBought: "not bought",
  rankRate: (share: string) => `${share} of the rank buy it`,
  // Names for answers the page has no picture of (nobody in the match bought them).
  fallbackNames: {
    dust: "Dust of Appearance",
    ward_sentry: "Sentry Ward",
    gem: "Gem of True Sight",
  } as Record<string, string>,
  noThreat: "Nothing that clearly called for an answer.",
  noTypes:
    "No STRATZ parse: damage splits only into right-clicks and the rest; magic and disables aren't known.",
  counterNote:
    "A rule-based estimate: counted when 45% or more of the hero damage taken was magical, 50% or more right-clicks, disables reached 1.5 s a minute, or an enemy hero healed 100 a minute; invisibility, evasion, passives and illusions from lists of heroes and items. Only answers this hero buys are listed (by the player, the rank, the pros or the player's past games).",

  // Power spikes.
  spikes: "Key items and level 6 for all ten",
  spikesHint:
    "BKB, Blink and Aghanim's Scepter ringed; the top row is the teamfights (green: more enemy deaths, red: more of ours)",
  fightsRow: "Fights",
  level6: "Level 6",
  after: "Four minutes after each key item",
  afterHint: "Follows the range above; greyed: there were teamfights and none was joined",
  afterCols: {
    t: "Time",
    fights: "Teamfights (joined / all)",
    ka: "Kills / assists",
    taken: "Taken by the team",
    tower: "Building damage",
  },
  objectives: {
    tower: "tower",
    rax: "barracks",
    fort: "Ancient",
    roshan: "Roshan",
    tormentor: "Tormentor",
    other: "building",
  } as Record<string, string>,
  cut: (sec: number) => `the game ended ${sec} s later`,
  enemySpike: "Teamfights right after an enemy core's BKB or Blink (within 2 minutes)",
  enemyCols: {
    t: "Fight",
    spike: "Enemy item",
    bkb: "BKBs (ours : theirs)",
    joined: "Joined",
    result: "Deaths (ours / theirs)",
  },
  before: (sec: number) => `${sec} s before`,
  noEnemySpike: "No such fights.",
  coresNote:
    "Cores: STRATZ's positions 1–3, else the three richest; a purchase isn't always on the hero right away.",

  // Neutral items.
  neutral: "Neutral items against the pros",
  neutralHint: (n: number) =>
    `Pros: the neutral item held at the end of ${n} pro games on the hero this patch`,
  neutralCols: {
    item: "Held this game",
    t: "Got",
    pro: "Pros ending with it (same tier)",
    top: "Pros' most common at the tier",
  },
  tierShort: (tier: number) => `T${tier}`,
  neutralTop: "Most often held at the end by pros",
  neutralCount: (n: number, of: number) => `${n}/${of}`,
  neutralTier: (n: number, of: number, tier: number) =>
    `${n} of the ${of} pro games ending with a tier ${tier} neutral`,
  neutralIsTop: "the tier's most common",
  neutralFinal: "final",
  neutralNote:
    "The pros' numbers count the item held at the end of the game: for lower tiers they come only from the few games that still held one, so they say little. Tiers follow the 7.41 neutral item table.",

  // Units the player controlled.
  units: "Other units' items (Spirit Bear…)",

  // Rows of the differences table.
  metricTpLess: "Time without a TP after 10:00",
  metricTreads: "Power Treads switches a minute",

  // One-line readings and summary lines (who is A / B, or empty for one match).
  tpLine: (who: string, time: string, longest: string) =>
    `${who || "The player"} went ${time} without a TP after 10:00 (longest ${longest}).`,
  tpDeaths: (who: string, n: number) =>
    `${who || "The player"} died ${n === 1 ? "once" : `${n} times`} without a TP.`,
  magicNoAnswer: (who: string, share: string, items: string) =>
    `${share} of ${who ? `${who}'s` : "the"} hero damage taken was magical, and no answer was bought (${items}; estimate).`,
  rareBuild: (who: string, items: string) =>
    `${who || "The player"} went off the usual build: ${items}, rare at the rank and among pros.`,
  skippedStaple: (who: string, item: string, share: string) =>
    `${who || "The player"} skipped ${item}, which ${share} of the rank buy.`,
  treadsPair: (a: string, b: string, avg: string) =>
    `Power Treads switches a minute: A ${a}, B ${b} (the rank about ${avg}).`,
  treadsSingle: (who: string, v: string, avg: string) =>
    `${who || "The player"} switched Power Treads ${v} times a minute; the rank about ${avg}.`,
  spikeIdle: (who: string, item: string) =>
    `In the four minutes after ${item}, ${who || "the player"} joined no teamfight, had no kills or assists and hit no buildings.`,
  enemySpikeFight: (who: string, hero: string, item: string, sec: number, ours: number, theirs: number) =>
    `${who || "The player"} fought ${sec} s after ${hero}'s ${item}: ${ours} of ours died, ${theirs} of theirs.`,
  join: ", ",
};

export default itemsEn;

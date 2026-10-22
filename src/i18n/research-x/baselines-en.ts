import type baselinesZh from "./baselines-zh";

const baselinesEn: typeof baselinesZh = {
  // What the references are.
  refsTitle: "What each game is compared with",
  refsHint: "the same hero's average at the same rank and position (STRATZ), each game against its own",
  bracket: "Rank and position",
  anyPosition: "any position",
  posFrom: {
    stratz: "position from STRATZ",
    override: "position set by hand",
    opendota: "position guessed from OpenDota's lane",
    none: "no position",
  },
  period: "Period",
  week: (from: string, to: string) => `the match's week (${from} – ${to}, UTC)`,
  recent: "the latest week (STRATZ no longer has the match's week, or too few games in it)",
  sample: "Sample",
  winRate: (rate: string, n: string) => `${n} games; the hero's win rate at this rank and position ${rate}`,
  patch: "Patch",
  unknownPatch: "unknown",
  patchDiff: (a: string, b: string) =>
    `A and B are on different patches (${a} / ${b}): items, item timings and rank averages don't compare directly.`,
  ownBaselines:
    "A and B are compared with different averages (hero, rank or position differ): each against its own.",
  ownWeeks: "A and B share hero, rank and position, but each is compared with its own match's week.",
  noBaseline: "No rank average (STRATZ returned none).",

  // Games still going.
  countsTitle: "Games still going at each minute",
  countsUnder: (minute: number, n: string) =>
    `From minute ${minute} fewer than 15% of the games are left (${n}).`,
  countsAt: (who: string, at: string, n: string, share: string) =>
    `${who}: at ${at}, ${n} of the reference games were still going (${share}).`,
  countsCaveat:
    "Each minute's average takes only the games still going then, so late minutes lean on long games (close games and comebacks): a late gap to the average isn't purely skill.",
  games: "Games",

  // The wide table.
  tableTitle: "This game vs the rank average",
  tableHint: "at the minute where the time range above ends",
  tableAt: (at: string, n: string, share: string) => `At ${at} (${n} reference games still going, ${share})`,
  lateWarn: "Fewer than 15% of the games are left at this minute: the average leans on long games.",
  stat: "Stat",
  mine: "This game",
  avg: "Average",
  ratio: "Ratio",
  groups: {
    economy: "Economy",
    fighting: "Fighting",
    taken: "Hero damage taken",
    feeding: "What deaths gave away",
    support: "Support and runes",
    misc: "Actions",
  },
  rows: {
    networth: "Net worth",
    xp: "XP",
    cs: "Last hits",
    dn: "Denies",
    level: "Level",
    neutrals: "Camps cleared",
    ancients: "Ancient camps cleared",
    towerDamage: "Building damage",
    kills: "Kills",
    deaths: "Deaths",
    assists: "Assists",
    kp: "Kill participation",
    heroDamage: "Hero damage",
    attackDamage: "Right-click damage (hero)",
    castDamage: "Spell and item damage (hero)",
    stunDuration: "Stuns dealt (seconds)",
    damageReceived: "Total",
    physicalDamageReceived: "Physical",
    magicalDamageReceived: "Magical",
    pureDamageReceived: "Pure",
    goldFed: "Gold given to the enemy",
    xpFed: "XP given to the enemy",
    goldLost: "Gold lost",
    campsStacked: "Camps stacked",
    healingAllies: "Healing allies",
    runeBounty: "Bounty runes",
    runePower: "Power runes",
    apm: "APM (average up to this minute)",
    casts: "Casts and item uses (Power Treads toggles included)",
    abilityCasts: "Ability casts",
  },
  // Rows whose table label leans on its group, standing alone in a sentence.
  alone: { damageReceived: "Hero damage taken", stunDuration: "Seconds of stuns dealt" } as Record<
    string,
    string
  >,
  wholeMark: "*",
  wholeNote: "* No timestamps for this one: the whole game's number.",
  campsNote:
    "Camps cleared are estimated from last hits: neutral last hits in one place within 25 s count once.",
  noTable: "No average for this minute.",

  // OpenDota's benchmarks.
  benchTitle: "OpenDota hero benchmarks: what the next step takes",
  benchHint: "this game's value, the share of players it beats, and the values for 50% / 75% / 90%",
  bench: {
    gold_per_min: "GPM",
    xp_per_min: "XPM",
    kills_per_min: "Kills per minute",
    deaths_per_min: "Deaths per minute",
    assists_per_min: "Assists per minute",
    last_hits_per_min: "Last hits per minute",
    denies_per_min: "Denies per minute",
    hero_damage_per_min: "Hero damage per minute",
    hero_healing_per_min: "Healing per minute",
    tower_damage: "Building damage",
  } as Record<string, string>,
  value: "This game",
  better: "Beats",
  benchNote:
    "Fewer deaths is better, so the death steps get smaller to the right. 75% is interpolated between OpenDota's neighbouring steps.",
  noBench: "No OpenDota benchmarks.",

  // Item timings.
  itemsTitle: "Item timings against the rank, the player's own and pros",
  itemsHint:
    "first purchases: key items, plus smaller items a fifth of the games at this rank buy; pros are this patch's pro games",
  item: "Item",
  time: "Done",
  avgTime: "Rank average",
  boughtBy: (rate: string) => `bought in ${rate} of games`,
  wrMine: "Win rate when done that minute",
  wrAvg: "Win rate at the average minute",
  personal: "Own median",
  pro: "Pro median",
  fasterThan: (share: string) => `faster than ${share}`,
  edgeBefore: (m: number) => `≤${m}′`,
  edgeAfter: (m: number) => `≥${m}′`,
  noItems: "No items to compare.",
  curveTitle: "Win rate by the minute the item was done",
  curveHint: "same rank and position; points with few games are fainter",
  minuteOf: (m: number) => `${m}–${m + 1} min`,
  winRate2: "Win rate",
  avgMark: "average",
  itemsCaveat:
    "Win rates are STRATZ's games at the same rank and position that finished the item in that minute. Association, not cause: games where it came early were often going well already. STRATZ lists only the minutes with enough games, so the share that buys an item is a little low.",

  // The timeline's curves.
  curvesTitle: "More curves against the rank average",
  curvesHint: "the grey dashed line is the rank average",
  curves: {
    kills: "Kills",
    deaths: "Deaths",
    assists: "Assists",
    campsStacked: "Camps stacked",
    goldFed: "Gold given away by deaths",
    attackDamage: "Right-click hero damage (hero)",
    castDamage: "Spell and item hero damage (hero)",
  },

  // Sentences.
  apart: (who: string, at: string, parts: string, thin: string | null) =>
    `By ${at}, ${who} is furthest from the rank average in ${parts}${thin ? `; only ${thin} of the reference games were still going then` : ""}.`,
  versus: (label: string, mine: string, avg: string) => `${label.toLowerCase()} ${mine} (average ${avg})`,
  kda: (at: string | null, parts: string) => `Kills / deaths / assists${at ? ` by ${at}` : ""}: ${parts}.`,
  kdaPart: (who: string, at: string | null, mine: string, avg: string) =>
    `${who}${at ? ` by ${at}` : ""} ${mine} (rank average ${avg})`,
  partSep: "; ",
  itemLine: (who: string, item: string, at: string, diff: string, wrMine: string, wrAvg: string) =>
    `${who} finished ${item} at ${at} (${diff}); at this rank, games that finished it that minute won ${wrMine}, at the average minute ${wrAvg} (association, not cause).`,
  itemPairLine: (item: string, a: string, wrA: string, b: string, wrB: string, avg: string, wrAvg: string) =>
    `${item}: at this rank, games that finished it in A's minute (${a}) won ${wrA}, in B's (${b}) ${wrB}, at the average (${avg}) ${wrAvg} (association, not cause).`,
  earlier: (d: string) => `${d} before the rank average`,
  later: (d: string) => `${d} after the rank average`,
  itemPair: (item: string, a: string, b: string) => `${item} against the rank average: A ${a}, B ${b}.`,
  early: (d: string) => `${d} early`,
  late: (d: string) => `${d} late`,
  ratioPair: (label: string, at: string, a: string, b: string) =>
    `${label} against each game's own rank average (by ${at}): A ×${a}, B ×${b}.`,
  metricKeyItem: "Core item vs the rank average (s)",
};

export default baselinesEn;

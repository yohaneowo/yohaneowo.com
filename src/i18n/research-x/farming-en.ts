import type farmingZh from "./farming-zh";

const farmingEn: typeof farmingZh = {
  noStratz:
    "No STRATZ parse: what each 10 seconds went on, where the last hits were and the gold log are missing, so only last hits per minute, net worth, the game state and the units killed are left here.",
  misfiled: (n: number) =>
    `STRATZ marks the ${n} frog-camp neutrals killed (tadpoles to ancient frogs, as OpenDota's kill log has them) as lane creeps, so the separate lane and jungle farm speeds, the jungle route, the farm places and the rhythm's wave ↔ camp switches count them as lane; farm time and the total farm speed come from the gold log and aren't affected.`,
  noData: "No STRATZ parse.",
  window: "Selected range",
  all: "Whole game",
  none: "None",
  seconds: (n: number) => `${n} s`,

  speed: {
    title: "Farm time and farm speed",
    hint: "Farm time: 10 seconds with a last hit and no fight; speed: creep and neutral gold earned in that time (from STRATZ's gold log)",
    alive: "Alive",
    farm: "Farm time (of time alive)",
    speed: "Farm speed (gold per farming minute)",
    laneJungle: "Lane / jungle",
    lhRate: "Last hits per farming minute",
    otherShare: "Share of creep gold from last hits in fights",
    farmPm: "Creep and neutral gold (per minute)",
    kills: "Kills and couriers (per minute)",
    objectives: "Buildings and Roshan (per minute)",
    gpm: "All gold (per minute)",
    lhAvg: "Last hits per minute (own / rank average)",
    nwAvg: "Net worth at the span's end (own / rank average)",
    avgNote:
      "The rank average is STRATZ's per-minute average for the hero in the same position and bracket, over only the games still going at that minute (fewer and longer games later on); hover a number for the count.",
    games: (n: string) => `${n} games`,
    gap: (who: string, total: string, time: string, speed: string) =>
      `${who} earns ${total} more creep and neutral gold a minute from farming: farm time ${time}, farm speed ${speed}`,
    gapBy: {
      time: ", so the gap is mostly the time spent farming.",
      speed: ", so the gap is mostly farm speed.",
    } as Record<string, string>,
    gapWindow: (m: string) => ` (both over ${m})`,
    drought: (from: string, to: string, value: string, median: string, doing: string) =>
      `The driest five minutes after 10:00 were ${from}–${to}: ${value} gold a minute (usually ${median})${doing}.`,
    droughtLh: (from: string, to: string, value: string, median: string) =>
      `The fewest last hits in five minutes after 10:00 were in ${from}–${to}: ${value} a minute (usually ${median}).`,
    doing: (list: string) => `; the time then: ${list}`,
  },

  state: {
    title: "Compared in the same game state",
    hint: "Each minute by the team's net-worth lead at its start: ahead by more than 5,000, behind by more than 2,000, else even",
    states: { ahead: "ahead", even: "even", behind: "behind" } as Record<string, string>,
    share: "Share of the game in each state",
    row: "State · phase",
    minutes: "Minutes",
    farm: "Farm gold / min",
    lh: "Last hits / min",
    hd: "Hero damage / min",
    td: "Building damage / min",
    deaths: "Deaths / 10 min",
    farmPct: "Farm time",
    fightPct: "Fight time",
    pair: " (A / B)",
    ratesHint:
      "Farm gold is creep and neutral gold (not known without the gold log); farm and fight time are of the time alive; under 3 minutes no numbers are shown.",
    matchHint:
      " Rows where both games spent 3 minutes or more in the same state and phase are shaded and compare directly.",
    noMatch:
      " The two games never spent 3 minutes or more in the same state and phase, so they can't be compared in the same state.",
    noLead: "No net-worth lead data.",
  },

  routes: {
    title: "Jungle routes and stacks",
    hint: "Neutral last hits at one spot within 12 s of each other are one camp; 7 or more at once is about a stacked camp (or two camps cleared together)",
    visits: "Camps cleared",
    perVisit: "Creeps per camp",
    perMin: "Camps per minute while clearing in a row",
    walk: "Walk to the next camp (median)",
    cycle: "Camp to camp (median)",
    large: "Clears of 7 creeps or more",
    stacks: "Large clears / team's stacks (whole game)",
    ancient: "Of them ancient camps",
    map: "Numbers in order, bigger circles for more creeps, a ring for 7 or more, purple for ancients",
    window: "Map window",
    slice: (from: number, to: number, n: number) => `${from}–${to}′ · ${n} camps`,
    noVisits: "No camps cleared in this window.",
    visit: (i: number, at: string, n: number) => `${i}. ${at} · ${n} creeps`,
    stackNote:
      "The numbers follow the time range above, the map the five minutes picked here; the pace counts only camps less than a minute apart. The team's stacks are every camp the team stacked over the game (the player's own included); counting clears of 7 or more as cleared stacks is an estimate.",
  },

  rhythm: {
    title: "Farming rhythm (from 10:00)",
    hint: "Each line is one; follows the time range above",
    switches: "Wave ↔ nearby camp",
    gaps: "45 s+ without a last hit",
    idle: "40 s+ idle",
    line: (switches: number, per100: string, gaps: number, idle: number, longest: string) =>
      `Went between a wave and a nearby camp within 40 s ${switches} times (${per100} per 100 last hits); went 45 s or more without a last hit while alive and out of fights ${gaps} times; spent 40 s or more only moving or in base ${idle} times${longest}.`,
    longest: (d: string, at: string) => `, the longest ${d} (${at})`,
    rule: "Idle leaves out hitting buildings, being at Roshan and the 30 s after respawning; nearby = within 20 cells (about 2,500 units).",
  },

  method: {
    title: "How the last hits were made",
    hint: "Each last hit by STRATZ: a right-click, an item (Battle Fury's cleave…), an ability, or an illusion or other unit",
    source: "How",
    total: "Total",
    share: "Share",
    gold: "Gold",
    rightClick: "Right-click",
    units: "Illusions and other units",
    item: "Item",
    ability: "Ability",
  },

  places: {
    title: "Where the farm came from",
    camps: "Neutral camps by size (OpenDota, kills over the game)",
    campNames: {
      small: "Small",
      medium: "Medium",
      mediumLarge: "Medium or large (centaurs, satyrs)",
      large: "Large",
      ancient: "Ancient",
      other: "Other",
    } as Record<string, string>,
    creeps: (melee: number, ranged: number, siege: number, flag: number) =>
      `Lane creeps: melee ${melee}, ranged ${ranged}, siege ${siege}, flagbearers ${flag}`,
    upgraded: (upgraded: number, mega: number) => `, of them super ${upgraded}, mega ${mega}`,
    denied: (n: number) => `; denied ${n}`,
    where: "Where the last hits were (STRATZ, by phase)",
    n: "Last hits",
    rows: {
      ownJungle: "Own jungle",
      enemyJungle: "Enemy jungle",
      ancients: "Ancient camps (both sides)",
      ownBase: "Lane · own base",
      ownHalf: "Lane · own half",
      enemyHalf: "Lane · enemy half",
      enemyBase: "Lane · enemy base",
      enemyTowers: "Nearer enemy towers",
    } as Record<string, string>,
    rule: "Own and enemy sides split at the river (the map's diagonal): the safe lane's tier-1 tower stands by the river, so the usual farm in front of it partly counts as the enemy half. 'Nearer enemy towers' counts only the towers still standing (the line moves forward as towers fall) and shows better how deep the farm was: a rough territory.",
  },

  afford: {
    title: "Key items: affordable to paid",
    hint: "From when the gold on hand first covered what was left to buy (less the parts already bought) to paying it off; and how long after paying the item came together (the courier, or a trip home)",
    bought: "Came together",
    from: "Affordable",
    held: "Held",
    heldBuyback: "With buyback kept",
    wait: "Paid, waited",
    where: "Where",
    place: { base: "in base", dead: "while dead", field: "in the field" } as Record<string, string>,
    none: "No key items in this range.",
    rule: "One point every 10 seconds, so gaps of a few seconds don't show. OpenDota logs no recipes: when the recipe was bought is read from the drop in gold on hand, left empty when it can't be. From 30:00 keeping buyback gold is common: 'with buyback kept' counts only the time the gold covered the item with buyback still paid for.",
  },

  insight: {
    single: (farm: string, speed: string, lh: string) =>
      `Farmed ${farm} of the time alive, at ${speed} gold and ${lh} last hits per farming minute.`,
    lhOnly: (lh: string, avg: string) => `${lh} last hits a minute (rank average ${avg}).`,
    state: (state: string, phase: string, a: string, b: string) =>
      `${phase}, game ${state}: farm gold per minute A ${a}, B ${b}.`,
    stateLh: (state: string, phase: string, a: string, b: string) =>
      `${phase}, game ${state}: last hits per minute A ${a}, B ${b}.`,
  },

  summary: {
    speed: (who: string, total: string, speed: string, time: string) =>
      `${who} farms ${total} more, mostly by farming faster (speed ${speed}, farm time ${time}).`,
    time: (who: string, total: string, time: string, speed: string) =>
      `${who} farms ${total} more, mostly by spending more time farming (farm time ${time}, speed ${speed}).`,
    single: (speed: string, farm: string) =>
      `Farm speed ${speed} gold per farming minute, farming ${farm} of the time alive.`,
    drought: (from: string, to: string, value: string, median: string) =>
      `Farm fell to ${value} gold a minute in ${from}–${to} (usually ${median}).`,
    held: (item: string, held: string) => `${item} was affordable ${held} before it was paid for.`,
  },

  lessons: {
    idle: (n: number, secs: string, rate: string, gold: string) =>
      `After 10:00, ${n} stretches of 40 s or more only moving or in base (not hitting buildings, at Roshan or just respawned), ${secs} in all beyond 20 s of walking each; at the player's own average farm while alive after 10:00 (${rate} gold a minute) about ${gold} gold (an estimate).`,
  },

  metrics: {
    farmSpeed: "Farm speed (gold per farming minute)",
    drought: "Farm gold in the driest 5 minutes after 10:00",
    perVisit: "Creeps per camp cleared",
    skillLh: "Last hits not by right-click",
  },
};

export default farmingEn;

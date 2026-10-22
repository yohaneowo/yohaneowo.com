import type decisionsZh from "./decisions-zh";

const decisionsEn: typeof decisionsZh = {
  noPositions: "Not parsed by STRATZ: no positions.",
  noTiming: "Not parsed by STRATZ: can't be worked out.",
  none: "None",
  yes: "✓",
  no: "✗",
  phaseNames: { laning: "Laning", mid: "Mid game", late: "Late game" },
  total: "Whole game",
  sec: (n: number) => `${n} s`,
  plus: (n: number) => `+${n} s`,
  units: (n: string) => `${n} units`,
  afterN: (what: string, n: number) => `${what} after ${n}`,
  listSep: "; ",
  paren: (s: string) => `(${s})`,
  objectives: {
    building: "Building",
    roshan: "Roshan",
    tormentor: "Tormentor",
    courier: "Courier",
  },
  ours: "We took it",
  theirs: "They took it",
  courierOurs: "Enemy courier killed",
  courierTheirs: "Our courier lost",

  // Key moments.
  moments: "Key moments: the minutes the win chance moved most",
  momentsHint: "STRATZ's win chance for the team by minute: the 4 biggest drops and the 3 biggest gains",
  momentsNw:
    "STRATZ has no win chance for this match: the change in the team's net-worth lead per minute is used instead.",
  swingName: { win: "win-chance", nw: "net-worth-lead" },
  noSwing: "No win chance or net-worth lead data.",
  colMinute: "Minute",
  colSwing: "Change",
  colWhat: "What happened",
  colMe: "The player",
  colPart: "Part",
  colWatch: "Watch",
  fightLine: (at: string, ours: number, theirs: number) =>
    `Teamfight ${at} (we lost ${ours}, they lost ${theirs})`,
  deathsLine: (ours: number, theirs: number) => `Kills: we lost ${ours}, they lost ${theirs}`,
  nothing: "No kills or objectives",
  deadFor: (n: number) => `dead ${n} s`,
  away: (n: string) => `${n} from the nearest kill or objective`,
  dealt: (n: string) => `dealt ${n}`,
  dropsLine: (n: number, k: number, quiet: number) =>
    `The biggest ${n === 1 ? "drop" : `${n} drops`}: took part in ${k}${quiet ? ` (${quiet} of those minutes had no kill or objective)` : ""}.`,
  gainsLine: (n: number, k: number, quiet: number) =>
    `The biggest ${n === 1 ? "gain" : `${n} gains`}: took part in ${k}${quiet ? ` (${quiet} of those minutes had no kill or objective)` : ""}.`,
  partNoPositions:
    "No positions: taking part is judged only from teamfights joined and the player's own kills, deaths and assists; the rest shows '–'.",
  partHint:
    "Took part: joined that minute's teamfight, had a kill, death or assist in it, or was alive within 1,500 units of its kills or objectives. The win chance has one point a minute, so only the minute is known.",
  watchNote:
    "Watch: the times are the game clock. Download the replay in the client (Watch → Replays, by match ID) and drag the timeline to that time. The console's demo_gototick takes ticks (30 a second) counted from the start of the recording, draft, countdown and pauses included, so the game clock alone can't be turned into a tick; only the time is given.",
  replay: "Replay file (.dem.bz2)",

  // The swing while something happened.
  swing: "What the player was doing while the win chance moved (by phase)",
  swingHint:
    "Each minute's change in the win chance, added to what happened in it; a minute can count under several rows",
  swingCaveat:
    "This is the team's swing in win chance (or net-worth lead) during those minutes, not this player's credit or blame.",
  swingCats: {
    kills: "Own kills or assists",
    deaths: "Own deaths",
    joined: "Teamfights joined",
    missed: "Teamfights not joined (alive)",
    taken: "Objectives we took",
    lost: "Objectives they took",
    quiet: "None of these",
  },
  minutes: (n: number) => `${n} min`,

  // After fights.
  after: "After a won fight or a kill",
  afterHint:
    "In the 150 s after a teamfight and the 90 s after a kill: the team's objectives and what the player did",
  afterLine: (won: number, converted: number, hit: number | null) =>
    `${converted} of ${won} won teamfights (more enemy deaths than ours) were turned into objectives${hit != null ? `; after ${hit} the player hit buildings` : ""}.`,
  noWon: "No won teamfights.",
  colFight: "Teamfight",
  colDeaths: "Ours / theirs died",
  colTook: "We took next",
  colTime: "The player (s): farm / fight / move / base / dead",
  colHit: "Building damage",
  doing: {
    dead: "died",
    hit: "hit buildings",
    farm: "farmed",
    base: "went to base",
    other: "moved or fought",
  },
  picksLine: (n: number, took: number, parts: string) =>
    `${n} kill${n === 1 ? "" : "s"} outside the won teamfights: the team took an objective after ${took}; the player ${parts}.`,
  deathLoss: (k: number, n: number) => `The enemy took an objective within 90 s of a death: ${k}/${n}`,

  // Phases.
  phases: "Phases set by the game's events",
  phasesHint:
    "Laning lasts until the own tier-1 tower in the player's lane falls or they leave the lane for good (15:00 at the latest), the mid game until the first barracks falls, then the late game",
  phaseSpan: (name: string, from: string, to: string) => `${name} ${from}–${to}`,
  laneWhy: { tower: "tier 1 fell", left: "left the lane", cap: "to 15:00" },
  colPhase: "Phase",
  colSpan: "Time",
  colFarm: "Farm",
  colFightShare: "Fight",
  colMove: "Move",
  colDead: "Dead",
  colPace: "Kills and net worth per minute (both teams)",
  colDeathShare: "Deaths (share of ours)",
  colKp: "Kill participation",
  phaseDiff: (phase: string, what: string, a: string, b: string) => `${phase}: ${what} A ${a}, B ${b}.`,
  phaseDeaths: (phase: string, who: string, share: string, k: number, n: number) =>
    `${phase}${who ? ` (${who})` : ""}: ${share} of the team's deaths (${k}/${n}); an even split is 20%.`,
  shares: { farm: "farm", fight: "fight", move: "move", dead: "dead" },
  paceHint:
    "Pace: kills and net worth gained per minute by both teams together, to read deaths and fights against (fast games bring more deaths).",

  // Buybacks.
  buyback: "Buyback gold late in the game",
  buybackHint:
    "From 30:00 (or from when an own tier-3 tower is first hit); buyback costs 200 + net worth ÷ 13",
  bbStart: (at: string, tower: boolean) => `From ${at}${tower ? " (an own tier-3 tower under attack)" : ""}`,
  bbHeld: (share: string, n: number) =>
    `the gold on hand covered a buyback ${share} of the living time; ${n} buyback${n === 1 ? "" : "s"}.`,
  bbCount: (n: number) => `${n} buyback${n === 1 ? "" : "s"}.`,
  bbDeaths: (n: number, noGold: number, unused: number) =>
    `${n} death${n === 1 ? "" : "s"}: ${noGold} without buyback gold; ${unused} with buyback ready (gold and cooldown) but unused while a building fell before the respawn.`,
  bbUnknown: "No gold-on-hand data (not parsed by STRATZ), so whether a buyback was affordable is unknown.",
  bbNoDeaths: "No deaths in this part.",
  bbShort: "The game ended before the late game.",
  bbLackRow: (at: string, gold: string, cost: string) =>
    `${at}: died with ${gold} on hand, buyback cost ${cost}`,
  bbUnusedRow: (at: string, lost: string) => `${at}: could buy back, didn't; lost ${lost} before the respawn`,

  // Respawns.
  respawn: "After respawning",
  respawnHint:
    "After each respawn (or buyback): a teleport or not, how soon the first last hit or fight came, where the player went first",
  colRespawn: "Respawn",
  colTp: "TP",
  colLh: "First last hit",
  colEngage: "First fight",
  colWent: "Went to",
  colNote: "Notes",
  went: { farm: "farm", fight: "fight", base: "stayed in base", move: "walk around" },
  walked: "walked",
  bought: "buyback",
  alone: "joined a teamfight alone",
  diedAgain: "died again within 60 s",
  respawnLine: (n: number, tp: number, median: string) =>
    `${n} respawn${n === 1 ? "" : "s"}, ${tp} with a teleport out within 15 s; median time to the first last hit ${median}.`,

  // Encounters.
  encounters: "Every exchange (including trades nobody died in)",
  encountersHint:
    "Hero damage between the player and the enemy heroes; an exchange ends after 6 s without new damage, and counts at 300+ damage or a death",
  encountersCaveat:
    "Outcome: by deaths when someone died, else a 1.5× damage edge wins. Only the player's own damage dealt and taken is in the data; allies' damage isn't counted.",
  colN: "Exchanges",
  colWon: "Won",
  colLost: "Lost",
  colEven: "Even or traded",
  colSmall: "Outside teamfights (won)",
  colFirst: "Player hit first",
  netDamage: "Each exchange: dealt − taken (colour = outcome, A circles, B squares)",
  results: { won: "won", lost: "lost", traded: "traded", even: "even" },
  encountersLine: (n: number, won: string, small: number, smallWon: number) =>
    `${n} exchange${n === 1 ? "" : "s"}, ${won} won; ${small} outside teamfights, ${smallWon} of them won.`,
  duelsLine: (n: number, won: number, lost: number) =>
    `One on one (a single enemy, no teammate near): ${n}, won ${won}, lost ${lost}.`,

  // Ally deaths.
  allies: "When a teammate died",
  alliesHint:
    "Each teammate's death: how far the player was then and 20 s before, and whether they hit someone or teleported in",
  alliesCaveat:
    "Judged from everyone's replay positions; the player may not have known the teammate was caught, and saving spells or items without damage aren't seen.",
  cls: {
    helped: "hit someone (within 2,500)",
    late: "came, but late",
    couldHelp: "could have helped, didn't",
    tooFar: "too far",
    dead: "was dead too",
  },
  colAlly: "Teammate",
  colDist: "Distance (20 s before → then)",
  colHitAlly: "Damage",
  colCls: "Reading",
  nearNoHit: "within 1,500, no hit",
  tp: "TP",

  // Space.
  space: "Space: enemy attention drawn",
  spaceHint:
    "Every 10 s, the living enemies within 1,800 units of each living hero of the team; the player's share (an even split is 20%)",
  spaceCaveat: "From everyone's replay positions, enemies in the fog included.",
  colAvg: "Enemies near on average",
  colShare: "Share of the team's",
  carryLine: (carry: string, n: number, gpm: string, other: string) =>
    `In the ${n} minutes the player had 2+ enemies near while ${carry} had none, ${carry} earned ${gpm} gold a minute, against ${other} in the others (a correlation, not a cause).`,
  spaceDeaths: (space: number, feed: number, other: number, team: number) =>
    `Deaths with no teammate within 3,000 units: drawing 3+ enemies ${space}×, with a single enemy near ${feed}×, other ${other}×; near teammates ${team}×.`,

  // Risk.
  risk: "Risky moments",
  riskHint:
    "Alive, 2+ enemies within 1,500 units, no teammate near and no own tower within 2,000 (every 10 s)",
  riskCaveat:
    "From everyone's replay positions; health is only known as each minute's lowest, so 'low health' is for that minute.",
  colRiskTime: "Time (of time alive)",
  colEpisodes: "Times",
  colDied: "Died",
  colEscaped: "Escaped",
  colClose: "Escaped low",
  riskLine: (n: number, died: number, escaped: number, close: number) =>
    `${n} risky moment${n === 1 ? "" : "s"}: died in ${died}, escaped ${escaped} (${close} with that minute's health under 30%).`,
  noRisk: "No risky moments.",

  // Objectives.
  timeline: "Objective timeline",
  timelineHint:
    "Both teams' buildings, Roshan, Tormentor and courier kills, and how far the player was (the closest moment of the 20 s before)",
  timelineCaveat:
    "Roshan's and the Tormentor's places are where the hero who took the Aegis or the kill stood (the pits move between patches and with day and night), a courier's where its killer stood: estimates.",
  presentLine: (n: number, k: number, lost: number, kl: number) =>
    `Present (within 2,000 units) at ${k} of ${n} objectives we took and ${kl} of ${lost} they took.`,
  colObj: "Objective",
  colDistance: "Distance (units)",
  colWho: "Who",
  colState: "The player",
  colPresent: "There",
  aegisBy: "Took the Aegis",
  killedBy: "Killed it",
  bounty: (n: string) => `bounty ${n}`,
  distAxis: "Distance to it (units) · green ours, red theirs, hollow = dead then, dashed 2,000",

  // Defence.
  defense: "Defending buildings",
  defenseHint:
    "Each spell of damage on an own building (drops within 25 s, 250+ health and over 12%, or the one it fell in)",
  defenseLine: (n: number, came: number, tp: number, far: number) =>
    `${n} spell${n === 1 ? "" : "s"} of damage, came within 2,000 units in ${came} (${tp} by teleport); ${far} fell while the player farmed 5,000+ units away.`,
  colWindow: "Under attack",
  colBuilding: "Building",
  colLostHp: "Health lost",
  colFrom: "Distance at start",
  colArrived: "Came",
  colDoing: "Doing",
  fell: "fell",
  there: "already there",
  trades: (list: string) => `Trades (one lost each within 90 s): ${list}`,
  tradePair: (lost: string, took: string) => `lost ${lost} for ${took}`,
  noDefense: "No own building took a real spell of damage.",

  // Split push.
  split: "Split pushing",
  splitHint: "Damage to buildings: no living teammate within 1,500 units counts as alone",
  soloDamage: "Alone",
  teamDamage: "With the team",
  splitKills: (n: number, solo: number) => `Finished ${n} building${n === 1 ? "" : "s"}, ${solo} alone.`,
  enemyHalf: (sec: string, share: string) =>
    `Time in the enemy half with no teammate within 3,000 units: ${sec} (${share} of the time alive).`,
  skipped: "Teamfights not joined",
  skippedRow: (at: string, ours: number, theirs: number, dist: string, doing: string, hit: string) =>
    `${at} (we lost ${ours}, they lost ${theirs}): ${dist} from the fight, ${doing}, building damage ${hit}`,
  noSkipped: "Joined every teamfight.",

  // Section readings and the summary.
  insightMoments: (n: number, k: number, what: string) =>
    `Took part in ${k}/${n} of the biggest ${what} drops.`,
  insightMomentsPair: (a: string, b: string, wa: string, wb: string) =>
    wa === wb
      ? `Took part in the biggest ${wa} drops: A ${a}, B ${b}.`
      : `Took part in the biggest drops (A ${wa}, B ${wb}): A ${a}, B ${b}.`,
  insightConvert: (n: number, k: number) => `${k} of ${n} won teamfights were turned into objectives.`,
  insightConvertPair: (a: string, b: string) => `Won teamfights turned into objectives: A ${a}, B ${b}.`,
  insightPresent: (n: number, k: number) => `Present at ${k} of the ${n} objectives the team took.`,
  insightPresentPair: (a: string, b: string) => `Present when the team took objectives: A ${a}, B ${b}.`,
  insightFar: (n: number) =>
    `${n} own building${n === 1 ? "" : "s"} fell while the player farmed 5,000+ units away.`,
  insightFarPair: (a: number, b: number) =>
    `Own buildings lost while farming 5,000+ units away: A ${a}, B ${b}.`,
  insightNone: "No positions (not parsed by STRATZ): only the objectives and teamfights are listed.",
  summaryDrops: (who: string, n: number, k: number, what: string) =>
    `${who} took part in only ${k}/${n} of the biggest ${what} drops.`,
  summaryDeathLoss: (who: string, k: number, n: number) =>
    `${who}: ${k} of ${n} deaths were followed by a lost objective within 90 s.`,
  summaryConvert: (a: string, b: string) => `Won teamfights turned into objectives: A ${a}, B ${b}.`,
  summaryBuyback: (who: string, n: number) => `${who} died ${n}× late without buyback gold.`,
  summaryUnused: (who: string, n: number) =>
    `${who} had buyback gold ${n}× but didn't buy back, and lost a building before respawning.`,
  summaryPresent: (a: string, b: string) => `Present when the team took objectives: A ${a}, B ${b}.`,
  ratio: (k: number, n: number) => `${k}/${n}`,
  lessonRespawn: (sec: number) =>
    `About ${sec} s between respawns and the first last hit (beyond 30 s of walking, without a teleport or a fight), valued at the farm rate of the time (estimate)`,

  metrics: {
    objPresence: "Present at team objectives",
    fightConvert: "Won fights turned into objectives",
    deathLoss: "Deaths followed by a lost objective",
    bbHeld: "Late time holding buyback gold",
    riskShare: "Time in risky moments",
    encounterWin: "Exchanges won",
    allyHelped: "Teammate deaths answered",
    spaceShare: "Share of the team's enemy attention",
    respawnLh: "Respawn to first last hit (s)",
  },
};

export default decisionsEn;

import type fightsZh from "./fights-zh";

// "1 death", "2 deaths".
const n_ = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// "A: the team…" when comparing, "The team…" alone.
const lead = (who: string, rest: string) => (who ? who + rest : rest.charAt(0).toUpperCase() + rest.slice(1));

const fightsEn: typeof fightsZh = {
  who: (label: string) => `${label}: `,
  none: "No teamfights in this time range.",
  results: { won: "Won", lost: "Lost", traded: "Traded" } as Record<string, string>,
  presence: { joined: "In", absent: "Away", dead: "Dead" } as Record<string, string>,

  outcome: "Teamfight results and the player's weight in them",
  outcomeHint: "OpenDota's teamfights, one per row",
  outcomeRule:
    "The side that lost more heroes lost the fight, the same number is a trade; gold and XP are the team's swing in the fight (what the team gained less what the enemy did); the level edge is the gap between the two teams' average levels at the start (from everyone's XP); the player's level is the one at the start, with the levels gained in the fight in brackets; the damage share is the player's part of the team's damage in the fight.",
  col: {
    time: "Time",
    result: "Result (deaths ours:theirs)",
    swing: "Team gold / XP",
    edge: "Level edge at start",
    level: "Player's level",
    dmgShare: "Damage share",
    healShare: "Healing share",
    presence: "Player",
  },
  recordRows: {
    joined: "Player in",
    absent: "Player alive but away",
    dead: "Player dead",
  } as Record<string, string>,
  recordCols: { n: "Fights", wlt: "Won / lost / traded", gold: "Team gold, avg", xp: "Team XP, avg" },
  big: (n: number, won: number, lost: number) =>
    `${n_(n, "fight", "fights")} with 35%+ of the team's damage: ${won} won, ${lost} lost.`,
  healNote:
    "OpenDota's teamfight healing includes the player's own (Magic Wand, lifesteal…), not only heals on allies.",

  missed: "Teamfights missed",
  missedHint: "alive but not in it",
  missedRule:
    "From the fight: at its start, how far the player was from the centre of where its heroes died; nearest enemy: the closest the player got to any enemy during it (as in the fight table); doing: what most of its 10-second samples went on; then what the player earned meanwhile, and the team's swing and win chance in it (the whole team's change, not all of it down to the absence).",
  noMissed: "No teamfight was missed while alive.",
  missedCol: {
    activity: "Doing",
    dist: "From the fight / nearest enemy (units)",
    meanwhile: "Own gold / XP",
    team: "Team result",
    swing: "Team gold / XP",
    win: "Win chance",
  },
  hindsight: "The player may not have known a fight was on there, or had something more pressing.",

  prep: "Readiness and execution in fights",
  prepHint: "fights joined",
  prepRule:
    "Ultimate and key items: ready at the start or not (used in the 15 s before it counts as used for the fight); BKB, Manta, Satanic: switched on before the first damage taken or after; right-click uptime: from the first action to the fight's end or the death, the share of seconds with the hero's own right-clicks landing on a hero (how many heroes in brackets); active uptime also counts spell damage and casts on heroes — the one to read for supports.",
  prepCol: {
    ult: "Ultimate",
    items: "Key items",
    timing: "BKB / Manta / Satanic",
    uptime: "Right-click uptime",
    active: "Active uptime",
    result: "Result",
  },
  ult: { ready: "Ready", used: "Just used", none: "Not learned", cooldown: "Cooldown" } as Record<
    string,
    string
  >,
  left: (n: number) => `${n} s left`,
  itemState: {
    ready: "Ready",
    used: "Just used",
    cooldown: "On cooldown",
    backpack: "In backpack",
  } as Record<string, string>,
  bag: "BP",
  kinds: { proactive: "Before hit", reactive: "After hit", unused: "Hit, not used" } as Record<
    string,
    string
  >,
  fromStart: (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)} s in`,
  afterHit: (n: number) => (n >= 0 ? `${n} s after the first hit` : `${-n} s before the first hit`),
  hitCount: (n: number) => n_(n, "hero", "heroes"),
  notReady: (n: number, won: number, lost: number) =>
    `${n_(n, "fight", "fights")} started not ready (ultimate or BKB, Manta, Blink with 5 s+ of cooldown left, or in the backpack): ${won} won, ${lost} lost.`,
  allReady: "The ultimate and key items were ready at the start of every fight joined.",
  prepEstimate:
    "Base cooldowns; cooldown cuts (talents, Octarine Core…) aren't counted, nor moments when a stun or silence left no way to use it.",
  noStratz: "Without STRATZ's parse there are no items, cooldowns or single hits to read.",

  recap: "Deaths taken apart",
  recapHint: "each death",
  recapRule:
    "Hero damage taken in the 10 s before the death (enemy illusions and summons included), by hero, ability and type; 60%+ of it in the last 3 s counts as a burst. Ready, unused: saving items off cooldown at the death and not used in its last 15 s (blinks left out: hero damage disables them for 3 s); charges left: Magic Wand, healing items… in the main slots at the death.",
  recapCol: {
    taken: "Taken, last 10 s",
    last3: "Last 3 s",
    from: "Mostly from",
    killers: "Killer and assists",
    unused: "Ready, unused",
    charges: "Charges left",
  },
  types: ["Right-click", "Physical spell", "Magical", "Pure"],
  recapLine: (n: number, burst: number, unused: number, wand: number) =>
    `${n_(n, "death", "deaths")}: ${n_(burst, "burst", "bursts")}; ${unused} with a saving item ready and unused; ${wand} with half a Magic Wand or more left.`,
  recapEstimate:
    "Ready, unused looks only at cooldowns and recent uses: whether a stun or silence before the death left no way to use it isn't known.",

  cost: "What deaths and kills were worth",
  costHint: "whole game",
  costRule:
    "Death cost = gold lost + farm missed while dead (at the farm rate of the 5 minutes before); gold and XP given to the enemy are apart. Rank average: the same hero and position at the same minute, summed so far (games still going only).",
  costRows: {
    cost: "Death cost",
    rate: "Per minute / of income",
    rateLostOnly: "Per minute / of income (gold lost only)",
    fed: "Given to the enemy",
    avg: (minute: number, n: string) => `Rank average (by minute ${minute}, ${n} games)`,
    kills: "Kills",
    richest: "Richest kills",
  },
  costValue: (cost: string, lost: string, missed: string) => `${cost} (lost ${lost} + missed ${missed})`,
  costNoMissed: (lost: string) =>
    `${lost} (gold lost only: without STRATZ's gold data the farm missed is unknown)`,
  fedValue: (gold: string, xp: string | null) => (xp ? `${gold} gold, ${xp} XP` : `${gold} gold`),
  lostFed: (lost: string, fed: string, xp: string | null) =>
    `lost ${lost}, fed ${fed} gold${xp ? ` and ${xp} XP` : ""}`,
  avgValue: (avg: string, me: string) => `${avg} (player: ${me})`,
  killsValue: (n: number, gold: string, xp: string | null, xpN: number) =>
    `${n}, each +${gold} gold${xp ? ` and +${xp} XP` : ""} on average${xp && xpN < n ? ` (XP over the ${xpN} with data)` : ""}`,
  noKills: "No kills, or no kill gold from STRATZ.",
  noDeaths: "No deaths.",

  cohesion: "Zone changes and grouping",
  cohesionHint: "by phase",
  cohesionRule:
    "Zone changes: the zone (three lanes, both jungles, the river, both bases) on the 10-second samples while alive, each change counted, per minute; distance to teammates: to the centre of the other living teammates (two or more), a teammate taken as dead while their position stands still. Neither is better or worse, only a style.",
  zonesCell: (z: string, d: string) => `${z}/min · ${d} units`,
  noGrid: "No positions from STRATZ.",

  lesson: (at: string, lost: string, missed: string) =>
    `Death at ${at}: ${lost} gold lost and about ${missed} of farm missed while dead`,
  lessonNoMissed: (at: string, lost: string) => `Death at ${at}: ${lost} gold lost`,
  lessonMissedOnly: (at: string, missed: string) =>
    `Death at ${at}: no gold lost, but about ${missed} of farm missed while dead`,
  lessonFed: (fed: string) => ` (and ${fed} to the enemy)`,
  lessonUnused: (items: string) => `; ${items} ready and unused`,
  end: ".",

  inRecord: (who: string, n: number, won: number, lost: number) =>
    lead(who, `the team won ${won} and lost ${lost} of the ${n} fights the player joined`),
  inAbsent: (n: number, lost: number) =>
    n === 1
      ? `, and ${lost ? "lost" : "didn't lose"} the one missed while alive`
      : `, and lost ${lost} of the ${n} missed while alive`,
  inUnused: (who: string, n: number, at: string, items: string) =>
    `${who}${n_(n, "death", "deaths")} with a saving item ready and unused (${at}: ${items}).`,
  inTargets: (who: string, core: string) => `${who}${core} of the hero damage went into enemy positions 1–3`,
  inConverted: (conv: string) => `, ${conv} into enemies who died within 10 s`,
  inUnits: (who: string, share: string) =>
    `${who}${share} of the hero damage came from illusions or summons.`,
  sep: "; ",

  sumAbsent: (who: string, n: number, gold: string) =>
    lead(
      who,
      n === 1
        ? `missed a teamfight while alive; the team's gold swing in it was ${gold}.`
        : `missed ${n} teamfights while alive; the team averaged ${gold} gold in them.`,
    ),
  sumUnused: (who: string, n: number, at: string, items: string) =>
    `${who}${n_(n, "death", "deaths")} with a saving item ready and unused (e.g. ${at}: ${items}).`,
  sumNotReady: (who: string, n: number, lost: number) =>
    `${who}${n} teamfights started without the ultimate or key items ready; ${lost} of them lost.`,
  window: (at: string) => ` (first ${at})`,
  sumWin: (a: string, b: string, win: string) =>
    `The team's win rate in the fights joined${win}: A ${a}, B ${b}.`,
  sumUnusedPair: (a: number, b: number, win: string) =>
    `Deaths with a saving item ready and unused${win}: A ${a}, B ${b}.`,
  sumEff: (a: string, b: string, win: string) =>
    `Hero damage per minute for each 1,000 net worth${win}: A ${a}, B ${b}.`,
  sumUptime: (a: string, b: string, win: string) => `Right-click uptime in teamfights${win}: A ${a}, B ${b}.`,
  sumCost: (a: string, b: string, win: string) => `Death cost per minute${win}: A ${a}, B ${b} gold.`,

  metrics: {
    fightWin: "Team win rate in fights joined",
    fightDmgShare: "Share of the team's fight damage",
    uptime: "Right-click uptime in fights",
    activeUptime: "Active uptime in fights",
    burstDeaths: "Deaths to a burst",
    converted: "Damage on enemies who died within 10 s",
    coreDamage: "Damage into enemy positions 1–3",
    dmgPer1k: "Hero damage per minute per 1k net worth",
    hdShare: "Share of the team's hero damage",
    deathCostPm: "Death cost per minute",
    zonesPm: "Zone changes per minute",
    centroid: "Distance to the team's centre",
  } as Record<string, string>,

  targets: "Whom the damage went to, by enemy position",
  targetsHint: "whole game",
  targetsRule:
    "Dealt and taken are OpenDota's game totals (illusions and summons included); died within 10 s: the share of the damage on enemies who died (by anyone) within 10 s of it, from STRATZ's single hits. Per fight only the shares (the amounts are in the fight table), left out under 300 damage.",
  estimatedPos: "No STRATZ positions: ranked by net worth (the richest as position 1), an estimate.",
  posCol: { pos: "Position", dealt: "Dealt", taken: "Taken" },
  pos: (n: number) => `Pos ${n}`,
  coreLine: (core: string, carryMid: string, taken: string) =>
    `Into enemy cores (positions 1–3): ${core}, ${carryMid} into positions 1 and 2; ${taken} of the damage taken came from cores.`,
  convLine: (v: string) => `${v} of the damage went into enemies who died within 10 s.`,
  fightCol: { fight: "Fight", core: "Into cores", conv: "Died within 10 s", coreTaken: "From cores" },
  efficiency: "Damage for the net worth, and shares of the team",
  efficiencyHint: "OpenDota",
  efficiencyRule:
    "Damage per minute per 1k net worth = the phase's hero damage per minute ÷ its average net worth (thousands), from OpenDota's per-minute damage curve (which can come out a little below the game total); the shares are the player's part of the team's hero damage, tower damage, total gold and final net worth (game totals).",
  per1k: "Damage per minute per 1k net worth",
  whole: "Whole game",
  shareNames: {
    heroDamage: "Hero damage",
    towerDamage: "Tower damage",
    gold: "Total gold",
    netWorth: "Net worth",
  } as Record<string, string>,
  matrix: "Each damage source on each enemy",
  matrixHint: "OpenDota: source × enemy hero, darker is more (right-clicks include illusions and summons)",
  total: "Total",
  heals: "Heals received and given",
  healsHint: "STRATZ's heal events",
  healsRule:
    "Received: own items, own abilities (enemy spells reflected back included) and each ally; heals with no source count as natural regeneration; given: heals on allies.",
  received: "Received",
  given: "Heals on allies",
  ownItems: "Own items",
  ownAbilities: "Own abilities",
  regen: "Natural regeneration (no source)",
  noGiven: "No heals on allies.",
  stratzIn: (v: string) => `STRATZ's total of heals from others: ${v}`,
  stratzGiven: (v: string) => `STRATZ's total of heals on allies: ${v}`,
  noHeals: "Without STRATZ's parse the heals' sources are unknown.",
  odHealing: (v: string) => `OpenDota: ${v} healing on other heroes`,
  foreign: "Damage that wasn't the hero's own",
  reflected: (total: string, hits: number) => `Enemy spells credited to the player: ${total} (${hits} hits)`,
  via: {
    counterspell: ", reflected by Counterspell",
    lotus: ", most likely reflected by Lotus Orb",
    stolen: ", stolen spells",
  } as Record<string, string>,
  back: (total: string) => `Own spells reflected back at the player: ${total}`,
  units: (dealt: string, ds: string, taken: string, ts: string) =>
    `Illusions and summons dealt ${dealt} (${ds} of the hero damage); enemy illusions and summons dealt ${taken} to the player (${ts} of the damage taken).`,
  unitsNote:
    "The damage figures in these two sections include illusions and summons: OpenDota's totals, sources and the matrix above count them as right-clicks, and STRATZ's single hits (the fight table, death recap, by position, died within 10 s) count them too; right-click and active uptime count the hero alone.",
  noForeign: "All of the damage was the hero's own, and none was reflected.",
};

export default fightsEn;

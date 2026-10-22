import type skillsZh from "./skills-zh";

const skillsEn: typeof skillsZh = {
  reading: {
    title: "How to read the use rates",
    hint: "the use rates above, by kind of ability",
    kinds: { nuke: "Damage spells", utility: "Utility spells", ult: "Ultimate" },
    expect: {
      nuke: "for farming, pushing and trading: cores should come close to what the cooldown allows, supports are often held back by mana",
      utility:
        "movement, saves, disables or buffs: it's about timing, a low rate isn't necessarily a problem",
      ult: "judge it by the fights it was used in, not by the cooldown",
    },
    low: (who: string, spell: string, ratio: string) =>
      `${who}'s ${spell} is a damage spell used only ${ratio} of the times its cooldown allowed.`,
  },

  talents: {
    title: "Talents",
    hint: "the two talents of each tier: how often the rank takes each and its win rate, and when this game took it",
    level: "Level",
    talent: "Talent",
    share: "Rank picks",
    win: "Win rate",
    taken: "This game",
    at: (time: string, level: number) => `${time} (level ${level})`,
    avg: (time: string) => `avg ${time}`,
    later: (time: string) => `later ${time}`,
    notTaken: (time: string) => `not taken (level reached ${time})`,
    notReached: "level not reached",
    none: "Without STRATZ's parse the talents taken aren't known.",
    odTimes:
      "Without STRATZ's parse: the order of the points is OpenDota's, each at the earliest level it could have come, and the time is the minute the XP curve reached that level; an estimate.",
    ref: (bracket: string, position: string, n: string) => `${bracket}${position} (STRATZ, ${n} games)`,
    note: (ref: string) =>
      `Rank: ${ref}. The win rate is that of the games where the talent was taken: game length and the state of the game move it, it isn't the talent's own effect; the later tiers only count the games that got there.`,
    differ: (level: number, a: string, b: string, sa: string, sb: string) =>
      `Different talents: at level ${level} A took “${a}”, B “${b}” (taken by ${sa} / ${sb} of the rank).`,
    rare: (who: string, level: number, talent: string, share: string) =>
      `${who} took “${talent}” at level ${level}, which only ${share} of the rank take.`,
    summary: (n: number, levels: string) =>
      `The talents differ in ${n} tier${n === 1 ? "" : "s"} (${levels}).`,
    levels: (list: number[]) => `level ${list.join(", ")}`,
  },

  build: {
    title: "Skill build against the rank",
    hint: "the level each ability was maxed at, and how often the rank does the same",
    ability: "Ability",
    maxed: "Maxed",
    share: "Rank does so",
    win: "Win rate",
    common: "Rank's most common",
    rank: (n: number) => `#${n}`,
    notMaxed: (first: number, n: number) => `not maxed (from level ${first}, ${n} points)`,
    points: (first: number, n: number) => `from level ${first}, ${n} points`,
    atLevel: (level: number, share: string) => `level ${level} · ${share}`,
    none: "Without STRATZ's parse the skill build isn't known.",
    odLevels:
      "Without STRATZ's parse: the order of the points is OpenDota's, each at the earliest level it could have come; an estimate.",
    note: "STRATZ: the hero level the rank maxes each ability at; the shares only count the games where it was maxed, and game length moves the win rate. There's none for the ultimate.",
    rare: (who: string, spell: string, level: number, share: string) =>
      `${who} maxed ${spell} at level ${level}, as only ${share} of the rank do.`,
  },

  conv: {
    title: "After the ultimate and the big spells",
    hint: "the ultimate and the damage or targeted spells with a cooldown of 15 s or more; follows the time range above",
    spell: "Spell",
    casts: "Casts",
    converted: "Kill / assist ≤4 s",
    nobody: "Hit no hero",
    perCast: "Heroes per cast",
    cores: "On cores",
    died: "Died ≤10 s",
    ult: "Ultimate",
    note: "A kill or assist of the player's within 4 s doesn't mean the spell made it; a hit is the cast's hero target or the spell's damage to a hero, so spells whose damage isn't credited to them (summons' attacks, say) can't tell a miss. Cores are the enemy's positions 1–3; died is a hero hit dying within 10 s.",
    none: "Without STRATZ's parse the cast times aren't known.",
    noCasts: "Not cast in this time range.",
    line: (who: string, spell: string, n: number, k: number) =>
      `${who} cast ${spell} ${n} times, ${k} of them followed by a kill or assist within 4 s.`,
    pair: (a: string, b: string, note: string) =>
      `A kill or assist within 4 s of the ultimate: A ${a}, B ${b}${note}.`,
    ofCasts: (k: number, n: number) => `${k} of ${n}`,
    summary: (who: string, a: string, b: string) =>
      `${who}'s ultimate was more often followed right away by a kill or assist (A ${a}, B ${b}).`,
  },

  fightTargets: {
    title: "Who the spells and items went to in each teamfight",
    hint: "on enemies: the heroes the ultimate and the big spells reached, and spells and items aimed at enemies; on allies: spells and items aimed at allies",
    time: "Start",
    result: "Deaths",
    enemy: "On enemies",
    ally: "On allies",
    enemyShare: (cores: number, known: number) => `${cores} of the ${known} on enemies went to cores`,
    allyShare: (n: number, cores: number) => `${n} on allies, ${cores} of them cores`,
    none: "No spells or items aimed at heroes in the teamfights of this time range.",
    noStratz: "Without STRATZ's parse the cast targets aren't known.",
    note: "Spells and items with no target or aimed at the ground (Pipe, area spells) only show who they reached through damage, for the ultimate and the big spells; casts outside teamfights aren't counted.",
  },

  mana: {
    title: "Mana",
    chart: "Average mana per minute (dashed: lowest)",
    lowestLine: "lowest",
    lowest: "Lowest",
    avg: "Average (alive)",
    low: "Time under 20%",
    lowOf: (share: string) => `${share} of the time alive`,
    dips: "Minutes dipping under 10%",
    lane: "Laning (0–10 min) average / lowest",
    fights: "Mana in the minute before teamfights",
    fightsLow: (low: number, n: number) => `${low} of ${n} under 30%`,
    held: "Casts held back by low mana",
    heldValue: (n: string) => `about ${n}`,
    heldNote:
      "Casts held back: how often per minute alive the game's mana-costing spells with a cooldown were cast, times the time under 20% mana; roughly how many casts low mana cost, not that the player wanted to cast then.",
    none: "Without STRATZ's parse mana isn't known.",
    line: (who: string, time: string, share: string) =>
      `${who} spent ${time} (${share} of the time alive) under 20% mana.`,
    pair: (a: string, b: string, note: string) => `Time under 20% mana: A ${a}, B ${b}${note}.`,
    withShare: (time: string, share: string) => `${time} (${share})`,
    summary: (who: string, a: string, b: string) =>
      `${who} ran short of mana more: time under 20% A ${a}, B ${b}.`,
    summarySingle: (time: string, share: string) =>
      `Spent ${time} (${share} of the time alive) under 20% mana.`,
  },

  hero: {
    title: "Hero-specific metrics",
    hint: "the two sides only, no rank reference",
    metric: "Metric",
    generic: "The three abilities used most",
    perMin: "Per minute",
    heroes: "Heroes per cast",
    units: {
      count: (n: number) => `${n} cast${n === 1 ? "" : "s"}`,
      hits: (n: number, of: number) => `${n} hit${n === 1 ? "" : "s"} in ${of} cast${of === 1 ? "" : "s"}`,
      perFight: (n: number, of: number) => `${n} in ${of} fight${of === 1 ? "" : "s"}`,
    },
    note: "Hits come from STRATZ's damage and cast targets (without STRATZ, OpenDota's hit counts for spells that hit one hero); farming and fighting are the time-use reading of those 10 seconds.",
    names: {
      amBlinkPm: "Blinks per minute",
      amBlinkFarm: "Blinks while farming",
      amBlinkFight: "Blinks while fighting",
      amVoidHeroes: "Heroes per Mana Void",
      esFissure: "Heroes per Fissure",
      esEcho: "Heroes per Echo Slam",
      miranaArrow: "Sacred Arrow hit rate",
      miranaArrowPm: "Sacred Arrows per minute",
      pudgeHook: "Meat Hook hit rate",
      pudgeHookKill: "Kill / assist ≤6 s after a hook hit",
      pudgeHookPm: "Meat Hooks per minute",
      wrPowershot: "Heroes per Powershot",
      wrPowershotHit: "Powershot hit rate",
      tideRavage: "Heroes per Ravage",
      enigmaHole: "Heroes per Black Hole",
      tinkerRearmFight: "Rearms per teamfight",
      tinkerRearmPm: "Rearms per minute",
      invokerInvokePm: "Invokes per minute",
      invokerSunStrike: "Sun Strike hit rate",
      invokerMeteor: "Heroes per Chaos Meteor",
      invokerTornado: "Heroes per Tornado",
      magnusRp: "Heroes per Reverse Polarity",
      magnusSkewer: "Heroes per Skewer",
      magnusShockwave: "Heroes per Shockwave",
    },
  },

  buffs: {
    title: "Permanent stacks",
    buff: "Effect",
    note: "The final stacks OpenDota recorded (Scepter, Shard and other item effects are with the items).",
  },

  battle: {
    title: "Attack damage and regeneration",
    hint: "the last value of each minute; runes, the fountain and salves show as spikes",
    attack: "Attack damage (base + bonus)",
    hpRegen: "Health regeneration (per second)",
    mpRegen: "Mana regeneration (per second)",
    marks: "Key items finished",
    none: "Without STRATZ's parse attack damage and regeneration aren't known.",
  },

  map: {
    title: "Map features",
    hint: "follows the time range above",
    feature: "Feature",
    watchers: "Watchers captured",
    gates: "Twin gates",
    gatesValue: (trips: number, uses: number) =>
      `${trips} trip${trips === 1 ? "" : "s"} (${uses} use${uses === 1 ? "" : "s"})`,
    walk: "Walking saved by twin gates",
    walkValue: (perTrip: string, total: string) => `about ${perTrip} a trip, ${total} in all`,
    lotuses: "Lotuses used",
    lotusGiven: (n: number) => `${n} on allies`,
    lotusFrom: (n: number) => `${n} from allies`,
    plucks: "Lotuses plucked",
    outposts: "Outposts captured",
    wisdom: "Wisdom runes",
    wisdomXp: (xp: string) => `${xp} XP under 'tome of knowledge'`,
    tormentor: "Tormentor (ours / theirs)",
    tormentorMine: (n: number) => `taken by the player ${n}×`,
    tormentorOurs: "Tormentor (ours)",
    tormentorTheirs: "Tormentor (theirs)",
    walkNote: (speed: number) =>
      `Twin gates: a trip is a jump of 60 map cells or more right after a use; the walking saved is the straight-line distance at ${speed} movement speed (real paths are longer), the channel itself not taken off.`,
    xpNote:
      "Wisdom rune XP comes under OpenDota's 'tome of knowledge' reason, but players who picked up no wisdom rune can have some too, so it isn't only from the player's own runes.",
    none: "No map features used in this time range.",
    noTimes: "(whole game, no times)",
    line: (list: string) => `Map features: ${list}.`,
    side: (who: string, list: string) => `${who} ${list}`,
    counts: {
      gates: (n: number) => `${n} twin gate trip${n === 1 ? "" : "s"}`,
      watchers: (n: number) => `${n} watcher${n === 1 ? "" : "s"}`,
      lotuses: (n: number) => `${n} lotus${n === 1 ? "" : "es"}`,
      wisdom: (n: number) => `${n} wisdom rune${n === 1 ? "" : "s"}`,
      outposts: (n: number) => `${n} outpost${n === 1 ? "" : "s"}`,
    },
    join: "; ",
  },

  orders: {
    title: "More commands",
    hint: "OpenDota's command counts, for the kinds STRATZ's command breakdown above doesn't separate",
    command: "Command",
    names: {
      hold: "Hold (H)",
      stop: "Stop (S)",
      tree: "Cast on a tree",
      toggle: "Toggle abilities",
      itemManage: "Inventory management",
      dropGive: "Drop, give, pick up items",
      rune: "Pick up runes",
      scan: "Scan",
      ping: "Ability pings",
      move: "Move",
      attack: "Attack",
      cast: "Cast",
    },
    value: (n: string, perMin: string) => `${n} (${perMin}/min)`,
    note: "Inventory management counts moving items, taking them out of the stash and marking them for sale; ability pings are alt-clicks on an ability, not map pings. Move, attack, cast, hold and scan have the same counts in STRATZ's command breakdown above, so they're only listed when a side is without it.",
  },

  chat: {
    title: "Chat and chat wheel",
    hint: "only what this player said; teammates' 'missing' and 'well played' calls are marked by time",
    own: "Typed",
    ownWheel: "Own chat wheel",
    missing: "Teammates: missing",
    wellPlayed: "Teammates: well played",
    wheel: "wheel",
    none: "No chat in this time range.",
  },

  diffHero: " (different heroes, not directly comparable)",

  metrics: {
    ultConv: "Kill / assist within 4 s of the ultimate",
    ultHeroes: "Heroes hit per ultimate",
    lowMana: "Time under 20% mana",
    wisdom: "Wisdom runes",
  },
};

export default skillsEn;

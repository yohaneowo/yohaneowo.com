import type visionZh from "./vision-zh";

const visionEn: typeof visionZh = {
  exposure: "Time in enemy observer vision",
  exposureHint:
    "The player's position every 10 seconds; within 1,600 units of an enemy observer counts as seen. Time dead is left out",
  rows: {
    alive: "Time alive",
    farmLane: "Farming lanes",
    farmJungle: "Farming the jungle",
    fight: "Fighting",
    move: "Moving",
  },
  minutes: "Minutes",
  inEnemy: "Under enemy wards",
  inOwn: "Under own wards",
  exposureMap:
    "Red circles: enemy observers' vision (1,600 units); shading: where the player was (alive); red dots: positions in enemy observer vision (every 10 s)",
  beforeDeath: "Under enemy wards in the minute before each death",
  secs: (n: number) => `${n} s`,
  exposedDeaths: (k: number, n: number, base: string) =>
    `${k} of ${n} deaths came after half or more of the minute before in enemy observer vision (compare: ${base} of the time alive in this range).`,
  noDeaths: "No deaths in this range.",
  exposureHindsight: "Where the enemy's wards stood comes from the replay; the player may not have known.",
  exposureRule:
    "Observers are taken with a 1,600-unit radius for as long as they stood (6 minutes, or until destroyed or the game ended), ignoring trees and high ground, and without enemy heroes', towers' or sentries' vision.",
  value: "What the player's own wards saw",
  valueHint:
    "While each observer stood: enemy heroes within 1,600 units (every 10 seconds, dead ones left out) and enemy deaths in range",
  placed: "Placed",
  area: "Area",
  lived: "Lived",
  seen: "Enemy heroes seen",
  kills: "Kills in range",
  valueLine: (n: number, minutes: string, per: string, kills: number) =>
    `${n} observers saw enemy heroes for ${minutes} hero-minutes in all (${per} s each on average); ${kills} enemy deaths in their range.`,
  sentryLine: (n: number, cleared: number, obs: number) =>
    `While the ${n} sentries stood, ${cleared} enemy wards within 1,050 units were destroyed by the team (${obs} of them observers).`,
  valueRule:
    "By radius only, whether or not trees and high ground block the view; a ward destroyed near several sentries counts for each.",
  noWards: "No wards of the player's in this range.",
  fog: "What the team could see (a fog-of-war estimate)",
  fogHint:
    "How much of the enemy heroes' time the team saw, and at each death whether the enemies around were visible",
  fogLine: (team: string, day: string, night: string) =>
    `The team saw the enemy heroes ${team} of the time (${day} by day, ${night} at night).`,
  seenByEnemy: (v: string) => `The enemy saw the player ${v} of their time alive.`,
  perHero: "Time each enemy hero was seen",
  deathSight: "Enemy heroes within 1,500 units at each death (grey: in the fog then)",
  near: "Enemies around",
  before10: "Seen 10 s before",
  night: "night",
  day: "day",
  nobody: "None",
  fromFog: (k: number, n: number) =>
    `Of the ${n} deaths with enemies around, ${k} came from enemies who had all been in the team's fog 10 s before (out of sight).`,
  fogRule:
    "An enemy hero counts as seen within the vision of a living allied hero (1,800 units by day, 800 at night; a few heroes differ), an observer (1,600) or a standing tower (1,900 by day; at night 600 for tier 1, 1,100 for the others). Day and night take turns every 5 minutes from 0:00 (night before the horn). Creeps, summons, spells, sentries, trees, high ground and invisibility aren't counted, so it can be off either way.",
  habits: "Ward habits: against the usual spots",
  habitsHint:
    "Shading: where this player warded in their other games on the hero (OpenDota); dots (observers, larger at usual spots) and squares (sentries): this game's wards",
  obs: "Observers",
  sen: "Sentries",
  usualLine: (k: number, n: number) => `${k} of this game's ${n} observers were at usual spots.`,
  usualRule: "A usual spot: 3 or more observers within 500 units in their other games.",
  habitsFrom: (obs: number, sen: number) => `Other games: ${obs} observers, ${sen} sentries.`,
  noHabits:
    "No ward map for this player on this hero (asked of OpenDota only for supports and players who placed 3 or more wards this game; anonymous players have none).",
  board: "The whole board at a moment: ten heroes, wards and buildings",
  boardHint:
    "Pick a teamfight, a death, or follow the charts' cursor; the slider moves up to 30 s either way",
  moment: "Moment",
  cursor: "Follow the charts' cursor",
  fightAt: (c: string) => `Teamfight ${c}`,
  deathAt: (who: string, c: string) => `${who} died ${c}`,
  noCursor: "Hover any chart to pick a moment.",
  at: (c: string, night: boolean) => `${c} (${night ? "night" : "day"})`,
  dead: "Dead",
  inFog: "In the team's fog",
  roshanAlive: "Roshan: up",
  roshanDead: (by: string, at: string, from: string, to: string) =>
    `Roshan: killed by ${by} at ${at}, back around ${from}–${to}`,
  roshanMaybe: (by: string, at: string, to: string) =>
    `Roshan: killed by ${by} at ${at}, may be back (by ${to} at the latest)`,
  aegis: (until: string) => `Aegis until ${until}`,
  tormentors: (list: string) => `Tormentors: ${list}`,
  boardLegend:
    "Hero outlines: side colour (the studied players in A orange, B blue); dots: observers; rings: sentries; squares: buildings (coloured by side).",
  boardFog:
    "Faded enemy heroes: by the vision section's rule, the studied player's team couldn't see them then.",
  boardHindsight:
    "The ten heroes and both sides' wards come from the replay; at the time the player couldn't see enemies in the fog or the enemy's wards.",
  noGrid: "Without STRATZ's parse there are no positions for the ten heroes.",
  duel: "Same match: A against B",
  mates: "Same match: A and B are teammates",
  damageLine: (ab: string, abUnits: string, ba: string, baUnits: string, ab10: string, ba10: string) =>
    `A dealt B ${ab} hero damage and B dealt A ${ba} (illusions and units ${abUnits} / ${baUnits}); in the first 10 minutes ${ab10} against ${ba10}.`,
  killsLine: (who: string, other: string, kills: string, assists: string) =>
    `${who} killed ${other}: ${kills}; assists: ${assists}.`,
  dmgChart: "Hero damage dealt to the other, cumulative",
  nwGap: "Net worth gap (A − B)",
  itemRace: "Key items in order (each one's first, second…)",
  order: "#",
  first: "First",
  jungleTitle: "Whose jungle the neutrals came from",
  jungleHint:
    "By the side of the river each neutral died on (camps by the side lanes and the river included)",
  jungleOf: (who: string) => `${who}'s jungle`,
  ownJungle: "Own jungle",
  enemyJungle: "Enemy jungle",
  creeps: (n: number, gold: string) => `${n} · ${gold} gold`,
  whileFarmed: (who: string, other: string) => `What ${who} did while ${other} farmed`,
  nearOther: (other: string, v: string) => `${v} of the time within 1,500 units of ${other}`,
  whereLine: (parts: string) => `Where, while alive: ${parts}`,
  none: "–",
  partSep: "; ",
  insightExposure: (parts: string) => `Time in enemy observer vision: ${parts}.`,
  exposurePart: (who: string, alive: string, farm: string | null) =>
    `${who ? `${who} ` : ""}${alive} of time alive${farm ? `, ${farm} while farming` : ""}`,
  insightDeaths: (who: string, k: number, n: number) =>
    `${k} of ${who ? `${who}'s ` : ""}${n} deaths came after half or more of the minute before in enemy observer vision.`,
  insightDuel: (ab: string, ba: string, ka: number, kb: number) =>
    `Same match: A dealt B ${ab} hero damage and took ${ba}; A killed B ${ka} ${ka === 1 ? "time" : "times"}, B killed A ${kb} ${kb === 1 ? "time" : "times"}.`,
  summaryExposure: (who: string, a: string, b: string, fa: string | null, fb: string | null) =>
    `${who} stood in enemy observer vision more (time alive: A ${a}, B ${b}${fa && fb ? `; while farming: A ${fa}, B ${fb}` : ""}).`,
  summaryExposureSingle: (alive: string, farm: string | null) =>
    `${alive} of the time alive was in enemy observer vision${farm ? ` (${farm} while farming)` : ""}.`,
  summaryDeaths: (who: string, k: number) =>
    `${who ? `${who}: ` : ""}${k} deaths came after half or more of the minute before in enemy observer vision.`,
  summarySight: (who: string, a: string, b: string) =>
    `${who}'s team saw the enemy heroes more (A ${a}, B ${b} of the time, estimated).`,
  summaryWards: (who: string, a: string, b: string) =>
    `${who}'s observers saw more of the enemy (A ${a}, B ${b} hero-seconds per observer).`,
  summaryWardsSingle: (n: number, minutes: string, kills: number) =>
    `${n} observers saw enemy heroes for ${minutes} hero-minutes in all (each hero counted apart); ${kills} enemy deaths in their range.`,
  metrics: {
    enemyWardTime: "Time alive in enemy observer vision",
    farmEnemyWards: "Farming under enemy wards",
    farmOwnWards: "Farming under own wards",
    teamSight: "Enemy hero time the team saw",
    wardSeen: "Enemy hero-seconds per observer",
  },
};

export default visionEn;

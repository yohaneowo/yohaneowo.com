// 局内科研 · vision. Mounted as dotahub.research.x.vision.
const visionZh = {
  // Time inside enemy observers' vision.
  exposure: "在对方假眼视野里的时间",
  exposureHint: "每 10 秒看一次自己的位置，在对方假眼 1600 码内算被看到；死亡时间不算",
  rows: {
    alive: "存活时间",
    farmLane: "线上打钱",
    farmJungle: "野区打钱",
    fight: "参战",
    move: "移动",
  } as Record<string, string>,
  minutes: "分钟",
  inEnemy: "对方假眼下",
  inOwn: "己方假眼下",
  exposureMap:
    "红圈：对方假眼的视野（1600 码）；底色：自己去过的地方（存活时）；红点：在对方假眼视野里的位置（每 10 秒）",
  beforeDeath: "死前一分钟在对方假眼下",
  secs: (n: number) => `${n} 秒`,
  exposedDeaths: (k: number, n: number, base: string) =>
    `${n} 次死亡里有 ${k} 次死前一分钟有一半以上时间在对方假眼下（对照：这段时间的存活时间有 ${base} 在对方假眼下）。`,
  noDeaths: "这段时间没有死亡。",
  exposureHindsight: "对方的眼插在哪里是从录像看到的，当时玩家不一定知道。",
  exposureRule:
    "假眼按 1600 码半径与存活时间（6 分钟，或到被排掉、比赛结束）算，不算树木与高地的遮挡，也不算对方英雄、塔与真眼的视野。",
  // What the player's own wards saw.
  value: "自己插的眼看到了什么",
  valueHint: "假眼立着时 1600 码内对方英雄的时间（每 10 秒一次，死掉的不算）与范围内的击杀",
  placed: "插下",
  area: "区域",
  lived: "存活",
  seen: "看到对方英雄",
  kills: "范围内击杀",
  valueLine: (n: number, minutes: string, per: string, kills: number) =>
    `${n} 个假眼合计看到对方英雄 ${minutes} 分钟（同时看到几个英雄就算几份；每个假眼平均 ${per} 秒），范围内对方阵亡 ${kills} 次。`,
  sentryLine: (n: number, cleared: number, obs: number) =>
    `${n} 个真眼立着时，1050 码内有 ${cleared} 个对方的眼被我方排掉（其中假眼 ${obs} 个）。`,
  valueRule: "按半径算，不管树木与高地会不会挡住；一个眼被排可能同时算在附近几个真眼上。",
  noWards: "这段时间没有自己插的眼。",
  // What the team could see.
  fog: "我方当时看得到什么（战争迷雾的估计）",
  fogHint: "对方英雄在我方视野里的时间，以及每次死亡时身边的对方英雄有没有被看到",
  fogLine: (team: string, day: string, night: string) =>
    `我方看得到对方英雄 ${team} 的时间（白天 ${day}、夜晚 ${night}）。`,
  seenByEnemy: (v: string) => `对方看得到自己 ${v} 的存活时间。`,
  perHero: "每个对方英雄被看到的时间",
  deathSight: "每次死亡时 1500 码内的对方英雄（灰色：当时在迷雾里）",
  near: "身边的对方英雄",
  before10: "10 秒前看得到",
  night: "夜",
  day: "日",
  nobody: "没有",
  fromFog: (k: number, n: number) =>
    `身边有对方英雄的 ${n} 次死亡里，有 ${k} 次这些英雄 10 秒前都在我方的迷雾里（从看不到的地方出来）。`,
  fogRule:
    "对方英雄在我方存活英雄（白天 1800 码、夜晚 800 码，少数英雄不同）、假眼（1600 码）或还立着的塔（白天 1900 码，夜晚一塔 600、其他塔 1100 码）范围内，就算看得到。0:00 起白天与夜晚每 5 分钟轮换（开局前是夜晚）。小兵、召唤物、技能、真眼、树木、高地与隐身都没算，所以两个方向都可能有误差。",
  // Usual ward spots.
  habits: "眼位习惯：和平常插的位置比",
  habitsHint:
    "底色是这位玩家用这个英雄其他对局插眼的位置（OpenDota），圆点（假眼，大的插在常用点）与方块（真眼）是这局插的",
  obs: "假眼",
  sen: "真眼",
  usualLine: (k: number, n: number) => `这局 ${n} 个假眼里有 ${k} 个插在常用点。`,
  usualRule: "常用点：其他对局在 500 码内插过 3 个以上假眼。",
  habitsFrom: (obs: number, sen: number) => `其他对局：假眼 ${obs} 个、真眼 ${sen} 个。`,
  noHabits:
    "没有这位玩家用这个英雄的眼位资料（只为辅助与这局插了 3 个以上眼的玩家向 OpenDota 查，匿名玩家查不到）。",
  // The whole board at a moment.
  board: "某一刻的全场：十个英雄、眼与建筑",
  boardHint: "选一波团战、一次死亡，或跟着图表游标；滑杆前后移动 30 秒",
  moment: "时刻",
  cursor: "跟着图表游标",
  fightAt: (c: string) => `团战 ${c}`,
  deathAt: (who: string, c: string) => `${who} 死亡 ${c}`,
  noCursor: "滑过任一图表来选时刻。",
  at: (c: string, night: boolean) => `${c}（${night ? "夜晚" : "白天"}）`,
  dead: "阵亡",
  inFog: "在我方迷雾里",
  roshanAlive: "肉山：活着",
  roshanDead: (by: string, at: string, from: string, to: string) =>
    `肉山：${at} 被${by}击杀，约 ${from}–${to} 复活`,
  roshanMaybe: (by: string, at: string, to: string) => `肉山：${at} 被${by}击杀，可能已复活（最晚 ${to}）`,
  aegis: (until: string) => `不朽之守护到 ${until}`,
  tormentors: (list: string) => `折磨者：${list}`,
  boardLegend:
    "英雄外框是阵营颜色（研究的玩家用 A 橙、B 蓝）；圆点：假眼；空心圈：真眼；方块：建筑（颜色是阵营）。",
  boardFog: "半透明的对方英雄：按视野一节的规则估计，当时我方看不到。",
  boardHindsight: "十个英雄与双方眼的位置都来自录像，当时玩家看不到迷雾里的对方，也看不到对方的眼。",
  noGrid: "没有 STRATZ 解析，看不到十个英雄的位置。",
  // Two players in the same match.
  duel: "同一局：A 与 B 的直接较量",
  mates: "同一局：A 与 B 是队友",
  damageLine: (ab: string, abUnits: string, ba: string, baUnits: string, ab10: string, ba10: string) =>
    `A 对 B 造成 ${ab} 英雄伤害、B 对 A ${ba}（其中幻象与召唤物 ${abUnits} / ${baUnits}）；前 10 分钟 ${ab10} 对 ${ba10}。`,
  killsLine: (who: string, other: string, kills: string, assists: string) =>
    `${who} 击杀 ${other}：${kills}；助攻：${assists}。`,
  dmgChart: "累计对对方造成的英雄伤害",
  nwGap: "净值差（A − B）",
  itemRace: "关键装备先后（各自第几件）",
  order: "第几件",
  first: "谁先",
  jungleTitle: "在谁的野区打野怪",
  jungleHint: "按野怪死在河道哪一边算（靠边路与河道的野点也算）",
  jungleOf: (who: string) => `${who} 方野区`,
  ownJungle: "己方野区",
  enemyJungle: "对方野区",
  creeps: (n: number, gold: string) => `${n} 只 · ${gold} 金`,
  whileFarmed: (who: string, other: string) => `${other} 打钱时 ${who} 在做什么`,
  nearOther: (other: string, v: string) => `${v} 的时间在 ${other} 1500 码内`,
  whereLine: (parts: string) => `存活时在：${parts}`,
  none: "–",
  // Sentences.
  partSep: "；",
  insightExposure: (parts: string) => `在对方假眼视野里的时间：${parts}。`,
  exposurePart: (who: string, alive: string, farm: string | null) =>
    `${who ? `${who} ` : ""}存活时间 ${alive}${farm ? `、打钱时 ${farm}` : ""}`,
  insightDeaths: (who: string, k: number, n: number) =>
    `${who ? `${who} ` : ""}${n} 次死亡里有 ${k} 次死前一分钟有一半以上时间在对方假眼下。`,
  insightDuel: (ab: string, ba: string, ka: number, kb: number) =>
    `同一局：A 对 B 造成 ${ab} 英雄伤害、B 对 A ${ba}；A 击杀 B ${ka} 次，B 击杀 A ${kb} 次。`,
  summaryExposure: (who: string, a: string, b: string, fa: string | null, fb: string | null) =>
    `${who} 更常待在对方假眼下（存活时间 A ${a}、B ${b}${fa && fb ? `；打钱时 A ${fa}、B ${fb}` : ""}）。`,
  summaryExposureSingle: (alive: string, farm: string | null) =>
    `存活时间有 ${alive} 在对方假眼下${farm ? `（打钱时 ${farm}）` : ""}。`,
  summaryDeaths: (who: string, k: number) =>
    `${who ? `${who} ` : ""}有 ${k} 次死亡前一分钟有一半以上时间在对方假眼下。`,
  summarySight: (who: string, a: string, b: string) =>
    `${who} 那一方看得到对方英雄的时间更多（A ${a}、B ${b}，估计）。`,
  summaryWards: (who: string, a: string, b: string) =>
    `${who} 的假眼看到的对方英雄更多（每个假眼平均 A ${a} 秒、B ${b} 秒）。`,
  summaryWardsSingle: (n: number, minutes: string, kills: number) =>
    `${n} 个假眼合计看到对方英雄 ${minutes} 分钟（几个英雄分开算），范围内对方阵亡 ${kills} 次。`,
  // Rows in the differences table.
  metrics: {
    enemyWardTime: "在对方假眼下的存活时间",
    farmEnemyWards: "打钱时在对方假眼下",
    farmOwnWards: "打钱时在己方假眼下",
    teamSight: "我方看得到对方英雄的时间",
    wardSeen: "每个假眼看到的对方英雄（秒）",
  },
};

export default visionZh;

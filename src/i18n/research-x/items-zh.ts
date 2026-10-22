// 局内科研 · items. Mounted as dotahub.research.x.items.
const itemsZh = {
  // The build against the rank's and the pros' games.
  choice: "出装与同段位、职业的对比",
  choiceHint:
    "同段位：STRATZ 同英雄同位置的对局；职业：本版本的职业对局（OpenDota）。只列成品装备，合成材料不算",
  item: "装备",
  bought: "购买",
  rank: "同段位",
  rankWin: "买了的胜率",
  pro: "职业（同阶段）",
  proShort: "职业",
  reading: "判读",
  phases: { start: "出门", early: "前期", mid: "中期", late: "后期" } as Record<string, string>,
  phasesHint: "出门：开局前；前期：0–10 分；中期：10–25 分；后期：25 分后",
  rankTags: {
    staple: "主流",
    common: "常见",
    rare: "少见",
    thin: "数据少",
    unlisted: "表中没有",
  } as Record<string, string>,
  rankTagHints: {
    staple: "同段位六成以上的对局会出",
    common: "同段位一成二到六成的对局会出",
    rare: "同段位不到一成二的对局会出",
    thin: "STRATZ 只留下一两个购买分钟，比例严重偏低，不当成少见",
    unlisted: "STRATZ 只列购买够多的装备；这件不在表里，多半少见",
  } as Record<string, string>,
  proTags: {
    common: "职业常出",
    uncommon: "职业少出",
    offMeta: "职业几乎不出",
    otherPhase: "职业多在别的阶段出",
  } as Record<string, string>,
  proTagHints: {
    common: "四分之一以上的职业对局在同一阶段买了这件",
    uncommon: "同一阶段买了这件的职业对局占 5% 到四分之一",
    offMeta: "同一阶段买了这件的职业对局不到 5%，或总共不到 5 场",
    otherPhase: "四分之一以上的职业对局会买，但大多在另一个阶段买",
  } as Record<string, string>,
  proUsual: (phase: string) => `职业多在${phase}买`,
  phasesIn: { start: "开局时", early: "前期", mid: "中期", late: "后期" } as Record<string, string>,
  proValue: (n: number, of: number, phase: number) => `${n}/${of}（${phase}）`,
  proFew: (of: number) => `<5/${of}`,
  skipped: "同段位或职业大多会出、这局没出",
  notReached: "比赛在平均出装时间前就结束了",
  choiceNote:
    "STRATZ 只列购买次数够多的装备与购买分钟，少见的装备不在表里，比例也偏低；胜率是买了这件的对局的胜率，和对局本来顺不顺有关，不等于装备的效果。",

  // Starting items and boots.
  start: "出门装与鞋",
  startItems: "出门装（数字是同段位开局就买的比例）",
  startSkipped: "同段位多数开局会买、这局没买",
  later: (at: string) => `${at} 才买`,
  never: "没买",
  unlisted: "表中没有",
  boots: "鞋",
  bootsCols: {
    bought: "购买",
    share: "同段位比例",
    time: "同段位平均",
    win: "胜率",
    uses: "使用（每分钟）",
    rankUses: "同段位使用（每分钟）",
  },
  countPm: (n: string, pm: string) => `${n}（${pm}）`,
  rankBoots: "同段位最常见的鞋",
  bootsNote: (avg: string) =>
    `使用次数取自 OpenDota；每分钟次数都按买到比赛结束算，同段位的按平均购买时间与平均比赛长度（约 ${avg} 分钟）估计，卖掉或升级的鞋会偏低。`,

  // Carrying a TP.
  tp: "TP 携带（10 分钟后）",
  tpHint: "跟着上面的时间范围；死亡的时间不算",
  tpNone: "没有 STRATZ 解析，看不到身上有没有 TP。",
  tpEarly: "选的时间范围在 10 分钟前。",
  tpLess: "没带 TP",
  tpLessValue: (time: string, share: string) => `${time}（存活时间的 ${share}）`,
  tpLongest: "最长一次",
  tpLongestValue: (time: string, at: string) => `${time}（${at} 起）`,
  tpGaps: "次数",
  tpChecks: {
    deaths: "死亡（死前 5 秒）",
    fights: "参与的团战（开打时）",
    towers: "己方塔倒（倒前 30 秒）",
  } as Record<string, string>,
  tpWithout: (n: number, of: number) => `${n}/${of} 次没带`,
  tpDead: "已阵亡",
  tpBand: "红：没带 TP；灰：死亡；黄：己方塔倒",
  tpNote: "STRATZ 的物品栏快照只在变化时记一笔，每一笔算到下一笔为止；身上有远行鞋也算带着 TP。",

  // Threats and the items that answer them.
  counter: "针对敌方阵容的装备",
  counterHint: "按承受的伤害与敌方的英雄、装备判断",
  threats: {
    magic: "魔法伤害",
    physical: "普攻",
    control: "控制",
    evasion: "闪避",
    invis: "隐身",
    heal: "治疗",
    passives: "被动技能",
    illusions: "幻象",
  } as Record<string, string>,
  magicLine: (share: string) => `承受的英雄伤害 ${share} 是魔法伤害`,
  physicalLine: (share: string) => `承受的英雄伤害 ${share} 来自普攻`,
  controlLine: (sec: string) => `每分钟被眩晕、禁锢 ${sec} 秒`,
  healLine: (v: string) => `每分钟治疗 ${v}`,
  notBought: "没出",
  rankRate: (share: string) => `同段位 ${share} 会出`,
  // Names for answers the page has no picture of (nobody in the match bought them).
  fallbackNames: { dust: "显影之尘", ward_sentry: "岗哨守卫", gem: "真视宝石" } as Record<string, string>,
  noThreat: "没有明显需要针对的地方。",
  noTypes: "没有 STRATZ 解析：伤害只分得出普攻与其他，魔法伤害与控制看不到。",
  counterNote:
    "按规则估计：承受的英雄伤害魔法占 45% 以上、普攻占 50% 以上，每分钟被控 1.5 秒以上，或敌方英雄每分钟治疗 100 以上才算；隐身、闪避、被动与幻象按英雄与装备的清单判断。只列这个英雄会出的对策装（自己、同段位、职业或自己以往的对局出过）。",

  // Power spikes.
  spikes: "十人的关键装备与 6 级",
  spikesHint: "圈出 BKB、跳刀与阿哈利姆神杖；最上一行是团战（绿：敌方死得多，红：我方死得多）",
  fightsRow: "团战",
  level6: "6 级",
  after: "出关键装备后 4 分钟内",
  afterHint: "跟着上面的时间范围；灰色：这段时间有团战却没参加",
  afterCols: {
    t: "时间",
    fights: "团战（参与 / 全部）",
    ka: "击杀 / 助攻",
    taken: "我方拿下",
    tower: "建筑伤害",
  },
  objectives: {
    tower: "塔",
    rax: "兵营",
    fort: "遗迹",
    roshan: "肉山",
    tormentor: "痛苦魔方",
    other: "建筑",
  } as Record<string, string>,
  cut: (sec: number) => `比赛 ${sec} 秒后结束`,
  enemySpike: "敌方核心刚出 BKB 或跳刀后的团战（2 分钟内）",
  enemyCols: {
    t: "团战",
    spike: "敌方装备",
    bkb: "BKB（我方 : 敌方）",
    joined: "参与",
    result: "双方死亡（我方 / 敌方）",
  },
  before: (sec: number) => `${sec} 秒前`,
  noEnemySpike: "没有这样的团战。",
  coresNote: "核心：STRATZ 判定的 1–3 号位，没有时取净值最高的三位；买了不一定马上带在身上。",

  // Neutral items.
  neutral: "中立物品与职业对局",
  neutralHint: (n: number) => `职业：本版本 ${n} 场同英雄的职业对局结束时带的中立物品`,
  neutralCols: {
    item: "这局带过的",
    t: "取得",
    pro: "职业结束时带（同等级）",
    top: "同等级职业最常带",
  },
  tierShort: (tier: number) => `${tier} 级`,
  neutralTop: "职业最常带到最后的",
  neutralCount: (n: number, of: number) => `${n}/${of}`,
  neutralTier: (n: number, of: number, tier: number) => `结束时带 ${tier} 级中立物品的 ${of} 场里有 ${n} 场`,
  neutralIsTop: "同等级最常见",
  neutralFinal: "最后",
  neutralNote:
    "职业的数字是比赛结束时身上的那一件：等级低的只来自结束时还带着它的少数对局，参考价值低。等级按 7.41 的中立物品表。",

  // Units the player controlled.
  units: "其他单位的装备（熊灵等）",

  // Rows of the differences table.
  metricTpLess: "10 分钟后没带 TP 的时间",
  metricTreads: "每分钟切动力鞋",

  // One-line readings and summary lines (who is A / B, or empty for one match).
  tpLine: (who: string, time: string, longest: string) =>
    `${who ? `${who} ` : ""}10 分钟后有 ${time} 没带 TP（最长一次 ${longest}）。`,
  tpDeaths: (who: string, n: number) => `${who ? `${who} ` : ""}有 ${n} 次死亡时身上没有 TP。`,
  magicNoAnswer: (who: string, share: string, items: string) =>
    `${who ? `${who} ` : ""}承受的英雄伤害 ${share} 是魔法伤害，却没出${items}（估计）。`,
  rareBuild: (who: string, items: string) => `${who ? `${who} ` : ""}出了同段位与职业都少见的${items}。`,
  skippedStaple: (who: string, item: string, share: string) =>
    `${who ? `${who} ` : ""}没出同段位 ${share} 会出的${item}。`,
  treadsPair: (a: string, b: string, avg: string) =>
    `每分钟切动力鞋：A ${a} 次、B ${b} 次（同段位约 ${avg} 次）。`,
  treadsSingle: (who: string, v: string, avg: string) =>
    `${who ? `${who} ` : ""}每分钟切动力鞋 ${v} 次，同段位约 ${avg} 次。`,
  spikeIdle: (who: string, item: string) =>
    `${who ? `${who} ` : ""}出${item}后 4 分钟内没参加团战、没有击杀助攻，也没打建筑。`,
  enemySpikeFight: (who: string, hero: string, item: string, sec: number, ours: number, theirs: number) =>
    `${who ? `${who} ` : ""}在${hero}出${item} ${sec} 秒后接团，我方死 ${ours}、敌方死 ${theirs}。`,
  join: "、",
};

export default itemsZh;

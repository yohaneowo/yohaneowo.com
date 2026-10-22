// 局内科研 · fights. Mounted as dotahub.research.x.fights.
const fightsZh = {
  // "A " before a sentence when comparing, nothing alone.
  who: (label: string) => `${label} `,
  none: "这个时间范围里没有团战。",
  results: { won: "赢", lost: "输", traded: "互换" } as Record<string, string>,
  presence: { joined: "参与", absent: "缺席", dead: "死亡中" } as Record<string, string>,

  // Each teamfight's result and the player's part.
  outcome: "团战结果与 TA 的份量",
  outcomeHint: "OpenDota 的团战，每行一场",
  outcomeRule:
    "多死的一方算输、一样算互换；金钱与经验是全队这场的得失（我方所得减对方所得）；等级差是开打时双方平均等级之差（由每人的经验换算）；TA 的等级是开打时的等级，括号是这场升了几级；伤害占比是 TA 占全队这场伤害的比例。",
  col: {
    time: "时间",
    result: "结果（我方:对方阵亡）",
    swing: "全队金钱 / 经验",
    edge: "开打等级差",
    level: "TA 的等级",
    dmgShare: "伤害占比",
    healShare: "治疗占比",
    presence: "TA",
  },
  recordRows: { joined: "TA 参与", absent: "TA 活着却缺席", dead: "TA 死亡中" } as Record<string, string>,
  recordCols: { n: "场", wlt: "胜 / 负 / 互换", gold: "全队平均金钱", xp: "全队平均经验" },
  big: (n: number, won: number, lost: number) => `伤害占全队 35% 以上的 ${n} 场：赢 ${won}、输 ${lost}。`,
  healNote: "OpenDota 的团战治疗含自己的回复（魔棒、吸血等），不只是治疗队友。",

  // Fights missed while alive.
  missed: "缺席的团战",
  missedHint: "活着却没参与的",
  missedRule:
    "离战场：开打时离这场英雄阵亡地点中心多远；最近敌人：这场期间离任何敌人最近多少（同团战表）；当时在做什么：这场的 10 秒取样多半在做什么；自己赚了多少，以及全队这场的得失与我方胜率的变化（是全队的变化，不全是缺席造成的）。",
  noMissed: "没有活着却缺席的团战。",
  missedCol: {
    activity: "当时在做什么",
    dist: "离战场 / 最近敌人（码）",
    meanwhile: "自己 金钱 / 经验",
    team: "全队结果",
    swing: "全队金钱 / 经验",
    win: "我方胜率",
  },
  hindsight: "TA 当下未必知道那里在打，也可能有更要紧的事。",

  // Readiness and execution.
  prep: "参战准备与执行",
  prepHint: "参与的团战",
  prepRule:
    "大招与关键装备：开打时是否就绪（开打前 15 秒内刚用过的算为这场用的）；BKB、Manta、撒旦：第一次挨打之前开（挨打前开）还是之后；普攻覆盖：从第一次出手到团战结束或阵亡，英雄本体有普攻打到英雄的秒数占比（括号是打到几个人）；出手覆盖把技能伤害与对英雄施法也算进去，辅助看这个。",
  prepCol: {
    ult: "大招",
    items: "关键装备",
    timing: "BKB / Manta / 撒旦",
    uptime: "普攻覆盖",
    active: "出手覆盖",
    result: "结果",
  },
  ult: { ready: "就绪", used: "刚放过", none: "未学", cooldown: "冷却" } as Record<string, string>,
  left: (n: number) => `还要 ${n} 秒`,
  itemState: { ready: "就绪", used: "刚用过", cooldown: "冷却中", backpack: "在背包" } as Record<
    string,
    string
  >,
  bag: "背",
  kinds: { proactive: "挨打前开", reactive: "挨打后开", unused: "挨打了没开" } as Record<string, string>,
  fromStart: (n: number) => `开打 ${n >= 0 ? "+" : "−"}${Math.abs(n)} 秒`,
  afterHit: (n: number) => (n >= 0 ? `挨打后 ${n} 秒` : `挨打前 ${-n} 秒`),
  hitCount: (n: number) => `${n} 人`,
  notReady: (n: number, won: number, lost: number) =>
    `${n} 场开打时没准备好（大招或 BKB、Manta、跳刀还要冷却 5 秒以上，或在背包）：赢 ${won}、输 ${lost}。`,
  allReady: "参与的团战开打时大招与关键装备都准备好了。",
  prepEstimate: "冷却按基础值估计，冷却缩减（天赋、玲珑心等）没算；被眩晕、沉默等控住而开不了的时候也没算。",
  noStratz: "没有 STRATZ 解析，看不到装备、冷却与逐次伤害。",

  // Deaths taken apart.
  recap: "阵亡回顾",
  recapHint: "每次阵亡",
  recapRule:
    "死前 10 秒承受的英雄伤害（含对方幻象与召唤物），按英雄、技能与类型分；最后 3 秒打掉六成以上算被秒。就绪没开：死时身上冷却好、死前 15 秒没开过的保命装备（跳刀受到英雄伤害后 3 秒不能用，不算）；剩余充能：死时主栏的魔棒、药品等还剩多少。",
  recapCol: {
    taken: "死前 10 秒承受",
    last3: "最后 3 秒",
    from: "主要来源",
    killers: "击杀者与助攻",
    unused: "就绪没开",
    charges: "剩余充能",
  },
  types: ["普攻", "物理技能", "魔法", "纯粹"],
  recapLine: (n: number, burst: number, unused: number, wand: number) =>
    `${n} 次阵亡：${burst} 次被秒；${unused} 次死时有保命装备就绪没开；${wand} 次魔棒还剩一半以上。`,
  recapEstimate: "就绪没开只看冷却与死前有没有用过，没算死前是否被眩晕、沉默等控住而开不了。",

  // What deaths and kills were worth.
  cost: "阵亡与击杀的金钱",
  costHint: "全场",
  costRule:
    "阵亡代价＝掉的钱＋复活期间少打的钱（按死前 5 分钟的打钱速度估计）；送给对方的金钱与经验另计。同段位平均：同英雄同位置的对局打到同一分钟时的累计（只算还没结束的对局）。",
  costRows: {
    cost: "阵亡代价",
    rate: "每分钟 / 占总收入",
    rateLostOnly: "每分钟 / 占总收入（只算掉钱）",
    fed: "送给对方",
    avg: (minute: number, n: string) => `同段位平均（到第 ${minute} 分钟，${n} 场）`,
    kills: "击杀",
    richest: "最值钱的击杀",
  },
  costValue: (cost: string, lost: string, missed: string) => `${cost}（掉钱 ${lost} ＋ 少打 ${missed}）`,
  costNoMissed: (lost: string) => `${lost}（只有掉钱；没有 STRATZ 的金钱资料，算不出少打多少）`,
  fedValue: (gold: string, xp: string | null) => (xp ? `${gold} 金、${xp} 经验` : `${gold} 金`),
  lostFed: (lost: string, fed: string, xp: string | null) =>
    `掉钱 ${lost}、送出 ${fed} 金${xp ? `、${xp} 经验` : ""}`,
  avgValue: (avg: string, me: string) => `${avg}（TA：${me}）`,
  // XP is averaged over the kills that have it (xpN of n).
  killsValue: (n: number, gold: string, xp: string | null, xpN: number) =>
    `${n} 次，平均每次 +${gold} 金${xp ? `、+${xp} 经验` : ""}${xp && xpN < n ? `（经验按有资料的 ${xpN} 次）` : ""}`,
  noKills: "没有击杀，或没有 STRATZ 的击杀金钱资料。",
  noDeaths: "没有阵亡。",

  // Grouping.
  cohesion: "转区与抱团",
  cohesionHint: "按阶段",
  cohesionRule:
    "转区：活着时每 10 秒取样，所在区域（三路、两边野区、河道、两边基地）变了算一次，换算成每分钟；离队友中心：和其他活着的队友（至少 2 位）中心点的平均距离，队友是否阵亡按位置不动推算。两项没有好坏之分，只看打法。",
  zonesCell: (z: string, d: string) => `${z} 次/分 · ${d} 码`,
  noGrid: "没有 STRATZ 的走位资料。",

  // Lessons (gold-valued).
  lesson: (at: string, lost: string, missed: string) =>
    `${at} 阵亡：掉 ${lost} 金，复活期间少打约 ${missed} 金`,
  lessonNoMissed: (at: string, lost: string) => `${at} 阵亡：掉 ${lost} 金`,
  lessonMissedOnly: (at: string, missed: string) => `${at} 阵亡：没掉钱，复活期间少打约 ${missed} 金`,
  lessonFed: (fed: string) => `（另送对方 ${fed}）`,
  lessonUnused: (items: string) => `；${items} 就绪没开`,
  end: "。",

  // Section readings.
  inRecord: (who: string, n: number, won: number, lost: number) =>
    `${who}参与的 ${n} 场团战全队 ${won} 胜 ${lost} 负`,
  inAbsent: (n: number, lost: number) => `，活着却缺席的 ${n} 场输了 ${lost} 场`,
  inUnused: (who: string, n: number, at: string, items: string) =>
    `${who}有 ${n} 次死时保命装备就绪没开（${at}：${items}）。`,
  inTargets: (who: string, core: string) => `${who}${core} 的英雄伤害打在敌方 1–3 号位`,
  inConverted: (conv: string) => `，${conv} 打在 10 秒内阵亡的敌人身上`,
  inUnits: (who: string, share: string) => `${who}${share} 的英雄伤害来自幻象或召唤物。`,
  sep: "；",

  // Summary lines (win: the shared window when the games differ in length, else empty).
  sumAbsent: (who: string, n: number, gold: string) =>
    n === 1
      ? `${who}有 1 场团战活着却没参与，全队在这场团战 ${gold} 金。`
      : `${who}有 ${n} 场团战活着却没参与，全队在这些团战平均 ${gold} 金。`,
  sumUnused: (who: string, n: number, at: string, items: string) =>
    `${who}有 ${n} 次死时保命装备就绪没开（例如 ${at}：${items}）。`,
  sumNotReady: (who: string, n: number, lost: number) =>
    `${who}有 ${n} 场团战开打时大招或关键装备没准备好，其中输了 ${lost} 场。`,
  window: (at: string) => `（前 ${at}）`,
  sumWin: (a: string, b: string, win: string) => `参与团战时全队的胜率${win}：A ${a}，B ${b}。`,
  sumUnusedPair: (a: number, b: number, win: string) => `死时保命装备就绪没开${win}：A ${a} 次，B ${b} 次。`,
  sumEff: (a: string, b: string, win: string) => `每千净值每分钟打出的英雄伤害${win}：A ${a}，B ${b}。`,
  sumUptime: (a: string, b: string, win: string) => `团战里的普攻覆盖${win}：A ${a}，B ${b}。`,
  sumCost: (a: string, b: string, win: string) => `每分钟的阵亡代价${win}：A ${a}，B ${b} 金。`,

  // Rows of the differences table.
  metrics: {
    fightWin: "参与团战的全队胜率",
    fightDmgShare: "团战伤害占全队比例",
    uptime: "团战普攻覆盖",
    activeUptime: "团战出手覆盖",
    burstDeaths: "被秒的阵亡比例",
    converted: "打在 10 秒内阵亡敌人身上的伤害",
    coreDamage: "打敌方 1–3 号位的伤害比例",
    dmgPer1k: "每千净值每分钟英雄伤害",
    hdShare: "占全队英雄伤害",
    deathCostPm: "每分钟阵亡代价",
    zonesPm: "每分钟转区",
    centroid: "离队友中心的距离",
  } as Record<string, string>,

  // The damage section.
  targets: "打谁：按敌方位置",
  targetsHint: "全场",
  targetsRule:
    "造成与承受来自 OpenDota 全场合计（含幻象与召唤物）；10 秒内阵亡：打在之后 10 秒内阵亡（不论谁击杀）的敌人身上的伤害占比，来自 STRATZ 逐次伤害。每场的数量见团战表，这里只列比例（不到 300 伤害的不算）。",
  estimatedPos: "没有 STRATZ 位置，按净值排名推测（最高的算 1 号位）。",
  posCol: { pos: "位置", dealt: "造成", taken: "承受" },
  pos: (n: number) => `${n} 号位`,
  coreLine: (core: string, carryMid: string, taken: string) =>
    `打敌方核心（1–3 号位）${core}，其中 1、2 号位 ${carryMid}；承受的伤害 ${taken} 来自核心。`,
  convLine: (v: string) => `${v} 的伤害打在 10 秒内阵亡的敌人身上。`,
  fightCol: { fight: "团战", core: "打核心", conv: "10 秒内阵亡", coreTaken: "挨核心打" },
  efficiency: "伤害效率与全队占比",
  efficiencyHint: "OpenDota",
  efficiencyRule:
    "每千净值每分钟伤害＝该阶段每分钟英雄伤害 ÷ 该阶段平均净值（千），按 OpenDota 的每分钟伤害曲线（可能比全场合计略少）；占比是 TA 占全队的英雄伤害、建筑伤害、总收入与最终净值（全场合计）。",
  per1k: "每千净值每分钟伤害",
  whole: "全场",
  shareNames: { heroDamage: "英雄伤害", towerDamage: "建筑伤害", gold: "总收入", netWorth: "净值" } as Record<
    string,
    string
  >,
  matrix: "每个来源打在谁身上",
  matrixHint: "OpenDota：伤害来源 × 敌方英雄，格子越深越多（普攻含幻象与召唤物）",
  total: "合计",
  heals: "治疗：受到与给出",
  healsHint: "STRATZ 的治疗事件",
  healsRule:
    "受到的分成自己的物品、自己的技能（含被反弹回来的敌方技能）与每位队友；没有来源的算自然回复；给出的是治疗队友。",
  received: "受到",
  given: "治疗队友",
  ownItems: "自己的物品",
  ownAbilities: "自己的技能",
  regen: "自然回复（没有来源）",
  noGiven: "没有治疗队友。",
  stratzIn: (v: string) => `STRATZ 统计他人给的治疗共 ${v}`,
  stratzGiven: (v: string) => `STRATZ 统计治疗队友共 ${v}`,
  noHeals: "没有 STRATZ 解析，看不到治疗从哪来。",
  odHealing: (v: string) => `OpenDota：治疗其他英雄共 ${v}`,
  foreign: "不是英雄本体打出的伤害",
  reflected: (total: string, hits: number) => `敌方技能算在 TA 名下 ${total}（命中 ${hits} 次）`,
  via: {
    counterspell: "，是法术反制反弹的",
    lotus: "，多半是清莲宝珠反弹的",
    stolen: "，是偷来的技能",
  } as Record<string, string>,
  back: (total: string) => `自己的技能被反弹回来打到自己 ${total}`,
  units: (dealt: string, ds: string, taken: string, ts: string) =>
    `幻象与召唤物打出 ${dealt}（占英雄伤害 ${ds}）；敌方幻象与召唤物打了 TA ${taken}（占承受 ${ts}）。`,
  unitsNote:
    "这两节的伤害数字都含幻象与召唤物：OpenDota 的合计、来源与上面的矩阵把它们算在普攻里，STRATZ 的逐次伤害（团战表、阵亡回顾、按位置、10 秒内阵亡）也算进去；只算英雄本体的是「普攻覆盖」与「出手覆盖」。",
  noForeign: "伤害都是英雄本体打的，也没有被反弹的技能。",
};

export default fightsZh;

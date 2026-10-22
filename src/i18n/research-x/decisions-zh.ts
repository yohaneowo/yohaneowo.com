// 局内科研 · decisions. Mounted as dotahub.research.x.decisions.
const decisionsZh = {
  noPositions: "没有 STRATZ 解析，看不到位置。",
  noTiming: "没有 STRATZ 解析，算不出来。",
  none: "没有",
  yes: "✓",
  no: "✗",
  phaseNames: { laning: "对线期", mid: "中期", late: "后期" } as Record<string, string>,
  total: "全场",
  sec: (n: number) => `${n} 秒`,
  plus: (n: number) => `+${n} 秒`,
  units: (n: string) => `${n} 码`,
  afterN: (what: string, n: number) => `${n} 次后${what}`,
  listSep: "；",
  paren: (s: string) => `（${s}）`,
  objectives: {
    building: "建筑",
    roshan: "肉山",
    tormentor: "痛苦魔方",
    courier: "信使",
  } as Record<string, string>,
  ours: "我方拿下",
  theirs: "敌方拿下",
  courierOurs: "杀了敌方信使",
  courierTheirs: "我方信使被杀",

  // Key moments.
  moments: "关键时刻：胜率变化最大的几分钟",
  momentsHint: "STRATZ 每分钟的我方胜率：跌最多的 4 分钟与涨最多的 3 分钟",
  momentsNw: "这局 STRATZ 没有胜率，改用我方经济领先每分钟的变化。",
  swingName: { win: "胜率", nw: "经济领先" } as Record<string, string>,
  noSwing: "没有胜率与经济领先资料。",
  colMinute: "那一分钟",
  colSwing: "变化",
  colWhat: "发生了什么",
  colMe: "自己",
  colPart: "参与",
  colWatch: "回看",
  fightLine: (at: string, ours: number, theirs: number) => `团战 ${at}（我方死 ${ours}、敌方死 ${theirs}）`,
  deathsLine: (ours: number, theirs: number) => `击杀：我方死 ${ours}、敌方死 ${theirs}`,
  nothing: "没有击杀或目标",
  deadFor: (n: number) => `死亡 ${n} 秒`,
  away: (n: string) => `离最近的击杀或目标 ${n}`,
  dealt: (n: string) => `造成 ${n}`,
  dropsLine: (n: number, k: number, quiet: number) =>
    `跌最多的 ${n} 分钟里参与了 ${k} 次${quiet ? `（${quiet} 次那分钟没有击杀或目标）` : ""}。`,
  gainsLine: (n: number, k: number, quiet: number) =>
    `涨最多的 ${n} 分钟里参与了 ${k} 次${quiet ? `（${quiet} 次那分钟没有击杀或目标）` : ""}。`,
  partNoPositions: "没有位置资料：只按团战参与与自己的击杀、死亡、助攻判断，其余记为「–」。",
  partHint:
    "参与：加入了那分钟的团战、自己有击杀死亡或助攻，或活着且离那分钟的击杀或目标 1,500 码内。胜率一分钟一个点，只看得出是哪一分钟。",
  watchNote:
    "回看：时间是游戏时钟。在客户端「观战 → 录像」用比赛编号下载录像，播放时把时间轴拖到那个时间。控制台的 demo_gototick 吃的是 tick（每秒 30），从录像开头算起，含选人、开局倒数与暂停，只凭游戏时间换算不出来，所以这里只给时间。",
  replay: "录像档（.dem.bz2）",

  // The swing while something happened.
  swing: "胜率变化发生时在做什么（按阶段）",
  swingHint: "每分钟的胜率变化加到那分钟里发生的事上；一分钟可以同时算进好几项",
  swingCaveat: "这是全队在那几分钟的胜率（或经济领先）变化，不是这位玩家一个人的功劳或责任。",
  swingCats: {
    kills: "自己击杀或助攻",
    deaths: "自己死亡",
    joined: "参与的团战",
    missed: "没参与的团战（活着时）",
    taken: "我方拿下目标",
    lost: "敌方拿下目标",
    quiet: "以上都没有",
  } as Record<string, string>,
  minutes: (n: number) => `${n} 分钟`,

  // After fights.
  after: "赢下团战或击杀之后",
  afterHint: "团战结束后 150 秒、击杀后 90 秒内：我方拿到的目标与自己在做什么",
  afterLine: (won: number, converted: number, hit: number | null) =>
    `赢下的 ${won} 场团战（敌方死得比我方多）有 ${converted} 场换到了目标${hit != null ? `；${hit} 场之后自己有打建筑` : ""}。`,
  noWon: "没有赢下的团战。",
  colFight: "团战",
  colDeaths: "我方死 / 敌方死",
  colTook: "之后我方拿到",
  colTime: "自己（秒）：打钱 / 参战 / 移动 / 基地 / 死亡",
  colHit: "打建筑",
  doing: {
    dead: "死了",
    hit: "打建筑",
    farm: "去打钱",
    base: "回基地",
    other: "移动或交战",
  } as Record<string, string>,
  picksLine: (n: number, took: number, parts: string) =>
    `赢下的团战以外的 ${n} 次击杀：${took} 次后我方拿到目标；${parts}。`,
  deathLoss: (k: number, n: number) => `死后 90 秒内敌方拿到目标：${k}/${n} 次`,

  // Phases.
  phases: "按局势划分的阶段",
  phasesHint: "对线期到自己那路的一塔倒下或离开线上为止（最晚 15:00），中期到第一座兵营倒下，之后是后期",
  phaseSpan: (name: string, from: string, to: string) => `${name} ${from}–${to}`,
  laneWhy: { tower: "一塔倒下", left: "离开线上", cap: "到 15:00" } as Record<string, string>,
  colPhase: "阶段",
  colSpan: "时间",
  colFarm: "打钱",
  colFightShare: "参战",
  colMove: "移动",
  colDead: "死亡",
  colPace: "双方每分钟击杀 · 净值增长",
  colDeathShare: "死亡（占我方）",
  colKp: "参与击杀",
  phaseDiff: (phase: string, what: string, a: string, b: string) => `${phase}：${what} A ${a}、B ${b}。`,
  phaseDeaths: (phase: string, who: string, share: string, k: number, n: number) =>
    `${phase}${who ? `（${who}）` : ""}：死亡占我方的 ${share}（${k}/${n}），五人平分是 20%。`,
  shares: { farm: "打钱", fight: "参战", move: "移动", dead: "死亡" } as Record<string, string>,
  paceHint: "节奏：双方合计每分钟的击杀与净值增长，用来对照死亡与参战（节奏快的局死得多是常态）。",

  // Buybacks.
  buyback: "后期的买活钱",
  buybackHint: "从 30:00 起（自家三塔先挨打就从那时起）；买活价 = 200 + 净值 ÷ 13",
  bbStart: (at: string, tower: boolean) => `从 ${at} 起${tower ? "（自家三塔开始挨打）" : ""}`,
  bbHeld: (share: string, n: number) => `活着的时间有 ${share} 手上的钱够买活，买活 ${n} 次。`,
  bbCount: (n: number) => `买活 ${n} 次。`,
  bbDeaths: (n: number, noGold: number, unused: number) =>
    `死了 ${n} 次：不够钱买活 ${noGold} 次；能买活（钱够、不在冷却）却没买、复活前又丢了建筑 ${unused} 次。`,
  bbUnknown: "没有手上金钱的资料（STRATZ 没有解析），看不出死时够不够买活。",
  bbNoDeaths: "这段时间没有死。",
  bbShort: "比赛在后期前就结束了。",
  bbLackRow: (at: string, gold: string, cost: string) => `${at} 死时手上 ${gold}，买活要 ${cost}`,
  bbUnusedRow: (at: string, lost: string) => `${at} 能买活没买，复活前丢了 ${lost}`,

  // Respawns.
  respawn: "复活之后",
  respawnHint: "每次复活（或买活）后：有没有 TP、多久补到第一刀或开始交战、先去做什么",
  colRespawn: "复活",
  colTp: "TP",
  colLh: "第一刀",
  colEngage: "交战",
  colWent: "先去",
  colNote: "备注",
  went: { farm: "打钱", fight: "交战", base: "留在基地", move: "走动" } as Record<string, string>,
  walked: "走路",
  bought: "买活",
  alone: "独自加入团战",
  diedAgain: "60 秒内又死",
  respawnLine: (n: number, tp: number, median: string) =>
    `${n} 次复活里 ${tp} 次 15 秒内 TP 出门，补到第一刀的中位数 ${median}。`,

  // Encounters.
  encounters: "所有交手（含没死人的换血）",
  encountersHint: "自己和敌方英雄的伤害往来，6 秒内没有新伤害就算一次结束；300 伤害以上或有人死才算",
  encountersCaveat:
    "胜负：有人死按死亡，没人死时伤害多出 1.5 倍以上算赢。只看得到自己造成与承受的伤害，队友打的不算。",
  colN: "交手",
  colWon: "赢",
  colLost: "输",
  colEven: "平或互换",
  colSmall: "团战外（赢）",
  colFirst: "自己先出手",
  netDamage: "每次交手：造成 − 承受（颜色是胜负，A 圆、B 方）",
  results: { won: "赢", lost: "输", traded: "互换", even: "平" } as Record<string, string>,
  encountersLine: (n: number, won: string, small: number, smallWon: number) =>
    `交手 ${n} 次，赢 ${won}；其中团战外 ${small} 次，赢 ${smallWon} 次。`,
  duelsLine: (n: number, won: number, lost: number) =>
    `1 对 1（只有一名敌人、身边没有队友）${n} 次：赢 ${won}、输 ${lost}。`,

  // Ally deaths.
  allies: "队友阵亡时",
  alliesHint: "每次队友死亡：自己离多远、20 秒前离多远、有没有出手或 TP 过去",
  alliesCaveat: "用录像里所有人的位置判断；当下不一定知道队友被抓，救人的技能与道具也看不到。",
  cls: {
    helped: "有出手（2,500 码内）",
    late: "赶来但晚了",
    couldHelp: "来得及却没帮",
    tooFar: "太远",
    dead: "自己也死着",
  } as Record<string, string>,
  colAlly: "队友",
  colDist: "距离（20 秒前 → 当时）",
  colHitAlly: "出手",
  colCls: "判断",
  nearNoHit: "1,500 码内没出手",
  tp: "TP",

  // Space.
  space: "牵制：吸引了多少敌人",
  spaceHint: "每 10 秒数我方每位活着的英雄 1,800 码内活着的敌人，看自己分到多少（五人平分是 20%）",
  spaceCaveat: "用录像里所有人的位置算，包括迷雾里的敌人。",
  colAvg: "身边平均敌人",
  colShare: "占全队",
  carryLine: (carry: string, n: number, gpm: string, other: string) =>
    `自己身边有 2 名以上敌人、${carry} 身边没有敌人的 ${n} 分钟里，${carry} 每分钟拿 ${gpm} 金，其他分钟 ${other}（只是相关，不代表因果）。`,
  spaceDeaths: (space: number, feed: number, other: number, team: number) =>
    `离队友 3,000 码外的死亡：引来 3 名以上敌人 ${space} 次、身边只有 1 名敌人 ${feed} 次、其他 ${other} 次；死在队友附近 ${team} 次。`,

  // Risk.
  risk: "危险处境",
  riskHint: "活着、1,500 码内 2 名以上敌人、没有队友、2,000 码内没有自家塔（每 10 秒）",
  riskCaveat: "按录像里所有人的位置判断；血量只有每分钟的最低值，残血是那一分钟的。",
  colRiskTime: "时间（占存活）",
  colEpisodes: "次数",
  colDied: "死亡",
  colEscaped: "脱险",
  colClose: "残血脱险",
  riskLine: (n: number, died: number, escaped: number, close: number) =>
    `${n} 次危险处境：${died} 次死亡、${escaped} 次脱险（${close} 次那分钟血量低于 30%）。`,
  noRisk: "没有危险处境。",

  // Objectives.
  timeline: "目标时间线",
  timelineHint: "双方的建筑、肉山、痛苦魔方与信使，以及当时自己离目标多远（取前 20 秒内最近的一刻）",
  timelineCaveat:
    "肉山与痛苦魔方的位置取拿盾或击杀的英雄当时的位置（坑位随版本与昼夜变化），信使取击杀者的位置，都是估计。",
  presentLine: (n: number, k: number, lost: number, kl: number) =>
    `我方拿下的 ${n} 个目标里在场 ${k} 个，敌方拿下的 ${lost} 个里在场 ${kl} 个（2,000 码内）。`,
  colObj: "目标",
  colDistance: "距离（码）",
  colWho: "谁拿",
  colState: "自己",
  colPresent: "在场",
  aegisBy: "拿盾的英雄",
  killedBy: "击杀的英雄",
  bounty: (n: string) => `赏金 ${n}`,
  distAxis: "离目标（码）· 绿是我方拿下、红是敌方，空心是当时死亡，虚线 2,000 码",

  // Defence.
  defense: "守塔",
  defenseHint: "自家建筑每段挨打（25 秒内连续掉血，掉 250 以上且超过 12%，或倒下那段）",
  defenseLine: (n: number, came: number, tp: number, far: number) =>
    `挨打 ${n} 段，赶到 2,000 码内 ${came} 段（${tp} 段用了 TP）；${far} 座在自己 5,000 码外打钱时倒下。`,
  colWindow: "挨打",
  colBuilding: "建筑",
  colLostHp: "掉血",
  colFrom: "开始时离多远",
  colArrived: "赶到",
  colDoing: "当时在做",
  fell: "倒下",
  there: "本来就在",
  trades: (list: string) => `换塔（90 秒内各丢一座）：${list}`,
  tradePair: (lost: string, took: string) => `丢${lost} 换${took}`,
  noDefense: "自家建筑没有大段挨打。",

  // Split push.
  split: "带线与推进",
  splitHint: "对建筑的伤害：1,500 码内没有活着的队友算独自",
  soloDamage: "独自",
  teamDamage: "和队友一起",
  splitKills: (n: number, solo: number) => `补掉建筑 ${n} 座，其中独自 ${solo} 座。`,
  enemyHalf: (sec: string, share: string) =>
    `在敌方半场、3,000 码内没有队友的时间 ${sec}（占存活 ${share}）。`,
  skipped: "没参加的团战",
  skippedRow: (at: string, ours: number, theirs: number, dist: string, doing: string, hit: string) =>
    `${at}（我方死 ${ours}、敌方死 ${theirs}）：离团战 ${dist}，${doing}，打建筑 ${hit}`,
  noSkipped: "每场团战都参加了。",

  // Section readings and the summary.
  insightMoments: (n: number, k: number, what: string) => `${what}跌最多的几分钟里参与了 ${k}/${n}。`,
  insightMomentsPair: (a: string, b: string, wa: string, wb: string) =>
    wa === wb
      ? `${wa}跌最多的几分钟里参与：A ${a}、B ${b}。`
      : `跌最多的几分钟里参与（A 看${wa}、B 看${wb}）：A ${a}、B ${b}。`,
  insightConvert: (n: number, k: number) => `赢下的 ${n} 场团战有 ${k} 场换到了目标。`,
  insightConvertPair: (a: string, b: string) => `赢下团战后换到目标：A ${a}、B ${b}。`,
  insightPresent: (n: number, k: number) => `我方拿下的 ${n} 个目标里在场 ${k} 个。`,
  insightPresentPair: (a: string, b: string) => `我方拿目标时在场：A ${a}、B ${b}。`,
  insightFar: (n: number) => `${n} 座自家建筑是在自己 5,000 码外打钱时倒下的。`,
  insightFarPair: (a: number, b: number) => `在 5,000 码外打钱时自家建筑倒下：A ${a} 座、B ${b} 座。`,
  insightNone: "没有位置资料（STRATZ 没有解析），只列出目标与团战。",
  summaryDrops: (who: string, n: number, k: number, what: string) =>
    `${who} 在${what}跌最多的几分钟里只参与了 ${k}/${n}。`,
  summaryDeathLoss: (who: string, k: number, n: number) =>
    `${who} ${n} 次死亡里有 ${k} 次死后 90 秒内丢了目标。`,
  summaryConvert: (a: string, b: string) => `赢下团战后换到目标：A ${a}，B ${b}。`,
  summaryBuyback: (who: string, n: number) => `${who} 后期有 ${n} 次死时不够买活。`,
  summaryUnused: (who: string, n: number) => `${who} 有 ${n} 次够钱买活却没买，复活前丢了建筑。`,
  summaryPresent: (a: string, b: string) => `我方拿目标时在场：A ${a}，B ${b}。`,
  ratio: (k: number, n: number) => `${k}/${n}`,
  lessonRespawn: (sec: number) =>
    `复活后到补第一刀前的空档（扣掉 30 秒路程，没 TP 也没交战）合计约 ${sec} 秒，按当时的打钱速度估计少拿的钱`,

  metrics: {
    objPresence: "我方拿目标时在场",
    fightConvert: "赢团后换到目标",
    deathLoss: "死后 90 秒内丢目标",
    bbHeld: "后期手上够买活的时间",
    riskShare: "危险处境时间",
    encounterWin: "交手赢的比例",
    allyHelped: "队友阵亡时有出手",
    spaceShare: "吸引敌人占全队",
    respawnLh: "复活到第一刀（秒）",
  } as Record<string, string>,
};

export default decisionsZh;

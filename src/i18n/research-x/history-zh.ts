// 局内科研 · history. Mounted as dotahub.research.x.history.
const historyZh = {
  // ── 对照基准 ──
  personal: "跟自己平常比（同英雄）",
  personalHint: (n: number) => `OpenDota 上 TA 用这个英雄的最近 ${n} 场（不含本场）`,
  parsedHint: (n: number) => `早期净值与正补来自 STRATZ 解析过的 ${n} 场`,
  personalAnon: "匿名玩家，看不到 TA 的历史。",
  personalNone: "OpenDota 看不到 TA 的历史：帐号不公开，或没有这个英雄的其他比赛。",
  pro: "跟职业比赛比（同英雄、同版本）",
  proHint: (n: number, patch: string) =>
    `OpenDota 收录的职业联赛（已解析）：${patch} 版本 ${n} 场，不含本场（最新的最多 400 场）`,
  proNone: "OpenDota 没有这个英雄在本版本的职业比赛资料。",
  metric: "项目",
  thisGame: "本局",
  pctile: "百分位",
  median: "中位数",
  proMedian: "职业中位数",
  range: "P10–P90",
  winLoss: "胜 / 负局中位数",
  n: (n: number) => `${n} 场`,
  totalTag: "整局",
  parsedTag: "STRATZ",
  pctNote:
    "百分位：这局的数字超过多少比例的场次（50 是中间）；绿色比平常好、红色比平常差（按位置判断，有些项目不分好坏）。",
  totalsNote: (p: string) => `标「整局」的是整场总数，比赛越长越多（本局时长的百分位：${p}）。`,
  rows: {
    gpm: "GPM",
    xpm: "XPM",
    lhpm: "每分钟正补",
    nw10: "10 分钟净值",
    lh: "正补",
    dn: "反补",
    kills: "击杀",
    deaths: "死亡",
    assists: "助攻",
    heroDamage: "英雄伤害",
    towerDamage: "建筑伤害",
    duration: "比赛时长",
    lh10: "10 分钟正补",
    dn10: "10 分钟反补",
    g10: "10 分钟累计金钱",
    xp10: "10 分钟经验",
    tp: "团战参与率",
    stacks: "囤野",
    stuns: "控制秒数",
    hd: "英雄伤害",
    td: "建筑伤害",
  } as Record<string, string>,
  lhAt: (m: number) => `${m} 分钟正补`,

  vs: "TA 用这个英雄对上这些英雄时",
  vsHint:
    "OpenDota：用这个英雄、对面有该英雄的比赛（最多 50 场，已扣掉本场）；每格是「平常 → 本局」，正补与死亡是整局总数",
  vsAnon: "匿名玩家，看不到 TA 的历史。",
  vsNone: "OpenDota 没有 TA 对上对线对手或伤害最多的英雄的纪录。",
  opponent: "对手",
  vsGames: "场次（胜率）",
  vsWon: (wr: string) => `（${wr}）`,
  vsGpm: "GPM",
  vsLh: "正补",
  vsDeaths: "死亡",
  laneTag: "对线",
  threatTag: "伤害最多",
  noOther: "除了本场没有别的",

  durations: "英雄胜率与比赛时长",
  durationsHint: (n: string) => `OpenDota 收录的比赛，不分版本与段位（共 ${n} 场）；少于 30 场的时段不画`,
  durationsAt: (who: string, len: string, from: number, to: number, wr: string, n: string) =>
    `${who}（${len}）落在 ${from}–${to} 分钟：这段胜率 ${wr}（${n} 场）。`,
  durationsOut: (who: string, len: string) => `${who}（${len}）所在的时段不到 30 场，不算。`,
  durationsNone: "OpenDota 没有这个英雄的比赛时长资料。",
  binLine: (hero: string, wr: string, n: string) => `${hero} ${wr}（${n} 场）`,
  lengthAxis: "比赛时长（分钟）",
  bin: (from: number, to: number) => `${from}–${to} 分钟`,

  rates: "英雄的整体胜率与职业热度",
  pubLine: (bracket: string | null, wr: string, n: string) =>
    `公开比赛（${bracket ? `${bracket}段位` : "本局段位"}，OpenDota）：胜率 ${wr}（${n} 场）`,
  pubNone: (bracket: string | null) =>
    `公开比赛：OpenDota 没有${bracket ? `${bracket}段位` : "这个段位"}的资料`,
  proLine: (pick: number, win: number, wr: string, ban: number) =>
    `职业比赛（OpenDota）：选 ${pick} 次、赢 ${win} 场（${wr}），禁 ${ban} 次`,
  ratesNote: (rankTable: boolean) =>
    `OpenDota 的公开与职业场次是它的近期统计（期间由 OpenDota 决定，不分版本）${rankTable ? "；同段位、同位置的胜率（STRATZ）在上面的同段位参考表里" : ""}。`,

  // ── 局势 ──
  compare: "两局可以比到什么程度",
  compareRows: {
    match: "同一场比赛",
    hero: "英雄",
    position: "位置",
    patch: "版本",
    mode: "游戏模式",
    lobby: "大厅类型",
    side: "阵营",
    result: "胜负",
    rank: "对局平均段位",
    duration: "比赛时长",
    shape: "局势",
    experience: "这个英雄的场次",
    party: "组队",
    smurfs: "对手中的疑似小号",
  } as Record<string, string>,
  lobbies: {
    "0": "普通匹配",
    "1": "练习赛（联赛、房间）",
    "2": "锦标赛",
    "4": "合作对抗电脑",
    "5": "组队天梯",
    "6": "单排天梯",
    "7": "天梯",
    "8": "1v1 中路",
    "9": "对战杯",
  } as Record<string, string>,
  verdicts: {
    mode: "游戏模式的规则不同（加速模式的金钱经验加倍、技能征召的英雄不同）：每分钟数字与时机不能直接比。",
    hero: "英雄不同：只能比打法的大方向（参战、走位、时间分配），数字本身别直接比。",
    position: (a: string, b: string) =>
      `位置不同（${a} 对 ${b}）：和位置有关的数字（正补、插眼、参战、囤野）要小心看。`,
    caution: (list: string) => `大致可比，要注意：${list}。`,
    also: (list: string) => `另外要注意：${list}。`,
    fine: "两局条件接近，可以直接比较。",
    sameMatch: "同一场比赛：版本、时长与局势都一样，差异来自两人。",
  },
  cautions: {
    hero: "英雄也不同",
    position: "位置也不同",
    mode: "模式不同",
    patch: "版本不同",
    lobby: "职业或房间比赛对天梯",
    rank: "段位差两档以上",
    duration: "时长差很多",
    shape: "局势一面倒对有来有回",
    experience: "英雄经验差很多",
    smurfs: "对手里有疑似小号",
  } as Record<string, string>,
  same: "相同",
  differ: "不同",
  unknown: "不明",
  solo: "单排",
  partyOf: (n: number) => `${n} 人组队`,
  noFlags: "没有",
  flagged: (n: number) => `${n} 位`,

  experience: "英雄经验与段位",
  heroGamesLabel: "这个英雄的场次",
  heroGames: (games: string, wins: number, wr: string) => `${games} 场，赢 ${wins} 场（${wr}）`,
  heroGamesOnly: (games: string) => `${games} 场`,
  heroGamesHint: "（OpenDota，含本场）",
  heroGamesListed: "（OpenDota 列出的最近场次，不含本场；没有英雄战绩，胜场不明）",
  usualLane: "常走的路（OpenDota，这个英雄的全部场次）",
  laneRoles: { "1": "优势路", "2": "中路", "3": "劣势路", "4": "野区", "0": "未知" } as Record<
    string,
    string
  >,
  thisGameTag: "本局",
  plusXp: "Dota Plus 英雄经验",
  plusHint: "没有 Dota Plus 时是 0",
  seasonRank: "本赛季段位",
  smurf: "STRATZ 小号标记",
  smurfYes: (n: number) => `疑似小号（${n}）`,
  smurfNo: "没有",
  laneFoesXp: "对线对手的英雄经验",

  players: "十位玩家",
  playersHint: "段位、小号标记、Dota Plus 英雄经验、组队与 IMP 来自 STRATZ；组队只标两人以上",
  missing: (cols: string, parsed: boolean) =>
    parsed ? `STRATZ 这场没有：${cols}。` : `STRATZ 没解析这场，没有：${cols}。`,
  noSmurfs: "STRATZ 没把任何人标为疑似小号。",
  colPlayer: "玩家",
  colRank: "段位",
  colSmurf: "小号",
  colXp: "英雄经验",
  colParty: "组队",
  colImp: "IMP",
  colKda: "KDA",
  party: (n: number) => `队 ${n}`,
  suspect: "疑似",
  laneOf: (who: string) => `${who} 的对线对手`,
  anonymous: "匿名",

  shape: "局势类型",
  shapeKinds: {
    stomp: "碾压取胜",
    stomped: "被碾压",
    comeback: "翻盘取胜",
    throw: "领先被翻",
    contested: "有来有回",
    close: "胶着",
  } as Record<string, string>,
  lead: (v: string, at: string) => `最多领先 ${v}（${at}）`,
  leadOnly: (v: string) => `最多领先 ${v}`,
  neverLed: "从没领先",
  deficit: (v: string, at: string) => `最多落后 ${v}（${at}）`,
  deficitOnly: (v: string) => `最多落后 ${v}`,
  neverBehind: "从没落后",
  changes: (n: number) => `领先易手 ${n} 次`,
  ahead: (p: string) => `${p} 的时间领先`,
  final: (v: string) => `结束时 ${v}`,
  shapeSource: {
    od: "我方金钱差（OpenDota）",
    stratz: "我方净值差（STRATZ）",
    shape: "OpenDota 记录的最大差距",
  } as Record<string, string>,
  shapeRule:
    "按金钱差判断：输的一方曾领先 5,000 以上算翻盘（或被翻）；输的一方没领先超过 1,500、赢的一方领先到 10,000 以上算碾压；赢的一方最多只领先不到 8,000 算胶着；其余算有来有回。一方领先 1,000 以上才算易手。",

  draft: "阵容评分与只看阵容的胜率",
  draftHint: "STRATZ 给每个选择的分：英雄本身的胜率 → 考虑当时阵容后的胜率（%）",
  draftNone: "STRATZ 没有这场的阵容评分。",
  draftTotal: (ours: string, theirs: string) => `调整合计（百分点）：我方 ${ours}，对方 ${theirs}。`,
  draftFlat: (n: number, total: number, v: number) =>
    `${total} 个选择里有 ${n} 个前后一样（多半是 ${v} → ${v}），像是没算出来的预设值，分数只能参考。`,
  draftCurve: "只看阵容的我方胜率（实线）与实时胜率（虚线）",
  live: "实时胜率",
  draftReading: (who: string, start: string, even: string | null, end: string) =>
    even
      ? `${who}：只看阵容，开局 ${start}，${even} 到 50%，曲线最后 ${end}。`
      : `${who}：只看阵容，开局 ${start}，曲线最后 ${end}。`,
  draftUndocumented: "STRATZ 没说明这条曲线怎么算，看起来是「比赛打到第几分钟时，只看阵容的胜率」。",

  quality: "暂停、断线与离开",
  qualityNone: "没有暂停、断线或提前离开。",
  pause: (at: string, secs: number) => `暂停 ${at}（${secs} 秒）`,
  pauseNote: "暂停时游戏时间不走，不影响每分钟的数字；断线与提前离开才会让一方少人。",
  pregame: "赛前",
  inRange: "在目前的时间范围内",
  events: { disconnect: "断线", reconnect: "重连", abandon: "放弃比赛" } as Record<string, string>,
  back: (at: string) => `${at} 重连`,
  noBack: "没有重连纪录",
  leaver: "提前离开",

  // ── Sentences ──
  end: "。",
  few: (who: string, n: number) => `（${who ? `${who} ` : ""}只有 ${n} 场）`,
  ownSingle: (metric: string, v: string, p: number, n: number) =>
    `${metric}（${v}）在 TA 最近 ${n} 场同英雄里排第 ${p} 百分位`,
  ownSide: (who: string, metric: string, v: string, p: number, n: number) =>
    `${who} 的 ${metric}（${v}）在 TA 最近 ${n} 场同英雄里排第 ${p} 百分位`,
  ownPair: (metric: string, pa: number, pb: number) =>
    `跟各自平常比，${metric} A 在第 ${pa}、B 在第 ${pb} 百分位`,
  proSingle: (metric: string, v: string, p: number, n: number) =>
    `对比本版本 ${n} 场职业比赛，${metric}（${v}）在第 ${p} 百分位`,
  proPair: (metric: string, pa: number, pb: number, shared: boolean) =>
    `对比${shared ? "本版本" : "各自英雄与版本"}的职业比赛，${metric} A 在第 ${pa}、B 在第 ${pb} 百分位`,
  unusualGood: "：比平常好得多的一局。",
  unusualBad: "：比平常差得多的一局。",
  pairMeaning: (better: string, worse: string) => `：${better} 打出了比平常好的一局，${worse} 比平常差。`,
  lengthToo: (longer: boolean, p: number, pro: boolean) =>
    `：不过这局也比${pro ? "这些职业比赛" : "平常"}${longer ? "长" : "短"}得多（时长在第 ${p} 百分位），每分钟的数字本来就会${longer ? "高" : "低"}一些。`,
  lengthPart: (who: string, longer: boolean, pro: boolean) =>
    `${who} 这局也比${pro ? "这些职业比赛" : "平常"}${longer ? "长" : "短"}得多`,
  lengthPair: (parts: string) => `；不过 ${parts}，每分钟的数字会跟着变。`,
  lengthBoth: (longer: boolean, pro: boolean) =>
    `；不过两人这局都比${pro ? "这些职业比赛" : "平常"}${longer ? "长" : "短"}得多，每分钟的数字会跟着变。`,
  expGap: (a: string, b: string, sameHero: boolean) =>
    sameHero
      ? `A 用这个英雄 ${a} 场、B ${b} 场：经验差距可能解释一部分差异。`
      : `A 用自己的英雄 ${a} 场、B 用自己的英雄 ${b} 场：经验差距可能解释一部分差异。`,
  shapePair: (a: string, b: string) => `局势不同：A ${a}、B ${b}，每分钟的数字会跟着局势变。`,
  shapeSame: (kind: string) => `两局局势相近（都是${kind}）。`,
  shapeSingle: (kind: string, detail: string) => `这局${kind}：${detail}。`,
  qualityLine: (pauses: number, drops: number, leavers: number) =>
    `比赛中有 ${[
      pauses ? `${pauses} 次暂停` : "",
      drops ? `${drops} 次断线` : "",
      leavers ? `${leavers} 人提前离开` : "",
    ]
      .filter(Boolean)
      .join("、")}。`,
  metricOwnGpm: "GPM 在本人同英雄场次的百分位",
  metricOwnXpm: "XPM 在本人同英雄场次的百分位",
  metricOwnLhpm: "每分钟正补在本人同英雄场次的百分位",
};

export default historyZh;

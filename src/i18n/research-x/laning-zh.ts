// 局内科研 · laning. Mounted as dotahub.research.x.laning.
const laningZh = {
  // The expected lane result.
  expect: "对线预期：同段位的对线纪录",
  expectHint:
    "这个英雄在同段位、同位置对上（或搭配）每个英雄的对线结果；胜、负都含大胜、大败，少于 50 局的不算进预期。预期 = 各纪录的简单平均，胜比负多 12 个百分点以上算占优，少 12 个以上算劣势。",
  hero: "英雄",
  role: "关系",
  vs: "对手",
  with: "队友",
  lanes: "局数",
  win: "胜",
  draw: "平",
  loss: "负",
  thin: "样本少",
  odds: { favoured: "占优", even: "均势", unfavoured: "劣势" } as Record<string, string>,
  verdicts: { "-1": "低于预期", "0": "符合预期", "1": "好于预期" } as Record<string, string>,
  expectLine: (odds: string, win: string, draw: string, loss: string, n: string) =>
    `预期${odds}：胜 ${win}、平 ${draw}、负 ${loss}（各项纪录合计 ${n} 局）`,
  actualLine: (result: string, verdict: string) => `实际${result}，${verdict}`,
  noActual: "STRATZ 没有这路的对线结果",
  tooThin: "纪录都太少，没有预期。",
  noExpect: "没有对线对手，或没有同段位的对线纪录。",
  expectSource: (bracket: string, position: string, week: boolean) =>
    `STRATZ heroStats 对线纪录：${bracket}${position}，${week ? "这场比赛那一周" : "最近"}的公开对局，不是这几位玩家自己的。`,

  // The 10-minute gaps.
  gaps: "对线差距：整条线、对位、同位置",
  gapsHint:
    "整条线：自己加同线队友对上对线对手的合计；对位：对方在线上对应的位置（1 对 3、2 对 2、4 对 5）；同位置：对方同号位。",
  atMinute: (m: number) => `${m} 分钟`,
  ours: "我方",
  theirs: "对方",
  nwGap: "净值差",
  xpGap: "经验差",
  wholeLane: (a: number, b: number) => `整条线（${a} 对 ${b}）`,
  counterpart: (n: number) => `对位（${n} 号位）`,
  samePosition: (n: number) => `同位置（${n} 号位）`,
  notInLane: "不在这路",
  noGaps: "看不出对线对手（STRATZ 未解析，或是打野、游走）。",
  noPositions: "没有 STRATZ 的位置（1–5 号位），看不出对位与同位置。",

  // Where the waves met.
  wave: "兵线交汇点（实线）与自己的位置（虚线）：0% = 己方一塔，100% = 敌方一塔",
  heroPlace: "自己的位置",
  waveStates: {
    intoOwn: "推到己方塔下",
    nearOwn: "停在己方塔前",
    middle: "在中间",
    nearEnemy: "压向敌方塔",
    intoEnemy: "推到敌方塔下",
  } as Record<string, string>,
  ahead: "站在兵线前面",
  waveMedian: "交汇点中位数",
  heroMean: "自己的平均位置",
  fromTower: (share: string, units: string) => `${share}（离己方一塔约 ${units} 码）`,
  minutes: (n: number) => `${n} 分钟`,
  fewHits: "补刀太少（每分钟至少 2 个，至少 4 分钟），看不出整段的兵线位置。",
  noWave: "没有 STRATZ 的补刀位置，或不在三路上。",
  waveNote:
    "用自己补线上小兵的位置估计两波兵交汇的地方（每分钟前后 30 秒的中位数）；反补和队友的补刀都没有位置，所以没算。塔下 = 离一塔 700 码内；塔前 = 靠自己（或对方）那三分之一段的其余部分；站在兵线前面 = 自己的平均位置比交汇点再往敌方 400 码以上。",

  // The lane's creeps.
  creeps: "前 10 分钟线上小兵的分配",
  creepChart: "自己补到的敌方小兵占比（累计，实线）；虚线是我方整条线",
  laneTeam: "我方整条线",
  enemyCreeps: (n: number) => `敌方小兵（约 ${n} 个到线上）`,
  ownCreeps: (n: number) => `我方小兵（约 ${n} 个）`,
  you: "自己",
  allies: "同线队友",
  deniedByThem: "被对方反补",
  rest: "其余",
  theirLh: "对方正补",
  ourDenies: "我方反补",
  restHint: "被小兵或防御塔杀掉、被别人拿走，或还活着",
  lhNote: (all: number, lane: number, m: number) =>
    `${m} 分钟 ${all} 个正补，其中 ${lane} 个是这路的线上小兵（按补刀位置）。`,
  lhNoPlaces: "没有补刀位置（STRATZ 未解析），自己的正补也是 OpenDota 的每分钟总数，可能含野怪或别路的兵。",
  noCreeps: "看不出这路的对手（STRATZ 未解析，或是打野、游走）。",
  creepNote:
    "到线上的小兵是按出兵规则推算的（假设 7.41：每 30 秒一波 3 个近战＋1 个远程，5:00、10:00…那波多 1 个投石车，出兵后约 45 秒死完），不是录像记录；队友与对手的正补、反补是 OpenDota 的每分钟总数，可能含野怪或别路的兵。",

  // Rotations.
  rotations: "前 15 分钟的游走",
  rotationsHint:
    "离开自己这路、连续两个位置点（每 10 秒一个）都在别路算一次，中途阵亡就算结束；结果看到达后 45 秒内。",
  time: "时间",
  where: "去哪",
  how: "方式",
  result: "结果",
  away: "离线",
  killGold: "击杀所得",
  givenUp: "少拿的补刀金钱 / 经验",
  tp: "TP",
  walk: "走过去",
  outcomes: { kill: "击杀", assist: "助攻", nothing: "没收获" } as Record<string, string>,
  died: "死了",
  noRotation: "前 15 分钟没有离开自己这路。",
  noHome: "STRATZ 没有判给这位玩家一条线（打野或游走），每次进到线上都算一次。",
  rotationLine: (n: number, per10: string, paid: number, died: number) =>
    `游走 ${n} 次（每 10 分钟 ${per10} 次），${paid} 次拿到击杀或助攻，${died} 次死了。`,
  givenLine: (gold: string, xp: string, kill: string | null) =>
    `离线少拿约 ${gold} 金、${xp} 经验${kill ? `；击杀拿到 ${kill} 金` : ""}。`,
  enemyIn: "敌方来这路（不在这路对线的敌方英雄）",
  who: "谁",
  youThere: "你在吗",
  then: "之后 45 秒：我方死亡 / 敌方死亡",
  here: "在",
  notHere: "不在",
  jump: "TP / 跳",
  noEnemyIn: "前 15 分钟没有别路的敌方英雄来这路。",
  noPath: "没有 STRATZ 的走位资料，看不出游走。",
  rotationNote:
    "少拿的补刀金钱 = 在自己这路时每分钟补刀（小兵与野怪）的金钱 × 离开的时间（不含阵亡），减去离开时在别处补到的小兵与野怪（按每次补刀）；经验同理，但小兵经验只有每分钟的总数，离开的那几秒按时间比例分摊。",
  positionsNote: "位置来自录像（每 10 秒一个点），包括当时被战争迷雾挡住的英雄。",

  // Runes.
  runes: "前 15 分钟的神符（双方）",
  runesHint: "按时 = 刷新后 15 秒内拿到。",
  kind: "种类",
  runeKinds: { power: "能量符", bounty: "赏金符", water: "水符", wisdom: "智慧符" } as Record<string, string>,
  total: "合计",
  share: "我方占比",
  mine: "自己",
  onTime: "按时（我方 / 对方）",
  afterPower: "拿到能量符后 60 秒内的击杀",
  noKill: "没有击杀",
  noRunes: "前 15 分钟没有神符拾取纪录。",
  runeNote:
    "刷新时间是假设的（7.41：赏金符 0:00 起每 4 分钟、水符 2:00 和 4:00、能量符 6:00 起每 2 分钟、智慧符每 7 分钟），只用来算按时；拾取纪录来自 OpenDota（十个人的）。",
  otherPatch: (patch: string) => `这场是 ${patch} 版本，规则可能不同。`,

  // Matchup threats (the game's context).
  threat: "对位威胁：同段位的克制关系与实际",
  threatHint:
    "优势：这个英雄对上他时的胜率，比两个英雄各自的胜率所预期的高（或低）几个百分点（STRATZ），不分位置；少于 50 局的不算。",
  games: "局数",
  winRate: "胜率",
  advantage: "优势",
  takenShare: "承受伤害",
  killedYou: "击杀你",
  dealtShare: "你的伤害",
  laneTag: "对线",
  draftLine: (avg: string, n: number) => `阵容平均优势 ${avg} 个百分点（${n} 个英雄）。`,
  countersLine: (heroes: string, share: string) => `克制你的：${heroes}，造成你承受伤害的 ${share}。`,
  counteredLine: (heroes: string, share: string) =>
    `你克制的：${heroes}，你的英雄伤害有 ${share} 打在他们身上。`,
  noThreat: "没有同段位的对位纪录。",
  threatSource: (bracket: string, week: boolean) =>
    `STRATZ heroStats 对位纪录：${bracket}，不分位置，${week ? "这场比赛那一周" : "最近"}的公开对局；伤害与击杀来自这局。`,

  // Sentences.
  insightExpect: (who: string, odds: string, win: string, loss: string, result: string, verdict: string) =>
    `${who}按同段位纪录这路${odds}（胜 ${win}、负 ${loss}），结果${result}，${verdict}。`,
  insightExpectPair: (a: string, b: string) => `对线预期与结果：A ${a}；B ${b}。`,
  expectShort: (odds: string, result: string, verdict: string) => `${odds}→${result}（${verdict}）`,
  insightGaps: (who: string, m: number, total: string, a: number, b: number, same: string | null) =>
    `${who}${m} 分钟整条线净值差 ${total}（${a} 对 ${b}）${same ? `，同位置 ${same}` : ""}。`,
  insightGapsPair: (ta: string, tb: string, sa: string | null, sb: string | null) =>
    `10 分钟整条线净值差 A ${ta}、B ${tb}${sa || sb ? `；同位置 A ${sa ?? "–"}、B ${sb ?? "–"}` : ""}。`,
  insightWave: (who: string, n: number) => `${who}兵线前 12 分钟有 ${n} 分钟被推到自己塔下。`,
  insightThreat: (who: string, hero: string, adv: string, share: string, kills: number, avg: string) =>
    `${who}最难打的对位是 ${hero}（${adv}），造成你承受伤害的 ${share}、击杀你 ${kills} 次；阵容平均优势 ${avg} 个百分点。`,
  insightDraftPair: (a: string, b: string) => `阵容平均对位优势：A ${a}、B ${b} 个百分点。`,
  sumExpectWorse: (who: string, odds: string, win: string, result: string) =>
    `${who}对线不如预期：按同段位纪录这路${odds}（胜 ${win}），结果${result}。`,
  sumExpectBetter: (who: string, odds: string, win: string, result: string) =>
    `${who}对线好于预期：按同段位纪录这路${odds}（胜 ${win}），结果${result}。`,
  sumExpectPair: (a: string, b: string) => `对线相对预期：A ${a}，B ${b}。`,
  sumGaps: (ta: string, tb: string, sa: string | null, sb: string | null) =>
    `10 分钟整条线净值差 A ${ta}、B ${tb}${sa || sb ? `（同位置 A ${sa ?? "–"}、B ${sb ?? "–"}）` : ""}。`,
  sumWave: (who: string, n: number) => `${who}兵线前 12 分钟有 ${n} 分钟被推到自己塔下。`,
  sumWavePair: (a: string, b: string) => `前 12 分钟兵线交汇点的中位数（0% = 己方一塔）：A ${a}，B ${b}。`,
  sumRotations: (who: string, n: number, paid: number) =>
    `${who}前 15 分钟游走 ${n} 次，${paid} 次拿到击杀或助攻。`,
  sumRotationsPair: (a: number, b: number) => `前 15 分钟游走：A ${a} 次，B ${b} 次。`,
  sumPower: (who: string, ours: number, all: number) => `${who}这边前 15 分钟拿到 ${ours}/${all} 个能量符。`,
  sumThreat: (who: string, hero: string, adv: string, share: string) =>
    `${hero} 是${who}最难打的对位（${adv}），也造成你承受伤害的 ${share}。`,
  sumDraft: (a: string, b: string) => `阵容对位优势：A 平均 ${a}，B ${b} 个百分点。`,
  lessonRotation: (n: number, gold: string) =>
    `前 15 分钟有 ${n} 次游走没换到击杀或助攻，离线少拿约 ${gold} 金的补刀钱（估计）。`,
  pp: (v: string) => `${v} 个百分点`,

  metrics: {
    laneTotal10: "10 分钟整条线净值差",
    laneRole10: "10 分钟对位净值差",
    lanePos10: "10 分钟同位置净值差",
    laneVsExp: "对线结果比预期（−2 到 +2）",
    wave12: "兵线交汇点（0% = 己方一塔）",
    creepShare10: "10 分钟补到的敌方线上小兵",
    rotations15: "前 15 分钟游走次数",
    runeShare15: "前 15 分钟我方神符占比",
  },
};

export default laningZh;

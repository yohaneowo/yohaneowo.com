// 局内科研 · farming. Mounted as dotahub.research.x.farming.
const farmingZh = {
  noStratz:
    "没有 STRATZ 解析：看不到每 10 秒在做什么、补刀的位置和金钱纪录，这里只剩每分钟正补、净值、局势与击杀的单位。",
  misfiled: (n: number) =>
    `STRATZ 把 ${n} 只青蛙营地的野怪（蝌蚪到远古青蛙，OpenDota 的击杀纪录有这些）记成了线上小兵，所以线上 / 野区各自的打钱速度、野区路线、补刀地点与节奏里的「线上 ↔ 野营」都把它们算在线上；打钱时间与打钱速度的合计照金钱纪录，不受影响。`,
  noData: "没有 STRATZ 解析。",
  window: "所选范围",
  all: "全场",
  none: "没有",
  seconds: (n: number) => `${n} 秒`,

  speed: {
    title: "打钱时间与打钱速度",
    hint: "打钱时间：10 秒内有补刀、没有交战；速度：这段时间拿到的小兵与野怪金钱（照 STRATZ 的金钱纪录）",
    alive: "存活",
    farm: "打钱时间（占存活）",
    speed: "打钱速度（每打钱分钟金钱）",
    laneJungle: "其中线上 / 野区",
    lhRate: "每打钱分钟正补",
    otherShare: "交战中补刀的金钱占比",
    farmPm: "小兵与野怪金钱（每分钟）",
    kills: "击杀与信使（每分钟）",
    objectives: "建筑与肉山（每分钟）",
    gpm: "全部金钱（每分钟）",
    lhAvg: "每分钟正补（自己 / 同段位平均）",
    nwAvg: "阶段结束时净值（自己 / 同段位平均）",
    avgNote:
      "同段位平均是 STRATZ 同英雄、同位置、同段位的每分钟平均，只算到那一分钟还在打的比赛（越晚场数越少、越偏向长局）；滑过数字可以看场数。",
    games: (n: string) => `${n} 场`,
    gap: (who: string, total: string, time: string, speed: string) =>
      `${who} 打钱拿到的小兵与野怪金钱每分钟多 ${total}：打钱时间 ${time}、打钱速度 ${speed}`,
    gapBy: { time: "，差距主要在花在打钱上的时间。", speed: "，差距主要在打钱速度。" } as Record<
      string,
      string
    >,
    gapWindow: (m: string) => `（两边都算 ${m}）`,
    drought: (from: string, to: string, value: string, median: string, doing: string) =>
      `10 分钟后打钱最少的 5 分钟在 ${from}–${to}：每分钟 ${value} 金（平常 ${median}）${doing}。`,
    droughtLh: (from: string, to: string, value: string, median: string) =>
      `10 分钟后正补最少的 5 分钟在 ${from}–${to}：每分钟 ${value} 个（平常 ${median}）。`,
    doing: (list: string) => `，那时${list}`,
  },

  state: {
    title: "同样局势下比较",
    hint: "按每一分钟开始时我方的经济差分：领先超过 5,000、落后超过 2,000，其余算均势",
    states: { ahead: "领先", even: "均势", behind: "落后" } as Record<string, string>,
    share: "各局势占全场",
    row: "局势 · 阶段",
    minutes: "分钟",
    farm: "每分钟打钱",
    lh: "每分钟正补",
    hd: "每分钟英雄伤害",
    td: "每分钟建筑伤害",
    deaths: "每 10 分钟死亡",
    farmPct: "打钱时间",
    fightPct: "参战时间",
    pair: "（A / B）",
    ratesHint: "打钱是小兵与野怪金钱（没有金钱纪录就看不到）；打钱与参战时间占存活；不到 3 分钟的不列数字。",
    matchHint: "两局在同一局势、同一阶段都有 3 分钟以上的列底色较深，可以直接比。",
    noMatch: "两局没有同一局势、同一阶段都超过 3 分钟的时候，没法在同样局势下比。",
    noLead: "没有经济差资料。",
  },

  routes: {
    title: "野区路线与清囤野",
    hint: "同一处 12 秒内接连补的野怪算清一次营地；一次 7 只以上，大约是囤过的营地（或一次清两营）",
    visits: "清营次数",
    perVisit: "每次几只",
    perMin: "连着清野时每分钟清几营",
    walk: "走到下一营（中位数）",
    cycle: "营地到营地（中位数）",
    large: "7 只以上的大清野",
    stacks: "大清野 / 队伍囤野（全场）",
    ancient: "其中远古营",
    map: "数字是先后，圆越大清的野怪越多，外圈是 7 只以上，紫色是远古",
    window: "地图时段",
    slice: (from: number, to: number, n: number) => `${from}–${to}′ · ${n} 营`,
    noVisits: "这段时间没有清野。",
    visit: (i: number, at: string, n: number) => `${i}. ${at} · ${n} 只`,
    stackNote:
      "统计跟着上面的时间范围，地图跟着这里选的 5 分钟；节奏只算前后相隔不到 1 分钟的营地。队伍囤野是全队（含自己）整场囤的营地数，把 7 只以上的清野当成清掉的囤野是估计。",
  },

  rhythm: {
    title: "打钱节奏（10:00 起）",
    hint: "每一条竖线是一次，跟着上面的时间范围",
    switches: "线上 ↔ 附近野营",
    gaps: "45 秒以上没补刀",
    idle: "40 秒以上空闲",
    line: (switches: number, per100: string, gaps: number, idle: number, longest: string) =>
      `线上与附近野营 40 秒内来回 ${switches} 次（每 100 个补刀 ${per100} 次）；存活又没交战却 45 秒以上没补刀 ${gaps} 次；40 秒以上只在走路或待在基地 ${idle} 段${longest}。`,
    longest: (d: string, at: string) => `，最长 ${d}（${at}）`,
    rule: "空闲不算推塔、在肉山与刚复活的 30 秒；附近 = 20 格（约 2,500 码）内。",
  },

  method: {
    title: "补刀方式",
    hint: "STRATZ 记的每个补刀是普攻、装备（如狂战斧溅射）、技能，还是幻象与其他单位补的",
    source: "方式",
    total: "合计",
    share: "占比",
    gold: "金钱",
    rightClick: "普攻",
    units: "幻象与其他单位",
    item: "装备",
    ability: "技能",
  },

  places: {
    title: "打钱地点",
    camps: "野怪营地大小（OpenDota，全场击杀）",
    campNames: {
      small: "小营",
      medium: "中营",
      mediumLarge: "中或大营（人马、萨特）",
      large: "大营",
      ancient: "远古营",
      other: "其他",
    } as Record<string, string>,
    creeps: (melee: number, ranged: number, siege: number, flag: number) =>
      `线上小兵：近战 ${melee}、远程 ${ranged}、攻城车 ${siege}、旗手 ${flag}`,
    upgraded: (upgraded: number, mega: number) => `，其中超级兵 ${upgraded}、巨型兵 ${mega}`,
    denied: (n: number) => `；反补 ${n}`,
    where: "补刀的地方（STRATZ，按阶段）",
    n: "补刀数",
    rows: {
      ownJungle: "己方野区",
      enemyJungle: "敌方野区",
      ancients: "远古营（两边合计）",
      ownBase: "线上 · 己方基地",
      ownHalf: "线上 · 己方半场",
      enemyHalf: "线上 · 敌方半场",
      enemyBase: "线上 · 敌方基地",
      enemyTowers: "离敌塔较近",
    } as Record<string, string>,
    rule: "己方 / 敌方以河道（地图的对角线）分：优势路的一塔就在河道旁，平常在一塔前打钱也有一部分算到敌方半场。「离敌塔较近」只算当时还站着的塔（塔倒了这条线就往前推），比较看得出打得多深，是粗略的地盘。",
  },

  afford: {
    title: "关键装备：买得起到付清",
    hint: "手上的钱第一次够买还没买的部分（扣掉已买的零件），到真的付清；付清后又过多久才合成（信使或回家）",
    bought: "合成",
    from: "买得起",
    held: "攒着没买",
    heldBuyback: "留买活钱后",
    wait: "付清后等合成",
    where: "合成时",
    place: { base: "在基地", dead: "死亡中", field: "在外面" } as Record<string, string>,
    none: "这段时间没有关键装备。",
    rule: "每 10 秒一个点，几秒内的差距看不出来。OpenDota 不记图纸：图纸何时买是从手上的钱掉了多少推的，推不出来就留空。30 分钟起留着买活钱是常见做法，「留买活钱后」只算扣掉买活钱还够的时间。",
  },

  insight: {
    single: (farm: string, speed: string, lh: string) =>
      `打钱时间占存活 ${farm}，每打钱分钟 ${speed} 金、${lh} 个正补。`,
    lhOnly: (lh: string, avg: string) => `每分钟正补 ${lh}（同段位平均 ${avg}）。`,
    state: (state: string, phase: string, a: string, b: string) =>
      `${phase}${state}时：每分钟打钱 A ${a}、B ${b}。`,
    stateLh: (state: string, phase: string, a: string, b: string) =>
      `${phase}${state}时：每分钟正补 A ${a}、B ${b}。`,
  },

  summary: {
    speed: (who: string, total: string, speed: string, time: string) =>
      `${who} 打钱多 ${total}，主要因为打得更快（速度 ${speed}，打钱时间 ${time}）。`,
    time: (who: string, total: string, time: string, speed: string) =>
      `${who} 打钱多 ${total}，主要因为花更多时间打钱（打钱时间 ${time}，速度 ${speed}）。`,
    single: (speed: string, farm: string) => `打钱速度每打钱分钟 ${speed} 金，打钱时间占存活 ${farm}。`,
    drought: (from: string, to: string, value: string, median: string) =>
      `${from}–${to} 打钱掉到每分钟 ${value} 金（平常 ${median}）。`,
    held: (item: string, held: string) => `${item} 的钱早就够了，${held}后才付清。`,
  },

  lessons: {
    idle: (n: number, secs: string, rate: string, gold: string) =>
      `10:00 后有 ${n} 段 40 秒以上只在走路或待在基地（不算推塔、肉山、刚复活），扣掉每段 20 秒路程共 ${secs}；照自己 10:00 后存活时的平均打钱（每分钟 ${rate} 金）约 ${gold} 金（估计）。`,
  },

  metrics: {
    farmSpeed: "打钱速度（每打钱分钟金钱）",
    drought: "10 分钟后最少 5 分钟的打钱",
    perVisit: "每次清营几只野怪",
    skillLh: "不是普攻的补刀占比",
  },
};

export default farmingZh;

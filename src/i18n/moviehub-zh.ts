// 观影统计 sub-navigation, the 推荐 page and the pages still being planned (Chinese);
// moviehub-en.ts must have the same shape.
const moviehubZh = {
  nav: {
    label: "观影统计的页面",
    stats: "我的统计",
    picks: "推荐",
    calendar: "追番日历",
    leaderboard: "排行榜",
    friends: "好友",
    wrapped: "年度回顾",
  },
  planned: {
    badge: "规划中",
    title: "尚未开发",
    note: "这个功能还在规划中，做好后会出现在这里。",
    calendar: "你在追的剧集和新番，这周哪天几点更新，下一集还要等多久。",
    leaderboard: "全站用户（只有愿意公开的人）的排名，例如本月看最多、评分最严格。",
    friends: "同一个 Discord 伺服器里也有观影统计的人：口味有多像、一起看过什么、最近在看什么。",
    wrapped: "一年看了什么：总数、时数、最爱的类型和导演、每个月的节奏，可以分享成一张图。",
  },
  picks: {
    title: "推荐",
    description:
      "Discord 里 /movie recommend 与 /anime recommend 抽到的推荐：今天的次数、今天抽到什么、最近 30 天的纪录。",
    kinds: { movie: "电影", show: "剧集", anime: "动漫" },
    kindsLabel: "推荐的类型",
    showPlanned: "剧集推荐尚未开发，目前可以在 Discord 用 /movie recommend 抽电影、/anime recommend 抽动漫。",
    left: (left: number, total: number) => `今天还剩 ${left} / ${total} 次`,
    bonus: (count: number) => `另有 ${count} 次奖励次数`,
    resets: "每天台北时间半夜 12 点重置；用完后会用奖励次数。",
    today: "今天的推荐",
    history: "最近 30 天",
    noHistory: "最近 30 天还没有推荐纪录。",
    draw: {
      movie: "在 Discord 用 /movie recommend 抽一部",
      anime: "在 Discord 用 /anime recommend 抽一部",
    },
    unopened: "还没抽",
    bonusCard: "奖励次数",
    linkDiscord: "关联 Discord 之后，bot 才找得到你的观影档案，才能抽推荐。",
    linkAction: "关联 Discord",
    columns: { title: "作品", mode: "池", result: "结果", day: "日期" },
    status: {
      pending: "还没决定",
      skip: "换掉了",
      watchlist: "想看",
      watched: (rating: number | null) => (rating == null ? "看过了" : `看过了 · ${rating} 分`),
      watched_existing: (rating: number | null) => (rating == null ? "之前看过" : `之前看过 · ${rating} 分`),
      rated: (rating: number | null) => (rating == null ? "补了评分" : `补了评分 · ${rating} 分`),
    },
    modes: {
      movie: { comfort: "猜你喜欢", bridge: "跨出一步", explore: "开新坑", backfill: "补个评分" },
      anime: { sequel: "续作", comfort: "猜你喜欢", bridge: "跨界", explore: "新坑", airing: "新番" },
    },
    signedOut: "登录后可以看你在 Discord 抽到的推荐。",
    signIn: "登录",
    noProfile: "还没有观影档案。先到「我的统计」连接 Trakt，再到 Discord 抽推荐。",
    toStats: "去我的统计",
    unavailable: "暂时无法连接推荐服务，请稍后再试。",
    loading: "正在读取推荐…",
    open: "打开",
  },
};

export default moviehubZh;

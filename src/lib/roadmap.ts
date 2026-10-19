// 开发计划 (/roadmap): the items, kept in code and updated with every commit that moves one (see
// CLAUDE.md). Votes, suggestions and their likes live in the database (roadmap_vote,
// roadmap_suggestion, roadmap_suggestion_like), keyed by these ids, so an id never changes once
// published. The history goes back to the first commit of each project: the Discord bot
// (2026-10-03), the admin (2026-10-08, on top of an admin template) and this site (2026-10-13).
//
//   considering  考虑中: being thought about; votes decide what comes first
//   building     开发中: being written, not on the dev site yet
//   testing      测试中: on the dev site (develop), waiting for the go-ahead to release
//   shipped      已上线: merged into main, with the release date
//   paused       暂缓:   started or planned, put on hold (with the reason)
//   declined     不做:   looked at and decided against (with the reason)

export type RoadmapStatus = "considering" | "building" | "testing" | "shipped" | "paused" | "declined";
export type RoadmapArea = "moviehub" | "dotahub" | "bot" | "admin" | "coinhub" | "uidhub" | "site";
type Text = { zh: string; en: string };

export type RoadmapItem = {
  id: string;
  status: RoadmapStatus;
  area: RoadmapArea;
  title: Text;
  summary: Text;
  // Why it's worth doing (mostly for what isn't shipped yet).
  why?: Text;
  // The parts of the work; the done ones count towards the progress shown on the card.
  steps?: { text: Text; done: boolean }[];
  // What shipped, for the changelog.
  notes?: Text[];
  // Site paths ("/moviehub") or full URLs.
  links?: { label: Text; href: string }[];
  // Why it's paused or declined.
  reason?: Text;
  added: string;
  started?: string;
  shipped?: string;
  // Suggestions (roadmap_suggestion ids) this item came from: shown to their authors as accepted.
  suggestions?: string[];
};

export const ROADMAP_STATUSES: RoadmapStatus[] = [
  "considering",
  "building",
  "testing",
  "shipped",
  "paused",
  "declined",
];
export const ROADMAP_AREAS: RoadmapArea[] = [
  "moviehub",
  "dotahub",
  "bot",
  "admin",
  "coinhub",
  "uidhub",
  "site",
];
// Voting is for what may still be built.
export const VOTABLE: RoadmapStatus[] = ["considering", "building", "testing", "paused"];

const step = (zh: string, en: string, done = false) => ({ text: { zh, en }, done });

export const ROADMAP: RoadmapItem[] = [
  // ── 考虑中 ─────────────────────────────────────────────────────────────────────────────────
  {
    id: "web-draw-picks",
    status: "considering",
    area: "moviehub",
    title: { zh: "在网站上抽推荐", en: "Draw picks on the website" },
    summary: {
      zh: "推荐页的问号卡可以直接点开抽一部，想看、看过了、评分也能在网站上按，跟 Discord 共用同一份次数。",
      en: "Flip a face-down card on the Picks page to draw one, and mark it wanted or watched with a rating there too, sharing the same daily picks as Discord.",
    },
    why: {
      zh: "现在只能在 Discord 抽，网站只能看结果；在电脑或手机浏览器上也该能直接用。",
      en: "Picks can only be drawn on Discord today, and the website just shows them; the browser should work too.",
    },
    steps: [
      step("决定抽卡的互动方式（翻牌、等待动画）", "Decide how drawing looks (card flip, waiting animation)"),
      step(
        "admin 开放网站用的抽卡接口，跟 bot 共用次数",
        "Admin endpoints for drawing from the website, sharing the bot's quota",
      ),
      step("想看、看过了、评分、删除评分的按钮", "Want, watched, rating and undo buttons"),
      step("抽卡进度与逾时处理", "Progress and timeouts while a pick is built"),
    ],
    links: [{ label: { zh: "推荐页", en: "Picks page" }, href: "/moviehub/picks" }],
    added: "2026-10-19",
  },
  {
    id: "show-picks",
    status: "considering",
    area: "bot",
    title: { zh: "剧集推荐", en: "Show picks" },
    summary: {
      zh: "像 /movie recommend 和 /anime recommend 一样，按你的观看记录推荐没看过的剧集。",
      en: "Like /movie recommend and /anime recommend: shows you haven't watched, picked from your history.",
    },
    why: {
      zh: "电影和动漫都有推荐了，剧集还没有；观影统计里剧集的资料已经很完整。",
      en: "Films and anime have picks, shows don't yet, and the statistics already know your shows well.",
    },
    steps: [
      step(
        "剧集的推荐池（续集季、猜你喜欢、新坑）",
        "Show pools (next seasons, ones you'll like, something new)",
      ),
      step("写回 Trakt：想看、看过了整季", "Write back to Trakt: watchlist and whole seasons watched"),
      step("Discord 指令与卡片", "Discord command and card"),
      step("网站推荐页的剧集分页", "The Shows tab on the Picks page"),
    ],
    added: "2026-10-19",
  },
  {
    id: "watch-calendar",
    status: "considering",
    area: "moviehub",
    title: { zh: "追番日历", en: "Watch calendar" },
    summary: {
      zh: "你在追的剧集和新番，这周哪天几点更新，下一集还要等多久。",
      en: "The shows and anime you follow: which day and time they air this week, and how long until the next episode.",
    },
    why: {
      zh: "追的东西一多，就记不得哪天更新；Trakt 的日历不分时区也不分动漫。",
      en: "With many shows it's hard to keep track of what airs when; Trakt's calendar doesn't separate anime or local time.",
    },
    links: [{ label: { zh: "规划中的页面", en: "The planned page" }, href: "/moviehub/calendar" }],
    added: "2026-10-19",
  },
  {
    id: "leaderboard",
    status: "considering",
    area: "moviehub",
    title: { zh: "排行榜", en: "Leaderboard" },
    summary: {
      zh: "全站用户（只有愿意公开的人）的排名，例如本月看最多、评分最严格。",
      en: "Rankings across the site (only people who choose to be listed), such as most watched this month or toughest raters.",
    },
    why: {
      zh: "让观影统计有一点竞争和社群感。",
      en: "A little competition and community for the statistics.",
    },
    steps: [
      step("帐号设定加「公开在排行榜」开关", "An opt-in switch in the account settings"),
      step("每天算一次排名", "Rankings computed daily"),
      step("排行榜页面", "The leaderboard page"),
    ],
    links: [{ label: { zh: "规划中的页面", en: "The planned page" }, href: "/moviehub/leaderboard" }],
    added: "2026-10-19",
  },
  {
    id: "friends",
    status: "considering",
    area: "moviehub",
    title: { zh: "好友页", en: "Friends page" },
    summary: {
      zh: "同一个 Discord 伺服器里也有观影统计的人：口味有多像、一起看过什么、最近在看什么。",
      en: "People on your Discord servers who also have statistics: how alike your tastes are, what you've both watched, what they watch now.",
    },
    why: {
      zh: "羁绊卡片只放得下几个人，整页才能好好比较。",
      en: "The bonds card only fits a few people; a whole page can compare properly.",
    },
    links: [{ label: { zh: "规划中的页面", en: "The planned page" }, href: "/moviehub/friends" }],
    added: "2026-10-19",
  },
  {
    id: "year-in-review",
    status: "considering",
    area: "moviehub",
    title: { zh: "年度回顾", en: "Year in review" },
    summary: {
      zh: "一年看了什么：总数、时数、最爱的类型和导演、每个月的节奏，可以分享成一张图。",
      en: "Your year in film: totals, hours, favourite genre and director, the monthly rhythm, shareable as one image.",
    },
    why: { zh: "年底最想分享的就是这个。", en: "The thing everyone wants to share at the end of the year." },
    links: [{ label: { zh: "规划中的页面", en: "The planned page" }, href: "/moviehub/wrapped" }],
    added: "2026-10-19",
  },
  {
    id: "uidhub",
    status: "considering",
    area: "uidhub",
    title: { zh: "UidHub：游戏 UID 公开页", en: "UidHub: a public page of game UIDs" },
    summary: {
      zh: "把自己在各个手游的 UID 放在一页，想加好友时直接给连结，不用开游戏查。",
      en: "Your UIDs from mobile games on one page, so friends can add you without you opening each game.",
    },
    why: {
      zh: "网站一开始就规划的三个功能之一，目前只有占位页。",
      en: "One of the three features planned from the start; only a placeholder page so far.",
    },
    steps: [
      step("支援哪些游戏、各自的 UID 格式", "Which games, and each game's UID format"),
      step("编辑自己的 UID", "Editing your UIDs"),
      step("公开页与复制按钮", "The public page with copy buttons"),
    ],
    links: [{ label: { zh: "UidHub", en: "UidHub" }, href: "/uidhub" }],
    added: "2026-10-13",
  },

  // ── 开发中 / 测试中 ──────────────────────────────────────────────────────────────────────────
  {
    id: "dotahub",
    status: "testing",
    area: "dotahub",
    title: { zh: "DotaHub：Dota 2 统计", en: "DotaHub: Dota 2 statistics" },
    summary: {
      zh: "用 Steam 登录连结帐号，看自己的段位、胜率、最近比赛、常用英雄、比赛详情与常一起玩的队友。",
      en: "Sign in with Steam to see your rank, win rate, recent matches, most played heroes, match details and the people you play with.",
    },
    why: {
      zh: "像 STRATZ、OpenDota 那样看自己的 Dota，但跟网站帐号和 Discord 放在一起，中文显示英雄和物品。",
      en: "Your Dota the way STRATZ and OpenDota show it, next to your site account and Discord, with heroes and items in Chinese.",
    },
    steps: [
      step("用 Steam 登录连结帐号", "Sign in with Steam to link the account", true),
      step(
        "总览：段位、胜率、最近一场（IMP 与死亡地图）、常用英雄、位置",
        "Overview: rank, win rate, the latest match (IMP and death map), heroes, roles",
        true,
      ),
      step(
        "比赛列表与比赛详情（计分板、出装、经济与经验曲线、选角）",
        "Match list and details (scoreboard, items, gold and XP curves, draft)",
        true,
      ),
      step("常一起玩的队友", "The people you play with", true),
      step("比赛的 IMP 表现分数（STRATZ）", "Match IMP scores (STRATZ)", true),
      step(
        "死亡地图：每场死在哪里、第几次，十个玩家都能看",
        "Death maps: where and in what order each player died in a match",
        true,
      ),
      step(
        "死亡热力图：最近 20 / 50 / 100 / 全部天梯，按英雄、阶段、胜负筛选",
        "Death heat map over the last 20 / 50 / 100 / all ranked matches, by hero, phase and result",
        true,
      ),
      step(
        "每场天梯打完，Discord 私讯这场的死亡地图（可在帐号设定关掉）",
        "A Discord DM with the death map after each ranked match (can be turned off in settings)",
        true,
      ),
      step("对线结果（STRATZ）", "Lane outcomes (STRATZ)"),
      step("别人的公开页、跟 Discord 好友比较", "Other players' pages and comparing with Discord friends"),
      step("Discord bot 指令（例如最近一场）", "Discord bot commands (e.g. the last match)"),
    ],
    links: [{ label: { zh: "DotaHub", en: "DotaHub" }, href: "/dotahub" }],
    added: "2026-10-19",
    started: "2026-10-19",
  },
  {
    id: "roadmap",
    status: "shipped",
    area: "site",
    title: { zh: "开发计划与投票", en: "Roadmap and voting" },
    summary: {
      zh: "就是这一区：路线图、更新纪录、公开的建议箱，替想要的功能投票。",
      en: "This section: the roadmap, the changelog, a public idea box, and votes for the features you want.",
    },
    why: {
      zh: "让大家知道接下来要做什么，也让最多人想要的先做。",
      en: "So everyone can see what's next, and the most wanted things come first.",
    },
    steps: [
      step("项目清单与投票", "Items and votes", true),
      step("分支时间线", "The branch timeline", true),
      step("开发计划自己的导航", "Its own navigation", true),
      step("更新纪录，补齐从第一天开始的历史", "A changelog with the history from day one", true),
      step("公开的建议箱，可以按赞", "A public idea box with likes", true),
      step("六种状态与项目详情", "Six statuses and item details", true),
      step("路线图改成功能区仪表板", "The roadmap as one card per area", true),
    ],
    links: [{ label: { zh: "建议箱", en: "Idea box" }, href: "/roadmap/ideas" }],
    notes: [
      {
        zh: "路线图：每个功能区一张卡，完成度、现在、接下来、已上线",
        en: "Roadmap: one card per area with progress, now, next and shipped",
      },
      {
        zh: "更新纪录从 bot 第一天开始，公开的建议箱可以按赞",
        en: "A changelog from the bot's first day, and a public idea box with likes",
      },
    ],
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "home",
    status: "shipped",
    area: "site",
    title: { zh: "新首页", en: "A new home page" },
    summary: {
      zh: "登录前是网站介绍（各功能附即时资料、最近更新、Discord bot）；登录后是自己的仪表板。",
      en: "Signed out, an introduction (each feature with live data, the latest updates, the Discord bot); signed in, your own dashboard.",
    },
    why: {
      zh: "原本的首页只有四张功能卡片，看不出网站在做什么，常用的人也要多点一层。",
      en: "The old home page was four feature cards: it didn't show what the site does, and regulars had to click through.",
    },
    steps: [
      step("登录前的介绍：功能卡片附即时资料", "The introduction: feature cards with live data", true),
      step(
        "TradeHub 行情：BTC、ETH、走势线、恐惧贪婪",
        "TradeHub market: BTC, ETH, a sparkline, Fear & Greed",
        true,
      ),
      step("最近更新与 Discord bot 邀请连结", "Latest updates and the bot invite link", true),
      step(
        "登录后的仪表板：观影数字、今天的推荐、开发计划",
        "The dashboard: statistics, today's picks, the roadmap",
        true,
      ),
    ],
    links: [{ label: { zh: "首页", en: "Home" }, href: "/" }],
    notes: [
      {
        zh: "登录前：功能卡片附即时行情、最近更新、Discord bot 邀请连结",
        en: "Signed out: feature cards with live market data, the latest updates, the bot invite",
      },
      {
        zh: "登录后：观影数字、今天的推荐、行情、开发计划",
        en: "Signed in: your statistics, today's picks, the market and the roadmap",
      },
    ],
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "rename-hubs",
    status: "shipped",
    area: "site",
    title: {
      zh: "CoinHub 改名 TradeHub、UIDHub 改名 UidHub",
      en: "CoinHub becomes TradeHub, UIDHub becomes UidHub",
    },
    summary: {
      zh: "网址改成 /tradehub，旧的 /coinhub 连结会自动转过去。",
      en: "The address is now /tradehub; old /coinhub links redirect.",
    },
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "picks-page",
    status: "shipped",
    area: "moviehub",
    title: { zh: "网站上的推荐纪录", en: "Picks on the website" },
    summary: {
      zh: "观影统计多了自己的导航；推荐页显示在 Discord 抽到的电影和动漫：今天的次数、今天的卡片、最近 30 天。",
      en: "Movie statistics gets its own navigation; the Picks page shows the films and anime drawn on Discord: picks left, today's cards, the last 30 days.",
    },
    steps: [
      step("观影统计的导航（不随顶栏收起）", "The statistics navigation (stays when the header hides)", true),
      step(
        "电影 / 动漫切换、今天的卡片与问号卡",
        "Film / anime tabs, today's cards and face-down cards",
        true,
      ),
      step("最近 30 天纪录", "The last 30 days", true),
      step("还没做的页面标「规划中」", "Pages not built yet tagged Planned", true),
    ],
    links: [{ label: { zh: "推荐页", en: "Picks page" }, href: "/moviehub/picks" }],
    notes: [
      {
        zh: "观影统计有了自己的导航，还没做的页面标「规划中」",
        en: "Movie statistics gets its own navigation; pages not built yet are tagged Planned",
      },
    ],
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "share-stats",
    status: "shipped",
    area: "moviehub",
    title: { zh: "分享自己的观影统计", en: "Share your statistics" },
    summary: {
      zh: "一键复制自己的公开统计连结，手机上直接叫出分享面板。",
      en: "Copy the public link to your statistics in one click, or open the share sheet on phones.",
    },
    why: {
      zh: "自己的页面网址 /moviehub 给别人只会看到他们自己的，要分享得用公开连结。",
      en: "Your own page's address shows each visitor their own statistics; sharing needs the public link.",
    },
    links: [{ label: { zh: "我的统计", en: "My stats" }, href: "/moviehub" }],
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "theme-reveal",
    status: "shipped",
    area: "site",
    title: { zh: "深浅色切换动画", en: "Theme switch animation" },
    summary: {
      zh: "切换深浅色时，新的颜色从按钮画圆扩散到整页；切回浅色时圆缩回按钮。",
      en: "Switching to dark spreads it from the button in a circle; going back to light shrinks the circle into the button.",
    },
    steps: [
      step("圆形扩散与图示转入", "The circle and the icon turning in", true),
      step("修正第二次起浅转深会闪一下", "Fix the flash from the second switch on", true),
    ],
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },

  // ── 暂缓 / 不做 ──────────────────────────────────────────────────────────────────────────────
  {
    id: "taste-match",
    status: "paused",
    area: "moviehub",
    title: { zh: "口味相似度与共同看过", en: "Taste match and watched together" },
    summary: {
      zh: "羁绊卡片显示两人的口味相似度；别人的统计页列出两人都看过的作品和双方评分。",
      en: "The bonds card shows how alike two people's tastes are; someone else's statistics list what you've both watched with both ratings.",
    },
    reason: {
      zh: "做出来试过后先撤下，等好友页一起重新设计。",
      en: "Built and tried, then taken down; to be redesigned together with the friends page.",
    },
    added: "2026-10-18",
    started: "2026-10-18",
  },
  {
    id: "theme-overlay",
    status: "declined",
    area: "site",
    title: { zh: "纯色圆形的主题切换", en: "A plain-color circle for the theme switch" },
    summary: {
      zh: "不用浏览器快照，叠一层新主题底色的圆扩散，扩满后才切主题。",
      en: "Without browser snapshots: a circle of the new background grows over the page, and the theme flips once it's full.",
    },
    reason: {
      zh: "不会闪，但圆里看不到深色的页面内容，效果差很多；改为修好快照的做法。",
      en: "No flashing, but the circle shows no page content inside, which looks much worse; the snapshot approach was fixed instead.",
    },
    added: "2026-10-19",
  },

  // ── 已上线（新的在前） ───────────────────────────────────────────────────────────────────────
  {
    id: "anime-recommend",
    status: "shipped",
    area: "bot",
    title: { zh: "动漫推荐 /anime recommend", en: "Anime picks: /anime recommend" },
    summary: {
      zh: "按你的追番记录推荐没看过的动漫，想看、看过了写回 Trakt。",
      en: "Anime you haven't watched, picked from your history; want and watched go back to Trakt.",
    },
    notes: [
      {
        zh: "五个推荐池：续作、猜你喜欢、跨界、新坑、新番",
        en: "Five pools: sequels, ones you'll like, crossovers, something new, airing",
      },
      {
        zh: "帐号设定可以决定推荐要不要包含本季新番",
        en: "An account setting decides whether airing anime are included",
      },
      {
        zh: "评分后整部作品的 Trakt 评分自动取各季平均",
        en: "After rating, the show's Trakt rating follows its seasons' average",
      },
      { zh: "排除已看过的分割季与看过的剧场版", en: "Split cours and films already watched are left out" },
    ],
    links: [{ label: { zh: "推荐页", en: "Picks page" }, href: "/moviehub/picks?kind=anime" }],
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "bonus-picks",
    status: "shipped",
    area: "bot",
    title: { zh: "推荐的奖励次数与 /owner", en: "Bonus picks and /owner" },
    summary: {
      zh: "电影和动漫推荐每人各有 100 次一次性的奖励次数，每天的次数用完后使用。",
      en: "Film and anime picks each come with 100 one-off bonus picks, used once the day's run out.",
    },
    notes: [
      {
        zh: "动漫每天 5 次、电影每天 3 次，用完后用奖励次数",
        en: "5 anime and 3 film picks a day, then bonus picks",
      },
      { zh: "站长指令 /owner bonus、/owner check", en: "Owner commands /owner bonus and /owner check" },
    ],
    added: "2026-10-19",
    started: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "anime-credit-cards",
    status: "shipped",
    area: "moviehub",
    title: { zh: "动漫制作人员卡", en: "Anime staff cards" },
    summary: {
      zh: "动画制作、监督、原作、音乐、总作画监督与声优，滑过显示简介和全部作品。",
      en: "Studios, directors, original creators, composers, chief animation directors and voice actors show a card with their profile and every work.",
    },
    notes: [
      {
        zh: "动画制作公司卡：标志、简介、全部作品与 Bangumi / MAL 分数",
        en: "Studio cards: logo, profile, every work with Bangumi / MAL scores",
      },
      {
        zh: "其他职务与声优也有人员卡，声优卡附角色图片",
        en: "Other roles and voice actors get cards too, with character pictures",
      },
      { zh: "头像滑过放大、点击开大图", en: "Photos zoom on hover and open large on click" },
    ],
    added: "2026-10-18",
    started: "2026-10-18",
    shipped: "2026-10-19",
  },
  {
    id: "movie-recommend",
    status: "shipped",
    area: "bot",
    title: { zh: "电影推荐 /movie recommend", en: "Film picks: /movie recommend" },
    summary: {
      zh: "按你的口味随机推荐一部没看过的电影，AI 写推荐理由；想看、看过了写回 Trakt。",
      en: "A random film you haven't seen, picked from your taste with an AI-written reason; want and watched go back to Trakt.",
    },
    notes: [
      {
        zh: "猜你喜欢、跨出一步、开新坑、补个评分四种",
        en: "Four kinds: you'll like, a step out, something new, rate it",
      },
      { zh: "「AI 怎么看」：问 AI 这部适不适合你", en: "Ask the AI whether a film suits you" },
      {
        zh: "评分可以修改或删除，评分会退还次数",
        en: "Ratings can be changed or removed; rating refunds the pick",
      },
    ],
    added: "2026-10-18",
    started: "2026-10-18",
    shipped: "2026-10-18",
  },
  {
    id: "bonds",
    status: "shipped",
    area: "moviehub",
    title: { zh: "羁绊与对比", en: "Bonds and comparison" },
    summary: {
      zh: "同一个 Discord 伺服器的人和你共同看过多少；点进对方的统计，风格雷达可以叠上自己的对比。",
      en: "How much you've watched in common with people on your Discord servers; on their statistics, the style radar can overlay yours.",
    },
    notes: [
      {
        zh: "羁绊卡片列出同伺服器的人与共同看过的数量",
        en: "The bonds card lists people on your servers and how much you share",
      },
      { zh: "任何人都能看别人的统计页", en: "Anyone can open someone else's statistics" },
      { zh: "风格雷达「对比」叠上自己的风格", en: "Compare overlays your style on the radar" },
    ],
    added: "2026-10-18",
    started: "2026-10-18",
    shipped: "2026-10-18",
  },
  {
    id: "share-preview",
    status: "shipped",
    area: "moviehub",
    title: { zh: "分享预览图与 /movie profile", en: "Share previews and /movie profile" },
    summary: {
      zh: "贴观影统计连结时显示名字、风格称号与雷达；Discord 里用 /movie profile 贴出某人的统计。",
      en: "A statistics link shows a preview with the name, style title and radar; /movie profile posts someone's statistics on Discord.",
    },
    added: "2026-10-18",
    started: "2026-10-18",
    shipped: "2026-10-18",
  },
  {
    id: "genre-ring",
    status: "shipped",
    area: "moviehub",
    title: { zh: "类型双环图", en: "The genre rings" },
    summary: {
      zh: "类型分布改成双环图：一环类型、一环你的评分段，指到哪一段就列出里面的片。",
      en: "Genres became two rings, genres and your rating bands; pointing at a part lists its films.",
    },
    notes: [
      {
        zh: "按信息量加权：常见类型分得少、稀有类型分得多",
        en: "Weighted by information: common genres count less, rare ones more",
      },
    ],
    added: "2026-10-18",
    started: "2026-10-18",
    shipped: "2026-10-18",
  },
  {
    id: "deploy",
    status: "shipped",
    area: "site",
    title: { zh: "自动部署与 dev 站", en: "Automatic deploys and a dev site" },
    summary: {
      zh: "网站、管理后台、bot 都搬到家里的伺服器（Proxmox + Coolify），推上去就自动部署；每个都有 dev 站先测。",
      en: "The site, admin and bots moved to a home server (Proxmox + Coolify) and deploy on push, each with a dev deployment to test first.",
    },
    notes: [
      { zh: "密钥统一放 Doppler", en: "Secrets live in Doppler" },
      { zh: "dev 站确认后才上线正式站", en: "Production only after the dev site is checked" },
      { zh: "启动时自动套用资料库迁移", en: "Database migrations apply on start" },
    ],
    added: "2026-10-16",
    started: "2026-10-16",
    shipped: "2026-10-17",
  },
  {
    id: "trakt-connect",
    status: "shipped",
    area: "moviehub",
    title: { zh: "用 Trakt 授权连接观影统计", en: "Connect statistics with Trakt sign-in" },
    summary: {
      zh: "观影档案改成用网站帐号建立、Trakt 授权连接，私密帐号也能统计；Discord 变成可选。",
      en: "Movie profiles are made from the site account and connected by signing in to Trakt, so private accounts work; Discord became optional.",
    },
    notes: [
      {
        zh: "/connect/discord：从 bot 过来的人一键登录或关联",
        en: "/connect/discord: one link to sign in or link from the bot",
      },
      {
        zh: "动漫列表显示 AniList 类型、改编来源与标签",
        en: "The anime list shows AniList genres, sources and tags",
      },
    ],
    added: "2026-10-17",
    started: "2026-10-17",
    shipped: "2026-10-17",
  },
  {
    id: "coinhub",
    status: "shipped",
    area: "coinhub",
    title: { zh: "TradeHub 看盘终端", en: "TradeHub trading terminal" },
    summary: {
      zh: "自己的 TradingView：K 线、画线工具、指标、警报、回放，以及恐惧贪婪、BTC.D、USDT.D、MSTR mNAV。",
      en: "My own TradingView: candles, drawing tools, indicators, alerts and replay, plus Fear & Greed, BTC.D, USDT.D and MSTR mNAV.",
    },
    notes: [
      {
        zh: "工作区（版面、画线、警报）跟着帐号同步",
        en: "The workspace (layout, drawings, alerts) syncs with the account",
      },
    ],
    links: [{ label: { zh: "TradeHub", en: "TradeHub" }, href: "/tradehub" }],
    added: "2026-10-16",
    started: "2026-10-16",
    shipped: "2026-10-16",
  },
  {
    id: "bilingual",
    status: "shipped",
    area: "site",
    title: { zh: "中英双语与 Discord 登录", en: "Chinese and English, and Discord sign-in" },
    summary: {
      zh: "整个网站有中文和英文，记住你选的语言；可以用 Discord 登录，或把 Discord 关联到帐号。",
      en: "The whole site in Chinese and English, remembering your choice; sign in with Discord, or link it to your account.",
    },
    added: "2026-10-16",
    started: "2026-10-16",
    shipped: "2026-10-16",
  },
  {
    id: "site-launch",
    status: "shipped",
    area: "site",
    title: { zh: "个人网站上线", en: "The website goes live" },
    summary: {
      zh: "yohaneowo.com 第一版：Google 登录，以及从 Trakt 观看记录做的观影统计。",
      en: "The first yohaneowo.com: Google sign-in and statistics from your Trakt history.",
    },
    added: "2026-10-13",
    started: "2026-10-13",
    shipped: "2026-10-13",
  },
  {
    id: "admin-ai",
    status: "shipped",
    area: "admin",
    title: { zh: "AI 调用管理", en: "AI usage tracking" },
    summary: {
      zh: "管理后台记录每次 AI 调用：调用日志、费用排行、模型价格、费用对账。",
      en: "The admin records every AI call: call log, cost ranking, model prices and cost reconciliation.",
    },
    added: "2026-10-12",
    started: "2026-10-12",
    shipped: "2026-10-12",
  },
  {
    id: "movie-daily",
    status: "shipped",
    area: "bot",
    title: { zh: "电影推荐私信 /movie", en: "Daily film DMs: /movie" },
    summary: {
      zh: "按你的 Trakt 观看记录推荐院线新片，每天私信给你。",
      en: "New releases picked from your Trakt history, sent to you every day.",
    },
    added: "2026-10-12",
    started: "2026-10-12",
    shipped: "2026-10-12",
  },
  {
    id: "admin-deps",
    status: "shipped",
    area: "admin",
    title: { zh: "项目依赖", en: "Project dependencies" },
    summary: {
      zh: "管理后台汇整每个项目的套件：依赖健康度与总览。",
      en: "The admin collects each project's packages: dependency health and an overview.",
    },
    added: "2026-10-10",
    started: "2026-10-10",
    shipped: "2026-10-10",
  },
  {
    id: "voice-hub",
    status: "shipped",
    area: "bot",
    title: { zh: "动态语音频道 /voice-hub", en: "Dynamic voice channels: /voice-hub" },
    summary: {
      zh: "进入指定频道就自动开一个自己的语音频道，没人时自动关掉；语音停留时间记到管理后台。",
      en: "Joining a hub channel opens a voice channel of your own that closes when empty; time spent in voice is recorded in the admin.",
    },
    added: "2026-10-08",
    started: "2026-10-08",
    shipped: "2026-10-08",
  },
  {
    id: "admin-bot",
    status: "shipped",
    area: "admin",
    title: { zh: "管理后台：Bot 管理与资产纪录", en: "Admin: bot management and asset history" },
    summary: {
      zh: "在开源后台模板上加了 Bot 管理（群组、解析日志、运行日志、语音纪录），首页显示总资产与资产纪录。",
      en: "On top of an admin template: bot management (servers, parse logs, run logs, voice records), and total assets with their history on the home page.",
    },
    added: "2026-10-08",
    started: "2026-10-08",
    shipped: "2026-10-08",
  },
  {
    id: "link-parse",
    status: "shipped",
    area: "bot",
    title: { zh: "链接解析下载与 LINE bot", en: "Link previews and downloads, and a LINE bot" },
    summary: {
      zh: "贴社群网站的连结，bot 自动把影片和图片抓下来贴回聊天；Discord 和 LINE 都能用。",
      en: "Paste a social link and the bot posts its video and pictures back into the chat, on Discord and LINE.",
    },
    notes: [
      {
        zh: "支援 TikTok、Instagram、Facebook、Threads、小红书、YouTube Shorts、X",
        en: "TikTok, Instagram, Facebook, Threads, Xiaohongshu, YouTube Shorts and X",
      },
      {
        zh: "/x 指令与「解析链接」右键选单（可以个人安装）",
        en: "The /x command and an Open link menu item (user-installable)",
      },
    ],
    added: "2026-10-07",
    started: "2026-10-07",
    shipped: "2026-10-07",
  },
  {
    id: "asset-report",
    status: "shipped",
    area: "bot",
    title: { zh: "加密资产报告", en: "Crypto asset reports" },
    summary: {
      zh: "汇总三个交易所的资产（含币本位总额），不定时私信报告；附恐惧贪婪指数与 MSTR mNAV。",
      en: "Assets across three exchanges (including the coin-denominated total), reported by DM now and then, with Fear & Greed and MSTR mNAV.",
    },
    notes: [{ zh: "每 15 分钟把资产快照存到管理后台", en: "Snapshots saved to the admin every 15 minutes" }],
    added: "2026-10-03",
    started: "2026-10-03",
    shipped: "2026-10-05",
  },
];

// Suggestions reviewed and not taken, with the reason shown in the idea box.
export const DECLINED_SUGGESTIONS: { id: string; reason: Text }[] = [];

export function roadmapItem(id: string) {
  return ROADMAP.find((item) => item.id === id);
}

export function progressOf(item: RoadmapItem) {
  if (!item.steps?.length) return null;
  return { done: item.steps.filter((s) => s.done).length, total: item.steps.length };
}

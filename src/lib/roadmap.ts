// 开发计划 (/roadmap): the items, kept in code and updated with every commit that moves one (see
// CLAUDE.md). Votes and suggestions live in the database (roadmap_vote, roadmap_suggestion),
// keyed by these ids, so an id never changes once published.
//
//   considering  考虑中: planned or being thought about
//   building     开发中: on the dev site (develop), not released yet
//   shipped      已上线: merged into main, with the release date

export type RoadmapStatus = "considering" | "building" | "shipped";
export type RoadmapArea = "moviehub" | "bot" | "coinhub" | "uidhub" | "site";

export type RoadmapItem = {
  id: string;
  status: RoadmapStatus;
  area: RoadmapArea;
  title: { zh: string; en: string };
  detail: { zh: string; en: string };
  // When it went on the roadmap, and (shipped) when it was released.
  added: string;
  shipped?: string;
  // Suggestions (roadmap_suggestion ids) this item came from: shown to their authors as accepted.
  suggestions?: string[];
};

export const ROADMAP_STATUSES: RoadmapStatus[] = ["considering", "building", "shipped"];
export const ROADMAP_AREAS: RoadmapArea[] = ["moviehub", "bot", "coinhub", "uidhub", "site"];

export const ROADMAP: RoadmapItem[] = [
  // 考虑中
  {
    id: "web-draw-picks",
    status: "considering",
    area: "moviehub",
    title: { zh: "在网站上抽推荐", en: "Draw picks on the website" },
    detail: {
      zh: "推荐页的问号卡可以直接点开抽一部，想看、看过了、评分也能在网站上按，跟 Discord 共用同一份次数。",
      en: "Flip a face-down card on the Picks page to draw one, and mark it wanted or watched with a rating there too, sharing the same daily picks as Discord.",
    },
    added: "2026-10-19",
  },
  {
    id: "show-picks",
    status: "considering",
    area: "bot",
    title: { zh: "剧集推荐", en: "Show picks" },
    detail: {
      zh: "像 /movie recommend 和 /anime recommend 一样，按你的观看记录推荐没看过的剧集。",
      en: "Like /movie recommend and /anime recommend: shows you haven't watched, picked from your history.",
    },
    added: "2026-10-19",
  },
  {
    id: "watch-calendar",
    status: "considering",
    area: "moviehub",
    title: { zh: "追番日历", en: "Watch calendar" },
    detail: {
      zh: "你在追的剧集和新番，这周哪天几点更新，下一集还要等多久。",
      en: "The shows and anime you follow: which day and time they air this week, and how long until the next episode.",
    },
    added: "2026-10-19",
  },
  {
    id: "leaderboard",
    status: "considering",
    area: "moviehub",
    title: { zh: "排行榜", en: "Leaderboard" },
    detail: {
      zh: "全站用户（只有愿意公开的人）的排名，例如本月看最多、评分最严格。",
      en: "Rankings across the site (only people who choose to be listed), such as most watched this month or toughest raters.",
    },
    added: "2026-10-19",
  },
  {
    id: "friends",
    status: "considering",
    area: "moviehub",
    title: { zh: "好友页", en: "Friends page" },
    detail: {
      zh: "同一个 Discord 伺服器里也有观影统计的人：口味有多像、一起看过什么、最近在看什么。",
      en: "People on your Discord servers who also have statistics: how alike your tastes are, what you've both watched, what they watch now.",
    },
    added: "2026-10-19",
  },
  {
    id: "year-in-review",
    status: "considering",
    area: "moviehub",
    title: { zh: "年度回顾", en: "Year in review" },
    detail: {
      zh: "一年看了什么：总数、时数、最爱的类型和导演、每个月的节奏，可以分享成一张图。",
      en: "Your year in film: totals, hours, favourite genre and director, the monthly rhythm, shareable as one image.",
    },
    added: "2026-10-19",
  },
  // 开发中
  {
    id: "roadmap",
    status: "building",
    area: "site",
    title: { zh: "开发计划与投票", en: "Roadmap and voting" },
    detail: {
      zh: "就是这一页：看接下来要做什么、替想要的功能投票、提出新建议。",
      en: "This page: what's coming, votes for the features you want, and new suggestions.",
    },
    added: "2026-10-19",
  },
  {
    id: "picks-page",
    status: "building",
    area: "moviehub",
    title: { zh: "网站上的推荐纪录", en: "Picks on the website" },
    detail: {
      zh: "观影统计多了自己的导航；推荐页显示在 Discord 抽到的电影和动漫：今天的次数、今天的卡片、最近 30 天。",
      en: "Movie statistics gets its own navigation; the Picks page shows the films and anime drawn on Discord: picks left, today's cards, the last 30 days.",
    },
    added: "2026-10-19",
  },
  {
    id: "share-stats",
    status: "building",
    area: "moviehub",
    title: { zh: "分享自己的观影统计", en: "Share your statistics" },
    detail: {
      zh: "一键复制自己的公开统计连结，手机上直接叫出分享面板。",
      en: "Copy the public link to your statistics in one click, or open the share sheet on phones.",
    },
    added: "2026-10-19",
  },
  {
    id: "theme-reveal",
    status: "building",
    area: "site",
    title: { zh: "深浅色切换动画", en: "Theme switch animation" },
    detail: {
      zh: "切换深浅色时，新的颜色从按钮画圆扩散到整页。",
      en: "Switching between light and dark spreads the new theme from the button in a circle.",
    },
    added: "2026-10-19",
  },
  // 已上线
  {
    id: "anime-recommend",
    status: "shipped",
    area: "bot",
    title: { zh: "动漫推荐 /anime recommend", en: "Anime picks: /anime recommend" },
    detail: {
      zh: "续作、猜你喜欢、跨界、新坑、新番五个池；想看、看过了写回 Trakt，整部作品的评分自动取各季平均。",
      en: "Five pools: sequels, ones you'll like, crossovers, something new and airing; want and watched go back to Trakt, and a show's rating follows its seasons' average.",
    },
    added: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "bonus-picks",
    status: "shipped",
    area: "bot",
    title: { zh: "推荐的奖励次数", en: "Bonus picks" },
    detail: {
      zh: "电影和动漫推荐每人各有 100 次一次性的奖励次数，每天的次数用完后使用。",
      en: "Film and anime picks each come with 100 one-off bonus picks, used once the day's run out.",
    },
    added: "2026-10-19",
    shipped: "2026-10-19",
  },
  {
    id: "anime-credit-cards",
    status: "shipped",
    area: "moviehub",
    title: { zh: "动漫制作人员卡", en: "Anime staff cards" },
    detail: {
      zh: "动画制作、监督、原作、音乐、总作画监督与声优，滑过显示简介和全部作品；声优卡附角色图片。",
      en: "Studios, directors, original creators, composers, chief animation directors and voice actors show a card with their profile and every work; voice actors' cards show their characters.",
    },
    added: "2026-10-18",
    shipped: "2026-10-19",
  },
  {
    id: "movie-recommend",
    status: "shipped",
    area: "bot",
    title: { zh: "电影推荐 /movie recommend", en: "Film picks: /movie recommend" },
    detail: {
      zh: "按你的口味随机推荐一部没看过的电影，AI 写推荐理由；想看、看过了写回 Trakt。",
      en: "A random film you haven't seen, picked from your taste with an AI-written reason; want and watched go back to Trakt.",
    },
    added: "2026-10-18",
    shipped: "2026-10-18",
  },
  {
    id: "bonds",
    status: "shipped",
    area: "moviehub",
    title: { zh: "羁绊与对比", en: "Bonds and comparison" },
    detail: {
      zh: "同一个 Discord 伺服器的人和你共同看过多少；点进对方的统计，风格雷达可以叠上自己的对比。",
      en: "How much you've watched in common with people on your Discord servers; on their statistics, the style radar can overlay yours.",
    },
    added: "2026-10-18",
    shipped: "2026-10-18",
  },
  {
    id: "share-preview",
    status: "shipped",
    area: "moviehub",
    title: { zh: "分享预览图与 /movie profile", en: "Share previews and /movie profile" },
    detail: {
      zh: "贴观影统计连结时显示名字、风格称号与雷达；Discord 里用 /movie profile 贴出某人的统计。",
      en: "A statistics link shows a preview with the name, style title and radar; /movie profile posts someone's statistics on Discord.",
    },
    added: "2026-10-18",
    shipped: "2026-10-18",
  },
];

// Suggestions reviewed and not taken, with the reason shown to their author.
export const DECLINED_SUGGESTIONS: { id: string; reason: { zh: string; en: string } }[] = [];

export function roadmapItem(id: string) {
  return ROADMAP.find((item) => item.id === id);
}

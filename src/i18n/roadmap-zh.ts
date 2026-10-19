// 开发计划 (/roadmap) texts (Chinese); roadmap-en.ts must have the same shape.
const roadmapZh = {
  title: "开发计划",
  description:
    "接下来要做什么、已经上线了什么。登录后可以替想要的功能投票（每个项目一票，再按一次收回），也可以提出新建议。",
  statuses: {
    considering: "考虑中",
    building: "开发中",
    shipped: "已上线",
  },
  statusHints: {
    considering: "还在规划，票数越多越先做",
    building: "正在 dev 站测试，确认后上线",
    shipped: "已经上线",
  },
  areas: {
    moviehub: "观影统计",
    bot: "Discord bot",
    coinhub: "CoinHub",
    uidhub: "UIDHub",
    site: "全站",
  },
  now: "现在",
  sort: { label: "考虑中的排序", votes: "票数", newest: "最新" },
  vote: "投票",
  voted: "已投票",
  votes: (n: number) => `${n} 票`,
  voteHint: "登录后才能投票",
  shippedOn: (date: string) => `${date} 上线`,
  empty: "目前没有项目。",
  voteFailed: "投票没有成功，请重试。",
  suggest: {
    title: "提出建议",
    description: "想要什么功能？写下来，下次更新开发计划时会看过；采纳的会出现在「考虑中」。",
    area: "属于哪个功能",
    name: "功能名称",
    namePlaceholder: "例如：观影统计可以按年份筛选",
    detail: "说明（选填）",
    detailPlaceholder: "想要它怎么运作、为什么需要",
    submit: "送出建议",
    sending: "送出中…",
    sent: "收到了，谢谢！",
    signIn: "登录后可以提出建议",
    errors: {
      badTitle: "功能名称要 2 到 60 个字。",
      badDetail: "说明最多 500 个字。",
      badArea: "请选择属于哪个功能。",
      tooMany: "你已经有 3 个建议在等审核，等下次更新后再提。",
      signIn: "请先登录。",
      failed: "送出失败，请重试。",
    },
  },
  mine: {
    title: "我的建议",
    pending: "等待审核",
    accepted: "已采纳",
    declined: "未采纳",
    seeItem: "看项目",
  },
  signIn: "登录",
};

export default roadmapZh;

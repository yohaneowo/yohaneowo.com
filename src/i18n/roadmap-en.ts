import type roadmapZh from "./roadmap-zh";

const roadmapEn: typeof roadmapZh = {
  title: "Roadmap",
  description:
    "What's coming and what has shipped. Signed in, you can vote for the features you want (one vote per item; press again to take it back) or suggest a new one.",
  statuses: {
    considering: "Considering",
    building: "In progress",
    shipped: "Shipped",
  },
  statusHints: {
    considering: "Still being planned; more votes, sooner",
    building: "Being tested on the dev site before release",
    shipped: "Live",
  },
  areas: {
    moviehub: "MovieHub",
    bot: "Discord bot",
    coinhub: "CoinHub",
    uidhub: "UIDHub",
    site: "Whole site",
  },
  sort: { label: "Sort", votes: "Votes", newest: "Newest" },
  vote: "Vote",
  voted: "Voted",
  votes: (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`,
  voteHint: "Sign in to vote",
  shippedOn: (date: string) => `Shipped ${date}`,
  empty: "Nothing here yet.",
  voteFailed: "Your vote didn't go through. Please try again.",
  suggest: {
    title: "Suggest a feature",
    description:
      "What would you like? Write it down; suggestions are read at the next roadmap update, and accepted ones appear under Considering.",
    area: "Which part",
    name: "Feature",
    namePlaceholder: "e.g. Filter movie statistics by year",
    detail: "Details (optional)",
    detailPlaceholder: "How it should work and why you'd want it",
    submit: "Send suggestion",
    sending: "Sending…",
    sent: "Got it, thank you!",
    signIn: "Sign in to suggest a feature",
    errors: {
      badTitle: "The feature name needs 2 to 60 characters.",
      badDetail: "Details can be at most 500 characters.",
      badArea: "Pick which part it belongs to.",
      tooMany: "You already have 3 suggestions waiting for review; try again after the next update.",
      signIn: "Please sign in first.",
      failed: "Couldn't send it. Please try again.",
    },
  },
  mine: {
    title: "My suggestions",
    pending: "Waiting for review",
    accepted: "Accepted",
    declined: "Not taken",
    seeItem: "See item",
  },
  signIn: "Sign in",
};

export default roadmapEn;

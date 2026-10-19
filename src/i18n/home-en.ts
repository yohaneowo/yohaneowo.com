import type homeZh from "./home-zh";

const homeEn: typeof homeZh = {
  signIn: "Sign in",
  invite: "Add the bot to Discord",
  roadmap: "Roadmap",
  features: "Features",
  planned: "Planned",
  voteForIt: "Vote for it",
  latest: "Latest updates",
  allUpdates: "All updates",
  testing: "Being tested",
  topVoted: "Most wanted",
  votes: (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`,
  movie: {
    points: [
      "A style radar, genre rings, and how your ratings differ from everyone's",
      "Films, shows and anime counted apart",
      "Draw picks on Discord; want and watched go back to Trakt",
    ],
  },
  market: {
    title: "Market",
    change24h: "24h",
    fearGreed: "Fear & Greed",
    unavailable: "Market data isn't available right now.",
  },
  bot: {
    title: "Discord bot",
    description:
      "The same features on Discord: film and anime picks, link previews, and voice channels of your own.",
    commands: [
      { name: "/movie recommend", text: "A film you haven't seen, picked from your taste" },
      { name: "/anime recommend", text: "An anime: sequels, airing, ones you'll like" },
      { name: "/movie profile", text: "Post someone's movie statistics" },
      { name: "/x · Open link", text: "Posts a social link's video and pictures back into the chat" },
      { name: "/voice-hub", text: "Join a hub to get a voice channel of your own" },
    ],
  },
  dashboard: {
    greeting: (name: string) => `Welcome back, ${name}`,
    subtitle: "Your statistics, today's picks, the market and the roadmap, in one place.",
    stats: "Movie statistics",
    films: "films",
    shows: "shows",
    anime: "anime",
    syncedAt: (date: string) => `Updated ${date}`,
    noProfile: "No movie profile yet. Connect Trakt and your statistics show up here.",
    createProfile: "Create a movie profile",
    open: "Open",
    picks: "Today's picks",
    filmPicks: "Films",
    animePicks: "Anime",
    left: (left: number, total: number) => `${left}/${total} left`,
    bonus: (n: number) => `${n} bonus`,
    drawOnDiscord: "Draw on Discord with /movie recommend or /anime recommend",
    myVotes: (n: number) => `You voted for ${n} ${n === 1 ? "item" : "items"}`,
    noVotes: "No votes yet; vote for the features you want.",
    linkDiscord: "Link Discord so the bot can find your movie profile.",
    linkAction: "Link Discord",
    unavailable: "Not available right now.",
  },
};

export default homeEn;

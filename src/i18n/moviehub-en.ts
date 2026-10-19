import type moviehubZh from "./moviehub-zh";

const moviehubEn: typeof moviehubZh = {
  nav: {
    label: "Movie statistics pages",
    stats: "My stats",
    picks: "Picks",
    calendar: "Calendar",
    leaderboard: "Leaderboard",
    friends: "Friends",
    wrapped: "Year in review",
  },
  planned: {
    badge: "Planned",
    title: "Not built yet",
    note: "This feature is still being planned; it will show up here once it's ready.",
    calendar:
      "The shows and anime you follow: which day and time they air this week, and how long until the next episode.",
    leaderboard:
      "Rankings across the site (only people who choose to be listed), such as most watched this month or toughest raters.",
    friends:
      "People on your Discord servers who also have statistics: how alike your tastes are, what you've both watched, what they watch now.",
    wrapped:
      "Your year in film: totals, hours, favourite genre and director, the monthly rhythm, shareable as one image.",
  },
  picks: {
    title: "Picks",
    description:
      "What /movie recommend and /anime recommend drew for you on Discord: picks left today, today's picks and the last 30 days.",
    kinds: { movie: "Films", show: "Shows", anime: "Anime" },
    kindsLabel: "Kind of picks",
    showPlanned:
      "Show picks aren't built yet. On Discord, /movie recommend draws a film and /anime recommend an anime.",
    left: (left: number, total: number) => `${left} / ${total} left today`,
    bonus: (count: number) => `plus ${count} bonus picks`,
    resets: "Resets at midnight Taipei time; bonus picks are used once the day's run out.",
    today: "Today's picks",
    history: "Last 30 days",
    noHistory: "No picks in the last 30 days.",
    draw: {
      movie: "Draw one on Discord with /movie recommend",
      anime: "Draw one on Discord with /anime recommend",
    },
    unopened: "Not drawn",
    bonusCard: "Bonus pick",
    linkDiscord: "Link Discord so the bot can find your movie profile and draw picks.",
    linkAction: "Link Discord",
    columns: { title: "Title", mode: "Pool", result: "Result", day: "Day" },
    status: {
      pending: "Undecided",
      skip: "Skipped",
      watchlist: "Want to watch",
      watched: (rating: number | null) => (rating == null ? "Watched" : `Watched · ${rating}`),
      watched_existing: (rating: number | null) =>
        rating == null ? "Seen before" : `Seen before · ${rating}`,
      rated: (rating: number | null) => (rating == null ? "Rated" : `Rated · ${rating}`),
    },
    modes: {
      movie: { comfort: "You'll like", bridge: "A step out", explore: "Something new", backfill: "Rate it" },
      anime: {
        sequel: "Sequel",
        comfort: "You'll like",
        bridge: "Crossover",
        explore: "Something new",
        airing: "Airing",
      },
    },
    signedOut: "Sign in to see the picks you drew on Discord.",
    signIn: "Sign in",
    noProfile: "No movie profile yet. Connect Trakt under My stats first, then draw picks on Discord.",
    toStats: "Go to My stats",
    unavailable: "Can't reach the recommendation service right now. Please try again later.",
    loading: "Loading picks…",
    open: "Open",
  },
};

export default moviehubEn;

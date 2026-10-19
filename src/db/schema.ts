import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Better Auth core tables (user / session / account / verification). Property names must match
// Better Auth's field names; the database columns are snake_case via `casing` in db/index.ts.

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);

// One row per linked login provider (Google or Discord).
export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.userId),
    uniqueIndex("account_provider_identity_unique").on(t.providerId, t.accountId),
    uniqueIndex("account_user_provider_unique").on(t.userId, t.providerId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.identifier)],
);

// Movie profile settings per site account. scoreSource is the public score shown next to the
// user's own ratings ("imdb" | "tmdb" | "metacritic"; see SCORE_SOURCES in lib/movie-types.ts).
export const moviePreference = pgTable("movie_preference", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  scoreSource: text().notNull().default("imdb"),
  ...timestamps,
});

// Discord servers each account is in (from the Discord OAuth `guilds` scope), for 羁绊: two
// accounts that share a server see each other's watch overlap on the movie page. Refreshed from
// Discord about once a day when the movie page is opened (lib/discord-guilds.ts).
export const discordGuild = pgTable(
  "discord_guild",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    guildId: text().notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.guildId] }), index("discord_guild_guild_idx").on(t.guildId)],
);

// 开发计划: one vote per account per roadmap item. The items live in code (lib/roadmap.ts),
// referenced here by id.
export const roadmapVote = pgTable(
  "roadmap_vote",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    itemId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] }), index("roadmap_vote_item_idx").on(t.itemId)],
);

// 开发计划 suggestions from signed-in accounts. Reviewed when the roadmap is updated: an item made
// from one lists its id (lib/roadmap.ts), a declined one is listed with the reason.
export const roadmapSuggestion = pgTable(
  "roadmap_suggestion",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    area: text().notNull(),
    title: text().notNull(),
    detail: text().notNull().default(""),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("roadmap_suggestion_user_idx").on(t.userId)],
);

// 开发计划 idea box: one like per account per suggestion (the suggestions are public, anonymous).
export const roadmapSuggestionLike = pgTable(
  "roadmap_suggestion_like",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    suggestionId: text()
      .notNull()
      .references(() => roadmapSuggestion.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.suggestionId] }),
    index("roadmap_suggestion_like_suggestion_idx").on(t.suggestionId),
  ],
);

// CoinHub workspace per site account: layout, charts, drawings, alerts and the paper account, as
// the browser stores them (lib/coinhub/sync.ts). Last write wins.
export const coinhubWorkspace = pgTable("coinhub_workspace", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb().notNull(),
  ...timestamps,
});

import { z } from "zod";

// Public score platforms a user can compare their ratings with. Rotten Tomatoes is shown but not
// selectable: its percentage counts positive reviews and is not an average score.
export const SCORE_SOURCES = ["imdb", "tmdb", "metacritic"] as const;
export type ScoreSource = (typeof SCORE_SOURCES)[number];
export const scoreSourceSchema = z.enum(SCORE_SOURCES);
// Anime also compare with Bangumi and MyAnimeList (the default follows the interface language).
export type ListSource = ScoreSource | "bangumi" | "mal";
export const ANIME_ROLES = ["director", "original", "studio", "music", "chiefAnimationDirector"] as const;
export type AnimeRole = (typeof ANIME_ROLES)[number];

const film = z.object({ id: z.number(), title: z.string(), rating: z.number() });
const profileFilm = z.object({
  id: z.number(),
  title: z.string(),
  year: z.number().nullable(),
  releaseDate: z.string().nullable(),
  director: z.string().nullable(),
  directorId: z.number().int().positive().nullable().optional(),
  // The director's own name (TMDB original_name), for the English interface.
  directorEn: z.string().nullable().optional().default(null),
  genre: z.string().nullable(),
  country: z.string().nullable(),
  publicScore: z.number().nullable(),
  voteCount: z.number().nullable(),
  // Fields added later stay optional so snapshots saved before them still parse.
  genres: z.array(z.string()).optional().default([]),
  imdbId: z.string().nullable().optional().default(null),
  imdbRating: z.number().nullable().optional().default(null),
  imdbVotes: z.number().nullable().optional().default(null),
  rottenTomatoes: z.number().nullable().optional().default(null),
  metacritic: z.number().nullable().optional().default(null),
  myRating: z.number().nullable(),
  // Trakt tags it "anime".
  anime: z.boolean().optional().default(false),
  // Plays (episode plays for a show); 0 when only rated. Null in snapshots from before it existed.
  plays: z.number().nullable().optional().default(null),
  originalTitle: z.string().nullable().optional().default(null),
  // For the English interface; null when TMDB has no English title.
  titleEn: z.string().nullable().optional().default(null),
  watchedAt: z.string(),
  poster: z.string().nullable(),
});
const genreRow = z.object({
  id: z.number(),
  name: z.string(),
  count: z.number(),
  ratedCount: z.number(),
  interest: z.number(),
  affinity: z.number().nullable(),
  average: z.number().nullable(),
});
const showSeason = z.object({
  number: z.number(),
  name: z.string().nullable(),
  episodes: z.number().nullable(),
  airDate: z.string().nullable(),
  publicScore: z.number().nullable(),
  myRating: z.number().nullable(),
  // Anime: the season's own Bangumi / AniList / MyAnimeList entry.
  titleZh: z.string().nullable().optional().default(null),
  titleEn: z.string().nullable().optional().default(null),
  bangumiId: z.number().nullable().optional().default(null),
  bangumiScore: z.number().nullable().optional().default(null),
  anilistId: z.number().nullable().optional().default(null),
  malId: z.number().nullable().optional().default(null),
  malScore: z.number().nullable().optional().default(null),
});
const animeStaff = z.object({
  role: z.enum(ANIME_ROLES),
  // AniList's ID; negative for people only Bangumi lists.
  id: z.number(),
  name: z.string(),
  nameEn: z.string().nullable(),
});
// A show row reuses the film fields: releaseDate is the first air date, director the creator.
const showItem = profileFilm.extend({
  episodesWatched: z.number().optional().default(0),
  episodesAired: z.number().nullable().optional().default(null),
  // Season ratings are separate from the show's own rating (myRating), as on Trakt.
  seasons: z.array(showSeason).optional().default([]),
  // Anime: the first season's Bangumi / MyAnimeList scores, and the staff across seasons.
  bangumiId: z.number().nullable().optional().default(null),
  bangumiScore: z.number().nullable().optional().default(null),
  bangumiVotes: z.number().nullable().optional().default(null),
  anilistId: z.number().nullable().optional().default(null),
  malId: z.number().nullable().optional().default(null),
  malScore: z.number().nullable().optional().default(null),
  malVotes: z.number().nullable().optional().default(null),
  staff: z.array(animeStaff).optional().default([]),
});
const showSection = z.object({
  watchedCount: z.number(),
  // Episode plays, rewatches included.
  episodes: z.number(),
  ratingCount: z.number(),
  mean: z.number().nullable(),
  distribution: z.array(z.number()).length(10),
  genres: z.array(genreRow),
  people: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      role: z.enum(["creator", "cast", ...ANIME_ROLES]),
      nameEn: z.string().nullable().optional().default(null),
      photo: z.string().nullable(),
      average: z.number(),
      count: z.number(),
      films: z.array(film),
    }),
  ),
  items: z.array(showItem),
});
export const movieResponseSchema = z.object({
  subscription: z
    .object({
      userId: z.string(),
      traktUser: z.string(),
      traktName: z.string(),
      region: z.string(),
      subscribedAt: z.string(),
      active: z.boolean(),
      revision: z.string(),
      syncedAt: z.string().nullable(),
      syncError: z.string().nullable(),
      syncRequested: z.boolean(),
      syncing: z.boolean(),
    })
    .nullable(),
  snapshot: z
    .object({
      version: z.literal(1),
      ratingCount: z.number(),
      watchedCount: z.number(),
      plays: z.number(),
      mean: z.number().nullable(),
      showRatingCount: z.number(),
      showMean: z.number().nullable(),
      distribution: z.array(z.number()).length(10),
      sampleCount: z.number(),
      sampleLimit: z.number(),
      films: z.array(profileFilm).optional().default([]),
      ratedIds: z.array(z.number()).optional().default([]),
      depth: z.number().nullable().optional().default(null),
      depthGroups: z.number().optional().default(0),
      shows: showSection.nullable().optional().default(null),
      // Anime series, kept apart from the other shows.
      anime: showSection.nullable().optional().default(null),
      genres: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          count: z.number(),
          ratedCount: z.number(),
          interest: z.number(),
          affinity: z.number().nullable(),
          average: z.number().nullable(),
        }),
      ),
      people: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          role: z.enum(["director", "cast"]),
          nameEn: z.string().nullable().optional().default(null),
          photo: z.string().nullable(),
          average: z.number(),
          count: z.number(),
          films: z.array(film),
        }),
      ),
    })
    .nullable(),
  platform: z
    .object({
      watchedPercentile: z.number().nullable(),
      users: z.number(),
      showsPercentile: z.number().nullable().optional().default(null),
      showUsers: z.number().optional().default(0),
      animePercentile: z.number().nullable().optional().default(null),
      animeUsers: z.number().optional().default(0),
    })
    .nullable()
    .optional()
    .default(null),
});
export type MovieResponse = z.infer<typeof movieResponseSchema>;

// The director card, as admin assembles it (TMDB person + directed films with public scores).
export const personCardSchema = z.object({
  id: z.number(),
  name: z.string(),
  photo: z.string().nullable(),
  biography: z.string().nullable(),
  films: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        year: z.number().nullable(),
        tmdbRating: z.number().nullable(),
        imdbRating: z.number().nullable(),
        rottenTomatoes: z.number().nullable(),
        metacritic: z.number().nullable(),
      }),
    )
    .nullable(),
});
export type PersonCard = z.infer<typeof personCardSchema>;
export type MovieSnapshot = NonNullable<MovieResponse["snapshot"]>;
export type ProfileFilm = MovieSnapshot["films"][number];
export type ShowSection = NonNullable<MovieSnapshot["shows"]>;
export type ShowItem = ShowSection["items"][number];

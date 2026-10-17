import type { Dictionary } from "@/i18n/dictionaries";
import type { ListSource, ProfileFilm } from "@/lib/movie-types";

// Radar order, clockwise from the top: 毒舌, 探索, 数量, 深度, 多样性 (names in style.axes).
export const AXES = ["bite", "fresh", "volume", "depth", "diversity"] as const;
export type Axis = (typeof AXES)[number];

// TMDB tags every anime with this genre, so on the anime tab it says nothing; the other genres do.
export const ANIMATION_GENRES = new Set(["动画", "動畫", "Animation"]);

// An anime item with "Animation" dropped from its genres (kept when it is the only one).
export function withoutAnimation<T extends { genre: string | null; genres: string[] }>(item: T): T {
  const genres = item.genres.filter((genre) => !ANIMATION_GENRES.has(genre));
  if (genres.length === 0) return item;
  return { ...item, genres, genre: ANIMATION_GENRES.has(item.genre ?? "") ? genres[0] : item.genre };
}

export const SCORE_LABELS: Record<ListSource, string> = {
  imdb: "IMDb",
  tmdb: "TMDB",
  metacritic: "Metacritic",
  bangumi: "Bangumi",
  mal: "MAL",
};

// A row of any list: anime series also carry Bangumi / MyAnimeList scores.
export type ScoredFilm = ProfileFilm & { bangumiScore?: number | null; malScore?: number | null };

// The chosen platform's score on the 10-point scale of the user's own ratings.
export function publicScore(film: ScoredFilm, source: ListSource) {
  if (source === "imdb") return film.imdbRating;
  if (source === "metacritic") return film.metacritic == null ? null : film.metacritic / 10;
  if (source === "bangumi") return film.bangumiScore ?? null;
  if (source === "mal") return film.malScore ?? null;
  return film.publicScore;
}

const GENRE_COLOR: Record<string, string> = {
  剧情: "#c9a76a",
  劇情: "#c9a76a",
  Drama: "#c9a76a",
  喜剧: "#e3c35a",
  喜劇: "#e3c35a",
  Comedy: "#e3c35a",
  科幻: "#6aa9d8",
  "Science Fiction": "#6aa9d8",
  动画: "#8fd0a8",
  動畫: "#8fd0a8",
  Animation: "#8fd0a8",
  悬疑: "#a99be0",
  懸疑: "#a99be0",
  Mystery: "#a99be0",
  惊悚: "#a99be0",
  驚悚: "#a99be0",
  Thriller: "#a99be0",
  纪录: "#d9d2c3",
  紀錄: "#d9d2c3",
  Documentary: "#d9d2c3",
  传记: "#d89a7a",
  傳記: "#d89a7a",
  爱情: "#e59ab5",
  愛情: "#e59ab5",
  Romance: "#e59ab5",
  动作: "#e2826a",
  動作: "#e2826a",
  Action: "#e2826a",
  恐怖: "#8b6999",
  Horror: "#8b6999",
  犯罪: "#7d8b99",
  Crime: "#7d8b99",
  冒险: "#6aa98a",
  冒險: "#6aa98a",
  Adventure: "#6aa98a",
};

export function genreColor(genre: string | null) {
  return (genre && GENRE_COLOR[genre]) || "#8b93a1";
}

export function daysAgo(watchedAt: string, today: string) {
  const watched = Date.parse(`${watchedAt}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.round((now - watched) / 86400000);
}

export function dateLabel(watchedAt: string, t: Dictionary["profile"]) {
  const [, month, day] = watchedAt.split("-");
  return t.date(Number(month), Number(day));
}

export function formatSigned(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}`;
}

export function scoreTone(diff: number) {
  if (diff > 0.25) return "up";
  if (diff < -0.25) return "down";
  return "eq";
}

function daysBetween(later: string, earlier: string) {
  return (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000;
}

// Films a genre counts for: every genre of the film, or the first one in older snapshots.
export function genresOf(film: ProfileFilm) {
  return film.genres.length ? film.genres : film.genre ? [film.genre] : [];
}

function compared(films: ScoredFilm[], source: ListSource) {
  return films.flatMap((film) => {
    const score = publicScore(film, source);
    return film.myRating != null && score != null ? [{ film, mine: film.myRating, score }] : [];
  });
}

export type StyleStats = {
  // 0–100; null: not measured yet (older snapshot, or no data for the axis).
  scores: (number | null)[];
  // One sentence per axis, with the user's own numbers.
  details: string[];
  title: string;
  top: [Axis, Axis];
};

export type StyleContext = {
  // Shows: 探索 counts from the first air date and 深度 is how much of each show was watched.
  kind: "movie" | "show";
  // What the 数量 sentence counts (电影, 剧, 动漫).
  noun: string;
  source: ListSource;
  // Genre names as shown (English names on the English page).
  genreLabel: (genre: string) => string;
  t: Dictionary["style"];
  // Share of each director (2+ seen) and series the user has started; from the whole history.
  depth: number | null;
  depthGroups: number;
  // Rank among the platform's users by films watched, 0–100.
  watchedPercentile: number | null;
  watchedCount: number;
  platformUsers: number;
};

// 毒舌, 探索 and 多样性 follow the window and filters; 深度 and 数量 always use the full history.
export function styleOf(films: ScoredFilm[], context: StyleContext): StyleStats | null {
  const count = films.length;
  if (count === 0) return null;
  // 毒舌: how far below the chosen platform the user rates on average; 2 points lower is 100.
  const pairs = compared(films, context.source);
  const bite = pairs.length
    ? pairs.reduce((sum, pair) => sum + pair.score - pair.mine, 0) / pairs.length
    : null;
  // 探索: share watched within a year of release (few people see many films in cinemas).
  const FRESH_DAYS = 365;
  const freshCount = films.filter(
    (film) =>
      film.releaseDate &&
      daysBetween(film.watchedAt, film.releaseDate) >= 0 &&
      daysBetween(film.watchedAt, film.releaseDate) <= FRESH_DAYS,
  ).length;
  const fresh = freshCount / count;
  // 多样性: normalized entropy of the genres seen.
  const genreCount = new Map<string, number>();
  for (const film of films) {
    for (const genre of genresOf(film)) genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
  }
  const assignments = [...genreCount.values()].reduce((sum, value) => sum + value, 0);
  let entropy = 0;
  for (const value of genreCount.values()) {
    const portion = value / assignments;
    entropy -= portion * Math.log(portion);
  }
  const diversity = genreCount.size > 1 ? entropy / Math.log(genreCount.size) : 0;

  const percent = (value: number | null) =>
    value == null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  const { t } = context;
  const label = SCORE_LABELS[context.source];
  const [topGenre, topGenreCount] = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  // Each axis's score and sentence, then laid out in AXES order.
  const axes: Record<Axis, { score: number | null; detail: string }> = {
    bite: {
      score: bite == null ? null : percent(bite / 2),
      detail:
        bite == null ? t.biteNone(label) : t.bite(pairs.length, label, bite >= 0, Math.abs(bite).toFixed(1)),
    },
    fresh: { score: percent(fresh), detail: t.fresh(count, freshCount, context.kind === "show") },
    diversity: {
      score: percent(diversity),
      detail: topGenre
        ? t.diversity(
            genreCount.size,
            context.genreLabel(topGenre),
            Math.round((topGenreCount / count) * 100),
          )
        : t.diversityNone,
    },
    depth: {
      score: percent(context.depth),
      detail:
        context.kind === "show"
          ? context.depth == null
            ? t.showDepthNone
            : t.showDepth(context.depthGroups, Math.round(context.depth * 100))
          : context.depth == null
            ? t.movieDepthNone
            : t.movieDepth(context.depthGroups, Math.round(context.depth * 100)),
    },
    volume: {
      score: context.watchedPercentile == null ? null : Math.round(context.watchedPercentile),
      detail:
        context.watchedPercentile == null
          ? t.volumeNone
          : t.volume(
              context.watchedCount,
              context.noun,
              Math.round(context.watchedPercentile),
              context.platformUsers,
            ),
    },
  };
  const scores = AXES.map((axis) => axes[axis].score);
  const details = AXES.map((axis) => axes[axis].detail);
  const ranked = scores
    .map((score, index) => ({ axis: AXES[index], score: score ?? -1 }))
    .sort((a, b) => b.score - a.score);
  const top: [Axis, Axis] = [ranked[0].axis, ranked[1].axis];
  if (ranked[0].score <= 0 && ranked[1].score <= 0) return { scores, details, title: t.balanced, top };
  const title = t.titles[top.join("+")] ?? t.titles[[...top].reverse().join("+")] ?? t.balanced;
  return { scores, details, title, top };
}

export type GenreRadarAxis = { genre: string; value: number; count: number; percent: number };

// The most-watched genres in the window. The largest reaches the edge so the shape stays readable;
// percent is the real share of films. Fewer than three genres cannot form a radar.
export function genreRadar(films: ScoredFilm[], limit = 6): GenreRadarAxis[] | null {
  const genreCount = new Map<string, number>();
  for (const film of films) {
    for (const genre of genresOf(film)) genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
  }
  const top = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length < 3) return null;
  const max = top[0][1];
  return top.map(([genre, count]) => ({
    genre,
    value: Math.round((count / max) * 100),
    count,
    percent: Math.round((count / films.length) * 100),
  }));
}

export function ratingOf(films: ScoredFilm[], source: ListSource) {
  const rated = films.filter((film) => film.myRating != null);
  const pairs = compared(films, source);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    ratedCount: rated.length,
    mine: rated.length ? mean(rated.map((film) => film.myRating!)) : null,
    publicMean: pairs.length ? mean(pairs.map((pair) => pair.score)) : null,
    bite: pairs.length ? mean(pairs.map((pair) => pair.score - pair.mine)) : null,
    diffs: [...pairs].reverse().map((pair) => pair.mine - pair.score),
    counts: Array.from({ length: 10 }, (_, index) => {
      const score = 10 - index;
      return { score, count: rated.filter((film) => Math.round(film.myRating!) === score).length };
    }),
  };
}

export function abovePublic(films: ScoredFilm[], source: ListSource) {
  const pairs = compared(films, source);
  const up = pairs.filter((pair) => pair.mine > pair.score).length;
  return {
    up,
    total: pairs.length,
    percent: pairs.length ? Math.round((up / pairs.length) * 100) : 0,
  };
}

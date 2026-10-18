import { genreName } from "@/i18n/genres";
import type { ProfileFilm } from "@/lib/movie-types";

// How much of a film each of its genres "is", for the genre ring. A film's weight is split over
// its genres by information: common genres (Drama is on a third of popular films) carry little,
// rare ones carry a lot, so "剧情" stops swallowing every film while a film still counts as one.
//
//   info(g) = 1 / share(g), capped at CAP × the most common genre's info
//   w(film, g) = info(g) / Σ info(t) over the film's genres
//
// Shares are base rates among popular titles, sampled once (2026-10-18) with Laplace smoothing:
// movies TMDB discover by popularity, ≥ 200 votes, 3000 films; shows the same, 2591 shows;
// anime AniList by popularity, 1000 titles. Keyed by TMDB's / AniList's English names.
export type GenreMedia = "movie" | "show" | "anime";

const CAP = 8;

const SHARE: Record<GenreMedia, Record<string, number>> = {
  movie: {
    Drama: 0.3604,
    Comedy: 0.3167,
    Action: 0.3137,
    Thriller: 0.2829,
    Adventure: 0.257,
    Family: 0.1626,
    Crime: 0.161,
    Fantasy: 0.1567,
    "Science Fiction": 0.1514,
    Romance: 0.1391,
    Horror: 0.1312,
    Animation: 0.1289,
    Mystery: 0.0861,
    History: 0.047,
    War: 0.0301,
    Music: 0.0192,
    Western: 0.0132,
    "TV Movie": 0.0036,
    Documentary: 0.0033,
  },
  show: {
    Drama: 0.6199,
    "Sci-Fi & Fantasy": 0.3556,
    Comedy: 0.3517,
    "Action & Adventure": 0.2961,
    Animation: 0.2616,
    Mystery: 0.1834,
    Crime: 0.1822,
    Family: 0.0898,
    Kids: 0.0664,
    Soap: 0.0303,
    Documentary: 0.028,
    "War & Politics": 0.0222,
    Reality: 0.0123,
    Western: 0.01,
    Talk: 0.0042,
    News: 0.0027,
  },
  anime: {
    Action: 0.4872,
    Comedy: 0.4656,
    Drama: 0.4067,
    Fantasy: 0.3684,
    Romance: 0.3546,
    Adventure: 0.2829,
    Supernatural: 0.2711,
    "Slice of Life": 0.2603,
    "Sci-Fi": 0.164,
    Mystery: 0.1611,
    Psychological: 0.1493,
    Ecchi: 0.1228,
    Thriller: 0.0658,
    Horror: 0.053,
    Sports: 0.0363,
    Mecha: 0.0305,
    Music: 0.0236,
    "Mahou Shoujo": 0.0059,
  },
};

const MOST_COMMON = Object.fromEntries(
  (Object.keys(SHARE) as GenreMedia[]).map((media) => [media, Math.max(...Object.values(SHARE[media]))]),
) as Record<GenreMedia, number>;

// Site genre names are TMDB's Chinese names (movies, shows) or AniList's English names (anime).
function share(media: GenreMedia, genre: string): number {
  const key = media === "anime" ? genre : genreName(genre, "en");
  const found = SHARE[media][key];
  // A genre missing from the corpus is rare by definition: the cap applies.
  return found ?? MOST_COMMON[media] / CAP;
}

export function genreInfo(media: GenreMedia, genre: string): number {
  const floor = MOST_COMMON[media];
  return Math.min(1 / share(media, genre), CAP / floor);
}

// {genre: weight} for one film; the weights add up to 1 (an empty map for a film with no genres).
export function genreWeights(
  media: GenreMedia,
  film: Pick<ProfileFilm, "genre" | "genres">,
): Map<string, number> {
  const genres = film.genres.length ? film.genres : film.genre ? [film.genre] : [];
  const info = genres.map((genre) => genreInfo(media, genre));
  const total = info.reduce((sum, value) => sum + value, 0);
  return new Map(genres.map((genre, index) => [genre, total ? info[index] / total : 0]));
}

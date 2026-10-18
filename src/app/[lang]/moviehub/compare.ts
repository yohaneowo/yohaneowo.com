import type { MovieResponse, MovieSnapshot, ProfileFilm, ShowItem } from "@/lib/movie-types";

// The comparison radar redraws the viewer's own style next to the profile being viewed, under
// the same tab, window, filters and score platform, so it needs the viewer's titles too. Only
// what the style axes read is kept: no titles, posters, people or seasons.
export type CompareMedia = "movie" | "show" | "anime";

export type StyleProfile = {
  name: string;
  films: ProfileFilm[];
  shows: ShowItem[] | null;
  anime: ShowItem[] | null;
  depth: number | null;
  depthGroups: number;
  watched: Record<CompareMedia, number>;
  percentile: Record<CompareMedia, number | null>;
  users: Record<CompareMedia, number>;
};

function slim<T extends ProfileFilm>(item: T): T {
  return {
    ...item,
    title: "",
    originalTitle: null,
    titleEn: null,
    poster: null,
    director: null,
    directorEn: null,
    directorId: null,
    country: null,
    tags: [],
    ...("seasons" in item ? { seasons: [], staff: [] } : {}),
  };
}

export function styleProfile(
  name: string,
  snapshot: MovieSnapshot,
  platform: MovieResponse["platform"],
): StyleProfile {
  return {
    name,
    films: snapshot.films.map(slim),
    shows: snapshot.shows ? snapshot.shows.items.map(slim) : null,
    anime: snapshot.anime ? snapshot.anime.items.map(slim) : null,
    depth: snapshot.depth,
    depthGroups: snapshot.depthGroups,
    watched: {
      movie: snapshot.watchedCount,
      show: snapshot.shows?.watchedCount ?? 0,
      anime: snapshot.anime?.watchedCount ?? 0,
    },
    percentile: {
      movie: platform?.watchedPercentile ?? null,
      show: platform?.showsPercentile ?? null,
      anime: platform?.animePercentile ?? null,
    },
    users: {
      movie: platform?.users ?? 0,
      show: platform?.showUsers ?? 0,
      anime: platform?.animeUsers ?? 0,
    },
  };
}

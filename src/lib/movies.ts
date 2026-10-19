import { z } from "zod";
import "server-only";
import {
  creditInfoSchema,
  creditWorksSchema,
  movieResponseSchema,
  personCardSchema,
  type CreditKind,
} from "./movie-types";

// code names the message in the dictionary (movies.errors).
export type MoviesErrorCode =
  | "notConnected"
  | "tooSoon"
  | "unreachable"
  | "badData"
  | "person"
  | "noProfile"
  | "traktTaken"
  | "traktDenied";
export class MoviesUnavailable extends Error {
  constructor(public code: MoviesErrorCode) {
    super(code);
  }
}

// admin answers 409 / 422 with one of these as its message when a Trakt account can't be connected.
const TRAKT_CODES = new Set<MoviesErrorCode>(["traktTaken", "traktDenied"]);

function endpoint() {
  const base = process.env.ADMIN_API_URL;
  const token = process.env.ADMIN_MOVIES_TOKEN;
  if (!base || !token) throw new MoviesUnavailable("notConnected");
  return { base: `${base.replace(/\/+$/, "")}/api/v1/bot/website/movies`, token };
}

// One call to admin's website movie API; errors become MoviesUnavailable codes.
async function call(path: string, init: { method?: string; body?: unknown; timeout?: number } = {}) {
  const { base, token } = endpoint();
  let response: Response;
  try {
    response = await fetch(base + path, {
      method: init.method ?? "GET",
      headers: { "X-Movies-Token": token, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeout ?? 10000),
    });
  } catch {
    throw new MoviesUnavailable("unreachable");
  }
  if (response.status === 429) throw new MoviesUnavailable("tooSoon");
  if (response.status === 404) throw new MoviesUnavailable("noProfile");
  const result = await response.json().catch(() => null);
  if ((response.status === 422 || response.status === 409) && TRAKT_CODES.has(result?.msg))
    throw new MoviesUnavailable(result.msg);
  if (!response.ok) throw new MoviesUnavailable("unreachable");
  if (!result?.success) throw new MoviesUnavailable("badData");
  return result.data;
}

// The account's profile and statistics. discordId is the account's linked Discord user, so a
// profile the bot created earlier is picked up and the bot can find one created on the site.
export async function getMovieStatistics(userId: string, discordId: string | null) {
  const query = discordId ? `?discordId=${encodeURIComponent(discordId)}` : "";
  return movieResponseSchema.parse(await call(`/users/${encodeURIComponent(userId)}${query}`));
}

// Someone else's statistics (or the viewer's own, for the comparison radar): read-only, so a
// visit never claims or merges profiles the way the owner's own page does.
export async function viewMovieStatistics(userId: string, discordId: string | null) {
  const query = discordId ? `?discordId=${encodeURIComponent(discordId)}` : "";
  return movieResponseSchema.parse(await call(`/users/${encodeURIComponent(userId)}/view${query}`));
}

// /anime recommend's settings on the movie profile: null when the account has no profile yet.
const animeSettingsSchema = z.object({ airing: z.boolean() });

export async function getAnimeSettings(userId: string) {
  try {
    return animeSettingsSchema.parse(await call(`/users/${encodeURIComponent(userId)}/anime-settings`));
  } catch (error) {
    if (error instanceof MoviesUnavailable && error.code === "noProfile") return null;
    throw error;
  }
}

export async function setAnimeSettings(userId: string, settings: { airing: boolean }) {
  return animeSettingsSchema.parse(
    await call(`/users/${encodeURIComponent(userId)}/anime-settings`, { method: "PUT", body: settings }),
  );
}

// The 推荐 page: one kind of the Discord recommendations (read-only).
const pickSchema = z.object({
  pickId: z.string(),
  day: z.string(),
  shownAt: z.string().nullable(),
  mode: z.string(),
  reason: z.string(),
  action: z.string().nullable(),
  rating: z.number().nullable(),
  usesBonus: z.boolean(),
  title: z.string(),
  originalTitle: z.string().nullable(),
  year: z.number().nullable(),
  poster: z.string().nullable(),
  people: z.array(z.string()),
  genres: z.array(z.string()),
  url: z.string(),
});
const picksSchema = z.object({
  kind: z.enum(["movie", "anime"]),
  today: z.string(),
  quota: z.number(),
  remainingToday: z.number(),
  bonus: z.number(),
  discordLinked: z.boolean(),
  todayPicks: z.array(pickSchema),
  recent: z.array(pickSchema),
});
export type PickItem = z.infer<typeof pickSchema>;
export type PicksView = z.infer<typeof picksSchema>;

// null when the account has no movie profile yet.
export async function getPicks(userId: string, kind: "movie" | "anime") {
  try {
    return picksSchema.parse(await call(`/users/${encodeURIComponent(userId)}/picks?kind=${kind}`));
  } catch (error) {
    if (error instanceof MoviesUnavailable && error.code === "noProfile") return null;
    throw error;
  }
}

export async function refreshMovieStatistics(userId: string) {
  await call(`/users/${encodeURIComponent(userId)}/refresh`, { method: "POST" });
}

// 羁绊: what this account has watched in common with each of these Discord users' profiles.
export const bondOverlapSchema = z.object({
  common: z.number(),
  mine: z.number(),
  theirs: z.number().optional(),
  share: z.number().optional(),
});
export const bondSchema = z.object({
  discordId: z.string(),
  traktUser: z.string(),
  traktName: z.string(),
  movies: bondOverlapSchema,
  shows: bondOverlapSchema,
  animeSeasons: bondOverlapSchema,
  total: z.object({ common: z.number(), mine: z.number(), share: z.number() }),
});
export type Bond = z.infer<typeof bondSchema>;

export async function getMovieBonds(userId: string, discordIds: string[]): Promise<Bond[]> {
  if (discordIds.length === 0) return [];
  const data = (await call(`/users/${encodeURIComponent(userId)}/bonds`, {
    method: "POST",
    body: { discordIds: discordIds.slice(0, 200) },
    timeout: 20000,
  })) as { bonds: unknown };
  return z.array(bondSchema).parse(data.bonds);
}

// Where to send the browser so the person can authorize this app on their Trakt account.
export async function getTraktAuthorizeUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string,
): Promise<string> {
  const params = new URLSearchParams({ redirectUri, state, codeChallenge });
  const data = (await call(`/trakt/authorize?${params}`)) as { url: string };
  return data.url;
}

// Trakt sent the browser back with a code: admin exchanges it and makes that Trakt account the
// account's profile (a lookup on Trakt, so allow more time).
export async function connectTrakt(
  userId: string,
  input: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
    region: string;
    discordId: string | null;
  },
) {
  const data = await call(`/users/${encodeURIComponent(userId)}/trakt`, {
    method: "POST",
    body: { ...input, discordId: input.discordId ?? undefined },
    timeout: 30000,
  });
  return movieResponseSchema.parse(data).subscription;
}

// An anime credit card: a studio or staff member by AniList and/or Bangumi ID, a voice actor by
// TMDB ID and name. Its head, or its works as known right now (admin never waits on its sources
// for these). Null when nothing is known.
export type CreditQuery = {
  kind: CreditKind;
  anilistId: number | null;
  bangumiId: number | null;
  tmdbId: number | null;
  name: string | null;
};

export async function getCreditPart(part: "info" | "works", query: CreditQuery, lang: "zh" | "en") {
  const params = new URLSearchParams({ kind: query.kind, lang });
  if (query.anilistId) params.set("anilistId", String(query.anilistId));
  if (query.bangumiId) params.set("bangumiId", String(query.bangumiId));
  if (query.tmdbId) params.set("tmdbId", String(query.tmdbId));
  if (query.name) params.set("name", query.name);
  try {
    // A voice actor's first look also finds them on AniList and Bangumi.
    const data = await call(`/credits/${part}?${params}`, { timeout: 30000 });
    return part === "info" ? creditInfoSchema.parse(data) : creditWorksSchema.parse(data);
  } catch (error) {
    if (error instanceof MoviesUnavailable && error.code === "noProfile") return null;
    throw error;
  }
}

// The director card from admin, in the given language; null when TMDB has no such person.
export async function getPersonCard(query: { id?: number; name?: string }, lang: "zh" | "en") {
  const { base, token } = endpoint();
  const params = new URLSearchParams(query.id ? { id: String(query.id) } : { name: query.name ?? "" });
  params.set("lang", lang);
  let response: Response;
  try {
    response = await fetch(`${base}/people/lookup?${params}`, {
      headers: { "X-Movies-Token": token },
      cache: "no-store",
      // A first look at a director fetches their filmography and scores.
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new MoviesUnavailable("unreachable");
  }
  if (response.status === 404) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new MoviesUnavailable("person");
  return personCardSchema.parse(result.data);
}

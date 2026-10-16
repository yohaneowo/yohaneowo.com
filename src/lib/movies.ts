import "server-only";
import { movieResponseSchema, personCardSchema } from "./movie-types";

// code names the message in the dictionary (movies.errors).
export type MoviesErrorCode = "notConnected" | "tooSoon" | "unreachable" | "badData" | "person";
export class MoviesUnavailable extends Error {
  constructor(public code: MoviesErrorCode) {
    super(code);
  }
}

async function request(discordId: string, refresh = false) {
  const base = process.env.ADMIN_API_URL;
  const token = process.env.ADMIN_MOVIES_TOKEN;
  if (!base || !token) throw new MoviesUnavailable("notConnected");
  const url = `${base.replace(/\/+$/, "")}/api/v1/bot/website/movies/${encodeURIComponent(discordId)}${refresh ? "/refresh" : ""}`;
  try {
    const response = await fetch(url, {
      method: refresh ? "POST" : "GET",
      headers: { "X-Movies-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) throw new MoviesUnavailable("tooSoon");
    if (!response.ok) throw new MoviesUnavailable("unreachable");
    const result = await response.json();
    if (!result.success) throw new MoviesUnavailable("badData");
    return result.data;
  } catch (error) {
    if (error instanceof MoviesUnavailable) throw error;
    throw new MoviesUnavailable("unreachable");
  }
}
export async function getMovieStatistics(discordId: string) {
  return movieResponseSchema.parse(await request(discordId));
}
export async function refreshMovieStatistics(discordId: string) {
  await request(discordId, true);
}

// The director card from admin, in the given language; null when TMDB has no such person.
export async function getPersonCard(query: { id?: number; name?: string }, lang: "zh" | "en") {
  const base = process.env.ADMIN_API_URL;
  const token = process.env.ADMIN_MOVIES_TOKEN;
  if (!base || !token) throw new MoviesUnavailable("notConnected");
  const params = new URLSearchParams(query.id ? { id: String(query.id) } : { name: query.name ?? "" });
  params.set("lang", lang);
  const url = `${base.replace(/\/+$/, "")}/api/v1/bot/website/movies/people/lookup?${params}`;
  let response: Response;
  try {
    response = await fetch(url, {
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

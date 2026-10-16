import "server-only";
import { movieResponseSchema, personCardSchema } from "./movie-types";

// code names the message in the dictionary (movies.errors).
export type MoviesErrorCode =
  | "notConnected"
  | "tooSoon"
  | "unreachable"
  | "badData"
  | "person"
  | "noProfile"
  | "traktInvalid"
  | "traktNotFound"
  | "traktPrivate";
export class MoviesUnavailable extends Error {
  constructor(public code: MoviesErrorCode) {
    super(code);
  }
}

// admin answers 422 with one of these as its message when the Trakt details can't be used.
const TRAKT_CODES = new Set<MoviesErrorCode>(["traktInvalid", "traktNotFound", "traktPrivate"]);

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
  if (response.status === 422 && TRAKT_CODES.has(result?.msg)) throw new MoviesUnavailable(result.msg);
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

export async function refreshMovieStatistics(userId: string) {
  await call(`/users/${encodeURIComponent(userId)}/refresh`, { method: "POST" });
}

// Creates the profile, or points it at another Trakt account / region. admin checks the Trakt
// account exists and is public (a lookup, so allow more time).
export async function saveMovieProfile(
  userId: string,
  input: { trakt: string; region: string; discordId: string | null },
) {
  const data = await call(`/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: { trakt: input.trakt, region: input.region, discordId: input.discordId ?? undefined },
    timeout: 30000,
  });
  return movieResponseSchema.parse(data).subscription;
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

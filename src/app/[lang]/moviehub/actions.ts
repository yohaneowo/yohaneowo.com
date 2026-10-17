"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { setScoreSource } from "@/lib/movie-preference";
import { scoreSourceSchema } from "@/lib/movie-types";
import {
  getTraktAuthorizeUrl,
  MoviesUnavailable,
  refreshMovieStatistics,
  type MoviesErrorCode,
} from "@/lib/movies";
import { isRegionCode } from "@/lib/regions";
import { createTraktState, TRAKT_STATE_COOKIE } from "@/lib/trakt-state";

// error: a key of the dictionary's movies.errors (the caller shows it in its language).
type ActionError = MoviesErrorCode | "signIn" | "badRegion" | "refreshFailed" | "badSource" | "saveFailed";

export async function requestStatisticsRefresh(): Promise<{ error: ActionError | null }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  try {
    await refreshMovieStatistics(session.user.id);
    revalidatePath("/[lang]/moviehub", "page");
    return { error: null };
  } catch (error) {
    return { error: error instanceof MoviesUnavailable ? error.code : "refreshFailed" };
  }
}

// The setup form: remembers the region, then hands back Trakt's authorization page. The state
// is signed and bound to this account; its nonce also sits in a short-lived cookie.
export async function startTraktConnect(input: {
  region: unknown;
  lang: unknown;
}): Promise<{ url: string } | { error: ActionError }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  const region = typeof input.region === "string" ? input.region.trim().toUpperCase() : "";
  if (!isRegionCode(region)) return { error: "badRegion" };
  const lang = input.lang === "en" ? "en" : "zh";
  const origin = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");
  if (!origin) return { error: "notConnected" };
  try {
    const { state, token } = createTraktState({ userId: session.user.id, region, lang });
    const url = await getTraktAuthorizeUrl(`${origin}/api/trakt/callback`, token);
    (await cookies()).set(TRAKT_STATE_COOKIE, state.nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/",
      maxAge: 600,
    });
    return { url };
  } catch (error) {
    return { error: error instanceof MoviesUnavailable ? error.code : "saveFailed" };
  }
}

export async function saveScoreSource(value: unknown): Promise<{ error: ActionError | null }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  const parsed = scoreSourceSchema.safeParse(value);
  if (!parsed.success) return { error: "badSource" };
  try {
    await setScoreSource(session.user.id, parsed.data);
    return { error: null };
  } catch {
    return { error: "saveFailed" };
  }
}

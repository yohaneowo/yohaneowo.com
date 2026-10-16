"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { setScoreSource } from "@/lib/movie-preference";
import { scoreSourceSchema } from "@/lib/movie-types";
import {
  MoviesUnavailable,
  refreshMovieStatistics,
  saveMovieProfile,
  type MoviesErrorCode,
} from "@/lib/movies";
import { isRegionCode } from "@/lib/regions";

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

// The setup form: the account's Trakt profile and region. The linked Discord account (if any)
// goes along so the bot can find the profile.
export async function createMovieProfile(input: {
  trakt: unknown;
  region: unknown;
}): Promise<{ error: ActionError | null }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  const trakt = typeof input.trakt === "string" ? input.trakt.trim() : "";
  const region = typeof input.region === "string" ? input.region.trim().toUpperCase() : "";
  if (!trakt || trakt.length > 300) return { error: "traktInvalid" };
  if (!isRegionCode(region)) return { error: "badRegion" };
  try {
    const linked = await getDiscordAccount(session.user.id);
    await saveMovieProfile(session.user.id, { trakt, region, discordId: linked?.accountId ?? null });
    revalidatePath("/[lang]/moviehub", "page");
    return { error: null };
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

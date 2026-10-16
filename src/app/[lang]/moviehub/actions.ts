"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { setScoreSource } from "@/lib/movie-preference";
import { scoreSourceSchema } from "@/lib/movie-types";
import { MoviesUnavailable, refreshMovieStatistics, type MoviesErrorCode } from "@/lib/movies";

// error: a key of the dictionary's movies.errors (the caller shows it in its language).
type ActionError = MoviesErrorCode | "signIn" | "linkDiscord" | "refreshFailed" | "badSource" | "saveFailed";

export async function requestStatisticsRefresh(): Promise<{ error: ActionError | null }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  const linked = await getDiscordAccount(session.user.id);
  if (!linked) return { error: "linkDiscord" };
  try {
    await refreshMovieStatistics(linked.accountId);
    revalidatePath("/[lang]/moviehub", "page");
    return { error: null };
  } catch (error) {
    return { error: error instanceof MoviesUnavailable ? error.code : "refreshFailed" };
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

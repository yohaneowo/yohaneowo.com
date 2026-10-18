"use server";
import { getSession } from "@/lib/auth";
import { setAnimeSettings } from "@/lib/movies";

// The account settings' /anime recommend switch (saved on the movie profile in admin).
export async function saveAnimeAiring(value: unknown): Promise<{ error: "signIn" | "saveFailed" | null }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  if (typeof value !== "boolean") return { error: "saveFailed" };
  try {
    await setAnimeSettings(session.user.id, { airing: value });
    return { error: null };
  } catch {
    return { error: "saveFailed" };
  }
}

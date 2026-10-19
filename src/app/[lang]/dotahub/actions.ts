"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { requestParse } from "@/lib/dota/data";
import { unlinkSteamAccount } from "@/lib/steam-link";

export async function disconnectSteam() {
  const session = await getSession();
  if (!session) return { ok: false };
  await unlinkSteamAccount(session.user.id);
  revalidatePath("/[lang]/dotahub", "layout");
  return { ok: true };
}

export async function askToParse(matchId: unknown) {
  if (typeof matchId !== "number" || !Number.isSafeInteger(matchId) || matchId <= 0) return { ok: false };
  return { ok: await requestParse(matchId).catch(() => false) };
}

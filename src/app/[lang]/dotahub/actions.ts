"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { setDotaNotify, unlinkDota } from "@/lib/dota/admin";
import { requestParse } from "@/lib/dota/data";
import { requestStratzParse } from "@/lib/dota/stratz";
import { unlinkSteamAccount } from "@/lib/steam-link";

export async function disconnectSteam() {
  const session = await getSession();
  if (!session) return { ok: false };
  await unlinkSteamAccount(session.user.id);
  await unlinkDota(session.user.id).catch(() => null);
  revalidatePath("/[lang]/dotahub", "layout");
  return { ok: true };
}

// The account setting: DM the death map after each ranked match.
export async function saveDotaNotify(notify: unknown) {
  const session = await getSession();
  if (!session || typeof notify !== "boolean") return { ok: false };
  const saved = await setDotaNotify(session.user.id, notify).catch(() => null);
  return { ok: Boolean(saved) };
}

export async function askStratzToParse(matchId: unknown) {
  if (typeof matchId !== "number" || !Number.isSafeInteger(matchId) || matchId <= 0)
    return { result: "failed" as const };
  return { result: await requestStratzParse(matchId) };
}

export async function askToParse(matchId: unknown) {
  if (typeof matchId !== "number" || !Number.isSafeInteger(matchId) || matchId <= 0) return { ok: false };
  return { ok: await requestParse(matchId).catch(() => false) };
}

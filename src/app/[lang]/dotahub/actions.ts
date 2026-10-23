"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { PREWARM_COOKIE } from "./prewarm";
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

// The browser setting: whether opening a DotaHub page fetches the other pages' data ahead (prewarm.ts).
// A cookie, so it's per browser and costs nothing to read.
export async function saveDotaPrewarm(on: unknown) {
  if (typeof on !== "boolean") return { ok: false };
  const jar = await cookies();
  if (on) jar.delete(PREWARM_COOKIE);
  else jar.set(PREWARM_COOKIE, "off", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  return { ok: true };
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

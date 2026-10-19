import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { localePath } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import {
  linkSteamAccount,
  publicOrigin,
  readSteamState,
  STEAM_STATE_COOKIE,
  SteamTaken,
  verifySteamLogin,
} from "@/lib/steam-link";

// Steam sends the browser back here after signing in. The state must be ours and this
// browser's, the signed-in account the one that started, and Steam must confirm the answer.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(url.origin);
  const jar = await cookies();
  const state = readSteamState(url.searchParams.get("state"), jar.get(STEAM_STATE_COOKIE)?.value);
  jar.delete(STEAM_STATE_COOKIE);
  const back = (lang: "zh" | "en", result: string) =>
    NextResponse.redirect(new URL(`${localePath(lang, "/dotahub")}?steam=${result}`, origin));
  if (!state) return back("zh", "state");
  const session = await getSession();
  if (!session || session.user.id !== state.userId) return back(state.lang, "signIn");
  const steamId = await verifySteamLogin(url, origin).catch(() => null);
  if (!steamId) return back(state.lang, "denied");
  try {
    await linkSteamAccount(session.user.id, steamId);
  } catch (error) {
    return back(state.lang, error instanceof SteamTaken ? "taken" : "failed");
  }
  return back(state.lang, "linked");
}

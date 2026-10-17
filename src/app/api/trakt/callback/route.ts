import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { localePath } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { connectTrakt, MoviesUnavailable } from "@/lib/movies";
import { readTraktState, TRAKT_STATE_COOKIE } from "@/lib/trakt-state";

// Trakt sends the browser back here after the person authorizes (or refuses). The code goes to
// admin, which exchanges it and makes that Trakt account the signed-in account's movie profile.
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Behind the proxy the request's own origin is the container's; the public one is BETTER_AUTH_URL,
  // and the redirect URI must match the one the authorization was started with.
  const origin = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") ?? url.origin;
  const jar = await cookies();
  const state = readTraktState(url.searchParams.get("state"), jar.get(TRAKT_STATE_COOKIE)?.value);
  jar.delete(TRAKT_STATE_COOKIE);
  const back = (lang: "zh" | "en", error?: string) =>
    NextResponse.redirect(new URL(localePath(lang, "/moviehub") + (error ? `?error=${error}` : ""), origin));
  if (!state) return back("zh", "traktState");
  const session = await getSession();
  if (!session || session.user.id !== state.userId) return back(state.lang, "signIn");
  const code = url.searchParams.get("code");
  if (!code) return back(state.lang, "traktDenied");
  try {
    const linked = await getDiscordAccount(session.user.id);
    await connectTrakt(session.user.id, {
      code,
      redirectUri: `${origin}/api/trakt/callback`,
      codeVerifier: state.verifier,
      region: state.region,
      discordId: linked?.accountId ?? null,
    });
  } catch (error) {
    return back(state.lang, error instanceof MoviesUnavailable ? error.code : "saveFailed");
  }
  return back(state.lang);
}

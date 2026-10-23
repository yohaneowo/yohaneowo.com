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
  const stateParam = url.searchParams.get("state");
  const cookie = jar.get(TRAKT_STATE_COOKIE)?.value;
  const state = readTraktState(stateParam, cookie);
  jar.delete(TRAKT_STATE_COOKIE);
  // Failures are logged (no tokens, no codes): someone's connect failing silently is otherwise
  // invisible, as Trakt talks straight to the browser and the browser straight to us.
  const fail = (reason: string, detail: Record<string, unknown> = {}) =>
    console.warn(
      `[trakt] connect failed: ${reason}`,
      JSON.stringify({
        ...detail,
        ua: request.headers.get("user-agent")?.slice(0, 120) ?? null,
        country: request.headers.get("cf-ipcountry") ?? null,
      }),
    );
  const back = (lang: "zh" | "en", error?: string) =>
    NextResponse.redirect(
      new URL(localePath(lang, "/moviehub") + (error ? `?error=${error}` : "?connected=1"), origin),
    );
  if (!state) {
    fail("state", {
      hasState: Boolean(stateParam),
      hasCookie: Boolean(cookie),
      traktError: url.searchParams.get("error"),
      referer: request.headers.get("referer"),
    });
    return back("zh", "traktState");
  }
  const session = await getSession();
  if (!session || session.user.id !== state.userId) {
    fail("session", { user: state.userId, signedIn: session?.user.id ?? null });
    return back(state.lang, "signIn");
  }
  const code = url.searchParams.get("code");
  if (!code) {
    fail("denied", { user: state.userId, traktError: url.searchParams.get("error") });
    return back(state.lang, "traktDenied");
  }
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
    const code = error instanceof MoviesUnavailable ? error.code : "saveFailed";
    fail("exchange", {
      user: state.userId,
      code,
      message: error instanceof Error ? error.message : String(error),
    });
    return back(state.lang, code);
  }
  return back(state.lang);
}

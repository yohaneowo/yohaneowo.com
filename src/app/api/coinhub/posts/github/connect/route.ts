import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { localePath } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import { authorizeUrl, githubApp, installUrl } from "@/lib/github-app";
import { createGitHubState, GITHUB_STATE_COOKIE } from "@/lib/github-state";

// "Connect GitHub" in TradeHub's X posts panel: off to the App's install page (pick the repos), or
// with ?mode=authorize to its authorization page (already installed: just prove who you are). Both
// come back to ./callback with a code.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
  const origin = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") ?? url.origin;
  const back = (code: string) =>
    NextResponse.redirect(new URL(`${localePath(lang, "/tradehub")}?xposts=${code}`, origin));
  const session = await getSession();
  if (!session) return back("signIn");
  if (!githubApp()) return back("notConfigured");
  const { token, cookie } = createGitHubState({ userId: session.user.id, lang });
  (await cookies()).set(GITHUB_STATE_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  const target =
    url.searchParams.get("mode") === "authorize"
      ? authorizeUrl(token, `${origin}/api/coinhub/posts/github/callback`)
      : installUrl(token);
  return NextResponse.redirect(target);
}

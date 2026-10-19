import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasLocale, localePath } from "@/i18n/config";
import { getSession } from "@/lib/auth";
import { publicOrigin, STEAM_STATE_COOKIE, startSteamLogin } from "@/lib/steam-link";

// "Connect Steam" on DotaHub: off to Steam's sign-in page (signed in to the site first).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(url.origin);
  const langParam = url.searchParams.get("lang") ?? undefined;
  const lang = hasLocale(langParam) ? langParam : "zh";
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(localePath(lang, "/login?next=/dotahub"), origin));
  const { url: steam, cookie } = startSteamLogin({ userId: session.user.id, lang, origin });
  (await cookies()).set(STEAM_STATE_COOKIE, cookie, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/steam",
    maxAge: 600,
  });
  return NextResponse.redirect(steam);
}

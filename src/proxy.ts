import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, hasLocale, localePath, type Locale } from "@/i18n/config";

// The language for an unprefixed path: the one picked before (cookie), else the browser's first
// preference between Chinese and English.
function preferred(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(saved)) return saved;
  for (const part of (request.headers.get("accept-language") ?? "").split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

const DOTAHUB = /^(?:\/(?:zh|en))?\/dotahub(?:\/|$)/;

// One log line per DotaHub page request (navigations and their RSC payloads, not prefetches): the
// path, whether a signed-in session cookie came with it, the country Cloudflare saw and the user
// agent — enough to tell, from the container's logs, who is spending the OpenDota / STRATZ quotas.
function logDotaHub(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!DOTAHUB.test(pathname) || request.headers.has("next-router-prefetch")) return;
  const signedIn = request.cookies.getAll().some((c) => c.name.includes("session_token"));
  // Long enough to keep a crawler's name, which comes at the end (…; Googlebot/2.1; +http://…).
  const agent = (request.headers.get("user-agent") ?? "").slice(0, 160);
  console.log(
    `[dotahub] ${pathname} ${signedIn ? "user" : "anon"} ${request.headers.get("cf-ipcountry") ?? "-"} ${request.headers.has("rsc") ? "rsc" : "page"} ua="${agent}"`,
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  logDotaHub(request);
  const prefix = pathname.split("/")[1];
  // /zh/... is the default language: show it without the prefix.
  if (prefix === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url);
  }
  if (hasLocale(prefix)) return NextResponse.next();
  const lang = preferred(request);
  if (lang !== DEFAULT_LOCALE) {
    return NextResponse.redirect(new URL(`${localePath(lang, pathname)}${search}`, request.url));
  }
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages only: not the API, Next's own files, or files with an extension (favicon.ico…).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

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

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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

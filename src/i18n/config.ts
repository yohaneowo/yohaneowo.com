// Chinese is the default and has no prefix (/moviehub); English lives under /en (/en/moviehub).
// proxy.ts rewrites unprefixed paths to /zh internally, so every page sits under app/[lang].
export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";
// Remembers the language picked in the header, so plain links keep it.
export const LOCALE_COOKIE = "lang";

export function hasLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

// A site path ("/moviehub") in the given language.
export function localePath(lang: Locale, path: string) {
  if (lang === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

// The same page in the other language: strips the current prefix, adds the new one.
export function switchLocalePath(pathname: string, to: Locale) {
  const bare = pathname.replace(/^\/(zh|en)(?=\/|$)/, "") || "/";
  return localePath(to, bare);
}

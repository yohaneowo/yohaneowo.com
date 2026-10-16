"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, localePath, type Locale } from "./config";
import { DICTIONARIES } from "./dictionaries";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={lang}>{children}</LocaleContext.Provider>;
}

// The page's language in client components: its dictionary, and links in that language.
export function useLocale() {
  const lang = useContext(LocaleContext);
  return { lang, t: DICTIONARIES[lang], href: (path: string) => localePath(lang, path) };
}

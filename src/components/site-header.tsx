import Link from "next/link";
import { Suspense } from "react";
import { HeaderShell } from "@/components/header-shell";
import { LanguageSwitch } from "@/components/language-switch";
import { ModeToggle } from "@/components/mode-toggle";
import { NAV_ITEMS } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

export async function SiteHeader() {
  const lang = await getLocale();
  const t = await getDictionary();
  return (
    <HeaderShell>
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:gap-6">
        <Link href={localePath(lang, "/")} className="shrink-0 font-semibold">
          yohaneowo
        </Link>
        {/* Scrolls sideways on narrow screens instead of pushing the page wider. */}
        <nav className="flex min-w-0 [scrollbar-width:none] items-center gap-4 overflow-x-auto text-sm whitespace-nowrap text-muted-foreground">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={localePath(lang, item.href)}
              className="transition-colors hover:text-foreground"
            >
              {t.nav[item.key].title}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Reads the query string, so it renders inside <Suspense> like UserMenu. */}
          <Suspense fallback={<div className="h-8 w-16" />}>
            <LanguageSwitch />
          </Suspense>
          <ModeToggle />
          <Suspense fallback={<div className="size-8" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </HeaderShell>
  );
}

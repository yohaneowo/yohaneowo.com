"use client";

import { LanguagesIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LOCALE_COOKIE, switchLocalePath } from "@/i18n/config";
import { useLocale } from "@/i18n/locale-provider";

// The same page in the other language. The choice is remembered, so plain links (and the next
// visit) keep it; see proxy.ts.
export function LanguageSwitch() {
  const { lang, t } = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const other = lang === "zh" ? "en" : "zh";
  const target = `${switchLocalePath(pathname, other)}${search ? `?${search}` : ""}`;
  return (
    <a
      href={target}
      lang={other === "zh" ? "zh-Hans" : "en"}
      aria-label={t.header.switchLanguageLabel}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <LanguagesIcon />
      {t.header.switchLanguage}
    </a>
  );
}

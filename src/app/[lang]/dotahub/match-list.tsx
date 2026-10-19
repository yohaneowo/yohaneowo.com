import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getHeroes, getPlayerMatches, MATCHES_PER_PAGE } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { MatchTable } from "./match-table";
import { Notice } from "./parts";

// One page of a player's matches with previous / next; path is the list's own page (the viewer's
// /dotahub/matches, or /dotahub/players/<id>/matches).
export async function MatchList({
  t,
  lang,
  accountId,
  page,
  path,
}: {
  t: Dictionary["dotahub"];
  lang: Locale;
  accountId: number;
  page: number;
  path: string;
}) {
  let matches, heroes;
  try {
    [matches, heroes] = await Promise.all([getPlayerMatches(accountId, page), getHeroes()]);
  } catch {
    return <Notice>{t.unavailable}</Notice>;
  }
  const pageHref = (n: number) => localePath(lang, `${path}?page=${n + 1}`);
  return (
    <div className="flex flex-col gap-4">
      {matches.length ? (
        <MatchTable matches={matches} heroes={heroes} t={t} lang={lang} />
      ) : (
        <Notice>{t.matches.empty}</Notice>
      )}
      <nav className="flex items-center justify-between text-sm">
        {page > 0 ? (
          <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t.matches.previous}
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">{t.matches.page(page + 1)}</span>
        <Link
          href={pageHref(page + 1)}
          aria-disabled={matches.length < MATCHES_PER_PAGE}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            matches.length < MATCHES_PER_PAGE && "pointer-events-none opacity-50",
          )}
        >
          {t.matches.next}
        </Link>
      </nav>
    </div>
  );
}

export function pageParam(raw: string | string[] | undefined) {
  return Math.max(0, Math.min(200, Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "1"), 10) - 1 || 0));
}

// A Dota account id from the address (32 bits), or null.
export function accountParam(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 && id < 2 ** 32 ? id : null;
}

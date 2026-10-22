import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getHeroes, getPlayerHeroes, getPlayerMatches, MATCHES_PER_PAGE } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { MatchFilters, type MatchResult } from "./match-filters";
import { MatchTable } from "./match-table";
import { Notice } from "./parts";

// One page of a player's matches with previous / next; path is the list's own page (the viewer's
// /dotahub/matches, or /dotahub/players/<id>/matches). hero and result filter the list (OpenDota
// applies them, so the pages stay full).
export async function MatchList({
  t,
  lang,
  accountId,
  page,
  path,
  hero = 0,
  result = "all",
}: {
  t: Dictionary["dotahub"];
  lang: Locale;
  accountId: number;
  page: number;
  path: string;
  hero?: number;
  result?: MatchResult;
}) {
  let matches, heroes, played;
  try {
    [matches, heroes, played] = await Promise.all([
      getPlayerMatches(accountId, page, { hero, win: result === "all" ? null : result === "win" }),
      getHeroes(),
      // The picker's counts; the list stands without them.
      getPlayerHeroes(accountId).catch(() => null),
    ]);
  } catch {
    return <Notice>{t.unavailable}</Notice>;
  }
  const counts: Record<number, number> = {};
  for (const h of played?.data ?? []) if (h.games) counts[Number(h.hero_id)] = h.games;
  const filtered = hero !== 0 || result !== "all";
  const pageHref = (n: number) => {
    const params = new URLSearchParams({ page: String(n + 1) });
    if (hero) params.set("hero", String(hero));
    if (result !== "all") params.set("win", result);
    return localePath(lang, `${path}?${params}`);
  };
  return (
    <div className="flex flex-col gap-4">
      <MatchFilters heroes={heroes} counts={counts} hero={hero} result={result} />
      {matches.length ? (
        <MatchTable matches={matches} heroes={heroes} t={t} lang={lang} accountId={accountId} />
      ) : (
        <Notice>{filtered && page === 0 ? t.matches.noneFiltered : t.matches.empty}</Notice>
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

// The match list's filters from the address: ?hero=<hero id> and ?win=win|loss.
export function heroParam(raw: string | string[] | undefined) {
  const id = Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? "0"), 10);
  return Number.isSafeInteger(id) && id > 0 && id < 1000 ? id : 0;
}

export function resultParam(raw: string | string[] | undefined): MatchResult {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "win" || value === "loss" ? value : "all";
}

// A Dota account id from the address (32 bits), or null.
export function accountParam(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 && id < 2 ** 32 ? id : null;
}

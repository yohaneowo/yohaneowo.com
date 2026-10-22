"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { HeroPicker } from "./deaths/hero-picker";

export type MatchResult = "all" | "win" | "loss";

// The match list's filters: a hero, and won or lost. They live in the address (?hero=&win=), so
// OpenDota sends the pages already filtered and a link keeps them; changing one starts from page 1.
export function MatchFilters({
  heroes,
  counts,
  hero,
  result,
}: {
  heroes: Record<number, HeroInfo>;
  // Matches per hero (all time), for the picker.
  counts: Record<number, number>;
  hero: number;
  result: MatchResult;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub;
  const router = useRouter();
  const pathname = usePathname();
  const countMap = useMemo(() => new Map(Object.entries(counts).map(([id, n]) => [Number(id), n])), [counts]);
  const go = (next: { hero: number; result: MatchResult }) => {
    const params = new URLSearchParams();
    if (next.hero) params.set("hero", String(next.hero));
    if (next.result !== "all") params.set("win", next.result);
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t.match.hero}</span>
        <HeroPicker
          value={hero}
          onChange={(next) => go({ hero: next, result })}
          heroes={heroes}
          counts={countMap}
        />
      </div>
      {/* Won / lost as the W and L of the stats pages' side panel. */}
      <div role="group" aria-label={t.deaths.result} className="flex items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">{t.deaths.result}</span>
        {(["all", "win", "loss"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={result === v}
            aria-label={t.deaths.results[v]}
            title={t.deaths.results[v]}
            onClick={() => go({ hero, result: v })}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-full border px-2.5 text-xs transition-colors",
              result === v
                ? "border-foreground/40 bg-muted font-medium"
                : "text-muted-foreground opacity-80 hover:text-foreground hover:opacity-100",
            )}
          >
            {v === "all" ? (
              t.deaths.results.all
            ) : (
              <span className={cn("font-semibold", v === "win" ? "text-emerald-500" : "text-red-500")}>
                {t.deaths.resultsShort[v]}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

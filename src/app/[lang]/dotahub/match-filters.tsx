"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import { HeroPicker } from "./deaths/hero-picker";
import { Chips } from "./stats/controls";

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
      <Chips
        label={t.deaths.result}
        value={result}
        options={(["all", "win", "loss"] as const).map((v) => [v, t.deaths.results[v]])}
        onChange={(next) => go({ hero, result: next })}
      />
    </div>
  );
}

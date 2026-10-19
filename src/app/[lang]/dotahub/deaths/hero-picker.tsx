"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";

const ATTR_ICONS = ["strength", "agility", "intelligence", "universal"].map(
  (name) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_${name}.png`,
);

// Every hero as an icon, grouped by primary attribute; the ones played in the range show how
// many matches, the rest are greyed out (picking them would show an empty map). 0 is all heroes.
export function HeroPicker({
  value,
  onChange,
  heroes,
  counts,
}: {
  value: number;
  onChange: (hero: number) => void;
  heroes: Record<number, HeroInfo>;
  counts: Map<number, number>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.deaths;
  const [open, setOpen] = useState(false);
  const current = value ? heroes[value] : undefined;
  const groups = t.attrs.map((name, attr) => ({
    name,
    attr,
    heroes: Object.entries(heroes)
      .filter(([, hero]) => hero.attr === attr)
      .map(([id, hero]) => ({ id: Number(id), hero }))
      .sort((a, b) => a.hero[lang].localeCompare(b.hero[lang], lang === "zh" ? "zh-Hans-CN" : "en")),
  }));
  const pick = (hero: number) => {
    onChange(hero);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t.pickHero}
        className="flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm hover:bg-muted dark:bg-input/30"
      >
        {current && <Image src={current.icon} alt="" width={20} height={20} unoptimized className="size-5" />}
        {current ? current[lang] : t.allHeroes}
        {value !== 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">({counts.get(value) ?? 0})</span>
        )}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-[min(92vw,600px)] gap-3 overflow-y-auto">
        <button
          type="button"
          onClick={() => pick(0)}
          aria-pressed={value === 0}
          className={cn(
            "self-start rounded-full border px-3 py-1 text-xs",
            value === 0
              ? "border-foreground/40 bg-muted font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.allHeroes}
        </button>
        {groups.map((group) => (
          <section key={group.attr} className="flex flex-col gap-1.5">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Image
                src={ATTR_ICONS[group.attr]}
                alt=""
                width={16}
                height={16}
                unoptimized
                className="size-4"
              />
              {group.name}
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1">
              {group.heroes.map(({ id, hero }) => {
                const n = counts.get(id) ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!n}
                    onClick={() => pick(id)}
                    aria-pressed={value === id}
                    aria-label={`${hero[lang]}${n ? ` (${n})` : ""}`}
                    title={n ? `${hero[lang]} · ${n}` : `${hero[lang]} · ${t.notPlayed}`}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-md border transition-colors",
                      value === id ? "border-foreground/60 bg-muted" : "border-transparent",
                      n ? "hover:bg-muted" : "opacity-25 grayscale",
                    )}
                  >
                    <Image src={hero.icon} alt="" width={32} height={32} unoptimized className="size-8" />
                    {n > 0 && (
                      <span className="absolute -right-0.5 -bottom-0.5 rounded bg-background px-0.5 text-[10px] leading-tight tabular-nums">
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </PopoverContent>
    </Popover>
  );
}

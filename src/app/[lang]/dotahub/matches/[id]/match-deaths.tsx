"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { DeathEvent } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { DeathMap } from "../../death-map";

export type DeathsOf = { key: string; heroId: number; name: string; radiant: boolean; events: DeathEvent[] };

// One match's death map, for any of the ten players (the viewer's own first).
export function MatchDeaths({
  players,
  heroes,
  initial,
}: {
  players: DeathsOf[];
  heroes: Record<number, HeroInfo>;
  initial: string;
}) {
  const { t, lang } = useLocale();
  const [selected, setSelected] = useState(initial);
  const current = players.find((p) => p.key === selected) ?? players[0];
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t.dotahub.matchDeaths.player} className="flex flex-wrap gap-1">
        {players.map((p) => {
          const hero = heroes[p.heroId];
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={p.key === current?.key}
              onClick={() => setSelected(p.key)}
              title={`${hero?.[lang] ?? ""} · ${p.name}`}
              className={cn(
                "flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition-colors",
                p.key === current?.key ? "border-foreground/50 bg-muted" : "opacity-70 hover:opacity-100",
                p.radiant ? "border-l-emerald-500/70" : "border-l-red-500/70",
                "border-l-2",
              )}
            >
              {hero && <Image src={hero.icon} alt="" width={20} height={20} unoptimized className="size-5" />}
              <span className="tabular-nums">{p.events.length}</span>
            </button>
          );
        })}
      </div>
      {current && <DeathMap events={current.events} heroes={heroes} />}
    </div>
  );
}

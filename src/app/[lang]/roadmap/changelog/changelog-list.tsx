"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { RoadmapArea } from "@/lib/roadmap";
import { AreaDot, AreaFilter, ItemDetails } from "../item-parts";
import type { ViewItem } from "../roadmap-view";

// Shipped items by release day, newest first, with an area filter.
export function ChangelogList({ items }: { items: ViewItem[] }) {
  const { t: dict } = useLocale();
  const t = dict.roadmap;
  const [area, setArea] = useState<RoadmapArea | null>(null);
  const shown = items.filter((item) => area === null || item.area === area);
  const days = [...new Set(shown.map((item) => item.shipped!))].sort().reverse();
  return (
    <div className="flex flex-col gap-6">
      <AreaFilter areas={items.map((item) => item.area)} value={area} onChange={setArea} />
      {days.length === 0 && <p className="text-sm text-muted-foreground">{t.changelog.empty}</p>}
      <ol className="flex flex-col">
        {days.map((day) => {
          const list = shown.filter((item) => item.shipped === day);
          return (
            <li key={day} className="relative border-l pb-8 pl-6 last:pb-0">
              <span className="absolute top-1 -left-[5px] size-2.5 rounded-full bg-foreground" aria-hidden />
              <h2 className="flex items-baseline gap-2 font-medium tabular-nums">
                {day}
                <span className="text-xs font-normal text-muted-foreground">
                  {t.changelog.count(list.length)}
                </span>
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {list.map((item) => (
                  <article
                    key={item.id}
                    id={`item-${item.id}`}
                    className="scroll-mt-32 rounded-xl border bg-card px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="font-medium">{item.title}</h3>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AreaDot area={item.area} />
                        {t.areas[item.area]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                    {(item.notes.length > 0 || item.links.length > 0) && <ItemDetails item={item} />}
                  </article>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

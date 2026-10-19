"use client";

import Link from "next/link";
import { CheckIcon, CircleIcon, ExternalLinkIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { ROADMAP_AREAS, type RoadmapArea } from "@/lib/roadmap";
import { cn } from "@/lib/utils";
import { AREA_COLOR, type ViewItem } from "./roadmap-view";

// What an item's 详情 opens: why, the steps (ticked when done), links, reason, dates.
export function ItemDetails({ item }: { item: ViewItem }) {
  const { t: dict, href } = useLocale();
  const t = dict.roadmap.details;
  const dates = [
    [t.added, item.added],
    [t.started, item.started],
    [t.shipped, item.shipped],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3 text-sm">
      {item.reason && (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">{t.reason}</h4>
          <p className="mt-1">{item.reason}</p>
        </section>
      )}
      {item.why && (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">{t.why}</h4>
          <p className="mt-1">{item.why}</p>
        </section>
      )}
      {item.steps.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">{t.steps}</h4>
          <ul className="mt-1 flex flex-col gap-1">
            {item.steps.map((s) => (
              <li key={s.text} className="flex items-start gap-2">
                {s.done ? (
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-label="✓" />
                ) : (
                  <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden />
                )}
                <span className={cn(s.done && "text-muted-foreground")}>{s.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {item.notes.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {item.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {item.links.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">{t.links}</h4>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {item.links.map((l) =>
              l.href.startsWith("/") ? (
                <li key={l.href}>
                  <Link href={href(l.href)} className="underline underline-offset-2">
                    {l.label}
                  </Link>
                </li>
              ) : (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    {l.label}
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        {dates.map(([label, date]) => `${label} ${date}`).join(" · ")}
      </p>
    </div>
  );
}

export function AreaDot({ area }: { area: RoadmapArea }) {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: AREA_COLOR[area] }}
      aria-hidden
    />
  );
}

// 全部 + the areas that have items: picks which area a page shows.
export function AreaFilter({
  areas,
  value,
  onChange,
}: {
  areas: RoadmapArea[];
  value: RoadmapArea | null;
  onChange: (area: RoadmapArea | null) => void;
}) {
  const { t: dict } = useLocale();
  const t = dict.roadmap;
  const shown = ROADMAP_AREAS.filter((area) => areas.includes(area));
  const chip = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
      active
        ? "border-foreground/40 bg-muted font-medium text-foreground"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div role="group" aria-label={t.filter.label} className="flex flex-wrap gap-1.5">
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={chip(value === null)}
      >
        {t.filter.all}
      </button>
      {shown.map((area) => (
        <button
          key={area}
          type="button"
          aria-pressed={value === area}
          onClick={() => onChange(value === area ? null : area)}
          className={chip(value === area)}
        >
          <AreaDot area={area} />
          {t.areas[area]}
        </button>
      ))}
    </div>
  );
}

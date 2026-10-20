"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";

export const toneOf = (value: number) =>
  value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

export function shortDate(unix: number, lang: string) {
  return new Date(unix * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "numeric",
    day: "numeric",
  });
}

// One match in a list: hero, result, KDA, date and whatever the list is about, linking to it.
export function MatchRow({
  m,
  heroes,
  matchHref,
  extra,
  value,
}: {
  m: DetailMatch;
  heroes: Record<number, HeroInfo>;
  matchHref: string;
  // What the list is about (a deficit, a win chance…), before the value.
  extra?: React.ReactNode;
  // The figure at the end (IMP by default).
  value?: React.ReactNode;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.impPage;
  return (
    <li>
      <Link
        href={`${matchHref}/${m.matchId}`}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
      >
        {heroes[m.heroId] && (
          <Image src={heroes[m.heroId].icon} alt="" width={20} height={20} unoptimized className="size-5" />
        )}
        <span className="min-w-0 flex-1 truncate">{heroes[m.heroId]?.[lang] ?? m.heroId}</span>
        <span
          className={cn(
            "text-xs",
            m.won ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
          )}
        >
          {m.won ? t.won : t.lost}
        </span>
        <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
          {m.kills}/{m.deaths}/{m.assists}
        </span>
        <span className="w-12 text-right text-xs text-muted-foreground">{shortDate(m.startTime, lang)}</span>
        {extra && <span className="text-right text-xs text-muted-foreground tabular-nums">{extra}</span>}
        <span className="w-14 text-right font-medium tabular-nums">
          {value ??
            (m.imp == null ? "–" : <span className={toneOf(m.imp)}>{m.imp > 0 ? `+${m.imp}` : m.imp}</span>)}
        </span>
      </Link>
    </li>
  );
}

// A plain table: the first column left-aligned, the rest right-aligned figures.
export function Table({
  head,
  rows,
  onRow,
  selected,
}: {
  head: React.ReactNode[];
  rows: { key: string | number; cells: React.ReactNode[] }[];
  onRow?: (key: string | number) => void;
  selected?: string | number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            {head.map((h, i) => (
              <th key={i} className={cn("px-3 py-2 font-normal whitespace-nowrap", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              onClick={onRow ? () => onRow(row.key) : undefined}
              className={cn(
                "border-b last:border-0",
                onRow && "cursor-pointer hover:bg-muted/50",
                selected === row.key && "bg-muted",
              )}
            >
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={cn("px-3 py-1.5 whitespace-nowrap", i > 0 && "text-right tabular-nums")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  ChartPieIcon,
  DicesIcon,
  type LucideIcon,
  SparklesIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type HubItem = {
  key: Exclude<keyof Dictionary["moviehub"]["nav"], "label">;
  href: string;
  icon: LucideIcon;
  // Not built yet: tagged 规划中 in the bar.
  planned?: boolean;
};

// 观影统计's own pages. Unlike the site header this bar never slides away: it sticks below the
// header and moves up into its place while the header is hidden (<html data-header-hidden>).
const ITEMS: HubItem[] = [
  { key: "stats", href: "/moviehub", icon: ChartPieIcon },
  { key: "picks", href: "/moviehub/picks", icon: DicesIcon },
  { key: "calendar", href: "/moviehub/calendar", icon: CalendarDaysIcon, planned: true },
  { key: "leaderboard", href: "/moviehub/leaderboard", icon: TrophyIcon, planned: true },
  { key: "friends", href: "/moviehub/friends", icon: UsersIcon, planned: true },
  { key: "wrapped", href: "/moviehub/wrapped", icon: SparklesIcon, planned: true },
];

// The header is h-14 plus its 1px bottom border.
const FRAME =
  "sticky top-[57px] z-30 -mt-8 mb-8 ml-[calc(50%-50vw)] w-screen border-b bg-background/80 backdrop-blur transition-[top] duration-300 [html[data-header-hidden]_&]:top-0";

function isActive(path: string, href: string) {
  // Someone else's statistics (/moviehub/u/…) count as the statistics page too.
  if (href === "/moviehub") return path === "/moviehub" || path.startsWith("/moviehub/u/");
  return path === href || path.startsWith(`${href}/`);
}

export function HubNav() {
  const { t, href } = useLocale();
  // The Chinese pages have no prefix in the address bar; the English ones start with /en.
  const path = (usePathname() ?? "").replace(/^\/(zh|en)(?=\/|$)/, "") || "/";
  return (
    <div className={FRAME}>
      <nav
        aria-label={t.moviehub.nav.label}
        className="mx-auto flex h-11 max-w-5xl [scrollbar-width:none] items-center gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap"
      >
        {ITEMS.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.key}
              href={href(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {t.moviehub.nav[item.key]}
              {item.planned && (
                <span className="rounded-full border px-1.5 text-[10px] leading-4 text-muted-foreground">
                  {t.moviehub.planned.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// Same box while the bar waits for the pathname, so nothing below it jumps.
export function HubNavPlaceholder() {
  return (
    <div className={FRAME}>
      <div className="h-11" />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageWidth, useWidePage } from "@/components/page-width";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type SubNavItem = {
  // Without the language prefix, e.g. "/moviehub/picks".
  href: string;
  label: string;
  icon: React.ReactNode;
  // A small tag after the label (e.g. 规划中).
  badge?: string;
  // Other paths that count as this page (prefixes), e.g. someone else's statistics.
  alsoActive?: string[];
};

// The header is h-14 plus its 1px bottom border.
const FRAME =
  "sticky top-[57px] z-30 -mt-8 mb-8 ml-[calc(50%-50vw)] w-screen border-b bg-background/80 backdrop-blur transition-[top] duration-300 [html[data-header-hidden]_&]:top-0";

function isActive(path: string, item: SubNavItem, items: SubNavItem[]) {
  if (path === item.href || item.alsoActive?.some((prefix) => path.startsWith(prefix))) return true;
  // A page below this one, unless a more specific item claims it.
  return (
    path.startsWith(`${item.href}/`) &&
    !items.some(
      (other) => other !== item && other.href.startsWith(`${item.href}/`) && path.startsWith(other.href),
    )
  );
}

// A feature's own navigation under the site header (观影统计, 开发计划). Unlike the header it
// never slides away: it sticks below it and moves up into its place while the header is hidden
// (<html data-header-hidden>, set by HeaderShell).
export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  const { href } = useLocale();
  const wide = useWidePage();
  // The Chinese pages have no prefix in the address bar; the English ones start with /en.
  const path = (usePathname() ?? "").replace(/^\/(zh|en)(?=\/|$)/, "") || "/";
  return (
    <div className={FRAME}>
      <nav
        aria-label={label}
        className={cn(
          pageWidth(wide),
          "flex h-11 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap",
        )}
      >
        {items.map((item) => {
          const active = isActive(path, item, items);
          return (
            <Link
              key={item.href}
              href={href(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors [&_svg]:size-4",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {item.icon}
              {item.label}
              {item.badge && (
                <span className="rounded-full border px-1.5 text-[10px] leading-4 text-muted-foreground">
                  {item.badge}
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
export function SubNavPlaceholder() {
  return (
    <div className={FRAME}>
      <div className="h-11" />
    </div>
  );
}

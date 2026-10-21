"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "teams", path: "/dotahub/goat" },
  { key: "players", path: "/dotahub/goat/players" },
  { key: "schedule", path: "/dotahub/goat/schedule" },
  { key: "live", path: "/dotahub/goat/live" },
  { key: "compare", path: "/dotahub/goat/compare" },
] as const;

// GOAT's own tabs; a team's page counts as 战队.
export function GoatTabs() {
  const { t, href } = useLocale();
  const tabs = t.dotahub.goat.tabs;
  const path = (usePathname() ?? "").replace(/^\/(zh|en)(?=\/|$)/, "");
  const active =
    TABS.find((tab) => tab.path !== "/dotahub/goat" && path.startsWith(tab.path))?.key ?? "teams";
  return (
    <nav aria-label={tabs.label} className="flex gap-1 self-start rounded-lg bg-muted p-1 text-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={href(tab.path)}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn(
            "relative rounded-md px-3 py-1 transition-colors",
            active === tab.key ? "font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {active === tab.key && (
            <motion.span
              layoutId="goat-tab"
              className="absolute inset-0 rounded-md bg-background shadow-sm"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{tabs[tab.key]}</span>
        </Link>
      ))}
    </nav>
  );
}

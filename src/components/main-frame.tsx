"use client";
import { usePathname } from "next/navigation";
import { pageWidth, useWidePage } from "@/components/page-width";
import { cn } from "@/lib/utils";

// The page container. TradeHub fills the viewport, so it gets no width limit or padding. This is
// decided from the route rather than with a `:has([data-fullbleed])` selector on <main>: the
// selector sometimes stayed matched after a client-side navigation away from TradeHub, leaving the
// next page stretched to the window edges until a reload. The language prefix is optional: the
// browser's Chinese URLs have none (`/tradehub`), while the server sees the rewritten `/zh/tradehub`.
const FULL_BLEED = /^(\/(zh|en))?\/tradehub(\/|$)/;

export function MainFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const wide = useWidePage();
  if (FULL_BLEED.test(path)) return <main className="flex w-full flex-1 flex-col">{children}</main>;
  return <main className={cn(pageWidth(wide), "flex flex-1 flex-col px-4 py-8")}>{children}</main>;
}

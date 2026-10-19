"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Pages that lay out three columns on wide screens get more room there. The header, the feature
// navigation and the page share the width so their left edges line up.
const WIDE = /^(\/(zh|en))?\/dotahub\/deaths(\/|$)/;

export function useWidePage() {
  return WIDE.test(usePathname() ?? "");
}

export function pageWidth(wide: boolean) {
  return cn("mx-auto w-full max-w-5xl", wide && "xl:max-w-7xl");
}

export function PageWidth({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(pageWidth(useWidePage()), className)}>{children}</div>;
}

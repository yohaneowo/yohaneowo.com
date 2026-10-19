"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Features whose pages use more room on wide screens (DotaHub's three-column heat map, wide
// scoreboards). Their feature navigation and content share the header's width, so the left edges
// line up; the other features keep the narrower content under the wide header.
const WIDE = /^(\/(zh|en))?\/dotahub(\/|$)/;

export function useWidePage() {
  return WIDE.test(usePathname() ?? "");
}

export function pageWidth(wide: boolean) {
  return cn("mx-auto w-full max-w-5xl", wide && "xl:max-w-7xl");
}

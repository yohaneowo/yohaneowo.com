"use client";
import { usePathname } from "next/navigation";

// The page container. CoinHub fills the viewport, so it gets no width limit or padding. This is
// decided from the route rather than with a `:has([data-fullbleed])` selector on <main>: the
// selector sometimes stayed matched after a client-side navigation away from CoinHub, leaving the
// next page stretched to the window edges until a reload.
const FULL_BLEED = /^\/(zh|en)\/coinhub(\/|$)/;

export function MainFrame({ children }: { children: React.ReactNode }) {
  const fullBleed = FULL_BLEED.test(usePathname() ?? "");
  return (
    <main
      className={
        fullBleed ? "flex w-full flex-1 flex-col" : "mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8"
      }
    >
      {children}
    </main>
  );
}

import Link from "next/link";
import { Suspense } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { NAV_ITEMS } from "@/components/site-nav";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold">
          yohaneowo
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
          <Suspense fallback={<div className="size-8" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

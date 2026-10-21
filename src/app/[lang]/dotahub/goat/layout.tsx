import { Suspense } from "react";
import { getDictionary } from "@/i18n/server";
import { CompareBar } from "./compare-tray";
import { GoatTabs } from "./goat-tabs";

// GOAT: the pro scene. Every page under it has the title, the tabs and the compare bar.
export default async function GoatLayout({ children }: { children: React.ReactNode }) {
  const t = (await getDictionary()).dotahub.goat;
  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-wide">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Suspense fallback={<div className="h-9 w-80 rounded-lg bg-muted" />}>
          <GoatTabs />
        </Suspense>
      </div>
      {children}
      <Suspense fallback={null}>
        <CompareBar />
      </Suspense>
    </div>
  );
}

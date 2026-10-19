import { Suspense } from "react";
import { SubNavPlaceholder } from "@/components/sub-nav";
import { getDictionary } from "@/i18n/server";
import { DotaSubNav } from "./dota-sub-nav";

// Every DotaHub page shares the sub-navigation (scoped to the player on someone's public page),
// and the data sources at the bottom.
export default async function DotaHubLayout({ children }: { children: React.ReactNode }) {
  const t = (await getDictionary()).dotahub;
  return (
    <>
      <Suspense fallback={<SubNavPlaceholder />}>
        <DotaSubNav />
      </Suspense>
      {children}
      <p className="mt-10 text-xs text-muted-foreground">{t.sources}</p>
    </>
  );
}

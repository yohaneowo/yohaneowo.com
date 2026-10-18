import { Suspense } from "react";
import { HubNav, HubNavPlaceholder } from "./hub-nav";

// Every 观影统计 page shares the sub-navigation under the site header.
export default function MovieHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<HubNavPlaceholder />}>
        <HubNav />
      </Suspense>
      {children}
    </>
  );
}

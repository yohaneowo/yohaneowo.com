import { Suspense } from "react";
import { FlameIcon, ListIcon, SwordsIcon, UsersIcon } from "lucide-react";
import { SubNav, SubNavPlaceholder, type SubNavItem } from "@/components/sub-nav";
import { getDictionary } from "@/i18n/server";
import { SourceHealthDots } from "./source-health";

// Every DotaHub page shares the sub-navigation, and the data sources at the bottom.
export default async function DotaHubLayout({ children }: { children: React.ReactNode }) {
  const t = (await getDictionary()).dotahub;
  const items: SubNavItem[] = [
    // Someone else's page (/dotahub/players/…) counts as the overview too.
    {
      href: "/dotahub",
      label: t.nav.overview,
      icon: <SwordsIcon aria-hidden />,
      alsoActive: ["/dotahub/players/"],
    },
    { href: "/dotahub/matches", label: t.nav.matches, icon: <ListIcon aria-hidden /> },
    { href: "/dotahub/deaths", label: t.nav.deaths, icon: <FlameIcon aria-hidden /> },
    { href: "/dotahub/peers", label: t.nav.peers, icon: <UsersIcon aria-hidden /> },
  ];
  return (
    <>
      <Suspense fallback={<SubNavPlaceholder />}>
        <SubNav label={t.nav.label} items={items} end={<SourceHealthDots />} />
      </Suspense>
      {children}
      <p className="mt-10 text-xs text-muted-foreground">{t.sources}</p>
    </>
  );
}

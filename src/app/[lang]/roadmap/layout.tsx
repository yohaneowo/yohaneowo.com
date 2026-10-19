import { Suspense } from "react";
import { HistoryIcon, LightbulbIcon, MapIcon, UserIcon } from "lucide-react";
import { SubNav, SubNavPlaceholder, type SubNavItem } from "@/components/sub-nav";
import { getDictionary } from "@/i18n/server";

// Every 开发计划 page shares the sub-navigation under the site header.
export default async function RoadmapLayout({ children }: { children: React.ReactNode }) {
  const t = (await getDictionary()).roadmap;
  const items: SubNavItem[] = [
    { href: "/roadmap", label: t.nav.roadmap, icon: <MapIcon aria-hidden /> },
    { href: "/roadmap/changelog", label: t.nav.changelog, icon: <HistoryIcon aria-hidden /> },
    { href: "/roadmap/ideas", label: t.nav.ideas, icon: <LightbulbIcon aria-hidden /> },
    { href: "/roadmap/me", label: t.nav.me, icon: <UserIcon aria-hidden /> },
  ];
  return (
    <>
      <Suspense fallback={<SubNavPlaceholder />}>
        <SubNav label={t.nav.label} items={items} />
      </Suspense>
      {children}
    </>
  );
}

import { Suspense } from "react";
import { CalendarDaysIcon, ChartPieIcon, DicesIcon, SparklesIcon, TrophyIcon, UsersIcon } from "lucide-react";
import { SubNav, SubNavPlaceholder, type SubNavItem } from "@/components/sub-nav";
import { getDictionary } from "@/i18n/server";

// Every 观影统计 page shares the sub-navigation under the site header. Pages not built yet are
// tagged 规划中 (planned.tsx).
export default async function MovieHubLayout({ children }: { children: React.ReactNode }) {
  const t = (await getDictionary()).moviehub;
  const planned = t.planned.badge;
  const items: SubNavItem[] = [
    // Someone else's statistics (/moviehub/u/…) count as the statistics page too.
    {
      href: "/moviehub",
      label: t.nav.stats,
      icon: <ChartPieIcon aria-hidden />,
      alsoActive: ["/moviehub/u/"],
    },
    { href: "/moviehub/picks", label: t.nav.picks, icon: <DicesIcon aria-hidden /> },
    {
      href: "/moviehub/calendar",
      label: t.nav.calendar,
      icon: <CalendarDaysIcon aria-hidden />,
      badge: planned,
    },
    {
      href: "/moviehub/leaderboard",
      label: t.nav.leaderboard,
      icon: <TrophyIcon aria-hidden />,
      badge: planned,
    },
    { href: "/moviehub/friends", label: t.nav.friends, icon: <UsersIcon aria-hidden />, badge: planned },
    { href: "/moviehub/wrapped", label: t.nav.wrapped, icon: <SparklesIcon aria-hidden />, badge: planned },
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

import { Suspense } from "react";
import { ActivityIcon, LinkIcon } from "lucide-react";
import { SubNav, SubNavPlaceholder, type SubNavItem } from "@/components/sub-nav";
import { getDictionary } from "@/i18n/server";

// LinkHub's pages share a sub-navigation: parse a link, and the gateway's status.
export default async function LinkHubLayout({ children }: { children: React.ReactNode }) {
  const t = (await getDictionary()).linkhub;
  const items: SubNavItem[] = [
    { href: "/linkhub", label: t.nav.parse, icon: <LinkIcon aria-hidden /> },
    { href: "/linkhub/status", label: t.nav.status, icon: <ActivityIcon aria-hidden /> },
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

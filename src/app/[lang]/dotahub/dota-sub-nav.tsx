"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowLeftIcon,
  CoinsIcon,
  FlameIcon,
  FlaskConicalIcon,
  ListIcon,
  StarIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";
import { SubNav } from "@/components/sub-nav";
import { useLocale } from "@/i18n/locale-provider";
import { SourceHealthDots } from "./source-health";

const PLAYER = /^(?:\/(?:zh|en))?\/dotahub\/players\/(\d+)(?:\/|$)/;

// DotaHub's navigation. On someone's public page (/dotahub/players/<id>/…) every item leads to
// that player's pages, with a way back to the viewer's own.
export function DotaSubNav() {
  const { t: dict, href } = useLocale();
  const t = dict.dotahub;
  const other = PLAYER.exec(usePathname() ?? "")?.[1];
  const base = other ? `/dotahub/players/${other}` : "/dotahub";
  return (
    <SubNav
      label={t.nav.label}
      items={[
        { href: base, label: t.nav.overview, icon: <SwordsIcon aria-hidden /> },
        { href: `${base}/matches`, label: t.nav.matches, icon: <ListIcon aria-hidden /> },
        { href: `${base}/deaths`, label: t.nav.deaths, icon: <FlameIcon aria-hidden /> },
        { href: `${base}/economy`, label: t.nav.economy, icon: <CoinsIcon aria-hidden /> },
        { href: `${base}/imp`, label: t.nav.imp, icon: <ActivityIcon aria-hidden /> },
        { href: `${base}/signature`, label: t.nav.signature, icon: <StarIcon aria-hidden /> },
        {
          href: `${base}/research`,
          label: t.nav.research,
          icon: <FlaskConicalIcon aria-hidden />,
          badge: t.nav.planned,
        },
        { href: `${base}/peers`, label: t.nav.peers, icon: <UsersIcon aria-hidden /> },
      ]}
      end={
        <div className="ml-auto flex shrink-0 items-center gap-4 pl-4">
          {other && (
            <Link
              href={href("/dotahub")}
              className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden />
              {t.player.mine}
            </Link>
          )}
          <SourceHealthDots />
        </div>
      }
    />
  );
}

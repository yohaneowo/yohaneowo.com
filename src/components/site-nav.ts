import {
  ChartCandlestickIcon,
  FilmIcon,
  Gamepad2Icon,
  type LucideIcon,
  MapIcon,
  SwordsIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

export type NavItem = {
  // Title and description come from the dictionary's `nav` section.
  key: keyof Dictionary["nav"];
  href: string;
  icon: LucideIcon;
  // A logo shown next to the title in the header (a white-on-transparent image used as a mask, so
  // it takes the text colour).
  logo?: string;
};

// Each feature gets one entry here; the header and the home page both render from it.
export const NAV_ITEMS: NavItem[] = [
  { key: "moviehub", href: "/moviehub", icon: FilmIcon },
  { key: "coinhub", href: "/tradehub", icon: ChartCandlestickIcon },
  { key: "uidhub", href: "/uidhub", icon: Gamepad2Icon },
  { key: "dotahub", href: "/dotahub", icon: SwordsIcon, logo: "/dota/dota2.png" },
  { key: "roadmap", href: "/roadmap", icon: MapIcon },
];

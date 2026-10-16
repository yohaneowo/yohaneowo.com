import { FilmIcon, Gamepad2Icon, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";

export type NavItem = {
  // Title and description come from the dictionary's `nav` section.
  key: keyof Dictionary["nav"];
  href: string;
  icon: LucideIcon;
};

// Each feature gets one entry here; the header and the home page both render from it.
export const NAV_ITEMS: NavItem[] = [
  { key: "moviehub", href: "/moviehub", icon: FilmIcon },
  { key: "uidhub", href: "/uidhub", icon: Gamepad2Icon },
];

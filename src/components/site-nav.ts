import { FilmIcon, Gamepad2Icon, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

// Each feature gets one entry here; the header and the home page both render from it.
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/trakt",
    title: "观影统计",
    description: "从 Trakt 观看记录看自己的口味：类型、评分分布、喜欢的导演与演员。",
    icon: FilmIcon,
  },
  {
    href: "/uidhub",
    title: "UIDHub",
    description: "公开自己在各个手游的 UID，想加好友时直接把链接给对方，不用开游戏查。",
    icon: Gamepad2Icon,
  },
];

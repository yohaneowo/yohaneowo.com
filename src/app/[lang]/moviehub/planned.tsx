import Link from "next/link";
import { HammerIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

// Each planned page's item on the roadmap (lib/roadmap.ts), where it can be voted for.
const ROADMAP_ITEM = {
  calendar: "watch-calendar",
  leaderboard: "leaderboard",
  friends: "friends",
  wrapped: "year-in-review",
} as const;

// A 观影统计 page that isn't built yet: its name, what it will do, and that it's being planned.
export async function PlannedPage({
  feature,
}: {
  feature: "calendar" | "leaderboard" | "friends" | "wrapped";
}) {
  const t = (await getDictionary()).moviehub;
  const lang = await getLocale();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted">
        <HammerIcon className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{t.nav[feature]}</h1>
        <Badge variant="outline">{t.planned.badge}</Badge>
      </div>
      <p className="text-lg font-medium">{t.planned.title}</p>
      <p className="text-muted-foreground">{t.planned[feature]}</p>
      <p className="text-sm text-muted-foreground">{t.planned.note}</p>
      <Link
        href={localePath(lang, `/roadmap#item-${ROADMAP_ITEM[feature]}`)}
        className={buttonVariants({ variant: "outline" })}
      >
        {t.planned.vote}
      </Link>
    </div>
  );
}

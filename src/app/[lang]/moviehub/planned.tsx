import { HammerIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/i18n/server";

// A 观影统计 page that isn't built yet: its name, what it will do, and that it's being planned.
export async function PlannedPage({
  feature,
}: {
  feature: "calendar" | "leaderboard" | "friends" | "wrapped";
}) {
  const t = (await getDictionary()).moviehub;
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
    </div>
  );
}

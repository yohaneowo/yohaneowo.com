import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";
import { getItemCosts, getItems, isKeyItem } from "@/lib/dota/data";
import type { DeathsSource } from "../deaths/deaths-view";
import { EconomyExplorer, type KeyItem } from "../economy/economy-explorer";
import { ImpExplorer } from "../imp/imp-explorer";
import { Notice } from "../parts";
import { loadDetailMatches } from "./load";

// The 经济 or IMP page's content for a player: loads their matches with details and hands them to
// the page's explorer. A player linked here has every stored match (with "all"); anyone else the
// newest 100 from STRATZ.
export async function StatsBody({
  kind,
  source,
  accountId,
}: {
  kind: "imp" | "economy";
  source: DeathsSource;
  accountId: number;
}) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const [data, itemInfo, costs] = await Promise.all([
    loadDetailMatches(source, accountId).catch(() => null),
    kind === "economy" ? getItems().catch(() => null) : null,
    kind === "economy" ? getItemCosts().catch(() => null) : null,
  ]);
  if (!data) return <Notice>{t.stats.unavailable}</Notice>;
  const ranges = source.kind === "stored" ? [20, 50, 100, 0] : [20, 50, 100];
  const matchHref = localePath(lang, "/dotahub/matches");
  const note = !data.complete ? t.stats.history : source.kind === "stratz" ? t.player.stratzRecent : null;

  let explorer;
  if (kind === "imp") {
    explorer = (
      <ImpExplorer
        matches={data.matches}
        sides={data.sides}
        heroes={data.heroes}
        ranges={ranges}
        matchHref={matchHref}
      />
    );
  } else {
    // Only the key items these matches bought go to the client.
    const items: Record<number, KeyItem> = {};
    for (const m of data.matches)
      for (const [, id] of m.details.items)
        if (!(id in items) && itemInfo?.[id] && isKeyItem(costs?.[id]))
          items[id] = { name: itemInfo[id][lang], img: itemInfo[id].img };
    explorer = (
      <EconomyExplorer
        matches={data.matches}
        sides={data.sides}
        heroes={data.heroes}
        items={items}
        ranges={ranges}
        matchHref={matchHref}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {explorer}
    </div>
  );
}

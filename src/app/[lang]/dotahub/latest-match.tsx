import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getItems, getMatch, type HeroInfo, type PlayerMatch, won } from "@/lib/dota/data";
import { getStratzMatch } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { DeathMap } from "./death-map";
import { duration, HeroImage, ItemImage, modeName, ResultBadge } from "./parts";

type T = Dictionary["dotahub"];

// STRATZ's IMP: about −100 to +100, 0 being average for the rank and hero.
export function ImpBadge({ imp, t }: { imp: number; t: T }) {
  const label = imp > 5 ? t.latest.above : imp < -5 ? t.latest.below : t.latest.average;
  return (
    <span className="flex items-baseline gap-2" title={t.latest.impHint}>
      <span className="text-xs text-muted-foreground">{t.latest.imp}</span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          imp > 5
            ? "text-emerald-600 dark:text-emerald-400"
            : imp < -5
              ? "text-red-600 dark:text-red-400"
              : undefined,
        )}
      >
        {imp > 0 ? `+${imp}` : imp}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

// The overview's latest match: hero, result, KDA, items, STRATZ's IMP and where the player died.
export async function LatestMatch({
  match,
  accountId,
  heroes,
  t,
  lang,
}: {
  match: PlayerMatch;
  accountId: number;
  heroes: Record<number, HeroInfo>;
  t: T;
  lang: Locale;
}) {
  const [stratz, full, items] = await Promise.all([
    getStratzMatch(match.match_id).catch(() => null),
    getMatch(match.match_id).catch(() => null),
    getItems().catch(() => ({}) as Awaited<ReturnType<typeof getItems>>),
  ]);
  const me = stratz?.players.find((p) => p.steamAccountId === accountId);
  const line = full?.players.find((p) => p.account_id === accountId);
  const hero = heroes[match.hero_id];
  const slots = line ? [line.item_0, line.item_1, line.item_2, line.item_3, line.item_4, line.item_5] : [];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <HeroImage hero={hero} lang={lang} className="h-14 w-24" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ResultBadge won={won(match)} t={t} />
              <span className="font-medium">{hero?.[lang]}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground tabular-nums">
              {match.kills} / {match.deaths} / {match.assists} · {duration(match.duration)} ·{" "}
              {modeName(match.game_mode, match.lobby_type, t)}
            </div>
          </div>
          {slots.length > 0 && (
            <div className="flex items-center gap-0.5">
              {slots.map((id, i) => (
                <ItemImage key={i} item={id ? items[id] : undefined} lang={lang} />
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-4">
            {me?.imp != null && <ImpBadge imp={me.imp} t={t} />}
            <Link
              href={localePath(lang, `/dotahub/matches/${match.match_id}`)}
              className="text-sm text-muted-foreground hover:underline"
            >
              {t.latest.open}
            </Link>
          </div>
        </div>
        {stratz?.parsed && me ? (
          <DeathMap events={me.deathEvents} heroes={heroes} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.latest.parsing}</p>
        )}
      </CardContent>
    </Card>
  );
}

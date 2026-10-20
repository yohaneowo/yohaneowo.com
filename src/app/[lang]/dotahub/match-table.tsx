import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { type HeroInfo, type PlayerMatch, won } from "@/lib/dota/data";
import { ago, duration, HeroImage, modeName, ResultBadge } from "./parts";

// A player's matches, one row each; a row opens the match.
export function MatchTable({
  matches,
  heroes,
  t,
  lang,
  accountId,
}: {
  matches: PlayerMatch[];
  heroes: Record<number, HeroInfo>;
  t: Dictionary["dotahub"];
  lang: Locale;
  // Whose matches these are: the match page puts them first.
  accountId?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 font-normal">{t.matches.result}</th>
            <th className="px-3 py-2 font-normal">{t.match.hero}</th>
            <th className="px-3 py-2 font-normal">{t.match.kda}</th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell">{t.matches.mode}</th>
            <th className="px-3 py-2 text-right font-normal">{t.match.duration}</th>
            <th className="hidden px-3 py-2 text-right font-normal sm:table-cell">{t.matches.when}</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const hero = heroes[m.hero_id];
            const href = localePath(
              lang,
              `/dotahub/matches/${m.match_id}${accountId ? `?p=${accountId}` : ""}`,
            );
            return (
              <tr key={m.match_id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-3 py-1.5">
                  <Link href={href} aria-label={t.match.title(m.match_id)}>
                    <ResultBadge won={won(m)} t={t} />
                  </Link>
                </td>
                <td className="px-3 py-1.5">
                  <Link href={href} className="flex items-center gap-2">
                    <HeroImage hero={hero} lang={lang} className="h-7 w-12" />
                    <span className="truncate">{hero?.[lang] ?? m.hero_id}</span>
                  </Link>
                </td>
                <td className="px-3 py-1.5 tabular-nums">
                  {m.kills} / {m.deaths} / {m.assists}
                </td>
                <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">
                  {modeName(m.game_mode, m.lobby_type, t)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{duration(m.duration)}</td>
                <td className="hidden px-3 py-1.5 text-right text-muted-foreground sm:table-cell">
                  {ago(m.start_time, t)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

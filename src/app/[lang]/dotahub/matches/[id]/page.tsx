import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import {
  getHeroes,
  getItems,
  getMatch,
  type HeroInfo,
  isRadiant,
  type ItemInfo,
  type Match,
  type MatchPlayer,
} from "@/lib/dota/data";
import { getStratzMatch } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { dotaViewer } from "../../account";
import { RequestParse } from "../../buttons";
import { duration, HeroImage, ItemImage, modeName, Notice } from "../../parts";
import { AdvantageChart } from "./advantage-chart";
import { type DeathsOf, MatchDeaths } from "./match-deaths";

type Params = Promise<{ id: string }>;
type T = Dictionary["dotahub"];

// Any match id can be opened, so there is no static shell to prerender: the page (layout
// included, whose client hooks read the path) renders per request.
export const instant = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getDictionary()).dotahub.match.title(Number(id)) };
}

function Team({
  name,
  won,
  players,
  heroes,
  items,
  t,
  lang,
  me,
}: {
  name: string;
  won: boolean;
  players: MatchPlayer[];
  heroes: Record<number, HeroInfo>;
  items: Record<number, ItemInfo>;
  t: T;
  lang: Locale;
  me: number | null;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 font-medium">
        {name}
        {won && (
          <span className="rounded bg-emerald-500/15 px-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            {t.match.win}
          </span>
        )}
      </h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 font-normal">{t.match.hero}</th>
              <th className="px-3 py-2 font-normal">{t.match.kda}</th>
              <th className="px-3 py-2 font-normal">{t.match.lhdn}</th>
              <th className="px-3 py-2 font-normal">{t.match.gpmxpm}</th>
              <th className="px-3 py-2 text-right font-normal">{t.match.netWorth}</th>
              <th className="px-3 py-2 text-right font-normal">{t.match.damage}</th>
              <th className="px-3 py-2 font-normal">{t.match.items}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const hero = heroes[p.hero_id];
              const slots = [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5];
              return (
                <tr
                  key={p.player_slot}
                  className={cn(
                    "border-b last:border-0",
                    p.account_id != null && p.account_id === me && "bg-primary/5",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <HeroImage hero={hero} lang={lang} className="h-7 w-12" />
                      <div className="min-w-0">
                        <div className="truncate text-xs text-muted-foreground">
                          {hero?.[lang]} · {t.match.level} {p.level}
                        </div>
                        <div className="max-w-40 truncate">
                          {p.account_id ? (
                            <a
                              href={`https://www.opendota.com/players/${p.account_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {p.personaname || p.account_id}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{t.match.anonymous}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                    {p.kills} / {p.deaths} / {p.assists}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                    {p.last_hits} / {p.denies}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                    {p.gold_per_min} / {p.xp_per_min}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {p.net_worth?.toLocaleString("en-US") ?? "–"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {p.hero_damage?.toLocaleString("en-US") ?? "–"}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-0.5">
                      {slots.map((id, i) => (
                        <ItemImage key={i} item={id ? items[id] : undefined} lang={lang} />
                      ))}
                      {p.item_neutral ? (
                        <span className="ml-1">
                          <ItemImage item={items[p.item_neutral]} lang={lang} />
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Draft({
  match,
  heroes,
  t,
  lang,
}: {
  match: Match;
  heroes: Record<number, HeroInfo>;
  t: T;
  lang: Locale;
}) {
  if (!match.picks_bans?.length) return null;
  const team = (side: number) =>
    match.picks_bans!.filter((p) => p.team === side).sort((a, b) => a.order - b.order);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{t.match.draft}</h2>
      {[0, 1].map((side) => (
        <div key={side} className="flex flex-wrap items-center gap-1.5">
          <span className="w-12 text-xs text-muted-foreground">
            {side === 0 ? t.match.radiant : t.match.dire}
          </span>
          {team(side).map((p) => (
            <span
              key={p.order}
              className={cn("relative", !p.is_pick && "opacity-40 grayscale")}
              title={`${p.order + 1}`}
            >
              <HeroImage hero={heroes[p.hero_id]} lang={lang} className="h-6 w-10" />
            </span>
          ))}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {t.match.picks} / <span className="opacity-60">{t.match.bans}</span>
      </p>
    </section>
  );
}

async function Detail({ params }: { params: Params }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return <Notice>{t.match.notFound}</Notice>;
  let data;
  try {
    data = await Promise.all([
      getMatch(id),
      getHeroes(),
      getItems(),
      dotaViewer(),
      getStratzMatch(id).catch(() => null),
    ]);
  } catch {
    return <Notice>{t.unavailable}</Notice>;
  }
  const [match, heroes, items, viewer, stratz] = data;
  if (!match) return <Notice>{t.match.notFound}</Notice>;
  // STRATZ's deaths per player, named from OpenDota's scoreboard (same hero, same side).
  const deaths: DeathsOf[] = (stratz?.parsed ? stratz.players : []).map((p, i) => {
    const line = match.players.find((m) => m.hero_id === p.heroId);
    return {
      key: `${i}`,
      heroId: p.heroId,
      name: line?.personaname || (p.steamAccountId ? String(p.steamAccountId) : t.match.anonymous),
      radiant: p.isRadiant,
      events: p.deathEvents,
    };
  });
  const mine =
    stratz?.players.findIndex((p) => viewer.state === "linked" && p.steamAccountId === viewer.accountId) ??
    -1;
  const me = viewer.state === "linked" ? viewer.accountId : null;
  const radiant = match.players.filter((p) => isRadiant(p.player_slot));
  const dire = match.players.filter((p) => !isRadiant(p.player_slot));
  const date = new Date(match.start_time * 1000).toISOString().slice(0, 16).replace("T", " ");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {modeName(match.game_mode, match.lobby_type, t)} · {duration(match.duration)} · {date} UTC
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            <span className={match.radiant_win ? "text-emerald-600 dark:text-emerald-400" : undefined}>
              {match.radiant_score}
            </span>
            <span className="mx-2 text-muted-foreground">:</span>
            <span className={!match.radiant_win ? "text-emerald-600 dark:text-emerald-400" : undefined}>
              {match.dire_score}
            </span>
            <span className="ml-3 text-base font-medium">
              {match.radiant_win ? t.match.radiantWin : t.match.direWin}
            </span>
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href={localePath(lang, "/dotahub/matches")} className="text-muted-foreground hover:underline">
            {t.match.back}
          </Link>
          <a
            href={`https://www.opendota.com/matches/${id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {t.match.openOn}
            <ExternalLinkIcon className="size-3" aria-hidden />
          </a>
        </div>
      </div>

      <Team
        name={t.match.radiant}
        won={match.radiant_win}
        players={radiant}
        heroes={heroes}
        items={items}
        t={t}
        lang={lang}
        me={me}
      />
      <Team
        name={t.match.dire}
        won={!match.radiant_win}
        players={dire}
        heroes={heroes}
        items={items}
        t={t}
        lang={lang}
        me={me}
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t.match.advantage}</h2>
        {match.radiant_gold_adv?.length && match.radiant_xp_adv?.length ? (
          <AdvantageChart gold={match.radiant_gold_adv} xp={match.radiant_xp_adv} />
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border px-4 py-4 text-sm text-muted-foreground">
            {t.match.notParsed}
            <RequestParse matchId={id} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t.matchDeaths.title}</h2>
        {deaths.length ? (
          <MatchDeaths players={deaths} heroes={heroes} initial={String(Math.max(0, mine))} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.deaths.noStratz}</p>
        )}
      </section>

      <Draft match={match} heroes={heroes} t={t} lang={lang} />
    </div>
  );
}

// One match, for anyone: both teams' scoreboard and items, the gold and XP curves, the draft.
export default async function MatchPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <Detail params={params} />
    </Suspense>
  );
}

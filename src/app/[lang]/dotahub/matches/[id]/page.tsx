import type { Metadata } from "next";
import Image from "next/image";
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
import { getStratzMatch, type StratzMatch } from "@/lib/dota/stratz";
import { cn } from "@/lib/utils";
import { dotaViewer } from "../../account";
import { RequestParse, RequestStratzParse } from "../../buttons";
import { duration, HeroImage, ItemImage, modeName, Notice } from "../../parts";
import { AdvantageChart } from "./advantage-chart";
import { type DeathsOf, MatchDeaths } from "./match-deaths";
import { type ImpOf, MatchImp } from "./match-imp";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ p?: string | string[] }>;
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
                            <Link
                              href={localePath(lang, `/dotahub/players/${p.account_id}`)}
                              className="hover:underline"
                            >
                              {p.personaname || p.account_id}
                            </Link>
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

// The draft: the bans in a row of their own (in ranked All Pick everyone nominates bans and some go
// through, so they belong to no side), then the picks on a timeline, each in its turn's column with
// Radiant above and Dire below, so the turns (2-2-2-2-1-1) show. The picks' order and sides from
// STRATZ (OpenDota's when it has none); the bans from OpenDota, Valve's own list of the bans that
// went through (it files them all under Radiant, which is why they get a row of their own), since
// STRATZ lists every nomination as banned.
function Draft({
  match,
  stratz,
  heroes,
  t,
  lang,
}: {
  match: Match;
  stratz: StratzMatch | null;
  heroes: Record<number, HeroInfo>;
  t: T;
  lang: Locale;
}) {
  const fromStratz = (stratz?.picks.length ?? 0) >= 2;
  const picks = fromStratz
    ? stratz!.picks
    : (match.picks_bans ?? [])
        .filter((x) => x.is_pick)
        .sort((a, b) => a.order - b.order)
        .map((x) => ({ heroId: x.hero_id, radiant: x.team === 0, order: x.order }));
  const openDotaBans = (match.picks_bans ?? []).filter((x) => !x.is_pick).map((x) => x.hero_id);
  const bans = openDotaBans.length ? openDotaBans : (stratz?.bans ?? []);
  if (!picks.length && !bans.length) return null;
  const nameOf = (heroId: number) => {
    const line = match.players.find((m) => m.hero_id === heroId);
    return line?.personaname || t.match.anonymous;
  };
  // A new turn starts where the side changes: a little space before it.
  const turnStart = picks.map((x, i) => i > 0 && x.radiant !== picks[i - 1].radiant);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{t.match.draft}</h2>
      {bans.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">{t.match.banPhase}</span>
          {bans.map((hero, i) => (
            <span key={`${hero}-${i}`} className="opacity-50 grayscale" title={heroes[hero]?.[lang]}>
              <HeroImage hero={heroes[hero]} lang={lang} className="h-6 w-10" />
            </span>
          ))}
        </div>
      )}
      {picks.length > 0 && (
        <div className="overflow-x-auto">
          {/* Radiant's row and Dire's, a grey line between them from the sides' marks to the last
              pick (Radiant's cells carry it, padded rather than spaced so it doesn't break). */}
          <div className="grid w-max grid-flow-col grid-rows-2 items-stretch">
            {[true, false].map((radiant) => (
              <div
                key={String(radiant)}
                className={cn("flex items-start pr-2", radiant ? "border-b border-border pb-2" : "pt-2")}
              >
                <Image
                  src={`/dota/${radiant ? "radiant" : "dire"}.webp`}
                  alt={radiant ? t.match.radiant : t.match.dire}
                  title={radiant ? t.match.radiant : t.match.dire}
                  width={36}
                  height={36}
                  className={cn(
                    "h-9 w-auto rounded-sm border-b-2",
                    radiant ? "border-b-emerald-500/70" : "border-b-red-500/70",
                  )}
                />
              </div>
            ))}
            {picks.map((x, i) =>
              [true, false].map((radiant) => (
                <div
                  key={`${i}-${radiant}`}
                  className={cn(
                    "flex flex-col items-center gap-0.5",
                    turnStart[i] ? "w-20 pl-4" : "w-16",
                    radiant ? "border-b border-border pb-2" : "pt-2",
                  )}
                >
                  {x.radiant === radiant ? (
                    <>
                      <span className="relative" title={t.match.pickNumber(i + 1)}>
                        <HeroImage
                          hero={heroes[x.heroId]}
                          lang={lang}
                          className={cn(
                            "h-9 w-14 border-b-2",
                            radiant ? "border-b-emerald-500/70" : "border-b-red-500/70",
                          )}
                        />
                        <span className="absolute top-0 left-0 rounded-br bg-black/70 px-1 text-[10px] text-white tabular-nums">
                          {i + 1}
                        </span>
                      </span>
                      <span className="w-16 truncate text-center text-[10px] text-muted-foreground">
                        {nameOf(x.heroId)}
                      </span>
                    </>
                  ) : (
                    <span className="h-9 w-14" aria-hidden />
                  )}
                </div>
              )),
            )}
          </div>
          <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
            <span>
              <span className="mr-1 inline-block h-0.5 w-3 bg-emerald-500/70 align-middle" />
              {t.match.radiant}
            </span>
            <span>
              <span className="mr-1 inline-block h-0.5 w-3 bg-red-500/70 align-middle" />
              {t.match.dire}
            </span>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t.match.draftNote}</p>
    </section>
  );
}

async function Detail({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const lang = await getLocale();
  const t = (await getDictionary()).dotahub;
  const id = Number((await params).id);
  // Whose page the match was opened from (?p=account id): their line comes first.
  const from = Number((await searchParams).p);
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
  // IMP minute by minute, coloured by slot; the page's player (or the viewer) first.
  const bySlot = [...match.players].sort((a, b) => a.player_slot - b.player_slot);
  const imps: ImpOf[] = stratz?.parsed
    ? bySlot.flatMap((line, slot) => {
        const p = stratz.players.find((x) => x.heroId === line.hero_id);
        return p?.impm.length
          ? [
              {
                key: String(line.hero_id),
                heroId: line.hero_id,
                name: line.personaname || t.match.anonymous,
                radiant: isRadiant(line.player_slot),
                slot,
                impm: p.impm,
                deaths: p.deathEvents.map((e) => ({ t: e.t, by: e.by })),
              },
            ]
          : [];
      })
    : [];
  const focusLine =
    match.players.find((x) => Number.isSafeInteger(from) && from > 0 && x.account_id === from) ??
    match.players.find((x) => me != null && x.account_id === me);
  const impFocus = String(focusLine?.hero_id ?? imps[0]?.heroId ?? "");
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
        <h2 className="font-medium">{t.matchImp.title}</h2>
        {imps.length ? (
          <MatchImp
            players={imps}
            heroes={heroes}
            focus={impFocus}
            matchTier={stratz?.rank ? Math.min(8, Math.max(1, Math.floor(stratz.rank / 10))) : null}
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border px-4 py-4">
            <p className="text-sm text-muted-foreground">{t.deaths.noStratz}</p>
            <RequestStratzParse matchId={id} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t.matchDeaths.title}</h2>
        {deaths.length ? (
          <MatchDeaths players={deaths} heroes={heroes} initial={String(Math.max(0, mine))} />
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border px-4 py-4">
            <p className="text-sm text-muted-foreground">{t.deaths.noStratz}</p>
            <RequestStratzParse matchId={id} />
          </div>
        )}
      </section>

      <Draft match={match} stratz={stratz} heroes={heroes} t={t} lang={lang} />
    </div>
  );
}

// One match, for anyone: both teams' scoreboard and items, the gold and XP curves, the draft.
export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <Detail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

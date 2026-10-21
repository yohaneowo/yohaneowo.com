import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { getHeroes } from "@/lib/dota/data";
import { type GoatPlayer, getTeamView } from "@/lib/dota/goat";
import { getTeamPage, type TeamPage } from "@/lib/dota/pro";
import { cn } from "@/lib/utils";
import { ago, duration, HeroImage, Notice, ResultBadge } from "../../../parts";
import { AddManyToCompare, AddToCompare } from "../../compare-tray";
import { pct, PlayerCard, PsOnlyCard, TeamLogo } from "../../parts";
import { SeriesRow } from "../../series-row";
import { MonthlyChart, type MonthRow } from "./team-charts";
import { LoadingPanel } from "../../../loading-panel";

type T = Dictionary["dotahub"];
type Params = Promise<{ id: string }>;

// Any team id can be opened, so there is no static shell to prerender (as for a match).
export const instant = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  const id = Number((await params).id);
  const page = Number.isInteger(id) ? await getTeamPage(id).catch(() => null) : null;
  return { title: page ? `${page.team.name} · ${t.title}` : t.title };
}

const DAY = 86400;
const date = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

// The last 12 months, oldest first.
function months(matches: TeamPage["matches"], now: number): MonthRow[] {
  const rows: MonthRow[] = [];
  const d = new Date(now);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    rows.push({ month: m.toISOString().slice(0, 7), wins: 0, losses: 0 });
  }
  for (const match of matches) {
    const row = rows.find((r) => r.month === date(match.start).slice(0, 7));
    if (row) row[match.won ? "wins" : "losses"]++;
  }
  return rows;
}

// Groups by a key over the last year: games and wins each, most games first.
function tally<K>(
  matches: TeamPage["matches"],
  key: (m: TeamPage["matches"][number]) => K | null,
  now: number,
) {
  const by = new Map<K, { games: number; wins: number; first: TeamPage["matches"][number] }>();
  for (const m of matches) {
    if (m.start < now / 1000 - 365 * DAY) continue;
    const k = key(m);
    if (k == null) continue;
    const row = by.get(k) ?? { games: 0, wins: 0, first: m };
    row.games++;
    if (m.won) row.wins++;
    by.set(k, row);
  }
  return [...by.values()].sort((a, b) => b.games - a.games);
}

function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

async function Body({ params, t, lang }: { params: Params; t: T; lang: Locale }) {
  await connection();
  const g = t.goat;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [view, heroes] = await Promise.all([
    getTeamView(id),
    getHeroes().catch(() => ({}) as Awaited<ReturnType<typeof getHeroes>>),
  ]);
  if (view === undefined) return <Notice>{g.unavailable}</Notice>;
  if (view === null) return <Notice>{g.team.notFound}</Notice>;
  const { page, goat, odTeams, series, roster, stale, psOnly, details } = view;
  const { team, members, matches } = page;
  // "Now" for the month and year windows: when the data was fetched.
  const now = page.at;
  const gamesFor = (p: GoatPlayer) =>
    members.find((m) => p.accounts.some((a) => a.accountId === m.accountId));
  const rosterIds = new Set([...roster, ...stale].flatMap((p) => p.accounts.map((a) => a.accountId)));
  const former = members
    .filter((m) => !m.current && !rosterIds.has(m.accountId))
    .sort((a, b) => b.games - a.games)
    .slice(0, 16);
  const rank = goat?.rank;
  const games = team.wins + team.losses;
  const opponents = tally(matches, (m) => m.opponentId, now).slice(0, 10);
  const leagues = tally(matches, (m) => (m.leagueId ? m.leagueId : null), now).slice(0, 10);
  const firstMatch = matches.length ? matches[matches.length - 1].start : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={localePath(lang, "/dotahub/goat")}
          className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          {g.team.back}
        </Link>
        <header className="flex flex-wrap items-center gap-4 rounded-xl border bg-linear-to-br from-muted/60 to-transparent p-4">
          <TeamLogo src={team.logo ?? goat?.ps?.image ?? null} name={team.name} size={72} />
          <div className="min-w-60 flex-1">
            <h2 className="text-2xl font-bold">
              {team.name}
              {team.tag && <span className="ml-2 font-mono text-base text-muted-foreground">{team.tag}</span>}
            </h2>
            <p className="text-sm text-muted-foreground">
              {g.record(team.wins, team.losses)} · {g.winRate} {pct(team.wins, games)} · {g.lastMatch}{" "}
              {ago(team.lastMatch, t)}
              {firstMatch && ` · ${g.team.since(date(firstMatch))}`}
            </p>
            <p className="mt-1 flex flex-wrap gap-3 text-xs">
              <a
                href={`https://www.opendota.com/teams/${id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
              >
                OpenDota <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
              <a
                href={`https://stratz.com/teams/${id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
              >
                STRATZ <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
              <a
                href={`https://www.dotabuff.com/esports/teams/${id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
              >
                Dotabuff <ExternalLinkIcon className="size-3" aria-hidden />
              </a>
            </p>
          </div>
          <div className="flex gap-6 text-center">
            {rank && (
              <div>
                <p className="text-3xl font-black tabular-nums">#{rank}</p>
                <p className="text-xs text-muted-foreground">{g.place}</p>
              </div>
            )}
            <div>
              <p className="text-3xl font-black tabular-nums">{Math.round(team.rating)}</p>
              <p className="text-xs text-muted-foreground">{g.rating}</p>
            </div>
          </div>
        </header>
        <p className="text-xs text-muted-foreground">
          {g.updatedHourly(ago(page.at / 1000, t))}
          {goat?.ps ? ` · ${g.ps.source}` : ""}
        </p>
      </div>

      <Section title={g.team.currentRoster} hint={g.team.rosterHint}>
        {roster.length ? (
          <>
            <div>
              <AddManyToCompare
                label={g.team.addAll}
                picks={roster.map((p) => ({
                  id: p.accounts[0].accountId,
                  name: p.name,
                  avatar: details[p.accounts[0].accountId]?.avatar ?? p.accounts[0].avatar,
                }))}
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {roster.map((p) => {
                const m = gamesFor(p);
                return (
                  <PlayerCard
                    key={p.key}
                    player={p}
                    details={details}
                    t={t}
                    lang={lang}
                    note={
                      m ? `${g.team.gamesForTeam(m.games)} · ${g.winRate} ${pct(m.wins, m.games)}` : undefined
                    }
                  />
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{g.noRoster}</p>
        )}
      </Section>

      {psOnly.length > 0 && (
        <Section title={g.ps.psOnlyTitle} hint={g.ps.psOnlyHint}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {psOnly.map((p) => (
              <PsOnlyCard key={p.id} p={p} t={t} />
            ))}
          </div>
        </Section>
      )}

      {series && (series.upcoming.length > 0 || series.past.length > 0) && (
        <div className="grid gap-8 lg:grid-cols-2">
          <Section title={g.schedule.teamUpcoming} hint={g.schedule.teamHint}>
            {series.upcoming.length ? (
              <ul className="flex flex-col gap-2">
                {series.upcoming.slice(0, 6).map((m) => (
                  <SeriesRow key={m.id} m={m} t={t} lang={lang} odTeams={odTeams} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{g.schedule.none}</p>
            )}
          </Section>
          <Section title={g.schedule.teamPast}>
            <ul className="flex flex-col gap-2">
              {series.past.slice(0, 6).map((m) => (
                <SeriesRow key={m.id} m={m} t={t} lang={lang} odTeams={odTeams} />
              ))}
            </ul>
          </Section>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={g.team.monthly} hint={g.team.monthlyHint}>
          <MonthlyChart rows={months(matches, now)} />
        </Section>
        <Section title={g.team.heroes} hint={g.team.heroesHint}>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {page.heroes.slice(0, 14).map((h) => (
              <li key={h.heroId} className="flex items-center gap-2 text-sm">
                <HeroImage hero={heroes[h.heroId]} lang={lang} className="h-6 w-10 rounded-sm" />
                <span className="min-w-0 flex-1 truncate">{heroes[h.heroId]?.[lang] ?? h.heroId}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {h.games} {g.team.picks}
                </span>
                <span className="w-10 text-right text-xs tabular-nums">{pct(h.wins, h.games)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title={g.team.recentMatches}>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 font-normal">{g.team.result}</th>
                <th className="px-3 py-2 font-normal">{g.team.opponent}</th>
                <th className="px-3 py-2 font-normal">{g.team.score}</th>
                <th className="px-3 py-2 font-normal">{g.team.league}</th>
                <th className="px-3 py-2 text-right font-normal">{g.team.duration}</th>
                <th className="px-3 py-2 text-right font-normal">{g.lastMatch}</th>
              </tr>
            </thead>
            <tbody>
              {matches.slice(0, 20).map((m) => (
                <tr key={m.matchId} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-1.5">
                    <Link href={localePath(lang, `/dotahub/matches/${m.matchId}`)}>
                      <ResultBadge won={m.won} t={t} />
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">
                    {m.opponentId ? (
                      <Link
                        href={localePath(lang, `/dotahub/goat/teams/${m.opponentId}`)}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <TeamLogo src={m.opponentLogo} name={m.opponent ?? ""} size={20} />
                        <span className="truncate">{m.opponent}</span>
                      </Link>
                    ) : (
                      (m.opponent ?? "–")
                    )}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {m.score[0]} : {m.score[1]}
                  </td>
                  <td className="max-w-56 truncate px-3 py-1.5 text-xs text-muted-foreground">
                    {m.league ?? "–"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{duration(m.duration)}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                    <Link
                      href={localePath(lang, `/dotahub/matches/${m.matchId}`)}
                      className="hover:underline"
                    >
                      {ago(m.start, t)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={g.team.opponents} hint={g.team.opponentsHint}>
          <ul className="flex flex-col gap-1.5">
            {opponents.map((o) => (
              <li key={o.first.opponentId} className="flex items-center gap-2 text-sm">
                <TeamLogo src={o.first.opponentLogo} name={o.first.opponent ?? ""} size={22} />
                <Link
                  href={localePath(lang, `/dotahub/goat/teams/${o.first.opponentId}`)}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {o.first.opponent}
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {g.record(o.wins, o.games - o.wins)}
                </span>
                <span className="w-10 text-right text-xs tabular-nums">{pct(o.wins, o.games)}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={g.team.leagues} hint={g.team.leaguesHint}>
          <ul className="flex flex-col gap-1.5">
            {leagues.map((l) => (
              <li key={l.first.leagueId} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.first.league ?? l.first.leagueId}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {g.record(l.wins, l.games - l.wins)}
                </span>
                <span className="w-10 text-right text-xs tabular-nums">{pct(l.wins, l.games)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {stale.length > 0 && (
        <Section title={g.ps.staleTitle} hint={g.ps.staleHint}>
          <div className="grid gap-3 lg:grid-cols-2">
            {stale.map((p) => (
              <PlayerCard key={p.key} player={p} details={details} t={t} lang={lang} />
            ))}
          </div>
        </Section>
      )}

      {former.length > 0 && (
        <Section title={g.team.former} hint={g.team.formerHint}>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {former.map((m) => (
              <li
                key={m.accountId}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
              >
                <Link
                  href={localePath(lang, `/dotahub/players/${m.accountId}`)}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {m.name}
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {m.games} · {pct(m.wins, m.games)}
                </span>
                <AddToCompare
                  pick={{ id: m.accountId, name: m.name, avatar: null }}
                  className="px-1.5 py-0.5"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export default async function Page({ params }: { params: Params }) {
  const [dict, lang] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<LoadingPanel kind="goatTeam" />}>
      <Body params={params} t={dict.dotahub} lang={lang} />
    </Suspense>
  );
}

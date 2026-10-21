import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { UserPlusIcon, XIcon } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import {
  getHeroes,
  getPeers,
  getPlayer,
  getPlayerHeroes,
  getRecentMatches,
  getWinLoss,
  type HeroInfo,
  isRadiant,
  type PlayerHero,
  type PlayerMatch,
} from "@/lib/dota/data";
import { getProDetails, getProScene, type ProDetails } from "@/lib/dota/pro";
import { cn } from "@/lib/utils";
import { dotaViewer } from "../../account";
import { duration, HeroImage, Medal } from "../../parts";
import { compareHref, MAX_COMPARE } from "../compare-ids";
import { CopyValue } from "../copy-button";
import { pct, TeamLogo } from "../parts";
import { CompareRadar } from "./compare-radar";
import { SyncPicks } from "./sync-picks";

type T = Dictionary["dotahub"];
type SearchParams = Promise<{ ids?: string | string[] }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).dotahub.goat;
  return { title: `${t.compare.title} · ${t.title}` };
}

// A categorical order for up to four people (blue, amber, green, rose).
const COLORS = ["#2563eb", "#d97706", "#059669", "#e11d48"];

type Person = {
  id: number;
  name: string;
  avatar: string | null;
  team: { id: number; name: string; logo: string | null } | null;
  rankTier: number | null;
  leaderboard: number | null;
  details: ProDetails | undefined;
  wl: { win: number; lose: number } | null;
  recent: PlayerMatch[] | null;
  heroes: PlayerHero[] | null;
  me: boolean;
};

const avg = (ms: PlayerMatch[], f: (m: PlayerMatch) => number | undefined) => {
  const v = ms.map(f).filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const won = (m: PlayerMatch) => isRadiant(m.player_slot) === m.radiant_win;

function parseIds(raw: string | string[] | undefined) {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return [...new Set(text.split(",").map(Number))]
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_COMPARE);
}

async function load(
  id: number,
  me: boolean,
  scene: Awaited<ReturnType<typeof getProScene>> | null,
  details: Record<number, ProDetails>,
): Promise<Person> {
  const [player, wl, recent, heroes] = await Promise.all([
    getPlayer(id).catch(() => null),
    getWinLoss(id).catch(() => null),
    getRecentMatches(id).catch(() => null),
    getPlayerHeroes(id).catch(() => null),
  ]);
  const pro = scene?.players.find((p) => p.accounts.some((a) => a.accountId === id));
  const team = pro?.teamId ? scene?.teams.find((x) => x.id === pro.teamId) : undefined;
  const d = details[id];
  return {
    id,
    name: pro?.name ?? d?.persona ?? player?.data.profile?.personaname ?? String(id),
    avatar: d?.avatar ?? player?.data.profile?.avatarfull ?? pro?.accounts[0].avatar ?? null,
    team: team ? { id: team.id, name: team.name, logo: team.logo } : null,
    rankTier: player?.data.rank_tier ?? d?.seasonRank ?? null,
    leaderboard: player?.data.leaderboard_rank ?? d?.leaderboardRank ?? null,
    details: d,
    wl: wl?.data ?? null,
    recent: recent?.data ?? null,
    heroes: heroes?.data ?? null,
    me,
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

async function Body({ searchParams, t, lang }: { searchParams: SearchParams; t: T; lang: Locale }) {
  await connection();
  const g = t.goat.compare;
  const ids = parseIds((await searchParams).ids);
  const viewer = await dotaViewer();
  const mine = viewer.state === "linked" ? viewer.accountId : null;
  const addMe =
    mine && !ids.includes(mine) && ids.length < MAX_COMPARE
      ? localePath(lang, compareHref([mine, ...ids]))
      : null;

  if (!ids.length)
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <SyncPicks picks={[]} />
        <p className="text-sm text-muted-foreground">{g.empty}</p>
        {addMe && (
          <Link
            href={addMe}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <UserPlusIcon className="size-4" aria-hidden />
            {g.addMe}
          </Link>
        )}
      </div>
    );

  const [scene, details, heroInfo] = await Promise.all([
    getProScene().catch(() => null),
    getProDetails(ids).catch(() => ({}) as Record<number, ProDetails>),
    getHeroes().catch(() => ({}) as Record<number, HeroInfo>),
  ]);
  const people = await Promise.all(ids.map((id) => load(id, id === mine, scene, details)));
  const peers = await Promise.all(
    people.map((p) => (people.length > 1 ? getPeers(p.id).catch(() => null) : Promise.resolve(null))),
  );

  // The comparison rows: each person's value, the higher (or lower) one marked best.
  type Row = {
    label: string;
    values: (number | null)[];
    format: (v: number) => string;
    lowerBetter?: boolean;
  };
  const recentOf = (p: Person) => p.recent ?? [];
  const rows: { group: string; rows: Row[] }[] = [
    {
      group: g.overall,
      rows: [
        {
          label: g.matches,
          values: people.map((p) => (p.wl ? p.wl.win + p.wl.lose : null)),
          format: (v) => v.toLocaleString(),
        },
        {
          label: g.winRate,
          values: people.map((p) =>
            p.wl && p.wl.win + p.wl.lose ? p.wl.win / (p.wl.win + p.wl.lose) : null,
          ),
          format: (v) => `${(v * 100).toFixed(1)}%`,
        },
      ],
    },
    {
      group: g.recent,
      rows: [
        {
          label: g.recentWin,
          values: people.map((p) =>
            recentOf(p).length ? recentOf(p).filter(won).length / recentOf(p).length : null,
          ),
          format: (v) => `${Math.round(v * 100)}%`,
        },
        {
          label: g.kda,
          values: people.map((p) => {
            const r = recentOf(p);
            if (!r.length) return null;
            const k = avg(r, (m) => m.kills)!;
            const d = avg(r, (m) => m.deaths)!;
            const a = avg(r, (m) => m.assists)!;
            return (k + a) / Math.max(1, d);
          }),
          format: (v) => v.toFixed(2),
        },
        {
          label: g.kills,
          values: people.map((p) => avg(recentOf(p), (m) => m.kills)),
          format: (v) => v.toFixed(1),
        },
        {
          label: g.deaths,
          values: people.map((p) => avg(recentOf(p), (m) => m.deaths)),
          format: (v) => v.toFixed(1),
          lowerBetter: true,
        },
        {
          label: g.assists,
          values: people.map((p) => avg(recentOf(p), (m) => m.assists)),
          format: (v) => v.toFixed(1),
        },
        {
          label: g.gpm,
          values: people.map((p) => avg(recentOf(p), (m) => m.gold_per_min)),
          format: (v) => Math.round(v).toString(),
        },
        {
          label: g.xpm,
          values: people.map((p) => avg(recentOf(p), (m) => m.xp_per_min)),
          format: (v) => Math.round(v).toString(),
        },
        {
          label: g.lastHits,
          values: people.map((p) => avg(recentOf(p), (m) => m.last_hits)),
          format: (v) => Math.round(v).toString(),
        },
        {
          label: g.damage,
          values: people.map((p) => avg(recentOf(p), (m) => m.hero_damage)),
          format: (v) => Math.round(v).toLocaleString(),
        },
        {
          label: g.avgDuration,
          values: people.map((p) => avg(recentOf(p), (m) => m.duration)),
          format: (v) => duration(v),
        },
      ],
    },
  ];
  const radarRows = [
    rows[1].rows[0],
    rows[1].rows[1],
    rows[1].rows[5],
    rows[1].rows[6],
    rows[1].rows[7],
    rows[1].rows[8],
  ];

  // Heroes everyone has at least 10 matches on, by the fewest anyone has.
  const heroGames = people.map((p) => new Map((p.heroes ?? []).map((h) => [Number(h.hero_id), h])));
  const shared = [...(heroGames[0]?.keys() ?? [])]
    .filter((id) => heroGames.every((m) => (m.get(id)?.games ?? 0) >= 10))
    .sort(
      (a, b) =>
        Math.min(...heroGames.map((m) => m.get(b)!.games)) -
        Math.min(...heroGames.map((m) => m.get(a)!.games)),
    )
    .slice(0, 12);

  const pairs: { a: number; b: number }[] = [];
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) pairs.push({ a: i, b: j });
  const others = people
    .filter((p) => !p.me)
    .map((p) => p.id)
    .slice(0, 2);
  const cols = { gridTemplateColumns: `repeat(${people.length}, minmax(0, 1fr))` };

  return (
    <div className="flex flex-col gap-8">
      <SyncPicks picks={people.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{g.hint}</p>
        {addMe && (
          <Link
            href={addMe}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
          >
            <UserPlusIcon className="size-3.5" aria-hidden />
            {g.addMe}
          </Link>
        )}
      </div>

      <div className="grid gap-3" style={cols}>
        {people.map((p, i) => (
          <article
            key={p.id}
            className="relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center"
            style={{ borderTopColor: COLORS[i], borderTopWidth: 3 }}
          >
            <Link
              href={localePath(lang, compareHref(ids.filter((x) => x !== p.id)))}
              aria-label={g.removeHint}
              title={g.removeHint}
              className="absolute top-2 right-2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" aria-hidden />
            </Link>
            <span className="size-16 overflow-hidden rounded-xl bg-muted">
              {p.avatar && (
                <Image src={p.avatar} alt={p.name} width={64} height={64} unoptimized className="size-16" />
              )}
            </span>
            <Link
              href={localePath(lang, `/dotahub/players/${p.id}`)}
              className="max-w-full truncate font-semibold hover:underline"
            >
              {p.name}
            </Link>
            {p.details?.realName && (
              <p className="-mt-1.5 max-w-full truncate text-xs text-muted-foreground">
                {p.details.realName}
              </p>
            )}
            {p.team ? (
              <Link
                href={localePath(lang, `/dotahub/goat/teams/${p.team.id}`)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                <TeamLogo src={p.team.logo} name={p.team.name} size={16} />
                {p.team.name}
              </Link>
            ) : p.me ? (
              <span className="text-xs text-muted-foreground">{g.me}</span>
            ) : null}
            <span className="flex items-center gap-1">
              <Medal tier={p.rankTier} t={t} size={36} />
              {p.leaderboard ? (
                <span className="text-xs font-semibold tabular-nums">#{p.leaderboard}</span>
              ) : null}
            </span>
            <CopyValue value={String(p.id)} label={t.goat.account.accountId} />
          </article>
        ))}
      </div>

      <Section title={g.overall}>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th />
                {people.map((p, i) => (
                  <th
                    key={p.id}
                    className="px-3 py-2 text-right text-xs font-semibold"
                    style={{ color: COLORS[i] }}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((block) => (
                <BlockRows key={block.group} group={block.group} rows={block.rows} people={people} />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={g.radar} hint={g.radarHint}>
          <CompareRadar
            axes={radarRows.map((r) => r.label)}
            series={people.map((p, i) => ({
              name: p.name,
              color: COLORS[i],
              values: radarRows.map((r) => r.values[i]),
            }))}
          />
        </Section>
        <Section title={g.shared} hint={g.sharedHint}>
          {shared.length ? (
            <ul className="flex flex-col gap-1.5">
              {shared.map((id) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <HeroImage hero={heroInfo[id]} lang={lang} className="h-6 w-10 shrink-0 rounded-sm" />
                  <span className="w-24 truncate">{heroInfo[id]?.[lang] ?? id}</span>
                  <span className="grid flex-1 gap-1 text-xs tabular-nums" style={cols}>
                    {heroGames.map((m, i) => {
                      const h = m.get(id)!;
                      return (
                        <span key={i} style={{ color: COLORS[i] }}>
                          {h.games} · {pct(h.win, h.games)}
                        </span>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{g.noShared}</p>
          )}
        </Section>
      </div>

      <Section title={g.topHeroes}>
        <div className="grid gap-3" style={cols}>
          {people.map((p, i) => (
            <ul
              key={p.id}
              className="flex flex-col gap-1 rounded-lg border p-2"
              style={{ borderTopColor: COLORS[i], borderTopWidth: 3 }}
            >
              {(p.heroes ?? []).slice(0, 8).map((h) => (
                <li key={h.hero_id} className="flex items-center gap-2 text-xs">
                  <HeroImage
                    hero={heroInfo[Number(h.hero_id)]}
                    lang={lang}
                    className="h-5 w-9 shrink-0 rounded-sm"
                  />
                  <span className="min-w-0 flex-1 truncate">{heroInfo[Number(h.hero_id)]?.[lang]}</span>
                  <span className="text-muted-foreground tabular-nums">{h.games}</span>
                  <span className="w-9 text-right tabular-nums">{pct(h.win, h.games)}</span>
                </li>
              ))}
              {!p.heroes?.length && <li className="text-xs text-muted-foreground">{g.noData}</li>}
            </ul>
          ))}
        </div>
      </Section>

      {pairs.length > 0 && (
        <Section title={g.h2h} hint={g.h2hHint}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {pairs.map(({ a, b }) => {
              const peer = peers[a]?.find((x) => x.account_id === people[b].id);
              return (
                <li key={`${a}-${b}`} className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    <span style={{ color: COLORS[a] }}>{people[a].name}</span> ×{" "}
                    <span style={{ color: COLORS[b] }}>{people[b].name}</span>
                  </p>
                  {peer && (peer.with_games || peer.against_games) ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span>
                        {g.together}: <b className="tabular-nums">{peer.with_games}</b> ·{" "}
                        {pct(peer.with_win, peer.with_games)}
                      </span>
                      <span>
                        {g.against}: <b className="tabular-nums">{peer.against_games}</b> ·{" "}
                        {pct(peer.against_win, peer.against_games)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{peers[a] ? g.never : g.noData}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {others.length > 0 && (
        <Section title={g.deeper} hint={g.deeperHint}>
          <div className="flex flex-wrap gap-2">
            <Link
              href={localePath(lang, `/dotahub/economy?vs=${others.join(",")}`)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              {g.economy}
            </Link>
            <Link
              href={localePath(lang, `/dotahub/imp?vs=${others.join(",")}`)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              {g.imp}
            </Link>
          </div>
        </Section>
      )}
    </div>
  );
}

function BlockRows({
  group,
  rows,
  people,
}: {
  group: string;
  rows: { label: string; values: (number | null)[]; format: (v: number) => string; lowerBetter?: boolean }[];
  people: Person[];
}) {
  return (
    <>
      <tr className="border-b bg-muted/40">
        <th
          colSpan={people.length + 1}
          className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground"
        >
          {group}
        </th>
      </tr>
      {rows.map((r) => {
        const present = r.values.filter((v): v is number => v != null);
        const best =
          present.length > 1 ? (r.lowerBetter ? Math.min(...present) : Math.max(...present)) : null;
        return (
          <tr key={r.label} className="border-b last:border-0">
            <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.label}</td>
            {r.values.map((v, i) => (
              <td
                key={people[i].id}
                className={cn(
                  "px-3 py-1.5 text-right tabular-nums",
                  v != null && v === best && "font-semibold text-amber-600 dark:text-amber-400",
                )}
              >
                {v == null ? "–" : r.format(v)}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const [dict, lang] = await Promise.all([getDictionary(), getLocale()]);
  const g = dict.dotahub.goat.compare;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{g.title}</h2>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
        <Body searchParams={searchParams} t={dict.dotahub} lang={lang} />
      </Suspense>
    </div>
  );
}

"use client";

import { useDeferredValue, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarIcon, SearchIcon, ShieldIcon } from "lucide-react";
import { motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { LocalTime } from "./local-time";

export type GridTeam = {
  id: number;
  rank: number;
  name: string;
  tag: string;
  logo: string | null;
  rating: number | null;
  wins: number;
  losses: number;
  lastMatch: string;
  // The team's next (or current) series on PandaScore's schedule.
  next: { live: boolean; begin: string | null; opponent: string; bestOf: number } | null;
  roster: { id: number; name: string; avatar: string | null; accounts: number[] }[];
};

const PODIUM = [
  "border-amber-400/70 shadow-[0_0_24px_-8px] shadow-amber-400/60",
  "border-zinc-300/70 dark:border-zinc-400/60",
  "border-orange-700/50",
];

// The active teams as cards (place, logo, rating, record, current five), with a search over teams,
// players and account IDs.
export function TeamGrid({ teams }: { teams: GridTeam[] }) {
  const { t, href } = useLocale();
  const g = t.dotahub.goat;
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const shown = q
    ? teams.filter(
        (team) =>
          team.name.toLowerCase().includes(q) ||
          team.tag.toLowerCase().includes(q) ||
          team.roster.some(
            (p) => p.name.toLowerCase().includes(q) || p.accounts.some((id) => String(id) === q),
          ),
      )
    : teams;

  return (
    <div className="flex flex-col gap-3">
      <label className="relative max-w-sm">
        <SearchIcon
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={g.search}
          aria-label={g.search}
          className="h-9 w-full rounded-md border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      {shown.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((team, i) => {
            const games = team.wins + team.losses;
            return (
              <motion.li
                key={team.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}
              >
                <Link
                  href={href(`/dotahub/goat/teams/${team.id}`)}
                  className={cn(
                    "group flex h-full flex-col gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40",
                    !q && PODIUM[team.rank - 1],
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 shrink-0 text-center text-lg font-black text-muted-foreground tabular-nums">
                      {team.rank}
                    </span>
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/60">
                      {team.logo ? (
                        <Image
                          src={team.logo}
                          alt={team.name}
                          width={48}
                          height={48}
                          unoptimized
                          className="size-full object-contain transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <ShieldIcon className="size-6 text-muted-foreground" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{team.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {team.tag && <span className="mr-1.5 font-mono">{team.tag}</span>}
                        {g.lastMatch} {team.lastMatch}
                      </p>
                    </div>
                    {team.rating != null && (
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold tabular-nums">{Math.round(team.rating)}</p>
                        <p className="text-[11px] text-muted-foreground">{g.rating}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{g.record(team.wins, team.losses)}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-red-500/30">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${games ? (team.wins / games) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{games ? Math.round((team.wins / games) * 100) : 0}%</span>
                  </div>
                  {team.next && (
                    <p className="flex items-center gap-1.5 text-xs">
                      {team.next.live ? (
                        <span className="rounded bg-red-500/15 px-1.5 font-semibold text-red-600 dark:text-red-400">
                          LIVE
                        </span>
                      ) : (
                        <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden />
                      )}
                      <span className="text-muted-foreground">{g.schedule.next}</span>
                      <span className="min-w-0 truncate font-medium">
                        {g.schedule.vs} {team.next.opponent}
                      </span>
                      <span className="ml-auto shrink-0 text-muted-foreground">
                        {!team.next.live && team.next.begin && <LocalTime iso={team.next.begin} />}{" "}
                        {g.schedule.bo(team.next.bestOf)}
                      </span>
                    </p>
                  )}
                  {team.roster.length ? (
                    <ul className="grid grid-cols-5 gap-1">
                      {team.roster.slice(0, 5).map((p) => (
                        <li key={p.id} className="flex min-w-0 flex-col items-center gap-1">
                          <span className="size-9 overflow-hidden rounded-full border bg-muted">
                            {p.avatar && (
                              <Image
                                src={p.avatar}
                                alt=""
                                width={36}
                                height={36}
                                unoptimized
                                className="size-9 object-cover object-top"
                              />
                            )}
                          </span>
                          <span className="w-full truncate text-center text-[11px]">{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">{g.noRoster}</p>
                  )}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">{g.noResults}</p>
      )}
    </div>
  );
}

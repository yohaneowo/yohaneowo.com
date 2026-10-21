"use client";

import { Fragment, useDeferredValue, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { AddToCompare } from "../compare-tray";
import { CopyValue } from "../copy-button";

export type DirectoryRow = {
  key: string;
  name: string;
  avatar: string | null;
  // PandaScore's real name, and whether PandaScore leaves them off the team's roster.
  real: string | null;
  stale: boolean;
  country: string | null;
  role: number;
  team: { id: number; name: string; logo: string | null; rank: number } | null;
  lastMatch: number;
  accounts: { id: number; persona: string | null; lastPlayed: string }[];
};

type Sort = "team" | "recent" | "name" | "accounts";
const PAGE = 60;

// Every current pro (OpenDota's register): search, filter by role, country and team, sort, and
// open a row for all of the player's accounts.
export function PlayerDirectory({ rows }: { rows: DirectoryRow[] }) {
  const { t, href } = useLocale();
  const g = t.dotahub.goat;
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(0);
  const [country, setCountry] = useState("");
  const [sort, setSort] = useState<Sort>("team");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());

  const countries = [...new Set(rows.map((r) => r.country).filter((c): c is string => !!c))].sort();
  const shown = rows
    .filter(
      (r) =>
        (!role || r.role === role) &&
        (!country || r.country === country) &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          r.real?.toLowerCase().includes(q) ||
          r.team?.name.toLowerCase().includes(q) ||
          r.accounts.some((a) => String(a.id) === q || a.persona?.toLowerCase().includes(q))),
    )
    .sort((a, b) => {
      if (sort === "recent") return b.lastMatch - a.lastMatch;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "accounts") return b.accounts.length - a.accounts.length;
      return (a.team?.rank ?? 999) - (b.team?.rank ?? 999) || b.lastMatch - a.lastMatch;
    });

  const select = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1 sm:max-w-sm">
          <SearchIcon
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={g.search}
            aria-label={g.search}
            className="h-9 w-full rounded-md border bg-background pr-3 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <select
          value={role}
          onChange={(e) => setRole(Number(e.target.value))}
          className={select}
          aria-label={g.account.position}
        >
          <option value={0}>{g.players.allRoles}</option>
          <option value={1}>{g.account.core}</option>
          <option value={2}>{g.account.support}</option>
        </select>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={select}
          aria-label={g.players.country}
        >
          <option value="">{g.players.allCountries}</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={select}
          aria-label={g.players.sort}
        >
          <option value="team">{g.players.sorts.team}</option>
          <option value="recent">{g.players.sorts.recent}</option>
          <option value="name">{g.players.sorts.name}</option>
          <option value="accounts">{g.players.sorts.accounts}</option>
        </select>
        <span className="text-xs text-muted-foreground tabular-nums">{g.players.count(shown.length)}</span>
      </div>

      {shown.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 font-normal">{g.players.player}</th>
                <th className="px-3 py-2 font-normal">{g.players.team}</th>
                <th className="px-3 py-2 font-normal">{g.account.position}</th>
                <th className="px-3 py-2 font-normal">{g.account.accountId}</th>
                <th className="px-3 py-2 text-right font-normal">{g.lastMatch}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((r) => {
                const expanded = open === r.key;
                return (
                  <Fragment key={r.key}>
                    <tr className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <span className="size-7 shrink-0 overflow-hidden rounded-full bg-muted">
                            {r.avatar && (
                              <Image
                                src={r.avatar}
                                alt=""
                                width={28}
                                height={28}
                                unoptimized
                                className="size-7 object-cover object-top"
                              />
                            )}
                          </span>
                          <Link
                            href={href(`/dotahub/players/${r.accounts[0].id}`)}
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                          {r.real && (
                            <span className="hidden text-xs text-muted-foreground md:inline">{r.real}</span>
                          )}
                          {r.country && /^[a-z]{2}$/.test(r.country) && (
                            <Image
                              src={`https://flagcdn.com/w40/${r.country}.png`}
                              alt={r.country.toUpperCase()}
                              title={r.country.toUpperCase()}
                              width={20}
                              height={14}
                              unoptimized
                              className="h-3.5 w-5 rounded-[2px] object-cover"
                            />
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        {r.team ? (
                          <Link
                            href={href(`/dotahub/goat/teams/${r.team.id}`)}
                            className="flex items-center gap-1.5 hover:underline"
                          >
                            {r.team.logo && (
                              <Image
                                src={r.team.logo}
                                alt=""
                                width={18}
                                height={18}
                                unoptimized
                                className="size-4.5 object-contain"
                              />
                            )}
                            <span className="max-w-40 truncate">{r.team.name}</span>
                            {r.stale && (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                {g.ps.stale}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">{g.account.freeAgent}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {r.role === 1 ? g.account.core : r.role === 2 ? g.account.support : "–"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-1">
                          <CopyValue value={String(r.accounts[0].id)} label={g.account.accountId} />
                          {r.accounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setOpen(expanded ? null : r.key)}
                              aria-expanded={expanded}
                              className="inline-flex cursor-pointer items-center gap-0.5 rounded-full border px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              {g.account.accounts(r.accounts.length)}
                              <ChevronDownIcon
                                className={cn("size-3 transition-transform", expanded && "rotate-180")}
                                aria-hidden
                              />
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                        {r.accounts[0].lastPlayed}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <AddToCompare pick={{ id: r.accounts[0].id, name: r.name, avatar: r.avatar }} />
                      </td>
                    </tr>
                    {expanded &&
                      r.accounts.map((a, i) => (
                        <tr key={a.id} className="border-b bg-muted/20 text-xs">
                          <td className="py-1 pr-3 pl-12 text-muted-foreground">
                            {i === 0 ? g.account.main : g.account.alt}
                            {a.persona && <span className="ml-2 text-foreground">{a.persona}</span>}
                          </td>
                          <td />
                          <td />
                          <td className="px-3 py-1">
                            <CopyValue value={String(a.id)} label={g.account.accountId} />
                          </td>
                          <td className="px-3 py-1 text-right text-muted-foreground">{a.lastPlayed}</td>
                          <td className="px-3 py-1 text-right">
                            <Link
                              href={href(`/dotahub/players/${a.id}`)}
                              className="text-muted-foreground hover:underline"
                            >
                              {g.account.openHub}
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">{g.noResults}</p>
      )}
      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit(limit + PAGE)}
          className="cursor-pointer self-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          {g.players.more(shown.length - limit)}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLinkIcon, TrophyIcon, UserIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import type { Era } from "@/lib/dota/legends";
import { cn } from "@/lib/utils";
import { Medal } from "../../parts";
import { AddToCompare } from "../compare-tray";
import { CopyValue } from "../copy-button";

export type LegendCard = {
  name: string;
  real: string;
  account: number;
  era: Era;
  ti: { year: number; team: string }[];
  known: string | null;
  team: { id: number; name: string } | null;
  photo: string | null;
  persona: string | null;
  seasonRank: number | null;
  leaderboardRank: number | null;
  matches: number | null;
  // How long ago the newest match was (worked out on the server), and whether it's recent.
  lastPlayed: string | null;
  recent: boolean;
};

const ERAS: (Era | "all")[] = ["all", "early", "middle", "recent", "icon"];

// The legends as cards: who they are, their TIs, whether they still play, and their account (to
// copy, open or compare). By era; the ones still on a top team only when asked for.
export function LegendBoard({ cards }: { cards: LegendCard[] }) {
  const { t, href } = useLocale();
  const g = t.dotahub.goat;
  const l = g.legends;
  const [era, setEra] = useState<Era | "all">("all");
  const [showActive, setShowActive] = useState(false);
  const shown = cards.filter((c) => (era === "all" || c.era === era) && (showActive || !c.team));
  const hiddenActive = cards.filter((c) => (era === "all" || c.era === era) && c.team).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
          {ERAS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={era === e}
              onClick={() => setEra(e)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 transition-colors",
                era === e
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.eras[e]}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={showActive} onChange={(e) => setShowActive(e.target.checked)} />
          {l.showActive(hiddenActive)}
        </label>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{l.count(shown.length)}</span>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <li key={c.account} className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex items-start gap-3">
              <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {c.photo ? (
                  <Image
                    src={c.photo}
                    alt={c.name}
                    width={64}
                    height={64}
                    unoptimized
                    className="size-16 object-cover object-top"
                  />
                ) : (
                  <span className="flex size-16 items-center justify-center">
                    <UserIcon className="size-6 text-muted-foreground" aria-hidden />
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={href(`/dotahub/players/${c.account}`)}
                  className="text-lg font-bold hover:underline"
                >
                  {c.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{c.real}</p>
                <p className="mt-1 text-xs">
                  {c.team ? (
                    <Link
                      href={href(`/dotahub/goat/teams/${c.team.id}`)}
                      className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 hover:underline dark:text-sky-300"
                    >
                      {l.active(c.team.name)}
                    </Link>
                  ) : c.recent ? (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                      {l.stillPlays(c.lastPlayed ?? "")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {c.lastPlayed ? l.lastSeen(c.lastPlayed) : l.unknown}
                    </span>
                  )}
                </p>
              </div>
              {c.seasonRank ? (
                <span className="flex shrink-0 flex-col items-center">
                  <Medal tier={c.seasonRank} t={t.dotahub} size={36} />
                  {c.leaderboardRank ? (
                    <span className="text-[11px] font-semibold tabular-nums">#{c.leaderboardRank}</span>
                  ) : null}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1">
              {c.ti.map((ti) => (
                <span
                  key={ti.year}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                >
                  <TrophyIcon className="size-3" aria-hidden />
                  {l.ti(ti.year, ti.team)}
                </span>
              ))}
              {c.known && <span className="text-xs text-muted-foreground">{c.known}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">{g.account.accountId}</span>
              <CopyValue value={String(c.account)} label={g.account.accountId} />
              {c.persona && <span className="max-w-32 truncate">{c.persona}</span>}
              {c.matches != null && (
                <span className="ml-auto text-muted-foreground tabular-nums">{l.matches(c.matches)}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <AddToCompare pick={{ id: c.account, name: c.name, avatar: c.photo }} />
              <Link
                href={href(`/dotahub/economy?vs=${c.account}`)}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {g.account.economyVs}
              </Link>
              <Link
                href={href(`/dotahub/imp?vs=${c.account}`)}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {g.account.impVs}
              </Link>
              <span className="ml-auto flex gap-2">
                {[
                  ["OpenDota", `https://www.opendota.com/players/${c.account}`],
                  ["STRATZ", `https://stratz.com/players/${c.account}`],
                ].map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {label}
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                ))}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

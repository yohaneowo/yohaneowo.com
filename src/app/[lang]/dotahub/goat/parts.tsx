import Image from "next/image";
import Link from "next/link";
import { ExternalLinkIcon, ShieldIcon } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProDetails, ProPlayer } from "@/lib/dota/pro";
import { cn } from "@/lib/utils";
import { ago, Medal } from "../parts";
import { AddToCompare } from "./compare-tray";
import { CopyValue } from "./copy-button";

type T = Dictionary["dotahub"];

export function TeamLogo({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/60"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          unoptimized
          className="size-full object-contain"
        />
      ) : (
        <ShieldIcon className="size-1/2 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

// A country's flag (flagcdn's pictures: emoji flags don't show on Windows).
export function Flag({ code }: { code: string | null }) {
  if (!code || !/^[a-z]{2}$/.test(code)) return null;
  return (
    <Image
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={code.toUpperCase()}
      title={code.toUpperCase()}
      width={20}
      height={14}
      unoptimized
      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover"
    />
  );
}

// STRATZ's position (1–5) when it has one, else OpenDota's core / support.
export function positionLabel(position: number | null | undefined, role: number, t: T) {
  if (position) return t.stats.positions[position - 1];
  if (role === 1) return t.goat.account.core;
  if (role === 2) return t.goat.account.support;
  return null;
}

const pct = (wins: number, games: number) => (games ? `${Math.round((wins / games) * 100)}%` : "–");
export { pct };

const href = (link: string, base: string) =>
  /^https?:\/\//.test(link) ? link : `${base}${link.replace(/^@/, "")}`;

function Out({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      {children}
      <ExternalLinkIcon className="size-3" aria-hidden />
    </a>
  );
}

// A player and every account of theirs: the point of GOAT. The first account is the main one
// (played last); each shows its ID (copyable), Steam name and when it last played.
export function PlayerCard({
  player,
  details,
  t,
  lang,
  team,
  note,
}: {
  player: ProPlayer;
  details: Record<number, ProDetails>;
  t: T;
  lang: Locale;
  // The team's name, when the card isn't on the team's own page.
  team?: { id: number; name: string; logo: string | null } | null;
  // A line under the name (matches for the team…).
  note?: string;
}) {
  const g = t.goat.account;
  const main = player.accounts[0];
  const info = details[main.accountId];
  const position = positionLabel(info?.position, player.role, t);
  const avatar = info?.avatar ?? main.avatar;
  return (
    <article className="flex flex-col gap-3 rounded-xl border p-3">
      <header className="flex items-start gap-3">
        <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
          {avatar && (
            <Image src={avatar} alt={player.name} width={56} height={56} unoptimized className="size-14" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={localePath(lang, `/dotahub/players/${main.accountId}`)}
              className="truncate text-base font-semibold hover:underline"
            >
              {player.name}
            </Link>
            <Flag code={player.country} />
            {position && (
              <span className="rounded-full border px-1.5 text-[11px] text-muted-foreground">{position}</span>
            )}
          </div>
          {(info?.realName || info?.sponsor) && (
            <p className="truncate text-xs text-muted-foreground">
              {[info?.realName, info?.sponsor && `${g.sponsor}: ${info.sponsor}`].filter(Boolean).join(" · ")}
            </p>
          )}
          {team !== undefined && (
            <p className="truncate text-xs text-muted-foreground">
              {team ? (
                <Link href={localePath(lang, `/dotahub/goat/teams/${team.id}`)} className="hover:underline">
                  {team.name}
                </Link>
              ) : (
                g.freeAgent
              )}
            </p>
          )}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
        {info?.seasonRank ? (
          <span className="flex shrink-0 flex-col items-center">
            <Medal tier={info.seasonRank} t={t} size={40} />
            {info.leaderboardRank ? (
              <span
                className="text-[11px] font-semibold tabular-nums"
                title={g.leaderboard(info.leaderboardRank)}
              >
                #{info.leaderboardRank}
              </span>
            ) : null}
          </span>
        ) : null}
      </header>

      <ul className="flex flex-col divide-y rounded-lg border text-sm">
        {player.accounts.map((a, i) => {
          const d = details[a.accountId];
          return (
            <li key={a.accountId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1.5">
              <span
                className={cn(
                  "rounded px-1.5 text-[10px] leading-4 font-medium",
                  i === 0
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {i === 0 ? g.main : g.alt}
              </span>
              <Link
                href={localePath(lang, `/dotahub/players/${a.accountId}`)}
                className="max-w-40 truncate text-xs hover:underline"
                title={g.persona}
              >
                {d?.persona ?? a.persona ?? a.name}
              </Link>
              <CopyValue value={String(a.accountId)} label={g.accountId} />
              {d?.leaderboardRank && i > 0 ? (
                <span className="text-[11px] text-muted-foreground tabular-nums">#{d.leaderboardRank}</span>
              ) : null}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {d?.anonymous ? g.anonymous : a.lastMatch ? g.lastPlayed(ago(a.lastMatch, t)) : g.never}
              </span>
            </li>
          );
        })}
      </ul>

      <footer className="flex flex-wrap items-center gap-1.5">
        <AddToCompare pick={{ id: main.accountId, name: player.name, avatar }} />
        <Link
          href={localePath(lang, `/dotahub/economy?vs=${main.accountId}`)}
          className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {g.economyVs}
        </Link>
        <Link
          href={localePath(lang, `/dotahub/imp?vs=${main.accountId}`)}
          className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {g.impVs}
        </Link>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Out to={`https://www.opendota.com/players/${main.accountId}`}>OpenDota</Out>
          <Out to={`https://stratz.com/players/${main.accountId}`}>STRATZ</Out>
          <Out to={`https://www.dotabuff.com/players/${main.accountId}`}>Dotabuff</Out>
          {(main.profile || main.steamId) && (
            <Out to={main.profile ?? `https://steamcommunity.com/profiles/${main.steamId}`}>Steam</Out>
          )}
          {info?.twitch && <Out to={href(info.twitch, "https://twitch.tv/")}>Twitch</Out>}
          {info?.twitter && <Out to={href(info.twitter, "https://x.com/")}>X</Out>}
        </span>
      </footer>
    </article>
  );
}

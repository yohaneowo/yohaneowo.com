"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import type { LiveGame } from "@/lib/dota/pro";
import { cn } from "@/lib/utils";
import { duration, HeroImage } from "../../parts";
import { AddToCompare } from "../compare-tray";
import { CopyValue } from "../copy-button";

const ATTR_ICONS = ["strength", "agility", "intelligence", "universal"].map(
  (name) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_${name}.png`,
);

const gold = (n: number) =>
  Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1)}k` : String(Math.abs(n));

function Side({
  game,
  radiant,
  heroes,
  picked,
}: {
  game: LiveGame;
  radiant: boolean;
  heroes: Record<number, HeroInfo>;
  // The rows to light up: players on a picked hero.
  picked: (p: LiveGame["players"][number]) => boolean;
}) {
  const { t, lang, href } = useLocale();
  const g = t.dotahub.goat.live;
  const team = radiant ? game.radiantTeam : game.direTeam;
  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          "text-xs font-medium",
          radiant ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        )}
      >
        {team ?? (radiant ? g.radiant : g.dire)}
      </p>
      <ul className="flex flex-col gap-1">
        {game.players
          .filter((p) => p.radiant === radiant)
          .map((p) => (
            <li
              key={`${p.accountId}-${p.heroId}`}
              className={cn(
                "-mx-1 flex items-center gap-2 rounded px-1 text-sm",
                picked(p) && "bg-amber-500/15 ring-1 ring-amber-500/50",
              )}
            >
              <HeroImage hero={heroes[p.heroId]} lang={lang} className="h-6 w-10 shrink-0 rounded-sm" />
              {p.accountId ? (
                <Link
                  href={href(`/dotahub/players/${p.accountId}`)}
                  className={cn(
                    "min-w-0 flex-1 truncate hover:underline",
                    p.pro ? "font-semibold" : "text-muted-foreground",
                  )}
                >
                  {p.name ?? heroes[p.heroId]?.[lang] ?? p.accountId}
                  {p.pro && p.teamName && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{p.teamName}</span>
                  )}
                </Link>
              ) : (
                <span className="flex-1 text-muted-foreground">{heroes[p.heroId]?.[lang]}</span>
              )}
              {p.pro && p.accountId > 0 && (
                <AddToCompare
                  pick={{ id: p.accountId, name: p.name ?? String(p.accountId), avatar: null }}
                  className="px-1.5 py-0.5"
                />
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}

// The live games with pros, and above them every hero as an icon to filter by: pick one or more and
// only the games where someone (a pro, unless widened to everyone) plays one of them stay, with
// that player lit up. Heroes nobody is on right now are greyed out.
export function LiveBoard({ games, heroes }: { games: LiveGame[]; heroes: Record<number, HeroInfo> }) {
  const { t, lang } = useLocale();
  const g = t.dotahub.goat.live;
  const [picked, setPicked] = useState<number[]>([]);
  const [prosOnly, setProsOnly] = useState(true);

  const counts = new Map<number, number>();
  for (const game of games) {
    const on = new Set(game.players.filter((p) => !prosOnly || p.pro).map((p) => p.heroId));
    for (const hero of on) counts.set(hero, (counts.get(hero) ?? 0) + 1);
  }
  const lit = (p: LiveGame["players"][number]) => picked.includes(p.heroId) && (!prosOnly || p.pro);
  const shown = picked.length ? games.filter((game) => game.players.some(lit)) : games;
  const groups = t.dotahub.deaths.attrs.map((name, attr) => ({
    name,
    attr,
    heroes: Object.entries(heroes)
      .filter(([, hero]) => hero.attr === attr)
      .map(([id, hero]) => ({ id: Number(id), hero }))
      .sort((a, b) => a.hero[lang].localeCompare(b.hero[lang], lang === "zh" ? "zh-Hans-CN" : "en")),
  }));
  const toggle = (id: number) =>
    setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-2 rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{g.filter}</span>
          <div role="group" className="flex gap-0.5 rounded-lg bg-muted p-0.5 text-xs">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={prosOnly === v}
                onClick={() => setProsOnly(v)}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-0.5",
                  prosOnly === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                )}
              >
                {v ? g.prosOnly : g.everyone}
              </button>
            ))}
          </div>
          {picked.length > 0 && (
            <>
              <span className="flex flex-wrap items-center gap-1">
                {picked.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 py-0.5 pr-1.5 pl-0.5 text-xs"
                  >
                    {heroes[id] && (
                      <Image
                        src={heroes[id].icon}
                        alt=""
                        width={18}
                        height={18}
                        unoptimized
                        className="size-4.5"
                      />
                    )}
                    {heroes[id]?.[lang]}
                    <XIcon className="size-3" aria-hidden />
                  </button>
                ))}
              </span>
              <button
                type="button"
                onClick={() => setPicked([])}
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              >
                {g.clear}
              </button>
            </>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {g.showing(shown.length, games.length)}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <div key={group.attr} className="flex items-start gap-2">
              <Image
                src={ATTR_ICONS[group.attr]}
                alt={group.name}
                title={group.name}
                width={18}
                height={18}
                unoptimized
                className="mt-2 size-4.5 shrink-0"
              />
              <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1">
                {group.heroes.map(({ id, hero }) => {
                  const n = counts.get(id) ?? 0;
                  const on = picked.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!n && !on}
                      onClick={() => toggle(id)}
                      aria-pressed={on}
                      aria-label={`${hero[lang]}${n ? ` (${n})` : ""}`}
                      title={n ? `${hero[lang]} · ${g.heroGames(n)}` : `${hero[lang]} · ${g.nobody}`}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded-md border transition",
                        on ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500" : "border-transparent",
                        n ? "cursor-pointer hover:bg-muted" : "opacity-20 grayscale",
                      )}
                    >
                      <Image src={hero.icon} alt="" width={28} height={28} unoptimized className="size-7" />
                      {n > 0 && (
                        <span className="absolute -right-0.5 -bottom-0.5 rounded bg-background px-0.5 text-[10px] leading-tight tabular-nums">
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {shown.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {shown.map((game) => {
              const lead = game.radiantLead;
              return (
                <motion.li
                  key={game.matchId}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                  className="flex flex-col gap-3 rounded-xl border p-3"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="rounded bg-red-500/15 px-1.5 font-semibold text-red-600 dark:text-red-400">
                      LIVE
                    </span>
                    <span className="font-mono text-sm text-foreground tabular-nums">
                      {duration(Math.max(0, game.gameTime))}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400">{game.radiantScore}</span> :{" "}
                      <span className="text-red-600 dark:text-red-400">{game.direScore}</span>
                    </span>
                    <span>{lead === 0 ? g.even : g.lead(lead > 0 ? g.radiant : g.dire, gold(lead))}</span>
                    {game.averageMmr && <span>{g.averageMmr(game.averageMmr)}</span>}
                    <span>{game.leagueId ? `${g.league} ${game.leagueId}` : g.pub}</span>
                    {game.spectators > 0 && <span>{g.spectators(game.spectators)}</span>}
                    {/* The match ID, to search in the game's Watch tab. */}
                    <span className="ml-auto flex items-center gap-0.5" title={g.matchIdHint}>
                      {g.matchId}
                      <CopyValue value={game.matchId} label={g.matchId} />
                    </span>
                  </div>
                  {/* The gold lead as a bar: green to the left for Radiant, red to the right for Dire. */}
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "absolute top-0 h-full",
                        lead >= 0 ? "right-1/2 bg-emerald-500" : "left-1/2 bg-red-500",
                      )}
                      style={{ width: `${Math.min(50, (Math.abs(lead) / 30000) * 50)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Side game={game} radiant heroes={heroes} picked={lit} />
                    <Side game={game} radiant={false} heroes={heroes} picked={lit} />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
          {games.length ? g.noMatch : g.none}
        </p>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon, PlusIcon, UserIcon, UsersIcon, XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { HeroPicker } from "../../deaths/hero-picker";
import { Medal, medalName } from "../../parts";
import { GoatTab } from "./goat-tab";
import { MAX_TARGETS, ME_COLOR, parseAccount, parseRankKey, rankKey, type SeriesKind } from "./series";

export type CompareTarget = {
  key: string;
  kind: SeriesKind;
  label: string;
  color: string;
  avatar: string | null;
  tier: number | null;
  heroId: number | null;
};

type Peer = { id: number; name: string; avatar: string | null; games: number };

// What the server hands the page for the compare menu (the hero and position come from the page's
// filters).
export type CompareProps = {
  // The economy page's own address (the language prefix included).
  path: string;
  ownerId: number;
  me: { label: string; avatar: string | null; tier: number | null };
  targets: CompareTarget[];
  peers: Peer[];
  bracketAvailable: boolean;
  myTier: number | null;
};

const isCrowdKind = (kind: SeriesKind) => kind === "bracket" || kind === "rank";

// A round face: a player's avatar, a crowd's medal in a dashed ring (我的对局 unranked: people).
function Face({
  avatar,
  tier,
  color,
  crowd,
  size = 32,
}: {
  avatar?: string | null;
  tier?: number | null;
  color?: string;
  crowd?: boolean;
  size?: number;
}) {
  const { t: dict } = useLocale();
  const ring = color ? { boxShadow: `0 0 0 2px ${color}` } : undefined;
  if (crowd)
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-muted/40"
        style={{ width: size, height: size, borderColor: color }}
      >
        {tier ? (
          <Medal tier={Math.floor(tier / 10) * 10} t={dict.dotahub} size={size - 4} />
        ) : (
          <UsersIcon className="size-3.5 text-muted-foreground" aria-hidden />
        )}
      </span>
    );
  return avatar ? (
    <Image
      src={avatar}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, ...ring }}
    />
  ) : (
    // No avatar (the profile couldn't be read): a round placeholder with a person in it.
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      style={{ width: size, height: size, ...ring }}
    >
      <UserIcon className="size-1/2" aria-hidden />
    </span>
  );
}

// Who to compare with: the page's player VS up to two others, picked from a menu of friends (the
// people played with most, or a pasted id), pros (GOAT's teams) and ranks (that rank's players of the hero in the
// filters, or 我的对局: the other nine of the player's own matches). In the side panel just the
// faces (names on hover); above the content on narrower screens, with names. The choice lives in
// the address (?vs=…).
export function CompareMenu({
  path,
  ownerId,
  me,
  targets,
  peers,
  bracketAvailable,
  myTier,
  heroes,
  hero,
  position,
  counts,
  onHero,
  busy = null,
  variant,
}: CompareProps & {
  heroes: Record<number, HeroInfo>;
  // The page's hero and position filters (0: all): the rank's hero starts on the filter's.
  hero: number;
  position: number;
  // Matches per hero in the page's range (for the hero picker).
  counts: Map<number, number>;
  // Picking a rank sets the page's hero filter to its hero.
  onHero: (hero: number) => void;
  // What the page is loading for the comparison by itself (switching the rank's hero).
  busy?: string | null;
  variant: "panel" | "top";
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.compare;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"friends" | "ranks" | "goat">("friends");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  // The rank's hero: the filter's until another is picked here (again each time the menu opens).
  const [picked, setPicked] = useState<number | null>(null);
  const rankHero = picked ?? hero;
  const keys = targets.map((x) => x.key);
  const full = keys.length >= MAX_TARGETS;
  const myMedal = myTier ? Math.floor(myTier / 10) : null;
  // Loading the comparison takes a few seconds (a rank picked for the first time longer): say what.
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const status = pending ? loading : busy;

  const go = (next: string[], what: string) => {
    setOpen(false);
    setInput("");
    setError(false);
    setLoading(what);
    startTransition(() =>
      router.push(next.length ? `${path}?vs=${next.join(",")}` : path, { scroll: false }),
    );
  };
  // Picking what's picked takes it away.
  const toggle = (key: string, label: string) => {
    if (keys.includes(key))
      go(
        keys.filter((k) => k !== key),
        t.updating,
      );
    else if (!full) go([...keys, key], t.loading(label));
  };
  const addPlayer = (id: number | null, label?: string) => {
    if (!id || id === ownerId) return setError(true);
    toggle(String(id), label ?? String(id));
  };
  const remove = (key: string) =>
    go(
      keys.filter((k) => k !== key),
      t.updating,
    );
  const rankTargets = targets.filter((x) => x.kind === "rank");
  const chosenTier = (medal: number) =>
    rankTargets.find((x) => x.key === rankKey(medal, rankHero)) ??
    (rankHero ? undefined : rankTargets.find((x) => parseRankKey(x.key)?.tier === medal));
  const openMenu = (next: boolean) => {
    setOpen(next);
    if (next) setPicked(null);
  };

  const menu = (
    <PopoverContent
      side={variant === "panel" ? "right" : "bottom"}
      align="start"
      className="max-h-[70vh] w-[min(92vw,400px)] gap-3 overflow-y-auto [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed"
    >
      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {(["friends", "ranks", "goat"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn(
              "flex-1 rounded-md px-3 py-1 transition-colors",
              tab === v
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.tabs[v]}
          </button>
        ))}
      </div>
      {full && <p className="text-xs text-muted-foreground">{t.full}</p>}
      {tab === "goat" ? (
        <GoatTab targets={targets} full={full} ownerId={ownerId} onToggle={toggle} />
      ) : tab === "friends" ? (
        <div className="flex flex-col gap-2">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addPlayer(parseAccount(input));
            }}
          >
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setError(false);
              }}
              placeholder={t.placeholder}
              className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
            />
            <button
              type="submit"
              disabled={full}
              className="h-8 rounded-md border px-3 text-xs hover:bg-muted disabled:opacity-40"
            >
              {t.add}
            </button>
          </form>
          {error && <p className="text-xs text-destructive">{t.badId}</p>}
          {peers.length > 0 ? (
            <div className="flex flex-col">
              <span className="mb-1 text-xs text-muted-foreground">{t.peers}</span>
              {peers.map((p) => {
                const chosen = targets.find((x) => x.key === String(p.id));
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!chosen && full}
                    aria-pressed={Boolean(chosen)}
                    onClick={() => toggle(String(p.id), p.name)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted disabled:opacity-40",
                      chosen && "bg-muted",
                    )}
                  >
                    <Face avatar={p.avatar} color={chosen?.color} size={24} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {chosen ? (
                      <CheckIcon className="size-4" style={{ color: chosen.color }} aria-hidden />
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t.gamesTogether(p.games)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t.noPeers}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bracketAvailable &&
            (() => {
              const chosen = targets.find((x) => x.key === "bracket");
              return (
                <button
                  type="button"
                  disabled={!chosen && full}
                  aria-pressed={Boolean(chosen)}
                  onClick={() => toggle("bracket", t.mine)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40",
                    chosen && "bg-muted",
                  )}
                  style={chosen ? { borderColor: chosen.color } : undefined}
                >
                  <Face tier={myTier} color={chosen?.color} crowd size={28} />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-sm">{t.mine}</span>
                    <span className="text-xs text-muted-foreground">{t.mineHint}</span>
                  </span>
                  {chosen && <CheckIcon className="size-4" style={{ color: chosen.color }} aria-hidden />}
                </button>
              );
            })()}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t.rankHero} {t.followsFilters}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <HeroPicker
                value={rankHero}
                onChange={(id) => setPicked(id)}
                heroes={heroes}
                counts={counts}
                showCount={false}
              />
              {rankHero ? (
                <span className="text-xs text-muted-foreground">
                  {position ? dict.dotahub.stats.positions[position - 1] : t.allPositions}
                </span>
              ) : null}
            </div>
            {!rankHero && <span className="text-xs text-muted-foreground">{t.pickHeroFirst}</span>}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((medal) => {
              const chosen = chosenTier(medal);
              return (
                <button
                  key={medal}
                  type="button"
                  disabled={!chosen && (!rankHero || full)}
                  aria-pressed={Boolean(chosen)}
                  onClick={() => {
                    if (chosen) return remove(chosen.key);
                    onHero(rankHero);
                    toggle(
                      rankKey(medal, rankHero),
                      `${medalName(medal * 10, dict.dotahub)} · ${heroes[rankHero]?.[lang] ?? rankHero}`,
                    );
                  }}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-xs hover:bg-muted disabled:opacity-40",
                    chosen && "bg-muted",
                  )}
                  style={
                    chosen ? { borderColor: chosen.color, boxShadow: `0 0 0 1px ${chosen.color}` } : undefined
                  }
                >
                  <Medal tier={medal * 10} t={dict.dotahub} size={36} />
                  <span className="truncate">{medalName(medal * 10, dict.dotahub)}</span>
                  {medal === myMedal && (
                    <span className="absolute top-0.5 left-1 text-[10px] text-muted-foreground">{t.you}</span>
                  )}
                  {chosen && (
                    <CheckIcon
                      className="absolute top-1 right-1 size-3.5"
                      style={{ color: chosen.color }}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t.rankHint}</p>
        </div>
      )}
    </PopoverContent>
  );

  if (variant === "panel")
    return (
      <div className="flex flex-col gap-1.5 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
        <span className="text-xs text-muted-foreground">{t.label}</span>
        {/* One centred row in the panel's 110px: three faces and VS (with two picked, no plus:
            removing one with its × brings it back). */}
        <div className="flex items-center justify-center gap-[3px]">
          <span title={me.label}>
            <Face avatar={me.avatar} color={ME_COLOR} size={28} />
          </span>
          <span className="text-xs font-semibold text-muted-foreground">VS</span>
          {targets.map((x) => (
            <span key={x.key} className="group relative" title={x.label}>
              <Face avatar={x.avatar} tier={x.tier} color={x.color} crowd={isCrowdKind(x.kind)} size={28} />
              <button
                type="button"
                onClick={() => remove(x.key)}
                aria-label={t.remove(x.label)}
                className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full border bg-background text-muted-foreground group-hover:flex hover:text-foreground"
              >
                <XIcon className="size-2.5" aria-hidden />
              </button>
            </span>
          ))}
          {!full && (
            <Popover open={open} onOpenChange={openMenu}>
              <PopoverTrigger
                aria-label={t.pick}
                title={t.pick}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed text-muted-foreground hover:text-foreground"
              >
                {status ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                ) : (
                  <PlusIcon className="size-4" aria-hidden />
                )}
              </PopoverTrigger>
              {menu}
            </Popover>
          )}
        </div>
        {status && (
          <p role="status" className="flex items-start gap-1 text-[11px] leading-tight text-muted-foreground">
            <Loader2Icon className="mt-px size-3 shrink-0 animate-spin" aria-hidden />
            {status}
          </p>
        )}
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <span className="flex min-w-0 items-center gap-2">
        <Face avatar={me.avatar} color={ME_COLOR} />
        <span className="truncate text-sm font-medium">{me.label}</span>
      </span>
      <span className="text-sm font-semibold tracking-wider text-muted-foreground">VS</span>
      {targets.map((x) => (
        <span
          key={x.key}
          className="flex min-w-0 items-center gap-2 rounded-full bg-muted/40 py-0.5 pr-1 pl-0.5"
        >
          <Face avatar={x.avatar} tier={x.tier} color={x.color} crowd={isCrowdKind(x.kind)} />
          <span className="truncate text-sm">{x.label}</span>
          <button
            type="button"
            onClick={() => remove(x.key)}
            aria-label={t.remove(x.label)}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={openMenu}>
        <PopoverTrigger
          aria-label={t.pick}
          className="flex items-center gap-2 rounded-full py-0.5 pr-3 pl-0.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-dashed">
            {status ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
            ) : (
              <PlusIcon className="size-4" aria-hidden />
            )}
          </span>
          {status ?? (full ? t.change : targets.length ? t.addAnother : t.pick)}
        </PopoverTrigger>
        {menu}
      </Popover>
    </div>
  );
}

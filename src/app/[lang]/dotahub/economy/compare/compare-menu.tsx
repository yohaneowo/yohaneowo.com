"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, UsersIcon, XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { HeroPicker } from "../../deaths/hero-picker";
import { Medal, medalName } from "../../parts";
import { MAX_TARGETS, parseAccount, rankKey, type SeriesKind } from "./series";

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

// A round face: a player's avatar, a crowd's medal (我的对局 with a people icon when unranked).
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
          <Medal tier={Math.floor(tier / 10) * 10} t={dict.dotahub} size={size - 6} />
        ) : (
          <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
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
    <span className="shrink-0 rounded-full bg-muted" style={{ width: size, height: size, ...ring }} />
  );
}

// Who to compare with, at the top of the economy page: the page's player VS up to two others, picked
// from a menu of friends (the people played with most, or a pasted id) and ranks (a hero's players
// at a rank tier, or 我的对局: the other nine of the player's own matches). The choice lives in
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
  heroGames,
}: {
  // The economy page's own address (the language prefix included).
  path: string;
  ownerId: number;
  me: { label: string; avatar: string | null; tier: number | null };
  targets: CompareTarget[];
  peers: Peer[];
  bracketAvailable: boolean;
  myTier: number | null;
  heroes: Record<number, HeroInfo>;
  // The page player's heroes with their matches, most played first (a rank compares one hero; the
  // first is the default).
  heroGames: [number, number][];
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.compare;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"friends" | "ranks">("friends");
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [hero, setHero] = useState(heroGames[0]?.[0] ?? 0);
  const keys = targets.map((x) => x.key);
  const full = keys.length >= MAX_TARGETS;
  const myMedal = myTier ? Math.floor(myTier / 10) : null;
  const counts = new Map(heroGames);

  const go = (next: string[]) => {
    setOpen(false);
    setInput("");
    setError(false);
    router.push(next.length ? `${path}?vs=${next.join(",")}` : path, { scroll: false });
  };
  const add = (key: string) => {
    if (!keys.includes(key)) go([...keys, key]);
  };
  const addPlayer = (id: number | null) => {
    if (!id || id === ownerId) return setError(true);
    add(String(id));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <Face avatar={me.avatar} color="#3b82f6" />
        <span className="truncate text-sm font-medium">{me.label}</span>
      </span>
      <span className="text-sm font-semibold tracking-wider text-muted-foreground">VS</span>
      {targets.map((x) => (
        <span
          key={x.key}
          className="flex min-w-0 items-center gap-2 rounded-full bg-muted/40 py-0.5 pr-1 pl-0.5"
        >
          <Face
            avatar={x.avatar}
            tier={x.tier}
            color={x.color}
            crowd={x.kind === "bracket" || x.kind === "rank"}
          />
          <span className="truncate text-sm">{x.label}</span>
          <button
            type="button"
            onClick={() => go(keys.filter((k) => k !== x.key))}
            aria-label={t.remove(x.label)}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {full ? (
        <span className="text-xs text-muted-foreground">{t.full}</span>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label={t.pick}
            className="flex items-center gap-2 rounded-full py-0.5 pr-3 pl-0.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <span className="flex size-8 items-center justify-center rounded-full border-2 border-dashed">
              <PlusIcon className="size-4" aria-hidden />
            </span>
            {targets.length ? t.addAnother : t.pick}
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-[70vh] w-[min(92vw,420px)] gap-3 overflow-y-auto">
            <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
              {(["friends", "ranks"] as const).map((v) => (
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
                  {v === "friends" ? t.friends : t.ranks}
                </button>
              ))}
            </div>
            {tab === "friends" ? (
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
                  <button type="submit" className="h-8 rounded-md border px-3 text-xs hover:bg-muted">
                    {t.add}
                  </button>
                </form>
                {error && <p className="text-xs text-destructive">{t.badId}</p>}
                {peers.length > 0 ? (
                  <div className="flex flex-col">
                    <span className="mb-1 text-xs text-muted-foreground">{t.peers}</span>
                    {peers.map((p) => {
                      const chosen = keys.includes(String(p.id));
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={chosen}
                          onClick={() => addPlayer(p.id)}
                          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted disabled:opacity-40"
                        >
                          <Face avatar={p.avatar} size={24} />
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t.gamesTogether(p.games)}
                          </span>
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
                {bracketAvailable && (
                  <button
                    type="button"
                    disabled={keys.includes("bracket")}
                    onClick={() => add("bracket")}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40"
                  >
                    <Face tier={myTier} crowd size={28} />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="text-sm">{t.mine}</span>
                      <span className="text-xs text-muted-foreground">{t.mineHint}</span>
                    </span>
                  </button>
                )}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{t.rankHero}</span>
                  <HeroPicker
                    value={hero}
                    onChange={(id) => id && setHero(id)}
                    heroes={heroes}
                    counts={counts}
                    showCount={false}
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((medal) => {
                    const key = rankKey(medal, hero);
                    return (
                      <button
                        key={medal}
                        type="button"
                        disabled={!hero || keys.includes(key)}
                        onClick={() => add(key)}
                        className="relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
                      >
                        <Medal tier={medal * 10} t={dict.dotahub} size={36} />
                        <span className="truncate">{medalName(medal * 10, dict.dotahub)}</span>
                        {medal === myMedal && (
                          <span className="absolute top-0.5 right-1 text-[10px] text-muted-foreground">
                            {t.you}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{t.rankHint(heroes[hero]?.[lang] ?? "")}</p>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

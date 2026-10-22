"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CheckIcon, Loader2Icon, ShieldIcon, UserIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { type GoatPick, goatPicks } from "../../goat/actions";
import type { CompareTarget } from "./compare-menu";

// Kept for the page's life: switching tabs or reopening the menu doesn't ask again.
let cached: GoatPick[] | null = null;

// The compare menu's GOAT tab: the current pros of the ranked teams, grouped by team, with a search
// over players and teams. Picking one adds them like a friend (by account).
export function GoatTab({
  targets,
  full,
  ownerId,
  onToggle,
}: {
  targets: CompareTarget[];
  full: boolean;
  ownerId: number;
  onToggle: (key: string, label: string) => void;
}) {
  const dict = useLocale().t.dotahub;
  const t = dict.compare;
  const legendsName = dict.goat.legends.group;
  const [picks, setPicks] = useState<GoatPick[] | null>(cached);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (cached) return;
    let stop = false;
    goatPicks()
      .then((list) => {
        if (stop) return;
        if (!list) return setFailed(true);
        // The legends group comes unnamed (the action can't read the language).
        cached = list.map((p) => (p.team.id < 0 ? { ...p, team: { ...p.team, name: legendsName } } : p));
        setPicks(cached);
      })
      .catch(() => !stop && setFailed(true));
    return () => {
      stop = true;
    };
  }, [legendsName]);

  if (failed) return <p className="text-xs text-muted-foreground">{t.goatFailed}</p>;
  if (!picks)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
        {t.goatLoading}
      </p>
    );

  const q = query.trim().toLowerCase();
  const shown = picks.filter(
    (p) =>
      p.id !== ownerId && (!q || p.name.toLowerCase().includes(q) || p.team.name.toLowerCase().includes(q)),
  );
  // Without a search, the top teams only (the list is long), then the legends; a search looks
  // through all of them.
  const groups = [...new Map(shown.map((p) => [p.team.id, p.team])).values()];
  const teams = q
    ? groups
    : [...groups.filter((g) => g.id >= 0).slice(0, 12), ...groups.filter((g) => g.id < 0)];

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t.goatSearch}
        aria-label={t.goatSearch}
        className="h-8 rounded-md border bg-transparent px-2 text-sm"
      />
      {teams.length ? (
        <div className="flex flex-col divide-y">
          {teams.map((team) => (
            <div key={team.id} className="flex flex-col py-2 first:pt-0 last:pb-0">
              <span className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-5 text-right tabular-nums">{team.id >= 0 ? `#${team.rank}` : ""}</span>
                {team.logo ? (
                  <Image
                    src={team.logo}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                    className="size-4 object-contain"
                  />
                ) : (
                  <ShieldIcon className="size-4" aria-hidden />
                )}
                {team.name}
              </span>
              {shown
                .filter((p) => p.team.id === team.id)
                .map((p) => {
                  const chosen = targets.find((x) => x.key === String(p.id));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!chosen && full}
                      aria-pressed={Boolean(chosen)}
                      onClick={() => onToggle(String(p.id), p.name)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted disabled:opacity-40",
                        chosen && "bg-muted",
                      )}
                    >
                      {p.avatar ? (
                        <Image
                          src={p.avatar}
                          alt=""
                          width={24}
                          height={24}
                          unoptimized
                          className="size-6 shrink-0 rounded-full object-cover object-top"
                          style={chosen ? { boxShadow: `0 0 0 2px ${chosen.color}` } : undefined}
                        />
                      ) : (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                          <UserIcon className="size-3 text-muted-foreground" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {chosen && <CheckIcon className="size-4" style={{ color: chosen.color }} aria-hidden />}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t.goatNone}</p>
      )}
      <p className="text-xs text-muted-foreground">{t.goatHint}</p>
    </div>
  );
}

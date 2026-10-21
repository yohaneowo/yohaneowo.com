"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeftRightIcon, XIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import type { LabPick, LabSuggestion } from "@/lib/dota/lab";
import { cn } from "@/lib/utils";
import { labPlayers } from "./actions";
import { SIDE_COLOR } from "./lab-parts";

export type Chosen = { matchId: number; slot: number; heroId: number | null; name: string | null } | null;

const param = (c: { matchId: number; slot: number }) => `${c.matchId}-${c.slot}`;

// Choosing the two games: a match id and a player for each side, or one of the suggestions (the
// viewer's recent matches; once A is set, matches on the same hero — the viewer's and pros').
export function LabPicker({
  a,
  b,
  recent,
  mine,
  pros,
  heroes,
  signedIn,
}: {
  a: Chosen;
  b: Chosen;
  recent: LabSuggestion[];
  mine: LabSuggestion[];
  pros: LabSuggestion[];
  heroes: Record<number, HeroInfo>;
  signedIn: boolean;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.research.pick;
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<"a" | "b" | null>(a ? (b ? null : "b") : "a");
  const [pending, start] = useTransition();

  const go = (next: { a?: string | null; b?: string | null }) => {
    const q = new URLSearchParams();
    const na = next.a !== undefined ? next.a : a ? param(a) : null;
    const nb = next.b !== undefined ? next.b : b ? param(b) : null;
    if (na) q.set("a", na);
    if (nb) q.set("b", nb);
    setEditing(null);
    start(() => router.push(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false }));
  };
  const target = editing ?? (a ? "b" : "a");

  const choose = (s: LabSuggestion) => {
    if (s.slot != null) return go({ [target]: param({ matchId: s.matchId, slot: s.slot }) });
    // Pros' matches come without the slot: the player on that hero.
    start(async () => {
      const found = await labPlayers(s.matchId);
      const p = found?.players.find((x) => x.heroId === s.heroId);
      if (p) go({ [target]: param({ matchId: s.matchId, slot: p.slot }) });
    });
  };

  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border p-3", pending && "opacity-70")}>
      <h2 className="text-sm font-semibold">{t.title}</h2>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <Slot
          label={t.sideA}
          color={SIDE_COLOR.a}
          chosen={a}
          heroes={heroes}
          editing={editing === "a"}
          onEdit={() => setEditing("a")}
          onClear={() => go({ a: b ? param(b) : null, b: null })}
          onPick={(v) => go({ a: v })}
        />
        <button
          type="button"
          disabled={!a || !b}
          onClick={() => go({ a: b ? param(b) : null, b: a ? param(a) : null })}
          className="flex cursor-pointer items-center justify-center gap-1 self-center rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title={t.swap}
        >
          <ArrowLeftRightIcon className="size-3.5" aria-hidden />
          <span className="md:sr-only">{t.swap}</span>
        </button>
        <Slot
          label={t.sideB}
          color={SIDE_COLOR.b}
          chosen={b}
          heroes={heroes}
          editing={editing === "b"}
          onEdit={() => setEditing("b")}
          onClear={() => go({ b: null })}
          onPick={(v) => go({ b: v })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Suggestions
          title={t.recent}
          list={recent}
          heroes={heroes}
          onPick={choose}
          empty={signedIn ? t.none : t.signIn}
        />
        <Suggestions
          title={t.sameHeroMine}
          list={mine}
          heroes={heroes}
          onPick={choose}
          empty={a ? t.none : t.suggestHint}
        />
        <Suggestions
          title={t.sameHeroPro}
          list={pros}
          heroes={heroes}
          onPick={choose}
          empty={a ? t.none : t.suggestHint}
        />
      </div>
    </section>
  );
}

function Slot({
  label,
  color,
  chosen,
  heroes,
  editing,
  onEdit,
  onClear,
  onPick,
}: {
  label: string;
  color: string;
  chosen: Chosen;
  heroes: Record<number, HeroInfo>;
  editing: boolean;
  onEdit: () => void;
  onClear: () => void;
  onPick: (value: string) => void;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.research.pick;
  const hero = chosen?.heroId != null ? heroes[chosen.heroId] : undefined;
  return (
    <div
      className="flex min-w-0 flex-col gap-2 rounded-lg border p-2"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{label}</span>
        {chosen && !editing && (
          <span className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="cursor-pointer rounded border px-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {t.change}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer rounded border px-1 text-muted-foreground hover:text-foreground"
              title={t.clear}
            >
              <XIcon className="size-3.5" aria-hidden />
            </button>
          </span>
        )}
      </div>
      {chosen && !editing ? (
        <div className="flex items-center gap-2 text-sm">
          {hero && <Image src={hero.icon} alt="" width={24} height={24} unoptimized className="size-6" />}
          <span className="font-medium">{hero?.[lang] ?? "?"}</span>
          <span className="truncate text-muted-foreground">{chosen.name}</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{chosen.matchId}</span>
        </div>
      ) : editing || !chosen ? (
        <MatchInput heroes={heroes} onPick={onPick} initial={chosen?.matchId} />
      ) : null}
    </div>
  );
}

function MatchInput({
  heroes,
  onPick,
  initial,
}: {
  heroes: Record<number, HeroInfo>;
  onPick: (value: string) => void;
  initial?: number;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.research.pick;
  const [value, setValue] = useState(initial ? String(initial) : "");
  const [players, setPlayers] = useState<{ id: number; parsed: boolean; list: LabPick[] } | null | "missing">(
    null,
  );
  const [pending, start] = useTransition();
  const load = () => {
    const id = Number(value.trim());
    if (!Number.isInteger(id) || id <= 0) return;
    start(async () => {
      const found = await labPlayers(id);
      setPlayers(found ? { id, parsed: found.parsed, list: found.players } : "missing");
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          placeholder={t.matchId}
          className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm tabular-nums"
          aria-label={t.matchId}
        />
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {pending ? t.loading : t.load}
        </button>
      </form>
      {players === "missing" && <p className="text-xs text-muted-foreground">{t.notFound}</p>}
      {players && players !== "missing" && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {t.choose}
            {!players.parsed && ` · ${t.unparsed}`}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {[true, false].map((radiant) => (
              <ul key={String(radiant)} className="flex flex-col gap-0.5">
                <li className="text-[11px] text-muted-foreground">{radiant ? t.radiant : t.dire}</li>
                {players.list
                  .filter((p) => p.radiant === radiant)
                  .map((p) => (
                    <li key={p.slot}>
                      <button
                        type="button"
                        onClick={() => onPick(`${players.id}-${p.slot}`)}
                        className="flex w-full cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
                      >
                        {heroes[p.heroId] && (
                          <Image
                            src={heroes[p.heroId].icon}
                            alt=""
                            width={18}
                            height={18}
                            unoptimized
                            className="size-[18px]"
                          />
                        )}
                        <span className="truncate">{heroes[p.heroId]?.[lang]}</span>
                        <span className="ml-auto truncate text-muted-foreground">{p.name}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Suggestions({
  title,
  list,
  heroes,
  onPick,
  empty,
}: {
  title: string;
  list: LabSuggestion[];
  heroes: Record<number, HeroInfo>;
  onPick: (s: LabSuggestion) => void;
  empty: string;
}) {
  const { t: dict, lang } = useLocale();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {list.length ? (
        <ul className="flex max-h-48 flex-col overflow-y-auto rounded-lg border text-xs">
          {list.map((s) => (
            <li key={`${s.matchId}-${s.slot}`} className="border-b last:border-0">
              <button
                type="button"
                onClick={() => onPick(s)}
                className="flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-left hover:bg-muted"
              >
                {heroes[s.heroId] && (
                  <Image
                    src={heroes[s.heroId].icon}
                    alt=""
                    width={18}
                    height={18}
                    unoptimized
                    className="size-[18px]"
                  />
                )}
                <span className="truncate">{heroes[s.heroId]?.[lang]}</span>
                {s.win != null && (
                  <span
                    className={
                      s.win ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }
                  >
                    {s.win ? dict.dotahub.research.header.win : dict.dotahub.research.header.loss}
                  </span>
                )}
                {s.label && <span className="truncate text-muted-foreground">{s.label}</span>}
                <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                  {new Date(s.start * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-2 py-3 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcwIcon, SwordIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/locale-provider";
import type { DeathEvent, StoredMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { HeatMap } from "../death-map";
import { HeroPicker } from "./hero-picker";
import { costs, DEATHS_TITLE_SLOT, insights, type Zone, zoneOf, zoneShares } from "./insights";

type Phase = "all" | "laning" | "mid" | "late";
type Result = "all" | "win" | "loss";

const PHASE_RANGE: Record<Exclude<Phase, "all">, [number, number]> = {
  laning: [-Infinity, 600],
  mid: [600, 1800],
  late: [1800, Infinity],
};

function Chips<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: [V, string][];
  onChange: (value: V) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            value === v
              ? "border-foreground/40 bg-muted font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Card({ title, value, hint }: { title: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-xs text-muted-foreground">{title}</span>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// A kill line like Dota's kill feed: the killer's icon, a sword, the hero the player was on.
function KillLine({
  by,
  victim,
  heroes,
  lang,
  unknown,
}: {
  by: number;
  victim: number;
  heroes: Record<number, HeroInfo>;
  lang: Locale;
  unknown: string;
}) {
  const icon = (id: number) =>
    heroes[id] ? (
      <Image
        src={heroes[id].icon}
        alt={heroes[id][lang]}
        title={heroes[id][lang]}
        width={20}
        height={20}
        unoptimized
        className="size-5"
      />
    ) : null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {heroes[by] ? icon(by) : <span>{unknown}</span>}
      <SwordIcon className="size-3.5 text-red-500" aria-label="→" />
      {icon(victim)}
    </span>
  );
}

// A few heroes as icon, name and a number, for the killer and own-hero cards.
function Heroes({
  list,
  heroes,
  lang,
}: {
  list: { id: number; text: string }[];
  heroes: Record<number, HeroInfo>;
  lang: Locale;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm font-normal">
      {list.map(({ id, text }) => (
        <span key={id} className="flex items-center gap-1.5">
          {heroes[id] && (
            <Image src={heroes[id].icon} alt="" width={20} height={20} unoptimized className="size-5" />
          )}
          <span className="truncate">{heroes[id]?.[lang]}</span>
          <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{text}</span>
        </span>
      ))}
    </div>
  );
}

// The heat map of the stored ranked matches, filtered by hero, phase and result, with where on
// the map the deaths fall beside it and highlight cards below.
export function DeathsExplorer({
  matches,
  heroes,
  sides,
}: {
  matches: StoredMatch[];
  heroes: Record<number, HeroInfo>;
  // Radiant (true) or Dire per match id, from OpenDota; missing ones show absolute map areas.
  sides: Record<number, boolean>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.deaths;
  const c = t.cards;
  const [hero, setHero] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("all");
  const [result, setResult] = useState<Result>("loss");
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [pinnedZone, setPinnedZone] = useState<Zone | null>(null);
  // The win rate sits at the end of the page title (outside this component): found after mount.
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setTitleSlot(document.getElementById(DEATHS_TITLE_SLOT)), 0);
    return () => clearTimeout(id);
  }, []);

  // STRATZ marks many older matches parsed without any death positions: those can't be drawn, so
  // they are left out (a match with no deaths is kept, it simply adds nothing to the map).
  const usable = useMemo(
    () => matches.filter((m) => m.parsed && (m.deathEvents.length || !m.deaths)),
    [matches],
  );
  // How many matches per hero under the result filter, for the hero picker.
  const counts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of usable)
      if (result === "all" || (result === "win") === m.won)
        counts.set(m.heroId, (counts.get(m.heroId) ?? 0) + 1);
    return counts;
  }, [usable, result]);
  const topHeroes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const byHero = usable.filter((m) => hero === 0 || m.heroId === hero);
  const parsed = byHero.filter((m) => result === "all" || (result === "win") === m.won);
  const unusable = matches.filter((m) => m.parsed && m.deaths && !m.deathEvents.length).length;
  const inPhase = (e: DeathEvent) =>
    phase === "all" || (e.t >= PHASE_RANGE[phase][0] && e.t < PHASE_RANGE[phase][1]);
  const zones = zoneShares(parsed, sides, inPhase);
  // Hovering a map area (or tapping it, which sticks) draws only that area's deaths.
  const shownZone = [hoveredZone, pinnedZone].find((z) => z && zones.some((s) => s.zone === z)) ?? null;
  const events = parsed.flatMap((m) =>
    m.deathEvents.filter((e) => inPhase(e) && (!shownZone || zoneOf(e, sides[m.matchId]) === shownZone)),
  );
  // The cards cover whole matches (all phases), so their shares mean something.
  const facts = parsed.length ? insights(parsed, byHero, heroes) : null;
  // Gold and waiting follow the phase (but not the area hovered on the map).
  const cost = costs(parsed, inPhase);
  const wins = byHero.filter((m) => m.won).length;
  const phaseNote = phase === "all" ? null : <span>{c.inPhase(t.phases[phase])}</span>;
  const one = (n: number) => n.toFixed(1);

  return (
    <div className="flex flex-col gap-4">
      {titleSlot &&
        byHero.length > 0 &&
        createPortal(
          <div className="text-right" title={c.winRateNote}>
            <div className="text-sm text-muted-foreground">{c.winRate}</div>
            <div className="text-5xl leading-tight font-semibold tabular-nums">
              {Math.round((wins / byHero.length) * 100)}%
            </div>
            <div className="text-sm text-muted-foreground tabular-nums">
              {c.winRateHint(wins, byHero.length - wins)}
            </div>
          </div>,
          titleSlot,
        )}
      <div className="flex flex-col gap-2">
        <Chips
          label={t.phase}
          value={phase}
          onChange={setPhase}
          options={(["all", "laning", "mid", "late"] as Phase[]).map((p) => [p, t.phases[p]])}
        />
        {/* Heroes on the left; the result filter at the right end, above the highlight cards. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t.hero}</span>
            <HeroPicker value={hero} onChange={setHero} heroes={heroes} counts={counts} />
            {/* Shortcuts: the three heroes played most in the range and result; again clears it. */}
            {topHeroes.map(([id, n]) => (
              <button
                key={id}
                type="button"
                aria-pressed={hero === id}
                onClick={() => setHero(hero === id ? 0 : id)}
                title={`${heroes[id]?.[lang] ?? id} · ${n}`}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs transition-colors",
                  hero === id
                    ? "border-foreground/50 bg-muted font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {heroes[id] && (
                  <Image src={heroes[id].icon} alt="" width={20} height={20} unoptimized className="size-5" />
                )}
                <span className="hidden sm:inline">{heroes[id]?.[lang]}</span>
                <span className="tabular-nums">{n}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setHero(0)}
              disabled={hero === 0}
              aria-label={t.resetHero}
              title={t.resetHero}
              className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <RotateCcwIcon className="size-3.5" aria-hidden />
            </button>
          </div>
          <Chips
            label={t.result}
            value={result}
            onChange={setResult}
            options={(["all", "win", "loss"] as Result[]).map((r) => [r, t.results[r]])}
          />
        </div>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,560px)_220px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <HeatMap events={events} className="max-w-[640px]" />
          <p className="text-xs text-muted-foreground tabular-nums">
            {t.summary(events.length, parsed.length)}
            {shownZone && ` · ${t.onlyZone(t.zones[shownZone])}`}
          </p>
          {unusable > 0 && <p className="text-xs text-muted-foreground">{t.noPositions(unusable)}</p>}
        </div>
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t.where}</h2>
          {zones.length ? (
            <ul className="flex flex-col gap-0.5 text-sm" onMouseLeave={() => setHoveredZone(null)}>
              {zones.map(({ zone, n, share }) => (
                <li key={zone}>
                  <button
                    type="button"
                    aria-pressed={pinnedZone === zone}
                    onMouseEnter={() => setHoveredZone(zone)}
                    onFocus={() => setHoveredZone(zone)}
                    onBlur={() => setHoveredZone(null)}
                    onClick={() => setPinnedZone((current) => (current === zone ? null : zone))}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-md px-1.5 py-1 text-left transition-[background-color,opacity]",
                      shownZone === zone ? "bg-muted" : "hover:bg-muted/60",
                      shownZone && shownZone !== zone && "opacity-50",
                    )}
                  >
                    <span className="flex w-full justify-between gap-2">
                      {t.zones[zone]}
                      <span className="text-muted-foreground tabular-nums">
                        {Math.round(share * 100)}% · {n}
                      </span>
                    </span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted-foreground/15">
                      <span
                        className="block h-full rounded-full bg-red-500/80"
                        style={{ width: `${share * 100}%` }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          )}
          <p className="text-xs text-muted-foreground">{t.whereHint}</p>
        </section>
        <section className="flex flex-col gap-2 md:col-span-2 xl:col-span-1">
          <h2 className="font-medium">{t.insights}</h2>
          {facts ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2">
              {facts.perMatch != null && (
                <Card title={c.perMatch} value={c.times(one(facts.perMatch))} hint={c.zero(facts.zero)} />
              )}
              {cost && (
                <Card
                  title={c.gold}
                  value={c.goldValue(Math.round(cost.gold.perMatch).toLocaleString("en-US"))}
                  hint={
                    <>
                      {phaseNote}
                      <span>
                        {c.goldMore(cost.gold.total.toLocaleString("en-US"), Math.round(cost.gold.perDeath))}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-1.5">
                        {c.worstGold(cost.gold.worst.gold, clock(cost.gold.worst.t))}
                        <KillLine
                          by={cost.gold.worst.by}
                          victim={cost.gold.worst.heroId}
                          heroes={heroes}
                          lang={lang}
                          unknown={t.unknownKiller}
                        />
                      </span>
                    </>
                  }
                />
              )}
              {cost && (
                <Card
                  title={c.waiting}
                  value={c.duration(Math.round(cost.dead.perMatch))}
                  hint={
                    <>
                      {phaseNote}
                      <span>{c.waitMore(c.duration(cost.dead.total), Math.round(cost.dead.perDeath))}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5">
                        {c.worstWait(cost.dead.worst.dead, clock(cost.dead.worst.t))}
                        <KillLine
                          by={cost.dead.worst.by}
                          victim={cost.dead.worst.heroId}
                          heroes={heroes}
                          lang={lang}
                          unknown={t.unknownKiller}
                        />
                      </span>
                    </>
                  }
                />
              )}
              <Card
                title={c.firstBlood}
                value={`${Math.round(facts.firstBlood.share * 100)}%`}
                hint={
                  facts.firstBlood.at != null
                    ? c.firstBloodHint(facts.firstBlood.n, clock(Math.round(facts.firstBlood.at)))
                    : c.firstBloodNone
                }
              />
              {facts.firstDeath != null && (
                <Card
                  title={c.firstDeath}
                  value={clock(Math.round(facts.firstDeath))}
                  hint={c.firstDeathHint}
                />
              )}
              <Card title={c.chains} value={c.times(String(facts.chains))} hint={c.chainsHint} />
              {facts.deadliest != null && (
                <Card
                  title={c.deadliest}
                  value={c.minutes(facts.deadliest)}
                  hint={
                    facts.phase
                      ? c.phaseShare(t.phases[facts.phase.phase], Math.round(facts.phase.share * 100))
                      : undefined
                  }
                />
              )}
              {facts.killers.length > 0 && (
                <Card
                  title={c.killers}
                  value={
                    <Heroes
                      heroes={heroes}
                      lang={lang}
                      list={facts.killers.map((k) => ({ id: k.id, text: String(k.n) }))}
                    />
                  }
                  hint={c.structures(facts.structures)}
                />
              )}
              {hero === 0 && facts.yourHeroes.length > 0 && (
                <Card
                  title={c.yourHeroes}
                  value={
                    <Heroes
                      heroes={heroes}
                      lang={lang}
                      list={facts.yourHeroes.map((h) => ({ id: h.id, text: c.heroDeaths(one(h.avg), h.n) }))}
                    />
                  }
                />
              )}
              {facts.winLoss && (
                <Card
                  title={c.winLoss}
                  value={c.winLossValue(one(facts.winLoss.win), one(facts.winLoss.loss))}
                  hint={c.ignoresResult}
                />
              )}
              {facts.many && (
                <Card
                  title={c.many}
                  value={c.manyValue(Math.round(facts.many.winRate * 100))}
                  hint={c.manyHint(facts.many.n)}
                />
              )}
              {facts.trend && (
                <Card
                  title={c.trend}
                  value={
                    <span
                      className={
                        facts.trend.recent <= facts.trend.before
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {c.trendValue(one(facts.trend.recent), one(facts.trend.before))}
                    </span>
                  }
                  hint={c.trendHint}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          )}
        </section>
      </div>
    </div>
  );
}

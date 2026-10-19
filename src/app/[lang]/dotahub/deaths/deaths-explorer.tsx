"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import type { StoredMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { HeatMap } from "../death-map";

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

// The heat map of the stored ranked matches, filtered by hero, phase and result, with a few
// highlights below.
export function DeathsExplorer({
  matches,
  heroes,
}: {
  matches: StoredMatch[];
  heroes: Record<number, HeroInfo>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.deaths;
  const [hero, setHero] = useState<number>(0);
  const [phase, setPhase] = useState<Phase>("all");
  const [result, setResult] = useState<Result>("all");

  const heroOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of matches) counts.set(m.heroId, (counts.get(m.heroId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [matches]);

  const shown = matches.filter(
    (m) => (hero === 0 || m.heroId === hero) && (result === "all" || (result === "win") === m.won),
  );
  const parsed = shown.filter((m) => m.parsed);
  const events = parsed.flatMap((m) =>
    m.deathEvents.filter(
      (e) => phase === "all" || (e.t >= PHASE_RANGE[phase][0] && e.t < PHASE_RANGE[phase][1]),
    ),
  );

  // Highlights over the shown matches (all phases, so the shares mean something).
  const all = parsed.flatMap((m) => m.deathEvents);
  const highlights: string[] = [];
  if (parsed.length) {
    highlights.push(t.perMatch((all.length / parsed.length).toFixed(1)));
    const byPhase = (Object.keys(PHASE_RANGE) as Exclude<Phase, "all">[]).map(
      (p) => [p, all.filter((e) => e.t >= PHASE_RANGE[p][0] && e.t < PHASE_RANGE[p][1]).length] as const,
    );
    const top = [...byPhase].sort((a, b) => b[1] - a[1])[0];
    if (top && all.length)
      highlights.push(t.phaseShare(t.phases[top[0]], Math.round((top[1] / all.length) * 100)));
    const killers = new Map<number, number>();
    for (const e of all) if (e.by) killers.set(e.by, (killers.get(e.by) ?? 0) + 1);
    const killer = [...killers.entries()].sort((a, b) => b[1] - a[1])[0];
    if (killer && heroes[killer[0]]) highlights.push(t.topKiller(heroes[killer[0]][lang], killer[1]));
    const buckets = new Map<number, number>();
    for (const e of all)
      if (e.t >= 0) buckets.set(Math.floor(e.t / 300) * 5, (buckets.get(Math.floor(e.t / 300) * 5) ?? 0) + 1);
    const bucket = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bucket) highlights.push(t.deadliest(bucket[0]));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t.hero}
          <select
            value={hero}
            onChange={(event) => setHero(Number(event.target.value))}
            className="h-8 rounded-lg border bg-transparent px-2.5 text-sm text-foreground dark:bg-input/30"
          >
            <option value={0}>{t.allHeroes}</option>
            {heroOptions.map(([id, n]) => (
              <option key={id} value={id}>
                {heroes[id]?.[lang] ?? id} ({n})
              </option>
            ))}
          </select>
        </label>
        <Chips
          label={t.phase}
          value={phase}
          onChange={setPhase}
          options={(["all", "laning", "mid", "late"] as Phase[]).map((p) => [p, t.phases[p]])}
        />
        <Chips
          label={t.result}
          value={result}
          onChange={setResult}
          options={(["all", "win", "loss"] as Result[]).map((r) => [r, t.results[r]])}
        />
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-2">
          <HeatMap events={events} className="max-w-[640px]" />
          <p className="text-xs text-muted-foreground tabular-nums">
            {t.summary(events.length, parsed.length)}
          </p>
        </div>
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t.insights}</h2>
          {highlights.length ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              {highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          )}
        </section>
      </div>
    </div>
  );
}

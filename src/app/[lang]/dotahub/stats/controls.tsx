"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import type { DetailMatch } from "@/lib/dota/admin";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { HeroPicker } from "../deaths/hero-picker";

export function Chips<V extends string | number>({
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

// Segmented buttons (a range, a chart's view).
export function Tabs<V extends string | number>({
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
    <div role="group" aria-label={label} className="flex gap-1 self-start rounded-lg bg-muted p-1 text-sm">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            value === v
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// The hero picker with shortcuts to the three heroes played most (again clears it) and a reset.
export function HeroFilter({
  value,
  onChange,
  heroes,
  counts,
}: {
  value: number;
  onChange: (hero: number) => void;
  heroes: Record<number, HeroInfo>;
  counts: Map<number, number>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.deaths;
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{t.hero}</span>
      <HeroPicker value={value} onChange={onChange} heroes={heroes} counts={counts} />
      {top.map(([id, n]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(value === id ? 0 : id)}
          title={`${heroes[id]?.[lang] ?? id} · ${n}`}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs transition-colors",
            value === id
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
        onClick={() => onChange(0)}
        disabled={value === 0}
        aria-label={t.resetHero}
        title={t.resetHero}
        className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <RotateCcwIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

type Side = "all" | "radiant" | "dire";
type Result = "all" | "win" | "loss";
const POSITIONS = [0, 1, 2, 3, 4, 5];

// The filters both stats pages share: how many of the newest matches (0: all), position, side,
// hero and result. Each list leaves one filter out where a chart compares across it.
export function useMatchFilters(matches: DetailMatch[], sides: Record<number, boolean>, ranges: number[]) {
  const [n, setN] = useState(ranges.includes(50) ? 50 : ranges[ranges.length - 1]);
  const [pos, setPos] = useState(0);
  const [side, setSide] = useState<Side>("all");
  const [hero, setHero] = useState(0);
  const [result, setResult] = useState<Result>("all");

  return useMemo(() => {
    const keepSide = (m: DetailMatch) => side === "all" || sides[m.matchId] === (side === "radiant");
    const keepPos = (m: DetailMatch) => pos === 0 || m.details.pos === pos;
    const keepHero = (m: DetailMatch) => hero === 0 || m.heroId === hero;
    const keepResult = (m: DetailMatch) => result === "all" || (result === "win") === m.won;
    const inRange = (n ? matches.slice(0, n) : matches).filter(keepSide);
    const counts = new Map<number, number>();
    for (const m of inRange)
      if (keepPos(m) && keepResult(m)) counts.set(m.heroId, (counts.get(m.heroId) ?? 0) + 1);
    return {
      n,
      setN,
      pos,
      setPos,
      side,
      setSide,
      hero,
      setHero,
      result,
      setResult,
      counts,
      // Everything applied.
      shown: inRange.filter((m) => keepPos(m) && keepHero(m) && keepResult(m)),
      // All but the result (win rates, wins against losses).
      bothResults: inRange.filter((m) => keepPos(m) && keepHero(m)),
      // All but the position (the per-position comparison).
      anyPosition: inRange.filter((m) => keepHero(m) && keepResult(m)),
      // All but the hero (the per-hero table).
      anyHero: inRange.filter((m) => keepPos(m) && keepResult(m)),
    };
  }, [matches, sides, n, pos, side, hero, result]);
}

export type MatchFilters = ReturnType<typeof useMatchFilters>;

export function FilterBar({
  f,
  heroes,
  ranges,
}: {
  f: MatchFilters;
  heroes: Record<number, HeroInfo>;
  ranges: number[];
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.deaths;
  const s = dict.dotahub.stats;
  return (
    <div className="flex flex-col gap-2">
      <Tabs
        label={t.range}
        value={f.n}
        onChange={f.setN}
        options={ranges.map((r) => [r, r ? t.recent(r) : t.all])}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Chips
          label={s.position}
          value={f.pos}
          onChange={f.setPos}
          options={POSITIONS.map((p) => [p, p ? s.positions[p - 1] : s.anyPosition])}
        />
        <Chips
          label={t.side}
          value={f.side}
          onChange={f.setSide}
          options={(["all", "radiant", "dire"] as Side[]).map((v) => [v, t.sides[v]])}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <HeroFilter value={f.hero} onChange={f.setHero} heroes={heroes} counts={f.counts} />
        <Chips
          label={t.result}
          value={f.result}
          onChange={f.setResult}
          options={(["all", "win", "loss"] as Result[]).map((v) => [v, t.results[v]])}
        />
      </div>
    </div>
  );
}

// A small card with a big number.
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "bad" && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

// The average of a per-minute series over matches, minute by minute; a minute only counts once
// at least MIN_AT_MINUTE matches reached it (fewer would be noise).
const MIN_AT_MINUTE = 3;
export function perMinute(series: number[][], cap = 60) {
  const length = Math.min(cap, Math.max(0, ...series.map((s) => s.length)));
  return Array.from({ length }, (_, minute) => {
    const values = series.filter((s) => s.length > minute).map((s) => s[minute]);
    return values.length >= MIN_AT_MINUTE ? Math.round(avg(values)!) : null;
  });
}

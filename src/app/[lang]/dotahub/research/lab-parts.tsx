"use client";

import Image from "next/image";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HeroInfo } from "@/lib/dota/data";
import type { LabAssets, LabSide } from "@/lib/dota/lab";
import { clock, MAP_IMAGE, mapPoint } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { type Align, timeOf, xOf } from "./insights";

// The two sides' colours: orange for A, blue for B (apart for every kind of colour vision). Text
// stays in the text colours; a coloured dot or line beside it says which side.
export const SIDE_COLOR = { a: "#f97316", b: "#3b82f6" } as const;
export type SideKey = "a" | "b";

// The hovered moment (in x units of the current alignment), shared by every chart and map without
// re-rendering the charts.
function createCursor() {
  let value: number | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (v: number | null) => {
      if (v === value) return;
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
export type Cursor = ReturnType<typeof createCursor>;
export const newCursor = createCursor;

export type LabCtx = {
  a: LabSide;
  b: LabSide | null;
  assets: LabAssets;
  heroes: Record<number, HeroInfo>;
  align: Align;
  // The x range shown, in the alignment's units (minutes, levels, minutes from the item).
  range: [number, number];
  cursor: Cursor;
  t: Dictionary["dotahub"]["research"];
  lang: "zh" | "en";
};

const Ctx = createContext<LabCtx | null>(null);
export const LabProvider = Ctx.Provider;
export function useLab() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLab outside LabProvider");
  return ctx;
}

export function useSides() {
  const { a, b } = useLab();
  return (
    b
      ? [
          ["a", a],
          ["b", b],
        ]
      : [["a", a]]
  ) as [SideKey, LabSide][];
}

// Seconds shown for a side: the x range turned back into its game time.
export function useTimeWindow(s: LabSide): [number, number] {
  const { align, range } = useLab();
  const from = timeOf(s, range[0], align) ?? -Infinity;
  const to = timeOf(s, range[1], align) ?? Infinity;
  return [from, to];
}

export function useCursorTime(s: LabSide) {
  const { cursor, align } = useLab();
  const x = useSyncExternalStore(cursor.subscribe, cursor.get, () => null);
  return x == null ? null : timeOf(s, x, align);
}

// ── Names and pictures ───────────────────────────────────────────────────────────────────────

export function useNames() {
  const { assets, heroes, lang, t } = useLab();
  return useMemo(
    () => ({
      items: (k: string) => assets.items[k]?.[lang] ?? k,
      abilities: (k: string) =>
        k === "null"
          ? t.damage.rightClick
          : (assets.abilities[k]?.[lang] ?? assets.items[k]?.[lang] ?? t.skills.special[k] ?? k),
      heroes: (id: number) => heroes[id]?.[lang] ?? String(id),
    }),
    [assets, heroes, lang, t],
  );
}

export function HeroIcon({
  id,
  size = 20,
  className,
}: {
  id: number | null;
  size?: number;
  className?: string;
}) {
  const { heroes, lang } = useLab();
  const h = id != null ? heroes[id] : undefined;
  if (!h)
    return (
      <span
        className={cn("inline-block rounded bg-muted", className)}
        style={{ width: size, height: size }}
      />
    );
  return (
    <Image
      src={h.icon}
      alt={h[lang]}
      title={h[lang]}
      width={size}
      height={size}
      unoptimized
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function ItemIcon({
  k,
  size = 24,
  title,
  className,
}: {
  k: string;
  size?: number;
  title?: string;
  className?: string;
}) {
  const { assets, lang } = useLab();
  const it = assets.items[k];
  if (!it)
    return (
      <span
        className={cn("inline-block rounded bg-muted text-[9px]", className)}
        style={{ width: size * 1.36, height: size }}
        title={k}
      />
    );
  return (
    <Image
      src={it.img}
      alt={it[lang]}
      title={title ?? it[lang]}
      width={Math.round(size * 1.36)}
      height={size}
      unoptimized
      className={cn("inline-block shrink-0 rounded-sm", className)}
      style={{ width: Math.round(size * 1.36), height: size }}
    />
  );
}

export function AbilityIcon({
  k,
  size = 24,
  title,
  className,
}: {
  k: string;
  size?: number;
  title?: string;
  className?: string;
}) {
  const { assets, lang } = useLab();
  const ab = assets.abilities[k];
  if (!ab || ab.talent)
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm bg-amber-500/20 text-[9px] font-semibold text-amber-800 dark:text-amber-200",
          className,
        )}
        style={{ width: size, height: size }}
        title={title ?? ab?.[lang] ?? k}
      >
        T
      </span>
    );
  return (
    <Image
      src={ab.img}
      alt={ab[lang]}
      title={title ?? ab[lang]}
      width={size}
      height={size}
      unoptimized
      className={cn("inline-block shrink-0 rounded-sm", className)}
      style={{ width: size, height: size }}
    />
  );
}

// Item or ability by key, whichever it is (damage sources mix the two).
export function SourceIcon({ k, size = 20 }: { k: string; size?: number }) {
  const { assets } = useLab();
  if (k === "null")
    return (
      <span className="inline-block size-5 shrink-0 rounded-sm bg-muted text-center text-[10px] leading-5">
        ⚔
      </span>
    );
  if (assets.items[k]) return <ItemIcon k={k} size={size} />;
  return <AbilityIcon k={k} size={size} />;
}

export function SideDot({ side, className }: { side: SideKey; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: SIDE_COLOR[side] }}
    />
  );
}

export function SideLabel({ side }: { side: SideKey }) {
  const { t } = useLab();
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold">
      <SideDot side={side} />
      {side === "a" ? t.insight.a : t.insight.b}
    </span>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────────────────────

export function Section({
  id,
  title,
  insight,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  insight: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section id={`lab-${id}`} className="scroll-mt-28 rounded-xl border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left"
      >
        <ChevronDownIcon
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground">{insight}</span>
        </span>
      </button>
      {open && <div className="flex flex-col gap-5 border-t px-4 py-4">{children}</div>}
    </section>
  );
}

export function Sub({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <h3 className="text-sm font-medium">
        {title}
        {hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{hint}</span>}
      </h3>
      {children}
    </div>
  );
}

// Side by side when comparing (one column each), full width alone.
export function PerSide({ children }: { children: (side: SideKey, s: LabSide) => ReactNode }) {
  const sides = useSides();
  return (
    <div className={cn("grid gap-4", sides.length > 1 && "lg:grid-cols-2")}>
      {sides.map(([k, s]) => (
        <div key={k} className="flex min-w-0 flex-col gap-2">
          {sides.length > 1 && <SideLabel side={k} />}
          {children(k, s)}
        </div>
      ))}
    </div>
  );
}

// ── Charts on the shared x axis ──────────────────────────────────────────────────────────────

export const GROUP = "dota-lab";

function axisName(t: LabCtx["t"], align: Align, item: string) {
  if (align.kind === "level") return t.timeline.levelAxis;
  if (align.kind === "item") return t.timeline.itemAxis(item);
  return t.timeline.minute;
}

export function fmtX(x: number, align: Align) {
  if (align.kind === "level") return `Lv ${x.toFixed(1)}`;
  const s = Math.round(x * 60);
  return align.kind === "item" ? `${s >= 0 ? "+" : "−"}${clock(Math.abs(s))}` : clock(s);
}

// A per-minute series for each side, on the shared x axis (with the cursor linked).
export function LineCompare({
  title,
  series,
  format = (v) => Math.round(v).toLocaleString(),
  height = 200,
  step = false,
  integer = false,
  xMax,
  extra,
  baseline,
  marks,
}: {
  title: string;
  // The per-minute values of a side (index = minute), or null when the side has none.
  series: (s: LabSide) => number[] | null;
  format?: (v: number) => string;
  height?: number;
  step?: boolean;
  // Counts: whole numbers on the y axis.
  integer?: boolean;
  // A narrower x range than the shared one (the laning chart's first minutes).
  xMax?: number;
  // More lines per side (lane opponents…): name, values, dashed.
  extra?: (s: LabSide, side: SideKey) => { name: string; values: number[] }[];
  // The same hero's rank average for the side (grey, dashed; drawn once when both share it).
  baseline?: (s: LabSide) => (number | null)[] | null;
  // Events marked on the side's line (kills, deaths…).
  marks?: (s: LabSide, side: SideKey) => { t: number; color: string }[];
}) {
  const { align, range, cursor, assets, lang, t } = useLab();
  const sides = useSides();
  const itemName = align.kind === "item" ? (assets.items[align.key]?.[lang] ?? align.key) : "";
  const option = useMemo<EChartsOption>(() => {
    const lines: NonNullable<EChartsOption["series"]> = [];
    for (const [k, s] of sides) {
      const values = series(s);
      if (!values?.length) continue;
      const points = values
        .map((v, m) => [xOf(s, m * 60, align), v] as [number | null, number])
        .filter((p): p is [number, number] => p[0] != null);
      lines.push({
        name: k === "a" ? t.insight.a : t.insight.b,
        type: "line",
        data: points,
        showSymbol: false,
        step: step ? "end" : undefined,
        lineStyle: { width: 2, color: SIDE_COLOR[k] },
        itemStyle: { color: SIDE_COLOR[k] },
      });
      for (const e of extra?.(s, k) ?? [])
        lines.push({
          name: `${k === "a" ? t.insight.a : t.insight.b} · ${e.name}`,
          type: "line",
          data: e.values
            .map((v, m) => [xOf(s, m * 60, align), v] as [number | null, number])
            .filter((p): p is [number, number] => p[0] != null),
          showSymbol: false,
          lineStyle: { width: 1.5, type: "dashed", color: SIDE_COLOR[k], opacity: 0.6 },
          itemStyle: { color: SIDE_COLOR[k] },
        });
      const evs = marks?.(s, k) ?? [];
      if (evs.length)
        lines.push({
          name: `${k === "a" ? t.insight.a : t.insight.b} ·`,
          type: "scatter",
          symbolSize: 7,
          data: evs
            .map((e) => {
              const x = xOf(s, e.t, align);
              const m = e.t / 60;
              const i = Math.min(values.length - 1, Math.max(0, Math.floor(m)));
              const y =
                values[i] + ((values[Math.min(values.length - 1, i + 1)] ?? values[i]) - values[i]) * (m - i);
              return x == null
                ? null
                : { value: [x, y], itemStyle: { color: e.color, borderColor: "#fff", borderWidth: 1 } };
            })
            .filter((v) => v != null),
          tooltip: { show: false },
        });
    }
    // The rank average: one line per distinct baseline.
    const drawn = new Set<string>();
    for (const [k, s] of sides) {
      const bl = baseline?.(s);
      const meta = s.advanced.baseline;
      if (!bl?.length || !meta) continue;
      const id = `${s.heroId}-${meta.position}-${meta.bracket}`;
      if (drawn.has(id) && align.kind === "time") continue;
      drawn.add(id);
      lines.push({
        name: `${t.deep.baseline}${sides.length > 1 && drawn.size > 1 ? ` (${k === "a" ? t.insight.a : t.insight.b})` : ""}`,
        type: "line",
        data: bl
          .map((v, m) => [xOf(s, m * 60, align), v] as [number | null, number | null])
          .filter((p): p is [number, number] => p[0] != null && p[1] != null),
        showSymbol: false,
        lineStyle: { width: 1.5, type: "dashed", color: "#9ca3af" },
        itemStyle: { color: "#9ca3af" },
      });
    }
    return {
      animation: false,
      grid: { left: 48, right: 12, top: 28, bottom: 28 },
      title: { text: title, left: 0, top: 0, textStyle: { fontSize: 12, fontWeight: 500 } },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => (typeof v === "number" ? format(v) : String(v)),
        axisPointer: { type: "line", label: { formatter: (p) => fmtX(Number(p.value), align) } },
      },
      xAxis: {
        type: "value",
        min: range[0],
        max: xMax != null ? Math.min(range[1], xMax) : range[1],
        name: axisName(t, align, itemName),
        nameLocation: "end",
        nameGap: 4,
        nameTextStyle: { fontSize: 10 },
        axisLabel: {
          formatter: (v: number) => (align.kind === "level" ? String(v) : String(Math.round(v))),
          fontSize: 10,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (v: number) => format(v), fontSize: 10 },
        splitLine: { lineStyle: { opacity: 0.3 } },
        scale: true,
        minInterval: integer ? 1 : undefined,
      },
      series: lines,
    };
  }, [sides, series, extra, align, range, title, format, step, t, itemName, integer, xMax, baseline, marks]);
  if (!option.series || (option.series as unknown[]).length === 0) return null;
  return (
    <div style={{ height }} className="min-w-0">
      <EChart
        option={option}
        group={GROUP}
        onEvents={{
          updateAxisPointer: ((e: { axesInfo?: { value: number }[] }) =>
            cursor.set(e.axesInfo?.[0]?.value ?? null)) as never,
          globalout: (() => cursor.set(null)) as never,
        }}
      />
    </div>
  );
}

// Events as dots on the shared x axis (casts, item uses…), one row per key.
export function TimeStrip({
  rows,
  side,
  s,
}: {
  rows: { key: string; label: ReactNode; times: number[] }[];
  side: SideKey;
  s: LabSide;
}) {
  const { align, range } = useLab();
  const span = range[1] - range[0] || 1;
  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="flex w-40 shrink-0 items-center gap-1.5 truncate text-xs">{r.label}</span>
          <span className="relative h-4 min-w-0 flex-1 rounded bg-muted/50">
            {r.times.map((t, i) => {
              const x = xOf(s, t, align);
              if (x == null || x < range[0] || x > range[1]) return null;
              return (
                <span
                  key={i}
                  title={clock(t)}
                  className="absolute top-0.5 h-3 w-[2px] rounded"
                  style={{
                    left: `${((x - range[0]) / span) * 100}%`,
                    background: SIDE_COLOR[side],
                    opacity: 0.85,
                  }}
                />
              );
            })}
          </span>
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {r.times.length}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── The map ──────────────────────────────────────────────────────────────────────────────────

export type MapMark = {
  x: number;
  y: number;
  shape?: "dot" | "square" | "cross" | "ring";
  color: string;
  size?: number;
  title?: string;
  label?: string;
};

// The Dota map with marks, an optional heat layer (counts on a grid) and the hovered position.
export function LabMap({
  marks = [],
  heat,
  heatColor,
  cursorOf,
  className,
}: {
  marks?: MapMark[];
  heat?: { x: number; y: number }[];
  heatColor?: string;
  // The sides whose position at the hovered moment is marked.
  cursorOf?: { side: SideKey; s: LabSide }[];
  className?: string;
}) {
  const cells = useMemo(() => {
    if (!heat?.length) return [];
    const N = 32;
    const grid = new Map<string, number>();
    for (const h of heat) {
      const p = mapPoint(h.x, h.y);
      const k = `${Math.min(N - 1, Math.floor(p.left * N))},${Math.min(N - 1, Math.floor(p.top * N))}`;
      grid.set(k, (grid.get(k) ?? 0) + 1);
    }
    const max = Math.max(...grid.values());
    return [...grid.entries()].map(([k, c]) => {
      const [i, j] = k.split(",").map(Number);
      return { i, j, f: Math.sqrt(c / max), N };
    });
  }, [heat]);
  return (
    <div className={cn("relative aspect-square w-full overflow-hidden rounded-lg bg-muted", className)}>
      <Image src={MAP_IMAGE} alt="" fill unoptimized sizes="480px" className="object-cover" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        {cells.map((c) => (
          <rect
            key={`${c.i},${c.j}`}
            x={(c.i * 100) / c.N}
            y={(c.j * 100) / c.N}
            width={100 / c.N}
            height={100 / c.N}
            fill={heatColor ?? "#f97316"}
            opacity={0.15 + c.f * 0.7}
          />
        ))}
        {marks.map((m, i) => {
          const p = mapPoint(m.x, m.y);
          const cx = p.left * 100;
          const cy = p.top * 100;
          const r = m.size ?? 1.6;
          const common = { stroke: "white", strokeWidth: 0.35 };
          return (
            <g key={i}>
              {m.title && <title>{m.title}</title>}
              {m.shape === "square" ? (
                <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={m.color} {...common} />
              ) : m.shape === "cross" ? (
                <path
                  d={`M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}`}
                  stroke={m.color}
                  strokeWidth={0.8}
                />
              ) : m.shape === "ring" ? (
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={m.color} strokeWidth={0.6} />
              ) : (
                <circle cx={cx} cy={cy} r={r} fill={m.color} {...common} />
              )}
              {m.label && (
                <text x={cx} y={cy + 0.9} textAnchor="middle" fontSize={2.2} fontWeight={700} fill="white">
                  {m.label}
                </text>
              )}
            </g>
          );
        })}
        {cursorOf?.map(({ side, s }) => (
          <CursorMark key={side} side={side} s={s} />
        ))}
      </svg>
    </div>
  );
}

function CursorMark({ side, s }: { side: SideKey; s: LabSide }) {
  const t = useCursorTime(s);
  if (t == null || !s.path.t.length) return null;
  let i = s.path.t.findIndex((x) => x >= t);
  if (i < 0) i = s.path.t.length - 1;
  const p = mapPoint(s.path.x[i], s.path.y[i]);
  return (
    <g>
      <circle
        cx={p.left * 100}
        cy={p.top * 100}
        r={2.6}
        fill={SIDE_COLOR[side]}
        stroke="white"
        strokeWidth={0.6}
      />
      <text
        x={p.left * 100}
        y={p.top * 100 - 3.4}
        textAnchor="middle"
        fontSize={2.6}
        fontWeight={700}
        fill="white"
        stroke="black"
        strokeWidth={0.2}
      >
        {clock(Math.round(t))}
      </text>
    </g>
  );
}

// A horizontal bar list (label, bar, value) for breakdowns.
export function Bars({
  rows,
  color,
  format = (v) => Math.round(v).toLocaleString(),
  max,
}: {
  rows: { key: string; label: ReactNode; value: number; note?: string }[];
  color: string;
  format?: (v: number) => string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-xs">
          <span className="flex w-40 shrink-0 items-center gap-1.5 truncate">{r.label}</span>
          <span className="relative h-3 min-w-0 flex-1 overflow-hidden rounded bg-muted/50">
            <span
              className="absolute inset-y-0 left-0 rounded"
              style={{ width: `${(r.value / top) * 100}%`, background: color }}
            />
          </span>
          <span className="min-w-20 shrink-0 text-right whitespace-nowrap tabular-nums">
            {format(r.value)}
            {r.note && <span className="ml-1 text-muted-foreground">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

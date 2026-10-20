"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import type { EChartsOption } from "echarts";
import { Loader2Icon } from "lucide-react";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import { cn } from "@/lib/utils";
import { Medal, medalName } from "../../parts";
import { type RankImp, rankImp } from "./actions";

export type ImpOf = {
  key: string;
  heroId: number;
  name: string;
  radiant: boolean;
  slot: number;
  impm: number[];
  // When the player died (seconds) and the killer's hero (0: a tower or creeps).
  deaths: { t: number; by: number }[];
};

// Dota's player colours by slot (Radiant 0–4, Dire 5–9): who's who across the game's own UI.
const SLOT_COLORS = [
  "#3375ff",
  "#66ffbf",
  "#bf00bf",
  "#f3f00b",
  "#ff6b00",
  "#fe86c2",
  "#a1b447",
  "#65d9f7",
  "#008321",
  "#a46900",
];
const CROWD_COLOR = "#8b5cf6";
// While the sample is still being collected, ask again this often.
const POLL_MS = 20_000;

// IMP minute by minute in one match: the focused player's line, others added by their faces, and
// (on demand) the same hero's IMP at a rank tier behind it — the match's own tier by default.
export function MatchImp({
  players,
  heroes,
  focus,
  matchTier,
}: {
  players: ImpOf[];
  heroes: Record<number, HeroInfo>;
  focus: string;
  // The match's average medal (1–8), the rank shown first.
  matchTier: number | null;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.matchImp;
  const [shown, setShown] = useState<string[]>([focus]);
  const [overlay, setOverlay] = useState(false);
  const [tier, setTier] = useState(matchTier ?? 5);
  // The sample asked for last, with which hero and tier it's for (another pick shows nothing until
  // its own arrives).
  const [loaded, setLoaded] = useState<{ key: string; data: RankImp | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const focused = players.find((p) => p.key === focus) ?? players[0];
  const heroName = heroes[focused.heroId]?.[lang] ?? String(focused.heroId);
  const sampleKey = `${focused.heroId}-${tier}`;
  const crowd = loaded?.key === sampleKey ? loaded.data : null;

  useEffect(() => {
    if (!overlay) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      startTransition(async () => {
        const next = await rankImp(focused.heroId, tier);
        if (stop) return;
        setLoaded({ key: `${focused.heroId}-${tier}`, data: next });
        if (next && next.count < next.target) timer = setTimeout(load, POLL_MS);
      });
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [overlay, tier, focused.heroId]);

  const visible = players.filter((p) => shown.includes(p.key));
  const length = Math.max(
    0,
    ...visible.map((p) => p.impm.length),
    overlay && crowd ? Math.min(crowd.mean.length, Math.max(...players.map((p) => p.impm.length))) : 0,
  );
  const crowdLabel = `${medalName(tier * 10, dict.dotahub)} · ${heroName}`;
  const option: EChartsOption = {
    grid: { left: 44, right: 16, top: 32, bottom: 28 },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "–" : String(v)) },
    xAxis: {
      type: "category",
      data: Array.from({ length }, (_, i) => String(i)),
      axisLabel: { formatter: (value: string) => dict.dotahub.match.minute(Number(value)) },
    },
    yAxis: { type: "value", splitLine: { lineStyle: { opacity: 0.25 } } },
    series: [
      ...(overlay && crowd?.count
        ? [
            // The middle half as a band: the low edge, then the gap up to the high edge stacked on it
            // (stacked as plain numbers: IMP goes below zero, and by default the signs stack apart).
            {
              name: t.band,
              type: "line" as const,
              stack: "band",
              stackStrategy: "all" as const,
              color: CROWD_COLOR,
              data: crowd.low.slice(0, length),
              lineStyle: { opacity: 0 },
              symbol: "none",
              silent: true,
              tooltip: { show: false },
            },
            {
              name: t.band,
              type: "line" as const,
              stack: "band",
              stackStrategy: "all" as const,
              color: CROWD_COLOR,
              data: crowd.high
                .slice(0, length)
                .map((h, i) => (h == null || crowd.low[i] == null ? null : h - crowd.low[i]!)),
              lineStyle: { opacity: 0 },
              areaStyle: { color: CROWD_COLOR, opacity: 0.15 },
              symbol: "none",
              silent: true,
              tooltip: { show: false },
            },
            {
              name: t.average(crowdLabel),
              type: "line" as const,
              data: crowd.mean.slice(0, length),
              color: CROWD_COLOR,
              lineStyle: { type: "dashed" as const, width: 2 },
              showSymbol: false,
              smooth: true,
            },
          ]
        : []),
      ...visible.map((p) => ({
        name: `${heroes[p.heroId]?.[lang] ?? p.heroId} · ${p.name}`,
        type: "line" as const,
        data: p.impm,
        color: SLOT_COLORS[p.slot] ?? "#3b82f6",
        lineStyle: { width: p.key === focused.key ? 3 : 2 },
        showSymbol: false,
        smooth: true,
        // Each death as a cross on the line at that minute; hovering says when and by whom.
        markPoint: {
          // A dot in the player's colour with a white cross.
          symbol: "circle",
          symbolSize: 15,
          itemStyle: { color: SLOT_COLORS[p.slot] ?? "#3b82f6", borderColor: "#0a0a0a", borderWidth: 1.5 },
          label: { show: true, formatter: "✕", color: "#fff", fontSize: 9, fontWeight: "bold" as const },
          tooltip: { formatter: (x: unknown) => String((x as { name?: string }).name ?? "") },
          data: p.deaths.map((d) => {
            const minute = Math.min(Math.max(0, Math.floor(d.t / 60)), Math.max(0, p.impm.length - 1));
            return {
              name: `${heroes[p.heroId]?.[lang] ?? p.heroId} · ${t.died(
                minute,
                d.by ? (heroes[d.by]?.[lang] ?? null) : dict.dotahub.deaths.unknownKiller,
              )}`,
              coord: [minute, p.impm[minute] ?? 0],
            };
          }),
        },
        markLine:
          p.key === visible[0]?.key
            ? {
                silent: true,
                symbol: "none",
                label: { show: false },
                lineStyle: { type: "dashed" as const, color: "#94a3b8", opacity: 0.6 },
                data: [{ yAxis: 0 }],
              }
            : undefined,
      })),
    ],
  };

  const toggle = (key: string) =>
    setShown((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {[true, false].map((radiant) => (
          <div key={String(radiant)} role="group" aria-label={t.players} className="flex gap-1">
            {players
              .filter((p) => p.radiant === radiant)
              .map((p) => {
                const on = shown.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.key)}
                    title={`${heroes[p.heroId]?.[lang] ?? ""} · ${p.name}`}
                    className={cn(
                      "cursor-pointer rounded-md border-2 p-0.5 transition-opacity",
                      on ? "opacity-100" : "border-transparent opacity-40 grayscale hover:opacity-80",
                    )}
                    style={on ? { borderColor: SLOT_COLORS[p.slot] } : undefined}
                  >
                    {heroes[p.heroId] && (
                      <Image
                        src={heroes[p.heroId].icon}
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                        className="size-6"
                      />
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={overlay}
          onClick={() => setOverlay((v) => !v)}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
            overlay
              ? "border-foreground/40 bg-muted font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span
            className="size-2 rounded-full border-2 border-dashed"
            style={{ borderColor: CROWD_COLOR }}
            aria-hidden
          />
          {t.overlay(heroName)}
        </button>
        {overlay && (
          <div role="group" aria-label={t.tier} className="flex flex-wrap gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((medal) => (
              <button
                key={medal}
                type="button"
                aria-pressed={tier === medal}
                onClick={() => setTier(medal)}
                title={`${medalName(medal * 10, dict.dotahub)}${medal === matchTier ? ` · ${t.thisMatch}` : ""}`}
                className={cn(
                  "relative cursor-pointer rounded-md border p-0.5 transition-opacity",
                  tier === medal
                    ? "border-foreground/50 bg-muted"
                    : "border-transparent opacity-50 hover:opacity-100",
                )}
              >
                <Medal tier={medal * 10} t={dict.dotahub} size={24} />
                {medal === matchTier && (
                  <span
                    className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-foreground"
                    aria-hidden
                  />
                )}
              </button>
            ))}
          </div>
        )}
        {overlay && (
          <span role="status" className="flex items-center gap-1 text-xs text-muted-foreground">
            {pending && !crowd && <Loader2Icon className="size-3 animate-spin" aria-hidden />}
            {crowd
              ? crowd.count < crowd.target
                ? t.collecting(crowd.count, crowd.target)
                : t.sample(crowdLabel, crowd.count)
              : pending
                ? t.loading
                : t.none}
          </span>
        )}
      </div>
      <div style={{ height: 300 }}>
        <EChart option={option} />
      </div>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
    </div>
  );
}

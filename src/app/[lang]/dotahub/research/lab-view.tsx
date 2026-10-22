"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useLocale } from "@/i18n/locale-provider";
import type { HeroInfo } from "@/lib/dota/data";
import type { LabAssets, LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { RequestStratzParse } from "../buttons";
import { Medal, modeName } from "../parts";
import {
  type Align,
  biggestDiffs,
  commonKeyItems,
  damageInsight,
  fightsInsight,
  fmtMetric,
  goldInsight,
  itemsInsight,
  laningInsight,
  miscInsight,
  movementInsight,
  resourcesInsight,
  skillsInsight,
  summary,
  timelineInsight,
  visionInsight,
  xOf,
} from "./insights";
import {
  HeroIcon,
  ItemIcon,
  type LabCtx,
  LabProvider,
  newCursor,
  Section,
  SIDE_COLOR,
  SideDot,
  type SideKey,
  useLab,
  useNames,
} from "./lab-parts";
import { ItemsBody, LaningBody, SkillsBody, TimelineBody } from "./sections-early";
import {
  DamageBody,
  FightsBody,
  GoldBody,
  MiscBody,
  MovementBody,
  ResourcesBody,
  VisionBody,
} from "./sections-late";
import {
  AttributesBlock,
  BaselineNote,
  ContextBody,
  DamageDeepBlock,
  DeathAnalysisBlock,
  FightBreakdownBlock,
  GoldDeepBlock,
  ItemEffectsBlock,
  LaneTradesBlock,
  MovementDeepBlock,
  SkillEfficiencyBlock,
  TimeBody,
  VisionQualityBlock,
} from "./sections-deep";
import {
  contextInsight,
  DEEP_METRICS,
  deepFightsInsight,
  deepGoldInsight,
  deepItemsInsight,
  deepLaningInsight,
  deepMovementInsight,
  deepSkillsInsight,
  deepSummary,
  deepVisionInsight,
  timeInsight,
} from "./advanced";
import { MODULES } from "./x";
import { type Ctx as ModuleCtx, SECTIONS, type SectionKey } from "./x/types";

// The x range of the whole match(es) for an alignment.
function domain(a: LabSide, b: LabSide | null, align: Align): [number, number] {
  const sides = b ? [a, b] : [a];
  if (align.kind === "level")
    return [1, Math.max(...sides.map((s) => s.levelTimes.filter((x) => x != null).length), 2)];
  if (align.kind === "nw")
    return [0, Math.ceil(Math.max(...sides.map((s) => Math.max(0, ...s.minutes.netWorth))) / 1000)];
  const xs = sides
    .flatMap((s) => [xOf(s, -90, align), xOf(s, s.duration, align)])
    .filter((x): x is number => x != null);
  return [Math.floor(Math.min(...xs)), Math.ceil(Math.max(...xs))];
}

export function LabView({
  a,
  b,
  assets,
  heroes,
}: {
  a: LabSide;
  b: LabSide | null;
  assets: LabAssets;
  heroes: Record<number, HeroInfo>;
}) {
  const { t: dict, lang } = useLocale();
  const t = dict.dotahub.research;
  const [align, setAlign] = useState<Align>({ kind: "time" });
  const full = useMemo(() => domain(a, b, align), [a, b, align]);
  const [rangeState, setRange] = useState<{ for: string; value: [number, number] } | null>(null);
  const alignKey = JSON.stringify(align);
  const range = rangeState?.for === alignKey ? rangeState.value : full;
  const [cursor] = useState(newCursor);
  const [rotate, setRotate] = useState(false);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(
    () => Object.fromEntries(SECTIONS.map((k) => [k, true])) as Record<SectionKey, boolean>,
  );
  const common = useMemo(() => commonKeyItems(a, b, assets), [a, b, assets]);

  const ctx: LabCtx = useMemo(
    () => ({ a, b, assets, heroes, align, range, cursor, t, lang, rotate }),
    [a, b, assets, heroes, align, range, cursor, t, lang, rotate],
  );

  return (
    <LabProvider value={ctx}>
      <div className="flex flex-col gap-4">
        <div className={cn("grid gap-3", b && "lg:grid-cols-2")}>
          <SideCard side="a" s={a} />
          {b && <SideCard side="b" s={b} />}
        </div>
        <p className="text-xs text-muted-foreground">{t.header.sourceNote}</p>
        <ModeGuard />

        {/* The controls stay in view: alignment, the shared range, and the sections. */}
        <div className="sticky top-[110px] z-20 flex flex-col gap-2 rounded-xl border bg-background/95 px-3 py-2 backdrop-blur transition-[top] duration-300 [html[data-header-hidden]_&]:top-14">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t.controls.align}</span>
            {(
              [
                ["time", t.controls.alignTime],
                ["level", t.controls.alignLevel],
                ["item", t.controls.alignItem],
                ["nw", t.controls.alignNw],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                disabled={kind === "item" && !common.length}
                aria-pressed={align.kind === kind}
                onClick={() => setAlign(kind === "item" ? { kind: "item", key: common[0] } : { kind })}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-40",
                  align.kind === kind
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title={kind === "item" && !common.length ? t.controls.noCommonItem : undefined}
              >
                {label}
              </button>
            ))}
            {align.kind === "item" && (
              <select
                value={align.key}
                onChange={(e) => setAlign({ kind: "item", key: e.target.value })}
                className="rounded-md border bg-background px-1.5 py-0.5"
                aria-label={t.controls.item}
              >
                {common.map((k) => (
                  <option key={k} value={k}>
                    {assets.items[k]?.[lang] ?? k}
                  </option>
                ))}
              </select>
            )}
            {(!a.radiant || (b && !b.radiant)) && (
              <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} />
                {t.controls.rotate}
              </label>
            )}
            <span className="ml-auto flex gap-1">
              <button
                type="button"
                className="cursor-pointer rounded-md border px-2 py-0.5 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setOpen(Object.fromEntries(SECTIONS.map((k) => [k, true])) as Record<SectionKey, boolean>)
                }
              >
                {t.controls.expandAll}
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-md border px-2 py-0.5 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setOpen(Object.fromEntries(SECTIONS.map((k) => [k, false])) as Record<SectionKey, boolean>)
                }
              >
                {t.controls.collapseAll}
              </button>
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="shrink-0 text-muted-foreground">
              {align.kind === "level"
                ? t.controls.rangeLevel
                : align.kind === "nw"
                  ? t.controls.rangeNw
                  : t.controls.range}
            </span>
            <Slider
              min={full[0]}
              max={full[1]}
              step={align.kind === "level" ? 1 : 0.5}
              value={range}
              onValueChange={(v) => Array.isArray(v) && setRange({ for: alignKey, value: [v[0], v[1]] })}
              className="min-w-0 flex-1"
            />
            <span className="w-28 shrink-0 text-right tabular-nums">
              {align.kind === "level"
                ? `Lv ${range[0]}–${range[1]}`
                : align.kind === "nw"
                  ? `${range[0]}k–${range[1]}k`
                  : `${clock(Math.round(range[0] * 60))}–${clock(Math.round(range[1] * 60))}`}
            </span>
            <button
              type="button"
              onClick={() => setRange(null)}
              className="shrink-0 cursor-pointer rounded-md border px-2 py-0.5 text-muted-foreground hover:text-foreground"
            >
              {t.controls.reset}
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto text-xs">
            {SECTIONS.map((k) => (
              <a
                key={k}
                href={`#lab-${k}`}
                onClick={() => setOpen((o) => ({ ...o, [k]: true }))}
                className="shrink-0 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {t.sections[k]}
              </a>
            ))}
          </nav>
        </div>

        <Summary />

        {SECTIONS.map((k) => (
          <SectionFor key={k} k={k} open={open[k]} onToggle={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} />
        ))}
      </div>
    </LabProvider>
  );
}

// Games the comparisons and the rank averages don't fit: Turbo (double gold and XP) and modes that
// change the heroes or the picks, two games in different modes, league and practice lobbies set
// against averages from public games, two patches, and two players from the same match.
const ODD_MODES = new Set([5, 18, 19, 20, 21, 23]);

function ModeGuard() {
  const { a, b, t } = useLab();
  const { t: dict } = useLocale();
  const g = t.guard;
  const sides: [SideKey, LabSide][] = b
    ? [
        ["a", a],
        ["b", b],
      ]
    : [["a", a]];
  const lines: string[] = [];
  for (const [k, s] of sides)
    if (ODD_MODES.has(s.gameMode))
      lines.push(
        g.oddMode(k === "a" ? t.insight.a : t.insight.b, modeName(s.gameMode, s.lobbyType, dict.dotahub)),
      );
  if (b && (a.gameMode !== b.gameMode || a.lobbyType !== b.lobbyType)) lines.push(g.differentMode);
  if (sides.some(([, s]) => s.lobbyType === 1 || s.lobbyType === 2)) lines.push(g.proLobby);
  if (b && a.patch && b.patch && a.patch.id !== b.patch.id) lines.push(g.patch(a.patch.name, b.patch.name));
  if (b && a.matchId === b.matchId) lines.push(g.sameMatch);
  if (!lines.length) return null;
  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
      <ul className="flex list-disc flex-col gap-0.5 pl-4">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function SectionFor({ k, open, onToggle }: { k: SectionKey; open: boolean; onToggle: () => void }) {
  const ctx = useInsightContext();
  const { t } = ctx;
  const insight = useMemo(() => {
    const { a, b, assets, names } = ctx;
    const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
    const base = (() => {
      switch (k) {
        case "context":
          return contextInsight(a, b, t);
        case "timeline":
          return timelineInsight(a, b, t);
        case "time":
          return timeInsight(a, b, t);
        case "laning":
          return join(laningInsight(a, b, t), deepLaningInsight(a, b, t));
        case "items":
          return join(itemsInsight(a, b, assets, t, names), deepItemsInsight(a, b, assets, t, names));
        case "skills":
          return join(skillsInsight(a, b, t, names), deepSkillsInsight(a, b, t, names));
        case "fights":
          return join(fightsInsight(a, b, t), deepFightsInsight(a, b, t));
        case "damage":
          return damageInsight(a, b, t, names);
        case "vision":
          return join(visionInsight(a, b, t), deepVisionInsight(a, b, t));
        case "movement":
          return join(movementInsight(a, b, t), deepMovementInsight(a, b, t));
        case "resources":
          return resourcesInsight(a, b, t);
        case "gold":
          return join(goldInsight(a, b, t), deepGoldInsight(a, b, assets, t));
        case "misc":
          return miscInsight(a, b, t);
        default:
          return "";
      }
    })();
    const more = MODULES.flatMap((m) => {
      try {
        return m.insights?.(ctx)[k] ?? [];
      } catch {
        return [];
      }
    });
    return join(base, ...more);
  }, [ctx, k, t]);
  const base: Partial<Record<SectionKey, React.ReactNode>> = {
    context: <ContextBody />,
    timeline: (
      <>
        <BaselineNote />
        <TimelineBody />
      </>
    ),
    time: <TimeBody />,
    laning: (
      <>
        <LaningBody />
        <LaneTradesBlock />
      </>
    ),
    items: (
      <>
        <ItemsBody />
        <ItemEffectsBlock />
      </>
    ),
    skills: (
      <>
        <SkillsBody />
        <SkillEfficiencyBlock />
      </>
    ),
    fights: (
      <>
        <FightsBody />
        <FightBreakdownBlock />
        <DeathAnalysisBlock />
      </>
    ),
    damage: (
      <>
        <DamageBody />
        <DamageDeepBlock />
      </>
    ),
    vision: (
      <>
        <VisionBody />
        <VisionQualityBlock />
      </>
    ),
    movement: (
      <>
        <MovementBody />
        <MovementDeepBlock />
      </>
    ),
    resources: <ResourcesBody />,
    gold: (
      <>
        <GoldBody />
        <GoldDeepBlock />
      </>
    ),
    misc: (
      <>
        <MiscBody />
        <AttributesBlock />
      </>
    ),
  };
  const blocks = MODULES.map((m) => m.blocks[k]).filter((B): B is React.ComponentType => !!B);
  if (!base[k] && !blocks.length) return null;
  return (
    <Section id={k} title={t.sections[k]} insight={insight} open={open} onToggle={onToggle}>
      {base[k]}
      {blocks.map((B, i) => (
        <Fragment key={i}>
          <B />
        </Fragment>
      ))}
    </Section>
  );
}

// The sides, names and dictionary the sentences need (kept stable between renders).
function useInsightContext(): ModuleCtx {
  const { a, b, assets, t } = useLab();
  const names = useNames();
  return useMemo(() => ({ a, b, assets, t, names }), [a, b, assets, t, names]);
}

// A module's part that throws (unexpected data) is left out rather than breaking the page.
function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}

function Summary() {
  const ctx = useInsightContext();
  const { a, b, assets, t, names } = ctx;
  const lines = useMemo(() => {
    const extra = MODULES.flatMap((m) => safe(() => m.summary?.(ctx) ?? [], []))
      .sort((x, y) => y.w - x.w)
      .slice(0, 6)
      .map((x) => x.text);
    return [...summary(a, b, assets, t, names), ...deepSummary(a, b, assets, t, names), ...extra].filter(
      (l, i, all) => l && all.indexOf(l) === i,
    );
  }, [ctx, a, b, assets, t, names]);
  const diffs = useMemo(
    () =>
      b ? biggestDiffs(a, b, [...DEEP_METRICS, ...MODULES.flatMap((m) => m.metrics ?? [])]).slice(0, 12) : [],
    [a, b],
  );
  const lessons = useMemo(
    () =>
      MODULES.flatMap((m) => safe(() => m.lessons?.(ctx) ?? [], []))
        .filter((l) => l.gold > 0)
        .sort((x, y) => y.gold - x.gold),
    [ctx],
  );
  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <h2 className="font-semibold">{b ? t.summary.title : t.summary.single}</h2>
      {lines.length ? (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t.summary.none}</p>
      )}
      {b && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">
            {t.summary.diffs}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t.summary.diffHint}</span>
          </h3>
          {diffs.length ? (
            <table className="mt-2 w-full max-w-2xl text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1 font-normal" />
                  <th className="py-1 text-right font-normal">
                    <SideDot side="a" className="mr-1" />
                    {t.insight.a}
                  </th>
                  <th className="py-1 text-right font-normal">
                    <SideDot side="b" className="mr-1" />
                    {t.insight.b}
                  </th>
                  <th className="py-1 pl-3 font-normal">{t.summary.better}</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr key={d.key} className="border-b last:border-0">
                    <td className="py-1">
                      {d.label?.(t) ?? t.metrics[d.key] ?? d.key}
                      {(d.until != null || d.byPct || d.noise) && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {[
                            d.until != null && t.summary.window(clock(d.until)),
                            d.byPct && t.summary.byPct,
                            d.noise && t.summary.noise,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className={cn("py-1 text-right tabular-nums", d.better === "a" && "font-semibold")}>
                      {fmtMetric(d.a, d.fmt)}
                    </td>
                    <td className={cn("py-1 text-right tabular-nums", d.better === "b" && "font-semibold")}>
                      {fmtMetric(d.b, d.fmt)}
                    </td>
                    <td className="py-1 pl-3">{d.better ? <SideDot side={d.better} /> : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t.summary.none}</p>
          )}
        </div>
      )}
      {lessons.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">
            {t.summary.lessons}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t.summary.lessonsHint}</span>
          </h3>
          <div className={cn("mt-2 grid gap-3", b && "lg:grid-cols-2")}>
            {(["a", "b"] as const)
              .filter((k) => k === "a" || b)
              .map((k) => (
                <ol key={k} className="flex flex-col gap-1 text-sm">
                  {lessons
                    .filter((l) => l.side === k)
                    .slice(0, 8)
                    .map((l, i) => (
                      <li key={i} className="flex items-baseline gap-2">
                        <SideDot side={k} />
                        <span className="flex-1">{l.text}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          ≈{Math.round(l.gold).toLocaleString()}
                        </span>
                      </li>
                    ))}
                </ol>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SideCard({ side, s }: { side: SideKey; s: LabSide }) {
  const { t: dict, href, lang } = useLocale();
  const t = dict.dotahub.research;
  const h = t.header;
  return (
    <LabHeroCard side={side} s={s}>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link
          href={href(`/dotahub/matches/${s.matchId}`)}
          className="inline-flex items-center gap-1 hover:underline"
        >
          {h.match} {s.matchId}
          <ExternalLinkIcon className="size-3" aria-hidden />
        </Link>
        {s.match.replayUrl && (
          <a
            href={s.match.replayUrl}
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
            title={h.replayHint}
          >
            {h.replay}
          </a>
        )}
        <span className={s.win ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
          {s.win ? h.win : h.loss}
        </span>
        <span>
          {h.duration} {clock(s.duration)}
        </span>
        <span className="text-muted-foreground">{modeName(s.gameMode, s.lobbyType, dict.dotahub)}</span>
        <span className="text-muted-foreground">
          {new Date(s.startTime * 1000).toLocaleDateString(lang === "zh" ? "zh-CN" : "en")}
        </span>
        {(s.teams.league || s.teams.radiant) && (
          <span className="text-muted-foreground">
            {[s.teams.league, s.teams.radiant && s.teams.dire && `${s.teams.radiant} vs ${s.teams.dire}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs sm:grid-cols-6">
        <Stat label={h.kda} value={`${s.totals.kills}/${s.totals.deaths}/${s.totals.assists}`} />
        <Stat label={h.netWorth} value={s.totals.netWorth.toLocaleString()} />
        <Stat label={h.gpmXpm} value={`${s.totals.gpm} / ${s.totals.xpm}`} />
        <Stat label={h.lhDn} value={`${s.totals.lastHits} / ${s.totals.denies}`} />
        <Stat label={h.level} value={String(s.totals.level)} />
        <Stat label={h.imp} value={s.totals.imp != null ? String(s.totals.imp) : "–"} />
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>
          {h.lane}
          {t.insight.colon}
          {s.lane ? t.lanes[s.lane] : "–"}
          {s.position ? ` · ${h.position(s.position)}` : ""}
          {s.positionFrom && (
            <span className="ml-1 text-muted-foreground">（{h.positionFrom[s.positionFrom]}）</span>
          )}
        </span>
        <PositionPick side={side} s={s} />
        <span className="flex items-center gap-1">
          {h.opponents}
          {t.insight.colon}
          {s.laneOpponents.length ? s.laneOpponents.map((x) => <HeroIcon key={x} id={x} size={18} />) : "–"}
        </span>
        <span className="flex items-center gap-1">
          {s.items.final.map((k, i) => (
            <ItemIcon key={i} k={k} size={18} />
          ))}
        </span>
        {s.rank ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            {h.rank}
            <Medal tier={s.rank} t={dict.dotahub} size={24} />
          </span>
        ) : null}
      </div>
      {!s.parsed.stratz && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-xs">
          <span className="flex-1">{t.unparsed.stratz}</span>
          <RequestStratzParse matchId={s.matchId} />
        </div>
      )}
    </LabHeroCard>
  );
}

// Choosing which position's rank average a side is compared with (?pa= / ?pb=).
function PositionPick({ side, s }: { side: SideKey; s: LabSide }) {
  const { t: dict } = useLocale();
  const h = dict.dotahub.research.header;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const key = side === "a" ? "pa" : "pb";
  const current = params.get(key) ?? "";
  return (
    <label className="flex items-center gap-1 text-muted-foreground">
      {h.positionPick}
      <select
        value={current}
        onChange={(e) => {
          const q = new URLSearchParams(params.toString());
          if (e.target.value) q.set(key, e.target.value);
          else q.delete(key);
          router.push(`${pathname}?${q}`, { scroll: false });
        }}
        className="rounded border bg-background px-1 py-0.5"
      >
        <option value="">
          {h.positionAuto}
          {s.positionFrom !== "override" && s.position ? ` (${s.position})` : ""}
        </option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {h.position(n)}
          </option>
        ))}
      </select>
    </label>
  );
}

function LabHeroCard({ side, s, children }: { side: SideKey; s: LabSide; children: React.ReactNode }) {
  const { t: dict, href } = useLocale();
  const t = dict.dotahub.research;
  const names = useNames();
  return (
    <article
      className="flex flex-col gap-2 rounded-xl border p-3"
      style={{ borderTop: `3px solid ${SIDE_COLOR[side]}` }}
    >
      <header className="flex items-center gap-3">
        <HeroPortrait id={s.heroId} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold">
            <SideDot side={side} />
            {side === "a" ? t.insight.a : t.insight.b}
          </p>
          <p className="truncate text-lg font-bold">{names.heroes(s.heroId)}</p>
          <p className="truncate text-sm">
            {s.accountId ? (
              <Link href={href(`/dotahub/players/${s.accountId}`)} className="hover:underline">
                {s.name ?? s.accountId}
              </Link>
            ) : (
              <span className="text-muted-foreground">{s.name ?? t.header.anonymous}</span>
            )}
          </p>
        </div>
      </header>
      {children}
    </article>
  );
}

function HeroPortrait({ id }: { id: number }) {
  const h = useLab().heroes[id];
  if (!h) return <span className="size-14 rounded bg-muted" />;
  return (
    <Image
      src={h.img}
      alt=""
      width={96}
      height={54}
      unoptimized
      className="h-[54px] w-24 rounded object-cover"
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

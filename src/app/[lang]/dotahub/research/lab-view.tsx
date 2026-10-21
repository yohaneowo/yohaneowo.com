"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
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

const SECTIONS = [
  "context",
  "timeline",
  "time",
  "laning",
  "items",
  "skills",
  "fights",
  "damage",
  "vision",
  "movement",
  "resources",
  "gold",
  "misc",
] as const;
type SectionKey = (typeof SECTIONS)[number];

// The x range of the whole match(es) for an alignment.
function domain(a: LabSide, b: LabSide | null, align: Align): [number, number] {
  const sides = b ? [a, b] : [a];
  if (align.kind === "level")
    return [1, Math.max(...sides.map((s) => s.levelTimes.filter((x) => x != null).length), 2)];
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
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(
    () => Object.fromEntries(SECTIONS.map((k) => [k, true])) as Record<SectionKey, boolean>,
  );
  const common = useMemo(() => commonKeyItems(a, b, assets), [a, b, assets]);

  const ctx: LabCtx = useMemo(
    () => ({ a, b, assets, heroes, align, range, cursor, t, lang }),
    [a, b, assets, heroes, align, range, cursor, t, lang],
  );

  return (
    <LabProvider value={ctx}>
      <div className="flex flex-col gap-4">
        <div className={cn("grid gap-3", b && "lg:grid-cols-2")}>
          <SideCard side="a" s={a} />
          {b && <SideCard side="b" s={b} />}
        </div>
        <p className="text-xs text-muted-foreground">{t.header.sourceNote}</p>

        {/* The controls stay in view: alignment, the shared range, and the sections. */}
        <div className="sticky top-[110px] z-20 flex flex-col gap-2 rounded-xl border bg-background/95 px-3 py-2 backdrop-blur transition-[top] duration-300 [html[data-header-hidden]_&]:top-14">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t.controls.align}</span>
            {(
              [
                ["time", t.controls.alignTime],
                ["level", t.controls.alignLevel],
                ["item", t.controls.alignItem],
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
              {align.kind === "level" ? t.controls.rangeLevel : t.controls.range}
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

function SectionFor({ k, open, onToggle }: { k: SectionKey; open: boolean; onToggle: () => void }) {
  const ctx = useInsightContext();
  const { t } = ctx;
  const insight = useMemo(() => {
    const { a, b, assets, names } = ctx;
    const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
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
        return join(goldInsight(a, b, t), deepGoldInsight(a, b, t));
      default:
        return miscInsight(a, b, t);
    }
  }, [ctx, k, t]);
  const body = {
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
  }[k];
  return (
    <Section id={k} title={t.sections[k]} insight={insight} open={open} onToggle={onToggle}>
      {body}
    </Section>
  );
}

// The sides, names and dictionary the sentences need (kept stable between renders).
function useInsightContext() {
  const { a, b, assets, t } = useLab();
  const names = useNames();
  return useMemo(() => ({ a, b, assets, t, names }), [a, b, assets, t, names]);
}

function Summary() {
  const { a, b, assets, t } = useInsightContext();
  const names = useNames();
  const lines = useMemo(
    () =>
      [...summary(a, b, assets, t, names), ...deepSummary(a, b, assets, t, names)].filter(
        (l, i, all) => all.indexOf(l) === i,
      ),
    [a, b, assets, t, names],
  );
  const diffs = useMemo(() => (b ? biggestDiffs(a, b, DEEP_METRICS).slice(0, 10) : []), [a, b]);
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
                    <td className="py-1">{t.metrics[d.key] ?? d.key}</td>
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
        </span>
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

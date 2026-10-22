"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { type Metric, num, pct, xOf } from "../insights";
import { buildingName } from "../sections-late";
import {
  Caveat,
  HeroIcon,
  ItemIcon,
  PerSide,
  SIDE_COLOR,
  type SideKey,
  Sub,
  useLab,
  useNames,
  useSides,
  useTimeWindow,
} from "../lab-parts";
import {
  bootsTable,
  type ChoiceRow,
  fightsAfterEnemySpike,
  itemChoices,
  neutralMeta,
  type ObjectiveKind,
  SPIKE_ITEMS,
  SPIKE_WINDOW,
  spikeRows,
  spikeUse,
  startingItems,
  type Threat,
  threats,
  tpCarry,
} from "./items-calc";
import type { Ctx, LabModule } from "./types";

// Items in depth: the build against the rank's and the pros' games, starting items and boots,
// carrying a TP, the items that answer the enemy lineup, both teams' power spikes and what came of
// the player's own, neutral items against the pros', and other units' items.

const sec = (t: number) => clock(Math.round(t));

const TONE = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  plain: "bg-muted text-muted-foreground",
  warn: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  bad: "bg-red-500/15 text-red-700 dark:text-red-300",
};
const RANK_TONE: Record<NonNullable<ChoiceRow["rankTag"]>, keyof typeof TONE> = {
  staple: "good",
  common: "plain",
  rare: "warn",
  thin: "plain",
  unlisted: "warn",
};
const PRO_TONE: Record<NonNullable<ChoiceRow["proTag"]>, keyof typeof TONE> = {
  common: "good",
  uncommon: "warn",
  offMeta: "bad",
  otherPhase: "warn",
};

function Tag({ tone, title, children }: { tone: keyof typeof TONE; title?: string; children: ReactNode }) {
  return (
    <span className={cn("rounded px-1 text-[10px] whitespace-nowrap", TONE[tone])} title={title}>
      {children}
    </span>
  );
}

// An item's icon, or its name when the page has no picture for it (an answer nobody bought).
function ItemMark({ k, size = 16, dim = false }: { k: string; size?: number; dim?: boolean }) {
  const { assets, t } = useLab();
  const names = useNames();
  if (assets.items[k]) return <ItemIcon k={k} size={size} className={cn(dim && "opacity-50 grayscale")} />;
  return <span className="text-muted-foreground">{t.x.items.fallbackNames[k] ?? names.items(k)}</span>;
}

// ── The build against the field ──────────────────────────────────────────────────────────────

function ChoiceSide({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.items;
  const names = useNames();
  const { rows, skipped } = useMemo(() => itemChoices(s, assets), [s, assets]);
  if (!rows.length && !skipped.length)
    return <p className="text-xs text-muted-foreground">{t.resources.none}</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{x.item}</th>
              <th className="py-1 font-normal" title={x.phasesHint}>
                {x.bought}
              </th>
              <th className="py-1 text-right font-normal">{x.rank}</th>
              <th className="py-1 text-right font-normal">{x.rankWin}</th>
              <th className="py-1 text-right font-normal">{x.pro}</th>
              <th className="py-1 pl-2 font-normal">{x.reading}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-1">
                  <span className="flex items-center gap-1.5">
                    <ItemIcon k={r.key} size={18} />
                    <span className="max-w-32 truncate">{names.items(r.key)}</span>
                  </span>
                </td>
                <td className="py-1 whitespace-nowrap tabular-nums">
                  {sec(r.t)} <span className="text-muted-foreground">{x.phases[r.phase]}</span>
                </td>
                <td className="py-1 text-right tabular-nums">
                  {r.rank ? (
                    `${r.rankTag === "thin" ? "≥" : ""}${pct(r.rank.rate)}`
                  ) : r.rankTag === "unlisted" ? (
                    <span className="text-muted-foreground">{x.unlisted}</span>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">{r.rank ? pct(r.rank.win) : "–"}</td>
                <td className="py-1 text-right whitespace-nowrap tabular-nums">
                  {r.pro
                    ? r.pro.n == null
                      ? x.proFew(r.pro.of)
                      : x.proValue(r.pro.n, r.pro.of, r.pro.phase ?? 0)
                    : "–"}
                </td>
                <td className="py-1 pl-2">
                  <span className="flex flex-wrap gap-1">
                    {r.rankTag && (
                      <Tag tone={RANK_TONE[r.rankTag]} title={x.rankTagHints[r.rankTag]}>
                        {x.rankTags[r.rankTag]}
                      </Tag>
                    )}
                    {r.proTag && (
                      <Tag tone={PRO_TONE[r.proTag]} title={x.proTagHints[r.proTag]}>
                        {r.usual ? x.proUsual(x.phasesIn[r.usual]) : x.proTags[r.proTag]}
                      </Tag>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {skipped.length > 0 && (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">{x.skipped}</span>
          <span className="flex flex-wrap gap-1.5">
            {skipped.map((m) => (
              <span
                key={m.key}
                className={cn("flex items-center gap-1 rounded border px-1.5 py-0.5", m.late && "opacity-60")}
                title={m.late ? x.notReached : undefined}
              >
                <ItemIcon k={m.key} size={16} />
                <span className="max-w-28 truncate">{names.items(m.key)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {[
                    m.rate != null && `${x.rank} ${pct(m.rate)}`,
                    m.pro != null && m.of && `${x.proShort} ${m.pro}/${m.of}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {m.late && <span className="text-muted-foreground">· {x.notReached}</span>}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function ChoiceBlock() {
  const { t } = useLab();
  const x = t.x.items;
  return (
    <Sub title={x.choice} hint={x.choiceHint}>
      <PerSide>{(k, s) => <ChoiceSide s={s} />}</PerSide>
      <Caveat kind="source">{x.choiceNote}</Caveat>
    </Sub>
  );
}

// ── Starting items and boots ─────────────────────────────────────────────────────────────────

function StartSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.items;
  const names = useNames();
  const start = useMemo(() => startingItems(s), [s]);
  const boots = useMemo(() => bootsTable(s), [s]);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">{x.startItems}</span>
        <span className="flex flex-wrap gap-1.5">
          {start.mine.map((r) => (
            <span
              key={r.key}
              className={cn(
                "flex items-center gap-1 rounded border px-1.5 py-0.5",
                start.listed && (r.rate == null || r.rate < 0.1) && "border-amber-500/60 bg-amber-500/10",
              )}
            >
              <ItemIcon k={r.key} size={16} />
              {r.count > 1 && <span className="tabular-nums">×{r.count}</span>}
              {start.listed && (
                <span className="text-muted-foreground tabular-nums">
                  {r.rate != null ? pct(r.rate) : x.unlisted}
                </span>
              )}
            </span>
          ))}
          {!start.mine.length && <span className="text-muted-foreground">–</span>}
        </span>
      </div>
      {start.skipped.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">{x.startSkipped}</span>
          <span className="flex flex-wrap gap-1.5">
            {start.skipped.map((r) => (
              <span key={r.key} className="flex items-center gap-1 rounded border px-1.5 py-0.5">
                <ItemIcon k={r.key} size={16} />
                <span className="tabular-nums">{pct(r.rate)}</span>
                <span className="text-muted-foreground">
                  {r.later != null ? x.later(sec(r.later)) : x.never}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}
      {boots.mine.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{x.boots}</th>
                <th className="py-1 font-normal">{x.bootsCols.bought}</th>
                <th className="py-1 text-right font-normal">{x.bootsCols.share}</th>
                <th className="py-1 text-right font-normal">{x.bootsCols.time}</th>
                <th className="py-1 text-right font-normal">{x.bootsCols.win}</th>
                <th className="py-1 text-right font-normal">{x.bootsCols.uses}</th>
                <th className="py-1 text-right font-normal">{x.bootsCols.rankUses}</th>
              </tr>
            </thead>
            <tbody>
              {boots.mine.map((b) => (
                <tr key={b.key} className="border-b last:border-0">
                  <td className="py-1">
                    <span className="flex items-center gap-1.5">
                      <ItemIcon k={b.key} size={18} />
                      <span className="max-w-28 truncate">{names.items(b.key)}</span>
                    </span>
                  </td>
                  <td className="py-1 tabular-nums">{sec(b.t)}</td>
                  <td className="py-1 text-right tabular-nums">{b.rank ? pct(b.rank.share, 1) : "–"}</td>
                  <td className="py-1 text-right tabular-nums">{b.rank ? sec(b.rank.time) : "–"}</td>
                  <td className="py-1 text-right tabular-nums">{b.rank ? pct(b.rank.win, 1) : "–"}</td>
                  <td className="py-1 text-right tabular-nums">
                    {b.uses ? x.countPm(num(b.uses), num(b.usesPm, 1)) : "–"}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {b.rank && b.rank.act > 0 ? x.countPm(num(b.rank.act, 1), num(b.rank.actPm, 1)) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {boots.common.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          {x.rankBoots}
          {t.insight.colon}
          {boots.common.map((b) => (
            <span key={b.key} className="flex items-center gap-1 tabular-nums">
              <ItemIcon k={b.key} size={14} />
              {pct(b.share, 1)} · {sec(b.time)}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function StartBlock() {
  const { t } = useLab();
  const x = t.x.items;
  const sides = useSides();
  // The rank's average game length behind its uses a minute (one per distinct reference).
  const avgs = [
    ...new Set(
      sides.flatMap(([, s]) => {
        const bt = bootsTable(s);
        return bt.avg != null && bt.mine.some((b) => b.rank) ? [num(bt.avg, 1)] : [];
      }),
    ),
  ];
  return (
    <Sub title={x.start}>
      <PerSide>{(k, s) => <StartSide s={s} />}</PerSide>
      {avgs.length > 0 && <Caveat kind="estimate">{x.bootsNote(avgs.join(" / "))}</Caveat>}
    </Sub>
  );
}

// ── Carrying a TP ────────────────────────────────────────────────────────────────────────────

type Tp = NonNullable<ReturnType<typeof tpCarry>>;

// The runs without a TP on the shared x axis, with the deaths and own towers lost; the part before
// 10:00 (not counted) greyed.
function TpBand({ s, tp }: { s: LabSide; tp: Tp }) {
  const { align, range } = useLab();
  const span = range[1] - range[0] || 1;
  const pos = (t: number) => {
    const v = xOf(s, t, align);
    return v == null ? null : ((v - range[0]) / span) * 100;
  };
  const bar = (a: number, b: number, key: string, className: string, title?: string) => {
    const l = pos(a);
    const r = pos(b);
    if (l == null || r == null) return null;
    const left = Math.max(0, l);
    const right = Math.min(100, r);
    if (right <= left) return null;
    return (
      <span
        key={key}
        title={title}
        className={cn("absolute inset-y-0", className)}
        style={{ left: `${left}%`, width: `${right - left}%` }}
      />
    );
  };
  const dot = (t: number, key: string, color: string, title: string) => {
    const l = pos(t);
    if (l == null || l < 0 || l > 100) return null;
    return (
      <span
        key={key}
        title={title}
        className="absolute top-0.5 size-3 -translate-x-1/2 rounded-full border border-white"
        style={{ left: `${l}%`, background: color }}
      />
    );
  };
  return (
    <div className="relative h-4 overflow-hidden rounded bg-muted/40">
      {bar(-90, tp.lo, "early", "bg-muted")}
      {tp.gaps.map((g, i) => bar(g.from, g.to, `g${i}`, "bg-red-500/70", `${sec(g.from)}–${sec(g.to)}`))}
      {tp.deaths.map((d, i) => dot(d.t, `d${i}`, "#71717a", sec(d.t)))}
      {tp.towers.map((o, i) => dot(o.t, `o${i}`, "#eab308", sec(o.t)))}
    </div>
  );
}

function TpSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.items;
  const [from, to] = useTimeWindow(s);
  const tp = useMemo(() => tpCarry(s, from, to), [s, from, to]);
  if (!tp) return <p className="text-xs text-muted-foreground">{x.tpNone}</p>;
  if (tp.hi <= tp.lo) return <p className="text-xs text-muted-foreground">{x.tpEarly}</p>;
  // A tower that fell while the player was dead says nothing about the TP.
  const checks: [string, { t: number; has: boolean | null; dead: boolean; label?: string }[]][] = [
    ["deaths", tp.deaths.map((d) => ({ ...d, dead: false }))],
    ["fights", tp.fights.map((d) => ({ ...d, dead: false }))],
    [
      "towers",
      tp.towers.map((d) => ({
        t: d.t,
        has: d.has,
        dead: d.dead,
        label: `${sec(d.t)} ${buildingName(d.key, t)}`,
      })),
    ],
  ];
  return (
    <div className="flex flex-col gap-2 text-xs">
      <TpBand s={s} tp={tp} />
      <p className="text-[10px] text-muted-foreground">{x.tpBand}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">{x.tpLess}</dt>
        <dd className="tabular-nums">
          {x.tpLessValue(sec(tp.total), pct(tp.alive ? tp.total / tp.alive : null, 1))}
        </dd>
        <dt className="text-muted-foreground">{x.tpLongest}</dt>
        <dd className="tabular-nums">
          {tp.longest ? x.tpLongestValue(sec(tp.longest.alive), sec(tp.longest.from)) : "–"}
        </dd>
        <dt className="text-muted-foreground">{x.tpGaps}</dt>
        <dd className="tabular-nums">{tp.gaps.length}</dd>
        {checks.map(([key, list]) => {
          const without = list.filter((c) => c.has === false && !c.dead);
          const dead = list.filter((c) => c.dead).length;
          return (
            <Fragment key={key}>
              <dt className="text-muted-foreground">{x.tpChecks[key]}</dt>
              <dd className="tabular-nums">
                {list.length ? x.tpWithout(without.length, list.length) : "–"}
                {without.length > 0 && (
                  <span className="ml-1.5 text-red-600 dark:text-red-400">
                    {without.map((c) => c.label ?? sec(c.t)).join(t.insight.sep)}
                  </span>
                )}
                {dead > 0 && (
                  <span className="ml-1.5 text-muted-foreground">
                    {x.tpDead} {dead}
                  </span>
                )}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}

function TpBlock() {
  const { t } = useLab();
  const x = t.x.items;
  return (
    <Sub title={x.tp} hint={x.tpHint}>
      <PerSide>{(k, s) => <TpSide s={s} />}</PerSide>
      <Caveat kind="source">{x.tpNote}</Caveat>
    </Sub>
  );
}

// ── The items that answer the enemy lineup ───────────────────────────────────────────────────

function ThreatEvidence({ th }: { th: Threat }) {
  const { t } = useLab();
  const x = t.x.items;
  const names = useNames();
  if (th.kind === "magic") return <>{x.magicLine(pct(th.value))}</>;
  if (th.kind === "physical") return <>{x.physicalLine(pct(th.value))}</>;
  if (th.kind === "control") return <>{x.controlLine(num(th.value, 1))}</>;
  return (
    <>
      {th.from.map((f, i) => (
        <span key={i} className="flex items-center gap-0.5 tabular-nums" title={names.heroes(f.hero)}>
          <HeroIcon id={f.hero} size={16} />
          {f.key && <ItemIcon k={f.key} size={14} />}
          {f.t != null && sec(f.t)}
          {f.perMin != null && x.healLine(num(f.perMin))}
        </span>
      ))}
    </>
  );
}

function CounterSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.items;
  const names = useNames();
  const list = useMemo(() => threats(s), [s]);
  const typed = s.advanced.damage.some((d) => !d.out);
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {!list.length && <p className="text-muted-foreground">{x.noThreat}</p>}
      {list.map((th) => (
        <div key={th.kind} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="w-16 shrink-0 font-medium">{x.threats[th.kind]}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
            <ThreatEvidence th={th} />
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {th.counters.map((c) => (
              <span
                key={c.key}
                className={cn(
                  "flex items-center gap-1 rounded border px-1 py-0.5 tabular-nums",
                  c.t == null && "border-dashed text-muted-foreground",
                )}
                title={[names.items(c.key), c.rate != null && x.rankRate(pct(c.rate))]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <ItemMark k={c.key} dim={c.t == null} />
                {c.t != null ? sec(c.t) : x.notBought}
              </span>
            ))}
          </span>
        </div>
      ))}
      {!typed && <p className="text-muted-foreground">{x.noTypes}</p>}
    </div>
  );
}

function CounterBlock() {
  const { t } = useLab();
  const x = t.x.items;
  return (
    <Sub title={x.counter} hint={x.counterHint}>
      <PerSide>{(k, s) => <CounterSide s={s} />}</PerSide>
      <Caveat kind="estimate">{x.counterNote}</Caveat>
    </Sub>
  );
}

// ── Power spikes ─────────────────────────────────────────────────────────────────────────────

// Icons packed into as few lines as keep them apart, as fractions of the track.
function pack<T extends { f: number }>(list: T[], gap: number) {
  const ends: number[] = [];
  return list
    .sort((a, b) => a.f - b.f)
    .map((p) => {
      let line = ends.findIndex((end) => end <= p.f);
      if (line < 0) {
        line = ends.length;
        ends.push(0);
      }
      ends[line] = p.f + gap;
      return { ...p, line };
    });
}

function SpikeTimeline({ side, s }: { side: SideKey; s: LabSide }) {
  const { align, range, assets, t } = useLab();
  const x = t.x.items;
  const names = useNames();
  const rows = useMemo(() => {
    const span = range[1] - range[0] || 1;
    const frac = (t: number) => {
      const v = xOf(s, t, align);
      return v == null || v < range[0] || v > range[1] ? null : (v - range[0]) / span;
    };
    return spikeRows(s, assets).map((r) => {
      const placed = pack(
        r.items.flatMap((k) => {
          const f = frac(k.t);
          return f == null ? [] : [{ ...k, f }];
        }),
        0.045,
      );
      return {
        ...r,
        placed,
        lines: Math.max(1, ...placed.map((p) => p.line + 1)),
        l6: r.level6 != null ? frac(r.level6) : null,
      };
    });
  }, [s, assets, align, range]);
  const fights = useMemo(() => {
    const span = range[1] - range[0] || 1;
    return s.fights.teamfights.flatMap((f) => {
      const v = xOf(s, f.start, align);
      return v == null || v < range[0] || v > range[1] ? [] : [{ ...f, f: (v - range[0]) / span }];
    });
  }, [s, align, range]);
  if (!rows.length) return <p className="text-xs text-muted-foreground">{t.resources.none}</p>;
  const ICON = 14;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-7 shrink-0 text-[10px] leading-3 text-muted-foreground">{x.fightsRow}</span>
        <span className="relative h-3 min-w-0 flex-1 rounded bg-muted/40">
          {fights.map((f, i) => (
            <span
              key={i}
              title={`${sec(f.start)} · ${f.teamDeaths} / ${f.enemyDeaths}`}
              className="absolute top-0 h-3 w-0.75 -translate-x-1/2 rounded"
              style={{
                left: `${f.f * 100}%`,
                background:
                  f.enemyDeaths > f.teamDeaths
                    ? "#22c55e"
                    : f.enemyDeaths < f.teamDeaths
                      ? "#ef4444"
                      : "#a3a3a3",
                opacity: f.joined ? 1 : 0.45,
              }}
            />
          ))}
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.slot} className="flex items-center gap-2">
          <span
            className={cn("w-7 shrink-0 border-l-2 pl-0.5", r.ours ? "border-emerald-500" : "border-red-500")}
            title={names.heroes(r.hero)}
          >
            <HeroIcon id={r.hero} size={20} />
          </span>
          <span
            className={cn("relative min-w-0 flex-1 rounded", r.me ? "bg-muted/70" : "bg-muted/30")}
            style={{
              height: r.lines * (ICON + 4) + 2,
              ...(r.me ? { boxShadow: `inset 0 0 0 1px ${SIDE_COLOR[side]}` } : {}),
            }}
          >
            {r.l6 != null && (
              <span
                className="absolute top-0.5 -translate-x-1/2 rounded-sm bg-violet-600/80 px-0.5 text-[9px] leading-3 font-semibold text-white"
                style={{ left: `${r.l6 * 100}%` }}
                title={`${x.level6} ${sec(r.level6 ?? 0)}`}
              >
                6
              </span>
            )}
            {r.placed.map((p) => (
              <span
                key={p.key}
                className="absolute"
                style={{ left: `calc(${p.f * 100}% - ${ICON * 0.68}px)`, top: 2 + p.line * (ICON + 4) }}
              >
                <ItemIcon
                  k={p.key}
                  size={ICON}
                  title={`${names.items(p.key)} · ${sec(p.t)}`}
                  className={cn(SPIKE_ITEMS.has(p.key) && "ring-2 ring-amber-400")}
                />
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function SpikeUseSide({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.items;
  const names = useNames();
  const [from, to] = useTimeWindow(s);
  const rows = useMemo(() => spikeUse(s, assets, from, to), [s, assets, from, to]);
  if (!rows.length) return <p className="text-xs text-muted-foreground">{t.resources.none}</p>;
  const objectives = (list: ObjectiveKind[]) => {
    const counts = new Map<ObjectiveKind, number>();
    for (const o of list) counts.set(o, (counts.get(o) ?? 0) + 1);
    return [...counts.entries()]
      .map(([k, n]) => `${x.objectives[k]}${n > 1 ? ` ×${n}` : ""}`)
      .join(t.insight.sep);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.item}</th>
            <th className="py-1 font-normal">{x.afterCols.t}</th>
            <th className="py-1 text-right font-normal">{x.afterCols.fights}</th>
            <th className="py-1 text-right font-normal">{x.afterCols.ka}</th>
            <th className="py-1 pl-3 font-normal">{x.afterCols.taken}</th>
            <th className="py-1 text-right font-normal">{x.afterCols.tower}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className={cn(
                "border-b last:border-0",
                r.fights > 0 && r.joined === 0 && "text-muted-foreground",
              )}
            >
              <td className="py-1">
                <span className="flex items-center gap-1.5" title={names.items(r.key)}>
                  <ItemIcon k={r.key} size={18} />
                  <span className="max-w-28 truncate">{names.items(r.key)}</span>
                </span>
              </td>
              <td className="py-1 tabular-nums">
                {sec(r.t)}
                {r.span < SPIKE_WINDOW && (
                  <span className="ml-1 text-[10px] text-muted-foreground">{x.cut(Math.round(r.span))}</span>
                )}
              </td>
              <td className="py-1 text-right tabular-nums">
                {r.joined} / {r.fights}
              </td>
              <td className="py-1 text-right tabular-nums">
                {r.kills} / {r.assists}
              </td>
              <td className="py-1 pl-3">{r.objectives.length ? objectives(r.objectives) : "–"}</td>
              <td className="py-1 text-right tabular-nums">{num(r.towerDamage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnemySpikeSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.items;
  const names = useNames();
  const [from, to] = useTimeWindow(s);
  const rows = useMemo(() => fightsAfterEnemySpike(s, from, to), [s, from, to]);
  if (!rows.length) return <p className="text-xs text-muted-foreground">{x.noEnemySpike}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.enemyCols.t}</th>
            <th className="py-1 font-normal">{x.enemyCols.spike}</th>
            <th className="py-1 text-right font-normal">{x.enemyCols.bkb}</th>
            <th className="py-1 pl-3 font-normal">{x.enemyCols.joined}</th>
            <th className="py-1 text-right font-normal">{x.enemyCols.result}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.i}
              className={cn("border-b align-top last:border-0", !r.joined && "text-muted-foreground")}
            >
              <td className="py-1 tabular-nums">
                {sec(r.start)}
                {r.died && <span className="ml-1 text-red-600 dark:text-red-400">✝</span>}
              </td>
              <td className="py-1">
                <span className="flex flex-col gap-0.5">
                  {r.spikes.map((p, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 tabular-nums"
                      title={`${names.heroes(p.hero)} · ${names.items(p.key)} · ${sec(p.t)}`}
                    >
                      <HeroIcon id={p.hero} size={16} />
                      <ItemIcon k={p.key} size={14} />
                      <span className="text-muted-foreground">{x.before(Math.round(p.before))}</span>
                    </span>
                  ))}
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">
                {r.bkb[0]} : {r.bkb[1]}
              </td>
              <td className="py-1 pl-3">{r.joined ? t.fights.yes : t.fights.no}</td>
              <td
                className={cn(
                  "py-1 text-right tabular-nums",
                  r.teamDeaths > r.enemyDeaths && "font-semibold text-red-600 dark:text-red-400",
                )}
              >
                {r.teamDeaths} / {r.enemyDeaths}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpikeBlock() {
  const { t } = useLab();
  const x = t.x.items;
  return (
    <>
      <Sub title={x.spikes} hint={x.spikesHint}>
        <PerSide>{(k, s) => <SpikeTimeline side={k} s={s} />}</PerSide>
      </Sub>
      <Sub title={x.after} hint={x.afterHint}>
        <PerSide>{(k, s) => <SpikeUseSide s={s} />}</PerSide>
      </Sub>
      <Sub title={x.enemySpike}>
        <PerSide>{(k, s) => <EnemySpikeSide s={s} />}</PerSide>
        <p className="text-xs text-muted-foreground">{x.coresNote}</p>
      </Sub>
    </>
  );
}

// ── Neutral items ────────────────────────────────────────────────────────────────────────────

// One row per neutral item held: the pro games that ended holding it among those that ended holding
// one of its tier, and the tier's most common; then the pros' most common overall.
function NeutralSide({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.items;
  const names = useNames();
  const d = useMemo(() => neutralMeta(s, assets), [s, assets]);
  if (!d) return <p className="text-xs text-muted-foreground">–</p>;
  const held = new Set(d.rows.map((r) => r.key));
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="text-muted-foreground">{x.neutralHint(d.of)}</p>
      {d.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{x.neutralCols.item}</th>
                <th className="py-1 font-normal">{x.neutralCols.t}</th>
                <th className="py-1 text-right font-normal">{x.neutralCols.pro}</th>
                <th className="py-1 pl-3 font-normal">{x.neutralCols.top}</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-1">
                    <span className="flex items-center gap-1.5">
                      <ItemIcon k={r.key} size={18} />
                      <span className="max-w-28 truncate">{names.items(r.key)}</span>
                      {r.tier != null && <span className="text-muted-foreground">{x.tierShort(r.tier)}</span>}
                      {r.final && <Tag tone="plain">{x.neutralFinal}</Tag>}
                    </span>
                  </td>
                  <td className="py-1 tabular-nums">{r.t != null ? sec(r.t) : "–"}</td>
                  <td
                    className="py-1 text-right tabular-nums"
                    title={r.tier != null && r.ofTier ? x.neutralTier(r.n, r.ofTier, r.tier) : undefined}
                  >
                    {x.neutralCount(r.n, r.tier != null && r.ofTier ? r.ofTier : d.of)}
                  </td>
                  <td className="py-1 pl-3">
                    {r.top ? (
                      <span className="flex items-center gap-1 tabular-nums" title={names.items(r.top.key)}>
                        <ItemIcon k={r.top.key} size={16} />
                        {x.neutralCount(r.top.n, r.ofTier ?? d.of)}
                      </span>
                    ) : r.ofTier && r.n ? (
                      <Tag tone="good">{x.neutralIsTop}</Tag>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">{x.neutralTop}</span>
        {d.top.map((r) => (
          <span
            key={r.key}
            className={cn(
              "flex items-center gap-1 rounded border px-1.5 py-0.5 tabular-nums",
              held.has(r.key) && "border-emerald-500/60 bg-emerald-500/10",
            )}
            title={[names.items(r.key), r.tier != null && x.tierShort(r.tier)].filter(Boolean).join(" · ")}
          >
            <ItemIcon k={r.key} size={16} />
            {x.neutralCount(r.n, d.of)}
          </span>
        ))}
      </div>
    </div>
  );
}

function NeutralBlock() {
  const { t, assets } = useLab();
  const x = t.x.items;
  const sides = useSides();
  // Only when the pros' counts can be named (their item ids map to the page's items).
  if (!sides.some(([, s]) => neutralMeta(s, assets))) return null;
  return (
    <Sub title={x.neutral}>
      <PerSide>{(k, s) => <NeutralSide s={s} />}</PerSide>
      <Caveat kind="source">{x.neutralNote}</Caveat>
    </Sub>
  );
}

// ── Other units' items ───────────────────────────────────────────────────────────────────────

function UnitsBlock() {
  const { t } = useLab();
  const sides = useSides();
  if (!sides.some(([, s]) => s.items.additionalUnits.length)) return null;
  return (
    <Sub title={t.x.items.units}>
      <PerSide>
        {(k, s) =>
          s.items.additionalUnits.length ? (
            <div className="flex flex-wrap gap-1">
              {s.items.additionalUnits.map((key, i) => (
                <ItemIcon key={i} k={key} size={24} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t.resources.none}</p>
          )
        }
      </PerSide>
    </Sub>
  );
}

function ItemsBlocks() {
  return (
    <>
      <ChoiceBlock />
      <StartBlock />
      <TpBlock />
      <CounterBlock />
      <SpikeBlock />
      <NeutralBlock />
      <UnitsBlock />
    </>
  );
}

// ── Readings ─────────────────────────────────────────────────────────────────────────────────

type Line = { text: string; w: number };

const treads = (s: LabSide) => bootsTable(s).mine.find((m) => m.key === "power_treads") ?? null;

// The contrasts worth a sentence, weighed by how much they say.
function lines(ctx: Ctx): Line[] {
  const { a, b, assets, t, names } = ctx;
  const x = t.x.items;
  const sides: [string, LabSide][] = b
    ? [
        [t.insight.a, a],
        [t.insight.b, b],
      ]
    : [["", a]];
  const out: Line[] = [];
  for (const [who, s] of sides) {
    const tp = tpCarry(s);
    if (tp) {
      const without = tp.deaths.filter((d) => d.has === false).length;
      if (without) out.push({ text: x.tpDeaths(who, without), w: Math.min(0.9, 0.25 + 0.15 * without) });
      else if (tp.total >= 120 && tp.longest)
        out.push({
          text: x.tpLine(who, sec(tp.total), sec(tp.longest.alive)),
          w: Math.min(0.5, tp.total / 600),
        });
    }
    const magic = threats(s).find((th) => th.kind === "magic");
    if (magic && !magic.counters.some((c) => c.t != null))
      out.push({
        text: x.magicNoAnswer(
          who,
          pct(magic.value),
          magic.counters
            .slice(0, 2)
            .map((c) => names.items(c.key))
            .join(x.join),
        ),
        w: 0.3 + (magic.value ?? 0) * 0.3,
      });
    const choice = itemChoices(s, assets);
    // Rare at the rank and among the pros: only where the pros' games were counted for it.
    const rare = choice.rows.filter(
      (r) =>
        (r.rankTag === "rare" || r.rankTag === "unlisted") &&
        (r.proTag === "offMeta" || r.proTag === "uncommon"),
    );
    if (rare.length)
      out.push({
        text: x.rareBuild(
          who,
          rare
            .slice(0, 3)
            .map((r) => names.items(r.key))
            .join(x.join),
        ),
        w: Math.min(0.45, 0.25 + 0.05 * rare.length),
      });
    const skipped = choice.skipped.find((m) => !m.late && m.rate != null);
    if (skipped)
      out.push({
        text: x.skippedStaple(who, names.items(skipped.key), pct(skipped.rate)),
        w: 0.2 + (skipped.rate ?? 0) * 0.3,
      });
    const idle = spikeUse(s, assets).find(
      (u) =>
        u.span >= SPIKE_WINDOW &&
        u.fights > 0 &&
        u.joined === 0 &&
        u.kills + u.assists === 0 &&
        !u.towerDamage,
    );
    if (idle) out.push({ text: x.spikeIdle(who, names.items(idle.key)), w: 0.2 });
    const lost = fightsAfterEnemySpike(s).find((f) => f.joined && f.teamDeaths > f.enemyDeaths);
    if (lost) {
      const p = lost.spikes[0];
      out.push({
        text: x.enemySpikeFight(
          who,
          names.heroes(p.hero),
          names.items(p.key),
          Math.round(p.before),
          lost.teamDeaths,
          lost.enemyDeaths,
        ),
        w: Math.min(0.5, 0.3 + 0.05 * (lost.teamDeaths - lost.enemyDeaths)),
      });
    }
  }
  // Power Treads switching, a marker of attention to mana and health: A against B on the same hero,
  // else each side against its rank.
  const ta = treads(a);
  const tb = b ? treads(b) : null;
  if (b && b.heroId === a.heroId && ta?.usesPm != null && tb?.usesPm != null) {
    const avg = ta.rank?.actPm ?? tb.rank?.actPm ?? null;
    const hi = Math.max(ta.usesPm, tb.usesPm);
    const lo = Math.min(ta.usesPm, tb.usesPm);
    if (lo > 0 && hi / lo >= 2)
      out.push({
        text: x.treadsPair(num(ta.usesPm, 1), num(tb.usesPm, 1), avg != null ? num(avg, 1) : "–"),
        w: 0.3,
      });
  } else
    for (const [who, tr] of [
      [b ? t.insight.a : "", ta],
      [t.insight.b, tb],
    ] as const) {
      const avg = tr?.rank?.actPm;
      if (tr?.usesPm == null || !avg) continue;
      const r = tr.usesPm / avg;
      if (r >= 2 || r <= 0.5) out.push({ text: x.treadsSingle(who, num(tr.usesPm, 1), num(avg, 1)), w: 0.2 });
    }
  return out;
}

// The share of the time alive after 10:00 (up to `until`) without a TP.
function tpShare(s: LabSide, until = Infinity) {
  const tp = tpCarry(s, -Infinity, until);
  return tp && tp.alive >= 60 ? tp.total / tp.alive : null;
}

const METRICS: Metric[] = [
  {
    key: "itemsTpLess",
    fmt: "pct",
    higher: false,
    get: (s) => tpShare(s),
    getUntil: (s, until) => tpShare(s, until),
    label: (t) => t.x.items.metricTpLess,
  },
  {
    key: "itemsTreads",
    fmt: "dec",
    higher: null,
    sameHero: true,
    get: (s) => treads(s)?.usesPm ?? null,
    label: (t) => t.x.items.metricTreads,
  },
];

export const itemsModule: LabModule = {
  blocks: { items: ItemsBlocks },
  insights: (ctx) => ({
    items: lines(ctx)
      .filter((l) => l.w >= 0.2)
      .sort((p, q) => q.w - p.w)
      .slice(0, 2)
      .map((l) => l.text),
  }),
  summary: (ctx) => lines(ctx).filter((l) => l.w >= 0.15),
  metrics: METRICS,
};

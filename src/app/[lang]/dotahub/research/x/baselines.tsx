"use client";

import { Fragment, type ReactNode, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import type { LabSide } from "@/lib/dota/lab";
import type { BaselineKey, LabBaseline } from "@/lib/dota/lab-extra";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { type Metric, num, pct } from "../insights";
import {
  Caveat,
  ItemIcon,
  LineCompare,
  PerSide,
  SIDE_COLOR,
  SideDot,
  type SideKey,
  Sub,
  useLab,
  useNames,
  useTimeWindow,
} from "../lab-parts";
import {
  avgAt,
  avgCurve,
  baselineId,
  baselineKind,
  benchmarkRows,
  compareMinute,
  coreItem,
  damageCurve,
  eventCurve,
  gamesAt,
  gamesAtStart,
  goldFedCurve,
  GROUPS,
  itemTimings,
  lastMinute,
  LONG_GAME_SHARE,
  ROW_BY,
  type RowFmt,
  type RowKey,
  type RowValue,
  TARGETS,
  tableAt,
  thinFrom,
  timedItems,
  weekOf,
} from "./baselines-calc";
import type { Ctx, LabModule } from "./types";
import { percentileOf } from "./util";

// Rank references: the hero's averages at the match's rank and position (STRATZ heroStats) set
// against this game — what they are and how far to trust them, a wide table at the end of the shared
// window, OpenDota's benchmark targets, more curves on the timeline, and the item timings with
// the win rate by purchase minute.

const GREY = "#9ca3af";
const who = (t: Ctx["t"], k: SideKey | number) => (k === "b" || k === 1 ? t.insight.b : t.insight.a);

function fmtRow(v: number, fmt: RowFmt, avg: boolean) {
  if (fmt === "pct") return pct(v);
  if (fmt === "sec") return num(v, 1);
  if (fmt === "count" && avg) return num(v, 1);
  return num(v);
}
const fmtRatio = (r: number | null) => (r == null || !Number.isFinite(r) ? "–" : `×${num(r, 2)}`);
const farFrom = (r: number | null) => r != null && (r >= 1.5 || r <= 1 / 1.5);

// The distinct rank averages on the page, with the sides that use each.
function useBaselineGroups() {
  const { a, b } = useLab();
  return useMemo(() => {
    const out: { id: string; bl: LabBaseline; sides: [SideKey, LabSide][] }[] = [];
    for (const [k, s] of (b
      ? [
          ["a", a],
          ["b", b],
        ]
      : [["a", a]]) as [SideKey, LabSide][]) {
      const id = baselineId(s);
      const bl = s.advanced.baseline;
      if (!id || !bl) continue;
      const g = out.find((x) => x.id === id);
      if (g) g.sides.push([k, s]);
      else out.push({ id, bl, sides: [[k, s]] });
    }
    return out;
  }, [a, b]);
}

// ── What the references are ──────────────────────────────────────────────────────────────────

const patchOf = (s: LabSide) => s.patch ?? s.match.patch;

function RefsTable() {
  const { t, a, b } = useLab();
  const x = t.x.baselines;
  const d = t.deep;
  const sides = (
    b
      ? [
          ["a", a],
          ["b", b],
        ]
      : [["a", a]]
  ) as [SideKey, LabSide][];
  const groups = useBaselineGroups();
  const pa = patchOf(a);
  const pb = b ? patchOf(b) : null;
  const rows: { key: string; label: string; get: (s: LabSide, bl: LabBaseline | null) => ReactNode }[] = [
    {
      key: "bracket",
      label: x.bracket,
      get: (s, bl) =>
        bl ? (
          <>
            {d.brackets[bl.bracket] ?? bl.bracket}
            {bl.position ? d.position(bl.position) : ` · ${x.anyPosition}`}
            <span className="block text-muted-foreground">{x.posFrom[s.positionFrom ?? "none"]}</span>
          </>
        ) : (
          "–"
        ),
    },
    {
      key: "period",
      label: x.period,
      get: (s, bl) => {
        if (!bl) return "–";
        if (!s.refs.baselineWeek || bl.week == null) return x.recent;
        const w = weekOf(bl.week);
        return x.week(w.from, w.to);
      },
    },
    {
      key: "sample",
      label: x.sample,
      get: (s, bl) => (bl ? x.winRate(bl.winRate != null ? pct(bl.winRate, 1) : "–", num(bl.matches)) : "–"),
    },
    { key: "patch", label: x.patch, get: (s) => patchOf(s)?.name ?? x.unknownPatch },
  ];
  return (
    <Sub title={x.refsTitle} hint={x.refsHint}>
      <table className="w-full text-xs">
        {sides.length > 1 && (
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal" />
              {sides.map(([k]) => (
                <th key={k} className="py-1 font-normal">
                  <SideDot side={k} className="mr-1" />
                  {who(t, k)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b align-top last:border-0">
              <td className="w-20 py-1 pr-2 text-muted-foreground">{r.label}</td>
              {sides.map(([k, s]) => (
                <td key={k} className="py-1 pr-2">
                  {r.get(s, s.advanced.baseline)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sides.some(([, s]) => !s.advanced.baseline) && (
        <p className="text-xs text-muted-foreground">{x.noBaseline}</p>
      )}
      {pa && pb && pa.id !== pb.id && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{x.patchDiff(pa.name, pb.name)}</p>
      )}
      {groups.length > 1 && (
        <p className="text-xs text-muted-foreground">
          {groups.every((g) => baselineKind(g.sides[0][1]) === baselineKind(groups[0].sides[0][1]))
            ? x.ownWeeks
            : x.ownBaselines}
        </p>
      )}
    </Sub>
  );
}

// How many reference games are still going at each minute: late averages come from long games only.
function GamesLeft() {
  const { t } = useLab();
  const x = t.x.baselines;
  const groups = useBaselineGroups();
  const option = useMemo<EChartsOption>(() => {
    const two = groups.length > 1;
    return {
      animation: false,
      grid: { left: 52, right: 16, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => (typeof v === "number" ? num(v) : String(v)),
        axisPointer: { type: "line", label: { formatter: (p) => `${Math.round(Number(p.value))}:00` } },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: Math.max(1, ...groups.map((g) => lastMinute(g.bl))),
        name: t.timeline.minute,
        nameLocation: "end",
        nameGap: 4,
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: { fontSize: 10, formatter: (v: number) => num(v) },
        splitLine: { lineStyle: { opacity: 0.3 } },
      },
      series: groups.map((g) => {
        const color = two ? SIDE_COLOR[g.sides[0][0]] : GREY;
        const thin = thinFrom(g.bl);
        return {
          name: two ? who(t, g.sides[0][0]) : x.games,
          type: "line" as const,
          showSymbol: false,
          data: Array.from({ length: lastMinute(g.bl) + 1 }, (_, m) => [m, gamesAt(g.bl, m)]),
          lineStyle: { width: 1.5, color },
          itemStyle: { color },
          areaStyle: { color, opacity: 0.08 },
          markLine: {
            symbol: "none",
            silent: true,
            data: [
              ...(thin != null
                ? [
                    {
                      xAxis: thin,
                      lineStyle: { color: "#f59e0b", type: "dashed" as const },
                      label: { formatter: `${Math.round(LONG_GAME_SHARE * 100)}%`, fontSize: 10 },
                    },
                  ]
                : []),
              ...g.sides.map(([k, s]) => ({
                xAxis: Math.min(Math.floor(s.duration / 60), lastMinute(g.bl)),
                lineStyle: { color: SIDE_COLOR[k], type: "solid" as const },
                label: { formatter: who(t, k), fontSize: 10 },
              })),
            ],
          },
        };
      }),
    };
  }, [groups, t, x]);
  if (!groups.length) return null;
  return (
    <Sub title={x.countsTitle}>
      <div className="h-44 min-w-0">
        <EChart option={option} />
      </div>
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {groups.map((g) => {
          const m = thinFrom(g.bl);
          return m == null ? null : (
            <li key={g.id} className="flex items-center gap-1.5">
              {groups.length > 1 && <SideDot side={g.sides[0][0]} />}
              {x.countsUnder(m, num(gamesAt(g.bl, m)))}
            </li>
          );
        })}
        {groups.flatMap((g) =>
          g.sides.map(([k, s]) => {
            const m = Math.min(Math.floor(s.duration / 60), lastMinute(g.bl));
            const n = gamesAt(g.bl, m);
            return (
              <li key={k}>{x.countsAt(who(t, k), clock(m * 60), num(n), pct(n / gamesAtStart(g.bl)))}</li>
            );
          }),
        )}
      </ul>
      <p className="text-xs text-muted-foreground">{x.countsCaveat}</p>
    </Sub>
  );
}

// ── This game against the average, at the end of the shared window ───────────────────────────

function SideTable({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.baselines;
  const [, to] = useTimeWindow(s);
  const m = compareMinute(s, to);
  const rows = useMemo(() => (m == null ? [] : tableAt(s, m)), [s, m]);
  const bl = s.advanced.baseline;
  if (!bl) return <p className="text-xs text-muted-foreground">{x.noBaseline}</p>;
  if (m == null || !rows.length) return <p className="text-xs text-muted-foreground">{x.noTable}</p>;
  const n = gamesAt(bl, m);
  const share = n / gamesAtStart(bl);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{x.tableAt(clock(m * 60), num(n), pct(share))}</p>
      {share < LONG_GAME_SHARE && <p className="text-xs text-amber-700 dark:text-amber-300">{x.lateWarn}</p>}
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.stat}</th>
            <th className="py-1 text-right font-normal">{x.mine}</th>
            <th className="py-1 text-right font-normal">{x.avg}</th>
            <th className="py-1 text-right font-normal">{x.ratio}</th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => {
            const list = rows.filter((r) => r.row.group === g);
            if (!list.length) return null;
            return (
              <Fragment key={g}>
                <tr>
                  <td colSpan={4} className="pt-2 pb-0.5 text-[11px] font-medium text-muted-foreground">
                    {x.groups[g]}
                  </td>
                </tr>
                {list.map((r) => (
                  <tr key={r.row.key} className="border-b">
                    <td className="py-0.5 pr-2">
                      {x.rows[r.row.key]}
                      {r.row.estimate && <span className="ml-1 text-muted-foreground">≈</span>}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">
                      {fmtRow(r.mine.v, r.row.fmt, false)}
                      {r.mine.whole && <span className="text-muted-foreground">{x.wholeMark}</span>}
                    </td>
                    <td className="py-0.5 text-right text-muted-foreground tabular-nums">
                      {fmtRow(r.avg, r.row.fmt, true)}
                    </td>
                    <td className={cn("py-0.5 text-right tabular-nums", farFrom(r.ratio) && "font-semibold")}>
                      {fmtRatio(r.ratio)}
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.some((r) => r.mine.whole) && <p className="text-xs text-muted-foreground">{x.wholeNote}</p>}
      {rows.some((r) => r.row.estimate) && <Caveat kind="estimate">{x.campsNote}</Caveat>}
    </div>
  );
}

// ── OpenDota's benchmarks: the values for the next steps ─────────────────────────────────────

const benchDigits = (v: number) => (Math.abs(v) < 1 ? 2 : Math.abs(v) < 100 ? 1 : 0);

function BenchTable({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.baselines;
  const rows = useMemo(() => benchmarkRows(s), [s]);
  if (!rows.length) return <p className="text-xs text-muted-foreground">{x.noBench}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal" />
            <th className="py-1 text-right font-normal">{x.value}</th>
            <th className="py-1 text-right font-normal">{x.better}</th>
            {TARGETS.map((q) => (
              <th key={q} className="py-1 text-right font-normal">
                {pct(q)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-0.5 pr-2 text-muted-foreground">{x.bench[r.key] ?? r.key}</td>
              <td className="py-0.5 text-right font-medium tabular-nums">
                {num(r.value, benchDigits(r.value!))}
              </td>
              <td className="py-0.5 text-right tabular-nums">{r.better != null ? pct(r.better) : "–"}</td>
              {r.targets.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "py-0.5 text-right tabular-nums",
                    r.better != null && r.better >= TARGETS[i]
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {v == null ? "–" : num(v, benchDigits(v))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefsBlock() {
  const { t } = useLab();
  const x = t.x.baselines;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <RefsTable />
        <GamesLeft />
      </div>
      <Sub title={x.tableTitle} hint={x.tableHint}>
        <PerSide>{(k, s) => <SideTable s={s} />}</PerSide>
      </Sub>
      <Sub title={x.benchTitle} hint={x.benchHint}>
        <PerSide>{(k, s) => <BenchTable s={s} />}</PerSide>
        <p className="text-xs text-muted-foreground">{x.benchNote}</p>
      </Sub>
    </>
  );
}

// ── More curves against the average ──────────────────────────────────────────────────────────

const avgOf = (key: BaselineKey) => (s: LabSide) => avgCurve(s.advanced.baseline, key);
const kills = (s: LabSide) => eventCurve(s, "kill");
const deaths = (s: LabSide) => eventCurve(s, "death");
const assists = (s: LabSide) => eventCurve(s, "assist");
const attack = (s: LabSide) => damageCurve(s, true);
const cast = (s: LabSide) => damageCurve(s, false);
const avgKills = avgOf("kills");
const avgDeaths = avgOf("deaths");
const avgAssists = avgOf("assists");
const avgFed = avgOf("goldFed");
const avgAttack = avgOf("attackDamage");
const avgCast = avgOf("castDamage");

type CurveKey = keyof Ctx["t"]["x"]["baselines"]["curves"];
const CURVES: {
  key: CurveKey;
  series: (s: LabSide) => number[] | null;
  baseline: (s: LabSide) => (number | null)[] | null;
  step?: boolean;
  count?: boolean;
}[] = [
  { key: "kills", series: kills, baseline: avgKills, step: true, count: true },
  { key: "deaths", series: deaths, baseline: avgDeaths, step: true, count: true },
  { key: "assists", series: assists, baseline: avgAssists, step: true, count: true },
  { key: "goldFed", series: goldFedCurve, baseline: avgFed, step: true },
  { key: "attackDamage", series: attack, baseline: avgAttack },
  { key: "castDamage", series: cast, baseline: avgCast },
];

// Each curve is drawn when a side has its own line (the average alone says nothing here).
function CurvesBlock() {
  const { t, a, b } = useLab();
  const x = t.x.baselines;
  const shown = useMemo(() => CURVES.filter((c) => [a, b].some((s) => s && c.series(s)?.length)), [a, b]);
  if ((!a.advanced.baseline && !b?.advanced.baseline) || !shown.length) return null;
  return (
    <Sub title={x.curvesTitle} hint={x.curvesHint}>
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        {shown.map((c) => (
          <LineCompare
            key={c.key}
            title={x.curves[c.key]}
            series={c.series}
            baseline={c.baseline}
            step={c.step}
            integer={c.count}
            height={180}
          />
        ))}
      </div>
    </Sub>
  );
}

// ── Item timings ─────────────────────────────────────────────────────────────────────────────

type Bucket = NonNullable<ReturnType<typeof itemTimings>[number]["atMine"]>;

function ItemTimingTable({ s }: { s: LabSide }) {
  const { t, assets } = useLab();
  const x = t.x.baselines;
  const names = useNames();
  const rows = useMemo(() => itemTimings(s, assets), [s, assets]);
  if (!rows.length) return <p className="text-xs text-muted-foreground">{x.noItems}</p>;
  const winRate = (c: Bucket | null) =>
    c ? (
      <span title={`${x.minuteOf(c.m)} · ${num(c.n)}`}>
        {pct(c.rate)}
        <span className="ml-1 text-[10px] text-muted-foreground">
          {c.edge < 0 ? x.edgeBefore(c.m) : c.edge > 0 ? x.edgeAfter(c.m) : `${c.m}′`}
        </span>
      </span>
    ) : (
      "–"
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 font-normal">{x.item}</th>
            <th className="py-1 font-normal">{x.time}</th>
            <th className="py-1 font-normal">{x.avgTime}</th>
            <th className="py-1 font-normal">{x.wrMine}</th>
            <th className="py-1 font-normal">{x.wrAvg}</th>
            <th className="py-1 font-normal">{x.personal}</th>
            <th className="py-1 font-normal">{x.pro}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b align-top last:border-0">
              <td className="py-1">
                <span title={names.items(r.key)}>
                  <ItemIcon k={r.key} size={18} />
                </span>
              </td>
              <td className="py-1 tabular-nums">{clock(r.t)}</td>
              <td className="py-1 tabular-nums">
                {r.avg != null ? (
                  <>
                    {clock(r.avg)}
                    <span
                      className={cn(
                        "ml-1",
                        Math.round(r.t - r.avg) === 0
                          ? "text-muted-foreground"
                          : r.t < r.avg
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {Math.round(r.t - r.avg) === 0 ? "±" : r.t < r.avg ? "−" : "+"}
                      {clock(Math.abs(r.t - r.avg))}
                    </span>
                    {r.rate != null && (
                      <span className="block text-[10px] text-muted-foreground">
                        {x.boughtBy(pct(r.rate))}
                      </span>
                    )}
                  </>
                ) : (
                  "–"
                )}
              </td>
              <td className="py-1 tabular-nums">{winRate(r.atMine)}</td>
              <td className="py-1 tabular-nums">{winRate(r.atAvg)}</td>
              <td className="py-1 tabular-nums">
                {r.personal?.median != null ? (
                  <>
                    {clock(Math.round(r.personal.median))}
                    <span className="ml-1 text-[10px] text-muted-foreground">n={r.personal.n}</span>
                  </>
                ) : (
                  "–"
                )}
              </td>
              <td className="py-1 tabular-nums">
                {r.pro?.median != null ? (
                  <>
                    {clock(Math.round(r.pro.median))}
                    <span className="ml-1 text-[10px] text-muted-foreground">n={r.pro.n}</span>
                    {r.pro.fasterThan != null && (
                      <span className="block text-[10px] text-muted-foreground">
                        {x.fasterThan(pct(r.pro.fasterThan))}
                      </span>
                    )}
                  </>
                ) : (
                  "–"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Points fade below this many games.
const FULL_N = 1500;

// The win rate by the minute an item was finished, at each side's rank and position, with the
// sides' timings and the average marked.
function ItemCurve() {
  const { t, assets, a, b } = useLab();
  const x = t.x.baselines;
  const names = useNames();
  const sides = useMemo(
    () =>
      (b
        ? [
            ["a", a],
            ["b", b],
          ]
        : [["a", a]]) as [SideKey, LabSide][],
    [a, b],
  );
  const options = useMemo(() => {
    const seen = new Map<string, number>();
    for (const [, s] of sides)
      for (const [k, at] of timedItems(s, assets))
        if ((s.advanced.baseline?.items[k]?.curve.length ?? 0) >= 3)
          seen.set(k, Math.min(seen.get(k) ?? at, at));
    return [...seen.entries()].sort((p, q) => p[1] - q[1]).map(([k]) => k);
  }, [sides, assets]);
  const [chosen, setChosen] = useState<string | null>(null);
  const core = coreItem(a)?.key;
  const key =
    chosen && options.includes(chosen) ? chosen : core && options.includes(core) ? core : options[0];
  const option = useMemo<EChartsOption | null>(() => {
    if (!key) return null;
    const groups: { id: string; sides: [SideKey, LabSide][]; bl: LabBaseline }[] = [];
    for (const [k, s] of sides) {
      const id = baselineId(s);
      const bl = s.advanced.baseline;
      if (!id || !bl?.items[key]) continue;
      const g = groups.find((y) => y.id === id);
      if (g) g.sides.push([k, s]);
      else groups.push({ id, sides: [[k, s]], bl });
    }
    const xs: number[] = [];
    // A second average within a minute of the first draws its line without a label.
    const firstAvg = groups[0]?.bl.items[key].time ?? 0;
    const series = groups.map((g, gi) => {
      const it = g.bl.items[key];
      const color = groups.length > 1 ? SIDE_COLOR[g.sides[0][0]] : GREY;
      it.curve.forEach((c) => xs.push(c.m, c.m + 1));
      xs.push(it.time / 60);
      const marks = g.sides.flatMap(([k, s]) => {
        const at = timedItems(s, assets).get(key);
        if (at == null) return [];
        xs.push(at / 60);
        return [
          {
            xAxis: at / 60,
            lineStyle: { color: SIDE_COLOR[k], type: "solid" as const, width: 1.5 },
            label: { formatter: `${who(t, k)} ${clock(at)}`, fontSize: 10, color: SIDE_COLOR[k] },
          },
        ];
      });
      return {
        name: groups.length > 1 ? who(t, g.sides[0][0]) : x.winRate2,
        type: "line" as const,
        showSymbol: true,
        symbolSize: 7,
        lineStyle: { width: 1.5, color, opacity: 0.5 },
        itemStyle: { color },
        data: it.curve.map((c) => ({
          value: [c.m + 0.5, c.w / c.n],
          name: `${x.minuteOf(c.m)} · ${pct(c.w / c.n, 1)} · ${num(c.n)}`,
          itemStyle: { opacity: 0.25 + 0.75 * Math.min(1, c.n / FULL_N) },
        })),
        markLine: {
          symbol: "none",
          silent: true,
          data: [
            ...marks,
            {
              xAxis: it.time / 60,
              lineStyle: { color, type: "dashed" as const, width: 1 },
              label: {
                show: gi === 0 || Math.abs(it.time - firstAvg) >= 60,
                formatter: `${x.avgMark} ${clock(it.time)}`,
                fontSize: 10,
                position: "insideEndBottom" as const,
              },
            },
          ],
        },
      };
    });
    if (!series.length) return null;
    return {
      animation: false,
      grid: { left: 40, right: 16, top: 20, bottom: 28 },
      tooltip: { trigger: "item", formatter: (p) => (p as { name?: string }).name ?? "" },
      xAxis: {
        type: "value",
        min: Math.floor(Math.min(...xs)),
        max: Math.ceil(Math.max(...xs)),
        name: t.timeline.minute,
        nameLocation: "end",
        nameGap: 4,
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 1,
        interval: 0.25,
        axisLabel: { fontSize: 10, formatter: (v: number) => pct(v) },
        splitLine: { lineStyle: { opacity: 0.3 } },
      },
      series,
    };
  }, [key, sides, assets, t, x]);
  if (!key || !option) return null;
  return (
    <Sub title={x.curveTitle} hint={x.curveHint}>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        {x.item}
        <select
          value={key}
          onChange={(e) => setChosen(e.target.value)}
          className="rounded-md border bg-background px-1.5 py-0.5 text-foreground"
        >
          {options.map((k) => (
            <option key={k} value={k}>
              {names.items(k)}
            </option>
          ))}
        </select>
      </label>
      <div className="h-52 min-w-0">
        <EChart option={option} />
      </div>
    </Sub>
  );
}

function ItemTimingBlock() {
  const { t, a, b } = useLab();
  const x = t.x.baselines;
  if (!a.advanced.baseline && !b?.advanced.baseline && !a.refs.pro && !b?.refs.pro) return null;
  return (
    <>
      <Sub title={x.itemsTitle} hint={x.itemsHint}>
        <PerSide>{(k, s) => <ItemTimingTable s={s} />}</PerSide>
      </Sub>
      <ItemCurve />
      <Caveat kind="source">{x.itemsCaveat}</Caveat>
    </>
  );
}

// ── Sentences, summary lines and the difference-table row ────────────────────────────────────

// The stats worth a sentence, furthest from the average first, with the average they need (so 1
// kill against 0.4 isn't 'two and a half times', nor a support's 164 building damage against 629).
const SENTENCE_MIN = new Map<RowKey, number>([
  ["networth", 0],
  ["cs", 30],
  ["kills", 2],
  ["deaths", 2],
  ["assists", 2],
  ["kp", 0.1],
  ["heroDamage", 1000],
  ["towerDamage", 1500],
  ["damageReceived", 1000],
  ["healingAllies", 1000],
  ["stunDuration", 5],
]);
const gapOf = (r: number) => Math.abs(Math.log(Math.max(0.05, r)));

function apartRows(s: LabSide, until = s.duration) {
  const m = compareMinute(s, until);
  const bl = s.advanced.baseline;
  if (m == null || !bl) return { m: null, share: 1, rows: [] as (RowValue & { gap: number })[] };
  const rows = tableAt(s, m)
    .filter((r) => r.ratio != null && r.avg >= (SENTENCE_MIN.get(r.row.key) ?? Infinity))
    .map((r) => ({ ...r, gap: gapOf(r.ratio!) }))
    .sort((p, q) => q.gap - p.gap);
  return { m, share: gamesAt(bl, m) / gamesAtStart(bl), rows };
}

const labelOf = (x: Ctx["t"]["x"]["baselines"], key: RowKey) => x.alone[key] ?? x.rows[key];
const versus = (x: Ctx["t"]["x"]["baselines"], r: RowValue) =>
  x.versus(labelOf(x, r.row.key), fmtRow(r.mine.v, r.row.fmt, false), fmtRow(r.avg, r.row.fmt, true));

// The core item's win rates, worth reading when the timing isn't outside the kept minutes, both
// minutes have enough games, and the rates differ by 3 points or more.
const ENOUGH = 300;
const WR_GAP = 0.03;
function itemReading(s: LabSide) {
  const c = coreItem(s);
  if (!c?.atMine || !c.atAvg || c.atMine.edge || c.atMine.n < ENOUGH || c.atAvg.n < ENOUGH) return null;
  return { key: c.key, t: c.t, avg: c.avg, atMine: c.atMine, atAvg: c.atAvg };
}

function itemSentence(ctx: Ctx, s: LabSide, i: number) {
  const x = ctx.t.x.baselines;
  const c = itemReading(s);
  if (!c || c.atMine.m === c.atAvg.m || Math.abs(c.atMine.rate - c.atAvg.rate) < WR_GAP) return null;
  const diff = c.t <= c.avg ? x.earlier(clock(c.avg - c.t)) : x.later(clock(c.t - c.avg));
  return {
    text: x.itemLine(
      who(ctx.t, i),
      ctx.names.items(c.key),
      clock(c.t),
      diff,
      pct(c.atMine.rate),
      pct(c.atAvg.rate),
    ),
    gap: Math.abs(c.atMine.rate - c.atAvg.rate),
  };
}

// A clear gap in a count: 1.5 or 40% of the average, whichever is more.
const clearGap = (v: number | null, avg: number | null) =>
  v != null && avg != null && Math.abs(v - avg) >= Math.max(1.5, 0.4 * avg);

// Every section's sentences at once, kept per context (the page asks once per section).
const cache = new WeakMap<Ctx, Partial<Record<"refs" | "timeline" | "items", string[]>>>();

function insights(ctx: Ctx) {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const { a, b, t, names } = ctx;
  const x = t.x.baselines;
  const sides = b ? [a, b] : [a];
  const refs: string[] = [];
  const pa = patchOf(a);
  const pb = b ? patchOf(b) : null;
  if (pa && pb && pa.id !== pb.id) refs.push(x.patchDiff(pa.name, pb.name));
  sides.forEach((s, i) => {
    const { m, share, rows } = apartRows(s);
    const top = rows.filter((r) => r.gap >= Math.log(1.3)).slice(0, 2);
    if (m != null && top.length)
      refs.push(
        x.apart(
          who(t, i),
          clock(m * 60),
          top.map((r) => versus(x, r)).join(t.insight.sep),
          share < LONG_GAME_SHARE ? pct(share) : null,
        ),
      );
  });
  // Kills, deaths and assists by 20:00 (or the game's last minute), a standard benchmark: the sides
  // with a clear gap in one of them.
  const kda: { m: number; text: (at: string | null) => string }[] = [];
  sides.forEach((s, i) => {
    const bl = s.advanced.baseline;
    const last = compareMinute(s, s.duration);
    if (!bl || last == null) return;
    const m = Math.min(20, last);
    if (m < 5) return;
    const end = m >= Math.floor(s.duration / 60);
    const keys = ["kills", "deaths", "assists"] as const;
    const mine = keys.map((k) => ROW_BY[k].mine(s, m, end)?.v ?? null);
    const avg = keys.map((k) => avgAt(bl, k, m));
    if (!mine.some((v, j) => clearGap(v, avg[j]))) return;
    const own = mine.map((v) => (v == null ? "–" : num(v))).join(" / ");
    const ref = avg.map((v) => (v == null ? "–" : num(v, 1))).join(" / ");
    kda.push({ m, text: (at) => x.kdaPart(who(t, i), at, own, ref) });
  });
  const same = kda.every((p) => p.m === kda[0].m);
  const timeline = kda.length
    ? [
        x.kda(
          same ? clock(kda[0].m * 60) : null,
          kda.map((p) => p.text(same ? null : clock(p.m * 60))).join(x.partSep),
        ),
      ]
    : [];
  // The core item's win rate at each side's minute: one sentence when both bought the same one
  // against the same kind of average, else one per side.
  const ra = itemReading(a);
  const rb = b ? itemReading(b) : null;
  const pair =
    b &&
    ra &&
    rb &&
    ra.key === rb.key &&
    baselineKind(a) === baselineKind(b) &&
    Math.abs(ra.atMine.rate - rb.atMine.rate) >= WR_GAP;
  const items =
    pair && ra && rb
      ? [
          x.itemPairLine(
            names.items(ra.key),
            clock(ra.t),
            pct(ra.atMine.rate),
            clock(rb.t),
            pct(rb.atMine.rate),
            clock(ra.avg),
            pct(ra.atAvg.rate),
          ),
        ]
      : sides.map((s, i) => itemSentence(ctx, s, i)?.text).filter((v): v is string => !!v);
  const out = { refs, timeline, items };
  cache.set(ctx, out);
  return out;
}

function summary(ctx: Ctx) {
  const { a, b, t, names } = ctx;
  const x = t.x.baselines;
  const out: { text: string; w: number }[] = [];
  if (!b) {
    const it = itemSentence(ctx, a, 0);
    if (it) out.push({ text: it.text, w: Math.min(0.8, 0.25 + it.gap * 2) });
    const { m, share, rows } = apartRows(a);
    if (m != null && rows[0] && rows[0].gap >= Math.log(1.5))
      out.push({
        text: x.apart(
          t.insight.a,
          clock(m * 60),
          versus(x, rows[0]),
          share < LONG_GAME_SHARE ? pct(share) : null,
        ),
        w: Math.min(0.8, 0.2 + rows[0].gap * 0.4),
      });
    return out;
  }
  // The same core item against each side's own rank average.
  const ca = coreItem(a);
  const cb = coreItem(b);
  if (ca && cb && ca.key === cb.key) {
    const da = ca.t - ca.avg;
    const db = cb.t - cb.avg;
    const fmt = (d: number) => (d <= 0 ? x.early(clock(-d)) : x.late(clock(d)));
    out.push({
      text: x.itemPair(names.items(ca.key), fmt(da), fmt(db)),
      w: Math.min(0.9, Math.abs(da - db) / 300),
    });
  }
  // The stat whose ratio to its own average differs most between the two, both up to the minute the
  // shorter game reached.
  const until = Math.min(a.duration, b.duration);
  const pa = apartRows(a, until);
  const rb = apartRows(b, until).rows;
  let best: { key: RowKey; a: number; b: number; gap: number } | null = null;
  for (const r of pa.rows) {
    const o = rb.find((q) => q.row.key === r.row.key);
    if (!o || r.ratio == null || o.ratio == null) continue;
    const gap = Math.abs(Math.log(Math.max(0.05, r.ratio)) - Math.log(Math.max(0.05, o.ratio)));
    if (!best || gap > best.gap) best = { key: r.row.key, a: r.ratio, b: o.ratio, gap };
  }
  const times = (r: number) => (r === 0 ? "0" : num(r, 2));
  if (best && pa.m != null && best.gap >= Math.log(1.5))
    out.push({
      text: x.ratioPair(labelOf(x, best.key), clock(pa.m * 60), times(best.a), times(best.b)),
      w: Math.min(0.7, best.gap * 0.5),
    });
  return out;
}

// The core item's timing against the rank average (seconds; ranked by where the timing falls among
// pros on the patch when both sides have them).
const metrics: Metric[] = [
  {
    key: "coreItemVsAvg",
    fmt: "signed",
    higher: false,
    get: (s) => {
      const c = coreItem(s);
      return c ? c.t - c.avg : null;
    },
    pct: (s, v) => {
      const c = coreItem(s);
      const d = c ? s.refs.pro?.items[c.key] : null;
      return c && d ? percentileOf(d, c.avg + v) : null;
    },
    // The player's own spread on that item's timing (5 games or more).
    spread: (s) => {
      const c = coreItem(s);
      const d = c ? s.refs.personal?.parsed.items[c.key] : null;
      return d && d.n >= 5 ? d.sd : null;
    },
    label: (t) => t.x.baselines.metricKeyItem,
  },
];

export const baselinesModule: LabModule = {
  blocks: { refs: RefsBlock, timeline: CurvesBlock, items: ItemTimingBlock },
  insights,
  summary,
  metrics,
};

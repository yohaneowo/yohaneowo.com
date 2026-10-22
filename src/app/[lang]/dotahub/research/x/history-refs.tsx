"use client";

import { type ReactNode, useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { useLocale } from "@/i18n/locale-provider";
import type { LabSide } from "@/lib/dota/lab";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { medalName } from "../../parts";
import { num, pct } from "../insights";
import {
  Caveat,
  HeroIcon,
  PerSide,
  SIDE_COLOR,
  SideDot,
  type SideKey,
  Sub,
  useLab,
  useNames,
  useSides,
} from "../lab-parts";
import {
  PERSONAL_LH_MINUTE,
  personalRows,
  proRows,
  type RefRow,
  rowStats,
  type RowStats,
  tone,
  vsOthers,
} from "./history-calc";
import { fmtValue } from "./history-text";

// The references section: this game against the player's own games on the hero and against pro
// games on the patch, the player's record against the enemy heroes, the hero's win rate by game
// length, and how the hero does in public and pro games.

const TONE = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-red-600 dark:text-red-400",
} as const;

function useRowLabel() {
  const { t } = useLab();
  const h = t.x.history;
  return (r: RefRow) => (r.key === "lhEarly" ? h.lhAt(PERSONAL_LH_MINUTE) : (h.rows[r.key] ?? r.key));
}

// The row's name with its tags: a whole-game total, a STRATZ-only sample, a sample unlike the rest.
function RowName({ r, n }: { r: RefRow; n: number }) {
  const { t } = useLab();
  const h = t.x.history;
  const label = useRowLabel();
  return (
    <span className="flex flex-wrap items-baseline gap-1">
      {label(r)}
      {r.total && <span className="text-[10px] text-muted-foreground">{h.totalTag}</span>}
      {r.parsed && <span className="text-[10px] text-muted-foreground">{h.parsedTag}</span>}
      {r.d.n !== n && <span className="text-[10px] text-muted-foreground">{h.n(r.d.n)}</span>}
    </span>
  );
}

function PctCell({ r, st }: { r: RefRow; st: RowStats }) {
  const tn = tone(r, st);
  return (
    <td className={cn("py-1 text-right tabular-nums", tn && TONE[tn])}>
      {st.pct == null ? "–" : Math.round(st.pct * 100)}
    </td>
  );
}

const Head = ({ children, left }: { children?: ReactNode; left?: boolean }) => (
  <th className={cn("py-1 font-normal", !left && "text-right")}>{children}</th>
);

// One side against its references: value, percentile, median, spread (and pro wins / losses).
function RefTable({ rows, n, pro }: { rows: RefRow[]; n: number; pro: boolean }) {
  const { t } = useLab();
  const h = t.x.history;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <Head left>{h.metric}</Head>
            <Head>{h.thisGame}</Head>
            <Head>{h.pctile}</Head>
            <Head>{pro ? h.proMedian : h.median}</Head>
            <Head>{h.range}</Head>
            {pro && <Head>{h.winLoss}</Head>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = rowStats(r);
            return (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-1 pr-2">
                  <RowName r={r} n={n} />
                </td>
                <td className="py-1 text-right font-medium tabular-nums">{fmtValue(r.value, r.fmt)}</td>
                <PctCell r={r} st={st} />
                <td className="py-1 text-right tabular-nums">{fmtValue(st.median, r.fmt)}</td>
                <td className="py-1 text-right text-muted-foreground tabular-nums">
                  {fmtValue(st.p10, r.fmt)}–{fmtValue(st.p90, r.fmt)}
                </td>
                {pro && (
                  <td className="py-1 text-right text-muted-foreground tabular-nums">
                    {fmtValue(r.win, r.fmt)} / {fmtValue(r.loss, r.fmt)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Both sides against one shared reference (same hero, same patch): their values side by side.
function SharedTable({ a, b, n }: { a: RefRow[]; b: RefRow[]; n: number }) {
  const { t } = useLab();
  const h = t.x.history;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <Head left>{h.metric}</Head>
            <Head>
              <SideDot side="a" className="mr-1" />
              {t.insight.a}
            </Head>
            <Head>{h.pctile}</Head>
            <Head>
              <SideDot side="b" className="mr-1" />
              {t.insight.b}
            </Head>
            <Head>{h.pctile}</Head>
            <Head>{h.proMedian}</Head>
            <Head>{h.range}</Head>
            <Head>{h.winLoss}</Head>
          </tr>
        </thead>
        <tbody>
          {a.map((ra) => {
            const rb = b.find((x) => x.key === ra.key);
            const sa = rowStats(ra);
            const sb = rb ? rowStats(rb) : null;
            return (
              <tr key={ra.key} className="border-b last:border-0">
                <td className="py-1 pr-2">
                  <RowName r={ra} n={n} />
                </td>
                <td className="py-1 text-right font-medium tabular-nums">{fmtValue(ra.value, ra.fmt)}</td>
                <PctCell r={ra} st={sa} />
                <td className="py-1 text-right font-medium tabular-nums">
                  {rb ? fmtValue(rb.value, rb.fmt) : "–"}
                </td>
                {rb && sb ? <PctCell r={rb} st={sb} /> : <td className="py-1 text-right">–</td>}
                <td className="py-1 text-right tabular-nums">{fmtValue(sa.median, ra.fmt)}</td>
                <td className="py-1 text-right text-muted-foreground tabular-nums">
                  {fmtValue(sa.p10, ra.fmt)}–{fmtValue(sa.p90, ra.fmt)}
                </td>
                <td className="py-1 text-right text-muted-foreground tabular-nums">
                  {fmtValue(ra.win, ra.fmt)} / {fmtValue(ra.loss, ra.fmt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Where this game's length falls among the reference's games, for reading the whole-game totals.
const lengthPct = (rows: RefRow[]) => {
  const r = rows.find((x) => x.key === "duration");
  const p = r ? rowStats(r).pct : null;
  return p == null ? null : String(Math.round(p * 100));
};

function PersonalFor({ s }: { s: LabSide }) {
  const { t } = useLab();
  const h = t.x.history;
  const rows = useMemo(() => personalRows(s), [s]);
  const p = s.refs.personal;
  if (!p || !rows.length)
    return <p className="text-xs text-muted-foreground">{s.accountId ? h.personalNone : h.personalAnon}</p>;
  const n = p.od.gpm?.n ?? rows[0].d.n;
  const len = lengthPct(rows);
  // STRATZ's parsed games that carry per-minute net worth or last hits (not every parsed game does).
  const early = Math.max(p.parsed.nw10?.n ?? 0, p.parsed.lh10?.n ?? 0);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">
        {[n ? h.personalHint(n) : "", early ? h.parsedHint(early) : ""].filter(Boolean).join(t.insight.sep)}
      </p>
      <RefTable rows={rows} n={n} pro={false} />
      {len && <p className="text-xs text-muted-foreground">{h.totalsNote(len)}</p>}
    </div>
  );
}

function PersonalBlock() {
  const { t } = useLab();
  const h = t.x.history;
  return (
    <Sub title={h.personal}>
      <PerSide>{(k, s) => <PersonalFor s={s} />}</PerSide>
      <p className="text-xs text-muted-foreground">{h.pctNote}</p>
    </Sub>
  );
}

function ProBlock() {
  const { t } = useLab();
  const h = t.x.history;
  const sides = useSides();
  const rows = useMemo(() => sides.map(([k, s]) => ({ k, s, rows: proRows(s) })), [sides]);
  const [ra, rb] = rows;
  const pa = ra.s.refs.pro;
  const pb = rb?.s.refs.pro;
  // The same hero in the same patch: one table with both sides.
  const shared = !!rb && !!pa && !!pb && ra.s.heroId === rb.s.heroId && pa.patch === pb.patch;
  if (shared) {
    const la = lengthPct(ra.rows);
    const lb = lengthPct(rb.rows);
    return (
      <Sub title={h.pro}>
        <p className="text-xs text-muted-foreground">{h.proHint(pa.n, pa.patch)}</p>
        <SharedTable a={ra.rows} b={rb.rows} n={pa.n} />
        {la && lb && (
          <p className="text-xs text-muted-foreground">
            {h.totalsNote(`${t.insight.a} ${la}${t.insight.sep}${t.insight.b} ${lb}`)}
          </p>
        )}
      </Sub>
    );
  }
  return (
    <Sub title={h.pro}>
      <PerSide>
        {(k, s) => {
          const pro = s.refs.pro;
          const list = rows.find((x) => x.k === k)?.rows ?? [];
          if (!pro || !list.length) return <p className="text-xs text-muted-foreground">{h.proNone}</p>;
          const len = lengthPct(list);
          return (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{h.proHint(pro.n, pro.patch)}</p>
              <RefTable rows={list} n={pro.n} pro />
              {len && <p className="text-xs text-muted-foreground">{h.totalsNote(len)}</p>}
            </div>
          );
        }}
      </PerSide>
    </Sub>
  );
}

// ── Against the enemy heroes ─────────────────────────────────────────────────────────────────

// The usual value against this game's; a rate also gets its change (10% or more), coloured when the
// role says which way is better. Game totals get no change: they follow the game's length.
function Change({
  from,
  to,
  higher,
  total,
}: {
  from: number | null;
  to: number;
  higher: boolean | null;
  total?: boolean;
}) {
  if (from == null) return <>–</>;
  const d = from ? to / from - 1 : 0;
  const shown = !total && Math.abs(d) >= 0.1;
  const good = !shown || higher == null ? null : d > 0 === higher;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {num(from, from < 20 ? 1 : 0)} → {num(to)}
      {shown && (
        <span className={cn("ml-1", good == null ? "text-muted-foreground" : good ? TONE.good : TONE.bad)}>
          {d > 0 ? "+" : "−"}
          {Math.abs(Math.round(d * 100))}%
        </span>
      )}
    </span>
  );
}

function VsHeroBlock() {
  const { t } = useLab();
  const h = t.x.history;
  return (
    <Sub title={h.vs} hint={h.vsHint}>
      <PerSide>
        {(k, s) => {
          if (!s.accountId) return <p className="text-xs text-muted-foreground">{h.vsAnon}</p>;
          if (!s.refs.vs.length) return <p className="text-xs text-muted-foreground">{h.vsNone}</p>;
          const threat = s.damage.fromHeroes[0]?.hero ?? null;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <Head left>{h.opponent}</Head>
                    <Head>{h.vsGames}</Head>
                    <Head>{h.vsGpm}</Head>
                    <Head>{h.vsLh}</Head>
                    <Head>{h.vsDeaths}</Head>
                  </tr>
                </thead>
                <tbody>
                  {s.refs.vs.map((raw) => {
                    const v = vsOthers(raw, s);
                    return (
                      <tr key={v.hero} className="border-b last:border-0">
                        <td className="py-1 pr-2">
                          <span className="flex items-center gap-1.5">
                            <HeroIcon id={v.hero} size={18} />
                            <span className="flex flex-col text-[10px] leading-tight text-muted-foreground">
                              {s.laneOpponents.includes(v.hero) && <span>{h.laneTag}</span>}
                              {v.hero === threat && <span>{h.threatTag}</span>}
                            </span>
                          </span>
                        </td>
                        {v.n ? (
                          <>
                            <td className="py-1 text-right whitespace-nowrap tabular-nums">
                              {v.n}
                              <span className="text-muted-foreground">{h.vsWon(pct(v.wins / v.n))}</span>
                            </td>
                            <td className="py-1 text-right">
                              <Change
                                from={v.gpm}
                                to={s.totals.gpm}
                                higher={s.position != null && s.position >= 4 ? null : true}
                              />
                            </td>
                            <td className="py-1 text-right">
                              <Change from={v.lh} to={s.totals.lastHits} higher={null} total />
                            </td>
                            <td className="py-1 text-right">
                              <Change from={v.deaths} to={s.totals.deaths} higher={null} total />
                            </td>
                          </>
                        ) : (
                          <td className="py-1 text-right text-muted-foreground" colSpan={4}>
                            {h.noOther}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }}
      </PerSide>
    </Sub>
  );
}

// ── Win rate by game length ──────────────────────────────────────────────────────────────────

// Bins with fewer games than this are left off the curve.
const BIN_MIN = 30;
const BIN = 300;

function DurationBlock() {
  const { t } = useLab();
  const h = t.x.history;
  const sides = useSides();
  const names = useNames();
  // One curve per hero: grey when both sides share it, else in the side's colour.
  const curves = useMemo(() => {
    const out: { k: SideKey; hero: number; total: number; bins: { t: number; n: number; w: number }[] }[] =
      [];
    for (const [k, s] of sides) {
      const all = s.refs.od?.durations ?? [];
      const bins = all.filter((d) => d.n >= BIN_MIN);
      if (bins.length >= 3 && !out.some((c) => c.hero === s.heroId))
        out.push({ k, hero: s.heroId, total: all.reduce((a, d) => a + d.n, 0), bins });
    }
    return out;
  }, [sides]);
  const option = useMemo<EChartsOption | null>(() => {
    if (!curves.length) return null;
    const single = curves.length === 1;
    // The axis covers whole bins (each point sits in its bin's middle) and both games' lengths.
    const xs = [
      ...curves.flatMap((c) => c.bins.flatMap((b) => [b.t / 60, (b.t + BIN) / 60])),
      ...sides.map(([, s]) => s.duration / 60),
    ];
    return {
      animation: false,
      grid: { left: 40, right: 12, top: 16, bottom: 34 },
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const list = (Array.isArray(params) ? params : [params]) as {
            seriesName: string;
            data: { value: [number, number]; n: number; from: number };
          }[];
          if (!list.length) return "";
          const from = list[0].data.from;
          return [
            h.bin(from, from + BIN / 60),
            ...list.map((p) => h.binLine(p.seriesName, pct(p.data.value[1]), num(p.data.n))),
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "value",
        min: Math.floor(Math.min(...xs) / 5) * 5,
        max: Math.ceil(Math.max(...xs) / 5) * 5,
        name: h.lengthAxis,
        nameLocation: "middle",
        nameGap: 22,
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%`, fontSize: 10 },
        splitLine: { lineStyle: { opacity: 0.3 } },
      },
      series: curves.map((c, i) => ({
        name: names.heroes(c.hero),
        type: "line",
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { width: 2, color: single ? "#9ca3af" : SIDE_COLOR[c.k] },
        itemStyle: { color: single ? "#9ca3af" : SIDE_COLOR[c.k] },
        // A bin covers [t, t + 5 min): its point sits in the middle.
        data: c.bins.map((b) => ({ value: [(b.t + BIN / 2) / 60, b.w / b.n], n: b.n, from: b.t / 60 })),
        markLine:
          i === 0
            ? {
                symbol: "none",
                silent: true,
                data: [
                  {
                    yAxis: 0.5,
                    lineStyle: { color: "#9ca3af", type: "dashed", width: 1 },
                    label: { show: false },
                  },
                  ...sides.map(([k, s]) => ({
                    xAxis: s.duration / 60,
                    lineStyle: { color: SIDE_COLOR[k], type: "solid" as const, width: 2 },
                    label: {
                      formatter: `${k === "a" ? t.insight.a : t.insight.b} ${clock(s.duration)}`,
                      color: SIDE_COLOR[k],
                      fontSize: 10,
                    },
                  })),
                ],
              }
            : undefined,
      })),
    };
  }, [curves, sides, names, h, t.insight.a, t.insight.b]);
  return (
    <Sub
      title={h.durations}
      hint={curves.length ? h.durationsHint(curves.map((c) => num(c.total)).join(" / ")) : undefined}
    >
      {option ? (
        <>
          <div className="h-52 min-w-0">
            <EChart option={option} />
          </div>
          <ul className="flex flex-col gap-0.5 text-xs">
            {sides.map(([k, s]) => {
              const bin = (s.refs.od?.durations ?? []).find(
                (d) => s.duration >= d.t && s.duration < d.t + BIN,
              );
              const who = k === "a" ? t.insight.a : t.insight.b;
              return (
                <li key={k} className="flex items-center gap-1.5">
                  <SideDot side={k} />
                  {bin && bin.n >= BIN_MIN
                    ? h.durationsAt(
                        who,
                        clock(s.duration),
                        bin.t / 60,
                        (bin.t + BIN) / 60,
                        pct(bin.w / bin.n),
                        num(bin.n),
                      )
                    : h.durationsOut(who, clock(s.duration))}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{h.durationsNone}</p>
      )}
    </Sub>
  );
}

// ── The hero in public and pro games ─────────────────────────────────────────────────────────

// The hero's public win rate at the match's medal and its pro picks, wins and bans (OpenDota); the
// rank average's win rate (STRATZ) is in the baseline's reference table.
function useRateLines(s: LabSide) {
  const { t } = useLab();
  const { t: dict } = useLocale();
  const h = t.x.history;
  const od = s.refs.od;
  // OpenDota's bracket is the match's medal (its average rank); with no rank it's unnamed.
  const bracket = s.rank ? medalName(Math.floor(s.rank / 10) * 10, dict.dotahub) : null;
  return [
    // OpenDota keeps no public games for some brackets (Immortal): 0 picks means no data.
    od?.pub?.pick
      ? h.pubLine(bracket, pct(od.pub.win / od.pub.pick, 1), num(od.pub.pick))
      : h.pubNone(bracket),
    od?.pro
      ? h.proLine(od.pro.pick, od.pro.win, od.pro.pick ? pct(od.pro.win / od.pro.pick) : "–", od.pro.ban)
      : "",
  ].filter(Boolean);
}

function RateLines({ s }: { s: LabSide }) {
  const names = useNames();
  const lines = useRateLines(s);
  return (
    <div className="flex items-start gap-2 text-xs">
      <HeroIcon id={s.heroId} size={22} />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{names.heroes(s.heroId)}</span>
        {lines.map((l) => (
          <span key={l} className="text-muted-foreground">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroRatesBlock() {
  const { t, a, b } = useLab();
  const h = t.x.history;
  const la = useRateLines(a);
  const lb = useRateLines(b ?? a);
  // Shown once when both sides would read the same.
  const same = !b || (a.heroId === b.heroId && la.join() === lb.join());
  return (
    <Sub title={h.rates}>
      {same ? <RateLines s={a} /> : <PerSide>{(k, s) => <RateLines s={s} />}</PerSide>}
      <Caveat kind="source">{h.ratesNote(!!a.advanced.baseline || !!b?.advanced.baseline)}</Caveat>
    </Sub>
  );
}

export function RefsBlocks() {
  return (
    <>
      <PersonalBlock />
      <ProBlock />
      <VsHeroBlock />
      <DurationBlock />
      <HeroRatesBlock />
    </>
  );
}

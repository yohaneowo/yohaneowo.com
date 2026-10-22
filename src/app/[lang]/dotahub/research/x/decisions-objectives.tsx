"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import type { LabSide } from "@/lib/dota/lab";
import type { Activity } from "@/lib/dota/lab-extra";
import { clock } from "@/lib/dota/map";
import { cn } from "@/lib/utils";
import { num, pct, xOf } from "../insights";
import {
  Bars,
  Caveat,
  HeroIcon,
  PerSide,
  SIDE_COLOR,
  type SideKey,
  Sub,
  useLab,
  useTimeWindow,
} from "../lab-parts";
import * as C from "./decisions-calc";
import { buildingLabel, objectiveLabel, objectiveWho } from "./decisions-text";

// 局内科研 · decisions, the objectives section: the timeline of every objective with the player's
// distance, building defence and trades, and split pushing.

export const muted = "text-xs text-muted-foreground";
const GOOD = "text-emerald-600 dark:text-emerald-400";
const BAD = "text-red-600 dark:text-red-400";

// ✓ / ✗ / – for a yes-no-unknown reading.
export function Part({ v }: { v: boolean | null | undefined }) {
  const { t } = useLab();
  const x = t.x.decisions;
  if (v == null) return <span className="text-muted-foreground">–</span>;
  return <span className={v ? GOOD : BAD}>{v ? x.yes : x.no}</span>;
}

// What the player was doing, in words (dead first).
export function useDoing() {
  const { t } = useLab();
  return (alive: boolean | null | undefined, a: Activity | null | undefined) =>
    alive === false ? t.deep.activities.dead : a ? t.deep.activities[a] : "–";
}

const heroOfSlot = (s: LabSide, slot: number) => s.match.players.find((p) => p.slot === slot)?.heroId ?? null;

// ── The objective timeline ───────────────────────────────────────────────────────────────────

const SYMBOL: Record<string, string> = {
  building: "rect",
  roshan: "diamond",
  tormentor: "triangle",
  courier: "circle",
};

function ObjectiveChart({ s, rows }: { s: LabSide; rows: C.ObjRow[] }) {
  const { t, align, range } = useLab();
  const x = t.x.decisions;
  const option = useMemo<EChartsOption | null>(() => {
    const data = rows.flatMap((r) => {
      const at = xOf(s, r.o.t, align);
      const y = r.dist ?? r.raw;
      if (at == null || y == null) return [];
      const color = r.ours ? "#22c55e" : "#ef4444";
      return [
        {
          value: [at, y],
          name: `${clock(r.o.t)} ${objectiveLabel(r.o, t)} · ${objectiveWho(r.o, s.radiant, t)}`,
          symbol: SYMBOL[r.o.type] ?? "circle",
          symbolSize: r.o.type === "courier" ? 6 : 9,
          itemStyle:
            r.alive === false ? { color: "transparent", borderColor: color, borderWidth: 1.5 } : { color },
        },
      ];
    });
    if (!data.length) return null;
    return {
      animation: false,
      grid: { left: 48, right: 12, top: 28, bottom: 24 },
      title: { text: x.distAxis, left: 0, top: 0, textStyle: { fontSize: 11, fontWeight: 500 } },
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number[] };
          return `${d.name}<br/>${x.units(num(d.value[1]))}`;
        },
      },
      xAxis: {
        type: "value",
        min: range[0],
        max: range[1],
        axisLabel: {
          fontSize: 10,
          formatter: (v: number) => (align.kind === "level" ? String(v) : String(Math.round(v))),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { opacity: 0.3 } },
      },
      series: [
        {
          type: "scatter",
          data,
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { type: "dashed", color: "#9ca3af" },
            data: [{ yAxis: 2000 }],
          },
        },
      ],
    };
  }, [rows, s, align, range, t, x]);
  if (!option) return null;
  return (
    <div className="h-44 min-w-0">
      <EChart option={option} />
    </div>
  );
}

function ObjectiveSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const doing = useDoing();
  const [from, to] = useTimeWindow(s);
  const rows = useMemo(() => C.objectiveRows(s, from, to), [s, from, to]);
  if (!rows.length) return <p className={muted}>{x.none}</p>;
  const big = rows.filter((r) => r.o.type !== "courier" && r.present != null);
  const took = big.filter((r) => r.ours);
  const lost = big.filter((r) => !r.ours);
  return (
    <div className="flex flex-col gap-2">
      {big.length > 0 ? (
        <p className="text-xs">
          {x.presentLine(
            took.length,
            took.filter((r) => r.present).length,
            lost.length,
            lost.filter((r) => r.present).length,
          )}
        </p>
      ) : (
        <p className={muted}>{x.noPositions}</p>
      )}
      <ObjectiveChart s={s} rows={rows} />
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-normal">{t.fights.time}</th>
              <th className="py-1 font-normal">{x.colObj}</th>
              <th className="py-1 font-normal">{x.colWho}</th>
              <th className="py-1 text-right font-normal">{x.colDistance}</th>
              <th className="py-1 pl-2 font-normal">{x.colState}</th>
              <th className="py-1 font-normal">{x.colPresent}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              // Who took the Aegis, killed the Tormentor or the courier; a courier's bounty.
              const by = r.aegis ?? (r.o.type === "tormentor" || r.o.type === "courier" ? r.o.slot : null);
              return (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 tabular-nums">{clock(r.o.t)}</td>
                  <td className="py-1">
                    <span className="flex items-center gap-1">
                      {objectiveLabel(r.o, t)}
                      {by != null && (
                        <span title={r.aegis != null ? x.aegisBy : x.killedBy}>
                          <HeroIcon id={heroOfSlot(s, by)} size={14} />
                        </span>
                      )}
                      {r.o.type === "courier" && r.o.value != null && (
                        <span className="text-muted-foreground tabular-nums">{x.bounty(num(r.o.value))}</span>
                      )}
                    </span>
                  </td>
                  <td className={cn("py-1", r.ours ? GOOD : BAD)}>{objectiveWho(r.o, s.radiant, t)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {r.dist != null ? `${r.approx ? "~" : ""}${num(r.dist)}` : "–"}
                  </td>
                  <td className="py-1 pl-2 text-muted-foreground">{doing(r.alive, r.activity)}</td>
                  <td className="py-1">
                    <Part v={r.o.type === "courier" ? null : r.present} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ObjectiveTimeline() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.timeline} hint={x.timelineHint}>
      <Caveat kind="estimate">{x.timelineCaveat}</Caveat>
      <PerSide>{(k, s) => <ObjectiveSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── Building defence ─────────────────────────────────────────────────────────────────────────

function DefenseSide({ s }: { s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const doing = useDoing();
  const [from, to] = useTimeWindow(s);
  const d = useMemo(() => C.defense(s, from, to), [s, from, to]);
  const trades = d.trades.length
    ? x.trades(
        d.trades
          .map((p) =>
            x.tradePair(
              `${buildingLabel(p.lost.key, t)} ${clock(p.lost.t)}`,
              `${buildingLabel(p.took.key, t)} ${clock(p.took.t)}`,
            ),
          )
          .join(x.listSep),
      )
    : null;
  if (!s.match.buildings.length || !s.path.t.length)
    return (
      <div className="flex flex-col gap-1">
        <p className={muted}>{x.noPositions}</p>
        {trades && <p className="text-xs">{trades}</p>}
      </div>
    );
  const came = d.list.filter((w) => w.arrival != null);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p>
        {d.list.length
          ? x.defenseLine(d.list.length, came.length, came.filter((w) => w.tp).length, d.lostFarming)
          : x.noDefense}
      </p>
      {d.list.length > 0 && (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-normal">{x.colWindow}</th>
                <th className="py-1 font-normal">{x.colBuilding}</th>
                <th className="py-1 text-right font-normal">{x.colLostHp}</th>
                <th className="py-1 text-right font-normal">{x.colFrom}</th>
                <th className="py-1 pl-2 font-normal">{x.colArrived}</th>
                <th className="py-1 font-normal">{x.colDoing}</th>
              </tr>
            </thead>
            <tbody>
              {d.list.map((w, i) => (
                <tr key={i} className={cn("border-b last:border-0", w.farAway && "bg-red-500/5")}>
                  <td className="py-1 whitespace-nowrap tabular-nums">
                    {clock(w.start)}–{clock(w.end)}
                  </td>
                  <td className="py-1">{buildingLabel(w.b.name, t)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {num(w.lost)}
                    {w.died && <span className={cn("ml-1", BAD)}>{x.fell}</span>}
                  </td>
                  <td className="py-1 text-right tabular-nums">{w.dist != null ? num(w.dist) : "–"}</td>
                  <td className="py-1 pl-2">
                    {w.arrival == null ? (
                      <Part v={false} />
                    ) : w.arrival === 0 ? (
                      x.there
                    ) : (
                      `${x.plus(w.arrival)} · ${w.tp ? x.tp : x.walked}`
                    )}
                  </td>
                  <td className="py-1 text-muted-foreground">{doing(w.alive, w.activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {trades && <p>{trades}</p>}
    </div>
  );
}

function DefenseBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.defense} hint={x.defenseHint}>
      <PerSide>{(k, s) => <DefenseSide s={s} />}</PerSide>
    </Sub>
  );
}

// ── Split pushing ────────────────────────────────────────────────────────────────────────────

function SplitSide({ k, s }: { k: SideKey; s: LabSide }) {
  const { t } = useLab();
  const x = t.x.decisions;
  const doing = useDoing();
  const [from, to] = useTimeWindow(s);
  const sp = useMemo(() => C.splitPush(s, from, to), [s, from, to]);
  if (!sp) return <p className={muted}>{x.noPositions}</p>;
  const total = sp.solo + sp.team;
  return (
    <div className="flex flex-col gap-2 text-xs">
      {total > 0 && (
        <Bars
          color={SIDE_COLOR[k]}
          rows={[
            { key: "solo", label: x.soloDamage, value: sp.solo, note: pct(sp.solo / total) },
            { key: "team", label: x.teamDamage, value: sp.team, note: pct(sp.team / total) },
          ]}
        />
      )}
      <p>
        {x.splitKills(sp.kills, sp.soloKills)}{" "}
        {sp.alive > 0 && x.enemyHalf(clock(sp.enemyHalf), pct(sp.enemyHalf / sp.alive))}
      </p>
      <div>
        <p className="text-muted-foreground">{x.skipped}</p>
        {sp.skipped.length ? (
          <ul className="flex flex-col gap-0.5">
            {sp.skipped.map((f) => (
              <li key={f.i} className="tabular-nums">
                {x.skippedRow(
                  clock(f.start),
                  f.ours,
                  f.theirs,
                  f.dist != null ? x.units(num(f.dist)) : "–",
                  doing(f.alive, f.activity),
                  num(f.hit),
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{x.noSkipped}</p>
        )}
      </div>
    </div>
  );
}

function SplitBlock() {
  const { t } = useLab();
  const x = t.x.decisions;
  return (
    <Sub title={x.split} hint={x.splitHint}>
      <PerSide>{(k, s) => <SplitSide k={k} s={s} />}</PerSide>
    </Sub>
  );
}

export function ObjectivesBlocks() {
  return (
    <>
      <ObjectiveTimeline />
      <DefenseBlock />
      <SplitBlock />
    </>
  );
}
